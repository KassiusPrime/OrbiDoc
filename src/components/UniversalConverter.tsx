import React, { useMemo, useRef, useState } from 'react';
import {
  IconArrowsExchange as ArrowsExchange,
  IconCheck as Check,
  IconDownload as Download,
  IconFile as FileIcon,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconPhoto as Photo,
  IconSettings as Settings,
  IconTrash as Trash,
  IconUpload as Upload,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import {
  ConvertibleFormat,
  ConversionOptions,
  ConversionResult,
  convertFile,
  getFileExtension,
  getSupportedOutputs,
  isSupportedInput,
} from '../lib/fileConversion';

type QueueStatus = 'ready' | 'converting' | 'done' | 'error';

type QueueItem = {
  id: string;
  file: File;
  target: ConvertibleFormat;
  status: QueueStatus;
  message?: string;
};

export interface UniversalConverterProps {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

const LABELS: Record<ConvertibleFormat, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  html: 'HTML',
  txt: 'TXT',
  png: 'PNG',
  jpg: 'JPG',
  webp: 'WebP',
  avif: 'AVIF',
  xlsx: 'XLSX',
  csv: 'CSV',
};

const ACCEPT = '.pdf,.docx,.html,.htm,.txt,.md,.json,.xml,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.avif';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
};

const getIcon = (file: File) => {
  const extension = getFileExtension(file);
  if (['png', 'jpg', 'webp', 'avif'].includes(extension)) return Photo;
  if (['xlsx', 'xls', 'csv'].includes(extension)) return FileSpreadsheet;
  if (['pdf', 'docx', 'html', 'htm', 'txt', 'md', 'json', 'xml'].includes(extension)) return FileText;
  return FileIcon;
};

export const UniversalConverter: React.FC<UniversalConverterProps> = ({ showNotification = () => {} }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState(90);
  const [maxDimension, setMaxDimension] = useState(0);
  const [pdfScale, setPdfScale] = useState(1.75);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const readyCount = useMemo(() => queue.filter((item) => item.status !== 'converting').length, [queue]);

  const addFiles = (files: File[]) => {
    const accepted: QueueItem[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const outputs = getSupportedOutputs(file);
      if (!isSupportedInput(file) || !outputs.length || file.size > 100 * 1024 * 1024) {
        rejected.push(file.name);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        target: outputs[0],
        status: 'ready',
      });
    }

    if (accepted.length) setQueue((current) => [...current, ...accepted]);
    if (rejected.length) showNotification(`Arquivos não suportados/maiores que 100 MB: ${rejected.slice(0, 3).join(', ')}`, 'error');
  };

  const options: ConversionOptions = {
    quality: quality / 100,
    maxWidth: maxDimension || undefined,
    maxHeight: maxDimension || undefined,
    pdfScale,
  };

  const convertOne = async (item: QueueItem, saveImmediately = true): Promise<ConversionResult | null> => {
    setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'converting', message: 'Convertendo…' } : entry));
    try {
      const result = await convertFile(item.file, item.target, options);
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'done', message: result.fileName } : entry));
      if (result.warnings.length) setWarnings((current) => [...current, ...result.warnings]);
      if (saveImmediately) saveAs(result.blob, result.fileName);
      return result;
    } catch (error: any) {
      const message = error?.message || 'Falha na conversão.';
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'error', message } : entry));
      if (saveImmediately) showNotification(message, 'error');
      return null;
    }
  };

  const convertAll = async () => {
    if (!queue.length) return;
    setBusy(true);
    setWarnings([]);
    try {
      const items = [...queue];
      const results: ConversionResult[] = [];
      for (const item of items) {
        const result = await convertOne(item, items.length === 1);
        if (result) results.push(result);
      }

      if (items.length > 1 && results.length) {
        const module = await import('jszip');
        const JSZip = (module as any).default || module;
        const zip = new JSZip();
        results.forEach((result) => zip.file(result.fileName, result.blob));
        saveAs(await zip.generateAsync({ type: 'blob' }), `DocSwiss_Conversoes_${new Date().toISOString().slice(0, 10)}.zip`);
      }

      if (results.length) showNotification(`${results.length} conversão(ões) concluída(s).`, 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center gap-5">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <ArrowsExchange className="w-4 h-4" /> Conversor universal
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-950 dark:text-white">Converter arquivos sem trocar de aplicativo</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              PDF, DOCX, HTML, TXT, XLSX/CSV e imagens PNG, JPG, WebP e AVIF. O processamento acontece localmente sempre que o navegador oferece o codec necessário.
            </p>
          </div>
          <button onClick={() => inputRef.current?.click()} className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" /> Adicionar arquivos
          </button>
          <input ref={inputRef} className="hidden" type="file" multiple accept={ACCEPT} onChange={(event) => {
            if (event.target.files) addFiles(Array.from(event.target.files));
            event.target.value = '';
          }} />
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50/70 dark:bg-slate-950/30 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
          <span><strong>Imagens:</strong> PNG · JPG · WebP · AVIF → imagens/PDF</span>
          <span><strong>Documentos:</strong> PDF · DOCX · HTML · TXT → texto/documento/PDF</span>
          <span><strong>Planilhas:</strong> XLSX · CSV → CSV/HTML/TXT/PDF/XLSX</span>
        </div>
      </div>

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
        onClick={() => !queue.length && inputRef.current?.click()}
        className={`rounded-3xl border-2 border-dashed p-5 sm:p-7 transition-all ${dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'} ${queue.length ? '' : 'cursor-pointer text-center'}`}
      >
        {!queue.length ? (
          <div className="py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Upload className="w-7 h-7" /></div>
            <h3 className="mt-4 font-black text-slate-900 dark:text-white">Solte seus arquivos aqui</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Você pode misturar documentos, planilhas e imagens na mesma fila.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const Icon = getIcon(item.file);
              const outputs = getSupportedOutputs(item.file);
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.file.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatBytes(item.file.size)} · {getFileExtension(item.file).toUpperCase()}</div>
                    {item.message && <div className={`mt-1 text-[11px] ${item.status === 'error' ? 'text-rose-600' : item.status === 'done' ? 'text-emerald-600' : 'text-slate-500'}`}>{item.message}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">PARA</span>
                    <select value={item.target} onChange={(event) => setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, target: event.target.value as ConvertibleFormat, status: 'ready', message: undefined } : entry))} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-800 dark:text-slate-100">
                      {outputs.map((format) => <option key={format} value={format}>{LABELS[format]}</option>)}
                    </select>
                    <button disabled={item.status === 'converting'} onClick={() => convertOne(item)} className="h-10 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5">
                      {item.status === 'done' ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />} {item.status === 'done' ? 'Gerar de novo' : 'Converter'}
                    </button>
                    <button onClick={() => setQueue((current) => current.filter((entry) => entry.id !== item.id))} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 flex items-center justify-center" aria-label="Remover"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {queue.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <button onClick={() => setAdvanced((value) => !value)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2"><Settings className="w-4 h-4" /> Opções avançadas</button>
            <button onClick={() => setQueue((current) => current.filter((item) => item.status !== 'done'))} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Limpar concluídos</button>
            <div className="lg:ml-auto text-xs text-slate-500 dark:text-slate-400">{queue.length} arquivo(s) · {readyCount} disponível(is)</div>
            <button disabled={busy} onClick={convertAll} className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black inline-flex items-center justify-center gap-2"><ArrowsExchange className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Convertendo…' : 'Converter tudo'}</button>
          </div>

          {advanced && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Qualidade de imagem: {quality}%<input type="range" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="mt-2 w-full" /></label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Limite de dimensão<input type="number" min="0" step="256" value={maxDimension} onChange={(event) => setMaxDimension(Math.max(0, Number(event.target.value) || 0))} placeholder="0 = original" className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3" /></label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Resolução PDF → imagem<input type="number" min="1" max="3" step="0.25" value={pdfScale} onChange={(event) => setPdfScale(Math.max(1, Math.min(3, Number(event.target.value) || 1.75)))} className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3" /></label>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-200">
              <strong>Avisos de fidelidade:</strong> {[...new Set(warnings)].slice(0, 4).join(' ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
