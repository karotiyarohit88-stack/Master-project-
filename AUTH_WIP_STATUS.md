# AUTH Step 1 — WIP / Unverified - ready for Termux test

**Branch:** `repair/auth-route-otp-profile-2026-11-14`

This commit contains an initial PostgreSQL-backed authentication implementation. It has NOT been built, migrated, or exercised in a running Termux environment. Do not treat this as Verified or PASS.

## Included changes
- `auth.ts`: PostgreSQL user, OTP challenge, session, and encrypted secret storage; register/login/logout/reset/profile endpoints.
- `migrations/001_auth_postgres.sql`: explicit PostgreSQL schema migration.
- `server.ts`: auth router, API session middleware, DB initialization, encrypted GitHub token persistence, and operator identity in approval audit details.
- `src/App.tsx`: Login-first session gate, Account panel, profile update, logout.
- `src/components/AuthScreen.tsx`: login, registration OTP, and password-reset UI.
- `.env.example`: SMTP, OTP secret, encryption key, and session settings.

## Required environment
- `DATABASE_URL` pointing to PostgreSQL.
- `AUTH_OTP_SECRET` (32+ random characters; required in production).
- `APP_ENCRYPTION_KEY` (32+ random characters; required to save/reload GitHub PAT).
- SMTP settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- For local-only OTP testing without SMTP, set `AUTH_DEV_OTP_LOG=true` with `NODE_ENV=development`; read the code from the Termux server log. Never enable this in production.

## Termux test sequence
1. `git status --short && git branch --show-current && git pull --ff-only origin repair/auth-route-otp-profile-2026-11-14`
2. `npm ci`
3. Apply schema: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_auth_postgres.sql`
4. `npm run lint`
5. `npm run build`
6. Start: `npm run dev`
7. In another Termux session: `curl -i http://127.0.0.1:3000/api/health`; unauthenticated protected endpoint: `curl -i http://127.0.0.1:3000/api/chat` (expect HTTP 401).
8. Test OTP request, resend lock (HTTP 429 before 60 seconds), expiry after 60 seconds, wrong-code attempt limit, register, session cookie, login, profile GET/PATCH, logout, old-cookie rejection, password reset, and old-session revocation. Test SMTP delivery with a mailbox you control.

## Known unverified risks / follow-up
- This first pass uses a shared server-level GitHub PAT slot encrypted in PostgreSQL, not a per-user integration credential vault.
- The route middleware protects all `/api/*` paths except health, auth endpoints, and the existing token-checked AutoPilot webhook. Confirm all external callbacks/integration routes in the running app.
- Run TypeScript and build checks; resolve any compiler/runtime/database/SMTP issues before changing this status.
- Confirm HTTPS production cookie behavior and deployment proxy configuration.
