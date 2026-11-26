-- Bind encrypted provider credentials to the authenticated Owner's active tenant.
-- Existing Owner accounts have one initial tenant; unresolved rows abort safely.

BEGIN;

ALTER TABLE app_secrets ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE app_secrets s
   SET tenant_id = t.id
  FROM app_tenants t
 WHERE t.owner_user_id = s.owner_id
   AND s.tenant_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_secrets WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot tenant-scope app_secrets: one or more Owner secrets have no matching tenant.';
  END IF;
END;
$$;

ALTER TABLE app_secrets ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'app_secrets_owner_tenant_fk'
       AND conrelid = 'app_secrets'::regclass
  ) THEN
    ALTER TABLE app_secrets
      ADD CONSTRAINT app_secrets_owner_tenant_fk
      FOREIGN KEY (tenant_id, owner_id)
      REFERENCES app_tenants (id, owner_user_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS app_secrets_owner_tenant_active_idx
  ON app_secrets (owner_id, tenant_id, created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_secrets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_secrets_owner_tenant_isolation ON app_secrets;
CREATE POLICY app_secrets_owner_tenant_isolation
  ON app_secrets
  USING (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON TABLE app_secrets IS
  'AES-256-GCM encrypted credentials isolated by authenticated Owner and active tenant.';

COMMIT;
