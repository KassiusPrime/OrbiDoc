import React, { useEffect, useMemo, useState } from 'react';
import {
  IconBrandGithub as GitHub,
  IconDownload as Download,
  IconExternalLink as ExternalLink,
  IconFileCode as FileCode,
  IconFolder as Folder,
  IconRefresh as Refresh,
  IconDeviceFloppy as Save,
  IconSettings as Settings,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import {
  downloadGitHubRepository,
  getStoredGitHubUser,
  listGitHubRepositories,
  loadGitHubRepositoryTree,
  openGitHubAppInstallation,
  readGitHubTextFile,
  saveGitHubTextFile,
  type GitHubRepository,
  type GitHubTextFile,
  type GitHubTreeEntry,
} from '../services/githubProjects';
import { OrbiDocLogo } from './OrbiDocLogo';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'xml', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'py', 'rb', 'php', 'java', 'kt', 'kts', 'swift', 'go', 'rs', 'c', 'h', 'cpp',
  'hpp', 'cs', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'sql', 'graphql', 'gql', 'env', 'gitignore', 'dockerfile', 'properties', 'gradle', 'vue', 'svelte',
]);

const extensionOf = (path: string) => {
  const name = path.split('/').pop()?.toLowerCase() || '';
  if (!name.includes('.')) return name;
  return name.split('.').pop() || '';
};

const isEditableText = (entry: GitHubTreeEntry) => entry.type === 'blob' && TEXT_EXTENSIONS.has(extensionOf(entry.path));

export const GitHubProjectsWorkspace: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [entries, setEntries] = useState<GitHubTreeEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubTextFile | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<'repos' | 'tree' | 'file' | 'save' | 'download' | null>(null);
  const [error, setError] = useState('');
  const [treeTruncated, setTreeTruncated] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('orbidoc:open-github', show);
    return () => window.removeEventListener('orbidoc:open-github', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const loadRepositories = async () => {
    const user = getStoredGitHubUser();
    if (!user) {
      setRepositories([]);
      setSelectedRepo(null);
      setError('Conecte o GitHub em Conta e conexões antes de abrir projetos privados.');
      return;
    }
    setBusy('repos');
    setError('');
    try {
      const next = await listGitHubRepositories(user);
      setRepositories(next);
      if (!next.length) setError('Nenhum repositório foi concedido ao GitHub App. Use “Gerenciar acesso” e escolha os projetos desejados.');
    } catch (reason: any) {
      setError(reason?.message || 'Falha ao listar repositórios autorizados.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => { if (open) void loadRepositories(); }, [open]);

  const openRepository = async (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setSelectedFile(null);
    setEditorValue('');
    setBusy('tree');
    setError('');
    try {
      const tree = await loadGitHubRepositoryTree(repo);
      setEntries(tree.entries);
      setTreeTruncated(tree.truncated);
    } catch (reason: any) {
      setEntries([]);
      setError(reason?.message || 'Falha ao carregar a árvore do repositório.');
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (entry: GitHubTreeEntry) => {
    if (!selectedRepo || !isEditableText(entry)) return;
    setBusy('file');
    setError('');
    try {
      const file = await readGitHubTextFile(selectedRepo, entry.path);
      setSelectedFile(file);
      setEditorValue(file.content);
    } catch (reason: any) {
      setError(reason?.message || 'Falha ao abrir arquivo do GitHub.');
    } finally {
      setBusy(null);
    }
  };

  const saveFile = async () => {
    if (!selectedRepo || !selectedFile) return;
    setBusy('save');
    setError('');
    try {
      const result = await saveGitHubTextFile(selectedRepo, selectedFile, editorValue);
      const nextSha = String(result?.content?.sha || selectedFile.sha);
      setSelectedFile({ ...selectedFile, sha: nextSha, content: editorValue, size: new Blob([editorValue]).size });
      await openRepository(selectedRepo);
    } catch (reason: any) {
      setError(reason?.message || 'Falha ao salvar no GitHub.');
    } finally {
      setBusy(null);
    }
  };

  const downloadProject = async () => {
    if (!selectedRepo) return;
    setBusy('download');
    setError('');
    try {
      const blob = await downloadGitHubRepository(selectedRepo);
      saveAs(blob, `${selectedRepo.name}-${selectedRepo.defaultBranch}.zip`);
    } catch (reason: any) {
      setError(reason?.message || 'Falha ao baixar o projeto.');
    } finally {
      setBusy(null);
    }
  };

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => entry.type === 'blob')
      .filter((entry) => !needle || entry.path.toLowerCase().includes(needle))
      .slice(0, 1200);
  }, [entries, query]);

  if (!open) return null;
  const canWrite = Boolean(selectedRepo?.permissions?.push || selectedRepo?.permissions?.admin || selectedRepo?.permissions?.maintain);
  const dirty = Boolean(selectedFile && selectedFile.content !== editorValue);

  return (
    <div className="fixed inset-0 z-[132] bg-[#F7F9FC] dark:bg-[#080D18] text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="shrink-0 min-h-14 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3">
        <OrbiDocLogo size="sm" />
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <GitHub className="w-4 h-4" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black truncate">Projetos GitHub</div>
          <div className="text-[9px] text-slate-400 truncate">Somente repositórios concedidos ao GitHub App aparecem aqui.</div>
        </div>
        <button type="button" onClick={() => { try { openGitHubAppInstallation(); } catch (reason: any) { setError(reason?.message || 'GitHub App não configurado.'); } }} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Settings className="w-4 h-4" /> <span className="hidden sm:inline">Gerenciar acesso</span></button>
        <button type="button" onClick={() => void loadRepositories()} disabled={busy === 'repos'} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-50" aria-label="Atualizar repositórios"><Refresh className={`w-4 h-4 ${busy === 'repos' ? 'animate-spin' : ''}`} /></button>
        <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar projetos GitHub"><X className="w-4 h-4" /></button>
      </header>

      {error && <div role="alert" className="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-[10px] font-semibold">{error}</div>}
      {treeTruncated && <div className="shrink-0 px-4 py-2 bg-cyan-50 dark:bg-cyan-950/25 text-cyan-800 dark:text-cyan-200 text-[10px]">O GitHub truncou a árvore recursiva deste projeto muito grande. O download integral continua disponível.</div>}

      <div className="flex-1 min-h-0 grid lg:grid-cols-[260px_330px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex flex-col">
          <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800"><div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Repositórios autorizados</div><div className="mt-1 text-[9px] text-slate-500">{repositories.length} projeto(s)</div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {repositories.map((repo) => <button key={repo.id} type="button" onClick={() => void openRepository(repo)} className={`w-full p-2.5 rounded-xl text-left ${selectedRepo?.id === repo.id ? 'bg-[#3157F6] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><div className="flex items-center gap-2"><Folder className="w-4 h-4 shrink-0" /><span className="text-[10px] font-black truncate">{repo.fullName}</span></div><div className={`mt-1 pl-6 text-[8px] ${selectedRepo?.id === repo.id ? 'text-white/70' : 'text-slate-400'}`}>{repo.private ? 'Privado' : 'Público'} · {repo.permissions?.push ? 'edição' : 'leitura'}</div></button>)}
          </div>
        </aside>

        <aside className="min-h-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D1422] flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar arquivos do projeto…" className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-[10px] outline-none focus:border-[#3157F6]" />
            {selectedRepo && <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => void downloadProject()} disabled={busy === 'download'} className="h-8 px-2.5 rounded-lg bg-[#3157F6] text-white text-[9px] font-black inline-flex items-center gap-1.5 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Baixar ZIP</button><button type="button" onClick={() => window.open(selectedRepo.htmlUrl, '_blank', 'noopener,noreferrer')} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> GitHub</button></div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {busy === 'tree' ? <div className="py-10 text-center text-[10px] text-slate-400">Carregando projeto…</div> : filteredEntries.map((entry) => <button key={`${entry.path}:${entry.sha}`} type="button" disabled={!isEditableText(entry)} onClick={() => void openFile(entry)} title={isEditableText(entry) ? entry.path : 'Arquivo disponível no ZIP; edição direta não suportada'} className={`w-full px-2 py-2 rounded-lg flex items-center gap-2 text-left ${selectedFile?.path === entry.path ? 'bg-white dark:bg-slate-800 shadow-sm' : 'hover:bg-white dark:hover:bg-slate-800/70'} disabled:opacity-45`}><FileCode className="w-3.5 h-3.5 shrink-0" /><span className="text-[9px] truncate">{entry.path}</span></button>)}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex flex-col bg-white dark:bg-[#0E1118]">
          {selectedFile ? <>
            <div className="shrink-0 min-h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] font-black truncate">{selectedFile.path}</div><div className="text-[8px] text-slate-400">{canWrite ? 'Você pode editar este arquivo' : 'Somente leitura'}{dirty ? ' · alterações não salvas' : ''}</div></div><button type="button" onClick={() => void saveFile()} disabled={!canWrite || !dirty || busy === 'save'} className="h-9 px-3 rounded-xl bg-[#3157F6] text-white text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40"><Save className="w-4 h-4" /> Salvar no GitHub</button></div>
            <textarea value={editorValue} onChange={(event) => setEditorValue(event.target.value)} readOnly={!canWrite} spellCheck={false} className="flex-1 min-h-0 w-full resize-none border-0 outline-none p-4 sm:p-6 bg-white dark:bg-[#0E1118] font-mono text-[12px] leading-relaxed" />
          </> : <div className="h-full flex items-center justify-center p-8 text-center"><div><GitHub className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" /><div className="mt-3 text-sm font-black">{selectedRepo ? 'Escolha um arquivo de texto' : 'Escolha um repositório'}</div><p className="mt-1 max-w-md text-[10px] leading-relaxed text-slate-400">O OrbiDoc só acessa os projetos selecionados na instalação do GitHub App. Downloads preservam o projeto inteiro em ZIP; edição direta respeita as permissões reais do proprietário/colaborador.</p></div></div>}
        </main>
      </div>
    </div>
  );
};
