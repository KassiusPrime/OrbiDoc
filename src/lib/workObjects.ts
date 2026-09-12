/**
 * WorkObject — identidade listável do que o usuário abre no Orbit.
 *
 * Contrato de plataforma (comando mestre, §2.2):
 *   Shell → WorkObject → Surface
 *
 * O `SavedProject` legado continua sendo a fonte de verdade da persistência
 * (`localStorage.orbidoc_projects_v1`). `WorkObject` é o **adaptador** de
 * apresentação: a sidebar, a busca e a command palette falam WorkObject; os
 * editores continuam falando SavedProject. Nada é migrado nem reescrito.
 */
import type { SavedProject } from '../types';

export type WorkObjectKind = 'doc' | 'sheet' | 'deck' | 'repo' | 'chat' | 'file';

export type WorkObjectSource = 'local' | 'drive' | 'github';

export interface WorkObject {
  id: string;
  kind: WorkObjectKind;
  title: string;
  updatedAt: string;
  previewSnippet?: string;
  source?: WorkObjectSource;
  /** Metadados específicos do kind (branch, mime, owner, etc.). */
  meta?: Record<string, unknown>;
  /** Rota interna necessária para abrir o objeto. */
  route: string;
}

const PROJECT_KIND: Record<SavedProject['type'], WorkObjectKind> = {
  word: 'doc',
  excel: 'sheet',
  powerpoint: 'deck',
  canva: 'file',
  extract: 'file',
  chat: 'chat',
};

export const workObjectKindOf = (type: SavedProject['type']): WorkObjectKind => PROJECT_KIND[type] ?? 'file';

/** Converte um projeto local em WorkObject listável. */
export const workObjectFromProject = (project: SavedProject): WorkObject => ({
  id: `local:${project.id}`,
  kind: workObjectKindOf(project.type),
  title: project.title || 'Sem título',
  updatedAt: project.updatedAt,
  previewSnippet: project.previewSnippet,
  source: 'local',
  meta: { projectId: project.id, projectType: project.type, tags: project.tags },
  route: project.type,
});

export const KIND_LABEL: Record<WorkObjectKind, string> = {
  doc: 'Documento',
  sheet: 'Planilha',
  deck: 'Apresentação',
  repo: 'Repositório',
  chat: 'Conversa',
  file: 'Arquivo',
};

export const SOURCE_LABEL: Record<WorkObjectSource, string> = {
  local: 'Neste dispositivo',
  drive: 'Google Drive',
  github: 'GitHub',
};
