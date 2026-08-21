import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import {
  getFileExtension,
  getSupportedOutputs,
  isSupportedInput,
  isUniversalImageInput,
  UNIVERSAL_IMAGE_OUTPUTS,
} from '../src/lib/fileConversion';

const makeFile = (name: string, type = 'application/octet-stream') =>
  new File(['fixture'], name, { type }) as unknown as globalThis.File;

test('normalizes common image extension aliases', () => {
  assert.equal(getFileExtension(makeFile('photo.JPEG', 'image/jpeg')), 'jpg');
  assert.equal(getFileExtension(makeFile('photo.JFIF', 'image/jpeg')), 'jpg');
  assert.equal(getFileExtension(makeFile('scan.TIF', 'image/tiff')), 'tiff');
  assert.equal(getFileExtension(makeFile('photo.HEIF', 'image/heif')), 'heic');
});

test('keeps JPG available as an explicit normalization target for JPEG aliases', () => {
  for (const name of ['photo.jpeg', 'photo.jpe', 'photo.jfif']) {
    const outputs = getSupportedOutputs(makeFile(name, 'image/jpeg'));
    assert.equal(outputs[0], 'png', name);
    assert.ok(outputs.includes('jpg'), `${name} should be normalizable to .jpg`);
  }
});

test('offers a broad writable image target set plus OCR document targets', () => {
  const outputs = getSupportedOutputs(makeFile('photo.png', 'image/png'));
  assert.equal(outputs.includes('png'), false);
  for (const format of ['jpg', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'heic', 'jxl', 'jp2', 'ico', 'psd', 'exr', 'qoi']) {
    assert.ok(outputs.includes(format as any), format);
  }
  for (const format of ['pdf', 'txt', 'html', 'docx']) assert.ok(outputs.includes(format as any), format);
  assert.ok(UNIVERSAL_IMAGE_OUTPUTS.length >= 20);
});

test('recognizes advanced image formats handled by the WASM fallback', () => {
  const fixtures = [
    ['camera.heic', 'image/heic'],
    ['scan.tiff', 'image/tiff'],
    ['design.psd', 'image/vnd.adobe.photoshop'],
    ['photo.jxl', 'image/jxl'],
    ['icon.ico', 'image/x-icon'],
    ['frame.exr', 'image/x-exr'],
    ['camera.nef', 'application/octet-stream'],
  ] as const;

  for (const [name, type] of fixtures) {
    const file = makeFile(name, type);
    assert.equal(isUniversalImageInput(file), true, name);
    assert.equal(isSupportedInput(file), true, name);
    const outputs = getSupportedOutputs(file);
    assert.ok(outputs.includes('png'), name);
    assert.ok(outputs.includes('jpg'), name);
    assert.ok(outputs.includes('webp'), name);
    assert.ok(outputs.includes('tiff'), name);
    assert.ok(outputs.includes('pdf'), name);
  }
});

test('accepts image MIME types even when the extension is uncommon', () => {
  const file = makeFile('asset.custom-image', 'image/x-custom');
  assert.equal(isUniversalImageInput(file), true);
  assert.equal(isSupportedInput(file), true);
  assert.ok(getSupportedOutputs(file).includes('png'));
});

test('keeps camera RAW formats input-only while offering rendered outputs', () => {
  const outputs = getSupportedOutputs(makeFile('camera.cr3'));
  assert.ok(outputs.includes('jpg'));
  assert.ok(outputs.includes('tiff'));
  assert.equal(outputs.includes('cr3' as any), false);
  assert.equal(outputs.includes('dng' as any), false);
});

test('offers document extraction and browser raster targets for PDF input', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('contract.pdf', 'application/pdf')),
    ['txt', 'html', 'docx', 'png', 'jpg', 'webp', 'avif'],
  );
});

test('routes spreadsheets to document-friendly outputs', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
    ['csv', 'html', 'txt', 'pdf', 'docx'],
  );
});

test('routes CSV to spreadsheet and document-friendly outputs', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('budget.csv', 'text/csv')),
    ['xlsx', 'html', 'txt', 'pdf', 'docx'],
  );
});

test('supports the requested modern image formats', () => {
  for (const name of ['image.png', 'image.jpg', 'image.webp', 'image.avif']) {
    assert.equal(isSupportedInput(makeFile(name)), true, name);
  }
});

test('rejects unsupported archive input', () => {
  assert.equal(isSupportedInput(makeFile('archive.zip', 'application/zip')), false);
});
