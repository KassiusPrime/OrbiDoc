import express from "express";
import path from "path";
import crypto from "node:crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 120_000;
const PROVIDER_TIMEOUT_MS = 35_000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 120;
const IMAGE_RATE_MAX_REQUESTS = 30;

const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
const GEMINI_ALLOWED_MODELS = new Set([
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
]);

const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const GROQ_ALLOWED_MODELS = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
]);

const OPENROUTER_DEFAULT_MODEL = "openrouter/auto";
const OPENROUTER_FALLBACK_MODEL = "openrouter/auto";

type ProviderId = "gemini" | "openrouter" | "groq";
type ChatMessage = { role: "system" | "user" | "assistant"; content: string; files?: unknown[] };
type RateEntry = { count: number; resetAt: number };
type ProviderMeta = {
  requestId: string;
  requestedProvider: string;
  requestedModel: string;
  provider: ProviderId;
  model: string;
  routedModel?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

const rateBuckets = new Map<string, RateEntry>();

function clientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (raw || req.ip || "unknown").trim();
}

function rateLimit(maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${clientIp(req)}:${req.path}`;
    const existing = rateBuckets.get(key);
    const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + RATE_WINDOW_MS } : existing;
    entry.count += 1;
    rateBuckets.set(key, entry);
    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    if (entry.count > maxRequests) {
      res.status(429).json({ error: "Muitas requisições. Aguarde alguns minutos e tente novamente." });
      return;
    }
    next();
  };
}

function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  let totalChars = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object") return false;
    const role = (message as any).role;
    const content = (message as any).content;
    if (!["system", "user", "assistant"].includes(role) || typeof content !== "string") return false;
    totalChars += content.length;
    if (totalChars > MAX_MESSAGE_CHARS) return false;
  }
  return true;
}

function normalizeProvider(value: unknown): ProviderId {
  if (value === "groq" || value === "openrouter") return value;
  return "gemini";
}

function normalizeGeminiModel(model: unknown) {
  return typeof model === "string" && GEMINI_ALLOWED_MODELS.has(model) ? model : GEMINI_DEFAULT_MODEL;
}

function normalizeGroqModel(model: unknown) {
  return typeof model === "string" && GROQ_ALLOWED_MODELS.has(model) ? model : GROQ_DEFAULT_MODEL;
}

function normalizeOpenRouterModel(model: unknown) {
  if (typeof model !== "string" || !model.trim()) return OPENROUTER_DEFAULT_MODEL;
  return model.trim().slice(0, 160);
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

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Falha desconhecida");
  return message.replace(/\s+/g, " ").slice(0, 260);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "12mb" }));

  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    return apiKey ? new GoogleGenAI({ apiKey }) : null;
  };

  const providerEnabled = (provider: ProviderId) => {
    if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
    if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
    return Boolean(process.env.OPENROUTER_API_KEY);
  };

  const prepareGeminiPayload = (messages: ChatMessage[], systemPromptOverride?: string, files?: any[]) => {
    let systemInstruction = systemPromptOverride ||
      "Você é o assistente do DocSwiss. Analise documentos, escreva, revise e explique com precisão. Preserve a formatação solicitada, deixe limitações explícitas e não invente fatos.";
    const contents: any[] = [];

    for (const message of messages) {
      if (!message?.content) continue;
      if (message.role === "system") {
        systemInstruction = message.content;
        continue;
      }
      const role = message.role === "assistant" ? "model" : "user";
      const parts: any[] = [];
      if (role === "user") {
        for (const file of (message.files as any[]) || files || []) {
          if (typeof file?.preview !== "string") continue;
          const match = file.preview.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
      parts.push({ text: String(message.content) });
      const previous = contents[contents.length - 1];
      if (previous?.role === role) previous.parts.push(...parts);
      else contents.push({ role, parts });
    }
    if (!contents.length) contents.push({ role: "user", parts: [{ text: "Olá" }] });
    return { systemInstruction, contents };
  };

  async function requestOpenRouter(messages: ChatMessage[], requestedModel: string, stream: boolean) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter não está configurado.");
    const models = requestedModel === OPENROUTER_FALLBACK_MODEL ? [requestedModel] : [requestedModel, OPENROUTER_FALLBACK_MODEL];
    let lastError = "OpenRouter não respondeu.";
    for (const model of models) {
      try {
        const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "DocSwiss" },
          body: JSON.stringify({ model, messages, stream }),
        });
        if (response.ok) return { response, model, internalFallback: model !== requestedModel };
        lastError = `OpenRouter ${response.status}: ${(await response.text()).slice(0, 180)}`;
      } catch (error) {
        lastError = compactError(error);
      }
    }
    throw new Error(lastError);
  }

  async function requestGroq(messages: ChatMessage[], model: string, stream: boolean) {
    if (!process.env.GROQ_API_KEY) throw new Error("Groq não está configurado.");
    const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream }),
    });
    if (!response.ok) throw new Error(`Groq ${response.status}: ${(await response.text()).slice(0, 180)}`);
    return response;
  }

  const chooseFallback = (requested: ProviderId): ProviderId | null => {
    const order: ProviderId[] = requested === "gemini" ? ["openrouter", "groq"] : ["gemini", "openrouter", "groq"];
    return order.find((provider) => provider !== requested && providerEnabled(provider)) || null;
  };

  const handleChatStream = async (req: express.Request, res: express.Response) => {
    const { provider: rawProvider, model: rawModel, messages, systemPrompt, files } = req.body || {};
    if (!validateMessages(messages)) {
      res.status(400).json({ error: "Mensagens inválidas ou grandes demais." });
      return;
    }

    const requestId = crypto.randomUUID();
    const requestedProvider = normalizeProvider(rawProvider);
    const requestedModel = typeof rawModel === "string" ? rawModel : "";
    let contentStarted = false;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-DocSwiss-Request-Id", requestId);
    res.flushHeaders?.();

    const writeSSE = (data: any) => {
      if (typeof data?.chunk === "string" && data.chunk.length) contentStarted = true;
      return res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const finish = () => { res.write("data: [DONE]\n\n"); res.end(); };
    const modelFor = (provider: ProviderId) => provider === requestedProvider ? rawModel : undefined;

    const streamProvider = async (provider: ProviderId, fallbackUsed: boolean, fallbackReason?: string) => {
      const providerModel = modelFor(provider);
      if (provider === "openrouter") {
        const desired = normalizeOpenRouterModel(providerModel);
        const { response, model, internalFallback } = await requestOpenRouter(messages, desired, true);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("OpenRouter retornou resposta sem stream.");
        const meta: ProviderMeta = {
          requestId, requestedProvider, requestedModel, provider: "openrouter", model,
          fallbackUsed: fallbackUsed || internalFallback,
          fallbackReason: internalFallback ? `O modelo ${desired} não respondeu; OpenRouter Auto foi usado.` : fallbackReason,
        };
        writeSSE({ meta });
        const decoder = new TextDecoder();
        let buffer = "";
        let routedModel = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed.model === "string" && parsed.model && parsed.model !== routedModel) {
                routedModel = parsed.model;
                writeSSE({ meta: { ...meta, routedModel } });
              }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) writeSSE({ chunk: delta });
            } catch { /* provider keepalive */ }
          }
        }
        return;
      }

      if (provider === "groq") {
        const model = normalizeGroqModel(providerModel);
        const response = await requestGroq(messages, model, true);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Groq retornou resposta sem stream.");
        writeSSE({ meta: { requestId, requestedProvider, requestedModel, provider: "groq", model, fallbackUsed, fallbackReason } satisfies ProviderMeta });
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) writeSSE({ chunk: delta });
            } catch { /* provider keepalive */ }
          }
        }
        return;
      }

      const ai = getGeminiClient();
      if (!ai) throw new Error("Gemini não está configurado.");
      const model = normalizeGeminiModel(providerModel);
      const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
      writeSSE({ meta: { requestId, requestedProvider, requestedModel, provider: "gemini", model, fallbackUsed, fallbackReason } satisfies ProviderMeta });
      const responseStream = await ai.models.generateContentStream({ model, contents, config: { systemInstruction } });
      for await (const chunk of responseStream) if (chunk.text) writeSSE({ chunk: chunk.text });
    };

    try {
      if (!providerEnabled(requestedProvider)) {
        const fallback = chooseFallback(requestedProvider);
        if (!fallback) throw new Error("Nenhum provedor de IA está configurado no servidor.");
        await streamProvider(fallback, true, `${requestedProvider} não está configurado no servidor.`);
      } else {
        try {
          await streamProvider(requestedProvider, false);
        } catch (error) {
          if (contentStarted) {
            writeSSE({ chunk: "\n\n> ⚠️ A conexão com o modelo foi interrompida. O DocSwiss não misturou a resposta com outro provedor; regenere para obter um resultado completo." });
          } else {
            const fallback = chooseFallback(requestedProvider);
            if (!fallback) throw error;
            await streamProvider(fallback, true, compactError(error));
          }
        }
      }
      finish();
    } catch (error) {
      console.error("Chat stream error", requestId, error);
      writeSSE({ error: compactError(error), requestId });
      finish();
    }
  };

  const handleChat = async (req: express.Request, res: express.Response) => {
    const { provider: rawProvider, model: rawModel, messages, systemPrompt, files } = req.body || {};
    if (!validateMessages(messages)) {
      res.status(400).json({ error: "Mensagens inválidas ou grandes demais." });
      return;
    }

    const requestId = crypto.randomUUID();
    const requestedProvider = normalizeProvider(rawProvider);
    const requestedModel = typeof rawModel === "string" ? rawModel : "";
    res.setHeader("X-DocSwiss-Request-Id", requestId);
    const modelFor = (provider: ProviderId) => provider === requestedProvider ? rawModel : undefined;

    const execute = async (provider: ProviderId, fallbackUsed: boolean, fallbackReason?: string) => {
      const providerModel = modelFor(provider);
      if (provider === "openrouter") {
        const desired = normalizeOpenRouterModel(providerModel);
        const { response, model, internalFallback } = await requestOpenRouter(messages, desired, false);
        const data: any = await response.json();
        const answer = data.choices?.[0]?.message?.content;
        if (!answer) throw new Error("OpenRouter não retornou conteúdo textual.");
        return {
          answer, requestId, requestedProvider, requestedModel, provider: "openrouter" as const, model,
          routedModel: typeof data.model === "string" ? data.model : undefined,
          fallbackUsed: fallbackUsed || internalFallback,
          fallbackReason: internalFallback ? `O modelo ${desired} não respondeu; OpenRouter Auto foi usado.` : fallbackReason,
        };
      }
      if (provider === "groq") {
        const model = normalizeGroqModel(providerModel);
        const response = await requestGroq(messages, model, false);
        const data: any = await response.json();
        const answer = data.choices?.[0]?.message?.content;
        if (!answer) throw new Error("Groq não retornou conteúdo textual.");
        return { answer, requestId, requestedProvider, requestedModel, provider: "groq" as const, model, fallbackUsed, fallbackReason };
      }
      const ai = getGeminiClient();
      if (!ai) throw new Error("Gemini não está configurado.");
      const model = normalizeGeminiModel(providerModel);
      const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
      const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
      return { answer: response.text || "Sem resposta gerada pelo modelo.", requestId, requestedProvider, requestedModel, provider: "gemini" as const, model, fallbackUsed, fallbackReason };
    };

    try {
      if (!providerEnabled(requestedProvider)) {
        const fallback = chooseFallback(requestedProvider);
        if (!fallback) {
          res.status(503).json({ error: "Nenhum provedor de IA está configurado no servidor.", requestId });
          return;
        }
        res.json(await execute(fallback, true, `${requestedProvider} não está configurado no servidor.`));
        return;
      }
      try {
        res.json(await execute(requestedProvider, false));
      } catch (error) {
        const fallback = chooseFallback(requestedProvider);
        if (!fallback) throw error;
        res.json(await execute(fallback, true, compactError(error)));
      }
    } catch (error) {
      console.error("Chat error", requestId, error);
      res.status(502).json({ error: compactError(error), requestId });
    }
  };

  const handleImageGen = async (req: express.Request, res: express.Response) => {
    const { prompt, width = 1024, height = 1024, model = "flux" } = req.body || {};
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8_000) {
      res.status(400).json({ error: "Descrição de imagem inválida ou grande demais." });
      return;
    }
    const requestId = crypto.randomUUID();
    const cleanPrompt = prompt.trim();
    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({ model: "gemini-3.1-flash-image", contents: cleanPrompt, config: { responseModalities: ["IMAGE"] } });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            res.json({ imageUrl: `data:${mimeType};base64,${part.inlineData.data}`, provider: "gemini", model: "gemini-3.1-flash-image", requestId, fallbackUsed: false });
            return;
          }
        }
      } catch (error) {
        console.warn("Gemini image generation failed", requestId, compactError(error));
      }
    }
    const safeWidth = Math.min(2048, Math.max(256, Number(width) || 1024));
    const safeHeight = Math.min(2048, Math.max(256, Number(height) || 1024));
    const seed = Math.floor(Math.random() * 1_000_000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${safeWidth}&height=${safeHeight}&model=${encodeURIComponent(String(model))}&nologo=true&seed=${seed}`;
    try {
      const imageResponse = await fetchWithTimeout(pollinationsUrl, { headers: { Accept: "image/webp,image/apng,image/*,*/*;q=0.8" } }, 20_000);
      if (imageResponse.ok) {
        const bytes = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        res.json({ imageUrl: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`, provider: "pollinations", model: String(model), requestId, fallbackUsed: Boolean(ai), fallbackReason: ai ? "Gemini Image não respondeu; gerador alternativo foi usado." : undefined });
        return;
      }
    } catch (error) {
      console.warn("Image fallback failed", requestId, compactError(error));
    }
    res.status(502).json({ error: "Nenhum gerador de imagens respondeu corretamente.", requestId });
  };

  const handleImageEdit = async (req: express.Request, res: express.Response) => {
    const { image, prompt } = req.body || {};
    if (typeof image !== "string" || !image || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Imagem e instrução de edição são obrigatórias." });
      return;
    }
    let mimeType = "image/jpeg";
    let base64Data = image;
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) { mimeType = match[1]; base64Data = match[2]; }
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: "Edição de imagem requer GEMINI_API_KEY configurada no servidor." });
      return;
    }
    const requestId = crypto.randomUUID();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: { parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: `Edite a imagem conforme esta instrução, preservando coerência e qualidade: ${prompt.trim()}` },
        ] },
        config: { responseModalities: ["IMAGE"] },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          const outputMime = part.inlineData.mimeType || "image/png";
          res.json({ imageUrl: `data:${outputMime};base64,${part.inlineData.data}`, provider: "gemini", model: "gemini-3.1-flash-image", requestId });
          return;
        }
      }
      res.status(502).json({ error: "O modelo não retornou uma imagem editada.", requestId });
    } catch (error) {
      console.error("Image edit error", requestId, error);
      res.status(502).json({ error: compactError(error), requestId });
    }
  };

  app.get("/api/ai/models", (_req, res) => {
    res.json({ models: [
      { id: "gemini-3.6-flash", provider: "gemini", label: "Gemini 3.6 Flash", enabled: providerEnabled("gemini"), recommended: true },
      { id: "gemini-3.5-flash-lite", provider: "gemini", label: "Gemini 3.5 Flash-Lite", enabled: providerEnabled("gemini") },
      { id: "gemini-3.1-pro-preview", provider: "gemini", label: "Gemini 3.1 Pro", enabled: providerEnabled("gemini"), preview: true },
      { id: "openrouter/auto", provider: "openrouter", label: "OpenRouter Auto", enabled: providerEnabled("openrouter"), recommended: true },
      { id: "openrouter/free", provider: "openrouter", label: "OpenRouter Free Router", enabled: providerEnabled("openrouter") },
      { id: "openai/gpt-oss-120b", provider: "groq", label: "Groq GPT-OSS 120B", enabled: providerEnabled("groq"), recommended: true },
      { id: "openai/gpt-oss-20b", provider: "groq", label: "Groq GPT-OSS 20B", enabled: providerEnabled("groq") },
    ] });
  });

  app.post("/api/chat/stream", rateLimit(RATE_MAX_REQUESTS), handleChatStream);
  app.post("/api/chat", rateLimit(RATE_MAX_REQUESTS), handleChat);
  app.post("/api/chats", rateLimit(RATE_MAX_REQUESTS), handleChat);
  app.post("/api/generate-image", rateLimit(IMAGE_RATE_MAX_REQUESTS), handleImageGen);
  app.post("/api/edit-image", rateLimit(IMAGE_RATE_MAX_REQUESTS), handleImageEdit);

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "DocSwiss",
      ai: { gemini: providerEnabled("gemini"), openrouter: providerEnabled("openrouter"), groq: providerEnabled("groq") },
      defaults: { gemini: GEMINI_DEFAULT_MODEL, openrouter: OPENROUTER_DEFAULT_MODEL, groq: GROQ_DEFAULT_MODEL },
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, host: "0.0.0.0" }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.use((_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`DocSwiss server listening on port ${PORT}`));
}

startServer().catch((error) => {
  console.error("Fatal server startup error:", error);
  process.exitCode = 1;
});
