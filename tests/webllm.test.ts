import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('WebLLM runtime uses a browser-local worker model', async () => {
  const source = await readFile('src/ai/webllm.ts', 'utf8');
  assert.match(source, /WebGPU/);
  assert.match(source, /webllm\.worker\.ts/);
  assert.match(source, /Llama-3\.2-1B-Instruct-q4f16_1-MLC/);
  assert.match(source, /indexeddb/);
});

test('Nexus streaming prefers WebLLM when the request is local-only', async () => {
  const source = await readFile('src/api/chat.ts', 'utf8');
  assert.match(source, /streamWebLLM/);
  assert.match(source, /!options\?\.webSearch/);
  assert.match(source, /!options\?\.files\?\.length/);
  assert.match(source, /\/api\/chat\/stream/);
});
