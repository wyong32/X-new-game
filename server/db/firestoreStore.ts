import { Firestore } from '@google-cloud/firestore';
import type { Store } from './storeInterface.js';
import type {
  XQuery,
  XPost,
  GameCandidate,
  CandidateQueryEvidence,
  AppSettings
} from '../../src/types.js';
import { INITIAL_QUERIES } from '../fixtures/seedQueries.js';

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

/**
 * Sanitizes object before persisting to Firestore.
 * 1. Deeply removes any undefined fields.
 * 2. STRICT SECURITY: Completely strips any x_bearer_token field.
 */
function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Never persist secrets under any circumstances
    if (key === 'x_bearer_token') continue;
    if (value !== undefined) {
      result[key] = typeof value === 'object' && value !== null ? cleanForFirestore(value) : value;
    }
  }
  return result as T;
}

export class FirestoreStore implements Store {
  private db: Firestore;
  private initialized = false;

  constructor() {
    this.db = new Firestore({
      projectId: process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || undefined,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      ignoreUndefinedProperties: true
    });
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 1. Ensure settings document exists
      const settingsRef = this.db.collection('settings').doc('app_settings');
      const settingsSnap = await settingsRef.get();
      if (!settingsSnap.exists) {
        const defaults = getBaseDefaultSettings();
        await settingsRef.set(cleanForFirestore(defaults));
      }

      // 2. Ensure initial seed queries exist if collection is empty
      const queriesSnap = await this.db.collection('queries').limit(1).get();
      if (queriesSnap.empty) {
        const now = new Date().toISOString();
        const batch = this.db.batch();
        for (const q of INITIAL_QUERIES) {
          const docRef = this.db.collection('queries').doc(q.id);
          batch.set(docRef, cleanForFirestore({
            ...q,
            created_at: now,
            updated_at: now
          }));
        }
        await batch.commit();
      }

      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize FirestoreStore:', err);
      throw err;
    }
  }

  // --- QUERIES ---
  public async getQueries(): Promise<XQuery[]> {
    await this.init();
    const snap = await this.db.collection('queries').get();
    return snap.docs.map(d => d.data() as XQuery);
  }

  public async getQuery(id: string): Promise<XQuery | undefined> {
    await this.init();
    const doc = await this.db.collection('queries').doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as XQuery;
  }

  public async saveQuery(query: XQuery): Promise<XQuery> {
    await this.init();
    const now = new Date().toISOString();
    query.updated_at = now;
    await this.db.collection('queries').doc(query.id).set(cleanForFirestore(query));
    return query;
  }

  public async updateQuery(id: string, partial: Partial<XQuery>): Promise<XQuery | undefined> {
    await this.init();
    const existing = await this.getQuery(id);
    if (!existing) return undefined;

    const updated: XQuery = {
      ...existing,
      ...partial,
      updated_at: new Date().toISOString()
    };
    await this.db.collection('queries').doc(id).set(cleanForFirestore(updated));
    return updated;
  }

  // --- POSTS ---
  public async getPosts(): Promise<XPost[]> {
    await this.init();
    const snap = await this.db.collection('posts').get();
    return snap.docs.map(d => d.data() as XPost);
  }

  public async getPost(id: string): Promise<XPost | undefined> {
    await this.init();
    const doc = await this.db.collection('posts').doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as XPost;
  }

  public async getPostByXId(xPostId: string): Promise<XPost | undefined> {
    await this.init();
    const snap = await this.db.collection('posts').where('x_post_id', '==', xPostId).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data() as XPost;
  }

  public async savePost(post: XPost): Promise<XPost> {
    await this.init();
    await this.db.collection('posts').doc(post.id).set(cleanForFirestore(post));
    return post;
  }

  public async updatePost(id: string, partial: Partial<XPost>): Promise<XPost | undefined> {
    await this.init();
    const existing = await this.getPost(id);
    if (!existing) return undefined;

    const updated: XPost = {
      ...existing,
      ...partial,
      updated_at: new Date().toISOString()
    };
    await this.db.collection('posts').doc(id).set(cleanForFirestore(updated));
    return updated;
  }

  // --- CANDIDATES ---
  public async getCandidates(): Promise<GameCandidate[]> {
    await this.init();
    const snap = await this.db.collection('candidates').get();
    return snap.docs.map(d => d.data() as GameCandidate);
  }

  public async getCandidate(id: string): Promise<GameCandidate | undefined> {
    await this.init();
    const doc = await this.db.collection('candidates').doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as GameCandidate;
  }

  public async saveCandidate(candidate: GameCandidate): Promise<GameCandidate> {
    await this.init();
    await this.db.collection('candidates').doc(candidate.id).set(cleanForFirestore(candidate));
    return candidate;
  }

  public async updateCandidate(id: string, partial: Partial<GameCandidate>): Promise<GameCandidate | undefined> {
    await this.init();
    const existing = await this.getCandidate(id);
    if (!existing) return undefined;

    const updated: GameCandidate = {
      ...existing,
      ...partial,
      updated_at: new Date().toISOString()
    };
    await this.db.collection('candidates').doc(id).set(cleanForFirestore(updated));
    return updated;
  }

  public async deleteCandidate(id: string): Promise<boolean> {
    await this.init();
    await this.db.collection('candidates').doc(id).delete();

    // Cascade delete evidence records
    const evidenceSnap = await this.db
      .collection('candidate_query_evidence')
      .where('candidate_id', '==', id)
      .get();

    if (!evidenceSnap.empty) {
      const batch = this.db.batch();
      for (const doc of evidenceSnap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
    return true;
  }

  // --- CANDIDATE QUERY EVIDENCE ---
  public async getCandidateQueryEvidenceList(): Promise<CandidateQueryEvidence[]> {
    await this.init();
    const snap = await this.db.collection('candidate_query_evidence').get();
    return snap.docs.map(d => d.data() as CandidateQueryEvidence);
  }

  public async getCandidateQueryEvidence(id: string): Promise<CandidateQueryEvidence | undefined> {
    await this.init();
    const doc = await this.db.collection('candidate_query_evidence').doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as CandidateQueryEvidence;
  }

  public async saveCandidateQueryEvidence(evidence: CandidateQueryEvidence): Promise<CandidateQueryEvidence> {
    await this.init();
    const now = new Date().toISOString();
    evidence.updated_at = now;
    await this.db.collection('candidate_query_evidence').doc(evidence.id).set(cleanForFirestore(evidence));
    return evidence;
  }

  public async getCandidateQueryEvidenceByCandidate(candidateId: string): Promise<CandidateQueryEvidence[]> {
    await this.init();
    const snap = await this.db
      .collection('candidate_query_evidence')
      .where('candidate_id', '==', candidateId)
      .get();
    return snap.docs.map(d => d.data() as CandidateQueryEvidence);
  }

  public async getCandidateQueryEvidenceByQuery(queryId: string): Promise<CandidateQueryEvidence[]> {
    await this.init();
    const snap = await this.db
      .collection('candidate_query_evidence')
      .where('query_id', '==', queryId)
      .get();
    return snap.docs.map(d => d.data() as CandidateQueryEvidence);
  }

  // --- SETTINGS ---
  public async getSettings(): Promise<AppSettings> {
    await this.init();
    const doc = await this.db.collection('settings').doc('app_settings').get();
    const base = getBaseDefaultSettings();
    const stored = doc.exists ? (doc.data() as Partial<AppSettings>) : {};

    const liveXConfigured = Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim().length > 0);
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );

    const safeSettings: AppSettings = {
      ...base,
      ...stored,
      x_api_configured: liveXConfigured,
      gemini_api_key_configured: geminiConfigured
    };

    // STRICT: Ensure token is never present in settings object
    if ('x_bearer_token' in (safeSettings as any)) {
      delete (safeSettings as any).x_bearer_token;
    }

    return safeSettings;
  }

  public async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    await this.init();
    // Strictly strip any attempted token injection
    const safePartial = { ...partial };
    if ('x_bearer_token' in (safePartial as any)) {
      delete (safePartial as any).x_bearer_token;
    }

    const current = await this.getSettings();
    const merged: AppSettings = {
      ...current,
      ...safePartial,
      x_api_configured: Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim().length > 0)
    };

    if ('x_bearer_token' in (merged as any)) {
      delete (merged as any).x_bearer_token;
    }

    await this.db.collection('settings').doc('app_settings').set(cleanForFirestore(merged));
    return this.getSettings();
  }

  // --- RESET ---
  public async resetAll(): Promise<void> {
    await this.init();
    const collections = ['posts', 'candidates', 'candidate_query_evidence', 'queries'];
    for (const colName of collections) {
      const snap = await this.db.collection(colName).get();
      if (!snap.empty) {
        const batch = this.db.batch();
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    // Re-seed initial queries
    const now = new Date().toISOString();
    const batch = this.db.batch();
    for (const q of INITIAL_QUERIES) {
      const docRef = this.db.collection('queries').doc(q.id);
      batch.set(docRef, cleanForFirestore({
        ...q,
        created_at: now,
        updated_at: now
      }));
    }
    await batch.commit();
  }
}
