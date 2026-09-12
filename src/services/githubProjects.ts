export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  accessToken: string;
  expiresAt?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  owner: string;
  permissions: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean; pull?: boolean };
  installationId: number;
}

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url?: string;
}

export interface GitHubTextFile {
  path: string;
  sha: string;
  content: string;
  encoding: 'utf-8';
  size: number;
}

const STORAGE_KEY = 'orbidoc_github_user';
const STATE_PREFIX = 'orbidoc_github_oauth_';
const OAUTH_MESSAGE = 'orbidoc:github-oauth';
const API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const TOKEN_SAFETY_MS = 60_000;

const clientId = () => String(import.meta.env.VITE_GITHUB_CLIENT_ID || '').trim();
const appSlug = () => String(import.meta.env.VITE_GITHUB_APP_SLUG || '').trim();
const redirectUri = () => `${window.location.origin}/auth/github`;

function randomState(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

export function isGitHubAppConfigured() {
  return Boolean(clientId() && appSlug());
}

export function getStoredGitHubUser(): GitHubUserProfile | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as GitHubUserProfile;
    if (!user?.id || !user?.login || !user.accessToken) {
      logoutGitHubUser();
      return null;
    }
    if (user.expiresAt && Date.now() + TOKEN_SAFETY_MS >= user.expiresAt && !user.refreshToken) {
      logoutGitHubUser();
      return null;
    }
    return user;
  } catch {
    logoutGitHubUser();
    return null;
  }
}

function saveGitHubUser(user: GitHubUserProfile) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('orbidoc:github-session', { detail: { userId: user.id, login: user.login } }));
}

export function logoutGitHubUser() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('orbidoc:github-session', { detail: null }));
}

async function exchangeToken(payload: Record<string, string>) {
  const response = await fetch('/api/github/oauth-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.accessToken) throw new Error(data.error || 'Falha ao concluir OAuth do GitHub.');
  return data as {
    accessToken: string;
    expiresIn?: number;
    refreshToken?: string;
    refreshTokenExpiresIn?: number;
  };
}

async function githubFetch(path: string, user?: GitHubUserProfile, init: RequestInit = {}) {
  const session = await ensureGitHubSession(user);
  if (!session) throw new Error('Conecte o GitHub antes de acessar repositórios privados.');
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${session.accessToken}`,
      'X-GitHub-Api-Version': API_VERSION,
      ...init.headers,
    },
  });
  if (response.status === 401) logoutGitHubUser();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `GitHub respondeu ${response.status}.`);
  }
  return response;
}

export async function ensureGitHubSession(explicit?: GitHubUserProfile): Promise<GitHubUserProfile | null> {
  const stored = getStoredGitHubUser();
  let user = stored && (!explicit || stored.id === explicit.id) ? stored : explicit || stored;
  if (!user) return null;
  if (!user.expiresAt || Date.now() + TOKEN_SAFETY_MS < user.expiresAt) return user;
  if (!user.refreshToken || (user.refreshTokenExpiresAt && Date.now() >= user.refreshTokenExpiresAt)) {
    logoutGitHubUser();
    return null;
  }

  const token = await exchangeToken({ action: 'refresh', refreshToken: user.refreshToken });
  user = {
    ...user,
    accessToken: token.accessToken,
    expiresAt: token.expiresIn ? Date.now() + token.expiresIn * 1000 : undefined,
    refreshToken: token.refreshToken || user.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresIn ? Date.now() + token.refreshTokenExpiresIn * 1000 : user.refreshTokenExpiresAt,
  };
  saveGitHubUser(user);
  return user;
}

async function fetchProfile(accessToken: string): Promise<Omit<GitHubUserProfile, 'accessToken'>> {
  const response = await fetch(`${API}/user`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': API_VERSION,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id || !data.login) throw new Error(data.message || 'Não foi possível carregar o perfil GitHub.');
  return {
    id: Number(data.id),
    login: String(data.login),
    name: String(data.name || data.login),
    email: data.email ? String(data.email) : undefined,
    avatarUrl: data.avatar_url ? String(data.avatar_url) : undefined,
  };
}

async function completeOAuthPopupIfNeeded() {
  if (typeof window === 'undefined' || window.location.pathname !== '/auth/github' || !window.opener) return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error_description') || params.get('error');

  try {
    if (error) throw new Error(error);
    if (!code || !state) throw new Error('Resposta OAuth GitHub incompleta.');
    const key = `${STATE_PREFIX}${state}`;
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (!raw) throw new Error('Estado OAuth GitHub expirou ou não pertence a esta sessão.');
    const stored = JSON.parse(raw) as { createdAt: number; redirectUri: string };
    if (Date.now() - stored.createdAt > 10 * 60 * 1000) throw new Error('Estado OAuth GitHub expirado.');

    const token = await exchangeToken({ action: 'exchange', code, redirectUri: stored.redirectUri });
    const profile = await fetchProfile(token.accessToken);
    const user: GitHubUserProfile = {
      ...profile,
      accessToken: token.accessToken,
      expiresAt: token.expiresIn ? Date.now() + token.expiresIn * 1000 : undefined,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresIn ? Date.now() + token.refreshTokenExpiresIn * 1000 : undefined,
    };
    window.opener.postMessage({ type: OAUTH_MESSAGE, user }, window.location.origin);
  } catch (reason: any) {
    window.opener.postMessage({ type: OAUTH_MESSAGE, error: reason?.message || 'Falha no OAuth GitHub.' }, window.location.origin);
  } finally {
    window.close();
  }
}

void completeOAuthPopupIfNeeded();

export async function loginWithGitHubApp(): Promise<GitHubUserProfile> {
  if (!clientId()) throw new Error('Configure VITE_GITHUB_CLIENT_ID com o Client ID do GitHub App.');
  const state = randomState();
  const callback = redirectUri();
  localStorage.setItem(`${STATE_PREFIX}${state}`, JSON.stringify({ createdAt: Date.now(), redirectUri: callback }));

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('state', state);

  const popup = window.open(url.toString(), 'orbidoc_github_oauth', 'popup=yes,width=540,height=760,resizable=yes,scrollbars=yes');
  if (!popup) {
    localStorage.removeItem(`${STATE_PREFIX}${state}`);
    throw new Error('O navegador bloqueou a janela do GitHub. Permita pop-ups e tente novamente.');
  }

  return await new Promise<GitHubUserProfile>((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('O login GitHub expirou antes de ser concluído.')); }, 3 * 60 * 1000);
    const closed = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error('A janela de login GitHub foi fechada.')); } }, 600);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== OAUTH_MESSAGE) return;
      cleanup();
      if (event.data.error) { reject(new Error(String(event.data.error))); return; }
      const user = event.data.user as GitHubUserProfile;
      saveGitHubUser(user);
      resolve(user);
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(closed);
      window.removeEventListener('message', onMessage);
      localStorage.removeItem(`${STATE_PREFIX}${state}`);
    };
    window.addEventListener('message', onMessage);
  });
}

export function openGitHubAppInstallation() {
  const slug = appSlug();
  if (!slug) throw new Error('Configure VITE_GITHUB_APP_SLUG antes de instalar o GitHub App.');
  window.open(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`, '_blank', 'noopener,noreferrer');
}

export async function listGitHubRepositories(user?: GitHubUserProfile): Promise<GitHubRepository[]> {
  const session = await ensureGitHubSession(user);
  if (!session) throw new Error('Conecte o GitHub antes de listar repositórios.');
  const installationsResponse = await githubFetch('/user/installations?per_page=100', session);
  const installationsData = await installationsResponse.json();
  const installations = Array.isArray(installationsData.installations) ? installationsData.installations : [];
  const repositories = new Map<number, GitHubRepository>();

  for (const installation of installations) {
    const installationId = Number(installation.id);
    const response = await githubFetch(`/user/installations/${installationId}/repositories?per_page=100`, session);
    const data = await response.json();
    for (const repo of Array.isArray(data.repositories) ? data.repositories : []) {
      repositories.set(Number(repo.id), {
        id: Number(repo.id),
        name: String(repo.name),
        fullName: String(repo.full_name),
        private: Boolean(repo.private),
        defaultBranch: String(repo.default_branch || 'main'),
        htmlUrl: String(repo.html_url || ''),
        owner: String(repo.owner?.login || String(repo.full_name || '').split('/')[0] || ''),
        permissions: repo.permissions || {},
        installationId,
      });
    }
  }

  return [...repositories.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function loadGitHubRepositoryTree(repository: GitHubRepository, ref = repository.defaultBranch) {
  const response = await githubFetch(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  const data = await response.json();
  return {
    sha: String(data.sha || ''),
    truncated: Boolean(data.truncated),
    entries: (Array.isArray(data.tree) ? data.tree : []) as GitHubTreeEntry[],
  };
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

export async function readGitHubTextFile(repository: GitHubRepository, path: string, ref = repository.defaultBranch): Promise<GitHubTextFile> {
  const response = await githubFetch(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
  const data = await response.json();
  if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') throw new Error('Este item não é um arquivo de texto editável pelo OrbiDoc.');
  if (Number(data.size) > 2 * 1024 * 1024) throw new Error('A edição direta é limitada a arquivos de texto de até 2 MB. Baixe o projeto para arquivos maiores.');
  return { path, sha: String(data.sha), content: decodeBase64Utf8(data.content), encoding: 'utf-8', size: Number(data.size) || 0 };
}

export async function saveGitHubTextFile(
  repository: GitHubRepository,
  file: GitHubTextFile,
  content: string,
  message = `Edit ${file.path} with OrbiDoc`,
  branch = repository.defaultBranch,
) {
  if (!repository.permissions?.push && !repository.permissions?.admin && !repository.permissions?.maintain) {
    throw new Error('Sua conta não possui permissão de escrita neste repositório.');
  }
  const response = await githubFetch(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/contents/${file.path.split('/').map(encodeURIComponent).join('/')}`, undefined, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: encodeBase64Utf8(content), sha: file.sha, branch }),
  });
  return response.json();
}

export async function downloadGitHubRepository(repository: GitHubRepository, ref = repository.defaultBranch) {
  const response = await githubFetch(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/zipball/${encodeURIComponent(ref)}`);
  return response.blob();
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected?: boolean;
}

/** Lista as branches do repositório para o seletor da surface Repo. */
export async function listGitHubBranches(repository: GitHubRepository): Promise<GitHubBranch[]> {
  const response = await githubFetch(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/branches?per_page=100`);
  const data = await response.json();
  return (Array.isArray(data) ? data : [])
    .map((item: any) => ({ name: String(item?.name || ''), sha: String(item?.commit?.sha || ''), protected: Boolean(item?.protected) }))
    .filter((branch: GitHubBranch) => Boolean(branch.name));
}

/** Metadados leves do repositório (usados na context bar da surface Repo). */
export async function readGitHubRepository(repository: GitHubRepository): Promise<GitHubRepository & { description?: string; stars?: number; language?: string }> {
  const response = await githubFetch(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`);
  const data = await response.json();
  return {
    ...repository,
    defaultBranch: String(data.default_branch || repository.defaultBranch),
    htmlUrl: String(data.html_url || repository.htmlUrl),
    private: Boolean(data.private),
    description: typeof data.description === 'string' ? data.description : undefined,
    stars: Number(data.stargazers_count) || 0,
    language: typeof data.language === 'string' ? data.language : undefined,
  };
}
