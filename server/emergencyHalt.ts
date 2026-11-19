import { getPostgresPool } from '../database.ts';

type QueryResult<T = any> = { rows: T[] };
export type EmergencyHaltDbClient = { query: (sql: string, values?: unknown[]) => Promise<QueryResult>; release: () => void };
export type EmergencyHaltDbPool = { connect: () => Promise<EmergencyHaltDbClient> };
export type OwnerEmergencyHaltState = { ownerId: string; halted: boolean; reason: string; updatedBy: string | null; updatedAt: string };

function resolvePool(override?: EmergencyHaltDbPool | null): EmergencyHaltDbPool | null {
  return override === undefined ? getPostgresPool() as unknown as EmergencyHaltDbPool | null : override;
}
function requireOwnerId(ownerId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId || '')) throw new Error('A valid authenticated Owner ID is required.');
}
async function withOwnerTransaction<T>(pool: EmergencyHaltDbPool, ownerId: string, run: (client: EmergencyHaltDbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.owner_id', $1, true)", [ownerId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  } finally { client.release(); }
}
export async function getOwnerEmergencyHaltState(ownerId: string, poolOverride?: EmergencyHaltDbPool | null): Promise<OwnerEmergencyHaltState> {
  requireOwnerId(ownerId);
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Emergency halt database is unavailable.');
  return withOwnerTransaction(pool, ownerId, async (client) => {
    const result = await client.query("SELECT owner_id, halted, reason, updated_by, updated_at FROM owner_emergency_halt WHERE owner_id = $1 LIMIT 1", [ownerId]);
    const row = result.rows[0];
    if (!row) throw new Error('Emergency halt state is missing; execution is blocked until Owner state is restored.');
    return { ownerId: row.owner_id, halted: row.halted === true, reason: String(row.reason || ''), updatedBy: row.updated_by || null, updatedAt: new Date(row.updated_at).toISOString() };
  });
}
export async function setOwnerEmergencyHaltState(ownerId: string, actorId: string, halted: boolean, reason: string, poolOverride?: EmergencyHaltDbPool | null): Promise<OwnerEmergencyHaltState> {
  requireOwnerId(ownerId); requireOwnerId(actorId);
  if (ownerId !== actorId) throw new Error('Only the matching Owner can change emergency halt state.');
  if (typeof halted !== 'boolean' || typeof reason !== 'string' || reason.length > 500) throw new Error('A valid halt state and reason (maximum 500 characters) are required.');
  if (halted && !reason.trim()) throw new Error('A reason is required when activating emergency halt.');
  const pool = resolvePool(poolOverride);
  if (!pool) throw new Error('Emergency halt database is unavailable.');
  return withOwnerTransaction(pool, ownerId, async (client) => {
    const result = await client.query("INSERT INTO owner_emergency_halt (owner_id, halted, reason, updated_by, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (owner_id) DO UPDATE SET halted = EXCLUDED.halted, reason = EXCLUDED.reason, updated_by = EXCLUDED.updated_by, updated_at = NOW() WHERE owner_emergency_halt.owner_id = $1 RETURNING owner_id, halted, reason, updated_by, updated_at", [ownerId, halted, reason.trim(), actorId]);
    if (!result.rows.length) throw new Error('Emergency halt state could not be saved.');
    const row = result.rows[0];
    return { ownerId: row.owner_id, halted: row.halted === true, reason: String(row.reason || ''), updatedBy: row.updated_by || null, updatedAt: new Date(row.updated_at).toISOString() };
  });
}
export async function assertOwnerEmergencyHaltClear(ownerId: string, poolOverride?: EmergencyHaltDbPool | null): Promise<void> {
  const state = await getOwnerEmergencyHaltState(ownerId, poolOverride);
  if (state.halted) throw new Error('Emergency halt is active. AI and agent execution are blocked.');
}

export function createOwnerEmergencyHaltMiddleware(poolOverride?: EmergencyHaltDbPool | null) {
  return async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (req.path === '/emergency-halt' || req.path === '/health' || req.path === '/system-doctor' || req.path === '/database/status') return next();
    const executionRoute = req.method === 'POST' && [
      /^\/chat$/,
      /^\/automation\/trigger$/,
      /^\/worker-agents\/delegate$/,
      /^\/video\/(generate-script|generate-voice|render)$/,
      /^\/autopilot\/trigger\/manual$/,
      /^\/autopilot\/webhook\//,
      /^\/autopilot\/content-pipeline\/prepare$/,
      /^\/autopilot\/workflows\/[^/]+\/run$/,
      /^\/autopilot\/executions\/[^/]+\/retry$/,
      /^\/publishing\/(prepare|publish)$/,
      /^\/github\/commit$/,
      /^\/project\/apply-proposal$/,
      /^\/sheets\/sync$/
    ].some(pattern => pattern.test(req.path));
    if (!executionRoute) return next();
    const ownerId = (res.locals.authSession as { id?: string } | undefined)?.id || '';
    try {
      await assertOwnerEmergencyHaltClear(ownerId, poolOverride);
      return next();
    } catch {
      return res.status(423).json({ error: 'Emergency halt is active or its durable state is unavailable. AI and agent execution are blocked.' });
    }
  };
}
