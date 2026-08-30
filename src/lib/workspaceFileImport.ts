import type { OcrItem, OrbiDocFileOrigin, OrbiDocFileSource, SavedProject } from '../types';
import { createEditorProjectFromFile, editorRouteForFile } from './editorFileRouting';

export type WorkspaceEditorRoute = 'word' | 'excel' | 'powerpoint' | 'extract';

export type ImportedWorkspaceFile = {
  route: WorkspaceEditorRoute;
  project: SavedProject;
  ocrItems?: OcrItem[];
  cleanup?: () => void;
};

const extensionOf = (file: File) => file.name.split('.').pop()?.toLowerCase() || '';
const baseName = (name: string) => name.replace(/\.[^/.]+$/, '').trim() || 'Arquivo';

const sourceLabel = (source: OrbiDocFileSource) => ({
  local: 'Arquivo local',
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  github: 'GitHub',
  share: 'Compartilhado com OrbiDoc',
  system: 'Sistema',
}[source]);

export function resolveWorkspaceEditor(file: File): WorkspaceEditorRoute | null {
  const editor = editorRouteForFile(file);
  if (editor) return editor;
  const extension = extensionOf(file);
  return extension === 'pdf' || file.type === 'application/pdf' ? 'extract' : null;
}

export async function importWorkspaceFile(
  file: File,
  source: OrbiDocFileSource = 'local',
  origin?: Partial<OrbiDocFileOrigin>,
): Promise<ImportedWorkspaceFile> {
  const route = resolveWorkspaceEditor(file);
  if (!route) throw new Error('Este formato deve continuar no leitor universal.');

  if (route !== 'extract') {
    const project = await createEditorProjectFromFile(file, source, origin);
    return { route, project };
  }

  const now = new Date().toISOString();
  const url = URL.createObjectURL(file);
  const item: OcrItem = {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileSize: file.size,
    text: '',
    status: 'completed',
    progress: 100,
    timestamp: now,
    fileUrl: url,
    fileType: file.type || 'application/pdf',
    tags: ['PDF', sourceLabel(source)],
  };
  const project: SavedProject = {
    id: crypto.randomUUID(),
    title: baseName(file.name),
    type: 'extract',
    createdAt: now,
    updatedAt: now,
    previewSnippet: `${sourceLabel(source)} · ${file.name}`,
    tags: ['Importado', 'PDF', sourceLabel(source)],
    content: { ocrItems: [{ ...item, fileUrl: undefined }] },
    origin: {
      ...origin,
      source,
      providerName: origin?.providerName || file.name,
      mimeType: origin?.mimeType || file.type || 'application/pdf',
      originalExtension: origin?.originalExtension || extensionOf(file),
      readOnly: true,
      openedAt: origin?.openedAt || now,
    },
  };
  return { route, project, ocrItems: [item], cleanup: () => URL.revokeObjectURL(url) };
}
