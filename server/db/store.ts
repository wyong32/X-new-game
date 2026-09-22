import fs from 'fs';
import path from 'path';
import type {
  XQuery,
  XPost,
  GameCandidate,
  AppSettings,
  QueryCategory,
  QueryPriority,
  CandidateStatus,
  CandidateHumanLabel
} from '../../src/types.js';
import { INITIAL_QUERIES } from '../fixtures/seedQueries.js';

interface DatabaseSchema {
  queries: Record<string, XQuery>;
  posts: Record<string, XPost>;
  candidates: Record<string, GameCandidate>;
  settings: AppSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_SETTINGS: AppSettings = {
  x_data_mode: (process.env.X_DATA_MODE as 'mock' | 'live') || 'mock',
  x_bearer_token: process.env.X_BEARER_TOKEN || '',
  gemini_api_key_configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  raw_post_text_retention_days: Number(process.env.RAW_POST_TEXT_RETENTION_DAYS) || 14,
  app_timezone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  max_x_requests_per_run: Number(process.env.MAX_X_REQUESTS_PER_RUN) || 30,
  max_x_posts_per_run: Number(process.env.MAX_X_POSTS_PER_RUN) || 1000,
  max_gemini_extractions_per_run: Number(process.env.MAX_GEMINI_EXTRACTIONS_PER_RUN) || 30
};

class MemoryStore {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = {
      queries: {},
      posts: {},
      candidates: {},
      settings: { ...DEFAULT_SETTINGS }
    };
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          queries: parsed.queries || {},
          posts: parsed.posts || {},
          candidates: parsed.candidates || {},
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
        };
      } else {
        // Initial setup
        this.seedInitialQueries();
        this.saveToDiskSync();
      }
    } catch (err) {
      console.error('Failed to load database from disk, using fresh memory state:', err);
      this.seedInitialQueries();
    }
  }

  public saveToDiskSync() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving database to disk:', err);
    }
  }

  public scheduleDiskSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToDiskSync();
    }, 500);
  }

  public seedInitialQueries() {
    const now = new Date().toISOString();
    for (const q of INITIAL_QUERIES) {
      if (!this.data.queries[q.id]) {
        this.data.queries[q.id] = {
          ...q,
          created_at: now,
          updated_at: now
        };
      }
    }
  }

  // --- QUERIES ---
  public getQueries(): XQuery[] {
    return Object.values(this.data.queries);
  }

  public getQuery(id: string): XQuery | undefined {
    return this.data.queries[id];
  }

  public saveQuery(query: XQuery): XQuery {
    const now = new Date().toISOString();
    query.updated_at = now;
    this.data.queries[query.id] = query;
    this.scheduleDiskSave();
    return query;
  }

  public updateQuery(id: string, partial: Partial<XQuery>): XQuery | undefined {
    const existing = this.data.queries[id];
    if (!existing) return undefined;
    const updated: XQuery = {
      ...existing,
      ...partial,
      updated_at: new Date().toISOString()
    };
    this.data.queries[id] = updated;
    this.scheduleDiskSave();
    return updated;
  }

  // --- POSTS ---
  public getPosts(): XPost[] {
    return Object.values(this.data.posts);
  }

  public getPost(id: string): XPost | undefined {
    return this.data.posts[id];
  }

  public getPostByXId(xPostId: string): XPost | undefined {
    return Object.values(this.data.posts).find(p => p.x_post_id === xPostId);
  }

  public savePost(post: XPost): XPost {
    this.data.posts[post.id] = post;
    this.scheduleDiskSave();
    return post;
  }

  public updatePost(id: string, partial: Partial<XPost>): XPost | undefined {
    const existing = this.data.posts[id];
    if (!existing) return undefined;
    const updated: XPost = {
      ...existing,
      ...partial,
      updated_at: new Date().toISOString()
    };
    this.data.posts[id] = updated;
    this.scheduleDiskSave();
    return updated;
  }

  // --- CANDIDATES ---
  public getCandidates(): GameCandidate[] {
    return Object.values(this.data.candidates);
  }

  public getCandidate(id: string): GameCandidate | undefined {
    return this.data.candidates[id];
  }

  public saveCandidate(candidate: GameCandidate): GameCandidate {
    this.data.candidates[candidate.id] = candidate;
    this.scheduleDiskSave();
    return candidate;
  }

  public updateCandidate(id: string, partial: Partial<GameCandidate>): GameCandidate | undefined {
    const existing = this.data.candidates[id];
    if (!existing) return undefined;
    const updated: GameCandidate = {
      ...existing,
      ...partial,
      updated_at: new Date().toISOString()
    };
    this.data.candidates[id] = updated;
    this.scheduleDiskSave();
    return updated;
  }

  public deleteCandidate(id: string): boolean {
    if (this.data.candidates[id]) {
      delete this.data.candidates[id];
      this.scheduleDiskSave();
      return true;
    }
    return false;
  }

  // --- SETTINGS ---
  public getSettings(): AppSettings {
    this.data.settings.gemini_api_key_configured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    return { ...this.data.settings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.data.settings = {
      ...this.data.settings,
      ...partial
    };
    this.scheduleDiskSave();
    return { ...this.data.settings };
  }

  public resetAll() {
    this.data.posts = {};
    this.data.candidates = {};
    this.data.queries = {};
    this.seedInitialQueries();
    this.saveToDiskSync();
  }
}

export const store = new MemoryStore();
