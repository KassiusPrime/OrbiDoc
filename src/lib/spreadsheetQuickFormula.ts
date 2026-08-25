import { cellKey, parseA1, parseRange, type ProSheet } from './spreadsheetPro';

export type QuickFormula = 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT';

export function insertQuickFormula(sheet: ProSheet, range: string, target: string, operation: QuickFormula) {
  const bounds = parseRange(range);
  const destination = parseA1(target);
  if (!bounds || !destination) return null;
  const values: number[] = [];
  for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
    for (let column = bounds.startColumn; column <= bounds.endColumn; column += 1) {
      const raw = String(sheet.cells[cellKey(row, column)]?.value ?? '').trim().replace(',', '.');
      if (!raw) continue;
      const number = Number(raw);
      if (Number.isFinite(number)) values.push(number);
    }
  }
  const result = operation === 'COUNT' ? values.length
    : operation === 'SUM' ? values.reduce((sum, value) => sum + value, 0)
      : operation === 'MIN' ? (values.length ? Math.min(...values) : 0)
        : operation === 'MAX' ? (values.length ? Math.max(...values) : 0)
          : (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  const next: ProSheet = { ...sheet, cells: { ...sheet.cells } };
  const key = cellKey(destination.row, destination.column);
  next.cells[key] = { ...(sheet.cells[key] || {}), value: String(Number(result.toFixed(8))), formula: `=${operation}(${range.toUpperCase()})` };
  next.rows = Math.max(next.rows, destination.row + 6);
  next.cols = Math.max(next.cols, destination.column + 4);
  return { sheet: next, value: result, formula: next.cells[key].formula as string, target: key };
}
