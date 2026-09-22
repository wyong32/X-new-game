import { MOCK_POSTS_FIXTURES, type RawMockPost } from '../fixtures/mockPosts.js';

export interface XSearchResultItem {
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    reply_count: number;
    retweet_count: number;
    quote_count: number;
  };
  entities?: {
    urls?: Array<{ expanded_url?: string; url: string }>;
    hashtags?: Array<{ tag: string }>;
  };
  attachments?: {
    media_keys?: string[];
  };
  has_media?: boolean;
  media_types?: string[];
}

export interface XSearchResult {
  data: XSearchResultItem[];
  meta: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
}

export interface XSearchClient {
  searchRecent(params: {
    query: string;
    sinceId?: string;
    maxResults?: number;
  }): Promise<XSearchResult>;
}

export class MockXClient implements XSearchClient {
  async searchRecent(params: {
    query: string;
    sinceId?: string;
    maxResults?: number;
  }): Promise<XSearchResult> {
    const rawQuery = params.query.toLowerCase().replace(/['"]/g, '');
    const keywords = rawQuery.split(/\s+/).filter(w => w.length > 2 && !w.startsWith('-') && !w.startsWith('lang:'));

    // Filter matching fixtures
    const matched = MOCK_POSTS_FIXTURES.filter(f => {
      // 1. Direct query matching mapping
      if (f.matching_query_texts.some(q => q.toLowerCase().includes(rawQuery) || rawQuery.includes(q.toLowerCase().replace(/['"]/g, '')))) {
        return true;
      }
      // 2. Keyword fallback in post text
      const postLower = f.text.toLowerCase();
      const hasKeywords = keywords.some(k => postLower.includes(k));
      return hasKeywords;
    });

    const results: XSearchResultItem[] = matched.slice(0, params.maxResults || 20).map(m => ({
      id: m.x_post_id,
      text: m.text,
      author_id: m.author_id,
      author_username: m.author_username,
      created_at: m.created_at,
      public_metrics: {
        like_count: m.like_count,
        reply_count: m.reply_count,
        retweet_count: m.repost_count,
        quote_count: m.quote_count
      },
      entities: {
        urls: m.urls.map(u => ({ expanded_url: u, url: u })),
        hashtags: m.hashtags.map(h => ({ tag: h.replace(/^#/, '') }))
      },
      has_media: m.has_media,
      media_types: m.media_types
    }));

    return {
      data: results,
      meta: {
        result_count: results.length,
        newest_id: results.length > 0 ? results[0].id : undefined
      }
    };
  }
}

export class LiveXClient implements XSearchClient {
  private bearerToken: string;

  constructor(token?: string) {
    this.bearerToken = token || process.env.X_BEARER_TOKEN || '';
  }

  async searchRecent(params: {
    query: string;
    sinceId?: string;
    maxResults?: number;
  }): Promise<XSearchResult> {
    if (!this.bearerToken) {
      throw new Error('X_BEARER_TOKEN is not configured. Please switch to MOCK mode or provide X API token in settings.');
    }

    const url = new URL('https://api.twitter.com/2/tweets/search/recent');
    url.searchParams.set('query', params.query);
    url.searchParams.set('max_results', String(Math.min(100, Math.max(10, params.maxResults || 20))));
    url.searchParams.set('tweet.fields', 'created_at,public_metrics,entities,attachments,lang');
    url.searchParams.set('expansions', 'author_id,attachments.media_keys');
    url.searchParams.set('user.fields', 'username,name');
    url.searchParams.set('media.fields', 'type');

    if (params.sinceId) {
      url.searchParams.set('since_id', params.sinceId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'User-Agent': 'XGameDiscoveryLab/0.1'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`X API HTTP ${response.status}: ${errText}`);
    }

    const json = await response.json();
    const usersMap = new Map<string, string>();
    if (json.includes?.users) {
      for (const u of json.includes.users) {
        usersMap.set(u.id, u.username);
      }
    }

    const mediaMap = new Map<string, string>();
    if (json.includes?.media) {
      for (const m of json.includes.media) {
        mediaMap.set(m.media_key, m.type);
      }
    }

    const items: XSearchResultItem[] = (json.data || []).map((t: any) => {
      const mediaTypes: string[] = [];
      if (t.attachments?.media_keys) {
        for (const k of t.attachments.media_keys) {
          const type = mediaMap.get(k);
          if (type) mediaTypes.push(type);
        }
      }

      return {
        id: t.id,
        text: t.text,
        author_id: t.author_id,
        author_username: usersMap.get(t.author_id) || `user_${t.author_id}`,
        created_at: t.created_at,
        public_metrics: t.public_metrics || {
          like_count: 0,
          reply_count: 0,
          retweet_count: 0,
          quote_count: 0
        },
        entities: {
          urls: t.entities?.urls?.map((u: any) => ({
            expanded_url: u.expanded_url || u.url,
            url: u.url
          })),
          hashtags: t.entities?.hashtags?.map((h: any) => ({ tag: h.tag }))
        },
        has_media: mediaTypes.length > 0 || Boolean(t.attachments?.media_keys?.length),
        media_types: mediaTypes
      };
    });

    return {
      data: items,
      meta: {
        result_count: items.length,
        newest_id: json.meta?.newest_id,
        oldest_id: json.meta?.oldest_id,
        next_token: json.meta?.next_token
      }
    };
  }
}

export function getXClient(mode: 'mock' | 'live', token?: string): XSearchClient {
  if (mode === 'live') {
    return new LiveXClient(token);
  }
  return new MockXClient();
}
