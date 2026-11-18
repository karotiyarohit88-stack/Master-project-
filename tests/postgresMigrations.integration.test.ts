import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPendingPostgresMigrations,
  closePostgresPool,
  getPostgresMigrationStatus,
  getPostgresPool,
  checkPostgresConnection
} from '../database.ts';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === 'true';

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
    '20261118_004_agent_task_rejection.sql'
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

    const rejected = await client.query(
      `INSERT INTO agent_tasks (tenant_id, owner_id, task_type, original_prompt, status, requires_approval)
       VALUES ($1, $2, 'integration', 'Rejected state schema test', 'rejected', TRUE) RETURNING status`,
      [tenantA.rows[0].id, userA.rows[0].id]
    );
    assert.equal(rejected.rows[0].status, 'rejected');
    await client.query('ROLLBACK');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve test failure */ }
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }
});
