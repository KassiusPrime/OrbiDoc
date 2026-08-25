import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWorkbookCell, recalculateWorkbookFormulas, type FormulaWorkbook } from '../src/lib/spreadsheetFormulaEngine';

const workbook = (): FormulaWorkbook => ({
  activeSheetId: 'dados',
  sheets: [
    { id: 'dados', name: 'Dados', rows: 80, cols: 20, cells: {
      A1: { value: 'Item' }, B1: { value: 'Valor' },
      A2: { value: 'A' }, B2: { value: '10' },
      A3: { value: 'B' }, B3: { value: '20' },
      A4: { value: 'C' }, B4: { value: 'texto' },
      A5: { value: 'D' }, B5: { value: '' },
      C2: { formula: '=SUM(B2:B5)', value: '' },
      C3: { formula: '=AVERAGE(B2:B5)', value: '' },
      C4: { formula: '=MIN(B2:B5)', value: '' },
      C5: { formula: '=MAX(B2:B5)', value: '' },
      C6: { formula: '=COUNT(B2:B5)', value: '' },
      C7: { formula: '=COUNTA(B2:B5)', value: '' },
    } },
    { id: 'resumo', name: 'Resumo Geral', rows: 80, cols: 20, cells: {
      A1: { formula: "='Dados'!C2", value: '' },
      A2: { formula: "=IF('Dados'!B2>=10,\"OK\",\"NOK\")", value: '' },
      A3: { formula: '=ROUND(10/3,2)', value: '' },
      A4: { formula: '=POWER(2,5)', value: '' },
      A5: { formula: '=CONCAT("Total: ",\'Dados\'!C2)', value: '' },
    } },
  ],
});

test('professional formula engine ignores text and blanks for numeric aggregations', () => {
  const source = workbook();
  assert.equal(evaluateWorkbookCell(source, 'dados', 'C2'), 30);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'C3'), 15);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'C4'), 10);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'C5'), 20);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'C6'), 2);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'C7'), 3);
});

test('formula engine supports cross-sheet references, conditionals and nested functions', () => {
  const source = workbook();
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A1'), 30);
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A2'), 'OK');
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A3'), 3.33);
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A4'), 32);
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A5'), 'Total: 30');
});

test('formula engine detects cycles and division by zero', () => {
  const source = workbook();
  source.sheets[0].cells.D1 = { formula: '=D2', value: '' };
  source.sheets[0].cells.D2 = { formula: '=D1', value: '' };
  source.sheets[0].cells.D3 = { formula: '=10/0', value: '' };
  assert.equal(evaluateWorkbookCell(source, 'dados', 'D1'), '#CIRC!');
  assert.equal(evaluateWorkbookCell(source, 'dados', 'D3'), '#DIV/0!');
});

test('recalculation updates stored values while preserving formulas', () => {
  const result = recalculateWorkbookFormulas(workbook());
  assert.ok(result.changed >= 8);
  const dados = result.workbook.sheets[0];
  const resumo = result.workbook.sheets[1];
  assert.equal(dados.cells.C3.value, '15');
  assert.equal(dados.cells.C3.formula, '=AVERAGE(B2:B5)');
  assert.equal(resumo.cells.A5.value, 'Total: 30');
});
