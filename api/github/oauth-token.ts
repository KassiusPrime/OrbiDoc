const TOKEN_URL = 'https://github.com/login/oauth/access_token';

function sameOriginRequest(req: any) {
  const origin = String(req.headers?.origin || '').trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').trim();
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
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
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token GitHub ausente.' });
      return;
    }
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', refreshToken);
  } else {
    const code = String(req.body?.code || '').trim();
    const redirectUri = String(req.body?.redirectUri || '').trim();
    if (!code || !redirectUri) {
      res.status(400).json({ error: 'Código ou redirect URI GitHub ausente.' });
      return;
    }
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OrbiDoc',
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

    res.setHeader('Cache-Control', 'no-store');
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
