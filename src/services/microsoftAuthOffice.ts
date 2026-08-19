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
  isFolder?: boolean;
}

const STORAGE_KEY_MS = 'orbidoc_microsoft_user';
const PKCE_KEY_PREFIX = 'orbidoc_ms_pkce_';
const OAUTH_MESSAGE = 'orbidoc:microsoft-oauth';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TENANT = 'common';
const SCOPES = ['openid', 'profile', 'email', 'User.Read', 'Files.ReadWrite'];

const clientId = () => String(import.meta.env.VITE_MICROSOFT_CLIENT_ID || '').trim();
const redirectUri = () => `${window.location.origin}/auth/microsoft`;

const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const randomString = (length = 64) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes).slice(0, length);
};

const sha256Challenge = async (verifier: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
};

const encodeDrivePath = (fileName: string) => fileName
  .split('/')
  .filter(Boolean)
  .map((segment) => encodeURIComponent(segment))
  .join('/');

const inferAccountType = (email: string): MicrosoftUserProfile['accountType'] => {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return 'personal';
  if (domain.includes('edu') || domain.includes('school') || domain.includes('aluno')) return 'school';
  return 'office365';
};

export function isMicrosoftOAuthConfigured() {
  return Boolean(clientId());
}

export function getStoredMicrosoftUser(): MicrosoftUserProfile | null {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY_MS) || localStorage.getItem(STORAGE_KEY_MS);
    if (!data) return null;
    const user: MicrosoftUserProfile = JSON.parse(data);
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
  if (!user.accessToken || user.accessToken.startsWith('ms_token_')) throw new Error('Sessão Microsoft inválida.');
  sessionStorage.setItem(STORAGE_KEY_MS, JSON.stringify(user));
  localStorage.removeItem(STORAGE_KEY_MS);
}

export function logoutMicrosoftUser(): void {
  sessionStorage.removeItem(STORAGE_KEY_MS);
  localStorage.removeItem(STORAGE_KEY_MS);
}

async function exchangeAuthorizationCode(code: string, state: string): Promise<MicrosoftUserProfile> {
  const raw = localStorage.getItem(`${PKCE_KEY_PREFIX}${state}`);
  if (!raw) throw new Error('Estado de login Microsoft expirou. Inicie o login novamente.');
  localStorage.removeItem(`${PKCE_KEY_PREFIX}${state}`);
  const stored = JSON.parse(raw) as { verifier: string; createdAt: number; redirectUri: string };
  if (!stored.verifier || Date.now() - stored.createdAt > 10 * 60 * 1000) throw new Error('Código PKCE Microsoft expirado.');

  const body = new URLSearchParams({
    client_id: clientId(),
    scope: SCOPES.join(' '),
    code,
    redirect_uri: stored.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: stored.verifier,
  });

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description || 'Microsoft não retornou um token de acesso.');

  const profileResponse = await fetch(`${GRAPH_BASE}/me?$select=id,displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.id) throw new Error(profile.error?.message || 'Não foi possível carregar o perfil Microsoft.');
  const email = String(profile.mail || profile.userPrincipalName || '').trim();
  if (!email) throw new Error('A conta Microsoft não retornou um e-mail utilizável.');

  return {
    id: String(profile.id),
    name: String(profile.displayName || email.split('@')[0]),
    email,
    accessToken: String(tokenData.access_token),
    accountType: inferAccountType(email),
    expiresAt: Date.now() + Math.max(60, Number(tokenData.expires_in) || 3600) * 1000 - 60_000,
  };
}

async function completeOAuthPopupIfNeeded() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/auth/microsoft') return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error_description') || params.get('error');
  if (!window.opener) return;

  try {
    if (error) throw new Error(error);
    if (!code || !state) throw new Error('Resposta OAuth Microsoft incompleta.');
    const user = await exchangeAuthorizationCode(code, state);
    window.opener.postMessage({ type: OAUTH_MESSAGE, user }, window.location.origin);
  } catch (oauthError: any) {
    window.opener.postMessage({ type: OAUTH_MESSAGE, error: oauthError?.message || 'Falha no login Microsoft.' }, window.location.origin);
  } finally {
    window.close();
  }
}

void completeOAuthPopupIfNeeded();

export async function loginWithMicrosoftPopup(): Promise<MicrosoftUserProfile> {
  const id = clientId();
  if (!id) throw new Error('Configure VITE_MICROSOFT_CLIENT_ID e cadastre /auth/microsoft como Redirect URI do tipo SPA no Microsoft Entra.');

  const verifier = randomString(64);
  const challenge = await sha256Challenge(verifier);
  const state = randomString(40);
  const callback = redirectUri();
  localStorage.setItem(`${PKCE_KEY_PREFIX}${state}`, JSON.stringify({ verifier, createdAt: Date.now(), redirectUri: callback }));

  const authorize = new URL(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
  authorize.searchParams.set('client_id', id);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('response_mode', 'query');
  authorize.searchParams.set('scope', SCOPES.join(' '));
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('prompt', 'select_account');

  const popup = window.open(authorize.toString(), 'orbidoc_microsoft_oauth', 'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes');
  if (!popup) {
    localStorage.removeItem(`${PKCE_KEY_PREFIX}${state}`);
    throw new Error('O navegador bloqueou a janela de login Microsoft. Permita pop-ups para o OrbiDoc e tente novamente.');
  }

  return await new Promise<MicrosoftUserProfile>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('O login Microsoft expirou antes de ser concluído.'));
    }, 3 * 60 * 1000);
    const closedCheck = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('A janela de login Microsoft foi fechada.'));
      }
    }, 600);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== OAUTH_MESSAGE) return;
      cleanup();
      if (event.data.error) {
        reject(new Error(String(event.data.error)));
        return;
      }
      const user = event.data.user as MicrosoftUserProfile;
      saveMicrosoftUser(user);
      resolve(user);
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(closedCheck);
      window.removeEventListener('message', onMessage);
      localStorage.removeItem(`${PKCE_KEY_PREFIX}${state}`);
    };

    window.addEventListener('message', onMessage);
  });
}

function assertValidSession(user: MicrosoftUserProfile) {
  if (!user?.accessToken || user.accessToken.startsWith('ms_token_')) throw new Error('Sessão Microsoft inválida. Conecte a conta novamente.');
  if (user.expiresAt && Date.now() >= user.expiresAt) {
    logoutMicrosoftUser();
    throw new Error('A sessão Microsoft expirou. Conecte a conta novamente.');
  }
}

async function graphFetch(user: MicrosoftUserProfile, path: string, init: RequestInit = {}) {
  assertValidSession(user);
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      ...init.headers,
    },
  });
  if (response.status === 401) logoutMicrosoftUser();
  if (!response.ok) {
    let message = `Microsoft Graph ${response.status}`;
    try {
      const data = await response.json();
      message = data.error?.message || message;
    } catch { /* keep status */ }
    throw new Error(message);
  }
  return response;
}

export async function uploadToOneDrive(
  user: MicrosoftUserProfile,
  fileName: string,
  content: string | Blob,
  mimeType: string = 'application/octet-stream',
): Promise<OneDriveFile> {
  const body = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  if (body.size > 250 * 1024 * 1024) throw new Error('Upload simples do OneDrive aceita arquivos de até 250 MB. Para arquivos maiores é necessária uma sessão de upload.');
  const safeName = fileName.replace(/["*:<>?\\|]/g, '_').replace(/^\.+/, '') || 'arquivo';
  const response = await graphFetch(user, `/me/drive/root:/${encodeDrivePath(safeName)}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': body.type || mimeType },
    body,
  });
  const item = await response.json();
  return {
    id: String(item.id),
    name: String(item.name || safeName),
    mimeType: String(item.file?.mimeType || body.type || mimeType),
    modifiedTime: String(item.lastModifiedDateTime || new Date().toISOString()),
    webUrl: item.webUrl,
    size: Number(item.size) || body.size,
    isFolder: Boolean(item.folder),
  };
}

export async function listOneDriveFiles(user: MicrosoftUserProfile): Promise<OneDriveFile[]> {
  const response = await graphFetch(user, '/me/drive/root/children?$select=id,name,size,lastModifiedDateTime,webUrl,file,folder&$orderby=lastModifiedDateTime%20desc&$top=200');
  const data = await response.json();
  return (Array.isArray(data.value) ? data.value : []).map((item: any) => ({
    id: String(item.id),
    name: String(item.name || 'Sem nome'),
    mimeType: String(item.file?.mimeType || (item.folder ? 'application/vnd.microsoft.folder' : 'application/octet-stream')),
    modifiedTime: String(item.lastModifiedDateTime || ''),
    webUrl: item.webUrl,
    size: Number(item.size) || 0,
    isFolder: Boolean(item.folder),
  }));
}

export async function downloadOneDriveFile(fileId: string, user?: MicrosoftUserProfile): Promise<Blob> {
  const session = user || getStoredMicrosoftUser();
  if (!session) throw new Error('Conecte uma conta Microsoft antes de baixar do OneDrive.');
  const response = await graphFetch(session, `/me/drive/items/${encodeURIComponent(fileId)}/content`);
  return response.blob();
}
