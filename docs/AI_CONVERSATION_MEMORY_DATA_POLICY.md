# AI Conversation Memory — Data and Safety Notes

## Purpose
The `ai_conversation_memory` table stores bounded, sanitized user questions and assistant responses so the authenticated AI Page Guide can use recent tenant-scoped context in later turns. The store is a retrieval/context feature; it does **not** train, fine-tune, or update a model automatically.

## Stored fields
- `owner_id`, `tenant_id`: mandatory identity scope.
- `role`: `user` or `assistant`.
- `content`: sanitized text, maximum 4,000 characters per turn.
- `context`: allow-listed metadata only (`page`, `language`, `questionType`).
- `created_at`: server timestamp.

## Security
- Every read/write starts a PostgreSQL transaction and sets transaction-local `app.owner_id` and `app.tenant_id`.
- PostgreSQL Row Level Security is enabled and forced; a composite tenant/owner foreign key prevents mismatched identity rows.
- The application redacts common labelled credentials, bearer tokens, JWT-shaped tokens, and common provider key formats before persistence.
- Page DOM text, control labels, web snippets, and conversation history remain untrusted prompt context.
- The durable Emergency Halt is checked before the Gemini and live-search provider calls.
- API keys are resolved from encrypted tenant secrets; no Google Search API key is read from a global environment fallback in the Page Guide or `/api/search` endpoint.

## Training/learning boundary
Stored turns can later support retrieval evaluation, prompt-quality analysis, or a separately approved dataset export. They are not sent to model-training services. Any future training/export workflow must add explicit user consent, data minimization, redaction review, retention controls, and a separate Owner approval gate.

## Operations
Apply the forward-only migration `20261126_001_ai_conversation_memory.sql` only through the existing approved migration process. No production database migration is run by this code change.
