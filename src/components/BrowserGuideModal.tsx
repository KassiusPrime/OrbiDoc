import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  Monitor,
  RefreshCw,
  Shield,
  Smartphone,
  TabletSmartphone,
  X,
} from 'lucide-react';
import {
  detectInstallDevice,
  isStandaloneInstalled,
  type OrbiDocInstallDevice,
} from '../lib/pwaInstall';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import { OrbiDocLogo } from './OrbiDocLogo';

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface BrowserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: DeferredInstallPrompt | null;
  onTriggerInstall?: () => void;
}

type DeviceCard = {
  id: OrbiDocInstallDevice;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DEVICES: DeviceCard[] = [
  { id: 'android', label: 'Android', subtitle: 'App nativo, PWA ou Play Store', icon: Smartphone },
  { id: 'ios', label: 'iPhone / iPad', subtitle: 'Web App pelo Safari', icon: TabletSmartphone },
  { id: 'windows', label: 'Windows', subtitle: 'PWA desktop', icon: Monitor },
  { id: 'mac', label: 'macOS', subtitle: 'PWA desktop', icon: Laptop },
  { id: 'linux', label: 'Linux', subtitle: 'PWA desktop', icon: Monitor },
  { id: 'web', label: 'Web', subtitle: 'Usar no navegador', icon: Globe },
];

const Status: React.FC<{
  ok: boolean;
  icon: React.ReactNode;
  text: string;
  neutral?: boolean;
}> = ({ ok, icon, text, neutral = false }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 ${
    neutral
      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
      : ok
        ? 'bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-300'
        : 'bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-300'
  }`}>
    {icon}{text}
  </span>
);

const Info: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
    <div className="text-[10px] font-black">{title}</div>
    <div className="mt-1 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</div>
  </div>
);

const PrimaryInstall: React.FC<{
  installed: boolean;
  canPrompt: boolean;
  onInstall: () => void;
}> = ({ installed, canPrompt, onInstall }) => {
  if (installed) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/25 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">Orbit já está instalado</div>
          <div className="mt-1 text-[9px] text-emerald-700 dark:text-emerald-300">Esta sessão já está executando como aplicativo instalado.</div>
        </div>
      </div>
    );
  }

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={onInstall}
        className="h-11 px-4 rounded-xl bg-[#7C3AED] hover:bg-violet-700 text-white text-[10px] font-black inline-flex items-center gap-2"
      >
        <Download className="w-4 h-4" /> Instalar Orbit
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-[10px] leading-relaxed text-slate-500">
      O navegador não ofereceu o prompt instalável nesta sessão. Use o menu do Chrome, Edge ou Safari conforme as instruções da plataforma.
    </div>
  );
};

export const BrowserGuideModal: React.FC<BrowserGuideModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt = null,
  onTriggerInstall,
}) => {
  const nativeRuntime = useMemo(() => isOrbiDocNativeRuntime(), []);
  const [device, setDevice] = useState<OrbiDocInstallDevice>(() => detectInstallDevice());
  const [installed, setInstalled] = useState(() => nativeRuntime || isStandaloneInstalled());
  const [swReady, setSwReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDevice(detectInstallDevice());
    setInstalled(nativeRuntime || isStandaloneInstalled());
    if (nativeRuntime) {
      setSwReady(false);
      return;
    }
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then((registration) => setSwReady(Boolean(registration)));
    }
  }, [isOpen, nativeRuntime]);

  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<{ installed?: boolean }>).detail;
      if (nativeRuntime) {
        setInstalled(true);
        return;
      }
      setInstalled(detail?.installed ?? isStandaloneInstalled());
    };
    window.addEventListener('orbit:install-state', handler);
    window.addEventListener('orbidoc:install-state', handler);
    window.addEventListener('appinstalled', handler);
    return () => {
      window.removeEventListener('orbit:install-state', handler);
      window.removeEventListener('orbidoc:install-state', handler);
      window.removeEventListener('appinstalled', handler);
    };
  }, [nativeRuntime]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  const secureOrigin = useMemo(
    () => window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location.hostname),
    [],
  );
  const publicUrl = useMemo(() => String(import.meta.env.VITE_PUBLIC_APP_URL || `${window.location.origin}/`), []);
  const apkUrl = String(import.meta.env.VITE_ANDROID_APK_URL || '').trim();
  const playStoreUrl = String(import.meta.env.VITE_PLAY_STORE_URL || '').trim();
  const current = DEVICES.find((item) => item.id === device) ?? DEVICES[0];

  if (!isOpen || !current) return null;

  const install = (): void => {
    if (installed || nativeRuntime) return;
    if (deferredPrompt && onTriggerInstall) onTriggerInstall();
  };

  const copyUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const refreshPwa = async (): Promise<void> => {
    if (nativeRuntime) return;
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
    window.location.reload();
  };

  const resetPwa = async (): Promise<void> => {
    if (nativeRuntime) return;
    if (!window.confirm('Remover caches do Orbit e recarregar? Seus projetos salvos localmente não serão apagados.')) return;
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    window.location.reload();
  };

  const canPrompt = Boolean(deferredPrompt && onTriggerInstall);

  return (
    <div
      className="orbidoc-install-overlay fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orbit-install-title"
    >
      <div className="orbidoc-keyboard-safe-panel relative w-full max-w-5xl bg-white dark:bg-[#0F0F11] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#27272A] overflow-hidden flex flex-col max-h-[94dvh]">
        <header className="p-4 sm:p-5 flex items-center gap-3 border-b border-slate-200 dark:border-[#27272A] shrink-0">
          <OrbiDocLogo size="md" showText={false} />
          <div className="min-w-0 flex-1">
            <h2 id="orbit-install-title" className="text-lg sm:text-xl font-black">Instalar Orbit</h2>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">O mesmo Orbispace no navegador, PWA e Android.</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-[#09090B] border-b border-slate-200 dark:border-[#27272A] flex flex-wrap gap-2 text-[9px] font-bold shrink-0">
          {nativeRuntime ? (
            <Status ok icon={<CheckCircle2 className="w-3.5 h-3.5" />} text="Orbit Android ativo" />
          ) : (
            <>
              <Status ok={secureOrigin} icon={<Shield className="w-3.5 h-3.5" />} text={`HTTPS ${secureOrigin ? 'OK' : 'necessário'}`} />
              <Status ok={swReady} icon={<RefreshCw className="w-3.5 h-3.5" />} text={`Service Worker ${swReady ? 'ativo' : 'aguardando'}`} />
              <Status ok={installed} neutral={!installed} icon={<CheckCircle2 className="w-3.5 h-3.5" />} text={installed ? 'Orbit instalado' : 'Executando na web'} />
            </>
          )}
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {DEVICES.map((item) => {
              const Icon = item.icon;
              const selected = item.id === device;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDevice(item.id)}
                  className={`rounded-2xl border p-3 text-left flex items-center gap-3 transition ${selected ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? 'bg-[#7C3AED] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black">{item.label}</div>
                    <div className="mt-0.5 text-[9px] text-slate-400">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="mt-5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#09090B] border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <current.icon className="w-5 h-5 text-violet-600 dark:text-violet-300" />
              <div><div className="text-sm font-black">{current.label}</div><div className="text-[9px] text-slate-400">{current.subtitle}</div></div>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {device === 'android' ? (
                <>
                  <PrimaryInstall installed={nativeRuntime || installed} canPrompt={canPrompt} onInstall={install} />
                  <div className="grid md:grid-cols-2 gap-3">
                    <Info title="App Android" text="Orbit usa o shell Capacitor local-first. OrbiDoc, OCR e ferramentas locais ficam empacotados; Nexus AI usa o mesmo backend seguro da versão Web." />
                    <Info title="PWA" text="Alternativa instalável pelo Chrome, compartilhando o mesmo Orbispace e a mesma identidade visual." />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!nativeRuntime && apkUrl ? (
                      <button type="button" onClick={() => window.open(apkUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-3 rounded-xl bg-[#7C3AED] text-white text-[9px] font-black inline-flex items-center gap-2">
                        <Download className="w-4 h-4" /> Baixar Orbit para Android
                      </button>
                    ) : null}
                    {playStoreUrl ? (
                      <button type="button" onClick={() => window.open(playStoreUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Abrir na Play Store
                      </button>
                    ) : (
                      <span className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center text-[9px] font-bold text-slate-400">Play Store ainda não publicada</span>
                    )}
                  </div>
                </>
              ) : device === 'ios' ? (
                installed
                  ? <PrimaryInstall installed canPrompt={false} onInstall={() => undefined} />
                  : <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-4 text-[10px] leading-relaxed">Abra <strong>{publicUrl}</strong> no Safari → Compartilhar → <strong>Adicionar à Tela de Início</strong>.</div>
              ) : device === 'web' ? (
                <div className="space-y-3">
                  <Info title="Orbit Web" text={publicUrl} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copyUrl()} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">{copied ? 'URL copiada' : 'Copiar URL'}</button>
                    <button type="button" onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-3 rounded-xl bg-[#7C3AED] text-white text-[9px] font-black inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir Orbit Web</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <PrimaryInstall installed={installed} canPrompt={canPrompt} onInstall={install} />
                  <div className="grid md:grid-cols-3 gap-3">
                    <Info title="Janela própria" text="Modo standalone com menos chrome do navegador e mais área útil para o Orbispace." />
                    <Info title="Arquivos" text="Em Chromium compatível, Orbit pode registrar tipos de arquivo associados ao OrbiDoc." />
                    <Info title="Atualizações" text="A PWA recebe os assets publicados sem reinstalação manual." />
                  </div>
                </div>
              )}
            </div>
          </section>

          {!nativeRuntime ? (
            <section className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1"><div className="text-[10px] font-black">Diagnóstico da PWA</div><div className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">Atualize primeiro; limpe caches apenas se uma instalação antiga continuar exibindo assets obsoletos.</div></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void refreshPwa()} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Atualizar</button>
                <button type="button" onClick={() => void resetPwa()} className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[9px] font-black">Resetar cache</button>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
};
