import type {
  XQuery,
  XPost,
  GameCandidate,
  CandidateQueryEvidence,
  AppSettings
} from '../../src/types.js';

export interface Store {
  init(): Promise<void>;

  // Queries
  getQueries(): Promise<XQuery[]>;
  getQuery(id: string): Promise<XQuery | undefined>;
  saveQuery(query: XQuery): Promise<XQuery>;
  updateQuery(id: string, partial: Partial<XQuery>): Promise<XQuery | undefined>;

  // Posts
  getPosts(): Promise<XPost[]>;
  getPost(id: string): Promise<XPost | undefined>;
  getPostByXId(xPostId: string): Promise<XPost | undefined>;
  savePost(post: XPost): Promise<XPost>;
  updatePost(id: string, partial: Partial<XPost>): Promise<XPost | undefined>;

  // Candidates
  getCandidates(): Promise<GameCandidate[]>;
  getCandidate(id: string): Promise<GameCandidate | undefined>;
  saveCandidate(candidate: GameCandidate): Promise<GameCandidate>;
  updateCandidate(id: string, partial: Partial<GameCandidate>): Promise<GameCandidate | undefined>;
  deleteCandidate(id: string): Promise<boolean>;

  // Candidate Query Evidence
  getCandidateQueryEvidenceList(): Promise<CandidateQueryEvidence[]>;
  getCandidateQueryEvidence(id: string): Promise<CandidateQueryEvidence | undefined>;
  saveCandidateQueryEvidence(evidence: CandidateQueryEvidence): Promise<CandidateQueryEvidence>;
  getCandidateQueryEvidenceByCandidate(candidateId: string): Promise<CandidateQueryEvidence[]>;
  getCandidateQueryEvidenceByQuery(queryId: string): Promise<CandidateQueryEvidence[]>;

  // Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;

  // Reset
  resetAll(): Promise<void>;
}
