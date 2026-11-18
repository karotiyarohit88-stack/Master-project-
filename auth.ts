import { Router, type Request, type Response, type RequestHandler } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { getPostgresPool } from './database.ts';
import { createOtpChallengeMaterial, hashEmailOtp, sendEmailOtp } from './authOtp.ts';

const SESSION_COOKIE = 'aaksh_session';
const CSRF_COOKIE = 'aaksh_csrf';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, number[]>();
const INVITATION_DEFAULT_HOURS = 72;
const INVITATION_MAX_HOURS = 168;

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

export type TenantContext = {
  tenantId: string;
  role: 'owner' | 'admin' | 'member';
};

type QueryResult = { rows: any[] };
type AuthDbClient = {
  query: (sql: string, values?: any[]) => Promise<QueryResult>;
  release: () => void;
};
type AuthDbPool = AuthDbClient & { connect: () => Promise<AuthDbClient> };

type AuthRouterOptions = {
  pool?: AuthDbPool | null;
  adminToken?: string;
  otpPepper?: string;
  sendOtp?: (email: string, otp: string) => Promise<void>;
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
  let saltHex = '';
  let digestHex = '';
  if (parts.length === 6 && parts[0] === 'scrypt' && parts[1] === '16384' &&
      parts[2] === '8' && parts[3] === '1') {
    saltHex = parts[4];
    digestHex = parts[5];
  } else if (parts.length === 3 && parts[0] === 'scrypt') {
    // AAKSH legacy userStore used Node scrypt defaults (N=16384, r=8, p=1).
    saltHex = parts[1];
    digestHex = parts[2];
  } else {
    return false;
  }
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(digestHex)) return false;
  try {
    const expected = Buffer.from(digestHex, 'hex');
    const actual = await deriveKey(password, Buffer.from(saltHex, 'hex'));
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
    try { cookies[name] = decodeURIComponent(rawValue); }
    catch { cookies[name] = rawValue; }
  }
  return cookies;
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly?: boolean; secure: boolean; maxAge: number }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax', `Max-Age=${options.maxAge}`];
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
  return process.env.NODE_ENV === 'production' || req.secure ||
    req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}

function hasSameOrigin(req: Request): boolean {
  const origin = req.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.get('host'); }
  catch { return false; }
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
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - attempts[0])) / 1000)) };
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

function validateEmail(emailValue: unknown): string | null {
  if (typeof emailValue !== 'string') return null;
  const email = emailValue.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function loadSession(pool: AuthDbPool | null, req: Request): Promise<AuthSession | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!pool || !token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const result = await pool.query(
    `SELECT s.id AS session_id, s.csrf_token_hash, s.expires_at,
            u.id, u.email, u.display_name, u.role
       FROM app_sessions s
       JOIN app_users u ON u.id = s.user_id
      WHERE s.session_token_hash = $1 AND s.revoked_at IS NULL
        AND s.expires_at > NOW() AND u.status = 'active'
      LIMIT 1`,
    [sha256(token)]
  );
  return (result.rows[0] as AuthSession) || null;
}

function createRequireSession(pool: AuthDbPool | null): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await loadSession(pool, req);
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
}

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


export function createCsrfMutationGuard(csrfGuard: RequestHandler): RequestHandler {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  return (req, res, next) => {
    if (safeMethods.has(req.method.toUpperCase())) return next();
    return csrfGuard(req, res, next);
  };
}

export function createAuthGuards(options: AuthRouterOptions = {}) {
  const pool = options.pool === undefined
    ? (getPostgresPool() as unknown as AuthDbPool | null)
    : options.pool;
  return {
    requireSession: createRequireSession(pool),
    requireRole(role: AuthUser['role']): RequestHandler {
      return (_req, res, next) => {
        const session = res.locals.authSession as AuthSession | undefined;
        if (!session) {
          res.status(401).json({ error: 'Authentication required.' });
          return;
        }
        if (session.role !== role) {
          res.status(403).json({ error: 'Insufficient role for this action.' });
          return;
        }
        next();
      };
    },
    requireTenantMembership: (async (_req: Request, res: Response, next: (error?: unknown) => void) => {
      const session = res.locals.authSession as AuthSession | undefined;
      if (!session) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      if (!pool) {
        res.status(503).json({ error: 'Tenant authorization database is unavailable.' });
        return;
      }
      try {
        const result = await pool.query(
          `SELECT t.id AS tenant_id, m.membership_role
             FROM app_tenant_memberships m
             JOIN app_tenants t ON t.id = m.tenant_id
            WHERE m.user_id = $1 AND m.status = 'active' AND t.status = 'active'
            ORDER BY m.created_at ASC
            LIMIT 2`,
          [session.id]
        );
        if (result.rows.length !== 1) {
          res.status(result.rows.length > 1 ? 409 : 403).json({
            error: result.rows.length > 1
              ? 'Account has multiple active workspaces; tenant selection is required.'
              : 'An active tenant workspace membership is required.'
          });
          return;
        }
        const membership = result.rows[0];
        if (!['owner', 'admin', 'member'].includes(membership.membership_role)) {
          res.status(403).json({ error: 'Tenant membership role is invalid.' });
          return;
        }
        res.locals.tenantContext = {
          tenantId: String(membership.tenant_id),
          role: membership.membership_role
        } satisfies TenantContext;
        next();
      } catch {
        res.status(503).json({ error: 'Tenant authorization could not be verified.' });
      }
    }) as RequestHandler,
    requireCsrf
  };
}

function publicUser(user: AuthUser) {
  return { id: user.id, email: user.email, displayName: user.display_name, role: user.role };
}

function isValidAdminBootstrapToken(providedToken: string, configuredToken: string): boolean {
  return configuredToken.length >= 32 && constantTimeTextEqual(providedToken, configuredToken);
}


const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

async function issueOtpChallenge(
  pool: AuthDbPool,
  email: string,
  purpose: 'login' | 'bootstrap_owner' | 'invitation',
  pendingPayload: Record<string, unknown>,
  options: AuthRouterOptions,
  userId?: string,
  invitationId?: string
): Promise<string> {
  const pepper = options.otpPepper ?? process.env.AAKSH_OTP_PEPPER ?? '';
  const material = createOtpChallengeMaterial(pepper);
  await pool.query(
    `UPDATE app_email_otp_challenges
        SET invalidated_at = NOW()
      WHERE lower(trim(email)) = $1 AND purpose = $2
        AND consumed_at IS NULL AND invalidated_at IS NULL`,
    [email, purpose]
  );
  await pool.query(
    `INSERT INTO app_email_otp_challenges
       (challenge_token_hash, email, purpose, otp_hash, pending_payload, user_id, invitation_id,
        attempts, max_attempts, expires_at, resend_after)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 0, $8, $9, $10)`,
    [material.challengeTokenHash, email, purpose, material.otpHash, JSON.stringify(pendingPayload),
      userId ?? null, invitationId ?? null, OTP_MAX_ATTEMPTS,
      new Date(Date.now() + OTP_TTL_MS), new Date(Date.now() + OTP_RESEND_COOLDOWN_MS)]
  );
  await (options.sendOtp ?? ((to, code) => sendEmailOtp(to, code)))(email, material.otp);
  return material.challengeToken;
}

export function createAuthRouter(options: AuthRouterOptions = {}) {
  const router = Router();
  const pool = options.pool === undefined
    ? (getPostgresPool() as unknown as AuthDbPool | null)
    : options.pool;
  const adminToken = options.adminToken ?? process.env.AAKSH_ADMIN_TOKEN ?? '';
  const requireSession = createRequireSession(pool);


  router.post('/bootstrap-owner', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    if (!isValidAdminBootstrapToken(req.get('x-aaksh-admin-token') || '', adminToken)) {
      res.status(401).json({ error: 'Administrative bootstrap authorization required.' }); return;
    }
    const credentials = validateCredentials(req.body?.email, req.body?.password);
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!credentials.valid || displayName.length < 1 || displayName.length > 100) {
      res.status(400).json({ error: 'Provide a valid email, a password of 12–128 characters, and a display name.' }); return;
    }
    if (!pool) { res.status(503).json({ error: 'PostgreSQL is not configured.' }); return; }
    let client: AuthDbClient | undefined;
    try {
      const passwordHash = await hashPassword(credentials.password);
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query('LOCK TABLE app_users IN EXCLUSIVE MODE');
      const owners = await client.query("SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'owner'");
      if (Number(owners.rows[0]?.count || 0) > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Owner bootstrap is permanently closed because an Owner account already exists.' }); return;
      }
      await client.query('COMMIT');
      const challengeToken = await issueOtpChallenge(pool, credentials.email, 'bootstrap_owner',
        { passwordHash, displayName }, options);
      res.status(202).json({ success: true, requiresOtp: true, challengeToken, message: 'A verification code has been sent to the provided email address.' });
    } catch (error) {
      if (client) { try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ } }
      if ((error as { code?: string })?.code === '23505') res.status(409).json({ error: 'An account with this email already exists.' });
      else res.status(503).json({ error: 'Owner verification could not be started. Check OTP delivery configuration.' });
    } finally { client?.release(); }
  });

  router.post('/login', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    const credentials = validateCredentials(req.body?.email, req.body?.password);
    if (!credentials.valid) { res.status(400).json({ error: 'Invalid email or password format.' }); return; }
    const rateKey = getLoginRateLimitKey(req, credentials.email);
    const rate = isLoginRateLimited(rateKey);
    if (rate.limited) { res.setHeader('Retry-After', String(rate.retryAfterSeconds)); res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' }); return; }
    if (!pool) { res.status(503).json({ error: 'Authentication database is unavailable.' }); return; }
    try {
      const result = await pool.query(
        `SELECT id, email, display_name, role, password_hash, status
           FROM app_users WHERE lower(trim(email)) = $1 LIMIT 1`, [credentials.email]);
      const user = result.rows[0] as (AuthUser & { password_hash: string; status: string }) | undefined;
      const passwordMatches = user ? await verifyPassword(credentials.password, user.password_hash) :
        (await deriveKey(credentials.password, Buffer.from('aaksh-auth-dummy-salt', 'utf8'))).length === PASSWORD_KEY_LENGTH;
      if (!user || user.status !== 'active' || !passwordMatches) {
        recordFailedLogin(rateKey); res.status(401).json({ error: 'Email or password is incorrect.' }); return;
      }
      const challengeToken = await issueOtpChallenge(pool, credentials.email, 'login', {}, options, user.id);
      res.status(202).json({ success: true, requiresOtp: true, challengeToken, message: 'A verification code has been sent to your email address.' });
    } catch {
      res.status(503).json({ error: 'Authentication service is temporarily unavailable. OTP delivery may not be configured.' });
    }
  });

  router.post('/verify-otp', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(challengeToken) || !/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Provide a valid challenge and six-digit verification code.' }); return;
    }
    if (!pool) { res.status(503).json({ error: 'Authentication database is unavailable.' }); return; }
    let client: AuthDbClient | undefined;
    try {
      client = await pool.connect(); await client.query('BEGIN');
      const found = await client.query(
        `SELECT id, email, purpose, otp_hash, pending_payload, user_id, invitation_id,
                attempts, max_attempts, expires_at, verified_at, consumed_at, invalidated_at
           FROM app_email_otp_challenges WHERE challenge_token_hash = $1 FOR UPDATE`,
        [sha256(challengeToken)]);
      const challenge = found.rows[0];
      if (!challenge || challenge.consumed_at || challenge.invalidated_at || challenge.verified_at ||
          new Date(challenge.expires_at).getTime() <= Date.now() || Number(challenge.attempts) >= Number(challenge.max_attempts)) {
        await client.query('ROLLBACK'); res.status(400).json({ error: 'Verification challenge is invalid, expired, or exhausted.' }); return;
      }
      const pepper = options.otpPepper ?? process.env.AAKSH_OTP_PEPPER ?? '';
      const suppliedHash = hashEmailOtp(otp, pepper);
      if (!constantTimeTextEqual(suppliedHash, String(challenge.otp_hash).trim())) {
        await client.query('UPDATE app_email_otp_challenges SET attempts = attempts + 1, invalidated_at = CASE WHEN attempts + 1 >= max_attempts THEN NOW() ELSE invalidated_at END WHERE id = $1', [challenge.id]);
        await client.query('COMMIT'); res.status(400).json({ error: 'Verification code is incorrect or expired.' }); return;
      }
      let user: AuthUser | undefined;
      if (challenge.purpose === 'bootstrap_owner') {
        await client.query('LOCK TABLE app_users IN EXCLUSIVE MODE');
        const owners = await client.query("SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'owner'");
        if (Number(owners.rows[0]?.count || 0) > 0) {
          await client.query('UPDATE app_email_otp_challenges SET invalidated_at = NOW() WHERE id = $1', [challenge.id]);
          await client.query('COMMIT'); res.status(409).json({ error: 'Owner bootstrap is permanently closed.' }); return;
        }
        const payload = challenge.pending_payload || {};
        const created = await client.query(
          `INSERT INTO app_users (email, password_hash, display_name, role, status, email_verified_at)
           VALUES ($1, $2, $3, 'owner', 'active', NOW()) RETURNING id, email, display_name, role`,
          [challenge.email, payload.passwordHash, payload.displayName]);
        user = created.rows[0] as AuthUser;
        const tenant = await client.query(
          `INSERT INTO app_tenants (display_name, owner_user_id)
           VALUES ($1, $2) RETURNING id`,
          [`${user.display_name} Workspace`, user.id]);
        const tenantId = tenant.rows[0]?.id;
        if (!tenantId) throw new Error('Owner workspace could not be created.');
        await client.query(
          `INSERT INTO app_tenant_memberships (tenant_id, user_id, membership_role, status)
           VALUES ($1, $2, 'owner', 'active') ON CONFLICT (tenant_id, user_id) DO NOTHING`,
          [tenantId, user.id]);
      } else if (challenge.purpose === 'invitation') {
        const invitationResult = await client.query(
          `SELECT i.id, i.email, i.role, i.tenant_id, t.id AS active_tenant_id,
                  i.expires_at, i.accepted_at, i.revoked_at
             FROM app_invitations i
             LEFT JOIN app_tenants t ON t.id = i.tenant_id AND t.status = 'active'
            WHERE i.id = $1 FOR UPDATE OF i`, [challenge.invitation_id]);
        const invitation = invitationResult.rows[0];
        if (!invitation || !invitation.tenant_id || !invitation.active_tenant_id ||
            invitation.accepted_at || invitation.revoked_at ||
            new Date(invitation.expires_at).getTime() <= Date.now()) {
          await client.query('ROLLBACK'); res.status(400).json({ error: 'Invitation is invalid, expired, revoked, or its workspace is unavailable.' }); return;
        }
        const payload = challenge.pending_payload || {};
        const created = await client.query(
          `INSERT INTO app_users (email, password_hash, display_name, role, status, email_verified_at)
           VALUES ($1, $2, $3, $4, 'active', NOW()) RETURNING id, email, display_name, role`,
          [invitation.email, payload.passwordHash, payload.displayName, invitation.role]);
        user = created.rows[0] as AuthUser;
        await client.query(
          `INSERT INTO app_tenant_memberships (tenant_id, user_id, membership_role, status)
           VALUES ($1, $2, $3, 'active')`,
          [invitation.tenant_id, user.id, invitation.role]);
        await client.query('UPDATE app_invitations SET accepted_at = NOW() WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL', [invitation.id]);
      } else {
        const result = await client.query('SELECT id, email, display_name, role, status FROM app_users WHERE id = $1 LIMIT 1', [challenge.user_id]);
        user = result.rows[0] as AuthUser | undefined;
        if (!user) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Account is no longer available.' }); return; }
      }
      await client.query('UPDATE app_email_otp_challenges SET verified_at = NOW(), consumed_at = NOW() WHERE id = $1', [challenge.id]);
      if (challenge.purpose === 'login' || challenge.purpose === 'bootstrap_owner') {
        const sessionToken = randomBytes(32).toString('base64url');
        const csrfToken = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
        await client.query(
          `INSERT INTO app_sessions (user_id, session_token_hash, csrf_token_hash, expires_at, user_agent, ip_fingerprint)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user!.id, sha256(sessionToken), sha256(csrfToken), expiresAt, (req.get('user-agent') || '').slice(0, 300), sha256(req.ip || req.socket.remoteAddress || 'unknown')]);
        await client.query('UPDATE app_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [user!.id]);
        await client.query('COMMIT');
        const secure = requestUsesSecureCookies(req);
        res.setHeader('Set-Cookie', [
          serializeCookie(SESSION_COOKIE, sessionToken, { httpOnly: true, secure, maxAge: Math.floor(SESSION_TTL_MS / 1000) }),
          serializeCookie(CSRF_COOKIE, csrfToken, { secure, maxAge: Math.floor(SESSION_TTL_MS / 1000) })
        ]);
        res.json({ success: true, user: publicUser(user!), csrfToken, expiresAt: expiresAt.toISOString() }); return;
      }
      await client.query('COMMIT');
      res.status(201).json({ success: true, user: publicUser(user!) });
    } catch {
      if (client) { try { await client.query('ROLLBACK'); } catch { /* already closed */ } }
      res.status(503).json({ error: 'OTP verification could not be completed.' });
    } finally { client?.release(); }
  });

  router.post('/resend-otp', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    const token = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) { res.status(400).json({ error: 'Invalid verification challenge.' }); return; }
    if (!pool) { res.status(503).json({ error: 'Authentication database is unavailable.' }); return; }
    try {
      const result = await pool.query(
        `SELECT id, email, purpose, pending_payload, user_id, invitation_id, expires_at, resend_after,
                attempts, max_attempts, consumed_at, invalidated_at
           FROM app_email_otp_challenges WHERE challenge_token_hash = $1 LIMIT 1`, [sha256(token)]);
      const challenge = result.rows[0];
      if (!challenge || challenge.consumed_at || challenge.invalidated_at ||
          new Date(challenge.expires_at).getTime() <= Date.now() ||
          Number(challenge.attempts) >= Number(challenge.max_attempts)) {
        res.status(400).json({ error: 'Verification challenge is invalid or expired.' }); return;
      }
      if (new Date(challenge.resend_after).getTime() > Date.now()) {
        res.setHeader('Retry-After', String(Math.ceil((new Date(challenge.resend_after).getTime() - Date.now()) / 1000)));
        res.status(429).json({ error: 'Please wait before requesting another code.' }); return;
      }
      const material = createOtpChallengeMaterial(options.otpPepper ?? process.env.AAKSH_OTP_PEPPER ?? '');
      const updated = await pool.query(
        `UPDATE app_email_otp_challenges SET otp_hash = $1, attempts = 0,
                expires_at = $2, resend_after = $3
          WHERE id = $4 AND consumed_at IS NULL AND invalidated_at IS NULL
            AND resend_after <= NOW() RETURNING id`,
        [material.otpHash, new Date(Date.now() + OTP_TTL_MS), new Date(Date.now() + OTP_RESEND_COOLDOWN_MS), challenge.id]);
      if (!updated.rows.length) { res.status(429).json({ error: 'Please wait before requesting another code.' }); return; }
      await (options.sendOtp ?? ((to, code) => sendEmailOtp(to, code)))(challenge.email, material.otp);
      res.json({ success: true, message: 'A new verification code has been sent.' });
    } catch { res.status(503).json({ error: 'Could not resend verification code.' }); }
  });

  router.get('/me', requireSession, (req: Request, res: Response) => {
    const session = res.locals.authSession as AuthSession;
    res.json({ authenticated: true, user: publicUser(session) });
  });

  router.post('/logout', requireSession, requireCsrf, async (req: Request, res: Response) => {
    const session = res.locals.authSession as AuthSession;
    try {
      if (!pool) {
        res.status(503).json({ error: 'Authentication database is unavailable.' });
        return;
      }
      await pool.query('UPDATE app_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [session.session_id]);
      clearAuthCookies(res, requestUsesSecureCookies(req));
      res.json({ success: true });
    } catch {
      res.status(503).json({ error: 'Logout could not be completed. Please retry.' });
    }
  });

  router.post('/invitations', requireSession, requireCsrf, async (req: Request, res: Response) => {
    const session = res.locals.authSession as AuthSession;
    if (session.role !== 'owner') {
      res.status(403).json({ error: 'Only the Owner can create invitations.' });
      return;
    }
    const email = validateEmail(req.body?.email);
    const role = req.body?.role === undefined ? 'member' : req.body.role;
    const requestedHours = req.body?.expiresInHours === undefined ? INVITATION_DEFAULT_HOURS : Number(req.body.expiresInHours);
    if (!email || (role !== 'admin' && role !== 'member') ||
        !Number.isInteger(requestedHours) || requestedHours < 1 || requestedHours > INVITATION_MAX_HOURS) {
      res.status(400).json({ error: 'Provide a valid email, role (admin/member), and expiry between 1 and 168 hours.' });
      return;
    }
    if (!pool) {
      res.status(503).json({ error: 'Authentication database is unavailable.' });
      return;
    }
    try {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + requestedHours * 60 * 60 * 1000);
      const tenantResult = await pool.query(
        `SELECT t.id AS tenant_id
           FROM app_tenant_memberships m
           JOIN app_tenants t ON t.id = m.tenant_id
          WHERE m.user_id = $1 AND m.status = 'active' AND t.status = 'active'
            AND m.membership_role = 'owner'
          ORDER BY m.created_at ASC
          LIMIT 2`,
        [session.id]
      );
      if (tenantResult.rows.length !== 1) {
        res.status(409).json({ error: 'Your account must have exactly one active Owner workspace before invitations can be created.' });
        return;
      }
      const tenantId = tenantResult.rows[0].tenant_id;
      const created = await pool.query(
        `INSERT INTO app_invitations (tenant_id, email, role, invite_token_hash, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, tenant_id, email, role, created_at, expires_at`,
        [tenantId, email, role, tokenHash, session.id, expiresAt]
      );
      res.status(201).json({
        success: true,
        invitation: created.rows[0],
        invitationToken: token,
        message: 'Copy this invitation token now. It will not be shown again.'
      });
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        res.status(409).json({ error: 'An active invitation or account already exists for this email.' });
      } else {
        res.status(503).json({ error: 'Invitation could not be created.' });
      }
    }
  });


  router.post('/accept-invitation', async (req: Request, res: Response) => {
    if (rejectCrossOriginIfPresent(req, res)) return;
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || password.length < 12 || password.length > 128 ||
        password.includes('\u0000') || displayName.length < 1 || displayName.length > 100) {
      res.status(400).json({ error: 'Provide a valid invitation token, a password of 12–128 characters, and a display name.' }); return;
    }
    if (!pool) { res.status(503).json({ error: 'Authentication database is unavailable.' }); return; }
    let client: AuthDbClient | undefined;
    try {
      const passwordHash = await hashPassword(password);
      client = await pool.connect(); await client.query('BEGIN');
      const found = await client.query(
        `SELECT id, email, role, expires_at, accepted_at, revoked_at
           FROM app_invitations WHERE invite_token_hash = $1 FOR UPDATE`, [sha256(token)]);
      const invitation = found.rows[0] as { id: string; email: string; role: 'admin' | 'member'; expires_at: string; accepted_at: string | null; revoked_at: string | null } | undefined;
      if (!invitation || invitation.accepted_at || invitation.revoked_at || new Date(invitation.expires_at).getTime() <= Date.now()) {
        await client.query('ROLLBACK'); res.status(400).json({ error: 'Invitation is invalid, expired, revoked, or already used.' }); return;
      }
      await client.query('COMMIT');
      const challengeToken = await issueOtpChallenge(pool, invitation.email, 'invitation',
        { passwordHash, displayName }, options, undefined, invitation.id);
      res.status(202).json({ success: true, requiresOtp: true, challengeToken, message: 'A verification code has been sent to the invited email address.' });
    } catch (error) {
      if (client) { try { await client.query('ROLLBACK'); } catch { /* already closed */ } }
      if ((error as { code?: string })?.code === '23505') res.status(409).json({ error: 'An account with this email already exists.' });
      else res.status(503).json({ error: 'Invitation verification could not be started. OTP delivery may not be configured.' });
    } finally { client?.release(); }
  });

  return router;
}
