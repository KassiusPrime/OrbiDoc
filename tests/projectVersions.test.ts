import test from 'node:test';
import assert from 'node:assert/strict';
import type { SavedProject } from '../src/types';

class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'window', { value: { dispatchEvent: () => true }, configurable: true });

const { loadProjectVersions, restoreProjectVersion, snapshotAllProjects } = await import('../src/lib/projectVersions');

const project = (patch: Partial<SavedProject> = {}): SavedProject => ({
  id: 'project-1',
  title: 'Relatório escolar',
  type: 'word',
  createdAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-21T12:10:00.000Z',
  content: { html: '<h1>Versão 1</h1>' },
  ...patch,
});

test('creates a restorable snapshot for a normal local project', () => {
  storage.clear();
  storage.setItem('orbidoc_projects_v1', JSON.stringify([project()]));
  assert.equal(snapshotAllProjects(true), 1);
  const versions = loadProjectVersions();
  assert.equal(versions.length, 1);
  assert.equal(versions[0].projectId, 'project-1');
  assert.equal(versions[0].restorable, true);
});

test('restores the saved project content without changing its id', () => {
  storage.clear();
  storage.setItem('orbidoc_projects_v1', JSON.stringify([project()]));
  snapshotAllProjects(true);
  const version = loadProjectVersions()[0];
  storage.setItem('orbidoc_projects_v1', JSON.stringify([project({ content: { html: '<p>Alterado</p>' }, updatedAt: '2026-08-21T13:00:00.000Z' })]));
  const restored = restoreProjectVersion(version.id);
  assert.equal(restored.id, 'project-1');
  assert.deepEqual(restored.content, { html: '<h1>Versão 1</h1>' });
});
