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
| MP-SEC-04 | `server.ts` lines 24-25, 1105 onward, 1276, 1345; `src/components/ConnectionsCenter.tsx` | Only global middleware visible at server startup is `express.json()`. Provider secret mutation/test requests are sent without an application session or authorization header. No global app-user auth middleware was found in the inspected server source. | Source-confirmed exposure; implementation pending |
| MP-SEC-06 | `src/App.tsx`; `server.ts` route inventory; `package.json` | Main React app initializes directly to `home`; no app login/register UI or application session/token middleware was found in inspected source. GitHub provider-token auth is not application-user authentication. | Source-confirmed absence in inspected files; implementation pending |
| MP-SEC-03 | `server.ts` in-memory `serverStore`; `package.json` dependencies | Provider configuration is currently held in process memory; no database client/ORM dependency appears in package manifest. | In-memory implementation confirmed; durable persistence pending |

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
