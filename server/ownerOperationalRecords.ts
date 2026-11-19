import { getPostgresPool } from '../database.ts';

type QueryResult<T = any> = { rows: T[] };
export type OwnerOperationalDbClient = {
  query: (sql: string, values?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};
export type OwnerOperationalDbPool = {
  connect: () => Promise<OwnerOperationalDbClient>;
};

export type OwnerOperationalRecordType =
  | 'video_job'
  | 'autopilot_task'
  | 'autopilot_workflow'
  | 'workflow_execution'
  | 'publishing_post'
  | 'sheets_sync_record'
  | 'change_proposal'
  | 'worker_agent'
  | 'payout_request'
  | 'verified_earning';

function resolvePool(override?: OwnerOperationalDbPool | null): OwnerOperationalDbPool | null {
  return override === undefined ? getPostgresPool() as unknown as OwnerOperationalDbPool | null : override;
}

async function withOwnerTransaction<T>(
  pool: OwnerOperationalDbPool,
  ownerId: string,
  tenantId: string,
  run: (client: OwnerOperationalDbClient) => Promise<T>
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
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally {
    client.release();
  }
}

function requireIdentity(ownerId: string, tenantId: string, recordType: string) {
  if (!ownerId || !tenantId || !recordType) throw new Error('Owner, tenant, and record type are required.');
}

export async function listOwnerOperationalRecords<T = any>(
  ownerId: string,
  tenantId: string,
  recordType: OwnerOperationalRecordType,
  poolOverride?: OwnerOperationalDbPool | null
): Promise<T[]> {
  requireIdentity(ownerId, tenantId, recordType);
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Operational database is unavailable.');
  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      `SELECT record_id, payload
         FROM owner_operational_records
        WHERE owner_id = $1 AND tenant_id = $2 AND record_type = $3
        ORDER BY updated_at DESC`,
      [ownerId, tenantId, recordType]
    );
    return result.rows.map((row) => row.payload as T);
  });
}

export async function getOwnerOperationalRecord<T = any>(
  ownerId: string,
  tenantId: string,
  recordType: OwnerOperationalRecordType,
  recordId: string,
  poolOverride?: OwnerOperationalDbPool | null
): Promise<T | null> {
  requireIdentity(ownerId, tenantId, recordType);
  if (!recordId) throw new Error('Record ID is required.');
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Operational database is unavailable.');
  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      `SELECT payload
         FROM owner_operational_records
        WHERE owner_id = $1 AND tenant_id = $2 AND record_type = $3 AND record_id = $4
        LIMIT 1`,
      [ownerId, tenantId, recordType, recordId]
    );
    return (result.rows[0]?.payload as T | undefined) ?? null;
  });
}

export async function upsertOwnerOperationalRecord<T extends { id: string }>(
  ownerId: string,
  tenantId: string,
  recordType: OwnerOperationalRecordType,
  record: T,
  poolOverride?: OwnerOperationalDbPool | null
): Promise<T> {
  requireIdentity(ownerId, tenantId, recordType);
  if (!record || typeof record.id !== 'string' || !record.id.trim() || record.id.length > 200) {
    throw new Error('A valid operational record ID is required.');
  }
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Operational database is unavailable.');
  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      `INSERT INTO owner_operational_records
         (owner_id, tenant_id, record_type, record_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (owner_id, tenant_id, record_type, record_id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
       WHERE owner_operational_records.owner_id = $1
         AND owner_operational_records.tenant_id = $2
       RETURNING payload`,
      [ownerId, tenantId, recordType, record.id, JSON.stringify(record)]
    );
    if (!result.rows.length) throw new Error('Operational record could not be saved.');
    return result.rows[0].payload as T;
  });
}

export async function deleteOwnerOperationalRecord(
  ownerId: string,
  tenantId: string,
  recordType: OwnerOperationalRecordType,
  recordId: string,
  poolOverride?: OwnerOperationalDbPool | null
): Promise<boolean> {
  requireIdentity(ownerId, tenantId, recordType);
  if (!recordId) throw new Error('Record ID is required.');
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Operational database is unavailable.');
  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM owner_operational_records
        WHERE owner_id = $1 AND tenant_id = $2 AND record_type = $3 AND record_id = $4
        RETURNING record_id`,
      [ownerId, tenantId, recordType, recordId]
    );
    return result.rows.length > 0;
  });
}

export async function countOwnerOperationalRecords(
  ownerId: string,
  tenantId: string,
  recordType: OwnerOperationalRecordType,
  poolOverride?: OwnerOperationalDbPool | null
): Promise<number> {
  requireIdentity(ownerId, tenantId, recordType);
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Operational database is unavailable.');
  return withOwnerTransaction(pool, ownerId, tenantId, async (client) => {
    const result = await client.query(
      'SELECT COUNT(*)::text AS count FROM owner_operational_records WHERE owner_id = $1 AND tenant_id = $2 AND record_type = $3',
      [ownerId, tenantId, recordType]
    );
    return Number(result.rows[0]?.count || 0);
  });
}
