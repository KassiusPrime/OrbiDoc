import test from 'node:test';
import assert from 'node:assert/strict';
import { ORBIT_EXTENSIONS, getOrbitExtension, getOrbitExtensionForRoute } from '../src/lib/orbitExtensions';

test('Orbit extension registry uses unique IDs and routes', () => {
  assert.equal(new Set(ORBIT_EXTENSIONS.map((item) => item.id)).size, ORBIT_EXTENSIONS.length);
  assert.equal(new Set(ORBIT_EXTENSIONS.map((item) => item.route)).size, ORBIT_EXTENSIONS.length);
});

test('each extension declares capabilities, permissions, and a version', () => {
  for (const extension of ORBIT_EXTENSIONS) {
    assert.match(extension.id, /^orbit\./);
    assert.match(extension.version, /^\d+\.\d+\.\d+$/);
    assert.ok(extension.capabilities.length > 0, extension.id);
    assert.ok(extension.permissions.length > 0, extension.id);
    assert.ok(['core', 'native-existing', 'legacy-adapter', 'planned'].includes(extension.stage));
  }
});

test('Nexus remains the core; reader, player, and image studio are first-class modules', () => {
  assert.equal(getOrbitExtension('orbit.nexus')?.stage, 'core');
  assert.equal(getOrbitExtension('orbit.reader')?.route, 'reader');
  assert.equal(getOrbitExtension('orbit.player')?.route, 'player');
  assert.equal(getOrbitExtension('orbit.image')?.route, 'image');
  assert.equal(getOrbitExtension('orbit.writer')?.stage, 'legacy-adapter');
  assert.equal(getOrbitExtension('orbit.sheets')?.stage, 'legacy-adapter');
  assert.equal(getOrbitExtension('orbit.slides')?.stage, 'legacy-adapter');
  assert.equal(getOrbitExtension('orbit.design')?.stage, 'legacy-adapter');
  for (const id of ['orbit.writer', 'orbit.sheets', 'orbit.slides', 'orbit.design'] as const) {
    assert.deepEqual(getOrbitExtension(id)?.aiTools, [], `${id} must not expose mutating tools in reader-only mode`);
  }
  assert.equal(getOrbitExtensionForRoute('canva')?.id, 'orbit.design');
});

test('extension registry contains declarative tool IDs, not executable remote entry URLs', () => {
  for (const extension of ORBIT_EXTENSIONS) {
    for (const toolId of extension.aiTools) assert.match(toolId, /^[a-z]+\.[A-Za-z][A-Za-z0-9]*$/);
  }
  assert.ok(ORBIT_EXTENSIONS.every((extension) => !('entry' in extension)));
});
