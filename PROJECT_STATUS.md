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
