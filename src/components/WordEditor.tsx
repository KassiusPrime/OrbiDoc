import React, { useState, useRef } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, FileOutput, Sparkles, Copy, Trash2, Eye, Edit3, Type, Heading1, Heading2,
  Heading3, Table, Image as ImageIcon, Search, RefreshCw, Check, Loader2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
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

export const WordEditor: React.FC<WordEditorProps> = ({
  initialContent = '',
  onSaveToHistory,
  showNotification = () => {},
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const [docTitle, setDocTitle] = useState('Novo Documento.docx');
  const [content, setContent] = useState(initialContent || '### Relatório Executivo e Proposta\n\nBem-vindo ao **Word Studio Pro**! Digite seu texto aqui ou utilize as ferramentas de IA para gerar conteúdos completos, relatórios e revisões.\n\n- Suporte a marcação e formatação rápida\n- Exportação direta para **DOCX**, **PDF** e **TXT**\n- Copiloto com Inteligência Artificial integrada\n');
  const [previewMode, setPreviewMode] = useState(false);
  
  // AI Copilot state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Search & Replace
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stats
  const wordsCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charsCount = content.length;
  const readingTimeMinutes = Math.ceil(wordsCount / 200);

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

  const handleAiAssist = async (action: 'generate' | 'improve' | 'expand' | 'summarize') => {
    if (action === 'generate' && !aiPrompt.trim()) return;

    setIsAiGenerating(true);
    try {
      let promptText = '';
      if (action === 'generate') {
        promptText = `Escreva um documento profissional em português sobre: "${aiPrompt}". Use subtítulos e tópicos organizados em markdown.`;
      } else if (action === 'improve') {
        promptText = `Melhore o seguinte texto tornando-o mais elegante e profissional:\n\n${content}`;
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

      if (action === 'generate') {
        setContent(data.answer);
      } else {
        setContent(data.answer);
      }

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

  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
    showNotification('Copiado para a área de transferência!', 'success');
  };

  const exportDocx = async () => {
    try {
      const paragraphs = content.split('\n').map(line => {
        const isHeader = line.startsWith('#');
        const cleanLine = line.replace(/^#+\s*/, '');
        return new Paragraph({
          children: [
            new TextRun({
              text: cleanLine,
              bold: isHeader || line.includes('**'),
              size: isHeader ? 28 : 24,
            })
          ]
        });
      });

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, docTitle.endsWith('.docx') ? docTitle : `${docTitle}.docx`);
      showNotification('Documento DOCX exportado com sucesso!', 'success');

      if (onSaveToHistory) {
        onSaveToHistory({
          type: 'word',
          title: docTitle,
          summary: `${wordsCount} palavras, ${charsCount} caracteres. Exportado como DOCX.`,
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
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
            W
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="text-base font-bold text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent focus:border-blue-400 px-2 py-0.5 rounded-lg outline-none w-full"
            />
            <p className="text-xs text-slate-500 px-2">
              {wordsCount} palavras • {charsCount} caracteres • ~{readingTimeMinutes} min de leitura
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            IA Copilot Word
          </button>

          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
              previewMode 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {previewMode ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Editar' : 'Visualização de Página'}
          </button>

          <div className="flex gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={exportDocx}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <FileOutput className="w-3.5 h-3.5" /> DOCX
            </button>
            <button
              onClick={exportPdf}
              className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <FileOutput className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={exportTxt}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <FileOutput className="w-3.5 h-3.5" /> TXT
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {!previewMode && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2 flex flex-wrap items-center gap-1">
          <button
            onClick={() => applyFormatting('**', '**', 'texto em negrito')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('*', '*', 'texto em itálico')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs italic flex items-center gap-1"
            title="Itálico"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('<u>', '</u>', 'texto sublinhado')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs underline flex items-center gap-1"
            title="Sublinhado"
          >
            <Underline className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('~~', '~~', 'texto tachado')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs line-through flex items-center gap-1"
            title="Tachado"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-1" />

          <button
            onClick={() => applyFormatting('# ', '', 'Título 1')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-extrabold flex items-center gap-1"
            title="Título 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('## ', '', 'Título 2')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
            title="Título 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('### ', '', 'Título 3')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
            title="Título 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-1" />

          <button
            onClick={() => applyFormatting('- ', '', 'Item da lista')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs flex items-center gap-1"
            title="Lista com Marcadores"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('1. ', '', 'Primeiro item')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs flex items-center gap-1"
            title="Lista Numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            onClick={() => applyFormatting('> ', '', 'Citação destacada')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs flex items-center gap-1"
            title="Citação"
          >
            <Type className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-1" />

          <button
            onClick={() => applyFormatting('| Coluna 1 | Coluna 2 |\n| --- | --- |\n| Item 1 | Item 2 |\n', '', '')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs flex items-center gap-1"
            title="Inserir Tabela"
          >
            <Table className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const url = prompt('Insira a URL da imagem:');
              if (url) applyFormatting(`![Imagem](${url})`, '', '');
            }}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg text-xs flex items-center gap-1"
            title="Inserir Imagem"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-1" />

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg text-xs flex items-center gap-1 ${
              showSearch ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Localizar e Substituir"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={copyContent}
              className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg text-xs flex items-center gap-1"
              title="Copiar tudo"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm('Deseja limpar todo o texto do documento?')) setContent('');
              }}
              className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg text-xs flex items-center gap-1"
              title="Limpar texto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Find and Replace bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs"
          >
            <input
              type="text"
              placeholder="Localizar texto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]"
            />
            <input
              type="text"
              placeholder="Substituir por..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]"
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
      <div className="bg-slate-100/80 rounded-3xl p-4 sm:p-8 min-h-[550px] flex justify-center shadow-inner">
        <motion.div
          layout
          className="bg-white w-full max-w-4xl min-h-[600px] shadow-xl rounded-2xl border border-slate-200/90 p-8 sm:p-12 transition-all"
        >
          {previewMode ? (
            <div className="prose prose-slate max-w-none text-slate-800 space-y-4">
              {content.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('# ')) {
                  return <h1 key={idx} className="text-3xl font-extrabold text-slate-900 border-b pb-2">{paragraph.replace('# ', '')}</h1>;
                }
                if (paragraph.startsWith('## ')) {
                  return <h2 key={idx} className="text-2xl font-bold text-slate-900 mt-6">{paragraph.replace('## ', '')}</h2>;
                }
                if (paragraph.startsWith('### ')) {
                  return <h3 key={idx} className="text-xl font-semibold text-slate-800 mt-4">{paragraph.replace('### ', '')}</h3>;
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
                return <p key={idx} className="leading-relaxed text-base">{paragraph}</p>;
              })}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Comece a digitar seu documento profissional aqui..."
              className="w-full h-full min-h-[520px] text-base text-slate-800 bg-transparent border-none outline-none resize-none leading-relaxed font-sans"
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
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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

              <p className="text-xs text-slate-500">
                Gere um documento completo a partir de um comando ou aprimore o texto atual.
              </p>

              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex: 'Crie uma proposta comercial detalhada para desenvolvimento de aplicativo mobile...'"
                className="w-full h-28 p-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAiAssist('generate')}
                  disabled={isAiGenerating || !aiPrompt.trim()}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
                >
                  {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Gerar do Zero
                </button>

                <button
                  onClick={() => handleAiAssist('improve')}
                  disabled={isAiGenerating}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Aprimorar Atual
                </button>
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-3">
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
    </div>
  );
};
