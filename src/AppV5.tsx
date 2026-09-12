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
  IconBrandGithub as GithubIcon,
  IconHistory as History,
  IconHome as Home,
  IconLayoutSidebarLeftCollapse as SidebarCollapse,
  IconLayoutSidebarLeftExpand as SidebarExpand,
  IconMenu2 as Menu,
  IconMoon as Moon,
  IconPhoto as Photo,
  IconPresentation as Presentation,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconSun as Sun,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { AiWorkspace } from './components/AiWorkspace';
import { AnalyticsWorkspace } from './components/AnalyticsWorkspace';
import { AudioWorkspace } from './components/AudioWorkspace';
import { BottomNavBar } from './components/BottomNavBar';
import { BrowserGuideModal } from './components/BrowserGuideModal';
import { CloudWorkspace } from './components/CloudWorkspace';
import { DesignEditor } from './components/DesignEditor';
import { DocumentEditor } from './components/DocumentEditor';
import { FabMenuSheet } from './components/FabMenuSheet';
import { FilesWorkspace } from './components/FilesWorkspace';
import { GoogleProfileBadge } from './components/GoogleProfileBadge';
import { HistoryVault } from './components/HistoryVault';
import { HomeDashboard } from './components/HomeDashboard';
import { ImageWorkspace } from './components/ImageWorkspace';
import { OfficeSuiteHub } from './components/OfficeSuiteHub';
import { OrbiDocLogo } from './components/OrbiDocLogo';
import { PdfOcrWorkspace } from './components/PdfOcrWorkspace';
import { PresentationEditor } from './components/PresentationEditor';
import { RepoSurface } from './components/RepoSurface';
import { SpreadsheetEditor } from './components/SpreadsheetEditor';
import { OrbitResizablePane, useMediaQuery } from './components/orbit/OrbitResizable';
import { convertFile } from './lib/fileConversion';
import { getStoredGoogleUser } from './services/googleAuthDrive';
import { getStoredMicrosoftUser } from './services/microsoftAuthOffice';
import type {
  ChatSession,
  GoogleUserProfile,
  HistoryItem,
  MicrosoftUserProfile,
  OcrItem,
  SavedProject,
  TabType,
} from './types';

type AppView = TabType | 'cloud' | 'repos';
type Notice = { message: string; type: 'success' | 'error' } | null;
type ThemeMode = 'light' | 'dark';
type NavItem = { id: AppView; label: string; icon: React.ComponentType<{ className?: string }> };
type CreateItem = { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; iconClass: string };
type SearchResult =
  | { kind: 'navigate'; id: AppView; label: string; icon: React.ComponentType<{ className?: string }> }
  | { kind: 'create'; id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; iconClass: string };

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const PROJECTS_KEY = 'orbidoc_projects_v1';
const HISTORY_KEY = 'orbidoc_history_v2';
const THEME_KEY = 'orbit_theme_v1';
const SIDEBAR_KEY = 'orbit_sidebar_collapsed_v1';
const PROJECT_VIEWS = new Set<AppView>(['word', 'excel', 'powerpoint', 'canva', 'extract']);
/** Superfícies que devem ocupar 100% da área útil, sem padding nem scroll externo. */
const FULL_BLEED_VIEWS = new Set<AppView>(['word', 'excel', 'powerpoint', 'canva', 'chat', 'ai', 'compare', 'repos']);

// Compatibility adapter for editor props. The frontend never chooses an internal
// model: src/api/chat.ts ignores these values and Nexus AI routes server-side.
const NEXUS_ENGINE = Object.freeze({ provider: 'openrouter', model: 'openrouter/free', label: 'Nexus AI' });

const WORKSPACE_NAV: NavItem[] = [
  { id: 'home', label: 'Orbispace', icon: Home },
  { id: 'projects', label: 'Meus arquivos', icon: Folder },
  { id: 'office', label: 'OrbiDoc', icon: Apps },
  { id: 'repos', label: 'Repositórios', icon: GithubIcon },
  { id: 'cloud', label: 'Nuvem', icon: Cloud },
];

const TOOL_NAV: NavItem[] = [
  { id: 'chat', label: 'Nexus AI', icon: Sparkles },
  { id: 'image', label: 'Imagens', icon: Photo },
  { id: 'audio', label: 'Áudio', icon: Headphones },
  { id: 'analytics', label: 'Dashboards', icon: ChartBar },
  { id: 'history', label: 'Histórico', icon: History },
];

const ALL_NAV = [...WORKSPACE_NAV, ...TOOL_NAV];

const CREATE_ITEMS: CreateItem[] = [
  { id: 'word', label: 'Documento', icon: FileText, iconClass: 'text-blue-600' },
  { id: 'excel', label: 'Planilha', icon: FileSpreadsheet, iconClass: 'text-emerald-600' },
  { id: 'powerpoint', label: 'Apresentação', icon: Presentation, iconClass: 'text-orange-600' },
  { id: 'canva', label: 'Design', icon: Apps, iconClass: 'text-fuchsia-600' },
  { id: 'extract', label: 'PDF & OCR', icon: FileCheck, iconClass: 'text-cyan-600' },
];

const VIEW_LABELS: Record<string, string> = {
  home: 'Orbispace',
  projects: 'Meus arquivos',
  office: 'OrbiDoc',
  cloud: 'Nuvem',
  repos: 'Repositórios',
  chat: 'Nexus AI',
  ai: 'Nexus AI',
  compare: 'Nexus AI',
  image: 'Imagens',
  audio: 'Áudio',
  analytics: 'Dashboards',
  history: 'Histórico',
  word: 'OrbiDoc · Documentos',
  excel: 'OrbiDoc · Planilhas',
  powerpoint: 'OrbiDoc · Apresentações',
  canva: 'Design',
  extract: 'OrbiDoc · PDF & OCR',
};

const readArray = <T,>(key: string): T[] => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const initialTheme = (): ThemeMode => {
  const stored = localStorage.getItem(THEME_KEY) ?? localStorage.getItem('orbidoc_theme_v2');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
};

const projectTitle = (type: SavedProject['type']): string => {
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
    previewSnippet: 'Criado no Orbispace · OrbiDoc.',
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
  const saved = (project.content as { ocrItems?: unknown } | undefined)?.ocrItems;
  return Array.isArray(saved) ? saved as OcrItem[] : [];
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const textToEditorHtml = (text: string): string => {
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) {
      closeList();
      html.push('<p><br></p>');
      continue;
    }
    if (/^###\s+/.test(trimmed)) {
      closeList();
      html.push(`<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      closeList();
      html.push(`<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(trimmed)) {
      closeList();
      html.push(`<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }
    if (/^[-*•]\s+/.test(trimmed)) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${escapeHtml(trimmed.replace(/^[-*•]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${escapeHtml(trimmed.replace(/^\d+[.)]\s+/, ''))}</li>`);
      continue;
    }
    if (/^>\s+/.test(trimmed)) {
      closeList();
      html.push(`<blockquote>${escapeHtml(trimmed.replace(/^>\s+/, ''))}</blockquote>`);
      continue;
    }
    closeList();
    html.push(`<p>${escapeHtml(raw)}</p>`);
  }

  closeList();
  return html.join('');
};

const SidebarSection: React.FC<{
  label: string;
  items: NavItem[];
  view: AppView;
  rail?: boolean;
  onNavigate: (target: AppView) => void;
}> = ({ label, items, view, rail = false, onNavigate }) => (
  <div>
    {rail ? null : (
      <div className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</div>
    )}
    <nav className="space-y-0.5" aria-label={label}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.id || (item.id === 'chat' && (view === 'ai' || view === 'compare'));
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            title={rail ? item.label : undefined}
            aria-label={rail ? item.label : undefined}
            className={`w-full h-9 rounded-lg flex items-center gap-2.5 text-[11px] font-bold ${rail ? 'justify-center px-0' : 'px-3'} ${active ? 'bg-[#EFF4FF] dark:bg-[#111D4A] text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {rail ? null : <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  </div>
);

export default function AppV5() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<SavedProject[]>(() => readArray<SavedProject>(PROJECTS_KEY));
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => readArray<HistoryItem>(HISTORY_KEY));
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [microsoftUser, setMicrosoftUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const compactViewport = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0'); } catch { /* storage indisponível */ }
  }, [sidebarCollapsed]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3600);
  }, []);

  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    window.dispatchEvent(new Event('orbidoc:projects-updated'));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 250)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      showNotification('Orbit instalado no dispositivo.', 'success');
    };
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setFabOpen(false);
      setSearch('');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const persistProject = useCallback((project: SavedProject) => {
    setProjects((current) => current.some((item) => item.id === project.id)
      ? current.map((item) => item.id === project.id ? project : item)
      : [project, ...current]);
    setActiveProject((current) => current?.id === project.id ? project : current);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((current) => current.filter((item) => item.id !== id));
    setActiveProject((current) => current?.id === id ? null : current);
  }, []);

  const createProject = useCallback((type: SavedProject['type'], content?: unknown) => {
    const normalizedContent = type === 'extract'
      ? (content && typeof content === 'object' ? content : { ocrItems: [] })
      : content;
    const project = createProjectRecord(type, normalizedContent);
    setOcrItems(type === 'extract' ? readProjectOcrItems(project) : []);
    setProjects((current) => [project, ...current]);
    setActiveProject(project);
    setView(type as AppView);
    setMenuOpen(false);
    setFabOpen(false);
    return project;
  }, []);

  const openProject = useCallback((project: SavedProject) => {
    setOcrItems(readProjectOcrItems(project));
    setActiveProject(project);
    setView(project.type === 'chat' ? 'chat' : project.type as AppView);
    setMenuOpen(false);
  }, []);

  const navigate = useCallback((target: AppView) => {
    setView(target);
    setMenuOpen(false);
    setFabOpen(false);
  }, []);

  const launchTool = useCallback((target: TabType) => {
    const type = projectTypeForTab(target);
    if (type) {
      createProject(type);
      return;
    }
    navigate(target);
  }, [createProject, navigate]);

  const saveHistory = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const record: HistoryItem = { ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    setHistory((current) => [record, ...current].slice(0, 250));
  }, []);

  const sendToDocument = useCallback((text: string) => {
    const html = textToEditorHtml(text);
    const project = createProjectRecord('word', html);
    const updated: SavedProject = {
      ...project,
      title: 'Documento do Nexus AI',
      content: html,
      previewSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 180),
      updatedAt: new Date().toISOString(),
    };
    setOcrItems([]);
    setProjects((current) => [updated, ...current]);
    setActiveProject(updated);
    setView('word');
    showNotification('Conteúdo aberto no OrbiDoc · Documentos.', 'success');
  }, [showNotification]);

  const exportOcrText = useCallback(async (text: string, name: string, format: 'txt' | 'docx' | 'pdf' | 'html') => {
    try {
      const base = (name || 'documento').replace(/\.[^/.]+$/, '');
      const source = new File([text], `${base}.txt`, { type: 'text/plain;charset=utf-8' });
      if (format === 'txt') {
        saveAs(source, source.name);
        showNotification('Texto exportado.', 'success');
        return;
      }
      const result = await convertFile(source, format);
      saveAs(result.blob, result.fileName);
      showNotification(result.warnings[0] || `Exportado como ${format.toUpperCase()}.`, result.warnings.length ? 'error' : 'success');
    } catch (error: unknown) {
      showNotification(error instanceof Error ? error.message : 'Falha na exportação.', 'error');
    }
  }, [showNotification]);

  useEffect(() => {
    if (view !== 'extract' || activeProject?.type !== 'extract') return;
    const serializable = ocrItems.map((item) => ({ ...item, fileUrl: item.fileUrl?.startsWith('blob:') ? undefined : item.fileUrl }));
    const preview = serializable.find((item) => item.text?.trim())?.text?.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Sessão PDF/OCR local.';
    const currentSerialized = JSON.stringify((activeProject.content as { ocrItems?: OcrItem[] } | undefined)?.ocrItems || []);
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
    if (!deferredPrompt) {
      setInstallGuideOpen(true);
      return;
    }
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const recentProjects = useMemo(() => projects
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8), [projects]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return [];
    const navigation: SearchResult[] = ALL_NAV
      .filter((item) => item.label.toLowerCase().includes(normalized) || String(item.id).includes(normalized))
      .map((item) => ({ kind: 'navigate', ...item }));
    const creation: SearchResult[] = CREATE_ITEMS
      .filter((item) => item.label.toLowerCase().includes(normalized))
      .map((item) => ({ kind: 'create', ...item }));
    return [...creation, ...navigation].slice(0, 8);
  }, [search]);

  /**
   * Contrato (§2.4): o título do objeto aparece **uma** vez.
   * Quando uma surface em tela cheia está aberta, quem mostra o título é a
   * context bar da própria surface; o header do shell passa a mostrar apenas
   * *onde* o usuário está (o módulo), nunca o nome do arquivo de novo.
   */
  /**
   * GitHub é WorkObject, não overlay. O badge de conta e qualquer deep link
   * levam para a surface Repo na área principal (Fase 5).
   */
  useEffect(() => {
    const openRepos = () => setView('repos');
    window.addEventListener('orbidoc:open-github', openRepos);
    return () => window.removeEventListener('orbidoc:open-github', openRepos);
  }, []);

  /**
   * Command palette abre WorkObjects por id (contrato Fase 6): a paleta vive
   * fora do shell, então pede a abertura por evento em vez de manipular DOM.
   */
  useEffect(() => {
    const openObject = (event: Event) => {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      const project = projectId
        ? projects.find((item) => item.id === projectId)
        : (event as CustomEvent<{ route?: string }>).detail?.route
          ? projects.find((item) => item.type === (event as CustomEvent<{ route?: string }>).detail.route)
          : undefined;
      if (project) openProject(project);
    };
    window.addEventListener('orbit:open-object', openObject);
    return () => window.removeEventListener('orbit:open-object', openObject);
  }, [openProject, projects]);

  const activeTitle = PROJECT_VIEWS.has(view) && activeProject ? activeProject.title : VIEW_LABELS[view] || 'Orbit';
  const surfaceOwnsTitle = PROJECT_VIEWS.has(view) && Boolean(activeProject);
  const shellTitle = surfaceOwnsTitle ? (VIEW_LABELS[view] || 'Orbit') : activeTitle;
  const editorView = PROJECT_VIEWS.has(view) || view === 'chat' || view === 'ai' || view === 'compare' || view === 'image';
  /** Editores e assistente usam toda a área útil; páginas de catálogo mantêm respiro. */
  const fullBleed = FULL_BLEED_VIEWS.has(view) && (!PROJECT_VIEWS.has(view) || Boolean(activeProject));
  const currentProject = (type: SavedProject['type']) => activeProject?.type === type ? activeProject : null;

  const renderProjectMissing = (type: SavedProject['type']) => (
    <div className="orbit-empty-state mx-auto mt-14 max-w-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
      <Folder className="w-10 h-10 mx-auto text-slate-300" />
      <h2 className="mt-3 text-base font-semibold">Nenhum arquivo aberto</h2>
      <p className="mt-1 text-sm text-slate-500">Crie um arquivo no OrbiDoc ou abra um existente em Meus arquivos.</p>
      <button type="button" onClick={() => createProject(type)} className="mt-5 h-10 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Criar agora</button>
    </div>
  );

  const renderContent = () => {
    if (view === 'home') return <HomeDashboard onNavigate={launchTool} onNewChat={() => navigate('chat')} recentHistory={history.slice(0, 6)} recentProjects={recentProjects} recentChats={[] as ChatSession[]} googleUser={googleUser} microsoftUser={microsoftUser} activeEngineLabel="Nexus AI" />;
    if (view === 'projects') return <FilesWorkspace projects={projects} onOpenProject={openProject} onCreateProject={createProject} onUpdateProject={persistProject} onDeleteProject={deleteProject} showNotification={showNotification} />;
    if (view === 'office') return <OfficeSuiteHub onSelectTool={launchTool} onOpenTool={launchTool} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
    if (view === 'repos') return <RepoSurface showNotification={showNotification} />;
    if (view === 'cloud') return <CloudWorkspace googleUser={googleUser} microsoftUser={microsoftUser} showNotification={showNotification} />;
    if (view === 'word') {
      const project = currentProject('word');
      return project ? <DocumentEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={NEXUS_ENGINE.provider} engineModel={NEXUS_ENGINE.model} /> : renderProjectMissing('word');
    }
    if (view === 'excel') {
      const project = currentProject('excel');
      return project ? <SpreadsheetEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={NEXUS_ENGINE.provider} engineModel={NEXUS_ENGINE.model} /> : renderProjectMissing('excel');
    }
    if (view === 'powerpoint') {
      const project = currentProject('powerpoint');
      return project ? <PresentationEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={NEXUS_ENGINE.provider} engineModel={NEXUS_ENGINE.model} /> : renderProjectMissing('powerpoint');
    }
    if (view === 'canva') {
      const project = currentProject('canva');
      return project ? <DesignEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={NEXUS_ENGINE.provider} engineModel={NEXUS_ENGINE.model} /> : renderProjectMissing('canva');
    }
    if (view === 'extract') {
      const project = currentProject('extract');
      if (!project) return renderProjectMissing('extract');
      return (
        <PdfOcrWorkspace
          items={ocrItems}
          setItems={setOcrItems}
          onSaveToHistory={(title, summary, details, tags) => saveHistory({ type: 'ocr', title, summary, details, tags })}
          onSendToChat={(text) => {
            navigator.clipboard?.writeText(text).catch(() => undefined);
            navigate('chat');
            showNotification('Texto copiado. O Nexus AI foi aberto.', 'success');
          }}
          onSendToAiText={sendToDocument}
          showNotification={showNotification}
          exportAsTxt={(text, name) => void exportOcrText(text, name, 'txt')}
          exportAsDocx={(text, name) => void exportOcrText(text, name, 'docx')}
          exportAsPdf={(text, name) => void exportOcrText(text, name, 'pdf')}
          exportAsMd={(text, name) => saveAs(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${name}.md`)}
        />
      );
    }
    if (view === 'chat' || view === 'ai' || view === 'compare') return <AiWorkspace onSendToWord={sendToDocument} showNotification={showNotification} />;
    if (view === 'image') return <ImageWorkspace onSaveToHistory={saveHistory} showNotification={showNotification} onSendToCanva={() => createProject('canva')} />;
    if (view === 'audio') return <AudioWorkspace showNotification={showNotification} onSaveToHistory={saveHistory} onSendToWord={sendToDocument} engineProvider={NEXUS_ENGINE.provider} engineModel={NEXUS_ENGINE.model} />;
    if (view === 'analytics') return <AnalyticsWorkspace projects={projects} history={history} />;
    if (view === 'history') {
      return (
        <HistoryVault
          items={history}
          onClearAll={() => { if (window.confirm('Apagar todo o histórico local?')) setHistory([]); }}
          onDeleteItem={(id) => setHistory((current) => current.filter((item) => item.id !== id))}
          onRestoreItem={(item) => {
            if (item.type === 'ocr') {
              const project = createProjectRecord('extract', { ocrItems: [{ id: crypto.randomUUID(), fileName: item.title, fileSize: 0, text: item.details || item.summary, status: 'completed', progress: 100, timestamp: new Date().toISOString(), tags: item.tags }] });
              setOcrItems(readProjectOcrItems(project));
              setProjects((current) => [project, ...current]);
              setActiveProject(project);
              setView('extract');
            } else if (item.type === 'chat' || item.type === 'ai' || item.type === 'compare') navigate('chat');
            else if (item.type === 'image') navigate('image');
            else if (item.type === 'audio') navigate('audio');
            else if (item.type === 'word' && item.details) sendToDocument(item.details);
            else if (item.type === 'excel') createProject('excel');
            else if (item.type === 'powerpoint') createProject('powerpoint');
            else if (item.type === 'canva') createProject('canva');
          }}
          onCopyText={(text) => navigator.clipboard?.writeText(text)}
        />
      );
    }
    return <OfficeSuiteHub onSelectTool={launchTool} onOpenTool={launchTool} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
  };

  return (
    <div className="h-dvh min-h-[560px] bg-slate-50 dark:bg-[#09090B] text-slate-900 dark:text-slate-100 overflow-hidden flex">
      {compactViewport ? null : sidebarCollapsed ? (
        <aside className="orbit-hide-on-focus hidden lg:flex w-[56px] shrink-0 border-r border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11] flex-col items-center py-2 gap-2">
          <button type="button" onClick={() => navigate('home')} aria-label="Ir para o Orbispace" className="w-9 h-9 rounded-lg flex items-center justify-center"><OrbiDocLogo size="sm" /></button>
          <div className="w-full px-1.5 space-y-2 overflow-y-auto">
            <SidebarSection label="Orbispace" items={WORKSPACE_NAV} view={view} rail onNavigate={navigate} />
            <div className="h-px mx-2 bg-slate-100 dark:bg-[#27272A]" />
            <SidebarSection label="Ferramentas" items={TOOL_NAV} view={view} rail onNavigate={navigate} />
          </div>
          <button type="button" onClick={() => setSidebarCollapsed(false)} className="mt-auto w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Expandir menu lateral" title="Expandir menu lateral">
            <SidebarExpand className="w-4 h-4" />
          </button>
        </aside>
      ) : (
        <OrbitResizablePane
          storageKey="app-sidebar"
          handle="end"
          defaultSize={244}
          min={190}
          max={420}
          label="menu lateral"
          className="orbit-hide-on-focus border-r border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11]"
        >
          <div className="h-12 px-3 flex items-center gap-1 border-b border-slate-100 dark:border-[#27272A]">
            <button type="button" onClick={() => navigate('home')} aria-label="Ir para o Orbispace" className="min-w-0"><OrbiDocLogo size="sm" /></button>
            <button type="button" onClick={() => setSidebarCollapsed(true)} className="ml-auto w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Recolher menu lateral" title="Recolher menu lateral">
              <SidebarCollapse className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2 flex-1 overflow-y-auto space-y-3.5">
            <SidebarSection label="Orbispace" items={WORKSPACE_NAV} view={view} onNavigate={navigate} />
            <SidebarSection label="Ferramentas" items={TOOL_NAV} view={view} onNavigate={navigate} />

            <div>
              <div className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">OrbiDoc · Criar</div>
              <div className="space-y-0.5">
                {CREATE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" onClick={() => launchTool(item.id)} className="w-full h-8 px-3 rounded-lg flex items-center gap-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <Icon className={`w-4 h-4 ${item.iconClass}`} /> <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-2 border-t border-slate-100 dark:border-[#27272A]">
            <button type="button" onClick={() => setInstallGuideOpen(true)} className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
              Instalar Orbit
            </button>
          </div>
        </OrbitResizablePane>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="orbit-hide-on-focus h-12 shrink-0 border-b border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11] px-2 sm:px-3 flex items-center gap-1.5 z-30">
          <button type="button" onClick={() => setMenuOpen(true)} className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>

          {editorView ? (
            <button type="button" onClick={() => navigate('projects')} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Voltar aos arquivos">
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : null}

          <div className="min-w-0 flex items-baseline gap-2">
            <span className="text-[13px] font-semibold truncate">{shellTitle}</span>
            <span className="hidden md:inline text-[10px] text-slate-400 truncate">
              {surfaceOwnsTitle ? 'Salvo neste dispositivo' : online ? 'Online' : 'Modo offline'}
            </span>
          </div>

          <div className="relative ml-auto hidden md:block w-[220px] xl:w-[320px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar no Orbispace…"
              aria-label="Buscar ferramenta ou criar"
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-100 dark:bg-[#18181B] border border-transparent text-xs outline-none"
            />
            {search.trim() ? (
              <div className="absolute top-10 inset-x-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F0F11] shadow-xl p-1.5 z-50">
                {searchResults.length ? searchResults.map((result) => {
                  const Icon = result.icon;
                  const create = result.kind === 'create';
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      onClick={() => {
                        if (create) launchTool(result.id as TabType);
                        else navigate(result.id as AppView);
                        setSearch('');
                      }}
                      className="w-full px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-bold flex items-center gap-2"
                    >
                      <Icon className={`w-4 h-4 ${create ? (result as Extract<SearchResult, { kind: 'create' }>).iconClass : 'text-slate-500'}`} />
                      <span className="min-w-0 flex-1 truncate">{create ? `Criar ${(result.label).toLowerCase()}` : result.label}</span>
                      <span className="text-[9px] uppercase tracking-wide text-slate-400">{create ? 'Novo' : 'Abrir'}</span>
                    </button>
                  );
                }) : <div className="px-3 py-4 text-xs text-slate-400 text-center">Nenhum destino encontrado.</div>}
              </div>
            ) : null}
          </div>

          {online ? null : (
            <span className="ml-auto md:ml-0 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">Offline</span>
          )}

          <button type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <GoogleProfileBadge user={googleUser} onUserChange={setGoogleUser} msUser={microsoftUser} setMsUser={setMicrosoftUser} onNotification={showNotification} />
        </header>

        <main
          className={`orbit-workspace-main ${fullBleed ? '' : 'overflow-y-auto p-3 sm:p-4 lg:p-5 pb-24 lg:pb-6'}`}
          data-orbit-surface={fullBleed ? 'editor' : 'page'}
        >
          <div className={`orbit-workspace-canvas ${fullBleed ? '' : 'max-w-[1520px] w-full mx-auto'}`}>{renderContent()}</div>
        </main>

        <div className="orbit-hide-on-focus">
          <BottomNavBar
            activeTab={view === 'ai' || view === 'compare' ? 'chat' : view === 'cloud' ? 'office' : view as TabType}
            onNavigate={(target) => navigate(target)}
            onOpenFab={() => setFabOpen(true)}
          />
        </div>
      </div>

      {menuOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <aside className="w-[304px] max-w-[88vw] h-full bg-white dark:bg-[#0F0F11] shadow-2xl p-3 overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="h-14 flex items-center justify-between px-2">
              <OrbiDocLogo size="md" />
              <button type="button" onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <SidebarSection label="Orbispace" items={WORKSPACE_NAV} view={view} onNavigate={navigate} />
              <SidebarSection label="Ferramentas" items={TOOL_NAV} view={view} onNavigate={navigate} />
            </div>

            <button type="button" onClick={() => { setFabOpen(true); setMenuOpen(false); }} className="mt-5 w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black">Criar no OrbiDoc</button>
            <button type="button" onClick={() => { setInstallGuideOpen(true); setMenuOpen(false); }} className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">Instalar Orbit</button>
          </aside>
        </div>
      ) : null}

      <FabMenuSheet isOpen={fabOpen} onClose={() => setFabOpen(false)} onSelectAction={launchTool} />
      <BrowserGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} deferredPrompt={deferredPrompt} onTriggerInstall={triggerInstall} />

      {notice ? (
        <div role={notice.type === 'error' ? 'alert' : 'status'} className={`fixed z-[90] top-4 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-white'}`}>
          {notice.message}
        </div>
      ) : null}
    </div>
  );
}
