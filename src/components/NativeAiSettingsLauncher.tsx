import React, { useEffect, useState } from 'react';
import { IconCheck, IconKey, IconLock, IconTrash, IconX } from '@tabler/icons-react';
import { clearNativeAiKey, getNativeAiStatus, isNativeBridgeAvailable, setNativeAiKey, type NativeAiProvider } from '../lib/nativeAndroidBridge';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import {
  FREE_ENTITLEMENT,
  hasOrbiDocFeature,
  subscribeToOrbiDocEntitlement,
  type OrbiDocEntitlement,
} from '../services/entitlements';

const LABELS: Record<NativeAiProvider, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

export const NativeAiSettingsLauncher: React.FC = () => {
  const native = isOrbiDocNativeRuntime() && isNativeBridgeAvailable();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<NativeAiProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<Array<{ provider: NativeAiProvider; configured: boolean }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [entitlement, setEntitlement] = useState<OrbiDocEntitlement>(FREE_ENTITLEMENT);
  const premiumByok = hasOrbiDocFeature(entitlement, 'ai.byok');

  const refresh = async () => {
    if (!native) return;
    setStatus(await getNativeAiStatus());
  };

  useEffect(() => subscribeToOrbiDocEntitlement(setEntitlement), []);
  useEffect(() => { void refresh(); }, [native]);

  useEffect(() => {
    if (!native) return;
    const openSettings = () => setOpen(true);
    window.addEventListener('orbidoc:open-ai-settings', openSettings);
    return () => window.removeEventListener('orbidoc:open-ai-settings', openSettings);
  }, [native]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, busy]);

  useEffect(() => {
    if (!native) return;

    let animationFrame = 0;
    const patchAssistantEmptyState = () => {
      animationFrame = 0;
      const candidates = Array.from(document.querySelectorAll<HTMLDivElement>('div'));
      const banner = candidates.find((element) => element.textContent?.includes('Nenhum provedor de IA está ativo.'));
      if (!banner || banner.dataset.orbidocNativeAiPatched === 'true') return;

      const copy = banner.querySelector('span');
      if (copy) {
        copy.textContent = premiumByok
          ? 'Nenhum provedor de IA está ativo. Conecte Google Gemini, Groq ou OpenRouter diretamente neste aparelho.'
          : 'Nenhum provedor de IA está ativo. BYOK está disponível no OrbiDoc Premium.';
      }

      banner.classList.add('flex-wrap');
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = premiumByok ? 'Conectar IA' : 'Ver Premium';
      action.className = 'ml-6 sm:ml-auto h-9 px-3 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black shrink-0';
      action.setAttribute('aria-label', premiumByok ? 'Conectar provedor de IA agora' : 'Ver acesso Premium');
      action.addEventListener('click', () => setOpen(true));
      banner.appendChild(action);
      banner.dataset.orbidocNativeAiPatched = 'true';

      const arenaCopy = candidates.find((element) => element.textContent?.includes('A arena usa apenas modelos que o servidor informou como configurados.'));
      if (arenaCopy) arenaCopy.textContent = 'A arena usa apenas modelos que estão conectados e disponíveis neste aparelho.';
    };

    const schedulePatch = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(patchAssistantEmptyState);
    };

    schedulePatch();
    const observer = new MutationObserver(schedulePatch);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [native, premiumByok]);

  useEffect(() => {
    if (!native) return;
    let timeout = 0;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ fileName?: string }>).detail;
      setDownloadNotice(`Salvo em Downloads/OrbiDoc${detail?.fileName ? ` · ${detail.fileName}` : ''}`);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setDownloadNotice(''), 4200);
    };
    window.addEventListener('orbidoc:native-download', handler);
    return () => {
      window.removeEventListener('orbidoc:native-download', handler);
      window.clearTimeout(timeout);
    };
  }, [native]);

  if (!native) return null;

  const configured = status.some((item) => item.configured);
  const save = async () => {
    if (!premiumByok) {
      setMessage('BYOK é um recurso Premium. Entre em uma conta Premium ou Supreme para cadastrar chaves próprias.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const models = await setNativeAiKey(provider, apiKey);
      if (!models.length) throw new Error('A chave foi salva, mas nenhum modelo compatível respondeu. Confira a chave e a conexão.');
      setApiKey('');
      setMessage(`${LABELS[provider]} conectado. ${models.length} modelo(s) encontrado(s).`);
      await refresh();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao conectar o provedor.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: NativeAiProvider) => {
    await clearNativeAiKey(item);
    await refresh();
    setMessage(`${LABELS[item]} removido deste aparelho.`);
    window.setTimeout(() => window.location.reload(), 500);
  };

  return <>
    {downloadNotice && <div className="orbidoc-native-download-notice fixed z-[176] left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm bottom-[9.2rem] sm:bottom-20 rounded-2xl bg-emerald-600 text-white shadow-2xl px-4 py-3 flex items-center gap-2 text-[10px] font-black" role="status" aria-live="polite"><IconCheck className="w-4 h-4 shrink-0" /><span className="truncate">{downloadNotice}</span></div>}

    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed z-[73] right-3 bottom-[84px] lg:right-[300px] lg:bottom-5 h-12 lg:h-11 px-3.5 lg:px-4 rounded-2xl bg-[#3157F6] hover:bg-[#2446D8] text-white shadow-xl shadow-[#3157F6]/20 border border-white/15 text-[10px] font-black inline-flex items-center justify-center gap-2 active:scale-95 transition-transform"
      aria-label={premiumByok ? 'Conectar IA no aparelho' : 'Abrir recurso Premium de chaves de IA'}
      title={premiumByok ? (configured ? 'Provedores de IA conectados' : 'Conectar provedor de IA') : 'BYOK · Premium'}
    >
      {premiumByok ? <IconKey className="w-5 h-5" /> : <IconLock className="w-5 h-5" />}
      <span>{premiumByok ? (configured ? 'IAs' : 'Conectar IA') : 'IA Premium'}</span>
    </button>

    {open && <div className="orbidoc-native-ai-overlay fixed inset-0 z-[180] bg-slate-950/70 backdrop-blur-sm p-0 sm:p-3 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="native-ai-settings-title">
      <div className="orbidoc-keyboard-safe-panel w-full max-w-lg max-h-[min(92dvh,760px)] rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-[#101827] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-[#3157F6]/10 text-[#3157F6] flex items-center justify-center">{premiumByok ? <IconKey className="w-5 h-5" /> : <IconLock className="w-5 h-5" />}</div>
          <div className="min-w-0 flex-1"><h3 id="native-ai-settings-title" className="text-sm font-black">{premiumByok ? 'Configurações · Provedores de IA' : 'OrbiDoc Premium · BYOK'}</h3><p className="text-[10px] text-slate-500">{premiumByok ? 'No Android, a chamada vai direto ao provedor escolhido.' : 'Use suas próprias chaves de IA com armazenamento no Android Keystore.'}</p></div>
          <button disabled={busy} onClick={() => setOpen(false)} className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40" aria-label="Fechar configurações de IA"><IconX className="w-4 h-4" /></button>
        </header>

        {!premiumByok ? (
          <div className="p-5 space-y-4">
            <div className="rounded-2xl bg-[#3157F6]/5 border border-[#3157F6]/15 p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#3157F6]">Premium BYOK</div>
              <div className="mt-1 text-base font-black">Sua chave. Seu provedor. Seu controle.</div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Premium libera Gemini, Groq e OpenRouter com chaves armazenadas pelo Android Keystore. O OrbiDoc não grava a chave em Firestore nem no workspace.</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-[9px] leading-relaxed text-slate-500">Entre em uma conta com entitlement <strong>Premium</strong> ou <strong>Supreme</strong>. A compra será vinculada à mesma identidade Firebase para funcionar entre plataformas.</div>
            <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('orbidoc:open-pricing')); }} className="w-full h-11 rounded-xl bg-[#3157F6] text-white text-[10px] font-black">Ver planos Premium</button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900 p-3 text-[10px] leading-relaxed text-emerald-800 dark:text-emerald-200">As chaves são criptografadas pelo <strong>Android Keystore</strong> e ficam somente neste aparelho. A Internet ainda é necessária para conversar com Gemini, Groq ou OpenRouter.</div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(LABELS) as NativeAiProvider[]).map((id) => {
                const active = provider === id;
                const ok = status.find((item) => item.provider === id)?.configured;
                return <button key={id} onClick={() => setProvider(id)} className={`min-w-[104px] flex-1 rounded-xl border px-3 py-2.5 text-[10px] font-black ${active ? 'border-[#3157F6] bg-[#3157F6]/10 text-[#3157F6]' : 'border-slate-200 dark:border-slate-700'}`}>{LABELS[id]}{ok ? ' ✓' : ''}</button>;
              })}
            </div>

            <label className="block"><span className="text-[10px] font-black">Chave de API de {LABELS[provider]}</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Cole sua chave aqui" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs outline-none focus:border-[#3157F6]" /></label>

            {message && <div className="text-[10px] rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-600 dark:text-slate-300" role="status" aria-live="polite">{message}</div>}

            <div className="flex flex-wrap gap-2 pb-1">
              <button disabled={busy || apiKey.trim().length < 10} onClick={() => void save()} className="h-10 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black disabled:opacity-40">{busy ? 'Testando…' : 'Salvar e testar'}</button>
              {status.find((item) => item.provider === provider)?.configured && <button disabled={busy} onClick={() => void remove(provider)} className="h-10 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-black flex items-center gap-1.5 disabled:opacity-40"><IconTrash className="w-4 h-4" /> Remover</button>}
            </div>
          </div>
        )}
      </div>
    </div>}
  </>;
};
