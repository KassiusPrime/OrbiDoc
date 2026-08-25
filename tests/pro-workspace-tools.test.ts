import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionalFormat, createFilteredSheet, markInvalid, replaceInRange, sortRange, trimRange, validateRange, type ProSheet } from '../src/lib/spreadsheetPro';
import { applyMasterFooter, auditDeck, createAgendaSlide, removeMasterFooter } from '../src/lib/presentationPro';
import { auditDesign, clampDesignElements, contrastRatio, resizeComposition } from '../src/lib/designPro';
import type { StudioElement } from '../src/lib/officeStudio';

const sheet = (): ProSheet => ({
  id: 's1', name: 'Dados', rows: 80, cols: 20, cells: {
    A1: { value: 'Nome', bold: true }, B1: { value: 'Status', bold: true }, C1: { value: 'Valor', bold: true },
    A2: { value: '  Ana   Silva  ' }, B2: { value: 'Ativo' }, C2: { value: '20' },
    A3: { value: 'Bruno' }, B3: { value: 'Inativo' }, C3: { value: '5' },
    A4: { value: 'Carla' }, B4: { value: 'Ativo' }, C4: { value: '12' },
  }, columnWidths: {},
});

test('spreadsheet pro filters to a new sheet without mutating the source', () => {
  const source = sheet();
  const filtered = createFilteredSheet(source, 'A1:C4', 'B', 'Ativo', true, true, 'Ativos');
  assert.ok(filtered);
  assert.equal(filtered?.cells.A1.value, 'Nome');
  assert.equal(filtered?.cells.A2.value, 'Ana   Silva');
  assert.equal(filtered?.cells.A3.value, 'Carla');
  assert.equal(source.cells.A3.value, 'Bruno');
});

test('spreadsheet pro sorts, trims, replaces, validates and formats ranges', () => {
  const source = sheet();
  const trimmed = trimRange(source, 'A2:A4');
  assert.equal(trimmed.sheet.cells.A2.value, 'Ana Silva');
  const replaced = replaceInRange(trimmed.sheet, 'B2:B4', 'Ativo', 'OK', true);
  assert.equal(replaced.replacements, 2);
  const sorted = sortRange(replaced.sheet, 'A1:C4', 'C', 'desc', true);
  assert.equal(sorted.cells.C2.value, '20');
  assert.equal(sorted.cells.C4.value, '5');
  const invalid = validateRange(sorted, 'C2:C4', { kind: 'number', min: 10 });
  assert.deepEqual(invalid, ['C4']);
  const marked = markInvalid(sorted, invalid);
  assert.equal(marked.cells.C4.bgColor, '#FEE2E2');
  const conditional = conditionalFormat(marked, 'C2:C4', { kind: 'greater', value: 15 });
  assert.equal(conditional.matched, 1);
  assert.equal(conditional.sheet.cells.C2.bgColor, '#DCFCE7');
});

const baseElement = (id: string, content = ''): StudioElement => ({ id, type: 'text', x: 0, y: 0, width: 200, height: 60, rotation: 0, opacity: 1, fill: '#0B1220', stroke: 'transparent', strokeWidth: 0, content, fontSize: 24, fontFamily: 'Inter, sans-serif', fontWeight: 700, textAlign: 'left' });

test('presentation pro applies removable footer and slide numbers', () => {
  const deck = { title: 'Deck', slides: [{ id: 'a', title: 'Capa', elements: [] }, { id: 'b', title: 'Dados', elements: [] }] };
  const mastered = applyMasterFooter(deck, 'Confidencial', { numbers: true, skipFirst: true });
  assert.equal(mastered.slides[0].elements.length, 0);
  assert.equal(mastered.slides[1].elements.length, 2);
  assert.ok(mastered.slides[1].elements.some((element) => element.content === 'Confidencial'));
  assert.equal(removeMasterFooter(mastered).slides[1].elements.length, 0);
});

test('presentation pro creates agenda and reports structural issues', () => {
  const deck = { slides: [{ id: 'a', title: 'Capa', notes: 'ok', elements: [] }, { id: 'b', title: 'Mercado', notes: '', elements: [] }, { id: 'c', title: 'Plano', notes: '', elements: [] }] };
  const withAgenda = createAgendaSlide(deck, true);
  assert.equal(withAgenda.slides[1].title, 'Agenda');
  assert.deepEqual(withAgenda.slides[1].bullets, ['Mercado', 'Plano']);
  const audit = auditDeck({ slides: [{ id: 'x', title: '', notes: '', layout: 'content', bullets: Array(8).fill('x'), elements: [] }] });
  assert.ok(audit.warnings >= 2);
  assert.ok(audit.info >= 1);
});

test('design pro resizes proportionally and clamps lost elements', () => {
  const design = { width: 1000, height: 1000, background: '#ffffff', elements: [{ ...baseElement('one', 'Título'), x: 100, y: 100, width: 400, height: 100 }, { ...baseElement('two', 'Fora'), x: 950, y: 960, width: 200, height: 100 }] };
  const resized = resizeComposition(design, 2000, 1000);
  assert.equal(resized.width, 2000);
  assert.equal(resized.elements[0].width, 400);
  assert.equal(resized.elements[0].x, 600);
  const clamped = clampDesignElements(design);
  assert.equal(clamped.changed, 1);
  assert.equal(clamped.design.elements[1].x, 800);
  assert.equal(clamped.design.elements[1].y, 900);
});

test('design pro audits contrast and out-of-bounds content', () => {
  assert.ok((contrastRatio('#000000', '#ffffff') || 0) > 20);
  const audit = auditDesign({ width: 1080, height: 1080, background: '#ffffff', elements: [{ ...baseElement('low', 'Baixo contraste'), fill: '#dddddd', fontSize: 14 }, { ...baseElement('lost', 'Fora'), x: -30 }] });
  assert.ok(audit.warnings >= 2);
  assert.ok(audit.info >= 1);
});
