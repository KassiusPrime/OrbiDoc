import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runtime = fs.readFileSync(new URL('../api/_lib/nexusAI.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const web = fs.readFileSync(new URL('../api/_lib/zeroCostWebSearch.ts', import.meta.url), 'utf8');
const nativeBridge = fs.readFileSync(new URL('../src/lib/nativeAndroidBridge.ts', import.meta.url), 'utf8');

test('every Nexus AI inference path uses the unified OpenRouter runtime', () => {
  assert.match(server, /nexusAI\.complete/);
  assert.match(server, /nexusAI\.stream/);
  assert.match(runtime, /createOpenRouter/);
  assert.doesNotMatch(server, /runChatV2|streamChatV2|hydrateGatewayRuntimeAuth/);
});

test('Nexus AI enforces free-only models and keeps them internal', () => {
  assert.match(runtime, /openrouter\/free/);
  assert.match(runtime, /PAID_MODEL_FORBIDDEN/);
  assert.match(runtime, /endsWith\(':free'\)/);
  assert.match(runtime, /never expose or discuss/i);
  assert.match(runtime, /CircuitBreaker/);
  assert.match(runtime, /fallbackUsed/);
});

test('web research never falls back to OpenRouter paid web search', () => {
  assert.match(web, /tavily-free/);
  assert.match(web, /cota gratuita/i);
  assert.doesNotMatch(web, /openrouter:web_search|openrouter:web_fetch|plugins:\s*\[\{\s*id:\s*['"]web/);
});

test('Android no longer forks AI routing or stores provider choices in the web contract', () => {
  assert.match(nativeBridge, /same server-side OpenRouter/);
  assert.match(nativeBridge, /installNativeAiApiBridge\(\): false/);
  assert.doesNotMatch(nativeBridge, /gemini|groq|listAiModels|setAiKey|clearAiKey/);
});
