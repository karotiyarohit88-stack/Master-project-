import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertOwnerEmergencyHaltClear,
  getOwnerEmergencyHaltState,
  setOwnerEmergencyHaltState,
  type EmergencyHaltDbPool
} from '../server/emergencyHalt.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function fakePool(halted = false, rows = true) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: EmergencyHaltDbPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
        if (sql.includes('RETURNING owner_id')) return { rows: [{ owner_id: OWNER, halted, reason: halted ? 'incident response' : '', updated_by: OWNER, updated_at: new Date().toISOString() }] };
        if (sql.startsWith('SELECT owner_id')) return { rows: rows ? [{ owner_id: OWNER, halted, reason: halted ? 'incident response' : '', updated_by: OWNER, updated_at: new Date().toISOString() }] : [] };
        return { rows: [] };
      },
      release: () => undefined
    })
  };
  return { pool, calls };
}

test('emergency halt state is read with Owner-scoped transaction and explicit predicate', async () => {
  const { pool, calls } = fakePool(false);
  const state = await getOwnerEmergencyHaltState(OWNER, pool);
  assert.equal(state.halted, false);
  assert.ok(calls.some(call => call.sql.includes("set_config('app.owner_id'")));
  const read = calls.find(call => call.sql.startsWith('SELECT owner_id'));
  assert.ok(read);
  assert.match(read.sql, /WHERE owner_id = \$1/);
  assert.deepEqual(read.values, [OWNER]);
});

test('emergency halt activation persists durable state and rejects another actor', async () => {
  const { pool, calls } = fakePool(true);
  const state = await setOwnerEmergencyHaltState(OWNER, OWNER, true, 'incident response', pool);
  assert.equal(state.halted, true);
  assert.ok(calls.some(call => call.sql.startsWith('INSERT INTO owner_emergency_halt')));
  await assert.rejects(() => setOwnerEmergencyHaltState(OWNER, OTHER, false, '', pool), /matching Owner/);
  await assert.rejects(() => setOwnerEmergencyHaltState(OWNER, OWNER, true, '', pool), /reason is required/);
});

test('AI execution fails closed when halt is active or durable state is missing', async () => {
  const active = fakePool(true);
  await assert.rejects(() => assertOwnerEmergencyHaltClear(OWNER, active.pool), /Emergency halt is active/);
  const missing = fakePool(false, false);
  await assert.rejects(() => assertOwnerEmergencyHaltClear(OWNER, missing.pool), /state is missing/);
});
