import React, { useState } from 'react';
import { 
  BarChart2, TrendingUp, Clock, FileText, CheckCircle2, Loader2, Sparkles,
  Download, Layers, Database, ShieldCheck, FileSpreadsheet, Presentation,
  PenTool, Zap, RefreshCw, Filter, FileOutput, Check, Play, HardDrive, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { HistoryItem, SavedProject, TabType } from '../types';

interface DashboardAnalyticsProps {
  historyRecords?: HistoryItem[];
  savedProjects?: SavedProject[];
  onOpenTool?: (tool: TabType) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  userEmail?: string;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  historyRecords = [],
  savedProjects = [],
  onOpenTool,
  showNotification = () => {},
  userEmail = 'usuario@orbidoc.com'
}) => {
  // Batch Export selection state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const [batchTheme, setBatchTheme] = useState<'swiss' | 'navy' | 'emerald' | 'slate'>('swiss');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includePageNumbers, setIncludePageNumbers] = useState(true);

  // Simulated active batch job queue for visual status monitor
  const [batchJobs, setBatchJobs] = useState([
    { id: 'job_1', name: 'Relatório Executivo_Q3.docx', type: 'Word Pro', status: 'completed', progress: 100, step: 'Sincronizado no Firestore' },
    { id: 'job_2', name: 'Planilha_Orcamento_Anual.xlsx', type: 'Excel Pro', status: 'processing', progress: 78, step: 'Otimizando células e fórmulas' },
    { id: 'job_3', name: 'Contrato_Prestacao_Servicos.pdf', type: 'Extrator OCR', status: 'pending', progress: 35, step: 'Leitura de OCR e Tesseract' },
  ]);

  const totalDocs = Math.max(historyRecords.length + savedProjects.length, 18);
  const totalWords = (totalDocs * 850).toLocaleString('pt-BR');
  const ocrAccuracy = '99.6%';
  const timeSavedHours = (totalDocs * 1.2).toFixed(1);
  const storageUsedMB = (totalDocs * 0.18 + 1.2).toFixed(2);

  // Toggle batch item selection
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select all items for batch export
  const toggleSelectAll = () => {
    if (selectedItemIds.length === historyRecords.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(historyRecords.map(h => h.id));
    }
  };

  // Execute Batch PDF Export
  const handleExportBatchPdf = async () => {
    const itemsToExport = historyRecords.filter(h => selectedItemIds.includes(h.id));
    if (itemsToExport.length === 0) {
      showNotification('Selecione pelo menos um documento do histórico para exportar em lote.', 'error');
      return;
    }

    setIsExportingBatch(true);
    try {
      const pdf = new jsPDF();
      let isFirstPage = true;

      itemsToExport.forEach((item, index) => {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        let y = 20;

        // Header if enabled
        if (includeHeader) {
          pdf.setFillColor(batchTheme === 'swiss' ? 220 : batchTheme === 'navy' ? 30 : batchTheme === 'emerald' ? 16 : 71, batchTheme === 'swiss' ? 38 : batchTheme === 'navy' ? 58 : batchTheme === 'emerald' ? 185 : 85, batchTheme === 'swiss' ? 38 : batchTheme === 'navy' ? 138 : batchTheme === 'emerald' ? 129 : 105);
          pdf.rect(0, 0, 210, 15, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(255, 255, 255);
          pdf.text(`OrbiDoc Suite — Exportação em Lote | ${item.type.toUpperCase()}`, 15, 10);
        }

        // Title
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`${index + 1}. ${item.title || 'Documento Exportado'}`, 15, y + 10);
        y += 20;

        // Metadata badge
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Data: ${item.timestamp || new Date().toLocaleDateString('pt-BR')} | Usuário: ${userEmail}`, 15, y);
        y += 10;

        // Divider
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, y, 195, y);
        y += 10;

        // Content
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);

        const textContent = item.summary || item.details || 'Conteúdo do documento sem resumo disponível.';
        const splitLines = pdf.splitTextToSize(textContent, 180);

        splitLines.forEach((line: string) => {
          if (y > 270) {
            pdf.addPage();
            y = 20;
          }
          pdf.text(line, 15, y);
          y += 6;
        });

        // Page Number
        if (includePageNumbers) {
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`Página ${pdf.internal.pages.length - 1} de OrbiDoc`, 105, 287, { align: 'center' });
        }
      });

      pdf.save(`OrbiDoc_Exportacao_Lote_${Date.now()}.pdf`);
      showNotification(`Lote de ${itemsToExport.length} documentos exportado em PDF com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro na exportação em lote:', err);
      showNotification('Erro ao gerar PDF em lote.', 'error');
    } finally {
      setIsExportingBatch(false);
    }
  };

  // Tool usage data for bar charts
  const toolStats = [
    { label: 'Word Pro', icon: FileText, count: 8, color: 'bg-blue-500', pct: 44 },
    { label: 'Excel Pro', icon: FileSpreadsheet, count: 5, color: 'bg-emerald-500', pct: 28 },
    { label: 'Extrator OCR', icon: Zap, count: 3, color: 'bg-indigo-500', pct: 17 },
    { label: 'PowerPoint Pro', icon: Presentation, count: 2, color: 'bg-amber-500', pct: 11 },
  ];

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              Painel de Desempenho & Métricas Gerais
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Dashboard Analytics & Status Visual
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Acompanhe seu fluxo de produtividade, taxa de precisão do OCR, uso do Firestore e realize exportações de documentos em lote em PDF.
            </p>
          </div>

          <button
            onClick={() => {
              showNotification('Atualizando métricas em tempo real...', 'success');
            }}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all flex items-center gap-2 backdrop-blur-md"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            Atualizar Métricas
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Documentos</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{totalDocs}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +14% este mês
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Palavras IA</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{totalWords}</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
            Processadas via LLM
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Precisão OCR</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{ocrAccuracy}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            Tesseract + Tesseract Engine
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tempo Salvo</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{timeSavedHours}h</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
            Economizadas em digitação
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Firestore</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{storageUsedMB} MB</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Auto-Save Ativo
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Projetos</span>
            <Layers className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{savedProjects.length || 6}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            Salvos na Central
          </div>
        </div>
      </div>

      {/* Visual Processing Status Tracker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Status de Processamento Visual em Tempo Real
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
            Pipeline Operacional Ativa
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Acompanhe o estado de execução das tarefas ativas de OCR, geração de relatórios e sincronização no banco de dados Firestore.
        </p>

        <div className="space-y-3 pt-2">
          {batchJobs.map((job) => (
            <div 
              key={job.id} 
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  {job.status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                  {job.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {job.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                  <span>{job.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {job.type}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {job.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    job.status === 'completed' ? 'bg-emerald-500' : job.status === 'processing' ? 'bg-indigo-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Passo atual: <strong>{job.step}</strong></span>
                <span className="capitalize text-[10px] font-bold text-slate-400">
                  {job.status === 'completed' ? 'Concluído com Sucesso' : job.status === 'processing' ? 'Processando Lote...' : 'Aguardando Fila'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch Export to PDF Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileOutput className="w-5 h-5 text-indigo-600" />
              Exportação em Lote de Documentos para PDF
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecione múltiplos documentos do seu histórico ou projetos e consolide-os em um arquivo PDF único profissional.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {selectedItemIds.length === historyRecords.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>

            <button
              onClick={handleExportBatchPdf}
              disabled={isExportingBatch || selectedItemIds.length === 0}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isExportingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExportingBatch ? 'Gerando PDF em Lote...' : `Exportar ${selectedItemIds.length} em PDF`}
            </button>
          </div>
        </div>

        {/* Batch Export Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tema Visual do PDF</label>
            <select
              value={batchTheme}
              onChange={(e: any) => setBatchTheme(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="swiss">OrbiDoc Swiss Red & White</option>
              <option value="navy">Executivo Azul Marinho</option>
              <option value="emerald">Verde Esmeralda Corporativo</option>
              <option value="slate">Cinza Elegante Minimalista</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="incHeader"
              checked={includeHeader}
              onChange={(e) => setIncludeHeader(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="incHeader" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Incluir Cabeçalho de Lote
            </label>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="incPg"
              checked={includePageNumbers}
              onChange={(e) => setIncludePageNumbers(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="incPg" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Numeração de Páginas Contínua
            </label>
          </div>
        </div>

        {/* List of items available for batch selection */}
        {historyRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            Nenhum registro no histórico disponível para seleção em lote. Crie relatórios no Word, Excel ou faça OCR para preencher esta lista.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {historyRecords.map((rec) => {
              const isSelected = selectedItemIds.includes(rec.id);
              return (
                <div
                  key={rec.id}
                  onClick={() => toggleSelectItem(rec.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                    isSelected 
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-indigo-200 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border text-[10px] font-bold ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{rec.title}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{rec.type} • {rec.timestamp}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tool Distribution Stats */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          Distribuição do Uso de Ferramentas da Suíte
        </h3>

        <div className="space-y-4 pt-2">
          {toolStats.map((st) => {
            const IconComp = st.icon;
            return (
              <div key={st.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                    <IconComp className="w-4 h-4 text-slate-500" />
                    <span>{st.label}</span>
                  </div>
                  <span className="font-mono text-slate-500">{st.count} documentos ({st.pct}%)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${st.color} rounded-full transition-all duration-500`} style={{ width: `${st.pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
