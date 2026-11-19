-- Durable Owner-scoped audit history.
-- Operational events are written only with the authenticated tenant Owner identity.
-- Legacy RAM-only/demo events are intentionally not assigned to a customer Owner.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS app_tenants_id_owner_pair_idx
  ON app_tenants (id, owner_user_id);

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL CHECK (category IN ('security', 'approval', 'webhook', 'autopilot', 'publishing', 'video', 'chat', 'github')),
  action TEXT NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 300),
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error', 'blocked', 'info')),
  details TEXT NOT NULL DEFAULT '',
  execution_hash TEXT,
  ip TEXT,
  CONSTRAINT owner_audit_logs_tenant_owner_fk
    FOREIGN KEY (tenant_id, owner_id)
    REFERENCES app_tenants (id, owner_user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS owner_audit_logs_owner_history_idx
  ON owner_audit_logs (owner_id, tenant_id, occurred_at DESC);

ALTER TABLE owner_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_audit_logs_owner_isolation ON owner_audit_logs;
CREATE POLICY owner_audit_logs_owner_isolation
  ON owner_audit_logs
  USING (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON TABLE owner_audit_logs IS
  'Append-only audit history isolated by Owner and tenant. Every application read includes owner_id and tenant_id predicates.';

COMMIT;
