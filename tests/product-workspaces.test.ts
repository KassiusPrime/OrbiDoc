import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('AI Studio exposes explicit provider diagnostics and provider-native web search', () => {
  const workspace = read('src/components/AiWorkspace.tsx');
  const diagnostics = read('src/components/AiDiagnosticsPanel.tsx');
  assert.match(workspace, /Diagnóstico/);
  assert.match(workspace, /undefined, undefined, true/);
  assert.match(workspace, /supportsWebSearch/);
  assert.match(diagnostics, /Provedor confirmado sem fallback oculto/);
  assert.match(diagnostics, /fallbackStatusFromCatalog/);
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
