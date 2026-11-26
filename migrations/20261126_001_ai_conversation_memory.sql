-- Durable, tenant-isolated conversational memory for contextual AI guidance.
-- Only sanitized user/assistant text and bounded non-sensitive context are stored.
BEGIN;

CREATE TABLE IF NOT EXISTS ai_conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_memory_owner_tenant_fk
    FOREIGN KEY (tenant_id, owner_id)
    REFERENCES app_tenants (id, owner_user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ai_memory_tenant_recent_idx
  ON ai_conversation_memory (owner_id, tenant_id, created_at DESC);

ALTER TABLE ai_conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_memory FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_memory_owner_tenant_isolation ON ai_conversation_memory;
CREATE POLICY ai_memory_owner_tenant_isolation ON ai_conversation_memory
  USING (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON TABLE ai_conversation_memory IS
  'Sanitized conversation turns for tenant-specific AI context; never store credentials, OTPs, or secrets.';
COMMIT;
