import React, { useEffect, useState } from 'react';
import {
  IconCloud as Cloud,
  IconDownload as Download,
  IconExternalLink as ExternalLink,
  IconFile as FileIcon,
  IconRefresh as Refresh,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { DriveFile, GoogleUserProfile, MicrosoftUserProfile } from '../types';
import { listGoogleDriveFiles, uploadToGoogleDrive } from '../services/googleAuthDrive';
import { listOneDriveFiles, uploadToOneDrive, downloadOneDriveFile, OneDriveFile } from '../services/microsoftAuthOffice';

interface CloudWorkspaceProps {
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type Provider = 'google' | 'microsoft';

export const CloudWorkspace: React.FC<CloudWorkspaceProps> = ({ googleUser, microsoftUser, showNotification = () => {} }) => {
  const [provider, setProvider] = useState<Provider>(googleUser ? 'google' : 'microsoft');
  const [googleFiles, setGoogleFiles] = useState<DriveFile[]>([]);
  const [microsoftFiles, setMicrosoftFiles] = useState<OneDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async (target = provider) => {
    setLoading(true);
    try {
      if (target === 'google') {
        if (!googleUser) { setGoogleFiles([]); return; }
        setGoogleFiles(await listGoogleDriveFiles(googleUser.accessToken));
      } else {
        if (!microsoftUser) { setMicrosoftFiles([]); return; }
        setMicrosoftFiles(await listOneDriveFiles(microsoftUser));
      }
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao carregar arquivos da nuvem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(provider); }, [provider, googleUser?.id, microsoftUser?.id]);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      if (provider === 'google') {
        if (!googleUser) throw new Error('Conecte uma conta Google antes de enviar arquivos.');
        await uploadToGoogleDrive(googleUser.accessToken, file.name, file.type || 'application/octet-stream', file);
      } else {
        if (!microsoftUser) throw new Error('Conecte uma conta Microsoft antes de enviar arquivos.');
        await uploadToOneDrive(microsoftUser, file.name, file, file.type || 'application/octet-stream');
      }
      showNotification(`${file.name} enviado para ${provider === 'google' ? 'Google Drive' : 'OneDrive'}.`, 'success');
      await load(provider);
    } catch (error: any) {
      showNotification(error?.message || 'Falha no upload.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const downloadMicrosoft = async (file: OneDriveFile) => {
    try {
      if (!microsoftUser || file.isFolder) return;
      const blob = await downloadOneDriveFile(file.id, microsoftUser);
      saveAs(blob, file.name);
    } catch (error: any) {
      showNotification(error?.message || 'Falha no download.', 'error');
    }
  };

  const currentFiles = provider === 'google' ? googleFiles : microsoftFiles;
  const connected = provider === 'google' ? Boolean(googleUser) : Boolean(microsoftUser);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1"><div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Cloud className="w-4 h-4" /> Nuvem conectada</div><h1 className="mt-1 text-2xl font-black">Google Drive e OneDrive</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">Esta tela lista somente arquivos retornados pelas APIs reais. Seus projetos locais continuam independentes e disponíveis offline.</p></div>
          <div className="flex bg-slate-100 dark:bg-slate-950 rounded-xl p-1"><button onClick={() => setProvider('google')} className={`h-9 px-3 rounded-lg text-xs font-black ${provider === 'google' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}>Google Drive</button><button onClick={() => setProvider('microsoft')} className={`h-9 px-3 rounded-lg text-xs font-black ${provider === 'microsoft' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}>OneDrive</button></div>
        </div>
      </section>

      {!connected ? <section className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center"><Cloud className="w-10 h-10 mx-auto text-slate-300" /><h2 className="mt-3 text-sm font-black">Conta {provider === 'google' ? 'Google' : 'Microsoft'} não conectada</h2><p className="mt-1 text-xs text-slate-500">Use a Central de Contas no cabeçalho para autenticar. O OrbiDoc não cria uma sessão de demonstração.</p></section> : <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"><div className="flex-1"><h2 className="text-sm font-black">Arquivos</h2><p className="text-[10px] text-slate-500">{currentFiles.length} item(ns) retornados pela API.</p></div><label className={`h-9 px-3 rounded-xl bg-indigo-600 text-white text-[11px] font-black inline-flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}><Upload className="w-4 h-4" />{uploading ? 'Enviando…' : 'Enviar arquivo'}<input type="file" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label><button onClick={() => load(provider)} disabled={loading} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-50"><Refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div>{loading ? <div className="p-12 text-center text-xs text-slate-400">Carregando arquivos reais…</div> : currentFiles.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{currentFiles.map((raw) => { const file: any = raw; return <div key={file.id} className="px-5 py-3 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FileIcon className="w-4 h-4 text-slate-500" /></div><div className="min-w-0 flex-1"><div className="text-xs font-bold truncate">{file.name}</div><div className="text-[10px] text-slate-400 mt-0.5">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('pt-BR') : 'Sem data'}{file.size ? ` · ${Math.max(1, Math.round(Number(file.size) / 1024))} KB` : ''}</div></div>{file.webViewLink || file.webUrl ? <button onClick={() => window.open(file.webViewLink || file.webUrl, '_blank', 'noopener,noreferrer')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Abrir na nuvem"><ExternalLink className="w-4 h-4" /></button> : null}{provider === 'microsoft' && !file.isFolder ? <button onClick={() => void downloadMicrosoft(file)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Baixar"><Download className="w-4 h-4" /></button> : null}</div>; })}</div> : <div className="p-12 text-center text-xs text-slate-400">Nenhum arquivo retornado por esta conexão.</div>}</section>}
    </div>
  );
};
