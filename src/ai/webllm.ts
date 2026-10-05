type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type WebLLMEvent =
  | { type: 'chunk'; id: number; chunk: string }
  | { type: 'done'; id: number }
  | { type: 'progress'; progress: number; text: string }
  | { type: 'error'; id: number; error: string };

const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
let worker: Worker | null = null;
let sequence = 0;
let supported: boolean | null = null;
const pending = new Map<number, { onChunk: (chunk: string) => void; resolve: () => void; reject: (error: Error) => void; signal?: AbortSignal }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WebLLMEvent>) => {
      const data = event.data;
      if (data.type === 'progress') {
        window.dispatchEvent(new CustomEvent('orbit:webllm-progress', { detail: data }));
        return;
      }
      if (data.type === 'error' || data.type === 'done' || data.type === 'chunk') {
        const item = pending.get(data.id);
        if (!item) return;
        if (data.type === 'chunk') item.onChunk(data.chunk);
        if (data.type === 'done') { pending.delete(data.id); item.resolve(); }
        if (data.type === 'error') { pending.delete(data.id); item.reject(new Error(data.error)); }
      }
    };
    worker.onerror = () => {
      for (const item of pending.values()) item.reject(new Error('WebLLM não pôde executar no navegador.'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export function webllmModel(): string { return DEFAULT_MODEL; }

export function webllmSupported(): boolean {
  if (supported !== null) return supported;
  supported = typeof window !== 'undefined' && 'gpu' in navigator;
  return supported;
}

export async function streamWebLLM(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!webllmSupported()) throw new Error('WebGPU indisponível neste navegador.');
  const id = ++sequence;
  const promise = new Promise<void>((resolve, reject) => pending.set(id, { onChunk, resolve, reject, signal }));
  const onAbort = () => {
    pending.delete(id);
    try { worker?.postMessage({ type: 'cancel', id }); } catch { /* best effort */ }
    reject(new DOMException('Operação cancelada.', 'AbortError'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    getWorker().postMessage({ type: 'generate', id, model: DEFAULT_MODEL, messages });
    await promise;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
