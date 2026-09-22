import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';
import { runQuery, runBatchQueries, seedAndRunMockWorkflow } from '../services/queryRunner.js';
import {
  computeCandidateScore,
  determineCandidateStatus
} from '../services/candidateService.js';
import { normalizeGameName, cleanCanonicalTitle } from '../services/normalization.js';
import type {
  CandidateHumanLabel,
  PostHumanLabel,
  QueryCategory,
  QueryPriority,
  QueryHealth,
  QueryAnalyticsSummary
} from '../../src/types.js';

export const apiRouter = Router();

// 1. App Status & Overview
apiRouter.get('/status', (req: Request, res: Response) => {
  const settings = store.getSettings();
  const queries = store.getQueries();
  const posts = store.getPosts();
  const candidates = store.getCandidates();

  const passedPosts = posts.filter(p => p.hard_filter_status === 'PASSED');
  const highConf = candidates.filter(c => c.candidate_score >= 80);
  const reviewed = candidates.filter(c => Boolean(c.human_label));
  const valuableNew = candidates.filter(c => c.human_label === 'VALUABLE_NEW_GAME');
  const validGames = candidates.filter(
    c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
  );

  const noiseRate = posts.length > 0
    ? Math.round(((posts.length - passedPosts.length) / posts.length) * 100)
    : 0;

  const valuableNewPrecision = reviewed.length > 0
    ? Math.round((valuableNew.length / reviewed.length) * 100)
    : 0;

  const candidatePrecision = reviewed.length > 0
    ? Math.round((validGames.length / reviewed.length) * 100)
    : 0;

  const usefulYieldPer1k = posts.length > 0
    ? Number(((valuableNew.length / posts.length) * 1000).toFixed(1))
    : 0;

  res.json({
    mode: settings.x_data_mode,
    gemini_ready: settings.gemini_api_key_configured,
    total_queries: queries.length,
    enabled_queries: queries.filter(q => q.enabled).length,
    total_posts: posts.length,
    passed_posts: passedPosts.length,
    total_candidates: candidates.length,
    high_confidence_candidates: highConf.length,
    reviewed_candidates: reviewed.length,
    valuable_new_games: valuableNew.length,
    valid_games: validGames.length,
    noise_rate_pct: noiseRate,
    valuable_new_precision_pct: valuableNewPrecision,
    candidate_precision_pct: candidatePrecision,
    useful_yield_per_1k: usefulYieldPer1k,
    settings
  });
});

// 2. Query Management
apiRouter.get('/queries', (req: Request, res: Response) => {
  const queries = store.getQueries();
  res.json(queries);
});

apiRouter.post('/queries', (req: Request, res: Response) => {
  const { name, query_text, category, priority, run_frequency_minutes, initial_confidence } = req.body;
  if (!query_text) {
    return res.status(400).json({ error: 'query_text is required' });
  }

  const id = `q_custom_${Date.now()}`;
  const now = new Date().toISOString();
  const newQuery = store.saveQuery({
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

apiRouter.patch('/queries/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = store.updateQuery(id, req.body);
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

apiRouter.post('/queries/:id/reset', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = store.updateQuery(id, {
    posts_collected: 0,
    posts_passed_filter: 0,
    candidates_generated: 0,
    human_validated_games: 0,
    human_rejected: 0,
    valuable_new_games: 0,
    precision: 0,
    last_since_id: undefined,
    last_status: 'IDLE',
    last_error: undefined
  });
  res.json(updated);
});

apiRouter.post('/queries/run-batch', async (req: Request, res: Response) => {
  const { filter } = req.body; // 'P1' | 'ENABLED' | 'DUE'
  try {
    const results = await runBatchQueries(filter);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Raw Posts Explorer
apiRouter.get('/posts', (req: Request, res: Response) => {
  let posts = store.getPosts();

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

  // Sort newest first
  posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json(posts);
});

apiRouter.get('/posts/:id', (req: Request, res: Response) => {
  const post = store.getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

apiRouter.patch('/posts/:id', (req: Request, res: Response) => {
  const { human_post_label } = req.body;
  const updated = store.updatePost(req.params.id, {
    human_post_label: human_post_label as PostHumanLabel
  });
  if (!updated) return res.status(404).json({ error: 'Post not found' });
  res.json(updated);
});

// 4. Game Candidates
apiRouter.get('/candidates', (req: Request, res: Response) => {
  let candidates = store.getCandidates();

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

  // Sorting
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

apiRouter.get('/candidates/:id', (req: Request, res: Response) => {
  const candidate = store.getCandidate(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  // Expand source posts
  const posts = candidate.source_post_ids
    .map(pid => store.getPost(pid))
    .filter(Boolean);

  // Expand source queries
  const queries = candidate.source_query_ids
    .map(qid => store.getQuery(qid))
    .filter(Boolean);

  res.json({
    ...candidate,
    posts,
    queries
  });
});

apiRouter.patch('/candidates/:id', (req: Request, res: Response) => {
  const { human_label, human_notes, canonical_name, aliases, status } = req.body;
  const candidate = store.getCandidate(req.params.id);
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

  const updated = store.updateCandidate(candidate.id, partial);

  // Trigger recalculation of query precision stats for source queries
  for (const qid of candidate.source_query_ids) {
    const q = store.getQuery(qid);
    if (q) {
      const associatedCands = store.getCandidates().filter(c => c.source_query_ids.includes(qid));
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
      const totalRev = validCount + rejectedCount;
      const prec = totalRev > 0 ? Math.round((validCount / totalRev) * 100) : 0;

      store.updateQuery(qid, {
        human_validated_games: validCount,
        human_rejected: rejectedCount,
        valuable_new_games: valNew,
        precision: prec
      });
    }
  }

  res.json(updated);
});

// Merge candidate A into candidate B
apiRouter.post('/candidates/:id/merge', (req: Request, res: Response) => {
  const source = store.getCandidate(req.params.id);
  const { target_id } = req.body;
  const target = store.getCandidate(target_id);

  if (!source || !target) {
    return res.status(404).json({ error: 'Source or target candidate not found' });
  }

  // Combine source post IDs & query IDs
  for (const pid of source.source_post_ids) {
    if (!target.source_post_ids.includes(pid)) {
      target.source_post_ids.push(pid);
    }
    // Update post pointer
    const p = store.getPost(pid);
    if (p) {
      p.candidate_id = target.id;
      store.savePost(p);
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

  if (!target.aliases.includes(source.canonical_name)) {
    target.aliases.push(source.canonical_name);
  }
  for (const a of source.aliases) {
    if (!target.aliases.includes(a)) {
      target.aliases.push(a);
    }
  }

  // Recalculate target score
  const contributingPosts = target.source_post_ids
    .map(pid => store.getPost(pid))
    .filter((p): p is any => Boolean(p));

  const hasBrowser = target.browser_signal || source.browser_signal;
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
  target.unique_author_count = new Set(contributingPosts.map(p => p.author_id)).size;
  target.max_engagement = Math.max(...contributingPosts.map(p => p.like_count + p.repost_count), 0);

  store.saveCandidate(target);

  // Mark source candidate as DUPLICATE and merged
  store.updateCandidate(source.id, {
    status: 'DUPLICATE',
    human_label: 'DUPLICATE',
    merged_into_candidate_id: target.id
  });

  res.json({ target, source });
});

// 5. Query Analytics
apiRouter.get('/analytics/queries', (req: Request, res: Response) => {
  const queries = store.getQueries();
  const allPosts = store.getPosts();
  const allCandidates = store.getCandidates();

  const summaries: QueryAnalyticsSummary[] = queries.map(q => {
    const qPosts = allPosts.filter(p => p.query_ids.includes(q.id));
    const passed = qPosts.filter(p => p.hard_filter_status === 'PASSED');
    const qCandidates = allCandidates.filter(c => c.source_query_ids.includes(q.id));

    const humanReviewed = qCandidates.filter(c => Boolean(c.human_label));
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

    const passRate = qPosts.length > 0 ? Number(((passed.length / qPosts.length) * 100).toFixed(1)) : 0;
    const precisionValid = humanReviewed.length > 0
      ? Number(((validGames.length / humanReviewed.length) * 100).toFixed(1))
      : 0;
    const precisionValuable = humanReviewed.length > 0
      ? Number(((valuableNew.length / humanReviewed.length) * 100).toFixed(1))
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

    // Determine Query Health
    let health: QueryHealth = 'INSUFFICIENT_DATA';
    if (q.last_status === 'ERROR') {
      health = 'ERROR';
    } else if (humanReviewed.length < 2 && qPosts.length < 5) {
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
      human_reviewed_candidates: humanReviewed.length,
      human_valid_games: validGames.length,
      valuable_new_games: valuableNew.length,
      rejected_candidates: rejected.length,
      precision_valid_game: precisionValid,
      precision_valuable_new_game: precisionValuable,
      posts_per_valid_game: postsPerValid,
      posts_per_valuable_game: postsPerValuable,
      yield_valuable_per_1k_posts: yieldPer1k
    };
  });

  // Query Leaderboards
  const bestByValuableYield = [...summaries]
    .filter(s => s.total_posts > 0)
    .sort((a, b) => b.yield_valuable_per_1k_posts - a.yield_valuable_per_1k_posts);

  const bestByPrecision = [...summaries]
    .filter(s => s.human_reviewed_candidates > 0)
    .sort((a, b) => b.precision_valid_game - a.precision_valid_game);

  const highestNoiseQueries = [...summaries]
    .filter(s => s.total_posts > 0)
    .sort((a, b) => a.pass_rate - b.pass_rate);

  res.json({
    summaries,
    leaderboard_valuable_yield: bestByValuableYield.slice(0, 5),
    leaderboard_precision: bestByPrecision.slice(0, 5),
    highest_noise: highestNoiseQueries.slice(0, 5)
  });
});

// 6. Feedback Analytics & Score Calibration
apiRouter.get('/analytics/feedback', (req: Request, res: Response) => {
  const candidates = store.getCandidates();
  const reviewed = candidates.filter(c => Boolean(c.human_label));

  // Score calibration buckets (Section 50)
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

  // Extraction Method precision (Section 51)
  const methods = ['URL_METADATA', 'EXPLICIT_PATTERN', 'HASHTAG', 'HEURISTIC', 'GEMINI', 'MANUAL'];
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

  // Label breakdown
  const labelCounts: Record<string, number> = {};
  for (const c of reviewed) {
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

// 7. Settings
apiRouter.get('/settings', (req: Request, res: Response) => {
  res.json(store.getSettings());
});

apiRouter.patch('/settings', (req: Request, res: Response) => {
  const updated = store.updateSettings(req.body);
  res.json(updated);
});

// 8. Re-seed Mock Data workflow
apiRouter.post('/reset-and-seed', async (req: Request, res: Response) => {
  try {
    store.resetAll();
    await seedAndRunMockWorkflow();
    res.json({ success: true, message: 'Database reset and mock pipeline completed.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. CSV Export (Section 52)
apiRouter.get('/export/:type', (req: Request, res: Response) => {
  const { type } = req.params;

  if (type === 'candidates') {
    const candidates = store.getCandidates();
    const headers = [
      'ID',
      'Canonical Name',
      'Normalized Name',
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
    const queries = store.getQueries();
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
      'Human Valid Games',
      'Valuable New Games',
      'Human Rejected',
      'Precision'
    ];

    const rows = queries.map(q => [
      q.id,
      `"${q.name.replace(/"/g, '""')}"`,
      `"${q.query_text.replace(/"/g, '""')}"`,
      q.category,
      q.priority,
      q.enabled ? 'TRUE' : 'FALSE',
      q.posts_collected,
      q.posts_passed_filter,
      q.candidates_generated,
      q.human_validated_games,
      q.valuable_new_games,
      q.human_rejected,
      `${q.precision}%`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="query_analytics.csv"');
    return res.send(csv);
  }

  if (type === 'posts') {
    const posts = store.getPosts();
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

// 10. Scheduled due queries endpoint (Section 45)
apiRouter.get('/jobs/run-due-queries', async (req: Request, res: Response) => {
  try {
    const results = await runBatchQueries('DUE');
    res.json({ timestamp: new Date().toISOString(), queries_executed: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
