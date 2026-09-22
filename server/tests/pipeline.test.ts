import { hardFilterPost } from '../services/hardFilter.js';
import { calculateGameContextScore } from '../services/gameContext.js';
import { extractFromExplicitPatterns, extractFromUrls } from '../services/entityExtraction.js';
import { normalizeGameName, isGenericTitle } from '../services/normalization.js';
import { shouldMergeCandidates, computeCandidateScore } from '../services/candidateService.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

console.log('--- Running Pipeline Tests ---');

// 1. Hard Filter Tests
const realRelease = hardFilterPost('Just released my game FROGBLOOD on itch! Check it out.');
assert(realRelease.passed, 'Hard filter passes real release');

const jobPost = hardFilterPost('We are hiring a Senior Unity Developer for our London studio!');
assert(!jobPost.passed && jobPost.rejectReasons.includes('Recruitment / Job posting'), 'Hard filter rejects recruitment');

const tutorialPost = hardFilterPost('How to make games in Godot 4: Complete beginner course tutorial.');
assert(!tutorialPost.passed && tutorialPost.rejectReasons.includes('Tutorial / Educational course'), 'Hard filter rejects tutorial');

const assetPackPost = hardFilterPost('New 3D low poly fantasy asset pack on sale in Unreal Marketplace!');
assert(!assetPackPost.passed && assetPackPost.rejectReasons.includes('Asset pack / Plugin / Store sale'), 'Hard filter rejects asset pack');

// 2. Context Score Tests
const highContext = calculateGameContextScore({
  text: 'Just released my game! Playable in browser on itch.',
  urls: ['https://danieldoan.itch.io/frogblood'],
  has_media: true
});
assert(highContext.score >= 70, `Context score for release + playable URL is high (${highContext.score})`);

const genericAdvice = calculateGameContextScore({
  text: 'Honestly making games is 10% coding and 90% fixing things you broke.',
  urls: []
});
assert(genericAdvice.score < 30, `Context score for generic gamedev comment is low (${genericAdvice.score})`);

// 3. Entity Extraction Tests
const extracted1 = extractFromExplicitPatterns('I made a game called Tiny Frog for mobile and web');
assert(extracted1?.name === 'Tiny Frog', 'Extracts game title from "I made a game called Tiny Frog"');

const extracted2 = extractFromExplicitPatterns('My new game "Pixel Frog Hotel" is out now on Poki!');
assert(extracted2?.name === 'Pixel Frog Hotel', 'Extracts game title from quoted structure "Pixel Frog Hotel"');

const urlExt = extractFromUrls(['https://danieldoan.itch.io/frogblood']);
assert(urlExt?.name === 'Frogblood', 'Extracts clean title from itch.io URL slug');

// 4. Normalization Tests
const norm1 = normalizeGameName('Tiny Frog Demo');
const norm2 = normalizeGameName('TINY FROG™');
const norm3 = normalizeGameName('Tiny-Frog');
assert(norm1 === 'tiny frog' && norm2 === 'tiny frog' && norm3 === 'tiny frog', 'Normalized key collapses demo, ™, and hyphens to "tiny frog"');

// 5. Generic Title Protection Tests
assert(isGenericTitle('Run'), 'Detects "Run" as generic title');
assert(isGenericTitle('Battle'), 'Detects "Battle" as generic title');
assert(!isGenericTitle('FROGBLOOD'), 'Recognizes "FROGBLOOD" as non-generic');
assert(!isGenericTitle('Pixel Frog Hotel'), 'Recognizes "Pixel Frog Hotel" as non-generic');

// 6. Deduplication Tests
const shouldMerge = shouldMergeCandidates(
  {
    canonical_name: 'Tiny Frog',
    normalized_name: 'tiny frog',
    aliases: [],
    urls: ['https://dev.itch.io/tiny-frog']
  },
  {
    canonical_name: 'Tiny Frog Demo',
    normalized_name: 'tiny frog',
    aliases: [],
    urls: ['https://dev.itch.io/tiny-frog']
  }
);
assert(shouldMerge, 'Clusters "Tiny Frog" and "Tiny Frog Demo" when normalized name matches');

const shouldNotMerge = shouldMergeCandidates(
  {
    canonical_name: 'Dungeon',
    normalized_name: 'dungeon',
    aliases: [],
    urls: []
  },
  {
    canonical_name: 'Tiny Dungeon',
    normalized_name: 'tiny dungeon',
    aliases: [],
    urls: []
  }
);
assert(!shouldNotMerge, 'Prevents merging generic single-word "Dungeon" with "Tiny Dungeon"');

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
