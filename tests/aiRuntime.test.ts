import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { gatewayAuthMode, getHealth, getModelCatalog, normalizeProvider } from '../api/_lib/ai';
import { resolveGatewayCredential } from '../api/_lib/gatewayAuth';

const KEYS = [
  'AI_GATEWAY_API_KEY',
  'VERCEL_OIDC_TOKEN',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

const TEST_OIDC_TOKEN = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDQ2MDQ4MDB9.test';
const previous = new Map<string, string | undefined>();

beforeEach(() => {
  previous.clear();
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('OrbiDoc AI runtime availability', () => {
  test('uses Vercel OIDC as an automatic Gateway credential', () => {
    process.env.VERCEL_OIDC_TOKEN = TEST_OIDC_TOKEN;

    assert.equal(gatewayAuthMode(), 'oidc');
    assert.equal(normalizeProvider(undefined), 'gateway');
    assert.equal(getHealth().ai.gateway, true);

    const enabled = getModelCatalog().filter((model) => model.enabled);
    assert.equal(enabled.some((model) => model.provider === 'gateway' && model.id === 'google/gemini-3.6-flash'), true);
    assert.equal(enabled.some((model) => model.provider === 'gateway' && model.id === 'openai/gpt-5.6-luna'), true);
  });

  test('runtime credential resolver prefers OIDC over a static Gateway key', async () => {
    process.env.VERCEL_OIDC_TOKEN = TEST_OIDC_TOKEN;
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';

    const credential = await resolveGatewayCredential();
    assert.equal(credential.mode, 'oidc');
    assert.equal(credential.token, TEST_OIDC_TOKEN);
  });

  test('falls back to an explicit Gateway API key when OIDC is unavailable', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';

    const credential = await resolveGatewayCredential();
    assert.equal(credential.mode, 'api-key');
    assert.equal(credential.token, 'test-gateway-key');
  });

  test('does not pretend direct providers are enabled without their secrets', () => {
    const health = getHealth();
    assert.equal(health.ai.gemini, false);
    assert.equal(health.ai.groq, false);
    assert.equal(health.ai.openrouter, false);
  });
});
