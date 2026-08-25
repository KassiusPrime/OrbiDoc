import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_FONTS, SHAPE_LIBRARY, snapStudioElement, StudioElement } from '../src/lib/officeStudio';

const element = (patch: Partial<StudioElement>): StudioElement => ({
  id: patch.id || 'moving',
  type: 'shape',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  rotation: 0,
  opacity: 1,
  fill: '#3157F6',
  stroke: 'transparent',
  strokeWidth: 0,
  content: '',
  fontSize: 32,
  fontFamily: OFFICE_FONTS[0].value,
  fontWeight: 700,
  textAlign: 'left',
  ...patch,
});

test('offers a broad office font and shape library', () => {
  assert.ok(OFFICE_FONTS.length >= 15);
  for (const font of ['Inter', 'Aptos', 'Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Courier New']) {
    assert.ok(OFFICE_FONTS.some((item) => item.label === font), font);
  }
  for (const shape of ['rectangle', 'rounded', 'circle', 'triangle', 'diamond', 'arrow', 'star', 'line']) {
    assert.ok(SHAPE_LIBRARY.some((item) => item.type === shape), shape);
  }
});

test('snaps an element center to the canvas center and returns visual guides', () => {
  const moving = element({ width: 100, height: 80 });
  const result = snapStudioElement(moving, 448, 458, [moving], 1000, 1000, 10);
  assert.equal(result.x, 450);
  assert.equal(result.y, 460);
  assert.deepEqual(result.guides.vertical, [500]);
  assert.deepEqual(result.guides.horizontal, [500]);
});

test('snaps edges and centers to neighboring elements', () => {
  const moving = element({ id: 'moving', width: 100, height: 80 });
  const neighbor = element({ id: 'neighbor', x: 300, y: 240, width: 200, height: 120 });
  const result = snapStudioElement(moving, 196, 258, [moving, neighbor], 1000, 1000, 8);
  assert.equal(result.x, 200);
  assert.equal(result.y, 260);
  assert.ok(result.guides.vertical.includes(300));
  assert.ok(result.guides.horizontal.includes(300));
});
