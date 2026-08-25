import React, { useEffect, useMemo, useState } from 'react';
import { IconArrowLeft as ArrowLeft, IconArrowRight as ArrowRight, IconMaximize as Maximize, IconX as X } from '@tabler/icons-react';
import { shapeClipPath, type StudioElement } from '../lib/officeStudio';
import type { DeckLike, OrbiTransition } from '../lib/presentationPro';

type Props = { deck: DeckLike; onClose: () => void };
const THEME_BG: Record<string, string> = { orbi: '#F7F9FC', light: '#FFFFFF', dark: '#080D18', corporate: '#F8FAFC', emerald: '#ECFDF5', warm: '#FFF7ED' };
const THEME_TEXT: Record<string, string> = { orbi: '#0B1220', light: '#0F172A', dark: '#F8FAFC', corporate: '#0F172A', emerald: '#052E16', warm: '#431407' };
const animationName = (transition: OrbiTransition) => transition === 'slide-left' ? 'orbiSlideLeft' : transition === 'slide-up' ? 'orbiSlideUp' : transition === 'zoom' ? 'orbiZoom' : transition === 'fade' ? 'orbiFade' : 'none';

const ElementView: React.FC<{ element: StudioElement }> = ({ element }) => {
  const base: React.CSSProperties = { position: 'absolute', left: `${element.x / 19.2}%`, top: `${element.y / 10.8}%`, width: `${element.width / 19.2}%`, height: `${element.height / 10.8}%`, transform: `rotate(${element.rotation || 0}deg)`, opacity: element.opacity ?? 1, overflow: 'hidden' };
  if (element.type === 'image') return <img src={element.content} alt="" style={{ ...base, objectFit: 'contain' }} />;
  if (element.type === 'text') return <div style={{ ...base, color: element.fill, fontFamily: element.fontFamily, fontWeight: element.fontWeight, fontSize: `clamp(10px, ${Math.max(12, element.fontSize) / 19.2}vw, ${Math.max(12, element.fontSize)}px)`, textAlign: element.textAlign, whiteSpace: 'pre-wrap', lineHeight: 1.15 }}>{element.content}</div>;
  return <div style={{ ...base, background: element.fill, border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : undefined, borderRadius: element.shape === 'rounded' ? '12%' : element.shape === 'circle' ? '50%' : undefined, clipPath: element.shape ? shapeClipPath(element.shape) : undefined }} />;
};

export const PresentationPlayerPro: React.FC<Props> = ({ deck, onClose }) => {
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const slide = deck.slides[Math.min(index, deck.slides.length - 1)];
  const transition = (slide?.orbiTransition || deck.orbiMaster?.transition || 'fade') as OrbiTransition;
  const duration = Number(slide?.orbiTransitionMs || deck.orbiMaster?.transitionMs || 420);
  const themeId = String((deck as any).theme || 'orbi');
  const background = String((slide as any)?.background || (slide as any)?.bgGradient || THEME_BG[themeId] || '#F7F9FC');
  const textColor = THEME_TEXT[themeId] || '#0B1220';
  const canPrev = index > 0; const canNext = index < deck.slides.length - 1;
  const progress = useMemo(() => deck.slides.length ? ((index + 1) / deck.slides.length) * 100 : 0, [index, deck.slides.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.min(deck.slides.length - 1, value + 1)); }
      else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
      else if (event.key.toLowerCase() === 'n') setShowNotes((value) => !value);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [deck.slides.length, onClose]);

  const requestFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => undefined);
  if (!slide) return null;
  return <div className="fixed inset-0 z-[1000] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Apresentação profissional">
    <style>{`@keyframes orbiFade{from{opacity:.12}to{opacity:1}}@keyframes orbiSlideLeft{from{opacity:.25;transform:translateX(7%)}to{opacity:1;transform:none}}@keyframes orbiSlideUp{from{opacity:.25;transform:translateY(7%)}to{opacity:1;transform:none}}@keyframes orbiZoom{from{opacity:.25;transform:scale(.94)}to{opacity:1;transform:scale(1)}}`}</style>
    <div className="flex-1 min-h-0 grid place-items-center p-2 sm:p-4">
      <div key={`${slide.id}:${index}`} className="relative w-full max-w-[1600px] aspect-video overflow-hidden shadow-2xl" style={{ background, color: textColor, animation: transition === 'none' ? undefined : `${animationName(transition)} ${duration}ms cubic-bezier(.2,.8,.2,1) both`, fontFamily: deck.fontFamily || 'Inter, system-ui, sans-serif' }}>
        <div className="absolute inset-[7%] z-10 pointer-events-none">
          {slide.title && <h1 className="font-black tracking-tight leading-[1.02]" style={{ fontSize: 'clamp(22px,5vw,78px)' }}>{slide.title}</h1>}
          {slide.subtitle && <p className="mt-3 opacity-70 font-semibold" style={{ fontSize: 'clamp(13px,2vw,30px)' }}>{slide.subtitle}</p>}
          {!!slide.bullets?.length && <ul className="mt-[5%] space-y-[2%] list-disc pl-[4%] font-semibold" style={{ fontSize: 'clamp(13px,2.2vw,34px)' }}>{slide.bullets.map((item, itemIndex) => <li key={`${item}:${itemIndex}`}>{item}</li>)}</ul>}
        </div>
        {(slide.elements || []).map((element) => <ElementView key={element.id} element={element} />)}
      </div>
    </div>
    {showNotes && <div className="mx-3 mb-2 max-h-28 overflow-auto rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80"><strong>Notas:</strong> {String(slide.notes || 'Sem notas.')}</div>}
    <div className="h-14 shrink-0 px-3 sm:px-5 flex items-center gap-2 text-white bg-black/90 border-t border-white/10">
      <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-white/10" aria-label="Fechar"><X className="w-5 h-5 mx-auto" /></button>
      <button onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={!canPrev} className="w-9 h-9 rounded-lg hover:bg-white/10 disabled:opacity-30" aria-label="Slide anterior"><ArrowLeft className="w-5 h-5 mx-auto" /></button>
      <button onClick={() => setIndex((value) => Math.min(deck.slides.length - 1, value + 1))} disabled={!canNext} className="w-9 h-9 rounded-lg hover:bg-white/10 disabled:opacity-30" aria-label="Próximo slide"><ArrowRight className="w-5 h-5 mx-auto" /></button>
      <div className="flex-1 mx-2 h-1 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-white" style={{ width: `${progress}%` }} /></div>
      <button onClick={() => setShowNotes((value) => !value)} className="h-9 px-2 rounded-lg hover:bg-white/10 text-[10px] font-black">Notas</button>
      <button onClick={requestFullscreen} className="w-9 h-9 rounded-lg hover:bg-white/10" aria-label="Tela cheia"><Maximize className="w-5 h-5 mx-auto" /></button>
      <span className="w-16 text-right text-[10px] font-black">{index + 1}/{deck.slides.length}</span>
    </div>
  </div>;
};