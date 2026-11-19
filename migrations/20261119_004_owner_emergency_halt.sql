-- Durable Owner-scoped emergency halt state.
-- Missing state is treated as unavailable and blocks AI/agent execution.

BEGIN;

CREATE TABLE IF NOT EXISTS owner_emergency_halt (
  owner_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  halted BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT owner_emergency_halt_reason_length CHECK (length(reason) <= 500)
);

-- Existing Owner accounts receive a durable, initially inactive switch.
-- Backfill before enabling FORCE RLS; application reads/writes remain RLS-scoped.
INSERT INTO owner_emergency_halt (owner_id, halted, reason)
SELECT id, FALSE, ''
  FROM app_users
 WHERE role = 'owner'
ON CONFLICT (owner_id) DO NOTHING;

ALTER TABLE owner_emergency_halt ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_emergency_halt FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_emergency_halt_owner_isolation ON owner_emergency_halt;
CREATE POLICY owner_emergency_halt_owner_isolation
  ON owner_emergency_halt
  USING (owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION create_owner_emergency_halt_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  previous_owner_id TEXT;
BEGIN
  IF NEW.role = 'owner' THEN
    previous_owner_id := current_setting('app.owner_id', true);
    PERFORM set_config('app.owner_id', NEW.id::text, true);
    INSERT INTO owner_emergency_halt (owner_id, halted, reason)
    VALUES (NEW.id, FALSE, '')
    ON CONFLICT (owner_id) DO NOTHING;
    PERFORM set_config('app.owner_id', COALESCE(previous_owner_id, ''), true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_create_emergency_halt ON app_users;
CREATE TRIGGER app_users_create_emergency_halt
AFTER INSERT ON app_users
FOR EACH ROW
EXECUTE FUNCTION create_owner_emergency_halt_state();

CREATE INDEX IF NOT EXISTS owner_emergency_halt_updated_at_idx
  ON owner_emergency_halt (updated_at DESC);

COMMENT ON TABLE owner_emergency_halt IS
  'Durable per-Owner emergency halt state. Provider and agent execution must fail closed when state cannot be read.';

COMMIT;
