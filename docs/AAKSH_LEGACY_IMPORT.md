# AAKSH legacy account and data migration

Master Project is the canonical application. Integrated AAKSH routes use the Master Project session cookie, app_users identity, tenant membership, PostgreSQL task queue and approval gate. The old AAKSH JSON account/session stores are not mounted by the Master Project server.

## Protected one-time import

The importer reads these files from a protected export directory:

- users.json — verified email accounts and legacy scrypt password hashes
- work-tasks.json — legacy work task history
- social-posts.json — legacy posts, likes and comments

Do not commit these files, upload them to chat, or put their contents in logs. Keep the export in a private local/staging location with restrictive file permissions.

The importer:
- imports only users with a valid UUID, verified email and supported scrypt hash;
- preserves password verification by converting the legacy hash envelope without knowing or exporting the plaintext password;
- gives each imported account its own tenant workspace and owner membership;
- imports work items into agent_tasks but requires fresh approval; previous AAKSH approvals are not trusted;
- records legacy terminal task states as unverified failures rather than claiming successful execution;
- imports social posts, likes and comments into tenant-scoped PostgreSQL tables;
- does not import old sessions or OTPs. Users must sign in again through Master Project;
- skips unverified, mobile-only, malformed or conflicting identities instead of guessing a mapping.

## Run safely

First provision a disposable or staging PostgreSQL database and apply the reviewed migrations. Set DATABASE_URL in the protected server environment; never place its value in source control or chat.

1. Set AAKSH_LEGACY_DATA_DIR to the protected export directory.
2. Set RUN_AAKSH_LEGACY_IMPORT=true.
3. Leave AAKSH_LEGACY_IMPORT_DRY_RUN=true (or unset) for the first run.
4. Run npm run import:aaksh:legacy and review only the returned counts.
5. After backing up the staging database and reviewing the counts, set AAKSH_LEGACY_IMPORT_DRY_RUN=false and run the same command once.

The script is idempotent for users, tasks and posts. It is opt-in and does not run during app startup or CI production workflows. Do not use it against production until the staging import and sign-in verification are approved.

## Remaining data boundary

The repository does not contain the user's live data/ JSON files, so no real legacy accounts or customer records have been imported in this code change. The CI integration test uses disposable synthetic fixtures only.
