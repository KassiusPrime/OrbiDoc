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
import { FilesWorkspace } from './components/FilesWorkspace';
import { OfficeSuiteHub } from './components/OfficeSuiteHub';
import { DocumentEditor } from './components/DocumentEditor';
import { SpreadsheetEditor } from './components/SpreadsheetEditor';
import { PresentationEditor } from './components/PresentationEditor';
import { DesignEditor } from './components/DesignEditor';
import { PdfOcrWorkspace } from './components/PdfOcrWorkspace';
import { ImageWorkspace } from './components/ImageWorkspace';
import { AiWorkspace, AiModelOption } from './components/AiWorkspace';
import { AudioWorkspace } from './components/AudioWorkspace';
import { AnalyticsWorkspace } from './components/AnalyticsWorkspace';
import { CloudWorkspace } from './components/CloudWorkspace';
import { HistoryVault } from './components/HistoryVault';
import { BrowserGuideModal } from './components/BrowserGuideModal';
import { DocPlusLogo } from './components/DocPlusLogo';
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
type ThemeMode = 'light' | 'dark';

const PROJECTS_KEY = 'docswiss_projects_v1';
const HISTORY_KEY = 'docswiss_history_v2';
const THEME_KEY = 'docswiss_theme_v2';
const MODEL_KEY = 'docswiss_ai_model_v2';
const PROJECT_VIEWS = new Set<AppView>(['word', 'excel', 'powerpoint', 'canva', 'extract']);

const readArray = <T,>(key: string): T[] => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const initialTheme = (): ThemeMode => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
  return labels[type];
};

const createProjectRecord = (type: SavedProject['type'], content?: unknown): SavedProject => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: projectTitle(type),
    type,
    createdAt: now,
    updatedAt: now,
    previewSnippet: 'Criado no workspace DocSwiss.',
    tags: [],
    content,
  };
};

const projectTypeForTab = (tab: AppView): SavedProject['type'] | null => {
  if (tab === 'word' || tab === 'excel' || tab === 'powerpoint' || tab === 'canva' || tab === 'extract') return tab;
  return null;
};

const readProjectOcrItems = (project: SavedProject | null | undefined): OcrItem[] => {
  if (project?.type !== 'extract') return [];
  const saved = (project.content as any)?.ocrItems;
  return Array.isArray(saved) ? saved : [];
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const textToEditorHtml = (text: string) => {
  const lines = text.split(/\r?\n/);
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => { if (list) html.push(`</${list}>`); list = null; };
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) { closeList(); html.push('<p><br></p>'); continue; }
    if (/^###\s+/.test(trimmed)) { closeList(); html.push(`<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`); continue; }
    if (/^##\s+/.test(trimmed)) { closeList(); html.push(`<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`); continue; }
    if (/^#\s+/.test(trimmed)) { closeList(); html.push(`<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`); continue; }
    if (/^[-*•]\s+/.test(trimmed)) {
      if (list !== 'ul') { closeList(); list = 'ul'; html.push('<ul>'); }
      html.push(`<li>${escapeHtml(trimmed.replace(/^[-*•]\s+/, ''))}</li>`); continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (list !== 'ol') { closeList(); list = 'ol'; html.push('<ol>'); }
      html.push(`<li>${escapeHtml(trimmed.replace(/^\d+[.)]\s+/, ''))}</li>`); continue;
    }
    if (/^>\s+/.test(trimmed)) { closeList(); html.push(`<blockquote>${escapeHtml(trimmed.replace(/^>\s+/, ''))}</blockquote>`); continue; }
    closeList(); html.push(`<p>${escapeHtml(raw)}</p>`);
  }
  closeList();
  return html.join('');
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

const CREATE_ITEMS: Array<{ id: AppView; label: string; icon: React.ComponentType<{ className?: string }>; iconClass: string }> = [
  { id: 'word', label: 'Documento', icon: FileText, iconClass: 'text-blue-600' },
  { id: 'excel', label: 'Planilha', icon: FileSpreadsheet, iconClass: 'text-emerald-600' },
  { id: 'powerpoint', label: 'Apresentação', icon: Presentation, iconClass: 'text-orange-600' },
  { id: 'canva', label: 'Design', icon: Apps, iconClass: 'text-fuchsia-600' },
  { id: 'extract', label: 'PDF & OCR', icon: FileCheck, iconClass: 'text-cyan-600' },
];

const VIEW_LABELS: Record<string, string> = {
  home: 'Início', projects: 'Meus arquivos', office: 'Apps & conversor', cloud: 'Nuvem', chat: 'Assistente IA', ai: 'Assistente IA', compare: 'Arena de IA', image: 'Imagens IA', audio: 'Áudio', analytics: 'Analytics', history: 'Histórico', word: 'Documentos', excel: 'Planilhas', powerpoint: 'Apresentações', canva: 'Design', extract: 'PDF & OCR',
};

export default function AppV4() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<SavedProject[]>(() => readArray<SavedProject>(PROJECTS_KEY));
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => readArray<HistoryItem>(HISTORY_KEY));
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [microsoftUser, setMicrosoftUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
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

  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    window.dispatchEvent(new Event('docswiss:projects-updated'));
  }, [projects]);

  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 250))); }, [history]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    const onInstalled = () => { setDeferredPrompt(null); showNotification('DocSwiss instalado no dispositivo.', 'success'); };
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
    let cancelled = false;
    fetch('/api/ai/models')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Catálogo de IA indisponível.')))
      .then((data) => {
        if (cancelled || !Array.isArray(data.models)) return;
        const enabled = (data.models as AiModelOption[]).filter((model) => model.enabled);
        setModelCatalog(enabled);
        if (!enabled.length) return;
        if (!enabled.some((model) => `${model.provider}:${model.id}` === selectedModelKey)) {
          const next = enabled.find((model) => model.recommended) || enabled[0];
          const nextKey = `${next.provider}:${next.id}`;
          setSelectedModelKey(nextKey);
          localStorage.setItem(MODEL_KEY, nextKey);
        }
      })
      .catch(() => setModelCatalog([]));
    return () => { cancelled = true; };
  }, []);

  const selectedModel = useMemo<AiModelOption>(() => {
    const match = modelCatalog.find((model) => `${model.provider}:${model.id}` === selectedModelKey);
    if (match) return match;
    const separator = selectedModelKey.indexOf(':');
    const provider = separator > 0 ? selectedModelKey.slice(0, separator) : 'gemini';
    const id = separator > 0 ? selectedModelKey.slice(separator + 1) : 'gemini-3.6-flash';
    return { provider, id, label: id, enabled: true };
  }, [modelCatalog, selectedModelKey]);

  const persistProject = useCallback((project: SavedProject) => {
    setProjects((current) => current.some((item) => item.id === project.id) ? current.map((item) => item.id === project.id ? project : item) : [project, ...current]);
    setActiveProject((current) => current?.id === project.id ? project : current);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((current) => current.filter((item) => item.id !== id));
    setActiveProject((current) => current?.id === id ? null : current);
  }, []);

  const createProject = useCallback((type: SavedProject['type'], content?: unknown) => {
    const normalizedContent = type === 'extract' ? (content && typeof content === 'object' ? content : { ocrItems: [] }) : content;
    const project = createProjectRecord(type, normalizedContent);
    if (type === 'extract') setOcrItems(readProjectOcrItems(project));
    else setOcrItems([]);
    setProjects((current) => [project, ...current]);
    setActiveProject(project);
    setView(type as AppView);
    setMenuOpen(false);
    return project;
  }, []);

  const openProject = useCallback((project: SavedProject) => {
    setOcrItems(readProjectOcrItems(project));
    setActiveProject(project);
    setView(project.type === 'chat' ? 'chat' : project.type as AppView);
    setMenuOpen(false);
  }, []);

  const navigate = useCallback((target: AppView) => { setView(target); setMenuOpen(false); }, []);

  const launchTool = useCallback((target: TabType) => {
    const type = projectTypeForTab(target);
    if (type) { createProject(type); return; }
    navigate(target);
  }, [createProject, navigate]);

  const saveHistory = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const record: HistoryItem = { ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    setHistory((current) => [record, ...current].slice(0, 250));
  }, []);

  const sendToDocument = useCallback((text: string) => {
    const html = textToEditorHtml(text);
    const project = createProjectRecord('word', html);
    const updated: SavedProject = { ...project, title: 'Documento da IA', content: html, previewSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 180), updatedAt: new Date().toISOString() };
    setOcrItems([]);
    setProjects((current) => [updated, ...current]);
    setActiveProject(updated);
    setView('word');
    showNotification('Conteúdo aberto em Documentos.', 'success');
  }, [showNotification]);

  const changeModel = useCallback((key: string) => { setSelectedModelKey(key); localStorage.setItem(MODEL_KEY, key); }, []);

  const exportOcrText = useCallback(async (text: string, name: string, format: 'txt' | 'docx' | 'pdf' | 'html') => {
    try {
      const base = (name || 'documento').replace(/\.[^/.]+$/, '');
      const source = new File([text], `${base}.txt`, { type: 'text/plain;charset=utf-8' });
      if (format === 'txt') { saveAs(source, source.name); showNotification('Texto exportado.', 'success'); return; }
      const result = await convertFile(source, format);
      saveAs(result.blob, result.fileName);
      showNotification(result.warnings[0] || `Exportado como ${format.toUpperCase()}.`, result.warnings.length ? 'error' : 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na exportação.', 'error');
    }
  }, [showNotification]);

  useEffect(() => {
    if (view !== 'extract' || activeProject?.type !== 'extract') return;
    const serializable = ocrItems.map((item) => ({ ...item, fileUrl: item.fileUrl?.startsWith('blob:') ? undefined : item.fileUrl }));
    const preview = serializable.find((item) => item.text?.trim())?.text?.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Sessão PDF/OCR local.';
    const currentSerialized = JSON.stringify((activeProject.content as any)?.ocrItems || []);
    const nextSerialized = JSON.stringify(serializable);
    if (currentSerialized === nextSerialized) return;
    persistProject({
      ...activeProject,
      content: { ...(activeProject.content && typeof activeProject.content === 'object' ? activeProject.content as object : {}), ocrItems: serializable },
      previewSnippet: preview,
      updatedAt: new Date().toISOString(),
    });
  }, [ocrItems, view, activeProject, persistProject]);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) { setInstallGuideOpen(true); return; }
    try { await deferredPrompt.prompt(); await deferredPrompt.userChoice; } finally { setDeferredPrompt(null); }
  }, [deferredPrompt]);

  const recentProjects = useMemo(() => projects.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8), [projects]);
  const filteredCreateItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return [];
    return CREATE_ITEMS.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [search]);

  const activeTitle = PROJECT_VIEWS.has(view) && activeProject ? activeProject.title : VIEW_LABELS[view] || 'DocSwiss';
  const editorView = PROJECT_VIEWS.has(view) || view === 'chat' || view === 'ai' || view === 'compare' || view === 'image';
  const currentProject = (type: SavedProject['type']) => activeProject?.type === type ? activeProject : null;

  const renderProjectMissing = (type: SavedProject['type']) => (
    <div className="max-w-xl mx-auto mt-14 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
      <Folder className="w-10 h-10 mx-auto text-slate-300" /><h2 className="mt-3 text-lg font-black">Nenhum arquivo aberto</h2><p className="mt-1 text-sm text-slate-500">Crie um novo arquivo ou abra um existente em Meus arquivos.</p><button onClick={() => createProject(type)} className="mt-5 h-10 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black">Criar agora</button>
    </div>
  );

  const renderContent = () => {
    if (view === 'home') return <HomeDashboard onNavigate={launchTool} onNewChat={() => navigate('chat')} recentHistory={history.slice(0, 6)} recentProjects={recentProjects} recentChats={[] as ChatSession[]} googleUser={googleUser} microsoftUser={microsoftUser} activeEngineLabel={selectedModel.label} />;
    if (view === 'projects') return <FilesWorkspace projects={projects} onOpenProject={openProject} onCreateProject={(type) => createProject(type)} onUpdateProject={persistProject} onDeleteProject={deleteProject} showNotification={showNotification} />;
    if (view === 'office') return <OfficeSuiteHub onSelectTool={launchTool} onOpenTool={launchTool} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
    if (view === 'cloud') return <CloudWorkspace googleUser={googleUser} microsoftUser={microsoftUser} showNotification={showNotification} />;
    if (view === 'word') { const project = currentProject('word'); return project ? <DocumentEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderProjectMissing('word'); }
    if (view === 'excel') { const project = currentProject('excel'); return project ? <SpreadsheetEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderProjectMissing('excel'); }
    if (view === 'powerpoint') { const project = currentProject('powerpoint'); return project ? <PresentationEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderProjectMissing('powerpoint'); }
    if (view === 'canva') { const project = currentProject('canva'); return project ? <DesignEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderProjectMissing('canva'); }
    if (view === 'extract') {
      const project = currentProject('extract');
      if (!project) return renderProjectMissing('extract');
      return <PdfOcrWorkspace
        items={ocrItems}
        setItems={setOcrItems}
        onSaveToHistory={(title, summary, details, tags) => saveHistory({ type: 'ocr', title, summary, details, tags })}
        onSendToChat={(text) => { navigator.clipboard?.writeText(text).catch(() => {}); navigate('chat'); showNotification('Texto copiado para a área de transferência. O Assistente IA foi aberto.', 'success'); }}
        onSendToAiText={sendToDocument}
        showNotification={showNotification}
        exportAsTxt={(text, name) => void exportOcrText(text, name, 'txt')}
        exportAsDocx={(text, name) => void exportOcrText(text, name, 'docx')}
        exportAsPdf={(text, name) => void exportOcrText(text, name, 'pdf')}
        exportAsMd={(text, name) => saveAs(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${name}.md`)}
      />;
    }
    if (view === 'chat' || view === 'ai' || view === 'compare') return <AiWorkspace selectedModelKey={selectedModelKey} onSelectedModelChange={changeModel} onSendToWord={sendToDocument} showNotification={showNotification} />;
    if (view === 'image') return <ImageWorkspace onSaveToHistory={saveHistory} showNotification={showNotification} onSendToCanva={() => createProject('canva')} />;
    if (view === 'audio') return <AudioWorkspace showNotification={showNotification} onSaveToHistory={saveHistory} onSendToWord={sendToDocument} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    if (view === 'analytics') return <AnalyticsWorkspace projects={projects} history={history} />;
    if (view === 'history') return <HistoryVault
      items={history}
      onClearAll={() => { if (window.confirm('Apagar todo o histórico local?')) setHistory([]); }}
      onDeleteItem={(id) => setHistory((current) => current.filter((item) => item.id !== id))}
      onRestoreItem={(item) => {
        if (item.type === 'ocr') {
          const project = createProjectRecord('extract', { ocrItems: [{ id: crypto.randomUUID(), fileName: item.title, fileSize: 0, text: item.details || item.summary, status: 'completed', progress: 100, timestamp: new Date().toISOString(), tags: item.tags }] });
          setOcrItems(readProjectOcrItems(project)); setProjects((current) => [project, ...current]); setActiveProject(project); setView('extract');
        } else if (item.type === 'chat' || item.type === 'ai' || item.type === 'compare') navigate('chat');
        else if (item.type === 'image') navigate('image');
        else if (item.type === 'audio') navigate('audio');
        else if (item.type === 'word' && item.details) sendToDocument(item.details);
        else if (item.type === 'excel') createProject('excel');
        else if (item.type === 'powerpoint') createProject('powerpoint');
        else if (item.type === 'canva') createProject('canva');
      }}
      onCopyText={(text) => navigator.clipboard?.writeText(text)}
    />;
    return <OfficeSuiteHub onSelectTool={launchTool} onOpenTool={launchTool} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
  };

  return (
    <div className="h-dvh min-h-[560px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden flex">
      <aside className="hidden lg:flex w-[252px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col">
        <div className="h-16 px-4 flex items-center border-b border-slate-100 dark:border-slate-800"><button onClick={() => navigate('home')} aria-label="Ir para o início"><DocPlusLogo size="md" /></button></div>
        <div className="p-3 flex-1 overflow-y-auto">
          <nav className="space-y-1">{NAV_ITEMS.map((item) => { const Icon = item.icon; const active = view === item.id || (item.id === 'chat' && (view === 'ai' || view === 'compare')); return <button key={item.id} onClick={() => navigate(item.id)} className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-xs font-bold ${active ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}</nav>
          <div className="mt-5 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Criar novo</div>
          <div className="mt-2 space-y-1">{CREATE_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => launchTool(item.id as TabType)} className="w-full h-9 px-3 rounded-xl flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"><Icon className={`w-4 h-4 ${item.iconClass}`} />{item.label}</button>; })}</div>
        </div>
        <div className="p-3 border-t border-slate-100 dark:border-slate-800"><button onClick={() => setInstallGuideOpen(true)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><div className="text-xs font-black">Instalar DocSwiss</div><div className="text-[10px] text-slate-500 mt-0.5">PWA · WebAPK · TWA</div></button></div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 flex items-center gap-3 z-30">
          <button onClick={() => setMenuOpen(true)} className="lg:hidden w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Abrir menu"><Menu className="w-5 h-5" /></button>
          {editorView && <button onClick={() => navigate('projects')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Voltar aos arquivos"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="min-w-0"><div className="text-sm font-black truncate">{activeTitle}</div><div className="text-[10px] text-slate-400 hidden sm:block">{PROJECT_VIEWS.has(view) && activeProject ? 'Salvo localmente neste dispositivo' : online ? 'Online' : 'Modo offline'}</div></div>
          <div className="relative ml-auto hidden md:block w-[250px] xl:w-[350px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Criar ou buscar aplicativo…" className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-transparent focus:border-indigo-300 dark:focus:border-indigo-800 text-xs outline-none" />
            {filteredCreateItems.length > 0 && <div className="absolute top-11 inset-x-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 z-50">{filteredCreateItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { launchTool(item.id as TabType); setSearch(''); }} className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-bold flex items-center gap-2"><Icon className={`w-4 h-4 ${item.iconClass}`} />Criar {item.label.toLowerCase()}</button>; })}</div>}
          </div>
          <span className={`hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-full text-[10px] font-black ${online ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'}`}>{online ? 'Online' : 'Offline'}</span>
          <button onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Alternar tema">{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          <GoogleProfileBadge user={googleUser} onUserChange={setGoogleUser} msUser={microsoftUser} setMsUser={setMicrosoftUser} onNotification={showNotification} />
        </header>

        <main className={`flex-1 min-h-0 overflow-y-auto ${view === 'chat' || view === 'ai' || view === 'compare' ? 'p-2 sm:p-3' : 'p-3 sm:p-5 lg:p-6'} pb-24 lg:pb-6`}><div className={view === 'chat' || view === 'ai' || view === 'compare' ? '' : 'max-w-[1600px] mx-auto'}>{renderContent()}</div></main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-[68px] border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-around">
          {[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[4]].map((item) => { const Icon = item.icon; const active = view === item.id || (item.id === 'chat' && (view === 'ai' || view === 'compare')); const label = item.label === 'Apps & converter' ? 'Apps' : item.label === 'Meus arquivos' ? 'Arquivos' : item.label; return <button key={item.id} onClick={() => navigate(item.id)} className={`min-w-[54px] h-12 rounded-xl flex flex-col items-center justify-center gap-1 text-[9px] font-bold ${active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' : 'text-slate-500 dark:text-slate-400'}`}><Icon className="w-5 h-5" />{label}</button>; })}
        </nav>
      </div>

      {menuOpen && <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/50" onClick={() => setMenuOpen(false)}><aside className="w-[300px] max-w-[88vw] h-full bg-white dark:bg-slate-900 shadow-2xl p-3 overflow-y-auto" onClick={(event) => event.stopPropagation()}><div className="h-14 flex items-center justify-between px-2"><DocPlusLogo size="md" /><button onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button></div><nav className="mt-3 space-y-1">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => navigate(item.id)} className="w-full h-11 px-3 rounded-xl flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon className="w-4 h-4" />{item.label}</button>; })}</nav><div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1">{CREATE_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => launchTool(item.id as TabType)} className="w-full h-10 px-3 rounded-xl flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><Icon className={`w-4 h-4 ${item.iconClass}`} />Novo {item.label.toLowerCase()}</button>; })}</div><button onClick={() => { setInstallGuideOpen(true); setMenuOpen(false); }} className="mt-5 w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-black">Instalar / Android</button></aside></div>}

      <BrowserGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} deferredPrompt={deferredPrompt} onTriggerInstall={triggerInstall} />
      {notice && <div className={`fixed z-[90] top-4 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-white'}`}>{notice.message}</div>}
    </div>
  );
}
