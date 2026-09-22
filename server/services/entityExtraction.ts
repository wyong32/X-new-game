import { cleanCanonicalTitle, normalizeGameName, isGenericTitle } from './normalization.js';
import type { ExtractionMethod } from '../../src/types.js';

export interface ExtractedEntityResult {
  game_name: string | null;
  method: ExtractionMethod;
  confidence: number;
  evidence: string[];
}

const BANNED_TITLES = new Set([
  'steam', 'itch', 'itch.io', 'unity', 'unreal', 'unreal engine', 'godot',
  'phaser', 'webgl', 'html5', 'pico-8', 'blender', 'gamemaker', 'construct',
  'indiedev', 'gamedev', 'gamejam', 'pixelart', 'game', 'games', 'video game',
  'indie game', 'my game', 'our game', 'new game', 'this game', 'today', 'now',
  'free', 'demo', 'update', 'trailer', 'link', 'below', 'enjoy', 'check it out'
]);

function isValidExtractedName(candidate: string): boolean {
  if (!candidate) return false;
  const cleaned = candidate.trim();
  if (cleaned.length < 2 || cleaned.length > 50) return false;

  const lower = cleaned.toLowerCase();
  if (BANNED_TITLES.has(lower)) return false;

  // Should not start with http or @
  if (/^(?:https?:\/\/|@|#)/i.test(cleaned)) return false;

  // Should not be purely punctuation or numbers
  if (!/[a-zA-Z]/.test(cleaned)) return false;

  return true;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * 1. URL Evidence Extraction
 */
export function extractFromUrls(urls: string[]): { name: string; evidence: string } | null {
  for (const url of urls) {
    try {
      const parsed = new URL(url);

      // itch.io: https://developer.itch.io/frogblood or https://itch.io/games/...
      if (parsed.hostname.endsWith('itch.io')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 1 && !['games', 'profile', 'community'].includes(parts[0])) {
          const rawSlug = parts[0];
          const name = titleCaseSlug(rawSlug);
          if (isValidExtractedName(name)) {
            return { name, evidence: `Extracted from itch.io slug: ${url}` };
          }
        }
      }

      // Steam: https://store.steampowered.com/app/12345/Frogblood_Carnival/
      if (parsed.hostname.includes('steampowered.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 3 && parts[0] === 'app') {
          const rawSlug = parts[2];
          const name = titleCaseSlug(rawSlug);
          if (isValidExtractedName(name)) {
            return { name, evidence: `Extracted from Steam store slug: ${url}` };
          }
        }
      }

      // Poki: https://poki.com/en/g/pixel-frog-hotel
      if (parsed.hostname.includes('poki.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const gIndex = parts.indexOf('g');
        if (gIndex !== -1 && parts[gIndex + 1]) {
          const name = titleCaseSlug(parts[gIndex + 1]);
          if (isValidExtractedName(name)) {
            return { name, evidence: `Extracted from Poki game slug: ${url}` };
          }
        }
      }

      // CrazyGames: https://crazygames.com/game/browser-knight
      if (parsed.hostname.includes('crazygames.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const gameIndex = parts.indexOf('game');
        if (gameIndex !== -1 && parts[gameIndex + 1]) {
          const name = titleCaseSlug(parts[gameIndex + 1]);
          if (isValidExtractedName(name)) {
            return { name, evidence: `Extracted from CrazyGames slug: ${url}` };
          }
        }
      }

      // Newgrounds: https://www.newgrounds.com/portal/view/123456 (title usually in hash or path)
      // GitHub Pages: https://user.github.io/game-title/
      if (parsed.hostname.endsWith('github.io')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 1) {
          const name = titleCaseSlug(parts[0]);
          if (isValidExtractedName(name)) {
            return { name, evidence: `Extracted from GitHub Pages repository slug: ${url}` };
          }
        }
      }
    } catch {
      // Invalid URL, continue
    }
  }
  return null;
}

/**
 * 2. Explicit Language Patterns
 */
export function extractFromExplicitPatterns(text: string): { name: string; evidence: string } | null {
  const patterns: { regex: RegExp; desc: string }[] = [
    // "I made a game called 'Tiny Frog'" or "I made a game called FROGBLOOD"
    {
      regex: /(?:i made|we made|created|developed|built)\s+(?:a|this)?\s*(?:new\s+)?game\s+called\s+['"“]([^'"”\n]+)['"”]/i,
      desc: 'Pattern: "game called \'[GAME]\'"'
    },
    {
      regex: /(?:i made|we made|created|developed|built)\s+(?:a|this)?\s*(?:new\s+)?game\s+called\s+([A-Z0-9][a-zA-Z0-9\s'-]{2,30})(?=[.,!?;:\s]|$)/i,
      desc: 'Pattern: "game called [GAME]"'
    },
    // "My game 'Tiny Frog' is out now" or "My new game FROGBLOOD is playable"
    {
      regex: /(?:my|our)\s+(?:new\s+)?game\s+['"“]([^'"”\n]+)['"”]/i,
      desc: 'Pattern: "my game \'[GAME]\'"'
    },
    {
      regex: /(?:my|our)\s+(?:new\s+)?game\s+([A-Z0-9][a-zA-Z0-9\s'-]{2,25})\s+(?:is\s+out|just\s+released|just\s+launched|is\s+playable|is\s+available)/i,
      desc: 'Pattern: "my game [GAME] is out/released"'
    },
    // "I just released 'Tiny Frog' on Steam"
    {
      regex: /i\s+(?:finally|just)\s+released\s+['"“]([^'"”\n]+)['"”]/i,
      desc: 'Pattern: "released \'[GAME]\'"'
    },
    {
      regex: /i\s+(?:finally|just)\s+released\s+my\s+game\s*,?\s+([A-Z0-9][a-zA-Z0-9\s'-]{2,25})(?=[.,!?;:\s]|$)/i,
      desc: 'Pattern: "released my game [GAME]"'
    },
    // "'Tiny Frog' is out now!"
    {
      regex: /['"“]([^'"”\n]{2,30})['"”]\s+(?:is\s+out\s+now|just\s+released|just\s+launched|is\s+finally\s+here|is\s+playable\s+in\s+browser)/i,
      desc: 'Pattern: "\'[GAME]\' is out now/released"'
    },
    // "FROGBLOOD is out now on Steam/itch"
    {
      regex: /([A-Z0-9][a-zA-Z0-9\s'-]{2,25})\s+(?:is\s+out\s+now|just\s+released|just\s+launched)\s+(?:on|in)\s+(?:steam|itch|browser|web)/i,
      desc: 'Pattern: "[GAME] is out now on [Platform]"'
    },
    // "Play 'Tiny Frog' in browser"
    {
      regex: /(?:play|try)\s+['"“]([^'"”\n]{2,30})['"”]\s+(?:in\s+browser|on\s+itch|now|for\s+free)/i,
      desc: 'Pattern: "play \'[GAME]\' in browser"'
    },
    // "Meet 'Tiny Frog', a game about..."
    {
      regex: /meet\s+['"“]?([A-Z0-9][a-zA-Z0-9\s'-]{2,25})['"”]?,?\s+(?:a|an|my|our|the)\s+(?:game|roguelike|platformer|rpg|puzzle)/i,
      desc: 'Pattern: "meet [GAME], a game about..."'
    }
  ];

  for (const { regex, desc } of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      let candidate = cleanCanonicalTitle(match[1]);
      // Strip trailing prepositions/clauses if not inside quotes
      candidate = candidate.replace(/\s+\b(?:for|on|in|available|playable|with|by|to|and|is|out|now)\b.*$/i, '').trim();
      if (isValidExtractedName(candidate)) {
        return { name: candidate, evidence: `${desc} → matched "${candidate}"` };
      }
    }
  }

  return null;
}

/**
 * 3. Known Aliases / Entities Matching
 */
export function extractFromKnownAliases(
  text: string,
  knownEntities: { canonical_name: string; aliases: string[]; normalized_name: string }[]
): { name: string; evidence: string } | null {
  for (const entity of knownEntities) {
    // Check canonical name
    const escCanon = entity.canonical_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const canonRegex = new RegExp(`\\b${escCanon}\\b`, 'i');
    if (canonRegex.test(text)) {
      return {
        name: entity.canonical_name,
        evidence: `Matched known entity catalog: "${entity.canonical_name}"`
      };
    }

    // Check aliases
    for (const alias of entity.aliases) {
      const escAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const aliasRegex = new RegExp(`\\b${escAlias}\\b`, 'i');
      if (aliasRegex.test(text)) {
        return {
          name: entity.canonical_name,
          evidence: `Matched known alias: "${alias}" for "${entity.canonical_name}"`
        };
      }
    }
  }

  return null;
}

/**
 * 4. Hashtag / Title Heuristics
 */
export function extractFromHeuristics(
  text: string,
  hashtags: string[] = []
): { name: string; evidence: string } | null {
  // Check specific game hashtags that are CamelCase and not generic
  for (const tag of hashtags) {
    const cleanTag = tag.replace(/^#/, '');
    if (
      cleanTag.length >= 3 &&
      !['indiedev', 'gamedev', 'gamejam', 'screenshotsaturday', 'pixelart', 'unity', 'unreal', 'godot', 'gaming', 'indiegame', 'games', 'gamer'].includes(cleanTag.toLowerCase())
    ) {
      // If it looks like a game title hashtag, e.g. #TinyFishingHorror or #FrogBlood
      if (/[A-Z]/.test(cleanTag.slice(1)) || cleanTag.includes('_')) {
        const title = cleanTag
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2');
        if (isValidExtractedName(title) && !isGenericTitle(title)) {
          return {
            name: title,
            evidence: `Extracted from game-specific hashtag #${cleanTag}`
          };
        }
      }
    }
  }

  // Check quoted string in first 100 characters if there's only one quote
  const quotes = text.match(/['"“]([^'"”\n]{3,30})['"”]/g);
  if (quotes && quotes.length === 1) {
    const title = cleanCanonicalTitle(quotes[0]);
    if (isValidExtractedName(title) && !isGenericTitle(title)) {
      return {
        name: title,
        evidence: `Extracted from prominent isolated title quote: "${title}"`
      };
    }
  }

  return null;
}
