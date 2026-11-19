import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import {
  createOwnerAuditMiddleware,
  listOwnerAuditLogs,
  queueOwnerAuditLog,
  type OwnerAuditDbPool
} from '../server/ownerAudit.ts';

function createFakePool() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: OwnerAuditDbPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        calls.push({ sql: sql.replace(/\\s+/g, ' ').trim(), values });
        if (sql.includes('FROM owner_audit_logs')) {
          return { rows: [{ id: 'log-1', category: 'security', action: 'test', status: 'info' }] };
        }
        return { rows: [] };
      },
      release: () => undefined
    })
  };
  return { pool, calls };
}

test('audit events are committed before the API response and include authenticated Owner/tenant IDs', async () => {
  const { pool, calls } = createFakePool();
  const app = express();
  app.use((_req, res, next) => {
    res.locals.authSession = { id: 'member-user-id' };
    res.locals.tenantContext = { ownerId: 'tenant-owner-id', tenantId: 'tenant-id', role: 'member' };
    next();
  });
  app.use(createOwnerAuditMiddleware({ pool }));
  app.post('/event', (_req, res) => {
    queueOwnerAuditLog({
      category: 'security',
      action: 'Owner-scoped audit test',
      status: 'success',
      details: 'Persisted before response.'
    });
    res.json({ success: true });
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/event`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    const insert = calls.find(call => call.sql.startsWith('INSERT INTO owner_audit_logs'));
    assert.ok(insert);
    assert.deepEqual(insert.values.slice(0, 2), ['tenant-owner-id', 'tenant-id']);
    assert.ok(calls.some(call => call.sql === 'COMMIT'));
    assert.ok(calls.some(call => call.sql.includes("set_config('app.owner_id'")));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('audit history SELECT is constrained by owner_id and tenant_id', async () => {
  const { pool, calls } = createFakePool();
  const rows = await listOwnerAuditLogs('owner-a', 'tenant-a', 20, pool);
  assert.equal(rows.length, 1);
  const query = calls.find(call => call.sql.startsWith('SELECT id, occurred_at'));
  assert.ok(query);
  assert.match(query.sql, /WHERE owner_id = \$1 AND tenant_id = \$2/);
  assert.deepEqual(query.values, ['owner-a', 'tenant-a', 20]);
});

test('audit migration enforces Owner/tenant foreign key and row-level security', () => {
  const sql = readFileSync(new URL('../migrations/20261119_001_owner_audit_logs.sql', import.meta.url), 'utf8');
  assert.match(sql, /owner_id UUID NOT NULL REFERENCES app_users\(id\)/);
  assert.match(sql, /FOREIGN KEY \(tenant_id, owner_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /owner_id = NULLIF\(current_setting\('app\.owner_id'/);
});
