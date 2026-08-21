export type EnhancementProfile = 'photo' | 'anime' | 'document';
export type EnhancementScale = 1 | 2 | 4;

export interface EnhancementOptions {
  scale: EnhancementScale;
  profile: EnhancementProfile;
  sharpen?: number;
  contrast?: number;
  saturation?: number;
  maxPixels?: number;
  outputType?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
}

export interface EnhancementPlan {
  width: number;
  height: number;
  requestedScale: number;
  effectiveScale: number;
  capped: boolean;
}

const DEFAULT_MAX_PIXELS = 28_000_000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function planEnhancement(width: number, height: number, scale: EnhancementScale, maxPixels = DEFAULT_MAX_PIXELS): EnhancementPlan {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const requestedPixels = safeWidth * safeHeight * scale * scale;
  const capped = requestedPixels > maxPixels;
  const pixelScale = capped ? Math.sqrt(maxPixels / (safeWidth * safeHeight)) : scale;
  const effectiveScale = Math.max(1, Math.min(scale, pixelScale));
  return {
    width: Math.max(1, Math.round(safeWidth * effectiveScale)),
    height: Math.max(1, Math.round(safeHeight * effectiveScale)),
    requestedScale: scale,
    effectiveScale,
    capped,
  };
}

const loadImage = (source: Blob | File | string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  let objectUrl = '';
  image.onload = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    reject(new Error('Não foi possível decodificar a imagem para aprimoramento.'));
  };
  if (typeof source === 'string') image.src = source;
  else {
    objectUrl = URL.createObjectURL(source);
    image.src = objectUrl;
  }
});

function profileDefaults(profile: EnhancementProfile) {
  if (profile === 'anime') return { sharpen: 0.22, contrast: 1.05, saturation: 1.06 };
  if (profile === 'document') return { sharpen: 0.28, contrast: 1.15, saturation: 0.92 };
  return { sharpen: 0.15, contrast: 1.035, saturation: 1.02 };
}

function applyPixelSharpen(context: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  if (amount <= 0 || width * height > 18_000_000) return;
  const source = context.getImageData(0, 0, width, height);
  const input = source.data;
  const output = new Uint8ClampedArray(input);
  const strength = clamp(amount, 0, 0.45);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const left = index - 4;
      const right = index + 4;
      const up = index - width * 4;
      const down = index + width * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = input[index + channel];
        const neighbors = (input[left + channel] + input[right + channel] + input[up + channel] + input[down + channel]) / 4;
        output[index + channel] = clamp(center + (center - neighbors) * strength * 2.1, 0, 255);
      }
    }
  }

  source.data.set(output);
  context.putImageData(source, 0, 0);
}

function drawHighQuality(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  let currentSource: CanvasImageSource = source;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;
  const temporary: HTMLCanvasElement[] = [];

  while (currentWidth * 1.9 < targetWidth || currentHeight * 1.9 < targetHeight) {
    const nextWidth = Math.min(targetWidth, Math.max(currentWidth + 1, Math.round(currentWidth * 1.8)));
    const nextHeight = Math.min(targetHeight, Math.max(currentHeight + 1, Math.round(currentHeight * 1.8)));
    const canvas = document.createElement('canvas');
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const context = canvas.getContext('2d');
    if (!context) break;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(currentSource, 0, 0, currentWidth, currentHeight, 0, 0, nextWidth, nextHeight);
    temporary.push(canvas);
    currentSource = canvas;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D indisponível para aprimoramento.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(currentSource, 0, 0, currentWidth, currentHeight, 0, 0, targetWidth, targetHeight);
  return { canvas, context, temporary };
}

export async function enhanceImageLocally(source: Blob | File | string, options: EnhancementOptions) {
  const image = await loadImage(source);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const plan = planEnhancement(sourceWidth, sourceHeight, options.scale, options.maxPixels);
  const defaults = profileDefaults(options.profile);
  const sharpen = options.sharpen ?? defaults.sharpen;
  const contrast = options.contrast ?? defaults.contrast;
  const saturation = options.saturation ?? defaults.saturation;
  const { canvas, context } = drawHighQuality(image, sourceWidth, sourceHeight, plan.width, plan.height);

  if (contrast !== 1 || saturation !== 1) {
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tempContext = temp.getContext('2d');
    if (tempContext) {
      tempContext.drawImage(canvas, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.filter = `contrast(${contrast}) saturate(${saturation})`;
      context.drawImage(temp, 0, 0);
      context.filter = 'none';
    }
  }

  applyPixelSharpen(context, canvas.width, canvas.height, sharpen);

  const outputType = options.outputType || 'image/png';
  const quality = clamp(options.quality ?? 0.94, 0.5, 1);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('Não foi possível codificar a imagem aprimorada.')),
    outputType,
    quality,
  ));

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    plan,
  };
}
