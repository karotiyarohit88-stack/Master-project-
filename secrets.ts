import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getPostgresPool } from './database.ts';

type QueryResult = { rows: any[] };
export type SecretsDbClient = {
  query: (sql: string, values?: any[]) => Promise<QueryResult>;
  release: () => void;
};
export type SecretsDbPool = {
  connect: () => Promise<SecretsDbClient>;
};

type SecretsRouterOptions = {
  pool?: SecretsDbPool | null;
  encryptionKey?: string;
};

type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  authTag: string;
};

function getEncryptionKey(configuredKey: string): Buffer {
  const value = configuredKey.trim();
  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(value)) key = Buffer.from(value, 'hex');
  else {
    try { key = Buffer.from(value, 'base64'); }
    catch { throw new Error('AAKSH_SECRETS_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.'); }
  }
  if (key.length !== 32) throw new Error('AAKSH_SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return key;
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  return secret.slice(0, 3) + '...' + secret.slice(-4);
}

export function encryptSecret(secret: string, key: Buffer, associatedData: string): EncryptedSecret {
  if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

export function decryptSecret(encrypted: EncryptedSecret, key: Buffer, associatedData: string): string {
  if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.nonce, 'base64'));
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function resolvePool(override?: SecretsDbPool | null): SecretsDbPool | null {
  return override === undefined ? getPostgresPool() as unknown as SecretsDbPool | null : override;
}

async function withOwnerTenantTransaction<T>(
  pool: SecretsDbPool,
  ownerId: string,
  tenantId: string,
  run: (client: SecretsDbClient) => Promise<T>
): Promise<T> {
  if (!ownerId || !tenantId) throw new Error('Authenticated Owner and tenant context are required.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.owner_id', $1, true), set_config('app.tenant_id', $2, true)", [ownerId, tenantId]);
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

function safeError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('AAKSH_SECRETS_ENCRYPTION_KEY')) {
    res.status(503).json({ error: 'Secret encryption is not configured. Set AAKSH_SECRETS_ENCRYPTION_KEY to a random 32-byte key in the server environment.' });
    return;
  }
  res.status(503).json({ error: 'Secret storage is temporarily unavailable.' });
}

function requestIdentity(res: Response) {
  const ownerId = (res.locals.authSession as { id?: string } | undefined)?.id || '';
  const tenantId = (res.locals.tenantContext as { tenantId?: string } | undefined)?.tenantId || '';
  return { ownerId, tenantId };
}

export function createSecretsRouter(options: SecretsRouterOptions = {}) {
  const router = Router();
  const pool = resolvePool(options.pool);
  const configuredKey = options.encryptionKey ?? process.env.AAKSH_SECRETS_ENCRYPTION_KEY ?? '';

  router.post('/', async (req: Request, res: Response) => {
    const { ownerId, tenantId } = requestIdentity(res);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim() : 'custom';
    const secret = typeof req.body?.secret === 'string' ? req.body.secret : '';
    if (!ownerId || !tenantId) return res.status(401).json({ error: 'Authenticated Owner tenant context is required.' });
    if (!name || name.length > 80 || !/^[A-Za-z0-9 _.-]+$/.test(name) ||
        !provider || provider.length > 40 || !/^[A-Za-z0-9 _.-]+$/.test(provider) ||
        secret.length < 1 || secret.length > 8192 || secret.includes('\u0000')) {
      return res.status(400).json({ error: 'Provide a valid name, provider, and secret (maximum 8192 characters).' });
    }
    if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured.' });
    try {
      const key = getEncryptionKey(configuredKey);
      const id = randomUUID();
      const encrypted = encryptSecret(secret, key, ownerId + ':' + tenantId + ':' + id);
      const preview = maskSecret(secret);
      const result = await withOwnerTenantTransaction(pool, ownerId, tenantId, client => client.query(
        'INSERT INTO app_secrets (id, owner_id, tenant_id, name, provider, masked_preview, ciphertext, nonce, auth_tag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, provider, masked_preview, created_at',
        [id, ownerId, tenantId, name, provider, preview, encrypted.ciphertext, encrypted.nonce, encrypted.authTag]
      ));
      return res.status(201).json({ success: true, secret: result.rows[0] });
    } catch (error) {
      return safeError(res, error);
    }
  });

  router.get('/', async (_req: Request, res: Response) => {
    const { ownerId, tenantId } = requestIdentity(res);
    if (!ownerId || !tenantId) return res.status(401).json({ error: 'Authenticated Owner tenant context is required.' });
    if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured.' });
    try {
      const result = await withOwnerTenantTransaction(pool, ownerId, tenantId, client => client.query(
        'SELECT id, name, provider, masked_preview, created_at FROM app_secrets WHERE owner_id = $1 AND tenant_id = $2 AND revoked_at IS NULL ORDER BY created_at DESC',
        [ownerId, tenantId]
      ));
      return res.json({ secrets: result.rows });
    } catch (error) {
      return safeError(res, error);
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    const { ownerId, tenantId } = requestIdentity(res);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!ownerId || !tenantId) return res.status(401).json({ error: 'Authenticated Owner tenant context is required.' });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'A valid secret ID is required.' });
    }
    if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured.' });
    try {
      const result = await withOwnerTenantTransaction(pool, ownerId, tenantId, client => client.query(
        'UPDATE app_secrets SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1 AND owner_id = $2 AND tenant_id = $3 AND revoked_at IS NULL RETURNING id',
        [id, ownerId, tenantId]
      ));
      if (!result.rows.length) return res.status(404).json({ error: 'Secret not found.' });
      return res.json({ success: true, revoked: true, id });
    } catch (error) {
      return safeError(res, error);
    }
  });

  return router;
}

export async function saveSecretForOwner(
  ownerId: string,
  tenantId: string,
  name: string,
  provider: string,
  secret: string,
  options: SecretsRouterOptions = {}
): Promise<{ id: string; name: string; provider: string; masked_preview: string }> {
  const pool = resolvePool(options.pool);
  const configuredKey = options.encryptionKey ?? process.env.AAKSH_SECRETS_ENCRYPTION_KEY ?? '';
  if (!ownerId || !tenantId || !pool) throw new Error('Secret storage is not configured for this Owner tenant.');
  if (!name || name.length > 80 || !provider || provider.length > 40 || !secret || secret.length > 8192 || secret.includes('\u0000')) {
    throw new Error('Invalid secret metadata or value.');
  }
  const key = getEncryptionKey(configuredKey);
  const id = randomUUID();
  const encrypted = encryptSecret(secret, key, ownerId + ':' + tenantId + ':' + id);
  const masked_preview = maskSecret(secret);
  await withOwnerTenantTransaction(pool, ownerId, tenantId, client => client.query(
    'INSERT INTO app_secrets (id, owner_id, tenant_id, name, provider, masked_preview, ciphertext, nonce, auth_tag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [id, ownerId, tenantId, name, provider, masked_preview, encrypted.ciphertext, encrypted.nonce, encrypted.authTag]
  ));
  return { id, name, provider, masked_preview };
}

export async function revokeSecretsForOwner(
  ownerId: string,
  tenantId: string,
  provider: string,
  options: SecretsRouterOptions = {}
): Promise<void> {
  const pool = resolvePool(options.pool);
  if (!ownerId || !tenantId || !provider || !pool) throw new Error('Secret storage is not configured for this Owner tenant.');
  await withOwnerTenantTransaction(pool, ownerId, tenantId, client => client.query(
    'UPDATE app_secrets SET revoked_at = NOW(), updated_at = NOW() WHERE owner_id = $1 AND tenant_id = $2 AND LOWER(provider) = LOWER($3) AND revoked_at IS NULL',
    [ownerId, tenantId, provider]
  ));
}

export async function resolveActiveSecretsForOwner(
  ownerId: string,
  tenantId: string,
  options: SecretsRouterOptions = {}
): Promise<Record<string, string>> {
  const pool = resolvePool(options.pool);
  const configuredKey = options.encryptionKey ?? process.env.AAKSH_SECRETS_ENCRYPTION_KEY ?? '';
  if (!pool || !configuredKey || !ownerId || !tenantId) return {};
  try {
    const key = getEncryptionKey(configuredKey);
    const result = await withOwnerTenantTransaction(pool, ownerId, tenantId, client => client.query(
      'SELECT id, provider, name, ciphertext, nonce, auth_tag FROM app_secrets WHERE owner_id = $1 AND tenant_id = $2 AND revoked_at IS NULL ORDER BY created_at ASC',
      [ownerId, tenantId]
    ));
    const resolved: Record<string, string> = {};
    for (const row of result.rows) {
      try {
        const plain = decryptSecret(
          { ciphertext: row.ciphertext, nonce: row.nonce, authTag: row.auth_tag },
          key,
          ownerId + ':' + tenantId + ':' + row.id
        );
        if (row.provider) {
          const provider = String(row.provider).trim().toLowerCase();
          const canonical =
            /gemini/.test(provider) ? 'gemini' :
            /open.?ai/.test(provider) ? 'openai' :
            /runway|video/.test(provider) ? 'video' :
            /eleven.?labs/.test(provider) ? 'elevenlabs' :
            /n8n/.test(provider) ? 'n8n' :
            /publish|social/.test(provider) ? 'publishing' :
            /bing|brave|tavily|search/.test(provider) ? 'search' : provider;
          resolved[canonical] = plain;
          resolved[provider] = plain;
        }
        if (row.name) {
          const name = String(row.name);
          resolved[name] = plain;
          resolved[name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')] = plain;
        }
      } catch {
        // Skip corrupted or mismatched key entries safely
      }
    }
    return resolved;
  } catch {
    return {};
  }
}
