import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  X,
  FileOutput,
  CloudUpload,
  Check,
  Loader2,
  Heading1,
  List,
  Quote,
  Code2,
} from 'lucide-react';
import { GoogleUserProfile } from '../types';
import { uploadToGoogleDrive } from '../services/googleAuthDrive';

interface CustomPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  defaultTitle?: string;
  googleUser: GoogleUserProfile | null;
  onNotification: (msg: string, type?: 'success' | 'error') => void;
}

type PdfBlockType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'code'
  | 'divider'
  | 'blank';

interface PdfBlock {
  type: PdfBlockType;
  text: string;
  marker?: string;
}

const stripInlineMarkdown = (value: string) => value
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  .replace(/<\/?(?:mark|span|p|div|strong|em|u|s)(?:\s+[^>]*)?>/gi, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/__(.*?)__/g, '$1')
  .replace(/~~(.*?)~~/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*(.*?)\*/g, '$1')
  .replace(/_(.*?)_/g, '$1')
  .replace(/<[^>]+>/g, '')
  .trim();

const parseMarkdownBlocks = (value: string): PdfBlock[] => {
  if (!value.trim()) return [{ type: 'paragraph', text: '' }];

  const blocks: PdfBlock[] = [];
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  let inCode = false;
  let codeLines: string[] = [];

  const flushCode = () => {
    if (!codeLines.length) return;
    blocks.push({ type: 'code', text: codeLines.join('\n') });
    codeLines = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^```/.test(trimmed)) {
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      blocks.push({ type: 'blank', text: '' });
      continue;
    }

    if (/^(---+|___+|\*\*\*+)$/.test(trimmed)) {
      blocks.push({ type: 'divider', text: '' });
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      blocks.push({ type: 'heading1', text: stripInlineMarkdown(h1[1]) });
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      blocks.push({ type: 'heading2', text: stripInlineMarkdown(h2[1]) });
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      blocks.push({ type: 'heading3', text: stripInlineMarkdown(h3[1]) });
      continue;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      blocks.push({ type: 'bullet', text: stripInlineMarkdown(bullet[1]), marker: '•' });
      continue;
    }

    const numbered = trimmed.match(/^(\d+[.)])\s+(.+)$/);
    if (numbered) {
      blocks.push({ type: 'numbered', text: stripInlineMarkdown(numbered[2]), marker: numbered[1] });
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      blocks.push({ type: 'quote', text: stripInlineMarkdown(quote[1]) });
      continue;
    }

    blocks.push({ type: 'paragraph', text: stripInlineMarkdown(trimmed) });
  }

  if (inCode) flushCode();
  return blocks;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const safeFilename = (value: string) => value
  .trim()
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '') || 'documento';

export const CustomPdfExportModal: React.FC<CustomPdfExportModalProps> = ({
  isOpen,
  onClose,
  initialText,
  defaultTitle = 'Documento OrbiDoc',
  googleUser,
  onNotification,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState(googleUser?.name || 'OrbiDoc User');
  const [fontFamily, setFontFamily] = useState<'helvetica' | 'times' | 'courier'>('helvetica');
  const [fontSize, setFontSize] = useState(11);
  const [margin, setMargin] = useState<'narrow' | 'normal' | 'wide'>('normal');
  const [themeColor, setThemeColor] = useState<'indigo' | 'swiss-red' | 'emerald' | 'slate' | 'navy'>('indigo');
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [watermark, setWatermark] = useState('');
  const [lineSpacing, setLineSpacing] = useState(1.4);
  const [isSavingDrive, setIsSavingDrive] = useState(false);

  const parsedBlocks = useMemo(() => parseMarkdownBlocks(initialText), [initialText]);

  if (!isOpen) return null;

  const colorHexes = {
    indigo: '#4F46E5',
    'swiss-red': '#D50000',
    emerald: '#059669',
    slate: '#334155',
    navy: '#1E3A8A',
  } as const;

  const selectedHex = colorHexes[themeColor];
  const selectedRgb = hexToRgb(selectedHex);

  const getMarginMm = () => {
    if (margin === 'narrow') return 10;
    if (margin === 'wide') return 25;
    return 15;
  };

  const generatePdfBlob = (): { doc: jsPDF; blob: Blob } => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginMm = getMarginMm();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginMm * 2;
    const footerReserve = 13;
    const bottomLimit = pageHeight - marginMm - footerReserve;
    let currentY = marginMm;
    let pageNum = 1;

    const drawWatermark = () => {
      if (!watermark.trim()) return;
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(34);
      doc.setTextColor(232, 236, 242);
      doc.text(watermark.trim().toUpperCase(), pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 35,
      });
    };

    const drawFooter = () => {
      if (!showPageNumbers) return;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(marginMm, pageHeight - marginMm - 5, pageWidth - marginMm, pageHeight - marginMm - 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('OrbiDoc Studio', marginMm, pageHeight - marginMm);
      doc.text(`Página ${pageNum}`, pageWidth - marginMm, pageHeight - marginMm, { align: 'right' });
    };

    const newPage = () => {
      drawFooter();
      doc.addPage();
      pageNum += 1;
      currentY = marginMm + 5;
      drawWatermark();
    };

    const ensureSpace = (height: number) => {
      if (currentY + height > bottomLimit) newPage();
    };

    const writeWrapped = (
      text: string,
      options: {
        x?: number;
        width?: number;
        size?: number;
        style?: 'normal' | 'bold' | 'italic' | 'bolditalic';
        family?: 'helvetica' | 'times' | 'courier';
        color?: [number, number, number];
        lineHeightMultiplier?: number;
        after?: number;
      } = {},
    ) => {
      const x = options.x ?? marginMm;
      const width = options.width ?? contentWidth;
      const size = options.size ?? fontSize;
      const family = options.family ?? fontFamily;
      const style = options.style ?? 'normal';
      const color = options.color ?? [15, 23, 42];
      const lineHeight = size * 0.3528 * (options.lineHeightMultiplier ?? lineSpacing);
      const lines = doc.splitTextToSize(text || ' ', width) as string[];

      doc.setFont(family, style);
      doc.setFontSize(size);
      doc.setTextColor(...color);

      for (const line of lines) {
        ensureSpace(lineHeight + 1);
        doc.text(line, x, currentY);
        currentY += lineHeight;
      }
      currentY += options.after ?? 1.4;
      return lines.length;
    };

    drawWatermark();

    doc.setFillColor(...selectedRgb);
    doc.rect(marginMm, marginMm, contentWidth, 3, 'F');
    currentY = marginMm + 9;

    writeWrapped(title || 'Documento OrbiDoc', {
      size: fontSize + 8,
      style: 'bold',
      color: [30, 41, 59],
      lineHeightMultiplier: 1.05,
      after: 2,
    });

    const metaParts: string[] = [];
    if (subtitle.trim()) metaParts.push(subtitle.trim());
    if (author.trim()) metaParts.push(`Por: ${author.trim()}`);
    if (showDate) metaParts.push(new Date().toLocaleDateString('pt-BR'));
    if (metaParts.length) {
      writeWrapped(metaParts.join('  •  '), {
        size: Math.max(8.5, fontSize - 1),
        style: 'italic',
        color: [100, 116, 139],
        lineHeightMultiplier: 1.15,
        after: 3,
      });
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginMm, currentY, pageWidth - marginMm, currentY);
    currentY += 7;

    for (const block of parsedBlocks) {
      switch (block.type) {
        case 'blank':
          currentY += fontSize * 0.22;
          if (currentY > bottomLimit) newPage();
          break;

        case 'divider':
          ensureSpace(6);
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.35);
          doc.line(marginMm, currentY + 1, pageWidth - marginMm, currentY + 1);
          currentY += 6;
          break;

        case 'heading1':
          ensureSpace(12);
          currentY += 2;
          writeWrapped(block.text, {
            size: fontSize + 5,
            style: 'bold',
            color: selectedRgb,
            lineHeightMultiplier: 1.08,
            after: 3,
          });
          break;

        case 'heading2':
          ensureSpace(10);
          currentY += 1.5;
          writeWrapped(block.text, {
            size: fontSize + 3,
            style: 'bold',
            color: [30, 41, 59],
            lineHeightMultiplier: 1.1,
            after: 2.5,
          });
          break;

        case 'heading3':
          ensureSpace(9);
          currentY += 1;
          writeWrapped(block.text, {
            size: fontSize + 1.5,
            style: 'bold',
            color: [51, 65, 85],
            lineHeightMultiplier: 1.1,
            after: 2,
          });
          break;

        case 'bullet':
        case 'numbered': {
          const marker = block.type === 'bullet' ? '•' : (block.marker || '1.');
          const markerWidth = block.type === 'bullet' ? 5 : 9;
          const textX = marginMm + markerWidth;
          const textWidth = contentWidth - markerWidth;
          const size = fontSize;
          const lineHeight = size * 0.3528 * lineSpacing;
          const lines = doc.splitTextToSize(block.text, textWidth) as string[];
          ensureSpace(lineHeight + 1);
          doc.setFont(fontFamily, 'normal');
          doc.setFontSize(size);
          doc.setTextColor(...selectedRgb);
          doc.text(marker, marginMm + 1, currentY);
          doc.setTextColor(15, 23, 42);
          for (const line of lines) {
            ensureSpace(lineHeight + 1);
            doc.text(line, textX, currentY);
            currentY += lineHeight;
          }
          currentY += 1.3;
          break;
        }

        case 'quote': {
          const quoteWidth = contentWidth - 8;
          const size = Math.max(9.5, fontSize - 0.2);
          const lineHeight = size * 0.3528 * lineSpacing;
          const lines = doc.splitTextToSize(block.text, quoteWidth) as string[];
          const estimatedHeight = Math.max(8, lines.length * lineHeight + 4);
          ensureSpace(estimatedHeight);
          const startY = currentY - 2;
          doc.setDrawColor(...selectedRgb);
          doc.setLineWidth(1.1);
          doc.line(marginMm + 1, startY, marginMm + 1, startY + estimatedHeight - 1);
          writeWrapped(block.text, {
            x: marginMm + 6,
            width: quoteWidth,
            size,
            style: 'italic',
            color: [71, 85, 105],
            after: 3,
          });
          break;
        }

        case 'code': {
          const size = Math.max(8.5, fontSize - 1.5);
          const x = marginMm + 3;
          const width = contentWidth - 6;
          const lineHeight = size * 0.3528 * 1.3;
          const logicalLines = block.text.split('\n');
          currentY += 1;
          for (const logicalLine of logicalLines) {
            const lines = doc.splitTextToSize(logicalLine || ' ', width - 4) as string[];
            for (const line of lines) {
              ensureSpace(lineHeight + 2.5);
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(x - 2, currentY - lineHeight + 1, width + 4, lineHeight + 2, 1, 1, 'F');
              doc.setFont('courier', 'normal');
              doc.setFontSize(size);
              doc.setTextColor(51, 65, 85);
              doc.text(line, x, currentY);
              currentY += lineHeight + 0.6;
            }
          }
          currentY += 3;
          break;
        }

        case 'paragraph':
        default:
          writeWrapped(block.text, { after: 2.2 });
          break;
      }
    }

    drawFooter();
    const blob = doc.output('blob');
    return { doc, blob };
  };

  const handleDownloadPdf = () => {
    try {
      const { doc } = generatePdfBlob();
      doc.save(`${safeFilename(title)}.pdf`);
      onNotification('PDF exportado preservando títulos, listas, citações e blocos de código.');
      onClose();
    } catch (err: any) {
      onNotification(`Erro ao gerar PDF: ${err?.message || 'falha desconhecida'}`, 'error');
    }
  };

  const handleSaveToDrive = async () => {
    if (!googleUser?.accessToken) {
      onNotification('Conecte sua Conta Google antes de salvar no Drive.', 'error');
      return;
    }

    setIsSavingDrive(true);
    try {
      const { blob } = generatePdfBlob();
      const filename = `${safeFilename(title)}.pdf`;
      const driveFile = await uploadToGoogleDrive(googleUser.accessToken, filename, 'application/pdf', blob);
      onNotification(`PDF salvo no Google Drive: ${driveFile.name}`);
      onClose();
    } catch (err: any) {
      onNotification(`Erro ao salvar no Drive: ${err?.message || 'falha desconhecida'}`, 'error');
    } finally {
      setIsSavingDrive(false);
    }
  };

  const previewBlocks = parsedBlocks.filter((block) => block.type !== 'blank').slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        <header className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <FileOutput className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Exportar PDF</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Preserva hierarquia de títulos, listas, citações, código e paginação.</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar exportação PDF" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 flex-1">
          <section className="lg:col-span-7 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">Documento</label>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <Heading1 className="w-3.5 h-3.5" /> Títulos
                  <List className="w-3.5 h-3.5 ml-1" /> Listas
                  <Quote className="w-3.5 h-3.5 ml-1" /> Citações
                  <Code2 className="w-3.5 h-3.5 ml-1" /> Código
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Título</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full mt-1 h-10 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="Título do PDF" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Subtítulo</span>
                  <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="w-full mt-1 h-10 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="Opcional" />
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Autor</span>
                  <input value={author} onChange={(event) => setAuthor(event.target.value)} className="w-full mt-1 h-10 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="Nome do autor" />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">Tipografia</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'helvetica', label: 'Helvetica' },
                  { id: 'times', label: 'Times' },
                  { id: 'courier', label: 'Courier' },
                ].map((item) => (
                  <button key={item.id} onClick={() => setFontFamily(item.id as typeof fontFamily)} className={`h-9 px-2 rounded-xl text-xs font-bold border ${fontFamily === item.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Fonte: {fontSize}pt</span>
                  <input type="range" min="9" max="16" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} className="w-full accent-indigo-600 mt-2" />
                </label>
                <label className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Espaçamento: {lineSpacing.toFixed(1)}x</span>
                  <input type="range" min="1.1" max="2" step="0.1" value={lineSpacing} onChange={(event) => setLineSpacing(Number(event.target.value))} className="w-full accent-indigo-600 mt-2" />
                </label>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">Layout</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'indigo', hex: '#4F46E5', label: 'Índigo' },
                  { id: 'swiss-red', hex: '#D50000', label: 'Suíço' },
                  { id: 'emerald', hex: '#059669', label: 'Esmeralda' },
                  { id: 'slate', hex: '#334155', label: 'Carvão' },
                  { id: 'navy', hex: '#1E3A8A', label: 'Marinho' },
                ].map((item) => (
                  <button key={item.id} onClick={() => setThemeColor(item.id as typeof themeColor)} title={item.label} style={{ backgroundColor: item.hex }} className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${themeColor === item.id ? 'border-white ring-2 ring-indigo-500 scale-105' : 'border-transparent'}`}>
                    {themeColor === item.id && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'narrow', label: 'Estreita' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'wide', label: 'Ampla' },
                ].map((item) => (
                  <button key={item.id} onClick={() => setMargin(item.id as typeof margin)} className={`h-9 px-2 rounded-xl text-[11px] font-bold border ${margin === item.id ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">Publicação</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input type="checkbox" checked={showPageNumbers} onChange={(event) => setShowPageNumbers(event.target.checked)} className="accent-indigo-600" />
                  <span>Números de página</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input type="checkbox" checked={showDate} onChange={(event) => setShowDate(event.target.checked)} className="accent-indigo-600" />
                  <span>Data do documento</span>
                </label>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Marca d'água</span>
                <input value={watermark} onChange={(event) => setWatermark(event.target.value)} className="w-full mt-1 h-9 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="Ex.: CONFIDENCIAL" />
              </div>
            </div>
          </section>

          <section className="lg:col-span-5 flex flex-col min-h-[420px]">
            <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
              <span>Prévia A4</span>
              <span className="text-[10px] normal-case tracking-normal text-emerald-600 dark:text-emerald-400">Estrutura preservada</span>
            </div>
            <div className="flex-1 bg-slate-200 dark:bg-slate-950 p-3 sm:p-5 rounded-2xl border border-slate-300 dark:border-slate-800 flex items-start justify-center overflow-auto">
              <div className="w-full max-w-[360px] aspect-[1/1.414] bg-white shadow-xl rounded-sm p-5 relative overflow-hidden text-slate-900" style={{ fontFamily: fontFamily === 'times' ? 'serif' : fontFamily === 'courier' ? 'monospace' : 'sans-serif' }}>
                <div style={{ backgroundColor: selectedHex }} className="w-full h-1.5 rounded-full mb-3" />
                <h4 className="font-black text-[13px] leading-tight line-clamp-2">{title || 'Título do Documento'}</h4>
                {(subtitle || author || showDate) && <p className="text-[7px] text-slate-400 italic mt-1 line-clamp-1">{[subtitle, author, showDate ? new Date().toLocaleDateString('pt-BR') : ''].filter(Boolean).join(' • ')}</p>}
                <div className="h-px bg-slate-200 my-2.5" />

                <div className="space-y-1.5 text-[7.5px] leading-relaxed max-h-[78%] overflow-hidden">
                  {previewBlocks.map((block, index) => {
                    if (block.type === 'divider') return <div key={index} className="h-px bg-slate-200 my-2" />;
                    if (block.type === 'heading1') return <div key={index} className="font-black text-[10px] mt-2" style={{ color: selectedHex }}>{block.text}</div>;
                    if (block.type === 'heading2') return <div key={index} className="font-black text-[9px] text-slate-800 mt-1.5">{block.text}</div>;
                    if (block.type === 'heading3') return <div key={index} className="font-bold text-[8px] text-slate-700 mt-1">{block.text}</div>;
                    if (block.type === 'bullet' || block.type === 'numbered') return <div key={index} className="flex gap-1.5"><span style={{ color: selectedHex }} className="font-bold shrink-0">{block.type === 'bullet' ? '•' : block.marker}</span><span>{block.text}</span></div>;
                    if (block.type === 'quote') return <div key={index} className="italic text-slate-500 pl-2 border-l-2" style={{ borderColor: selectedHex }}>{block.text}</div>;
                    if (block.type === 'code') return <pre key={index} className="font-mono text-[6.5px] bg-slate-100 rounded p-1.5 whitespace-pre-wrap line-clamp-4">{block.text}</pre>;
                    return <p key={index}>{block.text}</p>;
                  })}
                </div>

                {watermark && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] font-black text-xl rotate-[35deg] uppercase">{watermark}</div>}
                {showPageNumbers && <div className="absolute bottom-3 left-5 right-5 border-t border-slate-100 pt-1 flex justify-between text-[6px] text-slate-400"><span>OrbiDoc Studio</span><span>Página 1</span></div>}
              </div>
            </div>
          </section>
        </div>

        <footer className="px-4 sm:px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button onClick={onClose} className="h-10 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
          <div className="flex flex-col sm:flex-row gap-2">
            {googleUser?.accessToken && (
              <button onClick={handleSaveToDrive} disabled={isSavingDrive} className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {isSavingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                Salvar no Drive
              </button>
            )}
            <button onClick={handleDownloadPdf} className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm">
              <FileOutput className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
