import React, { useState } from 'react';
import { 
  History, Search, Trash2, FileText, Bot, SplitSquareHorizontal, 
  Sparkles, Image as ImageIcon, Volume2, ArrowRight, Copy, Check, Download, ExternalLink 
} from 'lucide-react';
import { HistoryItem, TabType } from '../types';

interface HistoryVaultProps {
  items: HistoryItem[];
  onClearAll: () => void;
  onDeleteItem: (id: string) => void;
  onRestoreItem: (item: HistoryItem) => void;
  onCopyText: (text: string) => void;
}

export const HistoryVault: React.FC<HistoryVaultProps> = ({
  items,
  onClearAll,
  onDeleteItem,
  onRestoreItem,
  onCopyText,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.summary.toLowerCase().includes(search.toLowerCase()) ||
      (item.details && item.details.toLowerCase().includes(search.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const handleCopy = (id: string, text: string) => {
    onCopyText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeIcon = (type: HistoryItem['type']) => {
    switch (type) {
      case 'ocr':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'chat':
        return <Bot className="w-4 h-4 text-indigo-400" />;
      case 'compare':
        return <SplitSquareHorizontal className="w-4 h-4 text-amber-400" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-pink-400" />;
      case 'audio':
        return <Volume2 className="w-4 h-4 text-cyan-400" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: HistoryItem['type']) => {
    switch (type) {
      case 'ocr': return 'OCR';
      case 'chat': return 'Chat IA';
      case 'compare': return 'Arena';
      case 'ai': return 'Texto IA';
      case 'image': return 'Imagem';
      case 'audio': return 'Áudio';
      default: return 'Geral';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Histórico de Atividades
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {filteredItems.length} de {items.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Sessões, documentos extraídos, chats e imagens geradas
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Tudo
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar histórico..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'ocr', label: 'OCR' },
            { id: 'chat', label: 'Chat' },
            { id: 'ai', label: 'Texto' },
            { id: 'image', label: 'Imagens' },
            { id: 'audio', label: 'Áudio' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500 p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
            <History className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium text-slate-400">Nenhum registro encontrado</p>
            <p className="text-xs text-slate-600 max-w-xs mt-1">
              As operações executadas no aplicativo (OCR, Chat, Traduções e Imagens) aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition-all shadow-sm flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800">
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200 font-mono">
                        {item.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                        {getTypeLabel(item.type)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteItem(item.id)}
                  title="Excluir este item"
                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-md transition-colors opacity-60 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Summary Text or Preview */}
              <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/80 text-xs text-slate-300 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {item.summary}
              </div>

              {/* Media URL if generated image */}
              {item.mediaUrl && (
                <div className="relative rounded-lg overflow-hidden border border-slate-800 max-h-48 bg-slate-950">
                  <img
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-full object-cover max-h-48 hover:scale-105 transition-transform duration-300"
                  />
                  <a
                    href={item.mediaUrl}
                    download="generated-image.png"
                    className="absolute bottom-2 right-2 p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 text-xs flex items-center gap-1 shadow-lg"
                  >
                    <Download className="w-3 h-3" />
                    Baixar
                  </a>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                <button
                  onClick={() => onRestoreItem(item)}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Restaurar no Módulo
                </button>

                <button
                  onClick={() => handleCopy(item.id, item.details || item.summary)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
