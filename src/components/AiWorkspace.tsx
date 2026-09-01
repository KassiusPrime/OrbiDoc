import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown as ArrowDown,
  IconCopy as Copy,
  IconFileText as FileText,
  IconLoader2 as Loader2,
  IconPaperclip as Paperclip,
  IconPlayerStop as Stop,
  IconRefresh as Refresh,
  IconSend as Send,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconWorldSearch as WorldSearch,
} from '@tabler/icons-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { sendToVercelStream, type AiMessage as ApiMessage } from '../api/chat';
import { CleanMarkdown } from './CleanMarkdown';

/** Kept only so dormant legacy AppV2–V4 files still type-check during migration. */
export type AiModelOption = {
  id: string;
  provider: string;
  label: string;
  enabled: boolean;
  recommended?: boolean;
  preview?: boolean;
  webSearch?: boolean;
};

export interface AiWorkspaceProps {
  selectedModelKey?: string;
  onSelectedModelChange?: (modelKey: string) => void;
  onSendToWord?: (text: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type ChatRole = 'user' | 'assistant';
type ChatEntry = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  streaming?: boolean;
  webSearch?: boolean;
};

type ToolCallState = 'running' | 'done' | 'error';

const CHAT_STORAGE_KEY = 'orbit_nexus_ai_chat_v1';
const INTERNAL_PROVIDER = 'openrouter';
const INTERNAL_MODEL = 'openrouter/free';

function loadMessages(): ChatEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatEntry => Boolean(
        item
        && typeof item === 'object'
        && typeof (item as ChatEntry).id === 'string'
        && ((item as ChatEntry).role === 'user' || (item as ChatEntry).role === 'assistant')
        && typeof (item as ChatEntry).content === 'string',
      ))
      .slice(-50);
  } catch {
    return [];
  }
}

function toApiMessages(messages: readonly ChatEntry[]): ApiMessage[] {
  return messages
    .filter((message) => message.content.trim())
    .map((message) => ({ role: message.role, content: message.content }));
}

function createEntry(role: ChatRole, content: string, extras?: Partial<Pick<ChatEntry, 'streaming' | 'webSearch'>>): ChatEntry {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extras,
  };
}

export const StreamingCursor: React.FC = () => (
  <span
    aria-hidden="true"
    className="ml-1 inline-block h-4 w-[3px] rounded-full bg-gradient-to-b from-[#7C3AED] to-[#A78BFA] animate-pulse align-text-bottom"
  />
);

export const UserMessage: React.FC<{ message: ChatEntry }> = ({ message }) => (
  <article className="flex justify-end px-3 sm:px-5 py-2">
    <div className="max-w-[88%] sm:max-w-[78%] rounded-[20px] rounded-br-md bg-[#7C3AED] px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
      <div className="whitespace-pre-wrap break-words">{message.content}</div>
      <time className="mt-1.5 block text-right text-[9px] text-white/65" dateTime={message.createdAt}>
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  </article>
);

export const AIMessage: React.FC<{
  message: ChatEntry;
  onCopy: (text: string) => void;
  onSendToWord?: (text: string) => void;
}> = ({ message, onCopy, onSendToWord }) => (
  <article className="group px-3 sm:px-5 py-2">
    <div className="max-w-[920px] rounded-[22px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F0F11] p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-black">Nexus AI</span>
        {message.webSearch ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 px-2 py-1 text-[9px] font-black text-violet-700 dark:text-violet-300">
            <WorldSearch className="h-3 w-3" /> Web
          </span>
        ) : null}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
        {message.content ? <CleanMarkdown content={message.content} /> : null}
        {message.streaming ? <StreamingCursor /> : null}
      </div>
      {!message.streaming && message.content ? (
        <div className="mt-4 flex flex-wrap gap-2 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => onCopy(message.content)} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
          {onSendToWord ? (
            <button type="button" onClick={() => onSendToWord(message.content)} className="h-8 px-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[9px] font-black inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Abrir no OrbiDoc
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  </article>
);

export const MessageList: React.FC<{
  messages: ChatEntry[];
  onCopy: (text: string) => void;
  onSendToWord?: (text: string) => void;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
}> = ({ messages, onCopy, onSendToWord, virtuosoRef }) => {
  if (!messages.length) return null;
  return (
    <Virtuoso
      ref={virtuosoRef}
      className="flex-1 min-h-0"
      data={messages}
      followOutput="smooth"
      initialTopMostItemIndex={Math.max(0, messages.length - 1)}
      increaseViewportBy={{ top: 320, bottom: 480 }}
      itemContent={(_index, message) => message.role === 'user'
        ? <UserMessage message={message} />
        : <AIMessage message={message} onCopy={onCopy} onSendToWord={onSendToWord} />}
    />
  );
};

export const SuggestionChips: React.FC<{ onSelect: (prompt: string) => void }> = ({ onSelect }) => {
  const suggestions = [
    'Resuma o documento atual em pontos objetivos',
    'Melhore este texto mantendo meu tom',
    'Crie uma tabela clara com os principais dados',
    'Pesquise informações atuais e cite fontes',
  ];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export const ToolCallCard: React.FC<{ title: string; state: ToolCallState; detail?: string }> = ({ title, state, detail }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs">
    <div className="flex items-center gap-2 font-black">
      {state === 'running' ? <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> : state === 'done' ? <Sparkles className="h-4 w-4 text-emerald-500" /> : <Refresh className="h-4 w-4 text-rose-500" />}
      {title}
    </div>
    {detail ? <p className="mt-1 text-[10px] text-slate-500">{detail}</p> : null}
  </div>
);

export const AIChatHeader: React.FC<{
  webSearch: boolean;
  busy: boolean;
  onWebSearchChange: (value: boolean) => void;
  onClear: () => void;
}> = ({ webSearch, busy, onWebSearchChange, onClear }) => (
  <header className="shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-[#0F0F11]/90 backdrop-blur-xl px-3 sm:px-4 py-3 flex items-center gap-3">
    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white flex items-center justify-center shadow-lg shadow-violet-500/15">
      <Sparkles className="h-5 w-5" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2"><h1 className="text-sm font-black">Nexus AI</h1><span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Free-only</span></div>
      <p className="text-[10px] text-slate-500 truncate">Assistente unificado do Orbit · roteamento automático</p>
    </div>
    <label className={`hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border px-2.5 text-[9px] font-black cursor-pointer ${webSearch ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
      <input className="sr-only" type="checkbox" checked={webSearch} onChange={(event) => onWebSearchChange(event.target.checked)} disabled={busy} />
      <WorldSearch className="h-4 w-4" /> Web
    </label>
    <button type="button" onClick={onClear} disabled={busy} className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-40" aria-label="Limpar conversa">
      <Trash className="h-4 w-4" />
    </button>
  </header>
);

export const AIComposer: React.FC<{
  value: string;
  busy: boolean;
  webSearch: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onWebSearchChange: (value: boolean) => void;
}> = ({ value, busy, webSearch, onChange, onSubmit, onStop, onWebSearchChange }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(180, Math.max(44, node.scrollHeight))}px`;
  }, [value]);

  return (
    <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-white/92 dark:bg-[#0F0F11]/94 backdrop-blur-xl px-3 sm:px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-4xl rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09090B] p-2 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/10">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!busy) onSubmit();
            }
          }}
          rows={1}
          placeholder="Pergunte ao Nexus AI…"
          aria-label="Mensagem para Nexus AI"
          className="block w-full resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-slate-400"
        />
        <div className="flex items-center gap-2 px-1 pb-1">
          <button type="button" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Anexar arquivo" title="Anexos serão conectados ao contexto do Orbispace em uma etapa posterior">
            <Paperclip className="h-4 w-4" />
          </button>
          <label className={`sm:hidden h-9 px-2.5 rounded-xl inline-flex items-center gap-1.5 text-[9px] font-black cursor-pointer ${webSearch ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300' : 'text-slate-500'}`}>
            <input className="sr-only" type="checkbox" checked={webSearch} onChange={(event) => onWebSearchChange(event.target.checked)} disabled={busy} />
            <WorldSearch className="h-4 w-4" /> Web
          </label>
          <span className="ml-auto hidden sm:inline text-[9px] text-slate-400">Enter envia · Shift+Enter quebra linha</span>
          {busy ? (
            <button type="button" onClick={onStop} className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black inline-flex items-center gap-1.5">
              <Stop className="h-4 w-4" /> Parar
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={!value.trim()} className="h-9 px-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-[10px] font-black inline-flex items-center gap-1.5 disabled:opacity-35">
              <Send className="h-4 w-4" /> Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export class ErrorBoundaryAI extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-4 rounded-3xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-6 text-center">
        <h2 className="text-sm font-black text-rose-800 dark:text-rose-200">Nexus AI encontrou um erro de interface</h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">O restante do OrbiDoc continua funcionando.</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-4 h-9 px-3 rounded-xl bg-rose-700 text-white text-[10px] font-black">Tentar novamente</button>
      </div>
    );
  }
}

export const AIChatPanel: React.FC<AiWorkspaceProps> = ({ onSendToWord, showNotification = () => {} }) => {
  const [messages, setMessages] = useState<ChatEntry[]>(loadMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const serializable = messages.map(({ streaming: _streaming, ...message }) => message);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serializable.slice(-50)));
  }, [messages]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const hasMessages = messages.length > 0;
  const lastAssistant = useMemo(() => [...messages].reverse().find((message) => message.role === 'assistant' && !message.streaming), [messages]);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    showNotification('Resposta copiada.', 'success');
  };

  const stop = () => controllerRef.current?.abort();
  const clear = () => {
    controllerRef.current?.abort();
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const submit = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    const user = createEntry('user', text, { webSearch });
    const assistant = createEntry('assistant', '', { streaming: true, webSearch });
    const context = [...messages, user];
    setMessages([...context, assistant]);
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      let answer = '';
      await sendToVercelStream(
        INTERNAL_PROVIDER,
        INTERNAL_MODEL,
        toApiMessages(context),
        (chunk) => {
          answer += chunk;
          setMessages((current) => current.map((message) => message.id === assistant.id ? { ...message, content: answer } : message));
        },
        { signal: controller.signal, webSearch },
      );
      setMessages((current) => current.map((message) => message.id === assistant.id ? { ...message, content: answer, streaming: false } : message));
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        setMessages((current) => current.map((message) => message.id === assistant.id ? { ...message, streaming: false, content: message.content || 'Resposta interrompida.' } : message));
      } else {
        const message = error instanceof Error ? error.message : 'Falha ao consultar o Nexus AI.';
        setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, streaming: false, content: `Não consegui concluir esta solicitação. ${message}` } : item));
        showNotification(message, 'error');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  };

  return (
    <div className="orbidoc-ai-studio h-[calc(100dvh-7.5rem)] min-h-[520px] overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#09090B] shadow-sm flex flex-col">
      <AIChatHeader webSearch={webSearch} busy={busy} onWebSearchChange={setWebSearch} onClear={clear} />

      {!hasMessages ? (
        <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 py-10">
          <div className="max-w-2xl text-center">
            <div className="mx-auto h-16 w-16 rounded-[24px] bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white flex items-center justify-center shadow-xl shadow-violet-500/20">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl sm:text-3xl font-black tracking-tight">Como o Nexus AI pode ajudar?</h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">Um único assistente para todo o Orbit. Ele decide internamente a melhor rota gratuita para escrever, analisar, programar, trabalhar no OrbiDoc ou pesquisar informações atuais.</p>
            <div className="mt-6"><SuggestionChips onSelect={(prompt) => { setInput(prompt); void submit(prompt); }} /></div>
          </div>
        </div>
      ) : (
        <MessageList messages={messages} onCopy={copy} onSendToWord={onSendToWord} virtuosoRef={virtuosoRef} />
      )}

      {hasMessages && lastAssistant ? (
        <button type="button" onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' })} className="absolute right-8 bottom-28 z-10 h-9 w-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg items-center justify-center hidden" aria-label="Ir para a resposta mais recente">
          <ArrowDown className="h-4 w-4" />
        </button>
      ) : null}

      <AIComposer value={input} busy={busy} webSearch={webSearch} onChange={setInput} onSubmit={() => void submit()} onStop={stop} onWebSearchChange={setWebSearch} />
    </div>
  );
};

export const AiWorkspace: React.FC<AiWorkspaceProps> = (props) => (
  <ErrorBoundaryAI><AIChatPanel {...props} /></ErrorBoundaryAI>
);
