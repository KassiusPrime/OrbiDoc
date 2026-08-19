import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

export const MAX_MESSAGES = 50;
export const MAX_MESSAGE_CHARS = 120_000;
const PROVIDER_TIMEOUT_MS = 35_000;
const PROVIDER_PROBE_TIMEOUT_MS = 8_000;
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';
const GEMINI_ALLOWED_MODELS = new Set([
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
]);

export const GATEWAY_DEFAULT_MODEL = 'google/gemini-3.6-flash';
export const GATEWAY_ECONOMY_MODEL = 'google/gemini-3.5-flash-lite';
export const GATEWAY_FREE_MODEL = 'inclusionai/ling-3.0-flash-free';
const GATEWAY_ALLOWED_MODELS = new Set([
  GATEWAY_DEFAULT_MODEL,
  GATEWAY_ECONOMY_MODEL,
  GATEWAY_FREE_MODEL,
  'openai/gpt-5.6-luna',
  'openai/gpt-5.6-terra',
  'openai/gpt-5.6-sol',
]);

export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
const GROQ_ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
]);

export const OPENROUTER_DEFAULT_MODEL = 'openrouter/auto';

export type ProviderId = 'gateway' | 'gemini' | 'openrouter' | 'groq';
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string; files?: unknown[] };
export type ProviderMeta = {
  requestId: string;
  requestedProvider: string;
  requestedModel: string;
  provider: ProviderId;
  model: string;
  routedModel?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type ChatResult = ProviderMeta & { answer: string };

type CompatibleMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
};

export function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  let totalChars = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return false;
    const role = (message as any).role;
    const content = (message as any).content;
    if (!['system', 'user', 'assistant'].includes(role) || typeof content !== 'string') return false;
    totalChars += content.length;
    if (totalChars > MAX_MESSAGE_CHARS) return false;
  }
  return true;
}

export function normalizeProvider(value: unknown): ProviderId {
  if (value === 'gateway' || value === 'openrouter' || value === 'groq' || value === 'gemini') return value;
  return providerEnabled('gateway') ? 'gateway' : 'gemini';
}

function normalizeGatewayModel(model: unknown) {
  return typeof model === 'string' && GATEWAY_ALLOWED_MODELS.has(model) ? model : GATEWAY_DEFAULT_MODEL;
}

function normalizeGeminiModel(model: unknown) {
  return typeof model === 'string' && GEMINI_ALLOWED_MODELS.has(model) ? model : GEMINI_DEFAULT_MODEL;
}

function normalizeGroqModel(model: unknown) {
  return typeof model === 'string' && GROQ_ALLOWED_MODELS.has(model) ? model : GROQ_DEFAULT_MODEL;
}

function normalizeOpenRouterModel(model: unknown) {
  if (typeof model !== 'string' || !model.trim()) return OPENROUTER_DEFAULT_MODEL;
  return model.trim().slice(0, 160);
}

export function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Falha desconhecida');
  return message.replace(/\s+/g, ' ').slice(0, 300);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

function getGatewayToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '';
}

export function gatewayAuthMode() {
  if (process.env.AI_GATEWAY_API_KEY) return 'api-key';
  if (process.env.VERCEL_OIDC_TOKEN) return 'oidc';
  return 'none';
}

export function providerEnabled(provider: ProviderId) {
  if (provider === 'gateway') return Boolean(getGatewayToken());
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY);
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function chooseFallback(requested: ProviderId): ProviderId | null {
  const order: ProviderId[] = requested === 'gateway'
    ? ['gemini', 'openrouter', 'groq']
    : ['gateway', 'gemini', 'openrouter', 'groq'];
  return order.find((provider) => provider !== requested && providerEnabled(provider)) || null;
}

function prepareGeminiPayload(messages: ChatMessage[], systemPromptOverride?: string, files?: any[]) {
  let systemInstruction = systemPromptOverride ||
    'Você é o assistente do OrbiDoc. Analise documentos, escreva, revise e explique com precisão. Preserve a formatação solicitada, deixe limitações explícitas e não invente fatos.';
  const contents: any[] = [];

  for (const message of messages) {
    if (!message?.content) continue;
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
    parts.push({ text: String(message.content) });

    const previous = contents[contents.length - 1];
    if (previous?.role === role) previous.parts.push(...parts);
    else contents.push({ role, parts });
  }

  if (!contents.length) contents.push({ role: 'user', parts: [{ text: 'Olá' }] });
  return { systemInstruction, contents };
}

function prepareCompatibleMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
  files?: any[],
  includeImages = false,
): CompatibleMessage[] {
  const prepared: CompatibleMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (systemPrompt && !prepared.some((message) => message.role === 'system')) {
    prepared.unshift({ role: 'system', content: systemPrompt });
  }

  if (!includeImages || !Array.isArray(files) || files.length === 0) return prepared;

  const images = files
    .map((file) => typeof file?.preview === 'string' ? file.preview : '')
    .filter((preview) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(preview) && preview.length <= 4_500_000)
    .slice(0, 4);
  if (!images.length) return prepared;

  for (let index = prepared.length - 1; index >= 0; index -= 1) {
    const message = prepared[index];
    if (message.role !== 'user' || typeof message.content !== 'string') continue;
    message.content = [
      { type: 'text', text: message.content },
      ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
    ];
    break;
  }
  return prepared;
}

function uniqueModels(models: string[]) {
  return [...new Set(models.filter(Boolean))];
}

async function requestGateway(
  messages: ChatMessage[],
  requestedModel: string,
  stream: boolean,
  systemPrompt?: string,
  files?: any[],
) {
  const token = getGatewayToken();
  if (!token) throw new Error('Vercel AI Gateway não está autenticado.');

  const desired = normalizeGatewayModel(requestedModel);
  const models = uniqueModels([desired, GATEWAY_ECONOMY_MODEL, GATEWAY_FREE_MODEL]);
  const compatibleMessages = prepareCompatibleMessages(messages, systemPrompt, files, true);
  let lastError = 'Vercel AI Gateway não respondeu.';

  for (const model of models) {
    try {
      const response = await fetchWithTimeout(`${AI_GATEWAY_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Vercel-AI-Gateway-App': 'OrbiDoc',
        },
        body: JSON.stringify({ model, messages: compatibleMessages, stream }),
      });
      if (response.ok) return { response, model, internalFallback: model !== desired };
      lastError = `AI Gateway ${response.status}: ${(await response.text()).slice(0, 180)}`;
    } catch (error) {
      lastError = compactError(error);
    }
  }
  throw new Error(lastError);
}

async function requestOpenRouter(messages: ChatMessage[], requestedModel: string, stream: boolean) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter não está configurado.');
  const desired = normalizeOpenRouterModel(requestedModel);
  const models = desired === OPENROUTER_DEFAULT_MODEL
    ? [desired]
    : [desired, OPENROUTER_DEFAULT_MODEL];
  let lastError = 'OpenRouter não respondeu.';

  for (const model of models) {
    try {
      const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OrbiDoc',
        },
        body: JSON.stringify({ model, messages, stream }),
      });
      if (response.ok) return { response, model, internalFallback: model !== desired };
      lastError = `OpenRouter ${response.status}: ${(await response.text()).slice(0, 180)}`;
    } catch (error) {
      lastError = compactError(error);
    }
  }
  throw new Error(lastError);
}

async function requestGroq(messages: ChatMessage[], model: string, stream: boolean) {
  if (!process.env.GROQ_API_KEY) throw new Error('Groq não está configurado.');
  const normalizedModel = normalizeGroqModel(model);
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: normalizedModel, messages, stream }),
  });
  if (!response.ok) throw new Error(`Groq ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return { response, model: normalizedModel };
}

async function readCompatibleStream(
  response: Response,
  meta: ProviderMeta,
  write: (payload: object) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`${meta.provider} retornou resposta sem stream.`);

  write({ meta });
  const decoder = new TextDecoder();
  let buffer = '';
  let routedModel = '';

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const raw = line.slice(6).trim();
    if (!raw || raw === '[DONE]') return;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.model === 'string' && parsed.model && parsed.model !== routedModel) {
        routedModel = parsed.model;
        write({ meta: { ...meta, routedModel } });
      }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) write({ chunk: delta });
      if (parsed.error) throw new Error(compactError(parsed.error?.message || parsed.error));
    } catch (error) {
      if (error instanceof Error && error.message && !error.message.startsWith('Unexpected')) throw error;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);
}

async function executeProvider(
  provider: ProviderId,
  rawModel: unknown,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  files: any[] | undefined,
  requestedProvider: ProviderId,
  requestedModel: string,
  requestId: string,
  fallbackUsed: boolean,
  fallbackReason?: string,
): Promise<ChatResult> {
  if (provider === 'gateway') {
    const desired = normalizeGatewayModel(rawModel);
    const { response, model, internalFallback } = await requestGateway(
      messages,
      desired,
      false,
      systemPrompt,
      files,
    );
    const data: any = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI Gateway não retornou conteúdo textual.');
    return {
      answer,
      requestId,
      requestedProvider,
      requestedModel,
      provider: 'gateway',
      model,
      routedModel: typeof data.model === 'string' ? data.model : undefined,
      fallbackUsed: fallbackUsed || internalFallback,
      fallbackReason: internalFallback
        ? `O modelo ${desired} não respondeu; o Gateway usou ${model}.`
        : fallbackReason,
    };
  }

  if (provider === 'openrouter') {
    const desired = normalizeOpenRouterModel(rawModel);
    const { response, model, internalFallback } = await requestOpenRouter(messages, desired, false);
    const data: any = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('OpenRouter não retornou conteúdo textual.');
    return {
      answer,
      requestId,
      requestedProvider,
      requestedModel,
      provider: 'openrouter',
      model,
      routedModel: typeof data.model === 'string' ? data.model : undefined,
      fallbackUsed: fallbackUsed || internalFallback,
      fallbackReason: internalFallback ? `O modelo ${desired} não respondeu; OpenRouter Auto foi usado.` : fallbackReason,
    };
  }

  if (provider === 'groq') {
    const { response, model } = await requestGroq(messages, typeof rawModel === 'string' ? rawModel : '', false);
    const data: any = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('Groq não retornou conteúdo textual.');
    return {
      answer,
      requestId,
      requestedProvider,
      requestedModel,
      provider: 'groq',
      model,
      routedModel: typeof data.model === 'string' ? data.model : undefined,
      fallbackUsed,
      fallbackReason,
    };
  }

  const ai = getGeminiClient();
  if (!ai) throw new Error('Gemini não está configurado.');
  const model = normalizeGeminiModel(rawModel);
  const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
  const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
  return {
    answer: response.text || 'Sem resposta gerada pelo modelo.',
    requestId,
    requestedProvider,
    requestedModel,
    provider: 'gemini',
    model,
    fallbackUsed,
    fallbackReason,
  };
}

export async function runChat(body: any): Promise<ChatResult> {
  const { provider: rawProvider, model: rawModel, messages, systemPrompt, files } = body || {};
  if (!validateMessages(messages)) throw new Error('Mensagens inválidas ou grandes demais.');

  const requestId = crypto.randomUUID();
  const requestedProvider = normalizeProvider(rawProvider);
  const requestedModel = typeof rawModel === 'string' ? rawModel : '';
  const modelFor = (provider: ProviderId) => provider === requestedProvider ? rawModel : undefined;

  if (!providerEnabled(requestedProvider)) {
    const fallback = chooseFallback(requestedProvider);
    if (!fallback) throw new Error('Nenhum provedor de IA está disponível no servidor.');
    return executeProvider(
      fallback, modelFor(fallback), messages, systemPrompt, files,
      requestedProvider, requestedModel, requestId, true,
      `${requestedProvider} não está configurado; o OrbiDoc ativou ${fallback}.`,
    );
  }

  try {
    return await executeProvider(
      requestedProvider, modelFor(requestedProvider), messages, systemPrompt, files,
      requestedProvider, requestedModel, requestId, false,
    );
  } catch (error) {
    const fallback = chooseFallback(requestedProvider);
    if (!fallback) throw error;
    return executeProvider(
      fallback, modelFor(fallback), messages, systemPrompt, files,
      requestedProvider, requestedModel, requestId, true, compactError(error),
    );
  }
}

export async function streamChat(body: any, write: (payload: object) => void) {
  const { provider: rawProvider, model: rawModel, messages, systemPrompt, files } = body || {};
  if (!validateMessages(messages)) throw new Error('Mensagens inválidas ou grandes demais.');

  const requestId = crypto.randomUUID();
  const requestedProvider = normalizeProvider(rawProvider);
  const requestedModel = typeof rawModel === 'string' ? rawModel : '';
  const modelFor = (provider: ProviderId) => provider === requestedProvider ? rawModel : undefined;

  const streamProvider = async (provider: ProviderId, fallbackUsed: boolean, fallbackReason?: string) => {
    const providerModel = modelFor(provider);

    if (provider === 'gateway') {
      const desired = normalizeGatewayModel(providerModel);
      const { response, model, internalFallback } = await requestGateway(
        messages,
        desired,
        true,
        systemPrompt,
        files,
      );
      const meta: ProviderMeta = {
        requestId,
        requestedProvider,
        requestedModel,
        provider: 'gateway',
        model,
        fallbackUsed: fallbackUsed || internalFallback,
        fallbackReason: internalFallback
          ? `O modelo ${desired} não respondeu; o Gateway usou ${model}.`
          : fallbackReason,
      };
      await readCompatibleStream(response, meta, write);
      return;
    }

    if (provider === 'openrouter') {
      const desired = normalizeOpenRouterModel(providerModel);
      const { response, model, internalFallback } = await requestOpenRouter(messages, desired, true);
      const meta: ProviderMeta = {
        requestId,
        requestedProvider,
        requestedModel,
        provider: 'openrouter',
        model,
        fallbackUsed: fallbackUsed || internalFallback,
        fallbackReason: internalFallback ? `O modelo ${desired} não respondeu; OpenRouter Auto foi usado.` : fallbackReason,
      };
      await readCompatibleStream(response, meta, write);
      return;
    }

    if (provider === 'groq') {
      const { response, model } = await requestGroq(messages, typeof providerModel === 'string' ? providerModel : '', true);
      const meta: ProviderMeta = {
        requestId,
        requestedProvider,
        requestedModel,
        provider: 'groq',
        model,
        fallbackUsed,
        fallbackReason,
      };
      await readCompatibleStream(response, meta, write);
      return;
    }

    const ai = getGeminiClient();
    if (!ai) throw new Error('Gemini não está configurado.');
    const model = normalizeGeminiModel(providerModel);
    const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
    write({ meta: { requestId, requestedProvider, requestedModel, provider: 'gemini', model, fallbackUsed, fallbackReason } satisfies ProviderMeta });
    const response = await ai.models.generateContentStream({ model, contents, config: { systemInstruction } });
    for await (const chunk of response) {
      if (chunk.text) write({ chunk: chunk.text });
    }
  };

  if (!providerEnabled(requestedProvider)) {
    const fallback = chooseFallback(requestedProvider);
    if (!fallback) throw new Error('Nenhum provedor de IA está disponível no servidor.');
    await streamProvider(fallback, true, `${requestedProvider} não está configurado; o OrbiDoc ativou ${fallback}.`);
    return requestId;
  }

  try {
    await streamProvider(requestedProvider, false);
  } catch (error) {
    const fallback = chooseFallback(requestedProvider);
    if (!fallback) throw error;
    await streamProvider(fallback, true, compactError(error));
  }
  return requestId;
}

export function getModelCatalog() {
  return [
    { id: 'gemini-3.6-flash', provider: 'gemini', label: 'Gemini 3.6 Flash · direto', enabled: providerEnabled('gemini'), recommended: true },
    { id: 'gemini-3.5-flash-lite', provider: 'gemini', label: 'Gemini 3.5 Flash-Lite · direto', enabled: providerEnabled('gemini') },
    { id: 'gemini-3.1-pro-preview', provider: 'gemini', label: 'Gemini 3.1 Pro · direto', enabled: providerEnabled('gemini'), preview: true },

    { id: GATEWAY_DEFAULT_MODEL, provider: 'gateway', label: 'Gemini 3.6 Flash · Vercel Gateway', enabled: providerEnabled('gateway'), recommended: true },
    { id: GATEWAY_ECONOMY_MODEL, provider: 'gateway', label: 'Gemini 3.5 Flash-Lite · Vercel Gateway', enabled: providerEnabled('gateway') },
    { id: 'openai/gpt-5.6-luna', provider: 'gateway', label: 'GPT-5.6 Luna · Vercel Gateway', enabled: providerEnabled('gateway'), recommended: true },
    { id: 'openai/gpt-5.6-terra', provider: 'gateway', label: 'GPT-5.6 Terra · Vercel Gateway', enabled: providerEnabled('gateway') },
    { id: GATEWAY_FREE_MODEL, provider: 'gateway', label: 'Ling 3.0 Flash · Gateway gratuito', enabled: providerEnabled('gateway') },

    { id: 'openrouter/auto', provider: 'openrouter', label: 'OpenRouter Auto · direto', enabled: providerEnabled('openrouter'), recommended: true },
    { id: 'openrouter/free', provider: 'openrouter', label: 'OpenRouter Free Router · direto', enabled: providerEnabled('openrouter') },

    { id: 'openai/gpt-oss-120b', provider: 'groq', label: 'Groq GPT-OSS 120B · direto', enabled: providerEnabled('groq'), recommended: true },
    { id: 'openai/gpt-oss-20b', provider: 'groq', label: 'Groq GPT-OSS 20B · direto', enabled: providerEnabled('groq') },
  ];
}

export function getHealth() {
  return {
    status: 'ok',
    app: 'OrbiDoc',
    ai: {
      gateway: providerEnabled('gateway'),
      gemini: providerEnabled('gemini'),
      openrouter: providerEnabled('openrouter'),
      groq: providerEnabled('groq'),
    },
    gatewayAuth: gatewayAuthMode(),
    defaults: {
      gateway: GATEWAY_DEFAULT_MODEL,
      gemini: GEMINI_DEFAULT_MODEL,
      openrouter: OPENROUTER_DEFAULT_MODEL,
      groq: GROQ_DEFAULT_MODEL,
    },
  };
}

async function probeHttp(url: string, headers: Record<string, string>) {
  try {
    const response = await fetchWithTimeout(url, { method: 'GET', headers }, PROVIDER_PROBE_TIMEOUT_MS);
    return { reachable: response.ok, status: response.status };
  } catch (error) {
    return { reachable: false, error: compactError(error) };
  }
}

export async function getProviderStatus() {
  const gatewayToken = getGatewayToken();
  const gateway = gatewayToken
    ? await probeHttp(`${AI_GATEWAY_URL}/models`, { Authorization: `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' })
    : { reachable: false, reason: 'not-configured' };

  const gemini = process.env.GEMINI_API_KEY
    ? await probeHttp('https://generativelanguage.googleapis.com/v1beta/models', {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      })
    : { reachable: false, reason: 'not-configured' };

  const openrouter = process.env.OPENROUTER_API_KEY
    ? await probeHttp('https://openrouter.ai/api/v1/models', {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      })
    : { reachable: false, reason: 'not-configured' };

  const groq = process.env.GROQ_API_KEY
    ? await probeHttp('https://api.groq.com/openai/v1/models', {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      })
    : { reachable: false, reason: 'not-configured' };

  return {
    status: 'ok',
    app: 'OrbiDoc',
    checkedAt: new Date().toISOString(),
    gatewayAuth: gatewayAuthMode(),
    providers: {
      gateway: { configured: providerEnabled('gateway'), ...gateway },
      gemini: { configured: providerEnabled('gemini'), ...gemini },
      openrouter: { configured: providerEnabled('openrouter'), ...openrouter },
      groq: { configured: providerEnabled('groq'), ...groq },
    },
  };
}

export async function generateImage(body: any) {
  const { prompt, width = 1024, height = 1024, model = 'flux' } = body || {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8_000) {
    throw new Error('Descrição de imagem inválida ou grande demais.');
  }

  const requestId = crypto.randomUUID();
  const cleanPrompt = prompt.trim();
  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: cleanPrompt,
        config: { responseModalities: ['IMAGE'] },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return { imageUrl: `data:${mimeType};base64,${part.inlineData.data}`, provider: 'gemini', model: 'gemini-3.1-flash-image', requestId, fallbackUsed: false };
        }
      }
    } catch {
      // Continue to public fallback.
    }
  }

  const safeWidth = Math.min(2048, Math.max(256, Number(width) || 1024));
  const safeHeight = Math.min(2048, Math.max(256, Number(height) || 1024));
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${safeWidth}&height=${safeHeight}&model=${encodeURIComponent(String(model))}&nologo=true&seed=${seed}`;
  const response = await fetchWithTimeout(url, { headers: { Accept: 'image/webp,image/apng,image/*,*/*;q=0.8' } }, 20_000);
  if (!response.ok) throw new Error('Nenhum gerador de imagens respondeu corretamente.');
  const bytes = await response.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return {
    imageUrl: `data:${contentType};base64,${base64}`,
    provider: 'pollinations',
    model: String(model),
    requestId,
    fallbackUsed: Boolean(ai),
    fallbackReason: ai ? 'Gemini Image não respondeu; gerador alternativo foi usado.' : undefined,
  };
}

export async function editImage(body: any) {
  const { image, prompt } = body || {};
  if (typeof image !== 'string' || !image || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Imagem e instrução de edição são obrigatórias.');
  }
  const ai = getGeminiClient();
  if (!ai) throw new Error('Edição de imagem requer GEMINI_API_KEY configurada no servidor.');

  let mimeType = 'image/jpeg';
  let base64Data = image;
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const requestId = crypto.randomUUID();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: { parts: [
      { inlineData: { data: base64Data, mimeType } },
      { text: `Edite a imagem conforme esta instrução, preservando coerência e qualidade: ${prompt.trim()}` },
    ] },
    config: { responseModalities: ['IMAGE'] },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      const outputMime = part.inlineData.mimeType || 'image/png';
      return { imageUrl: `data:${outputMime};base64,${part.inlineData.data}`, provider: 'gemini', model: 'gemini-3.1-flash-image', requestId };
    }
  }
  throw new Error('O modelo não retornou uma imagem editada.');
}
