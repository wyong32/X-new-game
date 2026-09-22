import type {
  GameCandidate,
  XPost,
  CandidateStatus,
  ScoreFactor,
  ExtractionMethod
} from '../../src/types.js';
import { normalizeGameName, isGenericTitle } from './normalization.js';

/**
 * Calculates Candidate Score (0-100) and produces full explainable breakdown.
 */
export function computeCandidateScore(candidate: {
  canonical_name: string;
  normalized_name: string;
  posts: XPost[];
  extraction_method: ExtractionMethod;
  browser_signal: boolean;
}): {
  candidate_score: number;
  entity_confidence: number;
  browser_confidence: number;
  score_breakdown: ScoreFactor[];
  why_selected: string[];
} {
  const breakdown: ScoreFactor[] = [];
  const why_selected: string[] = [];
  const isGeneric = isGenericTitle(candidate.canonical_name);

  // 1. Entity confidence (max 30)
  let entityConfidencePoints = 0;
  if (candidate.extraction_method === 'URL_SLUG' || candidate.extraction_method === 'URL_METADATA') {
    entityConfidencePoints = 28;
    breakdown.push({
      name: 'Entity Confidence',
      points: isGeneric ? 14 : 28,
      maxPoints: 30,
      reason: isGeneric
        ? 'URL slug/metadata title (generic name penalty -50%)'
        : 'High confidence direct game URL extraction'
    });
  } else if (candidate.extraction_method === 'EXPLICIT_PATTERN') {
    entityConfidencePoints = 26;
    breakdown.push({
      name: 'Entity Confidence',
      points: isGeneric ? 12 : 26,
      maxPoints: 30,
      reason: isGeneric
        ? 'Explicit pattern match (generic name penalty -50%)'
        : 'Explicit game title declaration pattern matched'
    });
  } else if (candidate.extraction_method === 'GEMINI') {
    entityConfidencePoints = 24;
    breakdown.push({
      name: 'Entity Confidence',
      points: isGeneric ? 12 : 24,
      maxPoints: 30,
      reason: 'Gemini AI contextual entity validation'
    });
  } else if (candidate.extraction_method === 'HASHTAG') {
    entityConfidencePoints = 18;
    breakdown.push({
      name: 'Entity Confidence',
      points: isGeneric ? 9 : 18,
      maxPoints: 30,
      reason: 'Game title extracted from specific CamelCase hashtag'
    });
  } else {
    entityConfidencePoints = 14;
    breakdown.push({
      name: 'Entity Confidence',
      points: isGeneric ? 7 : 14,
      maxPoints: 30,
      reason: 'Heuristic title extraction'
    });
  }
  if (isGeneric) {
    entityConfidencePoints = Math.round(entityConfidencePoints / 2);
    why_selected.push(`Note: Title "${candidate.canonical_name}" is in the generic dictionary; requires extra validation`);
  }

  // 2. Release evidence (max 20)
  const hasReleasePhrase = candidate.posts.some(p =>
    p.game_context_positive_reasons.some(r => r.includes('Explicit release phrase'))
  );
  let releasePoints = 0;
  if (hasReleasePhrase) {
    releasePoints = 20;
    breakdown.push({
      name: 'Release Evidence',
      points: 20,
      maxPoints: 20,
      reason: 'Clear release/launch phrasing in source post'
    });
    why_selected.push('Source post explicitly announced game release or launch');
  } else {
    releasePoints = 8;
    breakdown.push({
      name: 'Release Evidence',
      points: 8,
      maxPoints: 20,
      reason: 'Game showcased but without explicit release phrase'
    });
  }

  // 3. Playable URL / Store Page Evidence (max 15)
  const hasPlayableUrl = candidate.posts.some(p =>
    p.urls.some(u => /(?:itch\.io|store\.steampowered\.com|poki\.com|crazygames\.com|newgrounds\.com|github\.io)/i.test(u))
  );
  const hasAnyUrl = candidate.posts.some(p => p.urls.length > 0);
  let urlPoints = 0;
  if (hasPlayableUrl) {
    urlPoints = 15;
    breakdown.push({
      name: 'URL Evidence',
      points: 15,
      maxPoints: 15,
      reason: 'Direct playable platform or store link (itch.io, Steam, Poki, CrazyGames)'
    });
    why_selected.push('Direct playable link detected on recognized platform');
  } else if (hasAnyUrl) {
    urlPoints = 7;
    breakdown.push({
      name: 'URL Evidence',
      points: 7,
      maxPoints: 15,
      reason: 'External link provided'
    });
  } else {
    breakdown.push({
      name: 'URL Evidence',
      points: 0,
      maxPoints: 15,
      reason: 'No external URL in source post'
    });
  }

  // 4. Independent authors (max 15)
  const uniqueAuthors = new Set(candidate.posts.map(p => p.author_id)).size;
  let authorPoints = 0;
  if (uniqueAuthors >= 3) {
    authorPoints = 15;
    breakdown.push({
      name: 'Independent Authors',
      points: 15,
      maxPoints: 15,
      reason: `${uniqueAuthors} independent authors posted about this game`
    });
    why_selected.push(`Corroborated by ${uniqueAuthors} independent creators/players on X`);
  } else if (uniqueAuthors === 2) {
    authorPoints = 12;
    breakdown.push({
      name: 'Independent Authors',
      points: 12,
      maxPoints: 15,
      reason: '2 distinct authors posted about this game'
    });
    why_selected.push('Multiple distinct authors posted about this game');
  } else {
    authorPoints = 8;
    breakdown.push({
      name: 'Independent Authors',
      points: 8,
      maxPoints: 15,
      reason: '1 author (developer release post)'
    });
  }

  // 5. Browser / H5 evidence (max 10)
  let browserPoints = 0;
  let browserConfidence = 0;
  if (candidate.browser_signal) {
    browserPoints = 10;
    browserConfidence = 0.95;
    breakdown.push({
      name: 'Browser/Web Signal',
      points: 10,
      maxPoints: 10,
      reason: 'Browser playable keywords (HTML5/WebGL/play in browser) or web game portal URL'
    });
    why_selected.push('Identified as web/browser playable game (HTML5/WebGL/Browser platform)');
  } else {
    breakdown.push({
      name: 'Browser/Web Signal',
      points: 0,
      maxPoints: 10,
      reason: 'No explicit browser playable signal (likely PC/Steam indie)'
    });
  }

  // 6. Freshness (max 5)
  // <=24h = 5, <=72h = 3, <=7d = 1, >7d = 0
  const earliestPostTime = candidate.posts.length > 0
    ? Math.min(...candidate.posts.map(p => new Date(p.created_at).getTime() || Date.now()))
    : Date.now();
  const hoursSinceEarliest = Math.max(0, (Date.now() - earliestPostTime) / (1000 * 60 * 60));
  let freshnessPoints = 0;
  let freshnessReason = '';
  if (hoursSinceEarliest <= 24) {
    freshnessPoints = 5;
    freshnessReason = 'Recently discovered (<=24h)';
  } else if (hoursSinceEarliest <= 72) {
    freshnessPoints = 3;
    freshnessReason = 'Discovered <=72h ago';
  } else if (hoursSinceEarliest <= 24 * 7) {
    freshnessPoints = 1;
    freshnessReason = 'Discovered <=7d ago';
  } else {
    freshnessPoints = 0;
    freshnessReason = 'Discovered >7d ago';
  }

  breakdown.push({
    name: 'Freshness',
    points: freshnessPoints,
    maxPoints: 5,
    reason: freshnessReason
  });

  // 7. Engagement (max 5)
  const maxLikes = Math.max(...candidate.posts.map(p => p.like_count || 0), 0);
  let engagementPoints = 2;
  if (maxLikes > 50) engagementPoints = 5;
  else if (maxLikes > 10) engagementPoints = 4;
  else if (maxLikes > 0) engagementPoints = 3;

  breakdown.push({
    name: 'Engagement',
    points: engagementPoints,
    maxPoints: 5,
    reason: `Max likes ${maxLikes} (low weight to protect early-stage discoveries)`
  });

  const totalScore = Math.min(
    100,
    entityConfidencePoints +
      releasePoints +
      urlPoints +
      authorPoints +
      browserPoints +
      freshnessPoints +
      engagementPoints
  );

  return {
    candidate_score: totalScore,
    entity_confidence: entityConfidencePoints,
    browser_confidence: browserConfidence,
    score_breakdown: breakdown,
    why_selected
  };
}

export function determineCandidateStatus(score: number): CandidateStatus {
  if (score >= 80) return 'HIGH_CONFIDENCE';
  if (score >= 60) return 'REVIEW';
  if (score >= 40) return 'WEAK';
  return 'NOISE';
}

/**
 * Checks if two entities should merge according to Section 29:
 * 1. same linked game URL
 * 2. same normalized name + compatible evidence
 * 3. exact alias match
 * 4. high string similarity without generic word false-positive
 */
export function shouldMergeCandidates(
  a: { canonical_name: string; normalized_name: string; aliases: string[]; urls: string[] },
  b: { canonical_name: string; normalized_name: string; aliases: string[]; urls: string[] }
): boolean {
  // 1. Same linked game URL
  const sharedUrls = a.urls.filter(u =>
    b.urls.includes(u) &&
    !u.endsWith('/') &&
    !u.includes('twitter.com') &&
    !u.includes('x.com')
  );
  if (sharedUrls.length > 0) {
    return true;
  }

  // 2. Same normalized name
  if (a.normalized_name === b.normalized_name && a.normalized_name.length > 2) {
    return true;
  }

  // 3. Exact alias match
  if (a.aliases.includes(b.canonical_name) || b.aliases.includes(a.canonical_name)) {
    return true;
  }

  // 4. Check if one normalized title is prefix with "demo" or "edition" removed
  // e.g. "tiny frog" and "tiny frog demo" normalize to the same key already.
  // But DO NOT merge if one is simply a generic single word ("dungeon" and "tiny dungeon")
  if (
    !isGenericTitle(a.canonical_name) &&
    !isGenericTitle(b.canonical_name)
  ) {
    if (
      a.normalized_name.startsWith(b.normalized_name) ||
      b.normalized_name.startsWith(a.normalized_name)
    ) {
      // Must be very close in length (e.g. within 5 chars) to prevent broad submatch
      const diff = Math.abs(a.normalized_name.length - b.normalized_name.length);
      if (diff <= 6) {
        return true;
      }
    }
  }

  return false;
}
