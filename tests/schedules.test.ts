import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchDueSchedules, runScheduleWorker } from '../server/schedules.ts';

const dueSchedule = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  owner_id: '33333333-3333-4333-8333-333333333333',
  title: 'Daily status',
  original_prompt: 'Read project status',
  recurrence_type: 'daily',
  timezone: 'Asia/Kolkata',
  daily_time: '09:00',
  interval_minutes: null,
  next_run_at: new Date('2026-11-25T03:30:00.000Z')
};

function fakePool(dueRows: any[]) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql.includes('FROM agent_schedules') && sql.includes('FOR UPDATE SKIP LOCKED')) return { rows: dueRows };
      if (sql.includes('INSERT INTO agent_tasks')) return { rows: [{ id: '44444444-4444-4444-8444-444444444444' }] };
      return { rows: [] };
    },
    release() {}
  };
  return { calls, pool: { connect: async () => client } };
}

test('scheduler dispatches due schedule as an automatically approved fixed read-only task', async () => {
  const { calls, pool } = fakePool([dueSchedule]);
  const count = await dispatchDueSchedules({ pool: pool as any });
  assert.equal(count, 1);
  const insert = calls.find(call => call.sql.includes('INSERT INTO agent_tasks'));
  assert.ok(insert);
  assert.match(insert!.sql, /'read_only'/);
  assert.match(insert!.sql, /'queued',FALSE/);
  assert.deepEqual(insert!.values?.slice(0, 3), [dueSchedule.tenant_id, dueSchedule.owner_id, 'schedule:11111111-1111-4111-8111-111111111111:2026-11-25T03:30:00.000Z']);
  assert.ok(calls.some(call => call.sql.includes("set_config('app.worker_mode','true',true)")));
  assert.ok(calls.some(call => call.sql.includes('UPDATE agent_schedules SET last_run_at')));
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
});

test('scheduler does not create work when there are no due schedules', async () => {
  const { calls, pool } = fakePool([]);
  assert.equal(await dispatchDueSchedules({ pool: pool as any }), 0);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO agent_tasks')), false);
});

test('schedule worker refuses to start unless dedicated worker is explicitly enabled', async () => {
  const previous = process.env.MASTER_PROJECT_WORKER_ENABLED;
  delete process.env.MASTER_PROJECT_WORKER_ENABLED;
  try {
    await assert.rejects(() => runScheduleWorker(), /Schedule worker disabled/);
  } finally {
    if (previous === undefined) delete process.env.MASTER_PROJECT_WORKER_ENABLED;
    else process.env.MASTER_PROJECT_WORKER_ENABLED = previous;
  }
});
