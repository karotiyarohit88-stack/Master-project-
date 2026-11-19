import { randomUUID } from 'node:crypto';
import { getPostgresPool } from '../database.ts';

type DbResult = { rows: any[] };
type DbClient = {
  query: (sql: string, values?: unknown[]) => Promise<DbResult>;
  release: () => void;
};
type DbPool = DbClient & { connect: () => Promise<DbClient> };

export type PublishingDraftInput = {
  id?: string;
  topic: string;
  platform: string;
  caption: string;
  hashtags: string[];
  videoJobId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  dailyContent?: boolean;
  auditReport?: string;
};

function poolOrThrow(override?: DbPool | null): DbPool {
  const pool = override === undefined ? getPostgresPool() as unknown as DbPool | null : override;
  if (!pool) throw new Error('Publishing task database is unavailable.');
  return pool;
}

export async function createPublishingDraftForOwner(
  ownerId: string,
  tenantId: string,
  draft: PublishingDraftInput,
  poolOverride?: DbPool | null
): Promise<{ id: string; status: string }> {
  if (!ownerId || !tenantId) throw new Error('Owner and tenant identity are required.');
  if (!draft.topic.trim() || !draft.caption.trim() || !draft.platform.trim()) {
    throw new Error('Publishing draft topic, platform, and caption are required.');
  }

  const pool = poolOrThrow(poolOverride);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payload = {
      source: 'master_publishing',
      module: 'publishing',
      action: 'publish',
      category: 'social_post',
      topic: draft.topic.slice(0, 500),
      platform: draft.platform.slice(0, 50),
      caption: draft.caption.slice(0, 5000),
      hashtags: Array.isArray(draft.hashtags) ? draft.hashtags.slice(0, 30) : [],
      description: draft.caption.slice(0, 5000),
      ...(draft.videoJobId ? { videoJobId: draft.videoJobId } : {}),
      ...(draft.videoUrl ? { videoUrl: draft.videoUrl } : {}),
      ...(draft.thumbnailUrl ? { thumbnailUrl: draft.thumbnailUrl } : {}),
      ...(draft.dailyContent ? { dailyContent: true } : {}),
      ...(draft.auditReport ? { auditReport: draft.auditReport.slice(0, 1000) } : {})
    };
    const inserted = await client.query(
      `INSERT INTO agent_tasks
         (tenant_id, owner_id, idempotency_key, task_type, original_prompt, payload,
          status, requires_approval, priority)
       VALUES ($1, $2, $3, 'integration', $4, $5::jsonb, 'waiting_approval', TRUE, 100)
       RETURNING id, status`,
      [tenantId, ownerId, 'server-publish-' + randomUUID(), draft.topic.slice(0, 500), JSON.stringify(payload)]
    );
    const task = inserted.rows[0];
    if (!task) throw new Error('Publishing draft insert returned no row.');
    await client.query(
      `INSERT INTO agent_task_events
         (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
       VALUES ($1, $2, $3, 'created', 'intake', 'waiting_approval', $4, $5::jsonb)`,
      [task.id, tenantId, ownerId, 'Publishing draft staged for mandatory human approval.', JSON.stringify({ source: 'master_publishing', module: 'publishing' })]
    );
    await client.query('COMMIT');
    return { id: String(task.id), status: String(task.status) };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function listOwnerPublishingDrafts(ownerId: string, tenantId: string, poolOverride?: DbPool | null): Promise<any[]> {
  if (!ownerId || !tenantId) throw new Error('Owner and tenant identity are required.');
  const pool = poolOrThrow(poolOverride);
  const result = await pool.query(
    `SELECT id, owner_id, original_prompt, payload, status, requires_approval,
            approved_at, result, created_at, updated_at, completed_at
       FROM agent_tasks
      WHERE owner_id = $1 AND tenant_id = $2
        AND payload->>'module' = 'publishing'
        AND payload->>'source' = 'master_publishing'
      ORDER BY created_at DESC
      LIMIT 100`,
    [ownerId, tenantId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    topic: row.payload?.topic || row.original_prompt,
    platform: row.payload?.platform || 'youtube',
    caption: row.payload?.caption || '',
    hashtags: Array.isArray(row.payload?.hashtags) ? row.payload.hashtags : [],
    videoJobId: row.payload?.videoJobId,
    videoUrl: row.payload?.videoUrl,
    thumbnailUrl: row.payload?.thumbnailUrl,
    dailyContent: row.payload?.dailyContent === true,
    auditReport: row.payload?.auditReport,
    status: row.status === 'queued' ? 'approved' : row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at || undefined,
    publishedAt: row.completed_at || undefined,
    externalPostId: row.result?.externalPostId
  }));
}

export async function countOwnerPublishingDrafts(ownerId: string, tenantId: string, poolOverride?: DbPool | null): Promise<number> {
  if (!ownerId || !tenantId) throw new Error('Owner and tenant identity are required.');
  const pool = poolOrThrow(poolOverride);
  const result = await pool.query(
    `SELECT COUNT(*)::text AS count
       FROM agent_tasks
      WHERE owner_id = $1 AND tenant_id = $2
        AND payload->>'module' = 'publishing'
        AND payload->>'source' = 'master_publishing'`,
    [ownerId, tenantId]
  );
  return Number(result.rows[0]?.count || 0);
}
