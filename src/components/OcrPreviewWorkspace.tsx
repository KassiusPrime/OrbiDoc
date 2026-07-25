import React, { useState, useRef } from 'react';
import { 
  FileText, Upload, Loader2, Copy, FileOutput, Send, Tag, Eye, 
  ZoomIn, ZoomOut, RotateCw, Maximize2, Trash2, Plus, X, Search,
  Check, File, Image as ImageIcon, Sparkles, Filter, SlidersHorizontal
} from 'lucide-react';
import { OcrItem } from '../types';
import { processFileOcr, OcrOptions } from '../lib/ocrEngine';

export interface OcrPreviewWorkspaceProps {
  items?: OcrItem[];
  setItems?: React.Dispatch<React.SetStateAction<OcrItem[]>>;
  ocrList?: OcrItem[];
  setOcrList?: React.Dispatch<React.SetStateAction<OcrItem[]>>;
  onSaveToHistory?: (title: string, summary: string, details?: string, tags?: string[]) => void;
  onSendToChat?: (text: string) => void;
  onSendToAiText?: (text: string) => void;
  onNotification?: (msg: string, type?: 'success' | 'error') => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  exportAsTxt?: (text: string, name: string) => void;
  exportAsDocx?: (text: string, name: string) => void;
  exportAsPdf?: (text: string, name: string) => void;
  onOpenCustomPdf?: (text: string, fileName: string) => void;
  setIsGoogleDriveOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

const PRESET_TAGS = ['Contrato', 'Fatura', 'Financeiro', 'Importante', 'PDF', 'Pessoal', 'Relatório', 'Trabalho'].sort();

// Alphabetically sorted language list for OCR engine
export const SORTED_LANGUAGES = [
  { code: 'de', name: 'Alemão', ocrCode: 'ger' },
  { code: 'ar', name: 'Árabe', ocrCode: 'ara' },
  { code: 'zh-CN', name: 'Chinês / Mandarim (Simplificado)', ocrCode: 'chi_sim' },
  { code: 'zh-TW', name: 'Chinês / Mandarim (Tradicional)', ocrCode: 'chi_tra' },
  { code: 'ko', name: 'Coreano', ocrCode: 'kor' },
  { code: 'es', name: 'Espanhol', ocrCode: 'spa' },
  { code: 'fr', name: 'Francês', ocrCode: 'fra' },
  { code: 'en', name: 'Inglês', ocrCode: 'eng' },
  { code: 'it', name: 'Italiano', ocrCode: 'ita' },
  { code: 'ja', name: 'Japonês', ocrCode: 'jpn' },
  { code: 'pt-BR', name: 'Português (Brasil)', ocrCode: 'por' },
  { code: 'ru', name: 'Russo', ocrCode: 'rus' },
].sort((a, b) => a.name.localeCompare(b.name));

export const OcrPreviewWorkspace: React.FC<OcrPreviewWorkspaceProps> = ({
  items: propsItems,
  setItems: propsSetItems,
  ocrList,
  setOcrList,
  onSaveToHistory,
  onSendToChat,
  onSendToAiText,
  onNotification,
  showNotification,
  exportAsTxt = () => {},
  exportAsDocx = () => {},
  exportAsPdf = () => {},
  onOpenCustomPdf,
  setIsGoogleDriveOpen,
}) => {
  const items = propsItems || ocrList || [];
  const setItems = propsSetItems || setOcrList || (() => {});
  const notify = onNotification || showNotification || (() => {});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState('por');
  const [newTagInput, setNewTagInput] = useState('');
  
  // Image Preview Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [showFullPreview, setShowFullPreview] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const newItemId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5);
      const fileUrl = URL.createObjectURL(file);

      const newItem: OcrItem = {
        id: newItemId,
        fileName: file.name,
        fileSize: file.size,
        text: '',
        status: 'processing',
        progress: 0,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fileUrl,
        fileType: file.type || file.name.split('.').pop()?.toLowerCase(),
        tags: [file.name.endsWith('.pdf') ? 'PDF' : 'Imagem', 'OCR'],
      };

      setItems((prev) => [newItem, ...prev]);
      setSelectedItemId(newItemId);

      try {
        const text = await processFileOcr(file, {
          language: selectedLang,
          onProgress: (p) => {
            setItems((prev) =>
              prev.map((i) => (i.id === newItemId ? { ...i, progress: p } : i))
            );
          },
        });

        setItems((prev) =>
          prev.map((i) =>
            i.id === newItemId ? { ...i, text, status: 'completed', progress: 100 } : i
          )
        );

        if (onSaveToHistory) {
          onSaveToHistory(
            `OCR: ${file.name}`,
            text.substring(0, 120) + '...',
            text,
            newItem.tags
          );
        }

        notify(`Digitalização de ${file.name} concluída com sucesso!`);
      } catch (err: any) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === newItemId
              ? { ...i, status: 'error', error: err.message || 'Erro no processamento OCR' }
              : i
          )
        );
        notify(`Erro ao processar ${file.name}`, 'error');
      }
    }

    e.target.value = '';
  };

  const handleAddTag = (itemId: string, tagToAdd: string) => {
    const cleanTag = tagToAdd.trim();
    if (!cleanTag) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentTags = item.tags || [];
          if (!currentTags.includes(cleanTag)) {
            return { ...item, tags: [...currentTags, cleanTag] };
          }
        }
        return item;
      })
    );
    setNewTagInput('');
  };

  const handleRemoveTag = (itemId: string, tagToRemove: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, tags: (item.tags || []).filter((t) => t !== tagToRemove) };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (selectedItemId === itemId) {
      setSelectedItemId(items.find((i) => i.id !== itemId)?.id || null);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesTag =
      selectedTagFilter === 'all' || (item.tags && item.tags.includes(selectedTagFilter));
    const matchesSearch =
      !searchQuery.trim() ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Upper Control & Upload Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Extrator OCR com Preview Lado a Lado (PC) & Tags
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digitalize imagens e PDFs em múltiplos idiomas com pré-visualização e etiquetagem rápida.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Selector sorted alphabetically */}
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {SORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.ocrCode}>
                  🌐 {lang.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md flex items-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4" />
              Enviar Documento / Imagem
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              accept="image/*,.pdf,.txt,.md,.csv,.json,.xml,.docx,.xlsx"
              className="hidden"
            />
          </div>
        </div>

        {/* Tags & Search Filter Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Tags:
            </span>
            <button
              onClick={() => setSelectedTagFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedTagFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todas ({items.length})
            </button>
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(tag)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedTagFilter === tag
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documento ou texto..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Split-View Workspace */}
      {items.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center hover:border-indigo-500 transition-all cursor-pointer space-y-4"
        >
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-md">
            <Upload className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Nenhum documento digitalizado ainda
            </h3>
            <p className="text-xs text-slate-400">
              Arraste ou clique para selecionar fotos de documentos, digitalizações ou PDFs
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* File Selector Sidebar */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Documentos ({filteredItems.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    activeItem?.id === item.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {item.fileName}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tags Badges */}
                  <div className="flex flex-wrap gap-1">
                    {(item.tags || []).map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-md"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>{item.timestamp}</span>
                    <span
                      className={`font-bold ${
                        item.status === 'completed'
                          ? 'text-emerald-500'
                          : item.status === 'processing'
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {item.status === 'completed' ? 'Pronto' : item.status === 'processing' ? 'Lendo...' : 'Erro'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center Pane: Original Visual OCR Preview */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-500" />
                Pré-visualização do Documento
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                  title="Girar"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowFullPreview(!showFullPreview)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                  title="Expandir"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Preview Stage */}
            <div className="relative min-h-[420px] max-h-[520px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center p-4">
              {activeItem?.fileUrl ? (
                activeItem.fileName.endsWith('.pdf') ? (
                  <iframe
                    src={activeItem.fileUrl}
                    title="PDF Preview"
                    className="w-full h-[450px] rounded-xl border-none"
                  />
                ) : (
                  <div className="overflow-auto max-h-[450px] w-full flex items-center justify-center">
                    <img
                      src={activeItem.fileUrl}
                      alt="Original Document"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease',
                      }}
                      className="max-w-full h-auto rounded-lg shadow-2xl object-contain"
                    />
                  </div>
                )
              ) : (
                <div className="text-center text-slate-500 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs">Nenhuma pré-visualização visual disponível</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Extracted Text & Tags Manager */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Texto Extraído (Editável)
              </span>

              {activeItem?.text && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeItem.text);
                    notify('Texto copiado com sucesso!');
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Document Tagging Bar */}
            {activeItem && (
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-indigo-500" /> Tags do Documento:
                </span>

                <div className="flex flex-wrap gap-1.5">
                  {(activeItem.tags || []).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(activeItem.id, tag)}
                        className="hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(activeItem.id, newTagInput)}
                    placeholder="Adicionar nova tag..."
                    className="flex-1 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => handleAddTag(activeItem.id, newTagInput)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Textarea for Extracted Content */}
            {activeItem ? (
              <textarea
                value={activeItem.text}
                onChange={(e) => {
                  const updatedText = e.target.value;
                  setItems((prev) =>
                    prev.map((i) => (i.id === activeItem.id ? { ...i, text: updatedText } : i))
                  );
                }}
                placeholder="Aguardando extração do texto..."
                className="w-full h-72 text-xs bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed font-mono"
              />
            ) : (
              <div className="h-72 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center text-xs text-slate-400">
                Selecione um documento para visualizar o texto
              </div>
            )}

            {/* Export & Action Buttons */}
            {activeItem?.text && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => exportAsTxt(activeItem.text, activeItem.fileName)}
                    className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1"
                  >
                    <FileOutput className="w-3.5 h-3.5" /> TXT
                  </button>
                  <button
                    onClick={() => exportAsDocx(activeItem.text, activeItem.fileName)}
                    className="py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1"
                  >
                    <FileOutput className="w-3.5 h-3.5" /> DOCX
                  </button>
                  <button
                    onClick={() => exportAsPdf(activeItem.text, activeItem.fileName)}
                    className="py-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1"
                  >
                    <FileOutput className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(activeItem.text)}
                      className="py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar para Chat
                    </button>
                  )}
                  {onSendToAiText && (
                    <button
                      onClick={() => onSendToAiText(activeItem.text)}
                      className="py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Processar IA
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
