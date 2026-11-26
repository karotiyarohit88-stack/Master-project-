import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(moduleDir, 'migrations');
const MIGRATION_LOCK_KEY = 'master-project-ai-agent:migrations:v1';

let pool: Pool | null = null;

function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
}

export function getPostgresPool(): Pool | null {
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;

  if (!pool) {
    const max = Number.parseInt(process.env.PG_POOL_MAX || '10', 10);
    const connectionTimeoutMillis = Number.parseInt(
      process.env.PG_CONNECTION_TIMEOUT_MS || '5000',
      10
    );

    pool = new Pool({
      connectionString,
      max: Number.isFinite(max) ? Math.min(Math.max(max, 1), 30) : 10,
      connectionTimeoutMillis: Number.isFinite(connectionTimeoutMillis)
        ? Math.min(Math.max(connectionTimeoutMillis, 1000), 30000)
        : 5000,
      idleTimeoutMillis: 30000,
      application_name: 'master-project-ai-agent',
    });

    pool.on('error', (error: Error) => {
      // Do not log connection strings, credentials, or raw driver configuration.
      console.error('Unexpected PostgreSQL pool error:', error.message);
    });
  }

  return pool;
}

export async function checkPostgresConnection(connectionStringOverride?: string): Promise<{
  configured: boolean;
  connected: boolean;
  database?: string;
  serverVersion?: string;
  latencyMs?: number;
  error?: string;
}> {
  const configuredUrl = connectionStringOverride?.trim() || getDatabaseUrl();
  if (!configuredUrl) {
    return { configured: false, connected: false, error: 'DATABASE_URL is not configured.' };
  }

  const usesTemporaryPool = Boolean(connectionStringOverride?.trim() && connectionStringOverride.trim() !== getDatabaseUrl());
  const databasePool = usesTemporaryPool
    ? new Pool({ connectionString: configuredUrl, connectionTimeoutMillis: 5000, max: 1 })
    : getPostgresPool();
  if (!databasePool) {
    return { configured: false, connected: false, error: 'DATABASE_URL is not configured.' };
  }

  const startedAt = Date.now();
  try {
    const result = await databasePool.query<{
      database_name: string;
      server_version: string;
    }>(
      'SELECT current_database() AS database_name, current_setting(\'server_version\') AS server_version'
    );
    return {
      configured: true,
      connected: true,
      database: result.rows[0]?.database_name,
      serverVersion: result.rows[0]?.server_version,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PostgreSQL connection error';
    return {
      configured: true,
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: message.slice(0, 240),
    };
  } finally {
    if (usesTemporaryPool) await databasePool.end();
  }
}

export async function getPostgresMigrationStatus(): Promise<{
  migrationTableExists: boolean;
  appliedMigrations: string[];
}> {
  const databasePool = getPostgresPool();
  if (!databasePool) return { migrationTableExists: false, appliedMigrations: [] };

  try {
    const result = await databasePool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    return { migrationTableExists: true, appliedMigrations: result.rows.map((row) => row.version) };
  } catch (error) {
    if ((error as { code?: string })?.code === '42P01') {
      return { migrationTableExists: false, appliedMigrations: [] };
    }
    throw error;
  }
}

async function runMigration(client: PoolClient, version: string, sql: string, checksum: string) {
  await client.query('BEGIN');
  try {
    // Existing migration files include their own transaction wrappers. Strip only
    // those wrappers so the migration record and DDL commit atomically together.
    const body = sql
      .replace(/\bBEGIN\s*;/i, '')
      .replace(/COMMIT\s*;?\s*$/i, '');

    await client.query(body);
    await client.query(
      'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
      [version, checksum]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function applyPendingPostgresMigrations(onlyVersions?: string[]): Promise<{
  applied: string[];
  alreadyApplied: string[];
}> {
  if (process.env.RUN_DB_MIGRATIONS !== 'true') {
    throw new Error('Database migrations are disabled. Set RUN_DB_MIGRATIONS=true for an explicitly approved migration run.');
  }

  const databasePool = getPostgresPool();
  if (!databasePool) throw new Error('DATABASE_URL is not configured.');

  const client = await databasePool.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const allFiles = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => /^\d{8}_\d{3}_.+\.sql$/.test(file))
      .sort();
    const files = onlyVersions?.length
      ? allFiles.filter((file) => onlyVersions.includes(file))
      : allFiles;
    if (onlyVersions?.some((version) => !files.includes(version))) {
      throw new Error('One or more explicitly requested migration files are missing.');
    }

    for (const file of files) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum.trim() !== checksum) {
          throw new Error(`Applied migration ${file} has changed. Create a new forward-only migration instead of editing it.`);
        }
        alreadyApplied.push(file);
        continue;
      }

      await runMigration(client, file, sql, checksum);
      applied.push(file);
    }

    return { applied, alreadyApplied };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_KEY]);
    } finally {
      client.release();
    }
  }
}

export async function closePostgresPool(): Promise<void> {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  await activePool.end();
}
