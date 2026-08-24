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

type OcrImplementation = typeof import('./ocrEngineImpl');

let implementationPromise: Promise<OcrImplementation> | null = null;

function loadOcrImplementation() {
  if (!implementationPromise) implementationPromise = import('./ocrEngineImpl');
  return implementationPromise;
}

export async function extractTextFromImageAdvanced(
  file: File,
  options: OcrOptions = {},
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const implementation = await loadOcrImplementation();
  return implementation.extractTextFromImageAdvanced(file, options, onProgress);
}

export async function extractTextFromPdfAdvanced(
  file: File,
  options: OcrOptions = {},
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const implementation = await loadOcrImplementation();
  return implementation.extractTextFromPdfAdvanced(file, options, onProgress);
}

export async function processFileOcr(
  file: File,
  options: OcrOptions = {},
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const implementation = await loadOcrImplementation();
  return implementation.processFileOcr(file, options, onProgress);
}
