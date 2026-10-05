import { assertBase64UploadSize } from './uploadLimits.js';

const IMAGE_TIMEOUT_MS = 65_000;

type ImageBody = {
  prompt?: unknown;
  image?: unknown;
  width?: unknown;
  height?: unknown;
  quality?: unknown;
  profile?: unknown;
  scale?: unknown;
};

function compactError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? 'Falha desconhecida'))
    .replace(/\s+/g, ' ')
    .slice(0, 360);
}

function normalizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value) ? value : '';
}

async function configuredRealEsrgan(image: string, scale: 2 | 4, profile: string) {
  const endpoint = String(process.env.REAL_ESRGAN_ENDPOINT ?? '').trim();
  if (!endpoint) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.REAL_ESRGAN_TOKEN ? { Authorization: `Bearer ${process.env.REAL_ESRGAN_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        image,
        scale,
        model: profile === 'anime' ? 'RealESRGAN_x4plus_anime_6B' : 'realesr-general-x4v3',
        faceEnhance: false,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Real-ESRGAN ${response.status}: ${text.slice(0, 180)}`);
    const data = JSON.parse(text) as { imageUrl?: unknown; image?: unknown; output?: unknown };
    const imageUrl = normalizeImageUrl(data.imageUrl || data.image || data.output);
    if (!imageUrl) throw new Error('Real-ESRGAN não retornou uma imagem data URL válida.');
    return {
      imageUrl,
      provider: 'local-media-processor',
      model: profile === 'anime' ? 'RealESRGAN_x4plus_anime_6B' : 'realesr-general-x4v3',
      freeOnly: true,
      fallbackUsed: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function imageFeatureDisabled(action: 'geração' | 'edição'): never {
  throw new Error(`${action} de imagens está desativada no runtime self-hosted. Configure um processador local compatível antes de habilitar esta função.`);
}

export async function generateImageResilient(_rawBody: unknown) {
  return imageFeatureDisabled('geração');
}

export async function editImageResilient(_rawBody: unknown) {
  return imageFeatureDisabled('edição');
}

export async function enhanceImageResilient(rawBody: unknown) {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as ImageBody;
  const image = normalizeImageUrl(body.image);
  if (!image) throw new Error('Envie uma imagem válida para restauração.');
  assertBase64UploadSize(image, 'A imagem');
  const profile = body.profile === 'anime' || body.profile === 'document' ? body.profile : 'photo';
  const scale: 2 | 4 = Number(body.scale) === 4 ? 4 : 2;

  try {
    const local = await configuredRealEsrgan(image, scale, profile);
    if (local) return local;
  } catch (error) {
    throw new Error(`Real-ESRGAN indisponível: ${compactError(error)}`);
  }

  throw new Error('Restauração de imagem está indisponível: configure REAL_ESRGAN_ENDPOINT no servidor.');
}
