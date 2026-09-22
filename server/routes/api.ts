import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';
import { runQuery, runBatchQueries, type RunQueryResult } from '../services/queryRunner.js';
import {
  computeCandidateScore,
  determineCandidateStatus
} from '../services/candidateService.js';
import { normalizeGameName, cleanCanonicalTitle } from '../services/normalization.js';
import {
  authGuard,
  getAppPassword,
  createSession,
  invalidateSession,
  isValidSession,
  parseCookie,
  getClientIp,
  checkRateLimit,
  recordFailedLogin,
  resetFailedLogin
} from '../services/auth.js';
import type {
  XPost,
  CandidateHumanLabel,
  PostHumanLabel,
  QueryCategory,
  QueryPriority,
  QueryHealth,
  QueryAnalyticsSummary,
  CandidateQueryEvidence
} from '../../src/types.js';

export const apiRouter = Router();

// =================================================================
// 0. AUTHENTICATION (P0 SECURITY GUARD - HTTPONLY COOKIE ONLY)
// =================================================================

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    const minutesLeft = Math.ceil((rateLimit.remainingLockMs || 0) / 60000);
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please try again in ${minutesLeft} minute(s).`
    });
  }

  const { password } = req.body;
  const expected = getAppPassword();

  // P0-5: APP_PASSWORD must have NO fallback; if empty, always reject
  if (!expected || expected.trim() === '' || !password || password !== expected) {
    recordFailedLogin(ip);
    return res.status(401).json({ success: false, error: 'Invalid lab password' });
  }

  resetFailedLogin(ip);
  const token = createSession();
  const isProd = process.env.NODE_ENV === 'production';

  // P0-5: HttpOnly cookie session only, strict sameSite, secure in production
  res.cookie('lab_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // P0-5: Do NOT return auth token in JSON!
  res.json({
    success: true,
    message: 'Authenticated successfully'
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const cookies = parseCookie(req.headers.cookie);
  if (cookies.lab_session) {
    invalidateSession(cookies.lab_session);
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    invalidateSession(authHeader.substring(7).trim());
  }

  res.clearCookie('lab_session', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

apiRouter.get('/auth/status', (req: Request, res: Response) => {
  let authenticated = false;

  const cookies = parseCookie(req.headers.cookie);
  if (cookies.lab_session && isValidSession(cookies.lab_session)) {
    authenticated = true;
  }

  if (!authenticated) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authenticated = isValidSession(authHeader.substring(7).trim());
    }
  }

  // P0-5: auth_token query parameter support is STRICTLY removed
  res.json({ authenticated });
});

// Protect all subsequent API endpoints
apiRouter.use(authGuard);

// =================================================================
// 1. APP STATUS & OVERVIEW
// =================================================================

apiRouter.get('/status', async (req: Request, res: Response) => {
  const settings = await store.getSettings();
  const queries = await store.getQueries();
  const posts = await store.getPosts();
  const candidates = await store.getCandidates();

  const passedPosts = posts.filter(p => p.hard_filter_status === 'PASSED');
  const highConf = candidates.filter(c => c.candidate_score >= 80);

  // Standardized review counts (excluding UNSURE and DUPLICATE)
  const valuableNew = candidates.filter(c => c.human_label === 'VALUABLE_NEW_GAME');
  const validGames = candidates.filter(
    c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
  );
  const rejected = candidates.filter(
    c =>
      c.human_label === 'NOT_A_GAME' ||
      c.human_label === 'OLD_GAME' ||
      c.human_label === 'NOISE' ||
      c.human_label === 'WRONG_GAME_NAME' ||
      c.human_label === 'GAME_NOT_TARGET'
  );
  const standardReviewed = validGames.length + rejected.length;

  const noiseRate = posts.length > 0
    ? Math.round(((posts.length - passedPosts.length) / posts.length) * 100)
    : 0;

  const valuableNewPrecision = standardReviewed > 0
    ? Math.round((valuableNew.length / standardReviewed) * 100)
    : 0;

  const candidatePrecision = standardReviewed > 0
    ? Math.round((validGames.length / standardReviewed) * 100)
    : 0;

  const usefulYieldPer1k = posts.length > 0
    ? Number(((valuableNew.length / posts.length) * 1000).toFixed(1))
    : 0;

  res.json({
    mode: settings.x_data_mode,
    x_api_configured: settings.x_api_configured,
    gemini_ready: settings.gemini_api_key_configured,
    gemini_extraction_enabled: settings.gemini_extraction_enabled,
    total_queries: queries.length,
    enabled_queries: queries.filter(q => q.enabled).length,
    total_posts: posts.length,
    passed_posts: passedPosts.length,
    total_candidates: candidates.length,
    high_confidence_candidates: highConf.length,
    reviewed_candidates: standardReviewed,
    unsure_candidates: candidates.filter(c => c.human_label === 'UNSURE').length,
    duplicate_candidates: candidates.filter(c => c.human_label === 'DUPLICATE').length,
    valuable_new_games: valuableNew.length,
    valid_games: validGames.length,
    noise_rate_pct: noiseRate,
    valuable_new_precision_pct: valuableNewPrecision,
    candidate_precision_pct: candidatePrecision,
    useful_yield_per_1k: usefulYieldPer1k,
    settings
  });
});

// =================================================================
// 2. QUERY MANAGEMENT
// =================================================================

apiRouter.get('/queries', async (req: Request, res: Response) => {
  const queries = await store.getQueries();
  res.json(queries);
});

apiRouter.post('/queries', async (req: Request, res: Response) => {
  const { name, query_text, category, priority, run_frequency_minutes, initial_confidence } = req.body;
  if (!query_text) {
    return res.status(400).json({ error: 'query_text is required' });
  }

  const id = `q_custom_${Date.now()}`;
  const now = new Date().toISOString();
  const newQuery = await store.saveQuery({
    id,
    name: name || query_text,
    query_text,
    category: (category as QueryCategory) || 'RELEASE',
    priority: (priority as QueryPriority) || 'P2',
    initial_confidence: Number(initial_confidence) || 0.7,
    enabled: true,
    run_frequency_minutes: Number(run_frequency_minutes) || 120,
    posts_collected: 0,
    posts_passed_filter: 0,
    candidates_generated: 0,
    human_validated_games: 0,
    human_rejected: 0,
    valuable_new_games: 0,
    precision: 0,
    created_at: now,
    updated_at: now
  });

  res.json(newQuery);
});

apiRouter.patch('/queries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await store.updateQuery(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Query not found' });
  }
  res.json(updated);
});

apiRouter.post('/queries/:id/run', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await runQuery(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/queries/:id/reset', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await store.updateQuery(id, {
    posts_collected: 0,
    posts_passed_filter: 0,
    candidates_generated: 0,
    human_validated_games: 0,
    human_rejected: 0,
    valuable_new_games: 0,
    precision: 0,
    last_since_id: undefined,
    pending_next_token: undefined,
    pagination_since_id: undefined,
    pagination_newest_id: undefined,
    pagination_started_at: undefined,
    last_status: 'IDLE',
    last_error: undefined
  });
  res.json(updated);
});

// P0-3: Run batch using global RunBudget shared across all queries
apiRouter.post('/queries/run-batch', async (req: Request, res: Response) => {
  const { filter } = req.body;
  try {
    const batchResult = await runBatchQueries(filter);
    res.json(batchResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// 3. RAW POSTS EXPLORER
// =================================================================

apiRouter.get('/posts', async (req: Request, res: Response) => {
  let posts = await store.getPosts();

  const { query_id, hard_filter_status, min_score, has_url, has_media, label, search } = req.query;

  if (query_id) {
    posts = posts.filter(p => p.query_ids.includes(String(query_id)));
  }
  if (hard_filter_status) {
    posts = posts.filter(p => p.hard_filter_status === String(hard_filter_status));
  }
  if (min_score) {
    posts = posts.filter(p => p.game_context_score >= Number(min_score));
  }
  if (has_url === 'true') {
    posts = posts.filter(p => p.urls.length > 0);
  }
  if (has_media === 'true') {
    posts = posts.filter(p => p.has_media);
  }
  if (label) {
    posts = posts.filter(p => p.human_post_label === String(label));
  }
  if (search) {
    const term = String(search).toLowerCase();
    posts = posts.filter(
      p =>
        p.text.toLowerCase().includes(term) ||
        p.author_username.toLowerCase().includes(term) ||
        (p.extracted_game_name && p.extracted_game_name.toLowerCase().includes(term))
    );
  }

  posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(posts);
});

apiRouter.get('/posts/:id', async (req: Request, res: Response) => {
  const post = await store.getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

apiRouter.patch('/posts/:id', async (req: Request, res: Response) => {
  const { human_post_label } = req.body;
  const updated = await store.updatePost(req.params.id, {
    human_post_label: human_post_label as PostHumanLabel
  });
  if (!updated) return res.status(404).json({ error: 'Post not found' });
  res.json(updated);
});

// =================================================================
// 4. GAME CANDIDATES & QUERY ATTRIBUTION
// =================================================================

apiRouter.get('/candidates', async (req: Request, res: Response) => {
  let candidates = await store.getCandidates();

  const { status, browser_signal, reviewed_only, unreviewed_only, search, sort } = req.query;

  if (status) {
    candidates = candidates.filter(c => c.status === String(status));
  }
  if (browser_signal === 'true') {
    candidates = candidates.filter(c => c.browser_signal);
  }
  if (reviewed_only === 'true') {
    candidates = candidates.filter(c => Boolean(c.human_label));
  }
  if (unreviewed_only === 'true') {
    candidates = candidates.filter(c => !c.human_label);
  }
  if (search) {
    const term = String(search).toLowerCase();
    candidates = candidates.filter(
      c =>
        c.canonical_name.toLowerCase().includes(term) ||
        c.aliases.some(a => a.toLowerCase().includes(term))
    );
  }

  if (sort === 'score_desc' || !sort) {
    candidates.sort((a, b) => b.candidate_score - a.candidate_score);
  } else if (sort === 'newest') {
    candidates.sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
  } else if (sort === 'authors_desc') {
    candidates.sort((a, b) => b.unique_author_count - a.unique_author_count);
  } else if (sort === 'engagement_desc') {
    candidates.sort((a, b) => b.max_engagement - a.max_engagement);
  }

  res.json(candidates);
});

apiRouter.get('/candidates/:id', async (req: Request, res: Response) => {
  const candidate = await store.getCandidate(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const posts = (
    await Promise.all(candidate.source_post_ids.map(pid => store.getPost(pid)))
  ).filter(Boolean);

  const queries = (
    await Promise.all(candidate.source_query_ids.map(qid => store.getQuery(qid)))
  ).filter(Boolean);

  const evidence = await store.getCandidateQueryEvidenceByCandidate(candidate.id);

  res.json({
    ...candidate,
    posts,
    queries,
    evidence
  });
});

apiRouter.get('/candidates/:id/evidence', async (req: Request, res: Response) => {
  const evidence = await store.getCandidateQueryEvidenceByCandidate(req.params.id);
  res.json(evidence);
});

apiRouter.patch('/candidates/:id', async (req: Request, res: Response) => {
  const { human_label, human_notes, canonical_name, aliases, status } = req.body;
  const candidate = await store.getCandidate(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const now = new Date().toISOString();
  const partial: Partial<typeof candidate> = {};

  if (human_label !== undefined) {
    partial.human_label = human_label as CandidateHumanLabel;
    partial.labeled_at = now;
    if (human_label === 'VALUABLE_NEW_GAME' || human_label === 'VALID_GAME') {
      partial.status = 'CONFIRMED';
    } else if (
      human_label === 'NOT_A_GAME' ||
      human_label === 'OLD_GAME' ||
      human_label === 'NOISE' ||
      human_label === 'WRONG_GAME_NAME'
    ) {
      partial.status = 'REJECTED';
    }
  }

  if (human_notes !== undefined) {
    partial.human_notes = human_notes;
  }
  if (status !== undefined) {
    partial.status = status;
  }
  if (canonical_name) {
    partial.canonical_name = cleanCanonicalTitle(canonical_name);
    partial.normalized_name = normalizeGameName(partial.canonical_name);
  }
  if (aliases && Array.isArray(aliases)) {
    partial.aliases = aliases;
  }

  const updated = await store.updateCandidate(candidate.id, partial);

  // Recalculate query precision stats for source queries
  for (const qid of candidate.source_query_ids) {
    const q = await store.getQuery(qid);
    if (q) {
      const allCands = await store.getCandidates();
      const associatedCands = allCands.filter(c => c.source_query_ids.includes(qid));
      const validCount = associatedCands.filter(
        c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
      ).length;
      const rejectedCount = associatedCands.filter(
        c =>
          c.human_label === 'NOT_A_GAME' ||
          c.human_label === 'OLD_GAME' ||
          c.human_label === 'NOISE' ||
          c.human_label === 'WRONG_GAME_NAME' ||
          c.human_label === 'GAME_NOT_TARGET'
      ).length;
      const valNew = associatedCands.filter(c => c.human_label === 'VALUABLE_NEW_GAME').length;
      const totalReviewed = validCount + rejectedCount;
      const prec = totalReviewed > 0 ? Math.round((validCount / totalReviewed) * 100) : 0;

      await store.updateQuery(qid, {
        human_validated_games: validCount,
        human_rejected: rejectedCount,
        valuable_new_games: valNew,
        precision: prec
      });
    }
  }

  res.json(updated);
});

apiRouter.post('/candidates/:id/merge', async (req: Request, res: Response) => {
  const source = await store.getCandidate(req.params.id);
  const { target_id } = req.body;
  const target = await store.getCandidate(target_id);

  if (!source || !target) {
    return res.status(404).json({ error: 'Source or target candidate not found' });
  }

  for (const pid of source.source_post_ids) {
    if (!target.source_post_ids.includes(pid)) {
      target.source_post_ids.push(pid);
    }
    const p = await store.getPost(pid);
    if (p) {
      p.candidate_id = target.id;
      await store.savePost(p);
    }
  }

  for (const qid of source.source_query_ids) {
    if (!target.source_query_ids.includes(qid)) {
      target.source_query_ids.push(qid);
    }
  }

  for (const u of source.urls) {
    if (!target.urls.includes(u)) {
      target.urls.push(u);
    }
  }

  if (source.canonical_name !== target.canonical_name && !target.aliases.includes(source.canonical_name)) {
    target.aliases.push(source.canonical_name);
  }
  for (const a of source.aliases) {
    if (!target.aliases.includes(a)) {
      target.aliases.push(a);
    }
  }

  const contributingPosts: XPost[] = (
    await Promise.all(target.source_post_ids.map(pid => store.getPost(pid)))
  ).filter((p): p is XPost => Boolean(p));

  const hasBrowser = contributingPosts.some(
    (p: XPost) =>
      p.game_context_positive_reasons.some((r: string) => r.includes('Browser/web')) ||
      p.urls.some((u: string) => /(?:poki|crazygames|html5|webgl)/i.test(u))
  );

  const scored = computeCandidateScore({
    canonical_name: target.canonical_name,
    normalized_name: target.normalized_name,
    posts: contributingPosts,
    extraction_method: target.extraction_method,
    browser_signal: hasBrowser
  });

  target.candidate_score = scored.candidate_score;
  target.entity_confidence = scored.entity_confidence;
  target.browser_confidence = scored.browser_confidence;
  target.browser_signal = hasBrowser;
  target.score_breakdown = scored.score_breakdown;
  target.why_selected = scored.why_selected;
  target.unique_post_count = contributingPosts.length;
  target.unique_author_count = new Set(contributingPosts.map((p: XPost) => p.author_id)).size;
  target.max_engagement = Math.max(...contributingPosts.map((p: XPost) => p.like_count + p.repost_count), 0);

  await store.saveCandidate(target);

  // Mark source candidate as DUPLICATE and merged
  await store.updateCandidate(source.id, {
    status: 'DUPLICATE',
    human_label: 'DUPLICATE',
    merged_into_candidate_id: target.id
  });

  res.json({ target, source });
});

// =================================================================
// 5. QUERY ANALYTICS & HONEST PRECISION REPORTING
// =================================================================

apiRouter.get('/analytics/queries', async (req: Request, res: Response) => {
  const queries = await store.getQueries();
  const allPosts = await store.getPosts();
  const allCandidates = await store.getCandidates();

  const summaries: QueryAnalyticsSummary[] = queries.map(q => {
    const qPosts = allPosts.filter(p => p.query_ids.includes(q.id));
    const passed = qPosts.filter(p => p.hard_filter_status === 'PASSED');
    const qCandidates = allCandidates.filter(c => c.source_query_ids.includes(q.id));

    // Attribution: First Discovery counts
    const firstDiscoveryCandidates = allCandidates.filter(c => c.first_discovery_query_id === q.id);
    const firstDiscoveryValuable = firstDiscoveryCandidates.filter(
      c => c.human_label === 'VALUABLE_NEW_GAME'
    );

    // Standardized reviews:
    const validGames = qCandidates.filter(
      c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
    );
    const valuableNew = qCandidates.filter(c => c.human_label === 'VALUABLE_NEW_GAME');
    const rejected = qCandidates.filter(
      c =>
        c.human_label === 'NOT_A_GAME' ||
        c.human_label === 'OLD_GAME' ||
        c.human_label === 'NOISE' ||
        c.human_label === 'WRONG_GAME_NAME' ||
        c.human_label === 'GAME_NOT_TARGET'
    );

    // Explicit non-evaluated or unsure counts
    const unsureCount = qCandidates.filter(c => c.human_label === 'UNSURE').length;
    const duplicateCount = qCandidates.filter(c => c.human_label === 'DUPLICATE').length;
    const unreviewedCount = qCandidates.filter(c => !c.human_label).length;

    // Standardized review denominator = valid + rejected (excludes UNSURE, DUPLICATE, UNREVIEWED)
    const standardReviewedCount = validGames.length + rejected.length;

    const passRate = qPosts.length > 0 ? Number(((passed.length / qPosts.length) * 100).toFixed(1)) : 0;

    const precisionValid = standardReviewedCount > 0
      ? Number(((validGames.length / standardReviewedCount) * 100).toFixed(1))
      : 0;

    const precisionValuable = standardReviewedCount > 0
      ? Number(((valuableNew.length / standardReviewedCount) * 100).toFixed(1))
      : 0;

    const postsPerValid = validGames.length > 0
      ? Number((qPosts.length / validGames.length).toFixed(1))
      : 0;
    const postsPerValuable = valuableNew.length > 0
      ? Number((qPosts.length / valuableNew.length).toFixed(1))
      : 0;

    const yieldPer1k = qPosts.length > 0
      ? Number(((valuableNew.length / qPosts.length) * 1000).toFixed(1))
      : 0;

    // First Discovery Valuable Yield / 1000 Posts = (first_discovery_valuable_games / posts_collected) * 1000
    const firstDiscoveryYieldPer1k = qPosts.length > 0
      ? Number(((firstDiscoveryValuable.length / qPosts.length) * 1000).toFixed(1))
      : 0;

    // Health calculation
    let health: QueryHealth = 'INSUFFICIENT_DATA';
    if (q.last_status === 'ERROR') {
      health = 'ERROR';
    } else if (standardReviewedCount < 2 && qPosts.length < 5) {
      health = 'INSUFFICIENT_DATA';
    } else if (precisionValuable >= 40 && passRate >= 60) {
      health = 'EXCELLENT';
    } else if (precisionValid >= 55 && passRate >= 40) {
      health = 'GOOD';
    } else if (precisionValid < 30 || passRate < 25) {
      health = 'POOR';
    } else {
      health = 'WATCH';
    }

    return {
      query_id: q.id,
      query_name: q.name,
      query_text: q.query_text,
      category: q.category,
      priority: q.priority,
      health,
      total_posts: qPosts.length,
      posts_passed: passed.length,
      pass_rate: passRate,
      candidates_generated: qCandidates.length,
      first_discovery_candidates_count: firstDiscoveryCandidates.length,
      first_discovery_valuable_games: firstDiscoveryValuable.length,
      human_reviewed_candidates: standardReviewedCount,
      human_valid_games: validGames.length,
      valuable_new_games: valuableNew.length,
      rejected_candidates: rejected.length,
      unsure_candidates: unsureCount,
      duplicate_candidates: duplicateCount,
      unreviewed_candidates: unreviewedCount,
      precision_valid_game: precisionValid,
      validation_precision: precisionValid,
      precision_valuable_new_game: precisionValuable,
      first_discovery_valuable_yield_per_1k_posts: firstDiscoveryYieldPer1k,
      posts_per_valid_game: postsPerValid,
      posts_per_valuable_game: postsPerValuable,
      yield_valuable_per_1k_posts: yieldPer1k
    };
  });

  const bestByValuableYield = [...summaries]
    .filter(s => s.total_posts > 0)
    .sort((a, b) => b.yield_valuable_per_1k_posts - a.yield_valuable_per_1k_posts);

  const bestByFirstDiscoveryYield = [...summaries]
    .filter(s => s.total_posts > 0)
    .sort((a, b) => b.first_discovery_valuable_yield_per_1k_posts - a.first_discovery_valuable_yield_per_1k_posts);

  const bestByPrecision = [...summaries]
    .filter(s => s.human_reviewed_candidates > 0)
    .sort((a, b) => b.validation_precision - a.validation_precision);

  const highestNoiseQueries = [...summaries]
    .filter(s => s.total_posts > 0)
    .sort((a, b) => a.pass_rate - b.pass_rate);

  res.json({
    summaries,
    leaderboard_valuable_yield: bestByValuableYield.slice(0, 5),
    leaderboard_first_discovery_yield: bestByFirstDiscoveryYield.slice(0, 5),
    leaderboard_precision: bestByPrecision.slice(0, 5),
    highest_noise: highestNoiseQueries.slice(0, 5)
  });
});

// =================================================================
// 6. FEEDBACK ANALYTICS & SCORE CALIBRATION
// =================================================================

apiRouter.get('/analytics/feedback', async (req: Request, res: Response) => {
  const candidates = await store.getCandidates();
  const reviewed = candidates.filter(
    c => c.human_label && c.human_label !== 'UNSURE' && c.human_label !== 'DUPLICATE'
  );

  const buckets = [
    { label: '90–100', min: 90, max: 100 },
    { label: '80–89', min: 80, max: 89 },
    { label: '70–79', min: 70, max: 79 },
    { label: '60–69', min: 60, max: 69 },
    { label: '50–59', min: 50, max: 59 },
    { label: '40–49', min: 40, max: 49 },
    { label: '<40', min: 0, max: 39 }
  ];

  const calibration = buckets.map(b => {
    const inBucket = reviewed.filter(c => c.candidate_score >= b.min && c.candidate_score <= b.max);
    const valid = inBucket.filter(
      c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
    );
    const valuable = inBucket.filter(c => c.human_label === 'VALUABLE_NEW_GAME');
    return {
      bucket: b.label,
      total_candidates: inBucket.length,
      valid_games: valid.length,
      valuable_new: valuable.length,
      valid_rate_pct: inBucket.length > 0 ? Math.round((valid.length / inBucket.length) * 100) : 0,
      valuable_rate_pct: inBucket.length > 0 ? Math.round((valuable.length / inBucket.length) * 100) : 0
    };
  });

  const methods = ['URL_SLUG', 'URL_METADATA', 'EXPLICIT_PATTERN', 'HASHTAG', 'HEURISTIC', 'GEMINI', 'MANUAL'];
  const extractionStats = methods.map(m => {
    const byMethod = reviewed.filter(c => c.extraction_method === m);
    const valid = byMethod.filter(
      c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
    );
    return {
      method: m,
      total: byMethod.length,
      valid: valid.length,
      precision_pct: byMethod.length > 0 ? Math.round((valid.length / byMethod.length) * 100) : 0
    };
  });

  const labelCounts: Record<string, number> = {};
  for (const c of candidates) {
    if (c.human_label) {
      labelCounts[c.human_label] = (labelCounts[c.human_label] || 0) + 1;
    }
  }

  res.json({
    total_reviewed: reviewed.length,
    calibration,
    extractionStats,
    labelCounts
  });
});

// =================================================================
// 7. SETTINGS (P0 SECURITY - NO SECRETS RETURNED OR UPDATED)
// =================================================================

apiRouter.get('/settings', async (req: Request, res: Response) => {
  const settings = await store.getSettings();
  res.json(settings);
});

apiRouter.patch('/settings', async (req: Request, res: Response) => {
  const updated = await store.updateSettings(req.body);
  res.json(updated);
});

// =================================================================
// 8. RESET & SEED (P0-4: STRICTLY DISABLED IN LIVE MODE)
// =================================================================

apiRouter.post('/reset-and-seed', async (req: Request, res: Response) => {
  const settings = await store.getSettings();
  if (settings.x_data_mode === 'live' || process.env.X_DATA_MODE === 'live') {
    return res.status(403).json({
      error: 'Action disabled in LIVE mode: reset-and-seed cannot be run in live mode to protect live data.'
    });
  }

  try {
    await store.resetAll();
    const queries = await store.getQueries();
    for (const q of queries) {
      await runQuery(q.id);
    }
    res.json({ success: true, message: 'Database reset and mock pipeline completed.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// 9. CSV EXPORTS (PROTECTED BY AUTHGUARD VIA HTTPONLY COOKIE)
// =================================================================

apiRouter.get('/export/:type', async (req: Request, res: Response) => {
  const { type } = req.params;

  if (type === 'candidates') {
    const candidates = await store.getCandidates();
    const headers = [
      'ID',
      'Canonical Name',
      'Normalized Name',
      'First Discovery Query ID',
      'Score',
      'Entity Confidence',
      'Browser Signal',
      'Status',
      'Extraction Method',
      'Unique Posts',
      'Unique Authors',
      'Max Engagement',
      'Human Label',
      'Human Notes',
      'First Seen',
      'URLs'
    ];

    const rows = candidates.map(c => [
      c.id,
      `"${c.canonical_name.replace(/"/g, '""')}"`,
      `"${c.normalized_name.replace(/"/g, '""')}"`,
      c.first_discovery_query_id || '',
      c.candidate_score,
      c.entity_confidence,
      c.browser_signal ? 'YES' : 'NO',
      c.status,
      c.extraction_method,
      c.unique_post_count,
      c.unique_author_count,
      c.max_engagement,
      c.human_label || '',
      `"${(c.human_notes || '').replace(/"/g, '""')}"`,
      c.first_seen_at,
      `"${c.urls.join(' ; ')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="candidates.csv"');
    return res.send(csv);
  }

  if (type === 'queries') {
    const queries = await store.getQueries();
    const allPosts = await store.getPosts();
    const allCandidates = await store.getCandidates();

    const headers = [
      'ID',
      'Name',
      'Query Text',
      'Category',
      'Priority',
      'Enabled',
      'Posts Collected',
      'Passed Filter',
      'Candidates Generated',
      'First Discovery Candidates',
      'First Discovery Valuable Games',
      'Human Valid Games',
      'Valuable New Games',
      'Human Rejected',
      'Validation Precision',
      'First Discovery Valuable Yield / 1k Posts'
    ];

    const rows = queries.map(q => {
      const qPosts = allPosts.filter(p => p.query_ids.includes(q.id));
      const firstDisc = allCandidates.filter(c => c.first_discovery_query_id === q.id);
      const firstDiscVal = firstDisc.filter(c => c.human_label === 'VALUABLE_NEW_GAME');
      const yield1k = qPosts.length > 0 ? ((firstDiscVal.length / qPosts.length) * 1000).toFixed(1) : '0.0';

      return [
        q.id,
        `"${q.name.replace(/"/g, '""')}"`,
        `"${q.query_text.replace(/"/g, '""')}"`,
        q.category,
        q.priority,
        q.enabled ? 'TRUE' : 'FALSE',
        q.posts_collected,
        q.posts_passed_filter,
        q.candidates_generated,
        firstDisc.length,
        firstDiscVal.length,
        q.human_validated_games,
        q.valuable_new_games,
        q.human_rejected,
        `${q.precision}%`,
        yield1k
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="query_performance.csv"');
    return res.send(csv);
  }

  if (type === 'posts') {
    const posts = await store.getPosts();
    const headers = [
      'X Post ID',
      'Author',
      'Created At',
      'Game Context Score',
      'Hard Filter Status',
      'Extracted Game',
      'Extraction Method',
      'Human Post Label',
      'Likes',
      'Reposts',
      'Text'
    ];

    const rows = posts.map(p => [
      p.x_post_id,
      p.author_username,
      p.created_at,
      p.game_context_score,
      p.hard_filter_status,
      `"${(p.extracted_game_name || '').replace(/"/g, '""')}"`,
      p.extraction_method || '',
      p.human_post_label || '',
      p.like_count,
      p.repost_count,
      `"${p.text.replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="raw_posts.csv"');
    return res.send(csv);
  }

  res.status(400).json({ error: 'Invalid export type. Supported: candidates, queries, posts' });
});

// =================================================================
// 10. SCHEDULED DUE QUERIES
// =================================================================

apiRouter.get('/jobs/run-due-queries', async (req: Request, res: Response) => {
  const batchResult = await runBatchQueries('DUE');
  res.json({
    timestamp: new Date().toISOString(),
    queries_executed: batchResult.results.length,
    results: batchResult.results,
    budget_usage: batchResult.budget_usage
  });
});
