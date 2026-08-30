import type { DriveFile, GoogleUserProfile, MicrosoftUserProfile } from '../types';
import type { OneDriveFile } from './microsoftAuthOffice';
import { bindOrbiDocFileOrigin } from '../lib/systemFileOpen';

const GOOGLE_NATIVE_EXPORTS: Record<string, { mime: string; extension: string }> = {
  'application/vnd.google-apps.document': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
  'application/vnd.google-apps.presentation': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' },
  'application/vnd.google-apps.drawing': { mime: 'application/pdf', extension: 'pdf' },
};

const replaceExtension = (name: string, extension: string) => {
  const base = name.replace(/\.[^/.]+$/, '');
  return `${base || 'arquivo'}.${extension}`;
};

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || '';

export async function downloadGoogleDriveAsFile(user: GoogleUserProfile, file: DriveFile): Promise<File> {
  if (!user?.accessToken) throw new Error('Conecte o Google Drive novamente.');

  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?fields=id,name,mimeType,modifiedTime,version,size`,
    { headers: { Authorization: `Bearer ${user.accessToken}` } },
  );
  if (!metadataResponse.ok) throw new Error(`Google Drive ${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  const sourceMime = String(metadata.mimeType || file.mimeType || 'application/octet-stream');
  const native = GOOGLE_NATIVE_EXPORTS[sourceMime];
  const url = native
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(native.mime)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${user.accessToken}` } });
  if (!response.ok) {
    let message = `Google Drive ${response.status}`;
    try { message = (await response.json())?.error?.message || message; } catch { /* binary response */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  const originalName = String(metadata.name || file.name);
  const name = native ? replaceExtension(originalName, native.extension) : originalName;
  const opened = new File([blob], name, { type: blob.type || native?.mime || sourceMime, lastModified: Date.now() });
  return bindOrbiDocFileOrigin(opened, {
    source: 'google-drive',
    providerId: file.id,
    providerName: originalName,
    mimeType: sourceMime,
    originalExtension: native ? native.extension : extensionOf(name),
    modifiedTime: String(metadata.modifiedTime || file.modifiedTime || ''),
    etag: metadata.version ? `version:${String(metadata.version)}` : undefined,
    readOnly: Boolean(native),
  });
}

export async function downloadOneDriveAsFile(user: MicrosoftUserProfile, file: OneDriveFile): Promise<File> {
  if (!user?.accessToken) throw new Error('Conecte o OneDrive novamente.');
  if (file.isFolder) throw new Error('Abra a pasta antes de tentar baixar seu conteúdo.');

  const metadata = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(file.id)}?$select=id,name,file,size,lastModifiedDateTime,eTag,@microsoft.graph.downloadUrl`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (!metadata.ok) {
    if (metadata.status === 401) throw new Error('A sessão Microsoft expirou. Conecte a conta novamente.');
    throw new Error(`Microsoft Graph ${metadata.status}`);
  }
  const item = await metadata.json();
  const downloadUrl = item['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) throw new Error('O OneDrive não forneceu uma URL temporária para este arquivo.');
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Falha ao baixar ${file.name} do OneDrive (${response.status}).`);
  const blob = await response.blob();
  const name = String(item.name || file.name);
  const opened = new File([blob], name, { type: blob.type || item.file?.mimeType || file.mimeType || 'application/octet-stream', lastModified: Date.now() });
  return bindOrbiDocFileOrigin(opened, {
    source: 'onedrive',
    providerId: String(item.id || file.id),
    providerName: name,
    mimeType: String(item.file?.mimeType || file.mimeType || blob.type || 'application/octet-stream'),
    originalExtension: extensionOf(name),
    modifiedTime: String(item.lastModifiedDateTime || file.modifiedTime || ''),
    etag: item.eTag ? String(item.eTag) : undefined,
    readOnly: false,
  });
}
