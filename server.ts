import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 120_000;
const PROVIDER_TIMEOUT_MS = 30_000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 120;
const IMAGE_RATE_MAX_REQUESTS = 30;

type RateEntry = { count: number; resetAt: number };
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
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + RATE_WINDOW_MS }
      : existing;

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

function validateMessages(messages: unknown): messages is Array<{ role: string; content: string; files?: unknown[] }> {
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "12mb" }));

  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    return apiKey ? new GoogleGenAI({ apiKey }) : null;
  };

  const prepareGeminiPayload = (messages: any[], systemPromptOverride?: string, files?: any[]) => {
    let systemInstruction = systemPromptOverride ||
      "Você é o assistente do DocPlus+, especializado em análise documental e criação de conteúdo. Seja claro, preciso, preserve a formatação solicitada e não invente informações.";
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
        for (const file of message.files || files || []) {
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

    if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Olá" }] });
    return { systemInstruction, contents };
  };

  const handleChatStream = async (req: express.Request, res: express.Response) => {
    const { provider, model, messages, systemPrompt, files } = req.body || {};
    if (!validateMessages(messages)) {
      res.status(400).json({ error: "Mensagens inválidas ou grandes demais." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const writeSSE = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const finish = () => {
      res.write("data: [DONE]\n\n");
      res.end();
    };

    try {
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        try {
          const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "X-Title": "DocPlus+",
            },
            body: JSON.stringify({ model: model || "openai/gpt-4o", messages, stream: true }),
          });
          if (response.ok && response.body) {
            const reader = response.body.getReader();
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
                  if (delta) writeSSE({ chunk: delta, engine: "openrouter" });
                } catch { /* provider keepalive/non-JSON fragment */ }
              }
            }
            finish();
            return;
          }
        } catch (error: any) {
          console.warn("OpenRouter stream failed; using Gemini fallback:", error?.message);
        }
      }

      if (provider === "groq" && process.env.GROQ_API_KEY) {
        try {
          const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: model || "llama-3.3-70b-versatile", messages, stream: true }),
          });
          if (response.ok && response.body) {
            const reader = response.body.getReader();
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
                  if (delta) writeSSE({ chunk: delta, engine: "groq" });
                } catch { /* provider fragment */ }
              }
            }
            finish();
            return;
          }
        } catch (error: any) {
          console.warn("Groq stream failed; using Gemini fallback:", error?.message);
        }
      }

      const ai = getGeminiClient();
      if (!ai) {
        writeSSE({ error: "Nenhum provedor de IA está configurado no servidor." });
        finish();
        return;
      }

      const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
      const selectedModel = model === "gemini-3.1-pro-preview" ? "gemini-3.1-pro-preview" : "gemini-3.6-flash";
      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents,
        config: { systemInstruction, temperature: 0.7 },
      });
      for await (const chunk of responseStream) {
        if (chunk.text) writeSSE({ chunk: chunk.text, engine: "gemini" });
      }
      finish();
    } catch (error: any) {
      console.error("Chat stream error:", error);
      writeSSE({ error: error?.message || "Falha durante a resposta da IA." });
      finish();
    }
  };

  const handleChat = async (req: express.Request, res: express.Response) => {
    const { provider, model, messages, systemPrompt, files } = req.body || {};
    if (!validateMessages(messages)) {
      res.status(400).json({ error: "Mensagens inválidas ou grandes demais." });
      return;
    }

    try {
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        try {
          const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "X-Title": "DocPlus+",
            },
            body: JSON.stringify({ model: model || "openai/gpt-4o", messages }),
          });
          if (response.ok) {
            const data = await response.json();
            const answer = data.choices?.[0]?.message?.content;
            if (answer) {
              res.json({ answer, engine: "openrouter" });
              return;
            }
          }
        } catch (error: any) {
          console.warn("OpenRouter request failed; using Gemini fallback:", error?.message);
        }
      }

      if (provider === "groq" && process.env.GROQ_API_KEY) {
        try {
          const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: model || "llama-3.3-70b-versatile", messages }),
          });
          if (response.ok) {
            const data = await response.json();
            const answer = data.choices?.[0]?.message?.content;
            if (answer) {
              res.json({ answer, engine: "groq" });
              return;
            }
          }
        } catch (error: any) {
          console.warn("Groq request failed; using Gemini fallback:", error?.message);
        }
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: "Nenhum provedor de IA está configurado no servidor." });
        return;
      }

      const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
      const selectedModel = model === "gemini-3.1-pro-preview" ? "gemini-3.1-pro-preview" : "gemini-3.6-flash";
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: { systemInstruction, temperature: 0.7 },
      });
      res.json({ answer: response.text || "Sem resposta gerada pelo modelo.", engine: "gemini" });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error?.message || "Erro interno ao processar a requisição de IA." });
    }
  };

  const handleImageGen = async (req: express.Request, res: express.Response) => {
    const { prompt, width = 1024, height = 1024, model = "flux" } = req.body || {};
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8_000) {
      res.status(400).json({ error: "Descrição de imagem inválida ou grande demais." });
      return;
    }

    const cleanPrompt = prompt.trim();
    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: cleanPrompt,
          config: { responseModalities: ["IMAGE"] },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            res.json({ imageUrl: `data:${mimeType};base64,${part.inlineData.data}`, provider: "gemini-3.1-flash-image" });
            return;
          }
        }
      } catch (error: any) {
        console.warn("Gemini image generation failed; using fallback:", error?.message);
      }
    }

    const safeWidth = Math.min(2048, Math.max(256, Number(width) || 1024));
    const safeHeight = Math.min(2048, Math.max(256, Number(height) || 1024));
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const seed = Math.floor(Math.random() * 1_000_000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${safeWidth}&height=${safeHeight}&model=${encodeURIComponent(String(model))}&nologo=true&seed=${seed}`;

    try {
      const imageResponse = await fetchWithTimeout(pollinationsUrl, {
        headers: { Accept: "image/webp,image/apng,image/*,*/*;q=0.8" },
      }, 20_000);
      if (imageResponse.ok) {
        const bytes = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        res.json({ imageUrl: `data:${contentType};base64,${base64}`, provider: "pollinations" });
        return;
      }
    } catch (error: any) {
      console.warn("Image fallback failed:", error?.message);
    }

    res.status(502).json({ error: "Nenhum gerador de imagens respondeu corretamente." });
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
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: "Edição de imagem requer GEMINI_API_KEY configurada no servidor." });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: `Edite a imagem conforme esta instrução, preservando coerência e qualidade: ${prompt.trim()}` },
          ],
        },
        config: { responseModalities: ["IMAGE"] },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          const outputMime = part.inlineData.mimeType || "image/png";
          res.json({ imageUrl: `data:${outputMime};base64,${part.inlineData.data}`, provider: "gemini-3.1-flash-image" });
          return;
        }
      }
      res.status(502).json({ error: "O modelo não retornou uma imagem editada." });
    } catch (error: any) {
      console.error("Image edit error:", error);
      res.status(500).json({ error: error?.message || "Falha na edição da imagem." });
    }
  };

  app.post("/api/chat/stream", rateLimit(RATE_MAX_REQUESTS), handleChatStream);
  app.post("/api/chat", rateLimit(RATE_MAX_REQUESTS), handleChat);
  app.post("/api/chats", rateLimit(RATE_MAX_REQUESTS), handleChat);
  app.post("/api/generate-image", rateLimit(IMAGE_RATE_MAX_REQUESTS), handleImageGen);
  app.post("/api/edit-image", rateLimit(IMAGE_RATE_MAX_REQUESTS), handleImageEdit);

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      ai: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
      },
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DocPlus+ server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Fatal server startup error:", error);
  process.exitCode = 1;
});
