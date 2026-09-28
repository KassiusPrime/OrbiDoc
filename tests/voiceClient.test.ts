import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTextForSpeech } from '../src/api/voice';

test('splitTextForSpeech preserves all normalized content across chunks', () => {
  const source = Array.from({ length: 30 }, (_, index) => `Parágrafo ${index + 1}. Conteúdo de teste para leitura no documento.`).join('\n\n');
  const chunks = splitTextForSpeech(source, 120);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 120));
  assert.equal(chunks.join(' '), source.replace(/\s+/g, ' ').trim());
});

test('splitTextForSpeech returns an empty list for blank input', () => {
  assert.deepEqual(splitTextForSpeech('   \n\t  '), []);
});

test('splitTextForSpeech keeps short text as one chunk', () => {
  assert.deepEqual(splitTextForSpeech('Olá, Orbit.'), ['Olá, Orbit.']);
});
