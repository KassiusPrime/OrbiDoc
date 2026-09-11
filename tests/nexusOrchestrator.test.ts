import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = fs.readFileSync(path.join(root, 'api/_lib/nexusOrchestrator.ts'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'api/chat.ts'), 'utf8');
const stream = fs.readFileSync(path.join(root, 'api/chat/stream.ts'), 'utf8');

function countSpecialists(source: string): number {
  return (source.match(/role:\s*'/g) || []).length;
}

describe('Nexus AI collaboration', () => {
  test('keeps one public assistant while using multiple internal specialists', () => {
    expect(runtime).toContain('nexusAI');
    expect(runtime).toContain('SPECIALISTS');
    expect(countSpecialists(runtime)).toBeGreaterThanOrEqual(3);
    expect(runtime).toContain('Promise.all');
    expect(runtime).toContain('synthesisPrompt');
  });

  test('routes both normal and streaming chat through the orchestrator', () => {
    expect(chat).toContain('nexusOrchestrator.complete');
    expect(chat).not.toContain('nexusAI.complete');
    expect(stream).toContain('nexusOrchestrator.stream');
    expect(stream).not.toContain('nexusAI.stream');
  });

  test('does not expose internal model selection to the collaboration API', () => {
    expect(runtime).not.toMatch(/modelId\s*:/);
    expect(runtime).not.toMatch(/preferredModel/);
    expect(runtime).toContain("NexusCollaborationMode = 'auto' | 'single' | 'team'");
  });
});
