import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');

test('VoiceStudio API remains optional and authenticated like other AI routes', () => {
  assert.match(server, /\/api\/voice\/status/);
  assert.match(server, /\/api\/voice\/models/);
  assert.match(server, /\/api\/voice\/voices/);
  assert.match(server, /\/api\/voice\/speech/);
  assert.match(server, /\/api\/voice\/transcriptions/);
  assert.match(server, /VOICE_STUDIO_ENABLED/);
  assert.match(server, /VOICE_STUDIO_API_KEY/);
  assert.match(server, /requireAuthIfConfigured/);
});

test('VoiceStudio uses documented OpenAI-compatible endpoints', () => {
  assert.match(server, /\/v1\/models/);
  assert.match(server, /\/v1\/audio\/voices/);
  assert.match(server, /\/v1\/audio\/speech/);
  assert.match(server, /\/v1\/audio\/transcriptions/);
  assert.match(server, /multipart\/form-data/);
  assert.doesNotMatch(server, /\/api\/tts|\/api\/stt|\/api\/voices\/clone/);
});

test('VoiceStudio audio is proxied as a response artifact rather than persisted as chat base64', () => {
  assert.match(server, /Content-Type/);
  assert.match(server, /audio\/mpeg/);
  assert.match(server, /arrayBuffer\(\)/);
  assert.doesNotMatch(server, /data:audio\/mpeg;base64/);
});

test('VoiceStudio stays internal to the Docker network', () => {
  assert.match(compose, /profiles: \["voice"\]/);
  assert.match(compose, /VOICE_STUDIO_URL: http:\/\/voicestudio:3900/);
  assert.match(compose, /voicestudio_data/);
  assert.match(compose, /voicestudio_hf_cache/);
  assert.doesNotMatch(compose, /"3900:3900"/);
});
