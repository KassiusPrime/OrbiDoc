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
  engineProvider?: string;
  engineModel?: string;
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

  // Apply Auto-Sum formula to the current active cell
  const applyAutoSum = () => {
    if (!activeCellKey) return;
    const colMatch = activeCellKey.match(/[A-Z]+/)?.[0] || 'A';
    const rowMatch = parseInt(activeCellKey.match(/[0-9]+/)?.[0] || '1', 10);

    if (rowMatch > 1) {
      const startCell = `${colMatch}1`;
      const endCell = `${colMatch}${rowMatch - 1}`;
      const autoFormula = `=SUM(${startCell}:${endCell})`;
      handleCellChange(activeCellKey, autoFormula);
      showNotification(`Fórmula de auto-soma ${autoFormula} inserida em ${activeCellKey}`, 'success');
    } else {
      showNotification('Selecione uma célula abaixo dos seus dados para aplicar a Auto-Soma.', 'error');
    }
  };

  // Format active grid as table with themes
  const formatAsTable = (theme: 'emerald' | 'blue' | 'slate' | 'purple') => {
    const themeColors = {
      emerald: { header: '#059669', headerText: '#ffffff', zebra: '#ecfdf5', altZebra: '#ffffff' },
      blue: { header: '#2563eb', headerText: '#ffffff', zebra: '#eff6ff', altZebra: '#ffffff' },
      slate: { header: '#334155', headerText: '#ffffff', zebra: '#f8fafc', altZebra: '#ffffff' },
      purple: { header: '#7c3aed', headerText: '#ffffff', zebra: '#faf5ff', altZebra: '#ffffff' },
    }[theme];

    setGridData(prev => {
      const updated = { ...prev };
      // Format top row (1)
      cols.forEach(c => {
        const k = `${c}1`;
        updated[k] = {
          ...(updated[k] || { value: '' }),
          bold: true,
          bgColor: themeColors.header,
          textColor: themeColors.headerText,
          align: 'center',
        };
      });

      // Format data rows with zebra stripes
      for (let r = 2; r <= Math.min(rowCount, 10); r++) {
        cols.forEach(c => {
          const k = `${c}${r}`;
          updated[k] = {
            ...(updated[k] || { value: '' }),
            bgColor: r % 2 === 0 ? themeColors.zebra : themeColors.altZebra,
          };
        });
      }

      return updated;
    });

    showNotification(`Tabela formatada com o tema ${theme.toUpperCase()}!`, 'success');
  };

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

  const setCellTextColor = (color: string) => {
    if (!activeCellKey) return;
    setGridData(prev => ({
      ...prev,
      [activeCellKey]: { ...(prev[activeCellKey] || {}), textColor: color }
    }));
  };

  const setCellFontFamily = (font: string) => {
    if (!activeCellKey) return;
    setGridData(prev => ({
      ...prev,
      [activeCellKey]: { ...(prev[activeCellKey] || {}), fontFamily: font }
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2 flex-wrap">
          <button
            onClick={toggleBold}
            className={`p-2 rounded-lg text-xs font-bold ${
              gridData[activeCellKey]?.bold ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </button>

          {/* Font Selector */}
          <select
            value={gridData[activeCellKey]?.fontFamily || 'font-sans'}
            onChange={(e) => setCellFontFamily(e.target.value)}
            className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-transparent outline-none"
            title="Fonte da célula"
          >
            <option value="font-calibri">Calibri</option>
            <option value="font-league-spartan">League Spartan</option>
            <option value="font-arial">Arial</option>
            <option value="font-times">Times New Roman</option>
            <option value="font-sans">Sans-serif</option>
            <option value="font-serif">Serif</option>
            <option value="font-mono">Monospaced</option>
          </select>

          {/* Auto-Sum Button */}
          <button
            onClick={applyAutoSum}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-emerald-200"
            title="Auto-Soma de valores superiores"
          >
            <Calculator className="w-3.5 h-3.5" />
            Auto-Soma
          </button>

          {/* Format as Table Themes */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Tabela:</span>
            {[
              { id: 'emerald', label: 'Verde', bg: 'bg-emerald-600' },
              { id: 'blue', label: 'Azul', bg: 'bg-blue-600' },
              { id: 'slate', label: 'Cinza', bg: 'bg-slate-700' },
              { id: 'purple', label: 'Roxo', bg: 'bg-purple-600' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => formatAsTable(t.id as any)}
                className={`w-4 h-4 rounded-full ${t.bg} hover:scale-125 transition-transform`}
                title={`Formatar como tabela (${t.label})`}
              />
            ))}
          </div>

          {/* Background & Text Colors */}
          <div className="flex items-center gap-1 ml-1">
            <span className="text-[10px] font-bold text-slate-400">Fundo:</span>
            {['#ffffff', '#e0f2fe', '#dcfce7', '#fef08a', '#f3e8ff'].map(c => (
              <button
                key={c}
                onClick={() => setCellColor(c)}
                className="w-4 h-4 rounded-md border border-slate-300"
                style={{ backgroundColor: c }}
                title="Cor de fundo"
              />
            ))}
          </div>

          <div className="flex items-center gap-1 ml-1">
            <span className="text-[10px] font-bold text-slate-400">Texto:</span>
            {['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#7c3aed'].map(tc => (
              <button
                key={tc}
                onClick={() => setCellTextColor(tc)}
                className="w-4 h-4 rounded-md border border-slate-300 font-bold text-[9px] flex items-center justify-center"
                style={{ backgroundColor: tc, color: '#ffffff' }}
                title="Cor do texto"
              >
                A
              </button>
            ))}
          </div>
        </div>

        {/* Active Cell Formula Input */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
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
                          style={{ color: cellData.textColor || 'inherit' }}
                          className={`w-full py-2 px-3 bg-transparent border-none outline-none ${
                            cellData.fontFamily || 'font-sans'
                          } ${
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
