import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimNextAgentTask, completeLeasedAgentTask, failLeasedAgentTask, renewAgentTaskLease
} from '../agentTaskWorker.ts';

const TASK_ID = '2c4c3d4e-5f60-4a71-8b92-123456789abc';
const TENANT_ID = '11111111-2222-4333-8444-555555555555';

class WorkerDb {
  queries: { sql: string; values: unknown[] }[] = [];
  returnTask = true;
  async connect() {
    return {
      query: async (sql: string, values: unknown[] = []) => {
        this.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
        if (/WITH candidate AS/.test(sql)) return { rows: this.returnTask ? [{
          id: TASK_ID, tenant_id: TENANT_ID, owner_id: 'creator-1', task_type: 'read_only',
          original_prompt: 'Read a report', normalized_task: null, payload: {},
          attempts: 1, max_attempts: 3, lease_owner: values[0], lease_expires_at: new Date(Date.now() + 120000).toISOString()
        }] : [] };
        if (/UPDATE agent_tasks/.test(sql) && /LEASE_EXPIRED_MAX_ATTEMPTS/.test(sql)) return { rows: [] };
        if (/UPDATE agent_tasks/.test(sql)) return { rows: [{ id: TASK_ID, owner_id: 'creator-1', status: /CASE WHEN attempts/.test(sql) ? 'retry_wait' : 'completed' }] };
        return { rows: [] };
      },
      release: () => undefined
    };
  }
}

test('worker claims only approved, non-null-tenant tasks with atomic SKIP LOCKED lease', async () => {
  const db = new WorkerDb();
  const task = await claimNextAgentTask('worker-a', { pool: db as any, leaseSeconds: 120, taskTypes: ['read_only'] });
  assert.equal(task?.id, TASK_ID);
  const claim = db.queries.find(x => /WITH candidate AS/.test(x.sql));
  assert.ok(claim);
  assert.match(claim!.sql, /tenant_id IS NOT NULL/);
  assert.match(claim!.sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(claim!.sql, /approved_by IS NOT NULL AND approved_at IS NOT NULL/);
  assert.equal(claim!.values[0], 'worker-a');
  assert.equal(claim!.values[1], 120);
  assert.deepEqual(claim!.values[2], ['read_only']);
  assert.ok(db.queries.some(x => /INSERT INTO agent_task_events/.test(x.sql)));
});

test('worker returns no task and records no event when queue is empty', async () => {
  const db = new WorkerDb(); db.returnTask = false;
  assert.equal(await claimNextAgentTask('worker-a', { pool: db as any, taskTypes: ['read_only'] }), null);
  assert.equal(db.queries.some(x => /INSERT INTO agent_task_events/.test(x.sql)), false);
});

test('completion requires matching tenant, worker lease, running state and unexpired lease', async () => {
  const db = new WorkerDb();
  const completed = await completeLeasedAgentTask({
    taskId: TASK_ID, tenantId: TENANT_ID, workerId: 'worker-a', result: { summary: 'done' }
  }, { pool: db as any });
  assert.equal(completed, true);
  const update = db.queries.find(x => /UPDATE agent_tasks/.test(x.sql));
  assert.ok(update);
  assert.match(update!.sql, /tenant_id = \$2/);
  assert.match(update!.sql, /lease_owner = \$3/);
  assert.match(update!.sql, /lease_expires_at > NOW\(\)/);
  assert.equal(update!.values[1], TENANT_ID);
  assert.ok(db.queries.some(x => /INSERT INTO agent_task_events/.test(x.sql)));
});

test('worker failures schedule bounded retry and do not expose raw error text', async () => {
  const db = new WorkerDb();
  const result = await failLeasedAgentTask({
    taskId: TASK_ID, tenantId: TENANT_ID, workerId: 'worker-a',
    errorCode: 'PROVIDER_TIMEOUT', retryDelaySeconds: 999999
  }, { pool: db as any });
  assert.equal(result, 'retry_wait');
  const update = db.queries.find(x => /UPDATE agent_tasks/.test(x.sql));
  assert.ok(update);
  assert.equal(update!.values[1], TENANT_ID);
  assert.equal(update!.values[3], 3600);
  assert.equal(update!.values[4], 'PROVIDER_TIMEOUT');
});

test('invalid worker identity is rejected before touching the database', async () => {
  const db = new WorkerDb();
  await assert.rejects(() => claimNextAgentTask('worker id with spaces', { pool: db as any }), /Worker ID is invalid/);
  assert.equal(db.queries.length, 0);
});

test('expired final-attempt leases are terminalized rather than stranded forever', async () => {
  const db = new WorkerDb();
  await claimNextAgentTask('worker-a', { pool: db as any, taskTypes: ['read_only'] });
  const sweep = db.queries.find(x => /LEASE_EXPIRED_MAX_ATTEMPTS/.test(x.sql));
  assert.ok(sweep);
  assert.match(sweep!.sql, /tenant_id IS NOT NULL/);
  assert.match(sweep!.sql, /attempts >= max_attempts/);
  assert.ok(db.queries.some(x => /event_type, stage, status, message, details/.test(x.sql)));
});

test('lease renewal requires the current tenant, worker and unexpired lease', async () => {
  const db = new WorkerDb();
  assert.equal(await renewAgentTaskLease({
    taskId: TASK_ID, tenantId: TENANT_ID, workerId: 'worker-a', leaseSeconds: 9999
  }, { pool: db as any }), true);
  const update = db.queries.find(x => /UPDATE agent_tasks/.test(x.sql));
  assert.ok(update);
  assert.match(update!.sql, /tenant_id = \$2/);
  assert.match(update!.sql, /lease_owner = \$3/);
  assert.equal(update!.values[3], 900);
});


test('worker refuses to claim when no registered task types are supplied', async () => {
  const db = new WorkerDb();
  assert.equal(await claimNextAgentTask('worker-a', { pool: db as any }), null);
  assert.equal(db.queries.length, 0);
});

test('worker claim SQL is restricted to its explicit handler allowlist', async () => {
  const db = new WorkerDb();
  await claimNextAgentTask('worker-a', { pool: db as any, taskTypes: ['read_only', 'user_request'] });
  const claim = db.queries.find(x => /WITH candidate AS/.test(x.sql));
  assert.ok(claim);
  assert.match(claim!.sql, /task_type = ANY\(\$3::text\[\]\)/);
  assert.deepEqual(claim!.values[2], ['read_only', 'user_request']);
});
