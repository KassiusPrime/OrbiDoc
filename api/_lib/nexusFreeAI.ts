import crypto from 'node:crypto';
import { searchWebZeroCost, webContext, type WebSearchResult } from './zeroCostWebSearch.js';

const MODELS = [
  'openrouter/free',
  'nvidia/nemotron-3.5-lightning:free',
  'cohere/north-mini-code:free',
  'liquid/lfm-2.5-2.6b:free',
  'thinkingmachines/inkling-small:free',
] as const;

type Strategy = 'fast' | 'coding' | 'deep' | 'web';
export type NexusBody = {
  messages?: unknown;
  systemPrompt?: unknown;
  files?: unknown;
  webSearch?: unknown;
  webSearchExplicit?: unknown;
  taskHint?: unknown;
  maxOutputTokens?: unknown;
  privacy?: unknown;
};

export type NexusMeta = {
  requestId: string;
  assistant: 'Nexus AI';
  strategy: Strategy;
  freeOnly: true;
  fallbackUsed: boolean;
  webSearch: boolean;
  webEngine?: 'tavily-free';
};

export type NexusResult = NexusMeta & { answer: string };

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM = [
  'Você é Nexus AI, a inteligência unificada do Orbit.',
  'Responda em português quando o usuário escrever em português.',
  'Seja direto, preciso e útil. Não invente fatos e preserve o formato pedido.',
  'Você opera exclusivamente com modelos de inferência gratuitos. Nunca use ou solicite GPT, Gemini ou qualquer modelo pago.',
].join(' ');

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_MESSAGES = 60;
const MAX_INPUT_CHARS = 160_000;

function messages(value: unknown): Message[] {
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

function lastUser(items: readonly Message[]): string {
  for (let i = items.length - 1; i >= 0; i -= 1) if (items[i]?.role === 'user') return items[i]?.content ?? '';
  return '';
}

function strategy(items: readonly Message[], web: boolean, hint?: string): Strategy {
  if (web) return 'web';
  const text = `${hint ?? ''}\n${lastUser(items)}`;
  if (/\b(código|code|typescript|javascript|python|java|sql|regex|bug|erro|api|função|classe|excel|planilha)\b/i.test(text)) return 'coding';
  if (/\b(análise profunda|analise profundamente|arquitetura|estratégia|planejamento|compare|comparação|raciocínio|prova)\b/i.test(text)) return 'deep';
  return 'fast';
}

function modelOrder(kind: Strategy): readonly string[] {
  if (kind === 'coding') return ['cohere/north-mini-code:free', 'nvidia/nemotron-3.5-lightning:free', 'openrouter/free'];
  if (kind === 'deep') return ['nvidia/nemotron-3.5-lightning:free', 'openrouter/free', 'cohere/north-mini-code:free'];
  return ['openrouter/free', 'nvidia/nemotron-3.5-lightning:free', 'cohere/north-mini-code:free', 'liquid/lfm-2.5-2.6b:free'];
}

function apiKey(): string {
  const key = String(process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!key) throw new Error('Nexus AI gratuito ainda não está configurado no servidor. Configure OPENROUTER_API_KEY com uma chave gratuita do OpenRouter.');
  return key;
}

function outputLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 2048;
  return Math.max(256, Math.min(8192, Math.floor(value)));
}

function systemPrompt(body: NexusBody): string {
  const custom = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
  return custom ? `${SYSTEM}\n\nContexto adicional:\n${custom}` : SYSTEM;
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await run(controller.signal); } finally { clearTimeout(timer); }
}

async function webContextIfNeeded(body: NexusBody, items: readonly Message[]): Promise<{ context?: WebSearchResult; used: boolean }> {
  const explicit = body.webSearch === true;
  const text = lastUser(items);
  const automatic = /\b(hoje|agora|atual|recente|notícia|noticias|latest|2026|2027)\b/i.test(text);
  if (!explicit && !automatic) return { used: false };
  try {
    const result = await searchWebZeroCost(text);
    return { context: result, used: true };
  } catch (error) {
    if (explicit || body.webSearchExplicit === true) throw error;
    return { used: false };
  }
}

function requestBody(body: NexusBody, items: Message[], model: string, web?: WebSearchResult): string {
  const all = [...items];
  if (web) all.push({ role: 'system', content: webContext(web) });
  return JSON.stringify({
    model,
    messages: all,
    temperature: 0.2,
    max_tokens: outputLimit(body.maxOutputTokens),
    stream: false,
    provider: { allow_fallbacks: false, max_price: { prompt: 0, completion: 0 } },
  });
}

function extractAnswer(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((item) => typeof item?.text === 'string' ? item.text : '').join('').trim();
  return '';
}

function costOf(payload: any): number {
  const raw = payload?.usage?.cost ?? payload?.usage?.total_cost ?? payload?.cost;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

async function completeWithModel(body: NexusBody, items: Message[], model: string, web?: WebSearchResult): Promise<string> {
  const response = await withTimeout((signal) => fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': String(process.env.ORBIT_PUBLIC_URL ?? 'https://orbidoc.app'),
      'X-Title': 'Orbit · Nexus AI',
    },
    body: requestBody({ ...body, systemPrompt: systemPrompt(body) }, [{ role: 'system', content: systemPrompt(body) }, ...items], model, web),
    signal,
  }));
  const text = await response.text();
  let payload: any = {};
  try { payload = JSON.parse(text); } catch { payload = {}; }
  if (!response.ok) throw new Error(String(payload?.error?.message || `OpenRouter respondeu ${response.status}.`));
  if (costOf(payload) > 0) throw new Error('ZERO_COST_INVARIANT_VIOLATED: a rota selecionada reportou custo maior que zero.');
  const answer = extractAnswer(payload);
  if (!answer) throw new Error('O modelo gratuito retornou uma resposta vazia.');
  return answer;
}

export async function complete(body: NexusBody): Promise<NexusResult> {
  const requestId = crypto.randomUUID();
  const items = messages(body.messages);
  const web = await webContextIfNeeded(body, items);
  const kind = strategy(items, web.used, typeof body.taskHint === 'string' ? body.taskHint : undefined);
  const candidates = modelOrder(kind);
  let lastError: unknown = null;
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      const answer = await completeWithModel(body, items, candidates[index]!, web.context);
      return { requestId, assistant: 'Nexus AI', strategy: kind, freeOnly: true, fallbackUsed: index > 0, webSearch: web.used, webEngine: web.used ? 'tavily-free' : undefined, answer };
    } catch (error) {
      lastError = error;
      if (/OPENROUTER_API_KEY|ZERO_COST_INVARIANT/i.test(String(error))) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Nenhum modelo gratuito do Nexus AI está disponível no momento.');
}

export async function stream(body: NexusBody, onChunk: (chunk: string) => void, onMeta: (meta: NexusMeta) => void): Promise<void> {
  const result = await complete(body);
  onMeta({ requestId: result.requestId, assistant: result.assistant, strategy: result.strategy, freeOnly: true, fallbackUsed: result.fallbackUsed, webSearch: result.webSearch, webEngine: result.webEngine });
  const words = result.answer.match(/\S+\s*/g) ?? [result.answer];
  for (const word of words) onChunk(word);
}

export { MODELS };
