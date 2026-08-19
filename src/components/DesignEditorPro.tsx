import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconCircle as Circle,
  IconCopy as Copy,
  IconDownload as Download,
  IconLock as Lock,
  IconLockOpen as LockOpen,
  IconPhoto as Photo,
  IconRectangle as Rectangle,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconTypography as Type,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';

interface DesignEditorProProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  onSendToOcr?: (textOrImage: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

type DesignObject = {
  id: string;
  type: 'text' | 'rect' | 'circle' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: CanvasTextAlign;
  locked?: boolean;
};

type DesignState = { title: string; width: number; height: number; background: string; objects: DesignObject[] };
type ExportFormat = 'png' | 'jpg' | 'webp' | 'avif' | 'pdf';

const PRESETS = [
  { id: 'post', label: 'Post quadrado', width: 1080, height: 1080 },
  { id: 'story', label: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'presentation', label: 'Apresentação 16:9', width: 1920, height: 1080 },
  { id: 'youtube', label: 'Thumbnail', width: 1280, height: 720 },
  { id: 'banner', label: 'Banner', width: 1600, height: 900 },
  { id: 'card', label: 'Cartão', width: 1050, height: 600 },
];

const TEMPLATES: Array<{ label: string; background: string; objects: Omit<DesignObject, 'id'>[] }> = [
  {
    label: 'Editorial limpo',
    background: '#f8fafc',
    objects: [
      { type: 'text', x: 80, y: 100, width: 820, height: 180, rotation: 0, opacity: 1, fill: '#0f172a', content: 'SUA IDEIA\nEM DESTAQUE', fontSize: 72, fontFamily: 'Inter', fontWeight: 800, textAlign: 'left' },
      { type: 'rect', x: 80, y: 310, width: 180, height: 18, rotation: 0, opacity: 1, fill: '#4f46e5', content: '', fontSize: 16, fontFamily: 'Inter', fontWeight: 400, textAlign: 'left' },
      { type: 'text', x: 80, y: 370, width: 760, height: 120, rotation: 0, opacity: 1, fill: '#475569', content: 'Edite textos, cores, imagens e camadas diretamente no OrbiDoc.', fontSize: 34, fontFamily: 'Inter', fontWeight: 500, textAlign: 'left' },
    ],
  },
  {
    label: 'Promoção escura',
    background: '#0f172a',
    objects: [
      { type: 'text', x: 90, y: 120, width: 780, height: 90, rotation: 0, opacity: 1, fill: '#a5b4fc', content: 'NOVIDADE', fontSize: 46, fontFamily: 'Inter', fontWeight: 800, textAlign: 'left' },
      { type: 'text', x: 90, y: 240, width: 830, height: 240, rotation: 0, opacity: 1, fill: '#ffffff', content: 'Uma mensagem\nque chama atenção', fontSize: 76, fontFamily: 'Inter', fontWeight: 900, textAlign: 'left' },
      { type: 'rect', x: 90, y: 560, width: 350, height: 90, rotation: 0, opacity: 1, fill: '#4f46e5', content: '', fontSize: 16, fontFamily: 'Inter', fontWeight: 400, textAlign: 'left' },
      { type: 'text', x: 120, y: 585, width: 290, height: 45, rotation: 0, opacity: 1, fill: '#ffffff', content: 'SAIBA MAIS', fontSize: 28, fontFamily: 'Inter', fontWeight: 800, textAlign: 'center' },
    ],
  },
];

const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Design';
const defaultDesign = (title: string): DesignState => ({ title, width: 1080, height: 1080, background: '#ffffff', objects: [] });

const makeObject = (type: DesignObject['type'], width: number, height: number): DesignObject => ({
  id: crypto.randomUUID(),
  type,
  x: Math.round(width * 0.22),
  y: Math.round(height * 0.22),
  width: type === 'text' ? Math.round(width * 0.56) : Math.round(width * 0.3),
  height: type === 'text' ? Math.round(height * 0.16) : Math.round(height * 0.28),
  rotation: 0,
  opacity: 1,
  fill: type === 'text' ? '#0f172a' : '#4f46e5',
  content: type === 'text' ? 'Novo texto' : '',
  fontSize: Math.max(24, Math.round(width * 0.045)),
  fontFamily: 'Inter',
  fontWeight: 700,
  textAlign: 'left',
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Não foi possível carregar uma imagem do design.'));
  image.src = src;
});

const wrappedLines = (ctx: CanvasRenderingContext2D, content: string, width: number) => {
  const lines: string[] = [];
  for (const paragraph of content.split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    const words = paragraph.split(/\s+/);
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > width && line) { lines.push(line); line = word; }
      else line = candidate;
    });
    if (line) lines.push(line);
  }
  return lines;
};

export const DesignEditorPro: React.FC<DesignEditorProProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  onSendToOcr,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `orbidoc_design_v3_${project.id}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [design, setDesign] = useState<DesignState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved).design || defaultDesign(project.title);
      if (project.content && typeof project.content === 'object' && Array.isArray((project.content as any).objects)) return project.content as DesignState;
    } catch { /* default */ }
    return defaultDesign(project.title || 'Novo design');
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [zoom, setZoom] = useState(70);
  const [lastSaved, setLastSaved] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const selected = design.objects.find((object) => object.id === selectedId) || null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = {
        ...project,
        title: design.title,
        content: design,
        previewSnippet: `${design.width}×${design.height} · ${design.objects.length} elemento(s)`,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify({ design, updatedAt: updated.updatedAt }));
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [design, project.id]);

  const updateObject = (id: string, patch: Partial<DesignObject>) => {
    setDesign((current) => ({ ...current, objects: current.objects.map((object) => object.id === id ? { ...object, ...patch } : object) }));
  };

  const addObject = (type: DesignObject['type']) => {
    const object = makeObject(type, design.width, design.height);
    setDesign((current) => ({ ...current, objects: [...current.objects, object] }));
    setSelectedId(object.id);
  };

  const addImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showNotification('Selecione uma imagem válida.', 'error'); return; }
    if (file.size > 15 * 1024 * 1024) { showNotification('A imagem precisa ter menos de 15 MB.', 'error'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await loadImage(dataUrl).catch(() => null);
    const ratio = image ? image.naturalWidth / Math.max(1, image.naturalHeight) : 1.4;
    const width = Math.round(design.width * 0.45);
    const height = Math.round(width / Math.max(0.25, ratio));
    const object = { ...makeObject('image', design.width, design.height), content: dataUrl, width, height: Math.min(height, Math.round(design.height * 0.55)) };
    setDesign((current) => ({ ...current, objects: [...current.objects, object] }));
    setSelectedId(object.id);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID(), x: selected.x + 24, y: selected.y + 24 };
    setDesign((current) => ({ ...current, objects: [...current.objects, copy] }));
    setSelectedId(copy.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setDesign((current) => ({ ...current, objects: current.objects.filter((object) => object.id !== selectedId) }));
    setSelectedId(null);
  };

  const moveLayer = (direction: 'up' | 'down') => {
    if (!selectedId) return;
    setDesign((current) => {
      const index = current.objects.findIndex((object) => object.id === selectedId);
      const target = direction === 'up' ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= current.objects.length) return current;
      const objects = [...current.objects];
      [objects[index], objects[target]] = [objects[target], objects[index]];
      return { ...current, objects };
    });
  };

  const applyTemplate = (index: number) => {
    const template = TEMPLATES[index];
    setDesign((current) => ({ ...current, background: template.background, objects: template.objects.map((object) => ({ ...object, id: crypto.randomUUID() })) }));
    setSelectedId(null);
  };

  const renderCanvas = useCallback(async (target?: HTMLCanvasElement) => {
    const canvas = target || canvasRef.current || document.createElement('canvas');
    canvas.width = design.width;
    canvas.height = design.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível.');
    ctx.clearRect(0, 0, design.width, design.height);
    ctx.fillStyle = design.background;
    ctx.fillRect(0, 0, design.width, design.height);

    for (const object of design.objects) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, object.opacity));
      ctx.translate(object.x + object.width / 2, object.y + object.height / 2);
      ctx.rotate(object.rotation * Math.PI / 180);
      const x = -object.width / 2;
      const y = -object.height / 2;
      if (object.type === 'rect') {
        ctx.fillStyle = object.fill; ctx.fillRect(x, y, object.width, object.height);
      } else if (object.type === 'circle') {
        ctx.fillStyle = object.fill; ctx.beginPath(); ctx.ellipse(0, 0, object.width / 2, object.height / 2, 0, 0, Math.PI * 2); ctx.fill();
      } else if (object.type === 'text') {
        ctx.fillStyle = object.fill;
        ctx.font = `${object.fontWeight} ${object.fontSize}px ${object.fontFamily}, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = object.textAlign;
        const anchor = object.textAlign === 'center' ? 0 : object.textAlign === 'right' ? object.width / 2 : -object.width / 2;
        const lines = wrappedLines(ctx, object.content, object.width);
        const lineHeight = object.fontSize * 1.16;
        lines.slice(0, Math.max(1, Math.floor(object.height / lineHeight))).forEach((text, index) => ctx.fillText(text, anchor, y + index * lineHeight));
      } else if (object.type === 'image' && object.content) {
        const image = await loadImage(object.content).catch(() => null);
        if (image) ctx.drawImage(image, x, y, object.width, object.height);
      }
      ctx.restore();
    }
    return canvas;
  }, [design]);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      try { if (!cancelled) await renderCanvas(canvasRef.current || undefined); } catch { /* preview can recover on next render */ }
    };
    void draw();
    return () => { cancelled = true; };
  }, [renderCanvas]);

  const exportDesign = async (format: ExportFormat) => {
    setExportBusy(true);
    try {
      const exportCanvas = document.createElement('canvas');
      const canvas = await renderCanvas(exportCanvas);
      const base = cleanFileName(design.title);
      if (format === 'pdf') {
        const landscape = design.width > design.height;
        const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / design.width, pageHeight / design.height);
        const width = design.width * ratio;
        const height = design.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, 'FAST');
        saveAs(pdf.output('blob'), `${base}.pdf`);
      } else {
        let renderCanvas = canvas;
        if (format === 'jpg') {
          renderCanvas = document.createElement('canvas');
          renderCanvas.width = canvas.width;
          renderCanvas.height = canvas.height;
          const ctx = renderCanvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D indisponível.');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(canvas, 0, 0);
        }
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
        const blob = await new Promise<Blob>((resolve, reject) => renderCanvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Falha ao codificar ${format.toUpperCase()}.`)), mime, 0.92));
        if (format === 'avif' && blob.type !== 'image/avif') throw new Error('Este navegador não oferece codificação AVIF. Use PNG, JPG ou WebP.');
        saveAs(blob, `${base}.${format}`);
      }
      onSaveToHistory?.({ type: 'canva', title: design.title, summary: `${design.width}×${design.height} exportado como ${format.toUpperCase()}.`, tags: ['Design', format.toUpperCase()] });
      showNotification(`Design exportado como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao exportar design.', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const generateLayout = async () => {
    const prompt = window.prompt('Descreva o design que você quer criar:');
    if (!prompt?.trim()) return;
    setAiBusy(true);
    try {
      const answer = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: `Crie um layout gráfico simples em JSON estrito. Canvas: ${design.width}x${design.height}. Formato: {"background":"#RRGGBB","objects":[{"type":"text|rect|circle","x":0,"y":0,"width":100,"height":100,"fill":"#RRGGBB","content":"texto","fontSize":40,"fontWeight":700,"textAlign":"left|center|right"}]}. Use coordenadas dentro do canvas, cores hexadecimais válidas e no máximo 10 objetos. Não escreva Markdown fora do JSON.` },
        { role: 'user', content: prompt.trim() },
      ]);
      const match = answer.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('A IA não retornou um layout JSON válido.');
      const parsed = JSON.parse(match[0]);
      const safeColor = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
      const objects: DesignObject[] = (Array.isArray(parsed.objects) ? parsed.objects : []).slice(0, 10).filter((item: any) => ['text', 'rect', 'circle'].includes(item.type)).map((item: any) => ({
        ...makeObject(item.type, design.width, design.height),
        id: crypto.randomUUID(),
        type: item.type,
        x: Math.max(0, Math.min(design.width - 20, Number(item.x) || 0)),
        y: Math.max(0, Math.min(design.height - 20, Number(item.y) || 0)),
        width: Math.max(20, Math.min(design.width, Number(item.width) || 200)),
        height: Math.max(20, Math.min(design.height, Number(item.height) || 100)),
        fill: safeColor(item.fill, item.type === 'text' ? '#0f172a' : '#4f46e5'),
        content: String(item.content || '').slice(0, 500),
        fontSize: Math.max(10, Math.min(180, Number(item.fontSize) || 40)),
        fontWeight: Math.max(100, Math.min(900, Number(item.fontWeight) || 700)),
        textAlign: ['left', 'center', 'right'].includes(item.textAlign) ? item.textAlign : 'left',
      }));
      if (!objects.length) throw new Error('A IA não gerou elementos utilizáveis.');
      setDesign((current) => ({ ...current, background: safeColor(parsed.background, current.background), objects }));
      setSelectedId(null);
      showNotification('Layout gerado pela IA.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao gerar layout.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (design.width / rect.width), y: (event.clientY - rect.top) * (design.height / rect.height) };
  };

  const hitObject = (x: number, y: number) => [...design.objects].reverse().find((object) => !object.locked && x >= object.x && x <= object.x + object.width && y >= object.y && y <= object.y + object.height);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    const object = hitObject(point.x, point.y);
    if (!object) { setSelectedId(null); setDragging(null); return; }
    setSelectedId(object.id);
    setDragging({ id: object.id, dx: point.x - object.x, dy: point.y - object.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const point = canvasPoint(event);
    const object = design.objects.find((item) => item.id === dragging.id);
    if (!object || object.locked) return;
    updateObject(object.id, {
      x: Math.max(-object.width + 20, Math.min(design.width - 20, point.x - dragging.dx)),
      y: Math.max(-object.height + 20, Math.min(design.height - 20, point.y - dragging.dy)),
    });
  };

  const onPointerUp = () => setDragging(null);

  const selectedText = useMemo(() => design.objects.filter((object) => object.type === 'text').map((object) => object.content).join('\n').trim(), [design.objects]);

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <input value={design.title} onChange={(event) => setDesign((current) => ({ ...current, title: event.target.value }))} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome do design" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <button onClick={generateLayout} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Gerando…' : 'Layout com IA'}</button>
        <div className="relative group"><button disabled={exportBusy} className="h-8 px-2.5 rounded-lg bg-fuchsia-600 text-white text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Download className="w-3.5 h-3.5" />{exportBusy ? 'Exportando…' : 'Exportar'}</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['png','jpg','webp','avif','pdf'] as ExportFormat[]).map((format) => <button key={format} onClick={() => void exportDesign(format)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_285px]">
        <aside className="border-r border-slate-200 dark:border-slate-800 p-3 space-y-4 overflow-y-auto max-h-[780px]">
          <section><div className="text-[10px] font-black text-slate-400 uppercase mb-2">Adicionar</div><div className="grid grid-cols-2 gap-2"><ToolButton icon={Type} label="Texto" onClick={() => addObject('text')} /><ToolButton icon={Rectangle} label="Retângulo" onClick={() => addObject('rect')} /><ToolButton icon={Circle} label="Círculo" onClick={() => addObject('circle')} /><ToolButton icon={Photo} label="Imagem" onClick={() => imageInputRef.current?.click()} /></div><input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void addImage(event.target.files?.[0]); event.target.value = ''; }} /></section>
          <section><div className="text-[10px] font-black text-slate-400 uppercase mb-2">Tamanho</div><select value={`${design.width}x${design.height}`} onChange={(event) => { const preset = PRESETS.find((item) => `${item.width}x${item.height}` === event.target.value); if (preset) setDesign((current) => ({ ...current, width: preset.width, height: preset.height })); }} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-[10px]">{PRESETS.map((preset) => <option key={preset.id} value={`${preset.width}x${preset.height}`}>{preset.label} · {preset.width}×{preset.height}</option>)}</select></section>
          <section><div className="text-[10px] font-black text-slate-400 uppercase mb-2">Templates</div><div className="space-y-2">{TEMPLATES.map((template, index) => <button key={template.label} onClick={() => applyTemplate(index)} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800">{template.label}</button>)}</div></section>
          <section><div className="text-[10px] font-black text-slate-400 uppercase mb-2">Camadas</div><div className="space-y-1">{[...design.objects].reverse().map((object) => <button key={object.id} onClick={() => setSelectedId(object.id)} className={`w-full h-9 px-2 rounded-lg text-left text-[10px] font-bold flex items-center gap-2 ${selectedId === object.id ? 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><span className="truncate flex-1">{object.type === 'text' ? object.content.split('\n')[0] || 'Texto' : object.type === 'image' ? 'Imagem' : object.type === 'circle' ? 'Círculo' : 'Retângulo'}</span>{object.locked && <Lock className="w-3 h-3" />}</button>)}</div></section>
        </aside>

        <main className="min-h-[580px] bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-7 overflow-auto flex items-center justify-center">
          <div className="relative" style={{ width: `${design.width * (zoom / 100)}px`, height: `${design.height * (zoom / 100)}px`, maxWidth: '100%' }}>
            <canvas ref={canvasRef} width={design.width} height={design.height} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="absolute inset-0 w-full h-full bg-white shadow-2xl touch-none cursor-default" />
            {selected && <div className="absolute pointer-events-none border-2 border-fuchsia-500" style={{ left: `${selected.x * zoom / 100}px`, top: `${selected.y * zoom / 100}px`, width: `${selected.width * zoom / 100}px`, height: `${selected.height * zoom / 100}px`, transform: `rotate(${selected.rotation}deg)`, transformOrigin: 'center' }} />}
          </div>
        </main>

        <aside className="border-l border-slate-200 dark:border-slate-800 p-3 overflow-y-auto max-h-[780px] space-y-4">
          <div><div className="text-[10px] font-black text-slate-400 uppercase">Canvas</div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px]">Fundo<input type="color" value={design.background} onChange={(event) => setDesign((current) => ({ ...current, background: event.target.value }))} className="mt-1 w-full h-9 rounded-lg" /></label><label className="text-[10px]">Zoom<select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2"><option value="35">35%</option><option value="50">50%</option><option value="70">70%</option><option value="100">100%</option></select></label></div></div>
          {selected ? <>
            <div className="flex gap-1"><button onClick={duplicateSelected} className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-1"><Copy className="w-3.5 h-3.5" /> Duplicar</button><button onClick={() => moveLayer('up')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button><button onClick={() => moveLayer('down')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"><ArrowDown className="w-4 h-4" /></button><button onClick={() => updateObject(selected.id, { locked: !selected.locked })} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">{selected.locked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
            {selected.type === 'text' && <div><label className="text-[10px] font-black text-slate-400 uppercase">Texto</label><textarea value={selected.content} onChange={(event) => updateObject(selected.id, { content: event.target.value })} className="mt-1 w-full min-h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs" /><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px]">Tamanho<input type="number" min="8" max="240" value={selected.fontSize} onChange={(event) => updateObject(selected.id, { fontSize: Math.max(8, Math.min(240, Number(event.target.value) || 8)) })} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2" /></label><label className="text-[10px]">Peso<select value={selected.fontWeight} onChange={(event) => updateObject(selected.id, { fontWeight: Number(event.target.value) })} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2"><option value="400">Regular</option><option value="500">Médio</option><option value="700">Negrito</option><option value="900">Black</option></select></label></div></div>}
            {selected.type === 'image' && <div><button onClick={() => imageInputRef.current?.click()} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Trocar imagem</button>{onSendToOcr && <button onClick={() => onSendToOcr(selected.content)} className="mt-1 w-full h-9 rounded-xl text-[10px] font-bold text-cyan-600">Enviar para OCR</button>}</div>}
            {selected.type !== 'image' && <label className="text-[10px]">Cor<input type="color" value={selected.fill} onChange={(event) => updateObject(selected.id, { fill: event.target.value })} className="mt-1 w-full h-9 rounded-lg" /></label>}
            <div className="grid grid-cols-2 gap-2"><NumberField label="X" value={selected.x} onChange={(value) => updateObject(selected.id, { x: value })} /><NumberField label="Y" value={selected.y} onChange={(value) => updateObject(selected.id, { y: value })} /><NumberField label="Largura" value={selected.width} min={10} onChange={(value) => updateObject(selected.id, { width: Math.max(10, value) })} /><NumberField label="Altura" value={selected.height} min={10} onChange={(value) => updateObject(selected.id, { height: Math.max(10, value) })} /><NumberField label="Rotação" value={selected.rotation} onChange={(value) => updateObject(selected.id, { rotation: value })} /><label className="text-[10px]">Opacidade<input type="range" min="0" max="1" step="0.05" value={selected.opacity} onChange={(event) => updateObject(selected.id, { opacity: Number(event.target.value) })} className="mt-2 w-full" /></label></div>
            <button onClick={removeSelected} className="w-full h-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-black inline-flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Excluir elemento</button>
          </> : <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-5 text-center text-[11px] text-slate-400">Selecione um elemento no canvas ou na lista de camadas.</div>}
          {selectedText && <div className="text-[10px] text-slate-400">Texto no design: {selectedText.length} caracteres</div>}
        </aside>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => <button onClick={onClick} className="h-16 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-[10px] font-bold"><Icon className="w-5 h-5 text-fuchsia-600" />{label}</button>;

const NumberField: React.FC<{ label: string; value: number; min?: number; onChange: (value: number) => void }> = ({ label, value, min, onChange }) => <label className="text-[10px]">{label}<input type="number" min={min} value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2" /></label>;
