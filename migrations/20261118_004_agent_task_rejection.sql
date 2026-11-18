-- Add an explicit rejected terminal state for human approval decisions.
-- This is an additive, forward-only schema change. Do not apply to production
-- until the database migration window is explicitly approved.

BEGIN;

ALTER TABLE agent_tasks
  DROP CONSTRAINT IF EXISTS agent_tasks_status_check;

ALTER TABLE agent_tasks
  ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN (
    'queued', 'running', 'waiting_approval', 'retry_wait',
    'completed', 'failed', 'cancelled', 'rejected'
  ));

COMMENT ON COLUMN agent_tasks.status IS
  'Lifecycle state; rejected means a tenant Owner/Admin explicitly declined a task before execution.';

COMMIT;
