import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createUnifiedWorkspaceRouter } from '../unifiedWorkspaces.ts';

const TASK_ID = '2c4c3d4e-5f60-4a71-8b92-123456789abc';
const TENANT_A = '11111111-2222-4333-8444-555555555555';

class WorkspaceDb {
  task: Record<string, any> | null = null;
  events: Array<{ type: string; status: string }> = [];
  queries: Array<{ sql: string; values: unknown[] }> = [];

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql: sql.replace(/\\s+/g, ' ').trim(), values });
    if (/SELECT id, owner_id, original_prompt, payload, status/.test(sql)) {
      return { rows: this.task && values[0] === TENANT_A ? [this.task] : [] };
    }
    return { rows: [] };
  }

  async connect() {
    return {
      query: async (sql: string, values: unknown[] = []) => {
        this.queries.push({ sql: sql.replace(/\\s+/g, ' ').trim(), values });
        if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) return { rows: [] };
        if (/INSERT INTO agent_tasks/.test(sql)) {
          if (this.task && this.task.idempotency_key === values[2]) return { rows: [] };
          this.task = {
            id: TASK_ID, tenant_id: values[0], owner_id: values[1],
            idempotency_key: values[2], task_type: 'integration',
            original_prompt: values[3], payload: JSON.parse(String(values[4])),
            status: 'waiting_approval', requires_approval: true,
            approved_by: null, approved_at: null, result: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            completed_at: null
          };
          return { rows: [this.task] };
        }
        if (/SELECT id, owner_id, task_type, original_prompt/.test(sql)) {
          return { rows: this.task && this.task.tenant_id === values[0] && this.task.owner_id === values[1] ? [this.task] : [] };
        }
        if (/UPDATE agent_tasks/.test(sql) && /status = 'queued'/.test(sql) && /SET status = 'queued'/.test(sql)) {
          if (!this.task || this.task.id !== values[0] || this.task.tenant_id !== values[1] || this.task.status !== 'waiting_approval') return { rows: [] };
          this.task.status = 'queued'; this.task.approved_by = values[2]; this.task.approved_at = new Date().toISOString();
          return { rows: [{ id: TASK_ID, owner_id: this.task.owner_id }] };
        }
        if (/UPDATE agent_tasks/.test(sql) && /SET status = 'running'/.test(sql)) {
          if (!this.task || this.task.id !== values[0] || this.task.tenant_id !== values[1] || this.task.status !== 'queued' || !this.task.approved_by) return { rows: [] };
          this.task.status = 'running'; this.task.lease_owner = values[2];
          return { rows: [this.task] };
        }
        if (/UPDATE agent_tasks/.test(sql) && /SET status = 'completed'/.test(sql)) {
          if (!this.task || this.task.id !== values[0] || this.task.status !== 'running' || this.task.lease_owner !== values[2]) return { rows: [] };
          this.task.status = 'completed'; this.task.result = JSON.parse(String(values[3]));
          this.task.completed_at = new Date().toISOString();
          return { rows: [{ id: TASK_ID, owner_id: this.task.owner_id }] };
        }
        if (/INSERT INTO agent_task_events/.test(sql)) {
          this.events.push({ type: String(values[3]), status: String(values[2]) });
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => undefined
    };
  }
}

async function withServer(role: 'owner' | 'admin' | 'member', run: (url: string, db: WorkspaceDb, dispatches: string[]) => Promise<void>) {
  const db = new WorkspaceDb();
  const dispatches: string[] = [];
  const routers = createUnifiedWorkspaceRouter({
    pool: db as any,
    dispatchPublishing: async ({ task }) => {
      dispatches.push(task.id);
      return { externalPostId: 'provider-post-123' };
    }
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authSession = { id: 'user-123', role: 'owner' };
    res.locals.tenantContext = { tenantId: TENANT_A, role };
    next();
  });
  app.use('/api/aaksh', routers.aaksh);
  app.use('/api/publishing', routers.publishing);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  try { await run('http://127.0.0.1:' + address.port, db, dispatches); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

test('AAKSH work task is written to the shared tenant queue and waits for approval', async () => withServer('member', async (url, db) => {
  const response = await fetch(url + '/api/aaksh/work/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'aaksh-task-001' },
    body: JSON.stringify({ platform: 'website', category: 'seo', title: 'Audit website', description: 'Review the current SEO configuration.' })
  });
  assert.equal(response.status, 201);
  const body = await response.json() as any;
  assert.equal(body.task.status, 'waiting_approval');
  assert.equal(body.task.approvalRequired, true);
  assert.equal(body.task.source, 'aaksh');
  assert.equal(db.task?.task_type, 'integration');
  assert.equal(db.task?.tenant_id, TENANT_A);
  assert.equal(db.task?.payload.source, 'aaksh');
  assert.ok(db.events.some(x => x.type === 'created'));
}));

test('AAKSH publishing preparation uses the same Master approval queue', async () => withServer('member', async (url, db) => {
  const response = await fetch(url + '/api/aaksh/publishing/prepare', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: 'AI safety', platform: 'youtube' })
  });
  assert.equal(response.status, 201);
  const body = await response.json() as any;
  assert.equal(body.task.status, 'waiting_approval');
  assert.equal(body.task.approvalRequired, true);
  assert.equal(body.task.source, 'aaksh');
  assert.equal(db.task?.payload.module, 'publishing');
  assert.equal(db.task?.payload.action, 'publish');
}));

test('publishing cannot be dispatched before a tenant Owner/Admin approval', async () => withServer('owner', async (url, db, dispatches) => {
  db.task = {
    id: TASK_ID, tenant_id: TENANT_A, owner_id: 'user-123', payload: { source: 'aaksh', topic: 'Test', platform: 'youtube' },
    status: 'waiting_approval', requires_approval: true, approved_by: null, approved_at: null
  };
  const response = await fetch(url + '/api/publishing/publish', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId: TASK_ID })
  });
  assert.equal(response.status, 409);
  assert.equal(dispatches.length, 0);
}));

test('tenant Owner approval and provider confirmation complete the shared publishing task', async () => withServer('owner', async (url, db, dispatches) => {
  db.task = {
    id: TASK_ID, tenant_id: TENANT_A, owner_id: 'user-123', payload: { source: 'aaksh', topic: 'Test', platform: 'youtube', caption: 'Caption' },
    status: 'waiting_approval', requires_approval: true, approved_by: null, approved_at: null
  };
  const approval = await fetch(url + '/api/publishing/approve', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId: TASK_ID })
  });
  assert.equal(approval.status, 200);
  assert.equal(db.task.status, 'queued');
  const publish = await fetch(url + '/api/publishing/publish', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId: TASK_ID })
  });
  assert.equal(publish.status, 200);
  const body = await publish.json() as any;
  assert.equal(body.post.status, 'published');
  assert.equal(body.post.externalPostId, 'provider-post-123');
  assert.deepEqual(dispatches, [TASK_ID]);
  assert.equal(db.task.status, 'completed');
  assert.ok(db.events.some(x => x.type === 'approved'));
  assert.ok(db.events.some(x => x.type === 'published'));
}));

test('publishing approval is tenant-role protected', async () => withServer('member', async (url, db) => {
  db.task = {
    id: TASK_ID, tenant_id: TENANT_A, owner_id: 'user-123', payload: { source: 'aaksh', topic: 'Test' },
    status: 'waiting_approval', requires_approval: true, approved_by: null, approved_at: null
  };
  const response = await fetch(url + '/api/publishing/approve', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId: TASK_ID })
  });
  assert.equal(response.status, 403);
}));
