import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createSchedulesRouter, dispatchDueSchedules, runScheduleWorker } from '../server/schedules.ts';

const dueSchedule = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  owner_id: '33333333-3333-4333-8333-333333333333',
  title: 'Daily status',
  task_type: 'read_only',
  payload: { action: 'read_project_status' },
  original_prompt: 'Read project status',
  recurrence_type: 'daily',
  timezone: 'Asia/Kolkata',
  daily_time: '09:00',
  interval_minutes: null,
  next_run_at: new Date('2026-11-25T03:30:00.000Z')
};

function fakePool(dueRows: any[] = []) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql.includes('FROM agent_schedules') && sql.includes('FOR UPDATE SKIP LOCKED')) return { rows: dueRows };
      if (sql.includes('INSERT INTO agent_tasks')) return { rows: [{ id: '44444444-4444-4444-8444-444444444444' }] };
      if (sql.includes('INSERT INTO agent_schedules')) return { rows: [{ id: dueSchedule.id, title: values?.[2], recurrence_type: values?.[4], next_run_at: new Date() }] };
      if (sql.includes('SELECT id,title,task_type')) return { rows: [dueSchedule] };
      return { rows: [] };
    },
    release() {}
  };
  return { calls, pool: { connect: async () => client } };
}

async function withApi(role: string, pool: any, run: (url: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authSession = { id: dueSchedule.owner_id };
    res.locals.tenantContext = { tenantId: dueSchedule.tenant_id, role };
    next();
  });
  app.use('/api/schedules', createSchedulesRouter({ pool }));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  try { await run('http://127.0.0.1:' + address.port); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('scheduler dispatches due schedule as an automatically approved fixed read-only task', async () => {
  const { calls, pool } = fakePool([dueSchedule]);
  const count = await dispatchDueSchedules({ pool: pool as any });
  assert.equal(count, 1);
  const insert = calls.find(call => call.sql.includes('INSERT INTO agent_tasks'));
  assert.ok(insert);
  assert.ok(insert!.sql.includes("CASE WHEN $4='research' THEN 'waiting_approval' ELSE 'queued' END"));
  assert.equal(insert!.values?.[3], 'read_only');
  assert.deepEqual(JSON.parse(String(insert!.values?.[5])), { action: 'read_project_status' });
  assert.deepEqual(insert!.values?.slice(0, 2), [dueSchedule.tenant_id, dueSchedule.owner_id]);
  assert.ok(calls.some(call => call.sql.includes("set_config('app.worker_mode','true',true)")));
  assert.ok(calls.some(call => call.sql.includes('UPDATE agent_schedules SET last_run_at')));
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
});

test('scheduled research waits for a separate approval before provider calls', async () => {
  const researchSchedule = { ...dueSchedule, task_type: 'research', payload: { action: 'research' } };
  const { calls, pool } = fakePool([researchSchedule]);
  assert.equal(await dispatchDueSchedules({ pool: pool as any }), 1);
  const insert = calls.find(call => call.sql.includes('INSERT INTO agent_tasks'));
  assert.ok(insert);
  assert.equal(insert!.values?.[3], 'research');
  assert.deepEqual(JSON.parse(String(insert!.values?.[5])), { action: 'research' });
  assert.match(insert!.sql, /\\(\\$4='research'\\)/);
});

test('scheduler does not create work when there are no due schedules', async () => {
  const { calls, pool } = fakePool([]);
  assert.equal(await dispatchDueSchedules({ pool: pool as any }), 0);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO agent_tasks')), false);
});

test('schedule API validates recurrence and timezone before persistence', async () => {
  const { calls, pool } = fakePool();
  await withApi('owner', pool, async url => {
    const invalid = await fetch(url + '/api/schedules', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'bad', prompt: 'bad', recurrenceType: 'interval', intervalMinutes: 5, timezone: 'Asia/Kolkata' })
    });
    assert.equal(invalid.status, 400);
    const valid = await fetch(url + '/api/schedules', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Morning status', prompt: 'Read project status', recurrenceType: 'daily', dailyTime: '09:00', timezone: 'Asia/Kolkata' })
    });
    assert.equal(valid.status, 201);
    const body = await valid.json() as any;
    assert.equal(body.schedule.id, dueSchedule.id);
  });
  assert.ok(calls.some(call => call.sql.includes('INSERT INTO agent_schedules')));
});

test('only the tenant Owner can create recurring schedules', async () => {
  const { pool } = fakePool();
  await withApi('admin', pool, async url => {
    const response = await fetch(url + '/api/schedules', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Morning status', prompt: 'Read project status', recurrenceType: 'daily', dailyTime: '09:00' })
    });
    assert.equal(response.status, 403);
  });
});

test('schedule worker refuses to start unless dedicated worker is explicitly enabled', async () => {
  const previous = process.env.MASTER_PROJECT_WORKER_ENABLED;
  delete process.env.MASTER_PROJECT_WORKER_ENABLED;
  try { await assert.rejects(() => runScheduleWorker(), /Schedule worker disabled/); }
  finally {
    if (previous === undefined) delete process.env.MASTER_PROJECT_WORKER_ENABLED;
    else process.env.MASTER_PROJECT_WORKER_ENABLED = previous;
  }
});
