import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import { createAuthGuards, createAuthRouter, createCsrfMutationGuard } from '../auth.ts';
import { createAgentTaskRouter } from '../taskQueue.ts';
import { createUnifiedWorkspaceRouter } from '../unifiedWorkspaces.ts';
import assert from 'node:assert/strict';
import {
  applyPendingPostgresMigrations,
  closePostgresPool,
  getPostgresMigrationStatus,
  getPostgresPool,
  checkPostgresConnection
} from '../database.ts';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === 'true';


function readCookie(setCookie: string, name: string): string {
  const match = setCookie.match(new RegExp('(?:^|, )' + name + '=([^;]+)'));
  if (!match) throw new Error('Missing session cookie ' + name);
  return decodeURIComponent(match[1]);
}

async function runUnifiedPostgresE2E(pool: any) {
  const sentCodes: string[] = [];
  const adminToken = 'ci-only-owner-bootstrap-token-at-least-32-characters';
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({
    pool,
    adminToken,
    otpPepper: 'ci-only-otp-pepper-value-at-least-32-characters',
    sendOtp: async (_email, code) => { sentCodes.push(code); }
  }));
  const guards = createAuthGuards({ pool });
  app.use('/api', guards.requireSession, createCsrfMutationGuard(guards.requireCsrf));
  app.use('/api/tasks', guards.requireTenantMembership, createAgentTaskRouter({ pool }));
  const routers = createUnifiedWorkspaceRouter({
    pool,
    dispatchPublishing: async ({ task }) => ({ externalPostId: 'ci-provider-post-' + task.id })
  });
  app.use('/api/aaksh', guards.requireTenantMembership, routers.aaksh);
  app.use('/api/aaksh/social', guards.requireTenantMembership, routers.social);
  app.use('/api/publishing', guards.requireTenantMembership, routers.publishing);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No E2E test server port');
  const base = 'http://127.0.0.1:' + address.port;
  let userId = '';
  try {
    const bootstrap = await fetch(base + '/api/auth/bootstrap-owner', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-aaksh-admin-token': adminToken },
      body: JSON.stringify({ email: 'master-e2e@example.test', password: 'MasterE2EPassword!234', displayName: 'Master E2E Owner' })
    });
    assert.equal(bootstrap.status, 202);
    const bootstrapBody = await bootstrap.json() as any;
    const ownerCreated = await fetch(base + '/api/auth/verify-otp', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeToken: bootstrapBody.challengeToken, otp: sentCodes.at(-1) })
    });
    assert.equal(ownerCreated.status, 200);

    const login = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'master-e2e@example.test', password: 'MasterE2EPassword!234' })
    });
    assert.equal(login.status, 202);
    const loginBody = await login.json() as any;
    const verified = await fetch(base + '/api/auth/verify-otp', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeToken: loginBody.challengeToken, otp: sentCodes.at(-1) })
    });
    assert.equal(verified.status, 200);
    const verifiedBody = await verified.json() as any;
    const setCookie = verified.headers.get('set-cookie') || '';
    const cookies = 'aaksh_session=' + readCookie(setCookie, 'aaksh_session') +
      '; aaksh_csrf=' + readCookie(setCookie, 'aaksh_csrf');
    const headers = { cookie: cookies, origin: base, 'x-csrf-token': verifiedBody.csrfToken, 'content-type': 'application/json' };

    const me = await fetch(base + '/api/auth/me', { headers: { cookie: cookies } });
    assert.equal(me.status, 200);
    userId = (await me.json() as any).user.id;

    const aakshTaskResponse = await fetch(base + '/api/aaksh/work/tasks', {
      method: 'POST', headers,
      body: JSON.stringify({ platform: 'website', category: 'seo', title: 'PostgreSQL E2E task', description: 'Must use the Master tenant queue.' })
    });
    assert.equal(aakshTaskResponse.status, 201);
    const aakshTask = (await aakshTaskResponse.json() as any).task;
    assert.equal(aakshTask.status, 'awaiting_approval');

    const masterQueue = await fetch(base + '/api/tasks', { headers: { cookie: cookies } });
    assert.equal(masterQueue.status, 200);
    const masterQueueBody = await masterQueue.json() as any;
    assert.ok(masterQueueBody.tasks.some((task: any) => task.id === aakshTask.id));

    const taskApproval = await fetch(base + '/api/tasks/' + aakshTask.id + '/approve', {
      method: 'POST', headers
    });
    assert.equal(taskApproval.status, 200);
    assert.equal((await taskApproval.json() as any).executionStarted, false);

    const publishingDraftResponse = await fetch(base + '/api/aaksh/publishing/prepare', {
      method: 'POST', headers,
      body: JSON.stringify({ topic: 'Shared publishing E2E', platform: 'youtube' })
    });
    assert.equal(publishingDraftResponse.status, 201);
    const publishingDraft = (await publishingDraftResponse.json() as any).task;
    const publishingApproval = await fetch(base + '/api/publishing/approve', {
      method: 'POST', headers, body: JSON.stringify({ postId: publishingDraft.id })
    });
    assert.equal(publishingApproval.status, 200);
    const publish = await fetch(base + '/api/publishing/publish', {
      method: 'POST', headers, body: JSON.stringify({ postId: publishingDraft.id })
    });
    assert.equal(publish.status, 200);
    assert.equal((await publish.json() as any).post.status, 'published');

    const socialPost = await fetch(base + '/api/aaksh/social/posts', {
      method: 'POST', headers, body: JSON.stringify({ text: 'Shared PostgreSQL social E2E' })
    });
    assert.equal(socialPost.status, 201);
    const feed = await fetch(base + '/api/aaksh/social/feed', { headers: { cookie: cookies } });
    assert.equal(feed.status, 200);
    assert.ok((await feed.json() as any).posts.some((post: any) => post.text === 'Shared PostgreSQL social E2E'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (userId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM app_tenant_memberships WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM app_tenants WHERE owner_user_id = $1', [userId]);
        await client.query('DELETE FROM app_users WHERE id = $1', [userId]);
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* preserve cleanup error */ }
        throw error;
      } finally { client.release(); }
    }
  }
}

test('PostgreSQL migrations apply cleanly and tenant/task records remain isolated', { skip: !enabled }, async () => {
  assert.equal(process.env.RUN_DB_MIGRATIONS, 'true', 'Integration job must explicitly enable migrations for its disposable database.');
  const connection = await checkPostgresConnection();
  assert.equal(connection.connected, true, connection.error || 'PostgreSQL connection failed.');

  const migrationResult = await applyPendingPostgresMigrations();
  const status = await getPostgresMigrationStatus();
  const required = [
    '20261114_001_agent_task_queue.sql',
    '20261114_002_application_auth.sql',
    '20261116_003_email_otp_challenges.sql',
    '20261117_001_app_secrets.sql',
    '20261118_001_tenant_identity.sql',
    '20261118_002_invitation_tenant_scope.sql',
    '20261118_003_agent_task_tenant_scope.sql',
    '20261118_004_agent_task_rejection.sql',
    '20261118_005_aaksh_social_tenant_scope.sql'
  ];
  assert.equal(status.migrationTableExists, true);
  for (const migration of required) assert.ok(status.appliedMigrations.includes(migration), 'Missing migration ' + migration);
  assert.ok(migrationResult.applied.length + migrationResult.alreadyApplied.length >= required.length);

  const pool = getPostgresPool();
  assert.ok(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userA = await client.query(
      `INSERT INTO app_users (email, password_hash, display_name, role, status, email_verified_at)
       VALUES ($1, $2, 'Tenant A Owner', 'owner', 'active', NOW()) RETURNING id`,
      ['tenant-a-' + randomUUID() + '@example.test', 'x'.repeat(64)]
    );
    const userB = await client.query(
      `INSERT INTO app_users (email, password_hash, display_name, role, status, email_verified_at)
       VALUES ($1, $2, 'Tenant B Owner', 'owner', 'active', NOW()) RETURNING id`,
      ['tenant-b-' + randomUUID() + '@example.test', 'y'.repeat(64)]
    );
    const tenantA = await client.query(
      `INSERT INTO app_tenants (display_name, owner_user_id) VALUES ('Tenant A', $1) RETURNING id`,
      [userA.rows[0].id]
    );
    const tenantB = await client.query(
      `INSERT INTO app_tenants (display_name, owner_user_id) VALUES ('Tenant B', $1) RETURNING id`,
      [userB.rows[0].id]
    );
    await client.query(
      `INSERT INTO app_tenant_memberships (tenant_id, user_id, membership_role)
       VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`,
      [tenantA.rows[0].id, userA.rows[0].id, tenantB.rows[0].id, userB.rows[0].id]
    );

    const taskA = await client.query(
      `INSERT INTO agent_tasks (tenant_id, owner_id, task_type, original_prompt, payload, status, requires_approval)
       VALUES ($1, $2, 'integration', 'AAKSH tenant A', '{"source":"aaksh"}'::jsonb, 'waiting_approval', TRUE)
       RETURNING id`,
      [tenantA.rows[0].id, userA.rows[0].id]
    );
    await client.query(
      `INSERT INTO agent_task_events (task_id, tenant_id, owner_id, event_type, stage, status, message)
       VALUES ($1, $2, $3, 'created', 'intake', 'waiting_approval', 'Test event')`,
      [taskA.rows[0].id, tenantA.rows[0].id, userA.rows[0].id]
    );
    const visibleToA = await client.query(
      'SELECT id FROM agent_tasks WHERE tenant_id = $1',
      [tenantA.rows[0].id]
    );
    const visibleToB = await client.query(
      'SELECT id FROM agent_tasks WHERE tenant_id = $1',
      [tenantB.rows[0].id]
    );
    assert.equal(visibleToA.rows.length, 1);
    assert.equal(visibleToB.rows.length, 0);

    const post = await client.query(
      `INSERT INTO aaksh_social_posts (tenant_id, author_user_id, body)
       VALUES ($1, $2, 'Tenant A social post') RETURNING id`,
      [tenantA.rows[0].id, userA.rows[0].id]
    );
    await client.query(
      `INSERT INTO aaksh_social_likes (tenant_id, post_id, user_id)
       VALUES ($1, $2, $3)`,
      [tenantA.rows[0].id, post.rows[0].id, userA.rows[0].id]
    );
    await client.query(
      `INSERT INTO aaksh_social_comments (tenant_id, post_id, author_user_id, body)
       VALUES ($1, $2, $3, 'Tenant A comment')`,
      [tenantA.rows[0].id, post.rows[0].id, userA.rows[0].id]
    );
    const socialVisibleToA = await client.query(
      'SELECT id FROM aaksh_social_posts WHERE tenant_id = $1',
      [tenantA.rows[0].id]
    );
    const socialVisibleToB = await client.query(
      'SELECT id FROM aaksh_social_posts WHERE tenant_id = $1',
      [tenantB.rows[0].id]
    );
    assert.equal(socialVisibleToA.rows.length, 1);
    assert.equal(socialVisibleToB.rows.length, 0);

    const rejected = await client.query(
      `INSERT INTO agent_tasks (tenant_id, owner_id, task_type, original_prompt, status, requires_approval)
       VALUES ($1, $2, 'integration', 'Rejected state schema test', 'rejected', TRUE) RETURNING status`,
      [tenantA.rows[0].id, userA.rows[0].id]
    );
    assert.equal(rejected.rows[0].status, 'rejected');
    await client.query('ROLLBACK');
    await runUnifiedPostgresE2E(pool);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve test failure */ }
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }
});
