import { randomUUID } from 'node:crypto';
import { getPostgresPool } from './database.ts';

type QueryResult = { rows: any[] };
type WorkerClient = {
  query: (sql: string, values?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};
type WorkerPool = { connect: () => Promise<WorkerClient> };

export type LeasedAgentTask = {
  id: string;
  tenant_id: string;
  owner_id: string;
  task_type: string;
  original_prompt: string;
  normalized_task: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  lease_owner: string;
  lease_expires_at: string;
};

function requirePool(pool?: WorkerPool | null): WorkerPool {
  const activePool = pool === undefined ? getPostgresPool() as unknown as WorkerPool | null : pool;
  if (!activePool) throw new Error('Durable task database is not configured.');
  return activePool;
}

function validateWorkerId(workerId: string): string {
  const value = typeof workerId === 'string' ? workerId.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error('Worker ID is invalid.');
  return value;
}

function validateTaskId(taskId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    throw new Error('Task ID is invalid.');
  }
  return taskId;
}

function validateTenantId(tenantId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error('Tenant ID is invalid.');
  }
  return tenantId;
}

async function rollback(client: WorkerClient) {
  try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
}

/**
 * Atomically leases one eligible task. NULL-tenant legacy tasks and tasks
 * without a recorded human approval are never claimable.
 */
export async function claimNextAgentTask(
  workerIdInput: string,
  options: { leaseSeconds?: number; pool?: WorkerPool | null } = {}
): Promise<LeasedAgentTask | null> {
  const workerId = validateWorkerId(workerIdInput);
  const leaseSeconds = Math.min(Math.max(Math.floor(options.leaseSeconds ?? 120), 30), 900);
  const pool = requirePool(options.pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `WITH candidate AS (
         SELECT id
           FROM agent_tasks
          WHERE tenant_id IS NOT NULL
            AND available_at <= NOW()
            AND attempts < max_attempts
            AND (requires_approval = FALSE OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
            AND (
              status IN ('queued', 'retry_wait')
              OR (status = 'running' AND lease_expires_at <= NOW())
            )
          ORDER BY priority ASC, available_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE agent_tasks task
          SET status = 'running',
              attempts = task.attempts + 1,
              lease_owner = $1,
              lease_expires_at = NOW() + make_interval(secs => $2),
              started_at = COALESCE(task.started_at, NOW()),
              updated_at = NOW()
         FROM candidate
        WHERE task.id = candidate.id AND task.tenant_id IS NOT NULL
       RETURNING task.id, task.tenant_id, task.owner_id, task.task_type,
                 task.original_prompt, task.normalized_task, task.payload,
                 task.attempts, task.max_attempts, task.lease_owner, task.lease_expires_at`,
      [workerId, leaseSeconds]
    );
    const task = result.rows[0] as LeasedAgentTask | undefined;
    if (!task) {
      await client.query('COMMIT');
      return null;
    }
    await client.query(
      `INSERT INTO agent_task_events
         (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
       VALUES ($1, $2, $3, 'claimed', 'worker', 'running', $4, $5::jsonb)`,
      [task.id, task.tenant_id, task.owner_id, 'A worker acquired a time-limited task lease.', JSON.stringify({ workerId, attempt: task.attempts })]
    );
    await client.query('COMMIT');
    return task;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeLeasedAgentTask(
  input: { taskId: string; tenantId: string; workerId: string; result: Record<string, unknown> },
  options: { pool?: WorkerPool | null } = {}
): Promise<boolean> {
  const taskId = validateTaskId(input.taskId);
  const tenantId = validateTenantId(input.tenantId);
  const workerId = validateWorkerId(input.workerId);
  if (!input.result || typeof input.result !== 'object' || Array.isArray(input.result) ||
      Buffer.byteLength(JSON.stringify(input.result), 'utf8') > 64 * 1024) {
    throw new Error('Task result must be a JSON object no larger than 64 KB.');
  }
  const pool = requirePool(options.pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE agent_tasks
          SET status = 'completed', result = $4::jsonb, completed_at = NOW(),
              updated_at = NOW(), lease_owner = NULL, lease_expires_at = NULL
        WHERE id = $1 AND tenant_id = $2 AND lease_owner = $3
          AND status = 'running' AND lease_expires_at > NOW()
        RETURNING id, owner_id`,
      [taskId, tenantId, workerId, JSON.stringify(input.result)]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      `INSERT INTO agent_task_events
         (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
       VALUES ($1, $2, $3, 'completed', 'worker', 'completed', $4, $5::jsonb)`,
      [taskId, tenantId, updated.rows[0].owner_id, 'Worker recorded successful task completion.', JSON.stringify({ workerId })]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function failLeasedAgentTask(
  input: { taskId: string; tenantId: string; workerId: string; errorCode?: string; retryDelaySeconds?: number },
  options: { pool?: WorkerPool | null } = {}
): Promise<'retry_wait' | 'failed' | 'lease_lost'> {
  const taskId = validateTaskId(input.taskId);
  const tenantId = validateTenantId(input.tenantId);
  const workerId = validateWorkerId(input.workerId);
  const errorCode = typeof input.errorCode === 'string' && /^[A-Z0-9_:-]{1,64}$/.test(input.errorCode)
    ? input.errorCode : 'WORKER_ERROR';
  const retryDelaySeconds = Math.min(Math.max(Math.floor(input.retryDelaySeconds ?? 30), 1), 3600);
  const pool = requirePool(options.pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE agent_tasks
          SET status = CASE WHEN attempts < max_attempts THEN 'retry_wait' ELSE 'failed' END,
              available_at = CASE WHEN attempts < max_attempts
                THEN NOW() + make_interval(secs => $4) ELSE available_at END,
              last_error = $5, completed_at = CASE WHEN attempts < max_attempts THEN NULL ELSE NOW() END,
              updated_at = NOW(), lease_owner = NULL, lease_expires_at = NULL
        WHERE id = $1 AND tenant_id = $2 AND lease_owner = $3
          AND status = 'running' AND lease_expires_at > NOW()
        RETURNING id, owner_id, status`,
      [taskId, tenantId, workerId, retryDelaySeconds, errorCode]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return 'lease_lost';
    }
    const status = updated.rows[0].status as 'retry_wait' | 'failed';
    await client.query(
      `INSERT INTO agent_task_events
         (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
       VALUES ($1, $2, $3, 'worker_failed', 'worker', $4, $5, $6::jsonb)`,
      [taskId, tenantId, updated.rows[0].owner_id, status, status === 'retry_wait' ? 'Worker failed; task scheduled for a bounded retry.' : 'Worker failed; retry limit reached.', JSON.stringify({ workerId, errorCode, retryDelaySeconds })]
    );
    await client.query('COMMIT');
    return status;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export function createAgentWorkerId(prefix = 'master-project-worker'): string {
  return `${prefix}:${randomUUID()}`;
}
