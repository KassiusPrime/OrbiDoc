import { isOrbiDocNativeRuntime } from './nativeRuntime';

const DEFAULT_ORBIT_API_ORIGIN = 'https://doc-swiss.vercel.app';

type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function normalizeHttpsOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Web/PWA keep same-origin API calls. The embedded Capacitor bundle has no
 * Vercel server behind `/api`, so Android/iOS must target the deployed Orbit
 * API explicitly. A build-time override is supported for future custom domains.
 */
export function getOrbitApiOrigin(): string {
  if (!isOrbiDocNativeRuntime()) return '';

  const configured = normalizeHttpsOrigin((import.meta as ViteImportMeta).env?.VITE_ORBIT_API_ORIGIN);
  return configured ?? DEFAULT_ORBIT_API_ORIGIN;
}

export function orbitApiUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const origin = getOrbitApiOrigin();
  if (!origin) return path;
  return new URL(path, `${origin}/`).toString();
}

export const ORBIT_PRODUCTION_API_ORIGIN = DEFAULT_ORBIT_API_ORIGIN;
