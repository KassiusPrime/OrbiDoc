import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import {
  getFileExtension,
  getSupportedOutputs,
  isSupportedInput,
  isUniversalImageInput,
} from '../src/lib/fileConversion';

const makeFile = (name: string, type = 'application/octet-stream') =>
  new File(['fixture'], name, { type }) as unknown as globalThis.File;

test('normalizes common image extension aliases', () => {
  assert.equal(getFileExtension(makeFile('photo.JPEG', 'image/jpeg')), 'jpg');
  assert.equal(getFileExtension(makeFile('photo.JFIF', 'image/jpeg')), 'jpg');
  assert.equal(getFileExtension(makeFile('scan.TIF', 'image/tiff')), 'tiff');
  assert.equal(getFileExtension(makeFile('photo.HEIF', 'image/heif')), 'heic');
});

test('offers image conversion plus OCR document targets without repeating the source format', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('photo.jpeg', 'image/jpeg')),
    ['png', 'webp', 'avif', 'pdf', 'txt', 'html', 'docx'],
  );
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
    assert.deepEqual(
      getSupportedOutputs(file),
      ['png', 'jpg', 'webp', 'avif', 'pdf', 'txt', 'html', 'docx'],
      name,
    );
  }
});

test('accepts image MIME types even when the extension is uncommon', () => {
  const file = makeFile('asset.custom-image', 'image/x-custom');
  assert.equal(isUniversalImageInput(file), true);
  assert.equal(isSupportedInput(file), true);
  assert.ok(getSupportedOutputs(file).includes('png'));
});

test('offers document extraction and all supported raster targets for PDF input', () => {
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
