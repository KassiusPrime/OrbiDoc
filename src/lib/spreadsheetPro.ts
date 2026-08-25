export type ProCell = { value?: string | number; formula?: string; bgColor?: string; textColor?: string; [key: string]: unknown };
export type ProSheet = { id: string; name: string; rows: number; cols: number; cells: Record<string, ProCell>; columnWidths?: Record<number, number>; [key: string]: unknown };
export type Bounds = { startRow: number; endRow: number; startColumn: number; endColumn: number };
export type ValidationRule = { kind: 'number'; min?: number; max?: number } | { kind: 'date' } | { kind: 'list'; values: string[] } | { kind: 'nonempty' };
export type ConditionalRule = { kind: 'greater'; value: number } | { kind: 'less'; value: number } | { kind: 'equal'; value: string } | { kind: 'contains'; value: string } | { kind: 'nonempty' };

export const columnName = (index: number) => { let n = index + 1, out = ''; while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); } return out; };
export const parseA1 = (key: string) => { const m = key.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/); if (!m) return null; let column = 0; for (const char of m[1]) column = column * 26 + char.charCodeAt(0) - 64; const row = Number(m[2]) - 1; return row < 0 ? null : { row, column: column - 1 }; };
export const parseRange = (range: string): Bounds | null => { const [a, b = a] = range.trim().toUpperCase().split(':'); const start = parseA1(a || ''); const end = parseA1(b || ''); if (!start || !end) return null; return { startRow: Math.min(start.row, end.row), endRow: Math.max(start.row, end.row), startColumn: Math.min(start.column, end.column), endColumn: Math.max(start.column, end.column) }; };
export const cellKey = (row: number, column: number) => `${columnName(column)}${row + 1}`;
const keys = (b: Bounds) => { const out: string[] = []; for (let r = b.startRow; r <= b.endRow; r += 1) for (let c = b.startColumn; c <= b.endColumn; c += 1) out.push(cellKey(r, c)); return out; };
const clone = (sheet: ProSheet): ProSheet => ({ ...sheet, cells: Object.fromEntries(Object.entries(sheet.cells || {}).map(([key, cell]) => [key, { ...cell }])) });
const text = (cell?: ProCell) => String(cell?.value ?? '').trim();

export function replaceInRange(sheet: ProSheet, range: string, search: string, replacement: string, matchCase = false) {
  const bounds = parseRange(range); if (!bounds || !search) return { sheet, replacements: 0 };
  const next = clone(sheet); let replacements = 0;
  for (const key of keys(bounds)) { const cell = next.cells[key]; if (!cell || cell.formula) continue; const raw = String(cell.value ?? ''); const flags = matchCase ? 'g' : 'gi'; const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const matches = raw.match(new RegExp(escaped, flags)); if (matches?.length) { replacements += matches.length; cell.value = raw.replace(new RegExp(escaped, flags), replacement); } }
  return { sheet: next, replacements };
}

export function trimRange(sheet: ProSheet, range: string) {
  const bounds = parseRange(range); if (!bounds) return { sheet, changed: 0 }; const next = clone(sheet); let changed = 0;
  for (const key of keys(bounds)) { const cell = next.cells[key]; if (!cell || cell.formula || typeof cell.value !== 'string') continue; const normalized = cell.value.replace(/\s+/g, ' ').trim(); if (normalized !== cell.value) { cell.value = normalized; changed += 1; } }
  return { sheet: next, changed };
}

export function validateRange(sheet: ProSheet, range: string, rule: ValidationRule) {
  const bounds = parseRange(range); if (!bounds) return [] as string[]; const invalid: string[] = [];
  for (const key of keys(bounds)) { const value = text(sheet.cells[key]); let ok = true; if (rule.kind === 'nonempty') ok = value.length > 0; else if (rule.kind === 'number') { const n = Number(value.replace(',', '.')); ok = value.length > 0 && Number.isFinite(n) && (rule.min === undefined || n >= rule.min) && (rule.max === undefined || n <= rule.max); } else if (rule.kind === 'date') ok = value.length > 0 && !Number.isNaN(new Date(value).getTime()); else ok = rule.values.some((item) => item.trim().toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')); if (!ok) invalid.push(key); }
  return invalid;
}

export function markInvalid(sheet: ProSheet, invalidKeys: string[]) {
  const next = clone(sheet); const invalid = new Set(invalidKeys);
  for (const [key, cell] of Object.entries(next.cells)) { if (cell.validationError) { delete cell.validationError; if (cell.bgColor === '#FEE2E2') delete cell.bgColor; if (cell.textColor === '#B91C1C') delete cell.textColor; } if (invalid.has(key)) { cell.bgColor = '#FEE2E2'; cell.textColor = '#B91C1C'; cell.validationError = true; } }
  for (const key of invalid) if (!next.cells[key]) next.cells[key] = { value: '', bgColor: '#FEE2E2', textColor: '#B91C1C', validationError: true };
  return next;
}

export function conditionalFormat(sheet: ProSheet, range: string, rule: ConditionalRule) {
  const bounds = parseRange(range); if (!bounds) return { sheet, matched: 0 }; const next = clone(sheet); let matched = 0;
  for (const key of keys(bounds)) { const cell = next.cells[key] || { value: '' }; const raw = text(cell); const n = Number(raw.replace(',', '.')); const target = 'value' in rule ? String(rule.value) : ''; const ok = rule.kind === 'greater' ? Number.isFinite(n) && n > rule.value : rule.kind === 'less' ? Number.isFinite(n) && n < rule.value : rule.kind === 'equal' ? raw.toLocaleLowerCase('pt-BR') === target.toLocaleLowerCase('pt-BR') : rule.kind === 'contains' ? raw.toLocaleLowerCase('pt-BR').includes(target.toLocaleLowerCase('pt-BR')) : raw.length > 0; if (ok) { next.cells[key] = { ...cell, bgColor: '#DCFCE7', textColor: '#166534' }; matched += 1; } }
  return { sheet: next, matched };
}
