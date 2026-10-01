import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('document reader keeps the supported office/PDF formats and a bounded local file size', () => {
  const reader = read('src/lib/documentReader.ts');
  assert.match(reader, /\.pdf/);
  assert.match(reader, /\.docx/);
  assert.match(reader, /\.xlsx/);
  assert.match(reader, /\.ods/);
  assert.match(reader, /\.pptx/);
  assert.match(reader, /120 \* 1024 \* 1024/);
  assert.match(reader, /sourceFile: file/);
});

test('document reader sanitizes imported HTML before exposing it to the UI', () => {
  const reader = read('src/lib/documentReader.ts');
  assert.match(reader, /querySelectorAll\('script, iframe, object, embed, form/);
  assert.match(reader, /javascript:/);
});

test('Office documents still route through ONLYOFFICE rather than legacy editors', () => {
  const app = read('src/AppV5.tsx');
  const editor = read('src/components/OnlyOfficeEditor.tsx');
  assert.match(app, /OnlyOfficeEditor/);
  assert.match(editor, /\/api\/onlyoffice\/config/);
});

test('VoiceStudio remains optional and uses its documented health/REST contract', () => {
  const compose = read('docker-compose.yml');
  const env = read('.env.example');
  const voice = read('api/_lib/voiceStudioRuntime.ts');
  assert.match(compose, /profiles: \["voice"\]/);
  assert.match(compose, /ghcr\.io\/debpalash\/omnivoice-studio:stable/);
  assert.match(compose, /\/health/);
  assert.match(env, /VOICE_STUDIO_ENABLED=false/);
  assert.match(voice, /'\/health'/);
  assert.match(voice, /'\/v1\/audio\/transcriptions'/);
  assert.match(voice, /\/v1\/audio\/speech/);
  assert.match(voice, /\/profiles/);
});
