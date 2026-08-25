import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconActivity as Activity,
  IconCheck as Check,
  IconClock as Clock,
  IconRefresh as Refresh,
  IconTestPipe as TestPipe,
  IconX as X,
} from '@tabler/icons-react';
import type { AiModelOption } from './AiWorkspaceLegacy';

type ProviderStatus = {
  configured?: boolean;
  reachable?: boolean;
  modelCount?: number;
  strictRouting?: boolean;
  webSearch?: boolean;
  researchModel?: string;
  reason?: string;
};

type StatusPayload = Record<string, ProviderStatus>;
type TestResult = {
  ok: boolean;
  latencyMs: number;
  requestedProvider: string;
  requestedModel: string;
  provider?: string;
  model?: string;
  routedModel?: string;
  message?: string;
};

const PROVIDERS = ['gemini', 'groq', 'openrouter', 'gateway'] as const;
const providerLabel = (provider: string) => ({
  gemini: 'Google Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  gateway: 'Vercel AI Gateway',
} as Record<string, string>)[provider] || provider;
const modelKey = (model: Pick<AiModelOption, 'provider' | 'id'>) => `${model.provider}:${model.id}`;
const fallbackStatusFromCatalog = (catalog: AiModelOption[]): StatusPayload => Object.fromEntries(PROVIDERS.map((provider) => {
  const models = catalog.filter((model) => model.provider === provider);
  const active = models.length > 0;
  return [provider, {
    configured: active,
    reachable: active,
    modelCount: models.length,
    strictRouting: true,
    webSearch: provider !== 'gateway' ? active : models.some((model) => /^openai\//i.test(model.id)),
    researchModel: provider === 'groq' && models.some((model) => model.id === 'groq/compound') ? 'groq/compound' : undefined,
    reason: active ? 'catalog-fallback' : 'not-configured',
  }];
}));

export const AiDiagnosticsPanel: React.FC<{
  catalog: AiModelOption[];
  selectedModelKey?: string;
  onSelectedModelChange?: (key: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}> = ({ catalog, selectedModelKey, onSelectedModelChange, showNotification = () => {} }) => {
  const [status, setStatus] = useState<StatusPayload>({});
  const [statusBusy, setStatusBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const refresh = useCallback(async () => {
    setStatusBusy(true);
    try {
      const response = await fetch('/api/ai/status', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Diagnóstico indisponível (${response.status}).`);
      setStatus(data || {});
    } catch (error: any) {
      const fallback = fallbackStatusFromCatalog(catalog);
      setStatus(fallback);
      if (!catalog.length) showNotification(error?.message || 'Falha ao consultar os provedores.', 'error');
    } finally { setStatusBusy(false); }
  }, [catalog, showNotification]);

  useEffect(() => { void refresh(); }, [refresh]);

  const byProvider = useMemo(() => new Map(PROVIDERS.map((provider) => [provider, catalog.filter((model) => model.provider === provider)])), [catalog]);

  const testProvider = async (provider: string) => {
    const models = byProvider.get(provider as (typeof PROVIDERS)[number]) || [];
    const desired = models.find((model) => modelKey(model) === selectedModelKey) || models.find((model) => model.recommended) || models[0];
    if (!desired) {
      showNotification(`${providerLabel(provider)} não possui modelo ativo no catálogo.`, 'error');
      return;
    }
    const key = modelKey(desired);
    onSelectedModelChange?.(key);
    setTesting(provider);
    const started = performance.now();
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: desired.provider,
          model: desired.id,
          messages: [{ role: 'user', content: 'Responda somente com ORBIDOC_OK.' }],
          webSearch: false,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      if (!response.ok) throw new Error(data.error || `Falha ${response.status}`);
      const actualProvider = String(data.provider || '');
      const strictOk = actualProvider === desired.provider && !data.fallbackUsed;
      const result: TestResult = {
        ok: strictOk,
        latencyMs,
        requestedProvider: desired.provider,
        requestedModel: desired.id,
        provider: actualProvider,
        model: String(data.model || desired.id),
        routedModel: data.routedModel ? String(data.routedModel) : undefined,
        message: strictOk ? 'Provedor confirmado sem fallback oculto.' : `Resposta veio de ${actualProvider || 'provedor desconhecido'}.`,
      };
      setResults((current) => ({ ...current, [provider]: result }));
      showNotification(strictOk ? `${providerLabel(provider)} respondeu corretamente em ${latencyMs} ms.` : `${providerLabel(provider)} respondeu com roteamento inesperado.`, strictOk ? 'success' : 'error');
    } catch (error: any) {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      setResults((current) => ({ ...current, [provider]: {
        ok: false,
        latencyMs,
        requestedProvider: desired.provider,
        requestedModel: desired.id,
        message: error?.message || 'Falha desconhecida',
      } }));
      showNotification(error?.message || `Falha ao testar ${providerLabel(provider)}.`, 'error');
    } finally { setTesting(null); }
  };

  return <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[calc(100dvh-11rem)]">
    <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 text-xs font-black text-[#3157F6] dark:text-[#7AA2FF]"><Activity className="w-4 h-4" /> Diagnóstico de IA</div>
          <h2 className="mt-1 text-xl font-black">Estado real dos provedores</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">A consulta de estado não gasta geração. O botão “Testar” envia uma única mensagem mínima ao provedor escolhido para confirmar roteamento e latência. No APK, quando o endpoint Web não existe, o painel usa o catálogo nativo e o teste direto continua disponível.</p>
        </div>
        <button onClick={() => void refresh()} disabled={statusBusy} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center justify-center gap-2 disabled:opacity-40"><Refresh className={`w-4 h-4 ${statusBusy ? 'animate-spin' : ''}`} /> Atualizar estado</button>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => {
          const state = status[provider] || {};
          const models = byProvider.get(provider) || [];
          const result = results[provider];
          const ready = Boolean(state.configured && state.reachable && models.length);
          return <article key={provider} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ready ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : state.configured ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{ready ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}</div>
              <div className="min-w-0 flex-1"><div className="text-sm font-black">{providerLabel(provider)}</div><div className="mt-0.5 text-[9px] text-slate-400">{state.configured ? state.reachable ? 'Configurado e alcançável' : 'Configurado, mas não alcançável' : 'Não configurado'} · {models.length} modelo(s) utilizável(is)</div></div>
              {state.strictRouting && <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[8px] font-black uppercase">strict</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white dark:bg-slate-900 p-2"><div className="text-[8px] uppercase text-slate-400 font-black">Catálogo</div><div className="mt-1 text-xs font-black">{state.modelCount ?? '—'}</div></div><div className="rounded-xl bg-white dark:bg-slate-900 p-2"><div className="text-[8px] uppercase text-slate-400 font-black">Pesquisa</div><div className="mt-1 text-xs font-black">{state.webSearch ? 'Sim' : '—'}</div></div><div className="rounded-xl bg-white dark:bg-slate-900 p-2"><div className="text-[8px] uppercase text-slate-400 font-black">Teste</div><div className={`mt-1 text-xs font-black ${result?.ok ? 'text-emerald-600' : result ? 'text-rose-600' : ''}`}>{result ? result.ok ? 'OK' : 'Falhou' : '—'}</div></div></div>
            {result && <div className={`mt-3 rounded-xl border px-3 py-2 text-[9px] leading-relaxed ${result.ok ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200' : 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200'}`}><div className="font-black inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {result.latencyMs} ms</div><div className="mt-1 break-words">{result.message}</div>{result.provider && <div className="mt-1 opacity-80">Retorno: {result.provider} · {result.routedModel || result.model}</div>}</div>}
            <button onClick={() => void testProvider(provider)} disabled={!ready || testing !== null} className="mt-3 w-full h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center justify-center gap-2 disabled:opacity-40"><TestPipe className="w-4 h-4" /> {testing === provider ? 'Testando…' : 'Testar provedor'}</button>
          </article>;
        })}
      </div>
    </section>

    <aside className="xl:col-span-4 space-y-4">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"><h3 className="text-sm font-black">Como interpretar</h3><div className="mt-3 space-y-3 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400"><p><strong className="text-slate-800 dark:text-slate-200">Configurado:</strong> existe credencial válida no ambiente ou no bridge nativo.</p><p><strong className="text-slate-800 dark:text-slate-200">Alcançável:</strong> o catálogo remoto do provedor respondeu.</p><p><strong className="text-slate-800 dark:text-slate-200">Strict:</strong> o runtime não troca silenciosamente de provedor quando há erro.</p><p><strong className="text-slate-800 dark:text-slate-200">Teste:</strong> confirma uma geração mínima e compara o provedor pedido com o retornado.</p></div></section>
      <section className="rounded-3xl border border-blue-200/70 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-4"><div className="text-[10px] font-black text-blue-800 dark:text-blue-200">Transparência por padrão</div><p className="mt-1 text-[9px] leading-relaxed text-blue-700/80 dark:text-blue-300/80">O OrbiDoc mostra o provedor real, modelo solicitado, modelo roteado quando houver roteamento interno do mesmo provedor e a latência observada. Um teste só roda quando você toca no botão.</p></section>
    </aside>
  </div>;
};
