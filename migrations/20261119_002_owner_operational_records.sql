-- Generic durable records for Owner-scoped operational modules.
-- Each record is keyed by Owner, tenant, record type, and application record ID.

BEGIN;

CREATE TABLE IF NOT EXISTS owner_operational_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'video_job',
    'autopilot_task',
    'autopilot_workflow',
    'workflow_execution',
    'publishing_post',
    'sheets_sync_record',
    'change_proposal',
    'worker_agent',
    'payout_request',
    'verified_earning'
  )),
  record_id TEXT NOT NULL CHECK (length(trim(record_id)) BETWEEN 1 AND 200),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT owner_operational_records_owner_tenant_fk
    FOREIGN KEY (tenant_id, owner_id)
    REFERENCES app_tenants (id, owner_user_id)
    ON DELETE CASCADE,
  CONSTRAINT owner_operational_records_owner_key_unique
    UNIQUE (owner_id, tenant_id, record_type, record_id)
);

CREATE INDEX IF NOT EXISTS owner_operational_records_owner_type_idx
  ON owner_operational_records (owner_id, tenant_id, record_type, updated_at DESC);

ALTER TABLE owner_operational_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_operational_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_operational_records_owner_isolation ON owner_operational_records;
CREATE POLICY owner_operational_records_owner_isolation
  ON owner_operational_records
  USING (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON TABLE owner_operational_records IS
  'JSONB operational records partitioned by Owner, tenant, and record type. Application SQL must always include owner_id and tenant_id predicates.';

COMMIT;
