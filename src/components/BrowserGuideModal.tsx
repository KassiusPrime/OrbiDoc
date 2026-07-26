import React, { useState, useEffect } from 'react';
import { 
  Download, Monitor, Smartphone, Globe, CheckCircle2, AlertTriangle, 
  X, RefreshCw, Lock, ExternalLink, Shield, Sparkles, HelpCircle, Laptop
} from 'lucide-react';
import { DocSwissLogo } from './DocSwissLogo';

interface BrowserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onTriggerInstall?: () => void;
}

export const BrowserGuideModal: React.FC<BrowserGuideModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall,
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'chrome' | 'safari' | 'android' | 'troubleshoot'>('pwa');
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <DocSwissLogo size="md" showText={false} />
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Guia do Navegador & Instalação PWA
                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  DocSwiss Pro
                </span>
              </h2>
              <p className="text-xs text-slate-300">Como instalar no computador/celular e corrigir inicialização de atalhos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Install Banner */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-emerald-200">
                {isInstalled ? 'App DocSwiss Instalado e Ativo!' : 'Instalar aplicativo completo no seu dispositivo'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isInstalled 
                  ? 'Você já está rodando a versão PWA instalada em modo janela.' 
                  : 'Instale como aplicativo nativo para ter atalho na área de trabalho e suporte offline completo.'}
              </p>
            </div>
          </div>

          {!isInstalled && deferredPrompt && onTriggerInstall && (
            <button
              onClick={onTriggerInstall}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm shadow-md transition-all shrink-0 flex items-center gap-2 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Instalar Agora
            </button>
          )}
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto">
          {[
            { id: 'pwa', label: 'Modo Aplicativo PWA', icon: Laptop },
            { id: 'chrome', label: 'Chrome / Edge', icon: Monitor },
            { id: 'safari', label: 'iOS / Safari', icon: Smartphone },
            { id: 'android', label: 'Android', icon: Smartphone },
            { id: 'troubleshoot', label: 'Solução de Erros de Atalho', icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-700 dark:text-slate-300 text-sm">
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                Por que usar o DocSwiss como Aplicativo PWA?
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                O DocSwiss é um Progressive Web App (PWA) de última geração. Isso significa que ele se comporta como um programa nativo instalado no Windows, Mac, Android ou iPhone sem precisar de loja de aplicativos.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Janela Independente
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Abre sem barras do navegador, em tela cheia com ícone exclusivo na barra de tarefas ou área de trabalho.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Execução Offline Integrada
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    O Service Worker armazena em cache todos os editores de texto, planilhas, OCR e ferramentas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chrome' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Instruções para Google Chrome & Microsoft Edge (PC / Mac)
              </h3>
              <ol className="list-decimal list-inside space-y-3 pl-1 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Ícone na barra de endereço:</strong> Olhe para o lado direito da barra de URLs do navegador e clique no ícone de monitor com uma seta para baixo <Download className="w-3.5 h-3.5 inline text-emerald-500" /> "Instalar DocSwiss".
                </li>
                <li>
                  <strong>Pelo menu do navegador:</strong> Clique nos 3 pontos verticais <span className="font-bold">⋮</span> no canto superior direito &rarr; selecione <span className="font-semibold">"Salvar e Compartilhar"</span> ou <span className="font-semibold">"Instalar aplicativo"</span> &rarr; <span className="font-semibold">"Instalar DocSwiss"</span>.
                </li>
                <li>
                  <strong>Permitir Login Google & Popups:</strong> Se a janela de login do Google não abrir, clique no ícone de cadeado <Lock className="w-3.5 h-3.5 inline text-amber-500" /> na barra de endereço &rarr; clique em <span className="font-semibold">"Configurações do site"</span> &rarr; mude <span className="font-semibold">"Pop-ups e redirecionamentos"</span> para <span className="text-emerald-600 dark:text-emerald-400 font-bold">"Permitir"</span>.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'safari' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Instruções para iPhone & iPad (Safari iOS)
              </h3>
              <ol className="list-decimal list-inside space-y-3 pl-1 text-slate-600 dark:text-slate-300">
                <li>
                  Abra este site utilizando o navegador <strong>Safari</strong> no seu iPhone ou iPad.
                </li>
                <li>
                  Toque no botão <strong>Compartilhar</strong> (o quadrado com uma seta apontando para cima localizado no menu inferior).
                </li>
                <li>
                  Role as opções para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                </li>
                <li>
                  Confirme tocando em <strong>"Adicionar"</strong> no canto superior direito. O ícone oficial do DocSwiss será criado na sua tela inicial!
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Instruções para Celular Android (Chrome)
              </h3>
              <ol className="list-decimal list-inside space-y-3 pl-1 text-slate-600 dark:text-slate-300">
                <li>
                  Abra o site no <strong>Google Chrome</strong> do seu celular.
                </li>
                <li>
                  Toque nos 3 pontos <span className="font-bold">⋮</span> no canto superior direito do navegador.
                </li>
                <li>
                  Selecione a opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </li>
                <li>
                  Siga a confirmação na tela para salvar o aplicativo nativo na sua gaveta de apps.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'troubleshoot' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                O atalho não carrega o aplicativo ou fica em branco?
              </h3>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Causa: Atalho antigo apontando para cache expirado do PWA ou bloqueio de scripts.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Siga os passos abaixo para reativar o aplicativo e recarregar os arquivos e ícones:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">1. Recarregar Service Worker:</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Pressione <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px]">Ctrl + F5</kbd> (Windows) ou <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px]">Cmd + Shift + R</kbd> (Mac) para forçar o navegador a buscar o app do servidor.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">2. Remover e Reinstalar Atalho:</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Exclua o atalho antigo da área de trabalho, abra o link principal da aplicação e crie um novo atalho usando a opção "Instalar DocSwiss".
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then((registrations) => {
                          for (const registration of registrations) {
                            registration.unregister();
                          }
                          window.location.reload();
                        });
                      } else {
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Limpar Cache & Recarregar Aplicativo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>DocSwiss PWA Engine v2.5 · Suporte a qualquer e-mail Google</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
