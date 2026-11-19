import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countOwnerPublishingDrafts,
  createPublishingDraftForOwner,
  listOwnerPublishingDrafts
} from '../server/publishingDrafts.ts';

function fakePool() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  let nextId = 0;
  const pool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        calls.push({ sql: sql.replace(/\\s+/g, ' ').trim(), values });
        if (sql.includes('INSERT INTO agent_tasks')) {
          nextId += 1;
          return { rows: [{ id: 'task-' + nextId, status: 'waiting_approval' }] };
        }
        if (sql.includes('SELECT id, owner_id, original_prompt')) {
          return { rows: [{
            id: 'task-1', owner_id: 'owner-a', original_prompt: 'Draft A',
            payload: { topic: 'Draft A', platform: 'youtube', caption: 'Caption A', hashtags: ['#AI'] },
            status: 'waiting_approval', created_at: '2026-11-19T00:00:00.000Z'
          }] };
        }
        if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] };
        return { rows: [] };
      },
      release: () => undefined
    })
  };
  return { pool, calls };
}

test('publishing drafts are inserted into the tenant approval queue with Owner identity', async () => {
  const { pool, calls } = fakePool();
  const created = await createPublishingDraftForOwner('owner-a', 'tenant-a', {
    topic: 'Draft A', platform: 'youtube', caption: 'Caption A', hashtags: ['#AI']
  });
  assert.deepEqual(created, { id: 'task-1', status: 'waiting_approval' });
  const insert = calls.find(call => call.sql.startsWith('INSERT INTO agent_tasks'));
  assert.ok(insert);
  assert.deepEqual(insert.values.slice(0, 2), ['tenant-a', 'owner-a']);
  assert.match(insert.sql, /\(tenant_id, owner_id,/);
  assert.equal(calls.some(call => call.sql.startsWith('INSERT INTO agent_task_events')), true);
  assert.equal(calls.some(call => call.sql === 'COMMIT'), true);
});

test('publishing draft reads and counts are Owner+tenant scoped', async () => {
  const { pool, calls } = fakePool();
  const rows = await listOwnerPublishingDrafts('owner-a', 'tenant-a');
  const count = await countOwnerPublishingDrafts('owner-a', 'tenant-a');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].topic, 'Draft A');
  assert.equal(count, 1);
  const selects = calls.filter(call => call.sql.startsWith('SELECT'));
  assert.equal(selects.length, 2);
  for (const query of selects) {
    assert.match(query.sql, /WHERE owner_id = \$1 AND tenant_id = \$2/);
    assert.deepEqual(query.values.slice(0, 2), ['owner-a', 'tenant-a']);
  }
});
