import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { X, FileOutput, CloudUpload, Check, FileText, Settings, Eye, Palette, Sparkles, Loader2 } from 'lucide-react';
import { PdfExportOptions, GoogleUserProfile } from '../types';
import { cleanMarkdownForExport } from '../lib/cleanText';
import { uploadToGoogleDrive } from '../services/googleAuthDrive';

interface CustomPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  defaultTitle?: string;
  googleUser: GoogleUserProfile | null;
  onNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const CustomPdfExportModal: React.FC<CustomPdfExportModalProps> = ({
  isOpen,
  onClose,
  initialText,
  defaultTitle = 'Documento DocPlus+',
  googleUser,
  onNotification,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState(googleUser?.name || 'DocPlus+ User');
  const [fontFamily, setFontFamily] = useState<'helvetica' | 'times' | 'courier'>('helvetica');
  const [fontSize, setFontSize] = useState<number>(11);
  const [margin, setMargin] = useState<'narrow' | 'normal' | 'wide'>('normal');
  const [themeColor, setThemeColor] = useState<'indigo' | 'swiss-red' | 'emerald' | 'slate' | 'navy'>('indigo');
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [watermark, setWatermark] = useState('');
  const [lineSpacing, setLineSpacing] = useState(1.4);
  const [isSavingDrive, setIsSavingDrive] = useState(false);

  if (!isOpen) return null;

  const colorHexes = {
    indigo: '#4F46E5',
    'swiss-red': '#D50000',
    emerald: '#059669',
    slate: '#334155',
    navy: '#1E3A8A',
  };

  const selectedHex = colorHexes[themeColor];

  const getMarginMm = () => {
    switch (margin) {
      case 'narrow': return 10;
      case 'wide': return 25;
      default: return 15;
    }
  };

  const generatePdfBlob = (): { doc: jsPDF; blob: Blob } => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const marginMm = getMarginMm();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginMm * 2;

    let currentY = marginMm + 10;

    // Header Accent Bar
    doc.setFillColor(selectedHex);
    doc.rect(marginMm, marginMm, contentWidth, 3, 'F');
    currentY += 6;

    // Title
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(fontSize + 8);
    doc.setTextColor(30, 41, 59);
    doc.text(title || 'Documento DocPlus+', marginMm, currentY);
    currentY += 8;

    // Subtitle / Author Meta
    if (subtitle || author || showDate) {
      doc.setFont(fontFamily, 'italic');
      doc.setFontSize(fontSize - 1);
      doc.setTextColor(100, 116, 139);

      let metaString = '';
      if (author) metaString += `Por: ${author}`;
      if (showDate) metaString += ` • ${new Date().toLocaleDateString('pt-BR')}`;
      if (subtitle) metaString = `${subtitle} ${metaString ? '| ' + metaString : ''}`;

      doc.text(metaString, marginMm, currentY);
      currentY += 8;
    }

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginMm, currentY, pageWidth - marginMm, currentY);
    currentY += 8;

    // Watermark
    if (watermark) {
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(36);
      doc.setTextColor(240, 240, 245);
      doc.text(watermark.toUpperCase(), pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 35,
      });
    }

    // Content Body
    const cleanedContent = cleanMarkdownForExport(initialText);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);

    const splitLines = doc.splitTextToSize(cleanedContent, contentWidth);
    const lineStep = (fontSize * 0.35) * lineSpacing;

    let pageNum = 1;

    splitLines.forEach((line: string) => {
      if (currentY + lineStep > pageHeight - marginMm - 10) {
        // Add Page Footer
        if (showPageNumbers) {
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${pageNum}`, pageWidth - marginMm, pageHeight - marginMm, { align: 'right' });
          doc.text(`DocPlus+ Studio`, marginMm, pageHeight - marginMm);
        }

        doc.addPage();
        pageNum++;
        currentY = marginMm + 10;

        // Watermark on new page
        if (watermark) {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(36);
          doc.setTextColor(240, 240, 245);
          doc.text(watermark.toUpperCase(), pageWidth / 2, pageHeight / 2, {
            align: 'center',
            angle: 35,
          });
        }

        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(15, 23, 42);
      }

      doc.text(line, marginMm, currentY);
      currentY += lineStep;
    });

    // Add Page Footer for final page
    if (showPageNumbers) {
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${pageNum}`, pageWidth - marginMm, pageHeight - marginMm, { align: 'right' });
      doc.text(`DocPlus+ Studio`, marginMm, pageHeight - marginMm);
    }

    const blob = doc.output('blob');
    return { doc, blob };
  };

  const handleDownloadPdf = () => {
    try {
      const { doc } = generatePdfBlob();
      const filename = `${(title || 'documento').toLowerCase().replace(/\s+/g, '_')}_custom.pdf`;
      doc.save(filename);
      onNotification('PDF personalizado exportado com sucesso!');
      onClose();
    } catch (err: any) {
      onNotification(`Erro ao gerar PDF: ${err.message}`, 'error');
    }
  };

  const handleSaveToDrive = async () => {
    if (!googleUser || !googleUser.accessToken) {
      onNotification('Faça login com o Google para salvar no seu Drive.', 'error');
      return;
    }

    setIsSavingDrive(true);
    try {
      const { blob } = generatePdfBlob();
      const filename = `${title || 'Documento_DocPlus'}.pdf`;
      const driveFile = await uploadToGoogleDrive(googleUser.accessToken, filename, 'application/pdf', blob);
      onNotification(`Salvo com sucesso no seu Google Drive! (${driveFile.name})`);
      onClose();
    } catch (err: any) {
      onNotification(`Erro ao salvar no Drive: ${err.message}`, 'error');
    } finally {
      setIsSavingDrive(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-md">
              <FileOutput className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Exportar PDF Personalizado</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure fonte, margem, tema e marcas para publicação</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-700/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Controls Panel */}
          <div className="lg:col-span-7 space-y-5">
            {/* Metadata Controls */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Metadados do Documento</label>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Título</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Título do PDF"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Subtítulo (Opcional)</span>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Relatório / Nota"
                  />
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Autor</span>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Nome do Autor"
                  />
                </div>
              </div>
            </div>

            {/* Typography Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Tipografia & Estilo</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'helvetica', label: 'Sans (Helvetica)' },
                  { id: 'times', label: 'Serif (Times)' },
                  { id: 'courier', label: 'Mono (Courier)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontFamily(f.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                      fontFamily === f.id
                        ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tamanho da Fonte: {fontSize}pt</span>
                  <input
                    type="range"
                    min="9"
                    max="16"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Espaçamento: {lineSpacing}x</span>
                  <input
                    type="range"
                    min="1.1"
                    max="2.0"
                    step="0.1"
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Color Accent & Margins */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cor de Destaque & Layout</label>
              <div className="flex items-center gap-3">
                {[
                  { id: 'indigo', hex: '#4F46E5', label: 'Índigo' },
                  { id: 'swiss-red', hex: '#D50000', label: 'Suíço' },
                  { id: 'emerald', hex: '#059669', label: 'Esmeralda' },
                  { id: 'slate', hex: '#334155', label: 'Carvão' },
                  { id: 'navy', hex: '#1E3A8A', label: 'Marinho' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setThemeColor(c.id as any)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      themeColor === c.id ? 'border-white ring-2 ring-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    {themeColor === c.id && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'narrow', label: 'Margem Estreita (10mm)' },
                  { id: 'normal', label: 'Margem Padrão (15mm)' },
                  { id: 'wide', label: 'Margem Ampla (25mm)' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMargin(m.id as any)}
                    className={`py-2 px-2 text-[11px] rounded-xl border transition-all ${
                      margin === m.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extras Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Opções Adicionais</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={showPageNumbers}
                    onChange={(e) => setShowPageNumbers(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Números de Página</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={showDate}
                    onChange={(e) => setShowDate(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>Data & Timestamp</span>
                </label>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Marca d'água (Opcional)</span>
                <input
                  type="text"
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  className="w-full mt-1 px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: CONFIDENCIAL / RASCUNHO"
                />
              </div>
            </div>
          </div>

          {/* Live Page Preview Box */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Prévia Visual A4</span>
              <span className="text-[10px] text-indigo-500 font-normal">Ao Vivo</span>
            </div>
            <div className="flex-1 bg-slate-200 dark:bg-slate-950 p-4 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-800">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  fontFamily: fontFamily === 'helvetica' ? 'sans-serif' : fontFamily === 'times' ? 'serif' : 'monospace',
                  fontSize: `${fontSize * 0.7}px`,
                  color: '#0F172A',
                }}
                className="w-full aspect-[1/1.41] shadow-2xl rounded p-4 flex flex-col justify-between relative overflow-hidden select-none"
              >
                {/* Accent bar */}
                <div style={{ backgroundColor: selectedHex }} className="w-full h-1.5 rounded-full mb-2" />

                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">{title || 'Título do Documento'}</h4>
                  {(subtitle || author || showDate) && (
                    <p className="text-[9px] text-slate-400 italic mt-0.5 truncate">
                      {subtitle} {author && `• ${author}`} {showDate && `• ${new Date().toLocaleDateString('pt-BR')}`}
                    </p>
                  )}
                  <div className="w-full h-[1px] bg-slate-200 my-2" />

                  <div className="text-[9px] text-slate-700 space-y-1 overflow-hidden max-h-[220px]">
                    <p>{cleanMarkdownForExport(initialText).slice(0, 320) || 'Conteúdo do documento aqui...'}</p>
                  </div>
                </div>

                {watermark && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 font-bold text-2xl rotate-[35deg] uppercase">
                    {watermark}
                  </div>
                )}

                {showPageNumbers && (
                  <div className="text-[8px] text-slate-400 flex justify-between border-t border-slate-100 pt-1 mt-2">
                    <span>DocPlus+ Studio</span>
                    <span>Página 1</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {googleUser && (
              <button
                onClick={handleSaveToDrive}
                disabled={isSavingDrive}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
              >
                {isSavingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                Salvar no Google Drive
              </button>
            )}

            <button
              onClick={handleDownloadPdf}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
            >
              <FileOutput className="w-4 h-4" />
              Baixar PDF Customizado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
