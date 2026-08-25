export type DesignImageFilter = 'none' | 'grayscale' | 'sepia' | 'contrast' | 'bright' | 'saturate' | 'soft-blur';
export type DesignImageMask = 'none' | 'circle' | 'rounded';
export type CropRatio = 'original' | '1:1' | '4:5' | '16:9' | '9:16';

export const cropRatioValue = (ratio: CropRatio, width: number, height: number) => {
  if (ratio === 'original') return width / Math.max(1, height);
  const [a, b] = ratio.split(':').map(Number);
  return a / b;
};

export const filterCss = (filter: DesignImageFilter) => {
  if (filter === 'grayscale') return 'grayscale(1)';
  if (filter === 'sepia') return 'sepia(.9) contrast(1.05)';
  if (filter === 'contrast') return 'contrast(1.28)';
  if (filter === 'bright') return 'brightness(1.18) contrast(1.04)';
  if (filter === 'saturate') return 'saturate(1.45)';
  if (filter === 'soft-blur') return 'blur(2px)';
  return 'none';
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
  image.src = src;
});

export async function transformDesignImage(src: string, options: { ratio?: CropRatio; filter?: DesignImageFilter; mask?: DesignImageMask; quality?: number }) {
  const image = await loadImage(src);
  const ratio = cropRatioValue(options.ratio || 'original', image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  let cropWidth = sourceWidth; let cropHeight = sourceHeight;
  if (sourceWidth / sourceHeight > ratio) cropWidth = sourceHeight * ratio;
  else cropHeight = sourceWidth / ratio;
  const sourceX = (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  const maxSide = 2048;
  const scale = Math.min(1, maxSide / Math.max(cropWidth, cropHeight));
  const width = Math.max(1, Math.round(cropWidth * scale));
  const height = Math.max(1, Math.round(cropHeight * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas indisponível.');
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  if (options.mask === 'circle') {
    context.beginPath(); context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); context.clip();
  } else if (options.mask === 'rounded') {
    const radius = Math.max(12, Math.min(width, height) * 0.12);
    context.beginPath(); context.roundRect(0, 0, width, height, radius); context.clip();
  }
  context.filter = filterCss(options.filter || 'none');
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
  const transparent = options.mask && options.mask !== 'none';
  const mime = transparent ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(mime, Math.max(0.55, Math.min(1, options.quality ?? 0.92)));
  return { dataUrl, width, height, sourceWidth, sourceHeight };
}
