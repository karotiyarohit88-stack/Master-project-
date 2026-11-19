import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRuntimeSecretsMiddleware, getRuntimeSecret } from '../server/runtime-secrets-context.ts';

test('concurrent requests resolve and retain only their own Owner secrets', async () => {
  const app = express();
  app.use((req, res, next) => { res.locals.authSession = { id: req.header('x-owner-id') || '' }; res.locals.tenantContext = { tenantId: req.header('x-tenant-id') || '' }; next(); });
  app.use(createRuntimeSecretsMiddleware(async (ownerId, tenantId) => {
    await new Promise((resolve) => setTimeout(resolve, ownerId === 'owner-a' ? 25 : 5));
    return ownerId === 'owner-a' && tenantId === 'tenant-a'
      ? { openai: 'owner-a-openai-secret', gemini: 'owner-a-gemini-secret' }
      : ownerId === 'owner-b' && tenantId === 'tenant-b'
        ? { openai: 'owner-b-openai-secret', gemini: 'owner-b-gemini-secret' }
        : {};
  }));
  app.get('/credential', async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    res.json({ openai: getRuntimeSecret('openai'), gemini: getRuntimeSecret('gemini') });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const [a, b] = await Promise.all([
      fetch(base + '/credential', { headers: { 'x-owner-id': 'owner-a', 'x-tenant-id': 'tenant-a' } }),
      fetch(base + '/credential', { headers: { 'x-owner-id': 'owner-b', 'x-tenant-id': 'tenant-b' } })
    ]);
    assert.deepEqual(await a.json(), { openai: 'owner-a-openai-secret', gemini: 'owner-a-gemini-secret' });
    assert.deepEqual(await b.json(), { openai: 'owner-b-openai-secret', gemini: 'owner-b-gemini-secret' });
    assert.equal(getRuntimeSecret('openai'), '');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('anonymous requests do not resolve or inherit another Owner secret', async () => {
  let calls = 0;
  const app = express();
  app.use(createRuntimeSecretsMiddleware(async () => { calls++; return { openai: 'private' }; }));
  app.get('/credential', (_req, res) => res.json({ openai: getRuntimeSecret('openai') }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/credential`);
    assert.deepEqual(await response.json(), { openai: '' });
    assert.equal(calls, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
