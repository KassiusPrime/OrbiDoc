import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlertTriangle as AlertTriangle,
  IconBrain as Brain,
  IconCheck as Check,
  IconCopy as Copy,
  IconFileText as FileText,
  IconHistory as History,
  IconMessage as MessageSquare,
  IconPaperclip as Paperclip,
  IconPlayerStop as Stop,
  IconRefresh as Refresh,
  IconRobot as Robot,
  IconSend as Send,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react';
import { CleanMarkdown } from './CleanMarkdown';
import { processFileOcr } from '../lib/ocrEngine';
import { AI_RUNTIME_EVENT, AiRuntimeMeta, sendToVercel, sendToVercelStream } from '../api/chat';

export type AiModelOption = {
  id: string;
  provider: string;
  label: string;
  enabled: boolean;
  recommended?: boolean;
  preview?: boolean;
};

type ChatAttachment = {
  name: string;
  type: string;
  content: string;
  preview?: string;
};

type WorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  runtime?: AiRuntimeMeta;
};

type StoredSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: WorkspaceMessage[];
};

type AiTab = 'chat' | 'text' | 'arena';
type TextAction = 'summarize' | 'rewrite' | 'grammar' | 'translate';

export interface AiWorkspaceProps {
  selectedModelKey?: string;
  onSelectedModelChange?: (modelKey: string) => void;
  onSendToWord?: (text: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

const SESSION_KEY = 'orbidoc_ai_sessions_v2';
const MODEL_KEY = 'orbidoc_ai_model_v2';

const FALLBACK_CATALOG: AiModelOption[] = [];

const modelKey = (model: Pick<AiModelOption, 'provider' | 'id'>) => `${model.provider}:${model.id}`;

const loadSessions = (): StoredSession[] => {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const sessionTitle = (text: string, attachments: ChatAttachment[]) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean) return clean.slice(0, 56) + (clean.length > 56 ? '…' : '');
  if (attachments.length) return `Análise: ${attachments[0].name}`;
  return 'Nova conversa';
};

const readPreview = (file: File) => new Promise<string>((resolve) => {
  if (!file.type.startsWith('image/')) {
    resolve('');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => resolve('');
  reader.readAsDataURL(file);
});

export const AiWorkspace: React.FC<AiWorkspaceProps> = ({
  selectedModelKey,
  onSelectedModelChange,
  onSendToWord,
  showNotification = () => {},
}) => {
  const [tab, setTab] = useState<AiTab>('chat');
  const [catalog, setCatalog] = useState<AiModelOption[]>(FALLBACK_CATALOG);
  const [localModelKey, setLocalModelKey] = useState(() => selectedModelKey || localStorage.getItem(MODEL_KEY) || '');
  const [sessions, setSessions] = useState<StoredSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => loadSessions()[0]?.id || null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [runtime, setRuntime] = useState<AiRuntimeMeta | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textResult, setTextResult] = useState('');
  const [textAction, setTextAction] = useState<TextAction>('summarize');
  const [targetLanguage, setTargetLanguage] = useState('Português (Brasil)');
  const [textBusy, setTextBusy] = useState(false);
  const [arenaPrompt, setArenaPrompt] = useState('');
  const [arenaModels, setArenaModels] = useState<string[]>([]);
  const [arenaResults, setArenaResults] = useState<Array<{ key: string; label: string; text: string; error?: string }>>([]);
  const [arenaBusy, setArenaBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/models')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('catalog unavailable')))
      .then((data) => {
        if (cancelled || !Array.isArray(data.models)) return;
        const enabled = (data.models as AiModelOption[]).filter((model) => model.enabled);
        if (!enabled.length) {
          setCatalog([]);
          setArenaModels([]);
          setLocalModelKey('');
          localStorage.removeItem(MODEL_KEY);
          return;
        }
        setCatalog(enabled);
        setArenaModels(enabled.slice(0, 3).map(modelKey));
        const desired = selectedModelKey || localStorage.getItem(MODEL_KEY);
        const validDesired = enabled.find((model) => modelKey(model) === desired);
        const next = modelKey(validDesired || enabled.find((model) => model.recommended) || enabled[0]);
        setLocalModelKey(next);
        localStorage.setItem(MODEL_KEY, next);
        onSelectedModelChange?.(next);
      })
      .catch(() => {
        setCatalog([]);
        setArenaModels([]);
        setLocalModelKey('');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const listener = (event: Event) => setRuntime((event as CustomEvent<AiRuntimeMeta>).detail || null);
    window.addEventListener(AI_RUNTIME_EVENT, listener);
    return () => window.removeEventListener(AI_RUNTIME_EVENT, listener);
  }, []);

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(0, 50)));
  }, [sessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [sessions, activeSessionId, streaming]);

  const activeSession = sessions.find((session) => session.id === activeSessionId) || null;
  const selectedModel = useMemo(() => catalog.find((model) => modelKey(model) === localModelKey) || catalog[0], [catalog, localModelKey]);

  const selectModel = (key: string) => {
    setLocalModelKey(key);
    localStorage.setItem(MODEL_KEY, key);
    onSelectedModelChange?.(key);
  };

  const newSession = () => {
    setActiveSessionId(null);
    setInput('');
    setAttachments([]);
    setShowHistory(false);
  };

  const updateSessionMessages = (sessionId: string, updater: (messages: WorkspaceMessage[]) => WorkspaceMessage[]) => {
    setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, messages: updater(session.messages), updatedAt: new Date().toISOString() } : session));
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setLoadingFiles(true);
    try {
      const next: ChatAttachment[] = [];
      for (const file of files.slice(0, 8)) {
        if (file.size > 25 * 1024 * 1024) {
          showNotification(`${file.name} excede 25 MB para anexos do chat.`, 'error');
          continue;
        }
        try {
          const [content, preview] = await Promise.all([
            processFileOcr(file, { language: 'por+eng', enhanceContrast: true }),
            readPreview(file),
          ]);
          next.push({ name: file.name, type: file.type || 'application/octet-stream', content, preview });
        } catch (error: any) {
          showNotification(`Não foi possível ler ${file.name}: ${error?.message || 'formato incompatível'}`, 'error');
        }
      }
      setAttachments((current) => [...current, ...next].slice(0, 8));
    } finally {
      setLoadingFiles(false);
    }
  };

  const sendMessage = async (override?: { text: string; attachments?: ChatAttachment[] }) => {
    const messageText = override?.text ?? input;
    const messageAttachments = override?.attachments ?? attachments;
    if ((!messageText.trim() && !messageAttachments.length) || !selectedModel || streaming) return;

    const now = new Date().toISOString();
    const userMessage: WorkspaceMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: now,
      attachments: messageAttachments.length ? messageAttachments : undefined,
    };
    const assistantId = crypto.randomUUID();
    const assistant: WorkspaceMessage = { id: assistantId, role: 'assistant', content: '', timestamp: now };

    let sessionId = activeSessionId;
    let contextMessages = activeSession?.messages || [];
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      const session: StoredSession = {
        id: sessionId,
        title: sessionTitle(messageText, messageAttachments),
        createdAt: now,
        updatedAt: now,
        messages: [userMessage, assistant],
      };
      setSessions((current) => [session, ...current]);
      setActiveSessionId(sessionId);
      contextMessages = [];
    } else {
      updateSessionMessages(sessionId, (messages) => [...messages, userMessage, assistant]);
    }

    setInput('');
    setAttachments([]);
    setStreaming(true);
    setRuntime(null);
    const controller = new AbortController();
    abortRef.current = controller;

    let prompt = messageText.trim() || 'Analise os arquivos anexados.';
    for (const file of messageAttachments) {
      prompt += `\n\n[Arquivo: ${file.name}]\n${file.content.slice(0, 70_000)}\n[Fim do arquivo]`;
    }

    const aiMessages = [
      {
        role: 'system' as const,
        content: 'Você é o assistente principal do OrbiDoc. Trabalhe como um copiloto de produtividade e documentos: responda em português claro, use Markdown quando ajudar, não invente conteúdo dos anexos e diga quando algo não puder ser verificado. Para tarefas de escrita, preserve estrutura e intenção do usuário.',
      },
      ...contextMessages.slice(-16).map((message) => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content: prompt },
    ];

    let answer = '';
    let requestRuntime: AiRuntimeMeta | undefined;
    const runtimeListener = (event: Event) => {
      requestRuntime = (event as CustomEvent<AiRuntimeMeta>).detail;
      if (requestRuntime && sessionId) {
        updateSessionMessages(sessionId, (messages) => messages.map((message) => message.id === assistantId ? { ...message, runtime: requestRuntime } : message));
      }
    };
    window.addEventListener(AI_RUNTIME_EVENT, runtimeListener);

    try {
      await sendToVercelStream(
        selectedModel.provider,
        selectedModel.id,
        aiMessages,
        (chunk) => {
          answer += chunk;
          if (sessionId) updateSessionMessages(sessionId, (messages) => messages.map((message) => message.id === assistantId ? { ...message, content: answer, runtime: requestRuntime } : message));
        },
        { signal: controller.signal, files: messageAttachments },
      );

      if (!answer.trim()) throw new Error('A IA não retornou conteúdo.');
    } catch (error: any) {
      if (controller.signal.aborted) {
        if (sessionId) updateSessionMessages(sessionId, (messages) => messages.map((message) => message.id === assistantId && !message.content ? { ...message, content: '_Geração interrompida._' } : message));
      } else {
        if (sessionId) updateSessionMessages(sessionId, (messages) => messages.map((message) => message.id === assistantId ? { ...message, content: `**Falha na IA:** ${error?.message || 'erro desconhecido'}`, runtime: requestRuntime } : message));
        showNotification(error?.message || 'Falha na resposta da IA.', 'error');
      }
    } finally {
      window.removeEventListener(AI_RUNTIME_EVENT, runtimeListener);
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  const regenerate = () => {
    if (!activeSession || streaming) return;
    const lastUser = [...activeSession.messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) return;
    sendMessage({ text: lastUser.content, attachments: lastUser.attachments });
  };

  const deleteSession = (id: string) => {
    setSessions((current) => current.filter((session) => session.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const runTextTool = async () => {
    if (!textInput.trim() || !selectedModel) return;
    setTextBusy(true);
    setTextResult('');
    const instructions: Record<TextAction, string> = {
      summarize: 'Resuma o texto com fidelidade, mantendo fatos, nomes e decisões importantes. Organize em tópicos quando útil.',
      rewrite: 'Reescreva o texto com maior clareza, fluidez e profissionalismo, preservando o significado.',
      grammar: 'Corrija ortografia, gramática e pontuação. Retorne o texto corrigido e, ao final, uma lista curta das alterações importantes.',
      translate: `Traduza o texto para ${targetLanguage}, preservando títulos, listas, nomes próprios e formatação.`,
    };
    try {
      const answer = await sendToVercel(selectedModel.provider, selectedModel.id, [
        { role: 'system', content: instructions[textAction] },
        { role: 'user', content: textInput },
      ]);
      setTextResult(answer);
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao processar o texto.', 'error');
    } finally {
      setTextBusy(false);
    }
  };

  const runArena = async () => {
    if (!arenaPrompt.trim() || arenaModels.length < 2) return;
    setArenaBusy(true);
    const selected = arenaModels
      .map((key) => catalog.find((model) => modelKey(model) === key))
      .filter(Boolean) as AiModelOption[];
    const initial = selected.map((model) => ({ key: modelKey(model), label: model.label, text: 'Processando…' }));
    setArenaResults(initial);

    const results = await Promise.all(selected.map(async (model) => {
      try {
        const text = await sendToVercel(model.provider, model.id, [
          { role: 'system', content: 'Responda de forma precisa e comparável. Não mencione que está em uma arena de modelos.' },
          { role: 'user', content: arenaPrompt },
        ]);
        return { key: modelKey(model), label: model.label, text };
      } catch (error: any) {
        return { key: modelKey(model), label: model.label, text: '', error: error?.message || 'Modelo indisponível' };
      }
    }));
    setArenaResults(results);
    setArenaBusy(false);
  };

  const emptyChat = !activeSession?.messages.length;

  return (
    <div className="h-[calc(100dvh-7.5rem)] min-h-[560px] rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-3 sm:px-4 gap-2 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center"><Robot className="w-5 h-5" /></div>
        <div className="min-w-0 hidden sm:block">
          <div className="text-sm font-black text-slate-900 dark:text-white">Assistente OrbiDoc</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{selectedModel?.label || 'Nenhum modelo disponível'}</div>
        </div>

        <div className="ml-2 flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-1">
          {([
            ['chat', 'Chat', MessageSquare],
            ['text', 'Texto', Sparkles],
            ['arena', 'Arena', Brain],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 ${tab === id ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span></button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select value={localModelKey} onChange={(event) => selectModel(event.target.value)} className="h-9 max-w-[180px] sm:max-w-[240px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
            {catalog.map((model) => <option key={modelKey(model)} value={modelKey(model)}>{model.label}{model.preview ? ' (preview)' : ''}</option>)}
          </select>
          {tab === 'chat' && <button onClick={() => setShowHistory((value) => !value)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600" title="Histórico"><History className="w-4 h-4" /></button>}
        </div>
      </div>

      {runtime?.fallbackUsed && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Fallback ativo: {runtime.requestedProvider}/{runtime.requestedModel || 'auto'} → <strong>{runtime.provider}/{runtime.routedModel || runtime.model}</strong>. {runtime.fallbackReason}</span></div>
      )}

      {!catalog.length && (
        <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span><strong>Nenhum provedor de IA está ativo.</strong> Configure pelo menos uma credencial segura no servidor (Gemini, Groq ou OpenRouter). O OrbiDoc não simula um modelo disponível quando o backend não possui uma chave válida.</span>
        </div>
      )}

      {tab === 'chat' && (
        <div className="flex flex-1 min-h-0 relative">
          {showHistory && (
            <aside className="absolute md:relative inset-y-0 left-0 z-20 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl md:shadow-none">
              <div className="p-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800"><button onClick={newSession} className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-xs font-black">+ Nova conversa</button><button onClick={() => setShowHistory(false)} className="md:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"><X className="w-4 h-4" /></button></div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map((session) => (
                  <div key={session.id} className={`group rounded-xl p-2.5 flex items-start gap-2 ${activeSessionId === session.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                    <button onClick={() => { setActiveSessionId(session.id); setShowHistory(false); }} className="min-w-0 flex-1 text-left"><div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{session.title}</div><div className="text-[9px] text-slate-400 mt-1">{new Date(session.updatedAt).toLocaleString('pt-BR')}</div></button>
                    <button onClick={() => deleteSession(session.id)} className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <div className="flex-1 min-w-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-5">
              <div className="max-w-4xl mx-auto space-y-5">
                {emptyChat ? (
                  <div className="py-16 sm:py-24 text-center max-w-xl mx-auto">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center"><Sparkles className="w-7 h-7" /></div>
                    <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Como posso ajudar?</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Escreva, revise, compare ideias ou anexe PDF, DOCX, planilhas e imagens para análise.</p>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                      {['Resuma este documento e destaque decisões', 'Crie um relatório profissional a partir destes dados', 'Revise meu texto mantendo meu estilo', 'Analise esta planilha e explique os principais pontos'].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">{prompt}</button>)}
                    </div>
                  </div>
                ) : activeSession?.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${message.role === 'user' ? 'max-w-[86%] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl rounded-br-md px-4 py-3' : 'w-full max-w-[92%]'} text-sm leading-relaxed`}>
                      {message.attachments?.length ? <div className="mb-2 flex flex-wrap gap-1.5">{message.attachments.map((file) => <span key={file.name} className="px-2 py-1 rounded-lg bg-white/10 dark:bg-black/10 text-[10px] font-bold inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{file.name}</span>)}</div> : null}
                      {message.role === 'assistant' ? (
                        <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                          <CleanMarkdown content={message.content || (streaming ? '…' : '')} />
                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                            <span>{message.runtime?.routedModel || message.runtime?.model || selectedModel?.label}</span>
                            {message.runtime?.fallbackUsed && <span className="text-amber-600 font-bold">fallback</span>}
                            {message.content && <button onClick={() => navigator.clipboard.writeText(message.content)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>}
                            {message.content && onSendToWord && <button onClick={() => onSendToWord(message.content)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600" title="Abrir no editor"><FileText className="w-3.5 h-3.5" /></button>}
                          </div>
                        </div>
                      ) : <div className="whitespace-pre-wrap">{message.content}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
              <div className="max-w-4xl mx-auto">
                {attachments.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{attachments.map((file, index) => <span key={`${file.name}-${index}`} className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5"><Paperclip className="w-3 h-3" /><span className="max-w-[160px] truncate">{file.name}</span><button onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}><X className="w-3 h-3" /></button></span>)}</div>}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10">
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} rows={2} placeholder="Mensagem para o OrbiDoc…" className="w-full min-h-[52px] max-h-40 resize-y bg-transparent px-2 py-1 text-sm text-slate-900 dark:text-slate-100 outline-none" />
                  <div className="flex items-center gap-2 mt-1">
                    <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.html,.png,.jpg,.jpeg,.webp,.avif" onChange={(event) => { if (event.target.files) handleFiles(Array.from(event.target.files)); event.target.value = ''; }} />
                    <button disabled={loadingFiles} onClick={() => fileRef.current?.click()} className="h-9 px-2.5 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 text-[11px] font-bold"><Paperclip className="w-4 h-4" />{loadingFiles ? 'Lendo…' : 'Anexar'}</button>
                    {activeSession && <button disabled={streaming} onClick={regenerate} className="h-9 px-2.5 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 text-[11px] font-bold"><Refresh className="w-4 h-4" /> Regerar</button>}
                    <span className="ml-auto text-[9px] text-slate-400 hidden sm:inline">Enter envia · Shift+Enter quebra linha</span>
                    {streaming ? <button onClick={stop} className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center"><Stop className="w-4 h-4" /></button> : <button disabled={(!input.trim() && !attachments.length) || !selectedModel} onClick={() => sendMessage()} className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white flex items-center justify-center"><Send className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'text' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">{(['summarize', 'rewrite', 'grammar', 'translate'] as TextAction[]).map((action) => <button key={action} onClick={() => setTextAction(action)} className={`h-8 px-3 rounded-lg text-[11px] font-bold ${textAction === action ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{({ summarize: 'Resumir', rewrite: 'Reescrever', grammar: 'Revisar', translate: 'Traduzir' } as any)[action]}</button>)}</div>
              {textAction === 'translate' && <input value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs" placeholder="Idioma destino" />}
              <textarea value={textInput} onChange={(event) => setTextInput(event.target.value)} className="w-full min-h-[360px] resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm outline-none focus:border-indigo-500" placeholder="Cole ou escreva seu texto aqui…" />
              <button disabled={textBusy || !textInput.trim()} onClick={runTextTool} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />{textBusy ? 'Processando…' : 'Executar'}</button>
            </section>
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-h-[480px]">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-black text-slate-900 dark:text-white">Resultado</h3>{textResult && <div className="flex gap-1"><button onClick={() => navigator.clipboard.writeText(textResult)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><Copy className="w-4 h-4" /></button>{onSendToWord && <button onClick={() => onSendToWord(textResult)} className="w-8 h-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 flex items-center justify-center"><FileText className="w-4 h-4" /></button>}</div>}</div>
              {textResult ? <CleanMarkdown content={textResult} /> : <div className="h-80 flex items-center justify-center text-xs text-slate-400">O resultado aparecerá aqui.</div>}
            </section>
          </div>
        </div>
      )}

      {tab === 'arena' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="max-w-6xl mx-auto space-y-4">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Comparar modelos disponíveis</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A arena usa apenas modelos que o servidor informou como configurados.</p>
              <div className="mt-3 flex flex-wrap gap-2">{catalog.map((model) => { const key = modelKey(model); const selected = arenaModels.includes(key); return <button key={key} onClick={() => setArenaModels((current) => selected ? current.filter((item) => item !== key) : current.length < 3 ? [...current, key] : current)} className={`h-9 px-3 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 ${selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>{selected && <Check className="w-3.5 h-3.5" />}{model.label}</button>; })}</div>
              <textarea value={arenaPrompt} onChange={(event) => setArenaPrompt(event.target.value)} className="mt-3 w-full min-h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm outline-none focus:border-indigo-500" placeholder="Pergunta para comparar…" />
              <button disabled={arenaBusy || arenaModels.length < 2 || !arenaPrompt.trim()} onClick={runArena} className="mt-3 h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-black inline-flex items-center gap-2"><Brain className="w-4 h-4" />{arenaBusy ? 'Comparando…' : 'Comparar respostas'}</button>
            </section>

            {arenaResults.length > 0 && <div className={`grid grid-cols-1 ${arenaResults.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-3`}>{arenaResults.map((result) => <section key={result.key} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div className="flex items-center justify-between gap-2 mb-3"><h4 className="text-xs font-black text-slate-900 dark:text-white">{result.label}</h4>{!result.error && <button onClick={() => navigator.clipboard.writeText(result.text)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Copy className="w-3.5 h-3.5" /></button>}</div>{result.error ? <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{result.error}</div> : <CleanMarkdown content={result.text} />}</section>)}</div>}
          </div>
        </div>
      )}
    </div>
  );
};
