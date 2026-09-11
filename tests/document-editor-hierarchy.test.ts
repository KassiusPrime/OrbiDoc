import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('document editor follows the Google Docs hierarchy: context bar, toolbar, page and status bar', () => {
  const studio = read('src/components/DocumentEditorStudio.tsx');

  for (const region of ['1 · Context bar', '2 · Toolbar', '3 · Página', '4 · Status bar']) {
    assert.ok(studio.includes(region), `região ausente: ${region}`);
  }

  // A folha é a protagonista: fundo neutro, sombra suave e impressão funcional.
  assert.match(studio, /orbit-doc-canvas/);
  assert.match(studio, /orbit-doc-sheet/);
  assert.match(studio, /orbidoc-page/);
  assert.match(studio, /orbit-doc-toolbar/);

  // Contrato com localizar/substituir, painel Pro e outline.
  assert.match(studio, /orbidoc-rich-editor/);

  // Busca vive na barra de status; configuração de página também.
  assert.match(studio, /Localizar…/);
  assert.match(studio, /Tamanho da página/);
  assert.match(studio, /Zoom/);
});

test('advanced tools are only mounted inside the drawer, never stacked above the page', () => {
  const wrapper = read('src/components/DocumentEditor.tsx');
  const studio = read('src/components/DocumentEditorStudio.tsx');

  // O shell abre o drawer pelo botão "Avançado" e por Ctrl+H / Ctrl+F.
  assert.match(wrapper, /Avançado/);
  assert.match(wrapper, /orbit-drawer/);
  assert.match(wrapper, /event\.ctrlKey \|\| event\.metaKey/);

  for (const advanced of ['DocumentOutlinePane', 'DocumentFindReplaceBar', 'DocumentProPanel', 'OrbitProjectActions']) {
    assert.ok(wrapper.includes(advanced), `ferramenta avançada fora do drawer: ${advanced}`);
    assert.ok(!studio.includes(`<${advanced}`), `ferramenta avançada montada acima da página: ${advanced}`);
  }

  assert.doesNotMatch(wrapper, /StudioPowerBar/);
  assert.doesNotMatch(studio, /StudioPowerBar/);
});

test('document editor preserves autosave, templates, import/export, page setup and AI', () => {
  const studio = read('src/components/DocumentEditorStudio.tsx');

  for (const contract of [
    'orbidoc_document_v4_',
    'orbidoc_document_page_v1_',
    'DOCUMENT_TEMPLATES',
    'richHtmlToDocxBlob',
    'richHtmlToText',
    'sanitizeRichHtml',
    'mammoth',
    'convertFile',
    'sendToVercel',
    'OFFICE_FONTS',
    'onMouseDown={(event) => event.preventDefault()}',
  ]) {
    assert.ok(studio.includes(contract), `contrato perdido: ${contract}`);
  }
});

test('shared project tools keep snapshot and portable backup available to every editor', () => {
  const tools = read('src/components/orbit/OrbitProjectTools.tsx');
  const frame = read('src/components/orbit/OrbitEditorFrame.tsx');

  assert.match(tools, /snapshotAllProjects/);
  assert.match(tools, /orbidoc-project/);
  assert.match(tools, /ORBIT_SHORTCUTS/);
  assert.match(frame, /useProjectTools/);
  assert.match(frame, /OrbitShortcutsDialog/);
});
