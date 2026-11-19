import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRuntimeSecretsMiddleware, getRuntimeSecret } from '../server/runtime-secrets-context.ts';

test('runtime provider credentials are isolated by authenticated Owner and never fall back to process environment', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'global-environment-key-must-not-be-used';
  const app = express();
  app.use((req, res, next) => {
    res.locals.authSession = { id: req.header('x-owner-id') || '' };
    next();
  });
  app.use(createRuntimeSecretsMiddleware(async (ownerId): Promise<Record<string, string>> => {
    if (ownerId === 'owner-a') return { openai: 'encrypted-owner-a-key' };
    if (ownerId === 'owner-b') return { openai: 'encrypted-owner-b-key' };
    return {};
  }));
  app.get('/key', (_req, res) => res.json({
    openai: getRuntimeSecret('openai'),
    gemini: getRuntimeSecret('gemini')
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Runtime-secret test server did not bind.');
  const base = 'http://127.0.0.1:' + address.port;
  try {
    const a = await fetch(base + '/key', { headers: { 'x-owner-id': 'owner-a' } });
    const b = await fetch(base + '/key', { headers: { 'x-owner-id': 'owner-b' } });
    const anonymous = await fetch(base + '/key');
    assert.deepEqual(await a.json(), { openai: 'encrypted-owner-a-key', gemini: '' });
    assert.deepEqual(await b.json(), { openai: 'encrypted-owner-b-key', gemini: '' });
    assert.deepEqual(await anonymous.json(), { openai: '', gemini: '' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
