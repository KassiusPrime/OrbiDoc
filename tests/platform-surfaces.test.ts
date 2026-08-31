import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile = fs.readFileSync(new URL('../src/lib/platformProfile.ts', import.meta.url), 'utf8');
const surfaces = fs.readFileSync(new URL('../src/platform-surfaces.css', import.meta.url), 'utf8');

test('platform profile defines separate web mobile desktop and native app surfaces', () => {
  assert.match(profile, /'web' \| 'desktop' \| 'mobile' \| 'app'/);
  assert.match(profile, /if \(isOrbiDocNativeRuntime\(\)\) return 'app'/);
  assert.match(profile, /orbidoc-form-tablet/);
  assert.match(profile, /orbidoc-input-touch/);
});

test('native app keeps a dedicated style surface while inheriting mobile safety baseline', () => {
  assert.match(profile, /platform === 'app'.*orbidoc-platform-mobile/s);
  assert.match(surfaces, /orbidoc-platform-app/);
  assert.match(surfaces, /orbidoc-platform-desktop/);
  assert.match(surfaces, /orbidoc-platform-web/);
});
