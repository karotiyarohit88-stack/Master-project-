-- Master Project AI Agent: email OTP challenge storage.
-- REVIEW ONLY: this file is intentionally NOT executed by this change.
-- Apply only through a separately approved database change after review.
BEGIN;

CREATE TABLE IF NOT EXISTS app_email_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_token_hash CHAR(64) NOT NULL UNIQUE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL
    CHECK (purpose IN ('login', 'bootstrap_owner', 'invitation')),
  otp_hash CHAR(64) NOT NULL,
  pending_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES app_invitations(id) ON DELETE CASCADE,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  max_attempts SMALLINT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  resend_after TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  CONSTRAINT app_email_otp_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT app_email_otp_resend_after_creation CHECK (resend_after >= created_at)
);

CREATE INDEX IF NOT EXISTS app_email_otp_email_pending_idx
  ON app_email_otp_challenges (lower(trim(email)), purpose, created_at DESC)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS app_email_otp_expiry_idx
  ON app_email_otp_challenges (expires_at)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

COMMENT ON TABLE app_email_otp_challenges IS
  'Short-lived, single-use email verification challenges. Store only OTP digests and opaque challenge-token digests; never store or log plaintext OTPs.';

COMMIT;
