import React, { useState, useMemo } from 'react';
import { 
  Grid, Plus, Trash2, Download, FileSpreadsheet, Sparkles, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, BarChart2, Calculator, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as xlsx from 'xlsx';
import { saveAs } from 'file-saver';
import { ExcelCell, HistoryItem } from '../types';

interface ExcelSpreadsheetProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

const DEFAULT_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const INITIAL_ROWS_COUNT = 15;

export const ExcelSpreadsheet: React.FC<ExcelSpreadsheetProps> = ({
  onSaveToHistory,
  showNotification = () => {},
}) => {
  const [sheetTitle, setSheetTitle] = useState('Planilha_Financeira.xlsx');
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS);
  const [rowCount, setRowCount] = useState<number>(INITIAL_ROWS_COUNT);

  // Grid Data: key is "A1", "B2" etc.
  const [gridData, setGridData] = useState<Record<string, ExcelCell>>(() => {
    return {
      A1: { value: 'Item / Categoria', bold: true, bgColor: '#e0f2fe' },
      B1: { value: 'Janeiro', bold: true, bgColor: '#e0f2fe', align: 'center' },
      C1: { value: 'Fevereiro', bold: true, bgColor: '#e0f2fe', align: 'center' },
      D1: { value: 'Março', bold: true, bgColor: '#e0f2fe', align: 'center' },
      E1: { value: 'Total Trimestre', bold: true, bgColor: '#bae6fd', align: 'center' },

      A2: { value: 'Receita de Vendas' },
      B2: { value: '15000' },
      C2: { value: '18500' },
      D2: { value: '21000' },
      E2: { value: '=SUM(B2:D2)', bold: true },

      A3: { value: 'Serviços Prestados' },
      B3: { value: '8200' },
      C3: { value: '9400' },
      D3: { value: '10500' },
      E3: { value: '=SUM(B3:D3)', bold: true },

      A4: { value: 'Despesas Operacionais' },
      B4: { value: '-6500' },
      C4: { value: '-7100' },
      D4: { value: '-6800' },
      E4: { value: '=SUM(B4:D4)', bold: true },

      A5: { value: 'Resultado Líquido', bold: true, bgColor: '#fef08a' },
      B5: { value: '=SUM(B2:B4)', bold: true },
      C5: { value: '=SUM(C2:C4)', bold: true },
      D5: { value: '=SUM(D2:D4)', bold: true },
      E5: { value: '=SUM(E2:E4)', bold: true, bgColor: '#fde047' },
    };
  });

  const [activeCellKey, setActiveCellKey] = useState<string>('A1');
  const [editingFormula, setEditingFormula] = useState<string>('');
  const [showChartModal, setShowChartModal] = useState(false);

  // Evaluate cell value or formula
  const evaluateCell = (key: string, data: Record<string, ExcelCell>, visited = new Set<string>()): string => {
    const cell = data[key];
    if (!cell) return '';
    const raw = cell.value || '';

    if (!raw.startsWith('=')) {
      return raw;
    }

    if (visited.has(key)) return '#CIRCULAR!';
    visited.add(key);

    const formula = raw.substring(1).toUpperCase().trim();

    // =SUM(B2:D2) or =SUM(B2:B4)
    const sumMatch = formula.match(/^SUM\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/);
    if (sumMatch) {
      const [, start, end] = sumMatch;
      const values = getRangeValues(start, end, data, visited);
      const sum = values.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
      return sum.toLocaleString('pt-BR');
    }

    // =AVERAGE(B2:D2)
    const avgMatch = formula.match(/^(AVERAGE|AVG)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/);
    if (avgMatch) {
      const [, , start, end] = avgMatch;
      const values = getRangeValues(start, end, data, visited);
      if (values.length === 0) return '0';
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return avg.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }

    // =MAX(B2:D2)
    const maxMatch = formula.match(/^MAX\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/);
    if (maxMatch) {
      const [, start, end] = maxMatch;
      const values = getRangeValues(start, end, data, visited);
      return Math.max(...values, 0).toLocaleString('pt-BR');
    }

    // =MIN(B2:D2)
    const minMatch = formula.match(/^MIN\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/);
    if (minMatch) {
      const [, start, end] = minMatch;
      const values = getRangeValues(start, end, data, visited);
      return Math.min(...values).toLocaleString('pt-BR');
    }

    return raw;
  };

  const getRangeValues = (start: string, end: string, data: Record<string, ExcelCell>, visited: Set<string>): number[] => {
    const startCol = start.match(/[A-Z]+/)?.[0] || 'A';
    const startRow = parseInt(start.match(/[0-9]+/)?.[0] || '1', 10);
    const endCol = end.match(/[A-Z]+/)?.[0] || 'A';
    const endRow = parseInt(end.match(/[0-9]+/)?.[0] || '1', 10);

    const startColIdx = cols.indexOf(startCol);
    const endColIdx = cols.indexOf(endCol);

    const values: number[] = [];

    for (let c = Math.min(startColIdx, endColIdx); c <= Math.max(startColIdx, endColIdx); c++) {
      for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
        const k = `${cols[c]}${r}`;
        const valStr = evaluateCell(k, data, new Set(visited));
        const num = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(num)) values.push(num);
      }
    }
    return values;
  };

  const handleCellChange = (key: string, val: string) => {
    setGridData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), value: val }
    }));
  };

  const toggleBold = () => {
    if (!activeCellKey) return;
    setGridData(prev => ({
      ...prev,
      [activeCellKey]: { ...(prev[activeCellKey] || {}), bold: !prev[activeCellKey]?.bold }
    }));
  };

  const setCellColor = (color: string) => {
    if (!activeCellKey) return;
    setGridData(prev => ({
      ...prev,
      [activeCellKey]: { ...(prev[activeCellKey] || {}), bgColor: color }
    }));
  };

  const addRow = () => setRowCount(r => r + 1);
  const addCol = () => {
    const lastCol = cols[cols.length - 1];
    const nextChar = String.fromCharCode(lastCol.charCodeAt(0) + 1);
    if (nextChar <= 'Z') setCols(c => [...c, nextChar]);
  };

  const exportXlsx = () => {
    const wsData: any[][] = [];
    for (let r = 1; r <= rowCount; r++) {
      const rowArr: any[] = [];
      for (let c = 0; c < cols.length; c++) {
        const k = `${cols[c]}${r}`;
        rowArr.push(evaluateCell(k, gridData));
      }
      wsData.push(rowArr);
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Planilha');
    const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });

    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), sheetTitle.endsWith('.xlsx') ? sheetTitle : `${sheetTitle}.xlsx`);
    showNotification('Planilha Excel exportada com sucesso!', 'success');

    if (onSaveToHistory) {
      onSaveToHistory({
        type: 'excel',
        title: sheetTitle,
        summary: `Planilha com ${rowCount} linhas e ${cols.length} colunas exportada para Excel.`,
      });
    }
  };

  const exportCsv = () => {
    let csv = '';
    for (let r = 1; r <= rowCount; r++) {
      const rowArr: string[] = [];
      for (let c = 0; c < cols.length; c++) {
        const k = `${cols[c]}${r}`;
        rowArr.push(`"${evaluateCell(k, gridData).replace(/"/g, '""')}"`);
      }
      csv += rowArr.join(',') + '\n';
    }
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), sheetTitle.replace('.xlsx', '.csv'));
    showNotification('CSV exportado!', 'success');
  };

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const list: { name: string; val1: number; val2: number }[] = [];
    for (let r = 2; r <= 8; r++) {
      const name = evaluateCell(`A${r}`, gridData);
      const val1Str = evaluateCell(`B${r}`, gridData);
      const val2Str = evaluateCell(`C${r}`, gridData);
      const num1 = parseFloat(val1Str.replace(/\./g, '').replace(',', '.'));
      const num2 = parseFloat(val2Str.replace(/\./g, '').replace(',', '.'));
      if (name && (!isNaN(num1) || !isNaN(num2))) {
        list.push({ name, val1: isNaN(num1) ? 0 : num1, val2: isNaN(num2) ? 0 : num2 });
      }
    }
    return list;
  }, [gridData]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
            X
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={sheetTitle}
              onChange={(e) => setSheetTitle(e.target.value)}
              className="text-base font-bold text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent focus:border-emerald-400 px-2 py-0.5 rounded-lg outline-none w-full"
            />
            <p className="text-xs text-slate-500 px-2">
              {rowCount} Linhas • {cols.length} Colunas • Suporte a Fórmulas (=SUM, =AVERAGE)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowChartModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-semibold hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <BarChart2 className="w-4 h-4" />
            Gerar Gráfico
          </button>

          <button
            onClick={addRow}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Linha
          </button>

          <button
            onClick={addCol}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Coluna
          </button>

          <button
            onClick={exportXlsx}
            className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar XLSX
          </button>

          <button
            onClick={exportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Toolbar & Formula Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <button
            onClick={toggleBold}
            className={`p-2 rounded-lg text-xs font-bold ${
              gridData[activeCellKey]?.bold ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </button>

          <div className="flex gap-1 ml-1">
            {['#ffffff', '#e0f2fe', '#dcfce7', '#fef08a', '#f3e8ff'].map(c => (
              <button
                key={c}
                onClick={() => setCellColor(c)}
                className="w-5 h-5 rounded-md border border-slate-300"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Active Cell Formula Input */}
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            {activeCellKey}
          </span>
          <span className="text-slate-400 font-serif italic text-xs">f(x) =</span>
          <input
            type="text"
            value={gridData[activeCellKey]?.value || ''}
            onChange={(e) => handleCellChange(activeCellKey, e.target.value)}
            placeholder="Digite um número, texto ou fórmula como =SUM(B2:D2)..."
            className="w-full bg-transparent border-none outline-none text-xs text-slate-800 font-mono"
          />
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto max-h-[500px]">
        <table className="w-full border-collapse text-xs select-none">
          <thead>
            <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
              <th className="w-12 py-2 border-r border-slate-200 text-center font-semibold">#</th>
              {cols.map(c => (
                <th key={c} className="min-w-[120px] py-2 px-3 border-r border-slate-200 text-center font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, rIdx) => {
              const rowNum = rIdx + 1;
              return (
                <tr key={rowNum} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="bg-slate-100 text-slate-500 font-bold text-center border-r border-slate-200 py-1">
                    {rowNum}
                  </td>
                  {cols.map(col => {
                    const cellKey = `${col}${rowNum}`;
                    const cellData = gridData[cellKey] || {};
                    const displayVal = evaluateCell(cellKey, gridData);
                    const isActive = activeCellKey === cellKey;

                    return (
                      <td
                        key={cellKey}
                        onClick={() => setActiveCellKey(cellKey)}
                        style={{ backgroundColor: cellData.bgColor || '#ffffff' }}
                        className={`border-r border-slate-200 p-0 relative transition-all ${
                          isActive ? 'ring-2 ring-emerald-500 z-10' : ''
                        }`}
                      >
                        <input
                          type="text"
                          value={isActive ? cellData.value || '' : displayVal}
                          onChange={(e) => handleCellChange(cellKey, e.target.value)}
                          onFocus={() => setActiveCellKey(cellKey)}
                          className={`w-full py-2 px-3 bg-transparent border-none outline-none text-slate-800 font-sans ${
                            cellData.bold ? 'font-bold' : 'font-normal'
                          } ${
                            cellData.align === 'center' ? 'text-center' : cellData.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Chart Visualizer Modal */}
      <AnimatePresence>
        {showChartModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-xl w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-emerald-600" />
                  Visualizador de Gráfico
                </h3>
                <button onClick={() => setShowChartModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <p className="text-xs text-slate-500">Gráfico gerado a partir das séries de dados numéricos da planilha.</p>

              <div className="h-64 bg-slate-50 rounded-2xl p-4 flex items-end justify-around gap-2 border border-slate-200">
                {chartData.length === 0 ? (
                  <p className="text-xs text-slate-400 m-auto">Preencha colunas A e B com dados numéricos para visualizar o gráfico.</p>
                ) : (
                  chartData.map((d, idx) => {
                    const maxVal = Math.max(...chartData.map(x => Math.max(x.val1, x.val2)), 1);
                    const h1 = Math.min(100, Math.max(10, (d.val1 / maxVal) * 100));
                    const h2 = Math.min(100, Math.max(10, (d.val2 / maxVal) * 100));

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="flex items-end gap-1 w-full justify-center h-48">
                          <div
                            style={{ height: `${h1}%` }}
                            className="w-4 bg-emerald-500 rounded-t-md transition-all hover:bg-emerald-600"
                            title={`${d.name}: ${d.val1}`}
                          />
                          {d.val2 > 0 && (
                            <div
                              style={{ height: `${h2}%` }}
                              className="w-4 bg-blue-500 rounded-t-md transition-all hover:bg-blue-600"
                              title={`${d.name}: ${d.val2}`}
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-600 truncate max-w-[60px]">{d.name}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowChartModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
