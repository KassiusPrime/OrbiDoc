import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  // Initialize Gemini Client
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // Handler for AI Chat API routes (/api/chat and /api/chats)
  const handleChat = async (req: express.Request, res: express.Response) => {
    try {
      const { provider, model, messages } = req.body || {};
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Mensagens inválidas fornecidas." });
        return;
      }

      const ai = getGeminiClient();

      // Formulate prompt for Gemini
      const systemMsg = messages.find((m: any) => m.role === "system")?.content || "";
      const conversationHistory = messages
        .filter((m: any) => m.role !== "system")
        .map((m: any) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
        .join("\n\n");

      const fullPrompt = systemMsg 
        ? `${systemMsg}\n\n${conversationHistory}` 
        : conversationHistory;

      // Try OpenRouter if requested and key is present
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "deepseek/deepseek-chat",
              messages,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const answer = data.choices?.[0]?.message?.content;
            if (answer) {
              res.json({ answer, engine: provider });
              return;
            }
          }
        } catch (err: any) {
          console.warn("OpenRouter request failed, falling back to Gemini:", err.message);
        }
      }

      // Try Groq if requested and key is present
      if (provider === "groq" && process.env.GROQ_API_KEY) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "llama-3.1-70b-versatile",
              messages,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const answer = data.choices?.[0]?.message?.content;
            if (answer) {
              res.json({ answer, engine: provider });
              return;
            }
          }
        } catch (err: any) {
          console.warn("Groq request failed, falling back to Gemini:", err.message);
        }
      }

      // Fallback or Direct Gemini Handler
      if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fullPrompt || "Olá",
          config: {
            temperature: 0.7,
          },
        });

        const answer = response.text || "Sem resposta gerada pelo modelo.";
        res.json({ answer, engine: "gemini" });
        return;
      }

      // If no API key is available anywhere
      res.json({
        answer: "⚠️ O serviço de IA requer a configuração de uma chave de API (GEMINI_API_KEY, OPENROUTER_API_KEY ou GROQ_API_KEY).",
        engine: "none"
      });
    } catch (error: any) {
      console.error("Erro na rota de chat:", error);
      res.status(500).json({ error: error.message || "Erro interno ao processar requisição de IA." });
    }
  };

  // Handler for Image Generation (/api/generate-image)
  const handleImageGen = async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, width = 768, height = 768, model = "flux" } = req.body || {};
      if (!prompt || typeof prompt !== "string") {
        res.status(400).json({ error: "Descrição da imagem não fornecida." });
        return;
      }

      const cleanPrompt = prompt.trim();
      const ai = getGeminiClient();

      // Option 1: Try Imagen 3 if Gemini API key exists
      if (ai) {
        try {
          const response = await ai.models.generateImages({
            model: "imagen-3.0-generate-001",
            prompt: cleanPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
              aspectRatio: "1:1",
            },
          });

          const generatedImages = response.generatedImages;
          if (generatedImages && generatedImages.length > 0 && generatedImages[0].image?.imageBytes) {
            const base64Str = generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64Str}`;
            res.json({ imageUrl, provider: "imagen-3" });
            return;
          }
        } catch {
          // Silent fallback to Pollinations AI generator
        }
      }

      // Option 2: Pollinations AI with Flux model or standard model
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      const seed = Math.floor(Math.random() * 1000000);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const imgRes = await fetch(pollinationsUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const imageUrl = `data:${contentType};base64,${base64}`;
          res.json({ imageUrl, provider: "pollinations" });
          return;
        }
      } catch {
        // Fallback silently to direct stream URL if proxy fetch times out or encounters network issue
      }

      // Option 3: Direct Pollinations stream URL (never fails for browser client)
      res.json({ imageUrl: pollinationsUrl, provider: "pollinations-direct" });
    } catch (error: any) {
      console.error("Erro na geração de imagem:", error);
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.body?.prompt || 'art')}?width=768&height=768&nologo=true`;
      res.json({ imageUrl: fallbackUrl, provider: "fallback" });
    }
  };

  app.post("/api/chat", handleChat);
  app.post("/api/chats", handleChat);
  app.post("/api/generate-image", handleImageGen);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: 3000 },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
