import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('RAG and Live Search use the existing Gemini model with a declared search_web function', () => {
  assert.match(server, /import \{ GoogleGenAI, FunctionCallingConfigMode \} from '@google\/genai'/);
  assert.match(server, /functionDeclarations:\s*\[\{\s*name: 'search_web'/);
  assert.match(server, /functionCallingConfig:\s*\{ mode: FunctionCallingConfigMode\.ANY, allowedFunctionNames: \['search_web'\] \}/);
  assert.match(server, /functionResponse:\s*\{/);
  assert.match(server, /model: serverStore\.gemini\.model/);
});

test('RAG and Live Search require tenant encrypted Search and Gemini secrets and halt checks', () => {
  assert.match(server, /const searchApiKey = getOwnerSecret\('search'\)/);
  assert.match(server, /const geminiApiKey = getOwnerSecret\('gemini'\)/);
  assert.match(server, /await assertOwnerEmergencyHaltClear\(ownerId\);\s*const firstResponse = await client\.models\.generateContent/);
  assert.match(server, /searchBraveWeb\(query, searchApiKey, \(\) => assertOwnerEmergencyHaltClear\(ownerId\)\)/);
  assert.match(server, /await assertOwnerEmergencyHaltClear\(ownerId\);\s*const finalResponse = await client\.models\.generateContent/);
  assert.doesNotMatch(server, /process\.env\.(?:SEARCH_API_KEY|BING_SEARCH_API_KEY|BRAVE_SEARCH_API_KEY|TAVILY_API_KEY)/);
});

test('RAG corpus and research endpoints require Owner authorization', () => {
  assert.match(server, /app\.post\('\/api\/knowledge\/documents', requireOwnerForSecrets/);
  assert.match(server, /app\.get\('\/api\/knowledge\/documents', requireOwnerForSecrets/);
  assert.match(server, /app\.post\('\/api\/research', requireOwnerForSecrets/);
  assert.match(server, /app\.delete\('\/api\/knowledge\/documents\/:id', requireOwnerForSecrets/);
});
