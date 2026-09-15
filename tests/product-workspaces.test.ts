import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Nexus AI exposes one assistant without provider or model selectors', () => {
  const workspace = read('src/components/AiWorkspace.tsx');
  const client = read('src/api/chat.ts');
  const runtime = read('api/_lib/nexusAI.ts');

  assert.match(workspace, /Nexus AI/);
  assert.match(workspace, /IA unificada · (orquestração gratuita ativa|gratuita)/);
  assert.match(workspace, /Assistente unificado do (Orbispace|Orbit)/);
  assert.match(workspace, /Virtuoso/);
  assert.match(workspace, /Pesquisar|Web/);
  assert.doesNotMatch(workspace, /<select|<optgroup|providerLabel|researchModelKey/);

  // Compatibility arguments may still exist while older editors migrate,
  // but the client/server deliberately ignore model choice from the UI.
  assert.match(client, /provider\/model are deliberately ignored/);
  assert.match(runtime, /openrouter\/free/);
  assert.match(runtime, /:free/);
  assert.match(runtime, /max_price/);
  assert.match(runtime, /allow_fallbacks/);
});

test('video clip editor remains local and feature-detects browser recording support', () => {
  const editor = read('src/components/VideoClipEditor.tsx');
  const shell = read('src/components/AudioWorkspace.tsx');
  assert.match(editor, /MediaRecorder/);
  assert.match(editor, /isTypeSupported/);
  assert.doesNotMatch(editor, /fetch\(['"]https?:\/\//);
  assert.match(shell, /VideoClipEditor/);
});
