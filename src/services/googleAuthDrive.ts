import { GoogleUserProfile, DriveFile } from '../types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const STORAGE_KEY_USER = 'docswiss_google_user';

export function getStoredGoogleUser(): GoogleUserProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER);
    if (!data) return null;
    const user: GoogleUserProfile = JSON.parse(data);
    if (user.expiresAt && Date.now() > user.expiresAt) {
      localStorage.removeItem(STORAGE_KEY_USER);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function saveGoogleUser(user: GoogleUserProfile): void {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}

export function logoutGoogleUser(): void {
  localStorage.removeItem(STORAGE_KEY_USER);
}

/**
 * Initiates Google OAuth Login via Popup Window
 */
export function loginWithGooglePopup(): Promise<GoogleUserProfile> {
  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID || '823901238491-aistudio.apps.googleusercontent.com');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'select_account');

    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl.toString(),
      'google_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
    );

    if (!popup) {
      reject(new Error('Bloqueador de popups impediu a janela do Google. Permitir popups e tentar novamente.'));
      return;
    }

    const checkInterval = setInterval(async () => {
      try {
        if (!popup || popup.closed) {
          clearInterval(checkInterval);
          reject(new Error('Janela de login fechada pelo usuário.'));
          return;
        }

        const href = popup.location.href;
        if (href && href.includes(redirectUri) && href.includes('#')) {
          clearInterval(checkInterval);
          popup.close();

          const hashParams = new URLSearchParams(href.substring(href.indexOf('#') + 1));
          const accessToken = hashParams.get('access_token');
          const expiresIn = hashParams.get('expires_in');

          if (!accessToken) {
            reject(new Error('Token de acesso do Google não recebido.'));
            return;
          }

          // Fetch User Profile
          const profile = await fetchGoogleUserProfile(accessToken);
          profile.accessToken = accessToken;
          if (expiresIn) {
            profile.expiresAt = Date.now() + parseInt(expiresIn, 10) * 1000;
          }

          saveGoogleUser(profile);
          resolve(profile);
        }
      } catch {
        // Ignore cross-origin errors while user is logging in on Google domain
      }
    }, 500);
  });
}

/**
 * Fetch Google User Profile using Access Token
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Falha ao obter perfil do Google User.');
  }

  const data = await response.json();
  return {
    id: data.sub || data.id,
    name: data.name || data.email,
    email: data.email,
    picture: data.picture,
    accessToken,
  };
}

/**
 * Upload a file directly to the User's Google Drive (Restricted to app-created files scope)
 */
export async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  content: string | Blob
): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    mimeType,
    description: 'Documento criado via DocSwiss',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  
  if (typeof content === 'string') {
    form.append('file', new Blob([content], { type: mimeType }));
  } else {
    form.append('file', content);
  }

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,size', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao enviar arquivo para o Google Drive (${response.status})`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    modifiedTime: data.modifiedTime,
    webViewLink: data.webViewLink,
    size: data.size,
  };
}

/**
 * List files saved in the user's Google Drive by DocSwiss
 */
export async function listGoogleDriveFiles(accessToken: string): Promise<DriveFile[]> {
  const query = encodeURIComponent("trashed = false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&pageSize=30&orderBy=modifiedTime%20desc`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao listar arquivos do Google Drive.');
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Download file content from Google Drive
 */
export async function downloadGoogleDriveFile(accessToken: string, fileId: string): Promise<string> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao baixar arquivo do Google Drive.');
  }

  return response.text();
}
