-- Tenant-scoped RAG knowledge documents using PostgreSQL full-text retrieval.
-- No vector extension, external data, or cross-tenant shared corpus is required.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  source TEXT NOT NULL DEFAULT 'owner_supplied' CHECK (length(source) <= 300),
  content TEXT NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 100000),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', COALESCE(title, '') || ' ' || content)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_knowledge_owner_tenant_fk
    FOREIGN KEY (tenant_id, owner_id)
    REFERENCES app_tenants (id, owner_user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tenant_knowledge_owner_tenant_idx
  ON tenant_knowledge_documents (owner_id, tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS tenant_knowledge_search_vector_idx
  ON tenant_knowledge_documents USING GIN (search_vector);

ALTER TABLE tenant_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_knowledge_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_knowledge_owner_isolation ON tenant_knowledge_documents;
CREATE POLICY tenant_knowledge_owner_isolation
  ON tenant_knowledge_documents
  USING (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    owner_id = NULLIF(current_setting('app.owner_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON TABLE tenant_knowledge_documents IS
  'Owner-managed tenant-specific RAG corpus. Search and reads must always filter by owner_id and tenant_id.';

COMMIT;
