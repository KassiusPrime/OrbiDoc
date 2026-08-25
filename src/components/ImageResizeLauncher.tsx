import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowsMaximize as Resize,
  IconDownload as Download,
  IconLock as Lock,
  IconLockOpen as LockOpen,
  IconPhoto as Photo,
  IconTrash as Trash,
  IconUpload as Upload,
  IconX as X,
} from '@tabler/icons-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { computeResizePlacement, computeResizeTarget, outputExtension, outputMimeType, type ResizeFit, type ResizeMode, type ResizeOutputFormat } from '../lib/imageResize';

type InputImage = { id: string; file: File; url: string; width: number; height: number };
type ResultImage = { id: string; name: string; blob: Blob; url: string; width: number; height: number };
const PRESETS = [{ label: 'Full HD', width: 1920, height: 1080 }, { label: 'Quadrado', width: 1080, height: 1080 }, { label: 'Story', width: 1080, height: 1920 }, { label: 'HD', width: 1280, height: 720 }, { label: 'A4', width: 1240, height: 1754 }];
const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
const dimensions = (url: string) => loadImage(url).then((image) => ({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }));

export const ImageResizeLauncher: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InputImage[]>([]);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [mode, setMode] = useState<ResizeMode>('pixels');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [percent, setPercent] = useState(50);
  const [lockAspect, setLockAspect] = useState(true);
  const [fit, setFit] = useState<ResizeFit>('contain');
  const [format, setFormat] = useState<ResizeOutputFormat>('webp');
  const [quality, setQuality] = useState(90);
  const [background, setBackground] = useState('#ffffff');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const show = () => setOpen(true);
    const keyboard = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') { event.preventDefault(); setOpen(true); } if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('orbidoc:open-image-resizer', show); window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('orbidoc:open-image-resizer', show); window.removeEventListener('keydown', keyboard); };
  }, []);
  useEffect(() => () => { items.forEach((item) => URL.revokeObjectURL(item.url)); results.forEach((item) => URL.revokeObjectURL(item.url)); }, []);

  const addFiles = async (files: FileList | File[]) => {
    const next: InputImage[] = [];
    for (const file of Array.from(files).slice(0, 80)) {
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      try { const size = await dimensions(url); next.push({ id: crypto.randomUUID(), file, url, ...size }); } catch { URL.revokeObjectURL(url); }
    }
    setItems((current) => [...current, ...next]);
  };

  const processOne = async (item: InputImage) => {
    const target = computeResizeTarget(item.width, item.height, { mode, width, height, percent, lockAspect });
    const source = await loadImage(item.url);
    const canvas = document.createElement('canvas'); canvas.width = target.width; canvas.height = target.height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D indisponível.');
    if (format === 'jpg' || fit === 'contain') { ctx.fillStyle = background; ctx.fillRect(0, 0, target.width, target.height); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const placement = computeResizePlacement(item.width, item.height, target.width, target.height, fit);
    ctx.drawImage(source, placement.dx, placement.dy, placement.dw, placement.dh);
    const mime = outputMimeType(format);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Falha ao codificar ${format.toUpperCase()}.`)), mime, quality / 100));
    const base = item.file.name.replace(/\.[^/.]+$/, '') || 'imagem';
    return { id: item.id, name: `${base}_${target.width}x${target.height}.${outputExtension(format)}`, blob, url: URL.createObjectURL(blob), ...target } satisfies ResultImage;
  };

  const run = async () => {
    if (!items.length) return;
    setBusy(true); setNotice(''); results.forEach((item) => URL.revokeObjectURL(item.url));
    try {
      const next: ResultImage[] = [];
      for (const item of items) next.push(await processOne(item));
      setResults(next); setNotice(`${next.length} imagem(ns) redimensionada(s) localmente.`);
    } catch (error: any) { setNotice(error?.message || 'Falha no redimensionamento.'); }
    finally { setBusy(false); }
  };
  const downloadAll = async () => {
    if (!results.length) return;
    if (results.length === 1) { saveAs(results[0].blob, results[0].name); return; }
    const zip = new JSZip(); results.forEach((item) => zip.file(item.name, item.blob));
    saveAs(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }), 'OrbiDoc_Imagens_Redimensionadas.zip');
  };
  const previewTarget = useMemo(() => items[0] ? computeResizeTarget(items[0].width, items[0].height, { mode, width, height, percent, lockAspect }) : null, [items, mode, width, height, percent, lockAspect]);

  return <>
    <button onClick={() => setOpen(true)} className="fixed z-[70] right-5 bottom-[140px] lg:bottom-5 h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] shadow-xl text-[10px] font-black inline-flex items-center gap-2 orbidoc-image-resize-trigger" aria-label="Abrir redimensionador de imagens" title="Redimensionar imagens · Ctrl+Shift+R"><Resize className="w-4 h-4 text-[#3157F6] dark:text-[#7AA2FF]" /><span className="hidden xl:inline">Redimensionar</span></button>
    {open && <div className="fixed inset-0 z-[130] bg-slate-950/45 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-label="Redimensionador de imagens" className="w-full max-w-6xl max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#080D18] shadow-2xl overflow-hidden flex flex-col">
      <header className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/50 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center"><Resize className="w-5 h-5" /></div><div className="min-w-0 flex-1"><div className="text-sm font-black">Redimensionador profissional</div><div className="text-[9px] text-slate-400">Lote · pixels ou percentual · proporção · crop/contain · PNG/JPG/WebP · local</div></div><button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4 mx-auto" /></button></header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4"><aside className="lg:col-span-4 space-y-4"><section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4"><input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} /><button onClick={() => inputRef.current?.click()} className="w-full h-11 rounded-xl bg-[#3157F6] text-white text-xs font-black inline-flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Adicionar imagens</button><div className="mt-3 text-[10px] text-slate-500">{items.length} arquivo(s) na fila</div></section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode('pixels')} className={`h-9 rounded-xl text-[10px] font-black border ${mode === 'pixels' ? 'border-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/40 text-[#3157F6] dark:text-[#7AA2FF]' : 'border-slate-200 dark:border-slate-700'}`}>Pixels</button><button onClick={() => setMode('percent')} className={`h-9 rounded-xl text-[10px] font-black border ${mode === 'percent' ? 'border-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/40 text-[#3157F6] dark:text-[#7AA2FF]' : 'border-slate-200 dark:border-slate-700'}`}>Percentual</button></div>{mode === 'pixels' ? <><div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black text-slate-500">Largura<input type="number" min="1" max="8192" value={width} onChange={(event) => setWidth(Number(event.target.value) || 1)} className="mt-1 w-full h-10 rounded-xl border bg-slate-50 dark:bg-slate-950 px-3" /></label><label className="text-[9px] font-black text-slate-500">Altura<input type="number" min="1" max="8192" disabled={lockAspect} value={height} onChange={(event) => setHeight(Number(event.target.value) || 1)} className="mt-1 w-full h-10 rounded-xl border bg-slate-50 dark:bg-slate-950 px-3 disabled:opacity-40" /></label></div><button onClick={() => setLockAspect((value) => !value)} className="h-9 px-3 rounded-xl border text-[10px] font-black inline-flex items-center gap-2">{lockAspect ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />} Proporção {lockAspect ? 'travada' : 'livre'}</button><div className="grid grid-cols-2 gap-1.5">{PRESETS.map((preset) => <button key={preset.label} onClick={() => { setWidth(preset.width); setHeight(preset.height); setLockAspect(false); }} className="rounded-xl border p-2 text-left"><div className="text-[9px] font-black">{preset.label}</div><div className="text-[8px] text-slate-400">{preset.width}×{preset.height}</div></button>)}</div></> : <label className="text-[9px] font-black text-slate-500">Escala: {percent}%<input type="range" min="1" max="400" value={percent} onChange={(event) => setPercent(Number(event.target.value))} className="mt-2 w-full" /></label>}
      <label className="block text-[9px] font-black text-slate-500">Encaixe<select value={fit} onChange={(event) => setFit(event.target.value as ResizeFit)} className="mt-1 w-full h-10 rounded-xl border bg-slate-50 dark:bg-slate-950 px-3 text-[10px]"><option value="contain">Conter · sem corte</option><option value="cover">Preencher · corte central</option><option value="stretch">Esticar · dimensões exatas</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black text-slate-500">Formato<select value={format} onChange={(event) => setFormat(event.target.value as ResizeOutputFormat)} className="mt-1 w-full h-10 rounded-xl border bg-slate-50 dark:bg-slate-950 px-2"><option value="webp">WebP</option><option value="jpg">JPG</option><option value="png">PNG</option></select></label><label className="text-[9px] font-black text-slate-500">Fundo<input type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="mt-1 w-full h-10" /></label></div><label className="block text-[9px] font-black text-slate-500">Qualidade: {quality}%<input type="range" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} disabled={format === 'png'} className="mt-2 w-full disabled:opacity-40" /></label>{previewTarget && <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-2 text-[9px] text-slate-500">Primeira imagem: {items[0].width}×{items[0].height} → <strong>{previewTarget.width}×{previewTarget.height}</strong></div>}<button disabled={busy || !items.length} onClick={() => void run()} className="w-full h-11 rounded-xl bg-[#3157F6] text-white text-xs font-black disabled:opacity-40">{busy ? 'Redimensionando…' : 'Redimensionar lote'}</button></section></aside>
      <main className="lg:col-span-8 space-y-4"><section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] overflow-hidden"><div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><h3 className="text-xs font-black">Fila e resultados</h3>{results.length > 0 && <button onClick={() => void downloadAll()} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-2"><Download className="w-4 h-4" /> {results.length > 1 ? 'Baixar ZIP' : 'Baixar'}</button>}</div><div className="max-h-[650px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">{items.length ? items.map((item) => { const result = results.find((entry) => entry.id === item.id); return <div key={item.id} className="p-3 flex items-center gap-3"><img src={result?.url || item.url} alt="" className="w-16 h-14 rounded-xl object-contain bg-slate-100 dark:bg-slate-950" /><div className="min-w-0 flex-1"><div className="text-[10px] font-black truncate">{item.file.name}</div><div className="mt-0.5 text-[9px] text-slate-400">{item.width}×{item.height}{result ? ` → ${result.width}×${result.height} · ${(result.blob.size / 1024).toFixed(0)} KB` : ''}</div></div>{result && <button onClick={() => saveAs(result.blob, result.name)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="w-4 h-4 mx-auto" /></button>}<button onClick={() => { URL.revokeObjectURL(item.url); setItems((current) => current.filter((entry) => entry.id !== item.id)); setResults((current) => current.filter((entry) => entry.id !== item.id)); }} className="w-9 h-9 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash className="w-4 h-4 mx-auto" /></button></div>; }) : <div className="p-20 text-center text-slate-400"><Photo className="w-16 h-16 mx-auto opacity-25" /><div className="mt-3 text-xs font-black">Adicione imagens para começar</div></div>}</div></section>{notice && <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] px-3 py-2 text-[10px] font-bold">{notice}</div>}</main></div>
    </section></div>}
  </>;
};
