import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Nexus AI exposes one assistant without provider or model selectors', () => {
  const workspace = read('src/components/AiWorkspace.tsx');
  const client = read('src/api/chat.ts');
  const runtime = read('api/_lib/nexusAI.ts');

  assert.match(workspace, /Nexus AI/);
  assert.match(workspace, /IA unificada · orquestração gratuita ativa/);
  assert.match(workspace, /Assistente unificado do Orbispace/);
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
  assert.match(editor, /captureStream/);
  assert.match(editor, /Nenhum vídeo é enviado ao servidor/);
  assert.match(editor, /Exportar trecho/);
  assert.match(shell, /Cortar vídeo/);
});

test('document studio exposes find and replace with an input event back into autosave', () => {
  const tool = read('src/components/DocumentFindReplaceBar.tsx');
  const wrapper = read('src/components/DocumentEditor.tsx');
  assert.match(tool, /Ctrl\+H/);
  assert.match(tool, /Substituir tudo/);
  assert.match(tool, /InputEvent\('input'/);
  assert.match(wrapper, /DocumentFindReplaceBar/);
});