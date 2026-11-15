import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash } from 'node:crypto';
import { createAuthRouter, hashPassword } from '../auth.ts';

type Row = Record<string, any>;

class MemoryAuthDb {
  users: Row[] = [];
  sessions: Row[] = [];
  invitations: Row[] = [];
  async query(sql: string, values: any[] = []): Promise<{ rows: Row[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.includes('from app_sessions s') && normalized.includes('join app_users u')) {
      const session = this.sessions.find((item) =>
        item.session_token_hash === values[0] && !item.revoked_at &&
        new Date(item.expires_at).getTime() > Date.now());
      const user = session && this.users.find((item) => item.id === session.user_id && item.status === 'active');
      return { rows: session && user ? [{
        session_id: session.id, csrf_token_hash: session.csrf_token_hash,
        expires_at: session.expires_at, id: user.id, email: user.email,
        display_name: user.display_name, role: user.role
      }] : [] };
    }
    if (normalized.startsWith('select id, email, display_name, role, password_hash, status from app_users')) {
      const user = this.users.find((item) => item.email === values[0]);
      return { rows: user ? [user] : [] };
    }
    if (normalized.startsWith('insert into app_sessions')) {
      this.sessions.push({
        id: String(this.sessions.length + 1), user_id: values[0],
        session_token_hash: values[1], csrf_token_hash: values[2],
        expires_at: values[3], revoked_at: null
      });
      return { rows: [] };
    }
    if (normalized.startsWith('update app_users set last_login_at')) return { rows: [] };
    if (normalized.startsWith('update app_sessions set revoked_at')) {
      const session = this.sessions.find((item) => item.id === values[0]);
      if (session) session.revoked_at = new Date().toISOString();
      return { rows: [] };
    }
    if (normalized.startsWith('insert into app_invitations')) {
      const invitation = {
        id: String(this.invitations.length + 1), email: values[0], role: values[1],
        invite_token_hash: values[2], created_by: values[3],
        created_at: new Date().toISOString(), expires_at: values[4],
        accepted_at: null, revoked_at: null
      };
      this.invitations.push(invitation);
      return { rows: [{ id: invitation.id, email: invitation.email, role: invitation.role,
        created_at: invitation.created_at, expires_at: invitation.expires_at }] };
    }
    throw new Error(`Unexpected SQL in test database: ${normalized}`);
  }
  async connect() {
    return {
      query: async (sql: string, values: any[] = []): Promise<{ rows: Row[] }> => {
        const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        if (['begin', 'commit', 'rollback'].includes(normalized) || normalized.startsWith('lock table')) return { rows: [] };
        if (normalized.startsWith("select count(*)::text as count from app_users where role = 'owner'")) {
          return { rows: [{ count: String(this.users.filter((user) => user.role === 'owner').length) }] };
        }
        if (normalized.startsWith('insert into app_users')) {
          const user = {
            id: String(this.users.length + 1),
            email: values[0], password_hash: values[1], display_name: values[2],
            role: values[3] || 'owner', status: 'active'
          };
          if (this.users.some((item) => item.email === user.email)) throw Object.assign(new Error('duplicate'), { code: '23505' });
          this.users.push(user);
          return { rows: [{ id: user.id, email: user.email, display_name: user.display_name, role: user.role }] };
        }
        if (normalized.includes('from app_invitations') && normalized.includes('for update')) {
          const invitation = this.invitations.find((item) => item.invite_token_hash === values[0]);
          return { rows: invitation ? [{ ...invitation }] : [] };
        }
        if (normalized.startsWith('update app_invitations set accepted_at')) {
          const invitation = this.invitations.find((item) => item.id === values[0]);
          if (invitation) invitation.accepted_at = new Date().toISOString();
          return { rows: [] };
        }
        throw new Error(`Unexpected transaction SQL in test database: ${normalized}`);
      },
      release: () => undefined
    };
  }
}

const ADMIN_TOKEN = 'test-only-admin-token-with-more-than-32-characters';

async function withServer(run: (baseUrl: string, db: MemoryAuthDb) => Promise<void>) {
  const db = new MemoryAuthDb();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ pool: db, adminToken: ADMIN_TOKEN }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
  try { await run(`http://127.0.0.1:${address.port}`, db); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function cookieValue(setCookie: string, name: string): string {
  const match = setCookie.match(new RegExp(`(?:^|, )${name}=([^;]+)`));
  if (!match) throw new Error(`Missing ${name} cookie: ${setCookie}`);
  return decodeURIComponent(match[1]);
}

async function post(baseUrl: string, path: string, body: Row, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/auth/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

async function bootstrap(baseUrl: string, email = 'owner@example.test') {
  return post(baseUrl, 'bootstrap-owner', {
    email, password: 'OwnerPassword!234', displayName: 'Test Owner'
  }, { 'x-aaksh-admin-token': ADMIN_TOKEN });
}

async function login(baseUrl: string, email: string, password: string) {
  return post(baseUrl, 'login', { email, password });
}

test('bootstrap-owner creates one Owner and permanently closes after Owner exists', async () => {
  await withServer(async (baseUrl, db) => {
    const created = await bootstrap(baseUrl);
    assert.equal(created.status, 201);
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].role, 'owner');
    assert.notEqual(db.users[0].password_hash, 'OwnerPassword!234');
    const second = await bootstrap(baseUrl, 'second@example.test');
    assert.equal(second.status, 409);
    assert.equal(db.users.length, 1);
  });
});

test('bootstrap-owner rejects missing admin authorization', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, 'bootstrap-owner', {
      email: 'owner@example.test', password: 'OwnerPassword!234', displayName: 'Owner'
    });
    assert.equal(response.status, 401);
  });
});

test('login, me and logout enforce session and CSRF checks', async () => {
  await withServer(async (baseUrl, db) => {
    assert.equal((await bootstrap(baseUrl)).status, 201);
    const response = await login(baseUrl, 'owner@example.test', 'OwnerPassword!234');
    assert.equal(response.status, 200);
    const body = await response.json() as Row;
    assert.equal(body.user.role, 'owner');
    const setCookie = response.headers.get('set-cookie') || '';
    const session = cookieValue(setCookie, 'aaksh_session');
    const csrfCookie = cookieValue(setCookie, 'aaksh_csrf');
    assert.equal(db.sessions[0].session_token_hash, digest(session));
    assert.notEqual(db.sessions[0].session_token_hash, session);

    const cookies = `aaksh_session=${session}; aaksh_csrf=${csrfCookie}`;
    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookies } });
    assert.equal(me.status, 200);
    assert.equal((await me.json() as Row).user.email, 'owner@example.test');

    const rejectedLogout = await post(baseUrl, 'logout', {}, {
      cookie: cookies, origin: baseUrl, 'x-csrf-token': 'wrong-token'
    });
    assert.equal(rejectedLogout.status, 403);

    const logout = await post(baseUrl, 'logout', {}, {
      cookie: cookies, origin: baseUrl, 'x-csrf-token': body.csrfToken
    });
    assert.equal(logout.status, 200);
    assert.ok(db.sessions[0].revoked_at);

    const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookies } });
    assert.equal(afterLogout.status, 401);
  });
});

test('login rejects incorrect credentials without revealing account existence', async () => {
  await withServer(async (baseUrl) => {
    await bootstrap(baseUrl);
    const known = await login(baseUrl, 'owner@example.test', 'WrongPassword!234');
    const unknown = await login(baseUrl, 'missing@example.test', 'WrongPassword!234');
    assert.equal(known.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await known.json(), await unknown.json());
  });
});

test('only authenticated Owner can create invitation and only token hash is stored', async () => {
  await withServer(async (baseUrl, db) => {
    await bootstrap(baseUrl);
    const loginResponse = await login(baseUrl, 'owner@example.test', 'OwnerPassword!234');
    const loginBody = await loginResponse.json() as Row;
    const setCookie = loginResponse.headers.get('set-cookie') || '';
    const cookies = `aaksh_session=${cookieValue(setCookie, 'aaksh_session')}; aaksh_csrf=${cookieValue(setCookie, 'aaksh_csrf')}`;
    const created = await post(baseUrl, 'invitations', {
      email: 'member@example.test', role: 'member', expiresInHours: 24
    }, { cookie: cookies, origin: baseUrl, 'x-csrf-token': loginBody.csrfToken });
    assert.equal(created.status, 201);
    const body = await created.json() as Row;
    assert.match(body.invitationToken, /^[A-Za-z0-9_-]{40,60}$/);
    assert.equal(db.invitations[0].invite_token_hash, digest(body.invitationToken));
    assert.notEqual(db.invitations[0].invite_token_hash, body.invitationToken);
    assert.equal(JSON.stringify(db.invitations[0]).includes(body.invitationToken), false);
  });
});

test('accept-invitation creates an active account once and rejects token reuse', async () => {
  await withServer(async (baseUrl, db) => {
    await bootstrap(baseUrl);
    const ownerLogin = await login(baseUrl, 'owner@example.test', 'OwnerPassword!234');
    const ownerBody = await ownerLogin.json() as Row;
    const ownerCookies = ownerLogin.headers.get('set-cookie') || '';
    const created = await post(baseUrl, 'invitations', { email: 'member@example.test', role: 'member' }, {
      cookie: `aaksh_session=${cookieValue(ownerCookies, 'aaksh_session')}; aaksh_csrf=${cookieValue(ownerCookies, 'aaksh_csrf')}`,
      origin: baseUrl, 'x-csrf-token': ownerBody.csrfToken
    });
    const invitation = await created.json() as Row;
    const acceptBody = { token: invitation.invitationToken, password: 'MemberPassword!234', displayName: 'Member One' };
    const accepted = await post(baseUrl, 'accept-invitation', acceptBody);
    assert.equal(accepted.status, 201);
    assert.equal(db.users.find((user) => user.email === 'member@example.test')?.status, 'active');
    assert.equal(db.invitations[0].accepted_at !== null, true);
    const reused = await post(baseUrl, 'accept-invitation', acceptBody);
    assert.equal(reused.status, 400);
  });
});

test('accept-invitation rejects expired invitation', async () => {
  await withServer(async (baseUrl, db) => {
    await bootstrap(baseUrl);
    const ownerLogin = await login(baseUrl, 'owner@example.test', 'OwnerPassword!234');
    const ownerBody = await ownerLogin.json() as Row;
    const ownerCookies = ownerLogin.headers.get('set-cookie') || '';
    const created = await post(baseUrl, 'invitations', { email: 'expired@example.test' }, {
      cookie: `aaksh_session=${cookieValue(ownerCookies, 'aaksh_session')}; aaksh_csrf=${cookieValue(ownerCookies, 'aaksh_csrf')}`,
      origin: baseUrl, 'x-csrf-token': ownerBody.csrfToken
    });
    const invitation = await created.json() as Row;
    db.invitations[0].expires_at = new Date(Date.now() - 1000).toISOString();
    const expired = await post(baseUrl, 'accept-invitation', {
      token: invitation.invitationToken, password: 'MemberPassword!234', displayName: 'Expired User'
    });
    assert.equal(expired.status, 400);
    assert.equal(db.users.length, 1);
  });
});

test('non-Owner authenticated account cannot create invitations', async () => {
  await withServer(async (baseUrl, db) => {
    await bootstrap(baseUrl);
    const ownerLogin = await login(baseUrl, 'owner@example.test', 'OwnerPassword!234');
    const ownerBody = await ownerLogin.json() as Row;
    const ownerCookies = ownerLogin.headers.get('set-cookie') || '';
    const invitationResponse = await post(baseUrl, 'invitations', { email: 'member@example.test' }, {
      cookie: `aaksh_session=${cookieValue(ownerCookies, 'aaksh_session')}; aaksh_csrf=${cookieValue(ownerCookies, 'aaksh_csrf')}`,
      origin: baseUrl, 'x-csrf-token': ownerBody.csrfToken
    });
    const invitation = await invitationResponse.json() as Row;
    await post(baseUrl, 'accept-invitation', {
      token: invitation.invitationToken, password: 'MemberPassword!234', displayName: 'Member'
    });
    const memberLogin = await login(baseUrl, 'member@example.test', 'MemberPassword!234');
    const memberBody = await memberLogin.json() as Row;
    const memberCookies = memberLogin.headers.get('set-cookie') || '';
    const denied = await post(baseUrl, 'invitations', { email: 'other@example.test' }, {
      cookie: `aaksh_session=${cookieValue(memberCookies, 'aaksh_session')}; aaksh_csrf=${cookieValue(memberCookies, 'aaksh_csrf')}`,
      origin: baseUrl, 'x-csrf-token': memberBody.csrfToken
    });
    assert.equal(denied.status, 403);
    assert.equal(db.invitations.length, 1);
  });
});

test('password hashes verify and malformed hashes fail closed', async () => {
  const hash = await hashPassword('TestPassword!234');
  assert.equal(await (await import('../auth.ts')).verifyPassword('TestPassword!234', hash), true);
  assert.equal(await (await import('../auth.ts')).verifyPassword('WrongPassword!234', hash), false);
  assert.equal(await (await import('../auth.ts')).verifyPassword('TestPassword!234', 'plaintext'), false);
});
