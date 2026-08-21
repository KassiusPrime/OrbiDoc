import assert from 'node:assert/strict';
import test from 'node:test';
import { planEnhancement } from '../src/lib/imageEnhancer';

test('image enhancement keeps requested 2x scale inside pixel budget', () => {
  const plan = planEnhancement(1200, 800, 2, 10_000_000);
  assert.equal(plan.width, 2400);
  assert.equal(plan.height, 1600);
  assert.equal(plan.effectiveScale, 2);
  assert.equal(plan.capped, false);
});

test('image enhancement caps 4x upscale when output would exceed memory budget', () => {
  const plan = planEnhancement(4000, 3000, 4, 24_000_000);
  assert.equal(plan.capped, true);
  assert.ok(plan.effectiveScale >= 1);
  assert.ok(plan.effectiveScale < 4);
  assert.ok(plan.width * plan.height <= 24_100_000);
});

test('image enhancement never downsizes below original size just to satisfy an impossible cap', () => {
  const plan = planEnhancement(6000, 4000, 2, 10_000_000);
  assert.equal(plan.effectiveScale, 1);
  assert.equal(plan.width, 6000);
  assert.equal(plan.height, 4000);
  assert.equal(plan.capped, true);
});
