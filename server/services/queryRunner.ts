import { store } from '../db/store.js';
import { getXClient } from '../x/client.js';
import { hardFilterPost } from './hardFilter.js';
import { calculateGameContextScore } from './gameContext.js';
import {
  extractFromUrls,
  extractFromExplicitPatterns,
  extractFromKnownAliases,
  extractFromHeuristics
} from './entityExtraction.js';
import { extractGameWithGemini } from './geminiExtraction.js';
import { normalizeGameName, cleanCanonicalTitle } from './normalization.js';
import {
  computeCandidateScore,
  determineCandidateStatus,
  shouldMergeCandidates
} from './candidateService.js';
import type { XPost, GameCandidate, ExtractionMethod, CandidateHumanLabel } from '../../src/types.js';

export interface RunQueryResult {
  query_id: string;
  posts_fetched: number;
  posts_passed: number;
  candidates_created: number;
  candidates_updated: number;
  error?: string;
}

export async function runQuery(queryId: string): Promise<RunQueryResult> {
  const query = store.getQuery(queryId);
  if (!query) {
    throw new Error(`Query ${queryId} not found`);
  }

  const settings = store.getSettings();
  const client = getXClient(settings.x_data_mode, settings.x_bearer_token);

  let fetchedPostsCount = 0;
  let passedPostsCount = 0;
  let candidatesCreated = 0;
  let candidatesUpdated = 0;

  try {
    const searchRes = await client.searchRecent({
      query: query.query_text,
      sinceId: query.last_since_id,
      maxResults: settings.max_x_requests_per_run || 20
    });

    const now = new Date().toISOString();
    fetchedPostsCount = searchRes.data.length;

    for (const item of searchRes.data) {
      // 1. Check if post already exists in database
      let post = store.getPostByXId(item.id);

      const urls = (item.entities?.urls || []).map(u => u.expanded_url || u.url).filter(Boolean);
      const hashtags = (item.entities?.hashtags || []).map(h => h.tag.startsWith('#') ? h.tag : `#${h.tag}`);

      if (post) {
        // Append query if not already present
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

        // 1. URL evidence
        const urlExt = extractFromUrls(urls);
        if (urlExt) {
          extractedName = urlExt.name;
          extractionMethod = 'URL_METADATA';
          extractionConfidence = 0.95;
        }

        // 2. Explicit patterns
        if (!extractedName) {
          const patExt = extractFromExplicitPatterns(item.text);
          if (patExt) {
            extractedName = patExt.name;
            extractionMethod = 'EXPLICIT_PATTERN';
            extractionConfidence = 0.90;
          }
        }

        // 3. Known Aliases
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

        // 4. Hashtags / Heuristics
        if (!extractedName) {
          const heurExt = extractFromHeuristics(item.text, hashtags);
          if (heurExt) {
            extractedName = heurExt.name;
            extractionMethod = 'HASHTAG';
            extractionConfidence = 0.70;
          }
        }

        // 5. Gemini fallback (only if score >= 50 and deterministic failed)
        if (!extractedName && contextRes.score >= 50 && filterRes.passed) {
          const geminiRes = await extractGameWithGemini(item.text, urls);
          if (geminiRes && geminiRes.is_specific_game && geminiRes.game_name) {
            extractedName = geminiRes.game_name;
            extractionMethod = 'GEMINI';
            extractionConfidence = geminiRes.confidence || 0.85;
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
          candidate_processed: false,
          created_at_db: now,
          updated_at: now
        };

        store.savePost(post);
      }

      if (post.hard_filter_status === 'PASSED') {
        passedPostsCount++;
      }

      // Candidate Processing (threshold >= 50 and has extracted name)
      if (
        post.hard_filter_status === 'PASSED' &&
        post.game_context_score >= 50 &&
        post.extracted_game_name
      ) {
        const canonicalName = cleanCanonicalTitle(post.extracted_game_name);
        const normName = normalizeGameName(canonicalName);

        // Find existing candidate to cluster/merge with
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
        } else {
          // Create new Candidate entity
          const candId = `cand_${normName.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
          const isBrowser = post.game_context_positive_reasons.some(r => r.includes('Browser/web')) ||
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
        }
      }
    }

    // Refresh query aggregated stats
    const allPosts = store.getPosts().filter(p => p.query_ids.includes(query.id));
    const passedFilterPosts = allPosts.filter(p => p.hard_filter_status === 'PASSED');
    const associatedCandidates = store.getCandidates().filter(c => c.source_query_ids.includes(query.id));

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

    const totalReviewed = humanValid + humanRejected;
    const precision = totalReviewed > 0 ? Math.round((humanValid / totalReviewed) * 100) : 0;

    store.updateQuery(query.id, {
      posts_collected: allPosts.length,
      posts_passed_filter: passedFilterPosts.length,
      candidates_generated: associatedCandidates.length,
      human_validated_games: humanValid,
      human_rejected: humanRejected,
      valuable_new_games: valuableNew,
      precision,
      last_since_id: searchRes.meta.newest_id || query.last_since_id,
      last_run_at: now,
      last_status: 'SUCCESS',
      last_error: undefined
    });

    return {
      query_id: query.id,
      posts_fetched: fetchedPostsCount,
      posts_passed: passedPostsCount,
      candidates_created: candidatesCreated,
      candidates_updated: candidatesUpdated
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
      posts_fetched: 0,
      posts_passed: 0,
      candidates_created: 0,
      candidates_updated: 0,
      error: errMsg
    };
  }
}

/**
 * Runs all enabled queries or priority P1 queries
 */
export async function runBatchQueries(filter?: 'P1' | 'ENABLED' | 'DUE'): Promise<RunQueryResult[]> {
  const allQueries = store.getQueries();
  const results: RunQueryResult[] = [];

  const now = Date.now();
  const toRun = allQueries.filter(q => {
    if (!q.enabled) return false;
    if (filter === 'P1') return q.priority === 'P1';
    if (filter === 'DUE') {
      if (!q.last_run_at) return true;
      const lastRun = new Date(q.last_run_at).getTime();
      const intervalMs = (q.run_frequency_minutes || 60) * 60 * 1000;
      return now >= lastRun + intervalMs;
    }
    return true; // 'ENABLED'
  });

  for (const q of toRun) {
    const res = await runQuery(q.id);
    results.push(res);
  }

  return results;
}

/**
 * Seeds and initializes the system with full mock execution and realistic human review labels
 * so that all pages (/posts, /candidates, /candidates/:id, /analytics/queries, /analytics/feedback)
 * are immediately functional and demonstrably testable!
 */
export async function seedAndRunMockWorkflow(): Promise<void> {
  // 1. Run all P1 & P2 queries against mock fixtures
  const p1AndP2 = store.getQueries().filter(q => q.priority === 'P1' || q.priority === 'P2');
  for (const q of p1AndP2) {
    await runQuery(q.id);
  }
  // Run viral P3 queries to demonstrate high noise & contrast
  const viralQueries = store.getQueries().filter(q => q.category === 'VIRAL');
  for (const q of viralQueries) {
    await runQuery(q.id);
  }

  // 2. Pre-seed realistic human labels for key candidates to demonstrate precision analytics
  const candidates = store.getCandidates();
  const now = new Date().toISOString();

  for (const c of candidates) {
    const norm = c.normalized_name;
    let label: CandidateHumanLabel | undefined;
    let notes: string | undefined;

    if (norm.includes('frogblood')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'Legitimate new indie roguelike with active playable browser demo on itch.io';
    } else if (norm.includes('pixel frog hotel')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'Excellent cozy browser game on Poki, genuinely new release';
    } else if (norm.includes('tiny fishing horror')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'Viral Ludum Dare 48h game jam hit with HTML5 build';
    } else if (norm.includes('dungeon office')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'HR comedy simulator on GitHub Pages with WebGL';
    } else if (norm.includes('browser knight')) {
      label = 'VALID_GAME';
      notes = 'Clean Phaser HTML5 action game on CrazyGames';
    } else if (norm.includes('asteroid courier')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'GMTK jam submission with zero-g browser mechanics';
    } else if (norm.includes('neon drift')) {
      label = 'VALID_GAME';
      notes = 'PC Steam indie release, verified developer launch';
    } else if (norm.includes('sprout witch')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'Browser garden potion jam game on itch';
    } else if (norm.includes('shadow weaver')) {
      label = 'VALID_GAME';
      notes = 'Steam metroidvania release announcement';
    } else if (norm.includes('slime arena')) {
      label = 'VALID_GAME';
      notes = 'Godot web export arena game';
    } else if (norm.includes('void drifter')) {
      label = 'VALUABLE_NEW_GAME';
      notes = 'PICO-8 minimalist HTML5 dodge game';
    } else if (norm.includes('run')) {
      label = 'WRONG_GAME_NAME';
      notes = 'Generic single word title without verified multiplayer or brand evidence';
    } else if (norm.includes('battle')) {
      label = 'NOISE';
      notes = 'Vague single word tweet without playable link or metadata';
    }

    if (label) {
      store.updateCandidate(c.id, {
        human_label: label,
        human_notes: notes,
        labeled_at: now,
        status: label === 'VALUABLE_NEW_GAME' || label === 'VALID_GAME' ? 'CONFIRMED' : 'REJECTED'
      });
    }
  }

  // Pre-seed post-level labels for sample posts
  const posts = store.getPosts();
  for (const p of posts) {
    if (p.x_post_id === 'x_1001' || p.x_post_id === 'x_1004') {
      store.updatePost(p.id, { human_post_label: 'GOOD_DISCOVERY_POST' });
    } else if (p.x_post_id === 'x_1018') {
      store.updatePost(p.id, { human_post_label: 'REAL_GAME_BUT_NOT_NEW' });
    } else if (p.x_post_id === 'x_1013') {
      store.updatePost(p.id, { human_post_label: 'JOB' });
    } else if (p.x_post_id === 'x_1014') {
      store.updatePost(p.id, { human_post_label: 'TUTORIAL' });
    } else if (p.x_post_id === 'x_1015') {
      store.updatePost(p.id, { human_post_label: 'PROMOTION_SPAM' });
    } else if (p.x_post_id === 'x_1025') {
      store.updatePost(p.id, { human_post_label: 'GENERAL_GAMEDEV' });
    }
  }

  // Recalculate precision stats across all queries
  for (const q of store.getQueries()) {
    const queryPosts = store.getPosts().filter(p => p.query_ids.includes(q.id));
    const passed = queryPosts.filter(p => p.hard_filter_status === 'PASSED');
    const cands = store.getCandidates().filter(c => c.source_query_ids.includes(q.id));

    const humanValid = cands.filter(
      c => c.human_label === 'VALID_GAME' || c.human_label === 'VALUABLE_NEW_GAME'
    ).length;
    const humanRejected = cands.filter(
      c =>
        c.human_label === 'NOT_A_GAME' ||
        c.human_label === 'OLD_GAME' ||
        c.human_label === 'NOISE' ||
        c.human_label === 'WRONG_GAME_NAME' ||
        c.human_label === 'GAME_NOT_TARGET'
    ).length;
    const valuableNew = cands.filter(
      c => c.human_label === 'VALUABLE_NEW_GAME'
    ).length;

    const totalReviewed = humanValid + humanRejected;
    const precision = totalReviewed > 0 ? Math.round((humanValid / totalReviewed) * 100) : 0;

    store.updateQuery(q.id, {
      posts_collected: queryPosts.length,
      posts_passed_filter: passed.length,
      candidates_generated: cands.length,
      human_validated_games: humanValid,
      human_rejected: humanRejected,
      valuable_new_games: valuableNew,
      precision
    });
  }
}
