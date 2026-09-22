import { store as defaultStore } from '../db/store.js';
import type { Store } from '../db/storeInterface.js';
import { getXClient, type XSearchClient, type XSearchResultItem } from '../x/client.js';
import { hardFilterPost } from './hardFilter.js';
import { calculateGameContextScore } from './gameContext.js';
import {
  extractFromUrlSlugs,
  extractFromExplicitPatterns,
  extractFromKnownAliases,
  extractFromHeuristics
} from './entityExtraction.js';
import { fetchSafePageMetadata } from './urlMetadataFetcher.js';
import { extractGameWithGemini } from './geminiExtraction.js';
import { normalizeGameName, cleanCanonicalTitle } from './normalization.js';
import {
  computeCandidateScore,
  determineCandidateStatus,
  shouldMergeCandidates
} from './candidateService.js';
import { buildLiveQuery } from './queryBuilder.js';
import type {
  XPost,
  GameCandidate,
  ExtractionMethod,
  CandidateQueryEvidence,
  RunBudget,
  RunBudgetUsage
} from '../../src/types.js';

export interface RunQueryResult {
  query_id: string;
  requests_used: number;
  posts_fetched: number;
  posts_passed: number;
  candidates_created: number;
  candidates_updated: number;
  gemini_calls_used: number;
  pagination_stopped_reason: 'EXHAUSTED' | 'MAX_POSTS_REACHED' | 'MAX_REQUESTS_REACHED' | 'ERROR';
  cursor_advanced: boolean;
  error?: string;
}

export type GeminiExtractorFn = (
  text: string,
  urls: string[]
) => Promise<{
  is_specific_game: boolean;
  game_name?: string;
  confidence?: number;
} | null>;

export interface RunQueryOptions {
  customClient?: XSearchClient;
  maxRequestsOverride?: number;
  maxPostsOverride?: number;
  budget?: RunBudget;
  store?: Store;
  geminiExtractor?: GeminiExtractorFn;
}

export async function runQuery(
  queryId: string,
  options: RunQueryOptions = {}
): Promise<RunQueryResult> {
  const currentStore = options.store || defaultStore;
  const query = await currentStore.getQuery(queryId);
  if (!query) {
    throw new Error(`Query ${queryId} not found`);
  }

  const settings = await currentStore.getSettings();
  const client = options.customClient || getXClient(settings.x_data_mode);

  // Dedicated limit variables (safety caps)
  const maxRequestsLimit = options.maxRequestsOverride ?? settings.max_x_requests_per_run ?? 30;
  const maxPostsLimit = options.maxPostsOverride ?? settings.max_x_posts_per_query ?? 100;
  const maxGeminiLimit = settings.max_gemini_extractions_per_run ?? 30;
  const isGeminiEnabled = Boolean(settings.gemini_extraction_enabled);

  let requestsUsed = 0;
  let totalPostsFetched = 0;
  let passedPostsCount = 0;
  let candidatesCreated = 0;
  let candidatesUpdated = 0;
  let geminiCallsUsed = 0;
  let stoppedReason: RunQueryResult['pagination_stopped_reason'] = 'EXHAUSTED';
  let cursorAdvanced = false;

  const rawBatchItems: XSearchResultItem[] = [];

  // P0-2: Resumable Pagination State
  const isResuming = Boolean(query.pending_next_token);
  const effectiveSinceId = isResuming ? query.pagination_since_id : query.last_since_id;
  let currentNextToken: string | undefined = isResuming ? query.pending_next_token : undefined;
  let paginationNewestId: string | undefined = isResuming ? query.pagination_newest_id : undefined;
  const paginationStartedAt: string = isResuming && query.pagination_started_at
    ? query.pagination_started_at
    : new Date().toISOString();

  // Query formatting: in live mode, ensure standard English discovery filters
  const effectiveQueryText = settings.x_data_mode === 'live'
    ? buildLiveQuery(query.query_text)
    : query.query_text;

  try {
    // -------------------------------------------------------------
    // P0 - STEP 1: X RECENT-SEARCH RESUMABLE PAGINATION LOOP
    // -------------------------------------------------------------
    while (true) {
      // Global and query request limits
      const requestsLeft = Math.min(
        maxRequestsLimit - requestsUsed,
        options.budget ? options.budget.requestsRemaining : Infinity
      );
      if (requestsLeft <= 0) {
        stoppedReason = 'MAX_REQUESTS_REACHED';
        break;
      }

      // Global and query post limits
      const postsLeft = Math.min(
        maxPostsLimit - totalPostsFetched,
        options.budget ? options.budget.postsRemaining : Infinity
      );
      if (postsLeft <= 0) {
        stoppedReason = 'MAX_POSTS_REACHED';
        break;
      }

      const pageSize = Math.min(100, Math.max(10, postsLeft));

      const searchRes = await client.searchRecent({
        query: effectiveQueryText,
        sinceId: effectiveSinceId,
        maxResults: pageSize,
        nextToken: currentNextToken
      });
      requestsUsed++;
      if (options.budget) {
        options.budget.requestsRemaining--;
      }

      if (!searchRes.data || searchRes.data.length === 0) {
        stoppedReason = 'EXHAUSTED';
        currentNextToken = undefined;
        break;
      }

      // Track newest_id seen across the overall window (first page of search)
      if (!paginationNewestId && searchRes.meta.newest_id) {
        paginationNewestId = searchRes.meta.newest_id;
      }

      totalPostsFetched += searchRes.data.length;
      if (options.budget) {
        options.budget.postsRemaining -= searchRes.data.length;
      }
      rawBatchItems.push(...searchRes.data);

      if (searchRes.meta.next_token) {
        currentNextToken = searchRes.meta.next_token;
      } else {
        stoppedReason = 'EXHAUSTED';
        currentNextToken = undefined;
        break;
      }
    }

    // -------------------------------------------------------------
    // P0 - STEP 2: PROCESS & PERSIST POSTS + CANDIDATES
    // -------------------------------------------------------------
    const now = new Date().toISOString();

    for (const item of rawBatchItems) {
      // 1. Check if post already exists in database (deduplication)
      let post = await currentStore.getPostByXId(item.id);

      const urls = (item.entities?.urls || []).map(u => u.expanded_url || u.url).filter(Boolean);
      const hashtags = (item.entities?.hashtags || []).map(h => (h.tag.startsWith('#') ? h.tag : `#${h.tag}`));

      if (post) {
        // Post already exists: update query attribution if new query
        if (!post.query_ids.includes(query.id)) {
          post.query_ids.push(query.id);
          post.updated_at = now;
          await currentStore.savePost(post);
        }
      } else {
        // Hard Filter
        const filterRes = hardFilterPost(item.text);

        // Context Score
        const contextRes = calculateGameContextScore({
          text: item.text,
          urls,
          has_media: item.has_media,
          hashtags
        });

        // Entity Extraction Pipeline
        let extractedName: string | undefined = undefined;
        let extractionMethod: ExtractionMethod | undefined = undefined;
        let extractionConfidence: number | undefined = undefined;

        // 1. URL Slugs (highest priority & reliability)
        if (urls.length > 0) {
          const urlExt = extractFromUrlSlugs(urls);
          if (urlExt) {
            extractedName = urlExt.name;
            extractionMethod = urlExt.method;
            extractionConfidence = 0.90;
          }
        }

        // 2. URL Metadata Title (if slug was generic or missing)
        if (!extractedName && urls.length > 0 && settings.x_data_mode === 'live') {
          for (const u of urls.slice(0, 2)) {
            try {
              const meta = await fetchSafePageMetadata(u);
              if (meta && meta.title) {
                const cleanedTitle = cleanCanonicalTitle(meta.title);
                if (cleanedTitle.length > 2 && !cleanedTitle.includes('404')) {
                  extractedName = cleanedTitle;
                  extractionMethod = 'URL_METADATA';
                  extractionConfidence = 0.85;
                  break;
                }
              }
            } catch {
              // Ignore page fetch errors
            }
          }
        }

        // 3. Explicit Patterns
        if (!extractedName) {
          const patExt = extractFromExplicitPatterns(item.text);
          if (patExt) {
            extractedName = patExt.name;
            extractionMethod = 'EXPLICIT_PATTERN';
            extractionConfidence = 0.88;
          }
        }

        // 4. Known Aliases
        if (!extractedName) {
          const candidatesList = await currentStore.getCandidates();
          const known = candidatesList.map(c => ({
            canonical_name: c.canonical_name,
            aliases: c.aliases,
            normalized_name: c.normalized_name
          }));
          const knownExt = extractFromKnownAliases(item.text, known);
          if (knownExt) {
            extractedName = knownExt.name;
            extractionMethod = 'EXPLICIT_PATTERN';
            extractionConfidence = 0.88;
          }
        }

        // 5. Hashtags / Heuristics
        if (!extractedName) {
          const heurExt = extractFromHeuristics(item.text, hashtags);
          if (heurExt) {
            extractedName = heurExt.name;
            extractionMethod = 'HASHTAG';
            extractionConfidence = 0.70;
          }
        }

        // 6. Gemini fallback: strictly enforce isGeminiEnabled and cap/budget limit
        let extractionStatus: 'COMPLETED' | 'PENDING_EXTRACTION' | 'SKIPPED' = extractedName ? 'COMPLETED' : 'SKIPPED';
        if (!extractedName && contextRes.score >= 50 && filterRes.passed) {
          const geminiBudgetRemaining = options.budget
            ? options.budget.geminiRemaining
            : (maxGeminiLimit - geminiCallsUsed);

          if (!isGeminiEnabled) {
            // Gemini disabled: zero calls made!
            extractionStatus = 'SKIPPED';
          } else if (geminiCallsUsed >= maxGeminiLimit || geminiBudgetRemaining <= 0) {
            // Cap or budget reached: mark as PENDING_EXTRACTION without discarding
            extractionStatus = 'PENDING_EXTRACTION';
          } else {
            // Make Gemini call
            geminiCallsUsed++;
            if (options.budget) {
              options.budget.geminiRemaining--;
            }
            try {
              const extractor = options.geminiExtractor || extractGameWithGemini;
              const geminiRes = await extractor(item.text, urls);
              if (geminiRes && geminiRes.is_specific_game && geminiRes.game_name) {
                extractedName = geminiRes.game_name;
                extractionMethod = 'GEMINI';
                extractionConfidence = geminiRes.confidence || 0.85;
                extractionStatus = 'COMPLETED';
              }
            } catch (err) {
              console.error('Gemini extraction error:', err);
              extractionStatus = 'PENDING_EXTRACTION';
            }
          }
        }

        post = {
          id: `post_${item.id}`,
          x_post_id: item.id,
          text: item.text,
          author_id: item.author_id,
          author_username: item.author_username,
          created_at: item.created_at,
          fetched_at: now,
          like_count: item.public_metrics.like_count,
          reply_count: item.public_metrics.reply_count,
          repost_count: item.public_metrics.retweet_count,
          quote_count: item.public_metrics.quote_count,
          urls,
          hashtags,
          has_media: Boolean(item.has_media),
          media_types: item.media_types || [],
          query_ids: [query.id],
          hard_filter_status: filterRes.passed ? 'PASSED' : 'REJECTED',
          hard_filter_reasons: filterRes.rejectReasons,
          game_context_score: contextRes.score,
          game_context_positive_reasons: contextRes.positiveReasons,
          game_context_negative_reasons: contextRes.negativeReasons,
          extracted_game_name: extractedName,
          extraction_method: extractedName ? extractionMethod : undefined,
          extraction_confidence: extractedName ? extractionConfidence : undefined,
          extraction_status: extractionStatus,
          candidate_processed: false,
          created_at_db: now,
          updated_at: now
        };

        await currentStore.savePost(post);
      }

      if (post.hard_filter_status === 'PASSED') {
        passedPostsCount++;
      }

      // Candidate Processing (context score >= 50 and has extracted name)
      if (
        post.hard_filter_status === 'PASSED' &&
        post.game_context_score >= 50 &&
        post.extracted_game_name
      ) {
        const canonicalName = cleanCanonicalTitle(post.extracted_game_name);
        const normName = normalizeGameName(canonicalName);

        // Find existing candidate to cluster with
        const allCandidates = await currentStore.getCandidates();
        const existingCandidate = allCandidates.find(c =>
          shouldMergeCandidates(
            {
              canonical_name: canonicalName,
              normalized_name: normName,
              aliases: [],
              urls: post?.urls || []
            },
            {
              canonical_name: c.canonical_name,
              normalized_name: c.normalized_name,
              aliases: c.aliases,
              urls: c.urls
            }
          )
        );

        if (existingCandidate) {
          // Update existing candidate
          if (!existingCandidate.source_post_ids.includes(post.id)) {
            existingCandidate.source_post_ids.push(post.id);
          }
          if (!existingCandidate.source_query_ids.includes(query.id)) {
            existingCandidate.source_query_ids.push(query.id);
          }
          for (const u of post.urls) {
            if (!existingCandidate.urls.includes(u)) {
              existingCandidate.urls.push(u);
            }
          }

          // Attribution requirement: do NOT overwrite first_discovery_query_id!
          if (!existingCandidate.first_discovery_query_id) {
            existingCandidate.first_discovery_query_id = existingCandidate.first_query_id || query.id;
          }

          // Recalculate candidate metrics
          const candidatePosts: XPost[] = (
            await Promise.all(existingCandidate.source_post_ids.map(pid => currentStore.getPost(pid)))
          ).filter((p): p is XPost => Boolean(p));

          const isBrowser =
            candidatePosts.some(p => p.game_context_positive_reasons.some(r => r.includes('Browser/web'))) ||
            existingCandidate.urls.some(u => /(?:poki|crazygames|html5|webgl)/i.test(u));

          const scored = computeCandidateScore({
            canonical_name: existingCandidate.canonical_name,
            normalized_name: existingCandidate.normalized_name,
            posts: candidatePosts,
            extraction_method: existingCandidate.extraction_method,
            browser_signal: isBrowser
          });

          existingCandidate.candidate_score = scored.candidate_score;
          existingCandidate.entity_confidence = scored.entity_confidence;
          existingCandidate.browser_confidence = scored.browser_confidence;
          existingCandidate.browser_signal = isBrowser;
          existingCandidate.score_breakdown = scored.score_breakdown;
          existingCandidate.why_selected = scored.why_selected;
          existingCandidate.unique_post_count = candidatePosts.length;
          existingCandidate.unique_author_count = new Set(candidatePosts.map(p => p.author_id)).size;
          existingCandidate.max_engagement = Math.max(
            ...candidatePosts.map(p => p.like_count + p.repost_count),
            0
          );
          existingCandidate.last_seen_at = post.created_at;

          if (!existingCandidate.human_label && existingCandidate.status !== 'DUPLICATE') {
            existingCandidate.status = determineCandidateStatus(scored.candidate_score);
          }

          await currentStore.saveCandidate(existingCandidate);
          post.candidate_id = existingCandidate.id;
          post.candidate_processed = true;
          await currentStore.savePost(post);
          candidatesUpdated++;

          // Update or create CandidateQueryEvidence for this query
          const evidenceKey = `${existingCandidate.id}__${query.id}`;
          const existingEvidence = await currentStore.getCandidateQueryEvidence(evidenceKey);
          const postsForThisQuery = candidatePosts.filter(p => p.query_ids.includes(query.id));

          const updatedEvidence: CandidateQueryEvidence = {
            id: evidenceKey,
            candidate_id: existingCandidate.id,
            query_id: query.id,
            first_seen_at: existingEvidence ? existingEvidence.first_seen_at : post.created_at,
            post_count: postsForThisQuery.length,
            unique_author_count: new Set(postsForThisQuery.map(p => p.author_id)).size,
            is_first_discovery: existingCandidate.first_discovery_query_id === query.id,
            created_at: existingEvidence ? existingEvidence.created_at : now,
            updated_at: now
          };
          await currentStore.saveCandidateQueryEvidence(updatedEvidence);
        } else {
          // Create new Candidate entity
          const candId = `cand_${normName.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
          const isBrowser =
            post.game_context_positive_reasons.some(r => r.includes('Browser/web')) ||
            post.urls.some(u => /(?:poki|crazygames|html5|webgl)/i.test(u));

          const scored = computeCandidateScore({
            canonical_name: canonicalName,
            normalized_name: normName,
            posts: [post],
            extraction_method: post.extraction_method || 'HEURISTIC',
            browser_signal: isBrowser
          });

          const newCandidate: GameCandidate = {
            id: candId,
            canonical_name: canonicalName,
            normalized_name: normName,
            aliases: [],
            first_seen_at: post.created_at,
            last_seen_at: post.created_at,
            first_query_id: query.id,
            first_discovery_query_id: query.id, // P0 query attribution
            source_post_ids: [post.id],
            source_query_ids: [query.id],
            unique_post_count: 1,
            unique_author_count: 1,
            max_engagement: post.like_count + post.repost_count,
            browser_signal: isBrowser,
            browser_confidence: scored.browser_confidence,
            entity_confidence: scored.entity_confidence,
            candidate_score: scored.candidate_score,
            status: determineCandidateStatus(scored.candidate_score),
            extraction_method: post.extraction_method || 'HEURISTIC',
            score_breakdown: scored.score_breakdown,
            why_selected: scored.why_selected,
            urls: [...post.urls],
            created_at: now,
            updated_at: now
          };

          await currentStore.saveCandidate(newCandidate);
          post.candidate_id = candId;
          post.candidate_processed = true;
          await currentStore.savePost(post);
          candidatesCreated++;

          // Create initial CandidateQueryEvidence
          const evidenceKey = `${candId}__${query.id}`;
          const evidence: CandidateQueryEvidence = {
            id: evidenceKey,
            candidate_id: candId,
            query_id: query.id,
            first_seen_at: post.created_at,
            post_count: 1,
            unique_author_count: 1,
            is_first_discovery: true,
            created_at: now,
            updated_at: now
          };
          await currentStore.saveCandidateQueryEvidence(evidence);
        }
      }
    }

    // -------------------------------------------------------------
    // P0 - STEP 3: RESUMABLE CURSOR & PAGINATION UPDATE
    // -------------------------------------------------------------
    let updateFields: Partial<typeof query> = {};

    if (stoppedReason === 'EXHAUSTED' || !currentNextToken) {
      // Pagination backlog is completely exhausted
      const newSinceId = paginationNewestId || query.last_since_id;
      cursorAdvanced = Boolean(paginationNewestId && paginationNewestId !== query.last_since_id);
      updateFields = {
        last_since_id: newSinceId,
        pending_next_token: undefined,
        pagination_since_id: undefined,
        pagination_newest_id: undefined,
        pagination_started_at: undefined
      };
    } else {
      // Stopped because of MAX_POSTS_REACHED or MAX_REQUESTS_REACHED
      // MUST NOT advance last_since_id! Persist pending pagination state so next run resumes!
      cursorAdvanced = false;
      updateFields = {
        pending_next_token: currentNextToken,
        pagination_since_id: effectiveSinceId,
        pagination_newest_id: paginationNewestId,
        pagination_started_at: paginationStartedAt
      };
    }

    // -------------------------------------------------------------
    // P1 - STEP 4: RECALCULATE QUERY AGGREGATED STATS
    // -------------------------------------------------------------
    const allPosts = (await currentStore.getPosts()).filter(p => p.query_ids.includes(query.id));
    const passedFilterPosts = allPosts.filter(p => p.hard_filter_status === 'PASSED');
    const associatedCandidates = (await currentStore.getCandidates()).filter(c => c.source_query_ids.includes(query.id));

    const humanValid = associatedCandidates.filter(
      c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
    ).length;

    const humanRejected = associatedCandidates.filter(
      c =>
        c.human_label === 'NOT_A_GAME' ||
        c.human_label === 'OLD_GAME' ||
        c.human_label === 'NOISE' ||
        c.human_label === 'WRONG_GAME_NAME' ||
        c.human_label === 'GAME_NOT_TARGET'
    ).length;

    const valuableNew = associatedCandidates.filter(
      c => c.human_label === 'VALUABLE_NEW_GAME'
    ).length;

    const standardDenominator = humanValid + humanRejected;
    const precision = standardDenominator > 0 ? Math.round((humanValid / standardDenominator) * 100) : 0;

    await currentStore.updateQuery(query.id, {
      ...updateFields,
      posts_collected: allPosts.length,
      posts_passed_filter: passedFilterPosts.length,
      candidates_generated: associatedCandidates.length,
      human_validated_games: humanValid,
      human_rejected: humanRejected,
      valuable_new_games: valuableNew,
      precision,
      last_run_at: now,
      last_status: 'SUCCESS',
      last_error: undefined
    });

    return {
      query_id: query.id,
      requests_used: requestsUsed,
      posts_fetched: totalPostsFetched,
      posts_passed: passedPostsCount,
      candidates_created: candidatesCreated,
      candidates_updated: candidatesUpdated,
      gemini_calls_used: geminiCallsUsed,
      pagination_stopped_reason: stoppedReason,
      cursor_advanced: cursorAdvanced
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    await currentStore.updateQuery(query.id, {
      last_run_at: new Date().toISOString(),
      last_status: 'ERROR',
      last_error: errMsg
    });
    return {
      query_id: query.id,
      requests_used: requestsUsed,
      posts_fetched: totalPostsFetched,
      posts_passed: passedPostsCount,
      candidates_created: candidatesCreated,
      candidates_updated: candidatesUpdated,
      gemini_calls_used: geminiCallsUsed,
      pagination_stopped_reason: 'ERROR',
      cursor_advanced: false,
      error: errMsg
    };
  }
}

export interface BatchRunResult {
  results: RunQueryResult[];
  budget_usage: RunBudgetUsage;
}

export async function runBatchQueries(
  filter?: 'P1' | 'ENABLED' | 'DUE',
  options: {
    store?: Store;
    customClient?: XSearchClient;
    budget?: RunBudget;
  } = {}
): Promise<BatchRunResult> {
  const currentStore = options.store || defaultStore;
  const settings = await currentStore.getSettings();
  const queries = await currentStore.getQueries();
  const now = Date.now();

  const toRun = queries.filter(q => {
    if (!q.enabled) return false;
    if (filter === 'P1') return q.priority === 'P1';
    if (filter === 'DUE') {
      if (!q.last_run_at) return true;
      const elapsedMinutes = (now - new Date(q.last_run_at).getTime()) / (1000 * 60);
      return elapsedMinutes >= (q.run_frequency_minutes || 120);
    }
    return true; // 'ENABLED' or undefined
  });

  // Global RunBudget shared across all queries in this batch
  const initialRequests = settings.max_x_requests_per_run ?? 30;
  const initialPosts = settings.max_x_posts_per_run ?? 1000;
  const initialGemini = settings.gemini_extraction_enabled
    ? (settings.max_gemini_extractions_per_run ?? 30)
    : 0;

  const budget: RunBudget = options.budget || {
    requestsRemaining: initialRequests,
    postsRemaining: initialPosts,
    geminiRemaining: initialGemini,
    initialRequests,
    initialPosts,
    initialGemini
  };

  const results: RunQueryResult[] = [];
  let stoppedEarlyReason: string | undefined = undefined;

  for (const q of toRun) {
    if (budget.requestsRemaining <= 0) {
      stoppedEarlyReason = 'GLOBAL_REQUESTS_BUDGET_EXHAUSTED';
      break;
    }
    if (budget.postsRemaining <= 0) {
      stoppedEarlyReason = 'GLOBAL_POSTS_BUDGET_EXHAUSTED';
      break;
    }

    try {
      const res = await runQuery(q.id, {
        store: currentStore,
        customClient: options.customClient,
        budget
      });
      results.push(res);
    } catch (err: any) {
      results.push({
        query_id: q.id,
        requests_used: 0,
        posts_fetched: 0,
        posts_passed: 0,
        candidates_created: 0,
        candidates_updated: 0,
        gemini_calls_used: 0,
        pagination_stopped_reason: 'ERROR',
        cursor_advanced: false,
        error: err.message
      });
    }
  }

  const budgetUsage: RunBudgetUsage = {
    requests_used: budget.initialRequests - budget.requestsRemaining,
    requests_remaining: budget.requestsRemaining,
    posts_fetched: budget.initialPosts - budget.postsRemaining,
    posts_remaining: budget.postsRemaining,
    gemini_calls_used: budget.initialGemini - budget.geminiRemaining,
    gemini_remaining: budget.geminiRemaining,
    stopped_early_reason: stoppedEarlyReason
  };

  return { results, budget_usage: budgetUsage };
}

export async function seedAndRunMockWorkflow(targetStore?: Store): Promise<void> {
  const currentStore = targetStore || defaultStore;
  const queries = await currentStore.getQueries();
  for (const q of queries) {
    await runQuery(q.id, { store: currentStore });
  }
}
