import { Router, type Request, type Response } from 'express';
import { getPostgresPool } from '../database.ts';
import type { TenantContext } from '../auth.ts';
import { getPostgresMigrationStatus } from '../database.ts';

type DbClient = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>; release: () => void };
type DbPool = DbClient & { connect: () => Promise<DbClient> };
type Identity = { ownerId: string; tenantId: string; role: string };

function identity(res: Response): Identity | null {
  const session = res.locals.authSession as { id?: string } | undefined;
  const tenant = res.locals.tenantContext as TenantContext | undefined;
  return session?.id && tenant?.tenantId ? { ownerId: session.id, tenantId: tenant.tenantId, role: tenant.role } : null;
}
function error(res: Response, status: number, message: string) { return res.status(status).json({ error: message }); }
function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; } catch { return false; }
}

export function createSchedulesRouter(options: { pool?: DbPool | null } = {}) {
  const router = Router();
  const pool = options.pool === undefined ? getPostgresPool() as unknown as DbPool | null : options.pool;

  router.get('/', async (_req, res) => {
    const who = identity(res);
    if (!who) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Schedule database is unavailable.');
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.owner_id',$1,true), set_config('app.tenant_id',$2,true)", [who.ownerId, who.tenantId]);
        const rows = await client.query(
          `SELECT id,title,task_type,original_prompt,recurrence_type,timezone,daily_time,interval_minutes,next_run_at,enabled,last_run_at,last_task_id,created_at
             FROM agent_schedules WHERE tenant_id=$1 AND owner_id=$2 ORDER BY created_at DESC LIMIT 100`,
          [who.tenantId, who.ownerId]
        );
        await client.query('COMMIT');
        return res.json({ schedules: rows.rows });
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    } catch { return error(res, 503, 'Schedules could not be loaded. Confirm the schedule migration is applied.'); }
  });

  router.post('/', async (req, res) => {
    const who = identity(res);
    if (!who) return error(res, 401, 'Authenticated tenant context is required.');
    if (who.role !== 'owner') return error(res, 403, 'Only the tenant Owner can create recurring schedules.');
    if (!pool) return error(res, 503, 'Schedule database is unavailable.');
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const recurrence = req.body?.recurrenceType;
    const taskType = req.body?.taskType === 'research' ? 'research' : 'read_only';
    const taskPayload = taskType === 'research' ? { action: 'research' } : { action: 'read_project_status' };
    const timezone = req.body?.timezone || 'Asia/Kolkata';
    if (!title || title.length > 160 || !prompt || prompt.length > 4000) return error(res, 400, 'Title and prompt are required and must be within limits.');
    if (!validTimezone(timezone)) return error(res, 400, 'A valid IANA timezone is required.');
    if (recurrence === 'daily') {
      if (typeof req.body?.dailyTime !== 'string' || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(req.body.dailyTime)) return error(res, 400, 'dailyTime must use HH:mm.');
    } else if (recurrence === 'interval') {
      if (!Number.isInteger(req.body?.intervalMinutes) || req.body.intervalMinutes < 15 || req.body.intervalMinutes > 10080) return error(res, 400, 'intervalMinutes must be between 15 and 10080.');
    } else return error(res, 400, 'recurrenceType must be daily or interval.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.owner_id',$1,true), set_config('app.tenant_id',$2,true)", [who.ownerId, who.tenantId]);
      const result = await client.query(
        `INSERT INTO agent_schedules
          (tenant_id,owner_id,title,task_type,original_prompt,payload,recurrence_type,timezone,daily_time,interval_minutes,next_run_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::time,$10,
           CASE WHEN $7='interval' THEN NOW() + ($10::text || ' minutes')::interval
           ELSE
             CASE WHEN ((date_trunc('day', NOW() AT TIME ZONE $8)::date + $9::time) AT TIME ZONE $8) > NOW()
               THEN ((date_trunc('day', NOW() AT TIME ZONE $8)::date + $9::time) AT TIME ZONE $8)
               ELSE ((date_trunc('day', NOW() AT TIME ZONE $8)::date + 1 + $9::time) AT TIME ZONE $8)
             END
           END)
         RETURNING id,title,task_type,original_prompt,recurrence_type,timezone,daily_time,interval_minutes,next_run_at,enabled,created_at`,
        [who.tenantId, who.ownerId, title, taskType, prompt, JSON.stringify(taskPayload), recurrence, timezone, recurrence === 'daily' ? req.body.dailyTime : null, recurrence === 'interval' ? req.body.intervalMinutes : null]
      );
      await client.query('COMMIT');
      return res.status(201).json({ schedule: result.rows[0], automaticAction: taskType, approval: taskType === 'research' ? 'Each research run waits for a separate Owner/Admin approval before external search or Gemini API use.' : 'Schedule creation authorizes only the fixed read-only project-status action.' });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original */ }
      return error(res, 503, 'Schedule could not be saved. Confirm the schedule migration is applied.');
    } finally { client.release(); }
  });

  router.patch('/:id', async (req, res) => {
    const who = identity(res);
    if (!who) return error(res, 401, 'Authenticated tenant context is required.');
    if (who.role !== 'owner') return error(res, 403, 'Only the tenant Owner can change recurring schedules.');
    if (!pool) return error(res, 503, 'Schedule database is unavailable.');
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || typeof req.body?.enabled !== 'boolean') return error(res, 400, 'A valid schedule ID and boolean enabled value are required.');
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.owner_id',$1,true), set_config('app.tenant_id',$2,true)", [who.ownerId, who.tenantId]);
        const result = await client.query(
          `UPDATE agent_schedules SET enabled=$3, updated_at=NOW()
            WHERE id=$1 AND tenant_id=$2 AND owner_id=$4 RETURNING id,enabled,next_run_at`,
          [req.params.id, who.tenantId, req.body.enabled, who.ownerId]
        );
        await client.query('COMMIT');
        if (!result.rows[0]) return error(res, 404, 'Schedule not found in this workspace.');
        return res.json({ schedule: result.rows[0] });
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    } catch { return error(res, 503, 'Schedule could not be updated.'); }
  });

  router.delete('/:id', async (req, res) => {
    const who = identity(res);
    if (!who) return error(res, 401, 'Authenticated tenant context is required.');
    if (who.role !== 'owner') return error(res, 403, 'Only the tenant Owner can delete recurring schedules.');
    if (!pool) return error(res, 503, 'Schedule database is unavailable.');
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.owner_id',$1,true), set_config('app.tenant_id',$2,true)", [who.ownerId, who.tenantId]);
        const result = await client.query('DELETE FROM agent_schedules WHERE id=$1 AND tenant_id=$2 AND owner_id=$3 RETURNING id', [req.params.id, who.tenantId, who.ownerId]);
        await client.query('COMMIT');
        return result.rows[0] ? res.json({ deleted: true }) : error(res, 404, 'Schedule not found in this workspace.');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    } catch { return error(res, 503, 'Schedule could not be deleted.'); }
  });
  return router;
}

export async function dispatchDueSchedules(options: { pool?: DbPool | null; limit?: number } = {}): Promise<number> {
  const pool = options.pool === undefined ? getPostgresPool() as unknown as DbPool | null : options.pool;
  if (!pool) throw new Error('Schedule worker requires PostgreSQL.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.worker_mode','true',true)");
    const due = await client.query(
      `SELECT id,tenant_id,owner_id,title,task_type,original_prompt,payload,recurrence_type,timezone,daily_time,interval_minutes,next_run_at
         FROM agent_schedules
        WHERE enabled=TRUE AND next_run_at <= NOW()
        ORDER BY next_run_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1`,
      [Math.min(Math.max(options.limit || 20, 1), 100)]
    );
    for (const schedule of due.rows) {
      const runKey = `schedule:${schedule.id}:${new Date(schedule.next_run_at).toISOString()}`;
      const task = await client.query(
        `INSERT INTO agent_tasks
          (tenant_id,owner_id,idempotency_key,task_type,original_prompt,payload,status,requires_approval,priority)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,
           CASE WHEN $4='research' THEN 'waiting_approval' ELSE 'queued' END,
           ($4='research'),50)
         ON CONFLICT (owner_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [schedule.tenant_id, schedule.owner_id, runKey, schedule.task_type, schedule.original_prompt, JSON.stringify(schedule.payload)]
      );
      const taskId = task.rows[0]?.id || (await client.query('SELECT id FROM agent_tasks WHERE owner_id=$1 AND tenant_id=$2 AND idempotency_key=$3', [schedule.owner_id,schedule.tenant_id,runKey])).rows[0]?.id;
      if (!taskId) throw new Error('Could not persist scheduled task.');
      await client.query(
        `INSERT INTO agent_task_events (task_id,tenant_id,owner_id,event_type,stage,status,message,details)
         VALUES ($1,$2,$3,'scheduled','scheduler',CASE WHEN $4='research' THEN 'waiting_approval' ELSE 'queued' END,CASE WHEN $4='research' THEN 'Scheduled research awaits Owner/Admin approval' ELSE 'Scheduled read-only task queued automatically' END,$5::jsonb)`,
        [taskId,schedule.tenant_id,schedule.owner_id,schedule.task_type,JSON.stringify({ scheduleId: schedule.id })]
      );
      await client.query(
        `UPDATE agent_schedules SET last_run_at=NOW(),last_task_id=$2,updated_at=NOW(),
          next_run_at=CASE WHEN recurrence_type='interval'
            THEN NOW() + (interval_minutes::text || ' minutes')::interval
            ELSE
              CASE WHEN ((date_trunc('day', NOW() AT TIME ZONE timezone)::date + daily_time) AT TIME ZONE timezone) > NOW()
                THEN ((date_trunc('day', NOW() AT TIME ZONE timezone)::date + daily_time) AT TIME ZONE timezone)
                ELSE ((date_trunc('day', NOW() AT TIME ZONE timezone)::date + 1 + daily_time) AT TIME ZONE timezone)
              END
          END
          WHERE id=$1`,
        [schedule.id,taskId]
      );
    }
    await client.query('COMMIT');
    return due.rows.length;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original */ }
    throw error;
  } finally { client.release(); }
}

let schedulerStopping = false;
export function requestScheduleWorkerStop() { schedulerStopping = true; }
export async function runScheduleWorker(options: { pollIntervalMs?: number; shouldStop?: () => boolean } = {}): Promise<void> {
  if (process.env.MASTER_PROJECT_WORKER_ENABLED !== 'true') throw new Error('Schedule worker disabled; set MASTER_PROJECT_WORKER_ENABLED=true in the dedicated worker service.');
  schedulerStopping = false;
  const migrationStatus = await getPostgresMigrationStatus();
  if (!migrationStatus.migrationTableExists || !migrationStatus.appliedMigrations.includes('20261125_001_agent_schedules.sql')) throw new Error('Schedule worker blocked: schedule migration is not confirmed as applied.');
  const poll = Math.min(Math.max(options.pollIntervalMs ?? 15000, 1000), 60000);
  const shouldStop = options.shouldStop ?? (() => schedulerStopping);
  while (!shouldStop()) {
    try { await dispatchDueSchedules(); }
    catch { /* No credentials, prompts, or raw database errors are logged. */ }
    await new Promise(resolve => setTimeout(resolve, poll));
  }
}
