import crypto from 'node:crypto';
import { compactError, type ChatMessage } from './ai.js';

const WEB_TIMEOUT_MS = 60000;

type WebProvider = 'gemini' | 'groq' | 'openrouter';

type WebResult = {
  answer: string;
  requestId: string;
  requestedProvider: string;
  requestedModel: string;
  provider: WebProvider;
  model: string;
  routedModel?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  webSearch: true;
};

function apiKey(provider: WebProvider) {
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || '';
  if (provider === 'groq') return process.env.GROQ_API_KEY || '';
  return process.env.OPENROUTER_API_KEY || '';
}

function available(provider: WebProvider) {
  return Boolean(apiKey(provider));
}

function selectedProvider(raw: unknown): WebProvider {
  if ((raw === 'gemini' || raw === 'groq' || raw === 'openrouter') && available(raw)) return raw;
  const fallback = (['gemini', 'openrouter', 'groq'] as WebProvider[]).find(available);
  if (!fallback) throw new Error('Pesquisa na internet requer uma chave Gemini, OpenRouter ou Groq configurada.');
  return fallback;
}

function lastUserText(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return messages[index].content;
  }
  return '';
}

function flatten(messages: ChatMessage[]) {
  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n');
}

async function fetchTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEB_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sourceList(entries: Array<{ title?: string; url?: string }>) {
  const unique = new Map<string, string>();
  for (const entry of entries) {
    const url = String(entry.url || '').trim();
    if (!/^https?:\/\//i.test(url) || unique.has(url)) continue;
    unique.set(url, String(entry.title || url).trim() || url);
  }
  if (!unique.size) return '';
  return `\n\n### Fontes\n${[...unique].slice(0, 10).map(([url, title]) => `- [${title}](${url})`).join('\n')}`;
}

function parseGemini(root: any) {
  let answer = String(root?.output_text || '').trim();
  const sources: Array<{ title?: string; url?: string }> = [];
  for (const step of Array.isArray(root?.steps) ? root.steps : []) {
    if (step?.type !== 'model_output') continue;
    for (const block of Array.isArray(step?.content) ? step.content : []) {
      if (block?.type !== 'text') continue;
      if (!answer && typeof block?.text === 'string') answer = block.text.trim();
      for (const annotation of Array.isArray(block?.annotations) ? block.annotations : []) {
        if (annotation?.type === 'url_citation') sources.push({ title: annotation.title, url: annotation.url });
      }
    }
  }
  return `${answer}${sourceList(sources)}`.trim();
}

function parseCompatible(root: any) {
  const message = root?.choices?.[0]?.message || {};
  let answer = typeof message.content === 'string' ? message.content.trim() : '';
  const sources: Array<{ title?: string; url?: string }> = [];
  for (const annotation of Array.isArray(message.annotations) ? message.annotations : []) {
    const citation = annotation?.url_citation || annotation;
    if (citation?.url) sources.push({ title: citation.title, url: citation.url });
  }
  if (!sources.length && Array.isArray(root?.citations)) {
    for (const citation of root.citations) if (citation?.url) sources.push({ title: citation.title, url: citation.url });
  }
  answer += sourceList(sources);
  return answer.trim();
}

async function geminiSearch(messages: ChatMessage[], model: string) {
  const key = apiKey('gemini');
  const requestedModel = model && !model.includes('/') ? model : 'gemini-3.6-flash';
  const response = await fetchTimeout('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      model: requestedModel,
      input: flatten(messages),
      tools: [{ type: 'google_search' }],
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini Search ${response.status}: ${text.slice(0, 260)}`);
  const root = JSON.parse(text || '{}');
  const answer = parseGemini(root);
  if (!answer) throw new Error('Gemini Search não retornou conteúdo.');
  return { answer, model: requestedModel, routedModel: requestedModel };
}

async function groqSearch(messages: ChatMessage[]) {
  const model = 'groq/compound-mini';
  const response = await fetchTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey('groq')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      citation_options: 'enabled',
      compound_custom: { tools: { enabled_tools: ['web_search', 'visit_website'] } },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Groq Web Search ${response.status}: ${text.slice(0, 260)}`);
  const root = JSON.parse(text || '{}');
  const answer = parseCompatible(root);
  if (!answer) throw new Error('Groq Web Search não retornou conteúdo.');
  return { answer, model, routedModel: root?.model || model };
}

async function openRouterSearch(messages: ChatMessage[], model: string) {
  const requestedModel = model && !model.startsWith('openrouter/') ? model : 'openrouter/auto';
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${apiKey('openrouter')}`,
    'Content-Type': 'application/json',
    'X-Title': 'OrbiDoc',
  };
  const base = { model: requestedModel, messages, temperature: 0.35 };
  let response = await fetchTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...base,
      tools: [
        { type: 'openrouter:web_search', parameters: { max_results: 5, max_total_results: 10 } },
        { type: 'openrouter:web_fetch', parameters: { engine: 'openrouter', max_content_tokens: 12000 } },
      ],
    }),
  });
  let text = await response.text();
  if (!response.ok) {
    response = await fetchTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...base, plugins: [{ id: 'web', max_results: 5 }] }),
    });
    text = await response.text();
  }
  if (!response.ok) throw new Error(`OpenRouter Web Search ${response.status}: ${text.slice(0, 260)}`);
  const root = JSON.parse(text || '{}');
  const answer = parseCompatible(root);
  if (!answer) throw new Error('OpenRouter Web Search não retornou conteúdo.');
  return { answer, model: requestedModel, routedModel: root?.model || requestedModel };
}

export async function runWebGroundedChat(body: any): Promise<WebResult> {
  const messages = Array.isArray(body?.messages) ? body.messages as ChatMessage[] : [];
  if (!messages.length) throw new Error('Pesquisa na internet recebeu uma conversa vazia.');
  const requestedProvider = String(body?.provider || '');
  const requestedModel = String(body?.model || '');
  const provider = selectedProvider(body?.provider);
  const requestId = crypto.randomUUID();
  const currentDate = new Date().toISOString().slice(0, 10);
  const enriched: ChatMessage[] = [
    {
      role: 'system',
      content: `Data atual: ${currentDate}. Esta resposta possui pesquisa web. Confirme fatos recentes na web, prefira fontes oficiais/primárias, diferencie anúncio de lançamento e cite links verificáveis. Pergunta principal: ${lastUserText(messages).slice(0, 500)}`,
    },
    ...messages,
  ];

  const result = provider === 'gemini'
    ? await geminiSearch(enriched, requestedModel)
    : provider === 'groq'
      ? await groqSearch(enriched)
      : await openRouterSearch(enriched, requestedModel);

  return {
    answer: result.answer,
    requestId,
    requestedProvider,
    requestedModel,
    provider,
    model: result.model,
    routedModel: result.routedModel,
    fallbackUsed: provider !== requestedProvider,
    fallbackReason: provider !== requestedProvider ? `Pesquisa web roteada para ${provider}, que possui ferramenta de internet disponível.` : undefined,
    webSearch: true,
  };
}

export async function streamWebGroundedChat(body: any, write: (payload: object) => void) {
  try {
    const result = await runWebGroundedChat(body);
    const { answer, ...meta } = result;
    write({ meta });
    write({ chunk: answer });
    return result.requestId;
  } catch (error) {
    throw new Error(compactError(error));
  }
}
