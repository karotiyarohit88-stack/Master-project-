import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler, Response } from 'express';
import { getPostgresPool } from '../database.ts';

export type OwnerAuditEntry = {
  category: 'security' | 'approval' | 'webhook' | 'autopilot' | 'publishing' | 'video' | 'chat' | 'github';
  action: string;
  status: 'success' | 'warning' | 'error' | 'blocked' | 'info';
  details: string;
  executionHash?: string;
  ip?: string;
};

type AuditQueryResult = { rows: any[] };
type AuditDbClient = {
  query: (sql: string, values?: unknown[]) => Promise<AuditQueryResult>;
  release: () => void;
};
type AuditDbPool = { connect: () => Promise<AuditDbClient> };

type AuditContext = {
  ownerId: string;
  tenantId: string;
  entries: OwnerAuditEntry[];
};

const auditContextStorage = new AsyncLocalStorage<AuditContext>();

function getPool(): AuditDbPool | null {
  return getPostgresPool() as unknown as AuditDbPool | null;
}

export function queueOwnerAuditLog(entry: OwnerAuditEntry): void {
  const context = auditContextStorage.getStore();
  if (!context) throw new Error('Owner audit context is unavailable.');
  context.entries.push({ ...entry });
}

async function withOwnerTransaction<T>(
  pool: AuditDbPool,
  ownerId: string,
  tenantId: string,
  run: (client: AuditDbClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.owner_id', $1, true), set_config('app.tenant_id', $2, true)",
      [ownerId, tenantId]
    );
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original database error */ }
    throw error;
  } finally {
    client.release();
  }
}

async function persistAuditEntries(context: AuditContext, entries: OwnerAuditEntry[]): Promise<void> {
  if (!entries.length) return;
  const pool = getPool();
  if (!pool) throw new Error('Audit database is unavailable.');

  await withOwnerTransaction(pool, context.ownerId, context.tenantId, async (client) => {
    for (const entry of entries) {
      await client.query(
        `INSERT INTO owner_audit_logs
           (owner_id, tenant_id, category, action, status, details, execution_hash, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [context.ownerId, context.tenantId, entry.category, entry.action, entry.status,
          entry.details, entry.executionHash ?? null, entry.ip ?? null]
      );
    }
  });
}

function replaceFailedResponse(res: Response, end: (...args: any[]) => unknown): void {
  res.statusCode = 503;
  res.removeHeader('Content-Length');
  res.removeHeader('ETag');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  end(JSON.stringify({ error: 'Audit persistence is temporarily unavailable.' }));
}

/**
 * Establishes Owner/tenant audit context for each authenticated request.
 * Queued audit entries are committed before the HTTP response is completed.
 */
export function createOwnerAuditMiddleware(): RequestHandler {
  return (req, res, next) => {
    const session = res.locals.authSession as { id?: string } | undefined;
    const tenant = res.locals.tenantContext as { ownerId?: string; tenantId?: string } | undefined;

    if (!session || !tenant?.ownerId || !tenant.tenantId) {
      if (req.path === '/health' || req.path === '/auth' || req.path.startsWith('/auth/')) return next();
      return res.status(403).json({ error: 'Active Owner and tenant context is required.' });
    }

    const context: AuditContext = {
      ownerId: tenant.ownerId,
      tenantId: tenant.tenantId,
      entries: []
    };

    return auditContextStorage.run(context, () => {
      const response = res as typeof res & { end: (...args: any[]) => any };
      const originalEnd = response.end.bind(response);
      let endStarted = false;

      response.end = (...args: any[]) => {
        if (endStarted) return response;
        endStarted = true;

        const flush = async () => {
          while (context.entries.length) {
            const batch = context.entries.splice(0, context.entries.length);
            await persistAuditEntries(context, batch);
          }
        };

        if (!context.entries.length) return originalEnd(...args);

        void flush()
          .then(() => originalEnd(...args))
          .catch(() => replaceFailedResponse(res, originalEnd));
        return response;
      };

      next();
    });
  };
}

export async function listOwnerAuditLogs(
  ownerId: string,
  tenantId: string,
  limit = 250
): Promise<any[]> {
  if (!ownerId || !tenantId) throw new Error('Owner and tenant identity are required.');
  const pool = getPool();
  if (!pool) throw new Error('Audit database is unavailable.');

  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, occurred_at AS timestamp, category, action, status, details,
              execution_hash AS "executionHash", ip
         FROM owner_audit_logs
        WHERE owner_id = $1 AND tenant_id = $2
        ORDER BY occurred_at DESC
        LIMIT $3`,
      [ownerId, tenantId, Math.min(Math.max(Math.trunc(limit), 1), 500)]
    );
    return result.rows;
  });
}

export async function countOwnerAuditLogs(ownerId: string, tenantId: string): Promise<number> {
  if (!ownerId || !tenantId) throw new Error('Owner and tenant identity are required.');
  const pool = getPool();
  if (!pool) throw new Error('Audit database is unavailable.');

  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      'SELECT COUNT(*)::text AS count FROM owner_audit_logs WHERE owner_id = $1 AND tenant_id = $2',
      [ownerId, tenantId]
    );
    return Number(result.rows[0]?.count || 0);
  });
}
