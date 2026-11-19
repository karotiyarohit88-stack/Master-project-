import test from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders, buildContentSecurityPolicy } from '../server/config/security.middleware.js';

function responseMock() {
  const headers = new Map<string, string>();
  return {
    headers,
    removeHeader(name: string) { headers.delete(name.toLowerCase()); },
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), String(value)); }
  };
}

test('CSP is sent in report-only mode by default and blocks eval in policy text', () => {
  const previous = process.env.CSP_ENFORCE;
  delete process.env.CSP_ENFORCE;
  const res = responseMock();
  let nextCalled = false;
  securityHeaders({} as any, res as any, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  const policy = res.headers.get('content-security-policy-report-only') || '';
  assert.ok(policy.length > 0);
  assert.equal(res.headers.has('content-security-policy'), false);
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  if (previous === undefined) delete process.env.CSP_ENFORCE;
  else process.env.CSP_ENFORCE = previous;
});

test('CSP can be switched to enforcement only by explicit server configuration', () => {
  const previous = process.env.CSP_ENFORCE;
  process.env.CSP_ENFORCE = 'true';
  const res = responseMock();
  securityHeaders({} as any, res as any, () => undefined);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.has('content-security-policy-report-only'), false);
  if (previous === undefined) delete process.env.CSP_ENFORCE;
  else process.env.CSP_ENFORCE = previous;
});

test('CSP policy includes only required resource classes and denies plugins', () => {
  const policy = buildContentSecurityPolicy();
  assert.match(policy, /connect-src 'self'/);
  assert.match(policy, /img-src 'self' data: blob:/);
  assert.match(policy, /media-src 'self' data: blob:/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'self'/);
});
