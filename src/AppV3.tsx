import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconApps as Apps,
  IconChartBar as ChartBar,
  IconChevronLeft as ChevronLeft,
  IconCloud as Cloud,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconFolder as Folder,
  IconHeadphones as Headphones,
  IconHistory as History,
  IconHome as Home,
  IconMenu2 as Menu,
  IconMoon as Moon,
  IconPhoto as Photo,
  IconPresentation as Presentation,
  IconRobot as Robot,
  IconSearch as Search,
  IconSun as Sun,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { HomeDashboard } from './components/HomeDashboard';
import { ProjectsHub } from './components/ProjectsHub';
import { OfficeSuiteHub } from './components/OfficeSuiteHub';
import { DocumentEditor } from './components/DocumentEditor';
import { SpreadsheetEditor } from './components/SpreadsheetEditor';
import { PresentationEditor } from './components/PresentationEditor';
import { DesignEditor } from './components/DesignEditor';
import { OcrPreviewWorkspace } from './components/OcrPreviewWorkspace';
import { ImageGeneratorStudio } from './components/ImageGeneratorStudio';
import { AiWorkspace, AiModelOption } from './components/AiWorkspace';
import { AudioWorkspace } from './components/AudioWorkspace';
import { AnalyticsWorkspace } from './components/AnalyticsWorkspace';
import { CloudWorkspace } from './components/CloudWorkspace';
import { HistoryVault } from './components/HistoryVault';
import { BrowserGuideModal } from './components/BrowserGuideModal';
import { OrbiDocLogo } from './components/OrbiDocLogo';
import { GoogleProfileBadge } from './components/GoogleProfileBadge';
import { getStoredGoogleUser } from './services/googleAuthDrive';
import { getStoredMicrosoftUser } from './services/microsoftAuthOffice';
import { convertFile } from './lib/fileConversion';
import {
  ChatSession,
  GoogleUserProfile,
  HistoryItem,
  MicrosoftUserProfile,
  OcrItem,
  SavedProject,
  TabType,
} from './types';

type AppView = TabType | 'cloud';
type Notice = { message: string; type: 'success' | 'error' } | null;

const PROJECTS_KEY = 'orbidoc_projects_v1';
const HISTORY_KEY = 'orbidoc_history_v2';
const THEME_KEY = 'orbidoc_theme_v2';
const MODEL_KEY = 'orbidoc_ai_model_v2';

const PROJECT_EDITORS = new Set<AppView>(['word', 'excel', 'powerpoint', 'canva', 'extract']);

const readProjects = (): SavedProject[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readHistory = (): HistoryItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const projectTitle = (type: SavedProject['type']) => {
  const labels: Record<SavedProject['type'], string> = {
    word: 'Novo documento',
    excel: 'Nova planilha',
    powerpoint: 'Nova apresentação',
    canva: 'Novo design',
    extract: 'Novo PDF / OCR',
    chat: 'Nova conversa',
  };
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${labels[type]} · ${time}`;
};

const createProjectRecord = (type: SavedProject['type'], content?: unknown): SavedProject => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: projectTitle(type),
    type,
    createdAt: now,
    updatedAt: now,
    previewSnippet: 'Criado no workspace OrbiDoc.',
    tags: [],
    content,
  };
};

const toProjectType = (view: AppView): SavedProject['type'] | null => {
  if (view === 'word' || view === 'excel' || view === 'powerpoint' || view === 'canva' || view === 'extract') return view;
  return null;
};

const NAV_ITEMS: Array<{ id: AppView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'projects', label: 'Meus arquivos', icon: Folder },
  { id: 'office', label: 'Apps & converter', icon: Apps },
  { id: 'cloud', label: 'Nuvem', icon: Cloud },
  { id: 'chat', label: 'Assistente IA', icon: Robot },
  { id: 'image', label: 'Imagens IA', icon: Photo },
  { id: 'audio', label: 'Áudio', icon: Headphones },
  { id: 'analytics', label: 'Analytics', icon: ChartBar },
  { id: 'history', label: 'Histórico', icon: History },
];

const APP_SHORTCUTS: Array<{ id: AppView; label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = [
  { id: 'word', label: 'Documentos', icon: FileText, className: 'text-blue-600' },
  { id: 'excel', label: 'Planilhas', icon: FileSpreadsheet, className: 'text-emerald-600' },
  { id: 'powerpoint', label: 'Apresentações', icon: Presentation, className: 'text-orange-600' },
  { id: 'canva', label: 'Design', icon: Apps, className: 'text-fuchsia-600' },
  { id: 'extract', label: 'PDF & OCR', icon: FileCheck, className: 'text-cyan-600' },
];

const VIEW_LABELS: Record<string, string> = {
  home: 'Início', projects: 'Meus arquivos', office: 'Apps & conversor', cloud: 'Nuvem', chat: 'Assistente IA', image: 'Imagens IA',
  audio: 'Áudio', analytics: 'Analytics', history: 'Histórico', word: 'Documentos', excel: 'Planilhas', powerpoint: 'Apresentações',
  canva: 'Design', extract: 'PDF & OCR', ai: 'Assistente IA', compare: 'Arena',
};

export default function AppV3() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<SavedProject[]>(readProjects);
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [microsoftUser, setMicrosoftUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [selectedModelKey, setSelectedModelKey] = useState(() => localStorage.getItem(MODEL_KEY) || 'gemini:gemini-3.6-flash');
  const [modelCatalog, setModelCatalog] = useState<AiModelOption[]>([]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3600);
  }, []);

  const refreshProjects = useCallback(() => setProjects(readProjects()), []);

  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 250)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const onProjectEvent = () => refreshProjects();
    const onFocus = () => refreshProjects();
    window.addEventListener('orbidoc:projects-updated', onProjectEvent);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('orbidoc:projects-updated', onProjectEvent);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshProjects]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    const onInstalled = () => { setDeferredPrompt(null); showNotification('OrbiDoc instalado no dispositivo.', 'success'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [showNotification]);

  useEffect(() => {
    fetch('/api/ai/models')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('models unavailable')))
      .then((data) => {
        if (!Array.isArray(data.models)) return;
        const enabled = (data.models as AiModelOption[]).filter((model) => model.enabled);
        setModelCatalog(enabled);
        if (!enabled.length) return;
        if (!enabled.some((model) => `${model.provider}:${model.id}` === selectedModelKey)) {
          const next = enabled.find((model) => model.recommended) || enabled[0];
          const key = `${next.provider}:${next.id}`;
          setSelectedModelKey(key);
          localStorage.setItem(MODEL_KEY, key);
        }
      })
      .catch(() => setModelCatalog([]));
  }, []);

  const selectedModel = useMemo<AiModelOption>(() => {
    const found = modelCatalog.find((model) => `${model.provider}:${model.id}` === selectedModelKey);
    if (found) return found;
    const separator = selectedModelKey.indexOf(':');
    const provider = separator > 0 ? selectedModelKey.slice(0, separator) : 'gemini';
    const id = separator > 0 ? selectedModelKey.slice(separator + 1) : 'gemini-3.6-flash';
    return { provider, id, label: id, enabled: true };
  }, [modelCatalog, selectedModelKey]);

  const persistProject = useCallback((project: SavedProject) => {
    setProjects((current) => {
      const exists = current.some((item) => item.id === project.id);
      return exists ? current.map((item) => item.id === project.id ? project : item) : [project, ...current];
    });
    setActiveProject((current) => current?.id === project.id ? project : current);
  }, []);

  const createProject = useCallback((type: SavedProject['type'], content?: unknown) => {
    const project = createProjectRecord(type, content);
    persistProject(project);
    setActiveProject(project);
    setView(type as AppView);
    setMenuOpen(false);
    return project;
  }, [persistProject]);

  const openProject = useCallback((project: SavedProject) => {
    setActiveProject(project);
    setView(project.type === 'chat' ? 'chat' : project.type as AppView);
    setMenuOpen(false);
  }, []);

  const navigate = useCallback((target: TabType) => {
    const projectType = toProjectType(target);
    if (projectType) {
      if (!activeProject || activeProject.type !== projectType) createProject(projectType);
      else setView(target);
    } else {
      setView(target);
      if (target === 'home' || target === 'projects' || target === 'analytics') refreshProjects();
    }
    setMenuOpen(false);
  }, [activeProject, createProject, refreshProjects]);

  const changeView = useCallback((target: AppView) => {
    if (target === 'cloud') { setView('cloud'); setMenuOpen(false); return; }
    navigate(target as TabType);
  }, [navigate]);

  const saveHistory = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const record: HistoryItem = { ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    setHistory((current) => [record, ...current].slice(0, 250));
  }, []);

  const sendToDocument = useCallback((text: string) => {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = escaped.split(/\r?\n/).map((line) => line.trim() ? `<p>${line}</p>` : '<p><br></p>').join('');
    const project = createProject('word', html);
    const updated = { ...project, title: 'Documento da IA', content: html, previewSnippet: text.slice(0, 180), updatedAt: new Date().toISOString() };
    persistProject(updated);
    setActiveProject(updated);
    setView('word');
    showNotification('Conteúdo aberto em Documentos.', 'success');
  }, [createProject, persistProject, showNotification]);

  const changeModel = (key: string) => {
    setSelectedModelKey(key);
    localStorage.setItem(MODEL_KEY, key);
  };

  const exportOcrText = async (text: string, name: string, format: 'txt' | 'docx' | 'pdf' | 'html') => {
    try {
      const source = new File([text], `${name || 'documento'}.txt`, { type: 'text/plain' });
      if (format === 'txt') {
        saveAs(source, source.name);
        return;
      }
      const result = await convertFile(source, format);
      saveAs(result.blob, result.fileName);
      showNotification(result.warnings[0] || `Exportado como ${format.toUpperCase()}.`, result.warnings.length ? 'error' : 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na exportação.', 'error');
    }
  };

  const triggerInstall = async () => {
    if (!deferredPrompt) { setInstallGuideOpen(true); return; }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const recentProjects = useMemo(() => projects.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8), [projects]);
  const activeTitle = PROJECT_EDITORS.has(view) && activeProject ? activeProject.title : VIEW_LABELS[view] || 'OrbiDoc';
  const filteredShortcuts = search.trim() ? APP_SHORTCUTS.filter((item) => item.label.toLowerCase().includes(search.toLowerCase())) : [];
  const editorView = PROJECT_EDITORS.has(view) || view === 'chat' || view === 'image';

  const ensureActiveProject = (type: SavedProject['type']) => {
    if (activeProject?.type === type) return activeProject;
    const latest = projects.filter((project) => project.type === type).slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    if (latest) return latest;
    return createProjectRecord(type);
  };

  const renderContent = () => {
    if (view === 'home') return <HomeDashboard onNavigate={navigate} onNewChat={() => setView('chat')} recentHistory={history.slice(0, 6)} recentProjects={recentProjects} recentChats={[] as ChatSession[]} googleUser={googleUser} microsoftUser={microsoftUser} activeEngineLabel={selectedModel.label} />;
    if (view === 'projects') return <ProjectsHub onOpenProject={openProject} onCreateNewProject={(type) => createProject(type)} showNotification={showNotification} />;
    if (view === 'office') return <OfficeSuiteHub onSelectTool={navigate} onOpenTool={navigate} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
    if (view === 'cloud') return <CloudWorkspace googleUser={googleUser} microsoftUser={microsoftUser} showNotification={showNotification} />;

    if (view === 'word') {
      const project = ensureActiveProject('word');
      return <DocumentEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    }
    if (view === 'excel') {
      const project = ensureActiveProject('excel');
      return <SpreadsheetEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    }
    if (view === 'powerpoint') {
      const project = ensureActiveProject('powerpoint');
      return <PresentationEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    }
    if (view === 'canva') {
      const project = ensureActiveProject('canva');
      return <DesignEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    }
    if (view === 'extract') {
      return <OcrPreviewWorkspace items={ocrItems} setItems={setOcrItems} onSaveToHistory={(title, summary, details, tags) => saveHistory({ type: 'ocr', title, summary, details, tags })} onSendToChat={(text) => { navigator.clipboard.writeText(text).catch(() => {}); setView('chat'); showNotification('Texto copiado. Cole no chat ou anexe o arquivo original.', 'success'); }} onSendToAiText={sendToDocument} showNotification={showNotification} exportAsTxt={(text, name) => exportOcrText(text, name, 'txt')} exportAsDocx={(text, name) => exportOcrText(text, name, 'docx')} exportAsPdf={(text, name) => exportOcrText(text, name, 'pdf')} exportAsMd={(text, name) => saveAs(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${name}.md`)} />;
    }
    if (view === 'chat' || view === 'ai' || view === 'compare') return <AiWorkspace selectedModelKey={selectedModelKey} onSelectedModelChange={changeModel} onSendToWord={sendToDocument} showNotification={showNotification} />;
    if (view === 'image') return <ImageGeneratorStudio onSaveToHistory={saveHistory} showNotification={showNotification} onSendToCanva={() => changeView('canva')} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    if (view === 'audio') return <AudioWorkspace showNotification={showNotification} onSaveToHistory={saveHistory} onSendToWord={sendToDocument} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    if (view === 'analytics') return <AnalyticsWorkspace projects={projects} history={history} />;
    if (view === 'history') return <HistoryVault items={history} onClearAll={() => { if (window.confirm('Apagar todo o histórico local?')) setHistory([]); }} onDeleteItem={(id) => setHistory((current) => current.filter((item) => item.id !== id))} onRestoreItem={(item) => {
      if (item.type === 'ocr') {
        setOcrItems((current) => [{ id: crypto.randomUUID(), fileName: item.title, fileSize: 0, text: item.details || item.summary, status: 'completed', progress: 100, timestamp: new Date().toLocaleTimeString('pt-BR'), tags: item.tags }, ...current]);
        setView('extract');
      } else if (item.type === 'chat' || item.type === 'ai' || item.type === 'compare') setView('chat');
      else if (item.type === 'image') setView('image');
      else if (item.type === 'audio') setView('audio');
      else if (item.type === 'word' && item.details) sendToDocument(item.details);
      else if (item.type === 'excel') setView('excel');
      else if (item.type === 'powerpoint') setView('powerpoint');
      else if (item.type === 'canva') setView('canva');
    }} onCopyText={(text) => navigator.clipboard.writeText(text)} />;
    return <OfficeSuiteHub onSelectTool={navigate} onOpenTool={navigate} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
  };

  return (
    <div className="h-dvh min-h-[560px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden flex">
      <aside className="hidden lg:flex w-[252px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col">
        <div className="h-16 px-4 flex items-center border-b border-slate-100 dark:border-slate-800"><button onClick={() => changeView('home')}><OrbiDocLogo size="md" /></button></div>
        <div className="p-3 flex-1 overflow-y-auto">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => { const Icon = item.icon; const active = view === item.id || (item.id === 'chat' && (view === 'ai' || view === 'compare')); return <button key={item.id} onClick={() => changeView(item.id)} className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-xs font-bold ${active ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}
          </nav>
          <div className="mt-5 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Criar</div>
          <div className="mt-2 space-y-1">{APP_SHORTCUTS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeView(item.id)} className={`w-full h-9 px-3 rounded-xl flex items-center gap-3 text-[11px] font-bold ${view === item.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><Icon className={`w-4 h-4 ${item.className}`} />{item.label}</button>; })}</div>
        </div>
        <div className="p-3 border-t border-slate-100 dark:border-slate-800"><button onClick={() => setInstallGuideOpen(true)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><div className="text-xs font-black">Instalar OrbiDoc</div><div className="text-[10px] text-slate-500 mt-0.5">PWA · WebAPK · APK/AAB</div></button></div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 flex items-center gap-3 z-30">
          <button onClick={() => setMenuOpen(true)} className="lg:hidden w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><Menu className="w-5 h-5" /></button>
          {editorView && <button onClick={() => changeView('projects')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Voltar aos arquivos"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="min-w-0"><div className="text-sm font-black truncate">{activeTitle}</div><div className="text-[10px] text-slate-400 hidden sm:block">{PROJECT_EDITORS.has(view) && activeProject ? 'Projeto local · autosave por arquivo' : online ? 'Online' : 'Modo offline'}</div></div>

          <div className="relative ml-auto hidden md:block w-[250px] xl:w-[350px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aplicativo…" className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-transparent focus:border-indigo-300 dark:focus:border-indigo-800 text-xs outline-none" />
            {filteredShortcuts.length > 0 && <div className="absolute top-11 inset-x-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 z-50">{filteredShortcuts.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { changeView(item.id); setSearch(''); }} className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-bold flex items-center gap-2"><Icon className={`w-4 h-4 ${item.className}`} />{item.label}</button>; })}</div>}
          </div>

          <span className={`hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-full text-[10px] font-black ${online ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'}`}>{online ? 'Online' : 'Offline'}</span>
          <button onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          <GoogleProfileBadge user={googleUser} onUserChange={setGoogleUser} msUser={microsoftUser} setMsUser={setMicrosoftUser} onNotification={showNotification} />
        </header>

        <main className={`flex-1 min-h-0 overflow-y-auto ${view === 'chat' || view === 'ai' || view === 'compare' ? 'p-2 sm:p-3' : 'p-3 sm:p-5 lg:p-6'} pb-24 lg:pb-6`}>
          <div className={view === 'chat' || view === 'ai' || view === 'compare' ? '' : 'max-w-[1600px] mx-auto'}>{renderContent()}</div>
        </main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-[68px] border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-around">
          {[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[4]].map((item) => { const Icon = item.icon; const active = view === item.id || (item.id === 'chat' && (view === 'ai' || view === 'compare')); return <button key={item.id} onClick={() => changeView(item.id)} className={`min-w-[54px] h-12 rounded-xl flex flex-col items-center justify-center gap-1 text-[9px] font-bold ${active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' : 'text-slate-500 dark:text-slate-400'}`}><Icon className="w-5 h-5" />{item.label === 'Apps & converter' ? 'Apps' : item.label === 'Meus arquivos' ? 'Arquivos' : item.label}</button>; })}
        </nav>
      </div>

      {menuOpen && <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/50" onClick={() => setMenuOpen(false)}><aside className="w-[300px] max-w-[88vw] h-full bg-white dark:bg-slate-900 shadow-2xl p-3 overflow-y-auto" onClick={(event) => event.stopPropagation()}><div className="h-14 flex items-center justify-between px-2"><OrbiDocLogo size="md" /><button onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button></div><nav className="mt-3 space-y-1">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeView(item.id)} className="w-full h-11 px-3 rounded-xl flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon className="w-4 h-4" />{item.label}</button>; })}</nav><div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1">{APP_SHORTCUTS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeView(item.id)} className="w-full h-10 px-3 rounded-xl flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><Icon className={`w-4 h-4 ${item.className}`} />{item.label}</button>; })}</div><button onClick={() => { setInstallGuideOpen(true); setMenuOpen(false); }} className="mt-5 w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-black">Instalar / Android</button></aside></div>}

      <BrowserGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} deferredPrompt={deferredPrompt} onTriggerInstall={triggerInstall} />
      {notice && <div className={`fixed z-[90] top-4 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-white'}`}>{notice.message}</div>}
    </div>
  );
}
