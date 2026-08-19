import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  IconFileText as FileText, IconVolume as Volume2, IconUpload as Upload, IconLoader2 as Loader2, 
  IconKey as Key, IconWand as Wand2, IconPalette as Palette, IconCloudDownload as DownloadCloud,
  IconPhotoPlus as ImagePlus, IconMicrophone as Mic, IconSend as Send, IconSettings as Settings, 
  IconCopy as Copy, IconFileExport as FileOutput, IconLanguage as Languages, IconSparkles as Sparkles, 
  IconX as X, IconCheck as Check, IconLetterT as Type, IconRobot as Bot, IconMessage as MessageSquare, 
  IconPaperclip as Paperclip, IconPhoto as ImageIcon, IconVideo as FileVideo, IconFile as File, 
  IconTrash as Trash2, IconPlayerStop as StopCircle, IconLayoutColumns as SplitSquareHorizontal, 
  IconSun as Sun, IconMoon as Moon, IconHistory as History, IconAdjustmentsHorizontal as SlidersHorizontal,
  IconActivity as Activity, IconCpu as Cpu, IconShieldCheck as ShieldCheck, IconTerminal as Terminal, 
  IconDeviceDesktop as Monitor, IconChevronRight as ChevronRight, IconStack2 as Layers, IconHelp as HelpCircle,
  IconFileSpreadsheet as FileSpreadsheet, IconPresentation as Presentation, IconPencil as PenTool, 
  IconEdit as Edit3, IconMenu2 as Menu, IconChevronDown as ChevronDown, IconChevronUp as ChevronUp, 
  IconLayoutGrid as Grid, IconSparkles as Sparkle, IconDeviceMobile as Smartphone, IconDownload as Download, 
  IconRefresh as RefreshCw, IconCircleCheck as CheckCircle2, IconAlertCircle as AlertCircle, 
  IconFileSearch as FileSearch, IconLayersIntersect as Layers3, IconEye as Eye, IconDatabase as HardDrive, 
  IconExternalLink as ExternalLink, IconArrowLeft as ArrowLeft, IconFolder as FolderKanban, IconDeviceFloppy as Save, 
  IconChartBar as BarChart2, IconMaximize as Maximize2, IconMinimize as Minimize2, IconHome as Home, IconSearch as Search,
  IconWifi as Wifi, IconWifiOff as WifiOff
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';

import { TabType, AiActionType, AudioSubTabType, AiMessage, ChatMessage, ChatFile, HistoryItem, OcrItem, ChatSession, GoogleUserProfile, MicrosoftUserProfile, SavedProject } from './types';
import { OrbiDocLogo } from './components/OrbiDocLogo';
import { HistoryVault } from './components/HistoryVault';
import { WordEditor } from './components/WordEditor';
import { ExcelSpreadsheet } from './components/ExcelSpreadsheet';
import { PowerPointStudio } from './components/PowerPointStudio';
import { CanvaDesignStudio } from './components/CanvaDesignStudio';
import { ImageGeneratorStudio } from './components/ImageGeneratorStudio';
import { CleanMarkdown } from './components/CleanMarkdown';
import { CustomPdfExportModal } from './components/CustomPdfExportModal';
import { ThemeFontConfig } from './components/ThemeFontConfig';
import { GoogleProfileBadge } from './components/GoogleProfileBadge';
import { ChatHistoryVault } from './components/ChatHistoryVault';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { OfficeSuiteHub } from './components/OfficeSuiteHub';
import { OcrPreviewWorkspace } from './components/OcrPreviewWorkspace';
import { ProjectsHub } from './components/ProjectsHub';
import { BrowserGuideModal } from './components/BrowserGuideModal';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { HomeDashboard } from './components/HomeDashboard';
import { BottomNavBar } from './components/BottomNavBar';
import { FabMenuSheet } from './components/FabMenuSheet';
import { getStoredGoogleUser } from './services/googleAuthDrive';
import { getStoredMicrosoftUser } from './services/microsoftAuthOffice';
import { cleanAsterisks, optimizeLocalCR } from './lib/cleanText';
import { processFileOcr, OcrOptions } from './lib/ocrEngine';
import { saveDocumentToFirestore, FirestoreDocument } from './services/firebase';
import { sendToVercel, sendToVercelStream } from './api/chat';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// AI Engines supported with flagship Gemini and ChatGPT (GPT-4o) models
const ENGINES = [
  { id: 'gemini-flash', provider: 'gemini', model: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', emoji: '💎', description: 'Google • Ultra-rápido & Multimodal', tag: 'Google' },
  { id: 'gemini-pro', provider: 'gemini', model: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', emoji: '🔮', description: 'Google • Raciocínio Profundo', tag: 'Google' },
  { id: 'gpt-4o', provider: 'openrouter', model: 'openai/gpt-4o', label: 'ChatGPT (GPT-4o)', emoji: '🤖', description: 'OpenAI • Modelo Flagship', tag: 'OpenAI' },
  { id: 'gpt-4o-mini', provider: 'openrouter', model: 'openai/gpt-4o-mini', label: 'ChatGPT (GPT-4o Mini)', emoji: '⚡', description: 'OpenAI • Ágil & Preciso', tag: 'OpenAI' },
  { id: 'claude', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', emoji: '🎯', description: 'Anthropic • Escrita Refinada', tag: 'Anthropic' },
  { id: 'deepseek', provider: 'openrouter', model: 'deepseek/deepseek-chat', label: 'DeepSeek V3', emoji: '🧠', description: 'DeepSeek • Código & Lógica', tag: 'DeepSeek' },
  { id: 'groq', provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B', emoji: '⚡', description: 'Groq • Velocidade Extrema', tag: 'Groq' },
];

// Alphabetically ordered Languages (pt-br, inglês, mandarim, japonês, russo, coreano, espanhol, chinês, etc)
const LANGUAGES = [
  { code: 'de', name: 'Alemão' },
  { code: 'ar', name: 'Árabe' },
  { code: 'zh-CN', name: 'Chinês / Mandarim (Simplificado)' },
  { code: 'zh-TW', name: 'Chinês / Mandarim (Tradicional)' },
  { code: 'ko', name: 'Coreano' },
  { code: 'es', name: 'Espanhol' },
  { code: 'fr', name: 'Francês' },
  { code: 'en', name: 'Inglês' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: 'Japonês' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'ru', name: 'Russo' },
];

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'];

// Tool Categories Structure for Clean Organized Navigation
const CATEGORIES = [
  {
    id: 'start',
    title: 'Início & Dashboard',
    icon: Home,
    tools: [
      { id: 'home' as TabType, label: 'Início (Dashboard)', icon: Home, desc: 'Painel Inteligente e Ações Rápidas' },
    ],
  },
  {
    id: 'docs',
    title: 'Documentos & Office Pro',
    icon: FileText,
    tools: [
      { id: 'projects' as TabType, label: 'Meus Projetos (Canva)', icon: FolderKanban, desc: 'Painel Estilo Canva de Projetos Salvos' },
      { id: 'canva' as TabType, label: 'Canva Studio', icon: PenTool, desc: 'Design Visual Studio' },
      { id: 'office' as TabType, label: 'Central Office 365', icon: Grid, desc: 'Hub Microsoft Office & Importação' },
      { id: 'excel' as TabType, label: 'Excel Pro', icon: FileSpreadsheet, desc: 'Planilhas & Fórmulas' },
      { id: 'powerpoint' as TabType, label: 'PowerPoint Pro', icon: Presentation, desc: 'Apresentações IA' },
      { id: 'word' as TabType, label: 'Word Pro', icon: Edit3, desc: 'Editor DOCX completo' },
    ],
  },
  {
    id: 'vault',
    title: 'Histórico & Registros',
    icon: History,
    tools: [
      { id: 'analytics' as TabType, label: 'Analytics Dashboard', icon: BarChart2, desc: 'Métricas, gráficos e logs de exportação em lote' },
      { id: 'history' as TabType, label: 'Histórico Vault', icon: History, desc: 'Registro de atividades' },
    ],
  },
  {
    id: 'ai',
    title: 'Inteligência Artificial',
    icon: Sparkles,
    tools: [
      { id: 'compare' as TabType, label: 'Arena de Modelos', icon: SplitSquareHorizontal, desc: 'Compare Gemini, DeepSeek e Claude' },
      { id: 'chat' as TabType, label: 'Assistente IA', icon: Bot, desc: 'Chat interativo com arquivos' },
      { id: 'extract' as TabType, label: 'Extrator OCR Pro', icon: FileText, desc: 'Digitalize PDF e imagens com preview & tags' },
      { id: 'ai' as TabType, label: 'Studio de Texto', icon: Sparkles, desc: 'Traduzir, resumir e corrigir' },
    ],
  },
  {
    id: 'media',
    title: 'Mídia & Voz',
    icon: Palette,
    tools: [
      { id: 'audio' as TabType, label: 'Audio Lab', icon: Volume2, desc: 'Sintetizador e transcrição de áudio' },
      { id: 'image' as TabType, label: 'Gerador Visual', icon: ImageIcon, desc: 'Crie imagens incríveis' },
    ],
  },
];

// File Text Extractor Helper
export async function extractTextFromFile(file: File, onProgress?: (p: number) => void): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (IMAGE_EXTENSIONS.includes(ext)) {
    const result = await Tesseract.recognize(file, 'por+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    return result.data.text.trim();
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    if (onProgress) onProgress(100);
    return file.text();
  }

  if (ext === 'pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100));
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((s: any) => s.str).join(' ') + '\n\n';
      }
      return text.trim() || '[PDF sem texto editável extraível]';
    } catch {
      return '[Erro no arquivo PDF]';
    }
  }

  if (ext === 'docx') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (onProgress) onProgress(100);
      return result.value;
    } catch {
      return '[Erro ao ler arquivo DOCX]';
    }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = xlsx.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (onProgress) onProgress(100);
      return xlsx.utils.sheet_to_csv(ws);
    } catch {
      return '[Erro ao ler Planilha Excel]';
    }
  }

  if (onProgress) onProgress(100);
  return file.text();
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [activeDocumentTitle, setActiveDocumentTitle] = useState<string>('Novo Documento Sem Título');
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    try {
      const saved = localStorage.getItem('orbidoc_projects_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      {
        id: 'proj-1',
        title: 'Relatório Técnico e Proposta Comercial 2026',
        type: 'word',
        createdAt: new Date().toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        previewSnippet: 'Proposta de prestação de serviços com cronograma, orçamento detalhado e análise de riscos...',
        thumbnailColor: 'from-blue-600 to-indigo-700',
        tags: ['Comercial', 'Relatório', 'DOCX']
      },
      {
        id: 'proj-2',
        title: 'Balanço Financeiro & Fluxo de Caixa Pro',
        type: 'excel',
        createdAt: new Date().toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        previewSnippet: 'Planilha com fórmulas de SOMA, MÉDIA, projeção de receita trimestral e controle de custos.',
        thumbnailColor: 'from-emerald-600 to-teal-700',
        tags: ['Financeiro', 'Excel', 'XLSX']
      },
      {
        id: 'proj-3',
        title: 'Apresentação Executiva - Pitch de Vendas',
        type: 'powerpoint',
        createdAt: new Date().toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        previewSnippet: 'Deck de 10 slides com capa impactante, indicadores chave de desempenho e visão estratégica.',
        thumbnailColor: 'from-amber-500 to-orange-600',
        tags: ['Apresentação', 'Slides', 'PPTX']
      }
    ];
  });
  const [activeCategory, setActiveCategory] = useState<string>('start');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);

  // PWA Install State & Listener
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showNotification = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleTriggerInstall = useCallback(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          showNotification('OrbiDoc instalado com sucesso!', 'success');
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowBrowserGuide(true);
    }
  }, [deferredPrompt, showNotification]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isThemeFontOpen, setIsThemeFontOpen] = useState(false);
  const [showAiModelSheet, setShowAiModelSheet] = useState(false);

  // Capture PWA Install event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      showNotification('OrbiDoc foi instalado no seu dispositivo com sucesso!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Online/Offline PWA Listener
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showNotification('Conexão com a internet reestabelecida!', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showNotification('Modo Offline ativado. O app continuará funcionando via cache PWA.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard Shortcuts & Command Palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K or Cmd + K: Open Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      // Ctrl + Shift + L: Toggle theme
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
      }
      // Escape: Close active modals
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowShortcutsModal(false);
        setShowSettings(false);
        setShowInstallModal(false);
        setShowBrowserGuide(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Google & Microsoft User Profile States
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [msUser, setMsUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());

  // Auto-Save Engine State & Firestore Integration
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('orbidoc_autosave_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [autoSaveDelayMs, setAutoSaveDelayMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('orbidoc_autosave_delay');
      return saved ? parseInt(saved, 10) : 5000;
    } catch {
      return 5000;
    }
  });

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('orbidoc_autosave_enabled', JSON.stringify(autoSaveEnabled));
  }, [autoSaveEnabled]);

  useEffect(() => {
    localStorage.setItem('orbidoc_autosave_delay', autoSaveDelayMs.toString());
  }, [autoSaveDelayMs]);

  const handleForceAutoSave = useCallback(async () => {
    if (!autoSaveEnabled) return;
    setAutoSaveStatus('saving');
    try {
      const now = new Date();
      const docPayload: FirestoreDocument = {
        id: activeProject?.id || `doc_${Date.now()}`,
        title: activeDocumentTitle || 'Documento Sem Título',
        content: activeDocumentTitle,
        docType: activeTab,
        userEmail: googleUser?.email || msUser?.email || 'usuario@orbidoc.com',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      localStorage.setItem('orbidoc_last_autosave', JSON.stringify(docPayload));
      await saveDocumentToFirestore(docPayload);

      setLastSavedAt(now);
      setAutoSaveStatus('saved');
      showNotification('Documento auto-salvo com sucesso no Firestore!', 'success');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (err) {
      console.warn('AutoSave error:', err);
      setAutoSaveStatus('error');
    }
  }, [autoSaveEnabled, activeProject, activeDocumentTitle, activeTab, googleUser, msUser, showNotification]);

  // Debounced Auto-Save trigger
  useEffect(() => {
    if (!autoSaveEnabled) return;

    setAutoSaveStatus('pending');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const now = new Date();
        const docPayload: FirestoreDocument = {
          id: activeProject?.id || `doc_${Date.now()}`,
          title: activeDocumentTitle || 'Documento Sem Título',
          content: activeDocumentTitle,
          docType: activeTab,
          userEmail: googleUser?.email || msUser?.email || 'usuario@orbidoc.com',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        localStorage.setItem('orbidoc_last_autosave', JSON.stringify(docPayload));
        await saveDocumentToFirestore(docPayload);

        setLastSavedAt(now);
        setAutoSaveStatus('saved');

        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (err) {
        console.warn('AutoSave error:', err);
        setAutoSaveStatus('error');
      }
    }, autoSaveDelayMs);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [activeDocumentTitle, activeTab, activeProject, autoSaveEnabled, autoSaveDelayMs, googleUser, msUser]);

  // Custom PDF Export Modal State
  const [isCustomPdfOpen, setIsCustomPdfOpen] = useState(false);
  const [pdfExportText, setPdfExportText] = useState('');
  const [pdfExportTitle, setPdfExportTitle] = useState('Documento OrbiDoc');

  // Chat Sessions History State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('orbidoc_chat_sessions') || localStorage.getItem('orbidoc_chat_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      }
      return [];
    } catch {
      return [];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatSubTab, setChatSubTab] = useState<'active' | 'history'>('active');

  const openCustomPdf = (text: string, title = 'Documento OrbiDoc') => {
    setPdfExportText(text);
    setPdfExportTitle(title);
    setIsCustomPdfOpen(true);
  };

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('docutools_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light'; // Default to clean light theme for better accessibility
  });

  useEffect(() => {
    localStorage.setItem('docutools_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Keep active category in sync with active tab
  useEffect(() => {
    for (const cat of CATEGORIES) {
      if (cat.tools.some((t) => t.id === activeTab)) {
        setActiveCategory(cat.id);
        break;
      }
    }
  }, [activeTab]);

  // History state
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('docutools_history_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveHistoryItem = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toISOString(),
    };
    setHistoryItems((prev) => {
      const updated = [newItem, ...prev].slice(0, 100);
      localStorage.setItem('docutools_history_v1', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllHistory = () => {
    if (window.confirm('Tem certeza que deseja apagar todo o histórico de atividades?')) {
      setHistoryItems([]);
      localStorage.removeItem('docutools_history_v1');
      showNotification('Histórico limpo com sucesso.');
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistoryItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      localStorage.setItem('docutools_history_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    switch (item.type) {
      case 'ocr':
        setExtractedText(item.details || item.summary);
        setFileName(item.title);
        setActiveTab('extract');
        break;
      case 'chat':
        setChatInput(item.summary);
        setActiveTab('chat');
        break;
      case 'ai':
        setAiText(item.summary);
        if (item.details) setAiResult(item.details);
        setActiveTab('ai');
        break;
      case 'image':
        setImagePrompt(item.summary);
        if (item.mediaUrl) setGeneratedImage(item.mediaUrl);
        setActiveTab('image');
        break;
      case 'audio':
        setTtsText(item.summary);
        setSttResult(item.details || item.summary);
        setActiveTab('audio');
        break;
      case 'compare':
        setComparePrompt(item.summary);
        setActiveTab('compare');
        break;
    }
    showNotification(`Item restaurado para a aba ${item.type.toUpperCase()}`);
  };

  // Engines
  const [translationEngine, setTranslationEngine] = useState(() => localStorage.getItem('docutools_engine') || 'gemini');
  const currentEngine = ENGINES.find((e) => e.id === translationEngine) || ENGINES[0];

  // Google Drive & Enhanced OCR state
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState<string>('por+eng');
  const [ocrForcePdfOcr, setOcrForcePdfOcr] = useState<boolean>(false);
  const [ocrEnhanceContrast, setOcrEnhanceContrast] = useState<boolean>(true);
  const [viewingChatFileText, setViewingChatFileText] = useState<ChatFile | null>(null);

  // OCR state
  const [ocrList, setOcrList] = useState<OcrItem[]>([]);
  const [expandedOcrId, setExpandedOcrId] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isMonospace, setIsMonospace] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatAbortControllerRef = useRef<AbortController | null>(null);

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      showNotification('Síntese de voz não suportada neste navegador.', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#_`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
    showNotification('Reproduzindo resposta em áudio...');
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Arena state
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareResults, setCompareResults] = useState<any[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  // AI Text state
  const [targetLang, setTargetLang] = useState('en');
  const [aiText, setAiText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isAiWorking, setIsAiWorking] = useState(false);
  const [aiAction, setAiAction] = useState<AiActionType>('translate');

  // Image state
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Audio state
  const [audioSubTab, setAudioSubTab] = useState<AudioSubTabType>('tts');
  const [ttsText, setTtsText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sttResult, setSttResult] = useState('');
  const recognitionRef = useRef<any>(null);

  const handleOpenProject = useCallback((project: SavedProject) => {
    setActiveProject(project);
    setActiveDocumentTitle(project.title);
    setActiveTab(project.type);
    showNotification(`Projeto "${project.title}" aberto em página dedicada!`);
  }, [showNotification]);

  const handleCreateNewProject = useCallback((type: 'word' | 'excel' | 'powerpoint' | 'canva' | 'extract' | 'chat') => {
    const labels: Record<string, string> = {
      word: 'Novo Documento Word Pro',
      excel: 'Nova Planilha Excel Pro',
      powerpoint: 'Nova Apresentação PowerPoint',
      canva: 'Novo Design Canva Studio',
      extract: 'Novo Escaneamento OCR',
      chat: 'Novo Chat IA'
    };
    const title = `${labels[type] || 'Novo Projeto'} ${new Date().toLocaleDateString('pt-BR')}`;
    setActiveDocumentTitle(title);
    setActiveProject(null);
    setActiveTab(type as TabType);
    showNotification(`Criado: ${title}`);
  }, [showNotification]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => setShowSplash(false), 400);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('docutools_engine', translationEngine);
  }, [translationEngine]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Copiado para a área de transferência!');
    } catch {
      showNotification('Erro ao copiar.', 'error');
    }
  };

  const exportAsTxt = (text: string, name: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${name || 'documento'}.txt`);
    showNotification('Exportado como TXT');
  };

  const exportAsDocx = async (text: string, name: string) => {
    const doc = new Document({
      sections: [{ properties: {}, children: text.split('\n').map((line) => new Paragraph({ children: [new TextRun(line)] })) }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${name || 'documento'}.docx`);
    showNotification('Exportado como DOCX');
  };

  const exportAsPdf = (text: string, name: string) => {
    const pdf = new jsPDF();
    const lines = pdf.splitTextToSize(text, 180);
    let y = 15;
    lines.forEach((line: string) => {
      if (y > 280) {
        pdf.addPage();
        y = 15;
      }
      pdf.text(line, 15, y);
      y += 7;
    });
    pdf.save(`${name || 'documento'}.pdf`);
    showNotification('Exportado como PDF');
  };

  const exportAsMd = (text: string, name: string) => {
    const mdContent = text.startsWith('#') ? text : `# ${name || 'Documento OrbiDoc'}\n\n${text}`;
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${name || 'documento'}.md`);
    showNotification('Exportado como Markdown (.md)');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    const newItems: OcrItem[] = fileArray.map((file) => ({
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      fileName: file.name,
      fileSize: file.size,
      text: '',
      status: 'pending',
      progress: 0,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }));

    setOcrList((prev) => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setExpandedOcrId(newItems[0].id);
    }
    setIsProcessing(true);

    let completedCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const item = newItems[i];

      setFileName(file.name);

      setOcrList((prev) =>
        prev.map((o) => (o.id === item.id ? { ...o, status: 'processing', progress: 0 } : o))
      );

      try {
        const text = await processFileOcr(
          file,
          {
            language: ocrLanguage,
            enhanceContrast: ocrEnhanceContrast,
            forceOcrPdf: ocrForcePdfOcr,
          },
          (p) => {
            setProgress(p.progress);
            setOcrList((prev) =>
              prev.map((o) => (o.id === item.id ? { ...o, progress: p.progress } : o))
            );
          }
        );

        setOcrList((prev) =>
          prev.map((o) => (o.id === item.id ? { ...o, status: 'completed', text, progress: 100 } : o))
        );

        setExtractedText((prevText) => (prevText ? `${prevText}\n\n--- ${file.name} ---\n${text}` : text));
        completedCount++;

        saveHistoryItem({
          type: 'ocr',
          title: file.name,
          summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          details: text,
        });
      } catch (err) {
        console.error(err);
        setOcrList((prev) =>
          prev.map((o) =>
            o.id === item.id
              ? { ...o, status: 'error', error: 'Falha ao processar arquivo.', progress: 100 }
              : o
          )
        );
      }
    }

    setIsProcessing(false);
    setProgress(100);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (completedCount > 0) {
      showNotification(`Leitura de ${completedCount} arquivo(s) concluída com sucesso!`);
    } else {
      showNotification('Falha no processamento dos arquivos.', 'error');
    }
  };

  const updateOcrItemText = (id: string, newText: string) => {
    setOcrList((prev) => prev.map((o) => (o.id === id ? { ...o, text: newText } : o)));
  };

  const removeOcrItem = (id: string) => {
    setOcrList((prev) => prev.filter((o) => o.id !== id));
  };

  const clearAllOcrItems = () => {
    setOcrList([]);
    setExtractedText('');
    showNotification('Lista OCR limpa!');
  };

  const copyAllOcrText = () => {
    const completed = ocrList.filter((o) => o.status === 'completed' && o.text);
    if (completed.length === 0) {
      showNotification('Nenhum texto extraído para copiar.', 'error');
      return;
    }
    const combined = completed.map((o) => `=== ${o.fileName} ===\n${o.text}`).join('\n\n');
    copyToClipboard(combined);
  };

  const exportAllOcr = (format: 'txt' | 'docx' | 'pdf') => {
    const completed = ocrList.filter((o) => o.status === 'completed' && o.text);
    if (completed.length === 0) {
      showNotification('Nenhum texto extraído para exportar.', 'error');
      return;
    }
    const combined = completed.map((o) => `=== ${o.fileName} ===\n${o.text}`).join('\n\n');
    const filename = `orbidoc_ocr_lote_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'txt') exportAsTxt(combined, filename);
    if (format === 'docx') exportAsDocx(combined, filename);
    if (format === 'pdf') exportAsPdf(combined, filename);
  };

  const handleSendOcrItemToChat = (item: OcrItem) => {
    const chatFile: ChatFile = {
      name: item.fileName,
      type: 'text/plain',
      content: item.text,
    };
    setChatFiles((prev) => [...prev, chatFile]);
    setActiveTab('chat');
    showNotification(`Documento "${item.fileName}" anexado ao Chat! Digite sua pergunta.`);
  };

  const handleGoogleDriveFileSelect = async (file: File) => {
    if (activeTab === 'chat') {
      showNotification(`Importando "${file.name}" do Google Drive...`);
      try {
        const text = await processFileOcr(file, { language: ocrLanguage, enhanceContrast: true });
        const chatFile: ChatFile = {
          name: file.name,
          type: file.type || 'application/pdf',
          content: text,
        };
        setChatFiles((prev) => [...prev, chatFile]);
        showNotification(`"${file.name}" do Google Drive anexado ao Chat!`);
      } catch {
        showNotification(`Erro ao importar "${file.name}"`, 'error');
      }
    } else {
      setActiveTab('extract');
      showNotification(`Processando "${file.name}" do Google Drive para OCR...`);
      const newOcrItem: OcrItem = {
        id: Date.now() + Math.random().toString(36).substring(2, 7),
        fileName: file.name,
        fileSize: file.size,
        text: '',
        status: 'processing',
        progress: 0,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setOcrList((prev) => [newOcrItem, ...prev]);
      setExpandedOcrId(newOcrItem.id);
      setIsProcessing(true);

      try {
        const text = await processFileOcr(
          file,
          {
            language: ocrLanguage,
            enhanceContrast: ocrEnhanceContrast,
            forceOcrPdf: ocrForcePdfOcr,
          },
          (p) => {
            setProgress(p.progress);
            setOcrList((prev) =>
              prev.map((o) => (o.id === newOcrItem.id ? { ...o, progress: p.progress } : o))
            );
          }
        );

        setOcrList((prev) =>
          prev.map((o) => (o.id === newOcrItem.id ? { ...o, status: 'completed', text, progress: 100 } : o))
        );
        setExtractedText((prevText) => (prevText ? `${prevText}\n\n--- ${file.name} ---\n${text}` : text));
        showNotification(`"${file.name}" do Google Drive lido com sucesso!`);
      } catch {
        setOcrList((prev) =>
          prev.map((o) => (o.id === newOcrItem.id ? { ...o, status: 'error', error: 'Falha ao ler.' } : o))
        );
        showNotification(`Erro no processamento de "${file.name}"`, 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        showNotification(`Lendo ${file.name}...`);
        const extractedText = await processFileOcr(
          file,
          { language: ocrLanguage, enhanceContrast: true },
          (p) => {
            if (p.statusText) showNotification(`[${file.name}] ${p.statusText}`);
          }
        );
        let preview = '';
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          preview = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }
        setChatFiles((prev) => [
          ...prev,
          { name: file.name, type: file.type || 'application/pdf', content: extractedText, preview },
        ]);
        showNotification(`"${file.name}" anexado ao Chat!`);
      } catch {
        showNotification(`Erro ao anexar ${file.name}`, 'error');
      }
    }
    e.target.value = '';
  };

  const handleStopChatStream = () => {
    if (chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
      chatAbortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsChatLoading(false);
    showNotification('Geração de resposta interrompida.');
  };

  const sendChatMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim() && chatFiles.length === 0) return;

    const userMsgContent = textToSend;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      files: chatFiles.length > 0 ? [...chatFiles] : undefined,
      timestamp: new Date(),
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    if (!customPrompt) setChatInput('');
    setChatFiles([]);
    setIsChatLoading(true);
    setIsStreaming(true);

    const abortController = new AbortController();
    chatAbortControllerRef.current = abortController;

    try {
      let prompt = userMsgContent;
      if (userMessage.files) {
        for (const file of userMessage.files) {
          prompt += `\n\n[Arquivo Anexo (${file.name})]:\n${file.content}\n[Fim anexo]`;
        }
      }

      const messages: AiMessage[] = [
        { 
          role: 'system', 
          content: 'Você é o assistente inteligente de análise documental e criação de conteúdo do OrbiDoc. Responda com clareza, autoridade técnica e excelente estruturação em português. Utilize Markdown limpo com títulos, marcadores organizados e blocos de código bem formatados com identificação de linguagem sempre que relevante.' 
        },
        ...chatMessages.slice(-10).map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: prompt },
      ];

      let fullAnswer = '';

      try {
        await sendToVercelStream(
          currentEngine.provider,
          currentEngine.model,
          messages,
          (chunk) => {
            fullAnswer += chunk;
            setChatMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullAnswer } : m))
            );
          },
          { signal: abortController.signal, files: userMessage.files }
        );
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError') {
          return;
        }
        // Fallback to non-streaming if SSE stream fails or is blocked
        if (!fullAnswer) {
          const fallbackResponse = await sendToVercel(
            currentEngine.provider, 
            currentEngine.model, 
            messages, 
            undefined, 
            userMessage.files
          );
          fullAnswer = fallbackResponse;
          setChatMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullAnswer } : m))
          );
        }
      }

      if (fullAnswer) {
        saveHistoryItem({
          type: 'chat',
          title: `Chat (${currentEngine.label})`,
          summary: userMsgContent || 'Consulta com arquivo anexo',
          details: fullAnswer,
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showNotification(err.message || 'Falha na resposta do assistente.', 'error');
        setChatMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
      }
    } finally {
      setIsChatLoading(false);
      setIsStreaming(false);
      chatAbortControllerRef.current = null;
    }
  };

  const handleRegenerateLastResponse = async () => {
    const lastUserMsg = [...chatMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) {
      showNotification('Nenhuma mensagem anterior para regerar.', 'error');
      return;
    }
    // Remove last assistant message if present
    setChatMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex].role === 'assistant') {
        return prev.slice(0, lastIndex);
      }
      return prev;
    });
    await sendChatMessage(lastUserMsg.content);
  };

  const handleAiAction = async () => {
    if (!aiText.trim()) {
      showNotification('Insira o texto para processar.', 'error');
      return;
    }
    setIsAiWorking(true);
    setAiResult('');
    try {
      const targetLangName = LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
      const prompts: Record<AiActionType, string> = {
        translate: `Traduza o texto para ${targetLangName} preservando a formatação:`,
        summarize: 'Elabore um resumo conciso com os pontos-chave:',
        grammar: 'Corrija erros ortográficos e gramaticais de forma profissional:',
        improve: 'Aprimore a clareza, tom e estrutura do texto:',
        expand: 'Expanda o texto adicionando detalhes explicativos:',
        rewrite: 'Reescreva o texto em linguagem mais clara e refinada:',
      };

      const messages: AiMessage[] = [
        { role: 'system', content: prompts[aiAction] },
        { role: 'user', content: aiText },
      ];

      const response = await sendToVercel(currentEngine.provider, currentEngine.model, messages);
      setAiResult(response);
      showNotification('Processamento concluído!');

      saveHistoryItem({
        type: 'ai',
        title: `Texto IA: ${aiAction.toUpperCase()}`,
        summary: aiText.substring(0, 150) + '...',
        details: response,
      });
    } catch {
      showNotification('Erro no processamento do texto.', 'error');
    } finally {
      setIsAiWorking(false);
    }
  };

  const handleCompare = async () => {
    if (!comparePrompt.trim()) return;
    setIsComparing(true);
    setCompareResults([]);

    const modelsToTest = [
      { id: 'Gemini 3.6', provider: 'gemini', model: 'gemini-3.6-flash' },
      { id: 'DeepSeek V3', provider: 'openrouter', model: 'deepseek/deepseek-chat' },
      { id: 'Claude 3.5', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
    ];

    try {
      const messages: AiMessage[] = [{ role: 'user', content: comparePrompt }];
      const results = await Promise.all(
        modelsToTest.map(async (m) => {
          try {
            const answer = await sendToVercel(m.provider, m.model, messages);
            return { name: m.id, text: answer };
          } catch {
            return { name: m.id, text: `⚠️ Indisponível no momento.` };
          }
        })
      );
      setCompareResults(results);

      saveHistoryItem({
        type: 'compare',
        title: 'Arena de Modelos',
        summary: comparePrompt,
        details: results.map((r) => `[${r.name}]\n${r.text}`).join('\n\n---\n\n'),
      });
    } finally {
      setIsComparing(false);
    }
  };

  const handleTTS = () => {
    if (!ttsText.trim()) {
      showNotification('Insira o texto para ser vocalizado.', 'error');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      showNotification('Erro no sintetizador de voz.', 'error');
    };
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSTT = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      showNotification('Navegador não possui suporte a reconhecimento de áudio.', 'error');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript;
        setSttResult((prev) => {
          const updated = prev + (prev ? ' ' : '') + transcript;
          saveHistoryItem({
            type: 'audio',
            title: 'Transcrição de Áudio (STT)',
            summary: updated,
            details: updated,
          });
          return updated;
        });
      }
    };
    recognition.onerror = () => {
      setIsRecording(false);
    };
    recognition.onend = () => {
      if (isRecording && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsRecording(false);
        }
      }
    };
    recognitionRef.current = recognition;
    setSttResult('');
    recognition.start();
    setIsRecording(true);
    showNotification('Microfone ligado. Pode falar...');
  };

  const handleCreateNewChat = useCallback(() => {
    setActiveSessionId(null);
    setChatMessages([]);
    setChatFiles([]);
    setChatInput('');
    setActiveTab('chat');
    showNotification('Novo chat de IA iniciado com sucesso!');
  }, [showNotification]);

  const handleSelectChatSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id);
    setChatMessages(session.messages || []);
    setActiveTab('chat');
    showNotification(`Sessão "${session.title}" aberta!`);
  }, [showNotification]);

  // Find active tool details
  let activeToolInfo = CATEGORIES[0].tools[0];
  for (const cat of CATEGORIES) {
    const found = cat.tools.find((t) => t.id === activeTab);
    if (found) {
      activeToolInfo = found;
      break;
    }
  }

  // Text stats
  const currentText = activeTab === 'extract' ? extractedText : aiText;
  const wordCount = currentText ? currentText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = currentText ? currentText.length : 0;

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white transition-opacity duration-500">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl mb-6 animate-pulse">
          <OrbiDocLogo size="xl" showText={false} />
        </div>
        <OrbiDocLogo size="lg" showText={true} />
        <p className="text-sm text-slate-400 mt-3 font-medium tracking-wide">Digitalize, Crie e Edite Seus Documentos</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium flex items-center gap-2.5 animate-[slideIn_0.2s_ease] ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {notification.msg}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Configurações da Plataforma</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">APARÊNCIA E TIPOGRAFIA</label>
                <button
                  onClick={() => { setShowSettings(false); setIsThemeFontOpen(true); }}
                  className="w-full py-3 px-4 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Customizar Cores, Fontes e Layout
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">MOTOR DE IA PADRÃO</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {ENGINES.map((engine) => (
                    <button
                      key={engine.id}
                      onClick={() => setTranslationEngine(engine.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        translationEngine === engine.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 text-indigo-900 dark:text-indigo-300 font-medium'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{engine.emoji}</span>
                        <div>
                          <div className="text-xs font-bold">{engine.label}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-500">{engine.description}</div>
                        </div>
                      </div>
                      {translationEngine === engine.id && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme, Font & Auto-Save Customization Modal */}
      <ThemeFontConfig
        isOpen={isThemeFontOpen}
        onClose={() => setIsThemeFontOpen(false)}
        userEmail={googleUser?.email || msUser?.email || 'usuario@orbidoc.com'}
        autoSaveEnabled={autoSaveEnabled}
        setAutoSaveEnabled={setAutoSaveEnabled}
        autoSaveDelayMs={autoSaveDelayMs}
        setAutoSaveDelayMs={setAutoSaveDelayMs}
        autoSaveStatus={autoSaveStatus}
        lastSavedAt={lastSavedAt}
        onForceSave={handleForceAutoSave}
      />

      {/* Custom PDF Export Modal */}
      <CustomPdfExportModal
        isOpen={isCustomPdfOpen}
        onClose={() => setIsCustomPdfOpen(false)}
        initialText={pdfExportText}
        defaultTitle={pdfExportTitle}
        googleUser={googleUser}
        onNotification={showNotification}
      />


      {/* Install / Download App Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <DownloadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Instalar o Aplicativo Nativo OrbiDoc (WebAPK)</h2>
                  <p className="text-xs text-slate-500">Instalação direta no Celular/PC e Download do Projeto</p>
                </div>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
              {/* Option 1: PWA / WebAPK Installation */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    1. Instalar Aplicativo Nativo (WebAPK - Celular e Computador)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir em Nova Aba para Instalar
                    </button>

                    {deferredPrompt && (
                      <button
                        onClick={async () => {
                          deferredPrompt.prompt();
                          const { outcome } = await deferredPrompt.userChoice;
                          if (outcome === 'accepted') {
                            setDeferredPrompt(null);
                            setShowInstallModal(false);
                            showNotification('Instalação do aplicativo iniciada!', 'success');
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5"
                      >
                        <DownloadCloud className="w-4 h-4" />
                        Instalar Aplicativo Agora
                      </button>
                    )}
                  </div>
                </div>

                {/* Important notice when inside iframe */}
                {typeof window !== 'undefined' && window.self !== window.top && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      Aviso sobre 'Criar Atalho' vs 'Instalar App' (iFrame)
                    </div>
                    <p>
                      Você está dentro do quadro incorporado do editor. O Google Chrome <strong>bloqueia instalações de WebAPK em quadros incorporados (iframes)</strong> e exibe apenas "Criar atalho".
                    </p>
                    <p className="font-semibold text-amber-950 dark:text-amber-100">
                      👉 Clique no botão "Abrir em Nova Aba para Instalar" acima! Ao abrir na aba principal, o Chrome liberará o instalador do <strong>WebAPK Nativo</strong> com ícone próprio na sua gaveta de aplicativos.
                    </p>
                  </div>
                )}

                <p className="leading-relaxed">
                  O <strong>OrbiDoc</strong> é configurado com PWA / WebAPK de última geração. No Android, quando você seleciona "Adicionar à tela de início" ou "Instalar", o Google gera automaticamente um <strong>WebAPK nativo</strong> no seu celular com ícone próprio e funcionamento em tela cheia offline!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Android (Chrome)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Na nova aba no Chrome → abra o menu (<strong>⋮</strong>) → toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>. O Android criará o WebAPK automaticamente!
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> iPhone (Safari)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Na nova aba no Safari, toque em <strong>Compartilhar</strong> (quadrado com seta) → Selecione <strong>"Adicionar à Tela de Início"</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5 text-emerald-600" /> PC (Chrome / Edge)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Na nova aba, clique no ícone de tela na barra de endereço (canto direito da URL) → <strong>"Instalar OrbiDoc"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Converter em APK Android (PWABuilder / Web2APK) */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200 text-sm">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  2. Converter em APK Android (.apk / .aab) via PWABuilder / Web2APK
                </div>
                <p className="leading-relaxed">
                  Deseja gerar um pacote <strong>.APK instalável</strong> ou arquivo para publicar na Google Play Store? O OrbiDoc inclui manifesto WebManifest completo, suporte a ícones maskable e Service Worker otimizado.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => {
                      const appUrl = window.location.href;
                      window.open(`https://www.pwabuilder.com/url?url=${encodeURIComponent(appUrl)}`, '_blank');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Gerar APK no PWABuilder
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      showNotification('URL do WebApp copiada para a área de transferência!', 'success');
                    }}
                    className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar URL do App
                  </button>

                  <button
                    onClick={() => {
                      saveAs('/manifest.json', 'orbidoc-manifest.json');
                      showNotification('Manifesto WebManifest baixado com sucesso!');
                    }}
                    className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Manifest.json
                  </button>
                </div>
              </div>

              {/* Option 3: Export ZIP / GitHub */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
                  <Download className="w-4 h-4 text-slate-600" />
                  3. Baixar o Código Fonte Completo (Arquivo ZIP / GitHub)
                </div>
                <p className="leading-relaxed">
                  Se você deseja baixar os arquivos do projeto para abrir e editar no seu computador (VS Code, Node.js) ou compilar seu próprio APK via Android Studio (Trusted Web Activity):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400 pl-1">
                  <li>No menu superior do <strong>Google AI Studio</strong> (canto superior direito da tela).</li>
                  <li>Clique no botão de <strong>Compartilhar / Exportar</strong>.</li>
                  <li>Selecione <strong>"Download ZIP"</strong> para salvar o arquivo compactado com todo o código fonte.</li>
                  <li>Ou escolha <strong>"Export to GitHub"</strong> para salvar diretamente na sua conta do GitHub.</li>
                </ol>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Primary Clean Native Header */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-3 sm:px-4 z-40 flex-shrink-0 shadow-xs relative">
        {/* Left Side: Navigation Menu Toggle & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
            aria-label="Menu"
            title="Menu Principal"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <OrbiDocLogo size="md" showText={true} />
          </div>
        </div>

        {/* Right Side: Clean Search, Online Status & Profile Badge */}
        <div className="flex items-center gap-2">
          {/* Online / Offline Status Badge */}
          <div
            title={isOnline ? 'Conectado à Internet - Sincronizado' : 'Modo Offline - Edições Salvas em Cache Local'}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden md:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Offline (Cache Salvo)</span>
                <span className="md:hidden">Offline</span>
              </>
            )}
          </div>

          <button
            onClick={() => setShowCommandPalette(true)}
            title="Pesquisa Global (Ctrl + K)"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-medium"
          >
            <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline text-slate-500 font-semibold">Pesquisa</span>
          </button>

          <GoogleProfileBadge
            user={googleUser}
            onUserChange={(user) => setGoogleUser(user)}
            msUser={msUser}
            setMsUser={setMsUser}
            onNotification={showNotification}
          />
        </div>
      </header>

      {/* Main Workstation Container */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* PC Sidebar Navigation */}
        <aside className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex-col justify-between p-3 flex-shrink-0 space-y-4 overflow-y-auto">
          <div className="space-y-5">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <cat.icon className="w-3.5 h-3.5" />
                  <span>{cat.title}</span>
                </div>
                {cat.tools.map((tool) => {
                  const ToolIcon = tool.icon;
                  const isActive = activeTab === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTab(tool.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <ToolIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                      <div className="text-left flex-1 min-w-0">
                        <div className="truncate">{tool.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Plataforma Ativa</span>
            </div>
            <div className="text-[10px] truncate">{currentEngine.label}</div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-start"
            >
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
                className="w-72 bg-white dark:bg-slate-900 h-full p-4 space-y-6 overflow-y-auto border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                    <OrbiDocLogo size="md" showText={true} />
                    <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-5">
                    {CATEGORIES.map((cat) => (
                      <div key={cat.id} className="space-y-1">
                        <div className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <cat.icon className="w-3.5 h-3.5" />
                          <span>{cat.title}</span>
                        </div>
                        {cat.tools.map((tool) => {
                          const ToolIcon = tool.icon;
                          const isActive = activeTab === tool.id;
                          return (
                            <button
                              key={tool.id}
                              onClick={() => {
                                setActiveTab(tool.id);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold min-h-[44px] ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-md'
                                  : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40'
                              }`}
                            >
                              <ToolIcon className="w-4 h-4" />
                              <div className="text-left">
                                <div className="font-bold">{tool.label}</div>
                                <div className="text-[10px] opacity-70 font-normal">{tool.desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">
                    OrbiDoc Studio Office — Pronto para Uso
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Canvas View Area - Spacious Full Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-3 sm:p-6 lg:p-8 pb-24 md:pb-8 flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
            
            {/* Active Tool Workspace Render */}

            {/* 0. Home Dashboard */}
            {activeTab === 'home' && (
              <HomeDashboard
                onNavigate={setActiveTab}
                onNewChat={handleCreateNewChat}
                recentHistory={historyItems}
                recentProjects={savedProjects}
                recentChats={chatSessions}
                googleUser={googleUser}
                microsoftUser={msUser}
                activeEngineLabel={currentEngine.label}
              />
            )}

            {/* Dedicated Document Header Bar for standalone editor experience */}
            {['word', 'excel', 'powerpoint', 'canva', 'extract'].includes(activeTab) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm grid grid-cols-1 md:grid-cols-12 items-center gap-3 md:gap-4 mb-2 transition-colors duration-200"
              >
                {/* Left Section: Back to Projects */}
                <div className="md:col-span-3 flex items-center justify-start gap-2">
                  <button
                    onClick={() => setActiveTab('projects')}
                    aria-label="Voltar aos Meus Projetos"
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-200 border border-slate-200/80 dark:border-slate-700 active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-[#1976D2]"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#1976D2] dark:text-[#1E88E5]" aria-hidden="true" />
                    <span className="hidden sm:inline">Voltar aos Projetos</span>
                    <span className="sm:hidden">Voltar</span>
                  </button>
                </div>

                {/* Center Section: Centered Title 'Novo Documento Sem Título' */}
                <div className="md:col-span-6 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center gap-2 w-full max-w-md">
                    {activeTab === 'word' && <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />}
                    {activeTab === 'excel' && <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />}
                    {activeTab === 'powerpoint' && <Presentation className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />}
                    {activeTab === 'canva' && <PenTool className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" aria-hidden="true" />}
                    {activeTab === 'extract' && <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />}

                    <input
                      type="text"
                      value={activeDocumentTitle}
                      onChange={(e) => setActiveDocumentTitle(e.target.value)}
                      placeholder="Novo Documento Sem Título"
                      aria-label="Título do Documento"
                      className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 px-3 py-1 rounded-lg text-[18px] font-bold text-center text-slate-900 dark:text-slate-100 border border-transparent focus:border-[#1976D2] dark:focus:border-[#1E88E5] focus:outline-none transition-all duration-200 w-full"
                    />
                  </div>

                  <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                    Salvo localmente
                  </span>
                </div>

                {/* Right Section: Salvar Projeto and Assistente IA buttons aligned right with uniform spacing */}
                <div className="md:col-span-3 flex items-center justify-end gap-3 w-full">
                  <button
                    onClick={() => {
                      saveHistoryItem({
                        type: 'ocr',
                        title: activeDocumentTitle || 'Novo Documento Sem Título',
                        summary: `Documento [${activeDocumentTitle || 'Novo Documento Sem Título'}] editado no ${activeTab.toUpperCase()}`,
                        details: `Edição em modo de página dedicada.`
                      });
                      showNotification(`Projeto "${activeDocumentTitle || 'Novo Documento Sem Título'}" salvo no Vault!`);
                    }}
                    aria-label="Salvar Projeto"
                    className="px-4 py-2.5 bg-[#1976D2] hover:bg-blue-700 dark:bg-[#1E88E5] dark:hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>Salvar Projeto</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      showNotification('Assistente IA aberto para auxiliar neste documento.');
                    }}
                    aria-label="Abrir Assistente IA"
                    className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    <span>Assistente IA</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* -1. Hub de Projetos (Dashboard Estilo Canva) */}
            {activeTab === 'projects' && (
              <ProjectsHub
                onOpenProject={handleOpenProject}
                onCreateNewProject={handleCreateNewProject}
                showNotification={showNotification}
              />
            )}
            
            {/* 0. Central Office 365 & Microsoft Suite Hub */}
            {activeTab === 'office' && (
              <OfficeSuiteHub
                onOpenTool={(toolId: TabType) => setActiveTab(toolId)}
                msUser={msUser}
                setMsUser={setMsUser}
                showNotification={showNotification}
              />
            )}

            {/* 1. OCR Extrator Pro & Preview Workspace */}
            {activeTab === 'extract' && (
              <OcrPreviewWorkspace
                ocrList={ocrList}
                setOcrList={setOcrList}
                onSendToChat={(text: string) => {
                  setChatInput(text);
                  setActiveTab('chat');
                }}
                onOpenCustomPdf={(text: string, _fileName: string) => {
                  setAiText(text);
                  setActiveTab('ai');
                }}
                showNotification={showNotification}
                setIsGoogleDriveOpen={setIsGoogleDriveOpen}
                exportAsTxt={exportAsTxt}
                exportAsDocx={exportAsDocx}
                exportAsPdf={exportAsPdf}
                exportAsMd={exportAsMd}
              />
            )}

            {/* 2. Word Pro */}
            {activeTab === 'word' && (
              <WordEditor
                onSaveToHistory={saveHistoryItem}
                showNotification={showNotification}
                engineProvider={currentEngine.provider}
                engineModel={currentEngine.model}
              />
            )}

            {/* 3. Excel Pro */}
            {activeTab === 'excel' && (
              <ExcelSpreadsheet
                onSaveToHistory={saveHistoryItem}
                showNotification={showNotification}
                engineProvider={currentEngine.provider}
                engineModel={currentEngine.model}
              />
            )}

            {/* 4. PowerPoint Pro */}
            {activeTab === 'powerpoint' && (
              <PowerPointStudio
                onSaveToHistory={saveHistoryItem}
                showNotification={showNotification}
                engineProvider={currentEngine.provider}
                engineModel={currentEngine.model}
              />
            )}

            {/* 5. Canva Studio */}
            {activeTab === 'canva' && (
              <CanvaDesignStudio
                onSaveToHistory={saveHistoryItem}
                showNotification={showNotification}
                engineProvider={currentEngine.provider}
                engineModel={currentEngine.model}
              />
            )}

            {/* 6. Assistente IA Chat */}
            {activeTab === 'chat' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-130px)]">
                {/* Header & Sub-Tabs */}
                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Assistente IA Interativo</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {currentEngine.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{currentEngine.label} • {currentEngine.description}</p>
                    </div>
                  </div>

                  {/* Engine Selector Pill */}
                  <button
                    onClick={() => setShowAiModelSheet(true)}
                    className="px-3 py-1.5 bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 transition-all border border-slate-300/40 dark:border-slate-700/40 active:scale-95"
                    title="Trocar Modelo de IA (Gemini, ChatGPT, Claude, DeepSeek...)"
                  >
                    <span className="text-sm">{currentEngine.emoji}</span>
                    <span>{currentEngine.label}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Sub-Tabs: Conversa Ativa vs Antigos Chats */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl">
                      <button
                        onClick={() => setChatSubTab('active')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          chatSubTab === 'active'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        Conversa Ativa
                      </button>
                      <button
                        onClick={() => setChatSubTab('history')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          chatSubTab === 'history'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        Antigos Chats
                        {chatSessions.length > 0 && (
                          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px]">
                            {chatSessions.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {chatSubTab === 'active' && chatMessages.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const fullChatText = chatMessages.map(m => `${m.role === 'user' ? 'Usuário' : 'OrbiDoc'}: ${cleanAsterisks(m.content)}`).join('\n\n');
                            openCustomPdf(fullChatText, 'Conversa OrbiDoc IA');
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-indigo-100 transition-all"
                        >
                          <FileOutput className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          onClick={() => setChatMessages([])}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-rose-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {chatSubTab === 'history' ? (
                  <div className="flex-1 overflow-y-auto p-4">
                    <ChatHistoryVault
                      sessions={chatSessions}
                      activeSessionId={activeSessionId}
                      onSelectSession={(sessionId) => {
                        const target = chatSessions.find((s) => s.id === sessionId);
                        if (target) {
                          setChatMessages(target.messages);
                          setActiveSessionId(target.id);
                          setChatSubTab('active');
                          showNotification('Sessão de chat restaurada!');
                        }
                      }}
                      onDeleteSession={(id) => {
                        const updated = chatSessions.filter(s => s.id !== id);
                        setChatSessions(updated);
                        localStorage.setItem('orbidoc_chat_sessions', JSON.stringify(updated));
                        showNotification('Sessão removida do histórico.');
                      }}
                      onClearAllSessions={() => {
                        setChatSessions([]);
                        localStorage.removeItem('orbidoc_chat_sessions');
                        localStorage.removeItem('orbidoc_chat_sessions');
                        showNotification('Histórico de chats limpo com sucesso.');
                      }}
                      onExportPdf={(sessionText, title) => {
                        openCustomPdf(sessionText, title);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    {/* Messages Box */}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-slate-100/40 dark:bg-slate-950/40 text-xs">
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-3 py-4 max-w-lg mx-auto">
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <Bot className="w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">Como posso ajudar você hoje?</h3>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-1">
                            {[
                              { text: '📊 Resumir documento ou PDF', prompt: 'Por favor, faça um resumo executivo estruturado com os pontos principais do documento.' },
                              { text: '✉️ Escrever e-mail corporativo', prompt: 'Escreva um e-mail corporativo formal e bem estruturado abordando...' },
                              { text: '📝 Criar ata de reunião', prompt: 'Crie uma ata de reunião organizada em tópicos: participantes, decisões tomadas e tarefas pendentes.' },
                              { text: '🔍 Extrair insights e ações', prompt: 'Analise o texto e extraia os principais insights, alertas e ações recomendadas.' }
                            ].map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => sendChatMessage(chip.prompt)}
                                className="text-left px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 transition-all hover:shadow-xs flex items-center justify-between group"
                              >
                                <span className="truncate">{chip.text}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-1" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white shadow-md'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                              }`}
                            >
                              {msg.files && msg.files.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2 border-b border-white/20 dark:border-slate-800">
                                  {msg.files.map((f, i) => (
                                    <span key={i} className="text-[11px] bg-slate-900/10 dark:bg-slate-950 px-2.5 py-1 rounded-lg text-indigo-100 dark:text-indigo-300 flex items-center gap-1.5 border border-white/10 dark:border-slate-800">
                                      <Paperclip className="w-3.5 h-3.5" />
                                      {f.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {msg.role === 'assistant' ? (
                                <div>
                                  {msg.content === '' && isChatLoading ? (
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 py-2">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span className="font-semibold text-xs">Digitando resposta em tempo real...</span>
                                    </div>
                                  ) : (
                                    <CleanMarkdown content={msg.content} />
                                  )}

                                  {msg.content !== '' && (
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => speakText(msg.content)}
                                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2 py-1 rounded-md transition-colors"
                                          title="Ouvir em áudio"
                                        >
                                          <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> Ouvir
                                        </button>
                                        <button
                                          onClick={() => copyToClipboard(cleanAsterisks(msg.content))}
                                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors"
                                        >
                                          <Copy className="w-3.5 h-3.5" /> Copiar
                                        </button>
                                        <button
                                          onClick={handleRegenerateLastResponse}
                                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors"
                                          title="Regerar resposta"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" /> Regerar
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => exportAsMd(msg.content, 'Resposta_OrbiDoc')}
                                          className="hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold px-2 py-1 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-md transition-colors"
                                        >
                                          <FileOutput className="w-3.5 h-3.5" /> .md
                                        </button>
                                        <button
                                          onClick={() => openCustomPdf(msg.content, 'Resposta OrbiDoc IA')}
                                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition-colors"
                                        >
                                          <FileOutput className="w-3.5 h-3.5" /> PDF
                                        </button>
                                        <button
                                          onClick={() => {
                                            setExtractedText(msg.content);
                                            setActiveTab('word');
                                            showNotification('Texto enviado para o Word Pro!');
                                          }}
                                          className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                                          title="Abrir no Word Editor Pro"
                                        >
                                          <FileText className="w-3.5 h-3.5" /> Word Pro
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}

                      {isChatLoading && !isStreaming && (
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-start"
                        >
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl flex items-center gap-2.5 text-slate-500 shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                            <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Consultando modelo {currentEngine.label}...</span>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Attached Files Bar */}
                    {chatFiles.length > 0 && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 px-3">
                        {chatFiles.map((file, idx) => (
                          <span key={idx} className="text-xs bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                            <button onClick={() => setViewingChatFileText(file)} className="hover:text-indigo-600 dark:hover:text-indigo-300" title="Ver texto lido do arquivo">
                              <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                            <button onClick={() => setChatFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-500" title="Remover anexo">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Unified Input Bar estilo ChatGPT */}
                    <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="max-w-4xl mx-auto bg-slate-100/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-1.5 px-3 flex items-center gap-2 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <input
                          ref={chatFileInputRef}
                          type="file"
                          multiple
                          onChange={handleChatFileUpload}
                          className="hidden"
                          accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt"
                        />

                        {/* Attachment Options */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => chatFileInputRef.current?.click()}
                            title="Anexar arquivo local (PDF, Imagem, Doc)"
                            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setIsGoogleDriveOpen(true)}
                            title="Google Drive"
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 rounded-xl transition-colors hidden sm:flex"
                          >
                            <HardDrive className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Text Area / Input */}
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                          placeholder="Digite uma mensagem..."
                          className="flex-1 bg-transparent py-2 px-1 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                        />

                        {/* Voice & Send Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setActiveTab('audio');
                              showNotification('Gravador de áudio e transcrição aberto.');
                            }}
                            title="Gravação de Áudio e Voz"
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                          >
                            <Mic className="w-4 h-4" />
                          </button>

                          {isStreaming ? (
                            <button
                              onClick={handleStopChatStream}
                              title="Interromper geração"
                              className="p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-xs"
                            >
                              <StopCircle className="w-4 h-4 animate-pulse" />
                            </button>
                          ) : (
                            <button
                              onClick={() => sendChatMessage()}
                              disabled={isChatLoading || (!chatInput.trim() && chatFiles.length === 0)}
                              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-30 transition-all shadow-xs font-bold"
                              title="Enviar"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}


            {/* 7. Arena de Modelos */}
            {activeTab === 'compare' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm dark:shadow-2xl space-y-4">
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <SplitSquareHorizontal className="w-5 h-5 text-amber-500" />
                    Arena Multi-Modelo
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Compare respostas simultâneas do Gemini 3.6 Flash, DeepSeek V3 e Claude 3.5 Sonnet.
                  </p>
                </div>

                <textarea
                  value={comparePrompt}
                  onChange={(e) => setComparePrompt(e.target.value)}
                  placeholder="Insira o teste para disparar para todos os modelos..."
                  className="w-full h-32 p-3.5 bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                />

                <button
                  onClick={handleCompare}
                  disabled={isComparing || !comparePrompt.trim()}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  {isComparing ? 'Aguardando respostas simultâneas...' : 'Disparar para a Arena'}
                </button>

                {compareResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {compareResults.map((res, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{res.name}</span>
                            <button
                              onClick={() => copyToClipboard(res.text)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-80 overflow-y-auto mt-2">
                            <CleanMarkdown content={res.text} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 8. Studio de Texto IA */}
            {activeTab === 'ai' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm dark:shadow-2xl space-y-4">
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Studio de Texto IA
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tradução, Resumo, Correção Gramatical e Aprimoramento</p>
                  </div>

                  <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl w-full sm:w-auto">
                    {[
                      { id: 'translate' as const, label: 'Traduzir' },
                      { id: 'summarize' as const, label: 'Resumir' },
                      { id: 'grammar' as const, label: 'Gramática' },
                      { id: 'improve' as const, label: 'Melhorar' },
                    ].map((act) => (
                      <button
                        key={act.id}
                        onClick={() => setAiAction(act.id)}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                          aiAction === act.id
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>

                {aiAction === 'translate' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Idioma Destino:</span>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="Insira o texto fonte aqui..."
                  className="w-full h-44 p-3.5 bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                />

                <button
                  onClick={handleAiAction}
                  disabled={isAiWorking || !aiText.trim()}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition-all min-h-[44px]"
                >
                  {isAiWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isAiWorking ? 'Processando...' : 'Executar Processamento'}
                </button>

                {aiResult && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Resultado:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(cleanAsterisks(aiResult))}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1 hover:bg-slate-200"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </button>
                        <button
                          onClick={() => openCustomPdf(aiResult, `Resultado IA - ${aiAction.toUpperCase()}`)}
                          className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded text-xs font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-1 hover:bg-purple-200 transition-all"
                        >
                          <FileOutput className="w-3.5 h-3.5" />
                          PDF Customizado
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 leading-relaxed">
                      <CleanMarkdown content={aiResult} />
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 9. Gerador Visual Studio */}
            {activeTab === 'image' && (
              <ImageGeneratorStudio
                onSaveToHistory={saveHistoryItem}
                showNotification={showNotification}
                engineProvider={currentEngine.provider}
              />
            )}

            {/* 10. Audio Lab */}
            {activeTab === 'audio' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm dark:shadow-2xl space-y-4">
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      Laboratório de Áudio
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Síntese de Voz (TTS) e Transcrição (STT)</p>
                  </div>

                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <button
                      onClick={() => setAudioSubTab('tts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        audioSubTab === 'tts' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Texto → Fala
                    </button>
                    <button
                      onClick={() => setAudioSubTab('stt')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        audioSubTab === 'stt' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Fala → Texto
                    </button>
                  </div>
                </div>

                {audioSubTab === 'tts' && (
                  <div className="space-y-3">
                    <textarea
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                      placeholder="Insira o texto para ser vocalizado em Português..."
                      className="w-full h-36 p-3.5 bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                    />

                    <button
                      onClick={handleTTS}
                      className={`w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all min-h-[44px] ${
                        isSpeaking ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      }`}
                    >
                      {isSpeaking ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      {isSpeaking ? 'Interromper Leitura' : 'Iniciar Síntese de Voz'}
                    </button>
                  </div>
                )}

                {audioSubTab === 'stt' && (
                  <div className="space-y-4">
                    <button
                      onClick={handleSTT}
                      className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all min-h-[120px] ${
                        isRecording
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-cyan-500 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`p-3 rounded-full ${isRecording ? 'bg-rose-600 animate-pulse text-white' : 'bg-cyan-600 text-white'}`}>
                        <Mic className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-semibold">
                        {isRecording ? 'Gravando áudio... Clique para finalizar.' : 'Clique para gravar pelo microfone'}
                      </span>
                    </button>

                    {sttResult && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                        {sttResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 11. Dashboard Analytics */}
            {activeTab === 'analytics' && (
              <DashboardAnalytics
                historyRecords={historyItems}
                onOpenTool={(tool) => setActiveTab(tool)}
                showNotification={showNotification}
                userEmail="usuario@orbidoc.com"
              />
            )}

            {/* 12. Histórico Vault */}
            {activeTab === 'history' && (
              <HistoryVault
                items={historyItems}
                onClearAll={clearAllHistory}
                onDeleteItem={deleteHistoryItem}
                onRestoreItem={restoreHistoryItem}
                onCopyText={copyToClipboard}
              />
            )}

          </div>

          {/* Footer Metrics */}
          <footer className="mt-6 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-4">
              <span>Palavras: <strong className="text-slate-700 dark:text-slate-300 font-bold">{wordCount}</strong></span>
              <span>Caracteres: <strong className="text-slate-700 dark:text-slate-300 font-bold">{charCount}</strong></span>
              <span>Histórico: <strong className="text-slate-700 dark:text-slate-300 font-bold">{historyItems.length} itens</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>OrbiDoc Workspace</span>
            </div>
          </footer>
        </main>
      </div>
      {/* Google Drive Integration Modal */}
      <GoogleDriveModal
        isOpen={isGoogleDriveOpen}
        onClose={() => setIsGoogleDriveOpen(false)}
        onSelectFile={handleGoogleDriveFileSelect}
        onNotification={showNotification}
      />

      {/* Modal to view extracted text of attached chat file */}
      {viewingChatFileText && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <FileText className="w-5 h-5" />
                <span>Texto Extraído: {viewingChatFileText.name}</span>
              </div>
              <button onClick={() => setViewingChatFileText(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono whitespace-pre-wrap text-slate-800 dark:text-slate-200">
              {viewingChatFileText.content || '(Arquivo sem conteúdo de texto visível ou em processamento)'}
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => copyToClipboard(viewingChatFileText.content)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Texto
              </button>
              <button
                onClick={() => setViewingChatFileText(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Ctrl + K) */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Busca rápida de ferramentas e ações (ex: Word, OCR, Tema)..."
                className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <kbd className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 rounded text-slate-400 font-mono">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/50">
              {[
                { id: 'projects', label: 'Meus Projetos (Painel Estilo Canva)', cat: 'Documentos', icon: FolderKanban, action: () => { setActiveTab('projects'); setShowCommandPalette(false); } },
                { id: 'word', label: 'Word Pro (Editor DOCX)', cat: 'Documentos', icon: Edit3, action: () => { setActiveTab('word'); setShowCommandPalette(false); } },
                { id: 'excel', label: 'Excel Pro (Planilhas)', cat: 'Documentos', icon: FileSpreadsheet, action: () => { setActiveTab('excel'); setShowCommandPalette(false); } },
                { id: 'powerpoint', label: 'PowerPoint Pro (Apresentações)', cat: 'Documentos', icon: Presentation, action: () => { setActiveTab('powerpoint'); setShowCommandPalette(false); } },
                { id: 'canva', label: 'Canva Design Studio', cat: 'Documentos', icon: PenTool, action: () => { setActiveTab('canva'); setShowCommandPalette(false); } },
                { id: 'office', label: 'Central Microsoft Office 365', cat: 'Documentos', icon: Grid, action: () => { setActiveTab('office'); setShowCommandPalette(false); } },
                { id: 'extract', label: 'Extrator OCR Pro (PDFs e Imagens)', cat: 'IA', icon: FileText, action: () => { setActiveTab('extract'); setShowCommandPalette(false); } },
                { id: 'chat', label: 'Assistente IA Interativo', cat: 'IA', icon: Bot, action: () => { setActiveTab('chat'); setShowCommandPalette(false); } },
                { id: 'compare', label: 'Arena de Modelos (Gemini, Claude, DeepSeek)', cat: 'IA', icon: SplitSquareHorizontal, action: () => { setActiveTab('compare'); setShowCommandPalette(false); } },
                { id: 'ai', label: 'Studio de Texto (Traduzir, Resumir)', cat: 'IA', icon: Sparkles, action: () => { setActiveTab('ai'); setShowCommandPalette(false); } },
                { id: 'audio', label: 'Audio Lab (TTS & STT)', cat: 'Mídia', icon: Volume2, action: () => { setActiveTab('audio'); setShowCommandPalette(false); } },
                { id: 'image', label: 'Gerador Visual de Imagens', cat: 'Mídia', icon: ImageIcon, action: () => { setActiveTab('image'); setShowCommandPalette(false); } },
                { id: 'history', label: 'Histórico Vault', cat: 'Registros', icon: History, action: () => { setActiveTab('history'); setShowCommandPalette(false); } },
                { id: 'theme', label: 'Alternar Tema Claro / Escuro', cat: 'Geral', icon: theme === 'dark' ? Sun : Moon, action: () => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setShowCommandPalette(false); } },
                { id: 'shortcuts', label: 'Ver Atalhos do Teclado', cat: 'Geral', icon: HelpCircle, action: () => { setShowShortcutsModal(true); setShowCommandPalette(false); } },
              ]
                .filter(item => item.label.toLowerCase().includes(commandQuery.toLowerCase()) || item.cat.toLowerCase().includes(commandQuery.toLowerCase()))
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl text-left transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-105 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</div>
                          <div className="text-[10px] text-slate-400">{item.cat}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Reference Modal (?) */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Terminal className="w-5 h-5" />
                <span>Atalhos do Teclado OrbiDoc</span>
              </div>
              <button onClick={() => setShowShortcutsModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: 'Ctrl + K  ou  Cmd + K', desc: 'Abrir Busca Rápida / Command Palette' },
                { key: 'Ctrl + Shift + L', desc: 'Alternar Tema Claro / Escuro' },
                { key: 'Enter (na busca)', desc: 'Navegar para a ferramenta selecionada' },
                { key: 'ESC', desc: 'Fechar modais e painéis ativos' },
                { key: '?', desc: 'Abrir este painel de atalhos' },
              ].map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{shortcut.desc}</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browser & PWA Installation Guide Modal */}
      <BrowserGuideModal
        isOpen={showBrowserGuide}
        onClose={() => setShowBrowserGuide(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />

      {/* AI Model Selector Bottom Sheet Modal */}
      {showAiModelSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Selecione o Modelo de IA</h3>
              </div>
              <button
                onClick={() => setShowAiModelSheet(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {ENGINES.map((eng) => {
                const isSelected = translationEngine === eng.id;
                return (
                  <button
                    key={eng.id}
                    onClick={() => {
                      setTranslationEngine(eng.id);
                      setShowAiModelSheet(false);
                      showNotification(`Modelo alterado para ${eng.label}`);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/50 dark:border-slate-800">{eng.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">{eng.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            {eng.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{eng.description}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Navigation Bar (Mobile / Responsive) */}
      <BottomNavBar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onOpenFab={() => setIsFabOpen(true)}
      />

      {/* Floating Action Button (FAB) Bottom Sheet Menu */}
      <FabMenuSheet
        isOpen={isFabOpen}
        onClose={() => setIsFabOpen(false)}
        onSelectAction={(tab) => {
          if (tab === 'chat') {
            handleCreateNewChat();
          } else {
            setActiveTab(tab);
          }
          setIsFabOpen(false);
        }}
      />
    </div>
  );
}
