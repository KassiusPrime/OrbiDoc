import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { editImageResilient, generateImageResilient } from '../api/_lib/imageRuntime';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
const originalImageModel = process.env.OPENROUTER_FREE_IMAGE_MODEL;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  delete process.env.OPENROUTER_FREE_IMAGE_MODEL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
  if (originalImageModel === undefined) delete process.env.OPENROUTER_FREE_IMAGE_MODEL;
  else process.env.OPENROUTER_FREE_IMAGE_MODEL = originalImageModel;
});

function installOpenRouterImageMock(expectedBase64: string, cost = 0) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://openrouter.ai/api/v1/images');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer test-openrouter-key');
    const body = JSON.parse(String(init?.body || '{}')) as {
      model?: string;
      provider?: { allow_fallbacks?: boolean; max_price?: { prompt?: number; completion?: number } };
      input_references?: unknown[];
    };
    assert.equal(body.model, 'example/free-image:free');
    assert.equal(body.provider?.allow_fallbacks, false);
    assert.equal(body.provider?.max_price?.prompt, 0);
    assert.equal(body.provider?.max_price?.completion, 0);

    return new Response(JSON.stringify({
      data: [{ b64_json: expectedBase64, media_type: 'image/png' }],
      usage: { cost },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('Orbit image runtime', () => {
  test('fails closed when no free image model is configured', async () => {
    await assert.rejects(
      generateImageResilient({ prompt: 'Crie uma órbita minimalista.' }),
      /não oferece modelo de imagem :free|não fará fallback para um modelo pago/,
    );
  });

  test('rejects a configured paid image model before any network call', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'vendor/paid-image';
    await assert.rejects(
      generateImageResilient({ prompt: 'Crie uma órbita minimalista.' }),
      /PAID_IMAGE_MODEL_FORBIDDEN/,
    );
  });

  test('uses OpenRouter only when an explicit :free image route is configured', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    installOpenRouterImageMock('ZmFrZS1pbWFnZQ==');

    const result = await generateImageResilient({ prompt: 'Crie uma órbita minimalista.' });
    assert.equal(result.imageUrl, 'data:image/png;base64,ZmFrZS1pbWFnZQ==');
    assert.equal(result.provider, 'openrouter');
    assert.equal(result.assistant, 'Nexus AI');
    assert.equal(result.freeOnly, true);
  });

  test('image edits use the same free-only OpenRouter guardrails', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    installOpenRouterImageMock('ZWRpdGVkLWltYWdl');

    const result = await editImageResilient({
      image: 'data:image/png;base64,c291cmNlLWltYWdl',
      prompt: 'Troque apenas o fundo por azul escuro.',
    });

    assert.equal(result.imageUrl, 'data:image/png;base64,ZWRpdGVkLWltYWdl');
    assert.equal(result.provider, 'openrouter');
  });

  test('rejects a non-zero provider-reported image cost', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    installOpenRouterImageMock('ZmFrZQ==', 0.01);

    await assert.rejects(
      generateImageResilient({ prompt: 'Teste de custo.' }),
      /ZERO_COST_INVARIANT_VIOLATED/,
    );
  });
});
