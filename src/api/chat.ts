const CLIENT_AI_TIMEOUT_MS = 70000;
const CHAT_API_ENDPOINT = '/api/chat';
const CHAT_STREAM_ENDPOINT = '/api/chat/stream';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRuntimeMeta {
  requestId?: string;
  requestedProvider?: string;
  requestedModel?: string;
  provider?: string;
  model?: string;
  routedModel?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  webSearch?: boolean;
}

const RUNTIME_EVENT = 'orbidoc:ai-runtime';

function parseApiResponse(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function publishRuntime(meta?: AiRuntimeMeta) {
  if (!meta || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AiRuntimeMeta>(RUNTIME_EVENT, { detail: meta }));
}

function publishFailure(error: unknown, provider: string, model: string, webSearch?: boolean) {
  const message = error instanceof Error ? error.message : String(error || 'Falha na IA');
  publishRuntime({
    requestedProvider: provider,
    requestedModel: model,
    provider,
    model,
    fallbackUsed: false,
    fallbackReason: message,
    webSearch,
  });
}

export async function sendToVercel(
  provider: string,
  model: string,
  messages: AiMessage[],
  systemPrompt?: string,
  files?: any[],
  webSearch = false,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_AI_TIMEOUT_MS);

  try {
    const response = await fetch(CHAT_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages, systemPrompt, files, webSearch }),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = parseApiResponse(text);
    if (!response.ok) {
      const error = new Error(data.error || `Erro no servidor: ${response.status}`);
      publishFailure(error, provider, model, webSearch);
      throw error;
    }

    publishRuntime({
      requestId: data.requestId,
      requestedProvider: data.requestedProvider || provider,
      requestedModel: data.requestedModel || model,
      provider: data.provider || data.engine || provider,
      model: data.model || model,
      routedModel: data.routedModel,
      fallbackUsed: Boolean(data.fallbackUsed),
      fallbackReason: data.fallbackReason,
      webSearch: Boolean(data.webSearch ?? webSearch),
    });

    return data.answer || data.text || '';
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Tempo limite ao aguardar a IA. Tente novamente ou desative a pesquisa na internet.');
      publishFailure(timeoutError, provider, model, webSearch);
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function sendToVercelStream(
  provider: string,
  model: string,
  messages: AiMessage[],
  onChunk: (chunk: string) => void,
  options?: {
    systemPrompt?: string;
    files?: any[];
    signal?: AbortSignal;
    webSearch?: boolean;
  },
) {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), CLIENT_AI_TIMEOUT_MS);
  const abortFromCaller = () => timeoutController.abort();
  options?.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(CHAT_STREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        messages,
        systemPrompt: options?.systemPrompt,
        files: options?.files,
        webSearch: Boolean(options?.webSearch),
      }),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const data = parseApiResponse(text);
      const error = new Error(data.error || `Erro no servidor (${response.status})`);
      publishFailure(error, provider, model, options?.webSearch);
      throw error;
    }
    if (!response.body) throw new Error('Resposta sem corpo de dados.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) return false;
      const payload = trimmed.slice(6).trim();
      if (!payload) return false;
      if (payload === '[DONE]') return true;

      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return false;
      }

      if (parsed.error) {
        const error = new Error(String(parsed.error));
        publishFailure(error, provider, model, options?.webSearch);
        throw error;
      }
      if (parsed.meta) publishRuntime(parsed.meta as AiRuntimeMeta);
      if (typeof parsed.chunk === 'string' && parsed.chunk) onChunk(parsed.chunk);
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (processLine(line)) return;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (options?.signal?.aborted) throw error;
      const timeoutError = new Error('Tempo limite durante a resposta em streaming da IA.');
      publishFailure(timeoutError, provider, model, options?.webSearch);
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    options?.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const AI_RUNTIME_EVENT = RUNTIME_EVENT;
