import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('detailed health, database, connection, and GitHub status endpoints are Owner-only', () => {
  for (const route of [
    "app.get('/api/health', requireOwnerForSecrets",
    "app.get('/api/database/status', requireOwnerForSecrets",
    "app.get('/api/connections', requireOwnerForSecrets",
    "app.get('/api/github/status', requireOwnerForSecrets"
  ]) {
    assert.ok(serverSource.includes(route), `missing Owner guard: ${route}`);
  }
  assert.match(serverSource, /return requireOwnerForSecrets\(req, res, next\);/);
});

test('the unauthenticated health endpoint exposes only minimal liveness status', () => {
  assert.match(serverSource, /app\.get\('\/healthz', \(_req, res\) => res\.status\(200\)\.json\(\{ status: 'ok' \}\)\);/);
  assert.doesNotMatch(serverSource, /const publicHealth = req\.path === '\/health'/);
});

test('health and security routes are not bypassed by tenant membership or audit middleware', () => {
  const authBoundary = serverSource.slice(
    serverSource.indexOf('// Every application API'),
    serverSource.indexOf('// Enforce session-bound CSRF')
  );
  const tenantBoundary = serverSource.slice(
    serverSource.indexOf('// Every authenticated API'),
    serverSource.indexOf('// Owner role is required')
  );
  assert.doesNotMatch(authBoundary, /publicHealth/);
  assert.doesNotMatch(tenantBoundary, /publicHealth/);
  assert.match(serverSource, /app\.use\('\/api', createOwnerAuditMiddleware\(\)\);/);
});
