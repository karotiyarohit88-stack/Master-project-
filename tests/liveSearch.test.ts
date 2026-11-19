import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBraveSearchResults, searchBraveWeb } from '../server/liveSearch.ts';

test('Brave results are sanitized, bounded and restricted to safe HTTPS source links', () => {
  const results = sanitizeBraveSearchResults({
    web: { results: [
      { title: '<b>Safe title</b>', description: '<script>steal()</script>Useful &amp; safe', url: 'https://example.com/article#tracking' },
      { title: 'Local target', description: 'blocked', url: 'https://127.0.0.1/admin' },
      { title: 'HTTP target', description: 'blocked', url: 'http://example.com' },
      { title: 'Credential target', description: 'blocked', url: 'https://user:pass@example.com' },
      { title: 'Another safe result', description: 'safe', url: 'https://news.example.org/story' }
    ] }
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].title, 'Safe title');
  assert.equal(results[0].description, 'Useful & safe');
  assert.equal(results[0].url, 'https://example.com/article');
  assert.equal(results[0].domain, 'example.com');
});

test('Live Search checks durable emergency halt immediately before fetch and sends tenant key only in header', async () => {
  let haltChecks = 0;
  let fetched = false;
  const results = await searchBraveWeb('latest AI research', 'tenant-encrypted-search-key', async () => {
    haltChecks += 1;
  }, async (input, init) => {
    fetched = true;
    assert.match(String(input), /^https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search/);
    assert.equal((init?.headers as Record<string, string>)['X-Subscription-Token'], 'tenant-encrypted-search-key');
    assert.equal(String(input).includes('tenant-encrypted-search-key'), false);
    return new Response(JSON.stringify({ web: { results: [{ title: 'Result', description: 'Snippet', url: 'https://example.com' }] } }), { status: 200 });
  });
  assert.equal(haltChecks, 1);
  assert.equal(fetched, true);
  assert.equal(results.length, 1);
});

test('Live Search fails closed and does not fetch when emergency halt check fails', async () => {
  let fetched = false;
  await assert.rejects(() => searchBraveWeb('query', 'tenant-key', async () => {
    throw new Error('halt active');
  }, async () => {
    fetched = true;
    return new Response('{}', { status: 200 });
  }), /halt active/);
  assert.equal(fetched, false);
});
