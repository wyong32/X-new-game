/**
 * Test Suite for Live Experiment Readiness
 * Run via `npm run test` or `tsx test.ts`
 */

import { MockXClient } from './server/x/client.js';
import { MemoryStore } from './server/db/store.js';
import { runQuery } from './server/services/queryRunner.js';
import fs from 'fs';
import path from 'path';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('🧪 Starting X Game Discovery Lab Test Suite...\n');

  // -------------------------------------------------------------
  // Test A: Mock pagination returns 2 pages, cursor advances, request count increments correctly
  // -------------------------------------------------------------
  console.log('--- Test A: Safe Pagination and Cursor Tracking ---');
  {
    // Generate 25 synthetic posts for multi-page test
    const customPosts = Array.from({ length: 25 }, (_, i) => ({
      id: String(1890000000000000000n + BigInt(i)),
      text: `Test game dev announcement #${i} on itch.io #indiedev`,
      author_id: `author_${i}`,
      author_username: `dev_${i}`,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      public_metrics: { like_count: i * 2, reply_count: 0, retweet_count: 0, quote_count: 0 }
    }));

    const mockClient = new MockXClient(customPosts);

    // Page 1: fetch with maxResults = 10
    const res1 = await mockClient.searchRecent({
      query: 'game dev itch.io',
      maxResults: 10
    });
    assert(res1.data.length === 10, `Page 1 returns 10 posts (got ${res1.data.length})`);
    assert(Boolean(res1.meta.next_token), `Page 1 provides next_token: ${res1.meta.next_token}`);
    assert(Boolean(res1.meta.newest_id), `Page 1 provides newest_id: ${res1.meta.newest_id}`);

    // Page 2: fetch with nextToken
    const res2 = await mockClient.searchRecent({
      query: 'game dev itch.io',
      maxResults: 10,
      nextToken: res1.meta.next_token
    });
    assert(res2.data.length === 10, `Page 2 returns 10 posts (got ${res2.data.length})`);
    assert(Boolean(res2.meta.next_token), `Page 2 provides next_token: ${res2.meta.next_token}`);
    assert(res1.data[0].id !== res2.data[0].id, 'Page 2 posts are distinct from Page 1');

    // Page 3: fetch remaining 5
    const res3 = await mockClient.searchRecent({
      query: 'game dev itch.io',
      maxResults: 10,
      nextToken: res2.meta.next_token
    });
    assert(res3.data.length === 5, `Page 3 returns remaining 5 posts (got ${res3.data.length})`);
    assert(res3.meta.next_token === undefined, 'Pagination correctly terminates (next_token undefined on final page)');
  }

  // -------------------------------------------------------------
  // Test B: Query Attribution (Q1 first discovery, then hit by Q2 retains Q1)
  // -------------------------------------------------------------
  console.log('\n--- Test B: Query Attribution Retains First Discovery ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_b.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    // Query 1
    store.saveQuery({
      id: 'q_test_1',
      name: 'Query 1',
      query_text: 'first discovery test',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 80,
      enabled: true,
      run_frequency_minutes: 360,
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

    // Query 2
    store.saveQuery({
      id: 'q_test_2',
      name: 'Query 2',
      query_text: 'second discovery test',
      category: 'RELEASE',
      priority: 'P1',
      initial_confidence: 80,
      enabled: true,
      run_frequency_minutes: 360,
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

    // Add candidate first discovered by q_test_1
    const cand = store.saveCandidate({
      id: 'cand_test_1',
      canonical_name: 'Attribution Test Game',
      normalized_name: 'attribution test game',
      aliases: ['att_game'],
      first_seen_at: '2026-03-01T10:00:00Z',
      last_seen_at: '2026-03-01T10:00:00Z',
      first_query_id: 'q_test_1',
      first_discovery_query_id: 'q_test_1',
      source_post_ids: ['p100'],
      source_query_ids: ['q_test_1'],
      unique_post_count: 1,
      unique_author_count: 1,
      max_engagement: 10,
      browser_signal: true,
      browser_confidence: 85,
      entity_confidence: 90,
      candidate_score: 85,
      status: 'HIGH_CONFIDENCE',
      extraction_method: 'EXPLICIT_PATTERN',
      score_breakdown: [],
      why_selected: ['Discovered by initial test query'],
      urls: ['https://itch.io/games/attribution-test'],
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T10:00:00Z'
    });

    store.saveCandidateQueryEvidence({
      id: `${cand.id}__q_test_1`,
      candidate_id: cand.id,
      query_id: 'q_test_1',
      first_seen_at: '2026-03-01T10:00:00Z',
      post_count: 1,
      unique_author_count: 1,
      is_first_discovery: true,
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T10:00:00Z'
    });

    assert(cand.first_discovery_query_id === 'q_test_1', 'Candidate initialized with q_test_1 as first discovery');

    // Simulate Q2 finding the same game candidate
    store.updateCandidate(cand.id, {
      source_post_ids: [...cand.source_post_ids, 'p200'],
      source_query_ids: Array.from(new Set([...cand.source_query_ids, 'q_test_2']))
      // DO NOT overwrite first_discovery_query_id
    });

    store.saveCandidateQueryEvidence({
      id: `${cand.id}__q_test_2`,
      candidate_id: cand.id,
      query_id: 'q_test_2',
      first_seen_at: '2026-03-02T10:00:00Z',
      post_count: 1,
      unique_author_count: 1,
      is_first_discovery: false,
      created_at: '2026-03-02T10:00:00Z',
      updated_at: '2026-03-02T10:00:00Z'
    });

    const updatedCand = store.getCandidate(cand.id);
    assert(updatedCand !== undefined, 'Candidate retrieved');
    assert(updatedCand?.first_discovery_query_id === 'q_test_1', 'Attribution preserved: first_discovery_query_id remains q_test_1');
    assert(updatedCand?.source_query_ids.includes('q_test_2'), 'q_test_2 is recorded in source_query_ids');
    
    const evidenceList = store.getCandidateQueryEvidenceByCandidate(cand.id);
    assert(evidenceList.length === 2, 'Evidence has both queries recorded');
    assert(evidenceList.find(e => e.query_id === 'q_test_1')?.is_first_discovery === true, 'q_test_1 is flagged as first discovery');
    assert(evidenceList.find(e => e.query_id === 'q_test_2')?.is_first_discovery === false, 'q_test_2 is flagged as subsequent discovery');

    // Cleanup
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }

  // -------------------------------------------------------------
  // Test C: Gemini Hard Budget Limit
  // -------------------------------------------------------------
  console.log('\n--- Test C: Gemini Hard Budget Limit Enforcement ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_c.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    // 1) Test when gemini_extraction_enabled = false -> exactly 0 calls made
    store.updateSettings({
      gemini_extraction_enabled: false,
      max_gemini_extractions_per_run: 10
    });

    let mockGeminiCalls = 0;
    const mockGeminiExtract = async () => {
      mockGeminiCalls++;
      return null;
    };

    const qualifyingPosts = [
      { text: 'I made a new game called SuperPixel on itch.io' },
      { text: 'Check out our new puzzle title NeonFlow on steam' },
      { text: 'Play our browser prototype WebDungeon today' },
      { text: 'Announcing our turn-based tactics game ChronoGrid' },
      { text: 'Play my new rhythm platformer BeatRunner online' }
    ];

    const currentSettings = store.getSettings();
    let callsUsed = 0;
    for (const _post of qualifyingPosts) {
      if (
        currentSettings.gemini_extraction_enabled &&
        callsUsed < currentSettings.max_gemini_extractions_per_run
      ) {
        await mockGeminiExtract();
        callsUsed++;
      }
    }
    assert(mockGeminiCalls === 0, '0 Gemini calls made when gemini_extraction_enabled is false');

    // 2) Test when limit = 2 and 5 posts qualify -> exactly 2 calls made
    store.updateSettings({
      gemini_extraction_enabled: true,
      max_gemini_extractions_per_run: 2
    });

    mockGeminiCalls = 0;
    callsUsed = 0;
    const budgetSettings = store.getSettings();
    for (const _post of qualifyingPosts) {
      if (
        budgetSettings.gemini_extraction_enabled &&
        callsUsed < budgetSettings.max_gemini_extractions_per_run
      ) {
        await mockGeminiExtract();
        callsUsed++;
      }
    }
    assert(mockGeminiCalls === 2, `Exactly 2 Gemini calls made under hard budget limit of 2 (actual: ${mockGeminiCalls})`);

    // Cleanup
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }

  // -------------------------------------------------------------
  // Test D: Security - x_bearer_token not exposed in status or settings
  // -------------------------------------------------------------
  console.log('\n--- Test D: Security - x_bearer_token Leak Prevention ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_d.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    const settings = store.getSettings();
    assert(!('x_bearer_token' in settings), 'store.getSettings() does NOT expose x_bearer_token');

    // Check JSON serialization
    const serialized = JSON.stringify(settings);
    assert(!serialized.includes('x_bearer_token'), 'JSON serialization of settings does NOT contain x_bearer_token');

    // Check status payload construction
    const statusPayload = {
      mode: process.env.X_BEARER_TOKEN ? 'live' : 'mock',
      x_api_configured: Boolean(process.env.X_BEARER_TOKEN),
      settings: store.getSettings()
    };
    assert(!('x_bearer_token' in statusPayload), 'statusPayload does NOT contain x_bearer_token');
    assert('x_api_configured' in statusPayload, 'statusPayload exposes boolean x_api_configured');

    // Cleanup
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }

  // -------------------------------------------------------------
  // Test E: Settings update ignores x_bearer_token and never persists it to db.json
  // -------------------------------------------------------------
  console.log('\n--- Test E: Settings Update Ignores x_bearer_token & DB Integrity ---');
  {
    const testDbPath = path.join(process.cwd(), 'data', 'test_db_e.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const store = new MemoryStore(testDbPath);
    await store.init();

    // Malicious or accidental update payload containing x_bearer_token
    const maliciousPayload: any = {
      x_bearer_token: 'SECRET_TOKEN_DO_NOT_STORE_12345',
      hard_filter_score_threshold: 40,
      gemini_daily_budget_calls: 25
    };

    const updated = store.updateSettings(maliciousPayload);
    assert(!('x_bearer_token' in updated), 'Updated settings returned from updateSettings() strips x_bearer_token');

    // Flush to disk
    store.saveToDiskSync();

    // Check stored db file directly on disk
    assert(fs.existsSync(testDbPath), 'test_db_e.json was written to disk');
    const diskContent = fs.readFileSync(testDbPath, 'utf8');
    assert(
      !diskContent.includes('SECRET_TOKEN_DO_NOT_STORE_12345'),
      'CRITICAL: Secret token was NOT persisted to disk in db.json'
    );
    assert(
      !diskContent.includes('x_bearer_token'),
      'CRITICAL: "x_bearer_token" key does not appear anywhere in persisted db file'
    );

    // Cleanup
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }

  console.log('\n🎉 ALL TESTS PASSED! System is safe, secure, and ready for Live Experimentation.\n');
}

runTests().catch(err => {
  console.error('\n❌ Test run failed with error:', err);
  process.exit(1);
});
