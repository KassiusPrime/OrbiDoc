import React, { useEffect, useMemo, useState } from 'react';
import {
  IconActivity as Activity,
  IconCopy as Copy,
  IconFileText as FileText,
  IconMessage as MessageSquare,
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
const providerLabel = (provider: string) => ({ gemini: 'Google Gemini', groq: 'Groq', openrouter: 'OpenRouter', gateway: 'AI Gateway' } as Record<string, string>)[provider] || provider;
const supportsWebSearch = (model: AiModelOption) => Boolean((model as any).webSearch)
  || model.provider === 'gemini'
  || model.provider === 'openrouter'
  || (model.provider === 'groq' && /compound/i.test(model.id))
  || (model.provider === 'gateway' && /^openai\//i.test(model.id));

export const AiWorkspace: React.FC<AiWorkspaceProps> = (props) => {
  const { selectedModelKey, onSelectedModelChange, onSendToWord, showNotification = () => {} } = props;
  const [area, setArea] = useState<AiArea>('copilot');
  const [catalog, setCatalog] = useState<AiModelOption[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
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
  const defaultResearchModel = useMemo(() => researchModels.find((model) => model.provider === 'groq' && model.id === 'groq/compound') || researchModels.find((model) => model.recommended) || researchModels[0] || null, [researchModels]);
  const researchModel = useMemo(() => researchModels.find((model) => keyOf(model) === researchModelKey) || defaultResearchModel, [researchModels, researchModelKey, defaultResearchModel]);
  const grouped = useMemo(() => Array.from(new Map(catalog.map((model) => [model.provider, catalog.filter((item) => item.provider === model.provider)])).entries()), [catalog]);
  const researchGrouped = useMemo(() => Array.from(new Map(researchModels.map((model) => [model.provider, researchModels.filter((item) => item.provider === model.provider)])).entries()), [researchModels]);

  useEffect(() => {
    if (!researchModelKey && defaultResearchModel) setResearchModelKey(keyOf(defaultResearchModel));
  }, [researchModelKey, defaultResearchModel]);

  const runResearch = async () => {
    if (!query.trim()) return;
    if (!researchModel) {
      showNotification('Nenhum modelo com pesquisa Web real está ativo. Conecte Gemini, Groq Compound, OpenRouter ou um modelo Gateway compatível.', 'error');
      return;
    }
    setBusy(true); setResult('');
    try {
      const answer = await sendToVercel(researchModel.provider, researchModel.id, [
        { role: 'system', content: 'Você é o modo Pesquisa Web do OrbiDoc. Pesquise a Web usando as ferramentas nativas do provedor. Dê prioridade a fontes primárias e atuais, compare datas quando houver informação recente, separe fatos de inferências e inclua links/citações das fontes consultadas. Se algo não puder ser verificado, diga explicitamente.' },
        { role: 'user', content: query.trim() },
      ], undefined, undefined, true);
      setResult(answer);
    } catch (error: any) {
      showNotification(error?.message || 'Falha na pesquisa Web.', 'error');
    } finally { setBusy(false); }
  };

  return <div className="orbidoc-ai-studio space-y-3">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 shadow-sm flex flex-col xl:flex-row xl:items-center gap-3">
      <div className="flex items-center gap-2 min-w-0"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3157F6] to-[#6D5EF7] text-white flex items-center justify-center"><Sparkles className="w-5 h-5" /></div><div className="min-w-0"><div className="text-sm font-black">Orbi AI Studio</div><div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Provedor selecionado é respeitado sem fallback oculto</div></div></div>
      <div className="orbidoc-product-tabs flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1 overflow-x-auto xl:ml-4">
        <button onClick={() => setArea('copilot')} className={`h-9 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'copilot' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500'}`}><MessageSquare className="w-4 h-4" /> Copiloto</button>
        <button onClick={() => setArea('research')} className={`h-9 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'research' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500'}`}><WorldSearch className="w-4 h-4" /> Pesquisa Web</button>
        <button onClick={() => setArea('diagnostics')} className={`h-9 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'diagnostics' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500'}`}><Activity className="w-4 h-4" /> Diagnóstico</button>
      </div>
      <div className="xl:ml-auto min-w-0 flex items-center gap-2"><span className="hidden sm:inline-flex px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500">{selected ? providerLabel(selected.provider) : 'Sem provedor'}</span><select value={selected ? keyOf(selected) : ''} onChange={(event) => onSelectedModelChange?.(event.target.value)} disabled={!catalog.length} className="h-10 min-w-0 max-w-[310px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-[10px] font-black">{grouped.map(([provider, models]) => <optgroup key={provider} label={providerLabel(provider)}>{models.map((model) => <option key={keyOf(model)} value={keyOf(model)}>{model.label}{model.preview ? ' · preview' : ''}</option>)}</optgroup>)}</select></div>
    </section>

    {area === 'copilot' ? <AiWorkspaceLegacy {...props} /> : area === 'diagnostics' ? <AiDiagnosticsPanel catalog={catalog} selectedModelKey={selectedModelKey} onSelectedModelChange={onSelectedModelChange} showNotification={showNotification} /> : <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[calc(100dvh-11rem)]">
      <aside className="xl:col-span-4 space-y-4"><section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"><div className="inline-flex items-center gap-2 text-xs font-black text-[#3157F6] dark:text-[#7AA2FF]"><WorldSearch className="w-4 h-4" /> Pesquisa fundamentada</div><h2 className="mt-2 text-xl font-black">Pesquisar com fontes reais</h2><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Este modo envia <code className="font-mono">webSearch=true</code> ao runtime e usa a ferramenta nativa do provedor, não apenas um prompt pedindo para “procurar”.</p><div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3"><div className="text-[9px] font-black uppercase text-slate-400">Motor de pesquisa</div><select value={researchModel ? keyOf(researchModel) : ''} onChange={(event) => setResearchModelKey(event.target.value)} disabled={!researchModels.length} className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-black">{researchGrouped.map(([provider, models]) => <optgroup key={provider} label={providerLabel(provider)}>{models.map((model) => <option key={keyOf(model)} value={keyOf(model)}>{model.label}</option>)}</optgroup>)}</select><div className="text-[9px] text-slate-400 mt-2">{researchModel ? `${providerLabel(researchModel.provider)} · ${researchModel.id}` : 'Nenhum motor de pesquisa ativo.'}</div></div><div className="mt-4 space-y-2">{['Pesquise as notícias mais recentes sobre este assunto e cite fontes.', 'Compare as melhores opções atuais para esta decisão com fontes.', 'Faça uma pesquisa profunda: contexto, dados recentes, divergências e fontes.', 'Verifique esta afirmação na Web e indique o que é fato e o que é incerto.'].map((prompt) => <button key={prompt} onClick={() => setQuery(prompt)} className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-left text-[10px] font-bold hover:border-[#7AA2FF] hover:bg-[#EFF4FF]/50 dark:hover:bg-[#0D1E5B]/30">{prompt}</button>)}</div></section></aside>
      <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col min-h-[620px]"><div className="p-4 border-b border-slate-100 dark:border-slate-800"><div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 focus-within:border-[#3157F6] focus-within:ring-2 focus-within:ring-[#3157F6]/10"><textarea value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void runResearch(); } }} rows={4} className="w-full resize-y bg-transparent p-2 text-sm outline-none" placeholder="O que você quer pesquisar na Web?" /><div className="flex items-center gap-2"><span className="text-[9px] text-slate-400 hidden sm:inline">Ctrl/Cmd + Enter pesquisa</span>{researchModel && <span className="hidden md:inline px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[8px] font-black">{providerLabel(researchModel.provider)}</span>}<button disabled={busy || !query.trim() || !researchModel} onClick={() => void runResearch()} className="ml-auto h-10 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-2"><Search className="w-4 h-4" />{busy ? 'Pesquisando…' : 'Pesquisar'}</button></div></div></div><div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="max-w-4xl mx-auto">{result ? <><div className="mb-3 flex flex-wrap items-center gap-2"><span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black">{researchModel ? providerLabel(researchModel.provider) : 'Pesquisa Web'}</span><span className="text-[9px] text-slate-400">Pesquisa Web ativa · sem fallback entre provedores</span></div><div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5"><CleanMarkdown content={result} /></div><div className="mt-3 flex gap-2"><button onClick={() => navigator.clipboard.writeText(result)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Copy className="w-4 h-4" /> Copiar</button>{onSendToWord && <button onClick={() => onSendToWord(result)} className="h-9 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-black inline-flex items-center gap-2"><FileText className="w-4 h-4" /> Abrir em Documentos</button>}</div></> : <div className="py-24 text-center text-slate-400"><WorldSearch className="w-16 h-16 mx-auto opacity-25" /><div className="mt-4 text-sm font-black">Resultado da pesquisa aparecerá aqui</div><div className="mt-1 text-xs">Escolha o motor e peça fontes, datas, comparação e verificação quando precisar.</div></div>}</div></div></section>
    </div>}
  </div>;
};
