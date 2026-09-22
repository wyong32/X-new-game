import http from 'http';
import https from 'https';
import dns from 'dns/promises';

export interface SafeUrlMetadata {
  title?: string;
  ogTitle?: string;
  ogSiteName?: string;
  extractedGameName?: string;
  evidence?: string;
}

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // Link-local / Cloud metadata service
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(r => r.test(ip));
}

export function isSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    if (isPrivateIp(hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchSafePageMetadata(rawUrl: string, maxRedirects = 3): Promise<SafeUrlMetadata | null> {
  if (!isSafeUrl(rawUrl)) {
    return null;
  }

  let currentUrl = rawUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const parsed = new URL(currentUrl);

    // SSRF Check DNS resolution
    try {
      const addresses = await dns.lookup(parsed.hostname, { all: true });
      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return null; // Block internal network probing
        }
      }
    } catch {
      return null;
    }

    // Perform bounded fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; XGameDiscoveryLab/1.0; +https://github.com/lab)',
          Accept: 'text/html,application/xhtml+xml;q=0.9'
        },
        redirect: 'manual'
      });

      clearTimeout(timeout);

      // Handle Redirects safely
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return null;
        const nextUrl = new URL(location, currentUrl).toString();
        if (!isSafeUrl(nextUrl)) return null;
        currentUrl = nextUrl;
        redirects++;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return null;
      }

      // Read max 512KB to avoid memory bombs
      const MAX_BYTES = 512 * 1024;
      const reader = response.body?.getReader();
      if (!reader) return null;

      let received = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.length;
          chunks.push(value);
          if (received >= MAX_BYTES) {
            reader.cancel();
            break;
          }
        }
      }

      const html = Buffer.concat(chunks).toString('utf-8');

      // Extract metadata from HTML
      const ogTitleMatch = html.match(/<meta\s+[^>]*property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s+property=["']og:title["']/i);
      const ogSiteNameMatch = html.match(/<meta\s+[^>]*property=["']og:site_name["']\s+content=["']([^"']+)["']/i) ||
                               html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s+property=["']og:site_name["']/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

      const ogTitle = ogTitleMatch ? decodeHtmlEntities(ogTitleMatch[1].trim()) : undefined;
      const ogSiteName = ogSiteNameMatch ? decodeHtmlEntities(ogSiteNameMatch[1].trim()) : undefined;
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

      const rawCandidate = ogTitle || title;
      if (!rawCandidate) {
        return { ogTitle, ogSiteName, title };
      }

      // Clean common suffixes e.g., "Game Title by Author - itch.io", "Game Title on Steam", "Play Game Title Free"
      let cleaned = rawCandidate
        .replace(/\s*[-–—|]\s*(?:itch\.io|Steam|Poki|CrazyGames|Newgrounds|GitHub|Play on.*|Play Free.*)$/i, '')
        .replace(/\s+by\s+[A-Za-z0-9_.-]+$/i, '')
        .trim();

      return {
        title,
        ogTitle,
        ogSiteName,
        extractedGameName: cleaned.length >= 2 && cleaned.length <= 50 ? cleaned : undefined,
        evidence: `Extracted from page metadata (og:title/title) at ${new URL(currentUrl).hostname}`
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
