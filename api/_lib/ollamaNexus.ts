import crypto from 'node:crypto';
import { searchWebZeroCost, webContext, type WebSearchResult } from './zeroCostWebSearch.js';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:3b';
const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 45_000;
const STATUS_TIMEOUT_MS = 5_000;
const MAX_MESSAGES = 60;
const MAX_INPUT_CHARS = 160_000;
const SAFE_CONTEXT_TOKENS = 6_000;

export type NexusBody = {
  messages?: unknown;
  systemPrompt?: unknown;
  files?: unknown;
  webSearch?: unknown;
  webSearchExplicit?: unknown;
  taskHint?: unknown;
  maxOutputTokens?: unknown;
  privacy?: unknown;
  model?: unknown;
};

export type NexusMeta = {
  requestId: string;
  assistant: 'Nexus AI';
  strategy: 'fast' | 'coding' | 'deep' | 'web';
  freeOnly: true;
  fallbackUsed: boolean;
  webSearch: boolean;
  webEngine?: 'searxng-selfhosted';
  model: string;
};

export type NexusResult = NexusMeta & { answer: string };
type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type OllamaTag = { name?: unknown; size?: unknown; details?: { family?: unknown; parameter_size?: unknown; quantization_level?: unknown } };

const SYSTEM = [
  'Você é Nexus AI, a inteligência unificada do Orbit.',
  'Responda em português quando o usuário escrever em português.',
  'Seja direto, preciso e útil. Não invente fatos e preserve o formato pedido.',
  'Você usa exclusivamente inferência local fornecida pelo servidor Ollama. Nunca solicite nem tente usar provedores externos de inferência.',
].join(' ');

function ollamaUrl(): string {
  return String(process.env.OLLAMA_API_URL ?? DEFAULT_OLLAMA_URL).trim().replace(/\/$/, '') || DEFAULT_OLLAMA_URL;
}

function defaultModel(): string {
  return String(process.env.OLLAMA_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function outputLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 2048;
  return Math.max(256, Math.min(8192, Math.floor(value)));
}

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_MESSAGES) throw new Error('Conversa inválida.');
  let total = 0;
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Mensagem inválida.');
    const item = raw as { role?: unknown; content?: unknown };
    if (!['system', 'user', 'assistant'].includes(String(item.role)) || typeof item.content !== 'string') throw new Error('Mensagem inválida.');
    total += item.content.length;
    if (total > MAX_INPUT_CHARS) throw new Error('Contexto muito grande para esta requisição.');
    return { role: item.role as Message['role'], content: item.content };
  });
}

function estimateTokens(messages: readonly Message[]): number {
  return Math.ceil(messages.reduce((sum, item) => sum + item.content.length, 0) / 4);
}

function truncateMessages(items: Message[]): Message[] {
  if (estimateTokens(items) <= SAFE_CONTEXT_TOKENS) return items;
  const system = items.filter((item) => item.role === 'system');
  const conversation = items.filter((item) => item.role !== 'system');
  const kept: Message[] = [];
  let total = estimateTokens(system);
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const candidate = conversation[index]!;
    const next = total + Math.ceil(candidate.content.length / 4);
    if (next > SAFE_CONTEXT_TOKENS) break;
    kept.unshift(candidate);
    total = next;
  }
  console.warn(JSON.stringify({ event: 'nexus.context.truncated', originalMessages: items.length, retainedMessages: system.length + kept.length }));
  return [...system, ...kept];
}

function lastUser(items: readonly Message[]): string {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === 'user') return items[index]?.content ?? '';
  }
  return '';
}

function strategy(items: readonly Message[], web: boolean, hint?: string): NexusMeta['strategy'] {
  if (web) return 'web';
  const text = `${hint ?? ''}\n${lastUser(items)}`;
  if (/\b(código|code|typescript|javascript|python|java|sql|regex|bug|erro|api|função|classe|excel|planilha)\b/i.test(text)) return 'coding';
  if (/\b(análise profunda|analise profundamente|arquitetura|estratégia|planejamento|compare|comparação|raciocínio|prova)\b/i.test(text)) return 'deep';
  return 'fast';
}

function systemPrompt(body: NexusBody): string {
  const custom = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
  return custom ? `${SYSTEM}\n\nContexto adicional:\n${custom}` : SYSTEM;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const unlink = linkAbort(init.signal ?? undefined, controller);
  const timer = setTimeout(() => controller.abort(new Error('OLLAMA_CONNECT_TIMEOUT')), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

function linkAbort(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) return () => {};
  const abort = () => target.abort(source.reason);
  if (source.aborted) target.abort(source.reason);
  else source.addEventListener('abort', abort, { once: true });
  return () => source.removeEventListener('abort', abort);
}

function idleRead<T>(reader: ReadableStreamDefaultReader<T>, timeoutMs: number, signal?: AbortSignal): Promise<ReadableStreamReadResult<T>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('OLLAMA_IDLE_TIMEOUT'));
    }, timeoutMs);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error('OLLAMA_ABORTED'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
    reader.read().then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function streamAttempt(
  body: NexusBody,
  items: Message[],
  model: string,
  web: WebSearchResult | undefined,
  onChunk: (chunk: string) => void,
  onMeta: (meta: unknown) => void,
  externalSignal?: AbortSignal,
): Promise<{ receivedByte: boolean }> {
  const controller = new AbortController();
  const unlink = linkAbort(externalSignal, controller);
  const payloadMessages = [...items];
  if (web) payloadMessages.push({ role: 'system', content: webContext(web) });

  const payload = {
    model,
    messages: [{ role: 'system', content: systemPrompt(body) }, ...payloadMessages],
    stream: true,
    options: { num_predict: outputLimit(body.maxOutputTokens), temperature: 0.2 },
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${ollamaUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }, CONNECT_TIMEOUT_MS);
  } catch (error) {
    unlink();
    throw error;
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    unlink();
    throw new Error(`Ollama respondeu HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedByte = false;
  const readWithIdle = async () => {
    const idleController = new AbortController();
    const bridge = linkAbort(controller.signal, idleController);
    try {
      return await idleRead(reader, IDLE_TIMEOUT_MS, idleController.signal);
    } catch (error) {
      // A timeout must tear down the upstream Ollama request, not merely stop
      // awaiting reader.read(). Otherwise the model may keep consuming RAM/VRAM.
      if (error instanceof Error && error.message === 'OLLAMA_IDLE_TIMEOUT') {
        controller.abort(error);
        await reader.cancel(error).catch(() => {});
      }
      throw error;
    } finally {
      bridge();
    }
  };

  try {
    while (true) {
      let next: ReadableStreamReadResult<Uint8Array>;
      try {
        next = await readWithIdle();
      } catch (error) {
        if (!receivedByte && error instanceof Error && error.message === 'OLLAMA_IDLE_TIMEOUT') throw error;
        throw error;
      }
      if (next.done) break;
      if (next.value?.byteLength) receivedByte = true;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: { message?: { content?: unknown }; done?: boolean; eval_count?: unknown; eval_duration?: unknown };
        try {
          event = JSON.parse(line) as typeof event;
        } catch {
          continue;
        }
        const content = typeof event.message?.content === 'string' ? event.message.content : '';
        if (content) onChunk(content);
        if (event.done) onMeta({ model, evalCount: event.eval_count, evalDuration: event.eval_duration });
      }
    }

    const tail = buffer.trim();
    if (tail) {
      try {
        const event = JSON.parse(tail) as { message?: { content?: unknown }; done?: boolean; eval_count?: unknown; eval_duration?: unknown };
        if (typeof event.message?.content === 'string' && event.message.content) onChunk(event.message.content);
        if (event.done) onMeta({ model, evalCount: event.eval_count, evalDuration: event.eval_duration });
      } catch {
        // Ollama may end on an incomplete transport fragment; already-emitted chunks remain valid.
      }
    }
    return { receivedByte };
  } catch (error) {
    const enriched = error instanceof Error ? error : new Error(String(error));
    (enriched as Error & { receivedByte?: boolean }).receivedByte = receivedByte;
    throw enriched;
  } finally {
    try { reader.releaseLock(); } catch {}
    if (controller.signal.aborted) {
      try { await reader.cancel(controller.signal.reason); } catch {}
    }
    controller.abort();
    unlink();
  }
}

async function webContextIfNeeded(body: NexusBody, items: readonly Message[]): Promise<{ context?: WebSearchResult; used: boolean }> {
  const explicit = body.webSearch === true;
  const text = lastUser(items);
  const automatic = /\b(hoje|agora|atual|recente|notícia|noticias|latest|2026|2027)\b/i.test(text);
  if (!explicit && !automatic) return { used: false };
  try {
    const result = await searchWebZeroCost(text);
    return result.sources.length ? { context: result, used: true } : { used: false };
  } catch {
    return { used: false };
  }
}

export async function stream(
  body: NexusBody,
  onChunk: (chunk: string) => void,
  onMeta: (meta: NexusMeta) => void,
  signal?: AbortSignal,
): Promise<void> {
  const requestId = crypto.randomUUID();
  const rawItems = normalizeMessages(body.messages);
  const web = await webContextIfNeeded(body, rawItems);
  const items = truncateMessages(rawItems);
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : defaultModel();
  const kind = strategy(items, web.used, typeof body.taskHint === 'string' ? body.taskHint : undefined);

  let receivedByte = false;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < 2) {
    try {
      const result = await streamAttempt(body, items, model, web.context, onChunk, (meta) => onMeta({
        requestId,
        assistant: 'Nexus AI',
        strategy: kind,
        freeOnly: true,
        fallbackUsed: false,
        webSearch: web.used,
        webEngine: web.used ? 'searxng-selfhosted' : undefined,
        model,
        ...meta as object,
      }), signal);
      receivedByte = result.receivedByte;
      if (receivedByte || attempt > 0) return;
      return;
    } catch (error) {
      lastError = error;
      const attemptReceivedByte = Boolean((error as { receivedByte?: boolean })?.receivedByte);
      if (attemptReceivedByte) receivedByte = true;
      if (signal?.aborted) throw error;
      if (receivedByte || attempt > 0) break;
      attempt += 1;
      if (attempt >= 2) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('IA local indisponível no momento. Tente novamente.');
}

export async function complete(body: NexusBody): Promise<NexusResult> {
  let answer = '';
  let meta: NexusMeta | undefined;
  await stream(body, (chunk) => { answer += chunk; }, (value) => {
    meta = value;
  });
  if (!answer.trim()) throw new Error('O modelo local retornou uma resposta vazia.');
  return {
    requestId: meta?.requestId ?? crypto.randomUUID(),
    assistant: 'Nexus AI',
    strategy: meta?.strategy ?? 'fast',
    freeOnly: true,
    fallbackUsed: false,
    webSearch: meta?.webSearch ?? false,
    webEngine: meta?.webEngine,
    model: meta?.model ?? (typeof body.model === 'string' ? body.model : defaultModel()),
    answer: answer.trim(),
  };
}

async function check(url: string, init?: RequestInit): Promise<Response | null> {
  try { return await fetchWithTimeout(url, init ?? {}, STATUS_TIMEOUT_MS); } catch { return null; }
}

export async function listModels(): Promise<{ name: string; size: number; family?: string; parameterSize?: string; quantizationLevel?: string }[]> {
  const response = await check(`${ollamaUrl()}/api/tags`);
  if (!response?.ok) return [{ name: defaultModel(), size: 0 }];
  const root = await response.json().catch(() => ({})) as { models?: OllamaTag[] };
  const models = Array.isArray(root.models) ? root.models : [];
  const mapped = models
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '',
      size: typeof item.size === 'number' ? item.size : Number(item.size) || 0,
      family: typeof item.details?.family === 'string' ? item.details.family : undefined,
      parameterSize: typeof item.details?.parameter_size === 'string' ? item.details.parameter_size : undefined,
      quantizationLevel: typeof item.details?.quantization_level === 'string' ? item.details.quantization_level : undefined,
    }))
    .filter((item) => item.name);
  return mapped.length ? mapped : [{ name: defaultModel(), size: 0 }];
}

export async function status() {
  const tagsResponse = await check(`${ollamaUrl()}/api/tags`);
  const models = tagsResponse?.ok ? ((await tagsResponse.json().catch(() => ({}))) as { models?: OllamaTag[] }).models ?? [] : [];
  const model = defaultModel();
  const modelPresent = models.some((item) => item.name === model);
  const searchUrl = String(process.env.SEARXNG_URL ?? '').trim().replace(/\/$/, '');
  let search = false;
  if (searchUrl) {
    const response = await check(`${searchUrl}/search?q=orbit&format=json&language=pt-BR`);
    search = Boolean(response?.ok);
  }
  return {
    assistant: 'Nexus AI' as const,
    gateway: 'Ollama (self-hosted)' as const,
    configured: Boolean(tagsResponse?.ok && modelPresent),
    freeOnly: true as const,
    ollama: Boolean(tagsResponse?.ok),
    model,
    modelPresent,
    search,
    circuits: models.map((item) => ({ model: typeof item.name === 'string' ? item.name : '', state: 'CLOSED' as const, failures: 0 })),
  };
}
