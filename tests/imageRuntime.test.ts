import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  editImageResilient,
  generateImageResilient,
  getImageGenerationStatus,
  getVerifiedImageGenerationStatus,
} from '../api/_lib/imageRuntime';

const originalFetch = globalThis.fetch;
const originalEnv = {
  key: process.env.OPENROUTER_API_KEY,
  freeModel: process.env.OPENROUTER_FREE_IMAGE_MODEL,
  paidModel: process.env.OPENROUTER_IMAGE_MODEL,
  billing: process.env.ORBIT_IMAGE_BILLING_ENABLED,
  esrgan: process.env.REAL_ESRGAN_ENDPOINT,
};

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  delete process.env.OPENROUTER_FREE_IMAGE_MODEL;
  delete process.env.OPENROUTER_IMAGE_MODEL;
  delete process.env.ORBIT_IMAGE_BILLING_ENABLED;
  delete process.env.REAL_ESRGAN_ENDPOINT;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv.key === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalEnv.key;
  if (originalEnv.freeModel === undefined) delete process.env.OPENROUTER_FREE_IMAGE_MODEL;
  else process.env.OPENROUTER_FREE_IMAGE_MODEL = originalEnv.freeModel;
  if (originalEnv.paidModel === undefined) delete process.env.OPENROUTER_IMAGE_MODEL;
  else process.env.OPENROUTER_IMAGE_MODEL = originalEnv.paidModel;
  if (originalEnv.billing === undefined) delete process.env.ORBIT_IMAGE_BILLING_ENABLED;
  else process.env.ORBIT_IMAGE_BILLING_ENABLED = originalEnv.billing;
  if (originalEnv.esrgan === undefined) delete process.env.REAL_ESRGAN_ENDPOINT;
  else process.env.REAL_ESRGAN_ENDPOINT = originalEnv.esrgan;
});

function installOpenRouterImageMock(expectedBase64: string, cost = 0, expectedModel = 'example/free-image:free') {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://openrouter.ai/api/v1/images/models') {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), 'Bearer test-openrouter-key');
      const supported_parameters = {
        aspect_ratio: { type: 'enum', values: ['1:1', '4:3', '3:4', '16:9', '9:16', 'auto'] },
        resolution: { type: 'enum', values: ['1K', '2K', '4K'] },
        quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high'] },
        output_format: { type: 'enum', values: ['png', 'jpeg', 'webp'] },
        input_references: { type: 'array' },
      };
      return new Response(JSON.stringify({
        data: ['example/free-image:free', 'vendor/paid-image'].map((id) => ({
          id,
          architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
          supported_parameters,
        })),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    assert.equal(url, 'https://openrouter.ai/api/v1/images');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer test-openrouter-key');
    const body = JSON.parse(String(init?.body || '{}')) as {
      model?: string;
      quality?: string;
      aspect_ratio?: string;
      resolution?: string;
      size?: string;
      provider?: { allow_fallbacks?: boolean; max_price?: { prompt?: number; completion?: number } };
      input_references?: unknown[];
    };
    assert.equal(body.model, expectedModel);
    assert.equal(body.provider?.allow_fallbacks, false);
    assert.equal(body.size, undefined);
    if (body.aspect_ratio !== undefined) assert.ok(body.aspect_ratio);
    if (body.resolution !== undefined) assert.ok(body.resolution);
    assert.equal(body.provider?.max_price, undefined);

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
  test('fails closed when no model is configured', async () => {
    await assert.rejects(
      generateImageResilient({ prompt: 'Crie uma órbita minimalista.' }),
      /Geração de imagem remota ainda não está configurada/,
    );
  });

  test('rejects a malformed free model instead of treating it as paid', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'vendor/paid-image';
    await assert.rejects(
      generateImageResilient({ prompt: 'Crie uma órbita minimalista.' }),
      /precisa terminar em :free/,
    );
  });

  test('uses OpenRouter only when a verified free model route is configured', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    installOpenRouterImageMock('ZmFrZS1pbWFnZQ==');

    const result = await generateImageResilient({ prompt: 'Crie uma órbita minimalista.', width: 1024, height: 1024, quality: 'pro' });
    assert.equal(result.imageUrl, 'data:image/png;base64,ZmFrZS1pbWFnZQ==');
    assert.equal(result.provider, 'openrouter');
    assert.equal(result.assistant, 'Nexus AI');
    assert.equal(result.freeOnly, true);
    assert.equal(result.billingMode, 'free');
    assert.equal(getImageGenerationStatus().mode, 'free');
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
    assert.equal(result.freeOnly, true);
  });

  test('rejects provider-reported cost in free-only mode', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    installOpenRouterImageMock('ZmFrZQ==', 0.01);

    await assert.rejects(
      generateImageResilient({ prompt: 'Teste de custo.' }),
      /ZERO_COST_INVARIANT_VIOLATED/,
    );
  });

  test('never selects a paid model unless server billing opt-in is explicit', async () => {
    process.env.OPENROUTER_IMAGE_MODEL = 'vendor/paid-image';
    await assert.rejects(
      generateImageResilient({ prompt: 'Imagem paga sem autorização.' }),
      /faturável.*autorizado|ORBIT_IMAGE_BILLING_ENABLED=true/,
    );
    assert.equal(getImageGenerationStatus().enabled, false);
  });

  test('allows a paid model only with explicit server opt-in and reports billing mode', async () => {
    process.env.OPENROUTER_IMAGE_MODEL = 'vendor/paid-image';
    process.env.ORBIT_IMAGE_BILLING_ENABLED = 'true';
    installOpenRouterImageMock('cGFpZC1pbWFnZQ==', 0.02, 'vendor/paid-image');

    const result = await generateImageResilient({ prompt: 'Arte de teste.', quality: 'fast' });
    assert.equal(result.imageUrl, 'data:image/png;base64,cGFpZC1pbWFnZQ==');
    assert.equal(result.freeOnly, false);
    assert.equal(result.billingMode, 'paid');
    assert.equal(getImageGenerationStatus().mode, 'paid');
    assert.match(String(result.warning), /faturável/);
  });

  test('catalog status validates model support and never exposes API credentials', async () => {
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    installOpenRouterImageMock('c3RhdHVz');
    const verified = await getVerifiedImageGenerationStatus();
    assert.equal(verified.enabled, true);
    assert.equal(verified.mode, 'free');
    assert.equal(verified.editAvailable, true);
    assert.equal(JSON.stringify(verified).includes('test-openrouter-key'), false);
  });

  test('status never exposes secrets and reports missing credentials', () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_FREE_IMAGE_MODEL = 'example/free-image:free';
    const status = getImageGenerationStatus();
    assert.equal(status.enabled, false);
    assert.equal(status.mode, 'unavailable');
    assert.equal(JSON.stringify(status).includes('test-openrouter-key'), false);
  });
});
