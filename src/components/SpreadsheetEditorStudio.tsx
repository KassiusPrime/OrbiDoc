import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconBold as Bold,
  IconChartBar as ChartBar,
  IconChevronDown as SortDown,
  IconChevronUp as SortUp,
  IconDownload as Download,
  IconFileSpreadsheet as FileSpreadsheet,
  IconItalic as Italic,
  IconPlus as Plus,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { sendToVercel } from '../api/chat';
import { ExcelCell, HistoryItem, SavedProject } from '../types';
import { OFFICE_FONTS } from '../lib/officeStudio';
import { OrbitResizeGrip, OrbitResizablePane, useMediaQuery } from './orbit/OrbitResizable';

interface SpreadsheetEditorStudioProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type CellFormat = 'general' | 'currency' | 'percent' | 'date';
type StudioCell = ExcelCell & { underline?: boolean; format?: CellFormat; decimals?: number };
type SheetState = { id: string; name: string; rows: number; cols: number; cells: Record<string, StudioCell>; columnWidths?: Record<number, number>; rowHeights?: Record<number, number> };
type WorkbookState = { version: 4; sheets: SheetState[]; activeSheetId: string };

const DEFAULT_ROWS = 80;
const DEFAULT_COLS = 20;
const colName = (index: number) => {
  let value = Math.max(0, index) + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};
const DEFAULT_COL_WIDTH = 112;
const DEFAULT_ROW_HEIGHT = 26;
const MIN_COL_WIDTH = 44;
const MIN_ROW_HEIGHT = 20;
const createSheet = (name = 'Planilha1'): SheetState => ({ id: crypto.randomUUID(), name, rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {}, columnWidths: {}, rowHeights: {} });
const defaultWorkbook = (): WorkbookState => { const sheet = createSheet(); return { version: 4, sheets: [sheet], activeSheetId: sheet.id }; };
const numeric = (value: string | number | undefined) => { const parsed = Number(String(value ?? '').trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; };
const sanitizeSheetName = (value: string, fallback: string) => value.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || fallback;
const sanitizeFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Planilha';

const parseCell = (key: string) => {
  const match = key.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let column = 0;
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
  return { column: column - 1, row: Number(match[2]) - 1 };
};

const cellRange = (start: string, end: string) => {
  const a = parseCell(start);
  const b = parseCell(end);
  if (!a || !b) return [];
  const keys: string[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row += 1) {
    for (let col = Math.min(a.column, b.column); col <= Math.max(a.column, b.column); col += 1) keys.push(`${colName(col)}${row + 1}`);
  }
  return keys;
};

const evaluateCell = (key: string, cells: Record<string, StudioCell>, stack = new Set<string>()): string => {
  const upper = key.toUpperCase();
  const cell = cells[upper];
  if (!cell) return '';
  if (!cell.formula) return String(cell.value ?? '');
  if (stack.has(upper)) return '#CIRC!';
  const next = new Set(stack);
  next.add(upper);
  return evaluateFormula(cell.formula, cells, next);
};

const replaceReferences = (source: string, cells: Record<string, StudioCell>, stack: Set<string>) => source.replace(/\b([A-Z]+\d+)\b/g, (key) => String(numeric(evaluateCell(key, cells, stack))));

const evaluateFormula = (formula: string, cells: Record<string, StudioCell>, stack = new Set<string>()): string => {
  if (!formula.startsWith('=')) return formula;
  const source = formula.slice(1).trim().toUpperCase();
  const fn = source.match(/^(SUM|SOMA|AVERAGE|AVG|MÉDIA|MEDIA|MIN|MAX|COUNT|CONTAR|COUNTA)\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (fn) {
    const raw = cellRange(fn[2], fn[3]).map((key) => evaluateCell(key, cells, stack));
    const nums = raw.map(numeric);
    const op = fn[1];
    if (op === 'COUNTA') return String(raw.filter((value) => String(value).trim()).length);
    if (op === 'COUNT' || op === 'CONTAR') return String(raw.filter((value) => String(value).trim() !== '' && Number.isFinite(Number(String(value).replace(',', '.')))).length);
    if (!nums.length) return '0';
    const result = op === 'SUM' || op === 'SOMA' ? nums.reduce((sum, value) => sum + value, 0)
      : op === 'MIN' ? Math.min(...nums)
        : op === 'MAX' ? Math.max(...nums)
          : nums.reduce((sum, value) => sum + value, 0) / nums.length;
    return String(Number(result.toFixed(8)));
  }

  const round = source.match(/^ROUND\((.+),(\d+)\)$/);
  if (round) {
    try {
      const expression = replaceReferences(round[1], cells, stack);
      if (!/^[\d+\-*/().\s]+$/.test(expression)) return '#FÓRMULA?';
      const value = Function(`"use strict"; return (${expression})`)();
      return String(Number(Number(value).toFixed(Math.min(10, Number(round[2])))));
    } catch { return '#ERRO!'; }
  }

  const conditional = source.match(/^IF\((.+),([^,]+),([^,]+)\)$/);
  if (conditional) {
    try {
      const condition = replaceReferences(conditional[1], cells, stack);
      if (!/^[\d+\-*/().<>=!\s]+$/.test(condition)) return '#FÓRMULA?';
      const truthy = Boolean(Function(`"use strict"; return (${condition.replace(/(?<![<>=!])=(?!=)/g, '==')})`)());
      const branch = truthy ? conditional[2] : conditional[3];
      const replaced = replaceReferences(branch, cells, stack);
      if (/^[\d+\-*/().\s]+$/.test(replaced)) return String(Function(`"use strict"; return (${replaced})`)());
      return branch.replace(/^"|"$/g, '');
    } catch { return '#ERRO!'; }
  }

  try {
    const replaced = replaceReferences(source, cells, stack);
    if (!/^[\d+\-*/().\s]+$/.test(replaced)) return '#FÓRMULA?';
    const result = Function(`"use strict"; return (${replaced})`)();
    return Number.isFinite(result) ? String(Number(Number(result).toFixed(8))) : '#ERRO!';
  } catch { return '#ERRO!'; }
};

const recalculateCells = (cells: Record<string, StudioCell>) => {
  const next: Record<string, StudioCell> = { ...cells };
  Object.entries(cells).forEach(([key, cell]) => { if (cell.formula) next[key] = { ...cell, value: evaluateCell(key, cells) }; });
  return next;
};

const migrateWorkbook = (project: SavedProject): WorkbookState => {
  const content = project.content as any;
  if (content && Array.isArray(content.sheets)) return {
    version: 4,
    activeSheetId: content.activeSheetId || content.sheets[0]?.id,
    sheets: content.sheets.map((sheet: any) => ({
      ...sheet,
      rows: Math.max(DEFAULT_ROWS, sheet.rows || 0),
      cols: Math.max(DEFAULT_COLS, sheet.cols || 0),
      cells: sheet.cells || {},
      columnWidths: sheet.columnWidths || {},
      rowHeights: sheet.rowHeights || {},
    })),
  };
  return defaultWorkbook();
};

const formatCellValue = (cell: StudioCell, active: boolean) => {
  if (active || !cell.format || cell.format === 'general') return String(cell.value ?? '');
  const value = numeric(cell.value);
  if (cell.format === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: cell.decimals ?? 2 }).format(value);
  if (cell.format === 'percent') return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: cell.decimals ?? 1 }).format(value);
  if (cell.format === 'date') {
    const date = new Date(String(cell.value));
    return Number.isNaN(date.getTime()) ? String(cell.value ?? '') : date.toLocaleDateString('pt-BR');
  }
  return String(cell.value ?? '');
};

export const SpreadsheetEditorStudio: React.FC<SpreadsheetEditorStudioProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `orbidoc_spreadsheet_v4_${project.id}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Nova planilha');
  const [workbook, setWorkbook] = useState<WorkbookState>(() => {
    try { const local = localStorage.getItem(storageKey); if (local) return JSON.parse(local).workbook as WorkbookState; }
    catch { /* project fallback */ }
    return migrateWorkbook(project);
  });
  const [activeCell, setActiveCell] = useState('A1');
  const [selectionStart, setSelectionStart] = useState('A1');
  const [selectionEnd, setSelectionEnd] = useState('A1');
  const [formulaInput, setFormulaInput] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [freezeHeaders, setFreezeHeaders] = useState(true);
  const compactViewport = useMediaQuery('(max-width: 1023px)');

  const sheet = workbook.sheets.find((item) => item.id === workbook.activeSheetId) || workbook.sheets[0];
  const selectedCell = sheet.cells[activeCell] || { value: '' };
  const selectedKeys = useMemo(() => cellRange(selectionStart, selectionEnd), [selectionStart, selectionEnd]);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  useEffect(() => { setFormulaInput(selectedCell.formula || String(selectedCell.value || '')); }, [activeCell, workbook.activeSheetId, selectedCell.formula, selectedCell.value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = {
        ...project,
        title,
        content: workbook,
        previewSnippet: `${workbook.sheets.length} aba(s) · ${Object.keys(sheet.cells).length} célula(s) preenchida(s)`,
        updatedAt: new Date().toISOString(),
      };
      try { localStorage.setItem(storageKey, JSON.stringify({ workbook, title, updatedAt: updated.updatedAt })); } catch { /* quota */ }
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [workbook, title, project.id]);

  const updateSheet = (updater: (source: SheetState) => SheetState) => setWorkbook((current) => ({ ...current, sheets: current.sheets.map((item) => item.id === current.activeSheetId ? updater(item) : item) }));

  const setCell = (key: string, rawValue: string) => updateSheet((current) => {
    const previous = current.cells[key] || { value: '' };
    const formula = rawValue.startsWith('=') ? rawValue : undefined;
    const draft = { ...current.cells, [key]: { ...previous, value: formula ? previous.value : rawValue, formula } };
    return { ...current, cells: recalculateCells(draft) };
  });

  const commitFormula = () => setCell(activeCell, formulaInput);

  const styleSelection = (patch: Partial<StudioCell>) => updateSheet((current) => {
    const cells = { ...current.cells };
    selectedKeys.forEach((key) => { cells[key] = { ...(cells[key] || { value: '' }), ...patch }; });
    return { ...current, cells };
  });

  const selectCell = (key: string, extend = false) => {
    setActiveCell(key);
    if (extend) setSelectionEnd(key);
    else { setSelectionStart(key); setSelectionEnd(key); }
  };

  /** Foca a célula alvo mantendo o cursor dentro da grade (navegação por setas). */
  const focusCell = (key: string, extend = false) => {
    selectCell(key, extend);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-orbit-cell="${key}"]`)?.focus();
    });
  };

  const moveFocus = (rowDelta: number, colDelta: number, extend = false) => {
    const pos = parseCell(activeCell);
    if (!pos) return;
    const row = Math.max(0, Math.min(sheet.rows - 1, pos.row + rowDelta));
    const col = Math.max(0, Math.min(sheet.cols - 1, pos.column + colDelta));
    focusCell(`${colName(col)}${row + 1}`, extend);
  };

  const colWidth = (col: number) => sheet.columnWidths?.[col] ?? DEFAULT_COL_WIDTH;
  const rowHeight = (row: number) => sheet.rowHeights?.[row] ?? DEFAULT_ROW_HEIGHT;

  const resizeColumn = (col: number, delta: number) => updateSheet((current) => ({
    ...current,
    columnWidths: { ...(current.columnWidths || {}), [col]: Math.max(MIN_COL_WIDTH, (current.columnWidths?.[col] ?? DEFAULT_COL_WIDTH) + delta) },
  }));

  const resizeRow = (row: number, delta: number) => updateSheet((current) => ({
    ...current,
    rowHeights: { ...(current.rowHeights || {}), [row]: Math.max(MIN_ROW_HEIGHT, (current.rowHeights?.[row] ?? DEFAULT_ROW_HEIGHT) + delta) },
  }));

  /** Duplo clique na borda: ajusta a coluna ao conteúdo, como no Excel/Sheets. */
  const autoFitColumn = (col: number) => updateSheet((current) => {
    let longest = 3;
    for (let row = 0; row < current.rows; row += 1) {
      const cell = current.cells[`${colName(col)}${row + 1}`];
      if (cell) longest = Math.max(longest, String(cell.value ?? '').length);
    }
    return { ...current, columnWidths: { ...(current.columnWidths || {}), [col]: Math.max(MIN_COL_WIDTH, Math.min(420, longest * 7.6 + 18)) } };
  });

  const selectColumn = (col: number) => {
    setActiveCell(`${colName(col)}1`);
    setSelectionStart(`${colName(col)}1`);
    setSelectionEnd(`${colName(col)}${sheet.rows}`);
  };

  const selectRow = (row: number) => {
    setActiveCell(`A${row + 1}`);
    setSelectionStart(`A${row + 1}`);
    setSelectionEnd(`${colName(sheet.cols - 1)}${row + 1}`);
  };

  const selectEverything = () => {
    setActiveCell('A1');
    setSelectionStart('A1');
    setSelectionEnd(`${colName(sheet.cols - 1)}${sheet.rows}`);
  };

  const selectionBounds = useMemo(() => {
    const a = parseCell(selectionStart);
    const b = parseCell(selectionEnd);
    if (!a || !b) return null;
    return {
      minRow: Math.min(a.row, b.row),
      maxRow: Math.max(a.row, b.row),
      minCol: Math.min(a.column, b.column),
      maxCol: Math.max(a.column, b.column),
    };
  }, [selectionStart, selectionEnd]);

  const pasteBlock = (event: React.ClipboardEvent<HTMLInputElement>, startKey: string) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    const start = parseCell(startKey);
    if (!start) return;
    const matrix = text.replace(/\r/g, '').split('\n').filter((row, index, all) => row.length || index < all.length - 1).map((row) => row.split('\t'));
    updateSheet((current) => {
      const cells = { ...current.cells };
      matrix.forEach((row, rowOffset) => row.forEach((value, colOffset) => {
        const key = `${colName(start.column + colOffset)}${start.row + rowOffset + 1}`;
        const previous = cells[key] || { value: '' };
        cells[key] = { ...previous, value: value.startsWith('=') ? previous.value : value, formula: value.startsWith('=') ? value : undefined };
      }));
      return {
        ...current,
        rows: Math.max(current.rows, start.row + matrix.length + 5),
        cols: Math.max(current.cols, start.column + Math.max(0, ...matrix.map((row) => row.length)) + 3),
        cells: recalculateCells(cells),
      };
    });
    if (matrix.length) {
      const maxCols = Math.max(1, ...matrix.map((row) => row.length));
      setSelectionEnd(`${colName(start.column + maxCols - 1)}${start.row + matrix.length}`);
    }
  };

  const shiftRows = (mode: 'insert' | 'delete') => {
    const parsed = parseCell(activeCell);
    if (!parsed) return;
    updateSheet((current) => {
      const cells: Record<string, StudioCell> = {};
      Object.entries(current.cells).forEach(([key, cell]) => {
        const pos = parseCell(key);
        if (!pos) return;
        if (mode === 'delete' && pos.row === parsed.row) return;
        const row = mode === 'insert' ? (pos.row >= parsed.row ? pos.row + 1 : pos.row) : (pos.row > parsed.row ? pos.row - 1 : pos.row);
        cells[`${colName(pos.column)}${row + 1}`] = cell;
      });
      return { ...current, rows: Math.max(DEFAULT_ROWS, current.rows + (mode === 'insert' ? 1 : -1)), cells: recalculateCells(cells) };
    });
  };

  const shiftCols = (mode: 'insert' | 'delete') => {
    const parsed = parseCell(activeCell);
    if (!parsed) return;
    updateSheet((current) => {
      const cells: Record<string, StudioCell> = {};
      Object.entries(current.cells).forEach(([key, cell]) => {
        const pos = parseCell(key);
        if (!pos) return;
        if (mode === 'delete' && pos.column === parsed.column) return;
        const col = mode === 'insert' ? (pos.column >= parsed.column ? pos.column + 1 : pos.column) : (pos.column > parsed.column ? pos.column - 1 : pos.column);
        cells[`${colName(col)}${pos.row + 1}`] = cell;
      });
      return { ...current, cols: Math.max(DEFAULT_COLS, current.cols + (mode === 'insert' ? 1 : -1)), cells: recalculateCells(cells) };
    });
  };

  const sortActiveColumn = (direction: 'asc' | 'desc') => {
    const parsed = parseCell(activeCell);
    if (!parsed) return;
    updateSheet((current) => {
      let lastRow = 0;
      Object.keys(current.cells).forEach((key) => { const pos = parseCell(key); if (pos) lastRow = Math.max(lastRow, pos.row); });
      if (lastRow < 1) return current;
      const dataRows = Array.from({ length: lastRow }, (_, index) => index + 1);
      dataRows.sort((a, b) => {
        const av = current.cells[`${colName(parsed.column)}${a + 1}`]?.value ?? '';
        const bv = current.cells[`${colName(parsed.column)}${b + 1}`]?.value ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const comparison = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
        return direction === 'asc' ? comparison : -comparison;
      });
      const order = [0, ...dataRows];
      const cells: Record<string, StudioCell> = {};
      order.forEach((sourceRow, targetRow) => {
        for (let col = 0; col < current.cols; col += 1) {
          const source = current.cells[`${colName(col)}${sourceRow + 1}`];
          if (source) cells[`${colName(col)}${targetRow + 1}`] = source;
        }
      });
      return { ...current, cells: recalculateCells(cells) };
    });
  };

  const addSheet = () => setWorkbook((current) => {
    const next = createSheet(`Planilha${current.sheets.length + 1}`);
    return { ...current, sheets: [...current.sheets, next], activeSheetId: next.id };
  });

  const deleteActiveSheet = () => {
    if (workbook.sheets.length <= 1) return;
    setWorkbook((current) => {
      const sheets = current.sheets.filter((item) => item.id !== current.activeSheetId);
      return { ...current, sheets, activeSheetId: sheets[0].id };
    });
  };

  const applyTemplate = (kind: 'budget' | 'tasks' | 'grades') => {
    const target = createSheet(kind === 'budget' ? 'Orçamento' : kind === 'tasks' ? 'Tarefas' : 'Notas');
    const matrix = kind === 'budget'
      ? [['Categoria','Previsto','Realizado','Variação'],['Receita','0','0','=C2-B2'],['Pessoal','0','0','=C3-B3'],['Materiais','0','0','=C4-B4'],['Serviços','0','0','=C5-B5'],['Total','=SUM(B2:B5)','=SUM(C2:C5)','=C6-B6']]
      : kind === 'tasks'
        ? [['Tarefa','Responsável','Prioridade','Prazo','Status'],['Definir escopo','','Alta','','Não iniciado'],['Coletar dados','','Média','','Não iniciado'],['Revisar entrega','','Alta','','Não iniciado']]
        : [['Aluno / Item','Atividade 1','Atividade 2','Prova','Média'],['Exemplo','0','0','0','=AVERAGE(B2:D2)']];
    matrix.forEach((row, r) => row.forEach((value, c) => {
      const key = `${colName(c)}${r + 1}`;
      target.cells[key] = { value: value.startsWith('=') ? '' : value, formula: value.startsWith('=') ? value : undefined, bold: r === 0, bgColor: r === 0 ? '#EAF0FF' : undefined };
    }));
    target.cells = recalculateCells(target.cells);
    setWorkbook((current) => ({ ...current, sheets: [...current.sheets, target], activeSheetId: target.id }));
    selectCell('A1');
  };

  const importWorkbook = async (file?: File) => {
    if (!file) return;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const loaded = extension === 'csv' ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellStyles: true });
      const sheets: SheetState[] = loaded.SheetNames.map((name) => {
        const worksheet = loaded.Sheets[name];
        const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: '' });
        const state = createSheet(name);
        state.rows = Math.max(DEFAULT_ROWS, matrix.length + 10);
        state.cols = Math.max(DEFAULT_COLS, Math.max(0, ...matrix.map((row) => row.length)) + 3);
        matrix.forEach((row, r) => row.forEach((value, c) => {
          const key = `${colName(c)}${r + 1}`;
          const source = worksheet[key];
          state.cells[key] = { value: String(value ?? ''), formula: source?.f ? `=${source.f}` : undefined, bold: Boolean((source as any)?.s?.font?.bold), italic: Boolean((source as any)?.s?.font?.italic) };
        }));
        state.cells = recalculateCells(state.cells);
        return state;
      });
      if (!sheets.length) throw new Error('A planilha não contém abas legíveis.');
      setWorkbook({ version: 4, sheets, activeSheetId: sheets[0].id });
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      selectCell('A1');
      showNotification(`${file.name} importado.`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao importar planilha.', 'error'); }
  };

  const sheetBounds = (source: SheetState) => {
    let maxRow = 0;
    let maxCol = 0;
    Object.keys(source.cells).forEach((key) => {
      const parsed = parseCell(key);
      if (parsed) { maxRow = Math.max(maxRow, parsed.row + 1); maxCol = Math.max(maxCol, parsed.column + 1); }
    });
    return { rows: Math.max(1, maxRow), cols: Math.max(1, maxCol) };
  };

  const toSheetArray = (source: SheetState) => {
    const bounds = sheetBounds(source);
    return Array.from({ length: bounds.rows }, (_, row) => Array.from({ length: bounds.cols }, (_, col) => source.cells[`${colName(col)}${row + 1}`]?.value || ''));
  };

  const toXlsxSheet = (source: SheetState) => {
    const worksheet = XLSX.utils.aoa_to_sheet(toSheetArray(source));
    Object.entries(source.cells).forEach(([key, cell]) => {
      if (!cell.formula) return;
      const value = evaluateCell(key, source.cells);
      const number = Number(value);
      worksheet[key] = Number.isFinite(number) ? { t: 'n', v: number, f: cell.formula.slice(1) } : { t: 's', v: value, f: cell.formula.slice(1) };
    });
    return worksheet;
  };

  const exportWorkbook = async (format: 'xlsx' | 'csv' | 'pdf' | 'html') => {
    const base = sanitizeFileName(title.replace(/\.(xlsx|xls|csv|pdf|html)$/i, ''));
    try {
      if (format === 'xlsx') {
        const output = XLSX.utils.book_new();
        workbook.sheets.forEach((source, index) => XLSX.utils.book_append_sheet(output, toXlsxSheet(source), sanitizeSheetName(source.name, `Planilha${index + 1}`)));
        const bytes = XLSX.write(output, { type: 'array', bookType: 'xlsx' });
        saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`);
      } else if (format === 'csv') {
        const worksheet = XLSX.utils.aoa_to_sheet(toSheetArray(sheet));
        saveAs(new Blob(['\ufeff', XLSX.utils.sheet_to_csv(worksheet)], { type: 'text/csv;charset=utf-8' }), `${base}_${sanitizeSheetName(sheet.name, 'Planilha')}.csv`);
      } else if (format === 'html') {
        const worksheet = XLSX.utils.aoa_to_sheet(toSheetArray(sheet));
        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px}</style></head><body><h1>${base}</h1>${XLSX.utils.sheet_to_html(worksheet)}</body></html>`;
        saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      } else {
        const data = toSheetArray(sheet);
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: data[0]?.length > 8 ? 'landscape' : 'portrait' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFontSize(14); pdf.text(base, 10, 12); pdf.setFontSize(7);
        let y = 19;
        data.forEach((row) => {
          const line = row.map((value) => String(value).slice(0, 22).padEnd(22)).join(' | ');
          const lines = pdf.splitTextToSize(line, pageWidth - 20);
          if (y + lines.length * 3.4 > pageHeight - 10) { pdf.addPage(); y = 12; }
          pdf.text(lines, 10, y); y += lines.length * 3.4 + 1;
        });
        pdf.save(`${base}.pdf`);
      }
      onSaveToHistory?.({ type: 'excel', title: base, summary: `${workbook.sheets.length} aba(s) exportadas como ${format.toUpperCase()}.`, tags: ['Planilha', format.toUpperCase()] });
      showNotification(`Planilha exportada como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao exportar planilha.', 'error'); }
  };

  const runAiAnalysis = async () => {
    const data = toSheetArray(sheet).slice(0, 40).map((row) => row.slice(0, 12).join('\t')).join('\n');
    if (!data.trim()) return;
    setAiBusy(true);
    try {
      const answer = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: 'Analise a planilha como um analista de negócios. Identifique tendências, anomalias, riscos e próximos passos. Não invente dados.' },
        { role: 'user', content: data },
      ]);
      onSaveToHistory?.({ type: 'excel', title: `Análise: ${sheet.name}`, summary: answer.slice(0, 180), details: answer, tags: ['Planilha', 'IA'] });
      showNotification('Análise salva no histórico.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha na análise.', 'error'); }
    finally { setAiBusy(false); }
  };

  const rangeStats = useMemo(() => {
    const values = selectedKeys.map((key) => sheet.cells[key]?.value).filter((value) => value !== undefined && String(value).trim() !== '');
    const nums = values.map((value) => Number(String(value).replace(',', '.'))).filter(Number.isFinite);
    return {
      count: values.length,
      numericCount: nums.length,
      sum: nums.reduce((sum, value) => sum + value, 0),
      avg: nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0,
      min: nums.length ? Math.min(...nums) : 0,
      max: nums.length ? Math.max(...nums) : 0,
      nums,
    };
  }, [selectedKeys, sheet.cells]);

  const rows = useMemo(() => Array.from({ length: sheet.rows }, (_, index) => index), [sheet.rows]);
  const cols = useMemo(() => Array.from({ length: sheet.cols }, (_, index) => index), [sheet.cols]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <div className="shrink-0 min-h-11 px-2 sm:px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap">
        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-[180px] flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome da planilha" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <select defaultValue="" onChange={(event) => { if (event.target.value) applyTemplate(event.target.value as 'budget' | 'tasks' | 'grades'); event.target.value = ''; }} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold"><option value="">Modelos…</option><option value="budget">Orçamento</option><option value="tasks">Controle de tarefas</option><option value="grades">Notas / avaliação</option></select>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void importWorkbook(event.target.files?.[0]); event.target.value = ''; }} />
        <button onClick={() => inputRef.current?.click()} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Importar</button>
        <button onClick={runAiAnalysis} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-black inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Analisando…' : 'Analisar IA'}</button>
        <div className="relative group"><button className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar</button><div className="hidden group-hover:block absolute right-0 top-8 z-40 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['xlsx','csv','pdf','html'] as const).map((format) => <button key={format} onClick={() => void exportWorkbook(format)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
      </div>

      <div className="shrink-0 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
        <span className="w-14 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black flex items-center justify-center shrink-0">{activeCell}</span>
        <span className="text-xs font-black text-slate-400">fx</span>
        <input value={formulaInput} onChange={(event) => setFormulaInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitFormula(); }} onBlur={commitFormula} className="min-w-[220px] flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs outline-none focus:border-emerald-500" />
        <button onClick={() => styleSelection({ bold: !selectedCell.bold })} className={`w-8 h-8 rounded-lg ${selectedCell.bold ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Bold className="w-4 h-4 mx-auto" /></button>
        <button onClick={() => styleSelection({ italic: !selectedCell.italic })} className={`w-8 h-8 rounded-lg ${selectedCell.italic ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Italic className="w-4 h-4 mx-auto" /></button>
        <button onClick={() => styleSelection({ align: 'left' })} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><AlignLeft className="w-4 h-4 mx-auto" /></button><button onClick={() => styleSelection({ align: 'center' })} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><AlignCenter className="w-4 h-4 mx-auto" /></button><button onClick={() => styleSelection({ align: 'right' })} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><AlignRight className="w-4 h-4 mx-auto" /></button>
        <label title="Cor do texto" className="w-8 h-8 flex items-center justify-center"><input type="color" className="w-5 h-5" onChange={(event) => styleSelection({ textColor: event.target.value })} /></label><label title="Cor de fundo" className="w-8 h-8 flex items-center justify-center"><input type="color" defaultValue="#eaf0ff" className="w-5 h-5" onChange={(event) => styleSelection({ bgColor: event.target.value })} /></label>
        <select onChange={(event) => styleSelection({ fontFamily: event.target.value })} defaultValue="" className="h-8 max-w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px]"><option value="">Fonte</option>{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select>
        <select onChange={(event) => styleSelection({ format: event.target.value as CellFormat })} defaultValue="general" className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px]"><option value="general">Geral</option><option value="currency">R$ Moeda</option><option value="percent">Percentual</option><option value="date">Data</option></select>
        <button onClick={() => sortActiveColumn('asc')} title="Ordenar crescente" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><SortUp className="w-4 h-4 mx-auto" /></button><button onClick={() => sortActiveColumn('desc')} title="Ordenar decrescente" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><SortDown className="w-4 h-4 mx-auto" /></button>
        <div className="relative group"><button className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Linha</button><div className="hidden group-hover:block absolute top-8 z-40 w-32 rounded-xl border bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={() => shiftRows('insert')} className="w-full p-2 text-left text-[10px]">Inserir linha</button><button onClick={() => shiftRows('delete')} className="w-full p-2 text-left text-[10px] text-rose-600">Excluir linha</button></div></div>
        <div className="relative group"><button className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Coluna</button><div className="hidden group-hover:block absolute top-8 z-40 w-32 rounded-xl border bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={() => shiftCols('insert')} className="w-full p-2 text-left text-[10px]">Inserir coluna</button><button onClick={() => shiftCols('delete')} className="w-full p-2 text-left text-[10px] text-rose-600">Excluir coluna</button></div></div>
        <button onClick={() => setFreezeHeaders((value) => !value)} className={`h-8 px-2 rounded-lg text-[10px] font-bold border ${freezeHeaders ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-slate-200 dark:border-slate-700'}`}>Fixar cabeçalhos</button>
        <button onClick={() => setShowInsights((value) => !value)} className={`h-8 px-2 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${showInsights ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 dark:border-slate-700'}`}><ChartBar className="w-3.5 h-3.5" /> Resumo</button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="orbit-sheet-scroll">
          <table className="orbit-sheet text-[11px]" data-freeze={freezeHeaders}>
            <thead>
              <tr>
                <th
                  className="orbit-sheet__corner"
                  style={{ width: 48, minWidth: 48, height: 24 }}
                  onClick={selectEverything}
                  title="Selecionar toda a planilha"
                />
                {cols.map((col) => (
                  <th
                    key={col}
                    style={{ width: colWidth(col), minWidth: colWidth(col), height: 24 }}
                    data-selected={selectionBounds ? col >= selectionBounds.minCol && col <= selectionBounds.maxCol : false}
                    onClick={() => selectColumn(col)}
                    title={`Coluna ${colName(col)} · arraste a borda para redimensionar`}
                  >
                    {colName(col)}
                    <OrbitResizeGrip
                      axis="x"
                      label={`Largura da coluna ${colName(col)}`}
                      onResize={(delta, phase) => { if (phase === 'move' && delta) resizeColumn(col, delta); }}
                      onReset={() => autoFitColumn(col)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <th
                    style={{ width: 48, minWidth: 48, height: rowHeight(row) }}
                    data-selected={selectionBounds ? row >= selectionBounds.minRow && row <= selectionBounds.maxRow : false}
                    onClick={() => selectRow(row)}
                    title={`Linha ${row + 1} · arraste a borda para redimensionar`}
                  >
                    {row + 1}
                    <OrbitResizeGrip
                      axis="y"
                      label={`Altura da linha ${row + 1}`}
                      onResize={(delta, phase) => { if (phase === 'move' && delta) resizeRow(row, delta); }}
                      onReset={() => resizeRow(row, DEFAULT_ROW_HEIGHT - rowHeight(row))}
                    />
                  </th>
                  {cols.map((col) => {
                    const key = `${colName(col)}${row + 1}`;
                    const cell = sheet.cells[key] || { value: '' };
                    const active = activeCell === key;
                    return (
                      <td
                        key={key}
                        data-active={active}
                        data-in-range={selectedSet.has(key)}
                        style={{
                          width: colWidth(col),
                          minWidth: colWidth(col),
                          height: rowHeight(row),
                          backgroundColor: cell.bgColor || undefined,
                          color: cell.textColor || undefined,
                          textAlign: cell.align || 'left',
                          fontFamily: cell.fontFamily || undefined,
                        }}
                      >
                        <input
                          data-orbit-cell={key}
                          value={formatCellValue(cell, active)}
                          onFocus={() => { if (activeCell !== key) selectCell(key, false); }}
                          onMouseDown={(event) => selectCell(key, event.shiftKey)}
                          onChange={(event) => setCell(key, event.target.value)}
                          onPaste={(event) => pasteBlock(event, key)}
                          onKeyDown={(event) => {
                            const pos = parseCell(key);
                            if (!pos) return;
                            const caretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;
                            const caretAtEnd = event.currentTarget.selectionStart === event.currentTarget.value.length;
                            if (event.key === 'Enter') { event.preventDefault(); focusCell(`${colName(pos.column)}${Math.min(sheet.rows, pos.row + 2)}`); }
                            else if (event.key === 'Tab') { event.preventDefault(); const nextColumn = Math.max(0, Math.min(sheet.cols - 1, pos.column + (event.shiftKey ? -1 : 1))); focusCell(`${colName(nextColumn)}${pos.row + 1}`); }
                            else if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(1, 0, event.shiftKey); }
                            else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-1, 0, event.shiftKey); }
                            else if (event.key === 'ArrowRight' && caretAtEnd) { event.preventDefault(); moveFocus(0, 1, event.shiftKey); }
                            else if (event.key === 'ArrowLeft' && caretAtStart) { event.preventDefault(); moveFocus(0, -1, event.shiftKey); }
                            else if (event.key === 'Escape') event.currentTarget.blur();
                            else if (event.key === 'Delete' && selectedKeys.length > 1) { event.preventDefault(); styleSelection({ value: '', formula: undefined }); }
                          }}
                          className={`${cell.bold ? 'font-bold' : ''} ${cell.italic ? 'italic' : ''}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showInsights ? (
          compactViewport ? (
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center gap-3 overflow-x-auto text-[10px] font-bold text-slate-500">
              <span className="font-black text-slate-700 dark:text-slate-200">{selectionStart === selectionEnd ? selectionStart : `${selectionStart}:${selectionEnd}`}</span>
              <span>Células {rangeStats.count}</span>
              <span>Soma {Number(rangeStats.sum.toFixed(2))}</span>
              <span>Média {Number(rangeStats.avg.toFixed(2))}</span>
              <span>Mín {Number(rangeStats.min.toFixed(2))}</span>
              <span>Máx {Number(rangeStats.max.toFixed(2))}</span>
            </div>
          ) : (
            <OrbitResizablePane
              storageKey="sheet-insights"
              handle="start"
              defaultSize={264}
              min={210}
              max={480}
              label="painel de resumo"
              className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Intervalo</div>
                  <div className="mt-1 text-sm font-black">{selectionStart === selectionEnd ? selectionStart : `${selectionStart}:${selectionEnd}`}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Células" value={rangeStats.count} />
                  <Stat label="Números" value={rangeStats.numericCount} />
                  <Stat label="Soma" value={Number(rangeStats.sum.toFixed(2))} />
                  <Stat label="Média" value={Number(rangeStats.avg.toFixed(2))} />
                  <Stat label="Mínimo" value={Number(rangeStats.min.toFixed(2))} />
                  <Stat label="Máximo" value={Number(rangeStats.max.toFixed(2))} />
                </div>
                {rangeStats.nums.length > 1 ? (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Gráfico rápido</div>
                    <MiniBarChart values={rangeStats.nums.slice(0, 20)} />
                  </div>
                ) : null}
                <p className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-500">
                  Shift + clique seleciona intervalos, clique no cabeçalho seleciona a coluna ou a linha inteira e o duplo clique na borda ajusta a largura ao conteúdo.
                </p>
              </div>
            </OrbitResizablePane>
          )
        ) : null}
      </div>

      <div className="h-9 shrink-0 border-t border-slate-200 dark:border-slate-800 px-2 flex items-center gap-1 overflow-x-auto">{workbook.sheets.map((item) => <button key={item.id} onClick={() => { setWorkbook((current) => ({ ...current, activeSheetId: item.id })); selectCell('A1'); }} onDoubleClick={() => { const name = window.prompt('Nome da aba:', item.name); if (name) setWorkbook((current) => ({ ...current, sheets: current.sheets.map((sheetItem) => sheetItem.id === item.id ? { ...sheetItem, name: sanitizeSheetName(name, item.name) } : sheetItem) })); }} className={`h-8 px-3 rounded-lg text-[10px] font-bold ${workbook.activeSheetId === item.id ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}>{item.name}</button>)}<button onClick={addSheet} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="w-4 h-4 mx-auto" /></button>{workbook.sheets.length > 1 && <button onClick={deleteActiveSheet} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500"><Trash className="w-4 h-4 mx-auto" /></button>}</div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5"><div className="text-[9px] uppercase font-black text-slate-400">{label}</div><div className="mt-1 text-sm font-black truncate">{value}</div></div>;
const MiniBarChart: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  return <div className="h-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex items-end gap-1">{values.map((value, index) => <div key={index} title={String(value)} className="flex-1 min-w-1 rounded-t bg-emerald-500/80" style={{ height: `${Math.max(3, Math.abs(value) / max * 100)}%` }} />)}</div>;
};
