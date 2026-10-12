const OPENROUTER_IMAGE_URL = 'https://openrouter.ai/api/v1/images';
const OPENROUTER_IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/images/models';
const IMAGE_TIMEOUT_MS = 65_000;
const IMAGE_CATALOG_TIMEOUT_MS = 10_000;
const IMAGE_CATALOG_TTL_MS = 60_000;

type ImageModelCatalogItem = {
  id: string;
  name?: string;
  architecture?: { input_modalities?: unknown; output_modalities?: unknown };
  supported_parameters?: Record<string, unknown>;
};
type ImageModelCatalog = { data?: unknown };
let imageCatalogCache: { data: ImageModelCatalogItem[]; expiresAt: number } | null = null;

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

type ImageModelConfig = { model: string; paid: boolean };

function configuredImageModel(): ImageModelConfig {
  const freeModel = String(process.env.OPENROUTER_FREE_IMAGE_MODEL ?? '').trim();
  const paidModel = String(process.env.OPENROUTER_IMAGE_MODEL ?? '').trim();
  const billingEnabled = String(process.env.ORBIT_IMAGE_BILLING_ENABLED ?? '').trim().toLowerCase() === 'true';

  if (freeModel) {
    if (!freeModel.endsWith(':free')) throw new Error('OPENROUTER_FREE_IMAGE_MODEL precisa terminar em :free.');
    return { model: freeModel, paid: false };
  }
  if (billingEnabled) {
    if (!paidModel) throw new Error('ORBIT_IMAGE_BILLING_ENABLED está ativo, mas OPENROUTER_IMAGE_MODEL não foi configurado.');
    if (paidModel.endsWith(':free')) return { model: paidModel, paid: false };
    return { model: paidModel, paid: true };
  }
  if (paidModel) throw new Error('O modelo de imagem configurado pode gerar custos. Defina ORBIT_IMAGE_BILLING_ENABLED=true no servidor somente após autorizar o uso faturável.');
  throw new Error('Geração de imagem remota ainda não está configurada. Não há modelo gratuito selecionado; configure um OPENROUTER_FREE_IMAGE_MODEL real ou autorize explicitamente um modelo pago no servidor.');
}

export function getImageGenerationStatus() {
  const freeModel = String(process.env.OPENROUTER_FREE_IMAGE_MODEL ?? '').trim();
  const paidModel = String(process.env.OPENROUTER_IMAGE_MODEL ?? '').trim();
  const billingEnabled = String(process.env.ORBIT_IMAGE_BILLING_ENABLED ?? '').trim().toLowerCase() === 'true';
  const hasKey = Boolean(String(process.env.OPENROUTER_API_KEY ?? '').trim());
  const validFreeModel = freeModel.length > 0 && freeModel.endsWith(':free');
  const enabledFree = validFreeModel && hasKey;
  const enabledPaid = !freeModel && Boolean(paidModel) && billingEnabled && hasKey;
  const enabled = enabledFree || enabledPaid;
  const mode = enabledFree ? 'free' : enabledPaid ? 'paid' : 'unavailable';
  const message = enabledFree
    ? 'Modelo de imagem definido como gratuito; a disponibilidade será verificada no catálogo do provedor.'
    : enabledPaid
      ? 'Modelo faturável configurado no servidor. Cada solicitação remota pode gerar custos.'
      : !hasKey
        ? 'A geração remota aguarda a configuração segura da chave OpenRouter no servidor.'
        : paidModel && !billingEnabled
          ? 'Há um modelo potencialmente pago configurado, mas o faturamento está bloqueado por segurança.'
          : freeModel && !validFreeModel
            ? 'A configuração do modelo gratuito é inválida; o nome precisa terminar em :free.'
            : 'Geração remota não configurada. Escolha um modelo de imagem real ou continue com aprimoramento local.';
  return {
    enabled,
    mode,
    billingEnabled: enabledPaid,
    modelConfigured: Boolean(freeModel || paidModel),
    enhancementAvailable: Boolean(String(process.env.REAL_ESRGAN_ENDPOINT ?? '').trim()),
    editAvailable: false,
    model: enabled ? (enabledFree ? freeModel : paidModel) : undefined,
    message,
  };
}

function parameterValues(model: ImageModelCatalogItem, name: string): string[] {
  const parameter = model.supported_parameters?.[name];
  if (!parameter || typeof parameter !== 'object' || !Array.isArray((parameter as { values?: unknown }).values)) return [];
  return ((parameter as { values: unknown[] }).values).filter((value): value is string => typeof value === 'string');
}

function hasParameter(model: ImageModelCatalogItem, name: string): boolean {
  return Boolean(model.supported_parameters && Object.prototype.hasOwnProperty.call(model.supported_parameters, name));
}

async function fetchImageCatalog(): Promise<ImageModelCatalogItem[]> {
  if (imageCatalogCache && imageCatalogCache.expiresAt > Date.now()) return imageCatalogCache.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_CATALOG_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_IMAGE_MODELS_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Não foi possível consultar o catálogo OpenRouter (HTTP ${response.status}).`);
    const root = await response.json() as ImageModelCatalog;
    if (!Array.isArray(root.data)) throw new Error('O catálogo de imagens retornou uma resposta inválida.');
    const data = root.data.filter((item): item is ImageModelCatalogItem =>
      Boolean(item && typeof item === 'object' && typeof (item as ImageModelCatalogItem).id === 'string'),
    );
    imageCatalogCache = { data, expiresAt: Date.now() + IMAGE_CATALOG_TTL_MS };
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function configuredCatalogModel(modelId: string): Promise<ImageModelCatalogItem> {
  const catalog = await fetchImageCatalog();
  const model = catalog.find((item) => item.id === modelId);
  if (!model) throw new Error(`O modelo de imagem “${modelId}” não aparece no catálogo atual do OpenRouter. Revise OPENROUTER_IMAGE_MODEL.`);
  const architecture = model.architecture;
  const outputs = architecture && Array.isArray(architecture.output_modalities) ? architecture.output_modalities : [];
  if (!outputs.includes('image')) throw new Error('O modelo selecionado não declara saída de imagem no catálogo OpenRouter.');
  return model;
}

export async function getVerifiedImageGenerationStatus() {
  const status = getImageGenerationStatus();
  if (!status.enabled || !status.model) return status;
  try {
    const model = await configuredCatalogModel(status.model);
    const editAvailable = hasParameter(model, 'input_references');
    const isProcessorConfigured = Boolean(String(process.env.REAL_ESRGAN_ENDPOINT ?? '').trim());
    return {
      ...status,
      enabled: true,
      editAvailable,
      enhancementAvailable: isProcessorConfigured || editAvailable,
      message: status.mode === 'paid'
        ? `Modelo de imagem validado no catálogo (${status.model}). Geração remota é faturável e exige confirmação.`
        : `Modelo gratuito validado no catálogo (${status.model}).`,
    };
  } catch (error) {
    const reason = compactError(error);
    return {
      ...status,
      enabled: false,
      mode: 'unavailable' as const,
      billingEnabled: false,
      editAvailable: false,
      enhancementAvailable: Boolean(String(process.env.REAL_ESRGAN_ENDPOINT ?? '').trim()),
      message: reason || 'Não foi possível validar o modelo de imagem no catálogo.',
    };
  }
}
function apiKey(): string {
  const key = String(process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!key) throw new Error('OPENROUTER_API_KEY não está configurada.');
  return key;
}

function ratioValue(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : null;
}

function requestedImageParameters(body: ImageBody, model: ImageModelCatalogItem): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  const width = Number(body.width);
  const height = Number(body.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const targetRatio = width / height;
    const ratios = parameterValues(model, 'aspect_ratio').filter((value) => value === 'auto' || ratioValue(value) !== null);
    if (ratios.length) {
      const nearest = ratios
        .map((value) => ({ value, ratio: ratioValue(value) }))
        .filter((entry): entry is { value: string; ratio: number } => entry.ratio !== null)
        .sort((a, b) => Math.abs(Math.log(a.ratio / targetRatio)) - Math.abs(Math.log(b.ratio / targetRatio))[0];
      parameters.aspect_ratio = nearest?.value || (ratios.includes('auto') ? 'auto' : ratios[0]);
    }

    const requestedLongEdge = Math.max(width, height);
    const requestedTier = requestedLongEdge >= 3000 ? '4K' : requestedLongEdge >= 1400 ? '2K' : '1K';
    const resolutionValues = parameterValues(model, 'resolution');
    if (resolutionValues.length) {
      const desiredIndex = ['512', '1K', '2K', '4K'].indexOf(requestedTier);
      parameters.resolution = resolutionValues
        .slice()
        .sort((a, b) => Math.abs(['512', '1K', '2K', '4K'].indexOf(a) - desiredIndex) - Math.abs(['512', '1K', '2K', '4K'].indexOf(b) - desiredIndex))[0];
    }
  }

  const requestedQuality = body.quality === 'high' || body.quality === 'pro'
    ? 'high'
    : body.quality === 'fast' ? 'low' : 'auto';
  const qualities = parameterValues(model, 'quality');
  if (qualities.length) {
    parameters.quality = qualities.includes(requestedQuality) ? requestedQuality : qualities.includes('auto') ? 'auto' : qualities[0];
  }
  if (hasParameter(model, 'output_format')) {
    const formats = parameterValues(model, 'output_format');
    parameters.output_format = formats.includes('png') ? 'png' : formats[0] || 'png';
  }
  return parameters;
}

async function openRouterImageRequest(prompt: string, body: ImageBody, inputImage?: string) {
  const { model, paid } = configuredImageModel();
  const modelInfo = await configuredCatalogModel(model);
  if (inputImage && !hasParameter(modelInfo, 'input_references')) {
    throw new Error('O modelo está disponível para geração, mas não aceita edição por imagem de referência. Escolha um modelo com input_references no catálogo.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const payload: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      ...requestedImageParameters(body, modelInfo),
      provider: {
        allow_fallbacks: false,
      },
    };
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
    if (!paid && Number.isFinite(cost) && cost > 0) {
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
      model,
      freeOnly: !paid,
      billingMode: paid ? 'paid' : 'free',
      warning: paid ? 'Este processamento foi roteado para um modelo faturável autorizado no servidor.' : undefined,
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
      billingMode: 'configured-processor',
      warning: 'Processador remoto configurado pelo administrador. A política de custos desse serviço depende da implantação.',
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
