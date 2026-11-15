import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getPostgresPool } from './database.ts';

type QueryResult = { rows: any[] };
export type SecretsDbPool = {
  query: (sql: string, values?: any[]) => Promise<QueryResult>;
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

const TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS app_secrets (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    provider TEXT NOT NULL DEFAULT 'custom' CHECK (length(provider) BETWEEN 1 AND 40),
    masked_preview TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
  )
`;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

function getEncryptionKey(configuredKey: string): Buffer {
  const value = configuredKey.trim();
  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(value)) key = Buffer.from(value, 'hex');
  else {
    try { key = Buffer.from(value, 'base64'); }
    catch { throw new Error('AAKSH_SECRETS_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.'); }
  }
  if (key.length !== 32) {
    throw new Error('AAKSH_SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 3)}...${secret.slice(-4)}`;
}

export function encryptSecret(secret: string, key: Buffer, associatedData: string): EncryptedSecret {
  if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
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

async function ensureSecretsTable(pool: SecretsDbPool): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(TABLE_DDL);
      await pool.query('CREATE INDEX IF NOT EXISTS app_secrets_owner_active_idx ON app_secrets (owner_id, created_at DESC) WHERE revoked_at IS NULL');
      schemaReady = true;
    })().finally(() => { schemaPromise = null; });
  }
  await schemaPromise;
}

function safeError(res: Response, error: unknown) {
  // Never return database errors, SQL, encryption material, or secret values.
  const message = error instanceof Error ? error.message : '';
  if (message.includes('AAKSH_SECRETS_ENCRYPTION_KEY')) {
    res.status(503).json({ error: 'Secret encryption is not configured. Set AAKSH_SECRETS_ENCRYPTION_KEY to a random 32-byte key in the server environment.' });
    return;
  }
  res.status(503).json({ error: 'Secret storage is temporarily unavailable.' });
}

export function createSecretsRouter(options: SecretsRouterOptions = {}) {
  const router = Router();
  const pool = options.pool === undefined
    ? getPostgresPool() as unknown as SecretsDbPool | null
    : options.pool;
  const configuredKey = options.encryptionKey ?? process.env.AAKSH_SECRETS_ENCRYPTION_KEY ?? '';

  router.post('/', async (req: Request, res: Response) => {
    const ownerId = (res.locals.authSession as { id?: string } | undefined)?.id;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim() : 'custom';
    const secret = typeof req.body?.secret === 'string' ? req.body.secret : '';

    if (!ownerId) return res.status(401).json({ error: 'Authentication required.' });
    if (!name || name.length > 80 || !/^[A-Za-z0-9 _.-]+$/.test(name) ||
        !provider || provider.length > 40 || !/^[A-Za-z0-9 _.-]+$/.test(provider) ||
        secret.length < 1 || secret.length > 8192 || secret.includes('\u0000')) {
      return res.status(400).json({ error: 'Provide a valid name, provider, and secret (maximum 8192 characters).' });
    }
    if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured.' });

    try {
      const key = getEncryptionKey(configuredKey);
      await ensureSecretsTable(pool);
      const id = randomUUID();
      const encrypted = encryptSecret(secret, key, `${ownerId}:${id}`);
      const preview = maskSecret(secret);
      const result = await pool.query(
        `INSERT INTO app_secrets (id, owner_id, name, provider, masked_preview, ciphertext, nonce, auth_tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, provider, masked_preview, created_at`,
        [id, ownerId, name, provider, preview, encrypted.ciphertext, encrypted.nonce, encrypted.authTag]
      );
      return res.status(201).json({ success: true, secret: result.rows[0] });
    } catch (error) {
      return safeError(res, error);
    }
  });

  router.get('/', async (_req: Request, res: Response) => {
    const ownerId = (res.locals.authSession as { id?: string } | undefined)?.id;
    if (!ownerId) return res.status(401).json({ error: 'Authentication required.' });
    if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured.' });
    try {
      await ensureSecretsTable(pool);
      const result = await pool.query(
        `SELECT id, name, provider, masked_preview, created_at
           FROM app_secrets
          WHERE owner_id = $1 AND revoked_at IS NULL
          ORDER BY created_at DESC`,
        [ownerId]
      );
      return res.json({ secrets: result.rows });
    } catch (error) {
      return safeError(res, error);
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    const ownerId = (res.locals.authSession as { id?: string } | undefined)?.id;
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!ownerId) return res.status(401).json({ error: 'Authentication required.' });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'A valid secret ID is required.' });
    }
    if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured.' });
    try {
      await ensureSecretsTable(pool);
      const result = await pool.query(
        `UPDATE app_secrets SET revoked_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND owner_id = $2 AND revoked_at IS NULL
          RETURNING id`,
        [id, ownerId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Secret not found.' });
      return res.json({ success: true, revoked: true, id });
    } catch (error) {
      return safeError(res, error);
    }
  });

  return router;
}
