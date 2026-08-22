import React, { useEffect, useState } from 'react';
import { IconKey, IconTrash, IconX } from '@tabler/icons-react';
import { clearNativeAiKey, getNativeAiStatus, isNativeBridgeAvailable, setNativeAiKey, type NativeAiProvider } from '../lib/nativeAndroidBridge';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';

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

  const refresh = async () => {
    if (!native) return;
    setStatus(await getNativeAiStatus());
  };

  useEffect(() => { void refresh(); }, [native]);
  if (!native) return null;

  const configured = status.some((item) => item.configured);
  const save = async () => {
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
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed z-[145] right-3 bottom-[5.8rem] sm:bottom-5 h-10 px-3 rounded-2xl bg-[#3157F6] text-white shadow-xl border border-white/15 text-[10px] font-black flex items-center gap-2"
      aria-label="Conectar IA no aparelho"
    >
      <IconKey className="w-4 h-4" /> {configured ? 'IAs' : 'Conectar IA'}
    </button>

    {open && <div className="fixed inset-0 z-[180] bg-slate-950/70 backdrop-blur-sm p-3 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#101827] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <header className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-[#3157F6]/10 text-[#3157F6] flex items-center justify-center"><IconKey className="w-5 h-5" /></div>
          <div className="flex-1"><h3 className="text-sm font-black">IA conectada ao aparelho</h3><p className="text-[10px] text-slate-500">Sem Vercel: o Android chama o provedor diretamente.</p></div>
          <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"><IconX className="w-4 h-4" /></button>
        </header>

        <div className="p-4 space-y-4">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900 p-3 text-[10px] leading-relaxed text-emerald-800 dark:text-emerald-200">As chaves são criptografadas pelo <strong>Android Keystore</strong> e ficam somente neste aparelho. A Internet ainda é necessária para conversar com Gemini, Groq ou OpenRouter.</div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(LABELS) as NativeAiProvider[]).map((id) => {
              const active = provider === id;
              const ok = status.find((item) => item.provider === id)?.configured;
              return <button key={id} onClick={() => setProvider(id)} className={`rounded-xl border p-2 text-[10px] font-black ${active ? 'border-[#3157F6] bg-[#3157F6]/10 text-[#3157F6]' : 'border-slate-200 dark:border-slate-700'}`}>{LABELS[id]}{ok ? ' ✓' : ''}</button>;
            })}
          </div>

          <label className="block"><span className="text-[10px] font-black">Chave de API de {LABELS[provider]}</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Cole sua chave aqui" autoComplete="off" className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs outline-none focus:border-[#3157F6]" /></label>

          {message && <div className="text-[10px] rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-600 dark:text-slate-300">{message}</div>}

          <div className="flex flex-wrap gap-2">
            <button disabled={busy || apiKey.trim().length < 10} onClick={() => void save()} className="h-10 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black disabled:opacity-40">{busy ? 'Testando…' : 'Salvar e testar'}</button>
            {status.find((item) => item.provider === provider)?.configured && <button onClick={() => void remove(provider)} className="h-10 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[10px] font-black flex items-center gap-1.5"><IconTrash className="w-4 h-4" /> Remover</button>}
          </div>
        </div>
      </div>
    </div>}
  </>;
};
