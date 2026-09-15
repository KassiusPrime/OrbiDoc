import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runtime = fs.readFileSync(new URL('../api/_lib/nexusFreeAI.ts', import.meta.url), 'utf8');
const compatibility = fs.readFileSync(new URL('../api/_lib/nexusAI.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/api/chat.ts', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../src/components/AiWorkspace.tsx', import.meta.url), 'utf8');
const internet = fs.readFileSync(new URL('../src/lib/aiInternet.ts', import.meta.url), 'utf8');
const native = fs.readFileSync(new URL('../src/lib/nativeAndroidBridge.ts', import.meta.url), 'utf8');

test('Nexus AI is the single server runtime and does not expose internal model selection', () => {
  assert.match(server, /nexusAI\.complete/);
  assert.match(server, /nexusAI\.stream/);
  assert.doesNotMatch(server, /runChatV2|streamChatV2|hydrateGatewayRuntimeAuth/);
  assert.match(client, /provider\/model are deliberately ignored/i);
  assert.doesNotMatch(workspace, /<select|<optgroup/);
  assert.match(workspace, /Nexus AI/);
});

test('Nexus AI uses the canonical OpenRouter free-only zero-price runtime', () => {
  assert.match(runtime, /openrouter\/free/);
  assert.match(runtime, /endsWith\(':free'\)/);
  assert.match(runtime, /PAID_MODEL_FORBIDDEN|OPENROUTER_API_KEY/);
  assert.match(runtime, /max_price/);
  assert.match(runtime, /prompt:\s*0/);
  assert.match(runtime, /completion:\s*0/);
  assert.match(runtime, /allow_fallbacks:\s*false/);
  assert.match(runtime, /ZERO_COST_INVARIANT_VIOLATED/);
  assert.doesNotMatch(runtime, /createOpenRouter|generateText|streamText/);
  assert.match(compatibility, /nexusFreeAI/);
});

test('research is detected centrally and uses the same Nexus backend on Web and Android', () => {
  assert.match(runtime, /webContextIfNeeded/);
  assert.match(internet, /webSearch:\s*true/);
  assert.match(native, /installNativeAiApiBridge\(\): false/);
  assert.doesNotMatch(native, /api\.groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai\/api\/v1\/chat/);
});

test('sensitive Nexus calls enforce zero-cost routing', () => {
  assert.match(runtime, /allow_fallbacks:\s*false/);
  assert.match(runtime, /max_price/);
  assert.match(runtime, /ZERO_COST_INVARIANT_VIOLATED/);
});
