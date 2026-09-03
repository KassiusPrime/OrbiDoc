const NATIVE_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost',
]);

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  return NATIVE_ORIGINS.has(origin) || isLocalDevelopmentOrigin(origin);
}

/**
 * Enables the embedded Capacitor WebView to call Orbit's Vercel Functions.
 * Unknown browser origins receive no Access-Control-Allow-Origin header.
 */
export function applyNativeCors(req: any, res: any): boolean {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
