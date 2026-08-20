export type BrowserImageTarget = 'png' | 'jpg' | 'webp' | 'avif';

export interface BrowserImageConversionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

const MIME_BY_TARGET: Record<BrowserImageTarget, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

let magickPromise: Promise<any> | null = null;

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
  const keyByTarget: Record<BrowserImageTarget, string> = {
    png: 'Png',
    jpg: 'Jpeg',
    webp: 'WebP',
    avif: 'Avif',
  };
  const format = module.MagickFormat?.[keyByTarget[target]];
  if (!format) throw new Error(`O motor avançado não oferece saída ${target.toUpperCase()} nesta compilação.`);
  return format;
}

function resizeIfNeeded(image: any, options: BrowserImageConversionOptions) {
  const sourceWidth = Number(image.width) || 0;
  const sourceHeight = Number(image.height) || 0;
  if (!sourceWidth || !sourceHeight) return;

  const maxWidth = options.maxWidth && options.maxWidth > 0 ? options.maxWidth : sourceWidth;
  const maxHeight = options.maxHeight && options.maxHeight > 0 ? options.maxHeight : sourceHeight;
  const ratio = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  if (ratio >= 1) return;

  image.resize(
    Math.max(1, Math.round(sourceWidth * ratio)),
    Math.max(1, Math.round(sourceHeight * ratio)),
  );
}

/**
 * Decodes and converts images entirely in the browser through ImageMagick WASM.
 * This is intentionally loaded lazily so normal document workflows do not pay
 * the WASM startup/download cost until an advanced image format needs it.
 */
export async function convertImageWithMagick(
  file: File,
  target: BrowserImageTarget,
  options: BrowserImageConversionOptions = {},
): Promise<Blob> {
  const module = await getMagick();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = resolveFormat(module, target);
  const quality = Math.round(Math.min(1, Math.max(0.1, options.quality ?? 0.9)) * 100);

  try {
    return await module.ImageMagick.read(bytes, async (image: any) => {
      resizeIfNeeded(image, options);
      if (target !== 'png' && 'quality' in image) image.quality = quality;

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
    throw new Error(`Não foi possível decodificar ${file.name} com o motor universal de imagens${detail ? `: ${detail.slice(0, 220)}` : '.'}`);
  }
}

export async function getImageMagickRuntimeInfo() {
  const module = await getMagick();
  return {
    version: String(module.Magick?.imageMagickVersion || 'ImageMagick WASM'),
    delegates: String(module.Magick?.delegates || ''),
    features: String(module.Magick?.features || ''),
  };
}
