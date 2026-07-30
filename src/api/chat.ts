const CLIENT_AI_TIMEOUT_MS = 30000;
const CHAT_API_ENDPOINT = '/api/chat';
const CHAT_STREAM_ENDPOINT = '/api/chat/stream';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function parseApiResponse(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function sendToVercel(
  provider: string,
  model: string,
  messages: AiMessage[],
  systemPrompt?: string,
  files?: any[]
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_AI_TIMEOUT_MS);

  try {
    const response = await fetch(CHAT_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages, systemPrompt, files }),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = parseApiResponse(text);

    if (!response.ok) {
      throw new Error(data.error || `Erro no servidor: ${response.status}`);
    }

    return data.answer || data.text || '';
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo limite ao aguardar a IA. Tente uma mensagem menor ou outro modelo.');
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
  }
) {
  const response = await fetch(CHAT_STREAM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      messages,
      systemPrompt: options?.systemPrompt,
      files: options?.files,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    const data = parseApiResponse(text);
    throw new Error(data.error || `Erro no servidor (${response.status})`);
  }

  if (!response.body) {
    throw new Error('Resposta sem corpo de dados.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.chunk) {
          onChunk(parsed.chunk);
        } else if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch (e: any) {
        if (e.message !== 'Unexpected end of JSON input') {
          // ignore chunk parse artifacts
        }
      }
    }
  }
}
