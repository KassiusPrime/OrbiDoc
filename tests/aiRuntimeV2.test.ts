import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runtime = fs.readFileSync(new URL('../api/_lib/aiRuntimeV2.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const nativeWeb = fs.readFileSync(new URL('../scripts/configure-native-ai-web.mjs', import.meta.url), 'utf8');

test('server uses strict V2 multi-provider runtime instead of legacy cross-provider fallback', () => {
  assert.match(server, /runChatV2/);
  assert.match(server, /streamChatV2/);
  assert.doesNotMatch(server, /streamChatSafely/);
  assert.match(runtime, /Deliberately no cross-provider fallback/);
  assert.doesNotMatch(runtime, /chooseFallback/);
});

test('research model is a real Groq Compound system with web tools', () => {
  assert.match(runtime, /id: 'groq\/compound'/);
  assert.match(runtime, /id: 'groq\/compound-mini'/);
  assert.match(runtime, /enabled_tools: \['web_search', 'visit_website'\]/);
  assert.match(runtime, /Groq-Model-Version': 'latest'/);
});

test('Gemini and OpenRouter web research use provider-native search tools', () => {
  assert.match(runtime, /tools: \[\{ googleSearch: \{\} \}\]/);
  assert.match(runtime, /openrouter:web_search/);
  assert.match(runtime, /openrouter:web_fetch/);
});

test('Android research keeps Gemini, Groq and OpenRouter provider-native search', () => {
  assert.match(nativeWeb, /google_search/);
  assert.match(nativeWeb, /groq\/compound-mini/);
  assert.match(nativeWeb, /openrouter:web_search/);
});

test('catalog marks research and strict provider routing explicitly', () => {
  assert.match(runtime, /research: true/);
  assert.match(runtime, /strictProvider: true/);
  assert.match(runtime, /verified: confirmed/);
});
