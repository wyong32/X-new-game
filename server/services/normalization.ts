// Generic title dictionary according to Section 26
const GENERIC_TITLES = new Set([
  'run', 'escape', 'survival', 'battle', 'war', 'game', 'jump', 'race',
  'golf', 'football', 'puzzle', 'snake', 'runner', 'fight', 'block', 'craft',
  'tower', 'dungeon', 'card', 'roguelike', 'rpg', 'simulator', 'space',
  'hero', 'quest', 'arcade', 'clicker', 'idle', 'shooter', 'defense',
  'adventure', 'world', 'city', 'miner', 'racing', 'fishing', 'survivor'
]);

/**
 * Normalizes a game title for deduplication and clustering.
 * Removes symbols like ™, ®, ©, [demo], demo, alpha, beta, playtest,
 * lowercases and unifies punctuation/spaces.
 */
export function normalizeGameName(name: string): string {
  if (!name) return '';

  let normalized = name.trim();

  // Remove common trademarks & suffixes
  normalized = normalized.replace(/[™®©]/g, '');

  // Remove bracketed tags like [demo], [alpha], [v1.0]
  normalized = normalized.replace(/\[(?:demo|alpha|beta|playtest|v[\d.]+|prototype)\]/gi, '');
  normalized = normalized.replace(/\((?:demo|alpha|beta|playtest|v[\d.]+|prototype)\)/gi, '');

  // Remove standalone trailing words
  normalized = normalized.replace(/\b(?:demo|alpha|beta|playtest|prototype)\b/gi, '');

  // Normalize punctuation and symbols to spaces
  normalized = normalized.replace(/[-_.:/\\+]/g, ' ');

  // Collapse multiple whitespaces and trim
  normalized = normalized.toLowerCase().replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Checks if the title is too generic and cannot be trusted alone without strong evidence.
 */
export function isGenericTitle(name: string): boolean {
  const norm = normalizeGameName(name);
  if (!norm) return true;

  // Single word checks
  if (GENERIC_TITLES.has(norm)) {
    return true;
  }

  // Two generic words combined, e.g. "Space Game", "Card RPG"
  const words = norm.split(' ');
  if (words.length <= 2 && words.every(w => GENERIC_TITLES.has(w))) {
    return true;
  }

  // Extremely short strings (1 or 2 characters) unless Roman numerals
  if (norm.length <= 2 && !/^(?:iv|vi|ix|xi|xv)$/i.test(norm)) {
    return true;
  }

  return false;
}

/**
 * Cleans extracted title for display as canonical name
 */
export function cleanCanonicalTitle(name: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  // Strip outer quotes
  cleaned = cleaned.replace(/^['"“‘](.*)['"”’]$/, '$1').trim();
  // Strip trailing punctuation like exclamation mark or dots
  cleaned = cleaned.replace(/[.!,:;]+$/, '').trim();
  return cleaned;
}
