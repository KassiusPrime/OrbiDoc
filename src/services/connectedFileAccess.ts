import type { DriveFile, GoogleUserProfile, MicrosoftUserProfile } from '../types';
import type { OneDriveFile } from './microsoftAuthOffice';

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

export async function downloadGoogleDriveAsFile(user: GoogleUserProfile, file: DriveFile): Promise<File> {
  if (!user?.accessToken) throw new Error('Conecte o Google Drive novamente.');
  const native = GOOGLE_NATIVE_EXPORTS[file.mimeType];
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
  const name = native ? replaceExtension(file.name, native.extension) : file.name;
  return new File([blob], name, { type: blob.type || native?.mime || file.mimeType || 'application/octet-stream', lastModified: Date.now() });
}

export async function downloadOneDriveAsFile(user: MicrosoftUserProfile, file: OneDriveFile): Promise<File> {
  if (!user?.accessToken) throw new Error('Conecte o OneDrive novamente.');
  if (file.isFolder) throw new Error('Abra a pasta antes de tentar baixar seu conteúdo.');

  const metadata = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(file.id)}?$select=id,name,file,@microsoft.graph.downloadUrl`, {
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
  return new File([blob], String(item.name || file.name), { type: blob.type || item.file?.mimeType || file.mimeType || 'application/octet-stream', lastModified: Date.now() });
}
