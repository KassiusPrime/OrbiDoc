import React, { useState } from 'react';
import { MessageSquare, Plus, Search, Trash2, Edit2, Check, FileOutput, Calendar, Bot, ArrowRight, Sparkles, ExternalLink } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types';
import { CleanMarkdown } from './CleanMarkdown';

interface ChatHistoryVaultProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onExportPdf: (sessionText: string, title: string) => void;
}

export const ChatHistoryVault: React.FC<ChatHistoryVaultProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onExportPdf,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const handleStartRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const handleSaveRename = (sId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(sId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleExportSessionText = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedText = s.messages
      .map((m) => `[${m.role === 'user' ? 'Usuário' : 'Assistente IA'}]\n${m.content}`)
      .join('\n\n---\n\n');
    onExportPdf(formattedText, s.title);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Antigos Chats & Histórico de Conversas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Acesse, retome e gerencie suas conversas anteriores salvas
          </p>
        </div>

        <button
          onClick={onNewSession}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Chat
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar em conversas anteriores..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="p-12 text-center text-slate-400 space-y-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
          <MessageSquare className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm font-medium">Nenhum chat antigo encontrado.</p>
          <p className="text-xs text-slate-400">Inicie uma nova conversa para registrar seu histórico aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const lastMessage = session.messages[session.messages.length - 1];

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  isActive
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-800 shadow-md'
                    : 'bg-slate-50/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div>
                  {/* Title & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {editingId === session.id ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border rounded-lg w-full"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveRename(session.id, e)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate flex-1">
                        {session.title}
                      </h4>
                    )}

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleStartRename(session, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        title="Renomear Chat"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleExportSessionText(session, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        title="Exportar PDF Customizado"
                      >
                        <FileOutput className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                        title="Excluir Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Last Message Snippet */}
                  {lastMessage && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 my-2 bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      {lastMessage.content.slice(0, 100)}...
                    </div>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(session.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                    {session.messages.length} msg <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
