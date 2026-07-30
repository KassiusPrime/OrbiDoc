import React, { useState } from 'react';
import { 
  Presentation, Plus, Trash2, Play, Sparkles, Image as ImageIcon,
  ChevronLeft, ChevronRight, Layout, Download, FileText, Loader2, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import { SlideData, PresentationDeck, HistoryItem } from '../types';

interface PowerPointStudioProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  engineProvider?: string;
  engineModel?: string;
}

const THEMES = [
  { id: 'indigo', label: 'Indigo Tech', bg: 'from-slate-900 via-indigo-950 to-slate-900', text: 'text-white', accent: 'text-indigo-400' },
  { id: 'white', label: 'Clean White', bg: 'from-slate-50 via-white to-slate-100', text: 'text-slate-900', accent: 'text-blue-600' },
  { id: 'sunset', label: 'Sunset Gradient', bg: 'from-rose-900 via-purple-900 to-slate-900', text: 'text-white', accent: 'text-amber-400' },
  { id: 'emerald', label: 'Emerald Corporate', bg: 'from-slate-900 via-emerald-950 to-slate-900', text: 'text-white', accent: 'text-emerald-400' },
];

export const PowerPointStudio: React.FC<PowerPointStudioProps> = ({
  onSaveToHistory,
  showNotification = () => {},
  engineProvider = 'gemini',
  engineModel = 'gemini-2.5-flash',
}) => {
  const [deck, setDeck] = useState<PresentationDeck>({
    id: 'deck-1',
    title: 'Apresentação Corporativa Pro.pptx',
    slides: [
      {
        id: 's-1',
        title: 'Transformação Digital & IA',
        subtitle: 'Estratégias para o Mercado Moderno',
        bullets: ['Aceleração de Processos', 'Inovação Centrada no Cliente', 'Automação Inteligente'],
        bgGradient: THEMES[0].bg,
        layout: 'title',
      },
      {
        id: 's-2',
        title: 'Pilares Estratégicos',
        bullets: [
          'Integração de Modelos de Linguagem na Operação',
          'Segurança de Dados e Conformidade LGPD',
          'Capacitação Continuada das Equipes'
        ],
        bgGradient: THEMES[0].bg,
        layout: 'content',
      },
      {
        id: 's-3',
        title: '"A inovação distingue um líder de um seguidor."',
        subtitle: '— Steve Jobs',
        bullets: [],
        bgGradient: THEMES[0].bg,
        layout: 'quote',
      },
    ]
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // AI Slide Generator Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const activeSlide = deck.slides[activeSlideIndex] || deck.slides[0];

  const handleUpdateSlide = (updatedFields: Partial<SlideData>) => {
    setDeck(prev => {
      const newSlides = [...prev.slides];
      newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updatedFields };
      return { ...prev, slides: newSlides };
    });
  };

  const addSlide = (layout: SlideData['layout'] = 'content') => {
    const newSlide: SlideData = {
      id: `s-${Date.now()}`,
      title: 'Novo Slide de Conteúdo',
      subtitle: 'Subtítulo opcional do slide',
      bullets: ['Primeiro tópico explicativo', 'Segundo tópico estratégico'],
      bgGradient: selectedTheme.bg,
      layout,
    };
    setDeck(prev => ({ ...prev, slides: [...prev.slides, newSlide] }));
    setActiveSlideIndex(deck.slides.length);
  };

  const deleteActiveSlide = () => {
    if (deck.slides.length <= 1) {
      showNotification('A apresentação precisa ter pelo menos um slide.', 'error');
      return;
    }
    setDeck(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== activeSlideIndex)
    }));
    setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
  };

  const handleGenerateDeckAi = async () => {
    if (!aiTopic.trim()) return;
    setIsAiGenerating(true);

    try {
      const prompt = `Crie uma apresentação de slides profissional em JSON sobre o tema: "${aiTopic}".
Retorne estritamente um array JSON de 4 slides no formato:
[
  {
    "title": "Título do Slide",
    "subtitle": "Subtítulo opcional",
    "bullets": ["Tópico 1", "Tópico 2", "Tópico 3"],
    "layout": "title" ou "content" ou "quote"
  }
]`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: engineProvider,
          model: engineModel,
          messages: [
            { role: 'system', content: 'Você gera apresentações de slides em formato JSON estrito.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Clean JSON
      const jsonText = data.answer.replace(/```json/g, '').replace(/```/g, '').trim();
      const slidesJson = JSON.parse(jsonText);

      if (Array.isArray(slidesJson)) {
        const formattedSlides: SlideData[] = slidesJson.map((s, idx) => ({
          id: `ai-${idx}-${Date.now()}`,
          title: s.title || 'Slide de Conteúdo',
          subtitle: s.subtitle || '',
          bullets: Array.isArray(s.bullets) ? s.bullets : [],
          bgGradient: selectedTheme.bg,
          layout: s.layout || 'content'
        }));

        setDeck(prev => ({
          ...prev,
          title: `${aiTopic}.pptx`,
          slides: formattedSlides
        }));
        setActiveSlideIndex(0);
        showNotification('Apresentação completa gerada com IA!', 'success');
        setShowAiModal(false);
        setAiTopic('');
      }
    } catch (e: any) {
      showNotification('Erro ao gerar apresentação com IA. Tente novamente.', 'error');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const exportPptx = async () => {
    try {
      const pptx = new pptxgen();
      pptx.title = deck.title.replace('.pptx', '');

      deck.slides.forEach((slide) => {
        const pptxSlide = pptx.addSlide();
        
        // Clean slide title & subtitle without markdown symbols # * **
        const cleanTitle = slide.title.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        const cleanSubtitle = slide.subtitle ? slide.subtitle.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1') : '';

        // Slide Background
        pptxSlide.background = { color: selectedTheme.id === 'white' ? 'FFFFFF' : '0F172A' };

        // Slide Title Box (Native PowerPoint Text Frame)
        pptxSlide.addText(cleanTitle, {
          x: 0.8,
          y: 0.8,
          w: '80%',
          h: 1.0,
          fontSize: 30,
          fontFace: 'Calibri',
          bold: true,
          color: selectedTheme.id === 'white' ? '1E293B' : 'FFFFFF',
          align: 'left'
        });

        if (cleanSubtitle) {
          pptxSlide.addText(cleanSubtitle, {
            x: 0.8,
            y: 1.8,
            w: '80%',
            h: 0.6,
            fontSize: 18,
            fontFace: 'Calibri',
            color: selectedTheme.id === 'white' ? '475569' : '94A3B8',
            align: 'left'
          });
        }

        // Native Bullet List Items (clean text)
        if (slide.bullets && slide.bullets.length > 0) {
          const bulletObjects = slide.bullets.map(bullet => {
            const cleanItem = bullet.replace(/^[-*•]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
            return {
              text: cleanItem,
              options: {
                fontSize: 16,
                fontFace: 'Calibri',
                color: selectedTheme.id === 'white' ? '334155' : 'E2E8F0',
                bullet: true,
                breakLine: true
              }
            };
          });

          pptxSlide.addText(bulletObjects, {
            x: 0.8,
            y: cleanSubtitle ? 2.6 : 2.0,
            w: '85%',
            h: 4.2,
            align: 'left'
          });
        }
      });

      await pptx.writeFile({ fileName: deck.title.endsWith('.pptx') ? deck.title : `${deck.title}.pptx` });
      showNotification('Apresentação PPTX nativa exportada com sucesso!', 'success');

      if (onSaveToHistory) {
        onSaveToHistory({
          type: 'powerpoint',
          title: deck.title,
          summary: `Apresentação com ${deck.slides.length} slides exportada para PPTX.`
        });
      }
    } catch (err) {
      console.error('Erro ao exportar PPTX:', err);
      showNotification('Erro ao gerar arquivo PPTX.', 'error');
    }
  };

  const exportPdf = () => {
    try {
      const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
      deck.slides.forEach((slide, idx) => {
        if (idx > 0) pdf.addPage();
        
        pdf.setFillColor(240, 244, 248);
        pdf.rect(0, 0, 297, 210, 'F');

        pdf.setFontSize(26);
        pdf.setTextColor(20, 30, 50);
        pdf.text(slide.title, 20, 40);

        if (slide.subtitle) {
          pdf.setFontSize(16);
          pdf.setTextColor(80, 90, 110);
          pdf.text(slide.subtitle, 20, 55);
        }

        let y = 80;
        pdf.setFontSize(14);
        pdf.setTextColor(40, 50, 70);
        slide.bullets.forEach((bullet) => {
          pdf.text(`• ${bullet}`, 25, y);
          y += 12;
        });

        pdf.setFontSize(10);
        pdf.setTextColor(150, 160, 170);
        pdf.text(`Slide ${idx + 1} de ${deck.slides.length}`, 260, 200);
      });

      pdf.save(deck.title.replace('.pptx', '') + '.pdf');
      showNotification('Apresentação exportada como PDF!', 'success');

      if (onSaveToHistory) {
        onSaveToHistory({
          type: 'powerpoint',
          title: deck.title,
          summary: `Apresentação com ${deck.slides.length} slides exportada para PDF.`
        });
      }
    } catch {
      showNotification('Erro ao exportar PDF', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-md">
            P
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={deck.title}
              onChange={(e) => setDeck(prev => ({ ...prev, title: e.target.value }))}
              className="text-base font-bold text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent focus:border-amber-400 px-2 py-0.5 rounded-lg outline-none w-full"
            />
            <p className="text-xs text-slate-500 px-2">
              {deck.slides.length} Slides • PowerPoint Studio Pro
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-xs font-semibold hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            Gerar Slides com IA
          </button>

          <button
            onClick={() => setIsFullScreen(true)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Apresentar
          </button>

          <button
            onClick={exportPptx}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" /> PPTX (Office)
          </button>

          <button
            onClick={exportPdf}
            className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Sidebar: Slide Thumbnails */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-700">Slides ({deck.slides.length})</span>
            <button
              onClick={() => addSlide('content')}
              className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {deck.slides.map((s, idx) => (
              <motion.div
                key={s.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setActiveSlideIndex(idx)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  idx === activeSlideIndex
                    ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>Slide {idx + 1}</span>
                  <span className="uppercase text-[9px] bg-slate-200 px-1.5 py-0.5 rounded">{s.layout}</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">{s.title}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Center Canvas Preview & Editor */}
        <div className="lg:col-span-3 space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Layout:</span>
              <select
                value={activeSlide.layout}
                onChange={(e) => handleUpdateSlide({ layout: e.target.value as any })}
                className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 outline-none font-semibold"
              >
                <option value="title">Título Principal</option>
                <option value="content">Conteúdo + Tópicos</option>
                <option value="quote">Citação Relevante</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Tema:</span>
              <div className="flex gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTheme(t);
                      handleUpdateSlide({ bgGradient: t.bg });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                      selectedTheme.id === t.id ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={deleteActiveSlide}
              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg flex items-center gap-1 font-semibold ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir Slide
            </button>
          </div>

          {/* Slide High-Res Stage Preview */}
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-12 min-h-[420px] flex items-center justify-center shadow-xl relative overflow-hidden">
            <div className={`w-full aspect-[16/9] rounded-2xl bg-gradient-to-br ${activeSlide.bgGradient || selectedTheme.bg} p-8 sm:p-12 flex flex-col justify-between shadow-2xl relative border border-white/10`}>
              
              {/* Editable Content inside Stage */}
              {activeSlide.layout === 'title' && (
                <div className="my-auto space-y-4 text-center">
                  <input
                    type="text"
                    value={activeSlide.title}
                    onChange={(e) => handleUpdateSlide({ title: e.target.value })}
                    className="w-full bg-transparent text-2xl sm:text-4xl font-extrabold text-white text-center outline-none border-b border-transparent hover:border-white/20 focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={activeSlide.subtitle || ''}
                    onChange={(e) => handleUpdateSlide({ subtitle: e.target.value })}
                    placeholder="Subtítulo da Apresentação..."
                    className="w-full bg-transparent text-base sm:text-xl font-medium text-amber-300 text-center outline-none border-b border-transparent hover:border-white/20 focus:border-amber-400"
                  />
                </div>
              )}

              {activeSlide.layout === 'content' && (
                <div className="space-y-6">
                  <input
                    type="text"
                    value={activeSlide.title}
                    onChange={(e) => handleUpdateSlide({ title: e.target.value })}
                    className="w-full bg-transparent text-xl sm:text-3xl font-bold text-white outline-none border-b border-transparent hover:border-white/20 focus:border-amber-400"
                  />
                  <div className="space-y-2">
                    {activeSlide.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...activeSlide.bullets];
                            newBullets[bIdx] = e.target.value;
                            handleUpdateSlide({ bullets: newBullets });
                          }}
                          className="w-full bg-transparent text-sm sm:text-lg text-slate-200 outline-none hover:bg-white/5 focus:bg-white/10 px-2 py-0.5 rounded-lg"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => handleUpdateSlide({ bullets: [...activeSlide.bullets, 'Novo item do slide'] })}
                      className="text-xs text-amber-400 hover:underline flex items-center gap-1 mt-2"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Tópico
                    </button>
                  </div>
                </div>
              )}

              {activeSlide.layout === 'quote' && (
                <div className="my-auto text-center space-y-4">
                  <textarea
                    value={activeSlide.title}
                    onChange={(e) => handleUpdateSlide({ title: e.target.value })}
                    className="w-full bg-transparent text-xl sm:text-3xl font-serif italic text-amber-300 text-center outline-none resize-none"
                  />
                  <input
                    type="text"
                    value={activeSlide.subtitle || ''}
                    onChange={(e) => handleUpdateSlide({ subtitle: e.target.value })}
                    className="w-full bg-transparent text-sm sm:text-base text-slate-300 text-center outline-none"
                  />
                </div>
              )}

              {/* Slide Footer Counter */}
              <div className="flex items-center justify-between text-[11px] text-white/50 border-t border-white/10 pt-2">
                <span>{deck.title}</span>
                <span>Slide {activeSlideIndex + 1} de {deck.slides.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Interactive Presentation Mode */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 sm:p-12 select-none"
          >
            <div className="flex justify-between items-center text-white/60 text-xs">
              <span>{deck.title}</span>
              <button
                onClick={() => setIsFullScreen(false)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold"
              >
                Sair (ESC)
              </button>
            </div>

            {/* Active Presentation Stage */}
            <div className={`w-full max-w-5xl mx-auto aspect-[16/9] rounded-3xl bg-gradient-to-br ${activeSlide.bgGradient || selectedTheme.bg} p-12 flex flex-col justify-between shadow-2xl my-auto border border-white/10`}>
              {activeSlide.layout === 'title' && (
                <div className="my-auto space-y-6 text-center">
                  <h1 className="text-4xl sm:text-6xl font-extrabold text-white">{activeSlide.title}</h1>
                  <p className="text-xl sm:text-2xl font-medium text-amber-300">{activeSlide.subtitle}</p>
                </div>
              )}

              {activeSlide.layout === 'content' && (
                <div className="space-y-8 my-auto">
                  <h2 className="text-3xl sm:text-5xl font-bold text-white border-b border-white/20 pb-4">{activeSlide.title}</h2>
                  <div className="space-y-4">
                    {activeSlide.bullets.map((b, i) => (
                      <p key={i} className="text-xl sm:text-2xl text-slate-200 flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-amber-400" />
                        {b}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {activeSlide.layout === 'quote' && (
                <div className="my-auto text-center space-y-6">
                  <p className="text-3xl sm:text-5xl font-serif italic text-amber-300">{activeSlide.title}</p>
                  <p className="text-xl text-slate-300">{activeSlide.subtitle}</p>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center text-white max-w-5xl mx-auto w-full">
              <button
                onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
                disabled={activeSlideIndex === 0}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl disabled:opacity-30 flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Anterior
              </button>

              <span className="text-sm font-semibold">
                {activeSlideIndex + 1} / {deck.slides.length}
              </span>

              <button
                onClick={() => setActiveSlideIndex(Math.min(deck.slides.length - 1, activeSlideIndex + 1))}
                disabled={activeSlideIndex === deck.slides.length - 1}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl disabled:opacity-30 flex items-center gap-2 font-bold"
              >
                Próximo <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Presentation Generator Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  Gerador de Apresentação IA
                </h3>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <p className="text-xs text-slate-500">
                Digite o tema desejado e a IA criará uma estrutura de slides completa com títulos e pontos estratégicos.
              </p>

              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ex: 'Planejamento de Marketing Digital para 2026'..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500"
              />

              <button
                onClick={handleGenerateDeckAi}
                disabled={isAiGenerating || !aiTopic.trim()}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              >
                {isAiGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isAiGenerating ? 'Criando Slides...' : 'Gerar Apresentação Completa'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
