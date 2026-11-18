import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAgentTaskRouter } from '../taskQueue.ts';

const TASK_ID = '2c4c3d4e-5f60-4a71-8b92-123456789abc';
const TENANT_A = '11111111-2222-4333-8444-555555555555';

class TaskDb {
  resultOwnerId = 'user-123';
  resultStatus = 'completed';
  queries: { sql: string; values: unknown[] }[] = [];
  task = {
    id: TASK_ID, task_type: 'read_only', original_prompt: 'Check project status',
    normalized_task: null, payload: {}, status: 'waiting_approval', priority: 100,
    attempts: 0, max_attempts: 3, requires_approval: true, approved_by: null,
    approved_at: null, result: null, last_error: null, created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), started_at: null, completed_at: null
  };

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    if (/SELECT id, owner_id, task_type, status, result\s+FROM agent_tasks/.test(sql)) return { rows: [{ id: TASK_ID, owner_id: this.resultOwnerId, task_type: 'read_only', status: this.resultStatus, result: { action: 'read_project_status', file: 'PROJECT_STATUS.md', content: '# Master Project AI Agent' } }] };
    if (/SELECT .* FROM agent_tasks/.test(sql) && /WHERE tenant_id = \$1/.test(sql)) return { rows: [this.task] };
    if (/SELECT id FROM agent_tasks/.test(sql)) return { rows: [{ id: TASK_ID }] };
    if (/SELECT id, event_type/.test(sql)) return { rows: [{ id: 1, event_type: 'created', message: 'created' }] };
    return { rows: [] };
  }

  async connect() {
    return {
      query: async (sql: string, values: unknown[] = []) => {
        this.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
        if (/INSERT INTO agent_tasks/.test(sql)) return { rows: [{ ...this.task, tenant_id: values[0], owner_id: values[1] }] };
        if (/UPDATE agent_tasks/.test(sql)) return { rows: [{ id: TASK_ID, owner_id: 'user-123' }] };
        return { rows: [] };
      },
      release: () => undefined
    };
  }
}

async function withServer(role: 'owner' | 'admin' | 'member', run: (url: string, db: TaskDb) => Promise<void>, sessionId = 'user-123') {
  const db = new TaskDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authSession = { id: sessionId, role: 'owner' };
    res.locals.tenantContext = { tenantId: TENANT_A, role };
    next();
  });
  app.use('/api/tasks', createAgentTaskRouter({ pool: db as any }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  try { await run(`http://127.0.0.1:${address.port}`, db); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('task creation is durable, tenant-scoped, and waits for human approval', async () => withServer('member', async (url, db) => {
  const response = await fetch(url + '/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'task-001' },
    body: JSON.stringify({ taskType: 'read_only', prompt: 'Check project status', payload: { action: 'read_project_status' } })
  });
  assert.equal(response.status, 201);
  const body = await response.json() as any;
  assert.equal(body.task.status, 'waiting_approval');
  assert.equal(body.task.requires_approval, true);
  const insert = db.queries.find(x => /INSERT INTO agent_tasks/.test(x.sql));
  assert.ok(insert);
  assert.equal(insert!.values[0], TENANT_A);
  assert.equal(insert!.values[1], 'user-123');
  assert.ok(db.queries.some(x => /INSERT INTO agent_task_events/.test(x.sql)));
}));


test('read-only task intake rejects unsupported actions', async () => withServer('member', async url => {
  const response = await fetch(url + '/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ taskType: 'read_only', prompt: 'Read a file', payload: { action: 'read_any_file' } })
  });
  assert.equal(response.status, 400);
  const body = await response.json() as any;
  assert.match(body.error, /read_project_status/);
  const nullPayload = await fetch(url + '/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ taskType: 'read_only', prompt: 'Read status', payload: null })
  });
  assert.equal(nullPayload.status, 400);
}));

test('task history query always filters by the resolved tenant', async () => withServer('member', async (url, db) => {
  const response = await fetch(url + '/api/tasks');
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.tenantRole, 'member');
  assert.equal(body.tasks[0].canCancel, false);
  const query = db.queries.find(x => /SELECT .* FROM agent_tasks/.test(x.sql));
  assert.ok(query);
  assert.match(query!.sql, /WHERE tenant_id = \$1/);
  assert.equal(query!.values[0], TENANT_A);
}));

test('only tenant Owner or Admin can approve and approval does not claim execution', async () => {
  await withServer('member', async url => {
    const response = await fetch(url + '/api/tasks/' + TASK_ID + '/approve', { method: 'POST' });
    assert.equal(response.status, 403);
  });
  await withServer('owner', async (url, db) => {
    const response = await fetch(url + '/api/tasks/' + TASK_ID + '/approve', { method: 'POST' });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.status, 'queued');
    assert.equal(body.executionStarted, false);
    const update = db.queries.find(x => /UPDATE agent_tasks/.test(x.sql));
    assert.ok(update);
    assert.match(update!.sql, /tenant_id = \$2/);
    assert.equal(update!.values[1], TENANT_A);
  });
});


test('read-only task result is visible to its creator', async () => withServer('member', async (url, db) => {
  const response = await fetch(url + '/api/tasks/' + TASK_ID + '/result');
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.result.file, 'PROJECT_STATUS.md');
  assert.match(body.result.content, /Master Project AI Agent/);
}));

test('read-only task result is hidden from another tenant member', async () => withServer('member', async url => {
  const response = await fetch(url + '/api/tasks/' + TASK_ID + '/result');
  assert.equal(response.status, 403);
}, 'user-456'));

test('read-only task result is not exposed before completion', async () => withServer('member', async (url, db) => {
  db.resultStatus = 'running';
  const response = await fetch(url + '/api/tasks/' + TASK_ID + '/result');
  assert.equal(response.status, 409);
}));

test('task event history checks tenant ownership before returning events', async () => withServer('member', async (url, db) => {
  const response = await fetch(url + '/api/tasks/' + TASK_ID + '/events');
  assert.equal(response.status, 200);
  const checks = db.queries.filter(x => /tenant_id = \$2/.test(x.sql));
  assert.ok(checks.length >= 2);
  assert.ok(checks.every(x => x.values[1] === TENANT_A));
}));

test('tenant Owner can cancel tasks across their workspace', async () => withServer('owner', async (url) => {
  const response = await fetch(url + '/api/tasks');
  const body = await response.json() as any;
  assert.equal(body.tenantRole, 'owner');
  assert.equal(body.tasks[0].canCancel, true);
}));


test('only tenant Owner or Admin can reject a task awaiting approval', async () => {
  await withServer('member', async url => {
    const response = await fetch(url + '/api/tasks/' + TASK_ID + '/reject', { method: 'POST' });
    assert.equal(response.status, 403);
  });
  await withServer('owner', async (url, db) => {
    const response = await fetch(url + '/api/tasks/' + TASK_ID + '/reject', { method: 'POST' });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.status, 'rejected');
    assert.equal(body.executionStarted, false);
    const update = db.queries.find(x => /UPDATE agent_tasks/.test(x.sql));
    assert.ok(update);
    assert.match(update!.sql, /tenant_id = \$2/);
    assert.match(update!.sql, /status = 'waiting_approval'/);
    assert.equal(update!.values[1], TENANT_A);
    assert.ok(db.queries.some(x => /'rejected', 'approval', 'rejected'/.test(x.sql)));
  });
});
