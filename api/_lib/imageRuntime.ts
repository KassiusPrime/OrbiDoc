import {
  compactError,
  editImage as editImageLegacy,
  generateImage as generateImageLegacy,
} from './ai.js';
import { resolveGatewayCredential, type GatewayCredential } from './gatewayAuth.js';

const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';
const FAST_IMAGE_MODEL = 'google/gemini-3.1-flash-image';
const PRO_IMAGE_MODEL = 'google/gemini-3-pro-image';
const IMAGE_TIMEOUT_MS = 65_000;

function normalizeImageUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.startsWith('data:image/') ? value : '';
}

function resolveImageModel(body: any) {
  const requested = typeof body?.quality === 'string' ? body.quality.toLowerCase() : '';
  return requested === 'pro' || requested === 'max' || requested === 'high' ? PRO_IMAGE_MODEL : FAST_IMAGE_MODEL;
}

async function gatewayImageRequest(messages: any[], model: string, credential?: GatewayCredential) {
  const auth = credential || await resolveGatewayCredential();
  if (!auth.token) throw new Error('Vercel AI Gateway não está autenticado.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
        'X-Vercel-AI-Gateway-App': 'OrbiDoc',
      },
      body: JSON.stringify({
        model,
        messages,
        modalities: ['image'],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI Gateway Image ${response.status}: ${(await response.text()).slice(0, 220)}`);
    }

    const data: any = await response.json();
    const images = data?.choices?.[0]?.message?.images;
    if (!Array.isArray(images)) throw new Error('AI Gateway não retornou uma imagem.');

    for (const image of images) {
      const url = normalizeImageUrl(image?.image_url?.url);
      if (url) {
        return {
          imageUrl: url,
          provider: 'gateway',
          model: typeof data?.model === 'string' ? data.model : model,
          requestId: typeof data?.id === 'string' ? data.id : undefined,
          gatewayAuth: auth.mode,
          fallbackUsed: false,
        };
      }
    }

    throw new Error('AI Gateway retornou uma resposta sem imagem utilizável.');
  } finally {
    clearTimeout(timeout);
  }
}

async function configuredRealEsrgan(image: string, scale: 2 | 4, profile: string) {
  const endpoint = process.env.REAL_ESRGAN_ENDPOINT?.trim();
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
        faceEnhance: profile === 'photo',
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Real-ESRGAN ${response.status}: ${(await response.text()).slice(0, 180)}`);
    const data: any = await response.json();
    const imageUrl = normalizeImageUrl(data?.imageUrl || data?.image || data?.output);
    if (!imageUrl) throw new Error('O serviço Real-ESRGAN não retornou uma imagem data URL válida.');
    return {
      imageUrl,
      provider: 'real-esrgan',
      model: profile === 'anime' ? 'RealESRGAN_x4plus_anime_6B' : 'realesr-general-x4v3',
      fallbackUsed: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateImageResilient(body: any) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 8_000) throw new Error('Descrição de imagem inválida ou grande demais.');

  const model = resolveImageModel(body);
  const width = Number(body?.width) || 1024;
  const height = Number(body?.height) || 1024;
  const composedPrompt = `${prompt}\n\nFormato desejado: ${width}×${height}. Preserve composição limpa, alta definição, anatomia coerente e detalhes nítidos; evite artefatos, texto aleatório e deformações.`;
  const credential = await resolveGatewayCredential();
  if (credential.token) {
    try {
      return await gatewayImageRequest([{ role: 'user', content: composedPrompt }], model, credential);
    } catch (error) {
      const legacy = await generateImageLegacy({ ...body, prompt: composedPrompt });
      return {
        ...legacy,
        fallbackUsed: true,
        fallbackReason: compactError(error),
      };
    }
  }

  return generateImageLegacy({ ...body, prompt: composedPrompt });
}

export async function editImageResilient(body: any) {
  const image = normalizeImageUrl(body?.image);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!image || !prompt) throw new Error('Imagem e instrução de edição são obrigatórias.');
  if (image.length > 11_000_000) throw new Error('A imagem é grande demais para edição neste endpoint.');
  if (prompt.length > 8_000) throw new Error('A instrução de edição é grande demais.');

  const model = resolveImageModel(body);
  const credential = await resolveGatewayCredential();
  if (credential.token) {
    try {
      return await gatewayImageRequest([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Edite esta imagem seguindo exatamente a instrução. Preserve identidade, enquadramento, proporções e todos os detalhes que não foram solicitados para mudar. Produza acabamento limpo e alta definição. Instrução: ${prompt}`,
            },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ], model, credential);
    } catch (gatewayError) {
      try {
        const legacy = await editImageLegacy(body);
        return {
          ...legacy,
          fallbackUsed: true,
          fallbackReason: compactError(gatewayError),
        };
      } catch (legacyError) {
        throw new Error(`Edição indisponível. Gateway: ${compactError(gatewayError)}; fallback: ${compactError(legacyError)}`);
      }
    }
  }

  return editImageLegacy(body);
}

export async function enhanceImageResilient(body: any) {
  const image = normalizeImageUrl(body?.image);
  if (!image) throw new Error('Envie uma imagem válida para restauração.');
  if (image.length > 11_000_000) throw new Error('A imagem é grande demais para restauração neste endpoint.');
  const profile = ['photo', 'anime', 'document'].includes(body?.profile) ? body.profile : 'photo';
  const scale: 2 | 4 = Number(body?.scale) === 4 ? 4 : 2;

  try {
    const restored = await configuredRealEsrgan(image, scale, profile);
    if (restored) return restored;
  } catch (error) {
    // Continue with the generative restoration fallback. The response discloses the model/provider.
    console.warn('Configured Real-ESRGAN restoration failed:', compactError(error));
  }

  const credential = await resolveGatewayCredential();
  if (!credential.token) throw new Error('Restauração IA requer AI Gateway ou um REAL_ESRGAN_ENDPOINT configurado.');
  const profileHint = profile === 'anime'
    ? 'Preserve line art, cel shading, cores e traços originais de anime; não redesenhe personagens.'
    : profile === 'document'
      ? 'Preserve texto e geometria exatamente; reduza ruído e compressão sem inventar letras ou símbolos.'
      : 'Preserve rostos, identidade, textura e composição; reduza ruído e artefatos sem alterar pessoas ou objetos.';

  const result = await gatewayImageRequest([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Restaure esta imagem para alta definição. ${profileHint} Aumente nitidez aparente e legibilidade, corrija artefatos de compressão e preserve fielmente o conteúdo. Não adicione objetos, não mude pose, roupa, texto, cenário ou identidade. Saída pretendida: aproximadamente ${scale}× a resolução percebida.`,
        },
        { type: 'image_url', image_url: { url: image } },
      ],
    },
  ], PRO_IMAGE_MODEL, credential);

  return {
    ...result,
    restorationMode: 'generative',
    warning: 'Restauração por IA generativa pode reconstruir detalhes finos. Compare com o original antes de substituir um arquivo importante.',
  };
}
