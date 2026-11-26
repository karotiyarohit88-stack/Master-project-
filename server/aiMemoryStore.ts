import { randomUUID } from 'node:crypto';
import { getPostgresPool } from '../database.ts';

type QueryResult = { rows: any[] };
export type MemoryClient = { query: (sql: string, values?: unknown[]) => Promise<QueryResult>; release: () => void };
export type MemoryPool = { connect: () => Promise<MemoryClient> };
export type ConversationMemoryTurn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context: Record<string, unknown>;
  createdAt: string;
};

function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\b(?:password|passwd|api[_ -]?key|secret|access[_ -]?token|refresh[_ -]?token|otp)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[REDACTED_SECRET]')
    .slice(0, maxLength);
}

function poolFor(override?: MemoryPool | null): MemoryPool | null {
  return override === undefined ? getPostgresPool() as unknown as MemoryPool | null : override;
}

async function withTenant<T>(pool: MemoryPool, ownerId: string, tenantId: string, run: (client: MemoryClient) => Promise<T>): Promise<T> {
  if (!ownerId || !tenantId) throw new Error('Authenticated Owner and tenant identity are required.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.owner_id', $1, true), set_config('app.tenant_id', $2, true)", [ownerId, tenantId]);
    const value = await run(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* retain original error */ }
    throw error;
  } finally { client.release(); }
}

export async function saveConversationTurn(
  ownerId: string,
  tenantId: string,
  role: 'user' | 'assistant',
  content: string,
  context: Record<string, unknown> = {},
  poolOverride?: MemoryPool | null
): Promise<ConversationMemoryTurn> {
  const text = safeText(content, 4000).trim();
  if (!text) throw new Error('Conversation content is empty after safety filtering.');
  const pool = poolFor(poolOverride);
  if (!pool) throw new Error('Persistent AI memory database is unavailable.');
  const id = randomUUID();
  const safeContext = {
    page: safeText(context.page, 160),
    language: safeText(context.language, 20),
    questionType: safeText(context.questionType, 40)
  };
  return withTenant(pool, ownerId, tenantId, async client => {
    const result = await client.query(
      'INSERT INTO ai_conversation_memory (id, owner_id, tenant_id, role, content, context) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id, role, content, context, created_at',
      [id, ownerId, tenantId, role, text, JSON.stringify(safeContext)]
    );
    const row = result.rows[0];
    return { id: row.id, role: row.role, content: row.content, context: row.context || {}, createdAt: new Date(row.created_at).toISOString() };
  });
}

export async function getRecentConversationMemory(
  ownerId: string,
  tenantId: string,
  limit = 12,
  poolOverride?: MemoryPool | null
): Promise<ConversationMemoryTurn[]> {
  const pool = poolFor(poolOverride);
  if (!pool) throw new Error('Persistent AI memory database is unavailable.');
  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit)));
  return withTenant(pool, ownerId, tenantId, async client => {
    const result = await client.query(
      'SELECT id, role, content, context, created_at FROM ai_conversation_memory WHERE owner_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3',
      [ownerId, tenantId, safeLimit]
    );
    return result.rows.reverse().map(row => ({
      id: row.id, role: row.role, content: row.content, context: row.context || {},
      createdAt: new Date(row.created_at).toISOString()
    }));
  });
}
