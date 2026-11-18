-- Add tenant ownership to the durable agent task queue.
-- Legacy rows that cannot be mapped to exactly one active tenant remain NULL.
-- Queue APIs/workers must reject NULL tenant_id and always scope by tenant_id.

BEGIN;

ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS tenant_id UUID
  REFERENCES app_tenants(id) ON DELETE RESTRICT;

WITH single_active_membership AS (
  SELECT m.user_id, MIN(m.tenant_id::text)::uuid AS tenant_id
    FROM app_tenant_memberships m
    JOIN app_tenants t ON t.id = m.tenant_id
   WHERE m.status = 'active' AND t.status = 'active'
   GROUP BY m.user_id
  HAVING COUNT(*) = 1
)
UPDATE agent_tasks task
   SET tenant_id = membership.tenant_id
  FROM single_active_membership membership
 WHERE task.tenant_id IS NULL
   AND task.owner_id = membership.user_id::text;

ALTER TABLE agent_task_events
  ADD COLUMN IF NOT EXISTS tenant_id UUID
  REFERENCES app_tenants(id) ON DELETE RESTRICT;

UPDATE agent_task_events event
   SET tenant_id = task.tenant_id
  FROM agent_tasks task
 WHERE event.tenant_id IS NULL
   AND event.task_id = task.id
   AND task.tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_tasks_tenant_history_idx
  ON agent_tasks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_tasks_tenant_ready_idx
  ON agent_tasks (tenant_id, priority ASC, available_at ASC, created_at ASC)
  WHERE status IN ('queued', 'retry_wait');

CREATE INDEX IF NOT EXISTS agent_task_events_tenant_history_idx
  ON agent_task_events (tenant_id, created_at DESC);

COMMENT ON COLUMN agent_tasks.tenant_id IS
  'Tenant workspace owner. NULL legacy tasks are not eligible for tenant-scoped reads, claims, retries or execution until explicitly reconciled.';
COMMENT ON COLUMN agent_task_events.tenant_id IS
  'Tenant workspace copied from the parent task. NULL legacy events must remain inaccessible to tenant-scoped history queries.';

COMMIT;
