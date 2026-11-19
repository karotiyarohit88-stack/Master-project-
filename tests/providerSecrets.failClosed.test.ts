import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('provider credentials are never loaded from process-wide environment variables', () => {
  const forbiddenEnvironmentSecrets = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'RUNWAY_API_KEY',
    'VIDEO_PROVIDER_API_KEY',
    'ELEVENLABS_API_KEY',
    'N8N_API_KEY',
    'N8N_AUTH_TOKEN',
    'PUBLISHING_API_KEY',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'GOOGLE_SHEETS_KEY',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_OAUTH_TOKEN'
  ];

  for (const name of forbiddenEnvironmentSecrets) {
    assert.equal(serverSource.includes(`process.env.${name}`), false, `global credential fallback remains for ${name}`);
  }
});

test('Owner secret resolver has no fallback argument and every call is single-argument', () => {
  assert.match(serverSource, /function getOwnerSecret\(provider: string\): string/);
  assert.doesNotMatch(serverSource, /function getOwnerSecret\([^)]*fallback/);
  assert.doesNotMatch(serverSource, /getOwnerSecret\('[^']+'\s*,/);
  assert.match(serverSource, /function getGenAI\(\): GoogleGenAI \| null \{\s*const key = getOwnerSecret\('gemini'\);/);
});

test('missing Owner-scoped AI/provider credentials fail closed instead of returning simulated success', () => {
  assert.match(serverSource, /if \(!client\) \{\s*return res\.status\(403\)\.json\(\{ error: 'Owner-scoped Gemini API key is not configured\.' \}\);/);
  assert.match(serverSource, /if \(!ownerDatabaseUrl\) return res\.status\(403\)/);
  assert.match(serverSource, /Owner-scoped OpenAI API key is not configured/);
  assert.match(serverSource, /Owner-scoped ElevenLabs API key is not configured/);
  assert.match(serverSource, /Owner-scoped n8n webhook is not configured/);
});
