import { isOrbiDocNativeRuntime } from './nativeRuntime';

export type NativeAiProvider = 'gemini' | 'groq' | 'openrouter';

export type NativeAiModel = {
  id: string;
  provider: NativeAiProvider;
  label: string;
  enabled: boolean;
  recommended?: boolean;
};

type NativePlugin = {
  getAiStatus: () => Promise<{ providers?: Array<{ provider: NativeAiProvider; configured: boolean }> }>;
  setAiKey: (options: { provider: NativeAiProvider; apiKey: string }) => Promise<{ configured: boolean }>;
  clearAiKey: (options: { provider: NativeAiProvider }) => Promise<void>;
  listAiModels: (options: { provider: NativeAiProvider }) => Promise<{ models?: Array<{ id: string; label?: string }> }>;
  aiComplete: (options: { provider: NativeAiProvider; model: string; messages: Array<{ role: string; content: string }> }) => Promise<{ text?: string; provider?: string; model?: string }>;
  saveBase64File: (options: { fileName: string; mimeType: string; dataBase64: string }) => Promise<{ uri?: string; fileName?: string }>;
  downloadUrl: (options: { url: string; fileName?: string; mimeType?: string }) => Promise<{ uri?: string; fileName?: string }>;
  openUri: (options: { uri: string; mimeType?: string }) => Promise<void>;
  consumeOpenFile: () => Promise<{ available?: boolean; name?: string; mimeType?: string; dataBase64?: string }>;
};

const PROVIDERS: Array<{ provider: NativeAiProvider; label: string }> = [
  { provider: 'gemini', label: 'Google Gemini' },
  { provider: 'groq', label: 'Groq' },
  { provider: 'openrouter', label: 'OpenRouter' },
];

function plugin(): NativePlugin | null {
  if (!isOrbiDocNativeRuntime()) return null;
  return ((window as any).Capacitor?.Plugins?.OrbiDocNative || null) as NativePlugin | null;
}

export function isNativeBridgeAvailable() {
  return Boolean(plugin());
}

export async function getNativeAiStatus() {
  const bridge = plugin();
  if (!bridge) return PROVIDERS.map((item) => ({ ...item, configured: false }));
  const result = await bridge.getAiStatus();
  const status = new Map((result.providers || []).map((item) => [item.provider, Boolean(item.configured)]));
  return PROVIDERS.map((item) => ({ ...item, configured: status.get(item.provider) || false }));
}

export async function setNativeAiKey(provider: NativeAiProvider, apiKey: string) {
  const bridge = plugin();
  if (!bridge) throw new Error('A ponte nativa de IA não está disponível nesta instalação.');
  const key = apiKey.trim();
  if (key.length < 10) throw new Error('Informe uma chave de API válida.');
  await bridge.setAiKey({ provider, apiKey: key });
  return listNativeAiModels(provider);
}

export async function clearNativeAiKey(provider: NativeAiProvider) {
  const bridge = plugin();
  if (!bridge) return;
  await bridge.clearAiKey({ provider });
}

export async function listNativeAiModels(provider: NativeAiProvider): Promise<NativeAiModel[]> {
  const bridge = plugin();
  if (!bridge) return [];
  const result = await bridge.listAiModels({ provider });
  const models = (result.models || [])
    .filter((model) => model?.id)
    .filter((model) => !/embedding|embed|whisper|tts|speech|guard|moderation/i.test(model.id));
  return models.slice(0, 120).map((model, index) => ({
    id: model.id,
    provider,
    label: model.label || model.id,
    enabled: true,
    recommended: index === 0,
  }));
}

export async function getNativeAiCatalog(): Promise<NativeAiModel[]> {
  const status = await getNativeAiStatus();
  const configured = status.filter((item) => item.configured);
  const groups = await Promise.all(configured.map(async ({ provider }) => {
    try {
      return await listNativeAiModels(provider);
    } catch {
      return [];
    }
  }));
  const models = groups.flat();
  if (models.length) {
    models.forEach((model, index) => { model.recommended = index === 0; });
  }
  return models;
}

export async function nativeAiComplete(provider: string, model: string, messages: Array<{ role: string; content: string }>) {
  const bridge = plugin();
  if (!bridge) throw new Error('A ponte nativa de IA não está disponível.');
  if (!['gemini', 'groq', 'openrouter'].includes(provider)) throw new Error(`Provedor não suportado no modo nativo: ${provider}`);
  const result = await bridge.aiComplete({ provider: provider as NativeAiProvider, model, messages });
  const text = String(result.text || '').trim();
  if (!text) throw new Error('O provedor não retornou conteúdo.');
  return { text, provider: result.provider || provider, model: result.model || model };
}

function responseJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function pathnameOf(input: RequestInfo | URL) {
  try {
    if (input instanceof Request) return new URL(input.url, window.location.href).pathname;
    return new URL(String(input), window.location.href).pathname;
  } catch {
    return String(input);
  }
}

async function bodyOf(init?: RequestInit) {
  if (!init?.body) return {} as any;
  if (typeof init.body === 'string') {
    try { return JSON.parse(init.body); } catch { return {}; }
  }
  return {} as any;
}

function rewriteNativeAiCopy() {
  const candidates = Array.from(document.querySelectorAll('span'));
  for (const element of candidates) {
    const text = element.textContent || '';
    if (!text.includes('Configure pelo menos uma credencial segura no servidor')) continue;
    element.innerHTML = '<strong>Nenhum provedor de IA está conectado neste aparelho.</strong> Toque em “Conectar IA” e informe sua própria chave Gemini, Groq ou OpenRouter. A chave fica protegida pelo Android Keystore e as chamadas vão direto ao provedor, sem passar pela Vercel.';
  }
}

export function installNativeAiApiBridge() {
  if (!isOrbiDocNativeRuntime() || !plugin()) return false;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathnameOf(input);
    if (path === '/api/ai/models') {
      try {
        return responseJson({ models: await getNativeAiCatalog(), native: true });
      } catch (error: any) {
        return responseJson({ models: [], native: true, error: error?.message || 'Falha ao carregar modelos nativos.' });
      }
    }

    if (path === '/api/chat' || path === '/api/chat/stream') {
      const body = await bodyOf(init);
      try {
        const result = await nativeAiComplete(body.provider, body.model, Array.isArray(body.messages) ? body.messages : []);
        const meta = {
          requestedProvider: body.provider,
          requestedModel: body.model,
          provider: result.provider,
          model: result.model,
          routedModel: result.model,
          fallbackUsed: false,
        };
        if (path.endsWith('/stream')) {
          const sse = `data: ${JSON.stringify({ meta })}\n\ndata: ${JSON.stringify({ chunk: result.text })}\n\ndata: [DONE]\n\n`;
          return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
        }
        return responseJson({ answer: result.text, ...meta });
      } catch (error: any) {
        return responseJson({ error: error?.message || 'Falha na IA nativa.' }, 502);
      }
    }

    return originalFetch(input as any, init);
  }) as typeof window.fetch;

  const observer = new MutationObserver(rewriteNativeAiCopy);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  window.setTimeout(rewriteNativeAiCopy, 0);
  return true;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

export async function saveNativeBlob(blob: Blob, fileName: string) {
  const bridge = plugin();
  if (!bridge) throw new Error('Downloads nativos indisponíveis.');
  const dataBase64 = arrayBufferToBase64(await blob.arrayBuffer());
  const result = await bridge.saveBase64File({
    fileName: fileName || 'arquivo',
    mimeType: blob.type || 'application/octet-stream',
    dataBase64,
  });
  window.dispatchEvent(new CustomEvent('orbidoc:native-download', { detail: result }));
  return result;
}

export async function downloadNativeUrl(url: string, fileName?: string, mimeType?: string) {
  const bridge = plugin();
  if (!bridge) throw new Error('Downloads nativos indisponíveis.');
  const result = await bridge.downloadUrl({ url, fileName, mimeType });
  window.dispatchEvent(new CustomEvent('orbidoc:native-download', { detail: result }));
  return result;
}

export async function openNativeUri(uri: string, mimeType?: string) {
  const bridge = plugin();
  if (!bridge) return;
  await bridge.openUri({ uri, mimeType });
}

type LaunchConsumer = (params: { files: Array<{ name: string; getFile: () => Promise<File> }> }) => void;
let launchConsumer: LaunchConsumer | null = null;
let drainingOpenFile = false;

async function drainPendingOpenFile() {
  if (!launchConsumer || drainingOpenFile) return;
  const bridge = plugin();
  if (!bridge) return;
  drainingOpenFile = true;
  try {
    const result = await bridge.consumeOpenFile();
    if (!result.available || !result.dataBase64) return;
    const binary = atob(result.dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], result.name || 'arquivo', { type: result.mimeType || 'application/octet-stream' });
    launchConsumer({ files: [{ name: file.name, getFile: async () => file }] });
  } catch (error) {
    console.error('Falha ao abrir arquivo recebido pelo Android:', error);
  } finally {
    drainingOpenFile = false;
  }
}

export function installNativeFileOpenBridge() {
  if (!isOrbiDocNativeRuntime() || !plugin()) return false;
  const target = window as any;
  if (!target.launchQueue) {
    target.launchQueue = {
      setConsumer(consumer: LaunchConsumer) {
        launchConsumer = consumer;
        void drainPendingOpenFile();
      },
    };
  }
  const drain = () => void drainPendingOpenFile();
  window.addEventListener('focus', drain);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) drain(); });
  window.setInterval(drain, 1800);
  return true;
}
