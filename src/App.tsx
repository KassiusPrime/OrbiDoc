import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileText, Volume2, Upload, Loader2, Key, Wand2, Palette, DownloadCloud,
  ImagePlus, Mic, Send, Settings, Copy, FileOutput, Languages, Sparkles, X, 
  Check, Type, Bot, MessageSquare, Paperclip, Image as ImageIcon, FileVideo, 
  File, Trash2, StopCircle, SplitSquareHorizontal, Sun, Moon, History,
  Activity, Cpu, ShieldCheck, Terminal, Monitor, ChevronRight, Layers, HelpCircle,
  FileSpreadsheet, Presentation, PenTool, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';

import { TabType, AiActionType, AudioSubTabType, AiMessage, ChatMessage, ChatFile, HistoryItem } from './types';
import { HistoryVault } from './components/HistoryVault';
import { WordEditor } from './components/WordEditor';
import { ExcelSpreadsheet } from './components/ExcelSpreadsheet';
import { PowerPointStudio } from './components/PowerPointStudio';
import { CanvaDesignStudio } from './components/CanvaDesignStudio';
import { ImageGeneratorStudio } from './components/ImageGeneratorStudio';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const ENGINES = [
  { id: 'gemini', provider: 'gemini', model: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', emoji: '💎', description: 'Ultra-rápido & nativo' },
  { id: 'deepseek', provider: 'openrouter', model: 'deepseek/deepseek-chat', label: 'DeepSeek V3', emoji: '🧠', description: 'Alta precisão' },
  { id: 'qwen', provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', emoji: '🚀', description: 'Multilíngue avançado' },
  { id: 'claude', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5', emoji: '🎯', description: 'Raciocínio complexo' },
  { id: 'groq', provider: 'groq', model: 'llama-3.1-70b-versatile', label: 'Groq Llama 3.1', emoji: '⚡', description: 'Baixa latência' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' }, { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' }, { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' }, { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
];

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'];

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
  const [activeTab, setActiveTab] = useState<TabType>('extract');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('docutools_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark'; // Default to sleek workstation dark theme
  });

  useEffect(() => {
    localStorage.setItem('docutools_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
      const updated = [newItem, ...prev].slice(0, 100); // keep max 100 items
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

  // OCR state
  const [extractedText, setExtractedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isMonospace, setIsMonospace] = useState(true);
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
    }, 1500);
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
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsProcessing(true);
    setProgress(0);
    setExtractedText('');

    try {
      const text = await extractTextFromFile(file, (p) => setProgress(p));
      setExtractedText(text);
      showNotification('Leitura de documento concluída com sucesso!');

      // Save to history
      saveHistoryItem({
        type: 'ocr',
        title: file.name,
        summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        details: text,
      });
    } catch (err) {
      console.error(err);
      showNotification('Falha no processamento do arquivo.', 'error');
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        let content = '';
        let preview = '';
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          content = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          preview = content;
        } else {
          content = await extractTextFromFile(file, () => {});
        }
        setChatFiles((prev) => [...prev, { name: file.name, type: file.type, content, preview }]);
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
          if (!file.type.startsWith('image/')) {
            prompt += `\n\n[Anexo: ${file.name}]\n${file.content}\n[Fim anexo]`;
          }
        }
      }

      const messages: AiMessage[] = [
        { role: 'system', content: 'Você é o assistente técnico DocuTools Workstation. Seja preciso, objetivo e profissional em português.' },
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

      // Save to History
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
      showNotification('Insira o texto no painel de entrada.', 'error');
      return;
    }
    setIsAiWorking(true);
    setAiResult('');
    try {
      const targetLangName = LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
      const prompts: Record<AiActionType, string> = {
        translate: `Traduza o texto para ${targetLangName} preservando a formatação:`,
        summarize: 'Elabore um resumo conciso com os pontos-chave:',
        grammar: 'Corrija erros ortográficos e gramaticais com estilo profissional:',
        improve: 'Aprimore a clareza, tom e estrutura do texto:',
      };

      const messages: AiMessage[] = [
        { role: 'system', content: prompts[aiAction] },
        { role: 'user', content: aiText },
      ];

      const response = await sendToVercel(currentEngine.provider, currentEngine.model, messages);
      setAiResult(response);
      showNotification('Processamento concluído!');

      // Save to History
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
      { id: 'Gemini 2.5', provider: 'gemini', model: 'gemini-2.5-flash' },
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
          } catch (e: any) {
            return { name: m.id, text: `⚠️ Não foi possível obter resposta do provedor.` };
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

  // Server-side backed image generation
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      showNotification('Insira um prompt de descrição para a imagem.', 'error');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImage('');

    try {
      let imageUrl = '';
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: imagePrompt }),
        });

        const data = await response.json();
        if (response.ok && data.imageUrl) {
          imageUrl = data.imageUrl;
        }
      } catch (apiErr) {
        console.warn('API image generation failed, using direct Pollinations URL:', apiErr);
      }

      if (!imageUrl) {
        imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt.trim())}?width=768&height=768&nologo=true&seed=${Date.now()}`;
      }

      setGeneratedImage(imageUrl);
      showNotification('Imagem gerada com sucesso!');

      // Save to History
      saveHistoryItem({
        type: 'image',
        title: 'Imagem Gerada',
        summary: imagePrompt,
        mediaUrl: imageUrl,
      });
    } catch (err: any) {
      console.error(err);
      showNotification('Não foi possível gerar a imagem no momento.', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleTTS = () => {
    if (!ttsText.trim()) {
      showNotification('Insira o texto para ser lido.', 'error');
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
      showNotification('Navegador não possui suporte a SpeechRecognition.', 'error');
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
    showNotification('Microfone ativo. Fale agora...');
  };

  // Text stats
  const currentText = activeTab === 'extract' ? extractedText : aiText;
  const wordCount = currentText ? currentText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = currentText ? currentText.length : 0;

  if (showSplash) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30">
            <Cpu className="w-8 h-8 text-white animate-pulse" />
          </div>
          <span className="text-2xl font-bold font-mono tracking-tight">DocuTools Workstation</span>
        </div>
        <p className="text-xs text-slate-400 font-mono tracking-wide">
          Carregando módulos de engenharia de documentos v2.5...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-12 right-6 z-50 px-4 py-2.5 rounded-lg shadow-2xl border text-xs font-mono flex items-center gap-2 animate-[slideIn_0.2s_ease] ${
            notification.type === 'success'
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900 border-rose-500/50 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-rose-400" />}
          {notification.msg}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-slate-100">Painel de Configurações da Workstation</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-2">MODO VISUAL / TEMA</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border ${
                      theme === 'dark' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Moon className="w-4 h-4" /> Workstation Dark
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border ${
                      theme === 'light' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Sun className="w-4 h-4" /> Workstation Light
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-2">MOTOR DE INTELIGÊNCIA ARTIFICIAL</label>
                <div className="grid grid-cols-1 gap-2">
                  {ENGINES.map((engine) => (
                    <button
                      key={engine.id}
                      onClick={() => setTranslationEngine(engine.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        translationEngine === engine.id
                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{engine.emoji}</span>
                        <div>
                          <div className="text-xs font-bold text-slate-200">{engine.label}</div>
                          <div className="text-[10px] text-slate-500">{engine.description}</div>
                        </div>
                      </div>
                      {translationEngine === engine.id && <Check className="w-4 h-4 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                Salvar & Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Titlebar Header */}
      <header className="h-12 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-md">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold font-mono tracking-wider text-slate-100">DocuTools Workstation</span>
              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 rounded border border-indigo-500/30">
                PRO v2.5
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 ml-6 pl-6 border-l border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Engine: <strong className="text-slate-200 font-normal">{currentEngine.label}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>OCR Worker: <strong className="text-slate-200 font-normal">Tesseract Ready</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Histórico Vault</span>
            {historyItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {historyItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Alternar Modo Escuro / Claro"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            title="Configurações da Workstation"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workstation Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side Dock Nav */}
        <aside className="w-16 sm:w-56 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-2 flex-shrink-0">
          <div className="space-y-1">
            <div className="px-3 py-2 hidden sm:block text-[10px] font-mono font-semibold text-slate-500 tracking-wider">
              MÓDULOS DE TRABALHO
            </div>

            {[
              { id: 'extract' as TabType, label: 'OCR Workbench', icon: <FileText className="w-4 h-4" />, shortcut: '1' },
              { id: 'word' as TabType, label: 'Word Pro', icon: <Edit3 className="w-4 h-4" />, shortcut: '2' },
              { id: 'excel' as TabType, label: 'Excel Pro', icon: <FileSpreadsheet className="w-4 h-4" />, shortcut: '3' },
              { id: 'powerpoint' as TabType, label: 'PowerPoint Pro', icon: <Presentation className="w-4 h-4" />, shortcut: '4' },
              { id: 'canva' as TabType, label: 'Canva Studio', icon: <PenTool className="w-4 h-4" />, shortcut: '5' },
              { id: 'image' as TabType, label: 'Gerador Visual', icon: <ImageIcon className="w-4 h-4" />, shortcut: '6' },
              { id: 'chat' as TabType, label: 'Assistente IA', icon: <Bot className="w-4 h-4" />, shortcut: '7' },
              { id: 'compare' as TabType, label: 'Arena de Modelos', icon: <SplitSquareHorizontal className="w-4 h-4" />, shortcut: '8' },
              { id: 'ai' as TabType, label: 'Studio de Texto', icon: <Sparkles className="w-4 h-4" />, shortcut: '9' },
              { id: 'audio' as TabType, label: 'Audio Lab', icon: <Volume2 className="w-4 h-4" />, shortcut: '0' },
              { id: 'history' as TabType, label: 'Histórico Vault', icon: <History className="w-4 h-4" />, shortcut: 'H' },
            ].map((nav) => (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === nav.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/50'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {nav.icon}
                  <span className="hidden sm:inline text-left">{nav.label}</span>
                </div>
                <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-500 border border-slate-800">
                  {nav.shortcut}
                </span>
              </button>
            ))}
          </div>

          {/* Engine Status Widget */}
          <div className="hidden sm:block p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Status do Sistema</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div className="bg-indigo-500 h-full w-full animate-pulse" />
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              IA Ativa: {currentEngine.label}
            </div>
          </div>
        </aside>

        {/* Center Active Module Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-900/40 p-4 sm:p-6 flex flex-col justify-between">
          <div className="max-w-6xl mx-auto w-full space-y-6">
            
            {/* 1. OCR WORKBENCH */}
            {activeTab === 'extract' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        OCR & Extrator de Documentos
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Suporte completo para Imagens (PNG/JPG), PDF, DOCX Word e Planilhas Excel.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".png,.jpg,.jpeg,.gif,.pdf,.docx,.xlsx,.xls,.txt,.csv,.json"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg flex items-center gap-2 transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        Carregar Arquivo
                      </button>
                    </div>
                  </div>

                  {isProcessing && (
                    <div className="my-6 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          Processando {fileName}...
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {!extractedText && !isProcessing && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="my-6 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-12 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950 transition-all group"
                    >
                      <Upload className="w-10 h-10 text-slate-600 group-hover:text-indigo-400 mx-auto mb-3 transition-colors" />
                      <p className="text-sm font-semibold text-slate-300">Arraste e solte ou clique para enviar um arquivo</p>
                      <p className="text-xs text-slate-500 mt-1 font-mono">Formatos suportados: PNG, JPG, PDF, DOCX, XLSX, TXT</p>
                    </div>
                  )}

                  {extractedText && !isProcessing && (
                    <div className="space-y-3 my-4">
                      <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">VISUALIZAÇÃO:</span>
                          <button
                            onClick={() => setIsMonospace(!isMonospace)}
                            className={`px-2 py-1 rounded text-xs font-mono border ${
                              isMonospace ? 'bg-slate-800 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {isMonospace ? 'Fonte Monospace' : 'Fonte Sans'}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(extractedText)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copiar
                          </button>
                          <button
                            onClick={() => {
                              setAiText(extractedText);
                              setActiveTab('ai');
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Enviar p/ Studio IA
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        className={`w-full h-80 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y ${
                          isMonospace ? 'font-mono' : 'font-sans'
                        }`}
                      />

                      {/* Export Options */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                        <span className="text-xs font-mono text-slate-500 mr-2">EXPORTAR PARA:</span>
                        <button
                          onClick={() => exportAsTxt(extractedText, fileName)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1.5"
                        >
                          <FileOutput className="w-3.5 h-3.5" /> TXT
                        </button>
                        <button
                          onClick={() => exportAsDocx(extractedText, fileName)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-blue-400 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1.5"
                        >
                          <FileOutput className="w-3.5 h-3.5" /> DOCX Word
                        </button>
                        <button
                          onClick={() => exportAsPdf(extractedText, fileName)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-rose-400 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1.5"
                        >
                          <FileOutput className="w-3.5 h-3.5" /> PDF Document
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. WORD PRO STUDIO */}
            {activeTab === 'word' && (
              <WordEditor
                onSaveToHistory={saveHistoryItem}
                onShowNotification={showNotification}
              />
            )}

            {/* 3. EXCEL PRO SPREADSHEET */}
            {activeTab === 'excel' && (
              <ExcelSpreadsheet
                onSaveToHistory={saveHistoryItem}
                onShowNotification={showNotification}
              />
            )}

            {/* 4. POWERPOINT PRO STUDIO */}
            {activeTab === 'powerpoint' && (
              <PowerPointStudio
                onSaveToHistory={saveHistoryItem}
                onShowNotification={showNotification}
              />
            )}

            {/* 5. CANVA DESIGN STUDIO */}
            {activeTab === 'canva' && (
              <CanvaDesignStudio
                onSaveToHistory={saveHistoryItem}
                onShowNotification={showNotification}
              />
            )}

            {/* 6. CHAT ASSISTANT */}
            {activeTab === 'chat' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-140px)]">
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h2 className="text-xs font-bold text-slate-100 font-mono">Assistente Interativo IA</h2>
                      <p className="text-[10px] text-slate-500 font-mono">Modelo Ativo: {currentEngine.label}</p>
                    </div>
                  </div>

                  {chatMessages.length > 0 && (
                    <button
                      onClick={() => setChatMessages([])}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-rose-400 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpar Chat
                    </button>
                  )}
                </div>

                {/* Messages Box */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50 font-mono text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-600 text-center space-y-2">
                      <MessageSquare className="w-10 h-10 opacity-30" />
                      <p className="text-slate-400">Digite uma mensagem ou anexe documentos/imagens para iniciar a análise.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white border border-indigo-500'
                              : 'bg-slate-900 border border-slate-800 text-slate-200'
                          }`}
                        >
                          {msg.files && msg.files.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-slate-800">
                              {msg.files.map((f, i) => (
                                <span key={i} className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-indigo-300 border border-slate-800 flex items-center gap-1">
                                  <Paperclip className="w-3 h-3" />
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))
                  )}

                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Processando resposta com IA...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attached Files Bar */}
                {chatFiles.length > 0 && (
                  <div className="p-2 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2">
                    {chatFiles.map((file, idx) => (
                      <span key={idx} className="text-xs bg-slate-900 border border-slate-800 text-indigo-300 px-2 py-1 rounded-lg flex items-center gap-1.5">
                        <Paperclip className="w-3 h-3" />
                        {file.name}
                        <button onClick={() => setChatFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-400 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input Controls */}
                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    multiple
                    onChange={handleChatFileUpload}
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt"
                  />
                  <button
                    onClick={() => chatFileInputRef.current?.click()}
                    title="Anexar arquivos ao chat"
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl border border-slate-800"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder="Digite sua dúvida ou instrução técnica..."
                    className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />

                  <button
                    onClick={sendChatMessage}
                    disabled={isChatLoading || (!chatInput.trim() && chatFiles.length === 0)}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-50 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 3. ARENA DE MODELOS */}
            {activeTab === 'compare' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="pb-4 border-b border-slate-800">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                    <SplitSquareHorizontal className="w-5 h-5 text-amber-400" />
                    Arena Multi-Modelo Simultânea
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Avalie respostas em tempo real comparando Gemini 3.6 Flash, DeepSeek V3 e Claude 3.5 Sonnet.
                  </p>
                </div>

                <textarea
                  value={comparePrompt}
                  onChange={(e) => setComparePrompt(e.target.value)}
                  placeholder="Insira o prompt ou pergunta de teste para os modelos..."
                  className="w-full h-28 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />

                <button
                  onClick={handleCompare}
                  disabled={isComparing || !comparePrompt.trim()}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all font-mono"
                >
                  {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  {isComparing ? 'Aguardando respostas simultâneas...' : 'Disparar Prompt para a Arena'}
                </button>

                {compareResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    {compareResults.map((res, i) => (
                      <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-xs font-bold text-indigo-300 font-mono">{res.name}</span>
                            <button
                              onClick={() => copyToClipboard(res.text)}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto mt-2">
                            {res.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. AI TEXT STUDIO */}
            {activeTab === 'ai' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      Studio de Processamento de Texto
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Tradução, Resumo, Correção Gramatical e Refinamento de Escrita</p>
                  </div>

                  <div className="flex gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                    {[
                      { id: 'translate' as const, label: 'Traduzir' },
                      { id: 'summarize' as const, label: 'Resumir' },
                      { id: 'grammar' as const, label: 'Gramática' },
                      { id: 'improve' as const, label: 'Melhorar' },
                    ].map((act) => (
                      <button
                        key={act.id}
                        onClick={() => setAiAction(act.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                          aiAction === act.id
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>

                {aiAction === 'translate' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">IDIOMA DE DESTINO:</span>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-500"
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
                  className="w-full h-40 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />

                <button
                  onClick={handleAiAction}
                  disabled={isAiWorking || !aiText.trim()}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all font-mono"
                >
                  {isAiWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isAiWorking ? 'Processando texto com IA...' : 'Executar Processamento'}
                </button>

                {aiResult && (
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-purple-300">RESULTADO DA IA:</span>
                      <button
                        onClick={() => copyToClipboard(aiResult)}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded text-xs font-mono border border-slate-800 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar
                      </button>
                    </div>

                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                      {aiResult}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. VISUAL STUDIO */}
            {activeTab === 'image' && (
              <ImageGeneratorStudio
                onSaveToHistory={saveHistoryItem}
                onShowNotification={showNotification}
              />
            )}

            {/* 6. AUDIO LAB */}
            {activeTab === 'audio' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                      <Volume2 className="w-5 h-5 text-cyan-400" />
                      Laboratório de Áudio
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Síntese de Voz (TTS) e Reconhecimento de Áudio (STT)</p>
                  </div>

                  <div className="flex gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                    <button
                      onClick={() => setAudioSubTab('tts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium ${
                        audioSubTab === 'tts' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Texto → Fala
                    </button>
                    <button
                      onClick={() => setAudioSubTab('stt')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium ${
                        audioSubTab === 'stt' ? 'bg-cyan-600 text-white' : 'text-slate-400'
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
                      className="w-full h-32 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />

                    <button
                      onClick={handleTTS}
                      className={`w-full py-2.5 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-all ${
                        isSpeaking ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
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
                      className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                        isRecording
                          ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                          : 'border-slate-800 bg-slate-950 hover:border-cyan-500/50 text-slate-300'
                      }`}
                    >
                      <div className={`p-3 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse text-white' : 'bg-cyan-600 text-white'}`}>
                        <Mic className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-mono">
                        {isRecording ? 'Gravando áudio... Clique para finalizar.' : 'Clique para ativar a escuta do microfone'}
                      </span>
                    </button>

                    {sttResult && (
                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono whitespace-pre-wrap">
                        {sttResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 7. HISTÓRICO VAULT */}
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

          {/* Bottom Statusbar Metrics */}
          <footer className="mt-6 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-500 gap-2">
            <div className="flex items-center gap-4">
              <span>Palavras: <strong className="text-slate-300 font-normal">{wordCount}</strong></span>
              <span>Caracteres: <strong className="text-slate-300 font-normal">{charCount}</strong></span>
              <span>Histórico: <strong className="text-slate-300 font-normal">{historyItems.length} entradas</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sessão Segura Vercel Proxy
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
