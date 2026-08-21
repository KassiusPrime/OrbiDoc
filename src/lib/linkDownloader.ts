export type DirectDownloadKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'file';

export interface DirectDownloadResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
  kind: DirectDownloadKind;
  sourceUrl: string;
  transport: 'direct';
}

const MAX_DEFAULT_BYTES = 300 * 1024 * 1024;

const EXTENSION_KIND: Record<string, DirectDownloadKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', jfif: 'image', webp: 'image', avif: 'image', gif: 'image', bmp: 'image', svg: 'image', tif: 'image', tiff: 'image',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video',
  mp3: 'audio', m4a: 'audio', aac: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', opus: 'audio',
  pdf: 'document', txt: 'document', md: 'document', csv: 'document', json: 'document', html: 'document', htm: 'document', epub: 'document',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

const MIME_KIND: Array<[RegExp, DirectDownloadKind]> = [
  [/^image\//i, 'image'],
  [/^video\//i, 'video'],
  [/^audio\//i, 'audio'],
  [/^(application\/pdf|text\/|application\/(epub\+zip|json|xml))/i, 'document'],
  [/^(application\/(zip|x-7z-compressed|x-rar-compressed|gzip|x-tar))/i, 'archive'],
];

export function normalizeDirectDownloadUrl(input: string) {
  const value = input.trim();
  if (!value) throw new Error('Cole um link para baixar.');
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error('O link informado não é uma URL válida.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Somente links HTTP ou HTTPS são aceitos.');
  if (url.username || url.password) throw new Error('Links com credenciais embutidas não são aceitos.');
  if (/\.(m3u8|mpd)$/i.test(url.pathname)) {
    throw new Error('Playlists de streaming (HLS/DASH) não são baixadas pelo OrbiDoc. Use um link direto para o arquivo que você tem permissão para salvar.');
  }
  return url;
}

export function inferDirectDownloadKind(urlLike: string, mimeType = ''): DirectDownloadKind {
  const mime = mimeType.split(';')[0].trim();
  for (const [pattern, kind] of MIME_KIND) if (pattern.test(mime)) return kind;
  try {
    const pathname = new URL(urlLike).pathname;
    const extension = pathname.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_KIND[extension] || 'file';
  } catch {
    return 'file';
  }
}

export function sanitizeDownloadFilename(value: string, fallback = 'download') {
  const decoded = (() => { try { return decodeURIComponent(value); } catch { return value; } })();
  const cleaned = decoded.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180);
  return cleaned || fallback;
}

export function filenameFromHeaders(urlLike: string, disposition?: string | null) {
  if (disposition) {
    const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (utf) return sanitizeDownloadFilename(utf);
    const regular = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
    if (regular) return sanitizeDownloadFilename(regular);
  }
  try {
    const url = new URL(urlLike);
    const last = url.pathname.split('/').filter(Boolean).pop();
    return sanitizeDownloadFilename(last || 'download');
  } catch {
    return 'download';
  }
}

function copyChunkForBlob(chunk: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(chunk.byteLength);
  copy.set(chunk);
  return copy;
}

export async function downloadDirectUrl(
  input: string,
  onProgress?: (progress: number | null, loadedBytes: number, totalBytes?: number) => void,
  maxBytes = MAX_DEFAULT_BYTES,
): Promise<DirectDownloadResult> {
  const url = normalizeDirectDownloadUrl(input);
  let response: Response;
  try {
    response = await fetch(url.toString(), { method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer' });
  } catch {
    throw new Error('O servidor do link bloqueou o download direto pelo navegador (CORS/rede). O OrbiDoc não contorna essa proteção; abra o link original ou use uma fonte que permita download direto.');
  }
  if (!response.ok) throw new Error(`O servidor respondeu ${response.status}. Verifique se o link ainda é válido e público.`);

  const mimeType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
  if (/^text\/html$/i.test(mimeType) && !/\.(html?|xhtml)$/i.test(url.pathname)) {
    throw new Error('Este endereço retornou uma página web, não um arquivo direto. O OrbiDoc não extrai mídia de páginas ou serviços de streaming.');
  }

  const total = Number(response.headers.get('content-length') || 0) || undefined;
  if (total && total > maxBytes) throw new Error(`O arquivo tem ${(total / 1024 / 1024).toFixed(1)} MB e excede o limite local de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      loaded += value.byteLength;
      if (loaded > maxBytes) {
        await reader.cancel();
        throw new Error(`O download ultrapassou o limite local de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
      }
      chunks.push(copyChunkForBlob(value));
      onProgress?.(total ? Math.min(100, Math.round((loaded / total) * 100)) : null, loaded, total);
    }
  } else {
    const buffer = new Uint8Array(await response.arrayBuffer());
    loaded = buffer.byteLength;
    if (loaded > maxBytes) throw new Error(`O arquivo ultrapassa o limite local de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
    chunks.push(copyChunkForBlob(buffer));
  }

  const blob = new Blob(chunks, { type: mimeType });
  const filename = filenameFromHeaders(response.url || url.toString(), response.headers.get('content-disposition'));
  onProgress?.(100, loaded, total || loaded);
  return {
    blob,
    filename,
    mimeType,
    size: blob.size,
    kind: inferDirectDownloadKind(response.url || url.toString(), mimeType),
    sourceUrl: response.url || url.toString(),
    transport: 'direct',
  };
}