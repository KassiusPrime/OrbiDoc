import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeResizePlacement,
  computeResizeTarget,
  IMAGE_RESIZE_MAX_PIXELS,
  IMAGE_RESIZE_MAX_SIDE,
} from '../src/lib/imageResize';

test('percent resize preserves original aspect ratio', () => {
  assert.deepEqual(computeResizeTarget(4000, 3000, { mode: 'percent', percent: 50 }), { width: 2000, height: 1500 });
});

test('locked pixel resize derives height from each source image', () => {
  assert.deepEqual(computeResizeTarget(1920, 1080, { mode: 'pixels', width: 960, height: 960, lockAspect: true }), { width: 960, height: 540 });
});

test('unlocked pixel resize uses exact dimensions', () => {
  assert.deepEqual(computeResizeTarget(1920, 1080, { mode: 'pixels', width: 1080, height: 1080, lockAspect: false }), { width: 1080, height: 1080 });
});

test('contain centers an image without cropping', () => {
  const placement = computeResizePlacement(1600, 900, 1080, 1080, 'contain');
  assert.equal(Math.round(placement.dw), 1080);
  assert.equal(Math.round(placement.dh), 608);
  assert.equal(Math.round(placement.dx), 0);
  assert.equal(Math.round(placement.dy), 236);
});

test('cover fills the canvas and crops overflow centrally', () => {
  const placement = computeResizePlacement(1600, 900, 1080, 1080, 'cover');
  assert.equal(Math.round(placement.dw), 1920);
  assert.equal(Math.round(placement.dh), 1080);
  assert.equal(Math.round(placement.dx), -420);
  assert.equal(Math.round(placement.dy), 0);
});

test('oversized targets are capped before a canvas allocation can exhaust memory', () => {
  const target = computeResizeTarget(1000, 1000, { mode: 'pixels', width: IMAGE_RESIZE_MAX_SIDE + 1, lockAspect: true });
  assert.ok(target.width <= IMAGE_RESIZE_MAX_SIDE);
  assert.ok(target.height <= IMAGE_RESIZE_MAX_SIDE);
  assert.ok(target.width * target.height <= IMAGE_RESIZE_MAX_PIXELS);
  assert.equal(target.width, target.height);
});
