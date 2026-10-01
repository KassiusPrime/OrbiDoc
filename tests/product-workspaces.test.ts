import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Nexus AI exposes one assistant with a local model selector', () => {
  const workspace = read('src/components/AiWorkspace.tsx');
  const client = read('src/api/chat.ts');
  const runtime = read('api/_lib/ollamaNexus.ts');

  assert.match(workspace, /Nexus AI/);
  assert.match(workspace, /Nexus AI/);
  assert.match(workspace, /Local · Ollama/);
  assert.match(workspace, /Como posso ajudar\?/);
  assert.match(workspace, /Virtuoso/);
  assert.match(workspace, /Pesquisar|Web/);
  assert.match(workspace, /<select/);
  assert.match(workspace, /Modelo local do Nexus AI/);
  assert.doesNotMatch(workspace, /providerLabel|researchModelKey/);
  assert.doesNotMatch(workspace, /quickActions|MediaToolRail|modeLabels|Ferramentas de mídia/);
  assert.doesNotMatch(workspace, /Documento atual.*Arquivos.*Mídia.*Colar.*Adicionar contexto/);
  assert.match(workspace, /placeholder="Pergunte alguma coisa"/);
  assert.match(workspace, /bg-\[#6750D8\]/);
  assert.match(workspace, /max-w-3xl/);
  assert.match(workspace, /opacity-0 transition-opacity/);

  // Compatibility arguments remain in the API facade, while the selected local model is sent explicitly.
  assert.match(client, /model\?: string/);
  assert.match(runtime, /Ollama/);
  assert.match(runtime, /OLLAMA_MODEL/);
  assert.match(runtime, /searxng-selfhosted/);
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