/**
 * Centralized X Query Builder for Live Experimentation
 * Appends standard discovery search filters (lang:en -is:retweet)
 * without duplicating them in seed query definitions.
 */

export interface LiveQueryOptions {
  lang?: string | false;
  excludeRetweets?: boolean;
}

export function buildLiveQuery(
  baseQuery: string,
  options: LiveQueryOptions = {}
): string {
  let cleaned = baseQuery.trim().replace(/\s+/g, ' ');

  const lang = options.lang !== undefined ? options.lang : 'en';
  const excludeRetweets = options.excludeRetweets !== undefined ? options.excludeRetweets : true;

  if (lang && !cleaned.includes('lang:')) {
    cleaned = `${cleaned} lang:${lang}`;
  }

  if (excludeRetweets && !cleaned.includes('-is:retweet')) {
    cleaned = `${cleaned} -is:retweet`;
  }

  return cleaned.trim();
}
