import type { User } from 'firebase/auth';
import type { SavedProject } from '../types';
import {
  deleteDocumentFromFirestore,
  loadDocumentsFromFirestore,
  saveDocumentToFirestore,
  type FirestoreDocument,
} from './firebase';

const PROJECTS_KEY = 'orbidoc_projects_v1';
const HISTORY_KEY = 'orbidoc_history_v2';
const ACTIVE_SCOPE_KEY = 'orbidoc_workspace_scope_v1';
const LOCAL_SCOPE = 'local';

const scopeKey = (base: string, scope: string) => `${base}__scope_${scope}`;

function readArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray(key: string, value: unknown[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function currentScope() {
  return localStorage.getItem(ACTIVE_SCOPE_KEY) || LOCAL_SCOPE;
}

function saveCurrentWorkspaceToScope(scope: string) {
  localStorage.setItem(scopeKey(PROJECTS_KEY, scope), localStorage.getItem(PROJECTS_KEY) || '[]');
  localStorage.setItem(scopeKey(HISTORY_KEY, scope), localStorage.getItem(HISTORY_KEY) || '[]');
}

function restoreWorkspaceScope(scope: string, cloneCurrentWhenMissing: boolean) {
  const projectKey = scopeKey(PROJECTS_KEY, scope);
  const historyKey = scopeKey(HISTORY_KEY, scope);
  const projects = localStorage.getItem(projectKey);
  const history = localStorage.getItem(historyKey);

  if (projects === null && cloneCurrentWhenMissing) {
    localStorage.setItem(projectKey, localStorage.getItem(PROJECTS_KEY) || '[]');
  }
  if (history === null && cloneCurrentWhenMissing) {
    localStorage.setItem(historyKey, localStorage.getItem(HISTORY_KEY) || '[]');
  }

  localStorage.setItem(PROJECTS_KEY, localStorage.getItem(projectKey) || '[]');
  localStorage.setItem(HISTORY_KEY, localStorage.getItem(historyKey) || '[]');
  localStorage.setItem(ACTIVE_SCOPE_KEY, scope);
}

/**
 * Switches the local workspace namespace when the Firebase identity changes.
 * The first cloud sign-in adopts the current local workspace rather than losing
 * it; subsequent sign-ins restore only that UID's local copy.
 */
export function switchWorkspaceAccountScope(user: Pick<User, 'uid'> | null): boolean {
  const previousScope = currentScope();
  const nextScope = user?.uid || LOCAL_SCOPE;
  if (previousScope === nextScope) return false;

  saveCurrentWorkspaceToScope(previousScope);
  const nextAlreadyExists = localStorage.getItem(scopeKey(PROJECTS_KEY, nextScope)) !== null;
  const cloneCurrent = Boolean(user?.uid) && !nextAlreadyExists && previousScope === LOCAL_SCOPE;
  restoreWorkspaceScope(nextScope, cloneCurrent);
  return true;
}

export function readCurrentWorkspaceProjects(): SavedProject[] {
  return readArray<SavedProject>(PROJECTS_KEY);
}

export function currentWorkspaceProjectIds(): Set<string> {
  return new Set(readCurrentWorkspaceProjects().map((project) => project.id).filter(Boolean));
}

function normalizeRemoteProject(document: FirestoreDocument): SavedProject | null {
  try {
    const parsed = JSON.parse(document.content || '{}') as Partial<SavedProject>;
    if (parsed && parsed.id && parsed.type) {
      return {
        ...parsed,
        id: parsed.id,
        title: parsed.title || document.title || 'Projeto OrbiDoc',
        type: parsed.type,
        createdAt: parsed.createdAt || document.createdAt,
        updatedAt: parsed.updatedAt || document.updatedAt,
        previewSnippet: parsed.previewSnippet || 'Sincronizado com a Conta OrbiDoc.',
        tags: Array.isArray(parsed.tags) ? parsed.tags : document.tags || [],
      } as SavedProject;
    }
  } catch {
    // Older records may contain only the editor payload instead of a full project.
  }

  const supported = new Set(['word', 'excel', 'powerpoint', 'canva', 'extract', 'chat']);
  if (!supported.has(document.docType)) return null;
  return {
    id: document.id,
    title: document.title || 'Projeto OrbiDoc',
    type: document.docType as SavedProject['type'],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    previewSnippet: 'Restaurado da Conta OrbiDoc.',
    tags: document.tags || [],
    content: document.content,
  };
}

function newerProject(a: SavedProject, b: SavedProject) {
  const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return bTime > aTime ? b : a;
}

/** Merge remote projects into the UID-scoped local workspace without discarding local-only work. */
export async function mergeCloudWorkspaceProjects(): Promise<boolean> {
  const local = readCurrentWorkspaceProjects();
  const remote = (await loadDocumentsFromFirestore())
    .map(normalizeRemoteProject)
    .filter((project): project is SavedProject => Boolean(project));

  const merged = new Map<string, SavedProject>();
  local.forEach((project) => merged.set(project.id, project));
  remote.forEach((project) => {
    const existing = merged.get(project.id);
    merged.set(project.id, existing ? newerProject(existing, project) : project);
  });

  const next = [...merged.values()].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  const before = JSON.stringify(local);
  const after = JSON.stringify(next);
  if (before === after) return false;

  writeArray(PROJECTS_KEY, next);
  saveCurrentWorkspaceToScope(currentScope());
  window.dispatchEvent(new Event('orbidoc:projects-cloud-merged'));
  return true;
}

/**
 * Pushes current projects and propagates deletions detected after an initialized
 * snapshot. Cloud deletion is therefore never inferred from an empty first read.
 */
export async function syncCurrentWorkspaceProjects(previousIds?: Set<string>): Promise<Set<string>> {
  const projects = readCurrentWorkspaceProjects();
  const currentIds = new Set(projects.map((project) => project.id).filter(Boolean));

  for (const project of projects) {
    try {
      const serialized = JSON.stringify(project);
      await saveDocumentToFirestore({
        id: project.id,
        title: project.title || 'Projeto OrbiDoc',
        content: serialized,
        docType: project.type,
        tags: project.tags || [],
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`OrbiDoc cloud sync skipped project ${project.id}:`, error);
    }
  }

  if (previousIds) {
    for (const id of previousIds) {
      if (!currentIds.has(id)) await deleteDocumentFromFirestore(id);
    }
  }

  saveCurrentWorkspaceToScope(currentScope());
  return currentIds;
}
