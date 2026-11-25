import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeGoogleSearchResults, searchGoogleCustom } from '../server/googleCustomSearch.ts';

test('Google results are normalized and unsafe URLs are discarded', () => {
  const results = sanitizeGoogleSearchResults({ items: [
    { title: '<b>Safe result</b>', snippet: 'Useful &amp; current', link: 'https://example.com/path#fragment' },
    { title: 'HTTP is not allowed', snippet: 'unsafe', link: 'http://example.com' },
    { title: 'Localhost is not allowed', snippet: 'unsafe', link: 'https://localhost/private' },
    { title: 'IP literal is not allowed', snippet: 'unsafe', link: 'https://127.0.0.1/private' }
  ] });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Safe result');
  assert.equal(results[0].snippet, 'Useful & current');
  assert.equal(results[0].url, 'https://example.com/path');
  assert.equal(results[0].domain, 'example.com');
});

test('Google Custom Search uses the server API endpoint and required parameters', async () => {
  let requested = '';
  const results = await searchGoogleCustom('latest AI news', 'test-secret', 'test-cx', async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ items: [{ title: 'AI News', snippet: 'A short summary', link: 'https://news.example.com/story' }] }), { status: 200 });
  });
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, 'https://www.googleapis.com/customsearch/v1');
  assert.equal(url.searchParams.get('q'), 'latest AI news');
  assert.equal(url.searchParams.get('key'), 'test-secret');
  assert.equal(url.searchParams.get('cx'), 'test-cx');
  assert.equal(results[0].title, 'AI News');
});

test('Google Custom Search rejects empty queries and missing credentials', async () => {
  await assert.rejects(() => searchGoogleCustom('', 'key', 'cx'), /non-empty search query/);
  await assert.rejects(() => searchGoogleCustom('hello', '', 'cx'), /not configured/);
});

test('Google search is wired to authenticated API and AI Chat', async () => {
  const { readFileSync } = await import('node:fs');
  const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(server, /app\.get\('\/api\/search'/);
  assert.match(server, /process\.env\.GOOGLE_SEARCH_API_KEY/);
  assert.match(server, /process\.env\.GOOGLE_SEARCH_CX/);
  assert.match(server, /searchGoogleCustom\(query, apiKey, cx\)/);
  assert.match(server, /Search-aware AI Chat/);
  assert.match(server, /searchGoogleCustom\(prompt, googleKey, googleCx\)/);
});
