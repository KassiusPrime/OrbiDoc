import React, { useEffect, useMemo, useState } from 'react';
import {
  IconBrandGithub as GitHub,
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
  IconChevronLeft as ChevronLeft,
  IconCloud as Cloud,
  IconExternalLink as ExternalLink,
  IconFile as FileIcon,
  IconFolder as Folder,
  IconPlugConnected as Connected,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconUpload as Upload,
} from '@tabler/icons-react';
import type { DriveFile, GoogleUserProfile, MicrosoftUserProfile } from '../types';
import { listGoogleDriveFiles, uploadToGoogleDrive } from '../services/googleAuthDrive';
import { listOneDriveFiles, uploadToOneDrive, type OneDriveFile } from '../services/microsoftAuthOffice';
import { downloadGoogleDriveAsFile, downloadOneDriveAsFile } from '../services/connectedFileAccess';
import { downloadGitHubEntry, listGitHubRepositoryPath, parseGitHubRepositoryTarget, type GitHubEntry, type GitHubRepositoryTarget } from '../services/githubFiles';
import { openFileInsideOrbiDoc } from '../lib/systemFileOpen';

type Provider = 'google' | 'microsoft' | 'github';

type Props = {
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
  onOpenSettings?: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
};

const sizeLabel = (size?: string | number) => {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const ProviderButton: React.FC<{ active: boolean; icon: React.ComponentType<{ className?: string }>; label: string; detail: string; onClick: () => void }> = ({ active, icon: Icon, label, detail, onClick }) => (
  <button type="button" onClick={onClick} className={`w-full min-h-14 rounded-xl px-3 py-2 flex items-center gap-3 text-left transition-colors ${active ? 'bg-[#E8EEFF] dark:bg-[#0D1E5B]/65 text-[#2446D8] dark:text-[#AFC4FF]' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-white/80 dark:bg-[#101827]' : 'bg-slate-100 dark:bg-slate-800'}`}><Icon className="w-4.5 h-4.5" /></span>
    <span className="min-w-0"><span className="block text-[11px] font-black truncate">{label}</span><span className="block text-[9px] text-slate-400 truncate">{detail}</span></span>
  </button>
);

export const ServiceBrowserWorkspace: React.FC<Props> = ({ googleUser, microsoftUser, onOpenSettings = () => {}, showNotification = () => {} }) => {
  const [provider, setProvider] = useState<Provider>(googleUser ? 'google' : microsoftUser ? 'microsoft' : 'github');
  const [googleFiles, setGoogleFiles] = useState<DriveFile[]>([]);
  const [microsoftFiles, setMicrosoftFiles] = useState<OneDriveFile[]>([]);
  const [githubTarget, setGithubTarget] = useState<GitHubRepositoryTarget | null>(null);
  const [githubInput, setGithubInput] = useState('');
  const [githubEntries, setGithubEntries] = useState<GitHubEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadGoogle = async () => {
    if (!googleUser) { setGoogleFiles([]); return; }
    setGoogleFiles(await listGoogleDriveFiles(googleUser.accessToken));
  };

  const loadMicrosoft = async () => {
    if (!microsoftUser) { setMicrosoftFiles([]); return; }
    setMicrosoftFiles(await listOneDriveFiles(microsoftUser));
  };

  const loadGitHub = async (target = githubTarget) => {
    if (!target) { setGithubEntries([]); return; }
    setGithubEntries(await listGitHubRepositoryPath(target));
  };

  const reload = async () => {
    setLoading(true);
    try {
      if (provider === 'google') await loadGoogle();
      else if (provider === 'microsoft') await loadMicrosoft();
      else await loadGitHub();
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao atualizar o serviço.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [provider, googleUser?.id, microsoftUser?.id]);

  const connectGitHubTarget = async () => {
    setLoading(true);
    try {
      const parsed = parseGitHubRepositoryTarget(githubInput);
      const entries = await listGitHubRepositoryPath(parsed);
      setGithubTarget(parsed);
      setGithubEntries(entries);
      setProvider('github');
      setFilter('');
    } catch (error: any) {
      showNotification(error?.message || 'Não foi possível abrir o repositório.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openGitHubEntry = async (entry: GitHubEntry) => {
    if (!githubTarget) return;
    if (entry.type === 'dir') {
      const next = { ...githubTarget, path: entry.path };
      setGithubTarget(next);
      setLoading(true);
      try { setGithubEntries(await listGitHubRepositoryPath(next)); } catch (error: any) { showNotification(error?.message || 'Falha ao abrir pasta.', 'error'); } finally { setLoading(false); }
      return;
    }
    setLoading(true);
    try {
      openFileInsideOrbiDoc(await downloadGitHubEntry(githubTarget, entry), 'github');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao abrir arquivo do GitHub.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const goGitHubUp = async () => {
    if (!githubTarget) return;
    const parts = (githubTarget.path || '').split('/').filter(Boolean);
    parts.pop();
    const next = { ...githubTarget, path: parts.join('/') || undefined };
    setGithubTarget(next);
    setLoading(true);
    try { setGithubEntries(await listGitHubRepositoryPath(next)); } catch (error: any) { showNotification(error?.message || 'Falha ao voltar.', 'error'); } finally { setLoading(false); }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      if (provider === 'google') {
        if (!googleUser) throw new Error('Conecte o Google Drive em Configurações.');
        await uploadToGoogleDrive(googleUser.accessToken, file.name, file.type || 'application/octet-stream', file);
        await loadGoogle();
      } else if (provider === 'microsoft') {
        if (!microsoftUser) throw new Error('Conecte o OneDrive em Configurações.');
        await uploadToOneDrive(microsoftUser, file.name, file, file.type || 'application/octet-stream');
        await loadMicrosoft();
      } else {
        throw new Error('Escrita no GitHub será habilitada pelo GitHub App com permissões granulares; consultas públicas já funcionam sem armazenar token pessoal.');
      }
      showNotification(`${file.name} enviado com sucesso.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha no upload.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const openGoogle = async (file: DriveFile) => {
    if (!googleUser) return;
    setLoading(true);
    try { openFileInsideOrbiDoc(await downloadGoogleDriveAsFile(googleUser, file), 'google-drive'); }
    catch (error: any) { showNotification(error?.message || 'Falha ao abrir arquivo do Drive.', 'error'); }
    finally { setLoading(false); }
  };

  const openMicrosoft = async (file: OneDriveFile) => {
    if (!microsoftUser) return;
    if (file.isFolder) {
      showNotification('Navegação por subpastas do OneDrive entra na próxima etapa do navegador unificado.', 'error');
      return;
    }
    setLoading(true);
    try { openFileInsideOrbiDoc(await downloadOneDriveAsFile(microsoftUser, file), 'onedrive'); }
    catch (error: any) { showNotification(error?.message || 'Falha ao abrir arquivo do OneDrive.', 'error'); }
    finally { setLoading(false); }
  };

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredGoogle = useMemo(() => googleFiles.filter((item) => !normalizedFilter || item.name.toLowerCase().includes(normalizedFilter)), [googleFiles, normalizedFilter]);
  const filteredMicrosoft = useMemo(() => microsoftFiles.filter((item) => !normalizedFilter || item.name.toLowerCase().includes(normalizedFilter)), [microsoftFiles, normalizedFilter]);
  const filteredGitHub = useMemo(() => githubEntries.filter((item) => !normalizedFilter || item.name.toLowerCase().includes(normalizedFilter)), [githubEntries, normalizedFilter]);

  const connected = provider === 'google' ? Boolean(googleUser) : provider === 'microsoft' ? Boolean(microsoftUser) : Boolean(githubTarget);
  const providerName = provider === 'google' ? 'Google Drive' : provider === 'microsoft' ? 'OneDrive' : 'GitHub';

  return (
    <div className="h-full min-h-[520px] rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] overflow-hidden shadow-sm grid md:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="border-b md:border-b-0 md:border-r border-[#E6EBF2] dark:border-slate-800 bg-[#F8FAFD] dark:bg-[#0B111D] p-3">
        <div className="px-2 pt-1 pb-3"><div className="text-[10px] uppercase tracking-[0.14em] font-black text-slate-400">Serviços</div><div className="mt-1 text-sm font-black">Fontes conectadas</div></div>
        <div className="grid grid-cols-3 md:grid-cols-1 gap-1.5">
          <ProviderButton active={provider === 'google'} icon={Google} label="Google Drive" detail={googleUser?.email || 'Não conectado'} onClick={() => setProvider('google')} />
          <ProviderButton active={provider === 'microsoft'} icon={Microsoft} label="OneDrive" detail={microsoftUser?.email || 'Não conectado'} onClick={() => setProvider('microsoft')} />
          <ProviderButton active={provider === 'github'} icon={GitHub} label="GitHub" detail={githubTarget ? `${githubTarget.owner}/${githubTarget.repo}` : 'Repositórios públicos'} onClick={() => setProvider('github')} />
        </div>
        <div className="hidden md:block mt-4 px-2 text-[9px] leading-relaxed text-slate-400">Serviços são fontes de arquivos. Documento, Planilha, Apresentação e Design são modos de trabalho, não serviços separados.</div>
      </aside>

      <section className="min-w-0 flex flex-col">
        <header className="min-h-16 px-3 sm:px-4 border-b border-[#E6EBF2] dark:border-slate-800 flex flex-wrap items-center gap-2 bg-white dark:bg-[#101827]">
          <div className="min-w-0 mr-auto py-2"><div className="flex items-center gap-2 text-xs font-black"><Cloud className="w-4 h-4 text-[#3157F6]" /> {providerName}</div><div className="text-[9px] text-slate-400 mt-0.5">{connected ? 'Fonte disponível no OrbiDoc' : 'Conecte esta fonte para navegar pelos arquivos'}</div></div>
          <div className="relative w-full sm:w-56 order-3 sm:order-none mb-2 sm:mb-0"><Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar arquivos" className="w-full h-9 rounded-lg border border-[#DCE3EE] dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-950 pl-8 pr-3 text-[10px] outline-none" /></div>
          {(provider === 'google' || provider === 'microsoft') && connected ? <label className={`h-9 px-3 rounded-lg border border-[#DCE3EE] dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}><Upload className="w-3.5 h-3.5" /> {uploading ? 'Enviando' : 'Enviar'}<input type="file" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label> : null}
          <button type="button" onClick={() => void reload()} disabled={loading} className="w-9 h-9 rounded-lg border border-[#DCE3EE] dark:border-slate-700 flex items-center justify-center disabled:opacity-50" aria-label="Atualizar"><Refresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </header>

        {provider === 'github' && !githubTarget ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-5 sm:p-8 bg-[#F8FAFD]/65 dark:bg-[#080D18]/30">
            <div className="w-full max-w-xl rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-5 sm:p-6 shadow-sm">
              <GitHub className="w-8 h-8 text-slate-800 dark:text-white" />
              <h2 className="mt-4 text-lg font-black">Abrir repositório</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Cole uma URL do GitHub ou use <strong>owner/repo</strong>. Repositórios públicos abrem sem conta. Privados serão ligados por GitHub App para evitar PAT armazenado no navegador.</p>
              <div className="mt-4 flex gap-2"><input value={githubInput} onChange={(event) => setGithubInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void connectGitHubTarget(); }} placeholder="github.com/owner/repo" className="h-11 min-w-0 flex-1 rounded-xl border border-[#DCE3EE] dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#3157F6]" /><button onClick={() => void connectGitHubTarget()} disabled={loading} className="h-11 px-4 rounded-xl bg-[#3157F6] text-white text-xs font-black disabled:opacity-50">Abrir</button></div>
            </div>
          </div>
        ) : !connected ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-8 text-center"><div><Connected className="w-9 h-9 mx-auto text-slate-300" /><h2 className="mt-3 text-sm font-black">{providerName} não conectado</h2><p className="mt-1 text-xs text-slate-400 max-w-sm">Abra Configurações → Conexões para autorizar este serviço. A conta OrbiDoc e o acesso aos provedores continuam separados.</p><button onClick={onOpenSettings} className="mt-4 h-10 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black">Abrir configurações</button></div></div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            {provider === 'github' && githubTarget ? <div className="sticky top-0 z-10 h-11 px-3 sm:px-4 border-b border-[#E6EBF2] dark:border-slate-800 bg-white/95 dark:bg-[#101827]/95 backdrop-blur flex items-center gap-2"><button type="button" onClick={() => void goGitHubUp()} disabled={!githubTarget.path} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" aria-label="Voltar uma pasta"><ChevronLeft className="w-4 h-4 mx-auto" /></button><GitHub className="w-3.5 h-3.5" /><span className="text-[10px] font-black truncate">{githubTarget.owner}/{githubTarget.repo}{githubTarget.path ? `/${githubTarget.path}` : ''}</span><button onClick={() => { setGithubTarget(null); setGithubEntries([]); }} className="ml-auto text-[9px] font-black text-[#3157F6]">Trocar repositório</button></div> : null}
            <div className="divide-y divide-[#EEF2F6] dark:divide-slate-800">
              {provider === 'google' && filteredGoogle.map((file) => <FileRow key={file.id} name={file.name} meta={`${file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('pt-BR') : 'Sem data'}${sizeLabel(file.size) ? ` · ${sizeLabel(file.size)}` : ''}`} folder={file.mimeType === 'application/vnd.google-apps.folder'} onOpen={() => void openGoogle(file)} externalUrl={file.webViewLink} />)}
              {provider === 'microsoft' && filteredMicrosoft.map((file) => <FileRow key={file.id} name={file.name} meta={`${file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('pt-BR') : 'Sem data'}${sizeLabel(file.size) ? ` · ${sizeLabel(file.size)}` : ''}`} folder={Boolean(file.isFolder)} onOpen={() => void openMicrosoft(file)} externalUrl={file.webUrl} />)}
              {provider === 'github' && filteredGitHub.map((entry) => <FileRow key={entry.sha + entry.path} name={entry.name} meta={`${entry.type === 'dir' ? 'Pasta' : 'Arquivo'}${sizeLabel(entry.size) ? ` · ${sizeLabel(entry.size)}` : ''}`} folder={entry.type === 'dir'} onOpen={() => void openGitHubEntry(entry)} externalUrl={entry.htmlUrl || undefined} />)}
            </div>
            {!loading && ((provider === 'google' && !filteredGoogle.length) || (provider === 'microsoft' && !filteredMicrosoft.length) || (provider === 'github' && !filteredGitHub.length)) ? <div className="p-14 text-center text-xs text-slate-400"><FileIcon className="w-8 h-8 mx-auto mb-3 text-slate-300" />Nenhum item nesta visualização.</div> : null}
          </div>
        )}
      </section>
    </div>
  );
};

const FileRow: React.FC<{ name: string; meta: string; folder?: boolean; onOpen: () => void; externalUrl?: string }> = ({ name, meta, folder, onOpen, externalUrl }) => (
  <div className="min-h-14 px-3 sm:px-4 py-2 flex items-center gap-3 hover:bg-[#F8FAFD] dark:hover:bg-slate-900/55 group">
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 flex items-center gap-3 text-left rounded-lg focus-visible:outline-offset-2">
      <span className="w-9 h-9 shrink-0 rounded-lg bg-[#EEF2F8] dark:bg-slate-800 flex items-center justify-center">{folder ? <Folder className="w-4 h-4 text-amber-500" /> : <FileIcon className="w-4 h-4 text-slate-500" />}</span>
      <span className="min-w-0"><span className="block text-[11px] font-bold truncate">{name}</span><span className="block mt-0.5 text-[9px] text-slate-400 truncate">{meta}</span></span>
    </button>
    {externalUrl ? <button type="button" onClick={() => window.open(externalUrl, '_blank', 'noopener,noreferrer')} className="w-8 h-8 rounded-lg opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label={`Abrir ${name} no serviço original`}><ExternalLink className="w-3.5 h-3.5" /></button> : null}
  </div>
);
