export type EnhancementProfile = 'balanced' | 'photo' | 'anime' | 'document' | 'sharp';
export type EnhancementScale = 1 | 2 | 4;

export interface EnhancementOptions {
  scale: EnhancementScale;
  profile: EnhancementProfile;
  strength?: number;
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function defaultPixelBudget() {
  const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0);
  if (memory && memory <= 4) return 18_000_000;
  if (memory && memory <= 8) return 30_000_000;
  return 42_000_000;
}

export function planEnhancement(width: number, height: number, scale: EnhancementScale, maxPixels = defaultPixelBudget()): EnhancementPlan {
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

function percentile(histogram: Uint32Array, total: number, fraction: number) {
  const target = total * fraction;
  let running = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    running += histogram[i];
    if (running >= target) return i;
  }
  return 255;
}

function autoLevels(data: Uint8ClampedArray, amount: number) {
  const histogram = new Uint32Array(256);
  const pixelCount = data.length / 4;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 350_000));
  let samples = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += sampleStep) {
    const index = pixel * 4;
    const lum = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    histogram[lum] += 1;
    samples += 1;
  }
  const low = percentile(histogram, samples, 0.012);
  const high = Math.max(low + 18, percentile(histogram, samples, 0.988));
  const gain = 255 / (high - low);
  const blend = clamp(amount, 0, 1);
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const original = data[index + channel];
      const leveled = clamp((original - low) * gain, 0, 255);
      data[index + channel] = Math.round(original * (1 - blend) + leveled * blend);
    }
  }
}

function adjustSaturation(data: Uint8ClampedArray, saturation: number) {
  if (Math.abs(saturation - 1) < 0.005) return;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    data[index] = clamp(gray + (r - gray) * saturation, 0, 255);
    data[index + 1] = clamp(gray + (g - gray) * saturation, 0, 255);
    data[index + 2] = clamp(gray + (b - gray) * saturation, 0, 255);
  }
}

function grayscale(data: Uint8ClampedArray) {
  for (let index = 0; index < data.length; index += 4) {
    const value = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

function documentThreshold(data: Uint8ClampedArray, strength: number) {
  let sum = 0;
  let count = 0;
  const pixelCount = data.length / 4;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 250_000));
  for (let pixel = 0; pixel < pixelCount; pixel += sampleStep) {
    sum += data[pixel * 4];
    count += 1;
  }
  const mean = sum / Math.max(1, count);
  const threshold = clamp(mean * 0.9, 110, 210);
  const blend = clamp(0.35 + strength * 0.55, 0.35, 0.9);
  for (let index = 0; index < data.length; index += 4) {
    const original = data[index];
    const binary = original > threshold ? 255 : 0;
    const value = Math.round(original * (1 - blend) + binary * blend);
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

function applyPixelSharpen(imageData: ImageData, amount: number) {
  const { width, height, data } = imageData;
  if (amount <= 0 || width * height > 22_000_000) return;
  const input = new Uint8ClampedArray(data);
  const strength = clamp(amount, 0, 1.5);
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
        data[index + channel] = clamp(center + (center - neighbors) * strength, 0, 255);
      }
    }
  }
}

function drawHighQuality(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  let currentSource: CanvasImageSource = source;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;
  while (currentWidth * 1.75 < targetWidth || currentHeight * 1.75 < targetHeight) {
    const nextWidth = Math.min(targetWidth, Math.max(currentWidth + 1, Math.round(currentWidth * 1.6)));
    const nextHeight = Math.min(targetHeight, Math.max(currentHeight + 1, Math.round(currentHeight * 1.6)));
    const step = document.createElement('canvas');
    step.width = nextWidth;
    step.height = nextHeight;
    const stepContext = step.getContext('2d');
    if (!stepContext) break;
    stepContext.imageSmoothingEnabled = true;
    stepContext.imageSmoothingQuality = 'high';
    stepContext.drawImage(currentSource, 0, 0, currentWidth, currentHeight, 0, 0, nextWidth, nextHeight);
    currentSource = step;
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
  return { canvas, context };
}

function profileDefaults(profile: EnhancementProfile, strength: number) {
  const s = clamp(strength, 0, 1);
  if (profile === 'anime') return { levels: 0.5 + s * 0.22, saturation: 1.08 + s * 0.14, sharpen: 0.48 + s * 0.52 };
  if (profile === 'document') return { levels: 0.78, saturation: 0, sharpen: 0.42 + s * 0.35 };
  if (profile === 'sharp') return { levels: 0.44 + s * 0.18, saturation: 1.01, sharpen: 0.72 + s * 0.58 };
  if (profile === 'photo') return { levels: 0.58 + s * 0.24, saturation: 1.03 + s * 0.08, sharpen: 0.3 + s * 0.38 };
  return { levels: 0.5 + s * 0.2, saturation: 1.02 + s * 0.04, sharpen: 0.34 + s * 0.34 };
}

export async function enhanceImageLocally(source: Blob | File | string, options: EnhancementOptions) {
  const image = await loadImage(source);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const plan = planEnhancement(sourceWidth, sourceHeight, options.scale, options.maxPixels);
  const strength = clamp((options.strength ?? 65) / 100, 0, 1);
  const defaults = profileDefaults(options.profile, strength);
  const sharpen = options.sharpen ?? defaults.sharpen;
  const contrast = options.contrast ?? 1;
  const saturation = options.saturation ?? defaults.saturation;
  const { canvas, context } = drawHighQuality(image, sourceWidth, sourceHeight, plan.width, plan.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  autoLevels(imageData.data, defaults.levels);
  if (options.profile === 'document') {
    grayscale(imageData.data);
    documentThreshold(imageData.data, strength);
  } else {
    adjustSaturation(imageData.data, saturation);
  }
  applyPixelSharpen(imageData, sharpen);
  context.putImageData(imageData, 0, 0);

  if (contrast !== 1) {
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tempContext = temp.getContext('2d');
    if (tempContext) {
      tempContext.drawImage(canvas, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.filter = `contrast(${clamp(contrast, 0.8, 1.4)})`;
      context.drawImage(temp, 0, 0);
      context.filter = 'none';
    }
  }

  const outputType = options.outputType || 'image/png';
  const quality = clamp(options.quality ?? 0.95, 0.55, 1);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('Não foi possível codificar a imagem aprimorada.')),
    outputType,
    quality,
  ));

  return { blob, width: canvas.width, height: canvas.height, plan };
}
