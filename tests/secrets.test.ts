import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { createAuthGuards } from '../auth.ts';
import { createSecretsRouter, decryptSecret, encryptSecret, maskSecret, resolveActiveSecretsForOwner, revokeSecretsForOwner, saveSecretForOwner } from '../secrets.ts';

type Row = Record<string, any>;
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_SESSION = 'owner-session-token-value-123456789012345';
const MEMBER_SESSION = 'member-session-token-value-12345678901234';
const CSRF_TOKEN = 'csrf-token-value-123456789012345678901234';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

class MemorySecretsDb {
  rows: Row[] = [];
  async query(sql: string, values: any[] = []): Promise<{ rows: Row[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.startsWith('select s.id as session_id')) {
      const tokenHash = values[0];
      const owner = tokenHash === hash(OWNER_SESSION);
      const member = tokenHash === hash(MEMBER_SESSION);
      if (!owner && !member) return { rows: [] };
      const id = owner ? OWNER_ID : MEMBER_ID;
      return { rows: [{
        session_id: owner ? 'session-owner' : 'session-member',
        csrf_token_hash: hash(CSRF_TOKEN),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        id, email: owner ? 'owner@example.test' : 'member@example.test',
        display_name: owner ? 'Owner' : 'Member',
        role: owner ? 'owner' : 'member'
      }] };
    }
    if (normalized.startsWith('create table') || normalized.startsWith('create index')) {
      throw new Error('Runtime secret routes must never execute schema DDL.');
    }
    if (normalized.startsWith('insert into app_secrets')) {
      const row = {
        id: values[0], owner_id: values[1], name: values[2], provider: values[3],
        masked_preview: values[4], ciphertext: values[5], nonce: values[6],
        auth_tag: values[7], created_at: new Date().toISOString(), revoked_at: null
      };
      this.rows.push(row);
      return { rows: [{ id: row.id, name: row.name, provider: row.provider,
        masked_preview: row.masked_preview, created_at: row.created_at }] };
    }
    if (normalized.startsWith('select id, name, provider, masked_preview, created_at from app_secrets')) {
      return { rows: this.rows.filter(row => row.owner_id === values[0] && !row.revoked_at)
        .map(({ id, name, provider, masked_preview, created_at }) => ({ id, name, provider, masked_preview, created_at })) };
    }
    if (normalized.startsWith('update app_secrets set revoked_at')) {
      const row = this.rows.find(item => item.id === values[0] && item.owner_id === values[1] && !item.revoked_at);
      if (!row) return { rows: [] };
      row.revoked_at = new Date().toISOString();
      return { rows: [{ id: row.id }] };
    }
    throw new Error(`Unexpected SQL in secret test database: ${normalized}`);
  }
}

const encryptionKey = randomBytes(32);
const encryptionKeySetting = encryptionKey.toString('base64');

async function withServer(run: (baseUrl: string, db: MemorySecretsDb) => Promise<void>) {
  const db = new MemorySecretsDb();
  const guards = createAuthGuards({ pool: db as any });
  const app = express();
  app.use(express.json());
  app.use('/api/secrets',
    guards.requireSession,
    guards.requireRole('owner'),
    (req, res, next) => req.method === 'GET' ? next() : guards.requireCsrf(req, res, next),
    createSecretsRouter({ pool: db, encryptionKey: encryptionKeySetting })
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Secret test server did not bind a TCP port.');
  try { await run(`http://127.0.0.1:${address.port}`, db); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

function authHeaders(baseUrl: string, role: 'owner' | 'member', includeCsrf = true) {
  const session = role === 'owner' ? OWNER_SESSION : MEMBER_SESSION;
  return {
    cookie: `aaksh_session=${session}; aaksh_csrf=${CSRF_TOKEN}`,
    origin: baseUrl,
    ...(includeCsrf ? { 'x-csrf-token': CSRF_TOKEN } : {})
  };
}

test('AES-256-GCM encrypts and authenticates secret values; masking never returns the full key', () => {
  const secret = 'sk-live-super-secret-api-key-1234';
  const encrypted = encryptSecret(secret, encryptionKey, 'owner-id:secret-id');
  assert.notEqual(encrypted.ciphertext, secret);
  assert.equal(decryptSecret(encrypted, encryptionKey, 'owner-id:secret-id'), secret);
  assert.throws(() => decryptSecret(encrypted, encryptionKey, 'another-owner:secret-id'));
  assert.equal(maskSecret(secret), 'sk-...1234');
  assert.notEqual(maskSecret(secret), secret);
  assert.equal(maskSecret('short'), '••••••••');
});

test('Owner can create, list and revoke secrets; database stores ciphertext only', async () => {
  await withServer(async (baseUrl, db) => {
    const secretValue = 'sk-live-super-secret-api-key-1234';
    const created = await fetch(`${baseUrl}/api/secrets`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(baseUrl, 'owner') },
      body: JSON.stringify({ name: 'OpenAI Production', provider: 'OpenAI', secret: secretValue })
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as Row;
    assert.equal(createdBody.secret.masked_preview, 'sk-...1234');
    assert.equal(JSON.stringify(createdBody).includes(secretValue), false);
    assert.equal(db.rows.length, 1);
    assert.notEqual(db.rows[0].ciphertext, secretValue);
    assert.equal(JSON.stringify(db.rows[0]).includes(secretValue), false);
    assert.equal(decryptSecret({
      ciphertext: db.rows[0].ciphertext, nonce: db.rows[0].nonce, authTag: db.rows[0].auth_tag
    }, encryptionKey, `${OWNER_ID}:${db.rows[0].id}`), secretValue);

    const listed = await fetch(`${baseUrl}/api/secrets`, { headers: authHeaders(baseUrl, 'owner', false) });
    assert.equal(listed.status, 200);
    const listBody = await listed.json() as Row;
    assert.equal(listBody.secrets.length, 1);
    assert.equal(JSON.stringify(listBody).includes(secretValue), false);

    const deleted = await fetch(`${baseUrl}/api/secrets/${createdBody.secret.id}`, {
      method: 'DELETE', headers: authHeaders(baseUrl, 'owner')
    });
    assert.equal(deleted.status, 200);
    assert.ok(db.rows[0].revoked_at);
    const afterRevoke = await fetch(`${baseUrl}/api/secrets`, { headers: authHeaders(baseUrl, 'owner', false) });
    assert.deepEqual((await afterRevoke.json() as Row).secrets, []);
  });
});

test('anonymous and non-Owner users cannot access Secret Manager', async () => {
  await withServer(async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/secrets`);
    assert.equal(anonymous.status, 401);
    const member = await fetch(`${baseUrl}/api/secrets`, {
      headers: authHeaders(baseUrl, 'member', false)
    });
    assert.equal(member.status, 403);
  });
});

test('secret mutations reject missing or invalid CSRF tokens', async () => {
  await withServer(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/secrets`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(baseUrl, 'owner', false) },
      body: JSON.stringify({ name: 'Test', provider: 'Custom', secret: 'test-secret-value-123456' })
    });
    assert.equal(missing.status, 403);
    const invalid = await fetch(`${baseUrl}/api/secrets`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(baseUrl, 'owner'), 'x-csrf-token': 'wrong' },
      body: JSON.stringify({ name: 'Test', provider: 'Custom', secret: 'test-secret-value-123456' })
    });
    assert.equal(invalid.status, 403);
  });
});

test('Owner cannot read or revoke another owner account secret', async () => {
  await withServer(async (baseUrl, db) => {
    db.rows.push({
      id: '33333333-3333-4333-8333-333333333333', owner_id: MEMBER_ID,
      name: 'Member secret', provider: 'Custom', masked_preview: 'abc...7890',
      ciphertext: 'ciphertext', nonce: 'nonce', auth_tag: 'tag',
      created_at: new Date().toISOString(), revoked_at: null
    });
    const listed = await fetch(`${baseUrl}/api/secrets`, { headers: authHeaders(baseUrl, 'owner', false) });
    assert.equal((await listed.json() as Row).secrets.length, 0);
    const deleted = await fetch(`${baseUrl}/api/secrets/33333333-3333-4333-8333-333333333333`, {
      method: 'DELETE', headers: authHeaders(baseUrl, 'owner')
    });
    assert.equal(deleted.status, 404);
    assert.equal(db.rows[0].revoked_at, null);
  });
});

test('two Owners save and resolve separate encrypted keys without runtime DDL', async () => {
  const key = randomBytes(32);
  const ownerA = OWNER_ID;
  const ownerB = MEMBER_ID;
  const rows: Row[] = [];
  const statements: string[] = [];
  const pool = {
    async query(sql: string, values: any[] = []) {
      statements.push(sql);
      assert.equal(/^\s*(create|alter|drop)\b/i.test(sql), false, 'runtime secret calls must not perform DDL');
      if (sql.trim().toLowerCase().startsWith('insert into app_secrets')) {
        rows.push({
          id: values[0], owner_id: values[1], name: values[2], provider: values[3],
          masked_preview: values[4], ciphertext: values[5], nonce: values[6], auth_tag: values[7],
          revoked_at: null
        });
        return { rows: [] };
      }
      assert.match(sql, /where owner_id = \$1 and revoked_at is null/i);
      return { rows: rows.filter(row => row.owner_id === values[0]) };
    }
  };
  await Promise.all([
    saveSecretForOwner(ownerA, 'OpenAI API Key', 'openai', 'owner-a-openai-key', { pool, encryptionKey: key.toString('base64') }),
    saveSecretForOwner(ownerB, 'OpenAI API Key', 'openai', 'owner-b-openai-key', { pool, encryptionKey: key.toString('base64') })
  ]);
  const [a, b] = await Promise.all([
    resolveActiveSecretsForOwner(ownerA, { pool, encryptionKey: key.toString('base64') }),
    resolveActiveSecretsForOwner(ownerB, { pool, encryptionKey: key.toString('base64') })
  ]);
  assert.equal(a.openai, 'owner-a-openai-key');
  assert.equal(b.openai, 'owner-b-openai-key');
  assert.notEqual(a.openai, b.openai);
  assert.equal(rows.length, 2);
  assert.equal(statements.some(sql => /^\s*(create|alter|drop)\b/i.test(sql)), false);
});

test('secret revocation is restricted to the selected Owner and provider', async () => {
  let capturedSql = '';
  let capturedValues: any[] = [];
  const pool = {
    async query(sql: string, values: any[] = []) {
      capturedSql = sql;
      capturedValues = values;
      return { rows: [] };
    }
  };
  await revokeSecretsForOwner(OWNER_ID, 'github', { pool });
  assert.match(capturedSql, /update app_secrets/i);
  assert.match(capturedSql, /owner_id = \$1/i);
  assert.match(capturedSql, /lower\(provider\) = lower\(\$2\)/i);
  assert.deepEqual(capturedValues, [OWNER_ID, 'github']);
});
