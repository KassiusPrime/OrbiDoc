import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
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
import { detectInstallDevice, isStandaloneInstalled, type OrbiDocInstallDevice } from '../lib/pwaInstall';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import { OrbiDocLogo } from './OrbiDocLogo';

interface BrowserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onTriggerInstall?: () => void;
}

type DeviceCard = {
  id: OrbiDocInstallDevice;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DEVICES: DeviceCard[] = [
  { id: 'android', label: 'Android', subtitle: 'App nativo / PWA / Play Store', icon: Smartphone },
  { id: 'ios', label: 'iPhone / iPad', subtitle: 'Web App pelo Safari', icon: TabletSmartphone },
  { id: 'windows', label: 'Windows', subtitle: 'PWA desktop', icon: Monitor },
  { id: 'mac', label: 'macOS', subtitle: 'PWA desktop', icon: Laptop },
  { id: 'linux', label: 'Linux', subtitle: 'PWA desktop', icon: Monitor },
  { id: 'web', label: 'Web', subtitle: 'Usar no navegador', icon: Globe },
];

export const BrowserGuideModal: React.FC<BrowserGuideModalProps> = ({ isOpen, onClose, deferredPrompt, onTriggerInstall }) => {
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((registration) => setSwReady(Boolean(registration)));
  }, [isOpen, nativeRuntime]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ installed?: boolean }>).detail;
      if (nativeRuntime) {
        setInstalled(true);
        return;
      }
      if (detail?.installed !== undefined) setInstalled(Boolean(detail.installed));
      else setInstalled(isStandaloneInstalled());
    };
    window.addEventListener('orbidoc:install-state', handler);
    window.addEventListener('appinstalled', handler);
    return () => {
      window.removeEventListener('orbidoc:install-state', handler);
      window.removeEventListener('appinstalled', handler);
    };
  }, [nativeRuntime]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  const secureOrigin = useMemo(() => window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location.hostname), []);
  const publicUrl = useMemo(() => String(import.meta.env.VITE_PUBLIC_APP_URL || `${window.location.origin}/`), []);
  const apkUrl = String(import.meta.env.VITE_ANDROID_APK_URL || '').trim();
  const playStoreUrl = String(import.meta.env.VITE_PLAY_STORE_URL || '').trim();
  const current = DEVICES.find((item) => item.id === device) || DEVICES[0];

  if (!isOpen) return null;

  const install = () => {
    if (installed || nativeRuntime) return;
    if (deferredPrompt && onTriggerInstall) onTriggerInstall();
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const refreshPwa = async () => {
    if (nativeRuntime) return;
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
    window.location.reload();
  };

  const resetPwa = async () => {
    if (nativeRuntime) return;
    if (!window.confirm('Remover caches do OrbiDoc e recarregar? Seus projetos salvos localmente não serão apagados.')) return;
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

  return (
    <div className="orbidoc-install-overlay fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="orbidoc-install-title">
      <div className="orbidoc-keyboard-safe-panel relative w-full max-w-5xl bg-white dark:bg-[#101827] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94dvh]">
        <header className="p-4 sm:p-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <OrbiDocLogo size="md" showText={false} />
          <div className="min-w-0 flex-1"><h2 id="orbidoc-install-title" className="text-lg sm:text-xl font-black">Instalar OrbiDoc</h2><p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Escolha a plataforma. O Android usa um APK/AAB nativo local-first; PWA continua disponível como alternativa web.</p></div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </header>

        <div className="px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-[#080D18]/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 text-[9px] font-bold shrink-0">
          {nativeRuntime ? (
            <Status ok icon={<CheckCircle2 className="w-3.5 h-3.5" />} text="Android nativo ativo" />
          ) : (
            <>
              <Status ok={secureOrigin} icon={<Shield className="w-3.5 h-3.5" />} text={`HTTPS ${secureOrigin ? 'OK' : 'necessário'}`} />
              <Status ok={swReady} icon={<RefreshCw className="w-3.5 h-3.5" />} text={`Service Worker ${swReady ? 'ativo' : 'aguardando'}`} />
              <Status ok={installed} icon={<CheckCircle2 className="w-3.5 h-3.5" />} text={installed ? 'PWA instalada' : 'Executando na web'} neutral={!installed} />
            </>
          )}
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {DEVICES.map((item) => {
              const Icon = item.icon;
              const selected = item.id === device;
              return <button key={item.id} onClick={() => setDevice(item.id)} className={`rounded-2xl border p-3 text-left flex items-center gap-3 transition ${selected ? 'border-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/35' : 'border-slate-200 dark:border-slate-700 hover:border-[#3157F6]/35'}`}><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? 'bg-[#3157F6] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Icon className="w-5 h-5" /></div><div><div className="text-[11px] font-black">{item.label}</div><div className="mt-0.5 text-[9px] text-slate-400">{item.subtitle}</div></div></button>;
            })}
          </div>

          <section className="mt-5 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#080D18]/45 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3"><current.icon className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" /><div><div className="text-sm font-black">{current.label}</div><div className="text-[9px] text-slate-400">{current.subtitle}</div></div></div>
            <div className="p-4 sm:p-5">
              {device === 'android' && <AndroidPanel nativeRuntime={nativeRuntime} installed={installed} canPrompt={Boolean(deferredPrompt && onTriggerInstall)} onInstall={install} apkUrl={apkUrl} playStoreUrl={playStoreUrl} />}
              {device === 'ios' && <IosPanel installed={installed} publicUrl={publicUrl} />}
              {(device === 'windows' || device === 'mac' || device === 'linux') && <DesktopPanel installed={installed} canPrompt={Boolean(deferredPrompt && onTriggerInstall)} onInstall={install} device={device} />}
              {device === 'web' && <WebPanel publicUrl={publicUrl} onCopy={copyUrl} copied={copied} />}
            </div>
          </section>

          {nativeRuntime ? (
            <section className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div><div className="text-[10px] font-black text-emerald-800 dark:text-emerald-200">Runtime Android independente do site</div><div className="mt-1 text-[9px] leading-relaxed text-emerald-700 dark:text-emerald-300">O HTML, CSS, JavaScript, OCR português/inglês e ferramentas locais estão empacotados no APK. Atualizações do aplicativo vêm por um novo APK ou pela loja quando houver publicação.</div></div>
            </section>
          ) : (
            <section className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1"><div className="text-[10px] font-black">Diagnóstico da PWA</div><div className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">Atualize primeiro. Limpe caches apenas se uma instalação web antiga continuar usando ícones ou arquivos obsoletos.</div></div>
              <div className="flex flex-wrap gap-2"><button onClick={() => void refreshPwa()} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Atualizar PWA</button><button onClick={() => void resetPwa()} className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[9px] font-black">Resetar cache</button></div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

const Status: React.FC<{ ok: boolean; icon: React.ReactNode; text: string; neutral?: boolean }> = ({ ok, icon, text, neutral }) => <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${neutral ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : ok ? 'bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-300'}`}>{icon}{text}</span>;

const PrimaryInstall: React.FC<{ installed: boolean; canPrompt: boolean; onInstall: () => void }> = ({ installed, canPrompt, onInstall }) => installed ? <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/25 p-4 flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /><div><div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">OrbiDoc já está instalado</div><div className="mt-1 text-[9px] text-emerald-700 dark:text-emerald-300">Esta sessão já está executando como uma PWA instalada.</div></div></div> : canPrompt ? <button onClick={onInstall} className="h-11 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-2"><Download className="w-4 h-4" /> Instalar PWA do OrbiDoc</button> : <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-[10px] leading-relaxed text-slate-500">O navegador não ofereceu um prompt instalável nesta sessão. Use o menu do Chrome/Edge/Safari conforme as instruções da plataforma.</div>;

const AndroidPanel: React.FC<{ nativeRuntime: boolean; installed: boolean; canPrompt: boolean; onInstall: () => void; apkUrl: string; playStoreUrl: string }> = ({ nativeRuntime, installed, canPrompt, onInstall, apkUrl, playStoreUrl }) => <div className="space-y-4">
  {nativeRuntime ? (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/25 p-4 flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /><div><div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">Aplicativo Android nativo em execução</div><div className="mt-1 text-[9px] leading-relaxed text-emerald-700 dark:text-emerald-300">Esta instalação usa Capacitor e carrega o workspace diretamente dos arquivos empacotados no APK/AAB, sem depender de um domínio para iniciar.</div></div></div>
  ) : <PrimaryInstall installed={installed} canPrompt={canPrompt} onInstall={onInstall} />}

  <div className="grid md:grid-cols-2 gap-3">
    <Info title="APK / AAB nativo" text="É o caminho Android principal. O workspace local, scanner, leitor, OCR e ferramentas offline são incluídos no pacote do aplicativo." />
    <Info title="PWA / WebAPK" text="Continua como alternativa pelo Chrome. É útil para quem prefere instalar a versão web sem baixar um APK separado." />
  </div>

  {!nativeRuntime && <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 flex items-start gap-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" /><span>PWABuilder não é necessário para gerar o aplicativo Android principal. O APK/AAB do OrbiDoc é compilado pelo pipeline nativo Capacitor/Gradle.</span></div>}

  <div className="flex flex-wrap gap-2">
    {!nativeRuntime && apkUrl ? <button onClick={() => window.open(apkUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-3 rounded-xl bg-[#3157F6] text-white text-[9px] font-black inline-flex items-center gap-2"><Download className="w-4 h-4" /> Baixar APK Android</button> : null}
    {playStoreUrl ? <button onClick={() => window.open(playStoreUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir na Play Store</button> : <span className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center text-[9px] font-bold text-slate-400">Play Store ainda não publicada</span>}
  </div>
</div>;

const IosPanel: React.FC<{ installed: boolean; publicUrl: string }> = ({ installed, publicUrl }) => <div className="space-y-4">{installed ? <PrimaryInstall installed canPrompt={false} onInstall={() => {}} /> : <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-4 text-[10px] leading-relaxed">No iPhone/iPad, abra <strong>{publicUrl}</strong> no Safari → Compartilhar → <strong>Adicionar à Tela de Início</strong>. O iOS não usa o prompt `beforeinstallprompt` do Chromium.</div>}<div className="grid md:grid-cols-2 gap-3"><Info title="Web App" text="Abre sem a barra normal do navegador e usa o apple-touch-icon do OrbiDoc." /><Info title="Atualização" text="O service worker e os assets publicados continuam sendo atualizados pela web, sem baixar outro instalador." /></div></div>;

const DesktopPanel: React.FC<{ installed: boolean; canPrompt: boolean; onInstall: () => void; device: 'windows' | 'mac' | 'linux' }> = ({ installed, canPrompt, onInstall, device }) => <div className="space-y-4"><PrimaryInstall installed={installed} canPrompt={canPrompt} onInstall={onInstall} /><div className="grid md:grid-cols-3 gap-3"><Info title="Janela própria" text="O modo standalone remove a barra tradicional do navegador." /><Info title="Abrir com OrbiDoc" text="Em Chromium compatível, o manifesto registra tipos de arquivo para a PWA instalada." /><Info title="Desktop nativo" text={`A PWA é a versão desktop atual em ${device}. Um empacotamento desktop nativo pode ser adicionado depois sem alterar os projetos locais.`} /></div></div>;

const WebPanel: React.FC<{ publicUrl: string; onCopy: () => void; copied: boolean }> = ({ publicUrl, onCopy, copied }) => <div className="space-y-4"><div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4"><div className="text-[10px] font-black">Versão web</div><div className="mt-1 text-[10px] break-all text-slate-500">{publicUrl}</div></div><div className="flex flex-wrap gap-2"><button onClick={onCopy} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">{copied ? 'URL copiada' : 'Copiar URL'}</button><button onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-3 rounded-xl bg-[#3157F6] text-white text-[9px] font-black inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir versão web</button></div></div>;

const Info: React.FC<{ title: string; text: string }> = ({ title, text }) => <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3"><div className="text-[10px] font-black">{title}</div><div className="mt-1 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</div></div>;
