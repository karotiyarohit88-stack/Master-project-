import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireOwnerForSecrets } from '../server/requireOwnerSecrets.ts';

test('security and secret middleware requires both account and active tenant role to be Owner', async () => {
  const app = express();
  app.use((req, res, next) => {
    res.locals.authSession = { role: req.header('x-account-role') || '' };
    res.locals.tenantContext = { role: req.header('x-tenant-role') || '' };
    next();
  });
  app.get('/owner-only', requireOwnerForSecrets, (_req, res) => res.sendStatus(204));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Owner-guard test server did not bind.');
  const base = 'http://127.0.0.1:' + address.port;
  const call = (account: string, tenant: string) => fetch(base + '/owner-only', {
    headers: { 'x-account-role': account, 'x-tenant-role': tenant }
  });
  try {
    assert.equal((await call('owner', 'owner')).status, 204);
    assert.equal((await call('owner', 'tenant_admin')).status, 403);
    assert.equal((await call('tenant_admin', 'owner')).status, 403);
    assert.equal((await call('president', 'owner')).status, 403);
    assert.equal((await call('owner', 'president')).status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
