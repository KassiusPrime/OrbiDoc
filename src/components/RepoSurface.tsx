import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconBrandGithub as GitHub,
  IconExternalLink as ExternalLink,
  IconFolder as Folder,
  IconGitBranch as GitBranch,
  IconRefresh as Refresh,
  IconSettings as Settings,
} from '@tabler/icons-react';
import {
  getStoredGitHubUser,
  listGitHubBranches,
  listGitHubRepositories,
  loadGitHubRepositoryTree,
  openGitHubAppInstallation,
  readGitHubTextFile,
  type GitHubBranch,
  type GitHubRepository,
  type GitHubTextFile,
  type GitHubTreeEntry,
} from '../services/githubProjects';
import { OrbitResizablePane, useMediaQuery } from './orbit/OrbitResizable';
import { RepoTree } from './orbit/RepoTree';
import { RepoFileViewer } from './orbit/RepoFileViewer';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'xml', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'py', 'rb', 'php', 'java', 'kt', 'kts', 'swift', 'go', 'rs', 'c', 'h', 'cpp',
  'hpp', 'cs', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'sql', 'graphql', 'gql', 'env', 'gitignore', 'dockerfile', 'properties', 'gradle', 'vue', 'svelte',
]);

const LANGUAGES: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  py: 'python', rb: 'ruby', php: 'php', java: 'java', kt: 'kotlin', swift: 'swift', go: 'go', rs: 'rust',
  c: 'c', h: 'c', cpp: 'c++', hpp: 'c++', cs: 'c#', sh: 'shell', bash: 'shell', sql: 'sql',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', html: 'html', css: 'css', scss: 'scss',
  md: 'markdown', vue: 'vue', svelte: 'svelte', graphql: 'graphql', gql: 'graphql',
};

const MAX_VIEW_BYTES = 400_000;

const extensionOf = (path: string) => {
  const name = path.split('/').pop()?.toLowerCase() || '';
  if (!name.includes('.')) return name;
  return name.split('.').pop() || '';
};

const isTextEntry = (entry: GitHubTreeEntry) => entry.type === 'blob' && TEXT_EXTENSIONS.has(extensionOf(entry.path));

type Props = {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
};

/**
 * Surface Repo — GitHub como WorkObject de primeira classe.
 *
 * Contrato (§2.3): context bar única (`owner/repo @ branch` + caminho), corpo
 * em duas colunas (tree + arquivo), sem card de produto, sem iframe do
 * github.com e sem exigir escrita no MVP. Consome o conector já existente
 * (`services/githubProjects.ts`) — nenhuma dependência nova.
 */
export const RepoSurface: React.FC<Props> = ({ showNotification = () => {} }) => {
  const compact = useMediaQuery('(max-width: 1023px)');
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [branch, setBranch] = useState('');
  const [entries, setEntries] = useState<GitHubTreeEntry[]>([]);
  const [treeTruncated, setTreeTruncated] = useState(false);
  const [file, setFile] = useState<GitHubTextFile | null>(null);
  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState<'repos' | 'tree' | 'file' | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(() => Boolean(getStoredGitHubUser()));

  const loadRepositories = useCallback(async () => {
    setBusy('repos');
    setError('');
    try {
      const list = await listGitHubRepositories();
      setRepositories(list);
      setConnected(true);
    } catch (reason) {
      setConnected(false);
      setError(reason instanceof Error ? reason.message : 'Não foi possível listar os repositórios.');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (connected) void loadRepositories();
    else setBusy(null);
  }, [connected, loadRepositories]);

  const loadTree = useCallback(async (target: GitHubRepository, ref: string) => {
    setBusy('tree');
    setError('');
    setEntries([]);
    setFile(null);
    try {
      const result = await loadGitHubRepositoryTree(target, ref);
      setEntries(result.entries);
      setTreeTruncated(result.truncated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar a árvore do repositório.');
    } finally {
      setBusy(null);
    }
  }, []);

  const openRepository = useCallback(async (target: GitHubRepository) => {
    setRepository(target);
    setBranch(target.defaultBranch);
    setBranches([]);
    void loadTree(target, target.defaultBranch);
    try {
      setBranches(await listGitHubBranches(target));
    } catch {
      // O seletor continua funcional com a branch padrão mesmo sem a lista.
    }
  }, [loadTree]);

  const switchBranch = useCallback(async (next: string) => {
    if (!repository || !next || next === branch) return;
    setBranch(next);
    await loadTree(repository, next);
  }, [branch, loadTree, repository]);

  const openFile = useCallback(async (entry: GitHubTreeEntry) => {
    if (!repository) return;
    setBusy('file');
    setFileError('');
    setFile(null);
    try {
      const result = await readGitHubTextFile(repository, entry.path, branch);
      if (result.size > MAX_VIEW_BYTES) {
        setFile({ ...result, content: result.content.slice(0, MAX_VIEW_BYTES) });
      } else {
        setFile(result);
      }
    } catch (reason) {
      setFileError(reason instanceof Error ? reason.message : 'Não foi possível abrir este arquivo.');
    } finally {
      setBusy(null);
    }
  }, [branch, repository]);

  const isSelectable = useCallback((entry: GitHubTreeEntry) => isTextEntry(entry), []);
  const language = file ? LANGUAGES[extensionOf(file.path)] || extensionOf(file.path) : '';
  const truncated = Boolean(file && file.size > MAX_VIEW_BYTES);

  const filePathLabel = useMemo(() => {
    if (!repository || !file) return '';
    const parts = file.path.split('/');
    return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : file.path;
  }, [file, repository]);

  // ---------------------------------------------------------------------------
  // Desconectado: porta de entrada honesta, sem "landing de integração".
  // ---------------------------------------------------------------------------
  if (!connected && !busy) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="orbit-contextbar bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <GitHub className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">Repositórios</span>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <GitHub className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <h2 className="mt-3 text-base font-semibold">Conecte o GitHub</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              O OrbiDoc lê apenas os repositórios autorizados na instalação do GitHub App. Nenhum código sai deste dispositivo.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button type="button" onClick={() => setConnected(true)} className="orbit-action h-9 px-3 text-xs inline-flex items-center gap-2">
                <Refresh className="w-4 h-4" /> Tentar novamente
              </button>
              <button type="button" onClick={() => { try { openGitHubAppInstallation(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'GitHub App não configurado.'); } }} className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-2">
                <Settings className="w-4 h-4" /> Gerenciar acesso
              </button>
            </div>
            {error ? <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">{error}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  const treePanel = (
    <>
      <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--workspace-border)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-muted)] truncate">
          {repository ? `${repository.name} · ${entries.filter((entry) => entry.type === 'blob').length} arquivos` : 'Repositórios'}
        </span>
        {treeTruncated ? <span className="ml-auto text-[9px] text-amber-600 dark:text-amber-400">parcial</span> : null}
      </div>

      {repository ? (
        <RepoTree entries={entries} selectedPath={file?.path ?? null} onSelect={(entry) => void openFile(entry)} isSelectable={isSelectable} />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-2">
          {busy === 'repos' ? <p className="p-4 text-center text-[11px] text-[var(--workspace-muted)]">Carregando repositórios…</p> : null}
          {error ? <p className="p-3 text-[11px] text-amber-600 dark:text-amber-400">{error}</p> : null}
          {repositories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openRepository(item)}
              className="orbit-repo-node"
              style={{ paddingLeft: '10px' }}
              title={item.fullName}
            >
              <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate flex-1 text-left">{item.fullName}</span>
              <span className="shrink-0 text-[9px] text-[var(--workspace-muted)]">{item.private ? 'privado' : 'público'}</span>
            </button>
          ))}
          {!repositories.length && !busy && !error ? (
            <p className="p-4 text-center text-[11px] text-[var(--workspace-muted)]">Nenhum repositório autorizado.</p>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* Context bar — owner/repo @ branch | caminho | ações */}
      <header className="orbit-contextbar bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <GitHub className="w-5 h-5 shrink-0" />

        {repository ? (
          <button type="button" onClick={() => { setRepository(null); setEntries([]); setFile(null); setBranch(''); }} className="min-w-0 flex items-center gap-1.5 rounded-md px-1.5 h-7 hover:bg-slate-100 dark:hover:bg-slate-800" title="Voltar para a lista de repositórios">
            <span className="truncate text-sm font-semibold">{repository.owner}/{repository.name}</span>
          </button>
        ) : (
          <span className="text-sm font-semibold">Repositórios</span>
        )}

        {repository ? (
          <label className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={branch}
              onChange={(event) => void switchBranch(event.target.value)}
              aria-label="Branch"
              className="max-w-40 bg-transparent text-[11px] font-medium outline-none"
            >
              {(branches.length ? branches.map((item) => item.name) : [branch]).filter(Boolean).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {filePathLabel ? (
          <span className="hidden md:inline min-w-0 truncate text-[11px] text-slate-400" title={file?.path}>{filePathLabel}</span>
        ) : null}

        <div className="flex-1 min-w-[8px]" />

        {repository ? (
          <button type="button" onClick={() => void loadTree(repository, branch)} disabled={busy === 'tree'} className="h-7 w-7 shrink-0 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40" aria-label="Recarregar árvore" title="Recarregar">
            <Refresh className="w-3.5 h-3.5 mx-auto" />
          </button>
        ) : null}

        {repository ? (
          <a href={file ? `${repository.htmlUrl}/blob/${branch}/${file.path}` : repository.htmlUrl} target="_blank" rel="noopener noreferrer" className="h-7 shrink-0 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] font-medium inline-flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Abrir no GitHub</span>
          </a>
        ) : (
          <button type="button" onClick={() => { try { openGitHubAppInstallation(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'GitHub App não configurado.'); } }} className="h-7 shrink-0 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] font-medium inline-flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Gerenciar acesso</span>
          </button>
        )}
      </header>

      {/* Corpo — tree + arquivo */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {compact ? (
          <>
            {file ? (
              <RepoFileViewer content={file.content} path={file.path} language={language} truncated={truncated} busy={busy === 'file'} error={fileError} />
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">{treePanel}</div>
            )}
            {file ? (
              <button type="button" onClick={() => { setFile(null); setFileError(''); }} className="orbit-chip m-2 shrink-0 self-start">Arquivos</button>
            ) : null}
          </>
        ) : (
          <>
            <OrbitResizablePane
              storageKey="repo-tree"
              handle="end"
              defaultSize={264}
              min={220}
              max={460}
              label="árvore de arquivos do repositório"
              className="border-r border-[var(--workspace-border)] bg-[var(--workspace-bg)]"
            >
              {treePanel}
            </OrbitResizablePane>

            {file || fileError ? (
              <RepoFileViewer content={file?.content ?? ''} path={file?.path ?? ''} language={language} truncated={truncated} busy={busy === 'file'} error={fileError} />
            ) : (
              <div className="flex-1 min-w-0 flex items-center justify-center p-8 text-center">
                <div>
                  <GitHub className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="mt-3 text-sm font-semibold">{repository ? 'Escolha um arquivo de texto' : 'Escolha um repositório'}</p>
                  <p className="mt-1 max-w-md text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    A árvore mostra a branch selecionada. Arquivos binários aparecem esmaecidos e abrem pelo GitHub.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
