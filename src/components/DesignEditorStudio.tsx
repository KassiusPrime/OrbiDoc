import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconArrowBackUp as Undo,
  IconArrowForwardUp as Redo,
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconCopy as Copy,
  IconDownload as Download,
  IconGridDots as GridDots,
  IconLayers as Layers,
  IconLock as Lock,
  IconLockOpen as LockOpen,
  IconPhoto as Photo,
  IconPlus as Plus,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconTypography as Type,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';
import {
  AlignmentGuides,
  OFFICE_FONTS,
  SHAPE_LIBRARY,
  StudioElement,
  StudioShape,
  createStudioElement,
  readImageAsDataUrl,
  shapeClipPath,
  snapStudioElement,
} from '../lib/officeStudio';

interface DesignEditorStudioProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  onSendToOcr?: (textOrImage: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

type DesignState = {
  version: 4;
  title: string;
  width: number;
  height: number;
  background: string;
  elements: StudioElement[];
};

type Interaction =
  | { kind: 'drag'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string; startX: number; startY: number; startWidth: number; startHeight: number };

type ExportFormat = 'png' | 'jpg' | 'webp' | 'avif' | 'pdf';

const PRESETS = [
  { id: 'social', label: 'Post quadrado', width: 1080, height: 1080 },
  { id: 'story', label: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'presentation', label: 'Apresentação 16:9', width: 1920, height: 1080 },
  { id: 'a4', label: 'Documento A4', width: 1240, height: 1754 },
  { id: 'a4-landscape', label: 'A4 horizontal', width: 1754, height: 1240 },
  { id: 'poster', label: 'Pôster', width: 1400, height: 2000 },
  { id: 'youtube', label: 'Thumbnail', width: 1280, height: 720 },
  { id: 'card', label: 'Cartão / convite', width: 1050, height: 600 },
];

const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Design';
const cloneDesign = (value: DesignState): DesignState => JSON.parse(JSON.stringify(value));

const migrateDesign = (project: SavedProject): DesignState => {
  const content = project.content as any;
  if (content?.version === 4 && Array.isArray(content.elements)) return content as DesignState;
  if (content && Array.isArray(content.elements)) {
    return { version: 4, title: content.title || project.title || 'Novo design', width: content.width || 1080, height: content.height || 1080, background: content.background || '#ffffff', elements: content.elements };
  }
  if (content && Array.isArray(content.objects)) {
    const elements: StudioElement[] = content.objects.map((object: any) => ({
      ...createStudioElement(object.type === 'rect' || object.type === 'circle' ? 'shape' : object.type, content.width || 1080, content.height || 1080),
      id: object.id || crypto.randomUUID(),
      type: object.type === 'rect' || object.type === 'circle' ? 'shape' : object.type,
      shape: object.type === 'circle' ? 'circle' : object.type === 'rect' ? 'rectangle' : undefined,
      x: Number(object.x) || 0,
      y: Number(object.y) || 0,
      width: Number(object.width) || 200,
      height: Number(object.height) || 120,
      rotation: Number(object.rotation) || 0,
      opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
      fill: object.fill || '#3157F6',
      content: object.content || '',
      fontSize: Number(object.fontSize) || 36,
      fontFamily: object.fontFamily || OFFICE_FONTS[0].value,
      fontWeight: Number(object.fontWeight) || 700,
      textAlign: object.textAlign || 'left',
      locked: Boolean(object.locked),
    }));
    return { version: 4, title: content.title || project.title || 'Novo design', width: content.width || 1080, height: content.height || 1080, background: content.background || '#ffffff', elements };
  }
  return { version: 4, title: project.title || 'Novo design', width: 1080, height: 1080, background: '#ffffff', elements: [] };
};

const wrapCanvasText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { result.push(''); continue; }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) { result.push(line); line = word; }
      else line = candidate;
    }
    if (line) result.push(line);
  }
  return result;
};

const drawShape = (ctx: CanvasRenderingContext2D, element: StudioElement) => {
  const x = -element.width / 2;
  const y = -element.height / 2;
  const w = element.width;
  const h = element.height;
  const fillAndStroke = () => {
    if (element.fill !== 'transparent') { ctx.fillStyle = element.fill; ctx.fill(); }
    if (element.strokeWidth > 0 && element.stroke !== 'transparent') { ctx.strokeStyle = element.stroke; ctx.lineWidth = element.strokeWidth; ctx.stroke(); }
  };
  ctx.beginPath();
  if (element.shape === 'circle') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (element.shape === 'triangle') { ctx.moveTo(0, y); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); }
  else if (element.shape === 'diamond') { ctx.moveTo(0, y); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); }
  else if (element.shape === 'arrow') {
    ctx.moveTo(x, -h * 0.2); ctx.lineTo(w * 0.16, -h * 0.2); ctx.lineTo(w * 0.16, y); ctx.lineTo(w / 2, 0); ctx.lineTo(w * 0.16, h / 2); ctx.lineTo(w * 0.16, h * 0.2); ctx.lineTo(x, h * 0.2); ctx.closePath();
  } else if (element.shape === 'star') {
    const outer = Math.min(w, h) / 2;
    const inner = outer * 0.45;
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (element.shape === 'line') {
    ctx.moveTo(x, 0); ctx.lineTo(w / 2, 0);
    ctx.strokeStyle = element.stroke === 'transparent' ? element.fill : element.stroke;
    ctx.lineWidth = Math.max(1, element.strokeWidth || 4);
    ctx.stroke();
    return;
  } else if (element.shape === 'rounded') {
    const radius = Math.min(36, w / 5, h / 5);
    if ('roundRect' in ctx) (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, radius);
    else ctx.rect(x, y, w, h);
  } else ctx.rect(x, y, w, h);
  fillAndStroke();
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

export const DesignEditorStudio: React.FC<DesignEditorStudioProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  onSendToOcr,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `orbidoc_design_v4_${project.id}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [design, setDesign] = useState<DesignState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved).design as DesignState;
    } catch { /* project fallback */ }
    return migrateDesign(project);
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [guides, setGuides] = useState<AlignmentGuides>({ vertical: [], horizontal: [] });
  const [zoom, setZoom] = useState(60);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<DesignState[]>([]);
  const [redoStack, setRedoStack] = useState<DesignState[]>([]);

  const selected = design.elements.find((element) => element.id === selectedId) || null;
  const imageAssets = useMemo(() => [...new Set(design.elements.filter((element) => element.type === 'image' && element.content).map((element) => element.content))], [design.elements]);

  const checkpoint = useCallback(() => {
    setUndoStack((current) => [...current.slice(-39), cloneDesign(design)]);
    setRedoStack([]);
  }, [design]);

  const undo = useCallback(() => {
    setUndoStack((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setRedoStack((future) => [cloneDesign(design), ...future.slice(0, 39)]);
      setDesign(cloneDesign(previous));
      setSelectedId(null);
      return current.slice(0, -1);
    });
  }, [design]);

  const redo = useCallback(() => {
    setRedoStack((current) => {
      const next = current[0];
      if (!next) return current;
      setUndoStack((past) => [...past.slice(-39), cloneDesign(design)]);
      setDesign(cloneDesign(next));
      setSelectedId(null);
      return current.slice(1);
    });
  }, [design]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = {
        ...project,
        title: design.title,
        content: design,
        previewSnippet: `${design.width}×${design.height} · ${design.elements.length} elemento(s)`,
        updatedAt: new Date().toISOString(),
      };
      try { localStorage.setItem(storageKey, JSON.stringify({ design, updatedAt: updated.updatedAt })); } catch { /* storage quota */ }
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [design, project.id]);

  const updateElement = (id: string, patch: Partial<StudioElement>) => setDesign((current) => ({ ...current, elements: current.elements.map((element) => element.id === id ? { ...element, ...patch } : element) }));

  const addElement = (element: StudioElement) => {
    checkpoint();
    setDesign((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
  };

  const addText = () => addElement(createStudioElement('text', design.width, design.height));
  const addShape = (shape: StudioShape) => addElement(createStudioElement('shape', design.width, design.height, { shape, height: shape === 'line' ? 30 : Math.round(design.height * 0.22), fill: shape === 'line' ? '#3157F6' : '#3157F6', stroke: shape === 'line' ? '#3157F6' : 'transparent', strokeWidth: shape === 'line' ? 6 : 0 }));

  const addImageData = async (dataUrl: string) => {
    const image = await loadImage(dataUrl).catch(() => null);
    const ratio = image ? image.naturalWidth / Math.max(1, image.naturalHeight) : 1.4;
    const width = Math.round(design.width * 0.42);
    const height = Math.min(Math.round(width / Math.max(0.25, ratio)), Math.round(design.height * 0.56));
    addElement(createStudioElement('image', design.width, design.height, { content: dataUrl, width, height, fill: 'transparent' }));
  };

  const addImages = async (files: FileList | File[]) => {
    for (const file of Array.from(files).slice(0, 8)) {
      if (!file.type.startsWith('image/')) { showNotification(`${file.name} não é uma imagem compatível.`, 'error'); continue; }
      if (file.size > 18 * 1024 * 1024) { showNotification(`${file.name} excede 18 MB.`, 'error'); continue; }
      try { await addImageData(await readImageAsDataUrl(file)); } catch { showNotification(`Falha ao importar ${file.name}.`, 'error'); }
    }
  };

  const duplicateSelected = useCallback(() => {
    const element = design.elements.find((item) => item.id === selectedId);
    if (!element) return;
    checkpoint();
    const copy = { ...element, id: crypto.randomUUID(), x: element.x + 24, y: element.y + 24, locked: false };
    setDesign((current) => ({ ...current, elements: [...current.elements, copy] }));
    setSelectedId(copy.id);
  }, [design, selectedId, checkpoint]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    checkpoint();
    setDesign((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selectedId) }));
    setSelectedId(null);
  }, [selectedId, checkpoint]);

  const moveLayer = (direction: 'up' | 'down') => {
    if (!selectedId) return;
    checkpoint();
    setDesign((current) => {
      const index = current.elements.findIndex((element) => element.id === selectedId);
      const target = direction === 'up' ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= current.elements.length) return current;
      const elements = [...current.elements];
      [elements[index], elements[target]] = [elements[target], elements[index]];
      return { ...current, elements };
    });
  };

  const applyTemplate = (kind: 'business' | 'school' | 'poster' | 'minimal') => {
    checkpoint();
    const width = design.width;
    const height = design.height;
    const text = (content: string, x: number, y: number, w: number, h: number, fontSize: number, fill: string, weight = 700) => createStudioElement('text', width, height, { content, x, y, width: w, height: h, fontSize, fill, fontWeight: weight });
    const shape = (x: number, y: number, w: number, h: number, fill: string, shapeType: StudioShape = 'rectangle') => createStudioElement('shape', width, height, { x, y, width: w, height: h, fill, shape: shapeType });
    let background = '#ffffff';
    let elements: StudioElement[] = [];
    if (kind === 'business') {
      background = '#F7F9FC';
      elements = [shape(0, 0, width * 0.07, height, '#3157F6'), text('RELATÓRIO\nEXECUTIVO', width * 0.13, height * 0.15, width * 0.68, height * 0.22, Math.round(width * 0.07), '#0B1220', 800), text('Estratégia · Resultados · Próximos passos', width * 0.13, height * 0.42, width * 0.64, height * 0.08, Math.round(width * 0.028), '#475569', 500), shape(width * 0.13, height * 0.55, width * 0.22, height * 0.018, '#22D3EE')];
    } else if (kind === 'school') {
      background = '#FFFFFF';
      elements = [shape(width * 0.08, height * 0.08, width * 0.84, height * 0.84, '#EFF4FF', 'rounded'), text('TRABALHO\nESCOLAR', width * 0.15, height * 0.2, width * 0.7, height * 0.2, Math.round(width * 0.065), '#2446D8', 800), text('Tema · Nome · Turma · Data', width * 0.15, height * 0.46, width * 0.7, height * 0.08, Math.round(width * 0.027), '#475569', 500), shape(width * 0.15, height * 0.61, width * 0.7, height * 0.012, '#7AA2FF')];
    } else if (kind === 'poster') {
      background = '#080D18';
      elements = [text('IDEIA\nEM DESTAQUE', width * 0.09, height * 0.12, width * 0.82, height * 0.25, Math.round(width * 0.075), '#FFFFFF', 900), shape(width * 0.09, height * 0.43, width * 0.31, height * 0.035, '#6D5EF7'), text('Uma composição pronta para pôster, campanha ou apresentação visual.', width * 0.09, height * 0.53, width * 0.74, height * 0.13, Math.round(width * 0.03), '#CBD5E1', 500)];
    } else {
      background = '#FFFFFF';
      elements = [text('Título principal', width * 0.1, height * 0.14, width * 0.8, height * 0.12, Math.round(width * 0.06), '#0B1220', 800), text('Subtítulo ou descrição curta para contextualizar a peça.', width * 0.1, height * 0.3, width * 0.72, height * 0.1, Math.round(width * 0.027), '#64748B', 500), shape(width * 0.1, height * 0.48, width * 0.8, height * 0.01, '#3157F6')];
    }
    setDesign((current) => ({ ...current, background, elements }));
    setSelectedId(null);
  };

  const canvasPoint = (event: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (design.width / rect.width), y: (event.clientY - rect.top) * (design.height / rect.height) };
  };

  const startDrag = (event: React.PointerEvent, element: StudioElement) => {
    event.stopPropagation();
    setSelectedId(element.id);
    if (element.locked) return;
    checkpoint();
    const point = canvasPoint(event);
    setInteraction({ kind: 'drag', id: element.id, dx: point.x - element.x, dy: point.y - element.y });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const startResize = (event: React.PointerEvent, element: StudioElement) => {
    event.stopPropagation();
    if (element.locked) return;
    checkpoint();
    const point = canvasPoint(event);
    setInteraction({ kind: 'resize', id: element.id, startX: point.x, startY: point.y, startWidth: element.width, startHeight: element.height });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const moveInteraction = (event: React.PointerEvent) => {
    if (!interaction) return;
    const point = canvasPoint(event);
    const element = design.elements.find((item) => item.id === interaction.id);
    if (!element || element.locked) return;
    if (interaction.kind === 'drag') {
      const desiredX = point.x - interaction.dx;
      const desiredY = point.y - interaction.dy;
      if (snapEnabled) {
        const snapped = snapStudioElement(element, desiredX, desiredY, design.elements, design.width, design.height, Math.max(5, 10 * 100 / zoom));
        updateElement(element.id, { x: snapped.x, y: snapped.y });
        setGuides(snapped.guides);
      } else {
        updateElement(element.id, { x: desiredX, y: desiredY });
        setGuides({ vertical: [], horizontal: [] });
      }
    } else {
      const nextWidth = Math.max(24, interaction.startWidth + (point.x - interaction.startX));
      const nextHeightRaw = Math.max(24, interaction.startHeight + (point.y - interaction.startY));
      const nextHeight = event.shiftKey ? nextWidth * (interaction.startHeight / Math.max(1, interaction.startWidth)) : nextHeightRaw;
      updateElement(element.id, { width: nextWidth, height: nextHeight });
    }
  };

  const stopInteraction = () => { setInteraction(null); setGuides({ vertical: [], horizontal: [] }); };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) { event.preventDefault(); removeSelected(); return; }
      const selectedElement = design.elements.find((element) => element.id === selectedId);
      if (!selectedElement || selectedElement.locked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      updateElement(selectedElement.id, { x: selectedElement.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: selectedElement.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [design.elements, selectedId, duplicateSelected, removeSelected, undo, redo]);

  const renderToCanvas = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = design.width;
    canvas.height = design.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível.');
    ctx.fillStyle = design.background;
    ctx.fillRect(0, 0, design.width, design.height);
    for (const element of design.elements) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, element.opacity));
      ctx.translate(element.x + element.width / 2, element.y + element.height / 2);
      ctx.rotate(element.rotation * Math.PI / 180);
      if (element.type === 'shape') drawShape(ctx, element);
      else if (element.type === 'image' && element.content) {
        const image = await loadImage(element.content).catch(() => null);
        if (image) ctx.drawImage(image, -element.width / 2, -element.height / 2, element.width, element.height);
      } else if (element.type === 'text') {
        ctx.fillStyle = element.fill;
        ctx.font = `${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = element.textAlign;
        const anchor = element.textAlign === 'center' ? 0 : element.textAlign === 'right' ? element.width / 2 : -element.width / 2;
        const lineHeight = element.fontSize * 1.18;
        wrapCanvasText(ctx, element.content, element.width).slice(0, Math.max(1, Math.floor(element.height / lineHeight))).forEach((line, index) => ctx.fillText(line, anchor, -element.height / 2 + index * lineHeight));
      }
      ctx.restore();
    }
    return canvas;
  };

  const exportDesign = async (format: ExportFormat) => {
    setExportBusy(true);
    try {
      const canvas = await renderToCanvas();
      const base = cleanFileName(design.title);
      if (format === 'pdf') {
        const pdf = new jsPDF({ orientation: design.width > design.height ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / design.width, pageHeight / design.height);
        const w = design.width * ratio;
        const h = design.height * ratio;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h, undefined, 'FAST');
        pdf.save(`${base}.pdf`);
      } else {
        let exportCanvas = canvas;
        if (format === 'jpg') {
          exportCanvas = document.createElement('canvas');
          exportCanvas.width = canvas.width;
          exportCanvas.height = canvas.height;
          const ctx = exportCanvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D indisponível.');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(canvas, 0, 0);
        }
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
        const blob = await new Promise<Blob>((resolve, reject) => exportCanvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Falha ao codificar ${format.toUpperCase()}.`)), mime, 0.94));
        if (format === 'avif' && blob.type !== 'image/avif') throw new Error('Este navegador não oferece codificação AVIF.');
        saveAs(blob, `${base}.${format}`);
      }
      onSaveToHistory?.({ type: 'canva', title: design.title, summary: `${design.width}×${design.height} · ${design.elements.length} elementos · ${format.toUpperCase()}`, tags: ['Design', format.toUpperCase()] });
      showNotification(`Design exportado como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao exportar design.', 'error');
    } finally { setExportBusy(false); }
  };

  const generateLayout = async () => {
    const prompt = window.prompt('Descreva o layout que deseja criar:');
    if (!prompt?.trim()) return;
    setAiBusy(true);
    try {
      const answer = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: `Crie um layout visual em JSON estrito para um canvas ${design.width}x${design.height}. Formato: {"background":"#RRGGBB","elements":[{"type":"text|shape","shape":"rectangle|rounded|circle|triangle|diamond|arrow|star|line","x":0,"y":0,"width":200,"height":100,"fill":"#RRGGBB","content":"texto","fontSize":40,"fontWeight":700,"textAlign":"left|center|right"}]}. Máximo 14 elementos. Não escreva Markdown.` },
        { role: 'user', content: prompt.trim() },
      ]);
      const match = answer.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('A IA não retornou um layout JSON válido.');
      const parsed = JSON.parse(match[0]);
      const safeColor = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
      const elements: StudioElement[] = (Array.isArray(parsed.elements) ? parsed.elements : []).slice(0, 14).filter((item: any) => item?.type === 'text' || item?.type === 'shape').map((item: any) => createStudioElement(item.type, design.width, design.height, {
        shape: SHAPE_LIBRARY.some((shape) => shape.type === item.shape) ? item.shape : 'rectangle',
        x: Math.max(0, Math.min(design.width - 20, Number(item.x) || 0)),
        y: Math.max(0, Math.min(design.height - 20, Number(item.y) || 0)),
        width: Math.max(20, Math.min(design.width, Number(item.width) || 200)),
        height: Math.max(20, Math.min(design.height, Number(item.height) || 100)),
        fill: safeColor(item.fill, item.type === 'text' ? '#0B1220' : '#3157F6'),
        content: String(item.content || '').slice(0, 700),
        fontSize: Math.max(10, Math.min(220, Number(item.fontSize) || 40)),
        fontWeight: Math.max(100, Math.min(900, Number(item.fontWeight) || 700)),
        textAlign: ['left', 'center', 'right'].includes(item.textAlign) ? item.textAlign : 'left',
      }));
      if (!elements.length) throw new Error('Nenhum elemento utilizável foi retornado.');
      checkpoint();
      setDesign((current) => ({ ...current, background: safeColor(parsed.background, current.background), elements }));
      setSelectedId(null);
      showNotification('Layout criado pela IA.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao gerar layout.', 'error'); }
    finally { setAiBusy(false); }
  };

  const scale = zoom / 100;

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="min-h-12 px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap">
        <input value={design.title} onChange={(event) => setDesign((current) => ({ ...current, title: event.target.value }))} className="min-w-[180px] flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome do design" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <button onClick={undo} disabled={!undoStack.length} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Desfazer"><Undo className="w-4 h-4 mx-auto" /></button>
        <button onClick={redo} disabled={!redoStack.length} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Refazer"><Redo className="w-4 h-4 mx-auto" /></button>
        <button onClick={generateLayout} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Gerando…' : 'Layout IA'}</button>
        <div className="relative group"><button disabled={exportBusy} className="h-8 px-2.5 rounded-lg bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Download className="w-3.5 h-3.5" />{exportBusy ? 'Exportando…' : 'Exportar'}</button><div className="hidden group-hover:block absolute right-0 top-8 z-40 w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['png','jpg','webp','avif','pdf'] as ExportFormat[]).map((format) => <button key={format} onClick={() => void exportDesign(format)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="border-r border-slate-200 dark:border-slate-800 p-3 space-y-4 overflow-y-auto lg:max-h-[calc(100dvh-9rem)]">
          <section><div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Adicionar</div><div className="grid grid-cols-2 gap-2"><ToolButton icon={Type} label="Texto" onClick={addText} /><ToolButton icon={Photo} label="Imagens" onClick={() => imageInputRef.current?.click()} /></div><input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(event) => { if (event.target.files) void addImages(event.target.files); event.target.value = ''; }} /></section>
          <section><div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Formas</div><div className="grid grid-cols-2 gap-1.5">{SHAPE_LIBRARY.map((shape) => <button key={shape.type} onClick={() => addShape(shape.type)} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#7AA2FF] hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-[10px] font-bold">{shape.label}</button>)}</div></section>
          <section><div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Templates</div><div className="space-y-1.5"><TemplateButton label="Relatório empresarial" onClick={() => applyTemplate('business')} /><TemplateButton label="Trabalho escolar" onClick={() => applyTemplate('school')} /><TemplateButton label="Pôster de impacto" onClick={() => applyTemplate('poster')} /><TemplateButton label="Minimalista" onClick={() => applyTemplate('minimal')} /></div></section>
          {imageAssets.length > 0 && <section><div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Imagens do projeto</div><div className="grid grid-cols-3 gap-1.5">{imageAssets.map((src, index) => <button key={`${src.slice(0, 32)}-${index}`} onClick={() => void addImageData(src)} className="aspect-square rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100"><img src={src} alt={`Imagem ${index + 1}`} className="w-full h-full object-cover" /></button>)}</div></section>}
          <section><div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2"><Layers className="w-3.5 h-3.5" /> Camadas</div><div className="space-y-1">{[...design.elements].reverse().map((element) => <button key={element.id} onClick={() => setSelectedId(element.id)} className={`w-full h-9 px-2 rounded-lg text-left text-[10px] font-bold flex items-center gap-2 ${selectedId === element.id ? 'bg-blue-50 dark:bg-blue-950/40 text-[#3157F6] dark:text-[#7AA2FF]' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><span className="truncate flex-1">{element.type === 'text' ? element.content.split('\n')[0] || 'Texto' : element.type === 'image' ? 'Imagem' : SHAPE_LIBRARY.find((shape) => shape.type === element.shape)?.label || 'Forma'}</span>{element.locked && <Lock className="w-3 h-3" />}</button>)}</div></section>
        </aside>

        <main className="min-h-[620px] bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-8 overflow-auto flex items-center justify-center">
          <div style={{ width: design.width * scale, height: design.height * scale }} className="relative shrink-0">
            <div ref={stageRef} onPointerMove={moveInteraction} onPointerUp={stopInteraction} onPointerCancel={stopInteraction} onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }} className="absolute left-0 top-0 shadow-2xl overflow-hidden touch-none" style={{ width: design.width, height: design.height, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundColor: design.background, backgroundImage: showGrid ? 'linear-gradient(to right, rgba(49,87,246,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(49,87,246,.10) 1px, transparent 1px)' : undefined, backgroundSize: showGrid ? '20px 20px' : undefined }}>
              {design.elements.map((element) => <StudioElementView key={element.id} element={element} selected={selectedId === element.id} onPointerDown={(event) => startDrag(event, element)} onResizePointerDown={(event) => startResize(event, element)} />)}
              {guides.vertical.map((value) => <div key={`v-${value}`} className="absolute top-0 bottom-0 w-px bg-fuchsia-500 pointer-events-none z-[90]" style={{ left: value }} />)}
              {guides.horizontal.map((value) => <div key={`h-${value}`} className="absolute left-0 right-0 h-px bg-fuchsia-500 pointer-events-none z-[90]" style={{ top: value }} />)}
            </div>
          </div>
        </main>

        <aside className="border-l border-slate-200 dark:border-slate-800 p-3 overflow-y-auto lg:max-h-[calc(100dvh-9rem)] space-y-4">
          <section><div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Canvas</div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px]">Tamanho<select value={`${design.width}x${design.height}`} onChange={(event) => { const preset = PRESETS.find((item) => `${item.width}x${item.height}` === event.target.value); if (preset) { checkpoint(); setDesign((current) => ({ ...current, width: preset.width, height: preset.height })); } }} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2">{PRESETS.map((preset) => <option key={preset.id} value={`${preset.width}x${preset.height}`}>{preset.label}</option>)}</select></label><label className="text-[10px]">Zoom<select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2"><option value="25">25%</option><option value="40">40%</option><option value="60">60%</option><option value="80">80%</option><option value="100">100%</option></select></label></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px]">Fundo<input type="color" value={design.background} onChange={(event) => setDesign((current) => ({ ...current, background: event.target.value }))} className="mt-1 w-full h-9" /></label><div className="space-y-1"><button onClick={() => setShowGrid((value) => !value)} className={`w-full h-8 rounded-lg border text-[10px] font-bold inline-flex items-center justify-center gap-1 ${showGrid ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}><GridDots className="w-3.5 h-3.5" /> Grade</button><button onClick={() => setSnapEnabled((value) => !value)} className={`w-full h-8 rounded-lg border text-[10px] font-bold ${snapEnabled ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/30' : 'border-slate-200 dark:border-slate-700'}`}>Snap {snapEnabled ? 'ativo' : 'desligado'}</button></div></div></section>

          {selected ? <>
            <div className="flex gap-1"><button onClick={duplicateSelected} className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-1"><Copy className="w-3.5 h-3.5" /> Duplicar</button><button onClick={() => moveLayer('up')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700"><ArrowUp className="w-4 h-4 mx-auto" /></button><button onClick={() => moveLayer('down')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700"><ArrowDown className="w-4 h-4 mx-auto" /></button><button onClick={() => updateElement(selected.id, { locked: !selected.locked })} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700">{selected.locked ? <Lock className="w-4 h-4 mx-auto" /> : <LockOpen className="w-4 h-4 mx-auto" />}</button></div>
            {selected.type === 'text' && <section className="space-y-2"><div className="text-[10px] font-black text-slate-400 uppercase">Tipografia</div><textarea value={selected.content} onChange={(event) => updateElement(selected.id, { content: event.target.value })} className="w-full min-h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs" /><select value={selected.fontFamily} onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value })} className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs">{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select><div className="grid grid-cols-2 gap-2"><NumberField label="Tamanho" value={selected.fontSize} min={8} onChange={(value) => updateElement(selected.id, { fontSize: Math.max(8, Math.min(300, value)) })} /><label className="text-[10px]">Peso<select value={selected.fontWeight} onChange={(event) => updateElement(selected.id, { fontWeight: Number(event.target.value) })} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2"><option value="400">Regular</option><option value="500">Médio</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option><option value="900">Black</option></select></label></div><div className="grid grid-cols-3 gap-1"><AlignButton active={selected.textAlign === 'left'} onClick={() => updateElement(selected.id, { textAlign: 'left' })}><AlignLeft /></AlignButton><AlignButton active={selected.textAlign === 'center'} onClick={() => updateElement(selected.id, { textAlign: 'center' })}><AlignCenter /></AlignButton><AlignButton active={selected.textAlign === 'right'} onClick={() => updateElement(selected.id, { textAlign: 'right' })}><AlignRight /></AlignButton></div></section>}
            {selected.type === 'shape' && <section className="space-y-2"><div className="text-[10px] font-black text-slate-400 uppercase">Forma</div><select value={selected.shape || 'rectangle'} onChange={(event) => updateElement(selected.id, { shape: event.target.value as StudioShape })} className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs">{SHAPE_LIBRARY.map((shape) => <option key={shape.type} value={shape.type}>{shape.label}</option>)}</select><div className="grid grid-cols-2 gap-2"><ColorField label="Preenchimento" value={selected.fill} onChange={(value) => updateElement(selected.id, { fill: value })} /><ColorField label="Contorno" value={selected.stroke === 'transparent' ? '#3157F6' : selected.stroke} onChange={(value) => updateElement(selected.id, { stroke: value, strokeWidth: Math.max(1, selected.strokeWidth) })} /></div><NumberField label="Espessura do contorno" value={selected.strokeWidth} min={0} onChange={(value) => updateElement(selected.id, { strokeWidth: Math.max(0, value) })} /></section>}
            {selected.type === 'image' && <section><div className="text-[10px] font-black text-slate-400 uppercase mb-2">Imagem</div><button onClick={() => imageInputRef.current?.click()} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold">Adicionar outra imagem</button>{onSendToOcr && <button onClick={() => onSendToOcr(selected.content)} className="mt-1 w-full h-9 rounded-xl text-[10px] font-bold text-cyan-600">Enviar esta imagem para OCR</button>}</section>}
            {selected.type !== 'image' && <ColorField label="Cor principal" value={selected.fill === 'transparent' ? '#3157F6' : selected.fill} onChange={(value) => updateElement(selected.id, { fill: value })} />}
            <section><div className="text-[10px] font-black text-slate-400 uppercase mb-2">Posição e tamanho</div><div className="grid grid-cols-2 gap-2"><NumberField label="X" value={selected.x} onChange={(value) => updateElement(selected.id, { x: value })} /><NumberField label="Y" value={selected.y} onChange={(value) => updateElement(selected.id, { y: value })} /><NumberField label="Largura" value={selected.width} min={20} onChange={(value) => updateElement(selected.id, { width: Math.max(20, value) })} /><NumberField label="Altura" value={selected.height} min={20} onChange={(value) => updateElement(selected.id, { height: Math.max(20, value) })} /><NumberField label="Rotação" value={selected.rotation} onChange={(value) => updateElement(selected.id, { rotation: value })} /><label className="text-[10px]">Opacidade<input type="range" min="0.05" max="1" step="0.05" value={selected.opacity} onChange={(event) => updateElement(selected.id, { opacity: Number(event.target.value) })} className="mt-2 w-full" /></label></div></section>
            <button onClick={removeSelected} className="w-full h-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-black inline-flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Excluir elemento</button>
          </> : <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-5 text-center text-[11px] text-slate-400"><Plus className="w-5 h-5 mx-auto mb-2" />Adicione ou selecione um elemento. Ao mover, as guias magenta indicam alinhamento com o canvas e outros objetos.</div>}
        </aside>
      </div>
    </div>
  );
};

const StudioElementView: React.FC<{ element: StudioElement; selected: boolean; onPointerDown: (event: React.PointerEvent) => void; onResizePointerDown: (event: React.PointerEvent) => void }> = ({ element, selected, onPointerDown, onResizePointerDown }) => {
  const common: React.CSSProperties = { position: 'absolute', left: element.x, top: element.y, width: element.width, height: element.height, transform: `rotate(${element.rotation}deg)`, transformOrigin: 'center', opacity: element.opacity, cursor: element.locked ? 'not-allowed' : 'move', userSelect: 'none' };
  return <div style={common} onPointerDown={onPointerDown} className={`group ${selected ? 'outline outline-2 outline-[#3157F6] outline-offset-2 z-[80]' : ''}`}>
    {element.type === 'text' ? <div className="w-full h-full overflow-hidden whitespace-pre-wrap leading-[1.18]" style={{ color: element.fill, fontFamily: element.fontFamily, fontSize: element.fontSize, fontWeight: element.fontWeight, textAlign: element.textAlign }}>{element.content}</div>
      : element.type === 'image' ? <img src={element.content} alt="Elemento" draggable={false} className="w-full h-full object-fill pointer-events-none" />
        : element.shape === 'line' ? <div className="absolute left-0 right-0 top-1/2" style={{ borderTop: `${Math.max(1, element.strokeWidth || 4)}px solid ${element.stroke === 'transparent' ? element.fill : element.stroke}` }} />
          : <div className="w-full h-full" style={{ background: element.fill, border: element.strokeWidth > 0 && element.stroke !== 'transparent' ? `${element.strokeWidth}px solid ${element.stroke}` : undefined, borderRadius: element.shape === 'circle' ? '50%' : element.shape === 'rounded' ? Math.min(36, element.width / 5, element.height / 5) : undefined, clipPath: shapeClipPath(element.shape || 'rectangle') }} />}
    {selected && !element.locked && <button type="button" aria-label="Redimensionar elemento" onPointerDown={onResizePointerDown} className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full bg-white border-2 border-[#3157F6] shadow-md cursor-nwse-resize" />}
    {element.locked && selected && <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center"><Lock className="w-3 h-3" /></div>}
  </div>;
};

const ToolButton: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => <button onClick={onClick} className="h-16 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#7AA2FF] hover:bg-blue-50/40 dark:hover:bg-blue-950/20 flex flex-col items-center justify-center gap-1 text-[10px] font-bold"><Icon className="w-5 h-5 text-[#3157F6]" />{label}</button>;
const TemplateButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => <button onClick={onClick} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-bold text-left px-3">{label}</button>;
const AlignButton: React.FC<React.PropsWithChildren<{ active: boolean; onClick: () => void }>> = ({ active, onClick, children }) => <button onClick={onClick} className={`h-8 rounded-lg flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 ${active ? 'bg-blue-50 text-[#3157F6] dark:bg-blue-950/30' : 'border border-slate-200 dark:border-slate-700'}`}>{children}</button>;
const ColorField: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => <label className="text-[10px]">{label}<input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full h-9 rounded-lg" /></label>;
const NumberField: React.FC<{ label: string; value: number; min?: number; onChange: (value: number) => void }> = ({ label, value, min, onChange }) => <label className="text-[10px]">{label}<input type="number" min={min} value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2" /></label>;
