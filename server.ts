import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

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

  // Helper to extract system prompt and formatted messages for Gemini
  const prepareGeminiPayload = (messages: any[], systemPromptOverride?: string, files?: any[]) => {
    let systemInstruction = systemPromptOverride || "Você é o assistente inteligente do DocuTools Pro, especializado em documentos, análise de texto, programação, tradução e respostas detalhadas. Responda sempre em português de forma clara, estruturada e usando Markdown elegante.";
    
    const geminiContents: any[] = [];
    
    for (const m of messages) {
      if (!m || !m.content) continue;
      
      if (m.role === "system") {
        systemInstruction = m.content;
        continue;
      }

      const role = m.role === "assistant" ? "model" : "user";
      const parts: any[] = [];

      // Add attached images if present in user message
      if (role === "user" && (m.files || files)) {
        const attachedFiles = m.files || files;
        for (const f of attachedFiles) {
          if (f.preview && f.preview.startsWith("data:image/")) {
            const matches = f.preview.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              });
            }
          }
        }
      }

      parts.push({ text: String(m.content) });

      if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
        geminiContents[geminiContents.length - 1].parts.push(...parts);
      } else {
        geminiContents.push({ role, parts });
      }
    }

    if (geminiContents.length === 0) {
      geminiContents.push({ role: "user", parts: [{ text: "Olá! Como você pode me ajudar hoje?" }] });
    }

    return { systemInstruction, contents: geminiContents };
  };

  // SSE Stream Handler for AI Chat (/api/chat/stream)
  const handleChatStream = async (req: express.Request, res: express.Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const writeSSE = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { provider, model, messages, systemPrompt, files } = req.body || {};
      if (!messages || !Array.isArray(messages)) {
        writeSSE({ error: "Mensagens inválidas fornecidas." });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const ai = getGeminiClient();

      // OpenRouter Stream
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://docutools.app",
              "X-Title": "DocuTools Pro",
            },
            body: JSON.stringify({
              model: model || "openai/gpt-4o",
              messages,
              stream: true,
            }),
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
                const trimmed = line.trim();
                if (trimmed.startsWith("data: ")) {
                  const dataStr = trimmed.slice(6);
                  if (dataStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      writeSSE({ chunk: delta, engine: provider });
                    }
                  } catch {}
                }
              }
            }
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        } catch (err: any) {
          console.warn("OpenRouter stream failed, falling back to Gemini:", err.message);
        }
      }

      // Groq Stream
      if (provider === "groq" && process.env.GROQ_API_KEY) {
        try {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "llama-3.3-70b-versatile",
              messages,
              stream: true,
            }),
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
                const trimmed = line.trim();
                if (trimmed.startsWith("data: ")) {
                  const dataStr = trimmed.slice(6);
                  if (dataStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      writeSSE({ chunk: delta, engine: provider });
                    }
                  } catch {}
                }
              }
            }
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        } catch (err: any) {
          console.warn("Groq stream failed, falling back to Gemini:", err.message);
        }
      }

      // Gemini Streaming (Default / Primary)
      if (ai) {
        const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
        const selectedModel = model === "gemini-3.1-pro-preview" ? "gemini-3.1-pro-preview" : "gemini-3.6-flash";

        const responseStream = await ai.models.generateContentStream({
          model: selectedModel,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            writeSSE({ chunk: chunk.text, engine: "gemini" });
          }
        }

        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // No Key Available
      writeSSE({ chunk: "⚠️ Nenhuma chave de API configurada para o serviço de IA. Adicione GEMINI_API_KEY no arquivo .env." });
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Erro no streaming do chat:", error);
      writeSSE({ error: error.message || "Erro durante transmissão de resposta da IA." });
      res.write("data: [DONE]\n\n");
      res.end();
    }
  };

  // Handler for AI Chat API routes (/api/chat and /api/chats)
  const handleChat = async (req: express.Request, res: express.Response) => {
    try {
      const { provider, model, messages, systemPrompt, files } = req.body || {};
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Mensagens inválidas fornecidas." });
        return;
      }

      const ai = getGeminiClient();

      // Try OpenRouter if requested and key is present
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://docutools.app",
              "X-Title": "DocuTools Pro",
            },
            body: JSON.stringify({
              model: model || "openai/gpt-4o",
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
              model: model || "llama-3.3-70b-versatile",
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
        const { systemInstruction, contents } = prepareGeminiPayload(messages, systemPrompt, files);
        const selectedModel = model === "gemini-3.1-pro-preview" ? "gemini-3.1-pro-preview" : "gemini-3.6-flash";

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: {
            systemInstruction,
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
        // Fallback silently
      }

      res.json({ imageUrl: pollinationsUrl, provider: "pollinations-direct" });
    } catch (error: any) {
      console.error("Erro na geração de imagem:", error);
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.body?.prompt || 'art')}?width=768&height=768&nologo=true`;
      res.json({ imageUrl: fallbackUrl, provider: "fallback" });
    }
  };

  app.post("/api/chat/stream", handleChatStream);
  app.post("/api/chat", handleChat);
  app.post("/api/chats", handleChat);
  app.post("/api/generate-image", handleImageGen);

  // Handler for AI Image Editing (/api/edit-image)
  app.post("/api/edit-image", async (req: express.Request, res: express.Response) => {
    try {
      const { image, prompt } = req.body || {};
      if (!image || !prompt) {
        res.status(400).json({ error: "Imagem e instrução de edição são obrigatórias." });
        return;
      }

      const ai = getGeminiClient();
      
      let mimeType = "image/jpeg";
      let base64Data = image;

      if (typeof image === "string" && image.startsWith("data:")) {
        const matches = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-image",
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                  },
                },
                {
                  text: `Sua tarefa é modificar e editar a imagem fornecida de acordo com este comando do usuário: "${prompt}". Retorne a imagem editada com alta qualidade mantendo a coerência visual.`,
                },
              ],
            },
          });

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                const editedUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
                res.json({ imageUrl: editedUrl, provider: "gemini-image-editing" });
                return;
              }
            }
          }
        } catch (err: any) {
          console.warn("Gemini Image Editing fallback to Pollinations:", err.message);
        }
      }

      // Fallback generator
      const seed = Math.floor(Math.random() * 1000000);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ", professional edit, ultra high quality, 8k")}?width=800&height=800&model=flux&nologo=true&seed=${seed}`;
      res.json({ imageUrl: pollinationsUrl, provider: "pollinations-edit-fallback" });
    } catch (error: any) {
      console.error("Erro na edição de imagem:", error);
      res.status(500).json({ error: error.message || "Falha na edição da imagem." });
    }
  });

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
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

