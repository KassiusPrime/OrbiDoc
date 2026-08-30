import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('office and PDF files route to one focused workspace session before the generic reader', async () => {
  const [wrapper, canonical, agent, main] = await Promise.all([
    read('src/lib/workspaceFileImport.ts'),
    read('src/lib/editorFileRouting.ts'),
    read('src/components/WorkspaceFileSessionAgent.tsx'),
    read('src/main.tsx'),
  ]);

  assert.match(wrapper, /editorRouteForFile/);
  assert.match(wrapper, /extension === 'pdf'/);
  assert.match(canonical, /\['docx', 'html', 'htm', 'txt', 'md', 'markdown'\]/);
  assert.match(canonical, /\['xlsx', 'xls', 'xlsm', 'xltx', 'csv', 'tsv'\]/);
  assert.match(canonical, /extension === 'pptx'/);
  assert.match(agent, /event\.stopImmediatePropagation\(\)/);
  assert.ok(main.indexOf('<WorkspaceFileSessionAgent />') < main.indexOf('<SystemFileOpenAgent />'));
});

test('focused sessions reuse the real editors instead of introducing duplicate mini apps', async () => {
  const agent = await read('src/components/WorkspaceFileSessionAgent.tsx');
  assert.match(agent, /<DocumentEditor project=\{project\}/);
  assert.match(agent, /<SpreadsheetEditor project=\{project\}/);
  assert.match(agent, /<PresentationEditor project=\{project\}/);
  assert.match(agent, /<PdfOcrWorkspace items=\{ocrItems\}/);
  assert.match(agent, /sessão local editável/);
  assert.match(agent, /Salvar na origem/);
});

test('system launch queue uses the same router and unsupported files fall back to the universal reader', async () => {
  const agent = await read('src/components/WorkspaceFileSessionAgent.tsx');
  assert.match(agent, /queue\.setConsumer/);
  assert.match(agent, /if \(resolveWorkspaceEditor\(file\)\) await beginSession\(file, 'system'\)/);
  assert.match(agent, /else openFileInsideOrbiDoc\(file, 'system'\)/);
  assert.match(agent, /Tentar leitor universal/);
});

test('one canonical office importer preserves editable document spreadsheet and presentation structure', async () => {
  const [wrapper, importer] = await Promise.all([
    read('src/lib/workspaceFileImport.ts'),
    read('src/lib/editorFileRouting.ts'),
  ]);
  assert.match(wrapper, /createEditorProjectFromFile\(file, source, origin\)/);
  assert.doesNotMatch(wrapper, /mammoth\.convertToHtml/);
  assert.match(importer, /mammoth\.convertToHtml/);
  assert.match(importer, /XLSX\.read/);
  assert.match(importer, /cellFormula: true/);
  assert.match(importer, /ppt\/slides\/slide/);
  assert.match(importer, /notesSlides/);
  assert.match(importer, /origin: normalizeOrigin/);
});

test('connected files keep provider identity in memory without persisting provider secrets', async () => {
  const [open, cloud, github] = await Promise.all([
    read('src/lib/systemFileOpen.ts'),
    read('src/services/connectedFileAccess.ts'),
    read('src/services/githubFiles.ts'),
  ]);
  assert.match(open, /new WeakMap<File, Partial<OrbiDocFileOrigin>>/);
  assert.match(open, /bindOrbiDocFileOrigin/);
  assert.match(cloud, /providerId: file\.id/);
  assert.match(cloud, /etag:/);
  assert.match(cloud, /readOnly: Boolean\(native\)/);
  assert.match(github, /readOnly: true/);
  assert.match(github, /repository: \{ owner: target\.owner, repo: target\.repo, path: entry\.path/);
});

test('cloud save-back serializes the active editor and refuses stale remote revisions', async () => {
  const [save, serializer, agent] = await Promise.all([
    read('src/services/connectedFileSave.ts'),
    read('src/lib/projectFileSerialization.ts'),
    read('src/components/WorkspaceFileSessionAgent.tsx'),
  ]);
  assert.match(save, /ConnectedFileConflictError/);
  assert.match(save, /serializeProjectToSourceFile\(project\)/);
  assert.match(save, /method: 'PATCH'/);
  assert.match(save, /method: 'PUT'/);
  assert.match(save, /'If-Match': currentEtag/);
  assert.match(serializer, /richHtmlToDocxBlob/);
  assert.match(serializer, /bookType: 'xlsx'/);
  assert.match(serializer, /new PptxGenJS\(\)/);
  assert.match(agent, /saveProjectToConnectedOrigin\(project\)/);
  assert.match(agent, /nenhuma versão é sobrescrita/);
});
