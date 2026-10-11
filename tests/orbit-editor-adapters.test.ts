import assert from 'node:assert/strict';
import test from 'node:test';
import type { SavedProject } from '../src/types';
import { dispatchOrbitAiTool } from '../src/lib/orbitAiTools';
import { createOrbitEditorHandlers } from '../src/lib/orbitEditorAdapters';

const makeProject = (type: SavedProject['type'], content: unknown): SavedProject => ({
  id: 'project-1',
  title: 'Projeto de teste',
  type,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  content,
});

function hostFor(initial: SavedProject) {
  let active = initial;
  const updates: SavedProject[] = [];
  return {
    host: {
      getActiveProject: () => active,
      onProjectChange: (next: SavedProject) => { active = next; updates.push(next); },
      now: () => '2026-10-10T12:00:00.000Z',
    },
    get active() { return active; },
    updates,
  };
}

test('Writer adapter appends escaped text as a paragraph without interpreting markup', async () => {
  const state = hostFor(makeProject('word', '<h1>Documento</h1>'));
  const result = await dispatchOrbitAiTool('writer.insertText', { text: '<script>alert(1)</script> & olá' }, {
    grantedPermissions: ['document.write.active'],
    handlers: createOrbitEditorHandlers(state.host),
  });
  assert.equal(result.ok, true);
  assert.match(String(state.active.content), /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; olá/);
  assert.doesNotMatch(String(state.active.content), /<script>/);
  assert.equal(state.updates.length, 1);
});

test('Sheets adapter updates exactly the selected range and clears stale formulas', async () => {
  const state = hostFor(makeProject('excel', {
    version: 4,
    activeSheetId: 'sheet-1',
    sheets: [{
      id: 'sheet-1', name: 'Planilha1', rows: 80, cols: 20,
      cells: { A1: { value: 'Antigo' }, B1: { value: '5', formula: '=2+3' }, C1: { value: 'Preservar' } },
    }],
  }));
  const result = await dispatchOrbitAiTool('sheets.setRangeValues', {
    sheetId: 'sheet-1', range: 'A1:B1', values: [['Novo', 12]],
  }, {
    grantedPermissions: ['workbook.write.active'],
    handlers: createOrbitEditorHandlers(state.host),
  });
  assert.equal(result.ok, true);
  const workbook = state.active.content as { sheets: Array<{ cells: Record<string, { value?: string; formula?: string }> }> };
  const cells = workbook.sheets[0].cells;
  assert.equal(cells.A1.value, 'Novo');
  assert.equal(cells.B1.value, '12');
  assert.equal(cells.B1.formula, undefined);
  assert.equal(cells.C1.value, 'Preservar');
  assert.equal(state.updates.length, 1);
});

test('Sheets adapter rejects mismatched dimensions without persisting partial changes', async () => {
  const state = hostFor(makeProject('excel', {
    version: 4, sheets: [{ id: 'sheet-1', name: 'Planilha1', rows: 80, cols: 20, cells: { A1: { value: 'safe' } } }],
  }));
  const result = await dispatchOrbitAiTool('sheets.setRangeValues', {
    sheetId: 'sheet-1', range: 'A1:B2', values: [['x']],
  }, {
    grantedPermissions: ['workbook.write.active'],
    handlers: createOrbitEditorHandlers(state.host),
  });
  assert.equal(result.ok, false);
  assert.equal(state.updates.length, 0);
  assert.equal((state.active.content as { sheets: Array<{ cells: Record<string, { value?: string }> }> }).sheets[0].cells.A1.value, 'safe');
});

test('Slides adapter creates a versioned native deck from a validated brief', async () => {
  const state = hostFor(makeProject('powerpoint', { version: 4, title: 'Antigo', slides: [] }));
  const result = await dispatchOrbitAiTool('slides.createDeck', {
    title: 'Plano de produto', topic: 'Objetivos, riscos e entregas', slideCount: 4,
  }, {
    grantedPermissions: ['deck.write.active'],
    handlers: createOrbitEditorHandlers(state.host),
  });
  assert.equal(result.ok, true);
  const deck = state.active.content as { version: number; title: string; slides: Array<{ id: string; title: string; layout: string }> };
  assert.equal(deck.version, 4);
  assert.equal(deck.title, 'Plano de produto');
  assert.equal(deck.slides.length, 4);
  assert.equal(deck.slides[0].layout, 'title');
  assert.ok(deck.slides.every((slide) => slide.id.length > 0));
  assert.equal(state.updates.length, 1);
});

test('editor adapters reject an active project of the wrong type', async () => {
  const state = hostFor(makeProject('word', '<p>Documento</p>'));
  const result = await dispatchOrbitAiTool('sheets.setRangeValues', {
    sheetId: 'sheet-1', range: 'A1', values: [[1]],
  }, {
    grantedPermissions: ['workbook.write.active'],
    handlers: createOrbitEditorHandlers(state.host),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EXECUTION_FAILED');
  assert.equal(state.updates.length, 0);
});
