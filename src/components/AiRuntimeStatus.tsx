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
import { orbitApiUrl } from '../lib/orbitApiOrigin';

type NexusHealth = {
  status?: string;
  ai?: {
    assistant?: string;
    gateway?: string;
    configured?: boolean;
    freeOnly?: boolean;
    ollama?: boolean;
    model?: string;
    modelPresent?: boolean;
    search?: boolean;
    healthyModels?: number;
    unavailableModels?: number;
    totalModels?: number;
  };
};

export const AiRuntimeStatus: React.FC = () => {
  const [meta, setMeta] = useState<AiRuntimeMeta | null>(null);
  const [health, setHealth] = useState<NexusHealth | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(orbitApiUrl('/api/health'), { cache: 'no-store' });
        if (!response.ok) throw new Error('health');
        const data = await response.json() as NexusHealth;
        if (cancelled) return;
        setHealth(data);
        const online = data.ai?.ollama === true && data.ai?.modelPresent === true;
        window.dispatchEvent(new CustomEvent('orbit:nexus-health', { detail: { online } }));
      } catch {
        if (!cancelled) {
          setHealth({ ai: { configured: false, ollama: false, modelPresent: false, search: false } });
          window.dispatchEvent(new CustomEvent('orbit:nexus-health', { detail: { online: false } }));
        }
      }
    };
    void load();
    const interval = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    const onVisibility = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!meta && !health) return null;
  const ai = health?.ai;
  const configured = ai?.configured !== false;
  const ollamaOnline = ai?.ollama === true && ai?.modelPresent === true;
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
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{ollamaOnline ? `Nexus AI · ${web ? 'Pesquisa Web' : 'Ollama local'}` : 'IA offline — verifique o servidor'}</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {expanded ? (
          <div className="orbidoc-ai-runtime-details border-t border-slate-100 dark:border-slate-800 p-3 space-y-2.5 text-[11px] max-h-[min(52dvh,380px)] overflow-y-auto">
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Gateway de IA</span><span className="font-black">{ai?.gateway || 'Ollama (self-hosted)'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Modelo</span><span className="font-black truncate max-w-[180px]">{ai?.model || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Servidor</span><span className={ollamaOnline ? 'inline-flex items-center gap-1 font-black text-emerald-600' : 'inline-flex items-center gap-1 font-black text-rose-600'}>{ollamaOnline ? <><CheckCircle className="w-3.5 h-3.5" /> online</> : 'offline'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Busca Web</span><span className="font-black">{ai?.search ? 'SearXNG disponível' : 'indisponível'}</span></div>
            {meta?.strategy ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Estratégia</span><span className="font-black">{meta.strategy === 'coding' ? 'Código & lógica' : meta.strategy === 'deep' ? 'Raciocínio profundo' : meta.strategy === 'web' ? 'Pesquisa fundamentada' : 'Resposta rápida'}</span></div> : null}
            {web ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Web</span><span className="inline-flex items-center gap-1 font-black text-violet-600"><WorldSearch className="w-3.5 h-3.5" /> SearXNG</span></div> : null}
            {ai?.totalModels ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Modelos instalados</span><span className="font-black">{ai.healthyModels ?? 0}/{ai.totalModels}</span></div> : null}
            {!ai?.search ? <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2 text-slate-500">Busca Web indisponível. O chat continua funcionando sem contexto externo.</div> : null}
            {meta?.fallbackUsed ? <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2 text-amber-800 dark:text-amber-200">O Nexus AI trocou automaticamente de rota gratuita para concluir a resposta.</div> : null}
            {meta?.requestId ? <div className="text-[9px] text-slate-400 break-all">request: {meta.requestId}</div> : null}
            <div className="pt-1 text-[9px] leading-relaxed text-slate-400">O modelo é executado pelo Ollama do servidor. A busca SearXNG fornece apenas dados externos não confiáveis.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
