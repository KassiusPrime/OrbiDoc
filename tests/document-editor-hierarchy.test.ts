import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('document editor follows the Google Docs hierarchy: context bar, toolbar, page and status bar', () => {
  const studio = read('src/components/DocumentEditorStudio.tsx');

  for (const region of ['1 · Context bar', '2 · Toolbar', '3 · Régua', '4 · Página', '5 · Status bar']) {
    assert.ok(studio.includes(region), `região ausente: ${region}`);
  }

  // Régua em centímetros alinhada à folha, com toggle na barra de status.
  assert.match(studio, /DocumentRuler/);
  assert.match(studio, /pageWidth=\{PAGE_WIDTH/);

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

test('spreadsheet surface follows the same contract as the document surface', () => {
  const sheetStudio = read('src/components/SpreadsheetEditorStudio.tsx');
  const sheetWrapper = read('src/components/SpreadsheetEditor.tsx');

  // Mesma hierarquia: context bar → toolbar → grade → status bar.
  for (const region of ['1 · Context bar', '2 · Toolbar', '3 · Grade', '4 · Status bar']) {
    assert.ok(sheetStudio.includes(region), `região ausente na planilha: ${region}`);
  }

  // Grade protagonista preservada com recursos da Fase 4 anterior.
  assert.match(sheetStudio, /orbit-sheet-scroll/);
  assert.match(sheetStudio, /orbit-sheet /);
  assert.match(sheetStudio, /OrbitResizeGrip/);

  // Uma única toolbar de superfície; sem moldura de terceira faixa.
  assert.doesNotMatch(sheetWrapper, /from '.\/orbit\/OrbitEditorFrame'/);
  assert.match(sheetStudio, /orbit-surface-toolbar/);

  // O painel Pro vai para o drawer, não para uma faixa permanente.
  assert.match(sheetStudio, /OrbitDrawer/);
  assert.match(sheetWrapper, /advancedTools=/);

  // Recursos de negócio preservados.
  for (const contract of ['recalculateWorkbookFormulas', 'orbidoc_spreadsheet_v4_', 'SpreadsheetProPanel']) {
    assert.ok(sheetWrapper.includes(contract), `contrato perdido na planilha: ${contract}`);
  }
});

test('shell shows the object title only once, never duplicated by the surface', () => {
  const shell = read('src/AppV5.tsx');
  assert.match(shell, /surfaceOwnsTitle/);
  assert.match(shell, /shellTitle/);
  assert.doesNotMatch(shell, /rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8/);
  assert.match(shell, /orbit-empty-state/);
});

test('GitHub is a first-class repo surface, not an integration overlay', () => {
  const shell = read('src/AppV5.tsx');
  const main = read('src/main.tsx');
  const surface = read('src/components/RepoSurface.tsx');

  // Nav e rota de primeira classe.
  assert.match(shell, /id: 'repos'/);
  assert.match(shell, /RepoSurface/);
  assert.ok(!shell.includes('GitHubProjectsWorkspace'), 'shell ainda monta o overlay GitHub');

  // O overlay antigo deixou de existir em main.tsx.
  assert.doesNotMatch(main, /GitHubProjectsWorkspace/);

  // Contrato da surface: uma context bar, tree + arquivo, sem iframe.
  assert.match(surface, /orbit-contextbar/);
  assert.match(surface, /RepoTree/);
  assert.match(surface, /RepoFileViewer/);
  assert.match(surface, /Abrir no GitHub/);
  assert.doesNotMatch(surface, /<iframe/);
  assert.doesNotMatch(surface, /rounded-3xl/);

  // Conector existente reaproveitado; nenhuma dependência nova de git.
  assert.match(surface, /listGitHubRepositories/);
  assert.match(surface, /loadGitHubRepositoryTree/);
  assert.match(surface, /readGitHubTextFile/);
  assert.match(surface, /listGitHubBranches/);
  assert.match(surface, /switchBranch/);
});
