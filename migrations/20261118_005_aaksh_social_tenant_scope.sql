-- AAKSH Social workspace: tenant-scoped PostgreSQL persistence.
-- New shared-platform records only; legacy JSON feed files are not imported here.

BEGIN;

CREATE TABLE IF NOT EXISTS aaksh_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES app_tenants(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS aaksh_social_posts_tenant_feed_idx
  ON aaksh_social_posts (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS aaksh_social_likes (
  tenant_id UUID NOT NULL REFERENCES app_tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES aaksh_social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, post_id, user_id),
  CONSTRAINT aaksh_social_likes_post_tenant_fk
    FOREIGN KEY (post_id, tenant_id)
    REFERENCES aaksh_social_posts(id, tenant_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aaksh_social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES app_tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  author_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aaksh_social_comments_post_tenant_fk
    FOREIGN KEY (post_id, tenant_id)
    REFERENCES aaksh_social_posts(id, tenant_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS aaksh_social_posts_id_tenant_idx
  ON aaksh_social_posts (id, tenant_id);

CREATE INDEX IF NOT EXISTS aaksh_social_likes_post_idx
  ON aaksh_social_likes (tenant_id, post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS aaksh_social_comments_post_idx
  ON aaksh_social_comments (tenant_id, post_id, created_at ASC);

COMMENT ON TABLE aaksh_social_posts IS
  'AAKSH social workspace posts stored in the canonical Master Project PostgreSQL database and isolated by tenant_id.';
COMMENT ON TABLE aaksh_social_likes IS
  'Tenant-scoped likes; a user can like a post only inside the post tenant.';
COMMENT ON TABLE aaksh_social_comments IS
  'Tenant-scoped comments; composite foreign key prevents cross-tenant post references.';

COMMIT;
