import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  assertOwnerEmergencyHaltClear,
  getOwnerEmergencyHaltState,
  setOwnerEmergencyHaltState,
  createOwnerEmergencyHaltMiddleware,
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

test('emergency halt middleware blocks agent execution and fails closed, while read-only status remains reachable', async () => {
  async function call(halted: boolean, hasState: boolean, method: 'POST' | 'GET', route: string) {
    const pool: EmergencyHaltDbPool = {
      connect: async () => ({
        query: async (sql: string) => {
          if (sql.startsWith('SELECT owner_id')) {
            return { rows: hasState ? [{ owner_id: OWNER, halted, reason: halted ? 'incident' : '', updated_by: OWNER, updated_at: new Date().toISOString() }] : [] };
          }
          return { rows: [] };
        },
        release: () => undefined
      })
    };
    const app = express();
    app.use('/api', (req, res, next) => {
      res.locals.authSession = { id: OWNER };
      next();
    }, createOwnerEmergencyHaltMiddleware(pool));
    app.post('/api/chat', (_req, res) => res.sendStatus(204));
    app.get('/api/status', (_req, res) => res.sendStatus(204));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Emergency halt middleware test server did not bind.');
    try {
      return await fetch('http://127.0.0.1:' + address.port + route, { method });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
  assert.equal((await call(true, true, 'POST', '/api/chat')).status, 423);
  assert.equal((await call(false, true, 'POST', '/api/chat')).status, 204);
  assert.equal((await call(false, false, 'POST', '/api/chat')).status, 423);
  assert.equal((await call(true, true, 'GET', '/api/status')).status, 204);
});
