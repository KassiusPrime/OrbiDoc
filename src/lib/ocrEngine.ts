import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { isOrbiDocNativeRuntime, nativeAssetUrl } from './nativeRuntime';

const pdfWorkerUrl = (pdfWorkerAsset as { default?: unknown }).default;
if (typeof pdfWorkerUrl === 'string' && pdfWorkerUrl) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface OcrOptions {
  language?: string;
  enhanceContrast?: boolean;
  forceOcrPdf?: boolean;
  onProgress?: (progress: number) => void;
}

export interface OcrProgress {
  progress: number;
  statusText?: string;
  currentPage?: number;
  totalPages?: number;
}

function tesseractRuntimeOptions() {
  if (!isOrbiDocNativeRuntime()) return {};
  return {
    workerPath: nativeAssetUrl('native-ocr/worker.min.js'),
    corePath: nativeAssetUrl('native-ocr/core'),
    langPath: nativeAssetUrl('native-ocr/lang'),
  };
}

async function preprocessImageToBlob(file: File, enhanceContrast = true): Promise<Blob | File> {
  if (!enhanceContrast) return file;

  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    const finish = (value: Blob | File) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        finish(file);
        return;
      }

      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let index = 0; index < data.length; index += 4) {
        const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        const contrasted = luminance < 128 ? Math.max(0, luminance - 28) : Math.min(255, luminance + 28);
        data[index] = contrasted;
        data[index + 1] = contrasted;
        data[index + 2] = contrasted;
      }
      context.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => finish(blob || file), 'image/png');
    };

    image.onerror = () => finish(file);
    image.src = url;
  });
}

export async function extractTextFromImageAdvanced(
  file: File,
  options: OcrOptions = {},
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const language = options.language || 'por+eng';
  onProgress?.({ progress: 10, statusText: 'Otimizando imagem…' });
  const processed = await preprocessImageToBlob(file, options.enhanceContrast ?? true);
  onProgress?.({ progress: 22, statusText: 'Iniciando OCR local…' });

  const result = await Tesseract.recognize(processed, language, {
    ...tesseractRuntimeOptions(),
    logger(message) {
      if (message.status === 'recognizing text') {
        onProgress?.({
          progress: 22 + Math.round(message.progress * 78),
          statusText: `Reconhecendo texto (${Math.round(message.progress * 100)}%)…`,
        });
      }
    },
  });

  onProgress?.({ progress: 100, statusText: 'OCR concluído' });
  return result.data.text.trim();
}

export async function extractTextFromPdfAdvanced(
  file: File,
  options: OcrOptions = {},
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = pdf.numPages;
  const pages: Array<{ page: number; nativeText: string; needsOcr: boolean }> = [];

  onProgress?.({ progress: 4, statusText: `Analisando ${totalPages} página(s)…`, totalPages });

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const nativeText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({
      page: pageNumber,
      nativeText,
      needsOcr: Boolean(options.forceOcrPdf) || nativeText.replace(/\s/g, '').length < 20,
    });
    onProgress?.({ progress: Math.min(25, 4 + Math.round((pageNumber / totalPages) * 21)), statusText: `Lendo estrutura ${pageNumber}/${totalPages}…`, currentPage: pageNumber, totalPages });
  }

  if (!pages.some((page) => page.needsOcr)) {
    onProgress?.({ progress: 100, statusText: 'Texto do PDF extraído' });
    return pages.map((page) => totalPages > 1 ? `--- Página ${page.page} ---\n${page.nativeText}` : page.nativeText).join('\n\n');
  }

  const language = options.language || 'por+eng';
  const resultPages: string[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const pageInfo = pages[index];
    if (!pageInfo.needsOcr) {
      resultPages.push(pageInfo.nativeText);
      continue;
    }

    const page = await pdf.getPage(pageInfo.page);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      resultPages.push(pageInfo.nativeText);
      continue;
    }

    onProgress?.({
      progress: 25 + Math.round((index / totalPages) * 65),
      statusText: `Renderizando página ${pageInfo.page}/${totalPages}…`,
      currentPage: pageInfo.page,
      totalPages,
    });

    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      resultPages.push(pageInfo.nativeText);
      continue;
    }

    const ocr = await Tesseract.recognize(blob, language, {
      ...tesseractRuntimeOptions(),
      logger(message) {
        if (message.status !== 'recognizing text') return;
        const pageShare = 65 / totalPages;
        const base = 25 + index * pageShare;
        onProgress?.({
          progress: Math.min(98, Math.round(base + message.progress * pageShare)),
          statusText: `OCR página ${pageInfo.page}/${totalPages}: ${Math.round(message.progress * 100)}%`,
          currentPage: pageInfo.page,
          totalPages,
        });
      },
    });

    resultPages.push(ocr.data.text.trim() || pageInfo.nativeText || '[Página sem texto legível]');
  }

  onProgress?.({ progress: 100, statusText: 'OCR do PDF concluído', totalPages });
  return resultPages
    .map((text, index) => totalPages > 1 ? `--- Página ${index + 1}${pages[index].needsOcr ? ' (OCR)' : ''} ---\n${text}` : text)
    .join('\n\n')
    .trim();
}

export async function processFileOcr(
  file: File,
  options: OcrOptions = {},
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const report = (progress: OcrProgress) => {
    onProgress?.(progress);
    options.onProgress?.(progress.progress);
  };

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif', 'tiff', 'tif'];
  const textExtensions = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx'];

  if (imageExtensions.includes(extension)) {
    return extractTextFromImageAdvanced(file, options, report);
  }

  if (extension === 'pdf') {
    return extractTextFromPdfAdvanced(file, options, report);
  }

  if (textExtensions.includes(extension)) {
    report({ progress: 100, statusText: 'Texto carregado' });
    return file.text();
  }

  if (extension === 'docx') {
    try {
      report({ progress: 25, statusText: 'Extraindo documento DOCX…' });
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      report({ progress: 100, statusText: 'DOCX lido' });
      return result.value || '[Documento DOCX vazio]';
    } catch (error: any) {
      throw new Error(`Falha ao ler DOCX: ${error?.message || 'arquivo incompatível'}`);
    }
  }

  if (extension === 'xlsx' || extension === 'xls') {
    try {
      report({ progress: 30, statusText: 'Extraindo planilha…' });
      const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
      const sections = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        return `--- Aba: ${sheetName} ---\n${xlsx.utils.sheet_to_csv(sheet)}`;
      });
      report({ progress: 100, statusText: 'Planilha lida' });
      return sections.join('\n\n');
    } catch (error: any) {
      throw new Error(`Falha ao ler planilha: ${error?.message || 'arquivo incompatível'}`);
    }
  }

  try {
    const text = await file.text();
    report({ progress: 100, statusText: 'Arquivo lido' });
    return text;
  } catch {
    throw new Error(`Formato .${extension || 'desconhecido'} não pode ser lido pelo OCR local.`);
  }
}
