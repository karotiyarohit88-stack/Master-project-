import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import express from 'express';
import { createAuthGuards, createAuthRouter, createCsrfMutationGuard, hashPassword } from '../auth.ts';
import { createAgentTaskRouter } from '../taskQueue.ts';
import { createUnifiedWorkspaceRouter } from '../unifiedWorkspaces.ts';

type Row = Record<string, any>;
const PEPPER = 'unit-test-otp-pepper-value-at-least-32-characters';
const ADMIN_TOKEN = 'test-only-admin-token-with-more-than-32-characters';

class MemoryAuthDb {
  users: Row[] = [];
  sessions: Row[] = [];
  invitations: Row[] = [];
  tenants: Row[] = [];
  memberships: Row[] = [];
  challenges: Row[] = [];
  sentCodes: string[] = [];
  tasks: Row[] = [];
  taskEvents: Row[] = [];

  private run(sql: string, values: any[] = []): { rows: Row[] } {
    const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();
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
    if (q.startsWith('select t.id as tenant_id, m.membership_role from app_tenant_memberships')) {
      const rows = this.memberships.filter(m => m.user_id === values[0] && m.status === 'active')
        .map(m => ({ membership: m, tenant: this.tenants.find(t => t.id === m.tenant_id && t.status === 'active') }))
        .filter(x => x.tenant)
        .map(x => ({ tenant_id: x.tenant!.id, membership_role: x.membership.membership_role }));
      return { rows: rows.slice(0, 2) };
    }
    if (q.startsWith('select id, task_type, original_prompt, payload, status') && q.includes('from agent_tasks')) {
      return { rows: this.tasks.filter(task => task.tenant_id === values[0]).slice(0, Number(values[1] || 50)) };
    }
    if (q.startsWith('select t.id as tenant_id from app_tenant_memberships')) {
      const rows = this.memberships.filter(m => m.user_id === values[0] && m.status === 'active' && m.membership_role === 'owner')
        .map(m => this.tenants.find(t => t.id === m.tenant_id && t.status === 'active')).filter(Boolean)
        .map(t => ({ tenant_id: t!.id }));
      return { rows: rows.slice(0, 2) };
    }
    if (q.startsWith('insert into app_invitations')) {
      const invite = { id: String(this.invitations.length + 1), tenant_id: values[0], email: values[1], role: values[2], invite_token_hash: values[3], created_by: values[4], created_at: new Date().toISOString(), expires_at: new Date(values[5]).toISOString(), accepted_at: null, revoked_at: null };
      this.invitations.push(invite); return { rows: [{ id: invite.id, tenant_id: invite.tenant_id, email: invite.email, role: invite.role, created_at: invite.created_at, expires_at: invite.expires_at }] };
    }
    throw new Error('Unexpected pool SQL: ' + q);
  }

  async query(sql: string, values: any[] = []) { return this.run(sql, values); }
  async connect() {
    return {
      query: async (sql: string, values: any[] = []): Promise<{ rows: Row[] }> => {
        const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        if (['begin', 'commit', 'rollback'].includes(q) || q.startsWith('lock table')) return { rows: [] };
        if (q.startsWith("select count(*)::text as count from app_users where role = 'owner'")) return { rows: [{ count: String(this.users.filter(x => x.role === 'owner').length) }] };
        if (q.startsWith('insert into agent_tasks')) {
          const task = {
            id: '2c4c3d4e-5f60-4a71-8b92-123456789abc',
            tenant_id: values[0], owner_id: values[1], idempotency_key: values[2],
            task_type: 'integration', original_prompt: values[3], payload: JSON.parse(String(values[4])),
            status: 'waiting_approval', requires_approval: true, approved_by: null, approved_at: null,
            result: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null
          };
          this.tasks.push(task);
          return { rows: [task] };
        }
        if (q.startsWith('update agent_tasks') && q.includes("set status = 'queued'")) {
          const task = this.tasks.find(x => x.id === values[0] && x.tenant_id === values[1] && x.status === 'waiting_approval');
          if (!task) return { rows: [] };
          task.status = 'queued'; task.approved_by = values[2]; task.approved_at = new Date().toISOString();
          return { rows: [{ id: task.id, owner_id: task.owner_id }] };
        }
        if (q.startsWith('insert into agent_task_events')) {
          const eventType = sql.match(/VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*'([^']+)'/i)?.[1] || 'unknown';
          this.taskEvents.push({ task_id: values[0], tenant_id: values[1], owner_id: values[2], event_type: eventType, status: 'recorded' });
          return { rows: [] };
        }
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
        if (q.startsWith('insert into app_tenants')) {
          const tenant = { id: String(this.tenants.length + 1), display_name: values[0], owner_user_id: values[1], status: 'active' };
          this.tenants.push(tenant); return { rows: [{ id: tenant.id }] };
        }
        if (q.startsWith('insert into app_tenant_memberships')) {
          const membership = { id: String(this.memberships.length + 1), tenant_id: values[0], user_id: values[1], membership_role: q.includes("'owner'") ? 'owner' : values[2], status: 'active' };
          this.memberships.push(membership); return { rows: [] };
        }
        if (q.includes('from app_invitations') && q.includes('for update')) {
          const invite = q.includes('where invite_token_hash') ? this.invitations.find(x => x.invite_token_hash === values[0]) : this.invitations.find(x => x.id === values[0]);
          const tenant = invite && this.tenants.find(x => x.id === invite.tenant_id && x.status === 'active');
          return { rows: invite ? [{ ...invite, active_tenant_id: tenant?.id ?? null }] : [] };
        }
        if (q.startsWith('insert into app_tenant_memberships')) {
          const membership = { id: String(this.memberships.length + 1), tenant_id: values[0], user_id: values[1], membership_role: values[2], status: values[3] || 'active' };
          this.memberships.push(membership); return { rows: [] };
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

async function withServer(run: (url: string, db: MemoryAuthDb) => Promise<void>, mount?: (app: any, db: MemoryAuthDb) => void) {
  const db = new MemoryAuthDb();
  const app = express(); app.use(express.json());
  app.use('/api/auth', createAuthRouter({ pool: db, adminToken: ADMIN_TOKEN, otpPepper: PEPPER, sendOtp: async (_email, code) => { db.sentCodes.push(code); } }));
  if (mount) mount(app, db);
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
  assert.equal(db.tenants.length, 1); assert.equal(db.memberships.length, 1);
  assert.equal(db.memberships[0].user_id, db.users[0].id); assert.equal(db.memberships[0].membership_role, 'owner');
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
  assert.equal(invitation.invitation.tenant_id, db.tenants[0].id);
  const accepted = await post(url, 'accept-invitation', { token: invitation.invitationToken, password: 'MemberPassword!234', displayName: 'Member' });
  assert.equal(accepted.status, 202); assert.equal(db.users.length, 1);
  const challenge = await accepted.json() as Row;
  assert.equal((await verify(url, challenge.challengeToken, latestCode(db))).status, 201);
  assert.equal(db.users.length, 2); assert.ok(db.invitations[0].accepted_at);
  assert.equal(db.memberships.length, 2);
  assert.equal(db.memberships[1].tenant_id, db.tenants[0].id);
  assert.equal(db.memberships[1].user_id, db.users[1].id);
  assert.equal(db.memberships[1].membership_role, 'member');
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

test('tenant membership guard resolves exactly one active workspace from the authenticated session', async () => withServer(async (url, db) => {
  const start = await bootstrap(url);
  const body = await start.json() as Row;
  const verified = await verify(url, body.challengeToken, latestCode(db));
  assert.equal(verified.status, 200);
  const setCookie = verified.headers.get('set-cookie') || '';
  const guards = createAuthGuards({ pool: db });
  const app = express();
  app.use(express.json());
  app.get('/tenant-protected', guards.requireSession, guards.requireTenantMembership, (_req, res) => {
    res.json({ tenant: res.locals.tenantContext });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No tenant guard port');
  const target = `http://127.0.0.1:${address.port}/tenant-protected`;
  try {
    const cookies = `aaksh_session=${cookie(setCookie, 'aaksh_session')}`;
    const allowed = await fetch(target, { headers: { cookie: cookies } });
    assert.equal(allowed.status, 200);
    const result = await allowed.json() as Row;
    assert.equal(result.tenant.tenantId, db.tenants[0].id);
    assert.equal(result.tenant.role, 'owner');
    db.memberships[0].status = 'suspended';
    assert.equal((await fetch(target, { headers: { cookie: cookies } })).status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}));

test('password hashes verify and malformed hashes fail closed', async () => {
  const hash=await hashPassword('TestPassword!234');
  const { verifyPassword }=await import('../auth.ts');
  assert.equal(await verifyPassword('TestPassword!234',hash),true);
  assert.equal(await verifyPassword('WrongPassword!234',hash),false);
  assert.equal(await verifyPassword('TestPassword!234','plaintext'),false);
});


test('API mutation CSRF guard rejects missing tokens and accepts the session-bound token', async () => withServer(async (url, db) => {
  const started = await bootstrap(url);
  const challenge = await started.json() as Row;
  const verified = await verify(url, challenge.challengeToken, latestCode(db));
  assert.equal(verified.status, 200);
  const setCookie = verified.headers.get('set-cookie') || '';
  const verifiedBody = await verified.json() as Row;
  const cookies = `aaksh_session=${cookie(setCookie, 'aaksh_session')}; aaksh_csrf=${cookie(setCookie, 'aaksh_csrf')}`;

  const guards = createAuthGuards({ pool: db });
  const protectedApp = express();
  protectedApp.use(express.json());
  protectedApp.use('/api', guards.requireSession, createCsrfMutationGuard(guards.requireCsrf));
  protectedApp.post('/api/mutate', (_req, res) => res.json({ allowed: true }));
  protectedApp.get('/api/read', (_req, res) => res.json({ allowed: true }));
  const protectedServer = protectedApp.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => protectedServer.once('listening', resolve));
  const address = protectedServer.address();
  if (!address || typeof address === 'string') throw new Error('No protected test port');
  const protectedUrl = `http://127.0.0.1:${address.port}`;

  try {
    const common = { cookie: cookies, origin: protectedUrl };
    assert.equal((await fetch(protectedUrl + '/api/mutate', {
      method: 'POST', headers: { ...common, 'content-type': 'application/json' }, body: '{}'
    })).status, 403);
    assert.equal((await fetch(protectedUrl + '/api/mutate', {
      method: 'POST', headers: { ...common, 'content-type': 'application/json', 'x-csrf-token': verifiedBody.csrfToken }, body: '{}'
    })).status, 200);
    assert.equal((await fetch(protectedUrl + '/api/read', { headers: { cookie: cookies } })).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => protectedServer.close(error => error ? reject(error) : resolve()));
  }
}));


test('one Master login session accesses AAKSH work and Master approvals through the same tenant queue', async () => withServer(async (url, db) => {
  const started = await bootstrap(url);
  const bootstrapBody = await started.json() as Row;
  assert.equal((await verify(url, bootstrapBody.challengeToken, latestCode(db))).status, 200);

  const loginStart = await post(url, 'login', { email: 'owner@example.test', password: 'OwnerPassword!234' });
  assert.equal(loginStart.status, 202);
  const loginBody = await loginStart.json() as Row;
  const loginVerified = await verify(url, loginBody.challengeToken, latestCode(db));
  assert.equal(loginVerified.status, 200);
  const setCookie = loginVerified.headers.get('set-cookie') || '';
  const verifiedBody = await loginVerified.json() as Row;
  const cookies = `aaksh_session=${cookie(setCookie, 'aaksh_session')}; aaksh_csrf=${cookie(setCookie, 'aaksh_csrf')}`;

  const create = await fetch(url + '/api/aaksh/work/tasks', {
    method: 'POST',
    headers: { cookie: cookies, origin: url, 'x-csrf-token': verifiedBody.csrfToken, 'content-type': 'application/json' },
    body: JSON.stringify({ platform: 'website', category: 'seo', title: 'Shared auth E2E', description: 'Created through AAKSH adapter.' })
  });
  assert.equal(create.status, 201);
  const created = await create.json() as Row;
  const taskId = created.task.id;
  assert.equal(created.task.status, 'awaiting_approval');
  assert.equal(db.tasks.length, 1);
  assert.equal(db.tasks[0].tenant_id, db.tenants[0].id);

  const approval = await fetch(url + '/api/tasks/' + taskId + '/approve', {
    method: 'POST',
    headers: { cookie: cookies, origin: url, 'x-csrf-token': verifiedBody.csrfToken }
  });
  assert.equal(approval.status, 200);
  const approved = await approval.json() as Row;
  assert.equal(approved.status, 'queued');
  assert.equal(approved.executionStarted, false);
  assert.equal(db.tasks[0].status, 'queued');
  assert.ok(db.taskEvents.some(event => event.event_type === 'created'));
  assert.ok(db.taskEvents.some(event => event.event_type === 'approved'));
}, (app, db) => {
  const guards = createAuthGuards({ pool: db as any });
  app.use('/api', guards.requireSession, createCsrfMutationGuard(guards.requireCsrf));
  app.use('/api/tasks', guards.requireTenantMembership, createAgentTaskRouter({ pool: db as any }));
  const routers = createUnifiedWorkspaceRouter({ pool: db as any });
  app.use('/api/aaksh', guards.requireTenantMembership, routers.aaksh);
  app.use('/api/publishing', guards.requireTenantMembership, routers.publishing);
}));


test('legacy AAKSH scrypt password hashes remain verifiable during account migration', async () => {
  const password = 'LegacyAccountPassword!234';
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64).toString('hex');
  const legacyHash = 'scrypt$' + salt.toString('hex') + '$' + digest;
  const { verifyPassword } = await import('../auth.ts');
  assert.equal(await verifyPassword(password, legacyHash), true);
  assert.equal(await verifyPassword('WrongLegacyPassword!234', legacyHash), false);
});
