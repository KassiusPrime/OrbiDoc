const OPENROUTER_IMAGE_URL = 'https://openrouter.ai/api/v1/images';
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

type OpenRouterImageResponse = {
  data?: Array<{ b64_json?: unknown; media_type?: unknown }>;
  usage?: { cost?: unknown };
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

function configuredFreeImageModel(): string {
  const model = String(process.env.OPENROUTER_FREE_IMAGE_MODEL ?? '').trim();
  if (!model) {
    throw new Error('Geração de imagem remota está desativada: em 2026-09-01 o OpenRouter não oferece modelo de imagem :free. O Orbit não fará fallback para um modelo pago.');
  }
  if (!model.endsWith(':free')) {
    throw new Error(`PAID_IMAGE_MODEL_FORBIDDEN: ${model}`);
  }
  return model;
}

function apiKey(): string {
  const key = String(process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!key) throw new Error('OPENROUTER_API_KEY não está configurada.');
  return key;
}

function requestedSize(body: ImageBody): string | undefined {
  const width = Number(body.width);
  const height = Number(body.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  const safeWidth = Math.max(256, Math.min(4096, Math.round(width)));
  const safeHeight = Math.max(256, Math.min(4096, Math.round(height)));
  return `${safeWidth}x${safeHeight}`;
}

async function openRouterImageRequest(prompt: string, body: ImageBody, inputImage?: string) {
  const model = configuredFreeImageModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const payload: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      output_format: 'png',
      quality: body.quality === 'high' ? 'high' : 'auto',
      provider: {
        allow_fallbacks: false,
        max_price: { prompt: 0, completion: 0 },
      },
    };
    const size = requestedSize(body);
    if (size) payload.size = size;
    if (inputImage) {
      payload.input_references = [{ type: 'image_url', image_url: { url: inputImage } }];
    }

    const response = await fetch(OPENROUTER_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        'X-Title': 'Orbit · OrbiDoc Media',
        'HTTP-Referer': String(process.env.ORBIT_PUBLIC_URL ?? 'https://orbidoc.app'),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenRouter Image ${response.status}: ${text.slice(0, 260)}`);

    const root = JSON.parse(text) as OpenRouterImageResponse;
    const rawCost = root.usage?.cost;
    const cost = typeof rawCost === 'number' ? rawCost : typeof rawCost === 'string' ? Number(rawCost) : 0;
    if (Number.isFinite(cost) && cost > 0) {
      throw new Error(`ZERO_COST_INVARIANT_VIOLATED: OpenRouter reportou custo ${cost} para ${model}.`);
    }
    const first = root.data?.[0];
    const base64 = typeof first?.b64_json === 'string' ? first.b64_json : '';
    if (!base64) throw new Error('OpenRouter não retornou bytes de imagem.');
    const mediaType = typeof first?.media_type === 'string' && first.media_type.startsWith('image/') ? first.media_type : 'image/png';
    return {
      imageUrl: `data:${mediaType};base64,${base64}`,
      provider: 'openrouter',
      assistant: 'Nexus AI',
      freeOnly: true,
      fallbackUsed: false,
    };
  } finally {
    clearTimeout(timeout);
  }
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

export async function generateImageResilient(rawBody: unknown) {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as ImageBody;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 8_000) throw new Error('Descrição de imagem inválida ou grande demais.');
  return openRouterImageRequest(prompt, body);
}

export async function editImageResilient(rawBody: unknown) {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as ImageBody;
  const image = normalizeImageUrl(body.image);
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!image || !prompt) throw new Error('Imagem e instrução de edição são obrigatórias.');
  if (image.length > 11_000_000) throw new Error('A imagem é grande demais para edição neste endpoint.');
  if (prompt.length > 8_000) throw new Error('A instrução de edição é grande demais.');
  return openRouterImageRequest(
    `Edite a imagem de referência seguindo exatamente esta instrução, preservando tudo que não foi solicitado para mudar: ${prompt}`,
    body,
    image,
  );
}

export async function enhanceImageResilient(rawBody: unknown) {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as ImageBody;
  const image = normalizeImageUrl(body.image);
  if (!image) throw new Error('Envie uma imagem válida para restauração.');
  if (image.length > 11_000_000) throw new Error('A imagem é grande demais para restauração neste endpoint.');
  const profile = body.profile === 'anime' || body.profile === 'document' ? body.profile : 'photo';
  const scale: 2 | 4 = Number(body.scale) === 4 ? 4 : 2;

  try {
    const local = await configuredRealEsrgan(image, scale, profile);
    if (local) return local;
  } catch (error) {
    console.warn(JSON.stringify({ event: 'media.realesrgan.fail', error: compactError(error) }));
  }

  const hint = profile === 'anime'
    ? 'Preserve line art, cel shading, cores e traços originais; não redesenhe personagens.'
    : profile === 'document'
      ? 'Preserve texto e geometria exatamente; reduza ruído sem inventar letras ou símbolos.'
      : 'Preserve rostos, identidade, textura, composição e objetos; reduza ruído sem alterar a cena.';

  return openRouterImageRequest(
    `Restaure a imagem de referência com alta fidelidade. ${hint} Melhore nitidez e artefatos de compressão, sem adicionar conteúdo.`,
    body,
    image,
  );
}
