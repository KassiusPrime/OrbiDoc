import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle as AlertTriangle,
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconCircleCheck as CheckCircle2,
  IconRobot as Robot,
} from '@tabler/icons-react';
import { AI_RUNTIME_EVENT, AiRuntimeMeta } from '../api/chat';

type ModelHealth = {
  id: string;
  provider: string;
  label: string;
  enabled: boolean;
  recommended?: boolean;
  preview?: boolean;
};

export const AiRuntimeStatus: React.FC = () => {
  const [meta, setMeta] = useState<AiRuntimeMeta | null>(null);
  const [models, setModels] = useState<ModelHealth[]>([]);
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
    fetch('/api/ai/models')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('AI health unavailable')))
      .then((data) => {
        if (!cancelled && Array.isArray(data.models)) setModels(data.models);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => { cancelled = true; };
  }, []);

  const enabledCount = useMemo(() => models.filter((model) => model.enabled).length, [models]);
  const actualModel = meta?.routedModel || meta?.model;
  const actualProvider = meta?.provider;
  const hasFailure = Boolean(meta?.fallbackReason && !meta?.fallbackUsed);

  if (!meta && models.length === 0) return null;

  return (
    <div className="fixed right-3 bottom-[76px] md:bottom-4 z-[70] pointer-events-none max-w-[calc(100vw-24px)]">
      <div className="pointer-events-auto rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden min-w-[220px] max-w-sm">
        <button
          onClick={() => setExpanded((value) => !value)}
          className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70"
          aria-expanded={expanded}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${hasFailure ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50' : meta?.fallbackUsed ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50'}`}>
            {hasFailure ? <AlertTriangle className="w-4 h-4" /> : <Robot className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide font-black text-slate-400">IA em execução</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {actualModel ? `${actualProvider || 'IA'} · ${actualModel}` : `${enabledCount} provedor(es) disponível(is)`}
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {expanded && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-3 text-[11px]">
            {meta && (
              <div className="space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Solicitado</span><span className="font-bold text-slate-700 dark:text-slate-200 text-right">{meta.requestedProvider || '—'} · {meta.requestedModel || 'automático'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Respondendo</span><span className="font-bold text-slate-700 dark:text-slate-200 text-right">{actualProvider || '—'} · {actualModel || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Fallback</span><span className={`font-black ${meta.fallbackUsed ? 'text-amber-600' : 'text-emerald-600'}`}>{meta.fallbackUsed ? 'Sim' : 'Não'}</span></div>
                {meta.fallbackReason && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2 text-amber-800 dark:text-amber-200 leading-relaxed">{meta.fallbackReason}</div>}
                {meta.requestId && <div className="text-[9px] text-slate-400 break-all">request: {meta.requestId}</div>}
              </div>
            )}

            {models.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="font-black text-slate-700 dark:text-slate-200">Modelos configurados</div>
                {models.map((model) => (
                  <div key={`${model.provider}:${model.id}`} className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${model.enabled ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'}`} />
                    <span className={model.enabled ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}>{model.label}</span>
                    {model.recommended && <span className="ml-auto text-[8px] font-black uppercase text-indigo-500">recomendado</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
