import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runtime = fs.readFileSync(new URL('../api/_lib/ollamaNexus.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/api/chat.ts', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../src/components/AiWorkspace.tsx', import.meta.url), 'utf8');
const internet = fs.readFileSync(new URL('../src/lib/aiInternet.ts', import.meta.url), 'utf8');
const native = fs.readFileSync(new URL('../src/lib/nativeAndroidBridge.ts', import.meta.url), 'utf8');

test('Nexus AI uses Ollama as the single inference runtime', () => {
  assert.match(server, /from ['"]\.\/api\/_lib\/ollamaNexus\.js['"]/);
  assert.match(server, /complete\(/);
  assert.match(server, /stream\(/);
  assert.doesNotMatch(server, /nexusAI|nexusFreeAI|openrouter\.ai\/api\/v1\/chat/);
  assert.match(runtime, /OLLAMA_API_URL/);
  assert.match(runtime, /\/api\/chat/);
  assert.match(runtime, /stream:\s*true/);
});

test('Ollama runtime has connection, idle timeout and local model controls', () => {
  assert.match(runtime, /CONNECT_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(runtime, /IDLE_TIMEOUT_MS\s*=\s*45_000/);
  assert.match(runtime, /OLLAMA_MODEL/);
  assert.match(runtime, /receivedByte/);
  assert.match(runtime, /OLLAMA_IDLE_TIMEOUT/);
  assert.doesNotMatch(runtime, /max_price|allow_fallbacks|ZERO_COST_INVARIANT_VIOLATED/);
});

test('Web grounding is isolated behind optional SearXNG evidence', () => {
  const web = fs.readFileSync(new URL('../api/_lib/zeroCostWebSearch.ts', import.meta.url), 'utf8');
  assert.match(web, /SEARXNG_URL/);
  assert.match(web, /searxng-selfhosted/);
  assert.match(web, /<web_data source="searxng_selfhosted" trust="untrusted">/);
  assert.doesNotMatch(web, /api\.tavily\.com|TAVILY_API_KEY/);
  assert.doesNotMatch(runtime, /api\.tavily\.com|TAVILY_API_KEY/);
});

test('Web and Android use the same API contract without native provider routing', () => {
  assert.match(client, /orbitApiUrl\('\/api\/chat'\)|orbitApiUrl\('\/api\/chat\/stream'\)/);
  assert.match(internet, /webSearch:\s*true/);
  assert.match(native, /installNativeAiApiBridge\(\): false/);
  assert.doesNotMatch(native, /api\.groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai\/api\/v1\/chat/);
});

test('Client exposes only the installed local model list', () => {
  assert.match(workspace, /<select/);
  assert.match(workspace, /Modelo local do Nexus AI/);
  assert.match(workspace, /orbit\.chatModel/);
  assert.match(client, /model\?: string/);
});

test('Optional API auth is present without changing the browser contract', () => {
  const auth = fs.readFileSync(new URL('../api/_lib/apiAuth.ts', import.meta.url), 'utf8');
  assert.match(auth, /API_AUTH_TOKEN/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(server, /requireAuthIfConfigured/);
});
