import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileText, Volume2, Upload, Loader2, Key, Wand2, Palette, DownloadCloud,
  ImagePlus, Mic, Send, Settings, Copy, FileOutput, Languages, Sparkles, X, 
  Check, Type, Bot, MessageSquare, Paperclip, Image as ImageIcon, FileVideo, 
  File, Trash2, StopCircle, SplitSquareHorizontal, Sun, Moon, History, SlidersHorizontal,
  Activity, Cpu, ShieldCheck, Terminal, Monitor, ChevronRight, Layers, HelpCircle,
  FileSpreadsheet, Presentation, PenTool, Edit3, Menu, ChevronDown, ChevronUp, Grid, Sparkle,
  Smartphone, Download, RefreshCw, CheckCircle2, AlertCircle, FileSearch, Layers3,
  Eye, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';

import { TabType, AiActionType, AudioSubTabType, AiMessage, ChatMessage, ChatFile, HistoryItem, OcrItem, ChatSession, GoogleUserProfile, MicrosoftUserProfile } from './types';
import { DocSwissLogo } from './components/DocSwissLogo';
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
import { getStoredGoogleUser } from './services/googleAuthDrive';
import { getStoredMicrosoftUser } from './services/microsoftAuthOffice';
import { cleanAsterisks } from './lib/cleanText';
import { processFileOcr, OcrOptions } from './lib/ocrEngine';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Alphabetically ordered AI Engines by label
const ENGINES = [
  { id: 'claude', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', emoji: '🎯', description: 'Raciocínio complexo' },
  { id: 'deepseek', provider: 'openrouter', model: 'deepseek/deepseek-chat', label: 'DeepSeek V3', emoji: '🧠', description: 'Alta precisão' },
  { id: 'gemini', provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', emoji: '💎', description: 'Ultra-rápido & nativo' },
  { id: 'groq', provider: 'groq', model: 'llama-3.1-70b-versatile', label: 'Groq Llama 3.1', emoji: '⚡', description: 'Baixa latência' },
  { id: 'qwen', provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', emoji: '🚀', description: 'Multilíngue avançado' },
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

// Tool Categories Structure for Clean Organized Navigation (Alphabetical Order)
const CATEGORIES = [
  {
    id: 'docs',
    title: 'Documentos & Office Pro',
    icon: FileText,
    tools: [
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

// API Proxy Helper
async function sendToVercel(provider: string, model: string, messages: AiMessage[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erro no servidor (${response.status})`);
  }
  return data.answer;
}

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
  const [activeTab, setActiveTab] = useState<TabType>('word');
  const [activeCategory, setActiveCategory] = useState<string>('docs');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isThemeFontOpen, setIsThemeFontOpen] = useState(false);

  // Google & Microsoft User Profile States
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [msUser, setMsUser] = useState<MicrosoftUserProfile | null>(() => getStoredMicrosoftUser());

  // Custom PDF Export Modal State
  const [isCustomPdfOpen, setIsCustomPdfOpen] = useState(false);
  const [pdfExportText, setPdfExportText] = useState('');
  const [pdfExportTitle, setPdfExportTitle] = useState('Documento DocSwiss');

  // Chat Sessions History State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('docswiss_chat_sessions');
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

  const openCustomPdf = (text: string, title = 'Documento DocSwiss') => {
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
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

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

  const showNotification = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

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
    const filename = `docswiss_ocr_lote_${new Date().toISOString().slice(0, 10)}`;
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

  const sendChatMessage = async () => {
    if (!chatInput.trim() && chatFiles.length === 0) return;
    const userMsgContent = chatInput;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      files: chatFiles.length > 0 ? [...chatFiles] : undefined,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatFiles([]);
    setIsChatLoading(true);

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
          content: 'Você é o assistente inteligente de análise documental do DocuTools. Analise cuidadosamente o conteúdo de quaisquer arquivos anexados na conversa para responder com dados precisos. Evite formatações excessivas com asteriscos, cerquilhas ou marcadores poluídos. Responda em português de maneira clara, estruturada e limpa.' 
        },
        ...chatMessages.slice(-8).map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: prompt },
      ];

      const response = await sendToVercel(currentEngine.provider, currentEngine.model, messages);
      
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        },
      ]);

      saveHistoryItem({
        type: 'chat',
        title: `Chat (${currentEngine.label})`,
        summary: userMsgContent || 'Consulta com arquivo anexo',
        details: response,
      });
    } catch (err: any) {
      showNotification(err.message || 'Falha na resposta do assistente.', 'error');
    } finally {
      setIsChatLoading(false);
    }
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
          <DocSwissLogo size="xl" showText={false} />
        </div>
        <DocSwissLogo size="lg" showText={true} />
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

      {/* Theme and Font Customization Modal */}
      <ThemeFontConfig isOpen={isThemeFontOpen} onClose={() => setIsThemeFontOpen(false)} />

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
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Como Baixar e Instalar o DocSwiss</h2>
                  <p className="text-xs text-slate-500">Instalação no Celular/PC e Download do Projeto</p>
                </div>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
              {/* Option 1: PWA Installation */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  1. Instalar como Aplicativo Nativo (PWA - Celular e Computador)
                </div>
                <p className="leading-relaxed">
                  O <strong>DocSwiss</strong> é um aplicativo PWA moderno. Você pode instalá-lo diretamente no seu dispositivo sem precisar de loja de aplicativos!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Android (Chrome)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Abra o menu (<strong>⋮</strong>) no canto superior do Chrome → Toque em <strong>"Adicionar à Tela Inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> iPhone (Safari)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Toque no botão <strong>Compartilhar</strong> (quadrado com seta para cima) no Safari → Selecione <strong>"Adicionar à Tela de Início"</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5 text-emerald-600" /> PC (Chrome/Edge)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Clique no ícone de tela com seta na barra de endereço da URL (lado direito) ou no menu → <strong>"Instalar DocSwiss"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Export ZIP / GitHub */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
                  <Download className="w-4 h-4 text-indigo-600" />
                  2. Baixar o Código Fonte Completo (Arquivo ZIP / GitHub)
                </div>
                <p className="leading-relaxed">
                  Se você deseja baixar os arquivos do projeto para abrir e editar no seu computador (VS Code, Node.js):
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

      {/* Primary Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-4 sm:px-6 z-40 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            aria-label="Menu de Navegação"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <DocSwissLogo size="md" showText={true} />
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-800">
              Studio Office
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Active Model Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span>{currentEngine.emoji}</span>
            <span>{currentEngine.label}</span>
          </div>

          {/* Baixar App Button */}
          <button
            onClick={() => setShowInstallModal(true)}
            title="Como Baixar / Instalar o Aplicativo"
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
          >
            <DownloadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar App</span>
          </button>

          {/* History Vault Button */}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
            {historyItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                {historyItems.length}
              </span>
            )}
          </button>

          {/* Theme & Font Customizer */}
          <button
            onClick={() => setIsThemeFontOpen(true)}
            title="Aparência, Fontes e Layout"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1 text-xs font-medium"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden xl:inline">Aparência</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Alternar Tema Claro / Escuro"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Google Drive Button */}
          <button
            onClick={() => setIsGoogleDriveOpen(true)}
            title="Abrir Google Drive Integrado"
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-500/40 hover:bg-amber-500/20 transition-all"
          >
            <HardDrive className="w-4 h-4 text-amber-500" />
            <span className="hidden lg:inline">Google Drive</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            title="Configurações"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Google & Microsoft Unified Auth Profile Badge */}
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
                    <DocSwissLogo size="md" showText={true} />
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
                    DocSwiss Studio Office — Pronto para Uso
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Canvas View Area */}
        <main className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-4 sm:p-8 lg:p-10 flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            
            {/* Mobile Category Quick Switcher Pills (Top Bar) */}
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setActiveTab(cat.tools[0].id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[40px] border ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  <span>{cat.title}</span>
                </button>
              ))}
            </div>

            {/* Mobile Secondary Tool Selector Pills */}
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.find((c) => c.id === activeCategory)?.tools.map((tool) => {
                const ToolIcon = tool.icon;
                const isActive = activeTab === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTab(tool.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
                      isActive
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ToolIcon className="w-3.5 h-3.5" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Tool Workspace Render */}
            
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
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl flex flex-col h-[calc(100vh-170px)] sm:h-[calc(100vh-160px)]">
                {/* Header & Sub-Tabs */}
                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Assistente IA Interativo</h2>
                      <p className="text-[11px] text-slate-500">{currentEngine.label}</p>
                    </div>
                  </div>

                  {/* Sub-Tabs: Conversa Ativa vs Antigos Chats */}
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const fullChatText = chatMessages.map(m => `${m.role === 'user' ? 'Usuário' : 'DocSwiss'}: ${cleanAsterisks(m.content)}`).join('\n\n');
                          openCustomPdf(fullChatText, 'Conversa DocSwiss IA');
                        }}
                        className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-indigo-100 transition-all"
                      >
                        <FileOutput className="w-3.5 h-3.5" />
                        PDF Customizado
                      </button>
                      <button
                        onClick={() => setChatMessages([])}
                        className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Limpar
                      </button>
                    </div>
                  )}
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
                        localStorage.setItem('docswiss_chat_sessions', JSON.stringify(updated));
                        showNotification('Sessão removida do histórico.');
                      }}
                      onClearAllSessions={() => {
                        setChatSessions([]);
                        localStorage.removeItem('docswiss_chat_sessions');
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
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-100/40 dark:bg-slate-950/40 text-xs">
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-2 py-12">
                          <MessageSquare className="w-10 h-10 opacity-30" />
                          <p className="text-slate-600 dark:text-slate-400 font-medium">Faça perguntas ou envie anexos para análise com Inteligência Artificial.</p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl p-3.5 leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white shadow-md'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                              }`}
                            >
                              {msg.files && msg.files.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-white/20 dark:border-slate-800">
                                  {msg.files.map((f, i) => (
                                    <span key={i} className="text-[10px] bg-slate-900/10 dark:bg-slate-950 px-2 py-0.5 rounded text-indigo-200 dark:text-indigo-300 flex items-center gap-1">
                                      <Paperclip className="w-3 h-3" />
                                      {f.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {msg.role === 'assistant' ? (
                                <div>
                                  <CleanMarkdown content={msg.content} />
                                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 text-[10px]">
                                    <button
                                      onClick={() => copyToClipboard(cleanAsterisks(msg.content))}
                                      className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-slate-500"
                                    >
                                      <Copy className="w-3 h-3" /> Copiar
                                    </button>
                                    <button
                                      onClick={() => openCustomPdf(msg.content, 'Resposta DocSwiss IA')}
                                      className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold"
                                    >
                                      <FileOutput className="w-3 h-3" /> Exportar PDF
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      {isChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex items-center gap-2 text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                            <span>Gerando resposta sem asteriscos...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Attached Files */}
                    {chatFiles.length > 0 && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                        {chatFiles.map((file, idx) => (
                          <span key={idx} className="text-xs bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            <Paperclip className="w-3 h-3" />
                            <span className="max-w-[120px] truncate">{file.name}</span>
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

                    {/* Input Bar */}
                    <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <input
                        ref={chatFileInputRef}
                        type="file"
                        multiple
                        onChange={handleChatFileUpload}
                        className="hidden"
                        accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt"
                      />
                      <button
                        onClick={() => setIsGoogleDriveOpen(true)}
                        title="Anexar arquivo do Google Drive"
                        className="p-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <HardDrive className="w-4 h-4 text-amber-500" />
                      </button>

                      <button
                        onClick={() => chatFileInputRef.current?.click()}
                        title="Anexar arquivo local"
                        className="p-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                        placeholder="Digite sua mensagem aqui..."
                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 min-h-[48px]"
                      />

                      <button
                        onClick={sendChatMessage}
                        disabled={isChatLoading || (!chatInput.trim() && chatFiles.length === 0)}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center shadow-md"
                      >
                        <Send className="w-4 h-4" />
                      </button>
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

            {/* 11. Histórico Vault */}
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
              <span>DocSwiss Workspace</span>
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
    </div>
  );
}
