import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import {
  getFileExtension,
  getSupportedOutputs,
  isSupportedInput,
} from '../src/lib/fileConversion';

const makeFile = (name: string, type = 'application/octet-stream') =>
  new File(['fixture'], name, { type }) as unknown as globalThis.File;

test('normalizes jpeg extension to jpg', () => {
  assert.equal(getFileExtension(makeFile('photo.JPEG', 'image/jpeg')), 'jpg');
});

test('offers useful image conversion targets without repeating the source format', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('photo.jpeg', 'image/jpeg')),
    ['png', 'webp', 'avif', 'pdf'],
  );
});

test('offers document extraction targets for PDF input', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('contract.pdf', 'application/pdf')),
    ['txt', 'html', 'docx', 'png', 'jpg', 'webp'],
  );
});

test('routes CSV to spreadsheet and document-friendly outputs', () => {
  assert.deepEqual(
    getSupportedOutputs(makeFile('budget.csv', 'text/csv')),
    ['xlsx', 'html', 'txt', 'pdf', 'docx'],
  );
});

test('rejects unsupported archive input', () => {
  assert.equal(isSupportedInput(makeFile('archive.zip', 'application/zip')), false);
});
