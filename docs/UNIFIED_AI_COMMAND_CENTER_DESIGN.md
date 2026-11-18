# Master Project — Unified AI Command Center Design

Status: DESIGN BASELINE — implementation is incremental and not yet runtime-verified.
Repository: `karotiyarohit88-stack/Master-project-`
Target branch: `feature/master-project-api-key-secret-manager`
Scope: Extend the existing Master Project. Do not create a replacement application or a second dashboard.

## 1. Product decision

The product has ONE primary dashboard and ONE shared execution/control plane.
Agents, models, platforms, customer projects, reports, approvals, and settings are workspaces/sections inside that dashboard. They are not independent dashboards or separate execution engines.

Keep existing routes, modules, login, chat, settings, connections, analytics, worker-agent UI, and task workflow UI unless an inspected dependency requires a minimal compatible change. Reuse existing components and APIs where safe; avoid duplicate navigation and duplicate task histories.

## 2. Unified dashboard information architecture

The single dashboard should expose these sections through one navigation shell:

1. Overview — system health, active work, blockers, recent verified results.
2. Chief AI — request intake, scope confirmation, task decomposition, prioritization, final report.
3. Work Queue — shared task list, owner, assigned agent, dependencies, retries, approvals, status and evidence.
4. Agent Studio — create/configure/version/test/activate/disable agents from reusable templates.
5. Model Center — provider/model registry, capability routing, limits, latency, cost estimates, fallback policy.
6. Platform & Tool Studio — integration catalog, official API/OAuth setup, scoped permissions, connection tests.
7. Independent Audit — code diff review, policy checks, test results, security findings and evidence.
8. Safe Repair — backup/snapshot, bounded patch proposal, approval gate, tests, rollback.
9. Approvals — one central inbox for consequential actions and exact action details.
10. Customer Projects — isolated project workspaces, deliverables, quality checks and acceptance.
11. Activity & Reports — append-only task events, notifications, usage/cost records and exportable reports.
12. Settings & Security — users/roles, secrets, retention, model policy, audit policy and emergency stop.

These are sections in the existing application shell. They must not create multiple competing dashboards, task engines, approval stores or histories.

## 3. Chief AI and shared execution lifecycle

All requests use one canonical lifecycle:

`received -> classified -> planned -> policy_checked -> queued -> running -> awaiting_approval (when required) -> verifying -> completed | failed | blocked | cancelled`

Required stages:
1. Chief AI records the original user request and expected outcome without silently changing intent.
2. Planner produces bounded steps, affected resources, dependencies, acceptance criteria, risk level and estimated cost.
3. Policy/security gate checks identity, role, scope, data ownership, tool permissions, secret access and approval requirements.
4. One shared Work Engine dispatches only allow-listed tools to an eligible agent.
5. Execution records start/end times, actor, agent/model/tool versions, input/output references, retries and errors.
6. Independent Audit checks the actual diff/artifact and runs relevant tests; it must not rely only on the executing agent's self-report.
7. Safe Repair may prepare a minimal patch only within the approved scope, with a recoverable backup and rollback plan.
8. Audit runs again after repair. Failed checks remain failed; no forced PASS.
9. Chief AI issues a final report: VERIFIED WORKING, PARTIALLY WORKING, NOT CONNECTED, NOT TESTED, or FAILED, with file paths, test output and evidence.

A task can be marked completed only when its acceptance criteria and required independent checks pass. A queued/delegated/status-updated task is not proof that work executed.

## 4. Agent Studio

An agent definition must include:
- Stable agent ID, display name, purpose, owner/scope and version.
- Allowed task types and explicit denied task types.
- Allowed tools and resource scopes (least privilege).
- Approved model policy and fallback policy.
- Input/output schema, timeout, retry and token/cost limits.
- Human-approval rules and data-handling classification.
- Test cases, evaluation results, audit history and lifecycle status.

Lifecycle: draft -> configured -> test_pending -> tested -> awaiting_owner_activation -> active -> paused/retired.
New agents default to draft and cannot execute production tasks before test evidence and owner activation. Agents cannot grant themselves permissions, approve their own consequential actions, edit audit records, or change global policy.

## 5. Model Center

A model record is configuration/metadata, not a claim that a new model has been trained.
Track provider, model ID, supported modalities, context limits, availability, rate limits, data-use terms, estimated price, key reference (never the key), health-check time and allowed agent/task classes.

Routing policy must be server-side, deterministic where possible, budget-aware and fail closed when no permitted model is available. Paid calls require explicit user approval each time unless the user later authorizes a clearly bounded policy. Do not expose provider keys to the browser, logs, source control or model prompts. Custom model training/fine-tuning is a separate future workflow requiring data rights, compute budget, evaluation and explicit approval.

## 6. Platform & Tool Studio

Use a versioned allow-list of integration definitions. Store connection state per user/tenant and only safe metadata in ordinary records. Credentials live in the server-side secret manager or OAuth token vault, encrypted and access-controlled. Never store raw credentials in frontend state, localStorage, task payloads, logs or Git.

Connection statuses must be truthful: NOT CONNECTED, NEEDS CONFIGURATION, CONNECTED (credential present), TESTED, VERIFIED WORKING, ERROR. OAuth scopes must be minimal. Use official provider APIs and respect provider terms. External actions such as sending, posting, submitting, deleting, purchasing or changing account settings require explicit action-level approval.

## 7. Security and safety invariants

- Authentication and server-side authorization on every non-public API; owner-only mutations enforced on the server, not merely hidden in UI.
- Tenant/user ownership checked on every task, project, artifact, connection and report read/write.
- CSRF protection for cookie-authenticated mutations; secure, HttpOnly, SameSite cookies; session rotation/revocation; login/OTP rate limits.
- Secrets never returned by APIs; redact headers, tokens, credentials, personal data and sensitive prompt fragments from logs.
- Validate schemas, content types, payload sizes, IDs and allowed state transitions.
- Idempotency for retried external actions; bounded retries, timeouts, worker leases and dead-letter handling.
- Append-only audit events with actor, action, target, decision, timestamp and evidence reference. Do not permit agents to rewrite history.
- Emergency stop must prevent new dispatches and cancel/hold eligible queued work without deleting records.
- Backups and tested restore/rollback before database migrations, self-repair or destructive changes.
- No deployment, paid API call, subscription, external publication, payment, destructive operation or production migration without the required explicit owner approval.
- No agent may self-approve or bypass the independent audit/policy gate.

## 8. Data and runtime architecture

Use the existing PostgreSQL integration and migration framework only after verifying the actual target database and obtaining approval to apply migrations. The existing task-queue SQL migration is a schema foundation, not evidence of an active queue. A durable worker requires transactional claiming/leases, heartbeat, stale-lease recovery, idempotency, bounded retries, graceful shutdown and observable health.

Canonical records should cover users/tenants, projects, agent definitions/versions, model/provider metadata, integration definitions/connections, tasks, task steps, approvals, immutable audit events, artifacts/evidence, notifications and usage/cost entries. Enforce tenant ownership in every query and use database constraints/indexes for lifecycle consistency.

Do not add a second database or reuse another project’s database. Confirm the Master Project's own provisioned database and backup/restore path before enabling durable execution.

## 9. Customer work quality loop

For each customer project, Chief AI records requirements, deliverables, acceptance criteria, constraints and due date. Agents prepare work in an isolated workspace. Independent audit checks completeness, correctness, security, usability and requested format. Customer-facing delivery is staged for human review when required. Record revisions, acceptance/rejection reasons and satisfaction feedback. Never claim customer satisfaction without actual feedback.

## 10. Implementation sequence and release gates

Phase A — inspect and baseline:
- Inventory existing routes, components, auth middleware, secrets handling, migrations, tests and CI.
- Map current features to the sections above; mark each VERIFIED WORKING, PARTIALLY WORKING, NOT CONNECTED, NOT TESTED or FAILED.
- Preserve known working behavior and maintain the cumulative issue register.

Phase B — secure foundation:
- Close route-level authorization gaps, confirm tenant isolation, session/CSRF behavior and secret redaction.
- Add tests for authorization, ownership, approval and unsafe state transitions.
- Do not enable background execution until persistence and worker recovery are verified.

Phase C — shared workflow:
- Implement one durable task state machine and dispatcher using existing PostgreSQL foundations.
- Add immutable task events, approvals and notification records.
- Connect existing chat and worker-agent entry points to this canonical engine without duplicate routes/history.

Phase D — Agent and Model Studio:
- Add draft/version/test/activation lifecycle for agents.
- Add model registry and server-side policy router with budget and availability checks.
- Keep all paid providers disabled until explicitly configured and approved.

Phase E — independent audit and bounded repair:
- Build evidence-based checks and test runners.
- Implement backup, patch-scope validation, owner approval, retest and rollback.
- Require a second independent audit after every repair.

Phase F — unified dashboard:
- Integrate sections into the existing navigation shell.
- Show real backend statuses, event history, evidence and approval state.
- Do not show placeholder/simulated metrics as live facts.

Phase G — verification and release:
- Run unit, integration, authorization, tenant-isolation, migration, worker-recovery, build and end-to-end tests.
- Verify with real HTTP responses and logs in the target environment.
- Deployment and production activation remain separate approval-gated steps.

## 11. Current source observations (not runtime claims)

Inspected on the target feature branch:
- `src/App.tsx`: workflow step state is initialized in the frontend; modal callbacks advance local state and append local log strings.
- `src/components/TaskWorkflowModal.tsx`: Start/Approve/Next/Retry are callback-driven UI controls; the component itself does not execute a durable backend workflow.
- `src/components/WorkerAgentsCenter.tsx`: delegates to `POST /api/worker-agents/delegate` and reports that the agent status changed to executing.
- `server.ts`: `GET /api/worker-agents` returns the in-memory agent list; `POST /api/worker-agents/delegate` updates agent status/mission and writes an audit record, but this route alone does not prove an AI worker completed the mission.
- `server.ts`: application API session middleware, role checks for selected mutation routes, rate limiting and security middleware are present. Route-by-route coverage still requires audit.
- `database.ts` and migrations: PostgreSQL pool/probe and guarded migration runner exist in source. No live database connection or applied migration is claimed here.
- `migrations/20261114_001_agent_task_queue.sql`: queue schema foundation exists; no active worker is proven by the migration.
- `package.json`: `lint`, `build` and `test` scripts are defined; CI workflow exists. Current workflow run status must be checked separately before release.

## 12. Non-goals and boundaries

- No second dashboard or replacement application.
- No false "connected", "running", "completed", "verified" or "customer satisfied" labels.
- No automatic public registration/owner elevation or cross-customer data access.
- No uncontrolled self-modifying agent or unrestricted shell/code execution.
- No provider training or paid API use without explicit approval.
- No production migration/deployment as part of documentation or source-only changes.

## 13. Definition of done

The unified system is ready only when one user request can be traced end-to-end through Chief AI, Planner, policy gate, shared queue, worker, independent audit, approval (when required), notification and final evidence report; records survive restarts; cross-user access tests fail closed; and the existing application build and core workflows remain healthy.
