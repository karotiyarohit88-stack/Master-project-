# Google Custom Search setup

The dashboard Live Search panel and search-aware AI Chat use the server-side Google Custom Search JSON API.

Set these Render environment variables on the **staging/security-hardening service only**:

- `GOOGLE_SEARCH_API_KEY`: create a Google Programmable Search / Custom Search JSON API key and store it as a secret. Never commit the value or paste it into chat.
- `GOOGLE_SEARCH_CX`: `3056ad1f2fc5843bc`

The key is deliberately blank in source control. The app returns a safe configuration error until both variables are present. The key is only read by the server and is never sent to the browser.

The Google API may have quota or billing requirements. Confirm the current Google Cloud pricing/quota before enabling live requests. Do not enable paid billing without explicit approval.

Authenticated endpoint: `GET /api/search?q=your+query`

The AI Chat backend also retrieves Google results for prompts that explicitly request web/current information. Results are treated as untrusted context, only HTTPS public URLs are shown, and API requests are rate limited. The existing tenant-scoped Brave/RAG research pipeline remains separate and unchanged.
