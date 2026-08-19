import React, { useMemo, useRef, useState } from 'react';
import {
  IconArchive as Archive,
  IconCopy as Copy,
  IconDownload as Download,
  IconFile as FileIcon,
  IconFileText as FileText,
  IconFilter as Filter,
  IconPhoto as Photo,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconUpload as Upload,
  IconZoomIn as ZoomIn,
  IconZoomOut as ZoomOut,
} from '@tabler/icons-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { OcrItem } from '../types';
import { processFileOcr } from '../lib/ocrEngine';

interface PdfOcrWorkspaceProps {
  items: OcrItem[];
  setItems: React.Dispatch<React.SetStateAction<OcrItem[]>>;
  onSaveToHistory?: (title: string, summary: string, details?: string, tags?: string[]) => void;
  onSendToChat?: (text: string) => void;
  onSendToAiText?: (text: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  exportAsTxt?: (text: string, name: string) => void;
  exportAsDocx?: (text: string, name: string) => void;
  exportAsPdf?: (text: string, name: string) => void;
  exportAsMd?: (text: string, name: string) => void;
}

const LANGUAGES = [
  { code: 'por+eng', label: 'Português + Inglês' },
  { code: 'por', label: 'Português' },
  { code: 'eng', label: 'Inglês' },
  { code: 'spa', label: 'Espanhol' },
  { code: 'fra', label: 'Francês' },
  { code: 'deu', label: 'Alemão' },
  { code: 'ita', label: 'Italiano' },
  { code: 'jpn', label: 'Japonês' },
];

const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.html,.htm,.json,.xml,.png,.jpg,.jpeg,.webp,.avif,.bmp,.tif,.tiff';

const baseName = (name: string) =>
  name.replace(/\.[^/.]+$/, '').replace(/[<>:"/\\|?*]/g, '_') || 'Documento';

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const isImageItem = (item?: OcrItem) =>
  Boolean(item?.fileType?.startsWith('image/') || /\.(png|jpe?g|webp|avif|bmp|tiff?)$/i.test(item?.fileName || ''));

const isPdfItem = (item?: OcrItem) =>
  Boolean(item?.fileType === 'application/pdf' || /\.pdf$/i.test(item?.fileName || ''));

const classifyItem = (item: Pick<OcrItem, 'fileName' | 'fileType'>) => {
  if (isPdfItem(item as OcrItem)) return 'PDF';
  if (isImageItem(item as OcrItem)) return 'Imagem';
  return 'Documento';
};

export const PdfOcrWorkspace: React.FC<PdfOcrWorkspaceProps> = ({
  items,
  setItems,
  onSaveToHistory,
  onSendToChat,
  onSendToAiText,
  showNotification = () => {},
  exportAsTxt = () => {},
  exportAsDocx = () => {},
  exportAsPdf = () => {},
  exportAsMd = () => {},
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null);
  const [language, setLanguage] = useState('por+eng');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pdf' | 'image' | 'document'>('all');
  const [zoom, setZoom] = useState(100);
  const [forceOcrPdf, setForceOcrPdf] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const active = items.find((item) => item.id === selectedId) || items[0] || null;

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const search = query.trim().toLowerCase();
        const matchesText =
          !search ||
          item.fileName.toLowerCase().includes(search) ||
          item.text.toLowerCase().includes(search);
        const matchesType =
          filter === 'all' ||
          (filter === 'pdf' && isPdfItem(item)) ||
          (filter === 'image' && isImageItem(item)) ||
          (filter === 'document' && !isPdfItem(item) && !isImageItem(item));
        return matchesText && matchesType;
      }),
    [items, query, filter],
  );

  const patchItem = (id: string, patch: Partial<OcrItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const processOne = async (file: File) => {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    const item: OcrItem = {
      id,
      fileName: file.name,
      fileSize: file.size,
      text: '',
      status: 'processing',
      progress: 0,
      timestamp: new Date().toISOString(),
      fileUrl: url,
      fileType: file.type || file.name.split('.').pop()?.toLowerCase(),
      tags: [classifyItem({ fileName: file.name, fileType: file.type })],
    };

    setItems((current) => [item, ...current]);
    setSelectedId(id);

    try {
      const text = await processFileOcr(
        file,
        { language, forceOcrPdf, enhanceContrast: true },
        (progress) => patchItem(id, { progress: progress.progress }),
      );
      patchItem(id, { text, status: 'completed', progress: 100 });
      onSaveToHistory?.(
        `Extração: ${file.name}`,
        text.slice(0, 180),
        text,
        [...(item.tags || []), 'Extração'],
      );
      showNotification(`${file.name} processado.`, 'success');
    } catch (error: any) {
      patchItem(id, {
        status: 'error',
        progress: 0,
        error: error?.message || 'Falha no processamento.',
      });
      showNotification(
        `${file.name}: ${error?.message || 'falha no processamento'}`,
        'error',
      );
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    for (const file of files.slice(0, 20)) {
      if (file.size > 80 * 1024 * 1024) {
        showNotification(`${file.name} excede o limite local de 80 MB.`, 'error');
        continue;
      }
      await processOne(file);
    }
  };

  const remove = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (item?.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(item.fileUrl);
    const remaining = items.filter((entry) => entry.id !== id);
    setItems(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id || null);
  };

  const reprocess = async () => {
    if (!active?.fileUrl?.startsWith('blob:')) {
      showNotification(
        'O arquivo original não está mais disponível nesta sessão. Envie-o novamente.',
        'error',
      );
      return;
    }

    try {
      const blob = await fetch(active.fileUrl).then((response) => response.blob());
      const file = new File([blob], active.fileName, {
        type: active.fileType || blob.type,
      });
      patchItem(active.id, { status: 'processing', progress: 0, error: undefined });
      const text = await processFileOcr(
        file,
        { language, forceOcrPdf, enhanceContrast: true },
        (progress) => patchItem(active.id, { progress: progress.progress }),
      );
      patchItem(active.id, { text, status: 'completed', progress: 100 });
      showNotification('Documento processado novamente.', 'success');
    } catch (error: any) {
      patchItem(active.id, {
        status: 'error',
        error: error?.message || 'Falha no reprocessamento.',
      });
      showNotification(error?.message || 'Falha no reprocessamento.', 'error');
    }
  };

  const exportHtml = (text: string, name: string) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${baseName(name)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.6}</style></head><body><h1>${baseName(name)}</h1><p>${escaped}</p></body></html>`;
    saveAs(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      `${baseName(name)}.html`,
    );
  };

  const batchZip = async () => {
    const completed = items.filter(
      (item) => item.status === 'completed' && item.text.trim(),
    );
    if (!completed.length) {
      showNotification('Não há textos concluídos para exportar.', 'error');
      return;
    }

    setBatchBusy(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('OrbiDoc_Extracoes');
      completed.forEach((item) => {
        const base = baseName(item.fileName);
        folder?.file(`${base}.txt`, item.text);
        folder?.file(`${base}.md`, `# ${base}\n\n${item.text}`);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(
        blob,
        `OrbiDoc_Extracoes_${new Date().toISOString().slice(0, 10)}.zip`,
      );
      showNotification(
        `${completed.length} extração(ões) empacotada(s).`,
        'success',
      );
    } catch {
      showNotification('Falha ao criar o ZIP.', 'error');
    } finally {
      setBatchBusy(false);
    }
  };

  const renderPreview = () => {
    if (!active?.fileUrl) {
      return <div className="text-xs text-slate-400">Selecione um arquivo.</div>;
    }

    if (isImageItem(active)) {
      return (
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}>
          <img
            src={active.fileUrl}
            alt={active.fileName}
            className="max-w-full max-h-[650px] object-contain rounded-xl shadow-lg"
          />
        </div>
      );
    }

    if (isPdfItem(active)) {
      return (
        <iframe
          src={active.fileUrl}
          title={active.fileName}
          className="w-full h-[650px] bg-white rounded-xl border-0"
        />
      );
    }

    return (
      <div className="text-center text-slate-400">
        <FileText className="w-14 h-14 mx-auto opacity-40" />
        <div className="mt-3 text-xs font-bold">
          Prévia visual não disponível para este formato.
        </div>
        <div className="mt-1 text-[10px]">
          O conteúdo extraído aparece no painel de texto.
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-black text-cyan-700 dark:text-cyan-300">
              <FileText className="w-4 h-4" /> PDF & OCR
            </div>
            <h1 className="mt-1 text-2xl font-black">Leitura, digitalização e extração</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              PDFs com texto são lidos diretamente; páginas digitalizadas usam OCR local.
              Também abre DOCX, planilhas, HTML, TXT e imagens.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-[11px] font-bold"
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
            <label className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 text-[10px] font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={forceOcrPdf}
                onChange={(event) => setForceOcrPdf(event.target.checked)}
              />
              Forçar OCR em PDF
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void uploadFiles(Array.from(event.target.files));
                event.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Abrir arquivos
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[650px] flex flex-col">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar arquivo ou texto extraído…"
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-[11px] outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-[10px] font-bold"
            >
              <option value="all">Todos</option>
              <option value="pdf">PDF</option>
              <option value="image">Imagens</option>
              <option value="document">Documentos</option>
            </select>
            <button
              onClick={batchZip}
              disabled={batchBusy || !items.length}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Archive className="w-4 h-4" />
              {batchBusy ? 'Criando…' : 'ZIP das extrações'}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 m-4 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-400 flex flex-col items-center justify-center text-slate-400"
          >
            <Upload className="w-10 h-10" />
            <h2 className="mt-4 text-sm font-black text-slate-600 dark:text-slate-300">
              Arraste ou selecione documentos
            </h2>
            <p className="mt-1 text-xs max-w-md text-center">
              PDF, DOCX, XLSX, CSV, HTML, TXT, PNG, JPG, WebP, AVIF e outros formatos de imagem.
            </p>
          </button>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.7fr)]">
            <aside className="border-r border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[700px] lg:max-h-none">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full p-3 text-left flex items-start gap-3 ${active?.id === item.id ? 'bg-cyan-50 dark:bg-cyan-950/25' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isImageItem(item) ? 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40' : isPdfItem(item) ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      {isImageItem(item) ? <Photo className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black truncate">{item.fileName}</div>
                      <div className="mt-0.5 text-[9px] text-slate-400">
                        {formatBytes(item.fileSize)} · {item.status === 'processing' ? `${Math.round(item.progress)}%` : item.status}
                      </div>
                      {item.status === 'processing' && (
                        <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="min-h-[420px] bg-slate-100 dark:bg-slate-950 overflow-auto p-4 flex items-center justify-center border-b lg:border-b-0 xl:border-r border-slate-100 dark:border-slate-800">
              {renderPreview()}
            </div>

            <aside className="xl:block min-h-[420px] overflow-y-auto p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <h3 className="text-xs font-black">Texto extraído</h3>
                  <div className="text-[9px] text-slate-400">
                    {active?.text.length || 0} caracteres
                  </div>
                </div>
                {active && (
                  <>
                    <button
                      onClick={reprocess}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                      title="Processar novamente"
                    >
                      <Refresh className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(active.id)}
                      className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center"
                      title="Remover"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {active?.status === 'error' ? (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {active.error || 'Falha no processamento.'}
                </div>
              ) : (
                <textarea
                  value={active?.text || ''}
                  onChange={(event) => active && patchItem(active.id, { text: event.target.value })}
                  className="w-full min-h-[390px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs leading-relaxed outline-none focus:border-cyan-500"
                  placeholder={active?.status === 'processing' ? 'Processando…' : 'Texto extraído…'}
                />
              )}

              {active?.text && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(active.text)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </button>
                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(active.text)}
                      className="h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold inline-flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Enviar à IA
                    </button>
                  )}
                  {onSendToAiText && (
                    <button
                      onClick={() => onSendToAiText(active.text)}
                      className="h-9 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold"
                    >
                      Abrir em Documentos
                    </button>
                  )}
                  <div className="relative group">
                    <button className="w-full h-9 rounded-xl bg-cyan-600 text-white text-[10px] font-black inline-flex items-center justify-center gap-2">
                      <Download className="w-3.5 h-3.5" /> Exportar
                    </button>
                    <div className="hidden group-hover:block absolute bottom-9 right-0 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">
                      <button onClick={() => exportAsTxt(active.text, baseName(active.fileName))} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">TXT</button>
                      <button onClick={() => exportAsMd(active.text, baseName(active.fileName))} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Markdown</button>
                      <button onClick={() => exportHtml(active.text, active.fileName)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">HTML</button>
                      <button onClick={() => exportAsDocx(active.text, baseName(active.fileName))} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">DOCX</button>
                      <button onClick={() => exportAsPdf(active.text, baseName(active.fileName))} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">PDF</button>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {active && isImageItem(active) && (
          <div className="h-10 px-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 justify-center">
            <button
              onClick={() => setZoom((value) => Math.max(25, value - 10))}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-slate-400 w-12 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((value) => Math.min(200, value + 10))}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
