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
  lines: string[];
  lineCount: number;
}

export interface GitHubProject {
  id: number;
  nodeId?: string;
  number: number;
  title: string;
  description?: string;
  shortDescription?: string;
  state?: string;
  public?: boolean;
  url?: string;
  htmlUrl?: string;
  owner?: string;
  updatedAt?: string;
}

export interface GitHubFileChange {
  path: string;
  content: string;
  expectedSha?: string;
  mode?: '100644' | '100755' | '120000';
}

export interface GitHubCommitResult {
  sha: string;
  message: string;
  url?: string;
  files: string[];
}

const STORAGE_KEY = 'orbidoc_github_user';
const STATE_PREFIX = 'orbidoc_github_oauth_';
const OAUTH_MESSAGE = 'orbidoc:github-oauth';
const API = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const TOKEN_SAFETY_MS = 60_000;
const MAX_EDITABLE_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 100;

const clientId = () => String(import.meta.env.VITE_GITHUB_CLIENT_ID || '').trim();
const appSlug = () => String(import.meta.env.VITE_GITHUB_APP_SLUG || '').trim();
const redirectUri = () => `${window.location.origin}/auth/github`;

function randomState(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

function repositoryPath(repository: GitHubRepository, path = '') {
  const base = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
  if (!path) return base;
  return `${base}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
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

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
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
  if (!session) throw new Error('Conecte o GitHub antes de acessar seus repositórios.');

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  headers.set('X-GitHub-Api-Version', API_VERSION);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (response.status === 401) logoutGitHubUser();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.message || `GitHub respondeu ${response.status}.`;
    if (response.status === 403) throw new Error(`GitHub negou esta operação (403). Verifique as permissões do GitHub App/token: ${message}`);
    if (response.status === 404) throw new Error(`Recurso GitHub não encontrado ou sem acesso: ${path}`);
    if (response.status === 409) throw new Error('Conflito GitHub: o recurso mudou desde a última leitura. Recarregue antes de gravar.');
    throw new Error(message);
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
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}`, 'X-GitHub-Api-Version': API_VERSION },
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
  const repositories = new Map<number, GitHubRepository>();
  let page = 1;
  while (page <= 20) {
    const response = await githubFetch(withQuery('/user/installations', { per_page: 100, page }), session);
    const data = await response.json();
    const installations = Array.isArray(data.installations) ? data.installations : [];
    if (!installations.length) break;
    for (const installation of installations) {
      const installationId = Number(installation.id);
      let repoPage = 1;
      while (repoPage <= 20) {
        const repoResponse = await githubFetch(withQuery(`/user/installations/${installationId}/repositories`, { per_page: 100, page: repoPage }), session);
        const repoData = await repoResponse.json();
        const pageRepos = Array.isArray(repoData.repositories) ? repoData.repositories : [];
        for (const repo of pageRepos) {
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
        if (pageRepos.length < 100) break;
        repoPage += 1;
      }
    }
    if (installations.length < 100) break;
    page += 1;
  }
  return [...repositories.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function loadGitHubRepositoryTree(repository: GitHubRepository, ref = repository.defaultBranch) {
  const response = await githubFetch(`${repositoryPath(repository)}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  const data = await response.json();
  return { sha: String(data.sha || ''), truncated: Boolean(data.truncated), entries: (Array.isArray(data.tree) ? data.tree : []) as GitHubTreeEntry[] };
}

export async function readGitHubTextFile(repository: GitHubRepository, path: string, ref = repository.defaultBranch): Promise<GitHubTextFile> {
  if (!path.trim()) throw new Error('Informe o caminho do arquivo.');
  const response = await githubFetch(`${repositoryPath(repository, `contents/${path}`)}?ref=${encodeURIComponent(ref)}`);
  const data = await response.json();
  if (data.type !== 'file') throw new Error('O item selecionado não é um arquivo.');
  let content = '';
  if (data.encoding === 'base64' && typeof data.content === 'string') {
    content = decodeBase64Utf8(data.content);
  } else if (data.sha) {
    const blobResponse = await githubFetch(`${repositoryPath(repository)}/git/blobs/${encodeURIComponent(String(data.sha))}`);
    const blob = await blobResponse.json();
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new Error('O GitHub não retornou este blob em formato de texto.');
    content = decodeBase64Utf8(blob.content);
  } else {
    throw new Error('Não foi possível ler o conteúdo deste arquivo.');
  }
  const bytes = new TextEncoder().encode(content).byteLength;
  if (bytes > MAX_EDITABLE_TEXT_BYTES) throw new Error(`A edição direta está limitada a ${MAX_EDITABLE_TEXT_BYTES / 1024 / 1024} MB por arquivo para manter o navegador estável.`);
  const lines = content.split(/\r?\n/);
  return { path, sha: String(data.sha), content, encoding: 'utf-8', size: Number(data.size) || bytes, lines, lineCount: lines.length };
}

export async function readGitHubTextFileLines(repository: GitHubRepository, path: string, startLine = 1, endLine?: number, ref = repository.defaultBranch) {
  const file = await readGitHubTextFile(repository, path, ref);
  const start = Math.max(1, Math.floor(startLine));
  const end = Math.min(file.lineCount, Math.max(start, Math.floor(endLine ?? file.lineCount)));
  return { ...file, lines: file.lines.slice(start - 1, end), startLine: start, endLine: end };
}

async function getBranchHead(repository: GitHubRepository, branch: string) {
  const response = await githubFetch(`${repositoryPath(repository)}/git/ref/heads/${encodeURIComponent(branch)}`);
  const data = await response.json();
  const sha = String(data.object?.sha || '');
  if (!sha) throw new Error(`Não foi possível localizar o HEAD da branch ${branch}.`);
  return sha;
}

async function getCommit(repository: GitHubRepository, sha: string) {
  const response = await githubFetch(`${repositoryPath(repository)}/git/commits/${encodeURIComponent(sha)}`);
  return response.json() as Promise<{ sha: string; tree: { sha: string }; html_url?: string; message?: string }>;
}

async function assertExpectedFileSha(repository: GitHubRepository, change: GitHubFileChange, branch: string) {
  if (!change.expectedSha) return;
  const current = await readGitHubTextFile(repository, change.path, branch);
  if (current.sha !== change.expectedSha) throw new Error(`Conflito em ${change.path}: o arquivo mudou no GitHub desde a última leitura.`);
}

export async function commitGitHubFiles(repository: GitHubRepository, changes: GitHubFileChange[], message = 'Update files with OrbiDoc', branch = repository.defaultBranch): Promise<GitHubCommitResult> {
  if (!repository.permissions?.push && !repository.permissions?.admin && !repository.permissions?.maintain) throw new Error('Sua conta não possui permissão de escrita neste repositório.');
  if (!changes.length) throw new Error('Nenhuma alteração foi informada.');
  if (changes.length > MAX_BATCH_FILES) throw new Error(`Um commit pode conter no máximo ${MAX_BATCH_FILES} arquivos nesta interface.`);
  const normalized = changes.map((change) => ({ ...change, path: change.path.replace(/^\/+/, '').replace(/\\/g, '/') }));
  if (normalized.some((change) => !change.path || change.path.split('/').includes('..'))) throw new Error('Caminho de arquivo inválido.');
  for (const change of normalized) await assertExpectedFileSha(repository, change, branch);
  const parentSha = await getBranchHead(repository, branch);
  const parentCommit = await getCommit(repository, parentSha);
  const treeElements: Record<string, any>[] = [];
  for (const change of normalized) {
    const blobResponse = await githubFetch(`${repositoryPath(repository)}/git/blobs`, undefined, { method: 'POST', body: JSON.stringify({ content: encodeBase64Utf8(change.content), encoding: 'base64' }) });
    const blob = await blobResponse.json();
    if (!blob.sha) throw new Error(`GitHub não conseguiu criar o blob de ${change.path}.`);
    treeElements.push({ path: change.path, mode: change.mode || '100644', type: 'blob', sha: String(blob.sha) });
  }
  const treeResponse = await githubFetch(`${repositoryPath(repository)}/git/trees`, undefined, { method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeElements }) });
  const tree = await treeResponse.json();
  if (!tree.sha) throw new Error('GitHub não conseguiu montar a árvore do commit.');
  const commitResponse = await githubFetch(`${repositoryPath(repository)}/git/commits`, undefined, { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }) });
  const commit = await commitResponse.json();
  if (!commit.sha) throw new Error('GitHub não conseguiu criar o commit.');
  const currentHead = await getBranchHead(repository, branch);
  if (currentHead !== parentSha) throw new Error('A branch recebeu novas alterações enquanto o commit era preparado. Nenhuma alteração foi sobrescrita; recarregue e tente novamente.');
  await githubFetch(`${repositoryPath(repository)}/git/refs/heads/${encodeURIComponent(branch)}`, undefined, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { sha: String(commit.sha), message, url: commit.html_url ? String(commit.html_url) : undefined, files: normalized.map((change) => change.path) };
}

export async function saveGitHubTextFile(repository: GitHubRepository, file: GitHubTextFile, content: string, message = `Edit ${file.path} with OrbiDoc`, branch = repository.defaultBranch) {
  return commitGitHubFiles(repository, [{ path: file.path, content, expectedSha: file.sha }], message, branch);
}

export async function listGitHubProjects(user?: GitHubUserProfile): Promise<GitHubProject[]> {
  const session = await ensureGitHubSession(user);
  if (!session) throw new Error('Conecte o GitHub antes de listar projetos.');
  const response = await githubFetch(withQuery(`/users/${encodeURIComponent(session.login)}/projectsV2`, { per_page: 100 }), session);
  const data = await response.json();
  const projects = Array.isArray(data) ? data : [];
  return projects.map((project: any) => ({ id: Number(project.id), nodeId: project.node_id ? String(project.node_id) : undefined, number: Number(project.number), title: String(project.title || ''), description: project.description ? String(project.description) : undefined, shortDescription: project.short_description ? String(project.short_description) : undefined, state: project.state ? String(project.state) : undefined, public: typeof project.public === 'boolean' ? project.public : undefined, url: project.url ? String(project.url) : undefined, htmlUrl: project.html_url ? String(project.html_url) : undefined, owner: String(project.owner?.login || session.login), updatedAt: project.updated_at ? String(project.updated_at) : undefined }));
}

export async function listGitHubRepositoryProjects(repository: GitHubRepository): Promise<GitHubProject[]> {
  const response = await githubFetch(`${repositoryPath(repository)}/projectsV2?per_page=100`);
  const data = await response.json();
  const projects = Array.isArray(data) ? data : [];
  return projects.map((project: any) => ({ id: Number(project.id), nodeId: project.node_id ? String(project.node_id) : undefined, number: Number(project.number), title: String(project.title || ''), description: project.description ? String(project.description) : undefined, shortDescription: project.short_description ? String(project.short_description) : undefined, state: project.state ? String(project.state) : undefined, public: typeof project.public === 'boolean' ? project.public : undefined, url: project.url ? String(project.url) : undefined, htmlUrl: project.html_url ? String(project.html_url) : undefined, owner: repository.owner, updatedAt: project.updated_at ? String(project.updated_at) : undefined }));
}

export async function downloadGitHubRepository(repository: GitHubRepository, ref = repository.defaultBranch) {
  const response = await githubFetch(`${repositoryPath(repository)}/zipball/${encodeURIComponent(ref)}`);
  return response.blob();
}
