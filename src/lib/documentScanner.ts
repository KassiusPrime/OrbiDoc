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

export interface ScanPoint { x: number; y: number; }
export interface ScanCorners {
  topLeft: ScanPoint;
  topRight: ScanPoint;
  bottomRight: ScanPoint;
  bottomLeft: ScanPoint;
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
  perspectiveEnabled: boolean;
  corners: ScanCorners;
}

export interface ScanExportOptions {
  quality?: number;
  paper?: 'original' | 'a4';
  jpeg?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: ScanPoint, b: ScanPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export const defaultScanCrop = (): ScanCrop => ({ left: 0, top: 0, right: 100, bottom: 100 });
export const defaultScanCorners = (): ScanCorners => ({
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomRight: { x: 100, y: 100 },
  bottomLeft: { x: 0, y: 100 },
});

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
    perspectiveEnabled: false,
    corners: defaultScanCorners(),
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

const normalizeCorners = (corners: ScanCorners, width: number, height: number): ScanCorners => ({
  topLeft: { x: clamp(corners.topLeft.x, 0, 100) / 100 * width, y: clamp(corners.topLeft.y, 0, 100) / 100 * height },
  topRight: { x: clamp(corners.topRight.x, 0, 100) / 100 * width, y: clamp(corners.topRight.y, 0, 100) / 100 * height },
  bottomRight: { x: clamp(corners.bottomRight.x, 0, 100) / 100 * width, y: clamp(corners.bottomRight.y, 0, 100) / 100 * height },
  bottomLeft: { x: clamp(corners.bottomLeft.x, 0, 100) / 100 * width, y: clamp(corners.bottomLeft.y, 0, 100) / 100 * height },
});

function squareToQuad(corners: ScanCorners) {
  const x0 = corners.topLeft.x; const y0 = corners.topLeft.y;
  const x1 = corners.topRight.x; const y1 = corners.topRight.y;
  const x2 = corners.bottomRight.x; const y2 = corners.bottomRight.y;
  const x3 = corners.bottomLeft.x; const y3 = corners.bottomLeft.y;
  const dx1 = x1 - x2; const dx2 = x3 - x2; const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2; const dy2 = y3 - y2; const dy3 = y0 - y1 + y2 - y3;
  let g = 0; let h = 0;
  const det = dx1 * dy2 - dx2 * dy1;
  if ((Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6) && Math.abs(det) > 1e-6) {
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  return {
    a: x1 - x0 + g * x1,
    b: x3 - x0 + h * x3,
    c: x0,
    d: y1 - y0 + g * y1,
    e: y3 - y0 + h * y3,
    f: y0,
    g,
    h,
  };
}

function sampleBilinear(source: Uint8ClampedArray, width: number, height: number, x: number, y: number, target: Uint8ClampedArray, offset: number) {
  const sx = clamp(x, 0, width - 1);
  const sy = clamp(y, 0, height - 1);
  const x0 = Math.floor(sx); const y0 = Math.floor(sy);
  const x1 = Math.min(width - 1, x0 + 1); const y1 = Math.min(height - 1, y0 + 1);
  const tx = sx - x0; const ty = sy - y0;
  const i00 = (y0 * width + x0) * 4; const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4; const i11 = (y1 * width + x1) * 4;
  for (let channel = 0; channel < 4; channel += 1) {
    const top = source[i00 + channel] * (1 - tx) + source[i10 + channel] * tx;
    const bottom = source[i01 + channel] * (1 - tx) + source[i11 + channel] * tx;
    target[offset + channel] = top * (1 - ty) + bottom * ty;
  }
}

async function renderPerspectiveCanvas(image: HTMLImageElement, page: ScanPage, maxDimension: number) {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const sourceScale = Math.min(1, 2200 / Math.max(naturalWidth, naturalHeight));
  const sourceWidth = Math.max(1, Math.round(naturalWidth * sourceScale));
  const sourceHeight = Math.max(1, Math.round(naturalHeight * sourceScale));
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('Canvas indisponível para correção de perspectiva.');
  sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);

  const corners = normalizeCorners(page.corners, sourceWidth, sourceHeight);
  const topWidth = distance(corners.topLeft, corners.topRight);
  const bottomWidth = distance(corners.bottomLeft, corners.bottomRight);
  const leftHeight = distance(corners.topLeft, corners.bottomLeft);
  const rightHeight = distance(corners.topRight, corners.bottomRight);
  let outputWidth = Math.max(80, Math.round((topWidth + bottomWidth) / 2));
  let outputHeight = Math.max(80, Math.round((leftHeight + rightHeight) / 2));
  const outputScale = Math.min(1, Math.min(maxDimension, 2200) / Math.max(outputWidth, outputHeight));
  outputWidth = Math.max(1, Math.round(outputWidth * outputScale));
  outputHeight = Math.max(1, Math.round(outputHeight * outputScale));

  const sourceData = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data;
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) throw new Error('Canvas indisponível para correção de perspectiva.');
  const outputImage = outputContext.createImageData(outputWidth, outputHeight);
  const matrix = squareToQuad(corners);

  for (let y = 0; y < outputHeight; y += 1) {
    const v = outputHeight <= 1 ? 0 : y / (outputHeight - 1);
    for (let x = 0; x < outputWidth; x += 1) {
      const u = outputWidth <= 1 ? 0 : x / (outputWidth - 1);
      const denominator = matrix.g * u + matrix.h * v + 1;
      const sourceX = (matrix.a * u + matrix.b * v + matrix.c) / denominator;
      const sourceY = (matrix.d * u + matrix.e * v + matrix.f) / denominator;
      sampleBilinear(sourceData, sourceWidth, sourceHeight, sourceX, sourceY, outputImage.data, (y * outputWidth + x) * 4);
    }
  }
  outputContext.putImageData(outputImage, 0, 0);
  return outputCanvas;
}

async function renderRectangularCanvas(image: HTMLImageElement, page: ScanPage, maxDimension: number) {
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
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível para digitalização.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function renderScanPageCanvas(page: ScanPage, maxDimension = 3200) {
  const image = await loadImage(page.sourceUrl);
  const geometryCanvas = page.perspectiveEnabled
    ? await renderPerspectiveCanvas(image, page, maxDimension)
    : await renderRectangularCanvas(image, page, maxDimension);
  const rotated = page.rotation === 90 || page.rotation === 270;
  const outputWidth = rotated ? geometryCanvas.height : geometryCanvas.width;
  const outputHeight = rotated ? geometryCanvas.width : geometryCanvas.height;
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
  context.drawImage(geometryCanvas, -geometryCanvas.width / 2, -geometryCanvas.height / 2);
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
  let minX = sampleWidth; let minY = sampleHeight; let maxX = 0; let maxY = 0; let hits = 0;
  for (let y = 1; y < sampleHeight - 1; y += 2) {
    for (let x = 1; x < sampleWidth - 1; x += 2) {
      const pixel = samplePixel(x, y);
      const diff = Math.abs(pixel[0] - background[0]) + Math.abs(pixel[1] - background[1]) + Math.abs(pixel[2] - background[2]);
      const luminance = pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114;
      if (diff < 54 && luminance > 70) continue;
      hits += 1; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (hits < Math.max(30, (sampleWidth * sampleHeight) / 250)) return defaultScanCrop();
  const marginX = sampleWidth * 0.025; const marginY = sampleHeight * 0.025;
  const crop = {
    left: clamp(((minX - marginX) / sampleWidth) * 100, 0, 96),
    top: clamp(((minY - marginY) / sampleHeight) * 100, 0, 96),
    right: clamp(((maxX + marginX) / sampleWidth) * 100, 4, 100),
    bottom: clamp(((maxY + marginY) / sampleHeight) * 100, 4, 100),
  };
  if (crop.right - crop.left < 20 || crop.bottom - crop.top < 20) return defaultScanCrop();
  return crop;
}

export const cropToScanCorners = (crop: ScanCrop): ScanCorners => ({
  topLeft: { x: crop.left, y: crop.top },
  topRight: { x: crop.right, y: crop.top },
  bottomRight: { x: crop.right, y: crop.bottom },
  bottomLeft: { x: crop.left, y: crop.bottom },
});

export async function autoDetectScanCorners(page: ScanPage): Promise<ScanCorners> {
  return cropToScanCorners(await autoDetectScanCrop(page));
}

const canvasToDataUrl = (canvas: HTMLCanvasElement, quality = 0.92) => canvas.toDataURL('image/jpeg', quality);

export async function exportScansToPdf(pages: ScanPage[], fileName = 'OrbiDoc-Digitalizacao.pdf', options: ScanExportOptions = {}) {
  if (!pages.length) throw new Error('Adicione ao menos uma página para criar o PDF.');
  const quality = options.quality ?? 0.9;
  let pdf: jsPDF | null = null;
  for (let index = 0; index < pages.length; index += 1) {
    const canvas = await renderScanPageCanvas(pages[index]);
    const landscape = canvas.width > canvas.height;
    let pageWidth: number; let pageHeight: number;
    if (options.paper === 'a4') { pageWidth = landscape ? 297 : 210; pageHeight = landscape ? 210 : 297; }
    else { const max = 297; const ratio = canvas.width / canvas.height; if (ratio >= 1) { pageWidth = max; pageHeight = max / ratio; } else { pageHeight = max; pageWidth = max * ratio; } }
    if (!pdf) pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: [pageWidth, pageHeight], compress: true });
    else pdf.addPage([pageWidth, pageHeight], landscape ? 'landscape' : 'portrait');
    const padding = options.paper === 'a4' ? 8 : 0;
    const availableWidth = pageWidth - padding * 2; const availableHeight = pageHeight - padding * 2;
    const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
    const drawWidth = canvas.width * scale; const drawHeight = canvas.height * scale;
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
