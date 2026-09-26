import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCopy as Copy,
  IconFileText as FileText,
  IconHistory as History,
  IconPaperclip as Paperclip,
  IconPlayerStop as Stop,
  IconPlus as Plus,
  IconRefresh as Refresh,
  IconSend as Send,
  IconSparkles as Sparkles,
  IconWorldSearch as WorldSearch,
} from '@tabler/icons-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { sendToVercelStream, type AiMessage as ApiMessage } from '../api/chat';
import { CleanMarkdown } from './CleanMarkdown';

export type AiModelOption = { id: string; provider: string; label: string; enabled: boolean; recommended?: boolean; preview?: boolean; webSearch?: boolean };
export interface AiWorkspaceProps { selectedModelKey?: string; onSelectedModelChange?: (modelKey: string) => void; onSendToWord?: (text: string) => void; showNotification?: (message: string, type?: 'success' | 'error') => void; }
type ChatRole = 'user' | 'assistant';
type ChatEntry = { id: string; role: ChatRole; content: string; createdAt: string; streaming?: boolean; webSearch?: boolean };

const CHAT_STORAGE_KEY = 'orbit_nexus_ai_chat_v1';
const DRAFT_STORAGE_KEY = 'orbit_nexus_ai_draft_v1';
const INTERNAL_PROVIDER = 'openrouter';
const INTERNAL_MODEL = 'openrouter/free';
const URL_RE = /https?:\/\/[^\s]+/i;

const suggestionPrompts = [
  { label: 'Resumir', prompt: 'Resuma o documento atual em pontos objetivos e preserve os fatos importantes.' },
  { label: 'Analisar', prompt: 'Analise o arquivo ou contexto atual e destaque riscos, padrões e próximos passos.' },
  { label: 'Pesquisar', prompt: 'Pesquise informações atuais sobre este tema e cite as fontes mais relevantes.' },
  { label: 'Criar', prompt: 'Crie uma primeira versão clara e pronta para edição a partir do meu contexto.' },
] as const;

function loadMessages(): ChatEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChatEntry => Boolean(
      item && typeof item === 'object' &&
      typeof (item as ChatEntry).id === 'string' &&
      ((item as ChatEntry).role === 'user' || (item as ChatEntry).role === 'assistant') &&
      typeof (item as ChatEntry).content === 'string',
    )).slice(-80);
  } catch {
    return [];
  }
}

function toApiMessages(messages: readonly ChatEntry[]): ApiMessage[] {
  return messages.filter((message) => message.content.trim()).map((message) => ({ role: message.role, content: message.content }));
}

function createEntry(role: ChatRole, content: string, extras?: Partial<Pick<ChatEntry, 'streaming' | 'webSearch'>>): ChatEntry {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString(), ...extras };
}

function clickNavigation(label: string): void {
  const candidate = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === label || button.textContent?.trim().includes(label),
  );
  candidate?.click();
}

export const StreamingCursor: React.FC = () => (
  <span aria-hidden="true" className="ml-1 inline-block h-4 w-[2px] rounded-full bg-[#6750D8] animate-pulse align-text-bottom" />
);

export const UserMessage: React.FC<{ message: ChatEntry }> = ({ message }) => (
  <article className="group w-full px-2 py-3 sm:px-0">
    <div className="ml-auto max-w-[90%] sm:max-w-[78%] rounded-2xl rounded-br-md bg-slate-800/80 dark:bg-slate-800/70 px-4 py-2.5 text-sm leading-relaxed text-slate-100">
      <div className="whitespace-pre-wrap break-words">{message.content}</div>
    </div>
  </article>
);

export const AIMessage: React.FC<{ message: ChatEntry; onCopy: (text: string) => void; onSendToWord?: (text: string) => void; onRetry?: () => void }> = ({
  message, onCopy, onSendToWord, onRetry,
}) => (
  <article className="group w-full px-2 py-4 sm:px-0">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[#9A8BFF]">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span>Nexus AI</span>
          {message.webSearch ? <span className="text-[#9A8BFF]">Web</span> : null}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-[14px]">
          {message.content ? <CleanMarkdown content={message.content} /> : null}
          {message.streaming ? <StreamingCursor /> : null}
        </div>
        {!message.streaming && message.content ? (
          <div className="mt-2 flex flex-wrap gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => onCopy(message.content)} className="min-h-7 rounded-lg border border-slate-700/60 px-2 text-[10px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200">
              <Copy className="mr-1 inline h-3 w-3" />Copiar
            </button>
            {onRetry ? <button type="button" onClick={onRetry} className="min-h-7 rounded-lg border border-slate-700/60 px-2 text-[10px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200">
              <Refresh className="mr-1 inline h-3 w-3" />Refazer
            </button> : null}
            {onSendToWord ? <button type="button" onClick={() => onSendToWord(message.content)} className="min-h-7 rounded-lg border border-blue-500/20 px-2 text-[10px] font-medium text-blue-400 hover:bg-blue-500/10">
              <FileText className="mr-1 inline h-3 w-3" />Documento
            </button> : null}
          </div>
        ) : null}
      </div>
    </div>
  </article>
);

export const MessageList: React.FC<{ messages: ChatEntry[]; onCopy: (text: string) => void; onSendToWord?: (text: string) => void; onRetry?: () => void; virtuosoRef: React.RefObject<VirtuosoHandle | null> }> = ({
  messages, onCopy, onSendToWord, onRetry, virtuosoRef,
}) => (
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
  <div className="flex max-w-3xl flex-wrap justify-center gap-2">
    {suggestionPrompts.map((item) => (
      <button
        key={item.label}
        type="button"
        onClick={() => onSelect(item.prompt)}
        className="min-h-9 rounded-full border border-slate-700/70 px-3.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors duration-150 hover:border-slate-500 hover:bg-white/5 hover:text-slate-200"
      >
        {item.label}
      </button>
    ))}
  </div>
);

const AIChatHeader: React.FC<{ busy: boolean; onClear: () => void }> = ({ busy, onClear }) => (
  <header className="flex h-12 shrink-0 items-center border-b border-white/6 px-3 sm:px-5">
    <div className="flex min-w-0 items-center gap-2">
      <Sparkles className="h-4 w-4 text-[#8D7CFF]" />
      <span className="text-sm font-medium tracking-tight">Nexus AI</span>
      <span className="text-[10px] text-slate-500">Gratuito</span>
    </div>
    <div className="ml-auto flex items-center gap-1">
      <button type="button" onClick={onClear} disabled={busy} className="h-8 rounded-lg px-2.5 text-[10px] font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-40">
        <Plus className="mr-1 inline h-3.5 w-3.5" />Novo chat
      </button>
      <button type="button" onClick={() => clickNavigation('Histórico')} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300" aria-label="Abrir histórico">
        <History className="mx-auto h-4 w-4" />
      </button>
    </div>
  </header>
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
  onPasteClipboard: () => void;
  onReadLink: () => void;
}> = ({ value, busy, webSearch, onChange, onSubmit, onStop, onAttach, onWebSearchChange, onPasteClipboard, onReadLink }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(180, Math.max(44, node.scrollHeight))}px`;
  }, [value]);

  const openFiles = () => fileRef.current?.click();
  const runPlusAction = (action: () => void) => {
    setPlusOpen(false);
    action();
  };

  return (
    <div className="shrink-0 px-2.5 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2 sm:px-5">
      <div className="relative mx-auto max-w-3xl">
        {plusOpen ? (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-56 rounded-xl border border-slate-700/70 bg-[#141820] p-1.5 shadow-lg">
            <button type="button" onClick={() => runPlusAction(openFiles)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-slate-300 hover:bg-white/5">
              <Paperclip className="h-3.5 w-3.5 text-slate-500" />Anexar arquivo
            </button>
            <button type="button" onClick={() => runPlusAction(onPasteClipboard)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-slate-300 hover:bg-white/5">
              Colar da área de transferência
            </button>
            <button type="button" onClick={() => runPlusAction(() => clickNavigation('Documento'))} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-slate-300 hover:bg-white/5">
              Documento atual
            </button>
            <button type="button" onClick={() => runPlusAction(() => clickNavigation('Meus arquivos'))} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-slate-300 hover:bg-white/5">
              Meus arquivos
            </button>
          </div>
        ) : null}
        <input ref={fileRef} type="file" className="sr-only" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onAttach(file);
          event.currentTarget.value = '';
        }} />
        <div className="rounded-2xl border border-slate-700/60 bg-[#0f1218] shadow-sm transition-colors duration-150 focus-within:border-slate-600">
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
            placeholder="Pergunte alguma coisa"
            aria-label="Mensagem para Nexus AI"
            className="block max-h-44 w-full resize-none bg-transparent px-4 pt-3.5 text-sm leading-relaxed outline-none placeholder:text-slate-600"
          />
          <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1.5">
            <button type="button" onClick={() => setPlusOpen((open) => !open)} className="h-8 w-8 rounded-lg text-slate-600 hover:bg-white/5 hover:text-slate-300" aria-label="Adicionar contexto" aria-expanded={plusOpen}>
              <Plus className="mx-auto h-4 w-4" />
            </button>
            <button type="button" onClick={openFiles} className="h-8 w-8 rounded-lg text-slate-600 hover:bg-white/5 hover:text-slate-300" aria-label="Anexar arquivo">
              <Paperclip className="mx-auto h-4 w-4" />
            </button>
            <label className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-medium transition-colors ${webSearch ? 'text-[#9A8BFF] bg-violet-500/10' : 'text-slate-600 hover:bg-white/5 hover:text-slate-300'}`}>
              <input className="sr-only" type="checkbox" checked={webSearch} onChange={(event) => onWebSearchChange(event.target.checked)} disabled={busy} />
              <WorldSearch className="h-3.5 w-3.5" />Web
            </label>
            {URL_RE.test(value) ? <button type="button" onClick={onReadLink} disabled={busy} className="hidden sm:inline h-8 rounded-lg px-2 text-[10px] font-medium text-[#9A8BFF] hover:bg-violet-500/10">Ler link</button> : null}
            <div className="ml-auto">
              {busy ? (
                <button type="button" onClick={onStop} className="h-8 w-8 rounded-full bg-slate-700 text-slate-100 hover:bg-slate-600" aria-label="Parar">
                  <Stop className="mx-auto h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="button" onClick={onSubmit} disabled={!value.trim()} className="h-8 w-8 rounded-full bg-[#6750D8] text-white transition-opacity duration-150 disabled:opacity-30 hover:bg-[#7561E4]" aria-label="Enviar">
                  <Send className="mx-auto h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
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
      <div className="m-3 rounded-xl border border-rose-900/40 p-5 text-center">
        <h2 className="text-sm font-medium text-rose-200">Nexus AI encontrou um erro de interface</h2>
        <p className="mt-1 text-xs text-slate-500">O restante do Orbit continua disponível.</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-4 h-9 rounded-lg bg-rose-700 px-3 text-[10px] font-medium text-white">Tentar novamente</button>
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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Resposta copiada.', 'success');
    } catch {
      showNotification('Não foi possível copiar a resposta.', 'error');
    }
  };

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showNotification('A área de transferência está vazia.', 'error');
        return;
      }
      setInput((current) => `${current}${current.trim() ? '\n\n' : ''}${text}`);
    } catch {
      showNotification('O navegador bloqueou a leitura da área de transferência. Use Ctrl/Cmd+V diretamente.', 'error');
    }
  };

  const readLink = () => {
    const match = input.match(URL_RE);
    if (!match) return;
    setWebSearch(true);
    setInput(`Leia o conteúdo deste link e explique os pontos mais importantes, citando a fonte: ${match[0]}`);
  };

  const stop = () => controllerRef.current?.abort();

  useEffect(() => {
    const handler = () => {
      controllerRef.current?.abort();
      setMessages([]);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      setInput('');
    };
    window.addEventListener('orbidoc:nexus-new-chat', handler);
    return () => window.removeEventListener('orbidoc:nexus-new-chat', handler);
  }, []);

  const clear = () => {
    controllerRef.current?.abort();
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setInput('');
  };

  const attach = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      showNotification('Para contexto direto no chat, use arquivos de texto de até 2 MB.', 'error');
      return;
    }
    const textual = /^(text\/|application\/(json|xml|yaml|x-yaml))/.test(file.type) || /\.(md|txt|csv|json|xml|ya?ml|ts|tsx|js|jsx|css|html)$/i.test(file.name);
    if (!textual) {
      showNotification('Este tipo deve ser aberto pelo Orbit antes de entrar no contexto do Nexus AI.', 'error');
      return;
    }
    try {
      const text = await file.text();
      setInput((current) => `${current}${current.trim() ? '\n\n' : ''}[Arquivo: ${file.name}]\n${text.slice(0, 12000)}`);
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
      showNotification('Orbit está offline. O rascunho foi preservado.', 'error');
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
      await sendToVercelStream(INTERNAL_PROVIDER, INTERNAL_MODEL, toApiMessages(context), (chunk) => {
        answer += chunk;
        setMessages((current) => current.map((message) => message.id === assistant.id ? { ...message, content: answer } : message));
      }, { signal: controller.signal, webSearch });
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
    <section className="orbidoc-ai-studio h-full min-h-0 overflow-hidden flex flex-col bg-transparent" aria-label="Nexus AI">
      <AIChatHeader busy={busy} onClear={clear} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {!hasMessages ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
            <div className="w-full max-w-3xl text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-[#8D7CFF] opacity-80">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="mt-3 text-xl font-medium tracking-tight">Como posso ajudar?</h1>
              <p className="mx-auto mt-1.5 max-w-xl text-xs text-slate-500">Escreva, analise arquivos ou peça ações no Orbit.</p>
              <div className="mt-5 flex justify-center">
                <SuggestionChips onSelect={(prompt) => void submit(prompt)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <div className="mx-auto h-full max-w-3xl">
              <MessageList messages={messages} onCopy={copy} onSendToWord={onSendToWord} onRetry={lastUser ? () => void submit(lastUser.content) : undefined} virtuosoRef={virtuosoRef} />
            </div>
          </div>
        )}
        {hasMessages ? (
          <button
            type="button"
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' })}
            className="absolute bottom-24 right-4 hidden h-8 w-8 items-center justify-center rounded-full border border-slate-700/60 bg-[#141820] text-slate-500 shadow-sm hover:text-slate-300 sm:flex"
            aria-label="Ir para a resposta mais recente"
          >↓</button>
        ) : null}
        <AIComposer
          value={input}
          busy={busy}
          webSearch={webSearch}
          onChange={setInput}
          onSubmit={() => void submit()}
          onStop={stop}
          onAttach={(file) => void attach(file)}
          onWebSearchChange={setWebSearch}
          onPasteClipboard={() => void pasteClipboard()}
          onReadLink={readLink}
        />
      </div>
    </section>
  );
};

export const ToolCallCard: React.FC<{ title: string; state: 'running' | 'done' | 'error'; detail?: string }> = ({ title, state, detail }) => (
  <div className="rounded-lg border border-slate-700/60 bg-[#141820] p-3 text-xs">
    <div className="font-medium">{title}</div>
    {detail ? <p className="mt-1 text-[10px] text-slate-500">{detail}</p> : null}
  </div>
);

export const AiWorkspace: React.FC<AiWorkspaceProps> = (props) => <ErrorBoundaryAI><AIChatPanel {...props} /></ErrorBoundaryAI>;
