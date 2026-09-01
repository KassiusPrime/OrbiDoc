import React, { useEffect, useState } from 'react';
import {
  IconAlertTriangle as AlertTriangle,
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconCircleCheck as CheckCircle,
  IconSparkles as Sparkles,
  IconWorldSearch as WorldSearch,
} from '@tabler/icons-react';
import { AI_RUNTIME_EVENT, type AiRuntimeMeta } from '../api/chat';

type NexusHealth = {
  assistant?: string;
  gateway?: string;
  configured?: boolean;
  freeOnly?: boolean;
  healthyModels?: number;
  unavailableModels?: number;
  totalModels?: number;
};

export const AiRuntimeStatus: React.FC = () => {
  const [meta, setMeta] = useState<AiRuntimeMeta | null>(null);
  const [health, setHealth] = useState<NexusHealth | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<AiRuntimeMeta>;
      if (custom.detail) setMeta(custom.detail);
    };
    window.addEventListener(AI_RUNTIME_EVENT, listener);
    return () => window.removeEventListener(AI_RUNTIME_EVENT, listener);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/status')
      .then((response) => response.ok ? response.json() as Promise<NexusHealth> : Promise.reject(new Error('Nexus AI indisponível')))
      .then((data) => { if (!cancelled) setHealth(data); })
      .catch(() => { if (!cancelled) setHealth(null); });
    return () => { cancelled = true; };
  }, [meta?.requestId]);

  if (!meta && !health) return null;
  const configured = health?.configured !== false;
  const web = Boolean(meta?.webSearch);

  return (
    <div className="orbidoc-ai-runtime fixed z-[70] pointer-events-none" data-expanded={expanded ? 'true' : 'false'}>
      <div className="orbidoc-ai-runtime-card pointer-events-auto overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-[#0F0F11]/95 backdrop-blur-xl shadow-xl">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="orbidoc-ai-runtime-trigger w-full min-h-12 px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70"
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher status do Nexus AI' : 'Abrir status do Nexus AI'}
        >
          <div className={`orbidoc-ai-runtime-icon w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${configured ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50'}`}>
            {configured ? <Sparkles className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div className="orbidoc-ai-runtime-copy min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide font-black text-slate-400">Orbit</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Nexus AI · {web ? 'Pesquisa Web' : 'Roteamento automático'}</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {expanded ? (
          <div className="orbidoc-ai-runtime-details border-t border-slate-100 dark:border-slate-800 p-3 space-y-2.5 text-[11px] max-h-[min(52dvh,380px)] overflow-y-auto">
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Gateway de IA</span><span className="font-black">OpenRouter</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Política</span><span className="inline-flex items-center gap-1 font-black text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> somente free</span></div>
            {meta?.strategy ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Estratégia</span><span className="font-black">{meta.strategy === 'coding' ? 'Código & lógica' : meta.strategy === 'deep' ? 'Raciocínio profundo' : meta.strategy === 'web' ? 'Pesquisa fundamentada' : 'Resposta rápida'}</span></div> : null}
            {web ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Web</span><span className="inline-flex items-center gap-1 font-black text-violet-600"><WorldSearch className="w-3.5 h-3.5" /> descoberta gratuita</span></div> : null}
            {health?.totalModels ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Pool interno saudável</span><span className="font-black">{health.healthyModels ?? 0}/{health.totalModels}</span></div> : null}
            {meta?.fallbackUsed ? <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2 text-amber-800 dark:text-amber-200">O Nexus AI trocou automaticamente de rota gratuita para concluir a resposta.</div> : null}
            {meta?.requestId ? <div className="text-[9px] text-slate-400 break-all">request: {meta.requestId}</div> : null}
            <div className="pt-1 text-[9px] leading-relaxed text-slate-400">Os modelos internos não são expostos ao usuário. Logs e Circuit Breakers permanecem disponíveis para observabilidade do sistema.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
