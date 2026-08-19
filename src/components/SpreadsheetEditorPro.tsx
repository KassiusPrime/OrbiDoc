import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconBold as Bold,
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

interface SpreadsheetEditorProProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type SheetState = { id: string; name: string; rows: number; cols: number; cells: Record<string, ExcelCell> };
type WorkbookState = { sheets: SheetState[]; activeSheetId: string };

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 16;

const colName = (index: number) => {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

const createSheet = (name = 'Planilha1'): SheetState => ({ id: crypto.randomUUID(), name, rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {} });
const defaultWorkbook = (): WorkbookState => { const sheet = createSheet(); return { sheets: [sheet], activeSheetId: sheet.id }; };

const numeric = (value: string | number | undefined) => {
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCell = (cell: string) => {
  const match = cell.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let column = 0;
  for (const char of match[1]) column = column * 26 + (char.charCodeAt(0) - 64);
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

const evaluateCell = (key: string, cells: Record<string, ExcelCell>, stack = new Set<string>()): string => {
  const upper = key.toUpperCase();
  const cell = cells[upper];
  if (!cell) return '';
  if (!cell.formula) return String(cell.value ?? '');
  if (stack.has(upper)) return '#CIRC!';
  const nextStack = new Set(stack);
  nextStack.add(upper);
  return evaluateFormula(cell.formula, cells, nextStack);
};

const evaluateFormula = (formula: string, cells: Record<string, ExcelCell>, stack = new Set<string>()): string => {
  if (!formula.startsWith('=')) return formula;
  const source = formula.slice(1).trim().toUpperCase();
  const fn = source.match(/^(SUM|SOMA|AVERAGE|AVG|MÉDIA|MEDIA|MIN|MAX)\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (fn) {
    const values = cellRange(fn[2], fn[3]).map((key) => numeric(evaluateCell(key, cells, stack)));
    if (!values.length) return '0';
    const op = fn[1];
    const result = op === 'SUM' || op === 'SOMA' ? values.reduce((sum, value) => sum + value, 0)
      : op === 'MIN' ? Math.min(...values)
        : op === 'MAX' ? Math.max(...values)
          : values.reduce((sum, value) => sum + value, 0) / values.length;
    return String(Number(result.toFixed(6)));
  }

  try {
    const replaced = source.replace(/\b([A-Z]+\d+)\b/g, (key) => String(numeric(evaluateCell(key, cells, stack))));
    if (!/^[\d+\-*/().\s]+$/.test(replaced)) return '#FÓRMULA?';
    const result = Function(`"use strict"; return (${replaced})`)();
    return Number.isFinite(result) ? String(Number(Number(result).toFixed(6))) : '#ERRO!';
  } catch {
    return '#ERRO!';
  }
};

const recalculateCells = (cells: Record<string, ExcelCell>) => {
  const next: Record<string, ExcelCell> = { ...cells };
  Object.entries(cells).forEach(([key, cell]) => {
    if (cell.formula) next[key] = { ...cell, value: evaluateCell(key, cells) };
  });
  return next;
};

const sanitizeSheetName = (value: string, fallback: string) => value.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || fallback;
const sanitizeFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Planilha';

export const SpreadsheetEditorPro: React.FC<SpreadsheetEditorProProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_spreadsheet_v3_${project.id}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Nova planilha');
  const [workbook, setWorkbook] = useState<WorkbookState>(() => {
    try {
      const local = localStorage.getItem(storageKey);
      if (local) return JSON.parse(local).workbook || defaultWorkbook();
      if (project.content && typeof project.content === 'object' && Array.isArray((project.content as any).sheets)) return project.content as WorkbookState;
    } catch { /* default */ }
    return defaultWorkbook();
  });
  const [activeCell, setActiveCell] = useState('A1');
  const [formulaInput, setFormulaInput] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const sheet = workbook.sheets.find((item) => item.id === workbook.activeSheetId) || workbook.sheets[0];
  const selectedCell = sheet?.cells[activeCell] || { value: '' };

  useEffect(() => {
    setFormulaInput(selectedCell.formula || String(selectedCell.value || ''));
  }, [activeCell, workbook.activeSheetId, selectedCell.formula, selectedCell.value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = {
        ...project,
        title,
        content: workbook,
        previewSnippet: `${workbook.sheets.length} aba(s) · ${Object.keys(sheet?.cells || {}).length} célula(s) preenchida(s)`,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify({ workbook, title, updatedAt: updated.updatedAt }));
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [workbook, title, project.id]);

  const updateSheet = (updater: (sheet: SheetState) => SheetState) => {
    setWorkbook((current) => ({ ...current, sheets: current.sheets.map((item) => item.id === current.activeSheetId ? updater(item) : item) }));
  };

  const setCell = (key: string, rawValue: string) => {
    updateSheet((current) => {
      const previous = current.cells[key] || { value: '' };
      const formula = rawValue.startsWith('=') ? rawValue : undefined;
      const draft = {
        ...current.cells,
        [key]: { ...previous, value: formula ? previous.value : rawValue, formula },
      };
      return { ...current, cells: recalculateCells(draft) };
    });
  };

  const commitFormula = () => setCell(activeCell, formulaInput);

  const styleCell = (patch: Partial<ExcelCell>) => {
    updateSheet((current) => ({ ...current, cells: { ...current.cells, [activeCell]: { ...(current.cells[activeCell] || { value: '' }), ...patch } } }));
  };

  const importWorkbook = async (file?: File) => {
    if (!file) return;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const loaded = extension === 'csv' ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellStyles: true });
      const sheets: SheetState[] = loaded.SheetNames.map((name) => {
        const worksheet = loaded.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: '' });
        const state = createSheet(name);
        state.rows = Math.max(DEFAULT_ROWS, rows.length + 10);
        state.cols = Math.max(DEFAULT_COLS, Math.max(0, ...rows.map((row) => row.length)) + 3);
        rows.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
          const key = `${colName(colIndex)}${rowIndex + 1}`;
          const source = worksheet[key];
          state.cells[key] = {
            value: String(value ?? ''),
            formula: source?.f ? `=${source.f}` : undefined,
            bold: Boolean((source as any)?.s?.font?.bold),
            italic: Boolean((source as any)?.s?.font?.italic),
          };
        }));
        state.cells = recalculateCells(state.cells);
        return state;
      });
      if (!sheets.length) throw new Error('A planilha não contém abas legíveis.');
      setWorkbook({ sheets, activeSheetId: sheets[0].id });
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      setActiveCell('A1');
      showNotification(`${file.name} importado.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao importar planilha.', 'error');
    }
  };

  const sheetBounds = (source: SheetState) => {
    let maxRow = 0;
    let maxCol = 0;
    Object.keys(source.cells).forEach((key) => {
      const parsed = parseCell(key);
      if (!parsed) return;
      maxRow = Math.max(maxRow, parsed.row + 1);
      maxCol = Math.max(maxCol, parsed.column + 1);
    });
    return { rows: Math.max(1, maxRow), cols: Math.max(1, maxCol) };
  };

  const toSheetArray = (source: SheetState, formulas = false) => {
    const bounds = sheetBounds(source);
    const data: any[][] = [];
    for (let row = 0; row < bounds.rows; row += 1) {
      const values: any[] = [];
      for (let col = 0; col < bounds.cols; col += 1) {
        const cell = source.cells[`${colName(col)}${row + 1}`];
        values.push(formulas && cell?.formula ? cell.formula : cell?.value || '');
      }
      data.push(values);
    }
    return data;
  };

  const toXlsxSheet = (source: SheetState) => {
    const values = toSheetArray(source, false);
    const worksheet = XLSX.utils.aoa_to_sheet(values);
    Object.entries(source.cells).forEach(([key, cell]) => {
      if (!cell.formula) return;
      const evaluated = evaluateCell(key, source.cells);
      const numberValue = Number(evaluated);
      worksheet[key] = Number.isFinite(numberValue)
        ? { t: 'n', v: numberValue, f: cell.formula.slice(1) }
        : { t: 's', v: evaluated, f: cell.formula.slice(1) };
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
        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}</style></head><body><h1>${base}</h1>${XLSX.utils.sheet_to_html(worksheet)}</body></html>`;
        saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      } else {
        const rows = toSheetArray(sheet);
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: rows[0]?.length > 8 ? 'landscape' : 'portrait' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); pdf.text(base, margin, 12);
        pdf.setFontSize(7); pdf.setFont('courier', 'normal');
        let y = 19;
        rows.forEach((row) => {
          const line = row.map((value) => String(value).slice(0, 24).padEnd(24)).join(' | ');
          const lines = pdf.splitTextToSize(line, pageWidth - margin * 2);
          if (y + lines.length * 3.5 > pageHeight - 10) { pdf.addPage(); y = 12; }
          pdf.text(lines, margin, y); y += lines.length * 3.5 + 1;
        });
        saveAs(pdf.output('blob'), `${base}.pdf`);
      }
      onSaveToHistory?.({ type: 'excel', title: base, summary: `${workbook.sheets.length} aba(s) · exportação ${format.toUpperCase()}.`, details: XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(toSheetArray(sheet))), tags: ['Planilha', format.toUpperCase()] });
      showNotification(`Planilha exportada como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na exportação.', 'error');
    }
  };

  const addSheet = () => {
    const next = createSheet(`Planilha${workbook.sheets.length + 1}`);
    setWorkbook((current) => ({ sheets: [...current.sheets, next], activeSheetId: next.id }));
    setActiveCell('A1');
  };

  const deleteActiveSheet = () => {
    if (workbook.sheets.length === 1) return;
    const remaining = workbook.sheets.filter((item) => item.id !== workbook.activeSheetId);
    setWorkbook({ sheets: remaining, activeSheetId: remaining[0].id });
    setActiveCell('A1');
  };

  const runAiAnalysis = async () => {
    setAiBusy(true);
    try {
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(toSheetArray(sheet))).slice(0, 70_000);
      const answer = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: 'Analise a planilha fornecida. Identifique padrões, totais, possíveis inconsistências e próximos passos. Não invente números que não estejam nos dados. Responda em Markdown.' },
        { role: 'user', content: `Aba: ${sheet.name}\n\n${csv}` },
      ]);
      onSaveToHistory?.({ type: 'ai', title: `Análise: ${title}`, summary: answer.slice(0, 180), details: answer, tags: ['IA', 'Planilha'] });
      await navigator.clipboard?.writeText(answer).catch(() => {});
      showNotification('Análise concluída e copiada para a área de transferência.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na análise com IA.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const rows = Array.from({ length: sheet?.rows || DEFAULT_ROWS }, (_, index) => index);
  const cols = Array.from({ length: sheet?.cols || DEFAULT_COLS }, (_, index) => index);

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome da planilha" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void importWorkbook(event.target.files?.[0]); event.target.value = ''; }} />
        <button onClick={() => inputRef.current?.click()} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Importar</button>
        <button onClick={runAiAnalysis} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Analisando…' : 'Analisar IA'}</button>
        <div className="relative group"><button className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['xlsx','csv','pdf','html'] as const).map((format) => <button key={format} onClick={() => void exportWorkbook(format)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
      </div>

      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <span className="w-14 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black flex items-center justify-center shrink-0">{activeCell}</span>
        <span className="text-xs font-black text-slate-400">fx</span>
        <input value={formulaInput} onChange={(event) => setFormulaInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitFormula(); }} onBlur={commitFormula} className="min-w-[220px] flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs outline-none focus:border-emerald-500" />
        <button onClick={() => styleCell({ bold: !selectedCell.bold })} className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCell.bold ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Bold className="w-4 h-4" /></button>
        <button onClick={() => styleCell({ italic: !selectedCell.italic })} className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCell.italic ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Italic className="w-4 h-4" /></button>
        <button onClick={() => styleCell({ align: 'left' })} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => styleCell({ align: 'center' })} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => styleCell({ align: 'right' })} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><AlignRight className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 min-h-[520px] overflow-auto bg-slate-50 dark:bg-slate-950">
        <table className="border-collapse table-fixed min-w-max text-[11px]">
          <thead className="sticky top-0 z-10"><tr><th className="sticky left-0 z-20 w-12 h-7 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />{cols.map((col) => <th key={col} className="w-28 h-7 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-black text-slate-500">{colName(col)}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row}><th className="sticky left-0 z-[5] w-12 h-7 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 font-black">{row + 1}</th>{cols.map((col) => {
            const key = `${colName(col)}${row + 1}`;
            const cell = sheet.cells[key] || { value: '' };
            const active = activeCell === key;
            return <td key={key} className={`w-28 h-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 ${active ? 'ring-2 ring-inset ring-emerald-500' : ''}`} style={{ backgroundColor: cell.bgColor || undefined, color: cell.textColor || undefined, textAlign: cell.align || 'left' }}><input value={String(cell.value ?? '')} onFocus={() => setActiveCell(key)} onChange={(event) => setCell(key, event.target.value)} className={`w-full h-full px-1.5 bg-transparent outline-none text-[11px] ${cell.bold ? 'font-bold' : ''} ${cell.italic ? 'italic' : ''}`} /></td>;
          })}</tr>)}</tbody>
        </table>
      </div>

      <div className="h-11 border-t border-slate-200 dark:border-slate-800 px-2 flex items-center gap-1 overflow-x-auto">
        {workbook.sheets.map((item) => <button key={item.id} onClick={() => { setWorkbook((current) => ({ ...current, activeSheetId: item.id })); setActiveCell('A1'); }} onDoubleClick={() => { const name = window.prompt('Nome da aba:', item.name); if (name) setWorkbook((current) => ({ ...current, sheets: current.sheets.map((sheetItem) => sheetItem.id === item.id ? { ...sheetItem, name: sanitizeSheetName(name, item.name) } : sheetItem) })); }} className={`h-8 px-3 rounded-lg text-[10px] font-bold ${workbook.activeSheetId === item.id ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}>{item.name}</button>)}
        <button onClick={addSheet} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
        {workbook.sheets.length > 1 && <button onClick={deleteActiveSheet} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center"><Trash className="w-4 h-4" /></button>}
      </div>
    </div>
  );
};
