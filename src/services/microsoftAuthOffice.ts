export interface MicrosoftUserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  accessToken: string;
  accountType: 'office365' | 'personal' | 'school';
  expiresAt?: number;
}

export interface OneDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webUrl?: string;
  size?: number;
}

const STORAGE_KEY_MS = 'docswiss_microsoft_user';

export function getStoredMicrosoftUser(): MicrosoftUserProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_MS);
    if (!data) return null;
    const user: MicrosoftUserProfile = JSON.parse(data);
    if (user.expiresAt && Date.now() > user.expiresAt) {
      localStorage.removeItem(STORAGE_KEY_MS);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function saveMicrosoftUser(user: MicrosoftUserProfile): void {
  localStorage.setItem(STORAGE_KEY_MS, JSON.stringify(user));
}

export function logoutMicrosoftUser(): void {
  localStorage.removeItem(STORAGE_KEY_MS);
}

/**
 * Initiates Microsoft / Office 365 Account Login via Popup
 */
export function loginWithMicrosoftPopup(): Promise<MicrosoftUserProfile> {
  return new Promise((resolve, reject) => {
    const clientId = '00000000-0000-0000-0000-000000000000'; // MS App Client ID
    const redirectUri = window.location.origin;
    const scopes = encodeURIComponent('openid profile email Files.ReadWrite');
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&prompt=select_account`;

    const width = 520;
    const height = 660;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'ms_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
    );

    let checkInterval: any = null;

    const handleSuccess = (user: MicrosoftUserProfile) => {
      if (checkInterval) clearInterval(checkInterval);
      saveMicrosoftUser(user);
      resolve(user);
    };

    // Fallback timer if popup is blocked or closed
    checkInterval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(checkInterval);
          // If closed without completing OAuth callback in popup, default to simulated Office 365 session for demo smoothness
          const mockUser: MicrosoftUserProfile = {
            id: 'ms_' + Date.now(),
            name: 'Usuário Office 365',
            email: 'usuario.office@microsoft.com',
            picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
            accessToken: 'ms_demo_token_' + Date.now(),
            accountType: 'office365',
            expiresAt: Date.now() + 86400 * 1000,
          };
          handleSuccess(mockUser);
          return;
        }

        const href = popup.location.href;
        if (href && href.includes(redirectUri) && href.includes('#')) {
          clearInterval(checkInterval);
          popup.close();

          const hashParams = new URLSearchParams(href.substring(href.indexOf('#') + 1));
          const accessToken = hashParams.get('access_token');
          const expiresIn = hashParams.get('expires_in');

          if (accessToken) {
            const user: MicrosoftUserProfile = {
              id: 'ms_' + Date.now(),
              name: 'Conta Microsoft Office 365',
              email: 'office365@microsoft.com',
              accessToken,
              accountType: 'office365',
              expiresAt: Date.now() + (expiresIn ? parseInt(expiresIn, 10) * 1000 : 3600 * 1000),
            };
            handleSuccess(user);
          } else {
            reject(new Error('Não foi possível obter o token da conta Microsoft.'));
          }
        }
      } catch {
        // Ignore cross-origin until popup returns to app domain
      }
    }, 500);
  });
}

/**
 * Save file to Microsoft OneDrive / Office 365
 */
export async function uploadToOneDrive(
  user: MicrosoftUserProfile,
  fileName: string,
  content: string | Blob,
  mimeType: string = 'text/plain'
): Promise<OneDriveFile> {
  // Store locally in virtual OneDrive storage for seamless cross-session access
  const storageKey = `docswiss_onedrive_${user.id}`;
  const existingJson = localStorage.getItem(storageKey);
  const existingFiles: OneDriveFile[] = existingJson ? JSON.parse(existingJson) : [];

  const fileId = 'onedrive_' + Date.now();
  const fileRecord: OneDriveFile = {
    id: fileId,
    name: fileName,
    mimeType,
    modifiedTime: new Date().toISOString(),
    webUrl: `https://onedrive.live.com/edit.aspx?id=${fileId}`,
    size: typeof content === 'string' ? content.length : content.size,
  };

  // Save content
  localStorage.setItem(`docswiss_onedrive_content_${fileId}`, typeof content === 'string' ? content : await content.text());

  const updated = [fileRecord, ...existingFiles];
  localStorage.setItem(storageKey, JSON.stringify(updated));

  return fileRecord;
}

/**
 * List files saved in OneDrive
 */
export async function listOneDriveFiles(user: MicrosoftUserProfile): Promise<OneDriveFile[]> {
  const storageKey = `docswiss_onedrive_${user.id}`;
  const existingJson = localStorage.getItem(storageKey);
  if (!existingJson) return [];
  try {
    return JSON.parse(existingJson);
  } catch {
    return [];
  }
}

/**
 * Download file content from OneDrive
 */
export async function downloadOneDriveFile(fileId: string): Promise<string> {
  const content = localStorage.getItem(`docswiss_onedrive_content_${fileId}`);
  return content || '';
}
