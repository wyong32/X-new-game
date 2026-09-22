import { store } from '../db/store.js';
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
  CandidateQueryEvidence
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

export interface RunQueryOptions {
  customClient?: XSearchClient;
  maxRequestsOverride?: number;
  maxPostsOverride?: number;
}

export async function runQuery(
  queryId: string,
  options: RunQueryOptions = {}
): Promise<RunQueryResult> {
  const query = store.getQuery(queryId);
  if (!query) {
    throw new Error(`Query ${queryId} not found`);
  }

  const settings = store.getSettings();
  const client = options.customClient || getXClient(settings.x_data_mode);

  // Dedicated limit variables
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
  let newestIdSeen: string | undefined = undefined;
  let currentNextToken: string | undefined = undefined;
  let stoppedReason: RunQueryResult['pagination_stopped_reason'] = 'EXHAUSTED';
  let cursorAdvanced = false;

  const rawBatchItems: XSearchResultItem[] = [];

  // Query formatting: in live mode, ensure standard English discovery filters
  const effectiveQueryText = settings.x_data_mode === 'live'
    ? buildLiveQuery(query.query_text)
    : query.query_text;

  try {
    // -------------------------------------------------------------
    // P0 - STEP 1: X RECENT-SEARCH PAGINATION LOOP
    // -------------------------------------------------------------
    while (true) {
      if (requestsUsed >= maxRequestsLimit) {
        stoppedReason = 'MAX_REQUESTS_REACHED';
        break;
      }
      if (totalPostsFetched >= maxPostsLimit) {
        stoppedReason = 'MAX_POSTS_REACHED';
        break;
      }

      const pageSize = Math.min(100, Math.max(10, maxPostsLimit - totalPostsFetched));

      const searchRes = await client.searchRecent({
        query: effectiveQueryText,
        sinceId: query.last_since_id,
        maxResults: pageSize,
        nextToken: currentNextToken
      });
      requestsUsed++;

      if (!searchRes.data || searchRes.data.length === 0) {
        stoppedReason = 'EXHAUSTED';
        currentNextToken = undefined;
        break;
      }

      // Record the newest_id seen on the first page
      if (!newestIdSeen && searchRes.meta.newest_id) {
        newestIdSeen = searchRes.meta.newest_id;
      }

      totalPostsFetched += searchRes.data.length;
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
      let post = store.getPostByXId(item.id);

      const urls = (item.entities?.urls || []).map(u => u.expanded_url || u.url).filter(Boolean);
      const hashtags = (item.entities?.hashtags || []).map(h => (h.tag.startsWith('#') ? h.tag : `#${h.tag}`));

      if (post) {
        // Post already exists: update query attribution if new query
        if (!post.query_ids.includes(query.id)) {
          post.query_ids.push(query.id);
          post.updated_at = now;
          store.savePost(post);
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
        let extractedName: string | null = null;
        let extractionMethod: ExtractionMethod = 'HEURISTIC';
        let extractionConfidence = 0.5;

        // 1. Platform URL Slug Extraction (URL_SLUG)
        const slugExt = extractFromUrlSlugs(urls);
        if (slugExt) {
          extractedName = slugExt.name;
          extractionMethod = 'URL_SLUG';
          extractionConfidence = 0.95;
        }

        // 2. Safe Server-Side Page Metadata Extraction (URL_METADATA) for external/custom domains
        if (!extractedName && urls.length > 0 && filterRes.passed) {
          // Attempt metadata fetch on first safe URL
          for (const u of urls.slice(0, 2)) {
            try {
              const meta = await fetchSafePageMetadata(u);
              if (meta && meta.extractedGameName) {
                extractedName = meta.extractedGameName;
                extractionMethod = 'URL_METADATA';
                extractionConfidence = 0.92;
                break;
              }
            } catch {
              // Ignore fetch error and continue down extraction pipeline
            }
          }
        }

        // 3. Explicit language patterns
        if (!extractedName) {
          const patExt = extractFromExplicitPatterns(item.text);
          if (patExt) {
            extractedName = patExt.name;
            extractionMethod = 'EXPLICIT_PATTERN';
            extractionConfidence = 0.90;
          }
        }

        // 4. Known Aliases
        if (!extractedName) {
          const known = store.getCandidates().map(c => ({
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

        // 6. Gemini fallback: strictly enforce isGeminiEnabled and cap limit
        let extractionStatus: 'COMPLETED' | 'PENDING_EXTRACTION' | 'SKIPPED' = 'COMPLETED';
        if (!extractedName && contextRes.score >= 50 && filterRes.passed) {
          if (!isGeminiEnabled) {
            // Gemini disabled: zero calls made!
            extractionStatus = 'SKIPPED';
          } else if (geminiCallsUsed >= maxGeminiLimit) {
            // Cap reached: mark as PENDING_EXTRACTION without discarding
            extractionStatus = 'PENDING_EXTRACTION';
          } else {
            // Make Gemini call
            geminiCallsUsed++;
            try {
              const geminiRes = await extractGameWithGemini(item.text, urls);
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

        store.savePost(post);
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
        const allCandidates = store.getCandidates();
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
          if (
            canonicalName !== existingCandidate.canonical_name &&
            !existingCandidate.aliases.includes(canonicalName)
          ) {
            existingCandidate.aliases.push(canonicalName);
          }

          const contributingPosts = existingCandidate.source_post_ids
            .map(pid => store.getPost(pid))
            .filter((p): p is XPost => Boolean(p));

          const hasBrowser = contributingPosts.some(
            p =>
              p.game_context_positive_reasons.some(r => r.includes('Browser/web')) ||
              p.urls.some(u => /(?:poki|crazygames|html5|webgl)/i.test(u))
          );

          const scored = computeCandidateScore({
            canonical_name: existingCandidate.canonical_name,
            normalized_name: existingCandidate.normalized_name,
            posts: contributingPosts,
            extraction_method: existingCandidate.extraction_method,
            browser_signal: hasBrowser
          });

          existingCandidate.candidate_score = scored.candidate_score;
          existingCandidate.entity_confidence = scored.entity_confidence;
          existingCandidate.browser_confidence = scored.browser_confidence;
          existingCandidate.browser_signal = hasBrowser;
          existingCandidate.score_breakdown = scored.score_breakdown;
          existingCandidate.why_selected = scored.why_selected;
          existingCandidate.unique_post_count = contributingPosts.length;
          existingCandidate.unique_author_count = new Set(contributingPosts.map(p => p.author_id)).size;
          existingCandidate.max_engagement = Math.max(
            ...contributingPosts.map(p => p.like_count + p.repost_count),
            0
          );
          existingCandidate.last_seen_at = now;
          if (
            !existingCandidate.human_label &&
            existingCandidate.status !== 'CONFIRMED' &&
            existingCandidate.status !== 'REJECTED'
          ) {
            existingCandidate.status = determineCandidateStatus(scored.candidate_score);
          }

          store.saveCandidate(existingCandidate);
          post.candidate_id = existingCandidate.id;
          post.candidate_processed = true;
          store.savePost(post);
          candidatesUpdated++;

          // Update candidate_query_evidence
          const evidenceKey = `${existingCandidate.id}__${query.id}`;
          const existingEvidence = store.getCandidateQueryEvidence(evidenceKey);
          const postsFromThisQuery = contributingPosts.filter(p => p.query_ids.includes(query.id));
          const authorsFromThisQuery = new Set(postsFromThisQuery.map(p => p.author_id)).size;

          const updatedEvidence: CandidateQueryEvidence = {
            id: evidenceKey,
            candidate_id: existingCandidate.id,
            query_id: query.id,
            first_seen_at: existingEvidence ? existingEvidence.first_seen_at : post.created_at,
            post_count: postsFromThisQuery.length,
            unique_author_count: authorsFromThisQuery,
            is_first_discovery: existingCandidate.first_discovery_query_id === query.id,
            created_at: existingEvidence ? existingEvidence.created_at : now,
            updated_at: now
          };
          store.saveCandidateQueryEvidence(updatedEvidence);
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
            first_discovery_query_id: query.id, // P1 attribution requirement
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

          store.saveCandidate(newCandidate);
          post.candidate_id = candId;
          post.candidate_processed = true;
          store.savePost(post);
          candidatesCreated++;

          // Create initial CandidateQueryEvidence
          store.saveCandidateQueryEvidence({
            id: `${candId}__${query.id}`,
            candidate_id: candId,
            query_id: query.id,
            first_seen_at: post.created_at,
            post_count: 1,
            unique_author_count: 1,
            is_first_discovery: true,
            created_at: now,
            updated_at: now
          });
        }
      }
    }

    // -------------------------------------------------------------
    // P0 - STEP 3: SAFE CURSOR ADVANCEMENT
    // -------------------------------------------------------------
    // "Never move last_since_id past unprocessed results.
    // Stop only when no next_token OR max posts/requests reached."
    // Only advance last_since_id if all pages were completely processed (no remaining next_token)
    let newSinceId = query.last_since_id;
    if (!currentNextToken && newestIdSeen) {
      newSinceId = newestIdSeen;
      cursorAdvanced = true;
    }

    // -------------------------------------------------------------
    // P1 - STEP 4: RECALCULATE QUERY AGGREGATED STATS
    // -------------------------------------------------------------
    const allPosts = store.getPosts().filter(p => p.query_ids.includes(query.id));
    const passedFilterPosts = allPosts.filter(p => p.hard_filter_status === 'PASSED');
    const associatedCandidates = store.getCandidates().filter(c => c.source_query_ids.includes(query.id));

    // Standardized denominator:
    // Exclude UNSURE, DUPLICATE, UNREVIEWED from valid precision denominator
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

    store.updateQuery(query.id, {
      posts_collected: allPosts.length,
      posts_passed_filter: passedFilterPosts.length,
      candidates_generated: associatedCandidates.length,
      human_validated_games: humanValid,
      human_rejected: humanRejected,
      valuable_new_games: valuableNew,
      precision,
      last_since_id: newSinceId,
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
    store.updateQuery(query.id, {
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

export async function runBatchQueries(filter?: 'P1' | 'ENABLED' | 'DUE'): Promise<RunQueryResult[]> {
  const queries = store.getQueries();
  const now = Date.now();

  const toRun = queries.filter(q => {
    if (!q.enabled) return false;
    if (filter === 'P1') return q.priority === 'P1';
    if (filter === 'DUE') {
      if (!q.last_run_at) return true;
      const elapsedMinutes = (now - new Date(q.last_run_at).getTime()) / (1000 * 60);
      return elapsedMinutes >= (q.run_frequency_minutes || 120);
    }
    return true;
  });

  const results: RunQueryResult[] = [];
  for (const q of toRun) {
    try {
      const res = await runQuery(q.id);
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
  return results;
}

export async function seedAndRunMockWorkflow(): Promise<void> {
  const queries = store.getQueries();
  for (const q of queries) {
    await runQuery(q.id);
  }
}
