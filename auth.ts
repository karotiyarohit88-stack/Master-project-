import crypto from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

declare global {
  namespace Express {
    interface Request { authUser?: { id: string; email: string; display_name: string | null; avatar_url: string | null; created_at: string } }
  }
}

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined),
  max: 10,
  connectionTimeoutMillis: 10000,
}) : null;
const cookieName = process.env.AUTH_COOKIE_NAME || 'mp_session';
const days = Math.max(1, Math.min(30, Number(process.env.AUTH_SESSION_DAYS || 14)));
const secret = process.env.AUTH_OTP_SECRET || process.env.APP_ENCRYPTION_KEY || '';

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const otpDigest = (email: string, purpose: string, code: string) =>
  crypto.createHmac('sha256', secret || 'dev-only-secret-change-me').update(email + ':' + purpose + ':' + code).digest('hex');
const cookie = (req: Request) => {
  const value = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='));
  return value ? decodeURIComponent(value.slice(cookieName.length + 1)) : '';
};
const setCookie = (res: Response, token: string) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', cookieName + '=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + days * 86400 + secure);
};
const clearCookie = (res: Response) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', cookieName + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' + secure);
};

export async function initializeAuth() {
  if (!pool) {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required for production authentication.');
    console.warn('[AUTH] DATABASE_URL missing; auth endpoints fail closed.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, display_name TEXT, avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth_otp_challenges (
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('register','password_reset')),
      otp_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      attempts INTEGER NOT NULL DEFAULT 0, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS auth_otp_lookup_idx ON auth_otp_challenges(email,purpose,created_at DESC);
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id,expires_at);
    CREATE TABLE IF NOT EXISTS app_secrets (
      name TEXT PRIMARY KEY, encrypted_value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.info('[AUTH] PostgreSQL schema ready.');
}

async function getUser(req: Request) {
  if (!pool) return null;
  const token = cookie(req);
  if (token.length < 32) return null;
  const result = await pool.query(
    `SELECT u.id,u.email,u.display_name,u.avatar_url,u.created_at
     FROM auth_sessions s JOIN app_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW() LIMIT 1`, [sha(token)]
  );
  if (!result.rows[0]) return null;
  await pool.query('UPDATE auth_sessions SET last_seen_at=NOW() WHERE token_hash=$1', [sha(token)]);
  return result.rows[0] as Express.Request['authUser'];
}
async function newSession(userId: string, res: Response) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool!.query(
    "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+($3::int * INTERVAL '1 day'))",
    [userId, sha(token), days]
  );
  setCookie(res, token);
}
async function deliverOtp(email: string, purpose: string, code: string) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '') === 'true' || Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email,
      subject: purpose === 'register' ? 'Master Project email verification' : 'Master Project password reset',
      text: 'Your verification code is ' + code + '. It expires in 60 seconds.',
    });
    return;
  }
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_OTP_LOG === 'true') {
    console.info('[AUTH DEV OTP] purpose=' + purpose + ' email=' + email + ' code=' + code + ' expires_in=60s');
    return;
  }
  throw new Error('SMTP is not configured. Configure SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.');
}

export const authRouter = express.Router();
authRouter.post('/request-otp', async (req: Request, res: Response) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL is required.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const purpose = req.body?.purpose === 'password_reset' ? 'password_reset' : 'register';
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email is required.' });
  if (process.env.NODE_ENV === 'production' && !secret) return res.status(503).json({ error: 'AUTH_OTP_SECRET is required.' });
  try {
    const client = await pool.connect();
    let code = '';
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email + ':' + purpose]);
      const user = await client.query('SELECT id FROM app_users WHERE email=$1', [email]);
      if (purpose === 'register' && user.rowCount) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Email already registered.' });
      }
      if (purpose === 'password_reset' && !user.rowCount) {
        await client.query('ROLLBACK'); return res.json({ success: true, message: 'If the account exists, a code will be sent.' });
      }
      const latest = await client.query(
        'SELECT last_sent_at FROM auth_otp_challenges WHERE email=$1 AND purpose=$2 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [email, purpose]
      );
      if (latest.rows[0]) {
        const elapsed = Date.now() - new Date(latest.rows[0].last_sent_at).getTime();
        if (elapsed < 60000) {
          await client.query('ROLLBACK');
          return res.status(429).json({ error: 'Resend is locked for 60 seconds.', retryAfter: Math.ceil((60000 - elapsed) / 1000) });
        }
      }
      await client.query('UPDATE auth_otp_challenges SET consumed_at=NOW() WHERE email=$1 AND purpose=$2 AND consumed_at IS NULL', [email,purpose]);
      code = String(crypto.randomInt(0,1000000)).padStart(6,'0');
      await client.query(
        "INSERT INTO auth_otp_challenges(email,purpose,otp_hash,expires_at,last_sent_at) VALUES($1,$2,$3,NOW()+INTERVAL '60 seconds',NOW())",
        [email,purpose,otpDigest(email,purpose,code)]
      );
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    await deliverOtp(email,purpose,code);
    return res.json({ success:true, expiresIn:60, resendAfter:60 });
  } catch (e: any) { console.error('[AUTH] OTP request failed:',e?.message); return res.status(503).json({ error:e?.message || 'OTP delivery failed.' }); }
});
authRouter.post('/register', async (req: Request,res: Response) => {
  if (!pool) return res.status(503).json({error:'DATABASE_URL is required.'});
  const email=String(req.body?.email||'').trim().toLowerCase(), code=String(req.body?.code||''), password=String(req.body?.password||''), displayName=String(req.body?.displayName||'').trim().slice(0,100);
  if (!/^\\d{6}$/.test(code) || password.length<10 || !email) return res.status(400).json({error:'Email, six digit OTP and password (10+ chars) required.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[email+':register']);
    const r=await client.query("SELECT * FROM auth_otp_challenges WHERE email=$1 AND purpose='register' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[email]);
    const otp=r.rows[0];
    if (!otp || new Date(otp.expires_at).getTime()<=Date.now() || otp.attempts>=5) { await client.query('ROLLBACK'); return res.status(400).json({error:'OTP expired or unavailable.'}); }
    if (otpDigest(email,'register',code)!==otp.otp_hash) {
      await client.query('UPDATE auth_otp_challenges SET attempts=attempts+1 WHERE id=$1',[otp.id]); await client.query('COMMIT'); return res.status(400).json({error:'Incorrect OTP.'});
    }
    const hash=await bcrypt.hash(password,12);
    const created=await client.query('INSERT INTO app_users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name,avatar_url,created_at',[email,hash,displayName||null]);
    await client.query('UPDATE auth_otp_challenges SET consumed_at=NOW() WHERE id=$1',[otp.id]);
    await client.query('COMMIT');
    await newSession(created.rows[0].id,res);
    return res.status(201).json({success:true,user:created.rows[0]});
  } catch(e:any) { await client.query('ROLLBACK'); console.error('[AUTH] register:',e?.message); return res.status(409).json({error:'Registration failed; email may already exist.'}); } finally { client.release(); }
});
authRouter.post('/login', async (req:Request,res:Response) => {
  if(!pool) return res.status(503).json({error:'DATABASE_URL is required.'});
  const email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||'');
  const r=await pool.query('SELECT id,email,password_hash,display_name,avatar_url,created_at FROM app_users WHERE email=$1',[email]);
  const user=r.rows[0];
  if(!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:'Invalid email or password.'});
  await newSession(user.id,res); delete user.password_hash; return res.json({success:true,user});
});
authRouter.get('/session', async (req:Request,res:Response) => {
  if(!pool) return res.status(503).json({error:'DATABASE_URL is required.'});
  const user=await getUser(req); return user ? res.json({authenticated:true,user}) : res.status(401).json({authenticated:false});
});
authRouter.post('/logout', async (req:Request,res:Response) => {
  if(pool) { const token=cookie(req); if(token) await pool.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL',[sha(token)]); }
  clearCookie(res); return res.json({success:true});
});
authRouter.post('/reset-password', async (req:Request,res:Response) => {
  if(!pool) return res.status(503).json({error:'DATABASE_URL is required.'});
  const email=String(req.body?.email||'').trim().toLowerCase(), code=String(req.body?.code||''), password=String(req.body?.password||'');
  if(!/^\\d{6}$/.test(code)||password.length<10) return res.status(400).json({error:'Valid OTP and 10+ character password required.'});
  const c=await pool.connect();
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[email+':password_reset']);
    const r=await c.query("SELECT * FROM auth_otp_challenges WHERE email=$1 AND purpose='password_reset' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[email]);
    const otp=r.rows[0];
    if(!otp||new Date(otp.expires_at).getTime()<=Date.now()||otp.attempts>=5){await c.query('ROLLBACK');return res.status(400).json({error:'OTP expired or unavailable.'});}
    if(otpDigest(email,'password_reset',code)!==otp.otp_hash){await c.query('UPDATE auth_otp_challenges SET attempts=attempts+1 WHERE id=$1',[otp.id]);await c.query('COMMIT');return res.status(400).json({error:'Incorrect OTP.'});}
    await c.query('UPDATE app_users SET password_hash=$1,updated_at=NOW() WHERE email=$2',[await bcrypt.hash(password,12),email]);
    await c.query('UPDATE auth_otp_challenges SET consumed_at=NOW() WHERE id=$1',[otp.id]);
    await c.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=(SELECT id FROM app_users WHERE email=$1) AND revoked_at IS NULL',[email]);
    await c.query('COMMIT'); clearCookie(res); return res.json({success:true});
  } catch(e:any){await c.query('ROLLBACK');return res.status(503).json({error:'Password reset failed.'});} finally{c.release();}
});
authRouter.get('/profile', async (req:Request,res:Response)=>{const user=await getUser(req);return user?res.json({user}):res.status(401).json({error:'Authentication required.'});});
authRouter.patch('/profile', async (req:Request,res:Response)=>{
  if(!pool)return res.status(503).json({error:'DATABASE_URL is required.'});
  const user=await getUser(req);if(!user)return res.status(401).json({error:'Authentication required.'});
  const name=String(req.body?.displayName||'').trim().slice(0,100), avatar=req.body?.avatarUrl?String(req.body.avatarUrl).trim().slice(0,2048):null;
  if(avatar&&!/^https:\\/\\/.+/i.test(avatar))return res.status(400).json({error:'Avatar URL must use HTTPS.'});
  const r=await pool.query('UPDATE app_users SET display_name=$1,avatar_url=$2,updated_at=NOW() WHERE id=$3 RETURNING id,email,display_name,avatar_url,created_at',[name||null,avatar,user.id]);
  return res.json({success:true,user:r.rows[0]});
});
export async function requireSession(req:Request,res:Response,next:NextFunction) {
  if(req.path==='/health'||req.path.startsWith('/auth/')||req.path==='/auth'||/^\\/autopilot\\/webhook\\/[^/]+$/.test(req.path)) return next();
  if(!pool)return res.status(503).json({error:'Authentication database unavailable; set DATABASE_URL.'});
  try { const user=await getUser(req); if(!user)return res.status(401).json({error:'Authentication required.'}); req.authUser=user; return next(); }
  catch(e){console.error('[AUTH] session validation failed',e);return res.status(503).json({error:'Session validation unavailable.'});}
}
