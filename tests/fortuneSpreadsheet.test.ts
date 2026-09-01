import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePtBrFormula } from '../src/lib/fortuneSpreadsheet';

test('normaliza funções de planilha em português para o motor FortuneSheet', () => {
  assert.equal(normalizePtBrFormula('=SOMA(A1:A10)'), '=SUM(A1:A10)');
  assert.equal(normalizePtBrFormula('=MÉDIA(B2:B8)'), '=AVERAGE(B2:B8)');
  assert.equal(normalizePtBrFormula('=SE(A1>0,PROCV(A1,B1:C10,2,0),0)'), '=IF(A1>0,VLOOKUP(A1,B1:C10,2,0),0)');
  assert.equal(normalizePtBrFormula('=CONT.SE(A1:A5,">0")'), '=COUNTIF(A1:A5,">0")');
});

test('preserva referências absolutas e fórmulas em inglês', () => {
  assert.equal(normalizePtBrFormula('=SOMA($A$1:B$5)'), '=SUM($A$1:B$5)');
  assert.equal(normalizePtBrFormula('=SUM($A$1:B$5)'), '=SUM($A$1:B$5)');
});

test('não altera texto que não é fórmula', () => {
  assert.equal(normalizePtBrFormula('SOMA(A1:A3)'), 'SOMA(A1:A3)');
  assert.equal(normalizePtBrFormula('Relatório mensal'), 'Relatório mensal');
});
