import React, { useMemo, useRef, useState } from 'react';
import {
  IconArrowsExchange as ArrowsExchange,
  IconCheck as Check,
  IconDownload as Download,
  IconFile as FileIcon,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconLanguage as Language,
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
  isUniversalImageInput,
} from '../lib/fileConversion';

type QueueStatus = 'ready' | 'converting' | 'done' | 'error';
type QueueItem = { id: string; file: File; target: ConvertibleFormat; status: QueueStatus; message?: string };

export interface UniversalConverterProps {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

const LABELS: Partial<Record<ConvertibleFormat, string>> = {
  pdf: 'PDF', docx: 'DOCX', html: 'HTML', txt: 'TXT', xlsx: 'XLSX', csv: 'CSV',
  png: 'PNG', jpg: 'JPG', webp: 'WebP', avif: 'AVIF', gif: 'GIF', bmp: 'BMP', tiff: 'TIFF',
  heic: 'HEIC', jxl: 'JPEG XL', jp2: 'JPEG 2000', ico: 'ICO', cur: 'CUR', psd: 'PSD', dds: 'DDS',
  tga: 'TGA', exr: 'EXR', hdr: 'HDR', qoi: 'QOI', ppm: 'PPM', pgm: 'PGM', pbm: 'PBM', pnm: 'PNM',
  pcx: 'PCX', sgi: 'SGI', ras: 'RAS', xbm: 'XBM', xpm: 'XPM',
};
const labelFor = (format: ConvertibleFormat) => LABELS[format] || String(format).toUpperCase();

const ACCEPT = [
  '.pdf', '.docx', '.html', '.htm', '.txt', '.md', '.json', '.xml', '.csv', '.xlsx', '.xls',
  'image/*', '.heic', '.heif', '.hif', '.tif', '.tiff', '.jfif', '.jpe', '.jxl', '.jp2', '.j2k', '.jpf', '.jpx',
  '.psd', '.psb', '.dds', '.tga', '.exr', '.hdr', '.ppm', '.pgm', '.pbm', '.pnm', '.pcx', '.qoi', '.xcf',
  '.ico', '.cur', '.dib', '.sgi', '.ras', '.sun', '.xbm', '.xpm', '.wpg',
  '.dng', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.raf', '.srw', '.pef', '.raw',
].join(',');
const OCR_LANGUAGES = [
  { value: 'por+eng', label: 'Português + Inglês' },
  { value: 'por', label: 'Português' },
  { value: 'eng', label: 'Inglês' },
  { value: 'spa', label: 'Espanhol' },
  { value: 'fra', label: 'Francês' },
  { value: 'deu', label: 'Alemão' },
  { value: 'ita', label: 'Italiano' },
];

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
};

const getIcon = (file: File) => {
  const extension = getFileExtension(file);
  if (isUniversalImageInput(file)) return Photo;
  if (['xlsx', 'xls', 'csv'].includes(extension)) return FileSpreadsheet;
  if (['pdf', 'docx', 'html', 'htm', 'txt', 'md', 'json', 'xml'].includes(extension)) return FileText;
  return FileIcon;
};

export const UniversalConverter: React.FC<UniversalConverterProps> = ({ showNotification = () => {} }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState(92);
  const [resizeWidth, setResizeWidth] = useState(0);
  const [resizeHeight, setResizeHeight] = useState(0);
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(true);
  const [allowUpscale, setAllowUpscale] = useState(false);
  const [enhanceImage, setEnhanceImage] = useState(false);
  const [pdfScale, setPdfScale] = useState(1.75);
  const [ocrLanguage, setOcrLanguage] = useState('por+eng');
  const [forceOcrPdf, setForceOcrPdf] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const readyCount = useMemo(() => queue.filter((item) => item.status !== 'converting').length, [queue]);
  const totalBytes = useMemo(() => queue.reduce((sum, item) => sum + item.file.size, 0), [queue]);
  const hasOcrCandidate = useMemo(() => queue.some((item) => getFileExtension(item.file) === 'pdf' || isUniversalImageInput(item.file)), [queue]);
  const hasImage = useMemo(() => queue.some((item) => isUniversalImageInput(item.file)), [queue]);

  const addFiles = (files: File[]) => {
    const accepted: QueueItem[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const outputs = getSupportedOutputs(file);
      if (!isSupportedInput(file) || !outputs.length) {
        rejected.push(file.name);
        continue;
      }
      const rawExtension = file.name.split('.').pop()?.toLowerCase();
      const preferredTarget = ['jpeg', 'jpe', 'jfif'].includes(rawExtension || '') && outputs.includes('jpg') ? 'jpg' : outputs[0];
      accepted.push({ id: crypto.randomUUID(), file, target: preferredTarget, status: 'ready' });
    }
    if (accepted.length) setQueue((current) => [...current, ...accepted]);
    if (rejected.length) showNotification(`Arquivos não reconhecidos pelo conversor: ${rejected.slice(0, 3).join(', ')}`, 'error');
  };

  const options: ConversionOptions = {
    quality: quality / 100,
    maxWidth: resizeWidth || undefined,
    maxHeight: resizeHeight || undefined,
    preserveAspectRatio,
    allowUpscale,
    enhanceImage,
    pdfScale,
    ocrLanguage,
    forceOcrPdf,
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
      // Intencionalmente sequencial: não existe limite artificial de quantidade,
      // mas evitamos abrir dezenas de decodificadores/WASM ao mesmo tempo e estourar RAM.
      for (const item of items) {
        const result = await convertOne(item, items.length === 1);
        if (result) results.push(result);
      }
      if (items.length > 1 && results.length) {
        const module = await import('jszip');
        const JSZip = (module as any).default || module;
        const zip = new JSZip();
        results.forEach((result) => zip.file(result.fileName, result.blob));
        const archive = await zip.generateAsync({
          type: 'blob',
          streamFiles: true,
          compression: 'DEFLATE',
          compressionOptions: { level: 3 },
        });
        saveAs(archive, `OrbiDoc_Conversoes_${new Date().toISOString().slice(0, 10)}.zip`);
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
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400"><ArrowsExchange className="w-4 h-4" /> Conversor universal</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-950 dark:text-white">Converter, aprimorar e redimensionar arquivos</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">Imagens usam um fluxo híbrido: formatos comuns passam pelo navegador quando possível e formatos avançados usam ImageMagick WebAssembly local. Você pode controlar qualidade, dimensões, proporção e aprimoramento antes de exportar.</p>
          </div>
          <button onClick={() => inputRef.current?.click()} className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Adicionar arquivos</button>
          <input ref={inputRef} className="hidden" type="file" multiple accept={ACCEPT} onChange={(event) => { if (event.target.files) addFiles(Array.from(event.target.files)); event.target.value = ''; }} />
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50/70 dark:bg-slate-950/30 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
          <span><strong>Imagens:</strong> 100+ entradas → PNG · JPG · WebP · AVIF · GIF · BMP · TIFF · HEIC · JXL · JP2 · ICO · PSD · EXR e outros</span>
          <span><strong>JPEG → JPG:</strong> JPEG/JPE/JFIF podem ser normalizados para extensão .jpg</span>
          <span><strong>Qualidade:</strong> compressão ajustável + aprimoramento opcional de orientação, contraste tonal e nitidez</span>
          <span><strong>Redimensionamento:</strong> largura e altura independentes, proporção preservável e upscale opcional</span>
          <span><strong>Privacidade:</strong> imagens são processadas no próprio dispositivo</span>
        </div>
      </div>

      <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} onClick={() => !queue.length && inputRef.current?.click()} className={`rounded-3xl border-2 border-dashed p-5 sm:p-7 transition-all ${dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'} ${queue.length ? '' : 'cursor-pointer text-center'}`}>
        {!queue.length ? (
          <div className="py-10"><div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Upload className="w-7 h-7" /></div><h3 className="mt-4 font-black text-slate-900 dark:text-white">Solte seus arquivos aqui</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selecione quantos arquivos precisar. A fila processa um por vez para controlar o uso de memória.</p></div>
        ) : (
          <div className="space-y-3">{queue.map((item) => {
            const Icon = getIcon(item.file);
            const outputs = getSupportedOutputs(item.file);
            return <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
              <div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.file.name}</div><div className="text-[11px] text-slate-500 dark:text-slate-400">{formatBytes(item.file.size)} · {(getFileExtension(item.file) || 'imagem').toUpperCase()}</div>{item.message && <div className={`mt-1 text-[11px] ${item.status === 'error' ? 'text-rose-600' : item.status === 'done' ? 'text-emerald-600' : 'text-slate-500'}`}>{item.message}</div>}</div>
              <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-400">PARA</span><select value={item.target} onChange={(event) => setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, target: event.target.value as ConvertibleFormat, status: 'ready', message: undefined } : entry))} className="h-10 max-w-[148px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-800 dark:text-slate-100">{outputs.map((format) => <option key={format} value={format}>{labelFor(format)}</option>)}</select><button disabled={item.status === 'converting'} onClick={() => convertOne(item)} className="h-10 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5">{item.status === 'done' ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}{item.status === 'done' ? 'Gerar de novo' : 'Converter'}</button><button onClick={() => setQueue((current) => current.filter((entry) => entry.id !== item.id))} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 flex items-center justify-center" aria-label="Remover"><X className="w-4 h-4" /></button></div>
            </div>;
          })}</div>
        )}
      </div>

      {queue.length > 0 && <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3"><button onClick={() => setAdvanced((value) => !value)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2"><Settings className="w-4 h-4" /> Opções avançadas</button><button onClick={() => setQueue((current) => current.filter((item) => item.status !== 'done'))} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Limpar concluídos</button><div className="lg:ml-auto text-xs text-slate-500 dark:text-slate-400">{queue.length} arquivo(s) · {formatBytes(totalBytes)} · {readyCount} disponível(is)</div><button disabled={busy} onClick={convertAll} className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black inline-flex items-center justify-center gap-2"><ArrowsExchange className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Convertendo…' : 'Converter tudo'}</button></div>

        {advanced && <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className={`text-xs font-bold text-slate-600 dark:text-slate-300 ${hasImage ? '' : 'opacity-50'}`}>Qualidade de imagem: {quality}%<input disabled={!hasImage} type="range" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="mt-2 w-full" /></label>
            <label className={`text-xs font-bold text-slate-600 dark:text-slate-300 ${hasImage ? '' : 'opacity-50'}`}>Largura máxima / alvo (px)<input disabled={!hasImage} type="number" min="0" step="64" value={resizeWidth} onChange={(event) => setResizeWidth(Math.max(0, Number(event.target.value) || 0))} placeholder="0 = original" className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3" /></label>
            <label className={`text-xs font-bold text-slate-600 dark:text-slate-300 ${hasImage ? '' : 'opacity-50'}`}>Altura máxima / alvo (px)<input disabled={!hasImage} type="number" min="0" step="64" value={resizeHeight} onChange={(event) => setResizeHeight(Math.max(0, Number(event.target.value) || 0))} placeholder="0 = original" className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3" /></label>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Resolução PDF → imagem<input type="number" min="1" max="3" step="0.25" value={pdfScale} onChange={(event) => setPdfScale(Math.max(1, Math.min(3, Number(event.target.value) || 1.75)))} className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3" /></label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className={`h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 ${hasImage ? '' : 'opacity-50'}`}><input disabled={!hasImage} type="checkbox" checked={enhanceImage} onChange={(event) => setEnhanceImage(event.target.checked)} /> Aprimorar imagem</label>
            <label className={`h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 ${hasImage ? '' : 'opacity-50'}`}><input disabled={!hasImage} type="checkbox" checked={preserveAspectRatio} onChange={(event) => setPreserveAspectRatio(event.target.checked)} /> Preservar proporção</label>
            <label className={`h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 ${hasImage ? '' : 'opacity-50'}`}><input disabled={!hasImage} type="checkbox" checked={allowUpscale} onChange={(event) => setAllowUpscale(event.target.checked)} /> Permitir ampliar</label>
            <label className={`text-xs font-bold text-slate-600 dark:text-slate-300 ${hasOcrCandidate ? '' : 'opacity-50'}`}><span className="inline-flex items-center gap-1.5"><Language className="w-3.5 h-3.5" /> Idioma do OCR</span><select disabled={!hasOcrCandidate} value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3">{OCR_LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label>
            <label className={`text-xs font-bold text-slate-600 dark:text-slate-300 ${hasOcrCandidate ? '' : 'opacity-50'}`}><span>PDF digitalizado</span><span className="mt-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 flex items-center gap-2"><input disabled={!hasOcrCandidate} type="checkbox" checked={forceOcrPdf} onChange={(event) => setForceOcrPdf(event.target.checked)} /> Forçar OCR</span></label>
          </div>

          <p className="text-[10px] text-slate-500 dark:text-slate-400">RAW de câmera (CR2/CR3/NEF/ARW/DNG e similares) é aceito como entrada, mas não como saída: esses formatos guardam dados específicos do sensor que não podem ser reconstruídos fielmente a partir de uma imagem renderizada.</p>
        </div>}

        {warnings.length > 0 && <div className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-200"><strong>Avisos de fidelidade:</strong> {[...new Set(warnings)].slice(0, 6).join(' ')}</div>}
      </div>}
    </div>
  );
};
