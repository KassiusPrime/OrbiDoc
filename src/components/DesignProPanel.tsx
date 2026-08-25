import React, { useMemo, useState } from 'react';
import { IconArrowsMaximize as Resize, IconChecklist as Checklist, IconFrame as Frame } from '@tabler/icons-react';
import type { SavedProject } from '../types';
import { auditDesign, clampDesignElements, resizeComposition, type DesignLike } from '../lib/designPro';

type Props = {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  onApplied: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
};

const PRESETS = [
  ['1080 × 1080', 1080, 1080],
  ['1080 × 1920', 1080, 1920],
  ['1920 × 1080', 1920, 1080],
  ['1280 × 720', 1280, 720],
  ['1240 × 1754', 1240, 1754],
] as const;

export const DesignProPanel: React.FC<Props> = ({ project, onProjectChange, onApplied, showNotification = () => {} }) => {
  const [open, setOpen] = useState(false);
  const design = project.content as DesignLike;
  const [width, setWidth] = useState(() => Number(design?.width) || 1080);
  const [height, setHeight] = useState(() => Number(design?.height) || 1080);
  const audit = useMemo(() => design?.elements ? auditDesign(design) : { findings: [], warnings: 0, info: 0 }, [design]);

  if (!design?.elements || !design.width || !design.height) return null;

  const persist = (nextDesign: DesignLike, message: string) => {
    const updated = { ...project, content: nextDesign, title: String(nextDesign.title || project.title), updatedAt: new Date().toISOString() };
    try { localStorage.setItem(`orbidoc_design_v4_${project.id}`, JSON.stringify({ design: nextDesign, updatedAt: updated.updatedAt })); } catch { /* quota */ }
    onProjectChange(updated);
    onApplied();
    showNotification(message, 'success');
  };

  return <section className="mb-3 rounded-2xl border border-violet-200/70 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/10 overflow-hidden">
    <button onClick={() => setOpen((value) => !value)} className="w-full min-h-11 px-3 sm:px-4 flex items-center gap-2 text-left"><Frame className="w-4 h-4 text-violet-600" /><span className="text-xs font-black">Design QA</span><span className="text-[9px] text-slate-500 dark:text-slate-400">Responsividade · limites · contraste</span><span className="ml-auto text-[10px] font-black text-violet-700 dark:text-violet-300">{open ? 'Recolher' : 'Abrir'}</span></button>
    {open && <div className="p-3 sm:p-4 border-t border-violet-200/60 dark:border-violet-900 grid grid-cols-1 xl:grid-cols-3 gap-3">
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Resize className="w-4 h-4 text-violet-600" /> Redimensionar composição</div><p className="mt-1 text-[9px] leading-relaxed text-slate-500">Escala objetos proporcionalmente e centraliza a composição no novo canvas, sem distorcer formas.</p><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="64" max="8192" value={width} onChange={(event) => setWidth(Number(event.target.value))} className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><input type="number" min="64" max="8192" value={height} onChange={(event) => setHeight(Number(event.target.value))} className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /></div><div className="mt-2 flex flex-wrap gap-1">{PRESETS.map(([label, w, h]) => <button key={label} onClick={() => { setWidth(w); setHeight(h); }} className="h-7 px-2 rounded-lg border text-[8px] font-black">{label}</button>)}</div><button onClick={() => persist(resizeComposition(design, width, height), `Composição redimensionada para ${Math.round(width)} × ${Math.round(height)}.`)} className="mt-2 w-full h-9 rounded-lg bg-violet-600 text-white text-[9px] font-black">Aplicar tamanho</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Frame className="w-4 h-4 text-blue-600" /> Limites do canvas</div><p className="mt-2 text-[9px] leading-relaxed text-slate-500">Recoloca totalmente no canvas elementos parcialmente perdidos fora da área editável.</p><button onClick={() => { const result = clampDesignElements(design); persist(result.design, `${result.changed} elemento(s) reposicionado(s) dentro do canvas.`); }} className="mt-3 w-full h-9 rounded-lg bg-blue-600 text-white text-[9px] font-black">Corrigir elementos fora da tela</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Checklist className="w-4 h-4 text-emerald-600" /> Auditoria visual</div><div className="mt-2 flex gap-2"><span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[8px] font-black">{audit.warnings} alerta(s)</span><span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-black">{audit.info} observação(ões)</span></div><div className="mt-2 max-h-36 overflow-auto space-y-1">{audit.findings.slice(0, 14).map((item, index) => <div key={`${item.id}:${index}`} className="text-[9px] leading-relaxed">{item.message}</div>)}{!audit.findings.length && <div className="text-[9px] text-emerald-600 font-black">Nenhuma pendência visual estrutural detectada.</div>}</div><p className="mt-2 text-[8px] leading-relaxed text-slate-400">O contraste é auditado quando texto e fundo usam cores sólidas hexadecimais; imagens e gradientes exigem inspeção visual.</p></div>
    </div>}
  </section>;
};