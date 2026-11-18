import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { getPostgresPool } from './database.ts';
import type { TenantContext } from './auth.ts';

type DbResult = { rows: any[]; rowCount?: number | null };
type DbClient = { query: (sql: string, values?: unknown[]) => Promise<DbResult>; release: () => void };
type DbPool = DbClient & { connect: () => Promise<DbClient> };
type Session = { id: string; role: 'owner' | 'admin' | 'member' };

type WorkspaceContext = { session: Session; tenant: TenantContext };
type PublishDispatcher = (input: {
  task: Record<string, any>;
  ownerId: string;
}) => Promise<{ externalPostId: string }>;

function error(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function context(res: Response): WorkspaceContext | null {
  const session = res.locals.authSession as Session | undefined;
  const tenant = res.locals.tenantContext as TenantContext | undefined;
  return session && tenant ? { session, tenant } : null;
}

function publicPublishingTask(row: Record<string, any>) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    title: payload.topic || row.original_prompt,
    description: payload.description || payload.caption || '',
    category: payload.category || payload.module || 'workspace',
    topic: payload.topic || row.original_prompt,
    platform: payload.platform || 'youtube',
    caption: payload.caption || '',
    hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
    status: row.status === 'queued' ? 'approved' : row.status,
    approvalRequired: row.requires_approval === true,
    approvalStatus: row.status === 'rejected' ? 'rejected' : row.approved_at ? 'approved' : 'pending',
    result: row.result || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    approvedAt: row.approved_at || null,
    publishedAt: row.completed_at || null,
    externalPostId: row.result?.externalPostId || null,
    source: payload.source || 'master_publishing'
  };
}

function publicAakshTask(row: Record<string, any>) {
  const task = publicPublishingTask(row);
  const statusMap: Record<string, string> = {
    waiting_approval: 'awaiting_approval',
    queued: 'ready',
    running: 'in_progress',
    rejected: 'cancelled'
  };
  return {
    id: task.id,
    platform: task.platform,
    category: task.category,
    title: task.title,
    description: task.description,
    status: statusMap[row.status] || row.status,
    approvalRequired: task.approvalRequired,
    approvalStatus: task.approvalStatus,
    source: task.source,
    result: task.result,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    audit: []
  };
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export function createUnifiedWorkspaceRouter(options: {
  pool?: DbPool | null;
  dispatchPublishing?: PublishDispatcher;
} = {}) {
  const aakshRouter = Router();
  const publishingRouter = Router();
  const socialRouter = Router();
  const pool = options.pool === undefined ? getPostgresPool() as unknown as DbPool | null : options.pool;

  async function createApprovedWorkItem(req: any, res: Response, input: {
    source: 'aaksh' | 'master_publishing';
    module: string;
    action: string;
    platform: string;
    category: string;
    title: string;
    description: string;
    topic?: string;
    caption?: string;
    hashtags?: string[];
  }) {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL task storage is unavailable.');
    const keyHeader = typeof req.header('idempotency-key') === 'string' ? req.header('idempotency-key').trim() : '';
    const idempotencyKey = keyHeader || randomUUID();
    if (idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
      return error(res, 400, 'Idempotency-Key has an invalid format.');
    }
    const payload = {
      source: input.source,
      module: input.module,
      action: input.action,
      platform: input.platform,
      category: input.category,
      topic: input.topic || input.title,
      caption: input.caption || '',
      hashtags: input.hashtags || [],
      description: input.description
    };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO agent_tasks
           (tenant_id, owner_id, idempotency_key, task_type, original_prompt, payload,
            status, requires_approval, priority)
         VALUES ($1, $2, $3, 'integration', $4, $5::jsonb, 'waiting_approval', TRUE, 100)
         ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id, owner_id, task_type, original_prompt, payload, status, requires_approval,
                   approved_by, approved_at, result, created_at, updated_at, completed_at`,
        [ctx.tenant.tenantId, ctx.session.id, idempotencyKey, input.title, JSON.stringify(payload)]
      );
      if (!inserted.rows[0]) {
        const existing = await client.query(
          `SELECT id, owner_id, task_type, original_prompt, payload, status, requires_approval,
                  approved_by, approved_at, result, created_at, updated_at, completed_at
             FROM agent_tasks
            WHERE tenant_id = $1 AND owner_id = $2 AND idempotency_key = $3
            LIMIT 1`,
          [ctx.tenant.tenantId, ctx.session.id, idempotencyKey]
        );
        if (!existing.rows[0]) throw new Error('Idempotency replay could not be resolved.');
        await client.query('COMMIT');
        return res.status(200).json({ success: true, task: input.source === 'aaksh' && input.module === 'workspace' ? publicAakshTask(existing.rows[0]) : publicPublishingTask(existing.rows[0]), idempotentReplay: true });
      }
      const task = inserted.rows[0];
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'created', 'intake', 'waiting_approval', $4, $5::jsonb)`,
        [task.id, ctx.tenant.tenantId, ctx.session.id, 'AAKSH workspace work item is waiting for approval in the shared Master Project queue.', JSON.stringify({ source: input.source, module: input.module, action: input.action })]
      );
      await client.query('COMMIT');
      return res.status(201).json({ success: true, task: input.source === 'aaksh' && input.module === 'workspace' ? publicAakshTask(task) : publicPublishingTask(task), idempotentReplay: false });
    } catch (cause) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
      const code = (cause as { code?: string })?.code;
      if (code === '42P01' || code === '42703') return error(res, 503, 'Shared tenant/task migrations are not applied.');
      return error(res, 503, 'Work item could not be saved to the shared queue.');
    } finally {
      client.release();
    }
  }

  // AAKSH Social Feed persists in the same PostgreSQL database and tenant boundary.
  socialRouter.get('/feed', async (_req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL storage is unavailable.');
    try {
      const result = await pool.query(
        `SELECT p.id, p.author_user_id, p.body, p.created_at,
                (SELECT COUNT(*)::int FROM aaksh_social_likes l WHERE l.tenant_id = p.tenant_id AND l.post_id = p.id) AS likes_count,
                (SELECT COUNT(*)::int FROM aaksh_social_comments c WHERE c.tenant_id = p.tenant_id AND c.post_id = p.id) AS comments_count,
                EXISTS (SELECT 1 FROM aaksh_social_likes l WHERE l.tenant_id = p.tenant_id AND l.post_id = p.id AND l.user_id = $2) AS liked_by_me
           FROM aaksh_social_posts p
          WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
          ORDER BY p.created_at DESC LIMIT 50`,
        [ctx.tenant.tenantId, ctx.session.id]
      );
      return res.json({ success: true, posts: result.rows.map((post: any) => ({
        id: post.id, userId: post.author_user_id, text: post.body,
        likes: post.likes_count, commentsCount: post.comments_count,
        likedByMe: post.liked_by_me, createdAt: post.created_at
      })) });
    } catch {
      return error(res, 503, 'AAKSH social feed is temporarily unavailable.');
    }
  });

  socialRouter.post('/posts', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL storage is unavailable.');
    const body = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!body || body.length > 5000) return error(res, 400, 'Post text must be between 1 and 5000 characters.');
    try {
      const result = await pool.query(
        `INSERT INTO aaksh_social_posts (tenant_id, author_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, author_user_id, body, created_at`,
        [ctx.tenant.tenantId, ctx.session.id, body]
      );
      const post = result.rows[0];
      return res.status(201).json({ success: true, post: {
        id: post.id, userId: post.author_user_id, text: post.body,
        likes: 0, commentsCount: 0, likedByMe: false, createdAt: post.created_at
      } });
    } catch {
      return error(res, 503, 'Social post could not be saved.');
    }
  });

  socialRouter.post('/posts/:postId/like', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.postId)) return error(res, 400, 'Post ID is invalid.');
    try {
      const exists = await pool.query(
        'SELECT id FROM aaksh_social_posts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [req.params.postId, ctx.tenant.tenantId]
      );
      if (!exists.rows[0]) return error(res, 404, 'Post not found in this workspace.');
      const removed = await pool.query(
        'DELETE FROM aaksh_social_likes WHERE tenant_id = $1 AND post_id = $2 AND user_id = $3 RETURNING post_id',
        [ctx.tenant.tenantId, req.params.postId, ctx.session.id]
      );
      const liked = !removed.rows[0];
      if (liked) {
        await pool.query(
          'INSERT INTO aaksh_social_likes (tenant_id, post_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [ctx.tenant.tenantId, req.params.postId, ctx.session.id]
        );
      }
      const count = await pool.query(
        'SELECT COUNT(*)::int AS count FROM aaksh_social_likes WHERE tenant_id = $1 AND post_id = $2',
        [ctx.tenant.tenantId, req.params.postId]
      );
      return res.json({ success: true, liked, likes: count.rows[0]?.count || 0 });
    } catch {
      return error(res, 503, 'Like could not be updated.');
    }
  });

  socialRouter.get('/posts/:postId/comments', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.postId)) return error(res, 400, 'Post ID is invalid.');
    try {
      const post = await pool.query(
        'SELECT id FROM aaksh_social_posts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [req.params.postId, ctx.tenant.tenantId]
      );
      if (!post.rows[0]) return error(res, 404, 'Post not found in this workspace.');
      const comments = await pool.query(
        `SELECT id, author_user_id, body, created_at FROM aaksh_social_comments
          WHERE tenant_id = $1 AND post_id = $2 ORDER BY created_at ASC LIMIT 200`,
        [ctx.tenant.tenantId, req.params.postId]
      );
      return res.json({ success: true, comments: comments.rows.map((item: any) => ({
        id: item.id, userId: item.author_user_id, text: item.body, createdAt: item.created_at
      })) });
    } catch {
      return error(res, 503, 'Comments are temporarily unavailable.');
    }
  });

  socialRouter.post('/posts/:postId/comments', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.postId)) return error(res, 400, 'Post ID is invalid.');
    const body = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!body || body.length > 2000) return error(res, 400, 'Comment must be between 1 and 2000 characters.');
    try {
      const result = await pool.query(
        `INSERT INTO aaksh_social_comments (tenant_id, post_id, author_user_id, body)
         SELECT $1, p.id, $3, $4 FROM aaksh_social_posts p
          WHERE p.id = $2 AND p.tenant_id = $1 AND p.deleted_at IS NULL
         RETURNING id, author_user_id, body, created_at`,
        [ctx.tenant.tenantId, req.params.postId, ctx.session.id, body]
      );
      if (!result.rows[0]) return error(res, 404, 'Post not found in this workspace.');
      const item = result.rows[0];
      return res.status(201).json({ success: true, comment: {
        id: item.id, userId: item.author_user_id, text: item.body, createdAt: item.created_at
      } });
    } catch {
      return error(res, 503, 'Comment could not be saved.');
    }
  });

  socialRouter.delete('/posts/:postId', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL storage is unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.postId)) return error(res, 400, 'Post ID is invalid.');
    try {
      const deleted = await pool.query(
        `UPDATE aaksh_social_posts SET deleted_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            AND (author_user_id = $3 OR $4::boolean = TRUE)
          RETURNING id`,
        [req.params.postId, ctx.tenant.tenantId, ctx.session.id, ['owner', 'admin'].includes(ctx.tenant.role)]
      );
      if (!deleted.rows[0]) return error(res, 404, 'Post not found or not owned by this user.');
      return res.json({ success: true, deleted: true });
    } catch {
      return error(res, 503, 'Post could not be deleted.');
    }
  });

  // AAKSH work tasks are records in Master Project's tenant-scoped agent_tasks table.
  aakshRouter.get('/work/tasks', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL task storage is unavailable.');
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    try {
      const result = await pool.query(
        `SELECT id, owner_id, original_prompt, payload, status, requires_approval,
                approved_at, result, created_at, updated_at, completed_at
           FROM agent_tasks
          WHERE tenant_id = $1 AND payload->>'source' = 'aaksh'
          ORDER BY created_at DESC LIMIT $2`,
        [ctx.tenant.tenantId, limit]
      );
      return res.json({ success: true, tasks: result.rows.map(publicAakshTask), tenantRole: ctx.tenant.role });
    } catch {
      return error(res, 503, 'AAKSH work history is temporarily unavailable.');
    }
  });

  aakshRouter.post('/work/tasks', async (req, res) => {
    const body = req.body || {};
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const category = typeof body.category === 'string' ? body.category.trim().toLowerCase() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!/^[a-z0-9][a-z0-9._-]{0,49}$/.test(platform) || !/^[a-z0-9][a-z0-9._-]{0,49}$/.test(category)) {
      return error(res, 400, 'Valid platform and category keys are required.');
    }
    if (!validText(title, 160) || description.length > 5000) return error(res, 400, 'Title is required (max 160 characters); description max is 5000 characters.');
    return createApprovedWorkItem(req, res, {
      source: 'aaksh', module: 'workspace', action: 'execute_work_item',
      platform, category, title, description, topic: title
    });
  });

  aakshRouter.post('/publishing/prepare', async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const platform = typeof req.body?.platform === 'string' ? req.body.platform.trim().toLowerCase() : 'youtube';
    if (!validText(topic, 500)) return error(res, 400, 'Topic must contain between 1 and 500 characters.');
    if (!/^[a-z0-9][a-z0-9._-]{0,49}$/.test(platform)) return error(res, 400, 'A valid publishing platform is required.');
    const caption = '🚀 ' + topic + '\\n\\nPrepared for review. Publishing remains blocked until a workspace Owner/Admin approves this item.';
    return createApprovedWorkItem(req, res, {
      source: 'aaksh', module: 'publishing', action: 'publish',
      platform, category: 'social_post', title: topic, description: caption,
      topic, caption, hashtags: ['#AI', '#Technology', '#Automation']
    });
  });

  // AAKSH publishing drafts use the same durable task and approval record as all other work.
  publishingRouter.get('/queue', async (_req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL task storage is unavailable.');
    try {
      const result = await pool.query(
        `SELECT id, owner_id, original_prompt, payload, status, requires_approval,
                approved_at, result, created_at, updated_at, completed_at
           FROM agent_tasks
          WHERE tenant_id = $1 AND payload->>'source' IN ('aaksh', 'master_publishing')
          ORDER BY created_at DESC LIMIT 100`,
        [ctx.tenant.tenantId]
      );
      return res.json({ queue: result.rows.map(publicPublishingTask) });
    } catch {
      return error(res, 503, 'Shared publishing queue is temporarily unavailable.');
    }
  });

  publishingRouter.post('/prepare', async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const platform = typeof req.body?.platform === 'string' ? req.body.platform.trim().toLowerCase() : 'youtube';
    if (!validText(topic, 500)) return error(res, 400, 'Topic must contain between 1 and 500 characters.');
    if (!/^[a-z0-9][a-z0-9._-]{0,49}$/.test(platform)) return error(res, 400, 'A valid publishing platform is required.');
    const caption = '🚀 ' + topic + '\\n\\nPrepared for review. Publishing remains blocked until a workspace Owner/Admin approves this item.';
    const hashtags = ['#AI', '#Technology', '#Automation'];
    return createApprovedWorkItem(req, res, {
      source: 'master_publishing', module: 'publishing', action: 'publish',
      platform, category: 'social_post', title: topic, description: caption,
      topic, caption, hashtags
    });
  });

  publishingRouter.post('/approve', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!['owner', 'admin'].includes(ctx.tenant.role)) return error(res, 403, 'Only a workspace Owner or Admin can approve publishing.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL task storage is unavailable.');
    const taskId = typeof req.body?.postId === 'string' ? req.body.postId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) return error(res, 400, 'Publishing task ID is invalid.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const update = await client.query(
        `UPDATE agent_tasks
            SET status = 'queued', approved_by = $3, approved_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND payload->>'source' IN ('aaksh', 'master_publishing')
            AND status = 'waiting_approval' AND requires_approval = TRUE
          RETURNING id, owner_id`,
        [taskId, ctx.tenant.tenantId, ctx.session.id]
      );
      if (!update.rows[0]) {
        await client.query('ROLLBACK');
        return error(res, 409, 'Publishing item is not awaiting approval in this workspace.');
      }
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'approved', 'approval', 'queued', $4, $5::jsonb)`,
        [taskId, ctx.tenant.tenantId, update.rows[0].owner_id, 'Publishing approval recorded; no external post has been sent.', JSON.stringify({ approvedBy: ctx.session.id })]
      );
      await client.query('COMMIT');
      return res.json({ success: true, post: { id: taskId, status: 'approved' }, approvalRecorded: true });
    } catch {
      try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
      return error(res, 503, 'Publishing approval could not be recorded.');
    } finally {
      client.release();
    }
  });

  publishingRouter.post('/publish', async (req, res) => {
    const ctx = context(res);
    if (!ctx) return error(res, 401, 'Authenticated tenant context is required.');
    if (!pool) return error(res, 503, 'Shared PostgreSQL task storage is unavailable.');
    const taskId = typeof req.body?.postId === 'string' ? req.body.postId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) return error(res, 400, 'Publishing task ID is invalid.');
    if (!['owner', 'admin'].includes(ctx.tenant.role)) return error(res, 403, 'Only a workspace Owner/Admin can publish.');
    if (!options.dispatchPublishing) return error(res, 503, 'A verified publishing provider adapter is not configured.');

    const leaseOwner = 'publishing:' + ctx.session.id;
    const claimClient = await pool.connect();
    let task: Record<string, any> | undefined;
    try {
      await claimClient.query('BEGIN');
      const claimed = await claimClient.query(
        `UPDATE agent_tasks
            SET status = 'running', started_at = COALESCE(started_at, NOW()),
                lease_owner = $3, lease_expires_at = NOW() + INTERVAL '2 minutes',
                updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
            AND payload->>'source' IN ('aaksh', 'master_publishing')
            AND status = 'queued' AND requires_approval = TRUE
            AND approved_by IS NOT NULL AND approved_at IS NOT NULL
          RETURNING id, owner_id, payload, status, approved_by, approved_at`,
        [taskId, ctx.tenant.tenantId, leaseOwner]
      );
      task = claimed.rows[0];
      if (!task) {
        await claimClient.query('ROLLBACK');
        return error(res, 409, 'Publishing item is not approved or is already being processed.');
      }
      await claimClient.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'dispatch_started', 'provider', 'running', $4, $5::jsonb)`,
        [taskId, ctx.tenant.tenantId, task.owner_id, 'Approved publishing dispatch started.', JSON.stringify({ approvedBy: task.approved_by })]
      );
      await claimClient.query('COMMIT');
    } catch {
      try { await claimClient.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
      return error(res, 503, 'Publishing dispatch could not be claimed safely.');
    } finally {
      claimClient.release();
    }

    try {
      const provider = await options.dispatchPublishing({ task, ownerId: task.owner_id });
      if (!provider.externalPostId || provider.externalPostId.length > 200) throw new Error('Provider did not return a valid external post ID.');
      const finishClient = await pool.connect();
      try {
        await finishClient.query('BEGIN');
        const completed = await finishClient.query(
          `UPDATE agent_tasks
              SET status = 'completed', result = $4::jsonb, completed_at = NOW(), updated_at = NOW(),
                  lease_owner = NULL, lease_expires_at = NULL
            WHERE id = $1 AND tenant_id = $2 AND status = 'running' AND lease_owner = $3
            RETURNING id, owner_id`,
          [taskId, ctx.tenant.tenantId, leaseOwner, JSON.stringify({ externalPostId: provider.externalPostId, publicationConfirmed: true })]
        );
        if (!completed.rows[0]) throw new Error('Publishing lease was lost before completion.');
        await finishClient.query(
          `INSERT INTO agent_task_events
             (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
           VALUES ($1, $2, $3, 'published', 'provider', 'completed', $4, $5::jsonb)`,
          [taskId, ctx.tenant.tenantId, task.owner_id, 'Publishing provider confirmed external publication.', JSON.stringify({ externalPostId: provider.externalPostId })]
        );
        await finishClient.query('COMMIT');
      } catch (cause) {
        try { await finishClient.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
        throw cause;
      } finally {
        finishClient.release();
      }
      return res.json({ success: true, post: { id: taskId, status: 'published', externalPostId: provider.externalPostId }, mode: 'provider_confirmed', message: 'Provider confirmed publication.' });
    } catch {
      const failClient = await pool.connect();
      try {
        await failClient.query(
          `UPDATE agent_tasks
              SET status = 'failed', last_error = 'PUBLISHING_PROVIDER_UNCONFIRMED',
                  completed_at = NOW(), updated_at = NOW(), lease_owner = NULL, lease_expires_at = NULL
            WHERE id = $1 AND tenant_id = $2 AND status = 'running' AND lease_owner = $3`,
          [taskId, ctx.tenant.tenantId, leaseOwner]
        );
        await failClient.query(
          `INSERT INTO agent_task_events
             (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
           VALUES ($1, $2, $3, 'dispatch_failed', 'provider', 'failed', $4, '{}'::jsonb)`,
          [taskId, ctx.tenant.tenantId, task.owner_id, 'Provider publication was not confirmed.']
        );
      } finally {
        failClient.release();
      }
      return error(res, 502, 'Publishing provider did not confirm publication; the task is marked failed for manual reconciliation.');
    }
  });

  return { aaksh: aakshRouter, publishing: publishingRouter, social: socialRouter };
}
