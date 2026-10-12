import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchOrbitAiTool, ORBIT_AI_TOOLS, validateOrbitAiToolCatalog } from '../src/lib/orbitAiTools';

test('every declared extension AI tool has a typed definition and declared permission', () => {
  assert.deepEqual(validateOrbitAiToolCatalog(), []);
  assert.equal(new Set(ORBIT_AI_TOOLS.map((tool) => tool.id)).size, ORBIT_AI_TOOLS.length);
});

test('dispatcher rejects unknown tools and malformed arguments before calling handlers', async () => {
  let called = false;
  const context = { grantedPermissions: ['context.read.selected'], handlers: { 'nexus.summarize': () => { called = true; } } };
  assert.equal((await dispatchOrbitAiTool('unknown.tool', {}, context)).code, 'UNKNOWN_TOOL');
  assert.equal((await dispatchOrbitAiTool('nexus.summarize', { text: '' }, context)).code, 'INVALID_ARGUMENTS');
  assert.equal(called, false);
});

test('dispatcher enforces explicit per-call permissions and requires a host handler', async () => {
  const denied = await dispatchOrbitAiTool('nexus.summarize', { text: 'Olá' }, { grantedPermissions: [], handlers: { 'nexus.summarize': () => 'ok' } });
  assert.equal(denied.code, 'PERMISSION_DENIED');

  const missing = await dispatchOrbitAiTool('nexus.summarize', { text: 'Olá' }, { grantedPermissions: ['context.read.selected'], handlers: {} });
  assert.equal(missing.code, 'HANDLER_UNAVAILABLE');
});

test('dispatcher calls only a registered, validated handler and returns its result', async () => {
  let received: unknown;
  const result = await dispatchOrbitAiTool(
    'nexus.summarize',
    { text: 'Resumo explícito.' },
    { grantedPermissions: ['context.read.selected'], handlers: { 'nexus.summarize': (input) => { received = input; return { summary: 'Resumo' }; } } },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(received, { text: 'Resumo explícito.' });
});

test('dispatcher handles cancellation and does not leak internal handler errors', async () => {
  const controller = new AbortController();
  controller.abort();
  const aborted = await dispatchOrbitAiTool('nexus.summarize', { text: 'Resumo' }, { grantedPermissions: ['context.read.selected'], handlers: { 'nexus.summarize': () => 'ok' }, signal: controller.signal });
  assert.equal(aborted.code, 'ABORTED');

  const failed = await dispatchOrbitAiTool('nexus.summarize', { text: 'Resumo' }, { grantedPermissions: ['context.read.selected'], handlers: { 'nexus.summarize': () => { throw new Error('secret stack'); } } });
  assert.equal(failed.code, 'EXECUTION_FAILED');
  assert.equal(failed.message.includes('secret stack'), false);
});
