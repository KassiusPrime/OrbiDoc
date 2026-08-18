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

interface PresentationEditorProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type DeckState = {
  title: string;
  slides: SlideData[];
  theme: 'light' | 'dark' | 'indigo' | 'emerald';
};

const THEMES = {
  light: { bg: '#FFFFFF', text: '#0F172A', accent: '#2563EB', className: 'bg-white text-slate-950' },
  dark: { bg: '#0F172A', text: '#F8FAFC', accent: '#38BDF8', className: 'bg-slate-900 text-white' },
  indigo: { bg: '#1E1B4B', text: '#FFFFFF', accent: '#A5B4FC', className: 'bg-indigo-950 text-white' },
  emerald: { bg: '#022C22', text: '#FFFFFF', accent: '#6EE7B7', className: 'bg-emerald-950 text-white' },
};

const newSlide = (layout: SlideData['layout'] = 'content'): SlideData => ({
  id: crypto.randomUUID(),
  title: layout === 'title' ? 'Título da apresentação' : 'Novo slide',
  subtitle: layout === 'title' ? 'Subtítulo ou contexto' : undefined,
  bullets: layout === 'content' ? ['Primeiro ponto', 'Segundo ponto'] : [],
  bgGradient: '',
  layout,
  notes: '',
});

const defaultDeck = (): DeckState => ({
  title: 'Nova apresentação',
  theme: 'light',
  slides: [newSlide('title'), newSlide('content')],
});

export const PresentationEditor: React.FC<PresentationEditorProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_presentation_v2_${project.id}`;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [deck, setDeck] = useState<DeckState>(() => {
    try {
      const local = localStorage.getItem(storageKey);
      if (local) return JSON.parse(local).deck || defaultDeck();
      if (project.content && typeof project.content === 'object' && Array.isArray((project.content as any).slides)) return project.content as DeckState;
    } catch { /* default deck */ }
    return { ...defaultDeck(), title: project.title || 'Nova apresentação' };
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastSaved, setLastSaved] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const activeSlide = deck.slides[activeIndex] || deck.slides[0];
  const theme = THEMES[deck.theme];

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
    }, 700);
    return () => window.clearTimeout(timer);
  }, [deck, project.id]);

  const updateSlide = (patch: Partial<SlideData>) => {
    setDeck((current) => ({ ...current, slides: current.slides.map((slide, index) => index === activeIndex ? { ...slide, ...patch } : slide) }));
  };

  const addSlide = (layout: SlideData['layout'] = 'content') => {
    const slide = newSlide(layout);
    setDeck((current) => ({ ...current, slides: [...current.slides, slide] }));
    setActiveIndex(deck.slides.length);
  };

  const duplicateSlide = () => {
    const duplicate: SlideData = { ...activeSlide, id: crypto.randomUUID(), bullets: [...activeSlide.bullets] };
    const slides = [...deck.slides];
    slides.splice(activeIndex + 1, 0, duplicate);
    setDeck((current) => ({ ...current, slides }));
    setActiveIndex(activeIndex + 1);
  };

  const deleteSlide = () => {
    if (deck.slides.length === 1) return;
    setDeck((current) => ({ ...current, slides: current.slides.filter((_, index) => index !== activeIndex) }));
    setActiveIndex(Math.max(0, activeIndex - 1));
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= deck.slides.length || from === to) return;
    const slides = [...deck.slides];
    const [item] = slides.splice(from, 1);
    slides.splice(to, 0, item);
    setDeck((current) => ({ ...current, slides }));
    setActiveIndex(to);
  };

  const insertImage = async (file?: File) => {
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      showNotification('A imagem precisa ter menos de 10 MB.', 'error');
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    updateSlide({ image: data, layout: 'image' });
  };

  const exportPptx = async () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'DocSwiss';
    pptx.subject = deck.title;
    pptx.title = deck.title;
    deck.slides.forEach((source) => {
      const slide = pptx.addSlide();
      slide.background = { color: theme.bg.replace('#', '') };
      const textColor = theme.text.replace('#', '');
      const accent = theme.accent.replace('#', '');
      if (source.layout === 'title') {
        slide.addText(source.title, { x: 0.8, y: 2.2, w: 11.7, h: 0.8, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: textColor, align: 'center' });
        if (source.subtitle) slide.addText(source.subtitle, { x: 1.2, y: 3.15, w: 10.9, h: 0.5, fontFace: 'Aptos', fontSize: 16, color: accent, align: 'center' });
      } else {
        slide.addText(source.title, { x: 0.7, y: 0.5, w: 12, h: 0.6, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: textColor });
        if (source.image) {
          slide.addImage({ data: source.image, x: source.layout === 'image' ? 6.7 : 7.5, y: 1.5, w: 5.5, h: 3.4 });
        }
        if (source.bullets.length) {
          slide.addText(source.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), { x: 0.9, y: 1.6, w: source.image ? 5.4 : 11.2, h: 4.4, fontFace: 'Aptos', fontSize: 18, color: textColor, breakLine: true, valign: 'top', margin: 0.06 });
        }
        if (source.subtitle && source.layout === 'quote') slide.addText(source.subtitle, { x: 1.2, y: 4.8, w: 10.8, h: 0.4, fontSize: 13, italic: true, color: accent, align: 'right' });
      }
      if (source.notes) slide.addNotes(source.notes);
    });
    const blob = await pptx.write({ outputType: 'blob' }) as Blob;
    saveAs(blob, `${deck.title.replace(/[<>:"/\\|?*]/g, '_') || 'Apresentacao'}.pptx`);
    onSaveToHistory?.({ type: 'powerpoint', title: deck.title, summary: `${deck.slides.length} slides exportados em PPTX.`, details: deck.slides.map((slide) => `${slide.title}\n${slide.bullets.join('\n')}`).join('\n\n'), tags: ['PPTX', 'Apresentação'] });
    showNotification('PPTX exportado.', 'success');
  };

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    deck.slides.forEach((source, index) => {
      if (index > 0) pdf.addPage('a4', 'landscape');
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(theme.bg); pdf.rect(0, 0, width, height, 'F');
      pdf.setTextColor(theme.text); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(source.layout === 'title' ? 28 : 22);
      pdf.text(pdf.splitTextToSize(source.title, width - 36), source.layout === 'title' ? width / 2 : 18, source.layout === 'title' ? 75 : 25, { align: source.layout === 'title' ? 'center' : 'left' });
      if (source.subtitle) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(13); pdf.setTextColor(theme.accent); pdf.text(pdf.splitTextToSize(source.subtitle, width - 50), source.layout === 'title' ? width / 2 : 20, source.layout === 'title' ? 95 : 42, { align: source.layout === 'title' ? 'center' : 'left' }); }
      if (source.bullets.length) { pdf.setTextColor(theme.text); pdf.setFontSize(14); pdf.setFont('helvetica', 'normal'); let y = 52; source.bullets.forEach((bullet) => { const lines = pdf.splitTextToSize(`• ${bullet}`, width - 45); pdf.text(lines, 24, y); y += lines.length * 7 + 4; }); }
    });
    saveAs(pdf.output('blob'), `${deck.title.replace(/[<>:"/\\|?*]/g, '_') || 'Apresentacao'}.pdf`);
    showNotification('PDF da apresentação exportado.', 'success');
  };

  const generateWithAi = async () => {
    const topic = window.prompt('Tema da apresentação:');
    if (!topic?.trim()) return;
    setAiBusy(true);
    try {
      const response = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: 'Crie uma apresentação objetiva em JSON estrito. Formato: {"title":"...","slides":[{"title":"...","subtitle":"...","bullets":["..."],"layout":"title|content|quote"}]}. Faça 6 a 8 slides. Não use Markdown fora do JSON.' },
        { role: 'user', content: topic },
      ]);
      const match = response.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('A IA não retornou uma estrutura válida.');
      const parsed = JSON.parse(match[0]);
      const slides: SlideData[] = (parsed.slides || []).slice(0, 12).map((item: any, index: number) => ({
        id: crypto.randomUUID(),
        title: String(item.title || `Slide ${index + 1}`),
        subtitle: item.subtitle ? String(item.subtitle) : undefined,
        bullets: Array.isArray(item.bullets) ? item.bullets.map(String).slice(0, 6) : [],
        bgGradient: '',
        layout: ['title', 'content', 'quote'].includes(item.layout) ? item.layout : index === 0 ? 'title' : 'content',
        notes: '',
      }));
      if (!slides.length) throw new Error('Nenhum slide gerado.');
      setDeck((current) => ({ ...current, title: String(parsed.title || topic), slides }));
      setActiveIndex(0);
      showNotification(`${slides.length} slides gerados pela IA.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao gerar slides.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const previewBullets = useMemo(() => activeSlide.bullets.filter(Boolean), [activeSlide]);

  if (presenting) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={() => setPresenting(false)}>
        <div className={`w-[min(92vw,1400px)] aspect-video rounded-xl overflow-hidden ${theme.className} relative`} onClick={(event) => event.stopPropagation()}>
          <SlideCanvas slide={activeSlide} theme={theme} present />
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3"><button onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="px-4 py-2 rounded-full bg-black/50 text-white text-xs">Anterior</button><span className="text-xs text-white/70">{activeIndex + 1}/{deck.slides.length}</span><button onClick={() => activeIndex === deck.slides.length - 1 ? setPresenting(false) : setActiveIndex((index) => index + 1)} className="px-4 py-2 rounded-full bg-black/50 text-white text-xs">Próximo</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <input value={deck.title} onChange={(event) => setDeck((current) => ({ ...current, title: event.target.value }))} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" />
        <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
        <button onClick={generateWithAi} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Gerando…' : 'Gerar com IA'}</button>
        <button onClick={() => setPresenting(true)} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Apresentar</button>
        <div className="relative group"><button className="h-8 px-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={exportPptx} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">PPTX</button><button onClick={exportPdf} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">PDF</button></div></div>
      </div>

      <div className="h-11 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-black text-slate-400">Tema</span>{(Object.keys(THEMES) as DeckState['theme'][]).map((key) => <button key={key} onClick={() => setDeck((current) => ({ ...current, theme: key }))} className={`h-7 px-2.5 rounded-lg text-[10px] font-bold border ${deck.theme === key ? 'border-orange-500 text-orange-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>{key}</button>)}
        <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button onClick={() => addSlide('content')} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Novo slide</button>
        <div className="relative group"><button className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Layout className="w-3.5 h-3.5" /> Layout</button><div className="hidden group-hover:block absolute top-8 left-0 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['title','content','two-column','image','quote'] as SlideData['layout'][]).map((layout) => <button key={layout} onClick={() => updateSlide({ layout })} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{layout}</button>)}</div></div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { insertImage(event.target.files?.[0]); event.target.value = ''; }} />
        <button onClick={() => imageInputRef.current?.click()} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Photo className="w-3.5 h-3.5" /> Imagem</button>
        <button onClick={duplicateSlide} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Duplicar"><Copy className="w-4 h-4" /></button>
        <button onClick={deleteSlide} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center" title="Excluir"><Trash className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-32 sm:w-44 lg:w-52 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 overflow-y-auto p-2 space-y-2">
          {deck.slides.map((slide, index) => <button key={slide.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveSlide(Number(event.dataTransfer.getData('text/plain')), index)} onClick={() => setActiveIndex(index)} className={`w-full rounded-xl p-1.5 border text-left ${index === activeIndex ? 'border-orange-500 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent hover:bg-white dark:hover:bg-slate-900'}`}><div className={`aspect-video rounded-md overflow-hidden ${theme.className} relative`}><div className="absolute inset-0 p-2 flex flex-col justify-center"><div className="text-[6px] sm:text-[8px] font-black leading-tight line-clamp-2">{slide.title}</div>{slide.bullets.slice(0, 2).map((bullet) => <div key={bullet} className="mt-1 text-[4px] sm:text-[5px] opacity-70 truncate">• {bullet}</div>)}</div></div><div className="mt-1 text-[9px] text-slate-400">{index + 1}</div></button>)}
        </aside>

        <div className="flex-1 min-w-0 overflow-auto bg-slate-200/60 dark:bg-slate-950 p-4 sm:p-7 flex items-start justify-center">
          <div className={`w-[min(100%,1100px)] aspect-video rounded-xl shadow-xl overflow-hidden ${theme.className}`}><SlideCanvas slide={activeSlide} theme={theme} /></div>
        </div>

        <aside className="hidden xl:block w-[310px] shrink-0 border-l border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
          <div className="space-y-4">
            <label className="block"><span className="text-[10px] font-black text-slate-500">Título</span><textarea value={activeSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs outline-none focus:border-orange-500" /></label>
            <label className="block"><span className="text-[10px] font-black text-slate-500">Subtítulo</span><textarea value={activeSlide.subtitle || ''} onChange={(event) => updateSlide({ subtitle: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs outline-none focus:border-orange-500" /></label>
            <label className="block"><span className="text-[10px] font-black text-slate-500">Tópicos · uma linha por item</span><textarea value={activeSlide.bullets.join('\n')} onChange={(event) => updateSlide({ bullets: event.target.value.split('\n') })} rows={8} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs outline-none focus:border-orange-500" /></label>
            <label className="block"><span className="text-[10px] font-black text-slate-500">Notas do apresentador</span><textarea value={activeSlide.notes || ''} onChange={(event) => updateSlide({ notes: event.target.value })} rows={5} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs outline-none focus:border-orange-500" /></label>
          </div>
        </aside>
      </div>

      <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900"><input value={activeSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} className="w-full h-9 rounded-lg bg-slate-100 dark:bg-slate-950 px-3 text-xs font-bold outline-none" /><textarea value={previewBullets.join('\n')} onChange={(event) => updateSlide({ bullets: event.target.value.split('\n') })} rows={3} className="mt-2 w-full rounded-lg bg-slate-100 dark:bg-slate-950 px-3 py-2 text-xs outline-none" /></div>
    </div>
  );
};

const SlideCanvas: React.FC<{ slide: SlideData; theme: (typeof THEMES)[keyof typeof THEMES]; present?: boolean }> = ({ slide, theme, present }) => (
  <div className="w-full h-full relative p-[6%] flex flex-col" style={{ backgroundColor: theme.bg, color: theme.text }}>
    {slide.layout === 'title' ? <div className="m-auto text-center max-w-[85%]"><h1 className={`${present ? 'text-5xl' : 'text-2xl sm:text-4xl lg:text-5xl'} font-black leading-tight`}>{slide.title}</h1>{slide.subtitle && <p className={`${present ? 'text-2xl' : 'text-sm sm:text-xl'} mt-5 font-semibold`} style={{ color: theme.accent }}>{slide.subtitle}</p>}</div> : <><h2 className={`${present ? 'text-4xl' : 'text-xl sm:text-3xl lg:text-4xl'} font-black leading-tight max-w-[90%]`}>{slide.title}</h2>{slide.subtitle && <p className="mt-2 text-xs sm:text-base font-semibold" style={{ color: theme.accent }}>{slide.subtitle}</p>}<div className={`flex-1 min-h-0 mt-[5%] ${slide.image ? 'grid grid-cols-2 gap-[5%]' : ''}`}><div className="space-y-[3%]">{slide.bullets.filter(Boolean).map((bullet, index) => <div key={`${bullet}-${index}`} className={`${present ? 'text-2xl' : 'text-xs sm:text-base lg:text-xl'} flex items-start gap-2 sm:gap-3`}><span style={{ color: theme.accent }}>•</span><span>{bullet}</span></div>)}</div>{slide.image && <div className="min-h-0 flex items-center"><img src={slide.image} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" /></div>}</div></>}
  </div>
);
