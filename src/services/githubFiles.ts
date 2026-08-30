import { bindOrbiDocFileOrigin } from '../lib/systemFileOpen';

export type GitHubEntry = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  downloadUrl?: string | null;
  htmlUrl?: string | null;
};

export type GitHubRepositoryTarget = {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
};

const API = 'https://api.github.com';

const decodeRepoTarget = (input: string): GitHubRepositoryTarget => {
  const value = input.trim();
  if (!value) throw new Error('Informe um repositório GitHub, por exemplo owner/repo.');

  if (!/^https?:\/\//i.test(value)) {
    const [owner, repo, ...rest] = value.replace(/^\/+|\/+$/g, '').split('/');
    if (!owner || !repo) throw new Error('Use o formato owner/repo ou uma URL do GitHub.');
    return { owner, repo: repo.replace(/\.git$/i, ''), path: rest.join('/') || undefined };
  }

  const url = new URL(value);
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') throw new Error('Use uma URL de github.com.');
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('A URL precisa apontar para um repositório GitHub.');
  const [owner, rawRepo] = parts;
  const repo = rawRepo.replace(/\.git$/i, '');
  const marker = parts[2];
  if ((marker === 'tree' || marker === 'blob') && parts[3]) {
    return { owner, repo, ref: parts[3], path: parts.slice(4).join('/') || undefined };
  }
  return { owner, repo, path: parts.slice(2).join('/') || undefined };
};

export const parseGitHubRepositoryTarget = decodeRepoTarget;

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export async function listGitHubRepositoryPath(target: GitHubRepositoryTarget): Promise<GitHubEntry[]> {
  const path = target.path ? `/${target.path.split('/').map(encodeURIComponent).join('/')}` : '';
  const ref = target.ref ? `?ref=${encodeURIComponent(target.ref)}` : '';
  const response = await fetch(`${API}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents${path}${ref}`, { headers: headers() });
  if (response.status === 404) throw new Error('Repositório ou caminho não encontrado. Repositórios privados exigirão uma conexão GitHub autorizada.');
  if (response.status === 403) throw new Error('O GitHub limitou temporariamente consultas públicas. Tente novamente mais tarde ou conecte uma conta quando o GitHub App estiver configurado.');
  if (!response.ok) throw new Error(`Falha ao consultar o GitHub (${response.status}).`);
  const data = await response.json();
  const entries = Array.isArray(data) ? data : [data];
  return entries.map((item: any) => ({
    name: String(item.name || ''),
    path: String(item.path || ''),
    sha: String(item.sha || ''),
    size: Number(item.size || 0),
    type: item.type === 'dir' ? 'dir' : item.type === 'symlink' ? 'symlink' : item.type === 'submodule' ? 'submodule' : 'file',
    downloadUrl: item.download_url || null,
    htmlUrl: item.html_url || null,
  }));
}

const guessMime = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    txt: 'text/plain', md: 'text/markdown', json: 'application/json', csv: 'text/csv', html: 'text/html', css: 'text/css', js: 'text/javascript', jsx: 'text/javascript', ts: 'text/typescript', tsx: 'text/typescript',
    pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
    zip: 'application/zip', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4',
  };
  return map[ext] || 'application/octet-stream';
};

export async function downloadGitHubEntry(target: GitHubRepositoryTarget, entry: GitHubEntry): Promise<File> {
  if (entry.type !== 'file') throw new Error('Selecione um arquivo do repositório.');
  const path = entry.path.split('/').map(encodeURIComponent).join('/');
  const ref = target.ref ? `?ref=${encodeURIComponent(target.ref)}` : '';
  const response = await fetch(`${API}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${path}${ref}`, {
    headers: { ...headers(), Accept: 'application/vnd.github.raw+json' },
  });
  if (!response.ok) throw new Error(`Falha ao abrir ${entry.name} pelo GitHub (${response.status}).`);
  const blob = await response.blob();
  const file = new File([blob], entry.name, { type: blob.type || guessMime(entry.name), lastModified: Date.now() });
  return bindOrbiDocFileOrigin(file, {
    source: 'github',
    providerId: entry.path,
    providerName: entry.name,
    mimeType: file.type,
    originalExtension: entry.name.split('.').pop()?.toLowerCase() || '',
    etag: entry.sha ? `sha:${entry.sha}` : undefined,
    readOnly: true,
    repository: { owner: target.owner, repo: target.repo, path: entry.path, ref: target.ref },
  });
}
