import test from 'node:test';
import assert from 'node:assert/strict';
import { insertQuickFormula } from '../src/lib/spreadsheetQuickFormula';
import type { ProSheet } from '../src/lib/spreadsheetPro';

const source = (): ProSheet => ({ id: 'sheet', name: 'Dados', rows: 80, cols: 20, cells: { B2: { value: '10' }, B3: { value: '20' }, B4: { value: '30' } } });

test('quick spreadsheet sum calculates a value and keeps the formula editable', () => {
  const result = insertQuickFormula(source(), 'B2:B4', 'C5', 'SUM');
  assert.ok(result);
  assert.equal(result?.target, 'C5');
  assert.equal(result?.value, 60);
  assert.equal(result?.sheet.cells.C5.value, '60');
  assert.equal(result?.sheet.cells.C5.formula, '=SUM(B2:B4)');
});

test('quick spreadsheet count ignores non numeric cells', () => {
  const sheet = source();
  sheet.cells.B5 = { value: 'texto' };
  const result = insertQuickFormula(sheet, 'B2:B5', 'D1', 'COUNT');
  assert.equal(result?.value, 3);
  assert.equal(result?.sheet.cells.D1.formula, '=COUNT(B2:B5)');
});
