import { GoogleUserProfile, DriveFile } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || firebaseConfig.oAuthClientId || '';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const STORAGE_KEY_USER = 'orbidoc_google_user';
const TOKEN_SAFETY_WINDOW_MS = 60_000;
const DRIVE_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,size';

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

function sanitizeStoredProfile(user: GoogleUserProfile): GoogleUserProfile | null {
  if (!user?.id || !user?.email) return null;
  if (user.expiresAt && Date.now() + TOKEN_SAFETY_WINDOW_MS >= user.expiresAt) return null;
  if (!user.accessToken || user.accessToken.startsWith('google_token_') || user.accessToken.startsWith('firebase_token_')) return null;
  return user;
}

export function getStoredGoogleUser(): GoogleUserProfile | null {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY_USER) || localStorage.getItem(STORAGE_KEY_USER);
    if (!data) return null;
    const user = sanitizeStoredProfile(JSON.parse(data));
    if (!user) {
      sessionStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_USER);
      return null;
    }
    sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    localStorage.removeItem(STORAGE_KEY_USER);
    return user;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_USER);
    return null;
  }
}

export function saveGoogleUser(user: GoogleUserProfile): void {
  const safeUser = sanitizeStoredProfile(user);
  if (!safeUser) throw new Error('Sessão Google inválida ou sem token OAuth válido.');
  sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(safeUser));
  localStorage.removeItem(STORAGE_KEY_USER);
}

export function logoutGoogleUser(): void {
  sessionStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(STORAGE_KEY_USER);
}

/** Initiates a real Google OAuth flow. No fabricated/demo identity is accepted. */
export function loginWithGooglePopup(): Promise<GoogleUserProfile> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Autenticação Google indisponível fora do navegador.'));
      return;
    }
    if (!(window as any).google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services não foi carregado. Recarregue a página e tente novamente.'));
      return;
    }
    if (!CLIENT_ID) {
      reject(new Error('Google OAuth não está configurado. Defina VITE_GOOGLE_CLIENT_ID no ambiente de implantação.'));
      return;
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (!response?.access_token) {
            reject(new Error(response?.error_description || 'Autenticação Google cancelada ou recusada.'));
            return;
          }
          try {
            const expiresInSeconds = Number(response.expires_in || 3600);
            const profile = await fetchGoogleUserProfile(response.access_token);
            profile.expiresAt = Date.now() + Math.max(60, expiresInSeconds) * 1000;
            saveGoogleUser(profile);
            resolve(profile);
          } catch (error: any) {
            reject(new Error(error?.message || 'Não foi possível validar a Conta Google.'));
          }
        },
        error_callback: (error: any) => reject(new Error(error?.message || 'Falha ao abrir a autenticação Google.')),
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (error: any) {
      reject(new Error(error?.message || 'Falha ao inicializar a autenticação Google.'));
    }
  });
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Falha ao validar o perfil da Conta Google.');
  const data = await response.json();
  if (!data?.sub || !data?.email) throw new Error('A Conta Google não retornou um perfil válido.');
  return { id: data.sub, name: data.name || data.email, email: data.email, picture: data.picture, accessToken };
}

export async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  content: string | Blob
): Promise<DriveFile> {
  const metadata = { name: fileName, mimeType, description: 'Documento criado via OrbiDoc' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', typeof content === 'string' ? new Blob([content], { type: mimeType }) : content);

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(DRIVE_FIELDS)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao enviar arquivo para o Google Drive (${response.status})`);
  }
  const data = await response.json();
  return { id: data.id, name: data.name, mimeType: data.mimeType, modifiedTime: data.modifiedTime, webViewLink: data.webViewLink, size: data.size };
}

export async function getGoogleDriveFileMetadata(accessToken: string, fileId: string): Promise<DriveFile> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(DRIVE_FIELDS)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Falha ao verificar a versão do arquivo no Google Drive (${response.status}).`);
  }
  const data = await response.json();
  return { id: data.id, name: data.name, mimeType: data.mimeType, modifiedTime: data.modifiedTime, webViewLink: data.webViewLink, size: data.size };
}

export async function updateGoogleDriveFileContent(accessToken: string, fileId: string, content: Blob, mimeType: string): Promise<DriveFile> {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${encodeURIComponent(DRIVE_FIELDS)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': content.type || mimeType || 'application/octet-stream',
      },
      body: content,
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Falha ao atualizar o arquivo no Google Drive (${response.status}).`);
  }
  const data = await response.json();
  return { id: data.id, name: data.name, mimeType: data.mimeType, modifiedTime: data.modifiedTime, webViewLink: data.webViewLink, size: data.size };
}

/** Lists files that the drive.file OAuth scope makes available to this OrbiDoc client. */
export async function listGoogleDriveFiles(accessToken: string): Promise<DriveFile[]> {
  const query = encodeURIComponent('trashed = false');
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(${DRIVE_FIELDS})&pageSize=30&orderBy=modifiedTime%20desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao listar os arquivos do Google Drive disponíveis ao OrbiDoc.');
  }
  const data = await response.json();
  return data.files || [];
}

export async function downloadGoogleDriveFile(accessToken: string, fileId: string): Promise<string> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Erro ao baixar arquivo do Google Drive.');
  return response.text();
}