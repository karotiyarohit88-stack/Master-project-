import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { closePostgresPool, getPostgresPool } from '../database.ts';

type LegacyUser = {
  id: string; name?: string; email?: string | null; emailVerified?: boolean;
  passwordHash?: string; createdAt?: string;
};
type LegacyTask = {
  id?: string; ownerId?: string; platform?: string; category?: string;
  title?: string; description?: string; status?: string; approvalStatus?: string;
  audit?: unknown[]; createdAt?: string; updatedAt?: string;
};
type LegacyComment = { id?: string; authorId?: string; text?: string; createdAt?: string };
type LegacyPost = {
  id?: string; authorId?: string; text?: string; likes?: string[];
  comments?: LegacyComment[]; createdAt?: string; updatedAt?: string;
};
type Db = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>; release: () => void };
type Pool = { connect: () => Promise<Db> };

export type LegacyImportSummary = {
  dryRun: boolean;
  usersImported: number;
  usersSkipped: number;
  tenantsCreated: number;
  tasksImported: number;
  tasksSkipped: number;
  postsImported: number;
  postsSkipped: number;
  likesImported: number;
  commentsImported: number;
  sessionsImported: 0;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readArray<T>(file: string, optional = false): Promise<T[]> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Legacy data file must contain a JSON array: ' + path.basename(file));
    return parsed as T[];
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function convertLegacyPasswordHash(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' ||
      !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{128}$/i.test(parts[2])) return null;
  // AAKSH passes its 32-character hex salt as UTF-8 text to scryptSync.
  const saltBytesHex = Buffer.from(parts[1], 'utf8').toString('hex');
  return 'scrypt$16384$8$1$' + saltBytesHex + '$' + parts[2];
}

function validDate(value: unknown): Date {
  const parsed = typeof value === 'string' ? new Date(value) : new Date(NaN);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function importAakshLegacyData(options: {
  pool: Pool;
  dataDir: string;
  dryRun?: boolean;
}): Promise<LegacyImportSummary> {
  const dataDir = path.resolve(options.dataDir);
  const dryRun = options.dryRun !== false;
  const users = await readArray<LegacyUser>(path.join(dataDir, 'users.json'));
  const tasks = await readArray<LegacyTask>(path.join(dataDir, 'work-tasks.json'), true);
  const posts = await readArray<LegacyPost>(path.join(dataDir, 'social-posts.json'), true);

  const summary: LegacyImportSummary = {
    dryRun, usersImported: 0, usersSkipped: 0, tenantsCreated: 0,
    tasksImported: 0, tasksSkipped: 0, postsImported: 0, postsSkipped: 0,
    likesImported: 0, commentsImported: 0, sessionsImported: 0
  };
  const userMap = new Map<string, { id: string; tenantId: string }>();
  const client = await options.pool.connect();

  try {
    await client.query('BEGIN');
    for (const legacy of users) {
      const id = typeof legacy.id === 'string' ? legacy.id : '';
      const email = typeof legacy.email === 'string' ? legacy.email.trim().toLowerCase() : '';
      const passwordHash = convertLegacyPasswordHash(legacy.passwordHash);
      if (!UUID.test(id) || !EMAIL.test(email) || legacy.emailVerified !== true ||
          !passwordHash || typeof legacy.name !== 'string' || !legacy.name.trim()) {
        summary.usersSkipped++;
        continue;
      }

      const existing = await client.query(
        'SELECT id, email FROM app_users WHERE id = $1 OR lower(trim(email)) = $2 LIMIT 2',
        [id, email]
      );
      if (existing.rows.some((row: any) =>
        String(row.id) !== id || String(row.email).trim().toLowerCase() !== email
      )) {
        // Never merge two different identities merely because their email strings match.
        summary.usersSkipped++;
        continue;
      }
      if (!existing.rows.length) {
        await client.query(
          `INSERT INTO app_users
             (id, email, password_hash, display_name, role, status, email_verified_at)
           VALUES ($1, $2, $3, $4, 'member', 'active', $5)`,
          [id, email, passwordHash, legacy.name.trim().slice(0, 100), validDate(legacy.createdAt)]
        );
        summary.usersImported++;
      }

      let tenant = await client.query('SELECT id FROM app_tenants WHERE owner_user_id = $1 LIMIT 1', [id]);
      let tenantId: string;
      if (tenant.rows[0]) tenantId = String(tenant.rows[0].id);
      else {
        const created = await client.query(
          'INSERT INTO app_tenants (display_name, owner_user_id) VALUES ($1, $2) RETURNING id',
          [(legacy.name.trim().slice(0, 80) || email) + ' Workspace', id]
        );
        tenantId = String(created.rows[0].id);
        summary.tenantsCreated++;
      }
      await client.query(
        `INSERT INTO app_tenant_memberships (tenant_id, user_id, membership_role, status)
         VALUES ($1, $2, 'owner', 'active')
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET membership_role = 'owner', status = 'active'`,
        [tenantId, id]
      );
      userMap.set(id, { id, tenantId });
    }

    for (const legacy of tasks) {
      const mapped = typeof legacy.ownerId === 'string' ? userMap.get(legacy.ownerId) : undefined;
      const title = typeof legacy.title === 'string' ? legacy.title.trim().slice(0, 160) : '';
      const description = typeof legacy.description === 'string' ? legacy.description.slice(0, 5000) : '';
      if (!mapped || !title) {
        summary.tasksSkipped++;
        continue;
      }
      const legacyId = typeof legacy.id === 'string' && UUID.test(legacy.id) ? legacy.id : '';
      if (!legacyId) { summary.tasksSkipped++; continue; }
      const oldStatus = typeof legacy.status === 'string' ? legacy.status : 'unknown';
      const terminal = ['completed', 'failed', 'cancelled'].includes(oldStatus);
      const status = terminal ? 'failed' : 'waiting_approval';
      const payload = {
        source: 'aaksh', module: 'workspace', action: 'legacy_import_review',
        platform: typeof legacy.platform === 'string' ? legacy.platform.slice(0, 50) : 'legacy',
        category: typeof legacy.category === 'string' ? legacy.category.slice(0, 50) : 'legacy',
        topic: title, description,
        legacy: { id: legacyId, status: oldStatus, approvalStatus: legacy.approvalStatus || 'unknown', audit: Array.isArray(legacy.audit) ? legacy.audit.slice(-50) : [] }
      };
      const inserted = await client.query(
        `INSERT INTO agent_tasks
           (tenant_id, owner_id, idempotency_key, task_type, original_prompt, payload,
            status, requires_approval, max_attempts, last_error, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'integration', $4, $5::jsonb, $6, TRUE, 1, $7, $8, $9, $10)
         ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [mapped.tenantId, mapped.id, 'aaksh-legacy-task-' + legacyId,
          '[Imported AAKSH] ' + title + (description ? '\n' + description : ''),
          JSON.stringify(payload), status,
          terminal ? 'LEGACY_EXECUTION_NOT_VERIFIED' : null,
          terminal ? validDate(legacy.updatedAt) : null,
          validDate(legacy.createdAt), validDate(legacy.updatedAt)]
      );
      if (!inserted.rows[0]) {
        summary.tasksSkipped++;
        continue;
      }
      await client.query(
        `INSERT INTO agent_task_events
           (task_id, tenant_id, owner_id, event_type, stage, status, message, details)
         VALUES ($1, $2, $3, 'legacy_imported', 'migration', $4, $5, $6::jsonb)`,
        [inserted.rows[0].id, mapped.tenantId, mapped.id, status,
          terminal ? 'Legacy task imported for historical review; old completion is not treated as verified.' : 'Legacy task imported and held for fresh human approval.',
          JSON.stringify({ legacyTaskId: legacyId, legacyStatus: oldStatus })]
      );
      summary.tasksImported++;
    }

    for (const legacy of posts) {
      const authorId = typeof legacy.authorId === 'string' ? legacy.authorId : '';
      const mapped = userMap.get(authorId);
      const text = typeof legacy.text === 'string' ? legacy.text.trim().slice(0, 5000) : '';
      if (!mapped || !text) {
        summary.postsSkipped++;
        continue;
      }
      const postId = typeof legacy.id === 'string' && UUID.test(legacy.id) ? legacy.id : '';
      if (!postId) { summary.postsSkipped++; continue; }
      const createdAt = validDate(legacy.createdAt);
      const post = await client.query(
        `INSERT INTO aaksh_social_posts (id, tenant_id, author_user_id, body, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [postId, mapped.tenantId, mapped.id, text, createdAt, validDate(legacy.updatedAt)]
      );
      if (!post.rows[0]) {
        summary.postsSkipped++;
        continue;
      }
      summary.postsImported++;

      for (const legacyLikerId of Array.isArray(legacy.likes) ? legacy.likes : []) {
        const liker = typeof legacyLikerId === 'string' ? userMap.get(legacyLikerId) : undefined;
        if (!liker || liker.tenantId !== mapped.tenantId) continue;
        const like = await client.query(
          `INSERT INTO aaksh_social_likes (tenant_id, post_id, user_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING post_id`,
          [mapped.tenantId, postId, liker.id]
        );
        if (like.rows[0]) summary.likesImported++;
      }

      for (const comment of Array.isArray(legacy.comments) ? legacy.comments : []) {
        const commenter = typeof comment.authorId === 'string' ? userMap.get(comment.authorId) : undefined;
        const body = typeof comment.text === 'string' ? comment.text.trim().slice(0, 2000) : '';
        if (!commenter || commenter.tenantId !== mapped.tenantId || !body) continue;
        const commentId = typeof comment.id === 'string' && UUID.test(comment.id) ? comment.id : '';
        if (!commentId) continue;
        const insertedComment = await client.query(
          `INSERT INTO aaksh_social_comments (id, tenant_id, post_id, author_user_id, body, created_at)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [commentId, mapped.tenantId, postId, commenter.id, body, validDate(comment.createdAt)]
        );
        if (insertedComment.rows[0]) summary.commentsImported++;
      }
    }

    if (dryRun) await client.query('ROLLBACK');
    else await client.query('COMMIT');
    return summary;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally {
    client.release();
  }
}

async function runCli() {
  dotenv.config();
  if (process.env.RUN_AAKSH_LEGACY_IMPORT !== 'true') {
    throw new Error('Legacy import is disabled. Set RUN_AAKSH_LEGACY_IMPORT=true after reviewing the export.');
  }
  if (process.env.AAKSH_LEGACY_IMPORT_DRY_RUN !== 'false') {
    // Dry-run is the safe default. Applying changes requires an explicit second flag.
    process.env.AAKSH_LEGACY_IMPORT_DRY_RUN = 'true';
  }
  const dataDir = (process.env.AAKSH_LEGACY_DATA_DIR || '').trim();
  if (!dataDir) throw new Error('AAKSH_LEGACY_DATA_DIR must point to the protected legacy data export directory.');
  const pool = getPostgresPool();
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  try {
    const summary = await importAakshLegacyData({
      pool: pool as unknown as Pool,
      dataDir,
      dryRun: process.env.AAKSH_LEGACY_IMPORT_DRY_RUN !== 'false'
    });
    // Counts only; never print user emails, password hashes, sessions, or content.
    process.stdout.write(JSON.stringify(summary) + '\n');
  } finally {
    await closePostgresPool();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  runCli().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : 'Legacy import failed safely.') + '\n');
    process.exitCode = 1;
  });
}
