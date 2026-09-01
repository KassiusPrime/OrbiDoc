import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CircuitBreaker,
  NEXUS_FREE_MODELS,
  assertFreeModel,
} from '../api/_lib/nexusAI';

describe('Nexus AI free-only runtime', () => {
  test('every allowlisted route is OpenRouter free', () => {
    assert.ok(NEXUS_FREE_MODELS.length >= 2);
    for (const model of NEXUS_FREE_MODELS) {
      assert.ok(model === 'openrouter/free' || model.endsWith(':free'), `non-free route found: ${model}`);
      assert.doesNotThrow(() => assertFreeModel(model));
    }
  });

  test('paid and non-allowlisted models are rejected before any network call', () => {
    assert.throws(() => assertFreeModel('openai/gpt-5.6'), /PAID_MODEL_FORBIDDEN/);
    assert.throws(() => assertFreeModel('anthropic/claude-sonnet-4'), /PAID_MODEL_FORBIDDEN/);
    assert.throws(() => assertFreeModel('example/not-approved:free'), /MODEL_NOT_ALLOWLISTED/);
  });

  test('circuit breaker opens after threshold and allows a half-open probe after timeout', () => {
    const breaker = new CircuitBreaker('openrouter/free', {
      failureThreshold: 2,
      openDurationMs: 100,
    });

    breaker.begin();
    breaker.failure();
    assert.equal(breaker.getState(), 'CLOSED');

    breaker.begin();
    breaker.failure();
    const openedAt = Date.now();
    assert.equal(breaker.getState(openedAt), 'OPEN');
    assert.equal(breaker.getState(openedAt + 101), 'HALF_OPEN');

    breaker.begin();
    breaker.success();
    assert.equal(breaker.getState(), 'CLOSED');
  });
});
