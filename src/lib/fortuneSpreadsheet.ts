import * as XLSX from 'xlsx';

export type FortuneCell = {
  v?: string | number | boolean;
  m?: string | number;
  f?: string;
  ct?: { fa?: string; t?: string; s?: unknown };
  bg?: string;
  bl?: number;
  it?: number;
  un?: number;
  fs?: number;
  fc?: string;
  ht?: number;
  vt?: number;
  tb?: string;
  [key: string]: unknown;
};

export type FortuneSheet = {
  id?: string;
  name: string;
  order?: number;
  row?: number;
  column?: number;
  celldata?: Array<{ r: number; c: number; v: FortuneCell | null }>;
  data?: Array<Array<FortuneCell | null>>;
  config?: Record<string, unknown>;
  frozen?: unknown;
  [key: string]: unknown;
};

const PT_FORMULA_ALIASES: Array<[RegExp, string]> = [
  [/\bSOMA(?=\s*\()/giu, 'SUM'],
  [/\bM[ÉE]DIA(?=\s*\()/giu, 'AVERAGE'],
  [/\bMEDIA(?=\s*\()/giu, 'AVERAGE'],
  [/\bSE(?=\s*\()/giu, 'IF'],
  [/\bPROCV(?=\s*\()/giu, 'VLOOKUP'],
  [/\bPROCH(?=\s*\()/giu, 'HLOOKUP'],
  [/\bCONT\.SE(?=\s*\()/giu, 'COUNTIF'],
  [/\bCONTSE(?=\s*\()/giu, 'COUNTIF'],
  [/\bCONT\.SES(?=\s*\()/giu, 'COUNTIFS'],
  [/\bCONTSES(?=\s*\()/giu, 'COUNTIFS'],
  [/\bSOMASE(?=\s*\()/giu, 'SUMIF'],
  [/\bSOMA\.SE(?=\s*\()/giu, 'SUMIF'],
  [/\bSOMASES(?=\s*\()/giu, 'SUMIFS'],
  [/\bSOMA\.SES(?=\s*\()/giu, 'SUMIFS'],
  [/\bM[ÁA]XIMO(?=\s*\()/giu, 'MAX'],
  [/\bM[ÍI]NIMO(?=\s*\()/giu, 'MIN'],
  [/\bHOJE(?=\s*\()/giu, 'TODAY'],
  [/\bAGORA(?=\s*\()/giu, 'NOW'],
  [/\bE(?=\s*\()/giu, 'AND'],
  [/\bOU(?=\s*\()/giu, 'OR'],
  [/\bN[ÃA]O(?=\s*\()/giu, 'NOT'],
];

export function normalizePtBrFormula(formula: string) {
  if (!formula || !formula.startsWith('=')) return formula;
  return PT_FORMULA_ALIASES.reduce((source, [pattern, replacement]) => source.replace(pattern, replacement), formula);
}

export function normalizeFortuneSheetFormulas(sheets: FortuneSheet[]) {
  return sheets.map((sheet) => ({
    ...sheet,
    celldata: sheet.celldata?.map((entry) => entry.v?.f
      ? { ...entry, v: { ...entry.v, f: normalizePtBrFormula(entry.v.f) } }
      : entry),
    data: sheet.data?.map((row) => row.map((cell) => cell?.f ? { ...cell, f: normalizePtBrFormula(cell.f) } : cell)),
  }));
}

function toFortuneValue(cell: XLSX.CellObject): FortuneCell {
  const formula = typeof cell.f === 'string' ? normalizePtBrFormula(`=${cell.f.replace(/^=/, '')}`) : undefined;
  const value = cell.v as string | number | boolean | undefined;
  const result: FortuneCell = {
    v: value,
    m: cell.w ?? value,
  };
  if (formula) result.f = formula;
  if (cell.z) result.ct = { fa: String(cell.z), t: typeof value === 'number' ? 'n' : 'g' };
  return result;
}

export function xlsxArrayBufferToFortuneSheets(buffer: ArrayBuffer): FortuneSheet[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellFormula: true, cellNF: true });
  return workbook.SheetNames.map((name, order) => {
    const source = workbook.Sheets[name];
    const ref = source['!ref'] || 'A1';
    const range = XLSX.utils.decode_range(ref);
    const celldata: Array<{ r: number; c: number; v: FortuneCell }> = [];
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const address = XLSX.utils.encode_cell({ r, c });
        const cell = source[address];
        if (!cell) continue;
        const fortune = toFortuneValue(cell);
        if (cell.t === 'd' && cell.v instanceof Date) {
          fortune.v = cell.v.toISOString();
          fortune.m = cell.v.toLocaleDateString('pt-BR');
          fortune.ct = { fa: 'dd/mm/yyyy', t: 'd' };
        }
        celldata.push({ r, c, v: fortune });
      }
    }
    return {
      id: crypto.randomUUID(),
      name,
      order,
      row: Math.max(84, range.e.r + 1),
      column: Math.max(26, range.e.c + 1),
      celldata,
      config: {
        columnlen: Object.fromEntries((source['!cols'] || []).map((column, index) => [index, Math.max(40, Math.round((column?.wch || 10) * 8))])),
        rowlen: Object.fromEntries((source['!rows'] || []).map((row, index) => [index, Math.max(18, Math.round(row?.hpx || 20))])),
      },
    };
  });
}

function currentCellMatrix(sheet: FortuneSheet): Array<Array<FortuneCell | null>> {
  if (Array.isArray(sheet.data) && sheet.data.length) return sheet.data;
  const rows = Math.max(1, Number(sheet.row || 84));
  const columns = Math.max(1, Number(sheet.column || 26));
  const matrix = Array.from({ length: rows }, () => Array<FortuneCell | null>(columns).fill(null));
  for (const entry of sheet.celldata || []) {
    if (entry.r >= 0 && entry.c >= 0) {
      while (matrix.length <= entry.r) matrix.push(Array<FortuneCell | null>(columns).fill(null));
      while (matrix[entry.r].length <= entry.c) matrix[entry.r].push(null);
      matrix[entry.r][entry.c] = entry.v;
    }
  }
  return matrix;
}

function fortuneSheetToXlsxSheet(sheet: FortuneSheet) {
  const source = currentCellMatrix(sheet);
  const target: XLSX.WorkSheet = {};
  let maxRow = 0;
  let maxCol = 0;
  source.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell || (cell.v == null && !cell.f)) return;
      maxRow = Math.max(maxRow, r);
      maxCol = Math.max(maxCol, c);
      const address = XLSX.utils.encode_cell({ r, c });
      const formula = typeof cell.f === 'string' ? normalizePtBrFormula(cell.f).replace(/^=/, '') : undefined;
      const value = cell.v;
      const xlsxCell: XLSX.CellObject = {
        t: typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's',
        v: value == null ? '' : value,
      };
      if (formula) xlsxCell.f = formula;
      if (cell.ct?.fa) xlsxCell.z = cell.ct.fa;
      target[address] = xlsxCell;
    });
  });
  target['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
  const config = (sheet.config || {}) as { columnlen?: Record<string, number>; rowlen?: Record<string, number> };
  if (config.columnlen) {
    target['!cols'] = Array.from({ length: maxCol + 1 }, (_, c) => ({ wpx: config.columnlen?.[String(c)] || 73 }));
  }
  if (config.rowlen) {
    target['!rows'] = Array.from({ length: maxRow + 1 }, (_, r) => ({ hpx: config.rowlen?.[String(r)] || 20 }));
  }
  return target;
}

export function fortuneSheetsToXlsxBlob(sheets: FortuneSheet[]) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  sheets.forEach((sheet, index) => {
    let name = (sheet.name || `Planilha${index + 1}`).replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || `Planilha${index + 1}`;
    let suffix = 2;
    const base = name.slice(0, 28);
    while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}`.slice(0, 31);
    usedNames.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(workbook, fortuneSheetToXlsxSheet(sheet), name);
  });
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellStyles: true });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function fortuneSheetToCsvBlob(sheet: FortuneSheet) {
  const csv = XLSX.utils.sheet_to_csv(fortuneSheetToXlsxSheet(sheet), { FS: ',', RS: '\n' });
  return new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
}

export function migrateLegacyWorkbook(content: unknown): FortuneSheet[] {
  if (Array.isArray(content)) return normalizeFortuneSheetFormulas(content as FortuneSheet[]);
  const value = content as any;
  if (!value?.sheets?.length) {
    return [{ id: crypto.randomUUID(), name: 'Planilha1', order: 0, row: 84, column: 26, celldata: [] }];
  }

  if (Array.isArray(value.sheets[0]?.celldata) || Array.isArray(value.sheets[0]?.data)) {
    return normalizeFortuneSheetFormulas(value.sheets as FortuneSheet[]);
  }

  return value.sheets.map((sheet: any, order: number) => {
    const celldata: Array<{ r: number; c: number; v: FortuneCell }> = [];
    for (const [address, legacy] of Object.entries(sheet.cells || {}) as Array<[string, any]>) {
      const match = address.match(/^([A-Z]+)(\d+)$/i);
      if (!match) continue;
      let c = 0;
      for (const char of match[1].toUpperCase()) c = c * 26 + char.charCodeAt(0) - 64;
      const r = Number(match[2]) - 1;
      const cell: FortuneCell = {
        v: legacy.value ?? '',
        f: legacy.formula ? normalizePtBrFormula(legacy.formula) : undefined,
        bl: legacy.bold ? 1 : undefined,
        it: legacy.italic ? 1 : undefined,
        un: legacy.underline ? 1 : undefined,
        bg: legacy.bgColor,
        fc: legacy.textColor,
        ff: legacy.fontFamily,
        ht: legacy.align === 'center' ? 0 : legacy.align === 'right' ? 2 : 1,
      };
      celldata.push({ r, c: c - 1, v: cell });
    }
    return {
      id: sheet.id || crypto.randomUUID(),
      name: sheet.name || `Planilha${order + 1}`,
      order,
      row: Math.max(84, sheet.rows || 0),
      column: Math.max(26, sheet.cols || 0),
      celldata,
      config: { columnlen: sheet.columnWidths || {} },
    };
  });
}
