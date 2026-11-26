import { randomUUID } from 'node:crypto';
import { getPostgresPool } from '../database.ts';

type Result = { rows: any[] };
export type TenantKnowledgeClient = { query: (sql: string, values?: unknown[]) => Promise<Result>; release: () => void };
export type TenantKnowledgePool = { connect: () => Promise<TenantKnowledgeClient> };
export type TenantKnowledgeDocument = {
  id: string;
  title: string;
  source: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function poolFor(override?: TenantKnowledgePool | null): TenantKnowledgePool | null {
  return override === undefined ? getPostgresPool() as unknown as TenantKnowledgePool | null : override;
}

async function inTenant<T>(pool: TenantKnowledgePool, ownerId: string, tenantId: string, run: (client: TenantKnowledgeClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.owner_id', $1, true), set_config('app.tenant_id', $2, true)", [ownerId, tenantId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

function assertIdentity(ownerId: string, tenantId: string) {
  if (!ownerId || !tenantId) throw new Error('Authenticated Owner and tenant identity are required.');
}

export async function createTenantKnowledgeDocument(
  ownerId: string,
  tenantId: string,
  title: string,
  content: string,
  source = 'owner_supplied',
  poolOverride?: TenantKnowledgePool | null
): Promise<TenantKnowledgeDocument> {
  assertIdentity(ownerId, tenantId);
  if (!title.trim() || title.length > 200 || !content.trim() || Buffer.byteLength(content, 'utf8') > 100_000 || source.length > 300) {
    throw new Error('Knowledge document title, content, or source exceeds its allowed limit.');
  }
  const pool = poolFor(poolOverride);
  if (!pool) throw new Error('Tenant knowledge storage is unavailable.');
  const id = randomUUID();
  return inTenant(pool, ownerId, tenantId, async client => {
    const result = await client.query(
      'INSERT INTO tenant_knowledge_documents (id, owner_id, tenant_id, title, source, content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, source, content, created_at, updated_at',
      [id, ownerId, tenantId, title.trim(), source.trim() || 'owner_supplied', content]
    );
    const row = result.rows[0];
    return { id: row.id, title: row.title, source: row.source, content: row.content, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
  });
}

export async function listTenantKnowledgeDocuments(
  ownerId: string,
  tenantId: string,
  limit = 50,
  poolOverride?: TenantKnowledgePool | null
): Promise<Array<Omit<TenantKnowledgeDocument, 'content'>>> {
  assertIdentity(ownerId, tenantId);
  const pool = poolFor(poolOverride);
  if (!pool) throw new Error('Tenant knowledge storage is unavailable.');
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return inTenant(pool, ownerId, tenantId, async client => {
    const result = await client.query(
      'SELECT id, title, source, created_at, updated_at FROM tenant_knowledge_documents WHERE owner_id = $1 AND tenant_id = $2 ORDER BY updated_at DESC LIMIT $3',
      [ownerId, tenantId, safeLimit]
    );
    return result.rows.map(row => ({ id: row.id, title: row.title, source: row.source, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() }));
  });
}

export async function searchTenantKnowledgeDocuments(
  ownerId: string,
  tenantId: string,
  query: string,
  limit = 5,
  poolOverride?: TenantKnowledgePool | null
): Promise<Array<{ id: string; title: string; source: string; content: string; rank: number }>> {
  assertIdentity(ownerId, tenantId);
  if (!query.trim() || query.length > 500) return [];
  const pool = poolFor(poolOverride);
  if (!pool) throw new Error('Tenant knowledge storage is unavailable.');
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  return inTenant(pool, ownerId, tenantId, async client => {
    const result = await client.query(
      "SELECT id, title, source, left(content, 12000) AS content, ts_rank(search_vector, plainto_tsquery('simple', $3)) AS rank FROM tenant_knowledge_documents WHERE owner_id = $1 AND tenant_id = $2 AND search_vector @@ plainto_tsquery('simple', $3) ORDER BY rank DESC, updated_at DESC LIMIT $4",
      [ownerId, tenantId, query, safeLimit]
    );
    return result.rows.map(row => ({ id: row.id, title: row.title, source: row.source, content: row.content, rank: Number(row.rank) || 0 }));
  });
}

export async function deleteTenantKnowledgeDocument(
  ownerId: string,
  tenantId: string,
  id: string,
  poolOverride?: TenantKnowledgePool | null
): Promise<boolean> {
  assertIdentity(ownerId, tenantId);
  const pool = poolFor(poolOverride);
  if (!pool) throw new Error('Tenant knowledge storage is unavailable.');
  return inTenant(pool, ownerId, tenantId, async client => {
    const result = await client.query(
      'DELETE FROM tenant_knowledge_documents WHERE id = $1 AND owner_id = $2 AND tenant_id = $3 RETURNING id',
      [id, ownerId, tenantId]
    );
    return result.rows.length > 0;
  });
}
