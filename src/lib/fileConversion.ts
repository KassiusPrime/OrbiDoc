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
import {
  MAGICK_IMAGE_TARGETS,
  convertImageWithMagick,
  getBrowserImageMimeType,
  isBrowserImageTarget,
} from './imageMagickRuntime';
import type {
  BrowserImageConversionOptions,
  BrowserImageTarget,
} from './imageMagickRuntime';

export type ConvertibleFormat = CoreConvertibleFormat | BrowserImageTarget;
export type ConversionOptions = CoreConversionOptions & BrowserImageConversionOptions;
export type ConversionResult = CoreConversionResult;

export const UNIVERSAL_IMAGE_OUTPUTS: readonly BrowserImageTarget[] = MAGICK_IMAGE_TARGETS;

const CORE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'webp', 'avif']);
const CORE_IMAGE_TARGETS = new Set<ConvertibleFormat>(['png', 'jpg', 'webp', 'avif']);
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
const IMAGE_DOCUMENT_OUTPUTS: CoreConvertibleFormat[] = ['pdf', 'txt', 'html', 'docx'];
const IMAGE_OUTPUTS: ConvertibleFormat[] = [...MAGICK_IMAGE_TARGETS, ...IMAGE_DOCUMENT_OUTPUTS];

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

export function getSupportedOutputs(file: File): ConvertibleFormat[] {
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

function canUseFastBrowserPath(
  file: File,
  target: ConvertibleFormat,
  options: ConversionOptions,
) {
  const coreExtension = getCoreFileExtension(file);
  return CORE_IMAGE_EXTENSIONS.has(coreExtension)
    && CORE_IMAGE_TARGETS.has(target)
    && getCoreSupportedOutputs(file).includes(target as CoreConvertibleFormat)
    && !options.enhanceImage
    && !options.allowUpscale
    && options.preserveAspectRatio !== false;
}

async function convertUniversalImage(
  file: File,
  target: ConvertibleFormat,
  options: ConversionOptions,
  priorError?: unknown,
): Promise<CoreConversionResult> {
  const base = cleanBaseName(file.name);
  const warnings = [
    'Conversão de imagem realizada localmente no dispositivo; o arquivo não foi enviado a um servidor.',
  ];
  if (options.enhanceImage) {
    warnings.push('Aprimoramento automático aplicado com correção de orientação, normalização tonal e nitidez moderada.');
  }
  if (priorError) {
    const reason = String((priorError as any)?.message || priorError || '').replace(/\s+/g, ' ').trim();
    if (reason) warnings.push(`O caminho rápido do navegador não concluiu a operação; foi usado o motor universal (${reason.slice(0, 160)}).`);
  }

  if (isBrowserImageTarget(target)) {
    try {
      const blob = await convertImageWithMagick(file, target, options);
      return {
        blob,
        fileName: `${base}.${target}`,
        mimeType: getBrowserImageMimeType(target),
        warnings,
      };
    } catch (error) {
      // Keep a compatibility escape hatch for the four browser-native targets.
      if (CORE_IMAGE_TARGETS.has(target) && getCoreSupportedOutputs(file).includes(target as CoreConvertibleFormat)) {
        const fallback = await convertFileCore(file, target as CoreConvertibleFormat, options);
        return {
          ...withOriginalBase(fallback, file),
          warnings: [
            ...warnings,
            `O encoder universal não conseguiu gerar ${target.toUpperCase()}; o navegador concluiu a conversão pelo encoder nativo.`,
            ...fallback.warnings,
          ],
        };
      }
      throw error;
    }
  }

  if (!IMAGE_DOCUMENT_OUTPUTS.includes(target as CoreConvertibleFormat)) {
    throw new Error(`A saída ${String(target).toUpperCase()} não é compatível com este formato de imagem.`);
  }

  const pngBlob = await convertImageWithMagick(file, 'png', options);
  const normalized = new File([pngBlob], `${base}.png`, { type: 'image/png', lastModified: file.lastModified });
  const result = await convertFileCore(normalized, target as CoreConvertibleFormat, options);
  return {
    ...withOriginalBase(result, file),
    warnings: [...warnings, ...result.warnings],
  };
}

/**
 * Stable public conversion API.
 *
 * Common browser-native image conversions keep the lightweight Canvas path
 * when no advanced processing is requested. All broader image formats and
 * advanced resize/enhancement operations use ImageMagick WebAssembly locally.
 * Camera RAW formats remain input-only because they encode sensor-specific data
 * that cannot be recreated faithfully from an arbitrary rendered image.
 */
export async function convertFile(
  file: File,
  target: ConvertibleFormat,
  options: ConversionOptions = {},
): Promise<CoreConversionResult> {
  if (!isUniversalImageInput(file)) return convertFileCore(file, target as CoreConvertibleFormat, options);

  if (canUseFastBrowserPath(file, target, options)) {
    try {
      return await convertFileCore(file, target as CoreConvertibleFormat, options);
    } catch (error) {
      return convertUniversalImage(file, target, options, error);
    }
  }

  if (!IMAGE_OUTPUTS.includes(target)) {
    throw new Error(`A saída ${String(target).toUpperCase()} não é compatível com este formato de imagem.`);
  }
  return convertUniversalImage(file, target, options);
}
