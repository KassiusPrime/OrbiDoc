export type ResizeMode = 'pixels' | 'percent';
export type ResizeFit = 'contain' | 'cover' | 'stretch';
export type ResizeOutputFormat = 'png' | 'jpg' | 'webp';

export const IMAGE_RESIZE_MAX_SIDE = 8192;
export const IMAGE_RESIZE_MAX_PIXELS = 50_000_000;

export type ResizeTargetOptions = {
  mode: ResizeMode;
  width?: number;
  height?: number;
  percent?: number;
  lockAspect?: boolean;
};

export type ResizePlacement = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

const positive = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function assertSafeResizeDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('As dimensões de saída precisam ser maiores que zero.');
  }
  if (width > IMAGE_RESIZE_MAX_SIDE || height > IMAGE_RESIZE_MAX_SIDE) {
    throw new Error(`O redimensionador limita cada lado a ${IMAGE_RESIZE_MAX_SIDE}px para proteger a memória do dispositivo.`);
  }
  if (width * height > IMAGE_RESIZE_MAX_PIXELS) {
    throw new Error('A imagem de saída excede 50 megapixels. Reduza as dimensões para evitar falhas de memória.');
  }
}

export function computeResizeTarget(
  sourceWidth: number,
  sourceHeight: number,
  options: ResizeTargetOptions,
) {
  const sourceW = Math.max(1, Math.round(positive(sourceWidth, 1)));
  const sourceH = Math.max(1, Math.round(positive(sourceHeight, 1)));

  let width: number;
  let height: number;

  if (options.mode === 'percent') {
    const percent = Math.min(800, Math.max(1, positive(options.percent, 100)));
    width = Math.max(1, Math.round(sourceW * percent / 100));
    height = Math.max(1, Math.round(sourceH * percent / 100));
  } else if (options.lockAspect !== false) {
    width = Math.max(1, Math.round(positive(options.width, sourceW)));
    height = Math.max(1, Math.round(width * sourceH / sourceW));
  } else {
    width = Math.max(1, Math.round(positive(options.width, sourceW)));
    height = Math.max(1, Math.round(positive(options.height, sourceH)));
  }

  assertSafeResizeDimensions(width, height);
  return { width, height };
}

export function computeResizePlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ResizeFit,
): ResizePlacement {
  const sw = Math.max(1, positive(sourceWidth, 1));
  const sh = Math.max(1, positive(sourceHeight, 1));
  const tw = Math.max(1, positive(targetWidth, 1));
  const th = Math.max(1, positive(targetHeight, 1));

  if (fit === 'stretch') return { dx: 0, dy: 0, dw: tw, dh: th };

  const scale = fit === 'cover'
    ? Math.max(tw / sw, th / sh)
    : Math.min(tw / sw, th / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  return {
    dx: (tw - dw) / 2,
    dy: (th - dh) / 2,
    dw,
    dh,
  };
}

export function outputMimeType(format: ResizeOutputFormat) {
  if (format === 'jpg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

export function outputExtension(format: ResizeOutputFormat) {
  return format === 'jpg' ? 'jpg' : format;
}
