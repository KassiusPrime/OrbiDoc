import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface OcrOptions {
  language?: string; // 'por+eng', 'por', 'eng', 'es', 'fr', 'de'
  enhanceContrast?: boolean;
  forceOcrPdf?: boolean;
  onProgress?: (progress: number) => void;
}

export interface OcrProgress {
  progress: number; // 0 to 100
  statusText?: string;
  currentPage?: number;
  totalPages?: number;
}

/**
 * Pre-processa uma imagem ajustando contraste e escala de cinza em canvas
 * para aumentar consideravelmente a taxa de acerto do Tesseract OCR.
 */
async function preprocessImageToBlob(
  file: File,
  enhanceContrast = true
): Promise<Blob | File> {
  if (!enhanceContrast) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Aplicar filtro Grayscale e Aumento de Contraste Binarizado
      for (let i = 0; i < data.length; i += 4) {
        // Luminância média
        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        
        // Aumentar contraste (S-curve ou limiar dinâmico)
        let v = avg;
        if (v < 128) {
          v = Math.max(0, v - 30);
        } else {
          v = Math.min(255, v + 30);
        }

        data[i] = v;     // R
        data[i + 1] = v; // G
        data[i + 2] = v; // B
      }

      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob((blob) => {
        resolve(blob || file);
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Extração de Imagem com Tesseract avançado
 */
export async function extractTextFromImageAdvanced(
  file: File,
  options: OcrOptions = {},
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const lang = options.language || 'por+eng';
  
  if (onProgress) {
    onProgress({ progress: 10, statusText: 'Otimizando qualidade da imagem...' });
  }

  const processedBlob = await preprocessImageToBlob(file, options.enhanceContrast ?? true);

  if (onProgress) {
    onProgress({ progress: 25, statusText: 'Iniciando motor OCR Tesseract...' });
  }

  const result = await Tesseract.recognize(
    processedBlob,
    lang,
    {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const p = 25 + Math.round(m.progress * 75);
          onProgress({
            progress: p,
            statusText: `Processando OCR (${Math.round(m.progress * 100)}%)...`,
          });
        }
      },
    }
  );

  return result.data.text.trim();
}

/**
 * Extração de PDF Avançada
 * Tenta extração direta de texto. Se for PDF escaneado (imagem), renderiza cada página
 * em canvas de alta resolução (2.0x) e executa OCR via Tesseract!
 */
export async function extractTextFromPdfAdvanced(
  file: File,
  options: OcrOptions = {},
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    if (onProgress) {
      onProgress({ progress: 5, statusText: `Analisando PDF (${totalPages} página(s))...`, totalPages });
    }

    let fullText = '';
    let needsOcrCount = 0;
    const pageTexts: { pageNum: number; text: string; isScanned: boolean }[] = [];

    // Passo 1: Tentar extrair texto digital
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items.map((s: any) => s.str).join(' ').trim();

      // Se a página tem menos de 20 caracteres significativos, é provável que seja escaneada
      const isScanned = options.forceOcrPdf || text.length < 20;
      if (isScanned) needsOcrCount++;

      pageTexts.push({ pageNum, text, isScanned });
    }

    // Se a maioria das páginas tiver texto nativo e forceOcrPdf for falso
    if (needsOcrCount === 0 && !options.forceOcrPdf) {
      if (onProgress) onProgress({ progress: 100, statusText: 'Extração concluída' });
      return pageTexts
        .map((p) => (totalPages > 1 ? `--- Página ${p.pageNum} ---\n${p.text}` : p.text))
        .join('\n\n');
    }

    // Passo 2: Para páginas escaneadas (ou todas se forceOcrPdf), renderizar em Canvas e fazer OCR
    const lang = options.language || 'por+eng';

    for (let i = 0; i < pageTexts.length; i++) {
      const p = pageTexts[i];
      const pageNum = p.pageNum;

      const baseProgress = Math.round((i / totalPages) * 90);

      if (!p.isScanned && !options.forceOcrPdf) {
        fullText += (totalPages > 1 ? `--- Página ${pageNum} ---\n` : '') + p.text + '\n\n';
        continue;
      }

      if (onProgress) {
        onProgress({
          progress: baseProgress + 5,
          statusText: `Renderizando Página ${pageNum} de ${totalPages} para OCR...`,
          currentPage: pageNum,
          totalPages,
        });
      }

      // Renderizar página do PDF em canvas HD
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Escala 2x para nitidez excelente
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Converter canvas para blob
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

        if (blob) {
          if (onProgress) {
            onProgress({
              progress: baseProgress + 10,
              statusText: `OCR na Página ${pageNum}/${totalPages}...`,
              currentPage: pageNum,
              totalPages,
            });
          }

          const ocrResult = await Tesseract.recognize(blob, lang, {
            logger: (m) => {
              if (m.status === 'recognizing text' && onProgress) {
                const subP = Math.round(m.progress * (80 / totalPages));
                onProgress({
                  progress: Math.min(98, baseProgress + subP),
                  statusText: `Página ${pageNum}/${totalPages}: OCR ${Math.round(m.progress * 100)}%`,
                  currentPage: pageNum,
                  totalPages,
                });
              }
            },
          });

          const extractedPageText = ocrResult.data.text.trim();
          const pageHeader = totalPages > 1 ? `--- Página ${pageNum} (OCR) ---\n` : '';
          fullText += pageHeader + (extractedPageText || p.text || '[Página vazia ou sem texto legível]') + '\n\n';
        } else {
          fullText += (totalPages > 1 ? `--- Página ${pageNum} ---\n` : '') + p.text + '\n\n';
        }
      } else {
        fullText += (totalPages > 1 ? `--- Página ${pageNum} ---\n` : '') + p.text + '\n\n';
      }
    }

    if (onProgress) onProgress({ progress: 100, statusText: 'OCR concluído com sucesso!' });
    return fullText.trim() || '[PDF sem texto extraível mesmo após OCR]';
  } catch (err: any) {
    console.error('Erro na extração de PDF:', err);
    return `[Erro ao processar PDF: ${err.message || 'Formato incompatível'}]`;
  }
}

/**
 * Função Unificada Principal para extrair texto de qualquer arquivo
 */
export async function processFileOcr(
  file: File,
  options: OcrOptions = {},
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const combinedOnProgress = (p: OcrProgress) => {
    if (onProgress) onProgress(p);
    if (options.onProgress) options.onProgress(p.progress);
  };

  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
  const TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'];

  if (IMAGE_EXTS.includes(ext)) {
    return extractTextFromImageAdvanced(file, options, combinedOnProgress);
  }

  if (ext === 'pdf') {
    return extractTextFromPdfAdvanced(file, options, combinedOnProgress);
  }

  if (TEXT_EXTS.includes(ext)) {
    if (combinedOnProgress) combinedOnProgress({ progress: 100, statusText: 'Texto Lido' });
    return file.text();
  }

  if (ext === 'docx') {
    try {
      if (onProgress) onProgress({ progress: 30, statusText: 'Extraindo documento Word...' });
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (onProgress) onProgress({ progress: 100, statusText: 'DOCX Lida' });
      return result.value || '[Documento Word vazio]';
    } catch {
      return '[Erro ao ler arquivo Word DOCX]';
    }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      if (onProgress) onProgress({ progress: 40, statusText: 'Extraindo planilha Excel...' });
      const arrayBuffer = await file.arrayBuffer();
      const wb = xlsx.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (onProgress) onProgress({ progress: 100, statusText: 'Excel Lido' });
      return xlsx.utils.sheet_to_csv(ws);
    } catch {
      return '[Erro ao ler Planilha Excel]';
    }
  }

  if (onProgress) onProgress({ progress: 100, statusText: 'Arquivo lido' });
  return file.text();
}
