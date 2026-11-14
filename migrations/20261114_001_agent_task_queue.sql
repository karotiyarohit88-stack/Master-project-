-- Master Project AI Agent: durable task queue foundation
-- PostgreSQL migration. Apply only after a managed PostgreSQL database is provisioned.
-- API routes and workers must remain disabled until application authentication,
-- per-user authorization, and database connection verification are implemented.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  idempotency_key TEXT,
  task_type TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  normalized_task TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'waiting_approval', 'retry_wait', 'completed', 'failed', 'cancelled')),
  priority SMALLINT NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  result JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT agent_tasks_approval_consistency CHECK (
    (status <> 'waiting_approval')
    OR requires_approval
  ),
  CONSTRAINT agent_tasks_lease_consistency CHECK (
    (status <> 'running')
    OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_tasks_owner_idempotency_idx
  ON agent_tasks (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_tasks_ready_idx
  ON agent_tasks (priority ASC, available_at ASC, created_at ASC)
  WHERE status IN ('queued', 'retry_wait');

CREATE INDEX IF NOT EXISTS agent_tasks_expired_lease_idx
  ON agent_tasks (lease_expires_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS agent_tasks_owner_history_idx
  ON agent_tasks (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_task_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  stage TEXT,
  status TEXT,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_task_events_task_history_idx
  ON agent_task_events (task_id, created_at ASC);

CREATE INDEX IF NOT EXISTS agent_task_events_owner_history_idx
  ON agent_task_events (owner_id, created_at DESC);

COMMENT ON TABLE agent_tasks IS
  'Durable queue for authenticated Master Project AI Agent tasks. Do not expose through API until owner authorization is enforced.';
COMMENT ON TABLE agent_task_events IS
  'Append-only workflow stage and notification history, scoped by owner_id in application authorization.';
COMMENT ON COLUMN agent_tasks.original_prompt IS
  'Immutable user wording retained separately from normalized_task to preserve original intent.';
COMMENT ON COLUMN agent_tasks.lease_expires_at IS
  'Worker lease deadline; expired running tasks may be safely reclaimed by a future worker implementation.';
COMMENT ON COLUMN agent_tasks.requires_approval IS
  'Consequential work must remain blocked until an authenticated human approval is recorded.';

COMMIT;
