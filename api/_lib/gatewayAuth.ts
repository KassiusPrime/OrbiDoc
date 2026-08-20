import { getVercelOidcToken } from '@vercel/oidc';

export type GatewayAuthMode = 'oidc' | 'api-key' | 'none';

export type GatewayCredential = {
  token: string;
  mode: GatewayAuthMode;
};

function staticGatewayApiKey() {
  return typeof process.env.AI_GATEWAY_API_KEY === 'string'
    ? process.env.AI_GATEWAY_API_KEY.trim()
    : '';
}

/**
 * Resolve the Gateway credential for the current Vercel Function invocation.
 * OIDC is intentionally preferred. AI_GATEWAY_API_KEY is only a fallback for
 * local/non-Vercel runtimes or an explicit static-key configuration.
 */
export async function resolveGatewayCredential(): Promise<GatewayCredential> {
  try {
    const oidcToken = await getVercelOidcToken({ expirationBufferMs: 60_000 });
    if (typeof oidcToken === 'string' && oidcToken.trim()) {
      return { token: oidcToken.trim(), mode: 'oidc' };
    }
  } catch {
    // Local development or a runtime without OIDC can continue to the static fallback.
  }

  const apiKey = staticGatewayApiKey();
  if (apiKey) return { token: apiKey, mode: 'api-key' };

  return { token: '', mode: 'none' };
}

/**
 * Backward-compatibility bridge for the existing synchronous AI catalog/health
 * functions. The actual Gateway requests still consume the credential returned
 * directly by resolveGatewayCredential().
 */
export async function hydrateGatewayRuntimeAuth(): Promise<GatewayCredential> {
  const credential = await resolveGatewayCredential();

  if (credential.mode === 'oidc') {
    process.env.VERCEL_OIDC_TOKEN = credential.token;
  }

  return credential;
}
