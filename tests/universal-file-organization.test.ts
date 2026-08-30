import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('files workspace separates library device access and format reference', async () => {
  const source = await read('src/components/FilesWorkspace.tsx');
  assert.match(source, /Biblioteca/);
  assert.match(source, /Dispositivo/);
  assert.match(source, /Formatos/);
  assert.match(source, /SupportedFormatsWorkspace/);
});

test('capability registry covers office media code archives specialist files and unknown fallback', async () => {
  const source = await read('src/lib/fileCapabilityRegistry.ts');
  for (const extension of ['pdf', 'docx', 'xlsx', 'pptx', 'epub', 'heic', 'mp3', 'mp4', 'json', 'sqlite', 'ttf', 'vcf', 'eml', 'zip']) {
    assert.match(source, new RegExp(`['\"]${extension}['\"]`));
  }
  assert.match(source, /Formato desconhecido/);
  assert.match(source, /texto seguro/);
  assert.match(source, /inspeção binária\/hexadecimal/);
});

test('format reference is honest about codec gaps instead of advertising fake parity', async () => {
  const source = await read('src/lib/fileCapabilityRegistry.ts');
  assert.match(source, /ZIP está implementado hoje/);
  assert.match(source, /7z\/RAR\/TAR/);
  assert.match(source, /antes de serem anunciados como completos/);
  assert.match(source, /paridade.*em expansão/i);
});

test('universal reader opens zip-compatible packages media fonts structured files and unknown bytes safely', async () => {
  const reader = await read('src/lib/documentReader.ts');
  for (const extension of ['jar', 'apk', 'cbz', 'whl', 'vsix', 'mp3', 'mkv', 'ttf', 'ics', 'vcf', 'eml']) {
    assert.match(reader, new RegExp(`['\"]${extension}['\"]`));
  }
  assert.match(reader, /unknownFallback/);
  assert.match(reader, /looksTextual/);
  assert.match(reader, /hexDump/);
  assert.match(reader, /kind: 'hex'/);
  assert.match(reader, /kind: 'media'/);
  assert.match(reader, /kind: 'font'/);
});

test('system file surface renders audio video fonts archives and hex without another mini app', async () => {
  const agent = await read('src/components/SystemFileOpenAgent.tsx');
  assert.match(agent, /<audio/);
  assert.match(agent, /<video/);
  assert.match(agent, /FontPreview/);
  assert.match(agent, /Conteúdo do pacote/);
  assert.match(agent, /readerDocument\.kind === 'hex'/);
});
