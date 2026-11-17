import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import createSecurityMiddleware, { createRateLimitMiddleware } from '../server/config/security.middleware.js';

test('security middleware emits baseline headers', async () => {
  const app = express(); app.use(createSecurityMiddleware());
  app.get('/private', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/private`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('x-powered-by'), null);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('API rate limiter returns 429 after configured request limit', async () => {
  const app = express(); app.use(createRateLimitMiddleware({ windowMs: 60_000, maxRequests: 1 }));
  app.get('/private', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/private`;
  try { assert.equal((await fetch(url)).status, 200); assert.equal((await fetch(url)).status, 429); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
