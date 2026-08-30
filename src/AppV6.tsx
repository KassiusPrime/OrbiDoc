import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconApps as Apps,
  IconChartBar as Analytics,
  IconChevronLeft as ChevronLeft,
  IconClock as Recent,
  IconCloud as Services,
  IconFileCheck as Pdf,
  IconFileSpreadsheet as Spreadsheet,
  IconFileText as Document,
  IconFolder as Files,
  IconHeadphones as Audio,
  IconHome as Home,
  IconPhoto as Image,
  IconPresentation as Presentation,
  IconRobot as Ai,
  IconSearch as Search,
  IconSettings as Settings,
  IconTool as Tools,
  IconUser as User,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { AiWorkspace, type AiModelOption } from './components/AiWorkspace';
import { AnalyticsWorkspace } from './components/AnalyticsWorkspace';
import { AudioWorkspace } from './components/AudioWorkspace';
import { BrowserGuideModal } from './components/BrowserGuideModal';
import { DesignEditor } from './components/DesignEditor';
import { DocumentEditor } from './components/DocumentEditor';
import { FilesWorkspace } from './components/FilesWorkspace';
import { HistoryVault } from './components/HistoryVault';
import { HostBottomNav, type HostDestination } from './components/HostBottomNav';
import { ImageWorkspace } from './components/ImageWorkspace';
import { OfficeSuiteHub } from './components/OfficeSuiteHub';
import { OrbiDocLogo } from './components/OrbiDocLogo';
import { PdfOcrWorkspace } from './components/PdfOcrWorkspace';
import { PresentationEditor } from './components/PresentationEditor';
import { ServiceBrowserWorkspace } from './components/ServiceBrowserWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { SpreadsheetEditor } from './components/SpreadsheetEditor';
import { convertFile } from './lib/fileConversion';
import { openFileInsideOrbiDoc } from './lib/systemFileOpen';
import { getCurrentOrbiDocUser, subscribeToOrbiDocAuth, type OrbiDocAuthUser } from './services/firebase';
import { getStoredGoogleUser } from './services/googleAuthDrive';
import { getStoredMicrosoftUser } from './services/microsoftAuthOffice';
import type { GoogleUserProfile, HistoryItem, MicrosoftUserProfile, OcrItem, SavedProject, TabType } from './types';

type HostView = TabType | 'services' | 'settings';
type ThemePreference = 'system' | 'light' | 'dark';
type Notice = { message: string; type: 'success' | 'error' } | null;

type AppDefinition = {
  id: TabType;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const PROJECTS_KEY = 'orbidoc_projects_v1';
const HISTORY_KEY = 'orbidoc_history_v2';
const THEME_KEY = 'orbidoc_theme_v2';
const MODEL_KEY = 'orbidoc_ai_model_v2';
const PROJECT_VIEWS = new Set<HostView>(['word', 'excel', 'powerpoint', 'canva', 'extract']);

const PRIMARY_NAV: Array<{ id: HostDestination; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'projects', label: 'Arquivos', icon: Files },
  { id: 'services', label: 'Serviços', icon: Services },
  { id: 'history', label: 'Recentes', icon: Recent },
];

const APPS: AppDefinition[] = [
  { id: 'word', label: 'Documento', detail: 'Texto, revisão, referências e DOCX/PDF', icon: Document, accent: 'text-blue-600' },
  { id: 'excel', label: 'Planilha', detail: 'Tabelas, fórmulas, filtros e XLSX/CSV', icon: Spreadsheet, accent: 'text-emerald-600' },
  { id: 'powerpoint', label: 'Apresentação', detail: 'Slides, mestre, notas e PPTX', icon: Presentation, accent: 'text-orange-600' },
  { id: 'canva', label: 'Design', detail: 'Canvas, páginas, elementos e exportação', icon: Apps, accent: 'text-fuchsia-600' },
  { id: 'extract', label: 'PDF & OCR', detail: 'Leitura, extração, OCR e conversão', icon: Pdf, accent: 'text-cyan-600' },
  { id: 'chat', label: 'Assistente IA', detail: 'Pesquisa, escrita e transformação contextual', icon: Ai, accent: 'text-violet-600' },
  { id: 'image', label: 'Imagem', detail: 'Geração, edição e aprimoramento', icon: Image, accent: 'text-pink-600' },
  { id: 'audio', label: 'Áudio', detail: 'Transcrição, síntese e processamento', icon: Audio, accent: 'text-sky-600' },
  { id: 'analytics', label: 'Analytics', detail: 'Visão consolidada do workspace', icon: Analytics, accent: 'text-indigo-600' },
  { id: 'office', label: 'Conversor', detail: 'Conversão entre formatos e compatibilidade', icon: Tools, accent: 'text-slate-600' },
];

const VIEW_LABELS: Record<string, string> = {
  home: 'Início', projects: 'Arquivos', services: 'Serviços', history: 'Recentes', settings: 'Configurações',
  office: 'Conversor', word: 'Documento', excel: 'Planilha', powerpoint: 'Apresentação', canva: 'Design', extract: 'PDF & OCR',
  chat: 'Assistente IA', ai: 'Assistente IA', compare: 'Arena de IA', image: 'Imagem', audio: 'Áudio', analytics: 'Analytics',
};

const readArray = <T,>(key: string): T[] => {
  try { const parsed = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

const initialTheme = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
  } catch { /* storage unavailable */ }
  return 'system';
};

const projectTitle = (type: SavedProject['type']) => ({
  word: 'Novo documento', excel: 'Nova planilha', powerpoint: 'Nova apresentação', canva: 'Novo design', extract: 'Novo PDF / OCR', chat: 'Nova conversa',
}[type]);

const createProjectRecord = (type: SavedProject['type'], content?: unknown): SavedProject => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: projectTitle(type), type, createdAt: now, updatedAt: now, previewSnippet: 'Criado no OrbiDoc.', tags: [], content };
};

const projectTypeForView = (view: HostView): SavedProject['type'] | null => {
  if (view === 'word' || view === 'excel' || view === 'powerpoint' || view === 'canva' || view === 'extract') return view;
  return null;
};

const readProjectOcrItems = (project?: SavedProject | null): OcrItem[] => {
  if (project?.type !== 'extract') return [];
  const saved = project.content?.ocrItems;
  return Array.isArray(saved) ? saved : [];
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textToEditorHtml = (text: string) => text.split(/\r?\n/).map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>').join('');

const clickController = (label: string) => {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`A função “${label}” não está disponível nesta tela.`);
  button.click();
};

const AvatarButton: React.FC<{ user: OrbiDocAuthUser | null; google: GoogleUserProfile | null; microsoft: MicrosoftUserProfile | null; onClick: () => void }> = ({ user, google, microsoft, onClick }) => {
  const image = user?.photoURL || google?.picture || microsoft?.picture;
  const source = user?.displayName || user?.email || google?.name || microsoft?.name || 'OrbiDoc';
  const initials = source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OD';
  return <button type="button" onClick={onClick} className="w-9 h-9 rounded-xl border border-[#DCE3EE] dark:border-slate-700 bg-white dark:bg-[#101827] overflow-hidden flex items-center justify-center" aria-label="Abrir configurações da conta">{image ? <img src={image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user ? <span className="w-full h-full bg-[#3157F6] text-white flex items-center justify-center text-[9px] font-black">{initials}</span> : <User className="w-4 h-4 text-slate-500" />}</button>;
};

export default function AppV6() {
  const [view, setView] = useState<HostView>('home');
  const [projects, setProjects] = useState<SavedProject[]>(() => readArray<SavedProject>(PROJECTS_KEY));
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => readArray<HistoryItem>(HISTORY_KEY));
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [microsoftUser, setMicrosoftUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());
  const [orbiUser, setOrbiUser] = useState<OrbiDocAuthUser | null>(() => getCurrentOrbiDocUser());
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [selectedModelKey, setSelectedModelKey] = useState(() => localStorage.getItem(MODEL_KEY) || 'gemini:gemini-3.6-flash');
  const [modelCatalog, setModelCatalog] = useState<AiModelOption[]>([]);
  const localFileRef = useRef<HTMLInputElement>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  useEffect(() => subscribeToOrbiDocAuth(setOrbiUser), []);
  useEffect(() => { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); window.dispatchEvent(new Event('orbidoc:projects-updated')); }, [projects]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 250))); }, [history]);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    const onInstalled = () => { setDeferredPrompt(null); showNotification('OrbiDoc instalado no dispositivo.', 'success'); };
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('beforeinstallprompt', onInstall); window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('appinstalled', onInstalled); };
  }, [showNotification]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setAppSwitcherOpen((value) => !value); }
      if (event.key === 'Escape') { setAppSwitcherOpen(false); setSearch(''); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/models').then((response) => response.ok ? response.json() : Promise.reject(new Error())).then((data) => {
      if (cancelled || !Array.isArray(data.models)) return;
      const enabled = (data.models as AiModelOption[]).filter((model) => model.enabled);
      setModelCatalog(enabled);
      if (enabled.length && !enabled.some((model) => `${model.provider}:${model.id}` === selectedModelKey)) {
        const next = enabled.find((model) => model.recommended) || enabled[0];
        const key = `${next.provider}:${next.id}`;
        setSelectedModelKey(key); localStorage.setItem(MODEL_KEY, key);
      }
    }).catch(() => setModelCatalog([]));
    return () => { cancelled = true; };
  }, []);

  const selectedModel = useMemo<AiModelOption>(() => {
    const model = modelCatalog.find((item) => `${item.provider}:${item.id}` === selectedModelKey);
    if (model) return model;
    const [provider = 'gemini', ...modelParts] = selectedModelKey.split(':');
    const id = modelParts.join(':') || 'gemini-3.6-flash';
    return { provider, id, label: id, enabled: true };
  }, [modelCatalog, selectedModelKey]);

  const persistProject = useCallback((project: SavedProject) => {
    setProjects((items) => items.some((item) => item.id === project.id) ? items.map((item) => item.id === project.id ? project : item) : [project, ...items]);
    setActiveProject((current) => current?.id === project.id ? project : current);
  }, []);

  const createProject = useCallback((type: SavedProject['type'], content?: unknown) => {
    const normalized = type === 'extract' ? (content && typeof content === 'object' ? content : { ocrItems: [] }) : content;
    const project = createProjectRecord(type, normalized);
    setProjects((items) => [project, ...items]); setActiveProject(project); setOcrItems(type === 'extract' ? readProjectOcrItems(project) : []); setView(type); setAppSwitcherOpen(false);
    return project;
  }, []);

  const openProject = useCallback((project: SavedProject) => {
    setActiveProject(project); setOcrItems(readProjectOcrItems(project)); setView(project.type === 'chat' ? 'chat' : project.type);
  }, []);

  const navigate = useCallback((target: HostView) => { setView(target); setAppSwitcherOpen(false); }, []);
  const launchApp = useCallback((target: TabType) => {
    const projectType = projectTypeForView(target);
    if (projectType) { createProject(projectType); return; }
    navigate(target);
  }, [createProject, navigate]);

  const openSettings = useCallback((section: 'appearance' | 'account' | 'connections' | 'storage' | 'ai' = 'appearance') => {
    setView('settings'); setAppSwitcherOpen(false);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('orbidoc:settings-section', { detail: { section } })), 0);
  }, []);

  const saveHistory = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    setHistory((items) => [{ ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() }, ...items].slice(0, 250));
  }, []);

  const sendToDocument = useCallback((text: string) => {
    const html = textToEditorHtml(text);
    const project = { ...createProjectRecord('word', html), title: 'Documento da IA', previewSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 180) };
    setProjects((items) => [project, ...items]); setActiveProject(project); setView('word'); showNotification('Conteúdo aberto em Documento.', 'success');
  }, [showNotification]);

  const exportOcrText = useCallback(async (text: string, name: string, format: 'txt' | 'docx' | 'pdf' | 'html') => {
    try {
      const base = (name || 'documento').replace(/\.[^/.]+$/, '');
      const source = new File([text], `${base}.txt`, { type: 'text/plain;charset=utf-8' });
      if (format === 'txt') { saveAs(source, source.name); return; }
      const result = await convertFile(source, format); saveAs(result.blob, result.fileName);
      showNotification(result.warnings[0] || `Exportado como ${format.toUpperCase()}.`, result.warnings.length ? 'error' : 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha na exportação.', 'error'); }
  }, [showNotification]);

  useEffect(() => {
    if (view !== 'extract' || activeProject?.type !== 'extract') return;
    const serializable = ocrItems.map((item) => ({ ...item, fileUrl: item.fileUrl?.startsWith('blob:') ? undefined : item.fileUrl }));
    const nextSerialized = JSON.stringify(serializable);
    if (JSON.stringify(activeProject.content?.ocrItems || []) === nextSerialized) return;
    persistProject({ ...activeProject, content: { ...(activeProject.content || {}), ocrItems: serializable }, previewSnippet: serializable.find((item) => item.text?.trim())?.text?.replace(/\s+/g, ' ').slice(0, 180) || 'Sessão PDF/OCR local.', updatedAt: new Date().toISOString() });
  }, [ocrItems, view, activeProject, persistProject]);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) { setInstallGuideOpen(true); return; }
    try { await deferredPrompt.prompt(); await deferredPrompt.userChoice; } finally { setDeferredPrompt(null); }
  }, [deferredPrompt]);

  const recentProjects = useMemo(() => projects.slice().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 8), [projects]);
  const searchProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return projects.filter((project) => project.title.toLowerCase().includes(query) || project.tags?.some((tag) => tag.toLowerCase().includes(query))).slice(0, 6);
  }, [projects, search]);

  const currentProject = (type: SavedProject['type']) => activeProject?.type === type ? activeProject : null;
  const renderMissing = (type: SavedProject['type']) => <div className="max-w-lg mx-auto mt-16 text-center"><Files className="w-9 h-9 mx-auto text-slate-300" /><h2 className="mt-3 text-base font-black">Nenhum arquivo aberto</h2><p className="mt-1 text-xs text-slate-400">Abra um arquivo ou crie um novo.</p><button onClick={() => createProject(type)} className="mt-4 h-10 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black">Criar arquivo</button></div>;

  const renderHome = () => <div className="max-w-6xl mx-auto space-y-6">
    <section className="rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-5 sm:p-7 shadow-sm">
      <div className="max-w-3xl"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#3157F6]">Workspace conectado</div><h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-[-0.035em]">Abra o arquivo. O OrbiDoc cuida do resto.</h1><p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">Arquivos locais, Drive, OneDrive e GitHub entram pelo mesmo fluxo. Os apps de edição aparecem como modos de trabalho; IA, OCR e conversão ficam contextuais.</p></div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => localFileRef.current?.click()} className="h-11 px-4 rounded-xl bg-[#3157F6] text-white text-[11px] font-black inline-flex items-center gap-2"><Files className="w-4 h-4" /> Abrir arquivo</button><button onClick={() => navigate('services')} className="h-11 px-4 rounded-xl border border-[#DCE3EE] dark:border-slate-700 text-[11px] font-black inline-flex items-center gap-2"><Services className="w-4 h-4" /> Explorar serviços</button><button onClick={() => setAppSwitcherOpen(true)} className="h-11 px-4 rounded-xl border border-[#DCE3EE] dark:border-slate-700 text-[11px] font-black inline-flex items-center gap-2"><Apps className="w-4 h-4" /> Novo</button></div>
      <input ref={localFileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) openFileInsideOrbiDoc(file, 'local'); event.target.value = ''; }} />
    </section>
    <section><div className="flex items-center gap-2 mb-3"><Recent className="w-4 h-4 text-slate-400" /><h2 className="text-sm font-black">Arquivos recentes</h2><button onClick={() => navigate('projects')} className="ml-auto text-[10px] font-black text-[#3157F6]">Ver todos</button></div>{recentProjects.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">{recentProjects.map((project) => <button key={project.id} onClick={() => openProject(project)} className="min-h-24 rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4 text-left hover:border-[#3157F6]/35"><div className="text-[9px] uppercase tracking-wide font-black text-slate-400">{VIEW_LABELS[project.type]}</div><div className="mt-2 text-xs font-black truncate">{project.title}</div><div className="mt-1 text-[9px] text-slate-400 line-clamp-2">{project.previewSnippet || 'Arquivo local'}</div></button>)}</div> : <div className="rounded-2xl border border-dashed border-[#DCE3EE] dark:border-slate-800 p-8 text-center text-xs text-slate-400">Seus arquivos recentes aparecerão aqui.</div>}</section>
  </div>;

  const renderContent = () => {
    if (view === 'home') return renderHome();
    if (view === 'projects') return <FilesWorkspace projects={projects} onOpenProject={openProject} onCreateProject={createProject} onUpdateProject={persistProject} onDeleteProject={(id) => { setProjects((items) => items.filter((item) => item.id !== id)); setActiveProject((current) => current?.id === id ? null : current); }} showNotification={showNotification} />;
    if (view === 'services') return <ServiceBrowserWorkspace googleUser={googleUser} microsoftUser={microsoftUser} onOpenSettings={() => openSettings('connections')} showNotification={showNotification} />;
    if (view === 'settings') return <SettingsWorkspace theme={theme} onThemeChange={setTheme} googleUser={googleUser} onGoogleUserChange={setGoogleUser} microsoftUser={microsoftUser} onMicrosoftUserChange={setMicrosoftUser} onOpenInstall={() => setInstallGuideOpen(true)} showNotification={showNotification} />;
    if (view === 'office') return <OfficeSuiteHub onSelectTool={launchApp} onOpenTool={launchApp} msUser={microsoftUser} setMsUser={setMicrosoftUser} showNotification={showNotification} />;
    if (view === 'word') { const project = currentProject('word'); return project ? <DocumentEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderMissing('word'); }
    if (view === 'excel') { const project = currentProject('excel'); return project ? <SpreadsheetEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderMissing('excel'); }
    if (view === 'powerpoint') { const project = currentProject('powerpoint'); return project ? <PresentationEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderMissing('powerpoint'); }
    if (view === 'canva') { const project = currentProject('canva'); return project ? <DesignEditor key={project.id} project={project} onProjectChange={persistProject} onSaveToHistory={saveHistory} showNotification={showNotification} engineProvider={selectedModel.provider} engineModel={selectedModel.id} /> : renderMissing('canva'); }
    if (view === 'extract') { const project = currentProject('extract'); return project ? <PdfOcrWorkspace items={ocrItems} setItems={setOcrItems} onSaveToHistory={(title, summary, details, tags) => saveHistory({ type: 'ocr', title, summary, details, tags })} onSendToChat={(text) => { navigator.clipboard?.writeText(text).catch(() => {}); navigate('chat'); }} onSendToAiText={sendToDocument} showNotification={showNotification} exportAsTxt={(text, name) => void exportOcrText(text, name, 'txt')} exportAsDocx={(text, name) => void exportOcrText(text, name, 'docx')} exportAsPdf={(text, name) => void exportOcrText(text, name, 'pdf')} exportAsMd={(text, name) => saveAs(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${name}.md`)} /> : renderMissing('extract'); }
    if (view === 'chat' || view === 'ai' || view === 'compare') return <AiWorkspace selectedModelKey={selectedModelKey} onSelectedModelChange={(key) => { setSelectedModelKey(key); localStorage.setItem(MODEL_KEY, key); }} onSendToWord={sendToDocument} showNotification={showNotification} />;
    if (view === 'image') return <ImageWorkspace onSaveToHistory={saveHistory} showNotification={showNotification} onSendToCanva={() => createProject('canva')} />;
    if (view === 'audio') return <AudioWorkspace showNotification={showNotification} onSaveToHistory={saveHistory} onSendToWord={sendToDocument} engineProvider={selectedModel.provider} engineModel={selectedModel.id} />;
    if (view === 'analytics') return <AnalyticsWorkspace projects={projects} history={history} />;
    if (view === 'history') return <HistoryVault items={history} onClearAll={() => { if (window.confirm('Apagar todo o histórico local?')) setHistory([]); }} onDeleteItem={(id) => setHistory((items) => items.filter((item) => item.id !== id))} onRestoreItem={(item) => { if (item.type === 'ocr') createProject('extract', { ocrItems: [{ id: crypto.randomUUID(), fileName: item.title, fileSize: 0, text: item.details || item.summary, status: 'completed', progress: 100, timestamp: new Date().toISOString(), tags: item.tags }] }); else if (item.type === 'word' && item.details) sendToDocument(item.details); else if (item.type === 'excel' || item.type === 'powerpoint' || item.type === 'canva') createProject(item.type); else if (item.type === 'image') navigate('image'); else if (item.type === 'audio') navigate('audio'); else navigate('chat'); }} onCopyText={(text) => navigator.clipboard?.writeText(text)} />;
    return renderHome();
  };

  const editorView = PROJECT_VIEWS.has(view) || ['chat', 'ai', 'compare', 'image', 'audio'].includes(view);
  const activeTitle = PROJECT_VIEWS.has(view) && activeProject ? activeProject.title : VIEW_LABELS[view] || 'OrbiDoc';
  const hostActive: HostDestination = view === 'home' ? 'home' : view === 'services' ? 'services' : view === 'history' ? 'history' : view === 'settings' ? 'settings' : 'projects';

  return <div className="h-dvh min-h-0 bg-[#F6F8FC] dark:bg-[#080D18] text-[#101522] dark:text-slate-100 overflow-hidden flex">
    <aside className="hidden lg:flex w-[232px] shrink-0 border-r border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] flex-col">
      <div className="h-16 px-4 flex items-center border-b border-[#EEF2F6] dark:border-slate-800"><button onClick={() => navigate('home')} aria-label="Ir para o início"><OrbiDocLogo size="md" /></button></div>
      <div className="p-3 flex-1 min-h-0 overflow-y-auto">
        <button onClick={() => setAppSwitcherOpen(true)} className="w-full h-11 px-3 rounded-xl bg-[#3157F6] text-white flex items-center gap-2 text-[11px] font-black"><Apps className="w-4 h-4" /> Apps <span className="ml-auto text-[8px] opacity-70">Ctrl K</span></button>
        <nav className="mt-4 space-y-1" aria-label="Workspace">{PRIMARY_NAV.map((item) => { const Icon = item.icon; const active = hostActive === item.id; return <button key={item.id} onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined} className={`w-full min-h-10 px-3 rounded-xl flex items-center gap-3 text-[11px] font-bold ${active ? 'bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 text-[#2446D8] dark:text-[#AFC4FF]' : 'text-slate-600 dark:text-slate-300 hover:bg-[#F8FAFD] dark:hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}</nav>
      </div>
      <div className="p-3 border-t border-[#EEF2F6] dark:border-slate-800"><button onClick={() => openSettings('appearance')} className={`w-full min-h-10 px-3 rounded-xl flex items-center gap-3 text-[11px] font-bold ${view === 'settings' ? 'bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 text-[#2446D8] dark:text-[#AFC4FF]' : 'text-slate-600 dark:text-slate-300 hover:bg-[#F8FAFD] dark:hover:bg-slate-800'}`}><Settings className="w-4 h-4" />Configurações</button></div>
    </aside>

    <div className="flex-1 min-w-0 flex flex-col">
      <header className="h-16 shrink-0 border-b border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] px-3 sm:px-4 flex items-center gap-2 z-30">
        <button type="button" onClick={() => setAppSwitcherOpen(true)} className="lg:hidden w-10 h-10 rounded-xl hover:bg-[#F8FAFD] dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Abrir apps"><Apps className="w-5 h-5" /></button>
        {editorView ? <button onClick={() => navigate('projects')} className="w-9 h-9 rounded-xl hover:bg-[#F8FAFD] dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Voltar aos arquivos"><ChevronLeft className="w-5 h-5" /></button> : null}
        <div className="min-w-0"><div className="text-sm font-black truncate">{activeTitle}</div><div className="hidden sm:block text-[9px] text-slate-400 truncate">{PROJECT_VIEWS.has(view) && activeProject ? 'Arquivo do workspace' : online ? 'OrbiDoc conectado' : 'Modo offline'}</div></div>
        <div className="relative ml-auto hidden md:block w-[240px] xl:w-[360px]"><Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar arquivos" aria-label="Buscar arquivos" className="w-full h-9 rounded-xl border border-[#DCE3EE] dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-950 pl-8 pr-3 text-[10px] outline-none focus:border-[#3157F6]" />{search.trim() && <div className="absolute top-11 inset-x-0 z-50 rounded-xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xl p-1.5">{searchProjects.length ? searchProjects.map((project) => <button key={project.id} onClick={() => { openProject(project); setSearch(''); }} className="w-full min-h-10 px-3 rounded-lg hover:bg-[#F8FAFD] dark:hover:bg-slate-800 text-left"><span className="block text-[10px] font-black truncate">{project.title}</span><span className="block text-[8px] text-slate-400">{VIEW_LABELS[project.type]}</span></button>) : <div className="p-4 text-center text-[10px] text-slate-400">Nenhum arquivo local encontrado.</div>}</div>}</div>
        <span className={`hidden xl:inline-flex px-2 py-1 rounded-full text-[8px] font-black ${online ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'}`}>{online ? 'Online' : 'Offline'}</span>
        <button onClick={() => openSettings('appearance')} className="w-9 h-9 rounded-xl hover:bg-[#F8FAFD] dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Abrir configurações"><Settings className="w-4 h-4" /></button>
        <AvatarButton user={orbiUser} google={googleUser} microsoft={microsoftUser} onClick={() => openSettings('account')} />
      </header>

      <main className={`flex-1 min-h-0 overflow-y-auto ${['chat', 'ai', 'compare'].includes(view) ? 'p-2 sm:p-3' : 'p-3 sm:p-5 lg:p-6'} pb-24 lg:pb-6`}><div className={['chat', 'ai', 'compare'].includes(view) ? '' : 'max-w-[1540px] mx-auto'}>{renderContent()}</div></main>
      <HostBottomNav active={hostActive} onNavigate={(target) => navigate(target)} />
    </div>

    {appSwitcherOpen && <div className="fixed inset-0 z-[190] bg-[#080D18]/55 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="orbidoc-app-switcher-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setAppSwitcherOpen(false); }}>
      <section className="w-full max-w-4xl max-h-[min(88dvh,780px)] rounded-3xl border border-[#DCE3EE] dark:border-slate-800 bg-[#F6F8FC] dark:bg-[#080D18] shadow-2xl overflow-hidden flex flex-col">
        <header className="h-16 shrink-0 px-4 sm:px-5 border-b border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 text-[#3157F6] flex items-center justify-center"><Apps className="w-4.5 h-4.5" /></span><div className="min-w-0 flex-1"><h2 id="orbidoc-app-switcher-title" className="text-sm font-black">Apps OrbiDoc</h2><p className="text-[9px] text-slate-400">Escolha um modo de trabalho. Recursos avançados permanecem contextuais ao arquivo.</p></div><button onClick={() => setAppSwitcherOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar apps"><X className="w-4 h-4" /></button></header>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5"><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">{APPS.map((app) => { const Icon = app.icon; return <button key={app.id} onClick={() => launchApp(app.id)} className="min-h-[88px] rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4 flex items-center gap-3 text-left hover:border-[#3157F6]/35"><span className="w-10 h-10 rounded-xl bg-[#EEF2F8] dark:bg-slate-800 flex items-center justify-center shrink-0"><Icon className={`w-5 h-5 ${app.accent}`} /></span><span className="min-w-0"><span className="block text-xs font-black">{app.label}</span><span className="block mt-1 text-[9px] leading-relaxed text-slate-400">{app.detail}</span></span></button>; })}</div>
          <div className="mt-5 pt-4 border-t border-[#DCE3EE] dark:border-slate-800"><div className="px-1 text-[9px] uppercase tracking-[0.14em] font-black text-slate-400">Utilitários contextuais</div><div className="mt-2 flex flex-wrap gap-2"><Utility label="Scan & Reader" onClick={() => { setAppSwitcherOpen(false); clickController('Abrir Scan e Reader'); }} /><Utility label="Versões" onClick={() => { setAppSwitcherOpen(false); clickController('Abrir histórico de versões'); }} /><Utility label="Redimensionar" onClick={() => { setAppSwitcherOpen(false); window.dispatchEvent(new Event('orbidoc:open-image-resizer')); }} /><Utility label="Ferramentas locais" onClick={() => { setAppSwitcherOpen(false); window.dispatchEvent(new Event('orbidoc:open-local-tools')); }} /><Utility label="Laboratório offline" onClick={() => { setAppSwitcherOpen(false); window.dispatchEvent(new Event('orbidoc:open-advanced-tools')); }} /></div></div>
        </div>
      </section>
    </div>}

    <BrowserGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} deferredPrompt={deferredPrompt} onTriggerInstall={triggerInstall} />
    {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`fixed z-[220] top-4 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-3 rounded-2xl shadow-xl border text-[10px] font-bold ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200' : 'bg-white border-[#DCE3EE] text-slate-800 dark:bg-[#101827] dark:border-slate-700 dark:text-white'}`}>{notice.message}</div>}
  </div>;
}

const Utility: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => <button type="button" onClick={onClick} className="h-9 px-3 rounded-xl border border-[#DCE3EE] dark:border-slate-700 bg-white dark:bg-[#101827] text-[9px] font-black hover:border-[#3157F6]/35">{label}</button>;
