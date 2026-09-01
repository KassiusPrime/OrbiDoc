const TOKEN_URL = 'https://github.com/login/oauth/access_token';

function requestHost(req: any) {
  return String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').trim();
}

function sameOriginRequest(req: any) {
  const origin = String(req.headers?.origin || '').trim();
  const host = requestHost(req);
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validRedirectUri(req: any, redirectUri: string) {
  const host = requestHost(req);
  if (!host || !redirectUri) return false;
  try {
    const url = new URL(redirectUri);
    return url.host === host && url.pathname === '/auth/github' && /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

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
    if (!code || code.length > 1024 || !validRedirectUri(req, redirectUri)) {
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
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Orbit',
      },
      body: params,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      res.status(response.ok ? 400 : response.status).json({
        error: data.error_description || data.error || 'GitHub não retornou um token de acesso.',
      });
      return;
    }

    res.status(200).json({
      accessToken: String(data.access_token),
      expiresIn: Number(data.expires_in) || 0,
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      refreshTokenExpiresIn: Number(data.refresh_token_expires_in) || 0,
      tokenType: String(data.token_type || 'bearer'),
    });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Falha ao trocar credenciais com o GitHub.' });
  }
}
