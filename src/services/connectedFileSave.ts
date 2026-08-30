import type { OrbiDocFileOrigin, SavedProject } from '../types';
import { getStoredGoogleUser } from './googleAuthDrive';
import { getStoredMicrosoftUser } from './microsoftAuthOffice';
import { serializeProjectToSourceFile } from '../lib/projectFileSerialization';

export class ConnectedFileConflictError extends Error {
  readonly remoteModifiedTime?: string;
  constructor(message: string, remoteModifiedTime?: string) {
    super(message);
    this.name = 'ConnectedFileConflictError';
    this.remoteModifiedTime = remoteModifiedTime;
  }
}

export function canSaveProjectToOrigin(project: SavedProject) {
  const origin = project.origin;
  if (!origin?.providerId || origin.readOnly) return false;
  return origin.source === 'google-drive' || origin.source === 'onedrive';
}

const sameRevision = (origin: OrbiDocFileOrigin, currentModifiedTime?: string, currentEtag?: string) => {
  if (origin.etag && currentEtag) return origin.etag === currentEtag;
  if (origin.modifiedTime && currentModifiedTime) return origin.modifiedTime === currentModifiedTime;
  return true;
};

async function saveGoogle(project: SavedProject, origin: OrbiDocFileOrigin) {
  const user = getStoredGoogleUser();
  if (!user) throw new Error('A autorização do Google Drive expirou. Reconecte o Drive em Configurações.');
  const id = encodeURIComponent(origin.providerId || '');
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,modifiedTime,version,capabilities(canEdit)`,
    { headers: { Authorization: `Bearer ${user.accessToken}` } },
  );
  if (metadataResponse.status === 401) throw new Error('A autorização do Google Drive expirou. Reconecte o Drive em Configurações.');
  if (!metadataResponse.ok) throw new Error(`Não foi possível validar a versão no Google Drive (${metadataResponse.status}).`);
  const current = await metadataResponse.json();
  const currentEtag = current.version ? `version:${String(current.version)}` : undefined;
  if (current.capabilities?.canEdit === false) throw new Error('O Google Drive informa que este arquivo não pode ser editado por esta conta.');
  if (!sameRevision(origin, String(current.modifiedTime || ''), currentEtag)) {
    throw new ConnectedFileConflictError('O arquivo mudou no Google Drive desde que foi aberto. O OrbiDoc não sobrescreveu a versão mais nova.', String(current.modifiedTime || ''));
  }

  const output = await serializeProjectToSourceFile(project);
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id,name,mimeType,modifiedTime,version`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        'Content-Type': output.type || 'application/octet-stream',
      },
      body: output,
    },
  );
  if (!response.ok) {
    let message = `Google Drive ${response.status}`;
    try { message = (await response.json())?.error?.message || message; } catch { /* keep status */ }
    throw new Error(message);
  }
  const updated = await response.json();
  return {
    ...origin,
    providerName: String(updated.name || origin.providerName || output.name),
    mimeType: String(updated.mimeType || origin.mimeType || output.type),
    modifiedTime: String(updated.modifiedTime || new Date().toISOString()),
    etag: updated.version ? `version:${String(updated.version)}` : origin.etag,
    openedAt: new Date().toISOString(),
  } satisfies OrbiDocFileOrigin;
}

async function saveOneDrive(project: SavedProject, origin: OrbiDocFileOrigin) {
  const user = getStoredMicrosoftUser();
  if (!user) throw new Error('A autorização do OneDrive expirou. Reconecte a conta Microsoft em Configurações.');
  const id = encodeURIComponent(origin.providerId || '');
  const metadataResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${id}?$select=id,name,eTag,lastModifiedDateTime,file`,
    { headers: { Authorization: `Bearer ${user.accessToken}` } },
  );
  if (metadataResponse.status === 401) throw new Error('A autorização do OneDrive expirou. Reconecte a conta Microsoft em Configurações.');
  if (!metadataResponse.ok) throw new Error(`Não foi possível validar a versão no OneDrive (${metadataResponse.status}).`);
  const current = await metadataResponse.json();
  const currentEtag = current.eTag ? String(current.eTag) : undefined;
  const currentModifiedTime = String(current.lastModifiedDateTime || '');
  if (!sameRevision(origin, currentModifiedTime, currentEtag)) {
    throw new ConnectedFileConflictError('O arquivo mudou no OneDrive desde que foi aberto. O OrbiDoc não sobrescreveu a versão mais nova.', currentModifiedTime);
  }

  const output = await serializeProjectToSourceFile(project);
  if (output.size > 250 * 1024 * 1024) throw new Error('Este arquivo excede 250 MB e precisa de uma sessão de upload do OneDrive.');
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${id}/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'Content-Type': output.type || 'application/octet-stream',
      ...(currentEtag ? { 'If-Match': currentEtag } : {}),
    },
    body: output,
  });
  if (response.status === 412) {
    throw new ConnectedFileConflictError('O OneDrive detectou uma alteração concorrente. O OrbiDoc não sobrescreveu o arquivo.');
  }
  if (!response.ok) {
    let message = `Microsoft Graph ${response.status}`;
    try { message = (await response.json())?.error?.message || message; } catch { /* keep status */ }
    throw new Error(message);
  }
  const updated = await response.json();
  return {
    ...origin,
    providerName: String(updated.name || origin.providerName || output.name),
    mimeType: String(updated.file?.mimeType || origin.mimeType || output.type),
    modifiedTime: String(updated.lastModifiedDateTime || new Date().toISOString()),
    etag: updated.eTag ? String(updated.eTag) : currentEtag,
    openedAt: new Date().toISOString(),
  } satisfies OrbiDocFileOrigin;
}

export async function saveProjectToConnectedOrigin(project: SavedProject) {
  const origin = project.origin;
  if (!origin || !canSaveProjectToOrigin(project)) throw new Error('Este arquivo não possui uma origem conectada gravável. Use Salvar cópia.');
  if (origin.source === 'google-drive') return saveGoogle(project, origin);
  if (origin.source === 'onedrive') return saveOneDrive(project, origin);
  throw new Error('Esta origem ainda é somente leitura.');
}
