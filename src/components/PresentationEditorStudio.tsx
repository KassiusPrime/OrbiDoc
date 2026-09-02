import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconCopy as Copy,
  IconDownload as Download,
  IconLayout as Layout,
  IconPhoto as Photo,
  IconPlayerPlay as Play,
  IconPlus as Plus,
  IconSparkles as Sparkles,
  IconSquare as Square,
  IconTrash as Trash,
  IconTypography as Type,
  IconX as X,
} from '@tabler/icons-react';
import PptxGenJS from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject, SlideData } from '../types';
import { OrbitResizablePane, useMediaQuery } from './orbit/OrbitResizable';
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

interface PresentationEditorStudioProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type ThemeId = 'orbi' | 'light' | 'dark' | 'corporate' | 'emerald' | 'warm';
type Theme = { bg: string; text: string; accent: string; secondary: string };
type StudioSlide = SlideData & { elements: StudioElement[]; background?: string };
type DeckState = { version: 4; title: string; slides: StudioSlide[]; theme: ThemeId; fontFamily: string };
type Interaction = { id: string; kind: 'drag' | 'resize'; dx?: number; dy?: number; startX?: number; startY?: number; startWidth?: number; startHeight?: number };

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const PPTX_WIDTH = 13.333;
const PPTX_HEIGHT = 7.5;

const THEMES: Record<ThemeId, Theme> = {
  orbi: { bg: '#F7F9FC', text: '#0B1220', accent: '#3157F6', secondary: '#22D3EE' },
  light: { bg: '#FFFFFF', text: '#0F172A', accent: '#2563EB', secondary: '#94A3B8' },
  dark: { bg: '#080D18', text: '#F8FAFC', accent: '#7AA2FF', secondary: '#22D3EE' },
  corporate: { bg: '#F8FAFC', text: '#0F172A', accent: '#1D4ED8', secondary: '#475569' },
  emerald: { bg: '#ECFDF5', text: '#052E16', accent: '#059669', secondary: '#34D399' },
  warm: { bg: '#FFF7ED', text: '#431407', accent: '#EA580C', secondary: '#FDBA74' },
};

const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Apresentacao';
const fontFace = (stack: string) => stack.split(',')[0].replace(/["']/g, '').trim() || 'Arial';

const newSlide = (layout: SlideData['layout'] = 'content'): StudioSlide => ({
  id: crypto.randomUUID(),
  title: layout === 'title' ? 'Título da apresentação' : layout === 'quote' ? 'Uma ideia que merece destaque' : layout === 'blank' as any ? '' : 'Novo slide',
  subtitle: layout === 'title' ? 'Subtítulo ou contexto' : layout === 'quote' ? 'Fonte ou contexto' : undefined,
  bullets: layout === 'content' || layout === 'two-column' ? ['Primeiro ponto', 'Segundo ponto'] : [],
  bgGradient: '',
  layout,
  notes: '',
  elements: [],
});

const defaultDeck = (title = 'Nova apresentação'): DeckState => ({ version: 4, title, theme: 'orbi', fontFamily: OFFICE_FONTS[0].value, slides: [newSlide('title'), newSlide('content')] });

const migrateDeck = (project: SavedProject): DeckState => {
  const content = project.content as any;
  if (content?.version === 4 && Array.isArray(content.slides)) return content as DeckState;
  if (content && Array.isArray(content.slides)) return {
    version: 4,
    title: content.title || project.title || 'Nova apresentação',
    theme: (content.theme && THEMES[content.theme as ThemeId] ? content.theme : 'orbi') as ThemeId,
    fontFamily: content.fontFamily || OFFICE_FONTS[0].value,
    slides: content.slides.map((slide: SlideData & { elements?: StudioElement[] }) => ({ ...slide, elements: Array.isArray(slide.elements) ? slide.elements : [] })),
  };
  return defaultDeck(project.title || 'Nova apresentação');
};

const imageDimensions = (data: string) => new Promise<{ width: number; height: number }>((resolve) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth || image.width || 1, height: image.naturalHeight || image.height || 1 });
  image.onerror = () => resolve({ width: 16, height: 9 });
  image.src = data;
});

const fitRect = (sourceWidth: number, sourceHeight: number, x: number, y: number, width: number, height: number) => {
  const ratio = Math.min(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
  const w = sourceWidth * ratio; const h = sourceHeight * ratio;
  return { x: x + (width - w) / 2, y: y + (height - h) / 2, w, h };
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/); let line = '';
    for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (line && ctx.measureText(candidate).width > maxWidth) { result.push(line); line = word; } else line = candidate; }
    if (line) result.push(line);
  }
  return result;
};

export const PresentationEditorStudio: React.FC<PresentationEditorStudioProps> = ({ project, onProjectChange, showNotification = () => {}, onSaveToHistory, engineProvider = 'gemini', engineModel = 'gemini-3.6-flash' }) => {
  const storageKey = `orbidoc_presentation_v4_${project.id}`;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [deck, setDeck] = useState<DeckState>(() => { try { const local = localStorage.getItem(storageKey); if (local) return JSON.parse(local).deck as DeckState; } catch { /* fallback */ } return migrateDeck(project); });
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [guides, setGuides] = useState<AlignmentGuides>({ vertical: [], horizontal: [] });
  const [lastSaved, setLastSaved] = useState('');
  const [presenting, setPresenting] = useState(false);
  const compactViewport = useMediaQuery('(max-width: 1023px)');
  const [presentIndex, setPresentIndex] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const activeSlide = deck.slides[Math.min(activeIndex, deck.slides.length - 1)] || deck.slides[0];
  const theme = THEMES[deck.theme];
  const selected = activeSlide?.elements.find((element) => element.id === selectedId) || null;

  useEffect(() => { if (activeIndex >= deck.slides.length) setActiveIndex(Math.max(0, deck.slides.length - 1)); }, [deck.slides.length, activeIndex]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = { ...project, title: deck.title, content: deck, previewSnippet: `${deck.slides.length} slide(s) · ${deck.slides[0]?.title || 'Apresentação'}`, updatedAt: new Date().toISOString() };
      try { localStorage.setItem(storageKey, JSON.stringify({ deck, updatedAt: updated.updatedAt })); } catch { /* quota */ }
      onProjectChange(updated); setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [deck, project.id]);

  const updateSlide = (patch: Partial<StudioSlide>) => setDeck((current) => ({ ...current, slides: current.slides.map((slide, index) => index === activeIndex ? { ...slide, ...patch } : slide) }));
  const updateElement = (id: string, patch: Partial<StudioElement>) => updateSlide({ elements: activeSlide.elements.map((element) => element.id === id ? { ...element, ...patch } : element) });

  const addSlide = (layout: SlideData['layout'] = 'content') => {
    const slide = newSlide(layout); setDeck((current) => ({ ...current, slides: [...current.slides, slide] })); setActiveIndex(deck.slides.length); setSelectedId(null);
  };
  const duplicateSlide = () => { const duplicate: StudioSlide = { ...activeSlide, id: crypto.randomUUID(), bullets: [...(activeSlide.bullets || [])], elements: activeSlide.elements.map((element) => ({ ...element, id: crypto.randomUUID() })) }; const slides = [...deck.slides]; slides.splice(activeIndex + 1, 0, duplicate); setDeck((current) => ({ ...current, slides })); setActiveIndex(activeIndex + 1); setSelectedId(null); };
  const deleteSlide = () => { if (deck.slides.length <= 1) return; setDeck((current) => ({ ...current, slides: current.slides.filter((_, index) => index !== activeIndex) })); setActiveIndex(Math.max(0, activeIndex - 1)); setSelectedId(null); };
  const moveSlide = (direction: 'up' | 'down') => { const to = direction === 'up' ? activeIndex - 1 : activeIndex + 1; if (to < 0 || to >= deck.slides.length) return; const slides = [...deck.slides]; const [slide] = slides.splice(activeIndex, 1); slides.splice(to, 0, slide); setDeck((current) => ({ ...current, slides })); setActiveIndex(to); };

  const addOverlay = (type: 'text' | 'shape', shape?: StudioShape) => {
    const element = createStudioElement(type, SLIDE_WIDTH, SLIDE_HEIGHT, type === 'text' ? { x: 260, y: 300, width: 700, height: 160, fontSize: 54, fontFamily: deck.fontFamily } : { shape: shape || 'rectangle', x: 280, y: 300, width: 430, height: shape === 'line' ? 30 : 240, fill: theme.accent, stroke: shape === 'line' ? theme.accent : 'transparent', strokeWidth: shape === 'line' ? 6 : 0 });
    updateSlide({ elements: [...activeSlide.elements, element] }); setSelectedId(element.id);
  };

  const addImages = async (files: FileList | File[]) => {
    for (const file of Array.from(files).slice(0, 6)) {
      if (!file.type.startsWith('image/')) { showNotification(`${file.name} não é uma imagem.`, 'error'); continue; }
      if (file.size > 18 * 1024 * 1024) { showNotification(`${file.name} excede 18 MB.`, 'error'); continue; }
      try {
        const data = await readImageAsDataUrl(file); const dims = await imageDimensions(data); const box = fitRect(dims.width, dims.height, 880, 260, 760, 540);
        const element = createStudioElement('image', SLIDE_WIDTH, SLIDE_HEIGHT, { x: box.x, y: box.y, width: box.w, height: box.h, content: data, fill: 'transparent' });
        updateSlide({ elements: [...activeSlide.elements, element] }); setSelectedId(element.id);
      } catch { showNotification(`Falha ao importar ${file.name}.`, 'error'); }
    }
  };

  const duplicateElement = () => { if (!selected) return; const copy = { ...selected, id: crypto.randomUUID(), x: selected.x + 28, y: selected.y + 28, locked: false }; updateSlide({ elements: [...activeSlide.elements, copy] }); setSelectedId(copy.id); };
  const removeElement = () => { if (!selectedId) return; updateSlide({ elements: activeSlide.elements.filter((element) => element.id !== selectedId) }); setSelectedId(null); };
  const moveLayer = (direction: 'up' | 'down') => { if (!selectedId) return; const elements = [...activeSlide.elements]; const index = elements.findIndex((element) => element.id === selectedId); const target = direction === 'up' ? index + 1 : index - 1; if (index < 0 || target < 0 || target >= elements.length) return; [elements[index], elements[target]] = [elements[target], elements[index]]; updateSlide({ elements }); };

  const canvasPoint = (event: React.PointerEvent) => { const stage = stageRef.current; if (!stage) return { x: 0, y: 0 }; const rect = stage.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (SLIDE_WIDTH / rect.width), y: (event.clientY - rect.top) * (SLIDE_HEIGHT / rect.height) }; };
  const startDrag = (event: React.PointerEvent, element: StudioElement) => { event.stopPropagation(); setSelectedId(element.id); if (element.locked) return; const point = canvasPoint(event); setInteraction({ id: element.id, kind: 'drag', dx: point.x - element.x, dy: point.y - element.y }); (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); };
  const startResize = (event: React.PointerEvent, element: StudioElement) => { event.stopPropagation(); if (element.locked) return; const point = canvasPoint(event); setInteraction({ id: element.id, kind: 'resize', startX: point.x, startY: point.y, startWidth: element.width, startHeight: element.height }); (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); };
  const moveInteraction = (event: React.PointerEvent) => {
    if (!interaction) return; const point = canvasPoint(event); const element = activeSlide.elements.find((item) => item.id === interaction.id); if (!element || element.locked) return;
    if (interaction.kind === 'drag') { const desiredX = point.x - (interaction.dx || 0); const desiredY = point.y - (interaction.dy || 0); if (snapEnabled) { const snapped = snapStudioElement(element, desiredX, desiredY, activeSlide.elements, SLIDE_WIDTH, SLIDE_HEIGHT, 14); updateElement(element.id, { x: snapped.x, y: snapped.y }); setGuides(snapped.guides); } else updateElement(element.id, { x: desiredX, y: desiredY }); }
    else { const width = Math.max(30, (interaction.startWidth || element.width) + (point.x - (interaction.startX || point.x))); const rawHeight = Math.max(30, (interaction.startHeight || element.height) + (point.y - (interaction.startY || point.y))); const height = event.shiftKey ? width * ((interaction.startHeight || element.height) / Math.max(1, interaction.startWidth || element.width)) : rawHeight; updateElement(element.id, { width, height }); }
  };
  const stopInteraction = () => { setInteraction(null); setGuides({ vertical: [], horizontal: [] }); };

  const addBullet = () => updateSlide({ bullets: [...(activeSlide.bullets || []), 'Novo ponto'] });
  const setBullet = (index: number, value: string) => updateSlide({ bullets: (activeSlide.bullets || []).map((bullet, itemIndex) => itemIndex === index ? value : bullet) });
  const removeBullet = (index: number) => updateSlide({ bullets: (activeSlide.bullets || []).filter((_, itemIndex) => itemIndex !== index) });

  const applyDeckTemplate = (kind: 'pitch' | 'school' | 'report') => {
    if (!window.confirm('Substituir a apresentação atual pelo modelo selecionado?')) return;
    const slides: StudioSlide[] = kind === 'pitch' ? [newSlide('title'), { ...newSlide('content'), title: 'Problema / oportunidade', bullets: ['Contexto', 'Impacto', 'Por que agora?'] }, { ...newSlide('two-column'), title: 'Solução', bullets: ['Proposta de valor', 'Diferenciais', 'Como funciona'] }, { ...newSlide('content'), title: 'Resultados e próximos passos', bullets: ['Indicadores', 'Cronograma', 'Decisão necessária'] }]
      : kind === 'school' ? [newSlide('title'), { ...newSlide('content'), title: 'Introdução', bullets: ['Tema', 'Objetivo', 'Contexto'] }, { ...newSlide('two-column'), title: 'Desenvolvimento', bullets: ['Conceitos', 'Dados e exemplos', 'Análise'] }, { ...newSlide('content'), title: 'Conclusão', bullets: ['Síntese', 'Aprendizados', 'Referências'] }]
        : [newSlide('title'), { ...newSlide('content'), title: 'Resumo executivo', bullets: ['Situação atual', 'Principais números', 'Mensagem central'] }, { ...newSlide('two-column'), title: 'Resultados', bullets: ['Desempenho', 'Variações', 'Causas'] }, { ...newSlide('content'), title: 'Plano de ação', bullets: ['Prioridade 1', 'Prioridade 2', 'Responsáveis e prazos'] }];
    slides[0].title = kind === 'pitch' ? 'Pitch do projeto' : kind === 'school' ? 'Apresentação do trabalho' : 'Revisão executiva'; slides[0].subtitle = 'Subtítulo · Autor · Data';
    setDeck((current) => ({ ...current, slides })); setActiveIndex(0); setSelectedId(null);
  };

  const runAiOutline = async () => {
    const prompt = window.prompt('Tema da apresentação:'); if (!prompt?.trim()) return; setAiBusy(true);
    try {
      const answer = await sendToVercel(engineProvider, engineModel, [{ role: 'system', content: 'Crie um roteiro de apresentação com 5 a 8 slides. Retorne JSON estrito: {"title":"...","slides":[{"title":"...","bullets":["..."],"layout":"title|content|two-column|quote"}]}. Não use Markdown e não invente dados específicos.' }, { role: 'user', content: prompt.trim() }]);
      const match = answer.match(/\{[\s\S]*\}/); if (!match) throw new Error('A IA não retornou JSON válido.'); const parsed = JSON.parse(match[0]);
      const slides: StudioSlide[] = (Array.isArray(parsed.slides) ? parsed.slides : []).slice(0, 10).map((item: any) => ({ ...newSlide(['title','content','two-column','quote'].includes(item.layout) ? item.layout : 'content'), title: String(item.title || 'Slide'), bullets: Array.isArray(item.bullets) ? item.bullets.slice(0, 7).map(String) : [] }));
      if (!slides.length) throw new Error('Nenhum slide utilizável foi gerado.'); setDeck((current) => ({ ...current, title: String(parsed.title || current.title), slides })); setActiveIndex(0); setSelectedId(null); showNotification('Roteiro criado pela IA.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao criar roteiro.', 'error'); } finally { setAiBusy(false); }
  };

  const addPptxSlide = async (pptx: PptxGenJS, source: StudioSlide) => {
    const slide = pptx.addSlide(); const bg = source.background || theme.bg; slide.background = { color: bg.replace('#', '') }; const textColor = theme.text.replace('#', ''); const accent = theme.accent.replace('#', ''); const face = fontFace(deck.fontFamily);
    if (source.layout === 'title') { slide.addText(source.title, { x: 0.85, y: 2.1, w: 11.65, h: 1.05, fontFace: face, fontSize: 30, bold: true, color: textColor, align: 'center', margin: 0 }); if (source.subtitle) slide.addText(source.subtitle, { x: 1.3, y: 3.28, w: 10.7, h: 0.55, fontFace: face, fontSize: 16, color: accent, align: 'center', margin: 0 }); }
    else if (source.layout === 'quote') { slide.addText(`“${source.title}”`, { x: 1.0, y: 1.7, w: 11.3, h: 2.5, fontFace: face, fontSize: 28, italic: true, bold: true, color: textColor, align: 'center', valign: 'mid' as any, margin: 0.05 }); if (source.subtitle) slide.addText(source.subtitle, { x: 2.0, y: 4.6, w: 9.3, h: 0.5, fontFace: face, fontSize: 14, color: accent, align: 'right', margin: 0 }); }
    else { slide.addText(source.title, { x: 0.72, y: 0.48, w: 11.9, h: 0.65, fontFace: face, fontSize: 24, bold: true, color: textColor, margin: 0 }); if (source.bullets?.length) slide.addText(source.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), { x: 0.9, y: 1.5, w: source.layout === 'two-column' ? 5.4 : 11.2, h: 4.8, fontFace: face, fontSize: 18, color: textColor, breakLine: true, valign: 'top', margin: 0.06 }); }
    const shapeTypes = (pptx as any).ShapeType || {};
    for (const element of source.elements) {
      const x = element.x / SLIDE_WIDTH * PPTX_WIDTH; const y = element.y / SLIDE_HEIGHT * PPTX_HEIGHT; const w = element.width / SLIDE_WIDTH * PPTX_WIDTH; const h = element.height / SLIDE_HEIGHT * PPTX_HEIGHT;
      if (element.type === 'text') slide.addText(element.content, { x, y, w, h, fontFace: fontFace(element.fontFamily), fontSize: Math.max(8, element.fontSize * 0.75), bold: element.fontWeight >= 700, color: element.fill.replace('#', ''), align: element.textAlign, rotate: element.rotation, margin: 0.02, transparency: Math.round((1 - element.opacity) * 100) });
      else if (element.type === 'image' && element.content) slide.addImage({ data: element.content, x, y, w, h, rotate: element.rotation, transparency: Math.round((1 - element.opacity) * 100) });
      else if (element.type === 'shape') {
        const map: Record<StudioShape, string> = { rectangle: 'rect', rounded: 'roundRect', circle: 'ellipse', triangle: 'triangle', diamond: 'diamond', arrow: 'rightArrow', star: 'star5', line: 'line' }; const shape = shapeTypes[map[element.shape || 'rectangle']] || map[element.shape || 'rectangle'];
        slide.addShape(shape as any, { x, y, w, h, rotate: element.rotation, fill: element.shape === 'line' ? { color: 'FFFFFF', transparency: 100 } : { color: element.fill.replace('#', ''), transparency: Math.round((1 - element.opacity) * 100) }, line: { color: (element.stroke === 'transparent' ? element.fill : element.stroke).replace('#', ''), width: Math.max(1, element.strokeWidth || (element.shape === 'line' ? 3 : 0.5)), transparency: element.stroke === 'transparent' && element.shape !== 'line' ? 100 : 0 } });
      }
    }
    if (source.notes) slide.addNotes(source.notes);
  };

  const exportPptx = async () => {
    setExportBusy(true); try { const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'OrbiDoc'; pptx.title = deck.title; for (const source of deck.slides) await addPptxSlide(pptx, source); const blob = await pptx.write({ outputType: 'blob' }) as Blob; saveAs(blob, `${cleanFileName(deck.title)}.pptx`); onSaveToHistory?.({ type: 'powerpoint', title: deck.title, summary: `${deck.slides.length} slides exportados em PPTX.`, tags: ['PPTX', 'Apresentação'] }); showNotification('PPTX exportado.', 'success'); } catch (error: any) { showNotification(error?.message || 'Falha ao exportar PPTX.', 'error'); } finally { setExportBusy(false); }
  };

  const renderSlideCanvas = async (source: StudioSlide) => {
    const canvas = document.createElement('canvas'); canvas.width = SLIDE_WIDTH; canvas.height = SLIDE_HEIGHT; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas indisponível.'); const bg = source.background || theme.bg; ctx.fillStyle = bg; ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT); ctx.fillStyle = theme.text; ctx.font = `800 76px ${deck.fontFamily}`;
    if (source.layout === 'title') { ctx.textAlign = 'center'; ctx.fillText(source.title, SLIDE_WIDTH / 2, 430, 1500); if (source.subtitle) { ctx.fillStyle = theme.accent; ctx.font = `500 38px ${deck.fontFamily}`; ctx.fillText(source.subtitle, SLIDE_WIDTH / 2, 525, 1400); } }
    else if (source.layout === 'quote') { ctx.textAlign = 'center'; ctx.font = `italic 800 64px ${deck.fontFamily}`; wrapText(ctx, `“${source.title}”`, 1500).slice(0, 4).forEach((line, index) => ctx.fillText(line, SLIDE_WIDTH / 2, 360 + index * 82)); if (source.subtitle) { ctx.fillStyle = theme.accent; ctx.font = `500 32px ${deck.fontFamily}`; ctx.textAlign = 'right'; ctx.fillText(source.subtitle, 1650, 760); } }
    else { ctx.textAlign = 'left'; ctx.font = `800 58px ${deck.fontFamily}`; ctx.fillText(source.title, 120, 150, 1600); ctx.font = `500 38px ${deck.fontFamily}`; let y = 300; for (const bullet of source.bullets || []) { ctx.fillStyle = theme.accent; ctx.fillText('•', 145, y); ctx.fillStyle = theme.text; wrapText(ctx, bullet, source.layout === 'two-column' ? 700 : 1450).slice(0, 2).forEach((line, index) => ctx.fillText(line, 200, y + index * 48)); y += 100; } }
    for (const element of source.elements) {
      ctx.save(); ctx.globalAlpha = element.opacity; ctx.translate(element.x + element.width / 2, element.y + element.height / 2); ctx.rotate(element.rotation * Math.PI / 180);
      if (element.type === 'text') { ctx.fillStyle = element.fill; ctx.font = `${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`; ctx.textAlign = element.textAlign; ctx.textBaseline = 'top'; const anchor = element.textAlign === 'center' ? 0 : element.textAlign === 'right' ? element.width / 2 : -element.width / 2; wrapText(ctx, element.content, element.width).slice(0, 8).forEach((line, index) => ctx.fillText(line, anchor, -element.height / 2 + index * element.fontSize * 1.18)); }
      else if (element.type === 'image' && element.content) { const image = await loadImage(element.content).catch(() => null); if (image) ctx.drawImage(image, -element.width / 2, -element.height / 2, element.width, element.height); }
      else if (element.type === 'shape') { const w = element.width; const h = element.height; ctx.fillStyle = element.fill; ctx.beginPath(); if (element.shape === 'circle') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); else if (element.shape === 'triangle') { ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); } else if (element.shape === 'diamond') { ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); } else if (element.shape === 'line') { ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.strokeStyle = element.stroke === 'transparent' ? element.fill : element.stroke; ctx.lineWidth = Math.max(2, element.strokeWidth || 5); ctx.stroke(); ctx.restore(); continue; } else ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); }
      ctx.restore();
    }
    return canvas;
  };

  const exportPdf = async () => {
    setExportBusy(true); try { const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); for (let index = 0; index < deck.slides.length; index += 1) { if (index > 0) pdf.addPage('a4', 'landscape'); const canvas = await renderSlideCanvas(deck.slides[index]); const w = pdf.internal.pageSize.getWidth(); const h = pdf.internal.pageSize.getHeight(); pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, w, h, undefined, 'FAST'); } pdf.save(`${cleanFileName(deck.title)}.pdf`); onSaveToHistory?.({ type: 'powerpoint', title: deck.title, summary: `${deck.slides.length} slides exportados em PDF.`, tags: ['PDF', 'Apresentação'] }); showNotification('PDF exportado.', 'success'); } catch (error: any) { showNotification(error?.message || 'Falha ao exportar PDF.', 'error'); } finally { setExportBusy(false); }
  };

  return <>
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <div className="min-h-12 px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap">
        <input value={deck.title} onChange={(event) => setDeck((current) => ({ ...current, title: event.target.value }))} className="min-w-[180px] flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome da apresentação" /><span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <select defaultValue="" onChange={(event) => { if (event.target.value) applyDeckTemplate(event.target.value as 'pitch' | 'school' | 'report'); event.target.value = ''; }} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold"><option value="">Modelos…</option><option value="pitch">Pitch de projeto</option><option value="school">Apresentação escolar</option><option value="report">Revisão executiva</option></select>
        <select value={deck.theme} onChange={(event) => setDeck((current) => ({ ...current, theme: event.target.value as ThemeId }))} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold">{Object.keys(THEMES).map((key) => <option key={key} value={key}>{({ orbi: 'Orbi', light: 'Claro', dark: 'Escuro', corporate: 'Corporativo', emerald: 'Esmeralda', warm: 'Quente' } as Record<string, string>)[key]}</option>)}</select>
        <select value={deck.fontFamily} onChange={(event) => setDeck((current) => ({ ...current, fontFamily: event.target.value }))} className="h-8 max-w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold">{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select>
        <button onClick={runAiOutline} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-black inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Gerando…' : 'Roteiro IA'}</button><button onClick={() => { setPresentIndex(activeIndex); setPresenting(true); }} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Apresentar</button>
        <div className="relative group"><button disabled={exportBusy} className="h-8 px-2.5 rounded-lg bg-orange-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />{exportBusy ? 'Exportando…' : 'Exportar'}</button><div className="hidden group-hover:block absolute right-0 top-8 z-40 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={() => void exportPptx()} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">PPTX editável</button><button onClick={() => void exportPdf()} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">PDF</button></div></div>
      </div>

      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto"><button onClick={() => addSlide('content')} className="h-8 px-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-700 text-[10px] font-black inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Slide</button><button onClick={() => addOverlay('text')} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Caixa de texto</button><div className="relative group"><button className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center gap-1"><Square className="w-3.5 h-3.5" /> Formas</button><div className="hidden group-hover:grid grid-cols-2 absolute top-8 left-0 z-40 w-52 rounded-xl border bg-white dark:bg-slate-900 shadow-xl p-1">{SHAPE_LIBRARY.map((shape) => <button key={shape.type} onClick={() => addOverlay('shape', shape.type)} className="p-2 text-left text-[10px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{shape.label}</button>)}</div></div><input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(event) => { if (event.target.files) void addImages(event.target.files); event.target.value = ''; }} /><button onClick={() => imageInputRef.current?.click()} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center gap-1"><Photo className="w-3.5 h-3.5" /> Imagem</button><button onClick={() => setSnapEnabled((value) => !value)} className={`h-8 px-2.5 rounded-lg border text-[10px] font-bold ${snapEnabled ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' : 'border-slate-200 dark:border-slate-700'}`}>Guias {snapEnabled ? 'ativas' : 'desligadas'}</button></div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <OrbitResizablePane storageKey="deck-slides" handle="end" defaultSize={196} min={132} max={340} label="lista de slides" disabled={compactViewport} className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 shrink-0"><aside className="flex-1 min-h-0 max-h-40 lg:max-h-none overflow-y-auto p-2 space-y-2">{deck.slides.map((slide, index) => <button key={slide.id} onClick={() => { setActiveIndex(index); setSelectedId(null); }} className={`w-full rounded-xl border p-1.5 text-left ${index === activeIndex ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-800'}`}><div className="text-[9px] font-black text-slate-400 mb-1">{index + 1}</div><SlideCanvas slide={slide} theme={theme} fontFamily={deck.fontFamily} miniature /><div className="mt-1 text-[9px] font-bold truncate">{slide.title || 'Slide em branco'}</div></button>)}</aside></OrbitResizablePane>

        <main className="flex-1 min-w-0 min-h-0 bg-slate-200/70 dark:bg-slate-950 p-3 sm:p-5 overflow-auto flex items-center justify-center"><div className="w-full max-w-[1000px]"><div ref={stageRef} onPointerMove={moveInteraction} onPointerUp={stopInteraction} onPointerCancel={stopInteraction} onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }} className="relative w-full aspect-video shadow-2xl overflow-hidden touch-none" style={{ background: activeSlide.background || theme.bg }}><SlideCanvas slide={activeSlide} theme={theme} fontFamily={deck.fontFamily} interactive selectedId={selectedId} onElementPointerDown={startDrag} onResizePointerDown={startResize} />{guides.vertical.map((value) => <div key={`v-${value}`} className="absolute top-0 bottom-0 w-px bg-fuchsia-500 z-[95] pointer-events-none" style={{ left: `${value / SLIDE_WIDTH * 100}%` }} />)}{guides.horizontal.map((value) => <div key={`h-${value}`} className="absolute left-0 right-0 h-px bg-fuchsia-500 z-[95] pointer-events-none" style={{ top: `${value / SLIDE_HEIGHT * 100}%` }} />)}</div></div></main>

        <OrbitResizablePane storageKey="deck-inspector" handle="start" defaultSize={306} min={240} max={520} label="inspetor do slide" disabled={compactViewport} className="border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 shrink-0"><aside className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4"><div className="flex gap-1"><button onClick={duplicateSlide} className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-1"><Copy className="w-3.5 h-3.5" /> Duplicar slide</button><button onClick={() => moveSlide('up')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700"><ArrowUp className="w-4 h-4 mx-auto" /></button><button onClick={() => moveSlide('down')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700"><ArrowDown className="w-4 h-4 mx-auto" /></button></div>
          <section className="space-y-2"><div className="text-[10px] font-black uppercase text-slate-400">Conteúdo do slide</div><select value={activeSlide.layout} onChange={(event) => updateSlide({ layout: event.target.value as SlideData['layout'] })} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-[10px]"><option value="title">Capa</option><option value="content">Conteúdo</option><option value="two-column">Duas colunas</option><option value="quote">Citação</option><option value="image">Imagem / conteúdo</option></select><input value={activeSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs font-bold" placeholder="Título" />{(activeSlide.layout === 'title' || activeSlide.layout === 'quote') && <input value={activeSlide.subtitle || ''} onChange={(event) => updateSlide({ subtitle: event.target.value })} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs" placeholder="Subtítulo / fonte" />}{!['title','quote'].includes(activeSlide.layout) && <div><div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-400 uppercase">Pontos</span><button onClick={addBullet} className="text-[10px] font-black text-orange-600">+ adicionar</button></div><div className="mt-1 space-y-1.5">{(activeSlide.bullets || []).map((bullet, index) => <div key={index} className="flex gap-1"><input value={bullet} onChange={(event) => setBullet(index, event.target.value)} className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><button onClick={() => removeBullet(index)} className="w-8 h-8 rounded-lg text-rose-500">×</button></div>)}</div></div>}<label className="text-[10px]">Fundo do slide<input type="color" value={activeSlide.background || theme.bg} onChange={(event) => updateSlide({ background: event.target.value })} className="mt-1 w-full h-9" /></label><label className="text-[10px]">Notas do apresentador<textarea value={activeSlide.notes || ''} onChange={(event) => updateSlide({ notes: event.target.value })} className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-[10px]" /></label></section>
          {selected && <section className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3"><div className="text-[10px] font-black uppercase text-slate-400">Elemento selecionado</div><div className="flex gap-1"><button onClick={duplicateElement} className="flex-1 h-8 rounded-lg border text-[10px] font-bold">Duplicar</button><button onClick={() => moveLayer('up')} className="w-8 h-8 rounded-lg border"><ArrowUp className="w-3.5 h-3.5 mx-auto" /></button><button onClick={() => moveLayer('down')} className="w-8 h-8 rounded-lg border"><ArrowDown className="w-3.5 h-3.5 mx-auto" /></button></div>{selected.type === 'text' && <><textarea value={selected.content} onChange={(event) => updateElement(selected.id, { content: event.target.value })} className="w-full min-h-20 rounded-xl border bg-slate-50 dark:bg-slate-950 p-2 text-xs" /><select value={selected.fontFamily} onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value })} className="w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-xs">{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select><input type="number" min="12" max="220" value={Math.round(selected.fontSize)} onChange={(event) => updateElement(selected.id, { fontSize: Math.max(12, Number(event.target.value) || 12) })} className="w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-xs" /></>}{selected.type === 'shape' && <select value={selected.shape || 'rectangle'} onChange={(event) => updateElement(selected.id, { shape: event.target.value as StudioShape })} className="w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-xs">{SHAPE_LIBRARY.map((shape) => <option key={shape.type} value={shape.type}>{shape.label}</option>)}</select>}{selected.type !== 'image' && <label className="text-[10px]">Cor<input type="color" value={selected.fill === 'transparent' ? theme.accent : selected.fill} onChange={(event) => updateElement(selected.id, { fill: event.target.value })} className="mt-1 w-full h-9" /></label>}<div className="grid grid-cols-2 gap-2"><NumberField label="X" value={selected.x} onChange={(value) => updateElement(selected.id, { x: value })} /><NumberField label="Y" value={selected.y} onChange={(value) => updateElement(selected.id, { y: value })} /><NumberField label="Largura" value={selected.width} onChange={(value) => updateElement(selected.id, { width: Math.max(20, value) })} /><NumberField label="Altura" value={selected.height} onChange={(value) => updateElement(selected.id, { height: Math.max(20, value) })} /></div><button onClick={removeElement} className="w-full h-9 rounded-xl border border-rose-200 text-rose-600 text-[10px] font-black inline-flex items-center justify-center gap-1"><Trash className="w-3.5 h-3.5" /> Excluir elemento</button></section>}
          <button onClick={deleteSlide} disabled={deck.slides.length <= 1} className="w-full h-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-black disabled:opacity-40 inline-flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Excluir slide</button><div className="text-[10px] text-slate-400 flex items-center gap-1"><Layout className="w-3.5 h-3.5" /> {deck.slides.length} slides · {activeSlide.elements.length} elementos livres</div></aside></OrbitResizablePane>
      </div>
    </div>

    {presenting && <div className="fixed inset-0 z-[160] bg-black flex items-center justify-center" onClick={() => setPresentIndex((index) => Math.min(deck.slides.length - 1, index + 1))}><button onClick={(event) => { event.stopPropagation(); setPresenting(false); }} className="absolute right-4 top-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white"><X className="w-5 h-5 mx-auto" /></button><div className="w-full max-w-[1600px] aspect-video" style={{ background: deck.slides[presentIndex]?.background || theme.bg }}><SlideCanvas slide={deck.slides[presentIndex]} theme={theme} fontFamily={deck.fontFamily} present /></div><div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">{presentIndex + 1} / {deck.slides.length} · clique para avançar</div></div>}
  </>;
};

const SlideCanvas: React.FC<{ slide: StudioSlide; theme: Theme; fontFamily: string; miniature?: boolean; present?: boolean; interactive?: boolean; selectedId?: string | null; onElementPointerDown?: (event: React.PointerEvent, element: StudioElement) => void; onResizePointerDown?: (event: React.PointerEvent, element: StudioElement) => void }> = ({ slide, theme, fontFamily, miniature = false, present = false, interactive = false, selectedId, onElementPointerDown, onResizePointerDown }) => {
  const titleClass = miniature ? 'text-[5px]' : present ? 'text-5xl lg:text-7xl' : 'text-xl sm:text-3xl lg:text-4xl'; const bodyClass = miniature ? 'text-[3px]' : present ? 'text-xl lg:text-3xl' : 'text-xs sm:text-base lg:text-lg';
  return <div className="relative w-full h-full overflow-hidden" style={{ background: slide.background || theme.bg, color: theme.text, fontFamily }}>
    {slide.layout === 'title' ? <div className="absolute inset-0 p-[7%] flex flex-col items-center justify-center text-center"><h1 className={`${titleClass} font-black leading-tight`}>{slide.title}</h1>{slide.subtitle && <p className={`${bodyClass} mt-[4%] font-semibold`} style={{ color: theme.accent }}>{slide.subtitle}</p>}</div>
      : slide.layout === 'quote' ? <div className="absolute inset-0 p-[9%] flex flex-col items-center justify-center text-center"><div className={`${titleClass} italic font-black leading-tight`}>“{slide.title}”</div>{slide.subtitle && <div className={`${bodyClass} mt-[6%] self-end`} style={{ color: theme.accent }}>{slide.subtitle}</div>}</div>
        : <div className="absolute inset-0 p-[6%] flex flex-col"><h2 className={`${titleClass} font-black leading-tight`}>{slide.title}</h2><div className={`mt-[5%] flex-1 grid ${slide.layout === 'two-column' ? 'grid-cols-2 gap-[6%]' : 'grid-cols-1'} min-h-0`}><ul className={`${bodyClass} space-y-[3%] leading-relaxed`}>{(slide.bullets || []).map((bullet, index) => <li key={index} className="flex gap-[2%]"><span style={{ color: theme.accent }}>•</span><span>{bullet}</span></li>)}</ul></div></div>}
    {slide.elements.map((element) => <div key={element.id} onPointerDown={(event) => interactive && onElementPointerDown?.(event, element)} className={`${interactive && selectedId === element.id ? 'outline outline-2 outline-fuchsia-500 outline-offset-2 z-[80]' : ''}`} style={{ position: 'absolute', left: `${element.x / SLIDE_WIDTH * 100}%`, top: `${element.y / SLIDE_HEIGHT * 100}%`, width: `${element.width / SLIDE_WIDTH * 100}%`, height: `${element.height / SLIDE_HEIGHT * 100}%`, transform: `rotate(${element.rotation}deg)`, opacity: element.opacity, cursor: interactive ? 'move' : 'default' }}>{element.type === 'text' ? <div className="w-full h-full overflow-hidden whitespace-pre-wrap leading-[1.15]" style={{ color: element.fill, fontFamily: element.fontFamily, fontSize: miniature ? `${Math.max(2, element.fontSize / 13)}px` : `${element.fontSize / SLIDE_WIDTH * 100}vw`, fontWeight: element.fontWeight, textAlign: element.textAlign }}>{element.content}</div> : element.type === 'image' ? <img src={element.content} alt="" draggable={false} className="w-full h-full object-fill pointer-events-none" /> : element.shape === 'line' ? <div className="absolute left-0 right-0 top-1/2" style={{ borderTop: `${Math.max(1, element.strokeWidth || 4)}px solid ${element.stroke === 'transparent' ? element.fill : element.stroke}` }} /> : <div className="w-full h-full" style={{ background: element.fill, borderRadius: element.shape === 'circle' ? '50%' : element.shape === 'rounded' ? '14%' : undefined, clipPath: shapeClipPath(element.shape || 'rectangle') }} />}{interactive && selectedId === element.id && !element.locked && <button aria-label="Redimensionar" onPointerDown={(event) => onResizePointerDown?.(event, element)} className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-white border-2 border-fuchsia-500" />}</div>)}
  </div>;
};

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => <label className="text-[10px]">{label}<input type="number" value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value) || 0)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2" /></label>;
