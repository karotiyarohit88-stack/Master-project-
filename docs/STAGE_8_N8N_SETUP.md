# Stage 8 — n8n schedule setup

Import n8n/automated-content-pipeline.schedule.json into the intended n8n workspace. It is exported inactive and uses Asia/Kolkata for 09:00 and 21:00 daily.

Configure protected n8n environment values:
- MASTER_PROJECT_API_URL: existing Master Project base URL.
- MASTER_PROJECT_OWNER_SESSION_COOKIE: current OTP-authenticated Owner cookies, including both aaksh_session and aaksh_csrf cookie values.
- MASTER_PROJECT_CSRF_TOKEN: matching CSRF token.

The API retains Owner session, CSRF and Safety ON checks; no unauthenticated webhook bypass is introduced. Session expiry or missing credentials fails closed; refresh the Owner session values in n8n when needed.

The backend prepares a YouTube Short prompt pack and a 15-minute 3D cartoon long-video pack with scene prompts and ElevenLabs payload templates. If the existing n8n receiver URL is configured, the backend forwards the package with a draft-only policy. The receiver must not invoke paid providers or publish before human approval.

No paid Gemini, video-render or ElevenLabs calls are made by this code. Verify political claims against editor-supplied sources; never invent quotes, allegations, statistics or breaking-news facts.

Runtime limitation: pipeline runs and approval queue are currently in-memory. n8n provides the clock, but backend preparation requires a valid OTP Owner session. This is not yet a durable database-backed queue.
