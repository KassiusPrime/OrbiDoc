import React, { useEffect, useState } from 'react';
import { IconFile, IconMenu2, IconMoon, IconRobot, IconSun, IconX } from '@tabler/icons-react';
import { AiWorkspace } from './components/AiWorkspace';
import { BottomNavBar } from './components/BottomNavBar';
import { BrowserGuideModal } from './components/BrowserGuideModal';
import { OrbiDocLogo } from './components/OrbiDocLogo';
import { ReaderWorkspace } from './components/ReaderWorkspace';
import { CopilotShell } from './components/CopilotShell';
import { GoogleProfileBadge } from './components/GoogleProfileBadge';
import { getStoredGoogleUser } from './services/googleAuthDrive';
import { getStoredMicrosoftUser } from './services/microsoftAuthOffice';
import type { GoogleUserProfile, MicrosoftUserProfile, TabType } from './types';

type View = 'reader' | 'chat';
type ThemeMode = 'light' | 'dark';
type Notice = { message: string; type: 'success' | 'error' } | null;

const THEME_KEY = 'orbit_theme_v1';

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export default function AppV5() {
  const [view, setView] = useState<View>('reader');
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [microsoftUser, setMicrosoftUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3600);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onNavigateChat = () => setView('chat');
    window.addEventListener('orbit:navigate-chat', onNavigateChat);
    return () => window.removeEventListener('orbit:navigate-chat', onNavigateChat);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);

  const navigate = (target: TabType | View) => {
    setView(target === 'chat' || target === 'ai' ? 'chat' : 'reader');
    setMenuOpen(false);
  };

  return (
    <div className="h-dvh min-h-[560px] bg-slate-50 dark:bg-[#09090B] text-slate-900 dark:text-slate-100 overflow-hidden flex">
      <aside className="hidden lg:flex w-[232px] shrink-0 border-r border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11] flex-col">
        <div className="h-[68px] px-[18px] flex items-center border-b border-slate-100 dark:border-[#27272A]">
          <button type="button" onClick={() => navigate('reader')} aria-label="Abrir leitor"><OrbiDocLogo size="md" /></button>
        </div>
        <nav className="p-3 space-y-1">
          <button type="button" onClick={() => navigate('reader')} className={`w-full h-10 px-3 rounded-lg flex items-center gap-3 text-xs font-medium ${view === 'reader' ? 'bg-white/[0.05] text-slate-100' : 'text-slate-500 hover:bg-white/[0.04]'}`}>
            <IconFile className="w-4 h-4" /> Leitor
          </button>
          <button type="button" onClick={() => navigate('chat')} className={`w-full h-10 px-3 rounded-lg flex items-center gap-3 text-xs font-medium ${view === 'chat' ? 'bg-violet-500/8 text-violet-300' : 'text-slate-500 hover:bg-white/[0.04]'}`}>
            <IconRobot className="w-4 h-4" /> Nexus AI
          </button>
        </nav>
        <div className="mt-auto p-3 border-t border-slate-100 dark:border-[#27272A]">
          <button type="button" onClick={() => setInstallGuideOpen(true)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
            <div className="text-xs font-medium">Instalar Orbit</div>
            <div className="text-[10px] text-slate-500 mt-0.5">PWA · Android · Desktop</div>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11] px-3 sm:px-4 flex items-center gap-2 z-30">
          <button type="button" onClick={() => setMenuOpen(true)} className="lg:hidden w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Abrir menu"><IconMenu2 className="w-5 h-5" /></button>
          <div className="min-w-0"><div className="text-sm font-medium">{view === 'reader' ? 'Leitor' : 'Nexus AI'}</div><div className="text-[10px] text-slate-400 hidden sm:block">{online ? 'Local · WebLLM / Ollama' : 'Offline · leitura local disponível'}</div></div>
          <span className="ml-auto hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">{online ? 'Online' : 'Offline'}</span>
          <button type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Alternar tema">{theme === 'dark' ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}</button>
          <GoogleProfileBadge user={googleUser} onUserChange={setGoogleUser} msUser={microsoftUser} setMsUser={setMicrosoftUser} onNotification={showNotification} />
        </header>

        <main className={`flex-1 min-h-0 overflow-y-auto pb-20 lg:pb-4 ${view === 'chat' ? 'p-2 sm:p-3' : 'p-3 sm:p-5 lg:p-6'}`}>
          {view === 'reader' ? <ReaderWorkspace /> : <CopilotShell title="Nexus AI" contextTitle="Contexto do leitor" contextItems={[]} onContextSelect={() => {}}><AiWorkspace showNotification={showNotification} /></CopilotShell>}
        </main>

        <BottomNavBar activeTab={view === 'chat' ? 'chat' : 'projects'} onNavigate={navigate} />
      </div>

      {menuOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <aside className="w-[304px] max-w-[88vw] h-full bg-white dark:bg-[#0F0F11] shadow-2xl p-3" onClick={(event) => event.stopPropagation()}>
            <div className="h-14 flex items-center justify-between px-2"><OrbiDocLogo size="md" /><button type="button" onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar menu"><IconX className="w-5 h-5" /></button></div>
            <button type="button" onClick={() => navigate('reader')} className="mt-4 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-left px-3"><IconFile className="inline mr-2 h-4 w-4" />Leitor</button>
            <button type="button" onClick={() => navigate('chat')} className="mt-2 w-full h-11 rounded-xl border border-violet-500/30 text-violet-300 text-xs font-bold text-left px-3"><IconRobot className="inline mr-2 h-4 w-4" />Nexus AI</button>
            <button type="button" onClick={() => { setInstallGuideOpen(true); setMenuOpen(false); }} className="mt-6 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">Instalar Orbit</button>
          </aside>
        </div>
      ) : null}

      <BrowserGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} deferredPrompt={deferredPrompt} onTriggerInstall={async () => {
        if (!deferredPrompt) return;
        try { await deferredPrompt.prompt(); } finally { setDeferredPrompt(null); }
      }} />

      {notice ? <div role={notice.type === 'error' ? 'alert' : 'status'} className={`fixed z-[90] top-4 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-white'}`}>{notice.message}</div> : null}
    </div>
  );
}
