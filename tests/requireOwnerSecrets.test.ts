import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireOwnerForSecrets } from '../server/requireOwnerSecrets.ts';

test('only an authenticated Owner with Owner tenant membership can access secrets', async () => {
  const app = express();
  app.use((req, res, next) => {
    res.locals.authSession = { role: req.header('x-account-role') || '' };
    res.locals.tenantContext = { role: req.header('x-tenant-role') || '' };
    next();
  });
  app.get('/api/secrets', requireOwnerForSecrets, (_req, res) => res.json({ secrets: ['masked-preview-only'] }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/secrets`;

  try {
    const owner = await fetch(url, { headers: { 'x-account-role': 'owner', 'x-tenant-role': 'owner' } });
    assert.equal(owner.status, 200);
    assert.deepEqual(await owner.json(), { secrets: ['masked-preview-only'] });

    for (const [accountRole, tenantRole] of [
      ['admin', 'admin'],
      ['admin', 'owner'],
      ['owner', 'admin'],
      ['member', 'member'],
      ['president', 'president'],
      ['president', 'owner'],
      ['owner', 'president']
    ]) {
      const denied = await fetch(url, { headers: { 'x-account-role': accountRole, 'x-tenant-role': tenantRole } });
      assert.equal(denied.status, 403, `${accountRole}/${tenantRole} must be denied`);
      assert.deepEqual(await denied.json(), { error: 'Owner access is required to manage secrets.' });
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
