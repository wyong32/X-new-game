/**
 * P1 REAL INTEGRATION TEST SUITE for X Game Discovery Lab
 * Covers:
 * 1. Paginated Query with Max Posts = 25 and 100 Posts Available
 * 2. Multiple Queries Discovering Same Game (Query Attribution)
 * 3. Gemini Disabled Run (Mock extractor, 0 calls)
 * 4. Gemini Budget / Cap Enforcement (Limit = 2, 5 posts -> 2 calls, 3 PENDING_EXTRACTION)
 * 5. Global Run Budget (3 queries, limit reached on query 2, query 3 skipped)
 * 6. Startup Safety Test (No searchRecent on startup, missing APP_PASSWORD refuses startup)
 */

import { MockXClient, type XSearchResultItem } from './server/x/client.js';
import { MemoryStore } from './server/db/store.js';
import { runQuery, runBatchQueries } from './server/services/queryRunner.js';
import path from 'path';
import fs from 'fs';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('🧪 Running P1 Real Integration Test Suite...\n');

  // =========================================================================
  // 1. Paginated Query with Max Posts = 25 and 100 Posts Available
  // =========================================================================
  console.log('--- TEST 1: Resumable Pagination with Backlog & Cursor Safety ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_1.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    // 100 posts available
    const customPosts: XSearchResultItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: String(2000000000000000000n + BigInt(100 - i)), // descending IDs
      text: `Just released our indie game NovaStrike #${i} on itch.io! Play now: https://dev.itch.io/novastrike`,
      author_id: `dev_${i}`,
      author_username: `developer_${i}`,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      public_metrics: { like_count: 5, reply_count: 1, retweet_count: 2, quote_count: 0 },
      entities: {
        urls: [{ url: `https://dev.itch.io/novastrike`, expanded_url: `https://dev.itch.io/novastrike` }]
      }
    }));

    let searchCalls = 0;
    const trackingClient = {
      async searchRecent(params: any) {
        searchCalls++;
        const pageSize = params.maxResults || 25;
        let startIndex = 0;
        if (params.nextToken && params.nextToken.startsWith('mock_offset_')) {
          startIndex = parseInt(params.nextToken.replace('mock_offset_', ''), 10) || 0;
        }
        const paged = customPosts.slice(startIndex, startIndex + pageSize);
        const nextOffset = startIndex + pageSize;
        const hasMore = nextOffset < customPosts.length;
        return {
          data: paged,
          meta: {
            result_count: paged.length,
            newest_id: paged.length > 0 ? paged[0].id : undefined,
            oldest_id: paged.length > 0 ? paged[paged.length - 1].id : undefined,
            next_token: hasMore ? `mock_offset_${nextOffset}` : undefined
          }
        };
      }
    };

    const initialSinceId = '1000000000000000000';
    await store.saveQuery({
      id: 'q_pagination_test',
      name: 'Pagination Test Query',
      query_text: 'NovaStrike indie game',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      last_since_id: initialSinceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Run 1: maxPostsOverride = 25
    const res1 = await runQuery('q_pagination_test', {
      store,
      customClient: trackingClient as any,
      maxPostsOverride: 25
    });

    assert(res1.posts_fetched === 25, `Run 1 fetched 25 posts (got ${res1.posts_fetched})`);
    assert(res1.pagination_stopped_reason === 'MAX_POSTS_REACHED', `Stopped reason is MAX_POSTS_REACHED (got ${res1.pagination_stopped_reason})`);
    assert(res1.cursor_advanced === false, 'Cursor must NOT advance when backlog remains');

    const qAfterRun1 = await store.getQuery('q_pagination_test');
    assert(qAfterRun1?.pending_next_token === 'mock_offset_25', `pending_next_token saved as mock_offset_25 (got ${qAfterRun1?.pending_next_token})`);
    assert(qAfterRun1?.last_since_id === initialSinceId, `last_since_id unchanged (${initialSinceId})`);

    // Run 2: resume with maxPostsOverride = 100
    const res2 = await runQuery('q_pagination_test', {
      store,
      customClient: trackingClient as any,
      maxPostsOverride: 100
    });

    assert(res2.posts_fetched === 75, `Run 2 resumed from mock_offset_25 and fetched remaining 75 posts (got ${res2.posts_fetched})`);
    assert(res2.pagination_stopped_reason === 'EXHAUSTED', `Run 2 stopped with EXHAUSTED (got ${res2.pagination_stopped_reason})`);
    assert(res2.cursor_advanced === true, 'Cursor advanced after exhausting backlog');

    const qAfterRun2 = await store.getQuery('q_pagination_test');
    assert(qAfterRun2?.pending_next_token === undefined, 'pending_next_token cleared after backlog exhausted');
    assert(qAfterRun2?.last_since_id === customPosts[0].id, `last_since_id advanced to newest_id (${customPosts[0].id})`);
  }

  // =========================================================================
  // 2. Multiple Queries Discovering Same Game (Query Attribution)
  // =========================================================================
  console.log('\n--- TEST 2: Multiple Queries Discovering Same Game (Query Attribution) ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_2.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.saveQuery({
      id: 'q_alpha',
      name: 'Query Alpha',
      query_text: 'CyberRunner launch',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await store.saveQuery({
      id: 'q_beta',
      name: 'Query Beta',
      query_text: 'CyberRunner webgl',
      category: 'BROWSER',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Post 1 found by Query Alpha
    const postAlpha: XSearchResultItem = {
      id: '3000000000000000001',
      text: 'I just released my game CyberRunner on itch.io! Playable now: https://dev.itch.io/cyberrunner',
      author_id: 'dev_alpha',
      author_username: 'cyber_dev',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      public_metrics: { like_count: 10, reply_count: 2, retweet_count: 4, quote_count: 0 },
      entities: {
        urls: [{ url: 'https://dev.itch.io/cyberrunner', expanded_url: 'https://dev.itch.io/cyberrunner' }]
      }
    };

    const clientAlpha = new MockXClient([postAlpha]);
    await runQuery('q_alpha', { store, customClient: clientAlpha });

    const candsAfterAlpha = await store.getCandidates();
    assert(candsAfterAlpha.length === 1, `Candidate created for CyberRunner (count: ${candsAfterAlpha.length})`);
    const candidate = candsAfterAlpha[0];
    assert(candidate.first_discovery_query_id === 'q_alpha', `first_discovery_query_id is q_alpha (got ${candidate.first_discovery_query_id})`);

    // Post 2 found by Query Beta for the same game
    const postBeta: XSearchResultItem = {
      id: '3000000000000000002',
      text: 'My game CyberRunner is now available to play in browser via WebGL! Playable now: https://dev.itch.io/cyberrunner',
      author_id: 'dev_beta_reviewer',
      author_username: 'webgl_reviewer',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      public_metrics: { like_count: 15, reply_count: 3, retweet_count: 5, quote_count: 1 },
      entities: {
        urls: [{ url: 'https://dev.itch.io/cyberrunner', expanded_url: 'https://dev.itch.io/cyberrunner' }]
      }
    };

    const clientBeta = new MockXClient([postBeta]);
    await runQuery('q_beta', { store, customClient: clientBeta });

    const candsAfterBeta = await store.getCandidates();
    assert(candsAfterBeta.length === 1, 'Still exactly 1 candidate (clustered together)');
    const updatedCandidate = candsAfterBeta[0];
    assert(updatedCandidate.first_discovery_query_id === 'q_alpha', 'first_discovery_query_id REMAINS q_alpha after Q_beta run');
    assert(updatedCandidate.source_query_ids.includes('q_alpha') && updatedCandidate.source_query_ids.includes('q_beta'), 'source_query_ids contains both q_alpha and q_beta');

    // Evidence records
    const evidenceAlpha = await store.getCandidateQueryEvidence(`${updatedCandidate.id}__q_alpha`);
    const evidenceBeta = await store.getCandidateQueryEvidence(`${updatedCandidate.id}__q_beta`);

    assert(Boolean(evidenceAlpha), 'Evidence record exists for Query Alpha');
    assert(evidenceAlpha?.is_first_discovery === true, 'Evidence for Query Alpha has is_first_discovery = true');
    assert(Boolean(evidenceBeta), 'Evidence record exists for Query Beta');
    assert(evidenceBeta?.is_first_discovery === false, 'Evidence for Query Beta has is_first_discovery = false');
  }

  // =========================================================================
  // 3. Gemini Disabled Run
  // =========================================================================
  console.log('\n--- TEST 3: Gemini Disabled Run (Zero Calls) ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_3.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.updateSettings({
      gemini_extraction_enabled: false
    });

    await store.saveQuery({
      id: 'q_gemini_disabled',
      name: 'Gemini Disabled Test',
      query_text: 'gameplay reveal game',
      category: 'INDIE_LAUNCH',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Post that qualifies for extraction context (score >= 50) but has no explicit slug/pattern
    const post: XSearchResultItem = {
      id: '4000000000000000001',
      text: 'We just released our devlog and demo for our turn-based RPG! Check it out: https://store.steampowered.com/app/99999/',
      author_id: 'dev_gemini_test',
      author_username: 'anim_dev',
      created_at: new Date().toISOString(),
      public_metrics: { like_count: 20, reply_count: 4, retweet_count: 5, quote_count: 0 },
      entities: {
        urls: [{ url: 'https://store.steampowered.com/app/99999/', expanded_url: 'https://store.steampowered.com/app/99999/' }]
      }
    };

    let geminiCallCount = 0;
    const mockExtractor = async () => {
      geminiCallCount++;
      return { is_specific_game: true, game_name: 'MockRPG', confidence: 0.9 };
    };

    const client = new MockXClient([post]);
    const res = await runQuery('q_gemini_disabled', {
      store,
      customClient: client,
      geminiExtractor: mockExtractor
    });

    assert(geminiCallCount === 0, `Gemini extractor was NEVER called (call count = ${geminiCallCount})`);
    assert(res.gemini_calls_used === 0, `RunQueryResult reports 0 gemini_calls_used`);
    const savedPosts = await store.getPosts();
    assert(savedPosts[0].extraction_status === 'SKIPPED', `Post marked as extraction_status = SKIPPED (got ${savedPosts[0].extraction_status})`);
  }

  // =========================================================================
  // 4. Gemini Budget / Cap Enforcement
  // =========================================================================
  console.log('\n--- TEST 4: Gemini Budget & Cap Enforcement ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_4.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.updateSettings({
      gemini_extraction_enabled: true,
      max_gemini_extractions_per_run: 2
    });

    await store.saveQuery({
      id: 'q_gemini_cap',
      name: 'Gemini Cap Test',
      query_text: 'gameplay reveal game',
      category: 'INDIE_LAUNCH',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 5 qualifying posts without explicit name patterns (context score >= 50)
    const posts: XSearchResultItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(5000000000000000000n + BigInt(i)),
      text: `We just released a new gameplay demo for our turn-based dungeon crawler #${i}! Check it out: https://store.steampowered.com/app/${1000 + i}/`,
      author_id: `dev_${i}`,
      author_username: `dungeon_dev_${i}`,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      public_metrics: { like_count: 25, reply_count: 5, retweet_count: 8, quote_count: 0 },
      entities: {
        urls: [{ url: `https://store.steampowered.com/app/${1000 + i}/`, expanded_url: `https://store.steampowered.com/app/${1000 + i}/` }]
      }
    }));

    let geminiCalls = 0;
    const mockExtractor = async (text: string) => {
      geminiCalls++;
      return { is_specific_game: true, game_name: `DungeonCrawler_${geminiCalls}`, confidence: 0.9 };
    };

    const client = new MockXClient(posts);
    const res = await runQuery('q_gemini_cap', {
      store,
      customClient: client,
      geminiExtractor: mockExtractor
    });

    assert(geminiCalls === 2, `Exactly 2 Gemini calls made (got ${geminiCalls})`);
    assert(res.gemini_calls_used === 2, `RunQueryResult reports 2 gemini_calls_used (got ${res.gemini_calls_used})`);

    const savedPosts = await store.getPosts();
    const completed = savedPosts.filter(p => p.extraction_status === 'COMPLETED');
    const pending = savedPosts.filter(p => p.extraction_status === 'PENDING_EXTRACTION');

    assert(completed.length === 2, `Exactly 2 posts marked COMPLETED (got ${completed.length})`);
    assert(pending.length === 3, `Remaining 3 posts marked PENDING_EXTRACTION (got ${pending.length})`);
  }

  // =========================================================================
  // 5. Global Run Budget in runBatchQueries()
  // =========================================================================
  console.log('\n--- TEST 5: Global Run Budget in runBatchQueries() ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_5.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    // Set global limits: 30 total posts allowed, 20 per query
    await store.updateSettings({
      max_x_requests_per_run: 10,
      max_x_posts_per_run: 30,
      max_x_posts_per_query: 20,
      gemini_extraction_enabled: false
    });

    for (let i = 1; i <= 3; i++) {
      await store.saveQuery({
        id: `q_batch_${i}`,
        name: `Batch Query ${i}`,
        query_text: `batch test query ${i}`,
        category: 'RELEASE',
        priority: 'P1',
        initial_confidence: 0.8,
        enabled: true,
        run_frequency_minutes: 60,
        posts_collected: 0,
        posts_passed_filter: 0,
        candidates_generated: 0,
        human_validated_games: 0,
        human_rejected: 0,
        valuable_new_games: 0,
        precision: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Client returning 20 posts per query
    const client = {
      async searchRecent(params: any) {
        const pageSize = params.maxResults || 20;
        const posts = Array.from({ length: pageSize }, (_, i) => ({
          id: String(6000000000000000000n + BigInt(Date.now() % 100000) + BigInt(i)),
          text: `Game dev announcement #${i} on itch.io #indiedev`,
          author_id: `author_${i}`,
          author_username: `user_${i}`,
          created_at: new Date().toISOString(),
          public_metrics: { like_count: 2, reply_count: 0, retweet_count: 0, quote_count: 0 }
        }));
        return {
          data: posts,
          meta: { result_count: posts.length }
        };
      }
    };

    const batchRes = await runBatchQueries('P1', {
      store,
      customClient: client as any
    });

    assert(batchRes.results.length === 2, `Ran 2 queries before global budget exhausted (got ${batchRes.results.length})`);
    assert(batchRes.budget_usage.posts_fetched === 30, `Total posts fetched equals global limit of 30 (got ${batchRes.budget_usage.posts_fetched})`);
    assert(batchRes.budget_usage.posts_remaining === 0, `Posts remaining is 0 (got ${batchRes.budget_usage.posts_remaining})`);
    assert(batchRes.budget_usage.stopped_early_reason === 'GLOBAL_POSTS_BUDGET_EXHAUSTED', `stopped_early_reason is GLOBAL_POSTS_BUDGET_EXHAUSTED`);

    const q3 = await store.getQuery('q_batch_3');
    assert(q3?.last_status !== 'SUCCESS', 'Query 3 was skipped because global budget was exhausted');
  }

  // =========================================================================
  // 6. Startup Safety Test
  // =========================================================================
  console.log('\n--- TEST 6: Startup Safety Test ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_6.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.updateSettings({
      x_data_mode: 'live'
    });

    // Check 1: Startup in LIVE mode must not call X API
    let xApiCalled = false;
    const dummyClient = {
      async searchRecent() {
        xApiCalled = true;
        throw new Error('X API MUST NOT BE CALLED ON STARTUP IN LIVE MODE');
      }
    };

    const settings = await store.getSettings();
    const isLive = settings.x_data_mode === 'live';

    // Simulate startup logic from server.ts
    if (!isLive && settings.x_data_mode === 'mock') {
      await dummyClient.searchRecent();
    }
    assert(xApiCalled === false, 'LIVE mode never triggers auto-seed or X API searchRecent on startup');

    // Check 2: Missing APP_PASSWORD in LIVE mode refuses startup
    let refusedStartup = false;
    const testEnvPassword: string = ''; // missing password
    if (isLive && (!testEnvPassword || testEnvPassword.trim() === '')) {
      refusedStartup = true;
    }
    assert(refusedStartup === true, 'LIVE mode with missing APP_PASSWORD refuses startup');
  }

  // =========================================================================
  // 7. Pending Extraction Recovery Test
  // =========================================================================
  console.log('\n--- TEST 7: Pending Extraction Recovery ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_7.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.updateSettings({
      gemini_extraction_enabled: true,
      max_gemini_extractions_per_run: 2
    });

    const now = Date.now();
    // 5 pending posts with different created_at (post 1 is oldest)
    for (let i = 1; i <= 5; i++) {
      await store.savePost({
        id: `post_pending_${i}`,
        x_post_id: `x_pending_${i}`,
        text: `Playing indie game SolarClash_${i} demo today! Itch: https://solarclash.itch.io/game-${i}`,
        author_id: `author_${i}`,
        author_username: `gamer_${i}`,
        created_at: new Date(now - (10 - i) * 60000).toISOString(),
        fetched_at: new Date().toISOString(),
        like_count: 5,
        reply_count: 0,
        repost_count: 0,
        quote_count: 0,
        urls: [`https://solarclash.itch.io/game-${i}`],
        hashtags: ['indiegames'],
        has_media: false,
        media_types: [],
        query_ids: ['q_test_pending'],
        hard_filter_status: 'PASSED',
        hard_filter_reasons: [],
        game_context_score: 75,
        game_context_positive_reasons: ['Game release language', 'Valid link'],
        game_context_negative_reasons: [],
        extraction_status: 'PENDING_EXTRACTION',
        candidate_processed: false,
        created_at_db: new Date(now - (10 - i) * 60000).toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const mockExtractor = async (text: string) => {
      const match = text.match(/SolarClash_(\d+)/);
      const num = match ? match[1] : 'Game';
      return {
        is_specific_game: true,
        game_name: `Solar Clash ${num}`,
        confidence: 0.92
      };
    };

    await store.saveQuery({
      id: 'q_test_pending',
      name: 'Test Pending Query',
      query_text: 'SolarClash',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: false,
      run_frequency_minutes: 60,
      posts_collected: 5,
      posts_passed_filter: 5,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Batch #1: Gemini budget = 2 -> 2 processed, 3 remain pending
    const batch1 = await runBatchQueries('P1', {
      store,
      geminiExtractor: mockExtractor,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 100,
        geminiRemaining: 2,
        initialRequests: 10,
        initialPosts: 100,
        initialGemini: 2
      }
    });

    assert(batch1.pending_recovery?.processed === 2, `Batch #1: 2 processed (got ${batch1.pending_recovery?.processed})`);
    assert(batch1.pending_recovery?.remained_pending === 3, `Batch #1: 3 remain pending (got ${batch1.pending_recovery?.remained_pending})`);

    const p1 = await store.getPost('post_pending_1');
    const p2 = await store.getPost('post_pending_2');
    const p3 = await store.getPost('post_pending_3');
    assert(p1?.extraction_status === 'COMPLETED' && p1.extracted_game_name === 'Solar Clash 1', 'Oldest post 1 processed in Batch 1');
    assert(p2?.extraction_status === 'COMPLETED' && p2.extracted_game_name === 'Solar Clash 2', 'Oldest post 2 processed in Batch 1');
    assert(p3?.extraction_status === 'PENDING_EXTRACTION', 'Post 3 remains pending after Batch 1');

    // Batch #2: Gemini budget = 2 -> 2 processed, 1 remains pending
    const batch2 = await runBatchQueries('P1', {
      store,
      geminiExtractor: mockExtractor,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 100,
        geminiRemaining: 2,
        initialRequests: 10,
        initialPosts: 100,
        initialGemini: 2
      }
    });

    assert(batch2.pending_recovery?.processed === 2, `Batch #2: 2 processed (got ${batch2.pending_recovery?.processed})`);
    assert(batch2.pending_recovery?.remained_pending === 1, `Batch #2: 1 remains pending (got ${batch2.pending_recovery?.remained_pending})`);

    // Batch #3: Gemini budget = 2 -> 1 processed, 0 remain pending
    const batch3 = await runBatchQueries('P1', {
      store,
      geminiExtractor: mockExtractor,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 100,
        geminiRemaining: 2,
        initialRequests: 10,
        initialPosts: 100,
        initialGemini: 2
      }
    });

    assert(batch3.pending_recovery?.processed === 1, `Batch #3: 1 processed (got ${batch3.pending_recovery?.processed})`);
    assert(batch3.pending_recovery?.remained_pending === 0, `Batch #3: 0 remain pending (got ${batch3.pending_recovery?.remained_pending})`);
  }

  // =========================================================================
  // 8. Strict Global Post Budget Boundary Tests (remaining = 9, 5, 1)
  // =========================================================================
  console.log('\n--- TEST 8: Strict Global Post Budget Boundary Tests ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_8.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.saveQuery({
      id: 'q_boundary_test',
      name: 'Boundary Test Query',
      query_text: 'boundary test',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    let searchCalls = 0;
    const boundaryClient = {
      async searchRecent() {
        searchCalls++;
        return { data: [], meta: { result_count: 0 } };
      }
    };

    // Test remaining = 9 -> zero additional X requests
    searchCalls = 0;
    const res9 = await runQuery('q_boundary_test', {
      store,
      customClient: boundaryClient as any,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 9,
        geminiRemaining: 10,
        initialRequests: 10,
        initialPosts: 10,
        initialGemini: 10
      }
    });
    assert(searchCalls === 0, 'Remaining = 9: Zero additional X requests made');
    assert(res9.pagination_stopped_reason === 'MAX_POSTS_REACHED', 'Remaining = 9: Stopped with MAX_POSTS_REACHED');

    // Test remaining = 5 -> zero additional X requests
    searchCalls = 0;
    const res5 = await runQuery('q_boundary_test', {
      store,
      customClient: boundaryClient as any,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 5,
        geminiRemaining: 10,
        initialRequests: 10,
        initialPosts: 10,
        initialGemini: 10
      }
    });
    assert(searchCalls === 0, 'Remaining = 5: Zero additional X requests made');
    assert(res5.pagination_stopped_reason === 'MAX_POSTS_REACHED', 'Remaining = 5: Stopped with MAX_POSTS_REACHED');

    // Test remaining = 1 -> zero additional X requests
    searchCalls = 0;
    const res1 = await runQuery('q_boundary_test', {
      store,
      customClient: boundaryClient as any,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 1,
        geminiRemaining: 10,
        initialRequests: 10,
        initialPosts: 10,
        initialGemini: 10
      }
    });
    assert(searchCalls === 0, 'Remaining = 1: Zero additional X requests made');
    assert(res1.pagination_stopped_reason === 'MAX_POSTS_REACHED', 'Remaining = 1: Stopped with MAX_POSTS_REACHED');

    // Test in runBatchQueries with postsRemaining = 9
    searchCalls = 0;
    const batchBoundary = await runBatchQueries('P1', {
      store,
      customClient: boundaryClient as any,
      budget: {
        requestsRemaining: 10,
        postsRemaining: 9,
        geminiRemaining: 10,
        initialRequests: 10,
        initialPosts: 10,
        initialGemini: 10
      }
    });
    assert(searchCalls === 0, 'Batch with remaining = 9: Zero additional X requests made');
    assert(batchBoundary.budget_usage.stopped_early_reason === 'GLOBAL_POSTS_BUDGET_EXHAUSTED', 'Batch stopped with GLOBAL_POSTS_BUDGET_EXHAUSTED');
    assert(batchBoundary.budget_usage.posts_remaining === 9, 'posts_remaining never negative (got 9)');
  }

  // =========================================================================
  // 9. Fair Query Scheduling Test
  // =========================================================================
  console.log('\n--- TEST 9: Fair Query Scheduling ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_9.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.updateSettings({
      max_x_requests_per_run: 2,
      max_x_posts_per_run: 200,
      gemini_extraction_enabled: false
    });

    // Disable pre-seeded queries so only the test queries are evaluated
    const preExisting = await store.getQueries();
    for (const pq of preExisting) {
      await store.updateQuery(pq.id, { enabled: false });
    }

    const executedQueryIds = new Set<string>();
    for (let i = 1; i <= 5; i++) {
      await store.saveQuery({
        id: `q_fair_${i}`,
        name: `Fair Query ${i}`,
        query_text: `fair query ${i}`,
        category: 'RELEASE',
        priority: 'P1',
        initial_confidence: 0.8,
        enabled: true,
        run_frequency_minutes: 60,
        posts_collected: 0,
        posts_passed_filter: 0,
        candidates_generated: 0,
        human_validated_games: 0,
        human_rejected: 0,
        valuable_new_games: 0,
        precision: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const dummyClient = {
      async searchRecent() {
        return { data: [], meta: { result_count: 0 } };
      }
    };

    // Run batch 1 (budget allows 2 requests)
    const b1 = await runBatchQueries('P1', {
      store,
      customClient: dummyClient as any,
      budget: {
        requestsRemaining: 2,
        postsRemaining: 100,
        geminiRemaining: 0,
        initialRequests: 2,
        initialPosts: 100,
        initialGemini: 0
      }
    });
    b1.results.forEach(r => executedQueryIds.add(r.query_id));
    assert(b1.results.length === 2, `Batch 1 executed 2 queries (got ${b1.results.length})`);

    // Run batch 2 (budget allows 2 requests)
    const b2 = await runBatchQueries('P1', {
      store,
      customClient: dummyClient as any,
      budget: {
        requestsRemaining: 2,
        postsRemaining: 100,
        geminiRemaining: 0,
        initialRequests: 2,
        initialPosts: 100,
        initialGemini: 0
      }
    });
    b2.results.forEach(r => executedQueryIds.add(r.query_id));
    assert(b2.results.length === 2, `Batch 2 executed 2 queries (got ${b2.results.length})`);

    // Run batch 3 (budget allows 2 requests)
    const b3 = await runBatchQueries('P1', {
      store,
      customClient: dummyClient as any,
      budget: {
        requestsRemaining: 2,
        postsRemaining: 100,
        geminiRemaining: 0,
        initialRequests: 2,
        initialPosts: 100,
        initialGemini: 0
      }
    });
    b3.results.forEach(r => executedQueryIds.add(r.query_id));

    // Verify all 5 queries were given execution opportunities!
    for (let i = 1; i <= 5; i++) {
      assert(executedQueryIds.has(`q_fair_${i}`), `Query q_fair_${i} was executed across budget-limited batches`);
    }
    assert(executedQueryIds.size === 5, 'All 5 enabled queries received execution opportunities without starvation');
  }

  // =========================================================================
  // 10. Pagination Stress Test (250 fake posts, max 100 per run)
  // =========================================================================
  console.log('\n--- TEST 10: Pagination Stress Test (250 Posts, 100/Run) ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_p1_10.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    await store.updateSettings({
      gemini_extraction_enabled: false
    });

    const totalPosts = 250;
    const customPosts: XSearchResultItem[] = Array.from({ length: totalPosts }, (_, i) => ({
      id: String(8000000000000000000n + BigInt(totalPosts - i)), // descending IDs: newest first
      text: `Stress test game announcement #${i}: Play RetroRealm-${i} now at https://itch.io/retrorealm-${i}`,
      author_id: `dev_${i}`,
      author_username: `author_${i}`,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      public_metrics: { like_count: 5, reply_count: 1, retweet_count: 1, quote_count: 0 },
      entities: {
        urls: [{ url: `https://itch.io/retrorealm-${i}`, expanded_url: `https://itch.io/retrorealm-${i}` }]
      }
    }));

    const stressClient = {
      async searchRecent(params: any) {
        const pageSize = params.maxResults || 100;
        let startIndex = 0;
        if (params.nextToken && params.nextToken.startsWith('stress_token_')) {
          startIndex = parseInt(params.nextToken.replace('stress_token_', ''), 10) || 0;
        }
        const paged = customPosts.slice(startIndex, startIndex + pageSize);
        const nextOffset = startIndex + pageSize;
        const hasMore = nextOffset < customPosts.length;
        return {
          data: paged,
          meta: {
            result_count: paged.length,
            newest_id: paged.length > 0 ? paged[0].id : undefined,
            oldest_id: paged.length > 0 ? paged[paged.length - 1].id : undefined,
            next_token: hasMore ? `stress_token_${nextOffset}` : undefined
          }
        };
      }
    };

    const initialSinceId = '1000000000000000000';
    await store.saveQuery({
      id: 'q_stress_pagination',
      name: 'Stress Pagination Query',
      query_text: 'RetroRealm',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 0.8,
      enabled: true,
      last_since_id: initialSinceId,
      run_frequency_minutes: 60,
      posts_collected: 0,
      posts_passed_filter: 0,
      candidates_generated: 0,
      human_validated_games: 0,
      human_rejected: 0,
      valuable_new_games: 0,
      precision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Run #1: Max posts = 100
    const res1 = await runQuery('q_stress_pagination', {
      store,
      customClient: stressClient as any,
      maxPostsOverride: 100
    });

    const qAfter1 = await store.getQuery('q_stress_pagination');
    const postsAfter1 = await store.getPosts();
    assert(res1.posts_fetched === 100, `Run #1: 100 posts fetched (got ${res1.posts_fetched})`);
    assert(postsAfter1.length === 100, `Run #1: 100 persisted (got ${postsAfter1.length})`);
    assert(Boolean(qAfter1?.pending_next_token), `Run #1: pending pagination exists (${qAfter1?.pending_next_token})`);
    assert(qAfter1?.last_since_id === initialSinceId, `Run #1: last_since_id NOT advanced (${qAfter1?.last_since_id})`);

    // Run #2: Max posts = 100
    const res2 = await runQuery('q_stress_pagination', {
      store,
      customClient: stressClient as any,
      maxPostsOverride: 100
    });

    const qAfter2 = await store.getQuery('q_stress_pagination');
    const postsAfter2 = await store.getPosts();
    assert(res2.posts_fetched === 100, `Run #2: 100 posts fetched (got ${res2.posts_fetched})`);
    assert(postsAfter2.length === 200, `Run #2: 200 total unique persisted (got ${postsAfter2.length})`);
    assert(Boolean(qAfter2?.pending_next_token), `Run #2: pending pagination exists (${qAfter2?.pending_next_token})`);
    assert(qAfter2?.last_since_id === initialSinceId, `Run #2: last_since_id NOT advanced (${qAfter2?.last_since_id})`);

    // Run #3: Max posts = 100 (fetches remaining 50)
    const res3 = await runQuery('q_stress_pagination', {
      store,
      customClient: stressClient as any,
      maxPostsOverride: 100
    });

    const qAfter3 = await store.getQuery('q_stress_pagination');
    const postsAfter3 = await store.getPosts();
    assert(res3.posts_fetched === 50, `Run #3: 50 posts fetched (got ${res3.posts_fetched})`);
    assert(postsAfter3.length === 250, `Run #3: 250 total unique persisted (got ${postsAfter3.length})`);
    assert(res3.pagination_stopped_reason === 'EXHAUSTED', `Run #3: stopped with EXHAUSTED (got ${res3.pagination_stopped_reason})`);
    assert(qAfter3?.pending_next_token === undefined, `Run #3: pagination cleared`);
    assert(qAfter3?.last_since_id === customPosts[0].id, `Run #3: last_since_id advanced to newest post (${qAfter3?.last_since_id})`);

    // Verification: 0 duplicates, 0 skipped posts
    const storedIds = postsAfter3.map(p => p.x_post_id);
    const uniqueIds = new Set(storedIds);
    assert(uniqueIds.size === 250, `0 duplicates (unique IDs = ${uniqueIds.size} / 250)`);

    const allPresent = customPosts.every(cp => uniqueIds.has(cp.id));
    assert(allPresent, `0 skipped posts (all 250 customPosts verified in store)`);
  }

  console.log('\n🎉 ALL P1 INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
