import React, { useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPlus, IconSparkles, IconHistory } from '@tabler/icons-react';

export interface CopilotShellProps {
  children: React.ReactNode;
  title: string;
  contextTitle?: string;
  contextItems?: Array<{ id: string; label: string; detail?: string }>;
  onContextSelect?: (id: string) => void;
  onNavigate?: (view: 'reader' | 'projects' | 'history') => void;
}

export const CopilotShell: React.FC<CopilotShellProps> = ({
  children, title, contextTitle = 'Contexto', contextItems = [], onContextSelect, onNavigate,
}) => {
  const [rightOpen, setRightOpen] = useState(false);
  return (
    <section className="orbit-copilot-shell h-full min-h-[480px] min-w-0 flex overflow-hidden rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/70 dark:border-white/6">
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="h-12 shrink-0 border-b border-white/6 flex items-center px-3 sm:px-4 gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><i className="fi fi-rr-sparkles text-base" aria-hidden="true" /><IconSparkles className="hidden h-4 w-4" /></span>
          <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
          <span className="ml-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Texto gratuito · chat</span>
          <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onNavigate?.('history')} className="hidden h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:inline-flex items-center justify-center" aria-label="Abrir histórico" title="Histórico"><IconHistory className="h-4 w-4" /></button>
          <button type="button" onClick={() => window.dispatchEvent(new Event('orbidoc:nexus-new-chat'))} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800" aria-label="Novo chat">
            <IconPlus className="h-3.5 w-3.5" /> Novo chat
          </button>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <aside className={`hidden xl:flex shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-[#0f1218]/60 transition-[width] duration-200 ${rightOpen ? 'w-[250px]' : 'w-[44px]'}`}>
        <div className="h-12 px-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {rightOpen ? <span className="text-xs font-black">{contextTitle}</span> : null}
          <button type="button" onClick={() => setRightOpen(v => !v)} className="h-8 w-8 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center" aria-label={rightOpen ? 'Recolher contexto' : 'Expandir contexto'}>
            {rightOpen ? <IconChevronRight className="h-4 w-4" /> : <IconChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        {rightOpen ? <div className="p-2 space-y-1 overflow-y-auto">{contextItems.length ? contextItems.map(item => (
          <button key={item.id} type="button" onClick={() => onContextSelect?.(item.id)} className="w-full text-left rounded-lg p-2.5 hover:bg-white dark:hover:bg-slate-900">
            <div className="text-[11px] font-bold truncate">{item.label}</div>
            {item.detail ? <div className="mt-0.5 text-[9px] text-slate-500 line-clamp-2">{item.detail}</div> : null}
          </button>
        )) : <div className="p-3 text-[10px] text-slate-500">Abra um arquivo ou selecione um contexto para trabalhar com o Nexus AI.</div>}</div> : null}
      </aside>
    </section>
  );
};
