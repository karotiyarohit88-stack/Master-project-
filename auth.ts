import { Router, type Request, type Response, type RequestHandler } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { getPostgresPool } from './database.ts';

const SESSION_COOKIE = 'aaksh_session';
const CSRF_COOKIE = 'aaksh_csrf';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, number[]>();

type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
};

type AuthSession = AuthUser & {
  session_id: string;
  csrf_token_hash: string;
  expires_at: string;
};

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt);
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== '16384' ||
      parts[2] !== '8' || parts[3] !== '1' ||
      !/^[a-f0-9]{32}$/i.test(parts[4]) || !/^[a-f0-9]{128}$/i.test(parts[5])) {
    return false;
  }

  try {
    const expected = Buffer.from(parts[5], 'hex');
    const actual = await deriveKey(password, Buffer.from(parts[4], 'hex'));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly?: boolean; secure: boolean; maxAge: number }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`
  ];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function clearAuthCookies(res: Response, secure: boolean) {
  res.setHeader('Set-Cookie', [
    serializeCookie(SESSION_COOKIE, '', { httpOnly: true, secure, maxAge: 0 }),
    serializeCookie(CSRF_COOKIE, '', { secure, maxAge: 0 })
  ]);
}

function requestUsesSecureCookies(req: Request): boolean {
  return process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}

function hasSameOrigin(req: Request): boolean {
  const origin = req.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

function rejectCrossOriginIfPresent(req: Request, res: Response): boolean {
  const origin = req.get('origin');
  if (origin && !hasSameOrigin(req)) {
    res.status(403).json({ error: 'Cross-origin authentication request rejected.' });
    return true;
  }
  if (req.get('sec-fetch-site') === 'cross-site') {
    res.status(403).json({ error: 'Cross-site authentication request rejected.' });
    return true;
  }
  return false;
}

function getLoginRateLimitKey(req: Request, email: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return sha256(`${ip.toLowerCase()}|${email.toLowerCase()}`);
}

function isLoginRateLimited(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  for (const [entryKey, timestamps] of loginAttempts) {
    const active = timestamps.filter((timestamp) => now - timestamp < LOGIN_WINDOW_MS);
    if (active.length) loginAttempts.set(entryKey, active);
    else loginAttempts.delete(entryKey);
  }
  const attempts = loginAttempts.get(key) || [];
  if (attempts.length >= LOGIN_MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - attempts[0])) / 1000))
    };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

function recordFailedLogin(key: string) {
  const attempts = loginAttempts.get(key) || [];
  attempts.push(Date.now());
  loginAttempts.set(key, attempts);
}

function validateCredentials(emailValue: unknown, passwordValue: unknown) {
  const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { valid: false, email, password };
  }
  if (password.length < 12 || password.length > 128 || password.includes('\u0000')) {
    return { valid: false, email, password };
  }
  return { valid: true, email, password };
}

async function loadSession(req: Request): Promise<AuthSession | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const pool = getPostgresPool();
  if (!pool) return null;

  const result = await pool.query<AuthSession>(
    `SELECT s.id AS session_id, s.csrf_token_hash, s.expires_at,
            u.id, u.email, u.display_name, u.role
       FROM app_sessions s
       JOIN app_users u ON u.id = s.user_id
      WHERE s.session_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1`,
    [sha256(token)]
  );
  return result.rows[0] || null;
}

const requireSession: RequestHandler = async (req, res, next) => {
  try {
    const session = await loadSession(req);
    if (!session) {
      clearAuthCookies(res, requestUsesSecureCookies(req));
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    res.locals.authSession = session;
    next();
  } catch {
    res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
  }
};

const requireCsrf: RequestHandler = (req, res, next) => {
  const session = res.locals.authSession as AuthSession | undefined;
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE] || '';
  const headerToken = req.get('x-csrf-token') || '';

  if (!session || !hasSameOrigin(req) || !cookieToken ||
      !constantTimeTextEqual(cookieToken, headerToken) ||
      !constantTimeTextEqual(sha256(cookieToken), session.csrf_token_hash)) {
    res.status(403).json({ error: 'CSRF validation failed.' });
    return;
  }
  next();
};

function publicUser(user: AuthUser) {
  return { id: user.id, email: user.email, displayName: user.display_name, role: user.role };
}

function isValidAdminBootstrapToken(providedToken: string): boolean {
  const expectedToken = process.env.AAKSH_ADMIN_TOKEN || '';
  return expectedToken.length >= 32 && constantTimeTextEqual(providedToken, expectedToken);
}

export function createAuthRouter() {
  const router = Router();

  router.post('/bootstrap-owner', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    if (!isValidAdminBootstrapToken(req.get('x-aaksh-admin-token') || '')) {
      res.status(401).json({ error: 'Administrative bootstrap authorization required.' });
      return;
    }

    const credentials = validateCredentials(req.body?.email, req.body?.password);
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!credentials.valid || displayName.length < 1 || displayName.length > 100) {
      res.status(400).json({ error: 'Provide a valid email, a password of 12–128 characters, and a display name.' });
      return;
    }

    const pool = getPostgresPool();
    if (!pool) {
      res.status(503).json({ error: 'PostgreSQL is not configured.' });
      return;
    }

    let client;
    try {
      const passwordHash = await hashPassword(credentials.password);
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query('LOCK TABLE app_users IN EXCLUSIVE MODE');
      const count = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM app_users');
      if (Number(count.rows[0]?.count || 0) !== 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Owner bootstrap is permanently closed because an account already exists.' });
        return;
      }

      const created = await client.query<AuthUser>(
        `INSERT INTO app_users (email, password_hash, display_name, role, status, email_verified_at)
         VALUES ($1, $2, $3, 'owner', 'active', NOW())
         RETURNING id, email, display_name, role`,
        [credentials.email, passwordHash, displayName]
      );
      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        user: publicUser(created.rows[0]),
        message: 'Owner account created. Sign in using the login endpoint.'
      });
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
      }
      if ((error as { code?: string })?.code === '23505') {
        res.status(409).json({ error: 'An account with this email already exists.' });
      } else {
        res.status(503).json({ error: 'Owner bootstrap could not be completed.' });
      }
    } finally {
      client?.release();
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    const credentials = validateCredentials(req.body?.email, req.body?.password);
    if (!credentials.valid) {
      res.status(400).json({ error: 'Invalid email or password format.' });
      return;
    }

    const rateKey = getLoginRateLimitKey(req, credentials.email);
    const rate = isLoginRateLimited(rateKey);
    if (rate.limited) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
      return;
    }

    const pool = getPostgresPool();
    if (!pool) {
      res.status(503).json({ error: 'Authentication database is unavailable.' });
      return;
    }

    try {
      const result = await pool.query<AuthUser & { password_hash: string; status: string }>(
        `SELECT id, email, display_name, role, password_hash, status
           FROM app_users
          WHERE lower(trim(email)) = $1
          LIMIT 1`,
        [credentials.email]
      );
      const user = result.rows[0];
      const passwordMatches = user
        ? await verifyPassword(credentials.password, user.password_hash)
        : (await deriveKey(credentials.password, Buffer.from('aaksh-auth-dummy-salt', 'utf8'))).length === PASSWORD_KEY_LENGTH;

      if (!user || user.status !== 'active' || !passwordMatches) {
        recordFailedLogin(rateKey);
        res.status(401).json({ error: 'Email or password is incorrect.' });
        return;
      }

      const sessionToken = randomBytes(32).toString('base64url');
      const csrfToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await pool.query(
        `INSERT INTO app_sessions
          (user_id, session_token_hash, csrf_token_hash, expires_at, user_agent, ip_fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          sha256(sessionToken),
          sha256(csrfToken),
          expiresAt,
          (req.get('user-agent') || '').slice(0, 300),
          sha256(req.ip || req.socket.remoteAddress || 'unknown')
        ]
      );
      await pool.query('UPDATE app_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);
      loginAttempts.delete(rateKey);

      const secure = requestUsesSecureCookies(req);
      res.setHeader('Set-Cookie', [
        serializeCookie(SESSION_COOKIE, sessionToken, {
          httpOnly: true,
          secure,
          maxAge: Math.floor(SESSION_TTL_MS / 1000)
        }),
        serializeCookie(CSRF_COOKIE, csrfToken, {
          secure,
          maxAge: Math.floor(SESSION_TTL_MS / 1000)
        })
      ]);
      res.json({ success: true, user: publicUser(user), csrfToken, expiresAt: expiresAt.toISOString() });
    } catch {
      res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
    }
  });

  router.get('/me', requireSession, (req: Request, res: Response) => {
    const session = res.locals.authSession as AuthSession;
    res.json({ authenticated: true, user: publicUser(session) });
  });

  router.post('/logout', requireSession, requireCsrf, async (req: Request, res: Response) => {
    const session = res.locals.authSession as AuthSession;
    try {
      const pool = getPostgresPool();
      if (!pool) {
        res.status(503).json({ error: 'Authentication database is unavailable.' });
        return;
      }
      await pool.query(
        'UPDATE app_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
        [session.session_id]
      );
      clearAuthCookies(res, requestUsesSecureCookies(req));
      res.json({ success: true });
    } catch {
      res.status(503).json({ error: 'Logout could not be completed. Please retry.' });
    }
  });

  return router;
}
