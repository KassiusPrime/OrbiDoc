import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { NEXUS_FREE_MODELS, nexusAI, type NexusBody } from './api/_lib/nexusAI.js';
import { nexusOrchestrator } from './api/_lib/nexusOrchestrator.js';
import { editImageResilient, enhanceImageResilient, generateImageResilient } from './api/_lib/imageRuntime.js';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 120;
const IMAGE_RATE_MAX_REQUESTS = 30;
const OAUTH_RATE_MAX_REQUESTS = 30;
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

function compactError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? 'Falha desconhecida'))
    .replace(/\s+/g, ' ')
    .slice(0, 420);
}

function clientIp(req: express.Request): string {
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

function requestHost(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-host'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(value || req.headers.host || '').trim();
}

function sameOriginRequest(req: express.Request): boolean {
  const origin = String(req.headers.origin || '').trim();
  const host = requestHost(req);
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validGitHubRedirect(req: express.Request, redirectUri: string): boolean {
  const host = requestHost(req);
  if (!host || !redirectUri) return false;
  try {
    const parsed = new URL(redirectUri);
    return parsed.host === host && parsed.pathname === '/auth/github' && /^https?:$/.test(parsed.protocol);
  } catch {
    return false;
  }
}

async function exchangeGitHubOAuth(req: express.Request, res: express.Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: 'Origem não autorizada para OAuth GitHub.' });
    return;
  }

  const clientId = String(process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GITHUB_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: 'GitHub App OAuth ainda não foi configurado no servidor.' });
    return;
  }

  const action = String(req.body?.action || 'exchange');
  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  if (action === 'refresh') {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken || refreshToken.length > 2048) {
      res.status(400).json({ error: 'Refresh token GitHub ausente ou inválido.' });
      return;
    }
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', refreshToken);
  } else if (action === 'exchange') {
    const code = String(req.body?.code || '').trim();
    const redirectUri = String(req.body?.redirectUri || '').trim();
    if (!code || code.length > 1024 || !validGitHubRedirect(req, redirectUri)) {
      res.status(400).json({ error: 'Código ou redirect URI GitHub inválido.' });
      return;
    }
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
  } else {
    res.status(400).json({ error: 'Ação OAuth GitHub inválida.' });
    return;
  }

  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Orbit',
      },
      body: params,
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
    if (!response.ok || !accessToken) {
      res.status(response.ok ? 400 : response.status).json({
        error: String(data.error_description || data.error || 'GitHub não retornou um token de acesso.'),
      });
      return;
    }
    res.status(200).json({
      accessToken,
      expiresIn: Number(data.expires_in) || 0,
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      refreshTokenExpiresIn: Number(data.refresh_token_expires_in) || 0,
      tokenType: String(data.token_type || 'bearer'),
    });
  } catch (error) {
    res.status(502).json({ error: compactError(error) });
  }
}

async function startServer(): Promise<void> {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/ai/models', (_req, res) => {
    const status = nexusAI.status();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      assistant: 'Nexus AI',
      gateway: 'OpenRouter',
      unified: true,
      userSelectableModels: false,
      freeOnly: true,
      configured: status.configured,
      internalPoolSize: NEXUS_FREE_MODELS.length,
    });
  });

  app.get('/api/ai/status', (_req, res) => {
    const status = nexusAI.status();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      assistant: status.assistant,
      gateway: status.gateway,
      configured: status.configured,
      freeOnly: status.freeOnly,
      healthyModels: status.circuits.filter((circuit) => circuit.state !== 'OPEN').length,
      unavailableModels: status.circuits.filter((circuit) => circuit.state === 'OPEN').length,
      totalModels: status.circuits.length,
    });
  });

  app.get('/api/health', (_req, res) => {
    const status = nexusAI.status();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      product: 'Orbit',
      workspace: 'Orbispace',
      office: 'OrbiDoc',
      ai: {
        assistant: 'Nexus AI',
        gateway: 'OpenRouter',
        configured: status.configured,
        freeOnly: true,
        internalPoolSize: status.circuits.length,
      },
    });
  });

  app.post('/api/github/oauth-token', rateLimit(OAUTH_RATE_MAX_REQUESTS), exchangeGitHubOAuth);

  app.post('/api/chat/stream', rateLimit(RATE_MAX_REQUESTS), async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const write = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
    try {
      await nexusOrchestrator.stream(
        (req.body || {}) as NexusBody,
        (chunk) => write({ chunk }),
        (meta) => write({ meta }),
      );
    } catch (error) {
      write({ error: compactError(error) });
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  const chatHandler = async (req: express.Request, res: express.Response) => {
    try {
      const result = await nexusOrchestrator.complete((req.body || {}) as NexusBody);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Orbit-Request-Id', result.requestId);
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
      res.json(await generateImageResilient(req.body || {}));
    } catch (error) {
      res.status(503).json({ error: compactError(error) });
    }
  });

  app.post('/api/edit-image', rateLimit(IMAGE_RATE_MAX_REQUESTS), async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await editImageResilient(req.body || {}));
    } catch (error) {
      res.status(503).json({ error: compactError(error) });
    }
  });

  app.post('/api/enhance-image', rateLimit(IMAGE_RATE_MAX_REQUESTS), async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await enhanceImageResilient(req.body || {}));
    } catch (error) {
      res.status(503).json({ error: compactError(error) });
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

  app.listen(PORT, '0.0.0.0', () => console.log(`Orbit server listening on port ${PORT}`));
}

startServer().catch((error) => {
  console.error('Fatal Orbit server startup error:', error);
  process.exitCode = 1;
});
