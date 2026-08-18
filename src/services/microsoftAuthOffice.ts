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
    const data = sessionStorage.getItem(STORAGE_KEY_MS) || localStorage.getItem(STORAGE_KEY_MS);
    if (!data) return null;
    const user: MicrosoftUserProfile = JSON.parse(data);

    // Purge legacy fabricated sessions from older DocSwiss builds.
    if (!user.accessToken || user.accessToken.startsWith('ms_token_') || (user.expiresAt && Date.now() >= user.expiresAt)) {
      logoutMicrosoftUser();
      return null;
    }

    sessionStorage.setItem(STORAGE_KEY_MS, JSON.stringify(user));
    localStorage.removeItem(STORAGE_KEY_MS);
    return user;
  } catch {
    logoutMicrosoftUser();
    return null;
  }
}

export function saveMicrosoftUser(user: MicrosoftUserProfile): void {
  if (!user.accessToken || user.accessToken.startsWith('ms_token_')) {
    throw new Error('Sessão Microsoft inválida.');
  }
  sessionStorage.setItem(STORAGE_KEY_MS, JSON.stringify(user));
  localStorage.removeItem(STORAGE_KEY_MS);
}

export function logoutMicrosoftUser(): void {
  sessionStorage.removeItem(STORAGE_KEY_MS);
  localStorage.removeItem(STORAGE_KEY_MS);
}

/**
 * Microsoft OAuth was previously simulated. That behavior was removed because a fabricated
 * account must never be presented as a real Office 365 / OneDrive connection.
 */
export async function loginWithMicrosoftPopup(): Promise<MicrosoftUserProfile> {
  logoutMicrosoftUser();
  throw new Error(
    'A conexão Microsoft 365 está temporariamente desativada até o OAuth oficial (Microsoft Entra ID / Graph) ser configurado. O modo de demonstração inseguro foi removido.'
  );
}

export async function uploadToOneDrive(
  _user: MicrosoftUserProfile,
  _fileName: string,
  _content: string | Blob,
  _mimeType: string = 'text/plain'
): Promise<OneDriveFile> {
  throw new Error('OneDrive exige integração oficial com Microsoft Graph; armazenamento local não é tratado como OneDrive.');
}

export async function listOneDriveFiles(_user: MicrosoftUserProfile): Promise<OneDriveFile[]> {
  throw new Error('OneDrive exige integração oficial com Microsoft Graph.');
}

export async function downloadOneDriveFile(_fileId: string): Promise<string> {
  throw new Error('OneDrive exige integração oficial com Microsoft Graph.');
}
