import type { StudioElement } from './officeStudio';

export type OrbiTransition = 'none' | 'fade' | 'slide-left' | 'slide-up' | 'zoom';
type SlideLike = { id: string; title?: string; subtitle?: string; bullets?: string[]; notes?: string; layout?: any; elements?: StudioElement[]; orbiTransition?: OrbiTransition; orbiTransitionMs?: number; [key: string]: unknown };
export type DeckLike = { slides: SlideLike[]; title?: string; fontFamily?: string; orbiMaster?: { transition?: OrbiTransition; transitionMs?: number; fontFamily?: string; [key: string]: unknown }; [key: string]: unknown };
const FOOTER_PREFIX = 'orbidoc-master-footer-';
const NUMBER_PREFIX = 'orbidoc-master-number-';

const textElement = (id: string, content: string, x: number, y: number, width: number, align: 'left' | 'center' | 'right'): StudioElement => ({
  id, type: 'text', x, y, width, height: 42, rotation: 0, opacity: 0.78, fill: '#64748B', stroke: 'transparent', strokeWidth: 0,
  content, fontSize: 22, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600, textAlign: align, locked: true,
});

export function applyMasterFooter(deck: DeckLike, footer: string, options?: { numbers?: boolean; skipFirst?: boolean }) {
  const numbers = options?.numbers !== false;
  const skipFirst = options?.skipFirst !== false;
  return {
    ...deck,
    slides: deck.slides.map((slide, index) => {
      const elements = (slide.elements || []).filter((element) => !element.id.startsWith(FOOTER_PREFIX) && !element.id.startsWith(NUMBER_PREFIX));
      if (skipFirst && index === 0) return { ...slide, elements };
      if (footer.trim()) elements.push(textElement(`${FOOTER_PREFIX}${slide.id}`, footer.trim(), 74, 1015, 1450, 'left'));
      if (numbers) elements.push(textElement(`${NUMBER_PREFIX}${slide.id}`, String(index + 1), 1670, 1015, 176, 'right'));
      return { ...slide, elements };
    }),
  };
}

export function removeMasterFooter(deck: DeckLike) {
  return { ...deck, slides: deck.slides.map((slide) => ({ ...slide, elements: (slide.elements || []).filter((element) => !element.id.startsWith(FOOTER_PREFIX) && !element.id.startsWith(NUMBER_PREFIX)) })) };
}

export function applyDeckTransition(deck: DeckLike, transition: OrbiTransition, durationMs = 420) {
  const ms = Math.max(120, Math.min(1800, Math.round(durationMs)));
  return {
    ...deck,
    orbiMaster: { ...(deck.orbiMaster || {}), transition, transitionMs: ms },
    slides: deck.slides.map((slide) => ({ ...slide, orbiTransition: transition, orbiTransitionMs: ms })),
  };
}

export function applyTypographyMaster(deck: DeckLike, fontFamily: string) {
  const font = fontFamily.trim() || 'Inter, system-ui, sans-serif';
  return {
    ...deck,
    fontFamily: font,
    orbiMaster: { ...(deck.orbiMaster || {}), fontFamily: font },
    slides: deck.slides.map((slide) => ({
      ...slide,
      elements: (slide.elements || []).map((element) => element.type === 'text' ? { ...element, fontFamily: font } : element),
    })),
  };
}

export function createAgendaSlide(deck: DeckLike, afterTitle = true) {
  const entries = deck.slides.map((slide, index) => ({ index, title: String(slide.title || '').trim() })).filter((entry) => entry.title && (!afterTitle || entry.index > 0));
  const agenda: SlideLike = {
    id: crypto.randomUUID(), title: 'Agenda', subtitle: 'Visão geral da apresentação', bullets: entries.slice(0, 12).map((entry) => entry.title), notes: 'Agenda gerada automaticamente pelo OrbiDoc.', layout: 'content', elements: [], bgGradient: '',
    orbiTransition: deck.orbiMaster?.transition || 'fade', orbiTransitionMs: deck.orbiMaster?.transitionMs || 420,
  };
  const slides = [...deck.slides];
  slides.splice(afterTitle && slides.length ? 1 : 0, 0, agenda);
  return { ...deck, slides };
}

export function auditDeck(deck: DeckLike) {
  const findings: Array<{ slide: number; level: 'warning' | 'info'; message: string }> = [];
  deck.slides.forEach((slide, index) => {
    const title = String(slide.title || '').trim();
    const bullets = slide.bullets || [];
    const elements = slide.elements || [];
    if (!title && slide.layout !== 'blank') findings.push({ slide: index + 1, level: 'warning', message: 'Slide sem título.' });
    if (bullets.length > 7) findings.push({ slide: index + 1, level: 'warning', message: `${bullets.length} tópicos; considere dividir o conteúdo.` });
    if (elements.length > 10) findings.push({ slide: index + 1, level: 'warning', message: `${elements.length} elementos livres; verifique excesso visual.` });
    if (!String(slide.notes || '').trim()) findings.push({ slide: index + 1, level: 'info', message: 'Sem notas do apresentador.' });
    const transitionMs = Number(slide.orbiTransitionMs || deck.orbiMaster?.transitionMs || 0);
    if (transitionMs > 1200) findings.push({ slide: index + 1, level: 'info', message: 'Transição acima de 1,2 s pode deixar a apresentação lenta.' });
  });
  return { findings, warnings: findings.filter((item) => item.level === 'warning').length, info: findings.filter((item) => item.level === 'info').length };
}
