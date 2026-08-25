import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWorkbookCell, recalculateWorkbookFormulas, type FormulaWorkbook } from '../src/lib/spreadsheetFormulaEngine';

const workbook = (): FormulaWorkbook => ({
  activeSheetId: 'dados',
  sheets: [
    { id: 'dados', name: 'Dados', rows: 80, cols: 20, cells: {
      A1: { value: 'Item' }, B1: { value: 'Valor' }, D1: { value: 'Grupo' },
      A2: { value: 'A' }, B2: { value: '10' }, D2: { value: 'Norte' },
      A3: { value: 'B' }, B3: { value: '20' }, D3: { value: 'Sul' },
      A4: { value: 'C' }, B4: { value: 'texto' }, D4: { value: 'Norte' },
      A5: { value: 'D' }, B5: { value: '' }, D5: { value: 'Sul' },
      C2: { formula: '=SUM(B2:B5)', value: '' },
      C3: { formula: '=AVERAGE(B2:B5)', value: '' },
      C4: { formula: '=MIN(B2:B5)', value: '' },
      C5: { formula: '=MAX(B2:B5)', value: '' },
      C6: { formula: '=COUNT(B2:B5)', value: '' },
      C7: { formula: '=COUNTA(B2:B5)', value: '' },
      E2: { formula: '=COUNTIF(D2:D5,"Norte")', value: '' },
      E3: { formula: '=SUMIF(D2:D5,"Norte",B2:B5)', value: '' },
      E4: { formula: '=COUNTIF(B2:B5,">=15")', value: '' },
      E5: { formula: '=COUNTIF(A2:A5,"?")', value: '' },
    } },
    { id: 'resumo', name: 'Resumo Geral', rows: 80, cols: 20, cells: {
      A1: { formula: "='Dados'!C2", value: '' },
      A2: { formula: "=IF('Dados'!B2>=10,\"OK\",\"NOK\")", value: '' },
      A3: { formula: '=ROUND(10/3,2)', value: '' },
      A4: { formula: '=POWER(2,5)', value: '' },
      A5: { formula: '=CONCAT("Total: ",\'Dados\'!C2)', value: '' },
      A6: { formula: '=XLOOKUP("B",\'Dados\'!A2:A5,\'Dados\'!B2:B5,"Não encontrado")', value: '' },
      A7: { formula: '=PROCX("X",\'Dados\'!A2:A5,\'Dados\'!B2:B5,"Não encontrado")', value: '' },
      A8: { formula: '=IFERROR(10/0,"Falha tratada")', value: '' },
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

test('formula engine supports COUNTIF and SUMIF criteria including wildcards', () => {
  const source = workbook();
  assert.equal(evaluateWorkbookCell(source, 'dados', 'E2'), 2);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'E3'), 10);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'E4'), 1);
  assert.equal(evaluateWorkbookCell(source, 'dados', 'E5'), 4);
});

test('formula engine supports cross-sheet references, conditionals and nested functions', () => {
  const source = workbook();
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A1'), 30);
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A2'), 'OK');
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A3'), 3.33);
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A4'), 32);
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A5'), 'Total: 30');
});

test('formula engine supports XLOOKUP/PROCX and IFERROR/SEERRO', () => {
  const source = workbook();
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A6'), '20');
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A7'), 'Não encontrado');
  assert.equal(evaluateWorkbookCell(source, 'Resumo Geral', 'A8'), 'Falha tratada');
});

test('formula engine detects cycles and division by zero', () => {
  const source = workbook();
  source.sheets[0].cells.F1 = { formula: '=F2', value: '' };
  source.sheets[0].cells.F2 = { formula: '=F1', value: '' };
  source.sheets[0].cells.F3 = { formula: '=10/0', value: '' };
  assert.equal(evaluateWorkbookCell(source, 'dados', 'F1'), '#CIRC!');
  assert.equal(evaluateWorkbookCell(source, 'dados', 'F3'), '#DIV/0!');
});

test('recalculation updates stored values while preserving formulas', () => {
  const result = recalculateWorkbookFormulas(workbook());
  assert.ok(result.changed >= 12);
  const dados = result.workbook.sheets[0];
  const resumo = result.workbook.sheets[1];
  assert.equal(dados.cells.C3.value, '15');
  assert.equal(dados.cells.C3.formula, '=AVERAGE(B2:B5)');
  assert.equal(dados.cells.E3.value, '10');
  assert.equal(resumo.cells.A6.value, '20');
  assert.equal(resumo.cells.A8.value, 'Falha tratada');
});