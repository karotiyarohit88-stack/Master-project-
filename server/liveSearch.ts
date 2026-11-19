import { isIP } from 'node:net';
import { sanitizeUntrustedText } from './security/zeroTrust.ts';

export type LiveSearchResult = {
  title: string;
  description: string;
  url: string;
  domain: string;
};

function cleanMarkup(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const withoutMarkup = value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  return sanitizeUntrustedText(withoutMarkup, maxLength).replace(/\s+/g, ' ').trim();
}

function safeResultUrl(value: unknown): { url: string; domain: string } | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port && parsed.port !== '443') return null;
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isIP(host)) return null;
    parsed.hash = '';
    return { url: parsed.toString(), domain: host };
  } catch {
    return null;
  }
}

export function sanitizeBraveSearchResults(payload: unknown): LiveSearchResult[] {
  if (!payload || typeof payload !== 'object') return [];
  const web = (payload as { web?: { results?: unknown } }).web;
  if (!web || !Array.isArray(web.results)) return [];
  return web.results.slice(0, 5).flatMap((item: any) => {
    if (!item || typeof item !== 'object') return [];
    const safeUrl = safeResultUrl(item.url);
    const title = cleanMarkup(item.title, 240);
    const description = cleanMarkup(item.description || item.extra_snippets?.[0], 700);
    if (!safeUrl || !title) return [];
    return [{ title, description, url: safeUrl.url, domain: safeUrl.domain }];
  });
}

export async function searchBraveWeb(
  query: string,
  apiKey: string,
  checkEmergencyHalt: () => Promise<void>,
  fetchImpl: typeof fetch = fetch
): Promise<LiveSearchResult[]> {
  const cleanQuery = sanitizeUntrustedText(query, 200).trim();
  if (!cleanQuery) throw new Error('A non-empty Live Search query is required.');
  if (!apiKey) throw new Error('Tenant Live Search API key is not configured.');
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', cleanQuery);
  url.searchParams.set('count', '5');
  // Durable halt check occurs immediately before the external Search API call.
  await checkEmergencyHalt();
  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error('Live Search provider returned HTTP ' + response.status + '.');
  const payload = await response.json();
  return sanitizeBraveSearchResults(payload);
}
