# Stage 7 — Pre-merge readiness checklist

## Server environment (server-side secrets only)
- [ ] `AAKSH_OTP_PEPPER`: generate a cryptographically random value of at least 32 characters. Never expose it to browser code, logs, chat, or Git.
- [ ] `RESEND_API_KEY`: configure the Resend API key as a server-side secret, with only the required sending permissions.
- [ ] `RESEND_FROM_EMAIL`: use a sender address/domain verified in Resend.
- [ ] Confirm presence without printing values. Do not modify the existing five provider API keys.

## OTP database migration — separate approval required
- [ ] Review `migrations/20261116_003_email_otp_challenges.sql` against the target schema; confirm `app_users`, `app_invitations`, and UUID support already exist.
- [ ] Confirm a recoverable backup and an approved maintenance window.
- [ ] Obtain explicit approval before applying the migration. Keep `RUN_DB_MIGRATIONS=false` unchanged until separately approved.
- [ ] After approved application, verify the table and indexes through read-only schema inspection. Do not run the migration from CI or this branch change.

## Before merging to main
- [ ] Confirm GitHub Actions is green for locked dependency install, TypeScript check, all tests, and production build.
- [ ] Review the complete feature-branch diff, especially auth/session middleware, OTP challenge handling, Safety guardrails, and accessibility allowlist.
- [ ] Run a controlled OTP email test; confirm wrong, expired, and reused codes fail and no session is issued before OTP verification.
- [ ] Complete browser/mobile smoke tests for login, Safety OFF chat availability, Safety ON AutoPilot flow, CSRF rejection, and accessibility unavailable/disabled states.
- [ ] Implement and separately review the Android native Accessibility service before describing native automation as available; this TypeScript bridge does not grant Android permission.
- [ ] Review deployment configuration and rollback plan. No production DB migration, Render change, deployment, publishing, or paid provider call without separate explicit approval.
- [ ] Obtain explicit approval before opening/merging a PR into `main`. Do not merge automatically.

## Protected scope
- Branch: `feature/master-project-api-key-secret-manager` only.
- Do not modify `main`, live database, Render service/domain, or existing provider API keys.
- Never commit secret values or real test credentials.
