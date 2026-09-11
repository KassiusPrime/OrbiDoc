import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = fs.readFileSync(path.join(root, 'api/_lib/nexusOrchestrator.ts'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'api/chat.ts'), 'utf8');
const stream = fs.readFileSync(path.join(root, 'api/chat/stream.ts'), 'utf8');

function countSpecialists(source: string): number {
  return (source.match(/role:\s*'/g) || []).length;
}

test('Nexus keeps one public assistant while using multiple internal specialists', () => {
  assert.match(runtime, /nexusAI/);
  assert.match(runtime, /SPECIALISTS/);
  assert.ok(countSpecialists(runtime) >= 3);
  assert.match(runtime, /Promise\.all/);
  assert.match(runtime, /synthesisPrompt/);
});

test('normal and streaming chat route through the orchestrator', () => {
  assert.match(chat, /nexusOrchestrator\.complete/);
  assert.doesNotMatch(chat, /nexusAI\.complete/);
  assert.match(stream, /nexusOrchestrator\.stream/);
  assert.doesNotMatch(stream, /nexusAI\.stream/);
});

test('internal model selection is not exposed by the collaboration layer', () => {
  assert.doesNotMatch(runtime, /modelId\s*:/);
  assert.doesNotMatch(runtime, /preferredModel/);
  assert.match(runtime, /NexusCollaborationMode = 'auto' \| 'single' \| 'team'/);
});
