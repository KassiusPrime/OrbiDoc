import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  RefreshCw,
  Shield,
  Smartphone,
  X,
} from 'lucide-react';
import { DocPlusLogo } from './DocPlusLogo';

interface BrowserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onTriggerInstall?: () => void;
}

type TabId = 'install' | 'android' | 'package' | 'ios' | 'troubleshoot';

const CANONICAL_URL = 'https://doc-swiss.vercel.app/';

export const BrowserGuideModal: React.FC<BrowserGuideModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('install');
  const [isInstalled, setIsInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => setSwReady(Boolean(registration)));
    }
  }, [isOpen]);

  const secureOrigin = useMemo(() => window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location.hostname), []);

  if (!isOpen) return null;

  const refreshPwa = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }
    } finally {
      window.location.reload();
    }
  };

  const resetPwa = async () => {
    if (!window.confirm('Isso removerá os caches do DocSwiss neste navegador e recarregará o app. Seus arquivos salvos em localStorage não serão apagados, mas conteúdos offline em cache precisarão ser baixados novamente. Continuar?')) return;
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

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'install', label: 'Instalar', icon: Laptop },
    { id: 'android', label: 'Android / WebAPK', icon: Smartphone },
    { id: 'package', label: 'APK / AAB', icon: Download },
    { id: 'ios', label: 'iPhone / iPad', icon: Smartphone },
    { id: 'troubleshoot', label: 'Diagnóstico', icon: AlertTriangle },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        <header className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <DocPlusLogo size="md" showText={false} />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white truncate">Instalação do DocSwiss</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">PWA, WebAPK do Chrome e pacote Android TWA são caminhos diferentes.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </header>

        <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold ${secureOrigin ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}>
            {secureOrigin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} HTTPS {secureOrigin ? 'OK' : 'necessário'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold ${swReady ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
            <Shield className="w-3.5 h-3.5" /> Service Worker {swReady ? 'ativo' : 'aguardando'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><Globe className="w-3.5 h-3.5" /> Manifesto /manifest.webmanifest</span>
        </div>

        <nav className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </nav>

        <main className="p-5 sm:p-6 overflow-y-auto flex-1 text-sm text-slate-700 dark:text-slate-300">
          {activeTab === 'install' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">PWA instalada no computador ou celular</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Esta é a instalação normal pelo navegador. No desktop ela continua sendo uma PWA. No Android/Chrome, o navegador pode empacotá-la internamente como WebAPK.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info title="Sem barra do navegador" text="O modo standalone abre o DocSwiss em uma janela própria, usando o ícone e o nome do manifesto." />
                <Info title="Atualizações automáticas" text="O service worker atualiza os arquivos da aplicação sem exigir download manual de uma nova versão." />
                <Info title="Offline parcial" text="Editores e recursos armazenados no cache continuam disponíveis; serviços de IA e nuvem continuam dependentes de rede." />
              </div>

              {!isInstalled && deferredPrompt && onTriggerInstall ? (
                <button onClick={onTriggerInstall} className="h-12 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black inline-flex items-center gap-2"><Download className="w-4 h-4" /> Instalar DocSwiss agora</button>
              ) : isInstalled ? (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /><div><strong className="text-emerald-800 dark:text-emerald-200">O DocSwiss já está em modo instalado.</strong><p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">Se o ícone/nome ainda estiver antigo, atualize ou reinstale após a nova versão entrar em produção.</p></div></div>
              ) : (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 text-xs leading-relaxed">Se o botão de instalação não aparecer, abra o DocSwiss diretamente em uma aba HTTPS do Chrome/Edge. Em visualizações incorporadas ou navegadores sem evento de instalação, use o menu do navegador.</div>
              )}
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Android: PWA → WebAPK pelo Chrome</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">WebAPK é o pacote criado e administrado pelo Chrome/Google Play quando uma PWA elegível é instalada. Você não baixa esse APK do DocSwiss nem precisa de Digital Asset Links para esse fluxo.</p>
              </div>
              <ol className="space-y-3 text-sm">
                <Step n="1" text="Abra https://doc-swiss.vercel.app diretamente no Chrome do Android, fora de iframe ou navegador interno de outro app." />
                <Step n="2" text="Use “Instalar app” no menu do Chrome ou o prompt de instalação que o próprio site exibir." />
                <Step n="3" text="Confirme o nome DocSwiss e o ícone. O manifesto usa ícones separados para uso normal e maskable, evitando recorte/genericização." />
                <Step n="4" text="Depois de atualizar o manifesto/ícone, uma instalação antiga pode manter metadados em cache. Nesse caso remova a instalação antiga e instale novamente." />
              </ol>
              <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 p-4 text-xs leading-relaxed text-indigo-800 dark:text-indigo-200"><strong>Importante:</strong> “Adicionar à tela inicial” pode criar apenas um atalho em alguns navegadores. A experiência WebAPK completa depende do Chrome considerar a PWA instalável.</div>
            </div>
          )}

          {activeTab === 'package' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Gerar APK/AAB para Android</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Para um arquivo APK/AAB próprio, PWABuilder/Bubblewrap normalmente empacota o site como Trusted Web Activity (TWA). Isso é diferente do WebAPK automático do Chrome.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 font-black text-slate-900 dark:text-white">Fluxo correto</div>
                <div className="p-4 space-y-3">
                  <Step n="1" text="Gere o pacote usando a URL canônica de produção, não uma URL temporária de preview protegida." />
                  <Step n="2" text="Defina um package name estável (por exemplo app.docswiss.workspace) e gere/guarde a chave de assinatura Android." />
                  <Step n="3" text="Copie o SHA-256 do certificado de assinatura para ANDROID_SHA256_CERT_FINGERPRINT e o package para ANDROID_PACKAGE_NAME no ambiente de produção." />
                  <Step n="4" text="Faça novo deploy. O build do DocSwiss gera /.well-known/assetlinks.json automaticamente e o CI valida a estrutura." />
                  <Step n="5" text="Só depois disso a TWA consegue verificar o domínio e remover corretamente a barra do navegador." />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => window.open(`https://www.pwabuilder.com/url?url=${encodeURIComponent(CANONICAL_URL)}`, '_blank', 'noopener,noreferrer')} className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir no PWABuilder</button>
                <button onClick={() => navigator.clipboard.writeText(CANONICAL_URL)} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-700 dark:text-slate-200">Copiar URL canônica</button>
              </div>

              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 text-xs leading-relaxed text-amber-800 dark:text-amber-200"><strong>Não existe fingerprint universal:</strong> o SHA-256 depende da chave que assina seu APK/AAB. O DocSwiss agora gera assetlinks automaticamente quando esses dois valores reais são configurados.</div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">iPhone e iPad</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">iOS não usa WebAPK. A instalação é feita pelo Safari como Web App na Tela de Início.</p>
              </div>
              <ol className="space-y-3">
                <Step n="1" text="Abra o DocSwiss no Safari." />
                <Step n="2" text="Toque em Compartilhar." />
                <Step n="3" text="Escolha “Adicionar à Tela de Início” e confirme DocSwiss." />
                <Step n="4" text="O apple-touch-icon e os metadados do site são usados para a identidade visual da instalação." />
              </ol>
            </div>
          )}

          {activeTab === 'troubleshoot' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Diagnóstico de instalação</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use atualização antes de apagar caches. Reset completo fica como último recurso.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Info title="Ícone antigo/genérico" text="Confirme que a instalação aponta para a URL de produção; remova instalações antigas e reinstale após o deploy do manifesto novo." />
                <Info title="Abre com barra do navegador" text="WebAPK: verifique se foi instalado pelo Chrome. TWA/APK: verifique Digital Asset Links e certificado de assinatura." />
                <Info title="Tela branca após update" text="Primeiro atualize o service worker. Se persistir, faça reset de caches e recarregue." />
                <Info title="PWABuilder não analisa" text="Use a URL canônica pública de produção; previews protegidos por autenticação não servem como origem final do pacote." />
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={refreshPwa} className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar PWA e recarregar</button>
                <button onClick={resetPwa} className="h-11 px-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-black">Reset completo de cache</button>
              </div>
            </div>
          )}
        </main>

        <footer className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>DocSwiss · PWA offline-first · Android WebAPK / TWA preparados separadamente</span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold">Fechar</button>
        </footer>
      </div>
    </div>
  );
};

const Info: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
    <div className="font-black text-slate-900 dark:text-white text-sm">{title}</div>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{text}</p>
  </div>
);

const Step: React.FC<{ n: string; text: string }> = ({ n, text }) => (
  <li className="flex items-start gap-3 list-none">
    <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0">{n}</span>
    <span className="pt-1 text-slate-600 dark:text-slate-300 leading-relaxed">{text}</span>
  </li>
);
