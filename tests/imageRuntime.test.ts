import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { editImageResilient, generateImageResilient } from '../api/_lib/imageRuntime';

const originalFetch = globalThis.fetch;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const originalOidc = process.env.VERCEL_OIDC_TOKEN;

beforeEach(() => {
  process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
  delete process.env.VERCEL_OIDC_TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  if (originalOidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
  else process.env.VERCEL_OIDC_TOKEN = originalOidc;
});

function installGatewayMock(expectedImage: string) {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer test-gateway-key');
    const body = JSON.parse(String(init?.body || '{}'));
    assert.deepEqual(body.modalities, ['image']);
    assert.equal(body.model, 'google/gemini-3.1-flash-image');

    return new Response(JSON.stringify({
      id: 'chatcmpl-image-test',
      model: 'google/gemini-3.1-flash-image',
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          images: [{ type: 'image_url', image_url: { url: expectedImage } }],
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('OrbiDoc image runtime', () => {
  test('generates images through AI Gateway when authenticated', async () => {
    const expectedImage = 'data:image/png;base64,ZmFrZS1pbWFnZQ==';
    installGatewayMock(expectedImage);

    const result = await generateImageResilient({ prompt: 'Crie uma órbita minimalista.' });
    assert.equal(result.imageUrl, expectedImage);
    assert.equal(result.provider, 'gateway');
    assert.equal(result.model, 'google/gemini-3.1-flash-image');
    assert.equal(result.fallbackUsed, false);
  });

  test('edits an image through the multimodal Gateway request', async () => {
    const expectedImage = 'data:image/png;base64,ZWRpdGVkLWltYWdl';
    installGatewayMock(expectedImage);

    const result = await editImageResilient({
      image: 'data:image/png;base64,c291cmNlLWltYWdl',
      prompt: 'Troque apenas o fundo por azul escuro.',
    });

    assert.equal(result.imageUrl, expectedImage);
    assert.equal(result.provider, 'gateway');
    assert.equal(result.model, 'google/gemini-3.1-flash-image');
  });
});
