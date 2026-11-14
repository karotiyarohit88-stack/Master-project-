-- Master Project AI Agent: application identity and secure session foundation
-- PostgreSQL migration. Apply only after DATABASE_URL connectivity is genuinely verified.
-- This migration does not enable public registration or authentication routes by itself.
-- Keep auth endpoints disabled until password hashing, cookie/session validation,
-- CSRF checks, rate limits, owner-scoped authorization, and bootstrap controls are tested.

BEGIN;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'suspended')),
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT app_users_email_nonempty CHECK (length(trim(email)) > 3),
  CONSTRAINT app_users_password_hash_nonempty CHECK (length(password_hash) >= 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_normalized_idx
  ON app_users (lower(trim(email)));

CREATE INDEX IF NOT EXISTS app_users_status_role_idx
  ON app_users (status, role);

CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_fingerprint CHAR(64),
  CONSTRAINT app_sessions_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS app_sessions_user_active_idx
  ON app_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS app_sessions_expiry_cleanup_idx
  ON app_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS app_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member')),
  invite_token_hash CHAR(64) NOT NULL UNIQUE,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT app_invitations_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS app_invitations_email_pending_idx
  ON app_invitations (lower(trim(email)), expires_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS app_invitations_expiry_cleanup_idx
  ON app_invitations (expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE app_users IS
  'Application identities. Passwords must be stored only as strong password hashes, never plaintext.';
COMMENT ON TABLE app_sessions IS
  'Opaque server-side sessions; only SHA-256 token digests are stored. Enforce HttpOnly, Secure, SameSite cookies and CSRF validation in application code.';
COMMENT ON TABLE app_invitations IS
  'Invite-only account provisioning foundation; public self-registration is intentionally not enabled.';
COMMENT ON COLUMN app_users.role IS
  'Authorization role. The owner role must be provisioned through a controlled out-of-band bootstrap, never public registration.';
COMMENT ON COLUMN app_sessions.csrf_token_hash IS
  'Digest of the session-bound CSRF token required for state-changing browser requests.';

COMMIT;
