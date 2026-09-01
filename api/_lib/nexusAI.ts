import crypto from 'node:crypto';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText, type ModelMessage } from 'ai';
import { searchWebZeroCost, webContext, type WebSearchResult } from './zeroCostWebSearch.js';

export const NEXUS_FREE_MODELS = [
  'openrouter/free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'minimax/minimax-m3:free',
  'z-ai/glm-5.2:free',
  'thinkingmachines/inkling:free',
  'thinkingmachines/inkling-small:free',
  'poolside/laguna-s-2.1:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'cohere/north-mini-code:free',
  'liquid/lfm-2.5-2.6b:free',
] as const;

export type NexusFreeModelId = (typeof NEXUS_FREE_MODELS)[number];
export type NexusStrategy = 'fast' | 'coding' | 'deep' | 'web';
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type NexusMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type NexusBody = {
  messages?: unknown;
  systemPrompt?: unknown;
  files?: unknown;
  webSearch?: unknown;
  taskHint?: unknown;
  maxOutputTokens?: unknown;
};

export type NexusClientMeta = {
  requestId: string;
  assistant: 'Nexus AI';
  strategy: NexusStrategy;
  freeOnly: true;
  fallbackUsed: boolean;
  webSearch: boolean;
  webEngine?: 'tavily-free';
};

export type NexusResult = NexusClientMeta & { answer: string };

type CircuitOptions = {
  failureThreshold: number;
  openDurationMs: number;
};

const DEFAULT_SYSTEM_PROMPT = [
  'Você é Nexus AI, a inteligência unificada do Orbit.',
  'Orbispace é a área de trabalho e OrbiDoc é o módulo de documentos, planilhas, apresentações e dashboards.',
  'Seja direto, preciso e útil. Preserve formatos solicitados e não invente fatos.',
  'Você faz parte de uma orquestração interna de modelos gratuitos do OpenRouter; nunca exponha ou discuta qual modelo interno respondeu.',
].join(' ');

const REQUEST_TIMEOUT_MS = 42_000;
const MAX_MESSAGES = 60;
const MAX_INPUT_CHARS = 160_000;
const BREAKERS = new Map<NexusFreeModelId, CircuitBreaker>();

export class CircuitOpenError extends Error {
  constructor(public readonly modelId: NexusFreeModelId) {
    super(`Circuito temporariamente aberto para ${modelId}.`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private probeRunning = false;

  constructor(
    public readonly modelId: NexusFreeModelId,
    private readonly options: CircuitOptions = { failureThreshold: 3, openDurationMs: 30_000 },
  ) {}

  getState(now = Date.now()): CircuitState {
    if (this.state === 'OPEN' && now - this.openedAt >= this.options.openDurationMs) {
      this.state = 'HALF_OPEN';
      this.probeRunning = false;
    }
    return this.state;
  }

  begin(): void {
    const state = this.getState();
    if (state === 'OPEN' || (state === 'HALF_OPEN' && this.probeRunning)) {
      throw new CircuitOpenError(this.modelId);
    }
    if (state === 'HALF_OPEN') this.probeRunning = true;
  }

  success(): void {
    this.failures = 0;
    this.probeRunning = false;
    this.state = 'CLOSED';
  }

  failure(): void {
    this.failures += 1;
    this.probeRunning = false;
    if (this.state === 'HALF_OPEN' || this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}

for (const modelId of NEXUS_FREE_MODELS) BREAKERS.set(modelId, new CircuitBreaker(modelId));

export function assertFreeModel(modelId: string): asserts modelId is NexusFreeModelId {
  if (modelId !== 'openrouter/free' && !modelId.endsWith(':free')) {
    throw new Error(`PAID_MODEL_FORBIDDEN: ${modelId}`);
  }
  if (!(NEXUS_FREE_MODELS as readonly string[]).includes(modelId)) {
    throw new Error(`MODEL_NOT_ALLOWLISTED: ${modelId}`);
  }
}

function compactError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? 'Falha desconhecida'))
    .replace(/\s+/g, ' ')
    .slice(0, 420);
}

function is429(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; statusCode?: unknown; message?: unknown };
  return candidate.status === 429
    || candidate.statusCode === 429
    || (typeof candidate.message === 'string' && /\b429\b|rate.?limit/i.test(candidate.message));
}

function normalizeMessages(value: unknown): NexusMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    throw new Error('Nexus AI recebeu uma conversa inválida.');
  }
  let total = 0;
  const messages: NexusMessage[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new Error('Mensagem inválida.');
    const item = raw as { role?: unknown; content?: unknown };
    if (item.role !== 'system' && item.role !== 'user' && item.role !== 'assistant') throw new Error('Papel de mensagem inválido.');
    if (typeof item.content !== 'string') throw new Error('Conteúdo de mensagem inválido.');
    total += item.content.length;
    if (total > MAX_INPUT_CHARS) throw new Error('Contexto muito grande para esta requisição.');
    messages.push({ role: item.role, content: item.content });
  }
  return messages;
}

function lastUserText(messages: readonly NexusMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return messages[index]?.content ?? '';
  }
  return '';
}

function classify(messages: readonly NexusMessage[], webSearch: boolean, hint?: string): NexusStrategy {
  if (webSearch) return 'web';
  const text = `${hint ?? ''}\n${lastUserText(messages)}`.toLowerCase();
  if (/\b(code|código|typescript|javascript|python|java|sql|regex|bug|erro|stack trace|api|função|classe|formula|fórmula|excel|planilha)\b/i.test(text)) return 'coding';
  if (/\b(analise profundamente|análise profunda|pesquisa profunda|arquitetura|estratégia|planejamento|compare|comparação|raciocínio|proof|prove)\b/i.test(text)) return 'deep';
  return 'fast';
}

function candidateOrder(strategy: NexusStrategy): NexusFreeModelId[] {
  const orders: Record<NexusStrategy, NexusFreeModelId[]> = {
    fast: [
      'openrouter/free',
      'nvidia/nemotron-3.5-lightning:free',
      'thinkingmachines/inkling-small:free',
      'liquid/lfm-2.5-2.6b:free',
      'google/gemma-4-26b-a4b-it:free',
      'minimax/minimax-m3:free',
    ],
    coding: [
      'cohere/north-mini-code:free',
      'poolside/laguna-s-2.1:free',
      'thinkingmachines/inkling:free',
      'nvidia/nemotron-3.5-lightning:free',
      'openrouter/free',
      'z-ai/glm-5.2:free',
    ],
    deep: [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'z-ai/glm-5.2:free',
      'minimax/minimax-m3:free',
      'google/gemma-4-31b-it:free',
      'thinkingmachines/inkling:free',
      'openrouter/free',
    ],
    web: [
      'openrouter/free',
      'nvidia/nemotron-3.5-lightning:free',
      'z-ai/glm-5.2:free',
      'google/gemma-4-31b-it:free',
      'minimax/minimax-m3:free',
      'thinkingmachines/inkling-small:free',
    ],
  };
  return orders[strategy];
}

function toModelMessages(messages: readonly NexusMessage[], web?: WebSearchResult): ModelMessage[] {
  const output: ModelMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  })) as ModelMessage[];
  if (web) {
    output.push({ role: 'system', content: webContext(web) } as ModelMessage);
  }
  return output;
}

function systemPrompt(body: NexusBody): string {
  const custom = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
  return custom ? `${DEFAULT_SYSTEM_PROMPT}\n\nContexto adicional da ferramenta:\n${custom}` : DEFAULT_SYSTEM_PROMPT;
}

function outputLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 2_048;
  return Math.max(128, Math.min(8_192, Math.floor(value)));
}

function createProvider() {
  const apiKey = String(process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não está configurada para o Nexus AI.');
  return createOpenRouter({
    apiKey,
    headers: {
      'X-Title': 'Orbit · Nexus AI',
      'HTTP-Referer': String(process.env.ORBIT_PUBLIC_URL ?? process.env.VERCEL_URL ?? 'https://orbidoc.app'),
    },
  });
}

function logInternal(event: string, data: Record<string, unknown>): void {
  console.info(JSON.stringify({
    ts: new Date().toISOString(),
    service: 'nexus-ai',
    event,
    ...data,
  }));
}

async function withTimeout<T>(signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Nexus AI request timeout')), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function nextDelay(attempt: number): number {
  const base = Math.min(1_600, 100 * 2 ** attempt);
  return base + Math.floor(Math.random() * 120);
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw signal.reason ?? new Error('Abortado');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('Abortado'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export class NexusAIClient {
  async complete(body: NexusBody, signal?: AbortSignal): Promise<NexusResult> {
    const requestId = crypto.randomUUID();
    const messages = normalizeMessages(body.messages);
    const wantsWeb = body.webSearch === true;
    const strategy = classify(messages, wantsWeb, typeof body.taskHint === 'string' ? body.taskHint : undefined);
    const web = wantsWeb ? await searchWebZeroCost(lastUserText(messages)) : undefined;
    const candidates = candidateOrder(strategy);
    const provider = createProvider();
    const startedAt = Date.now();
    let lastError: unknown;
    let attempts = 0;

    for (const modelId of candidates) {
      assertFreeModel(modelId);
      const breaker = BREAKERS.get(modelId)!;
      try {
        breaker.begin();
      } catch (error) {
        lastError = error;
        continue;
      }

      attempts += 1;
      try {
        const result = await withTimeout(signal, (requestSignal) => generateText({
          model: provider(modelId),
          system: systemPrompt(body),
          messages: toModelMessages(messages, web),
          maxOutputTokens: outputLimit(body.maxOutputTokens),
          temperature: strategy === 'fast' ? 0.2 : 0.35,
          maxRetries: 0,
          abortSignal: requestSignal,
        }));
        const answer = result.text.trim();
        if (!answer) throw new Error('Resposta vazia do modelo interno.');
        breaker.success();
        logInternal('completion.ok', { requestId, modelId, strategy, attempts, latencyMs: Date.now() - startedAt, webSearch: wantsWeb });
        return {
          requestId,
          assistant: 'Nexus AI',
          strategy,
          freeOnly: true,
          fallbackUsed: attempts > 1,
          webSearch: wantsWeb,
          webEngine: web?.engine,
          answer,
        };
      } catch (error) {
        breaker.failure();
        lastError = error;
        logInternal('completion.fail', { requestId, modelId, strategy, attempts, error: compactError(error), status429: is429(error) });
        if (signal?.aborted) throw signal.reason ?? error;
        if (is429(error)) await sleep(nextDelay(Math.min(attempts - 1, 4)), signal);
      }
    }

    throw new Error(`Nexus AI indisponível em todos os modelos gratuitos permitidos. ${compactError(lastError)}`);
  }

  async stream(
    body: NexusBody,
    onChunk: (chunk: string) => void,
    onMeta: (meta: NexusClientMeta) => void,
    signal?: AbortSignal,
  ): Promise<NexusClientMeta> {
    const requestId = crypto.randomUUID();
    const messages = normalizeMessages(body.messages);
    const wantsWeb = body.webSearch === true;
    const strategy = classify(messages, wantsWeb, typeof body.taskHint === 'string' ? body.taskHint : undefined);
    const web = wantsWeb ? await searchWebZeroCost(lastUserText(messages)) : undefined;
    const candidates = candidateOrder(strategy);
    const provider = createProvider();
    const startedAt = Date.now();
    let lastError: unknown;
    let attempts = 0;

    for (const modelId of candidates) {
      assertFreeModel(modelId);
      const breaker = BREAKERS.get(modelId)!;
      try {
        breaker.begin();
      } catch (error) {
        lastError = error;
        continue;
      }

      attempts += 1;
      let emitted = false;
      try {
        const meta: NexusClientMeta = {
          requestId,
          assistant: 'Nexus AI',
          strategy,
          freeOnly: true,
          fallbackUsed: attempts > 1,
          webSearch: wantsWeb,
          webEngine: web?.engine,
        };
        const result = streamText({
          model: provider(modelId),
          system: systemPrompt(body),
          messages: toModelMessages(messages, web),
          maxOutputTokens: outputLimit(body.maxOutputTokens),
          temperature: strategy === 'fast' ? 0.2 : 0.35,
          maxRetries: 0,
          abortSignal: signal,
          onError({ error }) {
            logInternal('stream.error', { requestId, modelId, strategy, error: compactError(error) });
          },
        });

        for await (const textPart of result.textStream) {
          if (!textPart) continue;
          if (!emitted) {
            emitted = true;
            onMeta(meta);
          }
          onChunk(textPart);
        }

        if (!emitted) throw new Error('Streaming retornou conteúdo vazio.');
        breaker.success();
        logInternal('stream.ok', { requestId, modelId, strategy, attempts, latencyMs: Date.now() - startedAt, webSearch: wantsWeb });
        return meta;
      } catch (error) {
        breaker.failure();
        lastError = error;
        logInternal('stream.fail', { requestId, modelId, strategy, attempts, error: compactError(error), emitted });
        if (signal?.aborted) throw signal.reason ?? error;
        // Depois do primeiro byte não podemos reiniciar a resposta sem duplicar texto.
        if (emitted) throw error;
        if (is429(error)) await sleep(nextDelay(Math.min(attempts - 1, 4)), signal);
      }
    }

    throw new Error(`Nexus AI indisponível em todos os modelos gratuitos permitidos. ${compactError(lastError)}`);
  }

  status(): { assistant: 'Nexus AI'; gateway: 'OpenRouter'; configured: boolean; freeOnly: true; circuits: Array<{ model: NexusFreeModelId; state: CircuitState }> } {
    return {
      assistant: 'Nexus AI',
      gateway: 'OpenRouter',
      configured: Boolean(String(process.env.OPENROUTER_API_KEY ?? '').trim()),
      freeOnly: true,
      circuits: NEXUS_FREE_MODELS.map((model) => ({ model, state: BREAKERS.get(model)!.getState() })),
    };
  }
}

export const nexusAI = new NexusAIClient();
