-- Durable tenant-scoped recurring schedules. A schedule itself is an explicit Owner/Admin authorization.
BEGIN;

CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  task_type TEXT NOT NULL DEFAULT 'read_only' CHECK (task_type = 'read_only'),
  original_prompt TEXT NOT NULL CHECK (length(trim(original_prompt)) BETWEEN 1 AND 4000),
  payload JSONB NOT NULL DEFAULT '{"action":"read_project_status"}'::jsonb
    CHECK (payload = '{"action":"read_project_status"}'::jsonb),
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'interval')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata' CHECK (length(timezone) BETWEEN 1 AND 80),
  daily_time TIME,
  interval_minutes INTEGER,
  next_run_at TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_schedules_owner_tenant_fk FOREIGN KEY (tenant_id, owner_id)
    REFERENCES app_tenants(id, owner_user_id) ON DELETE CASCADE,
  CONSTRAINT agent_schedules_recurrence_fields CHECK (
    (recurrence_type = 'daily' AND daily_time IS NOT NULL AND interval_minutes IS NULL)
    OR
    (recurrence_type = 'interval' AND daily_time IS NULL AND interval_minutes BETWEEN 15 AND 10080)
  )
);

CREATE INDEX IF NOT EXISTS agent_schedules_due_idx
  ON agent_schedules (next_run_at)
  WHERE enabled = TRUE;

ALTER TABLE agent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_schedules_owner_isolation ON agent_schedules;
CREATE POLICY agent_schedules_owner_isolation ON agent_schedules
  USING (
    current_setting('app.worker_mode', true) = 'true'
    OR (current_setting('app.worker_mode', true) = 'true'
    OR (owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid))
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON TABLE agent_schedules IS
  'Recurring schedules. Only the fixed read-only project-status action is eligible for automatic execution until additional handlers are explicitly reviewed and approved.';

COMMIT;
