import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconBold as Bold,
  IconChartBar as ChartBar,
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

interface SpreadsheetEditorProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type SheetState = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, ExcelCell>;
};

type WorkbookState = { sheets: SheetState[]; activeSheetId: string };

const DEFAULT_ROWS = 40;
const DEFAULT_COLS = 12;

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

const createSheet = (name = 'Planilha1'): SheetState => ({
  id: crypto.randomUUID(),
  name,
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  cells: {},
});

const defaultWorkbook = (): WorkbookState => {
  const sheet = createSheet();
  return { sheets: [sheet], activeSheetId: sheet.id };
};

const numeric = (value: string | number | undefined) => {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cellRange = (start: string, end: string) => {
  const parse = (cell: string) => {
    const match = cell.toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    let column = 0;
    for (const char of match[1]) column = column * 26 + (char.charCodeAt(0) - 64);
    return { column: column - 1, row: Number(match[2]) - 1 };
  };
  const a = parse(start);
  const b = parse(end);
  if (!a || !b) return [];
  const keys: string[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row += 1) {
    for (let col = Math.min(a.column, b.column); col <= Math.max(a.column, b.column); col += 1) keys.push(`${colName(col)}${row + 1}`);
  }
  return keys;
};

const evaluateFormula = (formula: string, cells: Record<string, ExcelCell>, depth = 0): string => {
  if (!formula.startsWith('=') || depth > 8) return formula;
  const source = formula.slice(1).trim().toUpperCase();
  const fn = source.match(/^(SUM|AVERAGE|AVG|MIN|MAX)\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (fn) {
    const values = cellRange(fn[2], fn[3]).map((key) => {
      const cell = cells[key];
      const value = cell?.formula ? evaluateFormula(cell.formula, cells, depth + 1) : cell?.value;
      return numeric(value);
    });
    const operation = fn[1];
    const result = operation === 'SUM' ? values.reduce((sum, value) => sum + value, 0)
      : operation === 'MIN' ? Math.min(...values)
        : operation === 'MAX' ? Math.max(...values)
          : values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    return String(Number(result.toFixed(6)));
  }

  try {
    const replaced = source.replace(/\b([A-Z]+\d+)\b/g, (key) => {
      const cell = cells[key];
      const value = cell?.formula ? evaluateFormula(cell.formula, cells, depth + 1) : cell?.value;
      return String(numeric(value));
    });
    if (!/^[\d+\-*/().\s]+$/.test(replaced)) return '#FÓRMULA?';
    const result = Function(`"use strict"; return (${replaced})`)();
    return Number.isFinite(result) ? String(Number(Number(result).toFixed(6))) : '#ERRO!';
  } catch {
    return '#ERRO!';
  }
};

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_spreadsheet_v2_${project.id}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Nova planilha');
  const [workbook, setWorkbook] = useState<WorkbookState>(() => {
    try {
      const local = localStorage.getItem(storageKey);
      if (local) return JSON.parse(local).workbook || defaultWorkbook();
      if (project.content && typeof project.content === 'object' && Array.isArray((project.content as any).sheets)) return project.content as WorkbookState;
    } catch { /* use default */ }
    return defaultWorkbook();
  });
  const [activeCell, setActiveCell] = useState('A1');
  const [formulaInput, setFormulaInput] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const sheet = workbook.sheets.find((item) => item.id === workbook.activeSheetId) || workbook.sheets[0];
  const selectedCell = sheet?.cells[activeCell] || { value: '' };

  useEffect(() => {
    setFormulaInput(selectedCell.formula || selectedCell.value || '');
  }, [activeCell, workbook.activeSheetId]);

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
    }, 700);
    return () => window.clearTimeout(timer);
  }, [workbook, title, project.id]);

  const updateSheet = (updater: (sheet: SheetState) => SheetState) => {
    setWorkbook((current) => ({ ...current, sheets: current.sheets.map((item) => item.id === current.activeSheetId ? updater(item) : item) }));
  };

  const setCell = (key: string, rawValue: string) => {
    updateSheet((current) => {
      const previous = current.cells[key] || { value: '' };
      const isFormula = rawValue.startsWith('=');
      return {
        ...current,
        cells: {
          ...current.cells,
          [key]: { ...previous, value: isFormula ? evaluateFormula(rawValue, current.cells) : rawValue, formula: isFormula ? rawValue : undefined },
        },
      };
    });
  };

  const commitFormula = () => setCell(activeCell, formulaInput);

  const styleCell = (patch: Partial<ExcelCell>) => {
    updateSheet((current) => ({
      ...current,
      cells: { ...current.cells, [activeCell]: { ...(current.cells[activeCell] || { value: '' }), ...patch } },
    }));
  };

  const importWorkbook = async (file?: File) => {
    if (!file) return;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const loaded = extension === 'csv' ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true });
      const sheets: SheetState[] = loaded.SheetNames.map((name) => {
        const worksheet = loaded.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: '' });
        const state = createSheet(name);
        state.rows = Math.max(DEFAULT_ROWS, rows.length + 10);
        state.cols = Math.max(DEFAULT_COLS, Math.max(0, ...rows.map((row) => row.length)) + 3);
        rows.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
          const key = `${colName(colIndex)}${rowIndex + 1}`;
          const source = worksheet[key];
          state.cells[key] = { value: String(value ?? ''), formula: source?.f ? `=${source.f}` : undefined };
        }));
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

  const toSheetArray = (source: SheetState) => {
    const data: any[][] = [];
    for (let row = 0; row < source.rows; row += 1) {
      const values: any[] = [];
      for (let col = 0; col < source.cols; col += 1) {
        const cell = source.cells[`${colName(col)}${row + 1}`];
        values.push(cell?.formula || cell?.value || '');
      }
      data.push(values);
    }
    while (data.length && data[data.length - 1].every((value) => value === '')) data.pop();
    return data;
  };

  const exportWorkbook = async (format: 'xlsx' | 'csv' | 'pdf' | 'html') => {
    const base = title.replace(/\.(xlsx|xls|csv|pdf|html)$/i, '').replace(/[<>:"/\\|?*]/g, '_') || 'Planilha';
    try {
      if (format === 'xlsx') {
        const output = XLSX.utils.book_new();
        workbook.sheets.forEach((source) => XLSX.utils.book_append_sheet(output, XLSX.utils.aoa_to_sheet(toSheetArray(source)), source.name.slice(0, 31)));
        const bytes = XLSX.write(output, { type: 'array', bookType: 'xlsx' });
        saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`);
      } else if (format === 'csv') {
        const worksheet = XLSX.utils.aoa_to_sheet(toSheetArray(sheet));
        saveAs(new Blob(['\ufeff', XLSX.utils.sheet_to_csv(worksheet)], { type: 'text/csv;charset=utf-8' }), `${base}_${sheet.name}.csv`);
      } else if (format === 'html') {
        const worksheet = XLSX.utils.aoa_to_sheet(toSheetArray(sheet));
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${base}</title><style>table{border-collapse:collapse;font-family:Arial}td,th{border:1px solid #cbd5e1;padding:6px 8px}</style></head><body><h1>${base}</h1>${XLSX.utils.sheet_to_html(worksheet)}</body></html>`;
        saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      } else {
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: sheet.cols > 8 ? 'landscape' : 'portrait' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const rows = toSheetArray(sheet);
        pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); pdf.text(base, margin, 12);
        pdf.setFontSize(7); pdf.setFont('courier', 'normal');
        let y = 19;
        rows.forEach((row) => {
          const line = row.map((value) => String(value).slice(0, 24).padEnd(24)).join(' | ');
          const lines = pdf.splitTextToSize(line, pageWidth - margin * 2);
          if (y + lines.length * 3.5 > pdf.internal.pageSize.getHeight() - 10) { pdf.addPage(); y = 12; }
          pdf.text(lines, margin, y); y += lines.length * 3.5 + 1;
        });
        saveAs(pdf.output('blob'), `${base}.pdf`);
      }
      onSaveToHistory?.({ type: 'excel', title: base, summary: `${workbook.sheets.length} aba(s) exportada(s) como ${format.toUpperCase()}.`, details: XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(toSheetArray(sheet))), tags: ['Planilha', format.toUpperCase()] });
      showNotification(`Planilha exportada como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na exportação.', 'error');
    }
  };

  const addSheet = () => {
    const next = createSheet(`Planilha${workbook.sheets.length + 1}`);
    setWorkbook((current) => ({ sheets: [...current.sheets, next], activeSheetId: next.id }));
  };

  const deleteActiveSheet = () => {
    if (workbook.sheets.length === 1) return;
    const remaining = workbook.sheets.filter((item) => item.id !== workbook.activeSheetId);
    setWorkbook({ sheets: remaining, activeSheetId: remaining[0].id });
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
      await navigator.clipboard.writeText(answer).catch(() => {});
      showNotification('Análise concluída e copiada. Abra o Assistente IA para aprofundar.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na análise.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const chartValues = useMemo(() => {
    const values: Array<{ label: string; value: number }> = [];
    for (let row = 1; row <= Math.min(sheet.rows, 15); row += 1) {
      const label = sheet.cells[`A${row}`]?.value;
      const raw = sheet.cells[`B${row}`]?.formula ? evaluateFormula(sheet.cells[`B${row}`].formula!, sheet.cells) : sheet.cells[`B${row}`]?.value;
      const value = numeric(raw);
      if (label && value) values.push({ label: String(label), value });
    }
    return values.slice(0, 10);
  }, [sheet]);
  const chartMax = Math.max(1, ...chartValues.map((item) => Math.abs(item.value)));

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { importWorkbook(event.target.files?.[0]); event.target.value = ''; }} />
        <button onClick={() => inputRef.current?.click()} className="h-8 px-2.5 rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Importar</button>
        <div className="relative group"><button className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['xlsx','csv','pdf','html'] as const).map((format) => <button key={format} onClick={() => exportWorkbook(format)} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
      </div>

      <div className="px-2 sm:px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto">
        <ToolbarButton title="Negrito" onClick={() => styleCell({ bold: !selectedCell.bold })}><Bold /></ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => styleCell({ italic: !selectedCell.italic })}><Italic /></ToolbarButton>
        <ToolbarButton title="Alinhar à esquerda" onClick={() => styleCell({ align: 'left' })}><AlignLeft /></ToolbarButton>
        <ToolbarButton title="Centralizar" onClick={() => styleCell({ align: 'center' })}><AlignCenter /></ToolbarButton>
        <ToolbarButton title="Alinhar à direita" onClick={() => styleCell({ align: 'right' })}><AlignRight /></ToolbarButton>
        <label title="Cor da célula" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"><input type="color" defaultValue="#ffffff" className="w-5 h-5" onChange={(event) => styleCell({ bgColor: event.target.value })} /></label>
        <label title="Cor do texto" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"><input type="color" defaultValue="#111827" className="w-5 h-5" onChange={(event) => styleCell({ textColor: event.target.value })} /></label>
        <button disabled={aiBusy} onClick={runAiAnalysis} className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" /> {aiBusy ? 'Analisando…' : 'Analisar com IA'}</button>
        <button onClick={() => setShowChart((value) => !value)} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><ChartBar className="w-3.5 h-3.5" /> Gráfico rápido</button>
        <div className="ml-auto text-[10px] text-slate-400">{activeCell}</div>
      </div>

      <div className="h-10 border-b border-slate-200 dark:border-slate-800 flex items-center px-2 bg-slate-50 dark:bg-slate-950/40">
        <div className="w-14 text-center text-[10px] font-black text-slate-500">fx</div>
        <input value={formulaInput} onChange={(event) => setFormulaInput(event.target.value)} onBlur={commitFormula} onKeyDown={(event) => { if (event.key === 'Enter') { commitFormula(); (event.target as HTMLInputElement).blur(); } }} className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-mono outline-none focus:border-emerald-500" placeholder="Valor ou fórmula, ex.: =SUM(B2:B10)" />
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="border-collapse text-xs min-w-max">
            <thead className="sticky top-0 z-10"><tr><th className="sticky left-0 z-20 w-12 min-w-12 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"></th>{Array.from({ length: sheet.cols }, (_, col) => <th key={col} className="w-28 min-w-28 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500">{colName(col)}</th>)}</tr></thead>
            <tbody>{Array.from({ length: sheet.rows }, (_, row) => <tr key={row}><th className="sticky left-0 z-[5] w-12 min-w-12 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500">{row + 1}</th>{Array.from({ length: sheet.cols }, (_, col) => { const key = `${colName(col)}${row + 1}`; const cell = sheet.cells[key] || { value: '' }; const displayed = cell.formula ? evaluateFormula(cell.formula, sheet.cells) : cell.value; const selected = activeCell === key; return <td key={key} onClick={() => setActiveCell(key)} className={`relative w-28 min-w-28 h-8 border ${selected ? 'border-emerald-500 ring-1 ring-inset ring-emerald-500 z-[3]' : 'border-slate-200 dark:border-slate-800'}`} style={{ backgroundColor: cell.bgColor || undefined, color: cell.textColor || undefined, fontWeight: cell.bold ? 700 : 400, fontStyle: cell.italic ? 'italic' : 'normal', textAlign: cell.align || 'left' }}><input value={String(displayed ?? '')} onFocus={() => { setActiveCell(key); setFormulaInput(cell.formula || cell.value || ''); }} onChange={(event) => { const raw = event.target.value; updateSheet((current) => ({ ...current, cells: { ...current.cells, [key]: { ...(current.cells[key] || { value: '' }), value: raw, formula: undefined } } })); setFormulaInput(raw); }} className="w-full h-full bg-transparent px-1.5 outline-none text-[11px]" /></td>; })}</tr>)}</tbody>
          </table>
        </div>

        {showChart && <aside className="w-[300px] hidden lg:flex shrink-0 border-l border-slate-200 dark:border-slate-800 p-4 flex-col"><div className="flex items-center justify-between"><h3 className="text-xs font-black">Gráfico rápido A:B</h3><button onClick={() => setShowChart(false)} className="text-slate-400">×</button></div>{chartValues.length ? <div className="mt-5 flex-1 space-y-3 overflow-y-auto">{chartValues.map((item) => <div key={item.label}><div className="flex justify-between gap-2 text-[10px]"><span className="truncate">{item.label}</span><strong>{item.value}</strong></div><div className="mt-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(2, Math.abs(item.value) / chartMax * 100)}%` }} /></div></div>)}</div> : <div className="flex-1 flex items-center justify-center text-center text-[10px] text-slate-400">Preencha rótulos na coluna A e números na coluna B.</div>}</aside>}
      </div>

      <div className="h-10 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center px-2 gap-1 overflow-x-auto">
        {workbook.sheets.map((item) => <button key={item.id} onClick={() => { setWorkbook((current) => ({ ...current, activeSheetId: item.id })); setActiveCell('A1'); }} className={`h-8 px-3 rounded-lg text-[10px] font-bold whitespace-nowrap ${item.id === workbook.activeSheetId ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:bg-white/70 dark:hover:bg-slate-800/60'}`}>{item.name}</button>)}
        <button onClick={addSheet} className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
        {workbook.sheets.length > 1 && <button onClick={deleteActiveSheet} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center"><Trash className="w-4 h-4" /></button>}
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ title: string; onClick: () => void; children: React.ReactElement }> = ({ title, onClick, children }) => (
  <button title={title} onClick={onClick} className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">{children}</button>
);
