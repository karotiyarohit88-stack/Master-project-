import { isIP } from 'node:net';
import { sanitizeUntrustedText } from './security/zeroTrust.ts';

export type GoogleSearchResult = {
  title: string;
  snippet: string;
  url: string;
  domain: string;
};

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return sanitizeUntrustedText(value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'), maxLength)
    .replace(/\s+/g, ' ').trim();
}

function safeLink(value: unknown): { url: string; domain: string } | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) return null;
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isIP(host)) return null;
    parsed.hash = '';
    return { url: parsed.toString(), domain: host };
  } catch { return null; }
}

export function sanitizeGoogleSearchResults(payload: unknown): GoogleSearchResult[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.slice(0, 10).flatMap((item: any) => {
    if (!item || typeof item !== 'object') return [];
    const link = safeLink(item.link);
    const title = cleanText(item.title, 240);
    const snippet = cleanText(item.snippet, 700);
    if (!link || !title) return [];
    return [{ title, snippet, url: link.url, domain: link.domain }];
  });
}

export async function searchGoogleCustom(
  query: string,
  apiKey: string,
  cx: string,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleSearchResult[]> {
  const cleanQuery = sanitizeUntrustedText(query, 200).trim();
  if (!cleanQuery) throw new Error('A non-empty search query is required.');
  if (!apiKey || !cx) throw new Error('Google Custom Search is not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX on the server.');
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q', cleanQuery);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('num', '10');
  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error('Google Custom Search returned HTTP ' + response.status + '.');
  return sanitizeGoogleSearchResults(await response.json());
}
