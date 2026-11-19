-- Master Project: tenant identity and membership foundation.
-- Forward-only additive migration. Existing operational data is not rewritten.
-- Application routes must not claim tenant isolation until they resolve the
-- active tenant from the authenticated session and scope every query by it.

BEGIN;

CREATE TABLE IF NOT EXISTS app_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  owner_user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_tenants_display_name_nonempty CHECK (length(trim(display_name)) > 0)
);

CREATE TABLE IF NOT EXISTS app_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES app_tenants(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL DEFAULT 'member'
    CHECK (membership_role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS app_tenant_memberships_user_active_idx
  ON app_tenant_memberships (user_id, tenant_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS app_tenant_memberships_tenant_active_idx
  ON app_tenant_memberships (tenant_id, membership_role)
  WHERE status = 'active';

-- Give each already-provisioned Owner a separate initial tenant.
-- This is idempotent and does not merge customer accounts or move operational data.
WITH owner_users AS (
  SELECT id, display_name, email
  FROM app_users
  WHERE role = 'owner'
),
created_tenants AS (
  INSERT INTO app_tenants (display_name, owner_user_id)
  SELECT COALESCE(NULLIF(trim(u.display_name), ''), u.email) || ' Workspace', u.id
  FROM owner_users u
  WHERE NOT EXISTS (
    SELECT 1 FROM app_tenants t WHERE t.owner_user_id = u.id
  )
  ON CONFLICT (owner_user_id) DO NOTHING
  RETURNING id, owner_user_id
)
INSERT INTO app_tenant_memberships (tenant_id, user_id, membership_role)
SELECT t.id, t.owner_user_id, 'owner'
FROM app_tenants t
JOIN owner_users u ON u.id = t.owner_user_id
ON CONFLICT (tenant_id, user_id) DO NOTHING;


COMMENT ON TABLE app_tenants IS
  'Customer workspace boundary. API access must resolve an active membership from the authenticated session.';
COMMENT ON TABLE app_tenant_memberships IS
  'User-to-tenant authorization mapping. Never accept tenant_id from an untrusted request body as proof of access.';
COMMENT ON COLUMN app_tenant_memberships.membership_role IS
  'Tenant-scoped role; distinct from the global application role in app_users.';

COMMIT;
