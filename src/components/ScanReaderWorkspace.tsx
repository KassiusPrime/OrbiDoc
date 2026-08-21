import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconBook2 as Book,
  IconCamera as Camera,
  IconCrop as Crop,
  IconFileText as FileText,
  IconFolderOpen as FolderOpen,
  IconRefresh as Refresh,
  IconRotateClockwise as Rotate,
  IconScan as Scan,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { OcrItem } from '../types';
import {
  autoDetectScanCorners,
  autoDetectScanCrop,
  createScanPage,
  cropToScanCorners,
  defaultScanCorners,
  defaultScanCrop,
  exportScansToPdf,
  exportScansToZip,
  releaseScanPage,
  renderScanPageBlob,
  type ScanCorners,
  type ScanFilter,
  type ScanPage,
} from '../lib/documentScanner';
import {
  readArchiveEntry,
  readDocumentFile,
  READER_ACCEPT,
  releaseReaderDocument,
  type ReaderDocument,
} from '../lib/documentReader';
import { processFileOcr } from '../lib/ocrEngine';
import { PdfOcrWorkspace } from './PdfOcrWorkspace';

type WorkspaceMode = 'scan' | 'reader' | 'ocr';

type Props = {
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
};

const FILTERS: Array<{ id: ScanFilter; label: string }> = [
  { id: 'original', label: 'Original' },
  { id: 'auto', label: 'Auto' },
  { id: 'document', label: 'Documento' },
  { id: 'grayscale', label: 'Cinza' },
  { id: 'bw', label: 'P&B' },
];

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const ScanReaderWorkspace: React.FC<Props> = (props) => {
  const notify = props.showNotification || (() => {});
  const [mode, setMode] = useState<WorkspaceMode>('scan');

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-black text-cyan-700 dark:text-cyan-300"><Scan className="w-4 h-4" /> Scan & Reader</div>
            <h1 className="mt-1 text-2xl font-black">Digitalize, leia e extraia em um só lugar</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">Câmera e scanner multipágina com perspectiva de quatro cantos, leitor local de PDF/EPUB/ZIP/HTML/TXT/Markdown/DOCX/planilhas e OCR local.</p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-950 p-1">
            {([
              ['scan', 'Digitalizar', Camera],
              ['reader', 'Leitor', Book],
              ['ocr', 'OCR / Extrair', FileText],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setMode(id)} className={`h-9 px-3 rounded-xl text-[10px] font-black inline-flex items-center gap-1.5 ${mode === id ? 'bg-white dark:bg-slate-800 text-[#3157F6] dark:text-[#7AA2FF] shadow-sm' : 'text-slate-500'}`}><Icon className="w-3.5 h-3.5" /> {label}</button>
            ))}
          </div>
        </div>
      </section>

      {mode === 'scan' && <ScannerStudio {...props} notify={notify} onOpenOcr={() => setMode('ocr')} />}
      {mode === 'reader' && <ReaderStudio notify={notify} onSendToAiText={props.onSendToAiText} />}
      {mode === 'ocr' && <PdfOcrWorkspace {...props} />}
    </div>
  );
};

const ScannerStudio: React.FC<Props & { notify: (message: string, type?: 'success' | 'error') => void; onOpenOcr: () => void }> = ({ items, setItems, notify, onSaveToHistory, onOpenOcr }) => {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<ScanPage[]>([]);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [editingCorners, setEditingCorners] = useState(false);
  const [busy, setBusy] = useState<'crop' | 'ocr' | 'pdf' | 'zip' | null>(null);
  const [paper, setPaper] = useState<'original' | 'a4'>('a4');
  const active = pages.find((page) => page.id === activeId) || pages[0] || null;

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => () => pagesRef.current.forEach(releaseScanPage), []);

  useEffect(() => {
    if (!active) { setPreviewUrl(''); return; }
    let cancelled = false;
    let localUrl = '';
    const timer = window.setTimeout(() => {
      renderScanPageBlob(active, 0.88).then((blob) => {
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setPreviewUrl((old) => { if (old.startsWith('blob:')) URL.revokeObjectURL(old); return localUrl; });
      }).catch(() => {});
    }, 100);
    return () => { cancelled = true; window.clearTimeout(timer); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [
    active?.id,
    active?.rotation,
    active?.filter,
    active?.brightness,
    active?.contrast,
    active?.crop.left,
    active?.crop.top,
    active?.crop.right,
    active?.crop.bottom,
    active?.perspectiveEnabled,
    active?.corners.topLeft.x,
    active?.corners.topLeft.y,
    active?.corners.topRight.x,
    active?.corners.topRight.y,
    active?.corners.bottomRight.x,
    active?.corners.bottomRight.y,
    active?.corners.bottomLeft.x,
    active?.corners.bottomLeft.y,
  ]);

  const addFiles = (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|avif|gif|bmp|tiff?)$/i.test(file.name)).slice(0, 40);
    if (!accepted.length) { notify('Selecione imagens ou use a câmera para digitalizar.', 'error'); return; }
    const next = accepted.map(createScanPage);
    setPages((current) => [...current, ...next]);
    setActiveId((current) => current || next[0].id);
    notify(`${next.length} página(s) adicionada(s) ao scanner.`, 'success');
  };

  const patchActive = (patch: Partial<ScanPage>) => {
    if (!active) return;
    setPages((current) => current.map((page) => page.id === active.id ? { ...page, ...patch } : page));
  };

  const patchCorners = (corners: ScanCorners) => patchActive({ corners });

  const togglePerspective = () => {
    if (!active) return;
    if (active.perspectiveEnabled) {
      patchActive({ perspectiveEnabled: false });
      setEditingCorners(false);
      return;
    }
    patchActive({
      perspectiveEnabled: true,
      corners: cropToScanCorners(active.crop),
      crop: defaultScanCrop(),
    });
    setEditingCorners(true);
  };

  const removePage = (page: ScanPage) => {
    releaseScanPage(page);
    const remaining = pages.filter((entry) => entry.id !== page.id);
    setPages(remaining);
    if (activeId === page.id) setActiveId(remaining[0]?.id || null);
  };

  const movePage = (direction: -1 | 1) => {
    if (!active) return;
    const index = pages.findIndex((page) => page.id === active.id);
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    setPages(next);
  };

  const autoCrop = async () => {
    if (!active) return;
    setBusy('crop');
    try {
      if (active.perspectiveEnabled) {
        patchActive({ corners: await autoDetectScanCorners(active), crop: defaultScanCrop() });
        setEditingCorners(true);
        notify('Quatro cantos estimados. Arraste as alças para alinhar exatamente às bordas do documento.', 'success');
      } else {
        patchActive({ crop: await autoDetectScanCrop(active) });
        notify('Recorte automático estimado. Revise as bordas antes de exportar.', 'success');
      }
    } catch {
      notify('Não foi possível detectar as bordas automaticamente.', 'error');
    } finally { setBusy(null); }
  };

  const ocrAll = async () => {
    if (!pages.length) return;
    setBusy('ocr');
    try {
      const sections: string[] = [];
      for (let index = 0; index < pages.length; index += 1) {
        notify(`OCR da página ${index + 1}/${pages.length}…`);
        const blob = await renderScanPageBlob(pages[index], 0.94, 'image/png');
        const file = new File([blob], `pagina-${index + 1}.png`, { type: 'image/png' });
        const text = await processFileOcr(file, { language: 'por+eng', enhanceContrast: false });
        sections.push(`--- Página ${index + 1} ---\n${text}`);
      }
      const text = sections.join('\n\n');
      const item: OcrItem = { id: crypto.randomUUID(), fileName: `Digitalização ${new Date().toLocaleDateString('pt-BR')}.pdf`, fileSize: 0, text, status: 'completed', progress: 100, timestamp: new Date().toISOString(), fileType: 'application/pdf', tags: ['Scanner', 'OCR'] };
      setItems((current) => [item, ...current]);
      onSaveToHistory?.('OCR da digitalização', text.slice(0, 180), text, ['Scanner', 'OCR']);
      notify(`${pages.length} página(s) reconhecida(s).`, 'success');
      onOpenOcr();
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha no OCR da digitalização.', 'error'); }
    finally { setBusy(null); }
  };

  const restorePage = () => {
    patchActive({
      crop: defaultScanCrop(),
      corners: defaultScanCorners(),
      perspectiveEnabled: false,
      filter: 'auto',
      brightness: 100,
      contrast: 100,
      rotation: 0,
    });
    setEditingCorners(false);
  };

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { if (event.target.files) addFiles(Array.from(event.target.files)); event.target.value = ''; }} />
      <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(Array.from(event.target.files)); event.target.value = ''; }} />
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
        <button onClick={() => cameraInput.current?.click()} className="h-9 px-3 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-1.5"><Camera className="w-4 h-4" /> Câmera</button>
        <button onClick={() => fileInput.current?.click()} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-1.5"><Upload className="w-4 h-4" /> Importar páginas</button>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
        <select value={paper} onChange={(event) => setPaper(event.target.value as 'a4' | 'original')} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-[10px] font-bold"><option value="a4">PDF A4</option><option value="original">Tamanho original</option></select>
        <button disabled={!pages.length || busy === 'pdf'} onClick={() => { setBusy('pdf'); exportScansToPdf(pages, `OrbiDoc-Scan-${new Date().toISOString().slice(0, 10)}.pdf`, { paper }).then(() => notify('PDF digitalizado exportado.', 'success')).catch((error) => notify(error.message, 'error')).finally(() => setBusy(null)); }} className="h-9 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black disabled:opacity-40">Exportar PDF</button>
        <button disabled={!pages.length || busy === 'zip'} onClick={() => { setBusy('zip'); exportScansToZip(pages).then(() => notify('Páginas JPG exportadas em ZIP.', 'success')).catch((error) => notify(error.message, 'error')).finally(() => setBusy(null)); }} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black disabled:opacity-40">JPG em ZIP</button>
        <button disabled={!pages.length || busy === 'ocr'} onClick={() => void ocrAll()} className="h-9 px-3 rounded-xl border border-[#3157F6]/30 text-[#3157F6] dark:text-[#7AA2FF] text-[10px] font-black inline-flex items-center gap-1.5 disabled:opacity-40"><Sparkles className="w-4 h-4" /> OCR multipágina</button>
      </div>

      <div className="grid lg:grid-cols-[180px_minmax(0,1fr)_320px] min-h-[650px]">
        <aside className="border-r border-slate-100 dark:border-slate-800 p-2 overflow-y-auto max-h-[780px]">
          <div className="px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Páginas · {pages.length}</div>
          <div className="space-y-2">
            {pages.map((page, index) => (
              <button key={page.id} onClick={() => { setActiveId(page.id); setEditingCorners(page.perspectiveEnabled); }} className={`w-full rounded-xl border p-2 text-left ${active?.id === page.id ? 'border-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/40' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="aspect-[3/4] rounded-lg bg-slate-100 dark:bg-slate-950 overflow-hidden"><img src={page.sourceUrl} alt="" className="w-full h-full object-cover" /></div>
                <div className="mt-1.5 flex items-center justify-between gap-1"><span className="text-[9px] font-black">Página {index + 1}</span>{page.perspectiveEnabled && <span className="text-[7px] font-black text-cyan-600 dark:text-cyan-300">4 CANTOS</span>}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 p-4 bg-slate-50 dark:bg-[#080D18]/45 flex items-center justify-center overflow-auto">
          {active && active.perspectiveEnabled && editingCorners ? (
            <PerspectiveEditor page={active} onChange={patchCorners} />
          ) : active && previewUrl ? (
            <img src={previewUrl} alt="Prévia digitalizada" className="max-w-full max-h-[720px] object-contain rounded-xl shadow-2xl bg-white" />
          ) : (
            <div className="text-center max-w-md text-slate-400"><Camera className="w-16 h-16 mx-auto opacity-30" /><div className="mt-4 text-sm font-black text-slate-500 dark:text-slate-300">Digitalize sua primeira página</div><div className="mt-1 text-xs">No celular, o botão Câmera solicita a câmera traseira. No desktop, importe fotos ou scans existentes.</div></div>
          )}
        </main>

        <aside className="border-l border-slate-100 dark:border-slate-800 p-3 overflow-y-auto max-h-[780px]">
          {active ? <div className="space-y-4">
            <div className="flex items-center justify-between"><div><div className="text-xs font-black">Ajustes da página</div><div className="text-[9px] text-slate-400 truncate max-w-[190px]">{active.name}</div></div><button onClick={() => removePage(active)} className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash className="w-4 h-4 mx-auto" /></button></div>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => movePage(-1)} className="h-8 rounded-lg border text-[9px] font-bold inline-flex items-center justify-center gap-1"><ArrowUp className="w-3 h-3" /> Antes</button><button onClick={() => movePage(1)} className="h-8 rounded-lg border text-[9px] font-bold inline-flex items-center justify-center gap-1"><ArrowDown className="w-3 h-3" /> Depois</button></div>
            <div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Filtro</div><div className="grid grid-cols-2 gap-1.5">{FILTERS.map((filter) => <button key={filter.id} onClick={() => patchActive({ filter: filter.id })} className={`h-8 rounded-lg text-[9px] font-black border ${active.filter === filter.id ? 'border-[#3157F6] text-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/30' : 'border-slate-200 dark:border-slate-700'}`}>{filter.label}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => patchActive({ rotation: ((active.rotation + 90) % 360) as ScanPage['rotation'] })} className="h-9 rounded-xl border text-[9px] font-black inline-flex items-center justify-center gap-1.5"><Rotate className="w-3.5 h-3.5" /> Girar 90°</button><button disabled={busy === 'crop'} onClick={() => void autoCrop()} className="h-9 rounded-xl border text-[9px] font-black inline-flex items-center justify-center gap-1.5"><Crop className="w-3.5 h-3.5" /> {active.perspectiveEnabled ? 'Auto 4 cantos' : 'Auto recorte'}</button></div>

            <div className={`rounded-2xl border p-3 ${active.perspectiveEnabled ? 'border-cyan-300 dark:border-cyan-800 bg-cyan-50/70 dark:bg-cyan-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-center gap-3">
                <button type="button" role="switch" aria-checked={active.perspectiveEnabled} onClick={togglePerspective} className={`relative w-10 h-6 rounded-full transition ${active.perspectiveEnabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${active.perspectiveEnabled ? 'left-5' : 'left-1'}`} /></button>
                <div className="min-w-0 flex-1"><div className="text-[10px] font-black">Perspectiva · 4 cantos</div><div className="text-[8px] leading-relaxed text-slate-500 dark:text-slate-400">Corrige fotos tiradas de lado ou documentos inclinados antes do filtro e do OCR.</div></div>
              </div>
              {active.perspectiveEnabled && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setEditingCorners(true)} className={`h-8 rounded-lg border text-[8px] font-black ${editingCorners ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 bg-white/70 dark:bg-slate-950/40' : 'border-slate-200 dark:border-slate-700'}`}>Ajustar cantos</button><button onClick={() => setEditingCorners(false)} className={`h-8 rounded-lg border text-[8px] font-black ${!editingCorners ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 bg-white/70 dark:bg-slate-950/40' : 'border-slate-200 dark:border-slate-700'}`}>Ver resultado</button></div>}
            </div>

            <Range label="Brilho" value={active.brightness} min={70} max={140} onChange={(brightness) => patchActive({ brightness })} />
            <Range label="Contraste" value={active.contrast} min={70} max={170} onChange={(contrast) => patchActive({ contrast })} />
            {!active.perspectiveEnabled && <div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Recorte manual (%)</div><div className="space-y-2"><Range label="Esquerda" value={active.crop.left} min={0} max={Math.max(0, active.crop.right - 5)} onChange={(left) => patchActive({ crop: { ...active.crop, left } })} /><Range label="Direita" value={active.crop.right} min={Math.min(100, active.crop.left + 5)} max={100} onChange={(right) => patchActive({ crop: { ...active.crop, right } })} /><Range label="Topo" value={active.crop.top} min={0} max={Math.max(0, active.crop.bottom - 5)} onChange={(top) => patchActive({ crop: { ...active.crop, top } })} /><Range label="Base" value={active.crop.bottom} min={Math.min(100, active.crop.top + 5)} max={100} onChange={(bottom) => patchActive({ crop: { ...active.crop, bottom } })} /></div></div>}
            {active.perspectiveEnabled && <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-[8px] leading-relaxed text-slate-500 dark:text-slate-400">No modo <strong>Ajustar cantos</strong>, arraste TL, TR, BR e BL até os quatro vértices do papel. O resultado corrigido é usado no PDF, JPG, OCR e ZIP.</div>}
            <button onClick={restorePage} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center justify-center gap-1.5"><Refresh className="w-3.5 h-3.5" /> Restaurar página</button>
          </div> : <div className="text-[10px] text-slate-400">Selecione uma página.</div>}
        </aside>
      </div>
    </section>
  );
};

const CORNER_LIMITS: Record<keyof ScanCorners, { minX: number; maxX: number; minY: number; maxY: number; label: string }> = {
  topLeft: { minX: 0, maxX: 60, minY: 0, maxY: 60, label: 'TL' },
  topRight: { minX: 40, maxX: 100, minY: 0, maxY: 60, label: 'TR' },
  bottomRight: { minX: 40, maxX: 100, minY: 40, maxY: 100, label: 'BR' },
  bottomLeft: { minX: 0, maxX: 60, minY: 40, maxY: 100, label: 'BL' },
};

const clampPercent = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const PerspectiveEditor: React.FC<{ page: ScanPage; onChange: (corners: ScanCorners) => void }> = ({ page, onChange }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const keys = Object.keys(CORNER_LIMITS) as Array<keyof ScanCorners>;
  const points = keys.map((key) => `${page.corners[key].x},${page.corners[key].y}`).join(' ');

  const moveCorner = (key: keyof ScanCorners, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!frameRef.current || !(event.buttons & 1)) return;
    const rect = frameRef.current.getBoundingClientRect();
    const limits = CORNER_LIMITS[key];
    const x = clampPercent(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, limits.minX, limits.maxX);
    const y = clampPercent(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, limits.minY, limits.maxY);
    onChange({ ...page.corners, [key]: { x, y } });
  };

  return <div className="w-full flex flex-col items-center gap-3">
    <div className="text-[9px] font-black text-cyan-700 dark:text-cyan-300 bg-white/90 dark:bg-slate-900/90 border border-cyan-200 dark:border-cyan-800 rounded-full px-3 py-1.5 shadow-sm">Arraste as 4 alças para os cantos reais do documento</div>
    <div ref={frameRef} className="relative inline-block max-w-full rounded-xl overflow-hidden shadow-2xl bg-slate-900 touch-none select-none">
      <img src={page.sourceUrl} alt="Ajuste de perspectiva" draggable={false} className="block max-w-full max-h-[680px] object-contain pointer-events-none select-none" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={points} fill="rgba(34,211,238,0.10)" stroke="rgba(34,211,238,0.95)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" /></svg>
      {keys.map((key) => {
        const point = page.corners[key];
        const label = CORNER_LIMITS[key].label;
        return <button key={key} type="button" aria-label={`Mover canto ${label}`} title={`Canto ${label}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); moveCorner(key, event); }} onPointerMove={(event) => moveCorner(key, event)} className="absolute z-10 w-9 h-9 -ml-[18px] -mt-[18px] rounded-full border-2 border-white bg-cyan-600 text-white text-[8px] font-black shadow-xl touch-none cursor-move active:scale-110" style={{ left: `${point.x}%`, top: `${point.y}%` }}>{label}</button>;
      })}
    </div>
  </div>;
};

const Range: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange }) => <label className="block"><div className="flex justify-between text-[9px] font-bold"><span>{label}</span><span className="text-slate-400">{Math.round(value)}</span></div><input type="range" value={value} min={min} max={max} step={1} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[#3157F6]" /></label>;

const ReaderStudio: React.FC<{ notify: (message: string, type?: 'success' | 'error') => void; onSendToAiText?: (text: string) => void }> = ({ notify, onSendToAiText }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const documentRef = useRef<ReaderDocument | null>(null);
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [fontSize, setFontSize] = useState(17);
  const [readerTheme, setReaderTheme] = useState<'paper' | 'sepia' | 'dark'>('paper');
  const [archivePath, setArchivePath] = useState('');
  const [archiveContent, setArchiveContent] = useState<{ kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string } | null>(null);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => () => releaseReaderDocument(documentRef.current), []);

  const openFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      releaseReaderDocument(documentRef.current);
      documentRef.current = null;
      const next = await readDocumentFile(file);
      documentRef.current = next;
      setDocument(next);
      setArchivePath('');
      setArchiveContent(null);
      setQuery('');
      if (next.kind === 'unsupported') notify(`.${next.extension} ainda não possui visualização dedicada.`, 'error');
      else notify(`${file.name} aberto localmente.`, 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha ao abrir o arquivo.', 'error'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const searchable = archiveContent?.text || document?.text || '';
  const occurrences = useMemo(() => { const needle = query.trim().toLowerCase(); if (!needle || !searchable) return 0; return searchable.toLowerCase().split(needle).length - 1; }, [query, searchable]);
  const surface = readerTheme === 'dark' ? 'bg-[#0E1118] text-slate-100' : readerTheme === 'sepia' ? 'bg-[#F4ECD8] text-[#3B3428]' : 'bg-white text-slate-800';

  const selectArchive = async (path: string) => {
    if (!document) return;
    setArchivePath(path);
    try { setArchiveContent(await readArchiveEntry(document, path)); }
    catch (error) { notify(error instanceof Error ? error.message : 'Falha ao abrir item do ZIP.', 'error'); }
  };

  const render = () => {
    if (!document) return <div className="h-full flex items-center justify-center text-center text-slate-400"><div><Book className="w-16 h-16 mx-auto opacity-30" /><div className="mt-4 text-sm font-black text-slate-500 dark:text-slate-300">Abra um arquivo para começar</div><div className="mt-1 text-xs max-w-lg">PDF, EPUB, ZIP, DOCX, XLS/XLSX, HTML, Markdown, TXT, JSON, XML, CSV, código e imagens.</div></div></div>;
    if (document.kind === 'pdf' && document.objectUrl) return <iframe src={document.objectUrl} title={document.name} className="w-full h-full bg-white border-0" />;
    if (document.kind === 'image' && document.objectUrl) return <div className="h-full flex items-center justify-center p-5"><img src={document.objectUrl} alt={document.name} className="max-w-full max-h-full object-contain" /></div>;
    if (document.kind === 'zip') {
      if (!archivePath) return <div className="h-full flex items-center justify-center text-xs text-slate-400">Selecione um item do ZIP na lateral.</div>;
      if (archiveContent?.kind === 'image' && archiveContent.dataUrl) return <div className="h-full flex items-center justify-center p-5"><img src={archiveContent.dataUrl} alt={archivePath} className="max-w-full max-h-full object-contain" /></div>;
      if (archiveContent?.html) return <article className="orbidoc-reader-prose p-8 max-w-4xl mx-auto" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: archiveContent.html }} />;
      if (archiveContent?.text !== undefined) return <pre className="whitespace-pre-wrap break-words p-8 max-w-5xl mx-auto font-mono" style={{ fontSize: Math.max(12, fontSize - 2) }}>{archiveContent.text}</pre>;
      return <div className="h-full flex items-center justify-center text-xs text-slate-400">Arquivo binário dentro do ZIP. Extração/visualização dedicada ainda não disponível.</div>;
    }
    if (document.html) return <article className="orbidoc-reader-prose p-8 md:p-12 max-w-4xl mx-auto" style={{ fontSize, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: document.html }} />;
    if (document.text !== undefined) return <pre className="whitespace-pre-wrap break-words p-8 md:p-12 max-w-5xl mx-auto font-sans" style={{ fontSize, lineHeight: 1.7 }}>{document.text}</pre>;
    return <div className="h-full flex items-center justify-center text-xs text-slate-400">Prévia não disponível.</div>;
  };

  return <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
    <input ref={fileInput} type="file" accept={READER_ACCEPT} className="hidden" onChange={(event) => void openFile(event.target.files?.[0])} />
    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
      <button disabled={busy} onClick={() => fileInput.current?.click()} className="h-9 px-3 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-1.5"><FolderOpen className="w-4 h-4" /> Abrir arquivo</button>
      <div className="relative flex-1 min-w-[180px] max-w-md"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no conteúdo…" className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-[10px] outline-none" />{query && <span className="absolute right-3 top-2.5 text-[9px] text-slate-400">{occurrences}</span>}</div>
      <select value={readerTheme} onChange={(event) => setReaderTheme(event.target.value as 'paper' | 'sepia' | 'dark')} className="h-9 rounded-xl border bg-white dark:bg-slate-950 px-2 text-[10px] font-bold"><option value="paper">Papel</option><option value="sepia">Sépia</option><option value="dark">Escuro</option></select>
      <label className="h-9 px-2 rounded-xl border flex items-center gap-2 text-[9px] font-bold"><span>Aa</span><input type="range" min={12} max={28} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} className="w-20 accent-[#3157F6]" /></label>
      {searchable.trim() && <button onClick={() => onSendToAiText?.(searchable)} className="h-9 px-3 rounded-xl border text-[9px] font-black inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Enviar texto à IA</button>}
    </div>
    <div className={`grid ${document?.kind === 'zip' ? 'md:grid-cols-[280px_minmax(0,1fr)]' : ''} min-h-[700px] max-h-[850px] ${surface}`}>
      {document?.kind === 'zip' && <aside className="border-r border-black/10 dark:border-white/10 overflow-y-auto p-2"><div className="px-2 py-2"><div className="text-[10px] font-black">{document.title}</div><div className="text-[9px] opacity-60">{formatBytes(document.size)} · {document.archiveEntries?.length || 0} itens</div></div><div className="space-y-1">{document.archiveEntries?.filter((entry) => !entry.directory).map((entry) => <button key={entry.path} onClick={() => void selectArchive(entry.path)} className={`w-full rounded-lg px-2 py-2 text-left text-[9px] truncate ${archivePath === entry.path ? 'bg-[#3157F6] text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`} title={entry.path}>{entry.path}</button>)}</div></aside>}
      <main className="overflow-auto min-w-0">{render()}</main>
    </div>
  </section>;
};
