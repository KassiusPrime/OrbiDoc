import { orbitApiUrl } from '../lib/orbitApiOrigin';

const CLIENT_AI_TIMEOUT_MS = 70_000;

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRuntimeMeta {
  requestId?: string;
  assistant?: 'Nexus AI';
  strategy?: 'fast' | 'coding' | 'deep' | 'web';
  freeOnly?: boolean;
  fallbackUsed?: boolean;
  webSearch?: boolean;
  webEngine?: 'tavily-free';
  orchestrated?: boolean;
  agentsUsed?: number;
}

const RUNTIME_EVENT = 'orbit:nexus-ai-runtime';

function parseApiResponse(text: string): Record<string, unknown> {
  try { return text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { return {}; }
}

function publishRuntime(meta?: AiRuntimeMeta): void {
  if (!meta || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AiRuntimeMeta>(RUNTIME_EVENT, { detail: meta }));
}

function publishFailure(webSearch?: boolean): void {
  publishRuntime({ assistant: 'Nexus AI', freeOnly: true, fallbackUsed: false, webSearch });
}

function requestBody(messages: AiMessage[], systemPrompt?: string, files?: unknown[], webSearch = false): string {
  return JSON.stringify({ messages, systemPrompt, files, webSearch, collaboration: 'auto' });
}

/** Compatibility façade: provider/model remain accepted for legacy callers but are never sent to the server. */
export async function sendToVercel(
  _provider: string,
  _model: string,
  messages: AiMessage[],
  systemPrompt?: string,
  files?: unknown[],
  webSearch = false,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_AI_TIMEOUT_MS);
  try {
    const response = await fetch(orbitApiUrl('/api/chat'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: requestBody(messages, systemPrompt, files, webSearch), signal: controller.signal,
    });
    const data = parseApiResponse(await response.text());
    if (!response.ok) { publishFailure(webSearch); throw new Error(String(data.error || `Erro no servidor: ${response.status}`)); }
    publishRuntime({
      requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
      assistant: 'Nexus AI',
      strategy: data.strategy === 'fast' || data.strategy === 'coding' || data.strategy === 'deep' || data.strategy === 'web' ? data.strategy : undefined,
      freeOnly: data.freeOnly === true,
      fallbackUsed: data.fallbackUsed === true,
      webSearch: data.webSearch === true,
      webEngine: data.webEngine === 'tavily-free' ? 'tavily-free' : undefined,
      orchestrated: data.orchestrated === true,
      agentsUsed: typeof data.agentsUsed === 'number' ? data.agentsUsed : undefined,
    });
    return String(data.answer || '');
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      publishFailure(webSearch); throw new Error('Tempo limite ao aguardar o Nexus AI. Tente novamente.');
    }
    throw error;
  } finally { window.clearTimeout(timeoutId); }
}

export async function sendToVercelStream(
  _provider: string,
  _model: string,
  messages: AiMessage[],
  onChunk: (chunk: string) => void,
  options?: { systemPrompt?: string; files?: unknown[]; signal?: AbortSignal; webSearch?: boolean },
): Promise<void> {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), CLIENT_AI_TIMEOUT_MS);
  const abortFromCaller = () => timeoutController.abort();
  options?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await fetch(orbitApiUrl('/api/chat/stream'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: requestBody(messages, options?.systemPrompt, options?.files, Boolean(options?.webSearch)),
      signal: timeoutController.signal,
    });
    if (!response.ok) {
      const data = parseApiResponse(await response.text());
      publishFailure(options?.webSearch); throw new Error(String(data.error || `Erro no servidor (${response.status})`));
    }
    if (!response.body) throw new Error('Resposta sem corpo de dados.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const processLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) return false;
      const payload = trimmed.slice(6).trim();
      if (!payload) return false;
      if (payload === '[DONE]') return true;
      let parsed: { error?: unknown; meta?: AiRuntimeMeta; chunk?: unknown };
      try { parsed = JSON.parse(payload) as typeof parsed; } catch { return false; }
      if (parsed.error) { publishFailure(options?.webSearch); throw new Error(String(parsed.error)); }
      if (parsed.meta) publishRuntime(parsed.meta);
      if (typeof parsed.chunk === 'string' && parsed.chunk) onChunk(parsed.chunk);
      return false;
    };
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) if (processLine(line)) return;
    }
    buffer += decoder.decode(); if (buffer.trim()) processLine(buffer);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (options?.signal?.aborted) throw error;
      publishFailure(options?.webSearch); throw new Error('Tempo limite durante a resposta em streaming do Nexus AI.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId); options?.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const AI_RUNTIME_EVENT = RUNTIME_EVENT;
