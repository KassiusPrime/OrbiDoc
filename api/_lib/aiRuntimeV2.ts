import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { resolveGatewayCredential } from './gatewayAuth.js';

export type ProviderIdV2 = 'gateway' | 'gemini' | 'openrouter' | 'groq';
export type ChatMessageV2 = { role: 'system' | 'user' | 'assistant'; content: string; files?: unknown[] };
export type RuntimeMetaV2 = {
  requestId: string;
  requestedProvider: ProviderIdV2;
  requestedModel: string;
  provider: ProviderIdV2;
  model: string;
  routedModel?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  webSearch: boolean;
};
export type ChatResultV2 = RuntimeMetaV2 & { answer: string };

const TIMEOUT_MS = 45_000;
const MODEL_CACHE_MS = 5 * 60_000;
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';

const CURATED_MODELS: Array<{
  id: string;
  provider: ProviderIdV2;
  label: string;
  recommended?: boolean;
  preview?: boolean;
  webSearch?: boolean;
  research?: boolean;
  router?: boolean;
}> = [
  { id: 'gemini-3.6-flash', provider: 'gemini', label: 'Gemini 3.6 Flash · Google direto', recommended: true, webSearch: true },
  { id: 'gemini-3.5-flash-lite', provider: 'gemini', label: 'Gemini 3.5 Flash-Lite · Google direto', webSearch: true },
  { id: 'gemini-3.1-pro-preview', provider: 'gemini', label: 'Gemini 3.1 Pro · Google direto', preview: true, webSearch: true },

  { id: 'groq/compound', provider: 'groq', label: 'Groq Compound · Pesquisa Web', recommended: true, webSearch: true, research: true },
  { id: 'groq/compound-mini', provider: 'groq', label: 'Groq Compound Mini · Pesquisa rápida', webSearch: true, research: true },
  { id: 'openai/gpt-oss-120b', provider: 'groq', label: 'Groq GPT-OSS 120B · direto', recommended: true },
  { id: 'openai/gpt-oss-20b', provider: 'groq', label: 'Groq GPT-OSS 20B · direto' },
  { id: 'llama-3.3-70b-versatile', provider: 'groq', label: 'Groq Llama 3.3 70B · direto' },
  { id: 'llama-3.1-8b-instant', provider: 'groq', label: 'Groq Llama 3.1 8B · direto' },

  { id: 'openrouter/auto', provider: 'openrouter', label: 'OpenRouter Auto · direto', recommended: true, webSearch: true, router: true },
  { id: 'openrouter/free', provider: 'openrouter', label: 'OpenRouter Free Router · direto', webSearch: true, router: true },

  { id: 'openai/gpt-5.5', provider: 'gateway', label: 'GPT-5.5 · Vercel Gateway', recommended: true, webSearch: true },
  { id: 'openai/gpt-5.5-pro', provider: 'gateway', label: 'GPT-5.5 Pro · Vercel Gateway', webSearch: true },
  { id: 'google/gemini-3.6-flash', provider: 'gateway', label: 'Gemini 3.6 Flash · Vercel Gateway' },
  { id: 'google/gemini-3.5-flash-lite', provider: 'gateway', label: 'Gemini 3.5 Flash-Lite · Vercel Gateway' },
  { id: 'inclusionai/ling-3.0-flash-free', provider: 'gateway', label: 'Ling 3.0 Flash · Gateway gratuito' },
  // Keep the OrbiDoc aliases visible only when the live Gateway catalog confirms them.
  { id: 'openai/gpt-5.6-luna', provider: 'gateway', label: 'GPT-5.6 Luna · Vercel Gateway' },
  { id: 'openai/gpt-5.6-terra', provider: 'gateway', label: 'GPT-5.6 Terra · Vercel Gateway' },
  { id: 'openai/gpt-5.6-sol', provider: 'gateway', label: 'GPT-5.6 Sol · Vercel Gateway' },
];

const providerConfigured = (provider: ProviderIdV2) => {
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY);
  if (provider === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
};

const compact = (error: unknown) => (error instanceof Error ? error.message : String(error || 'Falha desconhecida'))
  .replace(/\s+/g, ' ')
  .slice(0, 420);

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function validateMessages(messages: unknown): messages is ChatMessageV2[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) return false;
  let total = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return false;
    if (!['system', 'user', 'assistant'].includes((message as any).role)) return false;
    if (typeof (message as any).content !== 'string') return false;
    total += (message as any).content.length;
    if (total > 120_000) return false;
  }
  return true;
}

function normalizeProvider(provider: unknown): ProviderIdV2 {
  if (provider === 'gateway' || provider === 'gemini' || provider === 'openrouter' || provider === 'groq') return provider;
  throw new Error(`Provedor de IA inválido: ${String(provider || 'vazio')}.`);
}

function compatibleMessages(messages: ChatMessageV2[], systemPrompt?: string, files?: any[]) {
  const out: any[] = messages.map((message) => ({ role: message.role, content: message.content }));
  if (systemPrompt && !out.some((message) => message.role === 'system')) out.unshift({ role: 'system', content: systemPrompt });
  const images = (files || [])
    .map((file) => typeof file?.preview === 'string' ? file.preview : '')
    .filter((preview) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(preview) && preview.length <= 4_500_000)
    .slice(0, 4);
  if (images.length) {
    for (let index = out.length - 1; index >= 0; index -= 1) {
      if (out[index].role !== 'user' || typeof out[index].content !== 'string') continue;
      out[index].content = [
        { type: 'text', text: out[index].content },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ];
      break;
    }
  }
  return out;
}

function geminiPayload(messages: ChatMessageV2[], systemPrompt?: string, files?: any[]) {
  let systemInstruction = systemPrompt || 'Você é o assistente do OrbiDoc. Responda com precisão, preserve o formato solicitado e não invente fatos.';
  const contents: any[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      systemInstruction = message.content;
      continue;
    }
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];
    if (role === 'user') {
      for (const file of (message.files as any[]) || files || []) {
        if (typeof file?.preview !== 'string') continue;
        const match = file.preview.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    parts.push({ text: message.content });
    const previous = contents[contents.length - 1];
    if (previous?.role === role) previous.parts.push(...parts);
    else contents.push({ role, parts });
  }
  return { systemInstruction, contents };
}

function appendSources(answer: string, sources: Array<{ title?: string; url?: string }>) {
  const unique = new Map<string, string>();
  for (const source of sources) {
    const url = String(source.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    unique.set(url, String(source.title || url).trim() || url);
  }
  if (!unique.size || /(?:^|\n)#{2,3}\s+Fontes\b/i.test(answer)) return answer.trim();
  return `${answer.trim()}\n\n### Fontes\n${[...unique].slice(0, 12).map(([url, title]) => `- [${title.replace(/[\[\]]/g, '')}](${url})`).join('\n')}`;
}

async function requestGemini(model: string, messages: ChatMessageV2[], systemPrompt?: string, files?: any[], webSearch = false) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Google Gemini não está configurado neste ambiente.');
  const client = new GoogleGenAI({ apiKey });
  const payload = geminiPayload(messages, systemPrompt, files);
  const response: any = await client.models.generateContent({
    model,
    contents: payload.contents,
    config: {
      systemInstruction: payload.systemInstruction,
      ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  const raw = String(response?.text || '').trim();
  if (!raw) throw new Error(`Gemini ${model} não retornou conteúdo textual.`);
  if (!webSearch) return { answer: raw, model };
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((chunk: any) => ({ title: chunk?.web?.title, url: chunk?.web?.uri }));
  return { answer: appendSources(raw, sources), model };
}

async function requestGroq(model: string, messages: ChatMessageV2[], systemPrompt?: string, webSearch = false) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Groq não está configurado neste ambiente.');
  const researchModel = model.startsWith('groq/compound');
  const effectiveModel = webSearch && !researchModel ? 'groq/compound-mini' : model;
  const body: any = {
    model: effectiveModel,
    messages: compatibleMessages(messages, systemPrompt),
    temperature: 0.35,
    citation_options: 'enabled',
  };
  if (webSearch || researchModel) {
    body.compound_custom = { tools: { enabled_tools: ['web_search', 'visit_website'] } };
  }
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Groq-Model-Version': 'latest' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Groq ${response.status}: ${text.slice(0, 320)}`);
  const data: any = JSON.parse(text);
  const message = data?.choices?.[0]?.message;
  let answer = String(message?.content || '').trim();
  if (!answer) throw new Error(`Groq ${effectiveModel} não retornou conteúdo textual.`);
  const sources: Array<{ title?: string; url?: string }> = [];
  for (const tool of message?.executed_tools || []) {
    for (const result of tool?.search_results || []) sources.push({ title: result?.title, url: result?.url });
  }
  if (sources.length) answer = appendSources(answer, sources);
  return { answer, model: effectiveModel, routedModel: effectiveModel !== model ? effectiveModel : undefined };
}

async function requestOpenRouter(model: string, messages: ChatMessageV2[], systemPrompt?: string, files?: any[], webSearch = false) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OpenRouter não está configurado neste ambiente.');
  const body: any = {
    model,
    messages: compatibleMessages(messages, systemPrompt, files),
    temperature: 0.35,
  };
  if (webSearch) {
    body.tools = [
      { type: 'openrouter:web_search', parameters: { max_results: 5, max_total_results: 10 } },
      { type: 'openrouter:web_fetch', parameters: { engine: 'openrouter', max_content_tokens: 12_000 } },
    ];
  }
  let response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'OrbiDoc' },
    body: JSON.stringify(body),
  });
  let text = await response.text();
  // Compatibility retry stays inside OpenRouter and never changes provider/model.
  if (!response.ok && webSearch) {
    delete body.tools;
    body.plugins = [{ id: 'web', max_results: 5 }];
    response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'OrbiDoc' },
      body: JSON.stringify(body),
    });
    text = await response.text();
  }
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 320)}`);
  const data: any = JSON.parse(text);
  const message = data?.choices?.[0]?.message;
  let answer = String(message?.content || '').trim();
  if (!answer) throw new Error(`OpenRouter ${model} não retornou conteúdo textual.`);
  const sources: Array<{ title?: string; url?: string }> = [];
  for (const citation of message?.annotations || message?.citations || []) {
    const source = citation?.url_citation || citation;
    sources.push({ title: source?.title, url: source?.url });
  }
  if (sources.length) answer = appendSources(answer, sources);
  return { answer, model: String(data?.model || model), routedModel: typeof data?.model === 'string' ? data.model : undefined };
}

function extractResponseText(data: any) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of data?.output || []) {
    for (const block of item?.content || []) {
      if (typeof block?.text === 'string') chunks.push(block.text);
    }
  }
  return chunks.join('\n').trim();
}

async function requestGateway(model: string, messages: ChatMessageV2[], systemPrompt?: string, files?: any[], webSearch = false) {
  const credential = await resolveGatewayCredential();
  if (!credential.token) throw new Error('Vercel AI Gateway não está autenticado.');
  const headers = {
    Authorization: `Bearer ${credential.token}`,
    'Content-Type': 'application/json',
    'X-Vercel-AI-Gateway-App': 'OrbiDoc',
  };

  if (webSearch && model.startsWith('openai/')) {
    const input = compatibleMessages(messages, systemPrompt, files).map((message: any) => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content : message.content,
    }));
    const response = await fetchWithTimeout(`${AI_GATEWAY_URL}/responses`, {
      method: 'POST', headers, body: JSON.stringify({ model, input, tools: [{ type: 'web_search' }] }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${text.slice(0, 320)}`);
    const data: any = JSON.parse(text);
    const answer = extractResponseText(data);
    if (!answer) throw new Error(`AI Gateway ${model} não retornou conteúdo textual.`);
    return { answer, model: String(data?.model || model), routedModel: typeof data?.model === 'string' ? data.model : undefined };
  }

  if (webSearch) {
    throw new Error('Pesquisa web neste modelo do Gateway não é garantida. Use Groq Compound, Gemini direto ou OpenRouter para pesquisa real.');
  }

  const response = await fetchWithTimeout(`${AI_GATEWAY_URL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: compatibleMessages(messages, systemPrompt, files), stream: false }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${text.slice(0, 320)}`);
  const data: any = JSON.parse(text);
  const answer = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!answer) throw new Error(`AI Gateway ${model} não retornou conteúdo textual.`);
  return { answer, model: String(data?.model || model), routedModel: typeof data?.model === 'string' ? data.model : undefined };
}

export async function runChatV2(body: any): Promise<ChatResultV2> {
  const provider = normalizeProvider(body?.provider);
  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  if (!model) throw new Error('Selecione um modelo de IA válido.');
  if (!validateMessages(body?.messages)) throw new Error('Mensagens inválidas ou grandes demais.');
  if (!providerConfigured(provider)) throw new Error(`${provider} não está configurado. Conecte este provedor antes de usá-lo.`);
  const requestId = crypto.randomUUID();
  const webSearch = Boolean(body?.webSearch);

  try {
    const result = provider === 'gemini'
      ? await requestGemini(model, body.messages, body.systemPrompt, body.files, webSearch)
      : provider === 'groq'
        ? await requestGroq(model, body.messages, body.systemPrompt, webSearch)
        : provider === 'openrouter'
          ? await requestOpenRouter(model, body.messages, body.systemPrompt, body.files, webSearch)
          : await requestGateway(model, body.messages, body.systemPrompt, body.files, webSearch);

    return {
      answer: result.answer,
      requestId,
      requestedProvider: provider,
      requestedModel: model,
      provider,
      model: result.model,
      routedModel: result.routedModel,
      fallbackUsed: false,
      webSearch,
    };
  } catch (error) {
    // Deliberately no cross-provider fallback: a selected Groq/OpenRouter/Gateway model
    // must never turn into Gemini behind the user's back.
    throw new Error(`${provider}/${model}: ${compact(error)}`);
  }
}

export async function streamChatV2(body: any, write: (payload: object) => void) {
  const result = await runChatV2(body);
  const { answer, ...meta } = result;
  write({ meta });
  write({ chunk: answer });
  return result.requestId;
}

type ModelCache = { expiresAt: number; values: Map<ProviderIdV2, Set<string> | null> };
let modelCache: ModelCache | null = null;

async function fetchModelIds(provider: ProviderIdV2): Promise<Set<string> | null> {
  try {
    if (!providerConfigured(provider)) return new Set();
    if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY!;
      const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {}, 8_000);
      if (!response.ok) return null;
      const data: any = await response.json();
      return new Set((data.models || []).filter((m: any) => !Array.isArray(m.supportedGenerationMethods) || m.supportedGenerationMethods.includes('generateContent')).map((m: any) => String(m.name || '').replace(/^models\//, '')));
    }
    if (provider === 'groq') {
      const response = await fetchWithTimeout('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }, 8_000);
      if (!response.ok) return null;
      const data: any = await response.json();
      return new Set((data.data || []).map((m: any) => String(m.id || '')));
    }
    if (provider === 'openrouter') {
      const response = await fetchWithTimeout('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } }, 8_000);
      if (!response.ok) return null;
      const data: any = await response.json();
      return new Set((data.data || []).map((m: any) => String(m.id || '')));
    }
    const credential = await resolveGatewayCredential();
    if (!credential.token) return new Set();
    const response = await fetchWithTimeout(`${AI_GATEWAY_URL}/models`, { headers: { Authorization: `Bearer ${credential.token}` } }, 8_000);
    if (!response.ok) return null;
    const data: any = await response.json();
    return new Set((data.data || data.models || []).map((m: any) => String(m.id || m.model || '')));
  } catch {
    return null;
  }
}

async function liveModelMap() {
  if (modelCache && modelCache.expiresAt > Date.now()) return modelCache.values;
  const providers: ProviderIdV2[] = ['gemini', 'groq', 'openrouter', 'gateway'];
  const pairs = await Promise.all(providers.map(async (provider) => [provider, await fetchModelIds(provider)] as const));
  const values = new Map<ProviderIdV2, Set<string> | null>(pairs);
  modelCache = { expiresAt: Date.now() + MODEL_CACHE_MS, values };
  return values;
}

export async function getModelCatalogV2() {
  const live = await liveModelMap();
  return CURATED_MODELS.map((model) => {
    const configured = providerConfigured(model.provider);
    const remote = live.get(model.provider);
    const routerException = model.provider === 'openrouter' && model.router;
    const confirmed = remote instanceof Set ? (remote.has(model.id) || routerException) : false;
    const enabled = configured && (remote === null || confirmed);
    return { ...model, enabled, verified: confirmed, strictProvider: true };
  });
}

async function probe(provider: ProviderIdV2) {
  if (!providerConfigured(provider)) return { configured: false, reachable: false, reason: 'not-configured' };
  const ids = await fetchModelIds(provider);
  return { configured: true, reachable: ids !== null, modelCount: ids?.size || 0 };
}

export async function getProviderStatusV2() {
  const [gateway, gemini, openrouter, groq] = await Promise.all([
    probe('gateway'), probe('gemini'), probe('openrouter'), probe('groq'),
  ]);
  return {
    gateway: { ...gateway, strictRouting: true },
    gemini: { ...gemini, strictRouting: true, webSearch: true },
    openrouter: { ...openrouter, strictRouting: true, webSearch: true },
    groq: { ...groq, strictRouting: true, webSearch: true, researchModel: 'groq/compound' },
  };
}
