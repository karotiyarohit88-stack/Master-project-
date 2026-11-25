import { Router, type Request, type Response } from 'express';
import { getPostgresPool } from './database.ts';
import type { TenantContext } from './auth.ts';

type DbResult = { rows: any[]; rowCount?: number | null };
type DbClient = {
  query: (sql: string, values?: unknown[]) => Promise<DbResult>;
  release: () => void;
};
type DbPool = DbClient & { connect: () => Promise<DbClient> };

type TaskSession = { id: string; role: 'owner' | 'admin' | 'member' };

const TASK_TYPES = new Set(['read_only', 'user_request', 'code_change', 'automation', 'media_generation', 'integration', 'research']);
const MAX_PROMPT_LENGTH = 12000;
const MAX_PAYLOAD_BYTES = 16 * 1024;
const TASK_COLUMNS = 'id, task_type, original_prompt, normalized_task, payload, status, priority, attempts, max_attempts, requires_approval, approved_by, approved_at, result, last_error, created_at, updated_at, started_at, completed_at';

function jsonError(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function getContext(res: Response): { session: TaskSession; tenant: TenantContext } | null {
  const session = res.locals.authSession as TaskSession | undefined;
  const tenant = res.locals.tenantContext as TenantContext | undefined;
  return session && tenant ? { session, tenant } : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeTask(row: Record<string, unknown>, context?: { session: TaskSession; tenant: TenantContext }) {
  const { last_error, owner_id, ...task } = row;
  return {
    ...task,
    last_error: last_error ? 'Task execution reported an error. Contact the workspace Owner for details.' : null,
    ...(context ? { canCancel: ['owner', 'admin'].includes(context.tenant.role) || owner_id === context.session.id } : {})
  };
}

export function createAgentTaskRouter(options: { pool?: DbPool | null } = {}) {
  const router = Router();
  const pool = options.pool === undefined ? getPostgresPool() as unknown as DbPool | null : options.pool;

  router.post('/', async (req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    const taskType = typeof req.body?.taskType === 'string' ? req.body.taskType : '';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const payload = req.body?.payload === undefined ? {} : req.body.payload;
    const idempotencyKey = typeof req.header('idempotency-key') === 'string' ? req.header('idempotency-key')!.trim() : '';
    if (!TASK_TYPES.has(taskType)) return jsonError(res, 400, 'Unsupported task type.');
    if (taskType === 'research' && context.tenant.role !== 'owner') return jsonError(res, 403, 'Only the tenant Owner can queue research that uses encrypted provider secrets.');
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return jsonError(res, 400, 'Prompt must contain between 1 and 12000 characters.');
    if (!isPlainObject(payload) || Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) {
      return jsonError(res, 400, 'Task payload must be a JSON object no larger than 16 KB.');
    }
    if ((taskType === 'read_only' && (payload.action !== 'read_project_status' || Object.keys(payload).some(key => key !== 'action'))) ||
        (taskType === 'research' && (payload.action !== 'research' || Object.keys(payload).some(key => key !== 'action')))) {
      return jsonError(res, 400, 'Read-only tasks support only read_project_status; research tasks support only the research action.');
    }
    if (idempotencyKey && (idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey))) {
      return jsonError(res, 400, 'Idempotency-Key has an invalid format.');
    }

    const requiresApproval = true; // Conservative default: no task executes before a recorded human approval.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO agent_tasks
           (tenant_id, owner_id, idempotency_key, task_type, original_prompt, payload,
            status, requires_approval, priority)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'waiting_approval', $7, 100)
         ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING ${TASK_COLUMNS}`,
        [context.tenant.tenantId, context.session.id, idempotencyKey || null, taskType, prompt, JSON.stringify(payload), requiresApproval]
      );
      if (!inserted.rows[0] && idempotencyKey) {
        const existing = await client.query(
          `SELECT ${TASK_COLUMNS} FROM agent_tasks
            WHERE tenant_id = $1 AND owner_id = $2 AND idempotency_key = $3
            LIMIT 1`,
          [context.tenant.tenantId, context.session.id, idempotencyKey]
        );
        if (!existing.rows[0]) throw new Error('Idempotency conflict could not be resolved in this tenant.');
        await client.query('COMMIT');
        return res.status(200).json({ task: safeTask(existing.rows[0]), idempotentReplay: true });
      }
      const task = inserted.rows[0];
      if (!task) throw new Error('Task insert returned no row.');
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'created', 'intake', 'waiting_approval', $4, $5::jsonb)`,
        [task.id, context.tenant.tenantId, context.session.id, 'Task saved and is waiting for human approval.', JSON.stringify({ taskType })]
      );
      await client.query('COMMIT');
      return res.status(201).json({ task: safeTask(task), idempotentReplay: false });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
      const code = (error as { code?: string })?.code;
      if (code === '42P01' || code === '42703') return jsonError(res, 503, 'Task storage schema is not ready. Apply the approved task and tenant migrations before enabling this API.');
      return jsonError(res, 503, 'Task could not be saved to durable storage.');
    } finally {
      client.release();
    }
  });

  router.get('/', async (_req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    const limit = Math.min(Math.max(Number.parseInt(String(_req.query.limit || '50'), 10) || 50, 1), 100);
    try {
      const result = await pool.query(
        `SELECT id, task_type, original_prompt, status, attempts, max_attempts, requires_approval, approved_at, created_at, owner_id FROM agent_tasks
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [context.tenant.tenantId, limit]
      );
      return res.json({ tasks: result.rows.map(row => safeTask(row, context)), tenantRole: context.tenant.role });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === '42P01' || code === '42703') return jsonError(res, 503, 'Task storage schema is not ready.');
      return jsonError(res, 503, 'Task history is temporarily unavailable.');
    }
  });

  router.get('/:taskId/result', async (req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.taskId)) {
      return jsonError(res, 400, 'Task ID is invalid.');
    }
    try {
      const result = await pool.query(
        `SELECT id, owner_id, task_type, status, result
           FROM agent_tasks
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1`,
        [req.params.taskId, context.tenant.tenantId]
      );
      const task = result.rows[0];
      if (!task || task.task_type !== 'read_only') return jsonError(res, 404, 'Read-only task result not found.');
      const canView = ['owner', 'admin'].includes(context.tenant.role) || task.owner_id === context.session.id;
      if (!canView) return jsonError(res, 403, 'Only the task creator or workspace Owner/Admin can view this result.');
      if (task.status !== 'completed') return jsonError(res, 409, 'Task result is not ready yet.');
      if (!isPlainObject(task.result) || Buffer.byteLength(JSON.stringify(task.result), 'utf8') > 64 * 1024) {
        return jsonError(res, 503, 'Stored task result is invalid or exceeds the result limit.');
      }
      return res.json({ taskId: task.id, result: task.result });
    } catch {
      return jsonError(res, 503, 'Task result is temporarily unavailable.');
    }
  });

  router.get('/:taskId/events', async (req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.taskId)) {
      return jsonError(res, 400, 'Task ID is invalid.');
    }
    try {
      const task = await pool.query(
        'SELECT id FROM agent_tasks WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [req.params.taskId, context.tenant.tenantId]
      );
      if (!task.rows[0]) return jsonError(res, 404, 'Task not found.');
      const events = await pool.query(
        `SELECT id, event_type, stage, status, message, details, created_at
           FROM agent_task_events
          WHERE task_id = $1 AND tenant_id = $2
          ORDER BY created_at ASC
          LIMIT 250`,
        [req.params.taskId, context.tenant.tenantId]
      );
      return res.json({ events: events.rows });
    } catch {
      return jsonError(res, 503, 'Task event history is temporarily unavailable.');
    }
  });

  router.post('/:taskId/approve', async (req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    if (!['owner', 'admin'].includes(context.tenant.role)) return jsonError(res, 403, 'Only a workspace Owner or Admin can approve tasks.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.taskId)) {
      return jsonError(res, 400, 'Task ID is invalid.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE agent_tasks
            SET status = 'queued', approved_by = $3, approved_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND status = 'waiting_approval' AND requires_approval = TRUE
          RETURNING id, owner_id`,
        [req.params.taskId, context.tenant.tenantId, context.session.id]
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return jsonError(res, 409, 'Task is not awaiting approval in this workspace.');
      }
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'approved', 'approval', 'queued', $4, $5::jsonb)`,
        [req.params.taskId, context.tenant.tenantId, result.rows[0].owner_id, 'Workspace approval recorded; task is queued but has not started.', JSON.stringify({ approvedBy: context.session.id })]
      );
      await client.query('COMMIT');
      return res.json({ taskId: req.params.taskId, status: 'queued', executionStarted: false });
    } catch {
      try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
      return jsonError(res, 503, 'Task approval could not be recorded.');
    } finally {
      client.release();
    }
  });

  router.post('/:taskId/reject', async (req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    if (!['owner', 'admin'].includes(context.tenant.role)) return jsonError(res, 403, 'Only a workspace Owner or Admin can reject tasks.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.taskId)) {
      return jsonError(res, 400, 'Task ID is invalid.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE agent_tasks
            SET status = 'rejected', updated_at = NOW(), completed_at = NOW(),
                lease_owner = NULL, lease_expires_at = NULL
          WHERE id = $1 AND tenant_id = $2 AND status = 'waiting_approval'
            AND requires_approval = TRUE
          RETURNING id, owner_id`,
        [req.params.taskId, context.tenant.tenantId]
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return jsonError(res, 409, 'Task is not awaiting approval in this workspace.');
      }
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'rejected', 'approval', 'rejected', $4, $5::jsonb)`,
        [req.params.taskId, context.tenant.tenantId, result.rows[0].owner_id,
          'Workspace Owner/Admin rejected the task before execution.',
          JSON.stringify({ rejectedBy: context.session.id })]
      );
      await client.query('COMMIT');
      return res.json({ taskId: req.params.taskId, status: 'rejected', executionStarted: false });
    } catch {
      try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
      return jsonError(res, 503, 'Task rejection could not be recorded.');
    } finally {
      client.release();
    }
  });

  router.post('/:taskId/cancel', async (req, res) => {
    const context = getContext(res);
    if (!context) return jsonError(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return jsonError(res, 503, 'Durable task storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.taskId)) {
      return jsonError(res, 400, 'Task ID is invalid.');
    }
    const canManageTenant = ['owner', 'admin'].includes(context.tenant.role);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE agent_tasks
            SET status = 'cancelled', updated_at = NOW(), completed_at = NOW(), lease_owner = NULL, lease_expires_at = NULL
          WHERE id = $1 AND tenant_id = $2 AND status IN ('queued', 'retry_wait', 'waiting_approval')
            AND ($4::boolean = TRUE OR owner_id = $3)
          RETURNING id, owner_id`,
        [req.params.taskId, context.tenant.tenantId, context.session.id, canManageTenant]
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return jsonError(res, 404, 'Cancellable task not found in this workspace.');
      }
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'cancelled', 'queue', 'cancelled', $4, $5::jsonb)`,
        [req.params.taskId, context.tenant.tenantId, result.rows[0].owner_id, 'Task cancelled before execution.', JSON.stringify({ cancelledBy: context.session.id })]
      );
      await client.query('COMMIT');
      return res.json({ taskId: req.params.taskId, status: 'cancelled' });
    } catch {
      try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
      return jsonError(res, 503, 'Task cancellation could not be recorded.');
    } finally {
      client.release();
    }
  });

  return router;
}
