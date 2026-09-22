import fs from 'fs';
import path from 'path';
import type {
  XQuery,
  XPost,
  GameCandidate,
  CandidateQueryEvidence,
  AppSettings
} from '../../src/types.js';
import { INITIAL_QUERIES } from '../fixtures/seedQueries.js';

interface DatabaseSchema {
  queries: Record<string, XQuery>;
  posts: Record<string, XPost>;
  candidates: Record<string, GameCandidate>;
  candidate_query_evidence: Record<string, CandidateQueryEvidence>;
  settings: AppSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');

function getBaseDefaultSettings(): AppSettings {
  return {
    x_data_mode: (process.env.X_DATA_MODE as 'mock' | 'live') || 'mock',
    x_api_configured: Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim().length > 0),
    gemini_api_key_configured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ),
    gemini_extraction_enabled: process.env.GEMINI_EXTRACTION_ENABLED !== 'false',
    raw_post_text_retention_days: Number(process.env.RAW_POST_TEXT_RETENTION_DAYS) || 14,
    app_timezone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
    max_x_requests_per_run: Number(process.env.MAX_X_REQUESTS_PER_RUN) || 30,
    max_x_posts_per_run: Number(process.env.MAX_X_POSTS_PER_RUN) || 1000,
    max_x_posts_per_query: Number(process.env.MAX_X_POSTS_PER_QUERY) || 100,
    max_gemini_extractions_per_run: Number(process.env.MAX_GEMINI_EXTRACTIONS_PER_RUN) || 30
  };
}

export class MemoryStore {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;
  private customDbFile?: string;

  constructor(customDbFile?: string) {
    this.customDbFile = customDbFile;
    this.data = {
      queries: {},
      posts: {},
      candidates: {},
      candidate_query_evidence: {},
      settings: getBaseDefaultSettings()
    };
    this.loadFromDisk();
  }

  public async init() {
    return Promise.resolve();
  }

  private loadFromDisk() {
    try {
      const targetDir = this.customDbFile ? path.dirname(this.customDbFile) : DATA_DIR;
      const targetFile = this.customDbFile || DB_FILE;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      if (fs.existsSync(targetFile)) {
        const raw = fs.readFileSync(targetFile, 'utf-8');
        const parsed = JSON.parse(raw);

        // Security check: ensure no legacy x_bearer_token lingers in parsed data
        if (parsed.settings && 'x_bearer_token' in parsed.settings) {
          delete parsed.settings.x_bearer_token;
        }

        this.data = {
          queries: parsed.queries || {},
          posts: parsed.posts || {},
          candidates: parsed.candidates || {},
          candidate_query_evidence: parsed.candidate_query_evidence || {},
          settings: {
            ...getBaseDefaultSettings(),
            ...(parsed.settings || {})
          }
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
      const targetDir = this.customDbFile ? path.dirname(this.customDbFile) : DATA_DIR;
      const targetFile = this.customDbFile || DB_FILE;
      const targetTmp = this.customDbFile ? `${this.customDbFile}.tmp` : DB_TMP_FILE;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Scrub any sensitive fields before persisting
      const sanitizedSettings = { ...this.data.settings };
      if ('x_bearer_token' in (sanitizedSettings as any)) {
        delete (sanitizedSettings as any).x_bearer_token;
      }

      const payload = {
        queries: this.data.queries,
        posts: this.data.posts,
        candidates: this.data.candidates,
        candidate_query_evidence: this.data.candidate_query_evidence,
        settings: sanitizedSettings
      };

      // Atomic write pattern: write to tmp file first, then atomic rename
      fs.writeFileSync(targetTmp, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(targetTmp, targetFile);
    } catch (err) {
      console.error('Error saving database atomically to disk:', err);
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
      // Also delete evidence records for this candidate
      for (const [key, ev] of Object.entries(this.data.candidate_query_evidence)) {
        if (ev.candidate_id === id) {
          delete this.data.candidate_query_evidence[key];
        }
      }
      this.scheduleDiskSave();
      return true;
    }
    return false;
  }

  // --- CANDIDATE QUERY EVIDENCE ---
  public getCandidateQueryEvidenceList(): CandidateQueryEvidence[] {
    return Object.values(this.data.candidate_query_evidence);
  }

  public getCandidateQueryEvidence(id: string): CandidateQueryEvidence | undefined {
    return this.data.candidate_query_evidence[id];
  }

  public saveCandidateQueryEvidence(evidence: CandidateQueryEvidence): CandidateQueryEvidence {
    const now = new Date().toISOString();
    evidence.updated_at = now;
    this.data.candidate_query_evidence[evidence.id] = evidence;
    this.scheduleDiskSave();
    return evidence;
  }

  public getCandidateQueryEvidenceByCandidate(candidateId: string): CandidateQueryEvidence[] {
    return Object.values(this.data.candidate_query_evidence).filter(e => e.candidate_id === candidateId);
  }

  public getCandidateQueryEvidenceByQuery(queryId: string): CandidateQueryEvidence[] {
    return Object.values(this.data.candidate_query_evidence).filter(e => e.query_id === queryId);
  }

  // --- SETTINGS ---
  public getSettings(): AppSettings {
    const liveXConfigured = Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim().length > 0);
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );

    this.data.settings.x_api_configured = liveXConfigured;
    this.data.settings.gemini_api_key_configured = geminiConfigured;

    // Ensure no secret is ever in returned settings
    const safeCopy: AppSettings = { ...this.data.settings };
    if ('x_bearer_token' in (safeCopy as any)) {
      delete (safeCopy as any).x_bearer_token;
    }
    return safeCopy;
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    // Strictly reject and strip any attempted secret injection through settings API
    const safePartial = { ...partial };
    if ('x_bearer_token' in (safePartial as any)) {
      delete (safePartial as any).x_bearer_token;
    }

    this.data.settings = {
      ...this.data.settings,
      ...safePartial,
      x_api_configured: Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim().length > 0)
    };
    this.scheduleDiskSave();
    return this.getSettings();
  }

  public resetAll() {
    this.data.posts = {};
    this.data.candidates = {};
    this.data.queries = {};
    this.data.candidate_query_evidence = {};
    this.seedInitialQueries();
    this.saveToDiskSync();
  }
}

export const store = new MemoryStore();
