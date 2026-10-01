import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { editImageResilient, enhanceImageResilient, generateImageResilient } from '../api/_lib/imageRuntime';

const originalEndpoint = process.env.REAL_ESRGAN_ENDPOINT;
const originalToken = process.env.REAL_ESRGAN_TOKEN;

beforeEach(() => {
  delete process.env.REAL_ESRGAN_ENDPOINT;
  delete process.env.REAL_ESRGAN_TOKEN;
});

afterEach(() => {
  if (originalEndpoint === undefined) delete process.env.REAL_ESRGAN_ENDPOINT;
  else process.env.REAL_ESRGAN_ENDPOINT = originalEndpoint;
  if (originalToken === undefined) delete process.env.REAL_ESRGAN_TOKEN;
  else process.env.REAL_ESRGAN_TOKEN = originalToken;
  mock.restoreAll();
});

describe('Orbit image runtime self-hosted', () => {
  test('generation is explicitly disabled without a local generator', async () => {
    const fetchMock = mock.method(globalThis, 'fetch');
    await assert.rejects(
      generateImageResilient({ prompt: 'Crie uma órbita minimalista.' }),
      /geração de imagens está desativada no runtime self-hosted/i,
    );
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('editing is explicitly disabled without a local generator', async () => {
    const fetchMock = mock.method(globalThis, 'fetch');
    await assert.rejects(
      editImageResilient({
        image: 'data:image/png;base64,c291cmNl',
        prompt: 'Troque apenas o fundo.',
      }),
      /edição de imagens está desativada no runtime self-hosted/i,
    );
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('enhancement fails clearly when Real-ESRGAN is not configured', async () => {
    const fetchMock = mock.method(globalThis, 'fetch');
    await assert.rejects(
      enhanceImageResilient({ image: 'data:image/png;base64,c291cmNl' }),
      /REAL_ESRGAN_ENDPOINT/i,
    );
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('enhancement uses only the configured local media processor', async () => {
    process.env.REAL_ESRGAN_ENDPOINT = 'http://realesrgan:8080/enhance';
    mock.method(globalThis, 'fetch', async (input, init) => {
      assert.equal(String(input), 'http://realesrgan:8080/enhance');
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ imageUrl: 'data:image/png;base64,ZGVmYXVsdA==' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await enhanceImageResilient({
      image: 'data:image/png;base64,c291cmNl',
      profile: 'document',
      scale: 2,
    });

    assert.equal(result.provider, 'local-media-processor');
    assert.equal(result.freeOnly, true);
  });
});
