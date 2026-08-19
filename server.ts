import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  compactError,
  editImage,
  generateImage,
  getHealth,
  getModelCatalog,
  getProviderStatus,
  runChat,
} from './api/_lib/ai.js';
import { streamChatSafely } from './api/_lib/aiSafeStream.js';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 120;
const IMAGE_RATE_MAX_REQUESTS = 30;

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

function clientIp(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (raw || req.ip || 'unknown').trim();
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

    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    if (entry.count > maxRequests) {
      res.status(429).json({ error: 'Muitas requisições. Aguarde alguns minutos e tente novamente.' });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/ai/models', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ models: getModelCatalog() });
  });

  app.get('/api/ai/status', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      res.json(await getProviderStatus());
    } catch (error) {
      res.status(502).json({ error: compactError(error) });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getHealth());
  });

  app.post('/api/chat/stream', rateLimit(RATE_MAX_REQUESTS), async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const write = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
    try {
      await streamChatSafely(req.body || {}, write);
    } catch (error) {
      write({ error: compactError(error) });
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  const chatHandler = async (req: express.Request, res: express.Response) => {
    try {
      const result = await runChat(req.body || {});
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-OrbiDoc-Request-Id', result.requestId);
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: compactError(error) });
    }
  };

  app.post('/api/chat', rateLimit(RATE_MAX_REQUESTS), chatHandler);
  app.post('/api/chats', rateLimit(RATE_MAX_REQUESTS), chatHandler);

  app.post('/api/generate-image', rateLimit(IMAGE_RATE_MAX_REQUESTS), async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await generateImage(req.body || {}));
    } catch (error) {
      res.status(502).json({ error: compactError(error) });
    }
  });

  app.post('/api/edit-image', rateLimit(IMAGE_RATE_MAX_REQUESTS), async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await editImage(req.body || {}));
    } catch (error) {
      res.status(502).json({ error: compactError(error) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`OrbiDoc server listening on port ${PORT}`));
}

startServer().catch((error) => {
  console.error('Fatal server startup error:', error);
  process.exitCode = 1;
});
