import dns from 'node:dns/promises';
import net from 'node:net';

// Vercel Functions cap non-streaming response payloads at 4.5 MB.
// Keep the proxy path below that limit; larger direct URLs are downloaded
// client-side when CORS permits, or opened at the origin as a fallback.
export const MAX_PROXY_DOWNLOAD_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 20_000;

const ALLOWED_TYPES = [
  'image/',
  'audio/',
  'video/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/epub+zip',
  'application/octet-stream',
  'text/plain',
] as const;

export interface RemoteMediaProbe {
  sourceUrl: string;
  finalUrl: string;
  fileName: string;
  contentType: string;
  contentLength?: number;
  kind: 'image' | 'audio' | 'video' | 'pdf' | 'archive' | 'file';
  downloadable: boolean;
  maxProxyBytes: number;
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || a >= 224;
}

function isPrivateIp(address: string) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb')
      || normalized.startsWith('::ffff:127.')
      || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.');
  }
  return true;
}

async function validateRemoteUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error('URL inválida.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Somente links HTTP/HTTPS são aceitos.');
  if (url.username || url.password) throw new Error('Links com credenciais embutidas não são aceitos.');
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Host não permitido.');
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (![80, 443].includes(port)) throw new Error('Somente portas web padrão são aceitas.');

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Endereços privados ou locais não são permitidos.');
  } else {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('O host resolve para uma rede privada ou não permitida.');
  }
  return url;
}

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180) || 'download';
}

function fileNameFromHeaders(response: Response, url: URL) {
  const disposition = response.headers.get('content-disposition') || '';
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf) {
    try { return safeFileName(decodeURIComponent(utf)); } catch { /* use fallback */ }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  if (plain) return safeFileName(plain);
  const pathName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'download');
  return safeFileName(pathName);
}

function classify(contentType: string): RemoteMediaProbe['kind'] {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.includes('zip') || contentType.includes('epub')) return 'archive';
  return 'file';
}

function typeIsAllowed(contentType: string) {
  const clean = contentType.split(';')[0].trim().toLowerCase();
  return ALLOWED_TYPES.some((allowed) => allowed.endsWith('/') ? clean.startsWith(allowed) : clean === allowed);
}

function parseTotalLength(response: Response) {
  const contentRange = response.headers.get('content-range') || '';
  const rangeTotal = contentRange.match(/\/([0-9]+)$/)?.[1];
  if (rangeTotal) return Number(rangeTotal);
  const length = response.headers.get('content-length');
  return length && /^\d+$/.test(length) ? Number(length) : undefined;
}

async function fetchValidated(rawUrl: string, init: RequestInit, redirects = 0): Promise<{ response: Response; url: URL }> {
  if (redirects > MAX_REDIRECTS) throw new Error('O link redirecionou vezes demais.');
  const url = await validateRemoteUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'OrbiDoc/1.0 direct-media-fetcher',
        Accept: 'image/*,audio/*,video/*,application/pdf,application/zip,application/epub+zip,application/octet-stream,text/plain;q=0.8,*/*;q=0.2',
        ...(init.headers || {}),
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirecionamento sem destino.');
      return fetchValidated(new URL(location, url).toString(), init, redirects + 1);
    }
    return { response, url };
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeRemoteMedia(rawUrl: string): Promise<RemoteMediaProbe> {
  let result = await fetchValidated(rawUrl, { method: 'HEAD' });
  if ([400, 403, 405, 501].includes(result.response.status)) {
    result = await fetchValidated(rawUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } });
  }
  if (!result.response.ok && result.response.status !== 206) throw new Error(`O servidor remoto respondeu ${result.response.status}.`);

  const contentType = (result.response.headers.get('content-type') || 'application/octet-stream').split(';')[0].toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) throw new Error('Este link aponta para uma página, não para um arquivo direto.');
  if (!typeIsAllowed(contentType)) throw new Error(`Tipo remoto não aceito: ${contentType || 'desconhecido'}.`);
  const contentLength = parseTotalLength(result.response);
  return {
    sourceUrl: rawUrl,
    finalUrl: result.url.toString(),
    fileName: fileNameFromHeaders(result.response, result.url),
    contentType,
    contentLength,
    kind: classify(contentType),
    downloadable: !contentLength || contentLength <= MAX_PROXY_DOWNLOAD_BYTES,
    maxProxyBytes: MAX_PROXY_DOWNLOAD_BYTES,
  };
}

export async function downloadRemoteMedia(rawUrl: string) {
  const { response, url } = await fetchValidated(rawUrl, { method: 'GET' });
  if (!response.ok) throw new Error(`O servidor remoto respondeu ${response.status}.`);
  const contentType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) throw new Error('Este endereço não é um arquivo direto para download.');
  if (!typeIsAllowed(contentType)) throw new Error(`Tipo remoto não aceito: ${contentType || 'desconhecido'}.`);
  const declared = parseTotalLength(response) || 0;
  if (declared > MAX_PROXY_DOWNLOAD_BYTES) throw new Error(`Arquivo acima do limite do proxy (${Math.round(MAX_PROXY_DOWNLOAD_BYTES / 1024 / 1024)} MB).`);
  if (!response.body) throw new Error('O servidor remoto não retornou conteúdo.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_PROXY_DOWNLOAD_BYTES) {
      await reader.cancel();
      throw new Error(`Arquivo acima do limite do proxy (${Math.round(MAX_PROXY_DOWNLOAD_BYTES / 1024 / 1024)} MB).`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes, fileName: fileNameFromHeaders(response, url), contentType, finalUrl: url.toString() };
}
