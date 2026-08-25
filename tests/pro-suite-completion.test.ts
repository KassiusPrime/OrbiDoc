import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeckTransition, applyTypographyMaster } from '../src/lib/presentationPro';
import { addDesignPage, deleteDesignPage, ensureDesignPages, renameDesignPage, switchDesignPage } from '../src/lib/designPages';
import { cropRatioValue, filterCss } from '../src/lib/designImageTools';

const design = () => ({ width: 1080, height: 1080, background: '#ffffff', elements: [{ id: 'one', type: 'text', x: 10, y: 10, width: 200, height: 80, rotation: 0, opacity: 1, fill: '#111111', stroke: 'transparent', strokeWidth: 0, content: 'Página 1', fontSize: 32, fontFamily: 'Inter', fontWeight: 700, textAlign: 'left' as const }] });

test('presentation pro stores transition metadata on every slide', () => {
  const deck: any = { title: 'Deck', fontFamily: 'Inter', slides: [{ id: 'a', elements: [] }, { id: 'b', elements: [] }] };
  const next = applyDeckTransition(deck, 'slide-left', 560);
  assert.equal(next.orbiMaster.transition, 'slide-left');
  assert.equal(next.orbiMaster.transitionMs, 560);
  assert.ok(next.slides.every((slide: any) => slide.orbiTransition === 'slide-left' && slide.orbiTransitionMs === 560));
});

test('presentation typography master updates free text without changing non text elements', () => {
  const deck: any = { title: 'Deck', slides: [{ id: 'a', elements: [{ id: 't', type: 'text', fontFamily: 'Arial' }, { id: 'i', type: 'image', fontFamily: 'Arial' }] }] };
  const next = applyTypographyMaster(deck, 'Aptos, sans-serif');
  assert.equal(next.fontFamily, 'Aptos, sans-serif');
  assert.equal(next.slides[0].elements[0].fontFamily, 'Aptos, sans-serif');
  assert.equal(next.slides[0].elements[1].fontFamily, 'Arial');
});

test('design pages preserve each canvas and can switch duplicate rename and delete', () => {
  const first: any = ensureDesignPages(design() as any);
  const firstId = first.orbiActivePageId;
  const second: any = addDesignPage(first, false);
  assert.equal(second.orbiPages.length, 2);
  const secondId = second.orbiActivePageId;
  second.elements = [{ ...design().elements[0], id: 'two', content: 'Página 2' }];
  const back: any = switchDesignPage(second, firstId!);
  assert.equal(back.elements[0].content, 'Página 1');
  const renamed: any = renameDesignPage(back, firstId!, 'Capa');
  assert.equal(renamed.orbiPages.find((page: any) => page.id === firstId).name, 'Capa');
  const deleted: any = deleteDesignPage(renamed, secondId!);
  assert.equal(deleted.orbiPages.length, 1);
  assert.equal(deleted.orbiActivePageId, firstId);
});

test('design image helpers expose stable crop ratios and local filter descriptors', () => {
  assert.equal(cropRatioValue('1:1', 1920, 1080), 1);
  assert.equal(cropRatioValue('16:9', 100, 100), 16 / 9);
  assert.equal(cropRatioValue('original', 1920, 1080), 1920 / 1080);
  assert.match(filterCss('grayscale'), /grayscale/);
  assert.match(filterCss('contrast'), /contrast/);
});
