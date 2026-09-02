import React, { useEffect, useMemo, useState } from 'react';
import {
  IconActivity as Activity,
  IconAlertTriangle as AlertTriangle,
  IconCopy as Copy,
  IconFileText as FileText,
  IconMessage as MessageSquare,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconWorldSearch as WorldSearch,
} from '@tabler/icons-react';
import { sendToVercel } from '../api/chat';
import { CleanMarkdown } from './CleanMarkdown';
import { AiDiagnosticsPanel } from './AiDiagnosticsPanel';
import { AiWorkspaceLegacy, type AiModelOption } from './AiWorkspaceLegacy';

export type { AiModelOption } from './AiWorkspaceLegacy';

export interface AiWorkspaceProps {
  selectedModelKey?: string;
  onSelectedModelChange?: (modelKey: string) => void;
  onSendToWord?: (text: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type AiArea = 'copilot' | 'research' | 'diagnostics';
const keyOf = (model: Pick<AiModelOption, 'provider' | 'id'>) => `${model.provider}:${model.id}`;
const providerLabel = (provider: string) => ({
  gemini: 'Google Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  gateway: 'AI Gateway',
  free: 'OrbiDoc Web · Grátis',
} as Record<string, string>)[provider] || provider;
const isFreeEngine = (model: Pick<AiModelOption, 'provider'> | null | undefined) => Boolean(model && model.provider === 'free');
const supportsWebSearch = (model: AiModelOption) => Boolean((model as any).webSearch)
  || model.provider === 'free'
  || model.provider === 'gemini'
  || model.provider === 'openrouter'
  || (model.provider === 'groq' && /compound/i.test(model.id))
  || (model.provider === 'gateway' && /^openai\//i.test(model.id));

const RESEARCH_PROMPTS = [
  'Pesquise as notícias mais recentes sobre este assunto e cite fontes.',
  'Compare as melhores opções atuais para esta decisão com fontes.',
  'Faça uma pesquisa profunda: contexto, dados recentes, divergências e fontes.',
  'Verifique esta afirmação na Web e indique o que é fato e o que é incerto.',
];

export const AiWorkspace: React.FC<AiWorkspaceProps> = (props) => {
  const { selectedModelKey, onSelectedModelChange, onSendToWord, showNotification = () => {} } = props;
  const [area, setArea] = useState<AiArea>('copilot');
  const [catalog, setCatalog] = useState<AiModelOption[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [researchModelKey, setResearchModelKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/models').then((response) => response.ok ? response.json() : Promise.reject(new Error('Catálogo indisponível'))).then((data) => {
      if (!cancelled && Array.isArray(data.models)) setCatalog((data.models as AiModelOption[]).filter((model) => model.enabled));
    }).catch(() => setCatalog([]));
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => catalog.find((model) => keyOf(model) === selectedModelKey) || catalog[0] || null, [catalog, selectedModelKey]);
  const researchModels = useMemo(() => catalog.filter(supportsWebSearch), [catalog]);
  // O motor gratuito é a porta de entrada: funciona para todos, sem chave e sem conta.
  const defaultResearchModel = useMemo(
    () => researchModels.find((model) => model.provider === 'free')
      || researchModels.find((model) => model.provider === 'groq' && model.id === 'groq/compound')
      || researchModels.find((model) => model.recommended)
      || researchModels[0]
      || null,
    [researchModels],
  );
  const researchModel = useMemo(() => researchModels.find((model) => keyOf(model) === researchModelKey) || defaultResearchModel, [researchModels, researchModelKey, defaultResearchModel]);
  const grouped = useMemo(() => Array.from(new Map(catalog.map((model) => [model.provider, catalog.filter((item) => item.provider === model.provider)])).entries()), [catalog]);
  const researchGrouped = useMemo(() => Array.from(new Map(researchModels.map((model) => [model.provider, researchModels.filter((item) => item.provider === model.provider)])).entries()), [researchModels]);

  useEffect(() => {
    if (!researchModelKey && defaultResearchModel) setResearchModelKey(keyOf(defaultResearchModel));
  }, [researchModelKey, defaultResearchModel]);

  const runResearch = async () => {
    const question = query.trim();
    if (!question || busy) return;
    if (!researchModel) {
      showNotification('Nenhum motor de pesquisa Web está ativo. O motor gratuito OrbiDoc Web deveria estar disponível — atualize a página ou verifique o diagnóstico.', 'error');
      return;
    }
    setBusy(true); setResult(''); setError('');
    try {
      const answer = await sendToVercel(researchModel.provider, researchModel.id, [
        { role: 'system', content: 'Você é o modo Pesquisa Web do OrbiDoc. Pesquise a Web usando as ferramentas nativas do provedor. Dê prioridade a fontes primárias e atuais, compare datas quando houver informação recente, separe fatos de inferências e inclua links/citações das fontes consultadas. Se algo não puder ser verificado, diga explicitamente.' },
        { role: 'user', content: question },
      ], undefined, undefined, true);
      setResult(answer);
    } catch (requestError: any) {
      const message = requestError?.message || 'Falha na pesquisa Web.';
      setError(message);
      showNotification(message, 'error');
    } finally { setBusy(false); }
  };

  const areaTabs: Array<{ id: AiArea; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'copilot', label: 'Copiloto', icon: MessageSquare },
    { id: 'research', label: 'Pesquisa Web', icon: WorldSearch },
    { id: 'diagnostics', label: 'Diagnóstico', icon: Activity },
  ];

  return <div className="orbidoc-ai-studio space-y-3">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 shadow-sm flex flex-col xl:flex-row xl:items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3157F6] to-[#6D5EF7] text-white flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="text-sm font-black">Orbi AI Studio</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Provedor selecionado é respeitado sem fallback oculto</div>
        </div>
      </div>
      <div className="orbidoc-product-tabs flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1 overflow-x-auto xl:ml-4" role="tablist" aria-label="Áreas do Orbi AI Studio">
        {areaTabs.map((tab) => {
          const Icon = tab.icon;
          const active = area === tab.id;
          return <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => setArea(tab.id)}
            className={`h-9 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-2 whitespace-nowrap transition-colors ${active ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Icon className="w-4 h-4" /> {tab.label}
          </button>;
        })}
      </div>
      <div className="xl:ml-auto min-w-0 flex items-center gap-2">
        <span className="hidden sm:inline-flex px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500">{selected ? providerLabel(selected.provider) : 'Sem provedor'}</span>
        <select
          value={selected ? keyOf(selected) : ''}
          onChange={(event) => onSelectedModelChange?.(event.target.value)}
          disabled={!catalog.length}
          aria-label="Modelo de IA do copiloto"
          className="h-10 min-w-0 max-w-[310px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-[10px] font-black"
        >
          {grouped.map(([provider, models]) => <optgroup key={provider} label={providerLabel(provider)}>{models.map((model) => <option key={keyOf(model)} value={keyOf(model)}>{model.label}{model.preview ? ' · preview' : ''}</option>)}</optgroup>)}
        </select>
      </div>
    </section>

    {area === 'copilot' ? <AiWorkspaceLegacy {...props} /> : area === 'diagnostics' ? <AiDiagnosticsPanel catalog={catalog} selectedModelKey={selectedModelKey} onSelectedModelChange={onSelectedModelChange} showNotification={showNotification} /> : <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[calc(100dvh-11rem)]">
      <aside className="xl:col-span-4 space-y-4">
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-black text-[#3157F6] dark:text-[#7AA2FF]"><WorldSearch className="w-4 h-4" /> Pesquisa fundamentada</div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[8px] font-black uppercase">Gratuito para todos</span>
          </div>
          <h2 className="mt-2 text-xl font-black">Pesquisar na web com fontes reais</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            O motor <strong className="text-slate-700 dark:text-slate-200">OrbiDoc Web</strong> funciona sem conta e sem chave de API para qualquer pessoa.
            Se houver provedores conectados (Gemini, Groq Compound, OpenRouter), você também pode usá-los — a escolha é sua.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <label htmlFor="orbidoc-research-engine" className="text-[9px] font-black uppercase text-slate-400">Motor de pesquisa</label>
            <select
              id="orbidoc-research-engine"
              value={researchModel ? keyOf(researchModel) : ''}
              onChange={(event) => setResearchModelKey(event.target.value)}
              disabled={!researchModels.length}
              className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-black"
            >
              {researchGrouped.map(([provider, models]) => <optgroup key={provider} label={providerLabel(provider)}>{models.map((model) => <option key={keyOf(model)} value={keyOf(model)}>{model.label}{isFreeEngine(model) ? ' · sem chave' : ''}</option>)}</optgroup>)}
            </select>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-400">
              {isFreeEngine(researchModel) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
              <span>{researchModel ? `${providerLabel(researchModel.provider)} · ${researchModel.id}` : 'Nenhum motor de pesquisa ativo.'}</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {RESEARCH_PROMPTS.map((prompt) => <button key={prompt} onClick={() => setQuery(prompt)} className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold hover:border-[#7AA2FF] hover:bg-[#EFF4FF]/50 dark:hover:bg-[#0D1E5B]/30">{prompt}</button>)}
          </div>
        </section>
      </aside>

      <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col min-h-[620px]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 focus-within:border-[#3157F6] focus-within:ring-2 focus-within:ring-[#3157F6]/10">
            <label htmlFor="orbidoc-research-query" className="sr-only">Pergunta para pesquisar na web</label>
            <textarea
              id="orbidoc-research-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void runResearch(); } }}
              rows={4}
              className="w-full resize-y bg-transparent p-2 text-sm outline-none"
              placeholder="O que você quer pesquisar na Web?"
              aria-describedby="orbidoc-research-hint"
            />
            <div className="flex items-center gap-2">
              <span id="orbidoc-research-hint" className="text-[9px] text-slate-400 hidden sm:inline">Ctrl/Cmd + Enter pesquisa</span>
              {researchModel && <span className={`hidden md:inline px-2 py-1 rounded-full text-[8px] font-black ${isFreeEngine(researchModel) ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'}`}>{providerLabel(researchModel.provider)}</span>}
              <button
                disabled={busy || !query.trim() || !researchModel}
                onClick={() => void runResearch()}
                className="ml-auto h-10 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] focus-visible:ring-2 focus-visible:ring-[#3157F6]/40 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-2"
              >
                <Search className="w-4 h-4" />{busy ? 'Pesquisando…' : 'Pesquisar'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            {busy ? <div className="py-16 max-w-xl mx-auto" aria-live="polite" aria-busy="true">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <span className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#3157F6]/20 animate-ping" />
                  <WorldSearch className="w-7 h-7 text-[#3157F6] dark:text-[#7AA2FF]" />
                </span>
                <div className="text-sm font-black text-slate-600 dark:text-slate-300">Consultando fontes na web…</div>
                <div className="text-xs">Buscando resultados, lendo trechos e preparando a resposta com fontes.</div>
                <div className="mt-4 w-full space-y-2.5" aria-hidden="true">
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse w-11/12" />
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse w-9/12" />
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse w-10/12" />
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse w-6/12" />
                </div>
              </div>
            </div> : error ? <div className="py-16 max-w-lg mx-auto" role="alert">
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 p-5 text-center">
                <AlertTriangle className="w-10 h-10 mx-auto text-rose-500" />
                <div className="mt-3 text-sm font-black text-rose-700 dark:text-rose-300">A pesquisa não pôde ser concluída</div>
                <p className="mt-1 text-xs leading-relaxed text-rose-600/90 dark:text-rose-300/80 break-words">{error}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => void runResearch()} className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400/40 text-white text-[10px] font-black inline-flex items-center gap-2"><Refresh className="w-4 h-4" /> Tentar novamente</button>
                  {isFreeEngine(researchModel) && researchModels.some((model) => !isFreeEngine(model)) && <span className="text-[9px] text-rose-500/80">Dica: um provedor conectado (Gemini, Groq, OpenRouter) pode estar mais estável agora.</span>}
                </div>
              </div>
            </div> : result ? <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black">{researchModel ? providerLabel(researchModel.provider) : 'Pesquisa Web'}</span>
                <span className="text-[9px] text-slate-400">Pesquisa Web ativa · sem fallback entre provedores</span>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                <CleanMarkdown content={result} />
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(result)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#3157F6]/30"><Copy className="w-4 h-4" /> Copiar</button>
                {onSendToWord && <button onClick={() => onSendToWord(result)} className="h-9 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-black inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-400/30"><FileText className="w-4 h-4" /> Abrir em Documentos</button>}
              </div>
            </> : <div className="py-24 text-center text-slate-400">
              <WorldSearch className="w-16 h-16 mx-auto opacity-25" />
              <div className="mt-4 text-sm font-black text-slate-500 dark:text-slate-300">Resultado da pesquisa aparecerá aqui</div>
              <div className="mt-1 text-xs">Escolha o motor e peça fontes, datas, comparação e verificação quando precisar.</div>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-black"><Sparkles className="w-3.5 h-3.5" /> O motor gratuito funciona sem chave de API</div>
            </div>}
          </div>
        </div>
      </section>
    </div>}
  </div>;
};
