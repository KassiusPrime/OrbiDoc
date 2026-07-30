import React, { useState } from 'react';
import { 
  IconDownload, IconX, IconFileText, IconCheck, IconArchive, 
  IconFileSpreadsheet, IconPresentation, IconPencil, IconLoader2,
  IconFolder, IconCircleCheck, IconLayersIntersect, IconSparkles, IconCloudDownload
} from '@tabler/icons-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { SavedProject, HistoryItem } from '../types';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: SavedProject[];
  historyItems?: HistoryItem[];
  showNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  isOpen,
  onClose,
  projects,
  historyItems = [],
  showNotification,
}) => {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    projects.map((p) => p.id)
  );
  const [exportFormat, setExportFormat] = useState<'zip' | 'merged_pdf'>('zip');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedProjectIds.length === projects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(projects.map((p) => p.id));
    }
  };

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRunBatchExport = async () => {
    const selected = projects.filter((p) => selectedProjectIds.includes(p.id));
    if (selected.length === 0) {
      showNotification('Selecione pelo menos um projeto para exportar.', 'error');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);

    try {
      if (exportFormat === 'zip') {
        const zip = new JSZip();
        const docsFolder = zip.folder('Documentos_DocPlus');

        selected.forEach((proj, i) => {
          const fileName = `${proj.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          const contentStr = proj.details || proj.summary || proj.previewSnippet || 'Sem conteúdo adicional.';
          if (proj.type === 'word') {
            docsFolder?.file(`${fileName}.txt`, contentStr);
          } else if (proj.type === 'excel') {
            docsFolder?.file(`${fileName}.csv`, proj.details || 'ID,Item,Valor\n1,Exemplo,100');
          } else if (proj.type === 'canva' || proj.type === 'powerpoint') {
            docsFolder?.file(`${fileName}_resumo.txt`, `${proj.title}\n\n${contentStr}`);
          } else {
            docsFolder?.file(`${fileName}.txt`, contentStr);
          }
          setExportProgress(Math.min(80, Math.round(((i + 1) / selected.length) * 70) + 10));
        });

        // Add index manifest
        const manifestContent = JSON.stringify(
          {
            exportDate: new Date().toISOString(),
            totalExported: selected.length,
            projects: selected.map((s) => ({ title: s.title, type: s.type, category: s.category })),
          },
          null,
          2
        );
        docsFolder?.file('manifesto_exportacao.json', manifestContent);

        setExportProgress(85);
        const content = await zip.generateAsync({ type: 'blob' });
        setExportProgress(100);
        saveAs(content, `DocPlus_Exportacao_Lote_${Date.now()}.zip`);
        showNotification(`${selected.length} projeto(s) exportado(s) em arquivo ZIP com sucesso!`, 'success');
      } else {
        // Merged PDF export
        const pdf = new jsPDF();
        let pageCount = 0;

        selected.forEach((proj, idx) => {
          if (pageCount > 0) {
            pdf.addPage();
          }
          pageCount++;

          // Document Header
          pdf.setFontSize(20);
          pdf.setTextColor(25, 118, 210);
          pdf.text(`Projeto #${idx + 1}: ${proj.title}`, 15, 20);

          pdf.setFontSize(10);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Tipo: ${proj.type.toUpperCase()} | Categoria: ${proj.category || 'Geral'} | Data: ${new Date(proj.updatedAt).toLocaleDateString('pt-BR')}`, 15, 28);

          pdf.setLineWidth(0.5);
          pdf.setDrawColor(203, 213, 225);
          pdf.line(15, 32, 195, 32);

          pdf.setFontSize(12);
          pdf.setTextColor(15, 23, 42);

          const bodyText = proj.details || proj.summary || 'Sem conteúdo adicional.';
          const lines = pdf.splitTextToSize(bodyText, 180);
          
          let yPos = 42;
          lines.forEach((line: string) => {
            if (yPos > 275) {
              pdf.addPage();
              yPos = 20;
            }
            pdf.text(line, 15, yPos);
            yPos += 7;
          });

          setExportProgress(Math.min(90, Math.round(((idx + 1) / selected.length) * 80) + 10));
        });

        setExportProgress(100);
        pdf.save(`DocPlus_Relatorio_Unificado_${Date.now()}.pdf`);
        showNotification(`Relatório PDF unificado com ${selected.length} documento(s) gerado!`, 'success');
      }

      setTimeout(() => {
        onClose();
        setExportProgress(0);
      }, 400);
    } catch (err: any) {
      console.error('Erro na exportação em lote:', err);
      showNotification('Erro ao processar exportação em lote.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <IconCloudDownload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Exportação em Lote
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  Batch Export
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Selecione múltiplos arquivos para baixar de uma só vez em arquivo ZIP ou PDF unificado.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Export Format Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setExportFormat('zip')}
            className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 ${
              exportFormat === 'zip'
                ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-xs">
              <IconArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h4 className="font-bold text-xs">Pacote ZIP (.zip)</h4>
              <p className="text-[10px] text-slate-500">Todos os arquivos separados em uma pasta compactada.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setExportFormat('merged_pdf')}
            className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 ${
              exportFormat === 'merged_pdf'
                ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-xs">
              <IconFileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h4 className="font-bold text-xs">PDF Unificado (.pdf)</h4>
              <p className="text-[10px] text-slate-500">Compilado com todos os documentos formatados.</p>
            </div>
          </button>
        </div>

        {/* Projects List & Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Projetos Disponíveis ({selectedProjectIds.length} de {projects.length} selecionados)
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
            >
              {selectedProjectIds.length === projects.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-950/30">
            {projects.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhum projeto salvo para exportar no momento.
              </p>
            ) : (
              projects.map((proj) => {
                const isChecked = selectedProjectIds.includes(proj.id);
                return (
                  <div
                    key={proj.id}
                    onClick={() => toggleProject(proj.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-800 shadow-xs'
                        : 'bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {isChecked && <IconCheck className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {proj.title}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {proj.type.toUpperCase()} • Categoria: {proj.category || 'Geral'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Export Progress Bar */}
        {isExporting && (
          <div className="space-y-1.5 p-3 bg-[#1976D2]/10 dark:bg-[#1E88E5]/10 border border-[#1976D2]/20 dark:border-[#1E88E5]/20 rounded-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-[#1976D2] dark:text-[#1E88E5]">
              <span>Processando exportação...</span>
              <span>{exportProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1976D2] dark:bg-[#1E88E5] transition-all duration-300 rounded-full"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRunBatchExport}
            disabled={isExporting || selectedProjectIds.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin" />
                Gerando Exportação...
              </>
            ) : (
              <>
                <IconDownload className="w-4 h-4" />
                Baixar {selectedProjectIds.length} Arquivo(s)
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
