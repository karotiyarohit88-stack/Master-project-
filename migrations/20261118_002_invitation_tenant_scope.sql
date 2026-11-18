-- Master Project: bind invitations to the inviter's tenant workspace.
-- Additive only: preserve existing invitations and backfill where the creator
-- already has an active tenant membership. Unresolvable legacy invitations
-- remain NULL and must be rejected by tenant-aware acceptance code.

BEGIN;

ALTER TABLE app_invitations
  ADD COLUMN IF NOT EXISTS tenant_id UUID
  REFERENCES app_tenants(id) ON DELETE RESTRICT;

UPDATE app_invitations i
   SET tenant_id = membership.tenant_id
  FROM app_tenant_memberships membership
  JOIN app_tenants tenant
    ON tenant.id = membership.tenant_id
   AND tenant.status = 'active'
 WHERE i.tenant_id IS NULL
   AND i.created_by = membership.user_id
   AND membership.status = 'active'
   AND membership.membership_role IN ('owner', 'admin');

CREATE INDEX IF NOT EXISTS app_invitations_tenant_pending_idx
  ON app_invitations (tenant_id, expires_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON COLUMN app_invitations.tenant_id IS
  'Tenant workspace the invitation grants access to. Must be derived from the authenticated inviter membership, never from request input. NULL legacy rows must fail closed during tenant-aware acceptance.';

COMMIT;
