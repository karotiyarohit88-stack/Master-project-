CREATE TABLE IF NOT EXISTS app_secrets (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  provider TEXT NOT NULL DEFAULT 'custom' CHECK (length(provider) BETWEEN 1 AND 40),
  masked_preview TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS app_secrets_owner_active_idx
  ON app_secrets (owner_id, created_at DESC)
  WHERE revoked_at IS NULL;
