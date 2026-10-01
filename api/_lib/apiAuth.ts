import crypto from 'node:crypto';

const AUTH_HEADER = 'authorization';

function configuredToken(): string {
  return String(process.env.API_AUTH_TOKEN ?? '').trim();
}

function bearerToken(req: any): string {
  const raw = typeof req.headers?.[AUTH_HEADER] === 'string' ? req.headers[AUTH_HEADER] : '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

export function requireAuthIfConfigured(req: any, res: any): boolean {
  const expected = configuredToken();
  if (!expected) return false;

  const provided = bearerToken(req);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const valid = expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!valid) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'Autenticação da API obrigatória.' });
    return true;
  }

  return false;
}

export function authConfigured(): boolean {
  return Boolean(configuredToken());
}

export function authMode(): 'required' | 'open' {
  return authConfigured() ? 'required' : 'open';
}
