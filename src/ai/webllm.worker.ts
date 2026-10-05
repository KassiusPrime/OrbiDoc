type WorkerRequest =
  | { type: 'generate'; id: number; model: string; messages: Array<{ role: 'system'|'user'|'assistant'; content: string }>; maxTokens?: number }
  | { type: 'cancel'; id: number };

let engine: any = null;
let loadedModel = '';

async function loadEngine(model: string) {
  if (engine && loadedModel === model) return engine;
  // WebLLM is intentionally loaded inside the worker so WebGPU generation never blocks React.
  // The official package supports CDN delivery; this keeps the browser-local runtime optional.
  // @ts-expect-error remote ESM module is intentionally runtime-loaded.
  const webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.85');
  engine = await webllm.CreateWebWorkerMLCEngine
    ? await webllm.CreateMLCEngine(model, {
        initProgressCallback: (progress: any) => {
          self.postMessage({ type: 'progress', progress: Number(progress?.progress || 0), text: String(progress?.text || '') });
        },
        appConfig: { cacheBackend: 'indexeddb', ...webllm.prebuiltAppConfig },
      })
    : null;
  if (!engine) throw new Error('WebLLM não pôde inicializar.');
  loadedModel = model;
  return engine;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== 'generate') return;
  try {
    const localEngine = await loadEngine(request.model);
    const stream = await localEngine.chat.completions.create({
      messages: request.messages,
      stream: true,
      temperature: 0.35,
      top_p: 0.9,
      max_tokens: request.maxTokens || 700,
    });
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) self.postMessage({ type: 'chunk', id: request.id, chunk: delta });
    }
    self.postMessage({ type: 'done', id: request.id });
  } catch (error) {
    self.postMessage({ type: 'error', id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
};
