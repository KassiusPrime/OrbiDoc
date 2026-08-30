import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('office and PDF files route to one focused workspace session before the generic reader', async () => {
  const [router, agent, main] = await Promise.all([
    read('src/lib/workspaceFileImport.ts'),
    read('src/components/WorkspaceFileSessionAgent.tsx'),
    read('src/main.tsx'),
  ]);

  assert.match(router, /\['docx', 'html', 'htm', 'txt', 'md', 'markdown'\]/);
  assert.match(router, /\['xlsx', 'xls', 'csv'\]/);
  assert.match(router, /extension === 'pptx'/);
  assert.match(router, /extension === 'pdf'/);
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
  assert.match(agent, /Save-back em preparação/);
});

test('system launch queue uses the same router and unsupported files fall back to the universal reader', async () => {
  const agent = await read('src/components/WorkspaceFileSessionAgent.tsx');
  assert.match(agent, /queue\.setConsumer/);
  assert.match(agent, /if \(resolveWorkspaceEditor\(file\)\) await beginSession\(file, 'system'\)/);
  assert.match(agent, /else openFileInsideOrbiDoc\(file, 'system'\)/);
  assert.match(agent, /Tentar leitor universal/);
});

test('importers preserve editable structure for documents spreadsheets and presentations', async () => {
  const importer = await read('src/lib/workspaceFileImport.ts');
  assert.match(importer, /mammoth\.convertToHtml/);
  assert.match(importer, /XLSX\.read/);
  assert.match(importer, /cellFormula: true/);
  assert.match(importer, /ppt\/slides\/slide/);
  assert.match(importer, /notesSlides/);
  assert.match(importer, /version: 4/);
});
