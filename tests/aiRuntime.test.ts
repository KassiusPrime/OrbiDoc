import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { gatewayAuthMode, getHealth, getModelCatalog, normalizeProvider } from '../api/_lib/ai';

const KEYS = [
  'AI_GATEWAY_API_KEY',
  'VERCEL_OIDC_TOKEN',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

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
    process.env.VERCEL_OIDC_TOKEN = 'test-oidc-token';

    assert.equal(gatewayAuthMode(), 'oidc');
    assert.equal(normalizeProvider(undefined), 'gateway');
    assert.equal(getHealth().ai.gateway, true);

    const enabled = getModelCatalog().filter((model) => model.enabled);
    assert.equal(enabled.some((model) => model.provider === 'gateway' && model.id === 'google/gemini-3.6-flash'), true);
    assert.equal(enabled.some((model) => model.provider === 'gateway' && model.id === 'openai/gpt-5.6-luna'), true);
  });

  test('prefers an explicit AI Gateway API key over OIDC when both exist', () => {
    process.env.VERCEL_OIDC_TOKEN = 'test-oidc-token';
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    assert.equal(gatewayAuthMode(), 'api-key');
  });

  test('does not pretend direct providers are enabled without their secrets', () => {
    const health = getHealth();
    assert.equal(health.ai.gemini, false);
    assert.equal(health.ai.groq, false);
    assert.equal(health.ai.openrouter, false);
  });
});
