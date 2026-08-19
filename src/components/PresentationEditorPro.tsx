import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCopy as Copy,
  IconDownload as Download,
  IconLayout as Layout,
  IconPhoto as Photo,
  IconPlayerPlay as Play,
  IconPlus as Plus,
  IconSparkles as Sparkles,
  IconTrash as Trash,
} from '@tabler/icons-react';
import PptxGenJS from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject, SlideData } from '../types';

interface PresentationEditorProProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type ThemeId = 'light' | 'dark' | 'indigo' | 'emerald';
type DeckState = { title: string; slides: SlideData[]; theme: ThemeId };
type Theme = { bg: string; text: string; accent: string; className: string };

const THEMES: Record<ThemeId, Theme> = {
  light: { bg: '#FFFFFF', text: '#0F172A', accent: '#2563EB', className: 'bg-white text-slate-950' },
  dark: { bg: '#0F172A', text: '#F8FAFC', accent: '#38BDF8', className: 'bg-slate-900 text-white' },
  indigo: { bg: '#1E1B4B', text: '#FFFFFF', accent: '#A5B4FC', className: 'bg-indigo-950 text-white' },
  emerald: { bg: '#022C22', text: '#FFFFFF', accent: '#6EE7B7', className: 'bg-emerald-950 text-white' },
};

const newSlide = (layout: SlideData['layout'] = 'content'): SlideData => ({
  id: crypto.randomUUID(),
  title: layout === 'title' ? 'Título da apresentação' : layout === 'quote' ? 'Uma ideia que merece destaque' : 'Novo slide',
  subtitle: layout === 'title' ? 'Subtítulo ou contexto' : layout === 'quote' ? 'Fonte ou contexto' : undefined,
  bullets: layout === 'content' || layout === 'two-column' ? ['Primeiro ponto', 'Segundo ponto'] : [],
  bgGradient: '',
  layout,
  notes: '',
});

const defaultDeck = (title = 'Nova apresentação'): DeckState => ({ title, theme: 'light', slides: [newSlide('title'), newSlide('content')] });
const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Apresentacao';

const imageDimensions = (data: string) => new Promise<{ width: number; height: number }>((resolve) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth || image.width || 1, height: image.naturalHeight || image.height || 1 });
  image.onerror = () => resolve({ width: 16, height: 9 });
  image.src = data;
});

const fitRect = (sourceWidth: number, sourceHeight: number, x: number, y: number, width: number, height: number) => {
  const ratio = Math.min(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
  const w = sourceWidth * ratio;
  const h = sourceHeight * ratio;
  return { x: x + (width - w) / 2, y: y + (height - h) / 2, w, h };
};

export const PresentationEditorPro: React.FC<PresentationEditorProProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_presentation_v3_${project.id}`;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [deck, setDeck] = useState<DeckState>(() => {
    try {
      const local = localStorage.getItem(storageKey);
      if (local) return JSON.parse(local).deck || defaultDeck(project.title);
      if (project.content && typeof project.content === 'object' && Array.isArray((project.content as any).slides)) return project.content as DeckState;
    } catch { /* default */ }
    return defaultDeck(project.title || 'Nova apresentação');
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastSaved, setLastSaved] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const activeSlide = deck.slides[Math.min(activeIndex, deck.slides.length - 1)] || deck.slides[0];
  const theme = THEMES[deck.theme] || THEMES.light;

  useEffect(() => {
    if (activeIndex >= deck.slides.length) setActiveIndex(Math.max(0, deck.slides.length - 1));
  }, [deck.slides.length, activeIndex]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = {
        ...project,
        title: deck.title,
        content: deck,
        previewSnippet: `${deck.slides.length} slide(s) · ${deck.slides[0]?.title || 'Apresentação'}`,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify({ deck, updatedAt: updated.updatedAt }));
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [deck, project.id]);

  const updateSlide = (patch: Partial<SlideData>) => {
    setDeck((current) => ({ ...current, slides: current.slides.map((slide, index) => index === activeIndex ? { ...slide, ...patch } : slide) }));
  };

  const addSlide = (layout: SlideData['layout'] = 'content') => {
    const slide = newSlide(layout);
    setDeck((current) => {
      const slides = [...current.slides, slide];
      window.queueMicrotask(() => setActiveIndex(slides.length - 1));
      return { ...current, slides };
    });
  };

  const duplicateSlide = () => {
    if (!activeSlide) return;
    const duplicate: SlideData = { ...activeSlide, id: crypto.randomUUID(), bullets: [...(activeSlide.bullets || [])] };
    setDeck((current) => {
      const slides = [...current.slides];
      slides.splice(activeIndex + 1, 0, duplicate);
      return { ...current, slides };
    });
    setActiveIndex((index) => index + 1);
  };

  const deleteSlide = () => {
    if (deck.slides.length <= 1) return;
    setDeck((current) => ({ ...current, slides: current.slides.filter((_, index) => index !== activeIndex) }));
    setActiveIndex((index) => Math.max(0, index - 1));
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= deck.slides.length || from === to) return;
    setDeck((current) => {
      const slides = [...current.slides];
      const [item] = slides.splice(from, 1);
      slides.splice(to, 0, item);
      return { ...current, slides };
    });
    setActiveIndex(to);
  };

  const insertImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione uma imagem válida.', 'error');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showNotification('A imagem precisa ter menos de 12 MB.', 'error');
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    updateSlide({ image: data, layout: activeSlide.layout === 'title' ? 'image' : activeSlide.layout });
  };

  const addPptxSlide = async (pptx: PptxGenJS, source: SlideData) => {
    const slide = pptx.addSlide();
    const textColor = theme.text.replace('#', '');
    const accent = theme.accent.replace('#', '');
    slide.background = { color: theme.bg.replace('#', '') };

    if (source.layout === 'title') {
      slide.addText(source.title, { x: 0.8, y: 2.15, w: 11.7, h: 0.9, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: textColor, align: 'center', margin: 0 });
      if (source.subtitle) slide.addText(source.subtitle, { x: 1.2, y: 3.2, w: 10.9, h: 0.55, fontFace: 'Aptos', fontSize: 16, color: accent, align: 'center', margin: 0 });
    } else if (source.layout === 'quote') {
      slide.addText(`“${source.title}”`, { x: 1.0, y: 1.75, w: 11.3, h: 2.4, fontFace: 'Aptos Display', fontSize: 28, italic: true, bold: true, color: textColor, align: 'center', valign: 'mid' as any, margin: 0.05 });
      if (source.subtitle) slide.addText(source.subtitle, { x: 2.0, y: 4.55, w: 9.3, h: 0.5, fontFace: 'Aptos', fontSize: 14, color: accent, align: 'right', margin: 0 });
    } else {
      slide.addText(source.title, { x: 0.7, y: 0.45, w: 12, h: 0.65, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: textColor, margin: 0 });
      const hasImage = Boolean(source.image);
      if (source.bullets?.length) {
        const bulletWidth = hasImage ? 5.6 : 11.3;
        slide.addText(source.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), { x: 0.9, y: 1.55, w: bulletWidth, h: 4.6, fontFace: 'Aptos', fontSize: 18, color: textColor, breakLine: true, valign: 'top', margin: 0.06 });
      }
      if (source.image) {
        const dims = await imageDimensions(source.image);
        const fitted = fitRect(dims.width, dims.height, source.layout === 'image' ? 6.6 : 7.0, 1.45, source.layout === 'image' ? 5.8 : 5.2, 4.6);
        slide.addImage({ data: source.image, x: fitted.x, y: fitted.y, w: fitted.w, h: fitted.h });
      }
    }
    if (source.notes) slide.addNotes(source.notes);
  };

  const exportPptx = async () => {
    setExportBusy(true);
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'DocSwiss';
      pptx.subject = deck.title;
      pptx.title = deck.title;
      for (const source of deck.slides) await addPptxSlide(pptx, source);
      const blob = await pptx.write({ outputType: 'blob' }) as Blob;
      saveAs(blob, `${cleanFileName(deck.title)}.pptx`);
      onSaveToHistory?.({ type: 'powerpoint', title: deck.title, summary: `${deck.slides.length} slides exportados em PPTX.`, details: deck.slides.map((slide) => `${slide.title}\n${(slide.bullets || []).join('\n')}`).join('\n\n'), tags: ['PPTX', 'Apresentação'] });
      showNotification('PPTX exportado.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao exportar PPTX.', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const addPdfImage = async (pdf: jsPDF, data: string, box: { x: number; y: number; w: number; h: number }) => {
    const dims = await imageDimensions(data);
    const fitted = fitRect(dims.width, dims.height, box.x, box.y, box.w, box.h);
    try {
      pdf.addImage(data, undefined as any, fitted.x, fitted.y, fitted.w, fitted.h, undefined, 'FAST');
    } catch {
      const image = new Image();
      image.src = data;
      await image.decode().catch(() => {});
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, image.naturalWidth || 1600);
      canvas.height = Math.max(1, image.naturalHeight || 900);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', fitted.x, fitted.y, fitted.w, fitted.h, undefined, 'FAST');
    }
  };

  const exportPdf = async () => {
    setExportBusy(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      for (let index = 0; index < deck.slides.length; index += 1) {
        const source = deck.slides[index];
        if (index > 0) pdf.addPage('a4', 'landscape');
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        pdf.setFillColor(theme.bg); pdf.rect(0, 0, width, height, 'F');
        pdf.setTextColor(theme.text);

        if (source.layout === 'title') {
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(28);
          pdf.text(pdf.splitTextToSize(source.title, width - 42), width / 2, 72, { align: 'center' });
          if (source.subtitle) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(13); pdf.setTextColor(theme.accent); pdf.text(pdf.splitTextToSize(source.subtitle, width - 55), width / 2, 96, { align: 'center' }); }
        } else if (source.layout === 'quote') {
          pdf.setFont('helvetica', 'italic'); pdf.setFontSize(25);
          pdf.text(pdf.splitTextToSize(`“${source.title}”`, width - 60), width / 2, 75, { align: 'center' });
          if (source.subtitle) { pdf.setFontSize(12); pdf.setTextColor(theme.accent); pdf.text(source.subtitle, width - 30, 122, { align: 'right' }); }
        } else {
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
          pdf.text(pdf.splitTextToSize(source.title, width - 36), 18, 24);
          const imageBox = { x: width * 0.57, y: 40, w: width * 0.38, h: height - 55 };
          if (source.image) await addPdfImage(pdf, source.image, imageBox);
          if (source.bullets?.length) {
            pdf.setTextColor(theme.text); pdf.setFontSize(13); pdf.setFont('helvetica', 'normal');
            let y = 46;
            const maxWidth = source.image ? width * 0.48 : width - 48;
            for (const bullet of source.bullets) {
              const lines = pdf.splitTextToSize(`• ${bullet}`, maxWidth);
              if (y + lines.length * 6 > height - 15) break;
              pdf.text(lines, 24, y);
              y += lines.length * 6 + 4;
            }
          }
        }
      }
      saveAs(pdf.output('blob'), `${cleanFileName(deck.title)}.pdf`);
      onSaveToHistory?.({ type: 'powerpoint', title: deck.title, summary: `${deck.slides.length} slides exportados em PDF.`, details: deck.slides.map((slide) => `${slide.title}\n${(slide.bullets || []).join('\n')}`).join('\n\n'), tags: ['PDF', 'Apresentação'] });
      showNotification('PDF da apresentação exportado com imagens.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao exportar PDF.', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const generateWithAi = async () => {
    const topic = window.prompt('Tema da apresentação:');
    if (!topic?.trim()) return;
    setAiBusy(true);
    try {
      const response = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: 'Crie uma apresentação objetiva em JSON estrito. Formato: {"title":"...","slides":[{"title":"...","subtitle":"...","bullets":["..."],"layout":"title|content|two-column|image|quote"}]}. Faça 6 a 8 slides. Não use Markdown fora do JSON.' },
        { role: 'user', content: topic.trim() },
      ]);
      const match = response.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('A IA não retornou uma estrutura válida.');
      const parsed = JSON.parse(match[0]);
      const allowedLayouts = new Set(['title', 'content', 'two-column', 'image', 'quote']);
      const slides: SlideData[] = (Array.isArray(parsed.slides) ? parsed.slides : []).slice(0, 12).map((item: any, index: number) => ({
        id: crypto.randomUUID(),
        title: String(item.title || `Slide ${index + 1}`).slice(0, 180),
        subtitle: item.subtitle ? String(item.subtitle).slice(0, 240) : undefined,
        bullets: Array.isArray(item.bullets) ? item.bullets.map((value: unknown) => String(value).slice(0, 280)).slice(0, 7) : [],
        bgGradient: '',
        layout: allowedLayouts.has(item.layout) ? item.layout : index === 0 ? 'title' : 'content',
        notes: '',
      }));
      if (!slides.length) throw new Error('Nenhum slide foi gerado.');
      setDeck((current) => ({ ...current, title: String(parsed.title || topic).slice(0, 180), slides }));
      setActiveIndex(0);
      showNotification(`${slides.length} slides gerados pela IA.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao gerar slides.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const setBullet = (index: number, value: string) => updateSlide({ bullets: (activeSlide.bullets || []).map((bullet, bulletIndex) => bulletIndex === index ? value : bullet) });
  const addBullet = () => updateSlide({ bullets: [...(activeSlide.bullets || []), 'Novo ponto'] });
  const removeBullet = (index: number) => updateSlide({ bullets: (activeSlide.bullets || []).filter((_, bulletIndex) => bulletIndex !== index) });
  const previewBullets = useMemo(() => (activeSlide?.bullets || []).filter(Boolean), [activeSlide]);

  if (presenting) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={() => setPresenting(false)}>
        <div className={`w-[min(94vw,1400px)] aspect-video rounded-xl overflow-hidden ${theme.className} relative`} onClick={(event) => event.stopPropagation()}>
          <SlideCanvas slide={activeSlide} theme={theme} present />
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3"><button onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="px-4 py-2 rounded-full bg-black/55 text-white text-xs">Anterior</button><span className="text-xs text-white/80">{activeIndex + 1}/{deck.slides.length}</span><button onClick={() => activeIndex === deck.slides.length - 1 ? setPresenting(false) : setActiveIndex((index) => index + 1)} className="px-4 py-2 rounded-full bg-black/55 text-white text-xs">Próximo</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <input value={deck.title} onChange={(event) => setDeck((current) => ({ ...current, title: event.target.value }))} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome da apresentação" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <button onClick={generateWithAi} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Gerando…' : 'Gerar com IA'}</button>
        <button onClick={() => setPresenting(true)} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Apresentar</button>
        <div className="relative group"><button disabled={exportBusy} className="h-8 px-2.5 rounded-lg bg-orange-600 text-white text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Download className="w-3.5 h-3.5" />{exportBusy ? 'Exportando…' : 'Exportar'}</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={() => void exportPptx()} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">PPTX</button><button onClick={() => void exportPdf()} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">PDF com imagens</button></div></div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="border-r border-slate-200 dark:border-slate-800 p-2 overflow-y-auto max-h-[760px] bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-1 mb-2"><button onClick={() => addSlide('content')} className="flex-1 h-8 rounded-lg bg-orange-600 text-white text-[10px] font-black inline-flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Novo slide</button><button onClick={duplicateSlide} className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center" title="Duplicar"><Copy className="w-4 h-4" /></button></div>
          <div className="space-y-2">{deck.slides.map((slide, index) => <button key={slide.id} onClick={() => setActiveIndex(index)} className={`w-full text-left rounded-xl border p-2 ${index === activeIndex ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}><div className="flex items-center gap-2"><span className="text-[9px] font-black text-slate-400">{index + 1}</span><span className="text-[10px] font-bold truncate flex-1">{slide.title}</span></div><div className={`mt-2 aspect-video rounded-md overflow-hidden ${theme.className}`}><SlideCanvas slide={slide} theme={theme} miniature /></div><div className="mt-1 flex justify-end gap-1"><span onClick={(event) => { event.stopPropagation(); moveSlide(index, index - 1); }} className="px-1.5 text-[9px] text-slate-400">↑</span><span onClick={(event) => { event.stopPropagation(); moveSlide(index, index + 1); }} className="px-1.5 text-[9px] text-slate-400">↓</span></div></button>)}</div>
        </aside>

        <main className="min-h-[560px] bg-slate-200/60 dark:bg-slate-950 p-4 sm:p-7 flex items-center justify-center overflow-auto">
          <div className={`w-full max-w-[980px] aspect-video rounded-xl shadow-xl overflow-hidden ${theme.className}`}><SlideCanvas slide={activeSlide} theme={theme} /></div>
        </main>

        <aside className="border-l border-slate-200 dark:border-slate-800 p-3 overflow-y-auto max-h-[760px] space-y-4">
          <div><label className="text-[10px] font-black text-slate-400 uppercase">Layout</label><select value={activeSlide.layout} onChange={(event) => updateSlide({ layout: event.target.value as SlideData['layout'] })} className="mt-1 w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs"><option value="title">Título</option><option value="content">Conteúdo</option><option value="two-column">Duas colunas</option><option value="image">Imagem + conteúdo</option><option value="quote">Citação</option></select></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase">Tema</label><select value={deck.theme} onChange={(event) => setDeck((current) => ({ ...current, theme: event.target.value as ThemeId }))} className="mt-1 w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs"><option value="light">Claro</option><option value="dark">Escuro</option><option value="indigo">Índigo</option><option value="emerald">Esmeralda</option></select></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase">Título</label><textarea value={activeSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs outline-none focus:border-orange-500" /></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase">Subtítulo / fonte</label><input value={activeSlide.subtitle || ''} onChange={(event) => updateSlide({ subtitle: event.target.value })} className="mt-1 w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs" /></div>
          <div><div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-400 uppercase">Pontos</label><button onClick={addBullet} className="text-[10px] font-black text-orange-600">+ adicionar</button></div><div className="mt-1 space-y-1.5">{(activeSlide.bullets || []).map((bullet, index) => <div key={index} className="flex gap-1"><input value={bullet} onChange={(event) => setBullet(index, event.target.value)} className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><button onClick={() => removeBullet(index)} className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">×</button></div>)}</div></div>
          <div><input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void insertImage(event.target.files?.[0]); event.target.value = ''; }} /><button onClick={() => imageInputRef.current?.click()} className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center justify-center gap-2"><Photo className="w-4 h-4" />{activeSlide.image ? 'Trocar imagem' : 'Adicionar imagem'}</button>{activeSlide.image && <button onClick={() => updateSlide({ image: undefined })} className="mt-1 w-full h-8 text-[10px] text-rose-500">Remover imagem</button>}</div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase">Notas do apresentador</label><textarea value={activeSlide.notes || ''} onChange={(event) => updateSlide({ notes: event.target.value })} className="mt-1 w-full min-h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-[10px]" /></div>
          <button onClick={deleteSlide} disabled={deck.slides.length <= 1} className="w-full h-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-black disabled:opacity-40 inline-flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Excluir slide</button>
        </aside>
      </div>
      <div className="h-10 px-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 text-[10px] text-slate-400"><Layout className="w-3.5 h-3.5" /> {deck.slides.length} slide(s) · {previewBullets.length} ponto(s) no slide atual</div>
    </div>
  );
};

const SlideCanvas: React.FC<{ slide: SlideData; theme: Theme; miniature?: boolean; present?: boolean }> = ({ slide, theme, miniature = false, present = false }) => {
  const titleClass = miniature ? 'text-[5px]' : present ? 'text-4xl lg:text-6xl' : 'text-xl sm:text-3xl lg:text-4xl';
  const bodyClass = miniature ? 'text-[3px]' : present ? 'text-xl lg:text-2xl' : 'text-xs sm:text-base lg:text-lg';
  if (slide.layout === 'title') return <div className="w-full h-full p-[7%] flex flex-col items-center justify-center text-center"><h1 className={`${titleClass} font-black leading-tight`}>{slide.title}</h1>{slide.subtitle && <p className={`${bodyClass} mt-[4%] font-semibold`} style={{ color: theme.accent }}>{slide.subtitle}</p>}</div>;
  if (slide.layout === 'quote') return <div className="w-full h-full p-[9%] flex flex-col items-center justify-center text-center"><div className={`${titleClass} italic font-black leading-tight`}>“{slide.title}”</div>{slide.subtitle && <div className={`${bodyClass} mt-[6%] self-end`} style={{ color: theme.accent }}>{slide.subtitle}</div>}</div>;
  return <div className="w-full h-full p-[6%] flex flex-col"><h2 className={`${titleClass} font-black leading-tight`}>{slide.title}</h2><div className={`mt-[5%] flex-1 grid ${slide.image ? 'grid-cols-2 gap-[5%]' : slide.layout === 'two-column' ? 'grid-cols-2 gap-[6%]' : 'grid-cols-1'} min-h-0`}><div className="min-h-0"><ul className={`${bodyClass} space-y-[3%] leading-relaxed`}>{(slide.bullets || []).map((bullet, index) => <li key={index} className="flex gap-[2%]"><span style={{ color: theme.accent }}>•</span><span>{bullet}</span></li>)}</ul></div>{slide.image && <div className="min-h-0 flex items-center justify-center"><img src={slide.image} alt="" className="max-w-full max-h-full object-contain rounded-lg" /></div>}</div></div>;
};
