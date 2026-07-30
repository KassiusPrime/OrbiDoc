import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, FileOutput, Sparkles, Copy, Trash2, Eye, Edit3, Type, Heading1, Heading2,
  Heading3, Table, Image as ImageIcon, Search, RefreshCw, Check, Loader2, Download,
  Highlighter, CheckCircle2, AlertTriangle, SpellCheck, Maximize2, Minimize2, Palette,
  Wand2, FileText, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { HistoryItem } from '../types';

interface WordEditorProps {
  initialContent?: string;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  engineProvider?: string;
  engineModel?: string;
}

interface GrammarError {
  id: string;
  original: string;
  suggestion: string;
  reason: string;
  index: number;
}

const WORD_AUTOSAVE_KEY = 'docswiss_word_autosave';

export const WordEditor: React.FC<WordEditorProps> = ({
  initialContent = '',
  onSaveToHistory,
  showNotification = () => {},
  engineProvider = 'gemini',
  engineModel = 'gemini-2.5-flash',
}) => {
  const [docTitle, setDocTitle] = useState('Novo Documento.docx');
  const [content, setContent] = useState(initialContent || '### Relatório Executivo e Proposta\n\nBem-vindo ao **Word Studio Pro**! Digite seu texto aqui ou utilize as ferramentas de IA para gerar conteúdos completos, relatórios e revisões.\n\n- Suporte a marcação e formatação rápida com alinhamento flexível\n- Exportação direta para **DOCX**, **PDF** e **TXT**\n- Revisão ortográfica e marcação de erros em tempo real\n');
  const [previewMode, setPreviewMode] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);

  // Auto-save load on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(WORD_AUTOSAVE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.content && !initialContent) {
          setContent(parsed.content);
        }
        if (parsed.docTitle) {
          setDocTitle(parsed.docTitle);
        }
        if (parsed.lastSaved) {
          const timeStr = new Date(parsed.lastSaved).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          setLastAutoSaveTime(timeStr);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar rascunho salvo do Word:', e);
    }
  }, [initialContent]);

  // Auto-save on document change
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const now = Date.now();
        localStorage.setItem(WORD_AUTOSAVE_KEY, JSON.stringify({
          docTitle,
          content,
          lastSaved: now
        }));
        const timeStr = new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setLastAutoSaveTime(timeStr);
      } catch (e) {
        console.warn('Erro ao salvar rascunho do Word:', e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [docTitle, content]);
  
  // Text Styling States
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [fontSize, setFontSize] = useState<string>('16px');
  const [fontFamily, setFontFamily] = useState<string>('font-sans');
  const [activeHighlight, setActiveHighlight] = useState<string>('#fef08a'); // default yellow mark
  const [focusMode, setFocusMode] = useState(false);
  const [expansiveDeviceMode, setExpansiveDeviceMode] = useState<'pc' | 'mobile'>('pc');

  // Error Detection State
  const [errors, setErrors] = useState<GrammarError[]>([]);
  const [isCheckingErrors, setIsCheckingErrors] = useState(false);
  const [showErrorPanel, setShowErrorPanel] = useState(false);

  // AI Copilot state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Search & Replace
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Right-click Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stats
  const wordsCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charsCount = content.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 200));

  const applyFormatting = (prefix: string, suffix: string = prefix, defaultPlaceholder: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = content.substring(start, end) || defaultPlaceholder;

    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
    setContent(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + prefix.length,
          start + prefix.length + selectedText.length
        );
      }
    }, 50);
  };

  const applyHighlight = (colorHex: string) => {
    applyFormatting(`<mark style="background-color: ${colorHex}">`, '</mark>', 'texto destacado');
    showNotification('Marcação aplicada ao texto!', 'success');
  };

  const applyTextColor = (colorHex: string) => {
    applyFormatting(`<span style="color: ${colorHex}">`, '</span>', 'texto colorido');
    showNotification('Cor de texto aplicada!', 'success');
  };

  // Error Detector & Grammar Checker
  const checkGrammarAndErrors = async () => {
    if (!content.trim()) {
      showNotification('Digite algum texto para verificar erros.', 'error');
      return;
    }

    setIsCheckingErrors(true);
    setShowErrorPanel(true);

    try {
      // Local basic checks first
      const localErrors: GrammarError[] = [];
      const lines = content.split('\n');

      lines.forEach((line, lineIdx) => {
        // Double spaces
        if (line.includes('  ')) {
          localErrors.push({
            id: `err-space-${lineIdx}`,
            original: 'Espaço duplo detectado',
            suggestion: line.replace(/  +/g, ' '),
            reason: 'Espaços duplos consecutivos encontrados nesta linha.',
            index: lineIdx,
          });
        }
        // Repeated words
        const repeatedWordMatch = line.match(/\b(\w+)\s+\1\b/i);
        if (repeatedWordMatch) {
          localErrors.push({
            id: `err-rep-${lineIdx}`,
            original: `Palavra repetida: "${repeatedWordMatch[0]}"`,
            suggestion: repeatedWordMatch[1],
            reason: 'Repetição desnecessária de palavras consecutivas.',
            index: lineIdx,
          });
        }
      });

      // AI-powered Grammar & Spell Check
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: engineProvider,
          model: engineModel,
          messages: [
            {
              role: 'system',
              content: 'Você é um revisor ortográfico e gramatical profissional. Analise o texto do usuário e liste até 5 erros ortográficos, concordância ou pontuação no formato JSON estrito: [{"original": "palavra_errada", "suggestion": "palavra_correta", "reason": "explicação breve"}]. Se não houver erros, retorne uma array vazia []. Responda APENAS o JSON.',
            },
            { role: 'user', content }
          ]
        })
      });

      const data = await res.json();
      let aiErrors: GrammarError[] = [];
      if (res.ok && data.answer) {
        try {
          const jsonMatch = data.answer.match(/\[.*\]/s);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            aiErrors = parsed.map((item: any, i: number) => ({
              id: `ai-err-${i}`,
              original: item.original || 'Erro detectado',
              suggestion: item.suggestion || '',
              reason: item.reason || 'Sugestão de correção gramatical.',
              index: i,
            }));
          }
        } catch (e) {
          console.warn('AI error json parsing skipped');
        }
      }

      const combined = [...localErrors, ...aiErrors];
      setErrors(combined);

      if (combined.length === 0) {
        showNotification('Nenhum erro encontrado! Texto excelente.', 'success');
      } else {
        showNotification(`${combined.length} sugestão(ões) de correção encontrada(s)!`, 'success');
      }
    } catch (err) {
      showNotification('Erro ao verificar ortografia.', 'error');
    } finally {
      setIsCheckingErrors(false);
    }
  };

  const fixError = (error: GrammarError) => {
    if (error.original && error.suggestion) {
      if (error.original.includes('Espaço duplo') || error.original.includes('Palavra repetida')) {
        const lines = content.split('\n');
        lines[error.index] = error.suggestion;
        setContent(lines.join('\n'));
      } else {
        const updated = content.replace(error.original, error.suggestion);
        setContent(updated);
      }
      setErrors(prev => prev.filter(e => e.id !== error.id));
      showNotification(`Corrigido: "${error.original}" → "${error.suggestion}"`, 'success');
    }
  };

  const fixAllErrors = () => {
    let updated = content;
    errors.forEach(err => {
      if (err.original && err.suggestion && !err.original.includes('Espaço duplo')) {
        updated = updated.replace(err.original, err.suggestion);
      }
    });
    setContent(updated);
    setErrors([]);
    showNotification('Todas as correções aplicadas!', 'success');
  };

  const handleAiAssist = async (action: 'generate' | 'improve' | 'expand' | 'summarize') => {
    if (action === 'generate' && !aiPrompt.trim()) return;

    setIsAiGenerating(true);
    try {
      let promptText = '';
      if (action === 'generate') {
        promptText = `Escreva um documento profissional em português sobre: "${aiPrompt}". Use subtítulos e tópicos organizados em markdown.`;
      } else if (action === 'improve') {
        promptText = `Melhore o seguinte texto tornando-o mais elegante, claro e profissional:\n\n${content}`;
      } else if (action === 'expand') {
        promptText = `Expanda e adicione mais detalhes úteis ao seguinte documento:\n\n${content}`;
      } else if (action === 'summarize') {
        promptText = `Resuma o seguinte documento mantendo apenas os pontos principais:\n\n${content}`;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: engineProvider,
          model: engineModel,
          messages: [
            { role: 'system', content: 'Você é um redator sênior profissional. Responda em Markdown claro e estruturado.' },
            { role: 'user', content: promptText }
          ]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no copiloto de texto');

      setContent(data.answer);
      showNotification('Texto atualizado com IA!', 'success');
      setShowAiModal(false);
      setAiPrompt('');
    } catch (err: any) {
      showNotification(err.message || 'Falha ao processar IA', 'error');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSearchReplace = () => {
    if (!searchTerm) return;
    const regex = new RegExp(searchTerm, 'gi');
    const updated = content.replace(regex, replaceTerm);
    setContent(updated);
    showNotification(`Substituído com sucesso!`, 'success');
  };

  // Centraliza apenas a linha atual onde o cursor se encontra
  const centerCurrentLine = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const lines = content.split('\n');
    let currentLength = 0;
    let targetLineIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1;
      if (start >= currentLength && start <= currentLength + lineLen) {
        targetLineIdx = i;
        break;
      }
      currentLength += lineLen;
    }

    const currentLine = lines[targetLineIdx];
    if (currentLine.includes('<p align="center">') || currentLine.includes('<div align="center">')) {
      lines[targetLineIdx] = currentLine
        .replace(/<p align="center">/g, '')
        .replace(/<\/p>/g, '')
        .replace(/<div align="center">/g, '')
        .replace(/<\/div>/g, '');
      showNotification('Alinhamento da linha restaurado.', 'success');
    } else {
      lines[targetLineIdx] = `<p align="center">${currentLine}</p>`;
      showNotification('Linha atual centralizada!', 'success');
    }

    setContent(lines.join('\n'));
  };

  // State for Table Preset Inserter
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableStyle, setTableStyle] = useState<'corporate' | 'executive' | 'minimal' | 'amber' | 'dark'>('corporate');

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    showNotification('Conteúdo copiado para a área de transferência!', 'success');
  };

  const insertWordTable = (overrideStyle?: 'corporate' | 'executive' | 'minimal' | 'amber' | 'dark') => {
    const styleToUse = overrideStyle || tableStyle;
    const themeStyles = {
      corporate: { headerBg: '#2563eb', headerColor: '#ffffff', border: '#cbd5e1', zebraBg: '#eff6ff' },
      executive: { headerBg: '#059669', headerColor: '#ffffff', border: '#cbd5e1', zebraBg: '#ecfdf5' },
      minimal: { headerBg: '#475569', headerColor: '#ffffff', border: '#e2e8f0', zebraBg: '#f8fafc' },
      amber: { headerBg: '#d97706', headerColor: '#ffffff', border: '#fcd34d', zebraBg: '#fffbeb' },
      dark: { headerBg: '#0f172a', headerColor: '#ffffff', border: '#334155', zebraBg: '#1e293b' },
    }[styleToUse];

    let html = `\n<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">\n<thead>\n<tr style="background-color: ${themeStyles.headerBg}; color: ${themeStyles.headerColor};">\n`;
    for (let c = 1; c <= tableCols; c++) {
      html += `  <th style="padding: 10px; border: 1px solid ${themeStyles.border}; text-align: left;">Cabeçalho ${c}</th>\n`;
    }
    html += `</tr>\n</thead>\n<tbody>\n`;

    for (let r = 1; r <= tableRows; r++) {
      const bg = r % 2 === 0 ? themeStyles.zebraBg : '#ffffff';
      html += `<tr style="background-color: ${bg};">\n`;
      for (let c = 1; c <= tableCols; c++) {
        html += `  <td style="padding: 8px; border: 1px solid ${themeStyles.border};">Dado ${r}.${c}</td>\n`;
      }
      html += `</tr>\n`;
    }
    html += `</tbody>\n</table>\n`;

    setContent(prev => prev + html);
    setShowTableModal(false);
    showNotification('Tabela formatada inserida no documento!', 'success');
  };

  const parseFormattedRuns = (rawText: string): TextRun[] => {
    const textWithoutHash = rawText.replace(/^#+\s*/, '');
    const runs: TextRun[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|__.*?__|_[^_]+_)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(textWithoutHash)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: textWithoutHash.substring(lastIndex, match.index), font: 'Calibri' }));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        runs.push(new TextRun({ text: token.slice(2, -2), bold: true, font: 'Calibri' }));
      } else if (token.startsWith('*') && token.endsWith('*')) {
        runs.push(new TextRun({ text: token.slice(1, -1), italics: true, font: 'Calibri' }));
      } else if (token.startsWith('__') && token.endsWith('__')) {
        runs.push(new TextRun({ text: token.slice(2, -2), bold: true, font: 'Calibri' }));
      } else if (token.startsWith('_') && token.endsWith('_')) {
        runs.push(new TextRun({ text: token.slice(1, -1), italics: true, font: 'Calibri' }));
      } else {
        runs.push(new TextRun({ text: token, font: 'Calibri' }));
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < textWithoutHash.length) {
      runs.push(new TextRun({ text: textWithoutHash.substring(lastIndex), font: 'Calibri' }));
    }

    return runs.length > 0 ? runs : [new TextRun({ text: textWithoutHash, font: 'Calibri' })];
  };

  const exportDocx = async () => {
    try {
      const getAlignment = () => {
        if (textAlign === 'center') return AlignmentType.CENTER;
        if (textAlign === 'right') return AlignmentType.RIGHT;
        if (textAlign === 'justify') return AlignmentType.JUSTIFIED;
        return AlignmentType.LEFT;
      };

      const paragraphs = content.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          return new Paragraph({ text: '', spacing: { after: 120 } });
        }

        if (trimmed.startsWith('# ')) {
          return new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: getAlignment(),
            children: parseFormattedRuns(trimmed.replace(/^#\s+/, '')),
            spacing: { before: 240, after: 120 },
          });
        } else if (trimmed.startsWith('## ')) {
          return new Paragraph({
            heading: HeadingLevel.HEADING_2,
            alignment: getAlignment(),
            children: parseFormattedRuns(trimmed.replace(/^##\s+/, '')),
            spacing: { before: 200, after: 100 },
          });
        } else if (trimmed.startsWith('### ')) {
          return new Paragraph({
            heading: HeadingLevel.HEADING_3,
            alignment: getAlignment(),
            children: parseFormattedRuns(trimmed.replace(/^###\s+/, '')),
            spacing: { before: 160, after: 80 },
          });
        } else if (/^[-*•]\s+/.test(trimmed)) {
          return new Paragraph({
            bullet: { level: 0 },
            alignment: getAlignment(),
            children: parseFormattedRuns(trimmed.replace(/^[-*•]\s+/, '')),
            spacing: { after: 60 },
          });
        } else if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
          const numPrefix = numMatch ? numMatch[1] : '';
          const restText = numMatch ? numMatch[2] : trimmed;
          return new Paragraph({
            alignment: getAlignment(),
            children: [
              new TextRun({ text: `${numPrefix} `, bold: true, font: 'Calibri' }),
              ...parseFormattedRuns(restText)
            ],
            spacing: { after: 60 },
          });
        } else {
          return new Paragraph({
            alignment: getAlignment(),
            children: parseFormattedRuns(trimmed),
            spacing: { after: 120 },
          });
        }
      });

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, docTitle.endsWith('.docx') ? docTitle : `${docTitle}.docx`);
      showNotification('Documento DOCX exportado com sucesso com estilos nativos do Office!', 'success');

      if (onSaveToHistory) {
        onSaveToHistory({
          type: 'word',
          title: docTitle,
          summary: `${wordsCount} palavras, ${charsCount} caracteres. Exportado como DOCX nativo.`,
          details: content
        });
      }
    } catch (e) {
      showNotification('Erro ao exportar DOCX', 'error');
    }
  };

  const exportPdf = () => {
    try {
      const pdf = new jsPDF();
      const lines = pdf.splitTextToSize(content, 180);
      let y = 15;
      lines.forEach((line: string) => {
        if (y > 280) {
          pdf.addPage();
          y = 15;
        }
        pdf.text(line, 15, y);
        y += 7;
      });
      pdf.save(docTitle.replace(/\.(docx|txt)$/, '') + '.pdf');
      showNotification('PDF exportado com sucesso!', 'success');
    } catch {
      showNotification('Erro ao exportar PDF', 'error');
    }
  };

  const exportTxt = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, docTitle.replace(/\.(docx|pdf)$/, '') + '.txt');
    showNotification('TXT exportado!', 'success');
  };

  return (
    <div className={`space-y-4 transition-all ${focusMode ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>
      {/* Header bar */}
      <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 transition-colors duration-200">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="w-10 h-10 rounded-xl bg-[#1976D2] dark:bg-[#1E88E5] text-white flex items-center justify-center font-bold shadow-md shrink-0">
            W
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              aria-label="Nome do Documento Word"
              placeholder="Novo Documento Sem Título"
              className="text-[18px] font-bold text-slate-900 dark:text-slate-100 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 border border-transparent focus:border-[#1976D2] dark:focus:border-[#1E88E5] px-2 py-0.5 rounded-lg outline-none w-full transition-all duration-200"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1.5 flex-wrap">
              <span>{wordsCount} palavras</span>
              <span>•</span>
              <span>{charsCount} caracteres</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3 h-3 inline" aria-hidden="true" />
                {lastAutoSaveTime ? `Salvo às ${lastAutoSaveTime}` : 'Salvamento automático ativo'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={checkGrammarAndErrors}
            disabled={isCheckingErrors}
            aria-label="Verificar Ortografia e Gramática"
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold shadow-md transition-all duration-200 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-400"
            title="Verificar Ortografia e Gramática"
          >
            {isCheckingErrors ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <SpellCheck className="w-4 h-4" aria-hidden="true" />}
            <span>Revisar Erros</span>
            {errors.length > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-amber-700 text-[10px] font-black rounded-full">
                {errors.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAiModal(true)}
            aria-label="Abrir IA Copilot Word"
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>IA Copilot Word</span>
          </button>

          <button
            onClick={() => setPreviewMode(!previewMode)}
            aria-label={previewMode ? 'Alternar para Modo de Edição' : 'Alternar para Modo de Visualização'}
            className={`px-3 py-2 rounded-2xl text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-400 ${
              previewMode 
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' 
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {previewMode ? <Edit3 className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            <span>{previewMode ? 'Editar' : 'Visualizar Página'}</span>
          </button>

          <button
            onClick={() => setFocusMode(!focusMode)}
            aria-label={focusMode ? 'Sair do Modo Foco' : 'Entrar no Modo Foco Sem Distrações'}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-slate-400"
            title={focusMode ? 'Sair do Modo Foco' : 'Modo Foco Sem Distrações'}
          >
            {focusMode ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
          </button>

          <div className="flex gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
            <button
              onClick={exportDocx}
              aria-label="Exportar para formato DOCX"
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <FileOutput className="w-3.5 h-3.5" aria-hidden="true" /> DOCX
            </button>
            <button
              onClick={exportPdf}
              aria-label="Exportar para formato PDF"
              className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <FileOutput className="w-3.5 h-3.5" aria-hidden="true" /> PDF
            </button>
            <button
              onClick={exportTxt}
              aria-label="Exportar para formato TXT"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <FileOutput className="w-3.5 h-3.5" aria-hidden="true" /> TXT
            </button>
          </div>
        </div>
      </div>

      {/* Primary Rich Formatting Toolbar */}
      {!previewMode && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-2.5 flex flex-wrap items-center gap-1.5">
          {/* Text Alignment */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            {[
              { id: 'left' as const, icon: AlignLeft, title: 'Alinhar à Esquerda' },
              { id: 'center' as const, icon: AlignCenter, title: 'Centralizar' },
              { id: 'right' as const, icon: AlignRight, title: 'Alinhar à Direita' },
              { id: 'justify' as const, icon: AlignJustify, title: 'Justificar Texto' },
            ].map((align) => {
              const Icon = align.icon;
              return (
                <button
                  key={align.id}
                  onClick={() => setTextAlign(align.id)}
                  className={`p-1.5 rounded-xl transition-all ${
                    textAlign === align.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={align.title}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Font Family Selector */}
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-transparent outline-none focus:border-blue-500"
          >
            <option value="font-sans">Arial / Sans-serif</option>
            <option value="font-serif">Times New Roman / Serif</option>
            <option value="font-calibri">Calibri</option>
            <option value="font-georgia">Georgia</option>
            <option value="font-garamond">Garamond</option>
            <option value="font-verdana">Verdana</option>
            <option value="font-trebuchet">Trebuchet MS</option>
            <option value="font-mono">Courier New (Código)</option>
            <option value="font-comic">Comic Sans MS</option>
            <option value="font-playfair">Playfair Display</option>
            <option value="font-jakarta">Plus Jakarta Sans</option>
          </select>

          {/* Font Size Selector */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-transparent outline-none focus:border-blue-500"
          >
            <option value="14px">14px (Pequeno)</option>
            <option value="16px">16px (Normal)</option>
            <option value="18px">18px (Médio)</option>
            <option value="22px">22px (Grande)</option>
            <option value="28px">28px (Título)</option>
          </select>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Highlighting Tools */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-400 pl-1">Marcação:</span>
            {[
              { color: '#fef08a', name: 'Amarelo' },
              { color: '#fbcfe8', name: 'Rosa' },
              { color: '#bbf7d0', name: 'Verde' },
              { color: '#bfdbfe', name: 'Azul' },
            ].map(h => (
              <button
                key={h.color}
                onClick={() => applyHighlight(h.color)}
                className="w-6 h-6 rounded-lg border border-slate-300 dark:border-slate-700 hover:scale-110 transition-transform shadow-xs"
                style={{ backgroundColor: h.color }}
                title={`Destacar em ${h.name}`}
              />
            ))}
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Text Color Tools */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-400 pl-1">Cor do Texto:</span>
            {[
              { color: '#0f172a', name: 'Escuro' },
              { color: '#2563eb', name: 'Azul' },
              { color: '#dc2626', name: 'Vermelho' },
              { color: '#16a34a', name: 'Verde' },
              { color: '#7c3aed', name: 'Roxo' },
              { color: '#ea580c', name: 'Laranja' },
            ].map(tc => (
              <button
                key={tc.color}
                onClick={() => applyTextColor(tc.color)}
                className="w-6 h-6 rounded-lg border border-slate-300 dark:border-slate-700 hover:scale-110 transition-transform shadow-xs flex items-center justify-center font-bold text-[11px]"
                style={{ backgroundColor: tc.color, color: tc.color === '#ffffff' ? '#0f172a' : '#ffffff' }}
                title={`Cor do texto: ${tc.name}`}
              >
                A
              </button>
            ))}
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Format Styles */}
          <button
            onClick={() => applyFormatting('**', '**', 'negrito')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('*', '*', 'itálico')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs italic"
            title="Itálico"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('<u>', '</u>', 'sublinhado')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs underline"
            title="Sublinhado"
          >
            <Underline className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('~~', '~~', 'tachado')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs line-through"
            title="Tachado"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          <button
            onClick={() => applyFormatting('# ', '', 'Título 1')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-extrabold"
            title="Título 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('## ', '', 'Título 2')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
            title="Título 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('- ', '', 'Item da lista')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs"
            title="Lista com Marcadores"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('1. ', '', 'Primeiro item')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs"
            title="Lista Numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            onClick={centerCurrentLine}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1"
            title="Centralizar Apenas a Linha Atual (<p align='center'>)"
          >
            <AlignCenter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] hidden lg:inline">Linha</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Table Presets */}
          <div className="relative group flex items-center">
            <button
              onClick={() => insertWordTable('corporate')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs flex items-center gap-1"
              title="Inserir Tabela Estilizada (Padrão Corporativo)"
            >
              <Table className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </button>
            <div className="hidden group-hover:flex absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 flex-col gap-1 min-w-[160px]">
              <span className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">Estilos de Tabela</span>
              <button
                onClick={() => insertWordTable('corporate')}
                className="text-left px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200"
              >
                📊 Corporativa (Azul)
              </button>
              <button
                onClick={() => insertWordTable('executive')}
                className="text-left px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200"
              >
                💼 Executiva (Verde)
              </button>
              <button
                onClick={() => insertWordTable('amber')}
                className="text-left px-2.5 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-950 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200"
              >
                📙 Elegante (Âmbar)
              </button>
              <button
                onClick={() => insertWordTable('dark')}
                className="text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200"
              >
                ⬛ Dark Luxo
              </button>
              <button
                onClick={() => insertWordTable('minimal')}
                className="text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200"
              >
                📑 Minimalista
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl text-xs flex items-center gap-1 ${
              showSearch ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
            title="Localizar e Substituir"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={copyContent}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs"
              title="Copiar tudo"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm('Deseja limpar todo o texto do documento?')) setContent('');
              }}
              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-xl text-xs"
              title="Limpar texto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grammar / Error Detection Panel */}
      <AnimatePresence>
        {showErrorPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Painel de Revisão Ortográfica e Gramatical
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {errors.length > 0 && (
                  <button
                    onClick={fixAllErrors}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Corrigir Todos os Erros
                  </button>
                )}
                <button
                  onClick={() => setShowErrorPanel(false)}
                  className="p-1 hover:bg-amber-200/50 rounded-lg text-amber-700 dark:text-amber-300 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {errors.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Nenhum erro ortográfico ou gramatical detectado! Texto pronto para publicação.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {errors.map((err) => (
                  <div
                    key={err.id}
                    className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 flex items-start justify-between gap-3 text-xs shadow-xs"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-600 dark:text-rose-400 line-through">
                          {err.original}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-lg">
                          {err.suggestion}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{err.reason}</p>
                    </div>
                    <button
                      onClick={() => fixError(err)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-[11px] shrink-0"
                    >
                      Corrigir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Find and Replace bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs"
          >
            <input
              type="text"
              placeholder="Localizar texto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]"
            />
            <input
              type="text"
              placeholder="Substituir por..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]"
            />
            <button
              onClick={handleSearchReplace}
              className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Substituir
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Workspace Area */}
      <div 
        onContextMenu={handleContextMenu}
        className="bg-slate-100/80 dark:bg-slate-950/80 rounded-3xl p-4 sm:p-8 min-h-[550px] flex justify-center shadow-inner"
      >
        <motion.div
          layout
          className="bg-white dark:bg-slate-900 w-full max-w-4xl min-h-[600px] shadow-xl rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 sm:p-12 transition-all"
        >
          {previewMode ? (
            <div
              className={`prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-100 space-y-4 ${fontFamily}`}
              style={{ textAlign }}
            >
              {content.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('# ')) {
                  return <h1 key={idx} className="text-3xl font-extrabold text-slate-900 dark:text-white border-b pb-2">{paragraph.replace('# ', '')}</h1>;
                }
                if (paragraph.startsWith('## ')) {
                  return <h2 key={idx} className="text-2xl font-bold text-slate-900 dark:text-white mt-6">{paragraph.replace('## ', '')}</h2>;
                }
                if (paragraph.startsWith('### ')) {
                  return <h3 key={idx} className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-4">{paragraph.replace('### ', '')}</h3>;
                }
                if (paragraph.startsWith('- ')) {
                  return (
                    <ul key={idx} className="list-disc list-inside space-y-1">
                      {paragraph.split('\n').map((li, i) => (
                        <li key={i}>{li.replace('- ', '')}</li>
                      ))}
                    </ul>
                  );
                }
                // Support highlights and text color rendering in preview
                const formattedText = paragraph
                  .replace(/<mark style="background-color: (#[0-9a-fA-F]+)">(.*?)<\/mark>/g, (m, bg, txt) => {
                    return `<mark style="background-color: ${bg}; padding: 0 4px; border-radius: 4px;">${txt}</mark>`;
                  })
                  .replace(/<span style="color: (#[0-9a-fA-F]+)">(.*?)<\/span>/g, (m, color, txt) => {
                    return `<span style="color: ${color}; font-weight: 600;">${txt}</span>`;
                  });

                return (
                  <p
                    key={idx}
                    className="leading-relaxed"
                    style={{ fontSize }}
                    dangerouslySetInnerHTML={{ __html: formattedText }}
                  />
                );
              })}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onContextMenu={handleContextMenu}
              placeholder="Comece a digitar seu documento profissional aqui..."
              className={`w-full h-full min-h-[520px] text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none resize-none leading-relaxed ${fontFamily}`}
              style={{ textAlign, fontSize }}
            />
          )}
        </motion.div>
      </div>

      {/* AI Copilot Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Copiloto de Redação IA
                </h3>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gere um documento completo a partir de um comando ou aprimore o texto atual.
              </p>

              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex: 'Crie uma proposta comercial detalhada para desenvolvimento de aplicativo mobile...'"
                className="w-full h-28 p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAiAssist('generate')}
                  disabled={isAiGenerating || !aiPrompt.trim()}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
                >
                  {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Gerar do Zero
                </button>

                <button
                  onClick={() => handleAiAssist('improve')}
                  disabled={isAiGenerating}
                  className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Aprimorar Atual
                </button>
              </div>

              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  onClick={() => handleAiAssist('expand')}
                  disabled={isAiGenerating}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  + Expandir Detalhes
                </button>
                <button
                  onClick={() => handleAiAssist('summarize')}
                  disabled={isAiGenerating}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  • Resumir Ponto a Ponto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Expansive Dedicated View (Modo Página Expansiva PC / Celular) */}
      {focusMode && (
        <div 
          onContextMenu={handleContextMenu}
          className="fixed inset-0 z-50 bg-slate-200 dark:bg-slate-950 flex flex-col p-2 sm:p-6 overflow-y-auto font-sans"
        >
          {/* Top Floating Control Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 shadow-xl flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto w-full sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFocusMode(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                ← Voltar
              </button>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 outline-none text-slate-800 dark:text-slate-100 px-1"
              />
            </div>

            {/* Device PC vs Mobile View Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setExpansiveDeviceMode('pc')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  expansiveDeviceMode === 'pc'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                💻 Modo PC (Folha A4 Centrada)
              </button>
              <button
                onClick={() => setExpansiveDeviceMode('mobile')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  expansiveDeviceMode === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                📱 Modo Celular (Expansivo Fluido)
              </button>
            </div>

            {/* Quick Essential Formatting Tools */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => applyFormatting('**', '**', 'negrito')}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 text-xs font-bold"
                title="Negrito"
              >
                N
              </button>
              <button
                onClick={() => applyFormatting('*', '*', 'itálico')}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 text-xs italic font-bold"
                title="Itálico"
              >
                I
              </button>
              <button
                onClick={centerCurrentLine}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-slate-200 text-xs font-bold"
                title="Centralizar Linha"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertWordTable('corporate')}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-slate-200 text-xs font-bold"
                title="Inserir Tabela Corporativa"
              >
                <Table className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAiModal(true)}
                className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" /> IA
              </button>
            </div>
          </div>

          {/* Paper Sheet Document Canvas Area */}
          <div className="flex-1 flex justify-center py-6">
            <div
              className={`bg-white dark:bg-slate-900 shadow-2xl border border-slate-300 dark:border-slate-800 rounded-2xl p-8 sm:p-14 min-h-[800px] transition-all ${
                expansiveDeviceMode === 'pc' ? 'max-w-4xl w-full' : 'w-full'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onContextMenu={handleContextMenu}
                placeholder="Página expansiva limpa. Digite seu texto e use o botão direito do mouse para formatar..."
                className={`w-full h-full min-h-[720px] text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none resize-none leading-relaxed ${fontFamily}`}
                style={{ textAlign, fontSize }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          onClick={closeContextMenu}
          className="fixed inset-0 z-50 bg-transparent"
        >
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 min-w-[200px] z-50 text-xs font-semibold space-y-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">Menu do Word</div>
            <button
              onClick={() => { applyFormatting('**', '**', 'negrito'); closeContextMenu(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <Bold className="w-3.5 h-3.5 text-slate-500" /> Negrito
            </button>
            <button
              onClick={() => { applyFormatting('*', '*', 'itálico'); closeContextMenu(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <Italic className="w-3.5 h-3.5 text-slate-500" /> Itálico
            </button>
            <button
              onClick={() => { centerCurrentLine(); closeContextMenu(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <AlignCenter className="w-3.5 h-3.5 text-blue-600" /> Centralizar Linha
            </button>
            <button
              onClick={() => { insertWordTable('corporate'); closeContextMenu(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <Table className="w-3.5 h-3.5 text-indigo-600" /> Inserir Tabela Corporativa
            </button>
            <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
            <button
              onClick={() => { setShowAiModal(true); closeContextMenu(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" /> Copiloto de IA
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

