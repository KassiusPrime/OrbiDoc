export const MAGICK_IMAGE_TARGETS = [
  'png', 'jpg', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'heic', 'jxl', 'jp2',
  'ico', 'cur', 'psd', 'dds', 'tga', 'exr', 'hdr', 'qoi', 'ppm', 'pgm', 'pbm',
  'pnm', 'pcx', 'sgi', 'ras', 'xbm', 'xpm',
] as const;

export type BrowserImageTarget = (typeof MAGICK_IMAGE_TARGETS)[number];

export interface BrowserImageConversionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowUpscale?: boolean;
  preserveAspectRatio?: boolean;
  enhanceImage?: boolean;
}

const MIME_BY_TARGET: Record<BrowserImageTarget, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  heic: 'image/heic',
  jxl: 'image/jxl',
  jp2: 'image/jp2',
  ico: 'image/x-icon',
  cur: 'image/x-icon',
  psd: 'image/vnd.adobe.photoshop',
  dds: 'image/vnd-ms.dds',
  tga: 'image/x-tga',
  exr: 'image/x-exr',
  hdr: 'image/vnd.radiance',
  qoi: 'image/qoi',
  ppm: 'image/x-portable-pixmap',
  pgm: 'image/x-portable-graymap',
  pbm: 'image/x-portable-bitmap',
  pnm: 'image/x-portable-anymap',
  pcx: 'image/x-pcx',
  sgi: 'image/sgi',
  ras: 'image/x-cmu-raster',
  xbm: 'image/x-xbitmap',
  xpm: 'image/x-xpixmap',
};

const FORMAT_KEYS: Record<BrowserImageTarget, string[]> = {
  png: ['Png'],
  jpg: ['Jpeg', 'Jpg'],
  webp: ['WebP', 'Webp'],
  avif: ['Avif'],
  gif: ['Gif'],
  bmp: ['Bmp'],
  tiff: ['Tiff', 'Tif'],
  heic: ['Heic', 'Heif'],
  jxl: ['Jxl'],
  jp2: ['Jp2', 'Jpeg2000'],
  ico: ['Ico', 'Icon'],
  cur: ['Cur'],
  psd: ['Psd'],
  dds: ['Dds'],
  tga: ['Tga'],
  exr: ['Exr'],
  hdr: ['Hdr'],
  qoi: ['Qoi'],
  ppm: ['Ppm'],
  pgm: ['Pgm'],
  pbm: ['Pbm'],
  pnm: ['Pnm'],
  pcx: ['Pcx'],
  sgi: ['Sgi'],
  ras: ['Ras'],
  xbm: ['Xbm'],
  xpm: ['Xpm'],
};

const TARGET_SET = new Set<string>(MAGICK_IMAGE_TARGETS);
let magickPromise: Promise<any> | null = null;

export function isBrowserImageTarget(value: string): value is BrowserImageTarget {
  return TARGET_SET.has(value);
}

export function getBrowserImageMimeType(target: BrowserImageTarget) {
  return MIME_BY_TARGET[target];
}

async function getMagick() {
  if (!magickPromise) {
    magickPromise = (async () => {
      // Both the JS wrapper and the large WASM payload stay out of the normal
      // OrbiDoc path. Vite resolves ?url only when this dynamic branch runs.
      const [module, wasmAsset] = await Promise.all([
        import('@imagemagick/magick-wasm'),
        import('@imagemagick/magick-wasm/magick.wasm?url'),
      ]);
      const magickWasmUrl = (wasmAsset as any).default || wasmAsset;
      await module.initializeImageMagick(new URL(String(magickWasmUrl), import.meta.url));
      return module;
    })().catch((error) => {
      magickPromise = null;
      throw error;
    });
  }
  return magickPromise;
}

function resolveFormat(module: any, target: BrowserImageTarget) {
  const formats = module.MagickFormat || {};
  for (const key of FORMAT_KEYS[target]) {
    if (formats[key] !== undefined) return formats[key];
  }

  const normalizedCandidates = new Set(FORMAT_KEYS[target].map((key) => key.toLowerCase()));
  const matchingKey = Object.keys(formats).find((key) => normalizedCandidates.has(key.toLowerCase()));
  if (matchingKey) return formats[matchingKey];

  throw new Error(`O motor avançado não oferece saída ${target.toUpperCase()} nesta compilação.`);
}

function positiveDimension(value?: number) {
  if (!Number.isFinite(value) || !value || value <= 0) return undefined;
  return Math.max(1, Math.round(value));
}

function resizeIfNeeded(image: any, options: BrowserImageConversionOptions) {
  const sourceWidth = Number(image.width) || 0;
  const sourceHeight = Number(image.height) || 0;
  if (!sourceWidth || !sourceHeight) return;

  const requestedWidth = positiveDimension(options.maxWidth);
  const requestedHeight = positiveDimension(options.maxHeight);
  if (!requestedWidth && !requestedHeight) return;

  const preserveAspectRatio = options.preserveAspectRatio !== false;
  const allowUpscale = Boolean(options.allowUpscale);
  let width = requestedWidth || sourceWidth;
  let height = requestedHeight || sourceHeight;

  if (preserveAspectRatio) {
    const widthRatio = requestedWidth ? requestedWidth / sourceWidth : Number.POSITIVE_INFINITY;
    const heightRatio = requestedHeight ? requestedHeight / sourceHeight : Number.POSITIVE_INFINITY;
    let ratio = Math.min(widthRatio, heightRatio);
    if (!Number.isFinite(ratio)) ratio = requestedWidth ? widthRatio : heightRatio;
    if (!allowUpscale) ratio = Math.min(1, ratio);
    width = Math.max(1, Math.round(sourceWidth * ratio));
    height = Math.max(1, Math.round(sourceHeight * ratio));
  } else if (!allowUpscale) {
    width = Math.min(sourceWidth, width);
    height = Math.min(sourceHeight, height);
  }

  if (width === sourceWidth && height === sourceHeight) return;
  image.resize(width, height);
}

function enhanceIfRequested(image: any, options: BrowserImageConversionOptions) {
  if (typeof image.autoOrient === 'function') {
    try { image.autoOrient(); } catch { /* orientation metadata is optional */ }
  }
  if (!options.enhanceImage) return;

  // Conservative enhancement: normalize tonal range and apply a restrained
  // sharpening pass. Unsupported operations are ignored by older WASM builds.
  if (typeof image.normalize === 'function') {
    try { image.normalize(); } catch { /* optional enhancement */ }
  }
  if (typeof image.sharpen === 'function') {
    try { image.sharpen(0, 0.65); } catch { /* optional enhancement */ }
  }
}

/**
 * Decodes, enhances, resizes and converts images entirely in the browser
 * through ImageMagick WASM. The runtime is loaded lazily so document-only
 * workflows do not pay the WASM startup/download cost.
 */
export async function convertImageWithMagick(
  file: File,
  target: BrowserImageTarget,
  options: BrowserImageConversionOptions = {},
): Promise<Blob> {
  const module = await getMagick();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = resolveFormat(module, target);
  const quality = Math.round(Math.min(1, Math.max(0.1, options.quality ?? 0.92)) * 100);

  try {
    return await module.ImageMagick.read(bytes, async (image: any) => {
      enhanceIfRequested(image, options);
      resizeIfNeeded(image, options);
      if ('quality' in image) image.quality = quality;

      return await new Promise<Blob>((resolve, reject) => {
        try {
          image.write(format, (data: Uint8Array) => {
            const copy = new Uint8Array(data.byteLength);
            copy.set(data);
            resolve(new Blob([copy.buffer], { type: MIME_BY_TARGET[target] }));
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error: any) {
    const detail = String(error?.message || error || '').replace(/\s+/g, ' ').trim();
    throw new Error(`Não foi possível converter ${file.name} para ${target.toUpperCase()} com o motor universal de imagens${detail ? `: ${detail.slice(0, 220)}` : '.'}`);
  }
}

export async function getImageMagickRuntimeInfo() {
  const module = await getMagick();
  return {
    version: String(module.Magick?.imageMagickVersion || 'ImageMagick WASM'),
    delegates: String(module.Magick?.delegates || ''),
    features: String(module.Magick?.features || ''),
    writableTargets: [...MAGICK_IMAGE_TARGETS],
  };
}
