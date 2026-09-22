export type QueryCategory =
  | 'RELEASE'
  | 'BROWSER'
  | 'INDIE_LAUNCH'
  | 'GAME_JAM'
  | 'VIRAL'
  | 'UNKNOWN_GAME';

export type QueryPriority = 'P1' | 'P2' | 'P3';

export type QueryHealth =
  | 'EXCELLENT'
  | 'GOOD'
  | 'WATCH'
  | 'POOR'
  | 'INSUFFICIENT_DATA'
  | 'ERROR';

export interface XQuery {
  id: string;
  name: string;
  query_text: string;
  category: QueryCategory;
  priority: QueryPriority;
  initial_confidence: number;
  enabled: boolean;
  run_frequency_minutes: number;
  last_since_id?: string;
  last_run_at?: string;
  last_status?: 'SUCCESS' | 'ERROR' | 'IDLE';
  last_error?: string;
  posts_collected: number;
  posts_passed_filter: number;
  candidates_generated: number;
  human_validated_games: number;
  human_rejected: number;
  valuable_new_games: number;
  precision: number;
  created_at: string;
  updated_at: string;
}

export type ExtractionMethod =
  | 'URL_SLUG'
  | 'URL_METADATA'
  | 'EXPLICIT_PATTERN'
  | 'HASHTAG'
  | 'HEURISTIC'
  | 'GEMINI'
  | 'MANUAL';

export type PostHumanLabel =
  | 'GOOD_DISCOVERY_POST'
  | 'REAL_GAME_BUT_NOT_NEW'
  | 'GENERAL_GAMEDEV'
  | 'PROMOTION_SPAM'
  | 'TUTORIAL'
  | 'JOB'
  | 'NOISE'
  | 'UNSURE';

export interface XPost {
  id: string;
  x_post_id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
  fetched_at: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  quote_count: number;
  urls: string[];
  hashtags: string[];
  has_media: boolean;
  media_types: string[];
  query_ids: string[];
  hard_filter_status: 'PASSED' | 'REJECTED';
  hard_filter_reasons?: string[];
  game_context_score: number;
  game_context_positive_reasons: string[];
  game_context_negative_reasons: string[];
  extracted_game_name?: string | null;
  extraction_method?: ExtractionMethod;
  extraction_confidence?: number;
  extraction_status?: 'COMPLETED' | 'PENDING_EXTRACTION' | 'SKIPPED';
  candidate_processed: boolean;
  candidate_id?: string;
  human_post_label?: PostHumanLabel;
  created_at_db: string;
  updated_at: string;
}

export type CandidateStatus =
  | 'HIGH_CONFIDENCE'
  | 'REVIEW'
  | 'WEAK'
  | 'NOISE'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'DUPLICATE';

export type CandidateHumanLabel =
  | 'VALUABLE_NEW_GAME'
  | 'VALID_GAME'
  | 'NOT_A_GAME'
  | 'OLD_GAME'
  | 'NOISE'
  | 'WRONG_GAME_NAME'
  | 'DUPLICATE'
  | 'GAME_NOT_TARGET'
  | 'UNSURE';

export interface ScoreFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface CandidateQueryEvidence {
  id: string; // `${candidate_id}__${query_id}`
  candidate_id: string;
  query_id: string;
  first_seen_at: string;
  post_count: number;
  unique_author_count: number;
  is_first_discovery: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameCandidate {
  id: string;
  canonical_name: string;
  normalized_name: string;
  aliases: string[];
  first_seen_at: string;
  last_seen_at: string;
  first_query_id: string;
  first_discovery_query_id: string;
  source_post_ids: string[];
  source_query_ids: string[];
  unique_post_count: number;
  unique_author_count: number;
  max_engagement: number;
  browser_signal: boolean;
  browser_confidence: number;
  entity_confidence: number;
  candidate_score: number;
  status: CandidateStatus;
  extraction_method: ExtractionMethod;
  human_label?: CandidateHumanLabel;
  human_notes?: string;
  labeled_at?: string;
  merged_into_candidate_id?: string;
  score_breakdown: ScoreFactor[];
  why_selected: string[];
  urls: string[];
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  x_data_mode: 'mock' | 'live';
  x_api_configured: boolean;
  gemini_api_key_configured: boolean;
  gemini_extraction_enabled: boolean;
  raw_post_text_retention_days: number;
  app_timezone: string;
  max_x_requests_per_run: number;
  max_x_posts_per_run: number;
  max_x_posts_per_query: number;
  max_gemini_extractions_per_run: number;
}

export interface QueryAnalyticsSummary {
  query_id: string;
  query_name: string;
  query_text: string;
  category: QueryCategory;
  priority: QueryPriority;
  health: QueryHealth;
  total_posts: number;
  posts_passed: number;
  pass_rate: number;
  candidates_generated: number;
  first_discovery_candidates_count: number;
  first_discovery_valuable_games: number;
  human_reviewed_candidates: number;
  human_valid_games: number;
  valuable_new_games: number;
  rejected_candidates: number;
  unsure_candidates: number;
  duplicate_candidates: number;
  unreviewed_candidates: number;
  precision_valid_game: number;
  validation_precision: number;
  precision_valuable_new_game: number;
  first_discovery_valuable_yield_per_1k_posts: number;
  posts_per_valid_game: number;
  posts_per_valuable_game: number;
  yield_valuable_per_1k_posts: number;
}
