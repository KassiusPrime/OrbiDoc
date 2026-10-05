import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { listModels, status, stream } from '../api/_lib/ollamaNexus';

const originalUrl = process.env.OLLAMA_API_URL;
const originalModel = process.env.OLLAMA_MODEL;
const originalSearch = process.env.SEARXNG_URL;

beforeEach(() => {
  process.env.OLLAMA_API_URL = 'http://ollama:11434';
  process.env.OLLAMA_MODEL = 'llama3.2:3b';
  delete process.env.SEARXNG_URL;
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env.OLLAMA_API_URL;
  else process.env.OLLAMA_API_URL = originalUrl;
  if (originalModel === undefined) delete process.env.OLLAMA_MODEL;
  else process.env.OLLAMA_MODEL = originalModel;
  if (originalSearch === undefined) delete process.env.SEARXNG_URL;
  else process.env.SEARXNG_URL = originalSearch;
  mock.restoreAll();
});

describe('Nexus AI self-hosted Ollama runtime', () => {
  test('lists installed Ollama models and maps their metadata', async () => {
    mock.method(globalThis, 'fetch', async (input) => {
      assert.equal(String(input), 'http://ollama:11434/api/tags');
      return new Response(JSON.stringify({
        models: [{
          name: 'llama3.2:3b',
          size: 2_100_000_000,
          details: { family: 'llama', parameter_size: '3.21B', quantization_level: 'Q4_K_M' },
        }],
      }), { status: 200 });
    });

    const models = await listModels();
    assert.equal(models.length, 1);
    assert.equal(models[0]?.name, 'llama3.2:3b');
    assert.equal(models[0]?.family, 'llama');
    assert.equal(models[0]?.parameterSize, '3.21B');
  });

  test('streams Ollama NDJSON into the existing chunk/meta callbacks', async () => {
    const chunks: string[] = [];
    const metas: unknown[] = [];
    mock.method(globalThis, 'fetch', async (input, init) => {
      assert.equal(String(input), 'http://ollama:11434/api/chat');
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string; stream?: boolean };
      assert.equal(body.model, 'llama3.2:3b');
      assert.equal(body.stream, true);
      const payload = [
        JSON.stringify({ message: { content: 'Olá ' }, done: false }),
        JSON.stringify({ message: { content: 'Orbit' }, done: false }),
        JSON.stringify({ message: { content: '' }, done: true, eval_count: 12 }),
      ].join('\n') + '\n';
      return new Response(payload, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
    });

    await stream(
      { messages: [{ role: 'user', content: 'diga olá' }] },
      (chunk) => chunks.push(chunk),
      (meta) => metas.push(meta),
    );

    assert.deepEqual(chunks, ['Olá ', 'Orbit']);
    assert.equal(metas.length, 1);
    assert.equal((metas[0] as { model?: string }).model, 'llama3.2:3b');
  });

  test('reports Ollama and installed default model readiness', async () => {
    mock.method(globalThis, 'fetch', async (input) => {
      const url = String(input);
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3.2:3b' }] }), { status: 200 });
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    const runtime = await status();
    assert.equal(runtime.gateway, 'Ollama (self-hosted)');
    assert.equal(runtime.ollama, true);
    assert.equal(runtime.modelPresent, true);
    assert.equal(runtime.configured, true);
  });

  test('fails over once when the connection fails before the first byte', async () => {
    let calls = 0;
    const chunks: string[] = [];
    mock.method(globalThis, 'fetch', async () => {
      calls += 1;
      if (calls === 1) throw new Error('connection reset');
      return new Response(
        JSON.stringify({ message: { content: 'ok' }, done: true }) + '\n',
        { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
      );
    });

    await stream(
      { messages: [{ role: 'user', content: 'teste retry' }] },
      (chunk) => chunks.push(chunk),
      () => {},
    );

    assert.equal(calls, 2);
    assert.deepEqual(chunks, ['ok']);
  });
});
