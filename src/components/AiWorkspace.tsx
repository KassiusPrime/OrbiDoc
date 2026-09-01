import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown as ArrowDown,
  IconCopy as Copy,
  IconFileText as FileText,
  IconFolder as Folder,
  IconHistory as History,
  IconLoader2 as Loader2,
  IconPaperclip as Paperclip,
  IconPlayerStop as Stop,
  IconPlus as Plus,
  IconRefresh as Refresh,
  IconSend as Send,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconWorldSearch as WorldSearch,
} from '@tabler/icons-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { sendToVercelStream, type AiMessage as ApiMessage } from '../api/chat';
import { CleanMarkdown } from './CleanMarkdown';

/** Compatibility type retained while older editor props finish migrating. */
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

const CHAT_STORAGE_KEY = 'orbit_nexus_ai_chat_v1';
const DRAFT_STORAGE_KEY = 'orbit_nexus_ai_draft_v1';
const INTERNAL_PROVIDER = 'openrouter';
const INTERNAL_MODEL = 'openrouter/free';

function loadMessages(): ChatEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChatEntry => Boolean(
      item
      && typeof item === 'object'
      && typeof (item as ChatEntry).id === 'string'
      && ((item as ChatEntry).role === 'user' || (item as ChatEntry).role === 'assistant')
      && typeof (item as ChatEntry).content === 'string',
    )).slice(-80);
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

function clickNavigation(label: string): void {
  const candidate = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.trim() === label || button.textContent?.trim().includes(label));
  candidate?.click();
}

const suggestionPrompts = [
  { label: 'Resumir', prompt: 'Resuma o documento atual em pontos objetivos e preserve os fatos importantes.' },
  { label: 'Analisar', prompt: 'Analise o arquivo ou contexto atual e destaque riscos, padrões e próximos passos.' },
  { label: 'Pesquisar', prompt: 'Pesquise informações atuais sobre este tema e cite as fontes mais relevantes.' },
  { label: 'Criar', prompt: 'Crie uma primeira versão clara e pronta para edição a partir do meu contexto.' },
  { label: 'Programar', prompt: 'Ajude a implementar ou depurar este código com uma solução objetiva e segura.' },
  { label: 'OrbiDoc', prompt: 'Transforme minha solicitação em conteúdo pronto para trabalhar dentro do OrbiDoc.' },
] as const;

export const StreamingCursor: React.FC = () => (
  <span aria-hidden="true" className="ml-1 inline-block h-4 w-[2px] rounded-full bg-[#6750D8] animate-pulse align-text-bottom" />
);

export const UserMessage: React.FC<{ message: ChatEntry }> = ({ message }) => (
  <article className="flex justify-end px-3 sm:px-5 py-2">
    <div className="max-w-[90%] sm:max-w-[76%] rounded-[16px] rounded-br-md bg-[#3157F6] px-4 py-3 text-sm leading-relaxed text-white">
      <div className="whitespace-pre-wrap break-words">{message.content}</div>
      <time className="mt-1 block text-right text-[9px] text-white/65" dateTime={message.createdAt}>
        {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  </article>
);

export const AIMessage: React.FC<{
  message: ChatEntry;
  onCopy: (text: string) => void;
  onSendToWord?: (text: string) => void;
  onRetry?: () => void;
}> = ({ message, onCopy, onSendToWord, onRetry }) => (
  <article className="group px-3 sm:px-5 py-2">
    <div className="max-w-[980px] border-l-2 border-[#6750D8]/30 pl-3 sm:pl-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#F2EFFF] dark:bg-[#211B43] text-[#6750D8] dark:text-[#B8AEFF]">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-extrabold">Nexus AI</span>
        {message.webSearch ? (
          <span className="inline-flex items-center gap-1 rounded-[8px] border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300">
            <WorldSearch className="h-3 w-3" /> Web
          </span>
        ) : null}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-[14px]">
        {message.content ? <CleanMarkdown content={message.content} /> : null}
        {message.streaming ? <StreamingCursor /> : null}
      </div>
      {!message.streaming && message.content ? (
        <div className="mt-3 flex flex-wrap gap-1.5 opacity-80 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => onCopy(message.content)} className="min-h-8 px-2.5 rounded-[8px] border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="min-h-8 px-2.5 rounded-[8px] border border-slate-200 dark:border-slate-700 text-[10px] font-bold inline-flex items-center gap-1.5">
              <Refresh className="h-3.5 w-3.5" /> Refazer
            </button>
          ) : null}
          {onSendToWord ? (
            <button type="button" onClick={() => onSendToWord(message.content)} className="min-h-8 px-2.5 rounded-[8px] bg-[#EEF3FF] dark:bg-[#111D4A] text-[#3157F6] dark:text-[#7AA2FF] text-[10px] font-bold inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Abrir no Orbit Nova
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
  onRetry?: () => void;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
}> = ({ messages, onCopy, onSendToWord, onRetry, virtuosoRef }) => (
  <Virtuoso
    ref={virtuosoRef}
    className="flex-1 min-h-0"
    data={messages}
    followOutput="smooth"
    initialTopMostItemIndex={Math.max(0, messages.length - 1)}
    increaseViewportBy={{ top: 320, bottom: 480 }}
    itemContent={(_index, message) => message.role === 'user'
      ? <UserMessage message={message} />
      : <AIMessage message={message} onCopy={onCopy} onSendToWord={onSendToWord} onRetry={onRetry} />}
  />
);

export const SuggestionChips: React.FC<{ onSelect: (prompt: string) => void }> = ({ onSelect }) => (
  <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2">
    {suggestionPrompts.map((item) => (
      <button
        key={item.label}
        type="button"
        onClick={() => onSelect(item.prompt)}
        className="min-h-10 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111318] px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#7AA2FF] hover:text-[#3157F6]"
      >
        {item.label}
      </button>
    ))}
  </div>
);

export const AIChatHeader: React.FC<{
  webSearch: boolean;
  busy: boolean;
  onWebSearchChange: (value: boolean) => void;
  onClear: () => void;
}> = ({ webSearch, busy, onWebSearchChange, onClear }) => (
  <div className="shrink-0 bg-white dark:bg-[#111318] border-b border-slate-200 dark:border-slate-800">
    <div className="orbit-context-strip px-2.5 sm:px-4 py-2" aria-label="Ações do Nexus AI">
      <button type="button" onClick={onClear} disabled={busy} className="orbit-toolbar-control h-10 px-3 inline-flex items-center gap-1.5 text-[11px] font-bold disabled:opacity-50">
        <Plus className="w-4 h-4" /> Novo
      </button>
      <button type="button" onClick={() => clickNavigation('Histórico')} className="orbit-toolbar-control h-10 px-3 inline-flex items-center gap-1.5 text-[11px] font-bold">
        <History className="w-4 h-4" /> Histórico
      </button>
      <button type="button" onClick={() => clickNavigation('Meus arquivos')} className="orbit-toolbar-control h-10 px-3 inline-flex items-center gap-1.5 text-[11px] font-bold">
        <Folder className="w-4 h-4" /> Arquivos
      </button>
      <label className={`orbit-toolbar-control h-10 px-3 inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer ${webSearch ? 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' : ''}`}>
        <input className="sr-only" type="checkbox" checked={webSearch} onChange={(event) => onWebSearchChange(event.target.checked)} disabled={busy} />
        <WorldSearch className="w-4 h-4" /> Web
      </label>
      <span className="ml-auto hidden md:inline text-[10px] font-semibold text-slate-400">Free-only · roteamento automático interno</span>
    </div>
    <div className="px-2.5 sm:px-4 pb-2">
      <div className="orbit-feature-bar">
        <span className="h-8 w-8 shrink-0 rounded-[10px] bg-[#F2EFFF] dark:bg-[#211B43] text-[#6750D8] dark:text-[#B8AEFF] inline-flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="orbit-feature-bar__copy">
          <div className="orbit-feature-bar__title">Nexus AI</div>
          <div className="orbit-feature-bar__description">Pesquisa · análise · documentos · código · arquivos</div>
        </div>
        <button type="button" onClick={() => clickNavigation('Meus arquivos')} className="hidden sm:inline-flex h-8 px-2.5 rounded-[8px] text-[10px] font-bold text-[#3157F6] hover:bg-[#EEF3FF] dark:hover:bg-[#111D4A]">Contexto</button>
      </div>
    </div>
  </div>
);

export const AIComposer: React.FC<{
  value: string;
  busy: boolean;
  webSearch: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onAttach: (file: File) => void;
  onWebSearchChange: (value: boolean) => void;
}> = ({ value, busy, webSearch, onChange, onSubmit, onStop, onAttach, onWebSearchChange }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(160, Math.max(44, node.scrollHeight))}px`;
  }, [value]);

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111318] px-2.5 sm:px-4 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-4xl rounded-[14px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0D11] p-1.5 focus-within:border-[#7AA2FF] focus-within:ring-2 focus-within:ring-[#7AA2FF]/15">
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
          className="block w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1.5 px-1 pb-1">
          <input ref={fileRef} type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAttach(file); event.currentTarget.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="h-9 w-9 rounded-[10px] text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Adicionar arquivo ao contexto">
            <Paperclip className="h-4 w-4" />
          </button>
          <label className={`h-9 px-2.5 rounded-[10px] inline-flex items-center gap-1.5 text-[10px] font-bold cursor-pointer ${webSearch ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300' : 'text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}>
            <input className="sr-only" type="checkbox" checked={webSearch} onChange={(event) => onWebSearchChange(event.target.checked)} disabled={busy} />
            <WorldSearch className="h-4 w-4" /> Web
          </label>
          <span className="ml-auto hidden sm:inline text-[9px] text-slate-400">Enter envia · Shift+Enter quebra linha</span>
          {busy ? (
            <button type="button" onClick={onStop} className="h-9 px-3 rounded-[10px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold inline-flex items-center gap-1.5">
              <Stop className="h-4 w-4" /> Parar
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={!value.trim()} className="h-9 px-3 rounded-[10px] bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-bold inline-flex items-center gap-1.5 disabled:opacity-35">
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
      <div className="m-3 orbit-workspace-surface p-5 text-center border-rose-200 dark:border-rose-900">
        <h2 className="text-sm font-extrabold text-rose-800 dark:text-rose-200">Nexus AI encontrou um erro de interface</h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">O restante do Orbit continua disponível.</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-4 h-9 px-3 rounded-[10px] bg-rose-700 text-white text-[10px] font-bold">Tentar novamente</button>
      </div>
    );
  }
}

export const AIChatPanel: React.FC<AiWorkspaceProps> = ({ onSendToWord, showNotification = () => {} }) => {
  const [messages, setMessages] = useState<ChatEntry[]>(loadMessages);
  const [input, setInput] = useState(() => localStorage.getItem(DRAFT_STORAGE_KEY) || '');
  const [busy, setBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const serializable = messages.map(({ streaming: _streaming, ...message }) => message);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serializable.slice(-80)));
  }, [messages]);

  useEffect(() => {
    if (input.trim()) localStorage.setItem(DRAFT_STORAGE_KEY, input);
    else localStorage.removeItem(DRAFT_STORAGE_KEY);
  }, [input]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const hasMessages = messages.length > 0;
  const lastUser = useMemo(() => [...messages].reverse().find((message) => message.role === 'user'), [messages]);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    showNotification('Resposta copiada.', 'success');
  };

  const stop = () => controllerRef.current?.abort();
  const clear = () => {
    controllerRef.current?.abort();
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setInput('');
  };

  const attach = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      showNotification('Para contexto direto no chat, use arquivos de texto de até 2 MB. Arquivos maiores podem ser abertos pelo Orbit Satellite.', 'error');
      return;
    }
    const textual = /^(text\/|application\/(json|xml|yaml|x-yaml))/.test(file.type) || /\.(md|txt|csv|json|xml|ya?ml|ts|tsx|js|jsx|css|html)$/i.test(file.name);
    if (!textual) {
      showNotification('Este tipo deve ser aberto pelo Orbit Satellite/Nebula antes de entrar no contexto do Nexus AI.', 'error');
      return;
    }
    try {
      const text = await file.text();
      setInput((current) => `${current}${current.trim() ? '\n\n' : ''}[Arquivo: ${file.name}]\n${text.slice(0, 12000)}`);
      showNotification(`${file.name} adicionado ao contexto local da mensagem.`, 'success');
    } catch {
      showNotification('Não foi possível ler este arquivo localmente.', 'error');
    }
  };

  const submit = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    if (!navigator.onLine) {
      setInput(text);
      localStorage.setItem(DRAFT_STORAGE_KEY, text);
      showNotification('Orbit está offline. O rascunho foi preservado e nenhuma chamada remota foi simulada.', 'error');
      return;
    }

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
    <section className="orbidoc-ai-studio orbit-workspace-surface h-[calc(100dvh-7.5rem)] min-h-[520px] overflow-hidden flex flex-col" aria-label="Nexus AI">
      <AIChatHeader webSearch={webSearch} busy={busy} onWebSearchChange={setWebSearch} onClear={clear} />

      {!hasMessages ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:py-8 flex items-center justify-center">
          <div className="w-full max-w-2xl text-center">
            <div className="mx-auto h-10 w-10 rounded-[12px] bg-[#F2EFFF] dark:bg-[#211B43] text-[#6750D8] dark:text-[#B8AEFF] flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">Como posso ajudar?</h1>
            <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Um único assistente para pesquisar, analisar, criar e trabalhar com o contexto autorizado do Orbit.
            </p>
            <div className="mt-4"><SuggestionChips onSelect={(prompt) => void submit(prompt)} /></div>
          </div>
        </div>
      ) : (
        <MessageList messages={messages} onCopy={copy} onSendToWord={onSendToWord} onRetry={lastUser ? () => void submit(lastUser.content) : undefined} virtuosoRef={virtuosoRef} />
      )}

      {hasMessages ? (
        <button type="button" onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' })} className="absolute right-5 bottom-24 z-10 h-9 w-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md hidden sm:flex items-center justify-center" aria-label="Ir para a resposta mais recente">
          <ArrowDown className="h-4 w-4" />
        </button>
      ) : null}

      <AIComposer value={input} busy={busy} webSearch={webSearch} onChange={setInput} onSubmit={() => void submit()} onStop={stop} onAttach={(file) => void attach(file)} onWebSearchChange={setWebSearch} />
    </section>
  );
};

export const ToolCallCard: React.FC<{ title: string; state: 'running' | 'done' | 'error'; detail?: string }> = ({ title, state, detail }) => (
  <div className="rounded-[12px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs">
    <div className="flex items-center gap-2 font-bold">
      {state === 'running' ? <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> : state === 'done' ? <Sparkles className="h-4 w-4 text-emerald-500" /> : <Refresh className="h-4 w-4 text-rose-500" />}
      {title}
    </div>
    {detail ? <p className="mt-1 text-[10px] text-slate-500">{detail}</p> : null}
  </div>
);

export const AiWorkspace: React.FC<AiWorkspaceProps> = (props) => (
  <ErrorBoundaryAI><AIChatPanel {...props} /></ErrorBoundaryAI>
);
