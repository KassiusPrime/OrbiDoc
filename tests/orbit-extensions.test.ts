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

test('Nexus is the core and Writer, Sheets, and Slides are explicitly planned as native engines', () => {
  assert.equal(getOrbitExtension('orbit.nexus')?.stage, 'core');
  assert.equal(getOrbitExtension('orbit.writer')?.stage, 'planned');
  assert.equal(getOrbitExtension('orbit.sheets')?.stage, 'planned');
  assert.equal(getOrbitExtension('orbit.slides')?.stage, 'planned');
  assert.equal(getOrbitExtensionForRoute('canva')?.id, 'orbit.design');
});

test('extension registry contains declarative tool IDs, not executable remote entry URLs', () => {
  for (const extension of ORBIT_EXTENSIONS) {
    for (const toolId of extension.aiTools) assert.match(toolId, /^[a-z]+\.[A-Za-z][A-Za-z0-9]*$/);
  }
  assert.ok(ORBIT_EXTENSIONS.every((extension) => !('entry' in extension)));
});
