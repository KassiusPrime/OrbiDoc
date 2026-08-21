import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export type ScanFilter = 'original' | 'auto' | 'document' | 'grayscale' | 'bw';
export type ScanRotation = 0 | 90 | 180 | 270;

export interface ScanCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ScanPage {
  id: string;
  name: string;
  sourceUrl: string;
  sourceType: string;
  rotation: ScanRotation;
  filter: ScanFilter;
  brightness: number;
  contrast: number;
  crop: ScanCrop;
}

export interface ScanExportOptions {
  quality?: number;
  paper?: 'original' | 'a4';
  jpeg?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const defaultScanCrop = (): ScanCrop => ({ left: 0, top: 0, right: 100, bottom: 100 });

export function createScanPage(file: File): ScanPage {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    sourceUrl: URL.createObjectURL(file),
    sourceType: file.type || 'image/jpeg',
    rotation: 0,
    filter: 'auto',
    brightness: 100,
    contrast: 100,
    crop: defaultScanCrop(),
  };
}

export function releaseScanPage(page: ScanPage) {
  if (page.sourceUrl.startsWith('blob:')) URL.revokeObjectURL(page.sourceUrl);
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Não foi possível carregar a imagem digitalizada.'));
  image.src = url;
});

const filterString = (page: ScanPage) => {
  const brightness = page.brightness / 100;
  const contrast = page.contrast / 100;
  const base = `brightness(${brightness}) contrast(${contrast})`;
  if (page.filter === 'original') return base;
  if (page.filter === 'auto') return `${base} contrast(1.18) saturate(.9) brightness(1.04)`;
  if (page.filter === 'document') return `${base} grayscale(1) contrast(1.52) brightness(1.12)`;
  if (page.filter === 'grayscale') return `${base} grayscale(1) contrast(1.12)`;
  return `${base} grayscale(1) contrast(1.4)`;
};

function applyBlackWhiteThreshold(context: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  let mean = 0;
  for (let index = 0; index < data.length; index += 4) mean += data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  mean /= Math.max(1, data.length / 4);
  const threshold = clamp(mean * 0.92, 105, 205);
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const value = luminance > threshold ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
}

export async function renderScanPageCanvas(page: ScanPage, maxDimension = 3200) {
  const image = await loadImage(page.sourceUrl);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const left = clamp(page.crop.left, 0, 98);
  const top = clamp(page.crop.top, 0, 98);
  const right = clamp(page.crop.right, left + 1, 100);
  const bottom = clamp(page.crop.bottom, top + 1, 100);
  const sourceX = Math.round((left / 100) * naturalWidth);
  const sourceY = Math.round((top / 100) * naturalHeight);
  const sourceWidth = Math.max(1, Math.round(((right - left) / 100) * naturalWidth));
  const sourceHeight = Math.max(1, Math.round(((bottom - top) / 100) * naturalHeight));
  const rotated = page.rotation === 90 || page.rotation === 270;
  let outputWidth = rotated ? sourceHeight : sourceWidth;
  let outputHeight = rotated ? sourceWidth : sourceHeight;
  const scale = Math.min(1, maxDimension / Math.max(outputWidth, outputHeight));
  outputWidth = Math.max(1, Math.round(outputWidth * scale));
  outputHeight = Math.max(1, Math.round(outputHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d', { willReadFrequently: page.filter === 'bw' });
  if (!context) throw new Error('Canvas indisponível para digitalização.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.save();
  context.translate(outputWidth / 2, outputHeight / 2);
  context.rotate((page.rotation * Math.PI) / 180);
  context.filter = filterString(page);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
  context.filter = 'none';
  if (page.filter === 'bw') applyBlackWhiteThreshold(context, outputWidth, outputHeight);
  return canvas;
}

export async function renderScanPageBlob(page: ScanPage, quality = 0.92, mimeType = 'image/jpeg') {
  const canvas = await renderScanPageCanvas(page);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar a página digitalizada.')), mimeType, quality));
}

export async function autoDetectScanCrop(page: ScanPage): Promise<ScanCrop> {
  const image = await loadImage(page.sourceUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, 360 / Math.max(width, height));
  const sampleWidth = Math.max(20, Math.round(width * scale));
  const sampleHeight = Math.max(20, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return defaultScanCrop();
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const data = context.getImageData(0, 0, sampleWidth, sampleHeight).data;

  const samplePixel = (x: number, y: number) => {
    const offset = (y * sampleWidth + x) * 4;
    return [data[offset], data[offset + 1], data[offset + 2]] as const;
  };
  const corners = [samplePixel(1, 1), samplePixel(sampleWidth - 2, 1), samplePixel(1, sampleHeight - 2), samplePixel(sampleWidth - 2, sampleHeight - 2)];
  const background = [0, 1, 2].map((channel) => corners.reduce((sum, pixel) => sum + pixel[channel], 0) / corners.length);
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let y = 1; y < sampleHeight - 1; y += 2) {
    for (let x = 1; x < sampleWidth - 1; x += 2) {
      const pixel = samplePixel(x, y);
      const diff = Math.abs(pixel[0] - background[0]) + Math.abs(pixel[1] - background[1]) + Math.abs(pixel[2] - background[2]);
      const luminance = pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114;
      if (diff < 54 && luminance > 70) continue;
      hits += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (hits < Math.max(30, (sampleWidth * sampleHeight) / 250)) return defaultScanCrop();
  const marginX = sampleWidth * 0.025;
  const marginY = sampleHeight * 0.025;
  const crop = {
    left: clamp(((minX - marginX) / sampleWidth) * 100, 0, 96),
    top: clamp(((minY - marginY) / sampleHeight) * 100, 0, 96),
    right: clamp(((maxX + marginX) / sampleWidth) * 100, 4, 100),
    bottom: clamp(((maxY + marginY) / sampleHeight) * 100, 4, 100),
  };
  if (crop.right - crop.left < 20 || crop.bottom - crop.top < 20) return defaultScanCrop();
  return crop;
}

const canvasToDataUrl = (canvas: HTMLCanvasElement, quality = 0.92) => canvas.toDataURL('image/jpeg', quality);

export async function exportScansToPdf(pages: ScanPage[], fileName = 'OrbiDoc-Digitalizacao.pdf', options: ScanExportOptions = {}) {
  if (!pages.length) throw new Error('Adicione ao menos uma página para criar o PDF.');
  const quality = options.quality ?? 0.9;
  let pdf: jsPDF | null = null;
  for (let index = 0; index < pages.length; index += 1) {
    const canvas = await renderScanPageCanvas(pages[index]);
    const landscape = canvas.width > canvas.height;
    let pageWidth: number;
    let pageHeight: number;
    if (options.paper === 'a4') {
      pageWidth = landscape ? 297 : 210;
      pageHeight = landscape ? 210 : 297;
    } else {
      const max = 297;
      const ratio = canvas.width / canvas.height;
      if (ratio >= 1) { pageWidth = max; pageHeight = max / ratio; } else { pageHeight = max; pageWidth = max * ratio; }
    }
    if (!pdf) pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: [pageWidth, pageHeight], compress: true });
    else pdf.addPage([pageWidth, pageHeight], landscape ? 'landscape' : 'portrait');
    const padding = options.paper === 'a4' ? 8 : 0;
    const availableWidth = pageWidth - padding * 2;
    const availableHeight = pageHeight - padding * 2;
    const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
    const drawWidth = canvas.width * scale;
    const drawHeight = canvas.height * scale;
    pdf.addImage(canvasToDataUrl(canvas, quality), 'JPEG', (pageWidth - drawWidth) / 2, (pageHeight - drawHeight) / 2, drawWidth, drawHeight, undefined, 'FAST');
  }
  pdf?.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

export async function exportScansToZip(pages: ScanPage[], fileName = 'OrbiDoc-Digitalizacao.zip') {
  if (!pages.length) throw new Error('Adicione ao menos uma página para exportar.');
  const zip = new JSZip();
  for (let index = 0; index < pages.length; index += 1) {
    const blob = await renderScanPageBlob(pages[index], 0.92, 'image/jpeg');
    zip.file(`pagina-${String(index + 1).padStart(3, '0')}.jpg`, blob);
  }
  saveAs(await zip.generateAsync({ type: 'blob' }), fileName.endsWith('.zip') ? fileName : `${fileName}.zip`);
}
