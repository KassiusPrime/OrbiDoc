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

test('quick spreadsheet aggregate functions ignore non numeric cells consistently', () => {
  const sheet = source();
  sheet.cells.B5 = { value: 'texto' };
  sheet.cells.B6 = { value: '' };
  assert.equal(insertQuickFormula(sheet, 'B2:B6', 'D1', 'COUNT')?.value, 3);
  assert.equal(insertQuickFormula(sheet, 'B2:B6', 'D2', 'AVERAGE')?.value, 20);
  assert.equal(insertQuickFormula(sheet, 'B2:B6', 'D3', 'MIN')?.value, 10);
  assert.equal(insertQuickFormula(sheet, 'B2:B6', 'D4', 'MAX')?.value, 30);
});
