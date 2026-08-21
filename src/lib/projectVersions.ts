import type { SavedProject } from '../types';

export interface ProjectVersion {
  id: string;
  projectId: string;
  projectTitle: string;
  projectType: SavedProject['type'];
  createdAt: string;
  sourceUpdatedAt: string;
  size: number;
  restorable: boolean;
  project?: SavedProject;
}

const PROJECTS_KEY = 'orbidoc_projects_v1';
const VERSIONS_KEY = 'orbidoc_project_versions_v1';
const MAX_VERSIONS_PER_PROJECT = 8;
const MAX_TOTAL_VERSIONS = 120;
const MAX_RESTORABLE_BYTES = 650_000;
const MIN_AUTO_INTERVAL_MS = 2 * 60 * 1000;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

export const loadProjectVersions = () => readJson<ProjectVersion[]>(VERSIONS_KEY, []);

const writeVersions = (versions: ProjectVersion[]) => {
  const normalized = versions
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_TOTAL_VERSIONS);
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(normalized));
  } catch {
    const compact = normalized.map((version, index) => index < 30 ? version : { ...version, project: undefined, restorable: false });
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(compact.slice(0, 60)));
  }
  window.dispatchEvent(new Event('orbidoc:versions-updated'));
};

const projectSize = (project: SavedProject) => new Blob([JSON.stringify(project)]).size;

export function snapshotProject(project: SavedProject, force = false): ProjectVersion | null {
  const versions = loadProjectVersions();
  const currentVersions = versions.filter((version) => version.projectId === project.id);
  const latest = currentVersions[0];
  if (!force && latest) {
    if (latest.sourceUpdatedAt === project.updatedAt) return null;
    if (Date.now() - new Date(latest.createdAt).getTime() < MIN_AUTO_INTERVAL_MS) return null;
  }

  const size = projectSize(project);
  const restorable = size <= MAX_RESTORABLE_BYTES;
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    projectId: project.id,
    projectTitle: project.title,
    projectType: project.type,
    createdAt: new Date().toISOString(),
    sourceUpdatedAt: project.updatedAt,
    size,
    restorable,
    project: restorable ? structuredClone(project) : undefined,
  };

  const others = versions.filter((entry) => entry.projectId !== project.id);
  const nextProjectVersions = [version, ...currentVersions].slice(0, MAX_VERSIONS_PER_PROJECT);
  writeVersions([...nextProjectVersions, ...others]);
  return version;
}

export function snapshotAllProjects(force = false) {
  const projects = readJson<SavedProject[]>(PROJECTS_KEY, []);
  let created = 0;
  projects.forEach((project) => { if (snapshotProject(project, force)) created += 1; });
  return created;
}

export function restoreProjectVersion(versionId: string) {
  const version = loadProjectVersions().find((entry) => entry.id === versionId);
  if (!version?.restorable || !version.project) throw new Error('Esta versão é apenas um marco de histórico e não contém conteúdo restaurável.');
  const projects = readJson<SavedProject[]>(PROJECTS_KEY, []);
  const now = new Date().toISOString();
  const restored: SavedProject = {
    ...structuredClone(version.project),
    updatedAt: now,
    title: version.project.title,
  };
  const index = projects.findIndex((project) => project.id === restored.id);
  if (index >= 0) projects[index] = restored;
  else projects.unshift(restored);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event('orbidoc:projects-updated'));
  return restored;
}

export function deleteProjectVersion(versionId: string) {
  writeVersions(loadProjectVersions().filter((version) => version.id !== versionId));
}

export function clearProjectVersions(projectId?: string) {
  if (!projectId) writeVersions([]);
  else writeVersions(loadProjectVersions().filter((version) => version.projectId !== projectId));
}

export function formatVersionBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
