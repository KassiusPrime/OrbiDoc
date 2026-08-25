import React, { useMemo, useState } from 'react';
import { IconChecklist as Checklist, IconLayout as Layout, IconList as List, IconNumbers as Numbers, IconPlayerPlay as Play, IconTypography as Typography } from '@tabler/icons-react';
import type { SavedProject } from '../types';
import { OFFICE_FONTS } from '../lib/officeStudio';
import { applyDeckTransition, applyMasterFooter, applyTypographyMaster, auditDeck, createAgendaSlide, removeMasterFooter, type OrbiTransition } from '../lib/presentationPro';
import { PresentationPlayerPro } from './PresentationPlayerPro';

type Props = {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  onApplied: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
};

export const PresentationProPanel: React.FC<Props> = ({ project, onProjectChange, onApplied, showNotification = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [footer, setFooter] = useState('OrbiDoc');
  const [numbers, setNumbers] = useState(true);
  const [skipFirst, setSkipFirst] = useState(true);
  const [transition, setTransition] = useState<OrbiTransition>('fade');
  const [transitionMs, setTransitionMs] = useState(420);
  const [fontFamily, setFontFamily] = useState('Inter, system-ui, sans-serif');
  const [presenting, setPresenting] = useState(false);
  const deck = project.content as any;
  const audit = useMemo(() => deck?.slides?.length ? auditDeck(deck) : { findings: [], warnings: 0, info: 0 }, [deck]);

  if (!deck?.slides?.length) return null;

  const persist = (nextDeck: any, message: string) => {
    const updated = { ...project, content: nextDeck, title: nextDeck.title || project.title, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(`orbidoc_presentation_v4_${project.id}`, JSON.stringify({ deck: nextDeck, updatedAt: updated.updatedAt })); } catch { /* quota */ }
    onProjectChange(updated);
    onApplied();
    showNotification(message, 'success');
  };

  return <>
    <section className="mb-3 rounded-2xl border border-blue-200/70 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/10 overflow-hidden">
      <button onClick={() => setOpen((value) => !value)} className="w-full min-h-11 px-3 sm:px-4 flex items-center gap-2 text-left"><Layout className="w-4 h-4 text-blue-600" /><span className="text-xs font-black">Apresentação Pro</span><span className="text-[9px] text-slate-500 dark:text-slate-400">Mestre · transições · agenda · auditoria · presenter</span><span className="ml-auto text-[10px] font-black text-blue-700 dark:text-blue-300">{open ? 'Recolher' : 'Abrir'}</span></button>
      {open && <div className="p-3 sm:p-4 border-t border-blue-200/60 dark:border-blue-900 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Numbers className="w-4 h-4 text-blue-600" /> Mestre de rodapé</div><input value={footer} onChange={(event) => setFooter(event.target.value)} placeholder="Texto do rodapé" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><label className="mt-2 flex items-center gap-2 text-[9px]"><input type="checkbox" checked={numbers} onChange={(event) => setNumbers(event.target.checked)} /> Numerar slides</label><label className="mt-1 flex items-center gap-2 text-[9px]"><input type="checkbox" checked={skipFirst} onChange={(event) => setSkipFirst(event.target.checked)} /> Ignorar capa</label><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => persist(applyMasterFooter(deck, footer, { numbers, skipFirst }), 'Rodapé mestre aplicado ao deck.')} className="h-9 rounded-lg bg-blue-600 text-white text-[9px] font-black">Aplicar</button><button onClick={() => persist(removeMasterFooter(deck), 'Rodapé mestre removido.')} className="h-9 rounded-lg border text-[9px] font-black">Remover</button></div></div>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Play className="w-4 h-4 text-cyan-600" /> Transição & apresentação</div><select value={transition} onChange={(event) => setTransition(event.target.value as OrbiTransition)} className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]"><option value="none">Sem transição</option><option value="fade">Fade</option><option value="slide-left">Deslizar lateral</option><option value="slide-up">Subir</option><option value="zoom">Zoom suave</option></select><label className="mt-2 block text-[8px] font-black text-slate-500">Duração: {transitionMs} ms<input type="range" min="120" max="1800" step="20" value={transitionMs} onChange={(event) => setTransitionMs(Number(event.target.value))} className="mt-1 w-full" /></label><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => persist(applyDeckTransition(deck, transition, transitionMs), 'Transição mestre aplicada a todos os slides.')} className="h-9 rounded-lg bg-cyan-600 text-white text-[9px] font-black">Aplicar ao deck</button><button onClick={() => setPresenting(true)} className="h-9 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black">Apresentar Pro</button></div><p className="mt-2 text-[8px] text-slate-400">←/→ ou espaço navegam · N alterna notas · Esc fecha.</p></div>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Typography className="w-4 h-4 text-fuchsia-600" /> Tipografia mestre</div><select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)} className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]">{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select><p className="mt-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Atualiza a fonte padrão do deck e todos os textos livres existentes.</p><button onClick={() => persist(applyTypographyMaster(deck, fontFamily), 'Tipografia mestre aplicada ao deck.')} className="mt-3 w-full h-9 rounded-lg bg-fuchsia-600 text-white text-[9px] font-black">Padronizar tipografia</button></div>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><List className="w-4 h-4 text-violet-600" /> Agenda automática</div><p className="mt-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Cria um slide após a capa usando os títulos existentes. Não altera os slides de origem.</p><button onClick={() => persist(createAgendaSlide(deck, true), 'Slide de agenda criado após a capa.')} className="mt-3 w-full h-9 rounded-lg bg-violet-600 text-white text-[9px] font-black">Gerar agenda</button></div>

        <div className="md:col-span-2 xl:col-span-4 rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Checklist className="w-4 h-4 text-emerald-600" /> Auditoria do deck</div><div className="mt-2 flex gap-2"><span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[8px] font-black">{audit.warnings} alerta(s)</span><span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-black">{audit.info} observação(ões)</span></div><div className="mt-2 max-h-32 overflow-auto grid sm:grid-cols-2 gap-1">{audit.findings.slice(0, 16).map((item, index) => <div key={`${item.slide}:${index}`} className="text-[9px] leading-relaxed"><strong>Slide {item.slide}:</strong> {item.message}</div>)}{!audit.findings.length && <div className="text-[9px] text-emerald-600 font-black">Nenhuma pendência estrutural detectada.</div>}</div></div>
      </div>}
    </section>
    {presenting && <PresentationPlayerPro deck={deck} onClose={() => setPresenting(false)} />}
  </>;
};