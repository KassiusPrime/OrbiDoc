export type FormulaCell = { value?: string | number; formula?: string; [key: string]: unknown };
export type FormulaSheet = { id: string; name: string; rows: number; cols: number; cells: Record<string, FormulaCell>; [key: string]: unknown };
export type FormulaWorkbook = { sheets: FormulaSheet[]; activeSheetId?: string; [key: string]: unknown };
export type FormulaValue = string | number | boolean;

const CELL_RE = /^([A-Z]+)(\d+)$/i;
const REF_RE = /^(?:(?:'([^']+)'|([A-Za-z0-9_À-ÿ.-]+))!)?([A-Z]+\d+)$/i;
const RANGE_RE = /^(?:(?:'([^']+)'|([A-Za-z0-9_À-ÿ.-]+))!)?([A-Z]+\d+):([A-Z]+\d+)$/i;
const ERROR_RE = /^#(?:CIRC!|REF!|DIV\/0!|FÓRMULA\?|ERRO!)$/;

export const formulaColumnName = (index: number) => {
  let n = Math.max(0, index) + 1;
  let out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
};

export const parseFormulaCell = (key: string) => {
  const match = key.trim().toUpperCase().match(CELL_RE);
  if (!match) return null;
  let column = 0;
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
  const row = Number(match[2]) - 1;
  return row < 0 ? null : { row, column: column - 1 };
};

const cellKey = (row: number, column: number) => `${formulaColumnName(column)}${row + 1}`;
const normalizeName = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
const findSheet = (workbook: FormulaWorkbook, nameOrId: string | undefined, current: FormulaSheet) => {
  if (!nameOrId) return current;
  const needle = normalizeName(nameOrId);
  return workbook.sheets.find((sheet) => sheet.id === nameOrId || normalizeName(sheet.name) === needle) || null;
};
const asNumber = (value: FormulaValue) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const source = String(value).trim();
  if (!source || ERROR_RE.test(source)) return NaN;
  const parsed = Number(source.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};
const asBoolean = (value: FormulaValue) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLocaleLowerCase('pt-BR');
  return Boolean(text && text !== 'false' && text !== 'falso' && text !== '0');
};
const formatNumber = (value: number) => Number.isFinite(value) ? String(Number(value.toFixed(10))) : '#ERRO!';

const splitTopLevel = (source: string, separator = ',') => {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) { if (char === quote && source[i - 1] !== '\\') quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === separator && depth === 0) { out.push(source.slice(start, i).trim()); start = i + 1; }
  }
  out.push(source.slice(start).trim());
  return out;
};

const findTopLevelOperator = (source: string, operators: string[]) => {
  let depth = 0;
  let quote = '';
  for (let i = source.length - 1; i >= 0; i -= 1) {
    const char = source[i];
    if (quote) { if (char === quote && source[i - 1] !== '\\') quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === ')') depth += 1;
    else if (char === '(') depth -= 1;
    if (depth !== 0) continue;
    for (const op of operators) {
      const start = i - op.length + 1;
      if (start < 0 || source.slice(start, i + 1) !== op) continue;
      if ((op === '+' || op === '-') && start === 0) continue;
      if ((op === '+' || op === '-') && /[+\-*/^(<>=]/.test(source[start - 1] || '')) continue;
      return { index: start, op };
    }
  }
  return null;
};

const stripOuterParens = (source: string) => {
  let value = source.trim();
  while (value.startsWith('(') && value.endsWith(')')) {
    let depth = 0; let quote = ''; let wraps = true;
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i];
      if (quote) { if (char === quote && value[i - 1] !== '\\') quote = ''; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      if (depth === 0 && i < value.length - 1) { wraps = false; break; }
    }
    if (!wraps) break;
    value = value.slice(1, -1).trim();
  }
  return value;
};

type EvalContext = { workbook: FormulaWorkbook; sheet: FormulaSheet; stack: Set<string> };

const resolveReference = (token: string, context: EvalContext): FormulaValue => {
  const match = token.trim().match(REF_RE);
  if (!match) return '#REF!';
  const targetSheet = findSheet(context.workbook, match[1] || match[2], context.sheet);
  if (!targetSheet) return '#REF!';
  const key = match[3].toUpperCase();
  const stackKey = `${targetSheet.id}!${key}`;
  if (context.stack.has(stackKey)) return '#CIRC!';
  const cell = targetSheet.cells[key];
  if (!cell) return '';
  if (!cell.formula) return cell.value ?? '';
  const nextStack = new Set(context.stack); nextStack.add(stackKey);
  return evaluateFormulaValue(cell.formula, { workbook: context.workbook, sheet: targetSheet, stack: nextStack });
};

const resolveRange = (token: string, context: EvalContext): FormulaValue[] | null => {
  const match = token.trim().match(RANGE_RE);
  if (!match) return null;
  const targetSheet = findSheet(context.workbook, match[1] || match[2], context.sheet);
  if (!targetSheet) return ['#REF!'];
  const start = parseFormulaCell(match[3]); const end = parseFormulaCell(match[4]);
  if (!start || !end) return ['#REF!'];
  const values: FormulaValue[] = [];
  for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
    for (let column = Math.min(start.column, end.column); column <= Math.max(start.column, end.column); column += 1) {
      const ref = `${targetSheet.name === context.sheet.name ? '' : `'${targetSheet.name}'!`}${cellKey(row, column)}`;
      values.push(resolveReference(ref, context));
    }
  }
  return values;
};

const compareValues = (left: FormulaValue, right: FormulaValue, op: string) => {
  const leftNumber = asNumber(left); const rightNumber = asNumber(right);
  const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  const a: any = numeric ? leftNumber : String(left).toLocaleLowerCase('pt-BR');
  const b: any = numeric ? rightNumber : String(right).toLocaleLowerCase('pt-BR');
  if (op === '=' || op === '==') return a === b;
  if (op === '<>' || op === '!=') return a !== b;
  if (op === '>') return a > b;
  if (op === '<') return a < b;
  if (op === '>=') return a >= b;
  return a <= b;
};

const flattenArguments = (args: string[], context: EvalContext) => args.flatMap((arg) => resolveRange(arg, context) ?? [evaluateExpression(arg, context)]);

const evaluateFunction = (name: string, argsSource: string, context: EvalContext): FormulaValue => {
  const nameUpper = name.toLocaleUpperCase('pt-BR');
  const args = splitTopLevel(argsSource);
  const flat = () => flattenArguments(args, context);
  const numericValues = () => flat().map(asNumber).filter(Number.isFinite);
  if (['SUM', 'SOMA'].includes(nameUpper)) return numericValues().reduce((sum, value) => sum + value, 0);
  if (['AVERAGE', 'AVG', 'MEDIA', 'MÉDIA'].includes(nameUpper)) { const values = numericValues(); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
  if (nameUpper === 'MIN') { const values = numericValues(); return values.length ? Math.min(...values) : 0; }
  if (nameUpper === 'MAX') { const values = numericValues(); return values.length ? Math.max(...values) : 0; }
  if (['COUNT', 'CONTAR'].includes(nameUpper)) return numericValues().length;
  if (nameUpper === 'COUNTA') return flat().filter((value) => String(value).trim() !== '').length;
  if (['IF', 'SE'].includes(nameUpper)) return asBoolean(evaluateExpression(args[0] || '', context)) ? evaluateExpression(args[1] || '', context) : evaluateExpression(args[2] || '', context);
  if (['AND', 'E'].includes(nameUpper)) return args.every((arg) => asBoolean(evaluateExpression(arg, context)));
  if (['OR', 'OU'].includes(nameUpper)) return args.some((arg) => asBoolean(evaluateExpression(arg, context)));
  if (['NOT', 'NAO', 'NÃO'].includes(nameUpper)) return !asBoolean(evaluateExpression(args[0] || '', context));
  if (['ROUND', 'ARRED'].includes(nameUpper)) { const value = asNumber(evaluateExpression(args[0] || '0', context)); const digits = Math.max(0, Math.min(10, Math.trunc(asNumber(evaluateExpression(args[1] || '0', context)) || 0))); return Number.isFinite(value) ? Number(value.toFixed(digits)) : '#ERRO!'; }
  if (nameUpper === 'ABS') { const value = asNumber(evaluateExpression(args[0] || '0', context)); return Number.isFinite(value) ? Math.abs(value) : '#ERRO!'; }
  if (['SQRT', 'RAIZ'].includes(nameUpper)) { const value = asNumber(evaluateExpression(args[0] || '0', context)); return Number.isFinite(value) && value >= 0 ? Math.sqrt(value) : '#ERRO!'; }
  if (['POWER', 'POTENCIA', 'POTÊNCIA'].includes(nameUpper)) { const base = asNumber(evaluateExpression(args[0] || '0', context)); const power = asNumber(evaluateExpression(args[1] || '0', context)); const value = Math.pow(base, power); return Number.isFinite(value) ? value : '#ERRO!'; }
  if (['CONCAT', 'CONCATENAR'].includes(nameUpper)) return flat().map(String).join('');
  if (['LEN', 'NÚM.CARACT', 'NUM.CARACT'].includes(nameUpper)) return String(evaluateExpression(args[0] || '', context)).length;
  if (['UPPER', 'MAIÚSCULA', 'MAIUSCULA'].includes(nameUpper)) return String(evaluateExpression(args[0] || '', context)).toLocaleUpperCase('pt-BR');
  if (['LOWER', 'MINÚSCULA', 'MINUSCULA'].includes(nameUpper)) return String(evaluateExpression(args[0] || '', context)).toLocaleLowerCase('pt-BR');
  if (['TRIM', 'ARRUMAR'].includes(nameUpper)) return String(evaluateExpression(args[0] || '', context)).replace(/\s+/g, ' ').trim();
  return '#FÓRMULA?';
};

const evaluateExpression = (input: string, context: EvalContext): FormulaValue => {
  let source = stripOuterParens(input.trim());
  if (!source) return '';
  if ((source.startsWith('"') && source.endsWith('"')) || (source.startsWith("'") && source.endsWith("'") && !source.includes('!'))) return source.slice(1, -1);
  if (/^(TRUE|VERDADEIRO)$/i.test(source)) return true;
  if (/^(FALSE|FALSO)$/i.test(source)) return false;
  if (REF_RE.test(source)) return resolveReference(source, context);
  const number = Number(source.replace(',', '.')); if (Number.isFinite(number)) return number;
  const fn = source.match(/^([A-Za-zÀ-ÿ.]+)\((.*)\)$/s); if (fn) return evaluateFunction(fn[1], fn[2], context);

  const comparison = findTopLevelOperator(source, ['>=', '<=', '<>', '!=', '==', '=', '>', '<']);
  if (comparison) return compareValues(evaluateExpression(source.slice(0, comparison.index), context), evaluateExpression(source.slice(comparison.index + comparison.op.length), context), comparison.op);
  const add = findTopLevelOperator(source, ['+', '-']);
  if (add) { const a = asNumber(evaluateExpression(source.slice(0, add.index), context)); const b = asNumber(evaluateExpression(source.slice(add.index + 1), context)); if (!Number.isFinite(a) || !Number.isFinite(b)) return '#ERRO!'; return add.op === '+' ? a + b : a - b; }
  const mul = findTopLevelOperator(source, ['*', '/']);
  if (mul) { const a = asNumber(evaluateExpression(source.slice(0, mul.index), context)); const b = asNumber(evaluateExpression(source.slice(mul.index + 1), context)); if (!Number.isFinite(a) || !Number.isFinite(b)) return '#ERRO!'; if (mul.op === '/' && b === 0) return '#DIV/0!'; return mul.op === '*' ? a * b : a / b; }
  const pow = findTopLevelOperator(source, ['^']);
  if (pow) { const a = asNumber(evaluateExpression(source.slice(0, pow.index), context)); const b = asNumber(evaluateExpression(source.slice(pow.index + 1), context)); const value = Math.pow(a, b); return Number.isFinite(value) ? value : '#ERRO!'; }
  if (source.startsWith('-')) { const value = asNumber(evaluateExpression(source.slice(1), context)); return Number.isFinite(value) ? -value : '#ERRO!'; }
  return source;
};

export function evaluateFormulaValue(formula: string, context: EvalContext): FormulaValue {
  const source = formula.startsWith('=') ? formula.slice(1) : formula;
  return evaluateExpression(source, context);
}

export function evaluateWorkbookCell(workbook: FormulaWorkbook, sheetIdOrName: string, key: string): FormulaValue {
  const sheet = workbook.sheets.find((item) => item.id === sheetIdOrName || normalizeName(item.name) === normalizeName(sheetIdOrName));
  if (!sheet) return '#REF!';
  const upper = key.toUpperCase();
  const cell = sheet.cells[upper];
  if (!cell) return '';
  if (!cell.formula) return cell.value ?? '';
  return evaluateFormulaValue(cell.formula, { workbook, sheet, stack: new Set([`${sheet.id}!${upper}`]) });
}

export function recalculateWorkbookFormulas<T extends FormulaWorkbook>(workbook: T) {
  let changed = 0;
  const next = { ...workbook, sheets: workbook.sheets.map((sheet) => ({ ...sheet, cells: Object.fromEntries(Object.entries(sheet.cells).map(([key, cell]) => [key, { ...cell }])) })) } as T;
  for (const sheet of next.sheets) {
    for (const [key, cell] of Object.entries(sheet.cells)) {
      if (!cell.formula) continue;
      const value = evaluateWorkbookCell(next, sheet.id, key);
      const normalized = typeof value === 'number' ? formatNumber(value) : typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
      if (String(cell.value ?? '') !== normalized) changed += 1;
      cell.value = normalized;
    }
  }
  return { workbook: next, changed };
}
