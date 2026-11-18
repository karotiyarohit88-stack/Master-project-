# Master Project AI Agent — Project Status & Capability Memory Registry

**Source Audit Update:** 2026-11-14 (feature branch; source inspection only)  
**Status:** Capability registry and mobile Control Centre UI present; user authentication and durable database persistence remain unimplemented/unverified  
**Environment:** React 19 + TypeScript + Vite + Express Backend (`server.ts`) + Gemini AI Integration  

---

## 1. Google Workspace Integration Registry (10 Services)

Every Google Workspace app is registered and tracked in `/src/config/capabilityRegistry.ts` and `/api/registry` in `server.ts`:

1. **Google Sheets:** Read/append workflow logs and telemetry data. Status: `Working — verified`. Scopes: `spreadsheets`, `drive.readonly`.
2. **Gmail:** Email notifications & briefs. Status: `Needs configuration`. Scopes: `gmail.send`, `gmail.readonly`.
3. **Google Calendar:** Publishing schedule & AutoPilot crons. Status: `Needs configuration`. Scopes: `calendar.events`, `calendar.readonly`.
4. **Google Docs:** Long-form specs & documentation briefs. Status: `Needs configuration`. Scopes: `documents`, `drive.file`.
5. **Google Slides:** Automated slide deck generator. Status: `Needs configuration`. Scopes: `presentations`, `drive.file`.
6. **Google Drive:** Project asset storage & media organization. Status: `Needs configuration`. Scopes: `drive.file`, `drive.metadata.readonly`.
7. **Google Meet:** Video/voice sync call link scheduling. Status: `Planned`. Scopes: `meetings.space.created`.
8. **Google Forms:** User feedback surveys & response collection. Status: `Needs configuration`. Scopes: `forms.body`, `forms.responses.readonly`.
9. **Google Keep:** Note-taking & idea snippet capture. Status: `Planned`. Scopes: `keep`, `keep.readonly`.
10. **Google Contacts:** Collaborator management & notification targets. Status: `Planned`. Scopes: `contacts.readonly`.

---

## 2. AI & Media Capabilities Registry

1. **AI Image Generation & Editing:** Gemini Imagen 3 / AI Studio Tool. Status: `Working — verified`.
2. **Voice Studio & Multi-Speaker TTS:** ElevenLabs API & Web Speech API. Status: `Working — verified`.
3. **Gemini Text-to-Speech:** Direct Gemini 3.8 Flash audio buffer synthesis. Status: `Working — verified`.
4. **AI Music & Soundtrack Composition:** Suno/Udio/Prototype Music Adapter. Status: `Needs configuration`.
5. **Persistent Storage & Database:** `server.ts` currently uses an in-memory store; a durable database connection has not been verified. Status: `Needs configuration`.
6. **User Authentication:** No application user/admin login route, session middleware, or Firebase token verification was found in the inspected deployed source. GitHub provider-token authentication is separate and does not authenticate application users. Status: `Needs configuration`.

---

## 3. App-Building Capabilities Registry

1. **Interactive Games (Canvas & HTML5):** 2D Game Studio & Game Loops. Status: `Working — verified`.
2. **3D Spatial Scenes (Three.js & WebGL):** Shaders & 3D Node Viewers. Status: `Working — verified`.
3. **Bioscience & Scientific Tools:** NCBI PubMed, 3D PDB Protein Viewer & FASTA Parsers. Status: `Working — verified`.
4. **Android App Builder:** Mobile PWA & WebView Package Builder. Status: `Working — verified`.

---

## 4. Verification & Testing Evidence

The following checks were recorded in an earlier project status snapshot. They have **not** been rerun for this feature-branch audit and must not be treated as current verification:

| Earlier recorded check | Endpoint / Command | Current audit status |
| :--- | :--- | :--- |
| TypeScript typecheck | `npm run lint` (`tsc --noEmit`) | Not rerun in this audit |
| Capability Registry API | `GET /api/registry` | Not independently retested |
| Capability Test Endpoint | `POST /api/registry/test-connection` | Not independently retested; endpoint semantics require review |
| Health Check | `GET /api/health` | Not independently retested against Render |
| Connections Check | `GET /api/connections` | Not independently retested against Render |

---

## 5. Summary of Code Files

- `/src/config/capabilityRegistry.ts`: System capability registry default data & types.
- `/server.ts`: In-memory `capabilityRegistryStore`, `/api/registry`, `/api/registry/test-connection`, and `/api/registry/update` endpoints.
- `/src/components/ConnectionsCenter.tsx`: Control Centre tabbed interface with Google Workspace Apps Registry, AI & Media Capabilities, and Server API Keys.
- `/PROJECT_STATUS.md`: Persistent capability memory roadmap document.


## 6. Security Audit Findings (2026-11-14)

This section records source-level findings on `feature/master-project-api-key-secret-manager`. No production deployment or runtime security test is implied.

| Issue ID | Module / File evidence | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-04 | `server.ts` admin-token middleware and sensitive route guards; `src/components/ConnectionsCenter.tsx` | Full application authentication is absent. AAKSH_ADMIN_TOKEN now protects connection save/test and capability-registry test/update routes only; other sensitive mutation, execution, approval, publishing, GitHub and automation routes still need route-by-route authorization. | Targeted protection committed on feature branch; comprehensive authorization and live verification pending |
| MP-SEC-06 | `src/App.tsx`; `server.ts`; `migrations/20261114_002_application_auth.sql` | No application login/register UI, password verification, session issuance/validation, CSRF enforcement or owner-scoped middleware. PostgreSQL identity/session/invitation tables exist only as an unapplied schema foundation. | Schema committed; runtime authentication and authorization pending |
| MP-SEC-03 | `server.ts` in-memory `serverStore`; `database.ts`; `package.json` | Provider settings and most application state remain in process memory. PostgreSQL connectivity/migration infrastructure is now present, but durable provider-secret vault and application-state persistence are not implemented. | PostgreSQL foundation committed; durable vault and application persistence pending |

**Immediate security boundary:** do not expose this branch publicly or merge/deploy it until application authentication and server-side authorization protect all sensitive mutation, execution, approval, and credential routes. The existing webhook token check is specific to `/api/autopilot/webhook/:triggerId` and is not a substitute for application-user authentication.

**Next safe engineering step:** map every sensitive route to its required role/permission and define a production-compatible session/database design before adding authentication code. Avoid a partial login screen or a client-only token check; neither protects the Express API.

## 7. Chief AI Agent Workflow — Requirement & Source Audit (2026-11-14)

**Requested outcome:** AAKSH Chief AI Agent in the existing chat must intake and clarify user instructions, normalize typo-heavy requests without changing intent, create an actionable plan, dispatch permitted work to an execution agent, independently verify results, route missing configuration/permissions to the user, notify on progress/blockers, and produce a final evidence-based chat report.

**Required stages:**
1. Chief Agent — parse the user's original request, preserve intent, identify ambiguity and safety boundaries.
2. Planning Agent — produce ordered steps, affected modules/files, dependencies, acceptance criteria, and rollback plan.
3. Configuration Agent — check existing settings and connector readiness; request only missing user-owned credentials/consents through secure settings/OAuth, never chat messages.
4. Execution Agent — invoke real, allow-listed backend tools; no fabricated completion or simulated file changes.
5. Independent Checking Agent — inspect actual outputs and run relevant checks; return failures to execution for bounded repair attempts.
6. Notification Agent — publish stage changes, blockers, approval requests, and evidence links/status.
7. Chief Agent — synthesize the verified outcome, list completed and pending items separately, and show exact files/tests/evidence in chat.

**Safety and persistence requirements:** retain original request and normalized task separately; require explicit human approval for destructive changes, publishing, spending/paid API use, credential changes, and production deployment; never treat an AI agent's own approval as user approval. Each stage must have a truthful status and timestamp. Do not label a task completed/verified unless the corresponding action and check actually succeeded. Store workflow runs and audit events in durable, user-scoped storage before describing them as permanent.

**Source findings:**
- src/App.tsx initializes a local, hard-coded four-step workflow modal state (including pre-marked completed/running/waiting-approval stages). This is presentation state, not evidence of agents having run.
- src/components/TaskWorkflowModal.tsx renders supplied steps/logs and advances via UI callbacks; it does not itself dispatch agent work or independently verify results.
- server.ts /api/chat uses request classification and hard-coded task/proposal branches; standard conversational requests call Gemini. The inspected route does not yet implement the requested Chief → Planner → Config → Executor → Checker → Notification → Chief orchestration loop.
- src/App.tsx chat sessions are persisted in browser localStorage; this is not server-side durable workflow/audit storage.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-WF-07 | Chat / Agent Orchestration (src/App.tsx, TaskWorkflowModal.tsx, server.ts) | Current workflow UI is not backed by a multi-agent execution and independent verification pipeline. | Source-confirmed; implementation pending |
| MP-WF-08 | Chat / Workflow Persistence (src/App.tsx, server.ts) | Chat history is browser-local and no durable workflow-run store was verified. | Source-confirmed for localStorage; durable store pending |
| MP-WF-09 | Task Status / Notifications | Current UI can display logs/status supplied by frontend state; durable event-driven stage notifications are not yet verified. | Implementation pending |

**Implementation order:** implement a truthful backend workflow contract and stage model first; connect the chat UI to server-returned stage events second; add independent verification and bounded repair third; add durable per-user workflow history only after the authentication/database foundation is in place. Preserve existing chat routes and modules. No deployment is authorized by this record.


## 8. 24/7 Background Agent Infrastructure — First Implementation Step (2026-11-14)

**Implemented on feature branch:** `migrations/20261114_001_agent_task_queue.sql` adds a PostgreSQL schema foundation for durable task records and append-only task events.

The schema includes:
- Original user prompt stored separately from the normalized task.
- Owner-scoped task identity and idempotency key.
- Queue lifecycle states: queued, running, waiting_approval, retry_wait, completed, failed, cancelled.
- Priority, bounded retry count, worker lease owner/expiry, and scheduled availability.
- Explicit human approval metadata for tasks requiring approval.
- Per-task and per-owner event-history indexes.

**Safety / activation boundary:** This is a committed SQL migration only. It has not been applied to a database, no database connection has been verified, and no background worker or 24/7 execution is active from this change. Do not expose task endpoints or start workers until application authentication, owner-level authorization, verified PostgreSQL connectivity, and worker claim/recovery logic are implemented and tested. Render persistent hosting/worker services and database provisioning remain separate deployment steps requiring user approval.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-WF-10 | Background Agent Queue / PostgreSQL | No durable task queue schema existed to preserve queued work, worker leases, retries, approvals, and task events across restarts. | SQL schema committed to feature branch; database migration not applied; runtime integration pending |


## 9. Administrative API Guard — First Security Hardening (2026-11-14)

**Implemented on feature branch:** added a fail-closed AAKSH_ADMIN_TOKEN gate to these sensitive routes:
- POST /api/connections/save
- POST /api/connections/test
- POST /api/registry/test-connection
- POST /api/registry/update

The server requires a minimum 32-character server-side token and compares it using crypto.timingSafeEqual. If the secret is absent/too short, the routes return HTTP 503; if missing/incorrect, they return HTTP 401. The Connections Center now accepts the admin token in a password field held only in component memory and sends it in the request header. The token is not written to localStorage.

**Configuration required before these protected actions can be used:** set a unique AAKSH_ADMIN_TOKEN in the deployment's server-side secret manager. Do not put it in GitHub, source code, chat, or persistent browser storage.

**Scope limitation:** this is a targeted owner/admin gate for connection and capability-registry mutation routes, not full application login, multi-user identity, session management, or per-user authorization. Other task-execution, approval, publishing, GitHub mutation, and automation routes still require a complete route-by-route auth design before public exposure. No live deployment, runtime test, or production security verification is claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-04 | Connections / Capability Registry API | Unauthenticated connection-secret mutation and capability-registry mutation/test routes were identified. | Targeted admin-token gate added to feature branch; full API route authorization and live verification pending |


## 10. Application Identity & Session Schema Foundation (2026-11-14)

**Implemented on feature branch:** added `migrations/20261114_002_application_auth.sql` with PostgreSQL tables for:
- `app_users`: normalized unique email, password-hash field, role, account status, verification and login timestamps.
- `app_sessions`: opaque session-token digest, session-bound CSRF-token digest, expiry/revocation and session metadata.
- `app_invitations`: hashed one-time invitation tokens, invited email/role, expiry and acceptance/revocation state.

**Security boundaries:** this is a database schema foundation only. No public registration or login endpoint has been added or enabled. The owner account must be provisioned through a controlled bootstrap path; public users cannot self-assign owner/admin roles. Password hashing, session cookie issuance/validation, CSRF enforcement, login rate limiting, invitation consumption, database connectivity, and owner-scoped route authorization still require implementation and runtime tests. Do not apply the migration or expose authentication routes until those controls are implemented and verified.

**Dependency finding (updated 2026-11-14):** PostgreSQL `pg` 8.16.3 is now in production `dependencies`; `@types/pg` 8.23.1 is in `devDependencies`; `esbuild` was aligned to `^0.28.0` to resolve the Vite 8.3.x peer requirement. Both `package.json` and `package-lock.json` were generated by npm in GitHub Actions, not hand-edited. `npm ci`, `npm run lint`, and `npm run build` all completed successfully in the PostgreSQL dependency bootstrap workflow on the feature branch.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-06 | Application Login / Identity / Sessions | No application login/register UI or server-side identity/session middleware was present in inspected source. | PostgreSQL schema foundation committed; runtime auth, controlled owner bootstrap, UI, route authorization and tests pending |


## 11. Automated Build Checks Added (2026-11-14)

Added `.github/workflows/ci.yml` on the feature branch. On pushes and pull requests it runs:
1. `npm ci` using the committed lockfile.
2. `npm run lint` (TypeScript no-emit check).
3. `npm run build` (Vite production build).

**Verification status (updated 2026-11-14):** GitHub Actions run `43591782467` completed successfully on the feature branch. The `npm ci`, `npm run lint` (TypeScript check), and `npm run build` steps all reported success. This verifies install, typecheck and production build only; it does not prove a live PostgreSQL connection, HTTP runtime behavior, or migration execution.

## 12. PostgreSQL Connection & Migration Runtime Foundation (2026-11-14)

**Implemented on feature branch:**
- Added `database.ts` using node-postgres Pool, bounded connection/pool settings, a real `SELECT current_database(), current_setting('server_version')` probe, and safe pool cleanup.
- `GET /api/health` and `GET /api/connections` now report PostgreSQL as connected only after a real query succeeds; `GET /api/database/status` exposes read-only connectivity and migration-ledger status.
- Replaced the configuration-presence-only database connection test with a real SQL probe.
- Added an admin-token-protected `POST /api/database/migrate` route. It is fail-closed unless `RUN_DB_MIGRATIONS=true` is set server-side. Migrations are not auto-applied on server startup.
- Migration runner uses a PostgreSQL advisory lock, SHA-256 file checksums, a `schema_migrations` ledger, transaction-wrapped application, and refuses changed historical migration files.
- Updated `.env.example` with PostgreSQL-only configuration and migration opt-in settings. Existing SQL migrations 001 and 002 are preserved.

**Dependency integration:** `pg@8.16.3` is a production dependency; `@types/pg@8.23.1` is a development dependency; `esbuild@^0.28.0` resolves the Vite 8 peer requirement. The dependency manifests were generated by npm in GitHub Actions. Bootstrap run `43591486178` completed successfully with `npm ci`, `npm run lint`, and `npm run build` all successful before committing the generated manifests.

**Not yet verified / activation boundary:** no real `DATABASE_URL` was supplied to the runner, so no live PostgreSQL server connection has been proven. Neither migration has been applied to any database. The new routes have source/build verification only; no HTTP runtime test or Render test is claimed. Do not set `RUN_DB_MIGRATIONS=true` or run migrations until the target database is provisioned, backed up, and explicitly approved.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-05 | PostgreSQL Connection Test | Previous test only checked whether a database URL was present. | Real SQL connectivity probe implemented on feature branch; live database connection pending server-side DATABASE_URL and runtime test |
| MP-WF-10 | Background Agent Queue / PostgreSQL | Durable task queue schema existed without a database migration runner. | Schema plus guarded migration runner committed; migrations not applied and queue runtime/worker still pending |
| MP-DB-11 | PostgreSQL Dependency Integration | PostgreSQL driver and compatible type declarations were absent; existing esbuild range conflicted with Vite 8.3.x peer requirements. | pg production dependency, @types/pg dev dependency, lockfile, and esbuild compatibility committed; CI/bootstrap build checks passed |



## 13. Unified AI Command Center — Architecture Baseline (2026-11-18)

**Decision:** Master Project remains one application with one primary dashboard, one shared Work Engine, one central Approval Centre, one independent Audit pipeline, and one canonical activity/history system. Agent Studio, Model Center, Platform & Tool Studio, Customer Projects, Safe Repair, Analytics, and Settings are sections/workspaces within the existing dashboard shell—not separate dashboards or duplicate execution systems.

**Design saved:** `docs/UNIFIED_AI_COMMAND_CENTER_DESIGN.md` defines the target navigation, Chief AI → Planner → Policy Gate → Work Engine → Worker → Independent Audit → Safe Repair/Retest → Chief AI report lifecycle, agent/model/platform creation rules, security invariants, data architecture, phased implementation and release gates.

**Source inspection evidence on the feature branch:**
- `src/App.tsx`: workflow steps are initialized in frontend state; modal callbacks update local step state/log strings.
- `src/components/TaskWorkflowModal.tsx`: workflow controls are callback-driven UI and do not themselves execute a durable backend workflow.
- `src/components/WorkerAgentsCenter.tsx`: calls `POST /api/worker-agents/delegate`; its success message describes delegation/status update.
- `server.ts`: `GET /api/worker-agents` returns the in-memory worker list; `POST /api/worker-agents/delegate` updates agent status/mission and records an audit event. This route alone does not prove a worker executed or completed the mission.
- `server.ts`: session middleware, rate limiting, security middleware and selected owner-role mutation guards are present; complete route-by-route authorization audit remains required.
- `database.ts` and migration files provide PostgreSQL connection/migration foundations, but no live database connection or applied migration is claimed here.
- `migrations/20261114_001_agent_task_queue.sql` is a schema foundation; it does not prove an active background worker.
- `package.json` defines lint/build/test scripts and `.github/workflows/ci.yml` exists. CI for this documentation commit was queued at the time of inspection; no success is claimed.

**Safety boundary:** This commit is documentation only. No runtime code, existing route, secret, database, migration, deployment, provider key, or paid API setting was changed. No production action was run.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-ARCH-12 | Unified Dashboard / Chief AI Orchestration | The intended one-dashboard architecture and shared Chief AI → Work Engine → independent Audit lifecycle were not captured in one implementation baseline. | Design baseline committed; implementation, route integration, runtime verification and release gates pending |


## 14. Security Audit — Owner Guard Coverage Hardening (2026-11-18)

**New finding MP-SEC-13:** The global owner-only mutation allow-list did not include several authenticated mutation endpoints. As a result, a signed-in non-owner member could delegate a worker mission, invoke provider-backed video script/voice generation, enqueue a video render, prepare a publishing draft (which can call Gemini), write Sheets sync records, or trigger the manual AutoPilot endpoint after the AutoPilot safety switch was enabled.

**Minimal fix committed:** `server.ts` now includes these paths in the existing server-side `requireOwner` guard:
- `POST /api/worker-agents/delegate`
- `POST /api/video/generate-script`
- `POST /api/video/generate-voice`
- `POST /api/video/render`
- `POST /api/publishing/prepare`
- `POST /api/sheets/sync`
- `POST /api/autopilot/trigger/manual`

**Evidence:** The modified `server.ts` was fetched again from the target branch. All seven route patterns were present in the global owner-only guard. Commit: `dbb48ecffcdc3b209dec96b32409b6d028396e82`.

**Status:** Source-level guard coverage verified. GitHub Actions for this commit was still `in_progress` at the time of this status update. No local lint/test, HTTP authorization test, live database test, or deployed runtime test is claimed. This role guard reduces member access; it does **not** replace per-action explicit paid-API approval, CSRF coverage, tenant isolation, or a durable task execution engine.

**Next unresolved security work:** Review route-by-route CSRF enforcement and owner/customer data isolation. Also introduce explicit per-call approval/budget enforcement before enabling paid provider execution.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-13 | API Authorization / Provider Actions | Several authenticated mutation endpoints were missing from the global Owner-only mutation guard. | Fixed in source; refetch verified; CI and runtime authorization tests pending |


## 15. CSRF Coverage & Customer Data Isolation Audit (2026-11-18)

**Audit scope:** latest feature-branch source for `server.ts`, `auth.ts`, `server/config/security.middleware.js`, `server/runtime-secrets-context.ts`, `src/App.tsx`, `src/components/AuthGate.tsx`, `secrets.ts`, auth migration, and `tests/auth.test.ts`.

### MP-SEC-14 — Incomplete CSRF coverage across authenticated API mutations

**Source-confirmed finding:**
- `auth.ts` creates a session-bound CSRF cookie/token and exposes `requireCsrf`; the check validates same-origin host, cookie/header equality, and the stored token digest.
- The auth router applies CSRF to `POST /api/auth/logout` and `POST /api/auth/invitations`.
- `server.ts` applies CSRF to selected routes only, including `POST /api/secrets/*`, `POST /api/accounting/payout-requests*`, `POST /api/connections/save`, `POST /api/autopilot/safety`, `POST /api/autopilot/content-pipeline/prepare`, `POST /api/publishing/auto-post-policy`, `POST /api/publishing/attach-verified-asset`, and GitHub credential connect/disconnect.
- Other authenticated state-changing routes were observed without explicit CSRF middleware, including chat command execution, project proposal apply/reject, worker delegation, video generation/render, AutoPilot config/trigger/queue/workflow/execution actions, publishing prepare/approve/publish, Sheets sync, and GitHub repository selection/commit.
- The existing tests exercise CSRF rejection/acceptance for logout and the invitation flow; no route-wide CSRF coverage test was found in the inspected test file.

**Why no blanket middleware was added in this audit:** The existing frontend sends the CSRF header only on routes specifically wired for it; a blanket token-based guard would break other current UI mutations until all API callers are migrated. Some authenticated endpoints also have webhook/API integration semantics that must be separated from browser-cookie routes. A safe fix needs a route inventory, a shared frontend CSRF fetch helper (or explicit per-route headers), and integration tests for both browser and non-browser callers. Do not treat the existing `SameSite=Lax` cookie as a substitute for explicit CSRF verification.

**Status:** Source audit confirmed; no runtime exploit test performed; no route behavior changed. Fix pending.

### MP-SEC-15 — Shared operational data is not tenant-isolated

**Source-confirmed finding:**
- `server.ts` stores operational state in process-wide arrays/objects such as `serverStore`, `workerAgents`, `changeProposals`, `autoPilotTasks`, `autoPilotWorkflows`, `workflowExecutions`, publishing queues, and audit records.
- Inspected authenticated GET routes return shared collections without filtering by the authenticated user's ID, including `GET /api/analytics`, `GET /api/project/proposals`, `GET /api/worker-agents`, `GET /api/autopilot/queue`, `GET /api/autopilot/workflows`, and `GET /api/autopilot/executions`.
- Inspected mutation handlers locate shared records by resource ID (for example proposal/task/workflow/execution IDs) without a tenant owner predicate. The global owner role guard is not a substitute for per-customer ownership.
- `src/App.tsx` stores chat conversations under shared browser localStorage keys rather than a server-side user-scoped store. This is device/browser-local persistence, not multi-user server isolation.
- In contrast, the Secret Manager queries inspected use `owner_id = $1`, showing an owner-scoped pattern for secrets only; that does not establish tenant isolation for operational records.

**Impact:** If multiple customer accounts use this application, a signed-in account may see or mutate shared operational records belonging to another account. This is a release blocker for customer-facing multi-tenancy.

**Status:** Source audit confirmed; no cross-account HTTP test or live database test performed. Fix pending. Do not enable customer onboarding/public multi-user access until every tenant-owned record and query is scoped and cross-tenant denial tests pass.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-14 | API CSRF Protection (`auth.ts`, `server.ts`, frontend API callers) | CSRF middleware is applied only to selected mutation routes; several authenticated state-changing routes have no explicit CSRF check. | Implemented centrally; integration test added; final-commit CI and runtime verification pending |
| MP-SEC-15 | Customer / Tenant Data Isolation (`server.ts`, `src/App.tsx`, operational stores) | Operational records and shared in-memory collections are not consistently scoped to the authenticated user/tenant. | Source-confirmed; data-model, query scoping, migration and cross-tenant tests pending |


## 16. Authenticated API Mutation CSRF Enforcement (2026-11-18)

**Implemented on the feature branch:**
- Added `createCsrfMutationGuard` in `auth.ts`. It lets GET, HEAD, and OPTIONS pass and applies the existing session-bound CSRF validator to every other HTTP method.
- Mounted the guard in `server.ts` after the global application-session middleware, so authenticated application API mutations are checked centrally rather than relying on individual route authors to remember the guard.
- The authentication router remains mounted before this middleware and continues to apply its own CSRF protection to logout and invitation creation.
- `src/main.tsx` already contained a same-origin API fetch wrapper that attaches the readable `aaksh_csrf` cookie as `X-CSRF-Token` for POST/PUT/PATCH/DELETE and sends same-origin credentials. This was inspected and retained without duplicate wrapper code.
- Added an integration test in `tests/auth.test.ts` that establishes a real test session, confirms a mutation without the CSRF header is rejected (403), confirms the matching session-bound token is accepted, and confirms a GET does not require the CSRF header.

**Safety boundary:** This is source-level implementation plus a committed test. It does not establish deployed runtime behavior until CI and an authorized staging/runtime test pass. The existing application-wide session requirement remains in force; no webhook authentication model was changed. No database migration, deployment, paid provider call, or external publishing action was performed.

**Verification:** Final code-and-status commit `195cc647fbffcfcf623d3dfbacea36dfc752f27b` passed GitHub Actions push run #202 (`44246901794`): locked dependency install, TypeScript check, authentication unit tests, and production build all succeeded. The PR-triggered run was still in progress when checked. This is CI verification only; no deployed runtime authorization test is claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-14 | API CSRF Protection (`auth.ts`, `server.ts`, `src/main.tsx`, `tests/auth.test.ts`) | Authenticated API mutations lacked consistent explicit CSRF validation. | Central mutation guard and integration test committed; GitHub Actions push run #202 (`44246901794`) passed install, TypeScript check, auth tests and production build; deployed runtime verification pending |


## 17. Shared Operational State Access Containment (2026-11-18)

**Implemented on the feature branch as an interim security containment:**
- Added a centralized Owner-role gate in `server.ts` for shared process-wide operational API families: analytics, accounting, project proposals, worker agents, video job history, AutoPilot APIs (excluding the webhook path), publishing records, and audit logs.
- This prevents non-Owner authenticated accounts from reading or mutating these shared in-memory operational records while tenant ownership is not represented consistently in those records.
- The existing session middleware remains in front of this guard; the Owner-role check uses the authenticated session resolved by `auth.ts`.

**Important limitation:** This is not full customer/tenant isolation. It temporarily restricts these shared operational features to the Owner; it does not provide separate customer workspaces. The production solution still requires durable tenant-owned records, `owner_id`/tenant foreign keys, owner-scoped reads and writes for every affected route, migration/backfill policy, and cross-tenant integration tests. Do not enable public customer onboarding or advertise multi-tenant isolation based on this containment.

**Verification boundary:** Source changes committed on the feature branch. GitHub Actions must pass for the final code commit; no production deployment, live HTTP role test, or database migration was performed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-15 | Customer / Tenant Data Isolation (`server.ts`, operational stores, database schema) | Shared in-memory operational APIs were accessible to authenticated non-Owner accounts without tenant predicates. | Interim fail-closed Owner-only containment committed; full per-tenant persistence/query scoping and cross-tenant tests remain pending |


## 18. Tenant Identity and Membership Schema Foundation (2026-11-18)

**Added on the feature branch:**
- Added additive migration `migrations/20261118_001_tenant_identity.sql`.
- Defines `app_tenants` and `app_tenant_memberships` with UUID keys, foreign keys, tenant-scoped roles, active/suspended/revoked membership states, uniqueness constraints, and lookup indexes.
- Seeds one separate initial workspace for each already-provisioned global Owner and creates that Owner's membership. The seed uses an explicit `owner_user_id` relationship and is idempotent.
- No existing operational records are moved, deleted, or rewritten.

**Not yet implemented:** Login/session tenant resolution, invitation acceptance membership creation, tenant switching policy, tenant-scoped project/task/workflow/publishing/audit tables, query predicates, database row-level security, and cross-tenant integration tests. The migration is schema groundwork only. The migration has NOT been applied to any database; no live database or deployment action was taken.

**Verification:** Migration source was fetched and reviewed after the deterministic owner-seed correction. GitHub Actions for the final branch commit has not yet been confirmed. SQL execution against PostgreSQL is not claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-15 | Customer / Tenant Data Isolation | Shared in-memory operational state lacks per-customer persistence and query scoping. | Interim Owner-only containment remains; tenant identity/membership schema committed but unapplied; auth integration, operational data migration, scoped queries, and cross-tenant tests pending |


## 19. Invitation-to-Tenant Schema Link (2026-11-18)

**Added on the feature branch:** `migrations/20261118_002_invitation_tenant_scope.sql` adds a nullable `tenant_id` foreign key to `app_invitations`, backfills it only when the invitation creator has an active Owner/Admin membership in an active tenant, and adds a pending-invitation tenant index.

**Fail-closed compatibility:** legacy invitations that cannot be mapped to an active tenant remain `NULL`. Tenant-aware acceptance code must reject those rows rather than guess a tenant. New invitation creation must derive the tenant from the authenticated inviter's active membership; a request-body tenant ID must never be trusted.

**Not yet implemented:** `auth.ts` still creates invitations without `tenant_id`, and invitation acceptance creates the user without inserting an `app_tenant_memberships` row. Login/session loading also does not resolve a tenant membership. This migration is preparatory schema only and is NOT applied to a database.

**Verification:** migration file committed as `77b8f26f149342432ba7ec75c268cd9a08e9b97d`; source refetch and CI for this commit are pending. No PostgreSQL execution, runtime test, or deployment is claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-15 | Invitation / Tenant Membership | Invitations are not currently bound to a tenant, and acceptance does not create tenant membership. | Additive tenant_id migration committed; auth route integration, membership resolution, SQL execution and cross-tenant tests pending |


## 20. Tenant-Aware Owner Bootstrap and Invitation Acceptance (2026-11-18)

**Implemented on the feature branch:**
- Owner bootstrap now creates an initial active tenant and an Owner membership in the same OTP-verification database transaction.
- Invitation creation resolves the inviter's active Owner membership from the authenticated session user ID. It requires exactly one active Owner workspace and writes that tenant ID into the invitation; it does not accept a tenant ID from the request body.
- Invitation OTP acceptance locks and checks the invitation, requires a non-NULL tenant ID and an active tenant, creates the invited user, inserts their active tenant membership with the invited role, and marks the invitation accepted in the same transaction.
- Legacy invitations without a tenant mapping, and invitations for inactive workspaces, fail closed rather than assigning an arbitrary tenant.
- Authentication tests now assert that bootstrap creates the Owner tenant membership and that invitation acceptance adds the invited user to the same tenant with the correct role.

**Files changed:** `auth.ts`, `tests/auth.test.ts`.

**Important rollout condition:** These code paths require migrations `20261118_001_tenant_identity.sql` and `20261118_002_invitation_tenant_scope.sql` to have been applied successfully before deploying this code. Neither migration has been applied to a database in this work. Do not deploy this change against a database missing these tables/columns. Session loading does not yet expose or enforce tenant context for every authenticated API route; operational route/query scoping and cross-tenant tests remain unresolved.

**Verification:** GitHub Actions push run `44251832834` for commit `a60c5f7f61edd69c59f5688fd268e0f9897b7ac1` completed successfully: locked dependency install, TypeScript check, authentication unit tests, and production build all passed. An earlier test run failed because the in-memory test double did not model the literal Owner membership role; the test double was corrected and the subsequent run passed. No live PostgreSQL migration, runtime HTTP test against a real DB, deployment, or customer isolation certification is claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-15 | Authentication / Tenant Membership | Owner bootstrap and invitation acceptance did not create tenant identity/membership links. | Source implementation and unit-test assertions committed; GitHub Actions push run `44251832834` passed install, TypeScript, auth tests and build; migrations unapplied; session tenant context, operational tenant scoping and cross-tenant runtime tests pending |


## 21. Fail-Closed Tenant Membership Request Guard (2026-11-18)

**Implemented on the feature branch:** createAuthGuards().requireTenantMembership in auth.ts now:
- Requires the already-authenticated server session and resolves membership using only the session user ID.
- Queries active memberships joined to active tenants; it never trusts a tenant ID supplied by the client.
- Allows the request only when exactly one active tenant membership is found.
- Rejects no active membership with HTTP 403 and multiple active memberships with HTTP 409, requiring a future explicit tenant-selection flow rather than silently choosing a workspace.
- Stores the resolved { tenantId, role } in res.locals.tenantContext for downstream route handlers.

**Tests:** tests/auth.test.ts now checks successful Owner workspace resolution and denial after the membership is suspended. GitHub Actions push run 44252012143 for commit 67aec302d1a4a029417ca636f734074a78114f91 completed successfully: dependency install, TypeScript check, authentication tests, and production build passed.

**Scope limitation:** The middleware is available but has not yet been mounted on the customer-owned operational route families. Existing Owner-only containment remains. This does not yet isolate projects, tasks, proposals, workflows, publishing, analytics, or audit data by tenant. No live PostgreSQL test or deployment is claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-15 | Authentication / Tenant Context | Authenticated requests had no reusable server-side resolver for an active tenant membership. | Fail-closed middleware and unit test committed; CI run 44252012143 passed; route integration and tenant-scoped data/query migration pending |


## 22. Durable Agent Task Queue Tenant Schema (2026-11-18)

**Added on the feature branch:** migrations/20261118_003_agent_task_tenant_scope.sql adds nullable tenant_id foreign keys to agent_tasks and agent_task_events. It backfills tasks only when owner_id maps to a user with exactly one active membership in an active tenant, then copies the resolved tenant ID to child task events. Tenant history/ready indexes are added.

**Fail-closed compatibility:** legacy tasks/events that cannot be mapped unambiguously remain NULL. Future queue APIs and workers must exclude NULL tenant_id from reads, claims, retries, execution and history; they must scope all operations by the resolved tenant. No task rows are deleted or rewritten beyond the additive tenant_id backfill.

**Scope limitation:** This is schema preparation only. No task API, worker claim loop, queue execution, or task-history route has been switched to tenant_id. The migration has NOT been applied to a database and no live SQL execution is claimed.

**Verification:** migration source was refetched at the branch head. GitHub Actions run `44252214742` for branch commit `77fb1ac8232e8e262df17d70f735b1746a7aea41` completed successfully: locked dependency installation, TypeScript check, authentication unit tests, and production build all passed. A second PR-triggered run `44252223107` also completed successfully. No PostgreSQL application or runtime execution is claimed.

| Issue ID | Module | Finding | Status |
| :--- | :--- | :--- | :--- |
| MP-SEC-15 | Agent Task Queue / Tenant Isolation | Durable queue schema stores owner_id but has no tenant key for tenant-scoped claims and task-event history. | Additive tenant_id migration committed; CI, database application, queue API/worker tenant predicates and runtime cross-tenant tests pending |


## 23. Worker Delegation and Durable Task Execution Gap (2026-11-18)

**Fresh source inspection at branch head `77fb1ac8232e8e262df17d70f735b1746a7aea41`:**
- `server.ts` contains no references to `agent_tasks` or `agent_task_events`; the new durable queue schema is not connected to an API or worker.
- `GET /api/worker-agents` returns the process-wide `workerAgents` array directly.
- `POST /api/worker-agents/delegate` finds an in-memory agent, changes `status` to `executing`, stores `activeMission`, writes an audit entry, and returns the agent. It does not enqueue a durable task, invoke an AI model/tool, run a worker, or verify mission completion.
- `src/components/WorkerAgentsCenter.tsx` displays “Mission delegated” and “Agent status updated to executing” after this status mutation; this is not evidence that the mission executed.
- `src/components/TaskWorkflowModal.tsx` receives `onStart`, `onApproveStep`, `onNextStep`, `onRetry`, and `onCancel` as props. The modal itself does not persist workflow steps or execute a backend task.
- Repository tree inspection found no task queue worker implementation file; the only durable queue source currently present is the SQL migration foundation.

**Issue classification:** This is a newly documented source-level confirmation of the existing MP-WF-07 / MP-WF-08 gap, not a separate new issue ID. It also blocks closure of MP-SEC-15 because queue execution and history cannot yet be tenant-scoped when no durable queue API/worker is wired.

**Required implementation before calling delegation real:** introduce authenticated task create/read/cancel/approve endpoints that derive tenant context from the session; write task and event rows transactionally; require non-NULL tenant_id; scope every query, claim, retry, approval, and event read by tenant_id; add a worker claim loop with safe leases and bounded retries; ensure consequential tasks remain waiting_approval until a human approval is recorded; and add cross-tenant denial plus queue lifecycle tests. Do not report an agent as executing/completed until a durable task state transition and worker evidence support it.

**Verification boundary:** Source files and repository tree were inspected and refetched. No task was enqueued, no worker was run, no database migration was applied, and no production/runtime execution was tested.

| Issue ID | Module | Finding | Status |
|---|---|---|---|
| MP-WF-07 | Worker Delegation / Orchestration | Delegation endpoint only mutates an in-memory status and audit log; no durable queue or real worker execution. | Source-confirmed; implementation pending |
| MP-WF-08 | Workflow History / Notifications | Workflow modal state/logs are callback-driven UI state; durable task/event history is not wired to the interface. | Source-confirmed; implementation pending |
| MP-SEC-15 | Agent Task Queue / Tenant Isolation | Tenant queue schema exists but no tenant-scoped queue API or worker uses it. | Schema committed; API/worker tenant predicates and cross-tenant tests pending |
