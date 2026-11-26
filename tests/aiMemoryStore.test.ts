import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecentConversationMemory, saveConversationTurn, type MemoryClient, type MemoryPool } from '../server/aiMemoryStore.ts';

function makePool(rows: any[] = []) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client: MemoryClient = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('INSERT INTO ai_conversation_memory')) {
        return { rows: [{ id: 'turn-1', role: values?.[3], content: values?.[4], context: JSON.parse(String(values?.[5])), created_at: new Date('2026-11-26T00:00:00Z') }] };
      }
      if (sql.includes('SELECT id, role, content, context, created_at FROM ai_conversation_memory')) return { rows };
      return { rows: [] };
    },
    release: () => { calls.push({ sql: 'RELEASE' }); }
  };
  return { pool: { connect: async () => client } as MemoryPool, calls };
}

test('conversation memory is persisted with transaction-scoped Owner and Tenant RLS context', async () => {
  const { pool, calls } = makePool();
  const turn = await saveConversationTurn('owner-1', 'tenant-1', 'user', 'How do I use this page?', { page: 'Dashboard', language: 'Hindi' }, pool);
  assert.equal(turn.role, 'user');
  assert.equal(turn.content, 'How do I use this page?');
  assert.ok(calls.some(call => call.sql.includes("set_config('app.owner_id'")));
  const insert = calls.find(call => call.sql.includes('INSERT INTO ai_conversation_memory'));
  assert.deepEqual(insert?.values?.slice(1, 4), ['owner-1', 'tenant-1', 'user']);
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
  assert.ok(calls.some(call => call.sql === 'RELEASE'));
});

test('memory redacts credential-like text and stores bounded structured context only', async () => {
  const { pool, calls } = makePool();
  const turn = await saveConversationTurn('owner-1', 'tenant-1', 'user', 'My password=hunter2 and API_KEY=AIza123456789012345678901234567890', {
    page: 'Dashboard', language: 'Hinglish', questionType: 'page_guide', token: 'should-not-be-stored'
  }, pool);
  assert.match(turn.content, /password=\[REDACTED\]/);
  assert.match(turn.content, /API_KEY=\[REDACTED\]/);
  const insert = calls.find(call => call.sql.includes('INSERT INTO ai_conversation_memory'));
  const context = JSON.parse(String(insert?.values?.[5]));
  assert.deepEqual(context, { page: 'Dashboard', language: 'Hinglish', questionType: 'page_guide' });
});

test('memory reads are tenant filtered, ordered oldest-to-newest, and bounded', async () => {
  const rows = [
    { id: 'new', role: 'assistant', content: 'New answer', context: {}, created_at: new Date('2026-11-26T02:00:00Z') },
    { id: 'old', role: 'user', content: 'Old question', context: {}, created_at: new Date('2026-11-26T01:00:00Z') }
  ];
  const { pool, calls } = makePool(rows);
  const turns = await getRecentConversationMemory('owner-1', 'tenant-1', 99, pool);
  assert.deepEqual(turns.map(turn => turn.id), ['old', 'new']);
  assert.equal(calls.find(call => call.sql.includes('ORDER BY created_at DESC'))?.values?.[2], 30);
});
