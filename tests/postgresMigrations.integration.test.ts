import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createAuthGuards, createAuthRouter, createCsrfMutationGuard, verifyPassword } from '../auth.ts';
import { createAgentTaskRouter } from '../taskQueue.ts';
import { createUnifiedWorkspaceRouter } from '../unifiedWorkspaces.ts';
import { importAakshLegacyData } from '../scripts/importAakshLegacyData.ts';
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

async function runLegacyImportE2E(pool: any) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aaksh-legacy-import-'));
  const userId = randomUUID();
  const taskId = randomUUID();
  const postId = randomUUID();
  const commentId = randomUUID();
  const password = 'LegacyAakshPassword!234';
  const salt = randomBytes(16);
  const legacyPasswordHash = 'scrypt' + '$' + salt.toString('hex') + '$' + scryptSync(password, salt, 64).toString('hex');
  const createdAt = new Date().toISOString();
  try {
    await writeFile(path.join(dataDir, 'users.json'), JSON.stringify([{
      id: userId, name: 'Legacy AAKSH User', email: 'legacy-aaksh@example.test',
      emailVerified: true, passwordHash: legacyPasswordHash, createdAt
    }]));
    await writeFile(path.join(dataDir, 'work-tasks.json'), JSON.stringify([{
      id: taskId, ownerId: userId, platform: 'website', category: 'seo',
      title: 'Legacy SEO task', description: 'Imported for review',
      status: 'planned', approvalStatus: 'approved', audit: [], createdAt, updatedAt: createdAt
    }]));
    await writeFile(path.join(dataDir, 'social-posts.json'), JSON.stringify([{
      id: postId, authorId: userId, text: 'Legacy social post', likes: [userId],
      comments: [{ id: commentId, authorId: userId, text: 'Legacy comment', createdAt }],
      createdAt, updatedAt: createdAt
    }]));

    const preview = await importAakshLegacyData({ pool, dataDir, dryRun: true });
    assert.equal(preview.usersImported, 1);
    assert.equal(preview.tasksImported, 1);
    assert.equal(preview.postsImported, 1);
    assert.equal(preview.likesImported, 1);
    assert.equal(preview.commentsImported, 1);
    const absent = await pool.query('SELECT id FROM app_users WHERE id = $1', [userId]);
    assert.equal(absent.rows.length, 0, 'Dry-run must not persist imported identities.');

    const applied = await importAakshLegacyData({ pool, dataDir, dryRun: false });
    assert.equal(applied.dryRun, false);
    assert.equal(applied.usersImported, 1);
    const user = await pool.query('SELECT id, password_hash FROM app_users WHERE id = $1', [userId]);
    assert.equal(user.rows.length, 1);
    assert.equal(await verifyPassword(password, user.rows[0].password_hash), true);

    const tenant = await pool.query('SELECT id FROM app_tenants WHERE owner_user_id = $1', [userId]);
    assert.equal(tenant.rows.length, 1);
    const task = await pool.query(
      `SELECT status, requires_approval, approved_by, payload
         FROM agent_tasks WHERE tenant_id = $1 AND owner_id = $2`,
      [tenant.rows[0].id, userId]
    );
    assert.equal(task.rows.length, 1);
    assert.equal(task.rows[0].status, 'waiting_approval');
    assert.equal(task.rows[0].requires_approval, true);
    assert.equal(task.rows[0].approved_by, null, 'Legacy approval is not trusted or carried forward.');
    assert.equal(task.rows[0].payload.legacy.approvalStatus, 'approved');

    const post = await pool.query(
      'SELECT id FROM aaksh_social_posts WHERE id = $1 AND tenant_id = $2',
      [postId, tenant.rows[0].id]
    );
    const likes = await pool.query('SELECT post_id FROM aaksh_social_likes WHERE post_id = $1', [postId]);
    const comments = await pool.query('SELECT id FROM aaksh_social_comments WHERE post_id = $1', [postId]);
    assert.equal(post.rows.length, 1);
    assert.equal(likes.rows.length, 1);
    assert.equal(comments.rows.length, 1);
    const sessions = await pool.query('SELECT id FROM app_sessions WHERE user_id = $1', [userId]);
    assert.equal(sessions.rows.length, 0, 'Legacy sessions are intentionally not imported; users must sign in again.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM agent_tasks WHERE tenant_id = $1', [tenant.rows[0].id]);
      await client.query('DELETE FROM aaksh_social_posts WHERE tenant_id = $1', [tenant.rows[0].id]);
      await client.query('DELETE FROM app_tenant_memberships WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM app_tenants WHERE id = $1', [tenant.rows[0].id]);
      await client.query('DELETE FROM app_users WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* preserve cleanup error */ }
      throw error;
    } finally { client.release(); }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
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
        await client.query('DELETE FROM agent_tasks WHERE tenant_id IN (SELECT id FROM app_tenants WHERE owner_user_id = $1)', [userId]);
        await client.query('DELETE FROM aaksh_social_posts WHERE tenant_id IN (SELECT id FROM app_tenants WHERE owner_user_id = $1)', [userId]);
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
    await runLegacyImportE2E(pool);
    await runUnifiedPostgresE2E(pool);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve test failure */ }
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }
});
