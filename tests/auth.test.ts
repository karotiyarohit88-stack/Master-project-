import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAuthGuards, createAuthRouter, hashPassword } from '../auth.ts';

type Row = Record<string, any>;
const PEPPER = 'unit-test-otp-pepper-value-at-least-32-characters';
const ADMIN_TOKEN = 'test-only-admin-token-with-more-than-32-characters';

class MemoryAuthDb {
  users: Row[] = [];
  sessions: Row[] = [];
  invitations: Row[] = [];
  challenges: Row[] = [];
  sentCodes: string[] = [];

  private run(sql: string, values: any[] = []): { rows: Row[] } {
    const q = sql.replace(/\\s+/g, ' ').trim().toLowerCase();
    if (q.includes('from app_sessions s') && q.includes('join app_users u')) {
      const session = this.sessions.find(x => x.session_token_hash === values[0] && !x.revoked_at && new Date(x.expires_at).getTime() > Date.now());
      const user = session && this.users.find(x => x.id === session.user_id && x.status === 'active');
      return { rows: session && user ? [{ session_id: session.id, csrf_token_hash: session.csrf_token_hash, expires_at: session.expires_at, id: user.id, email: user.email, display_name: user.display_name, role: user.role }] : [] };
    }
    if (q.startsWith('select id, email, display_name, role, password_hash, status from app_users')) {
      const user = this.users.find(x => x.email === values[0]); return { rows: user ? [{ ...user }] : [] };
    }
    if (q.startsWith('select id, email, purpose, pending_payload, user_id, invitation_id, expires_at, resend_after')) {
      const c = this.challenges.find(x => x.challenge_token_hash === values[0]); return { rows: c ? [{ ...c }] : [] };
    }
    if (q.startsWith('update app_email_otp_challenges set invalidated_at')) {
      for (const c of this.challenges) if (c.email.toLowerCase() === values[0] && c.purpose === values[1] && !c.consumed_at && !c.invalidated_at) c.invalidated_at = new Date().toISOString();
      return { rows: [] };
    }
    if (q.startsWith('insert into app_email_otp_challenges')) {
      const c = { id: String(this.challenges.length + 1), challenge_token_hash: values[0], email: values[1], purpose: values[2], otp_hash: values[3], pending_payload: JSON.parse(values[4]), user_id: values[5], invitation_id: values[6], attempts: 0, max_attempts: values[7], expires_at: new Date(values[8]).toISOString(), resend_after: new Date(values[9]).toISOString(), verified_at: null, consumed_at: null, invalidated_at: null };
      this.challenges.push(c); return { rows: [] };
    }
    if (q.startsWith('update app_email_otp_challenges set otp_hash')) {
      const c = this.challenges.find(x => x.id === values[3] && !x.consumed_at && !x.invalidated_at && new Date(x.resend_after).getTime() <= Date.now());
      if (!c) return { rows: [] };
      c.otp_hash = values[0]; c.attempts = 0; c.expires_at = new Date(values[1]).toISOString(); c.resend_after = new Date(values[2]).toISOString();
      return { rows: [{ id: c.id }] };
    }
    if (q.startsWith('insert into app_sessions')) {
      this.sessions.push({ id: String(this.sessions.length + 1), user_id: values[0], session_token_hash: values[1], csrf_token_hash: values[2], expires_at: values[3], revoked_at: null }); return { rows: [] };
    }
    if (q.startsWith('update app_users set last_login_at')) return { rows: [] };
    if (q.startsWith('update app_sessions set revoked_at')) {
      const s = this.sessions.find(x => x.id === values[0]); if (s) s.revoked_at = new Date().toISOString(); return { rows: [] };
    }
    if (q.startsWith('insert into app_invitations')) {
      const invite = { id: String(this.invitations.length + 1), email: values[0], role: values[1], invite_token_hash: values[2], created_by: values[3], created_at: new Date().toISOString(), expires_at: new Date(values[4]).toISOString(), accepted_at: null, revoked_at: null };
      this.invitations.push(invite); return { rows: [{ id: invite.id, email: invite.email, role: invite.role, created_at: invite.created_at, expires_at: invite.expires_at }] };
    }
    throw new Error('Unexpected pool SQL: ' + q);
  }

  async query(sql: string, values: any[] = []) { return this.run(sql, values); }
  async connect() {
    return {
      query: async (sql: string, values: any[] = []): Promise<{ rows: Row[] }> => {
        const q = sql.replace(/\\s+/g, ' ').trim().toLowerCase();
        if (['begin', 'commit', 'rollback'].includes(q) || q.startsWith('lock table')) return { rows: [] };
        if (q.startsWith("select count(*)::text as count from app_users where role = 'owner'")) return { rows: [{ count: String(this.users.filter(x => x.role === 'owner').length) }] };
        if (q.includes('from app_email_otp_challenges') && q.includes('for update')) {
          const c = this.challenges.find(x => x.challenge_token_hash === values[0]); return { rows: c ? [{ ...c }] : [] };
        }
        if (q.startsWith('update app_email_otp_challenges set attempts = attempts + 1')) {
          const c = this.challenges.find(x => x.id === values[0]); if (c) { c.attempts++; if (c.attempts >= c.max_attempts) c.invalidated_at = new Date().toISOString(); } return { rows: [] };
        }
        if (q.startsWith('update app_email_otp_challenges set invalidated_at')) {
          const c = this.challenges.find(x => x.id === values[0]); if (c) c.invalidated_at = new Date().toISOString(); return { rows: [] };
        }
        if (q.startsWith('update app_email_otp_challenges set verified_at')) {
          const c = this.challenges.find(x => x.id === values[0]); if (c) { c.verified_at = new Date().toISOString(); c.consumed_at = c.verified_at; } return { rows: [] };
        }
        if (q.startsWith('insert into app_users')) {
          const user = { id: String(this.users.length + 1), email: values[0], password_hash: values[1], display_name: values[2], role: values[3] || 'owner', status: 'active' };
          if (this.users.some(x => x.email === user.email)) throw Object.assign(new Error('duplicate'), { code: '23505' });
          this.users.push(user); return { rows: [{ id: user.id, email: user.email, display_name: user.display_name, role: user.role }] };
        }
        if (q.includes('from app_invitations') && q.includes('for update')) {
          const invite = this.invitations.find(x => x.id === values[0]); return { rows: invite ? [{ ...invite }] : [] };
        }
        if (q.startsWith('update app_invitations set accepted_at')) {
          const invite = this.invitations.find(x => x.id === values[0]); if (invite) invite.accepted_at = new Date().toISOString(); return { rows: [] };
        }
        if (q.startsWith('select id, email, display_name, role, status from app_users')) {
          const user = this.users.find(x => x.id === values[0]); return { rows: user ? [{ ...user }] : [] };
        }
        if (q.startsWith('insert into app_sessions')) return this.run(sql, values);
        if (q.startsWith('update app_users set last_login_at')) return { rows: [] };
        throw new Error('Unexpected transaction SQL: ' + q);
      },
      release: () => undefined
    };
  }
  release() {}
}

async function withServer(run: (url: string, db: MemoryAuthDb) => Promise<void>) {
  const db = new MemoryAuthDb();
  const app = express(); app.use(express.json());
  app.use('/api/auth', createAuthRouter({ pool: db, adminToken: ADMIN_TOKEN, otpPepper: PEPPER, sendOtp: async (_email, code) => { db.sentCodes.push(code); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test TCP port');
  try { await run(`http://127.0.0.1:${address.port}`, db); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
async function post(url: string, path: string, body: Row, headers: Record<string,string> = {}) {
  return fetch(`${url}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
function cookie(setCookie: string, name: string) {
  const m = setCookie.match(new RegExp(`(?:^|, )${name}=([^;]+)`)); if (!m) throw new Error('Missing cookie ' + name); return decodeURIComponent(m[1]);
}
async function bootstrap(url: string, email = 'owner@example.test') {
  return post(url, 'bootstrap-owner', { email, password: 'OwnerPassword!234', displayName: 'Test Owner' }, { 'x-aaksh-admin-token': ADMIN_TOKEN });
}
async function verify(url: string, challengeToken: string, otp: string) { return post(url, 'verify-otp', { challengeToken, otp }); }
function latestCode(db: MemoryAuthDb) { const code = db.sentCodes.at(-1); assert.ok(code); return code!; }

test('bootstrap Owner is created only after OTP verification and closes permanently', async () => withServer(async (url, db) => {
  const start = await bootstrap(url); assert.equal(start.status, 202); assert.equal(db.users.length, 0);
  const body = await start.json() as Row; assert.equal((await verify(url, body.challengeToken, latestCode(db))).status, 200);
  assert.equal(db.users.length, 1); assert.equal(db.users[0].role, 'owner'); assert.notEqual(db.users[0].password_hash, 'OwnerPassword!234');
  const second = await bootstrap(url, 'second@example.test'); assert.equal(second.status, 409);
}));
test('bootstrap-owner rejects missing admin authorization', async () => withServer(async url => {
  assert.equal((await post(url, 'bootstrap-owner', { email: 'owner@example.test', password: 'OwnerPassword!234', displayName: 'Owner' })).status, 401);
}));
test('login issues OTP and creates no session until successful verification; me/logout enforce CSRF', async () => withServer(async (url, db) => {
  const boot = await bootstrap(url); const bootBody = await boot.json() as Row;
  assert.equal((await verify(url, bootBody.challengeToken, latestCode(db))).status, 200);
  const start = await post(url, 'login', { email: 'owner@example.test', password: 'OwnerPassword!234' });
  assert.equal(start.status, 202); assert.equal(db.sessions.length, 1);
  const body = await start.json() as Row;
  const verified = await verify(url, body.challengeToken, latestCode(db));
  assert.equal(verified.status, 200); assert.equal(db.sessions.length, 2);
  const setCookie = verified.headers.get('set-cookie') || '';
  const cookies = `aaksh_session=${cookie(setCookie, 'aaksh_session')}; aaksh_csrf=${cookie(setCookie, 'aaksh_csrf')}`;
  const verifiedBody = await verified.json() as Row;
  const me = await fetch(`${url}/api/auth/me`, { headers: { cookie: cookies } });
  assert.equal(me.status, 200); assert.equal((await me.json() as Row).user.email, 'owner@example.test');
  assert.equal((await post(url, 'logout', {}, { cookie: cookies, origin: url, 'x-csrf-token': 'bad' })).status, 403);
  assert.equal((await post(url, 'logout', {}, { cookie: cookies, origin: url, 'x-csrf-token': verifiedBody.csrfToken })).status, 200);
}));
test('login rejects incorrect credentials without revealing account existence', async () => withServer(async url => {
  const a = await post(url, 'login', { email: 'known@example.test', password: 'WrongPassword!234' });
  const b = await post(url, 'login', { email: 'missing@example.test', password: 'WrongPassword!234' });
  assert.equal(a.status, 401); assert.deepEqual(await a.json(), await b.json());
}));
test('invalid OTP increments attempts; fifth failure invalidates challenge and blocks further verification', async () => withServer(async (url, db) => {
  const startedAt = Date.now();
  const start = await bootstrap(url); const body = await start.json() as Row;
  const challenge = db.challenges[0];
  assert.ok(new Date(challenge.expires_at).getTime() - startedAt >= 599000);
  assert.ok(new Date(challenge.expires_at).getTime() - startedAt <= 601000);
  assert.ok(new Date(challenge.resend_after).getTime() - startedAt >= 59000);
  assert.ok(new Date(challenge.resend_after).getTime() - startedAt <= 61000);
  const wrongCode = latestCode(db) === '000000' ? '000001' : '000000';
  for (let i=0;i<5;i++) assert.equal((await verify(url, body.challengeToken, wrongCode)).status, 400);
  const c = db.challenges[0]; assert.equal(c.attempts, 5); assert.ok(c.invalidated_at);
  assert.equal((await verify(url, body.challengeToken, latestCode(db))).status, 400);
  assert.equal(db.users.length, 0);
}));
test('OTP expires after ten minutes', async () => withServer(async (url, db) => {
  const start = await bootstrap(url); const body = await start.json() as Row;
  db.challenges[0].expires_at = new Date(Date.now() - 1).toISOString();
  assert.equal((await verify(url, body.challengeToken, latestCode(db))).status, 400);
  assert.equal(db.users.length, 0);
}));
test('resend enforces 60-second cooldown then rotates OTP', async () => withServer(async (url, db) => {
  const start = await bootstrap(url); const body = await start.json() as Row;
  const firstCode = latestCode(db);
  const tooSoon = await post(url, 'resend-otp', { challengeToken: body.challengeToken });
  assert.equal(tooSoon.status, 429); assert.equal(db.sentCodes.length, 1);
  db.challenges[0].resend_after = new Date(Date.now() - 1).toISOString();
  const resent = await post(url, 'resend-otp', { challengeToken: body.challengeToken });
  assert.equal(resent.status, 200); assert.equal(db.sentCodes.length, 2); assert.notEqual(latestCode(db), firstCode);
  assert.equal((await verify(url, body.challengeToken, firstCode)).status, 400);
  assert.equal((await verify(url, body.challengeToken, latestCode(db))).status, 200);
}));
test('Owner can create invitation; invited account is created only after OTP verification and token cannot be reused', async () => withServer(async (url, db) => {
  const start = await bootstrap(url); const body = await start.json() as Row;
  const verified = await verify(url, body.challengeToken, latestCode(db)); assert.equal(verified.status, 200);
  const sessionCookies = verified.headers.get('set-cookie') || '';
  const loginBody = await verified.json() as Row;
  const invitationResponse = await post(url, 'invitations', { email: 'member@example.test', role: 'member' }, {
    cookie: `aaksh_session=${cookie(sessionCookies,'aaksh_session')}; aaksh_csrf=${cookie(sessionCookies,'aaksh_csrf')}`,
    origin: url, 'x-csrf-token': loginBody.csrfToken
  });
  assert.equal(invitationResponse.status, 201);
  const invitation = await invitationResponse.json() as Row;
  const accepted = await post(url, 'accept-invitation', { token: invitation.invitationToken, password: 'MemberPassword!234', displayName: 'Member' });
  assert.equal(accepted.status, 202); assert.equal(db.users.length, 1);
  const challenge = await accepted.json() as Row;
  assert.equal((await verify(url, challenge.challengeToken, latestCode(db))).status, 201);
  assert.equal(db.users.length, 2); assert.ok(db.invitations[0].accepted_at);
  assert.equal((await post(url, 'accept-invitation', { token: invitation.invitationToken, password: 'MemberPassword!234', displayName: 'Member' })).status, 400);
}));
test('expired invitation cannot be accepted', async () => withServer(async (url, db) => {
  const start = await bootstrap(url); const b = await start.json() as Row; const verified = await verify(url,b.challengeToken,latestCode(db)); const cookies = verified.headers.get('set-cookie') || ''; const vb = await verified.json() as Row;
  const created = await post(url,'invitations',{email:'expired@example.test'}, { cookie:`aaksh_session=${cookie(cookies,'aaksh_session')}; aaksh_csrf=${cookie(cookies,'aaksh_csrf')}`, origin:url, 'x-csrf-token':vb.csrfToken });
  const invite = await created.json() as Row; db.invitations[0].expires_at = new Date(Date.now()-1000).toISOString();
  assert.equal((await post(url,'accept-invitation',{token:invite.invitationToken,password:'MemberPassword!234',displayName:'Expired'})).status,400);
}));
test('session guards reject anonymous requests and permit verified Owner', async () => withServer(async (url, db) => {
  const guards = createAuthGuards({ pool: db });
  const app = express(); app.use(express.json()); app.get('/protected', guards.requireSession, (_req,res) => res.json({allowed:true}));
  const server = app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve)); const addr=server.address(); if(!addr||typeof addr==='string') throw new Error('No guard port');
  try {
    const g=`http://127.0.0.1:${addr.port}`; assert.equal((await fetch(g+'/protected')).status,401);
    const start=await bootstrap(url); const b=await start.json() as Row; const verified=await verify(url,b.challengeToken,latestCode(db)); const set=verified.headers.get('set-cookie')||'';
    const allowed=await fetch(g+'/protected',{headers:{cookie:`aaksh_session=${cookie(set,'aaksh_session')}`}}); assert.equal(allowed.status,200);
  } finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
}));
test('password hashes verify and malformed hashes fail closed', async () => {
  const hash=await hashPassword('TestPassword!234');
  const { verifyPassword }=await import('../auth.ts');
  assert.equal(await verifyPassword('TestPassword!234',hash),true);
  assert.equal(await verifyPassword('WrongPassword!234',hash),false);
  assert.equal(await verifyPassword('TestPassword!234','plaintext'),false);
});
