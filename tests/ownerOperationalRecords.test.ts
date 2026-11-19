import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  countOwnerOperationalRecords,
  deleteOwnerOperationalRecord,
  getOwnerOperationalRecord,
  listOwnerOperationalRecords,
  upsertOwnerOperationalRecord,
  type OwnerOperationalDbPool
} from '../server/ownerOperationalRecords.ts';

function fakePool() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: OwnerOperationalDbPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        calls.push({ sql: sql.replace(/\\s+/g, ' ').trim(), values });
        if (sql.includes('RETURNING payload')) return { rows: [{ payload: { id: 'record-a', status: 'queued' } }] };
        if (sql.includes('RETURNING record_id')) return { rows: [{ record_id: 'record-a' }] };
        if (sql.includes('SELECT payload')) return { rows: [{ payload: { id: 'record-a', status: 'queued' } }] };
        if (sql.includes('SELECT record_id, payload')) return { rows: [{ record_id: 'record-a', payload: { id: 'record-a', status: 'queued' } }] };
        if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] };
        return { rows: [] };
      },
      release: () => undefined
    })
  };
  return { pool, calls };
}

test('Owner operational record reads and writes always carry Owner and tenant predicates', async () => {
  const { pool, calls } = fakePool();
  const ownerId = 'owner-a';
  const tenantId = 'tenant-a';
  const saved = await upsertOwnerOperationalRecord(ownerId, tenantId, 'video_job', { id: 'record-a', status: 'queued' }, pool);
  assert.deepEqual(saved, { id: 'record-a', status: 'queued' });

  const list = await listOwnerOperationalRecords(ownerId, tenantId, 'video_job', pool);
  assert.equal(list.length, 1);
  const found = await getOwnerOperationalRecord(ownerId, tenantId, 'video_job', 'record-a', pool);
  assert.deepEqual(found, { id: 'record-a', status: 'queued' });
  assert.equal(await countOwnerOperationalRecords(ownerId, tenantId, 'video_job', pool), 1);
  assert.equal(await deleteOwnerOperationalRecord(ownerId, tenantId, 'video_job', 'record-a', pool), true);

  const insert = calls.find(call => call.sql.startsWith('INSERT INTO owner_operational_records'));
  assert.ok(insert);
  assert.deepEqual(insert.values.slice(0, 2), [ownerId, tenantId]);
  assert.match(insert.sql, /WHERE owner_operational_records\.owner_id = \$1/);
  for (const call of calls.filter(call => /^(SELECT|DELETE)/i.test(call.sql))) {
    assert.match(call.sql, /WHERE owner_id = \$1 AND tenant_id = \$2/);
    assert.deepEqual(call.values.slice(0, 2), [ownerId, tenantId]);
  }
  const update = calls.find(call => call.sql.includes('DO UPDATE SET'));
  assert.ok(update);
  assert.match(update.sql, /WHERE owner_operational_records\.owner_id = \$1/);
});

test('operational records migration enforces Owner/tenant composite key and RLS', () => {
  const sql = readFileSync(new URL('../migrations/20261119_002_owner_operational_records.sql', import.meta.url), 'utf8');
  assert.match(sql, /owner_id UUID NOT NULL REFERENCES app_users\(id\)/);
  assert.match(sql, /FOREIGN KEY \(tenant_id, owner_id\)/);
  assert.match(sql, /UNIQUE \(owner_id, tenant_id, record_type, record_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
});
