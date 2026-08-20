import {
  compactError,
  editImage as editImageLegacy,
  generateImage as generateImageLegacy,
} from './ai.js';
import { resolveGatewayCredential, type GatewayCredential } from './gatewayAuth.js';

const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';
const GATEWAY_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';
const IMAGE_TIMEOUT_MS = 55_000;

function normalizeImageUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.startsWith('data:image/') ? value : '';
}

async function gatewayImageRequest(messages: any[], credential?: GatewayCredential) {
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
        model: GATEWAY_IMAGE_MODEL,
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
          model: typeof data?.model === 'string' ? data.model : GATEWAY_IMAGE_MODEL,
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

export async function generateImageResilient(body: any) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 8_000) throw new Error('Descrição de imagem inválida ou grande demais.');

  const credential = await resolveGatewayCredential();
  if (credential.token) {
    try {
      return await gatewayImageRequest([
        { role: 'user', content: prompt },
      ], credential);
    } catch (error) {
      const legacy = await generateImageLegacy(body);
      return {
        ...legacy,
        fallbackUsed: true,
        fallbackReason: compactError(error),
      };
    }
  }

  return generateImageLegacy(body);
}

export async function editImageResilient(body: any) {
  const image = normalizeImageUrl(body?.image);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!image || !prompt) throw new Error('Imagem e instrução de edição são obrigatórias.');
  if (image.length > 11_000_000) throw new Error('A imagem é grande demais para edição neste endpoint.');
  if (prompt.length > 8_000) throw new Error('A instrução de edição é grande demais.');

  const credential = await resolveGatewayCredential();
  if (credential.token) {
    try {
      return await gatewayImageRequest([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Edite esta imagem seguindo exatamente a instrução. Preserve composição, identidade visual e detalhes que não foram solicitados para mudar. Instrução: ${prompt}`,
            },
            {
              type: 'image_url',
              image_url: { url: image },
            },
          ],
        },
      ], credential);
    } catch (gatewayError) {
      try {
        const legacy = await editImageLegacy(body);
        return {
          ...legacy,
          fallbackUsed: true,
          fallbackReason: compactError(gatewayError),
        };
      } catch (legacyError) {
        throw new Error(`Edição indisponível. Gateway: ${compactError(gatewayError)}; Gemini direto: ${compactError(legacyError)}`);
      }
    }
  }

  return editImageLegacy(body);
}
