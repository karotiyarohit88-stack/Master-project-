import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash } from 'node:crypto';
import { createAuthGuards } from '../auth.ts';
import { createAutoPilotSafetyGuard } from '../src/utils/autoPilotSafetyGuard.ts';

const SESSION = 'test-session-token-with-more-than-40-characters';
const CSRF = 'test-csrf-token-with-sufficient-randomness';
const ORIGIN = 'http://127.0.0.1';

function makePool(role: 'owner' | 'member') {
  const sessionHash = createHash('sha256').update(SESSION).digest('hex');
  const csrfHash = createHash('sha256').update(CSRF).digest('hex');
  return {
    async query(sql: string, values: unknown[] = []) {
      if (sql.includes('FROM app_sessions s') && sql.includes('JOIN app_users u')) {
        return {
          rows: values[0] === sessionHash ? [{
            session_id: 'session-1',
            csrf_token_hash: csrfHash,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            id: 'user-1',
            email: 'owner@example.test',
            display_name: 'Test User',
            role
          }] : []
        };
      }
      return { rows: [] };
    },
    async connect() { throw new Error('Not used in guard integration tests'); },
    release() {}
  };
}

async function withServer(
  role: 'owner' | 'member',
  run: (url: string) => Promise<void>
) {
  let safetyEnabled = false;
  const app = express();
  app.use(express.json());
  const guards = createAuthGuards({ pool: makePool(role) as never });

  app.use('/api', guards.requireSession);
  app.use('/api', (req, res, next) => {
    const ownerOnly = req.path === '/autopilot/safety' ||
      req.path.startsWith('/autopilot/') || req.path === '/automation/trigger';
    if (!ownerOnly) return next();
    return guards.requireRole('owner')(req, res, next);
  });
  app.use('/api', createAutoPilotSafetyGuard(() => safetyEnabled));

  app.post('/api/autopilot/safety', guards.requireCsrf, (req, res) => {
    safetyEnabled = req.body?.safetyEnabled === true;
    res.json({ safetyEnabled });
  });
  app.post('/api/autopilot/config', (_req, res) => res.json({ started: true }));
  app.post('/api/automation/trigger', (_req, res) => res.json({ triggered: true }));
  app.post('/api/chat', (_req, res) => res.json({ reply: 'chat remains available' }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test TCP port');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
}

function headers(authenticated = true) {
  return {
    ...(authenticated ? { cookie: `aaksh_session=${SESSION}; aaksh_csrf=${CSRF}` } : {}),
    origin: ORIGIN,
    'x-csrf-token': CSRF,
    'content-type': 'application/json'
  };
}

test('Safety OFF blocks AutoPilot mutations with 423 while ordinary chat remains available', async () =>
  withServer('owner', async url => {
    const blocked = await fetch(`${url}/api/autopilot/config`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ isRunning: true })
    });
    assert.equal(blocked.status, 423);

    const trigger = await fetch(`${url}/api/automation/trigger`, {
      method: 'POST', headers: headers(), body: '{}'
    });
    assert.equal(trigger.status, 423);

    const chat = await fetch(`${url}/api/chat`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ message: 'Hello' })
    });
    assert.equal(chat.status, 200);
    assert.deepEqual(await chat.json(), { reply: 'chat remains available' });
  }));

test('Safety switch and AutoPilot cannot be activated without an authenticated session', async () =>
  withServer('owner', async url => {
    const safety = await fetch(`${url}/api/autopilot/safety`, {
      method: 'POST',
      headers: { ...headers(false) },
      body: JSON.stringify({ safetyEnabled: true })
    });
    assert.equal(safety.status, 401);

    const autopilot = await fetch(`${url}/api/autopilot/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isRunning: true })
    });
    assert.equal(autopilot.status, 401);
  }));

test('non-Owner authenticated sessions cannot enable Safety or mutate AutoPilot', async () =>
  withServer('member', async url => {
    const safety = await fetch(`${url}/api/autopilot/safety`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ safetyEnabled: true })
    });
    assert.equal(safety.status, 403);

    const autopilot = await fetch(`${url}/api/autopilot/config`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ isRunning: true })
    });
    assert.equal(autopilot.status, 403);
  }));

test('OTP-authenticated Owner session can enable Safety with CSRF, then AutoPilot mutation is allowed', async () =>
  withServer('owner', async url => {
    const enabled = await fetch(`${url}/api/autopilot/safety`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ safetyEnabled: true })
    });
    assert.equal(enabled.status, 200);
    assert.deepEqual(await enabled.json(), { safetyEnabled: true });

    const started = await fetch(`${url}/api/autopilot/config`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ isRunning: true })
    });
    assert.equal(started.status, 200);
  }));

test('Safety endpoint rejects a missing or invalid CSRF token', async () =>
  withServer('owner', async url => {
    const response = await fetch(`${url}/api/autopilot/safety`, {
      method: 'POST',
      headers: { cookie: `aaksh_session=${SESSION}; aaksh_csrf=${CSRF}`, origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ safetyEnabled: true })
    });
    assert.equal(response.status, 403);
  }));
