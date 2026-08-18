import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconCircle as Circle,
  IconCopy as Copy,
  IconDownload as Download,
  IconPhoto as Photo,
  IconPlus as Plus,
  IconRectangle as Rectangle,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconTypography as Type,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';

interface DesignEditorProps {
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

type DesignState = {
  title: string;
  width: number;
  height: number;
  background: string;
  objects: DesignObject[];
};

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
      { type: 'text', x: 80, y: 100, width: 820, height: 130, rotation: 0, opacity: 1, fill: '#0f172a', content: 'SUA IDEIA\nEM DESTAQUE', fontSize: 72, fontFamily: 'Inter', fontWeight: 800, textAlign: 'left' },
      { type: 'rect', x: 80, y: 280, width: 180, height: 18, rotation: 0, opacity: 1, fill: '#4f46e5', content: '', fontSize: 16, fontFamily: 'Inter', fontWeight: 400, textAlign: 'left' },
      { type: 'text', x: 80, y: 340, width: 760, height: 100, rotation: 0, opacity: 1, fill: '#475569', content: 'Edite textos, cores, imagens e camadas diretamente no DocSwiss.', fontSize: 34, fontFamily: 'Inter', fontWeight: 500, textAlign: 'left' },
    ],
  },
  {
    label: 'Promoção escura',
    background: '#0f172a',
    objects: [
      { type: 'text', x: 90, y: 120, width: 780, height: 90, rotation: 0, opacity: 1, fill: '#a5b4fc', content: 'NOVIDADE', fontSize: 46, fontFamily: 'Inter', fontWeight: 800, textAlign: 'left' },
      { type: 'text', x: 90, y: 240, width: 830, height: 220, rotation: 0, opacity: 1, fill: '#ffffff', content: 'Uma mensagem\nque chama atenção', fontSize: 76, fontFamily: 'Inter', fontWeight: 900, textAlign: 'left' },
      { type: 'rect', x: 90, y: 560, width: 350, height: 90, rotation: 0, opacity: 1, fill: '#4f46e5', content: '', fontSize: 16, fontFamily: 'Inter', fontWeight: 400, textAlign: 'left' },
      { type: 'text', x: 120, y: 585, width: 290, height: 45, rotation: 0, opacity: 1, fill: '#ffffff', content: 'SAIBA MAIS', fontSize: 28, fontFamily: 'Inter', fontWeight: 800, textAlign: 'center' },
    ],
  },
];

const makeObject = (type: DesignObject['type'], width: number, height: number): DesignObject => ({
  id: crypto.randomUUID(),
  type,
  x: Math.round(width * 0.25),
  y: Math.round(height * 0.25),
  width: type === 'text' ? Math.round(width * 0.5) : Math.round(width * 0.25),
  height: type === 'text' ? 120 : Math.round(width * 0.2),
  rotation: 0,
  opacity: 1,
  fill: type === 'text' ? '#0f172a' : '#4f46e5',
  content: type === 'text' ? 'Novo texto' : '',
  fontSize: 48,
  fontFamily: 'Inter',
  fontWeight: 700,
  textAlign: 'left',
});

const defaultDesign = (title: string): DesignState => ({ title, width: 1080, height: 1080, background: '#ffffff', objects: [] });

export const DesignEditor: React.FC<DesignEditorProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  onSendToOcr,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_design_v2_${project.id}`;
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
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) {
      showNotification('A imagem precisa ter menos de 15 MB.', 'error');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const object = { ...makeObject('image', design.width, design.height), content: dataUrl, width: Math.round(design.width * 0.45), height: Math.round(design.height * 0.35) };
    setDesign((current) => ({ ...current, objects: [...current.objects, object] }));
    setSelectedId(object.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setDesign((current) => ({ ...current, objects: current.objects.filter((object) => object.id !== selectedId) }));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID(), x: selected.x + 24, y: selected.y + 24 };
    setDesign((current) => ({ ...current, objects: [...current.objects, copy] }));
    setSelectedId(copy.id);
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

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = design.width;
    canvas.height = design.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.clearRect(0, 0, design.width, design.height);
    ctx.fillStyle = design.background;
    ctx.fillRect(0, 0, design.width, design.height);

    for (const object of design.objects) {
      ctx.save();
      ctx.globalAlpha = object.opacity;
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
        ctx.font = `${object.fontWeight} ${object.fontSize}px ${object.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = object.textAlign;
        const anchor = object.textAlign === 'center' ? 0 : object.textAlign === 'right' ? object.width / 2 : -object.width / 2;
        const words = object.content.split(/\s+/);
        const lines: string[] = [];
        let line = '';
        words.forEach((word) => {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > object.width && line) { lines.push(line); line = word; } else line = test;
        });
        if (line) lines.push(line);
        lines.slice(0, Math.max(1, Math.floor(object.height / (object.fontSize * 1.2)))).forEach((text, index) => ctx.fillText(text, anchor, y + index * object.fontSize * 1.2));
      } else if (object.type === 'image' && object.content) {
        const image = new Image();
        image.src = object.content;
        await image.decode().catch(() => {});
        if (image.complete) ctx.drawImage(image, x, y, object.width, object.height);
      }
      ctx.restore();
    }
    return canvas;
  }, [design]);

  const exportDesign = async (format: 'png' | 'jpg' | 'webp' | 'pdf') => {
    try {
      const canvas = await renderCanvas();
      const base = design.title.replace(/[<>:"/\\|?*]/g, '_') || 'Design';
      if (format === 'pdf') {
        const landscape = design.width > design.height;
        const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / design.width, pageHeight / design.height);
        const width = design.width * ratio;
        const height = design.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
        saveAs(pdf.output('blob'), `${base}.pdf`);
      } else {
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Falha ao codificar ${format}.`)), mime, 0.92));
        saveAs(blob, `${base}.${format}`);
      }
      onSaveToHistory?.({ type: 'canva', title: design.title, summary: `${design.width}×${design.height} exportado como ${format.toUpperCase()}.`, tags: ['Design', format.toUpperCase()] });
      showNotification(`Design exportado como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao exportar design.', 'error');
    }
  };

  const generateLayout = async () => {
    const prompt = window.prompt('Descreva o design que você quer criar:');
    if (!prompt?.trim()) return;
    setAiBusy(true);
    try {
      const answer = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: 'Crie um layout gráfico simples em JSON estrito. Formato: {"background":"#RRGGBB","objects":[{"type":"text|rect|circle","x":0,"y":0,"width":100,"height":100,"fill":"#RRGGBB","content":"texto","fontSize":40,"fontWeight":700,"textAlign":"left|center|right"}]}. Use coordenadas dentro de 1080x1080 e no máximo 8 objetos. Não escreva Markdown.' },
        { role: 'user', content: prompt },
      ]);
      const match = answer.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('A IA não retornou um layout válido.');
      const parsed = JSON.parse(match[0]);
      const objects: DesignObject[] = (parsed.objects || []).slice(0, 8).map((item: any) => ({
        id: crypto.randomUUID(),
        type: ['text', 'rect', 'circle'].includes(item.type) ? item.type : 'text',
        x: Math.max(0, Math.min(design.width, Number(item.x) || 0)),
        y: Math.max(0, Math.min(design.height, Number(item.y) || 0)),
        width: Math.max(20, Number(item.width) || 300),
        height: Math.max(20, Number(item.height) || 100),
        rotation: 0,
        opacity: 1,
        fill: typeof item.fill === 'string' ? item.fill : '#0f172a',
        content: String(item.content || ''),
        fontSize: Math.max(10, Math.min(160, Number(item.fontSize) || 40)),
        fontFamily: 'Inter',
        fontWeight: Math.max(300, Math.min(900, Number(item.fontWeight) || 700)),
        textAlign: ['left', 'center', 'right'].includes(item.textAlign) ? item.textAlign : 'left',
      }));
      setDesign((current) => ({ ...current, background: parsed.background || current.background, objects }));
      showNotification('Layout gerado pela IA. Ajuste os elementos livremente.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao gerar layout.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const scale = zoom / 100;
  const stageWidth = design.width * scale;
  const stageHeight = design.height * scale;

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <input value={design.title} onChange={(event) => setDesign((current) => ({ ...current, title: event.target.value }))} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <button onClick={generateLayout} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Gerando…' : 'Layout IA'}</button>
        <div className="relative group"><button className="h-8 px-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['png','jpg','webp','pdf'] as const).map((format) => <button key={format} onClick={() => exportDesign(format)} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
      </div>

      <div className="h-11 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <button onClick={() => addObject('text')} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Texto</button>
        <button onClick={() => addObject('rect')} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Rectangle className="w-3.5 h-3.5" /> Retângulo</button>
        <button onClick={() => addObject('circle')} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Circle className="w-3.5 h-3.5" /> Círculo</button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { addImage(event.target.files?.[0]); event.target.value = ''; }} />
        <button onClick={() => imageInputRef.current?.click()} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Photo className="w-3.5 h-3.5" /> Imagem</button>
        <span className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
        <select value={`${design.width}x${design.height}`} onChange={(event) => { const [width, height] = event.target.value.split('x').map(Number); setDesign((current) => ({ ...current, width, height })); }} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold">{PRESETS.map((preset) => <option key={preset.id} value={`${preset.width}x${preset.height}`}>{preset.label}</option>)}</select>
        <label className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-[10px] font-bold">Fundo <input type="color" value={/^#[0-9A-F]{6}$/i.test(design.background) ? design.background : '#ffffff'} onChange={(event) => setDesign((current) => ({ ...current, background: event.target.value }))} className="w-5 h-5" /></label>
        <div className="ml-auto flex items-center gap-2"><input type="range" min="25" max="100" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20" /><span className="text-[10px] text-slate-400">{zoom}%</span></div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="hidden lg:block w-[220px] shrink-0 border-r border-slate-200 dark:border-slate-800 p-3 overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modelos</div>
          <div className="mt-2 space-y-2">{TEMPLATES.map((template, index) => <button key={template.label} onClick={() => applyTemplate(index)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-fuchsia-400"><div className="h-16 rounded-lg" style={{ background: template.background }} /><div className="mt-2 text-[10px] font-bold">{template.label}</div></button>)}</div>
        </aside>

        <div className="flex-1 min-w-0 overflow-auto bg-slate-200/60 dark:bg-slate-950 p-6 flex items-start justify-center">
          <div className="relative shadow-2xl shrink-0" style={{ width: stageWidth, height: stageHeight, background: design.background }} onMouseMove={(event) => { if (!dragging) return; const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / scale - dragging.dx; const y = (event.clientY - rect.top) / scale - dragging.dy; updateObject(dragging.id, { x: Math.max(0, Math.min(design.width, x)), y: Math.max(0, Math.min(design.height, y)) }); }} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}>
            {design.objects.map((object, index) => <DesignElement key={object.id} object={object} selected={object.id === selectedId} scale={scale} zIndex={index + 1} onSelect={() => setSelectedId(object.id)} onDragStart={(event) => { if (object.locked) return; const targetRect = event.currentTarget.getBoundingClientRect(); setDragging({ id: object.id, dx: (event.clientX - targetRect.left) / scale, dy: (event.clientY - targetRect.top) / scale }); }} />)}
          </div>
        </div>

        <aside className="w-[280px] hidden xl:block shrink-0 border-l border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
          {selected ? <div className="space-y-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black">Elemento selecionado</h3><div className="flex gap-1"><button onClick={duplicateSelected} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Copy className="w-4 h-4" /></button><button onClick={removeSelected} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash className="w-4 h-4" /></button></div></div>{selected.type === 'text' && <label className="block text-[10px] font-bold text-slate-500">Texto<textarea value={selected.content} onChange={(event) => updateObject(selected.id, { content: event.target.value })} rows={5} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs" /></label>}<div className="grid grid-cols-2 gap-2"><NumberField label="X" value={selected.x} onChange={(value) => updateObject(selected.id, { x: value })} /><NumberField label="Y" value={selected.y} onChange={(value) => updateObject(selected.id, { y: value })} /><NumberField label="Largura" value={selected.width} onChange={(value) => updateObject(selected.id, { width: Math.max(10, value) })} /><NumberField label="Altura" value={selected.height} onChange={(value) => updateObject(selected.id, { height: Math.max(10, value) })} /><NumberField label="Rotação" value={selected.rotation} onChange={(value) => updateObject(selected.id, { rotation: value })} /><NumberField label="Opacidade %" value={Math.round(selected.opacity * 100)} onChange={(value) => updateObject(selected.id, { opacity: Math.max(0, Math.min(1, value / 100)) })} /></div><label className="flex items-center justify-between text-[10px] font-bold text-slate-500">Cor <input type="color" value={/^#[0-9A-F]{6}$/i.test(selected.fill) ? selected.fill : '#000000'} onChange={(event) => updateObject(selected.id, { fill: event.target.value })} /></label>{selected.type === 'text' && <><NumberField label="Tamanho da fonte" value={selected.fontSize} onChange={(value) => updateObject(selected.id, { fontSize: Math.max(8, value) })} /><select value={selected.textAlign} onChange={(event) => updateObject(selected.id, { textAlign: event.target.value as CanvasTextAlign })} className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></>}<div className="flex gap-2"><button onClick={() => moveLayer('up')} className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-1"><ArrowUp className="w-3.5 h-3.5" /> Frente</button><button onClick={() => moveLayer('down')} className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-1"><ArrowDown className="w-3.5 h-3.5" /> Trás</button></div></div> : <div className="h-full flex items-center justify-center text-center text-xs text-slate-400">Selecione um elemento para editar propriedades.</div>}
        </aside>
      </div>

      <div className="h-10 px-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto"><span className="text-[10px] font-black text-slate-400">Camadas:</span>{design.objects.map((object, index) => <button key={object.id} onClick={() => setSelectedId(object.id)} className={`h-7 px-2 rounded-lg text-[9px] font-bold whitespace-nowrap ${object.id === selectedId ? 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{index + 1}. {object.type}{object.type === 'text' ? ` · ${object.content.slice(0, 14)}` : ''}</button>)}</div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const DesignElement: React.FC<{ object: DesignObject; selected: boolean; scale: number; zIndex: number; onSelect: () => void; onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void }> = ({ object, selected, scale, zIndex, onSelect, onDragStart }) => {
  const style: React.CSSProperties = { position: 'absolute', left: object.x * scale, top: object.y * scale, width: object.width * scale, height: object.height * scale, opacity: object.opacity, transform: `rotate(${object.rotation}deg)`, transformOrigin: 'center', zIndex, cursor: object.locked ? 'default' : 'move', outline: selected ? '2px solid #d946ef' : 'none', outlineOffset: 2 };
  return <div style={style} onMouseDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }}><div className="w-full h-full overflow-hidden" style={{ backgroundColor: object.type === 'rect' || object.type === 'circle' ? object.fill : 'transparent', borderRadius: object.type === 'circle' ? '50%' : 0, color: object.fill, fontFamily: object.fontFamily, fontSize: object.fontSize * scale, fontWeight: object.fontWeight, textAlign: object.textAlign as any, whiteSpace: 'pre-wrap', lineHeight: 1.15 }}>{object.type === 'text' ? object.content : object.type === 'image' ? <img src={object.content} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" /> : null}</div></div>;
};

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => <label className="block text-[9px] font-bold text-slate-500">{label}<input type="number" value={Math.round(value * 100) / 100} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-1 w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /></label>;
