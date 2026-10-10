import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Design Studio persists layer visibility and blend modes as project metadata', () => {
  const model = read('src/lib/officeStudio.ts');
  const editor = read('src/components/DesignEditorStudio.tsx');
  assert.match(model, /visible\?: boolean/);
  assert.match(model, /blendMode\?: 'normal'.*'difference'/);
  assert.match(editor, /element\.visible === false/);
  assert.match(editor, /ctx\.globalCompositeOperation/);
  assert.match(editor, /mixBlendMode:/);
  assert.match(editor, /Modo de mesclagem/);
  assert.match(editor, /Mostrar camada/);
  assert.match(editor, /Ocultar camada/);
});

test('Hidden design layers are excluded from preview and exported canvas', () => {
  const editor = read('src/components/DesignEditorStudio.tsx');
  assert.match(editor, /for \(const element of design\.elements\) \{\s*if \(element\.visible === false\) continue;/);
  assert.match(editor, /design\.elements\.filter\(\(element\) => element\.visible !== false\)\.map/);
});
