import {
  convertFile as convertFileCore,
  getFileExtension as getCoreFileExtension,
  getSupportedOutputs as getCoreSupportedOutputs,
  isSupportedInput as isCoreSupportedInput,
} from './fileConversionV2';
import type {
  ConvertibleFormat as CoreConvertibleFormat,
  ConversionOptions as CoreConversionOptions,
  ConversionResult as CoreConversionResult,
} from './fileConversionV2';
import { convertImageWithMagick } from './imageMagickRuntime';

export type ConvertibleFormat = CoreConvertibleFormat;
export type ConversionOptions = CoreConversionOptions;
export type ConversionResult = CoreConversionResult;

const CORE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'webp', 'avif']);
const UNIVERSAL_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'jpe', 'jfif', 'webp', 'avif', 'apng',
  'gif', 'bmp', 'dib', 'svg', 'ico', 'cur',
  'tif', 'tiff', 'heic', 'heif', 'hif', 'jxl',
  'jp2', 'j2k', 'jpf', 'jpx', 'jpm',
  'psd', 'psb', 'dds', 'tga', 'exr', 'hdr',
  'ppm', 'pgm', 'pbm', 'pnm', 'pcx', 'qoi', 'xcf',
  'sgi', 'ras', 'sun', 'xbm', 'xpm', 'wpg',
  'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf', 'srw', 'pef', 'raw',
]);
const IMAGE_OUTPUTS: CoreConvertibleFormat[] = ['png', 'jpg', 'webp', 'avif', 'pdf', 'txt', 'html', 'docx'];

const cleanBaseName = (name: string) =>
  name.replace(/\.[^/.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'imagem';

function rawExtension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

export function getFileExtension(file: File): string {
  const extension = rawExtension(file);
  if (extension === 'jpeg' || extension === 'jpe' || extension === 'jfif') return 'jpg';
  if (extension === 'tif') return 'tiff';
  if (extension === 'heif' || extension === 'hif') return 'heic';
  return extension;
}

export function isUniversalImageInput(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/') || UNIVERSAL_IMAGE_EXTENSIONS.has(rawExtension(file));
}

export function getSupportedOutputs(file: File): CoreConvertibleFormat[] {
  if (isUniversalImageInput(file)) {
    const extension = getFileExtension(file);
    return IMAGE_OUTPUTS.filter((format) => format !== extension);
  }
  return getCoreSupportedOutputs(file);
}

export function isSupportedInput(file: File): boolean {
  return isUniversalImageInput(file) || isCoreSupportedInput(file);
}

function withOriginalBase(result: CoreConversionResult, source: File): CoreConversionResult {
  const extension = result.fileName.split('.').pop();
  if (!extension) return result;
  return { ...result, fileName: `${cleanBaseName(source.name)}.${extension}` };
}

async function convertUniversalImage(
  file: File,
  target: CoreConvertibleFormat,
  options: CoreConversionOptions,
  priorError?: unknown,
): Promise<CoreConversionResult> {
  const base = cleanBaseName(file.name);
  const warnings = [
    'Conversão realizada localmente pelo motor universal ImageMagick WebAssembly; o arquivo não foi enviado a um servidor.',
  ];
  if (priorError) {
    const reason = String((priorError as any)?.message || priorError || '').replace(/\s+/g, ' ').trim();
    if (reason) warnings.push(`O decodificador nativo não conseguiu concluir a operação; foi usado o motor universal (${reason.slice(0, 160)}).`);
  }

  if (target === 'png' || target === 'jpg' || target === 'webp' || target === 'avif') {
    const blob = await convertImageWithMagick(file, target, options);
    const mimeType = target === 'jpg' ? 'image/jpeg' : `image/${target}`;
    return { blob, fileName: `${base}.${target}`, mimeType, warnings };
  }

  const pngBlob = await convertImageWithMagick(file, 'png', options);
  const normalized = new File([pngBlob], `${base}.png`, { type: 'image/png', lastModified: file.lastModified });
  const result = await convertFileCore(normalized, target, options);
  return {
    ...withOriginalBase(result, file),
    warnings: [...warnings, ...result.warnings],
  };
}

/**
 * Stable public conversion API.
 *
 * Common browser-native image formats keep the fast V2 path. If that path is
 * unavailable, or when the input is a broader image format (HEIC/HEIF, TIFF,
 * GIF, BMP, SVG, ICO, PSD, JPEG XL, JPEG 2000, EXR and many others), OrbiDoc
 * falls back to ImageMagick WASM in the browser.
 */
export async function convertFile(
  file: File,
  target: CoreConvertibleFormat,
  options: CoreConversionOptions = {},
): Promise<CoreConversionResult> {
  if (!isUniversalImageInput(file)) return convertFileCore(file, target, options);

  const coreExtension = getCoreFileExtension(file);
  if (CORE_IMAGE_EXTENSIONS.has(coreExtension) && getCoreSupportedOutputs(file).includes(target)) {
    try {
      return await convertFileCore(file, target, options);
    } catch (error) {
      return convertUniversalImage(file, target, options, error);
    }
  }

  if (!IMAGE_OUTPUTS.includes(target)) {
    throw new Error(`A saída ${target.toUpperCase()} não é compatível com este formato de imagem.`);
  }
  return convertUniversalImage(file, target, options);
}
