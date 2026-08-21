import React, { useEffect, useState } from 'react';
import {
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
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
import { downloadOneDriveFile, listOneDriveFiles, OneDriveFile, uploadToOneDrive } from '../services/microsoftAuthOffice';

interface CloudWorkspaceProps {
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type Provider = 'google' | 'microsoft';
type CloudFile = DriveFile | OneDriveFile;

const PROVIDER_META = {
  google: { label: 'Google Drive', short: 'Google', icon: Google },
  microsoft: { label: 'OneDrive', short: 'Microsoft', icon: Microsoft },
} as const;

const fileSizeLabel = (size?: string | number) => {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const CloudWorkspace: React.FC<CloudWorkspaceProps> = ({
  googleUser,
  microsoftUser,
  showNotification = () => {},
}) => {
  const [provider, setProvider] = useState<Provider>(googleUser ? 'google' : 'microsoft');
  const [googleFiles, setGoogleFiles] = useState<DriveFile[]>([]);
  const [microsoftFiles, setMicrosoftFiles] = useState<OneDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async (target: Provider) => {
    setLoading(true);
    try {
      if (target === 'google') {
        if (!googleUser) {
          setGoogleFiles([]);
          return;
        }
        setGoogleFiles(await listGoogleDriveFiles(googleUser.accessToken));
        return;
      }

      if (!microsoftUser) {
        setMicrosoftFiles([]);
        return;
      }
      setMicrosoftFiles(await listOneDriveFiles(microsoftUser));
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao carregar arquivos da nuvem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(provider);
    // Tokens are deliberately not dependencies; profile ids represent account changes.
  }, [provider, googleUser?.id, microsoftUser?.id]);

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
      showNotification(`${file.name} enviado para ${PROVIDER_META[provider].label}.`, 'success');
      await load(provider);
    } catch (error: any) {
      showNotification(error?.message || 'Falha no upload.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const downloadMicrosoft = async (file: OneDriveFile) => {
    if (!microsoftUser || file.isFolder) return;
    try {
      const blob = await downloadOneDriveFile(file.id, microsoftUser);
      saveAs(blob, file.name);
    } catch (error: any) {
      showNotification(error?.message || 'Falha no download.', 'error');
    }
  };

  const currentFiles: CloudFile[] = provider === 'google' ? googleFiles : microsoftFiles;
  const connected = provider === 'google' ? Boolean(googleUser) : Boolean(microsoftUser);
  const profile = provider === 'google' ? googleUser : microsoftUser;
  const meta = PROVIDER_META[provider];

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-[fadeIn_0.2s_ease]">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400">
              <Cloud className="w-4 h-4" /> Nuvem
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Arquivos conectados</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Google Drive e OneDrive ficam separados da biblioteca local. Aqui aparecem somente arquivos retornados pelas APIs das contas conectadas.
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 rounded-xl p-1" role="tablist" aria-label="Provedor de nuvem">
            {(['google', 'microsoft'] as Provider[]).map((item) => {
              const ProviderIcon = PROVIDER_META[item].icon;
              const active = provider === item;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setProvider(item)}
                  className={`h-10 px-3 rounded-lg text-xs font-black inline-flex items-center gap-2 ${active ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <ProviderIcon className="w-4 h-4" /> {PROVIDER_META[item].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50/70 dark:bg-slate-950/30 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className={`inline-flex items-center gap-2 font-bold ${connected ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {connected ? `${meta.short} conectado` : `${meta.short} não conectado`}
          </span>
          {profile?.email ? <span className="truncate max-w-[280px]">{profile.email}</span> : <span>Use “Entrar e conectar” no cabeçalho para autenticar.</span>}
          <span className="sm:ml-auto">Biblioteca local permanece disponível offline.</span>
        </div>
      </section>

      {!connected ? (
        <section className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-14 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <meta.icon className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </div>
          <h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">Conecte {meta.label}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            A autenticação é opcional. Abra “Entrar e conectar” no canto superior e conecte a conta quando quiser acessar os arquivos desta nuvem.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[160px]">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">{meta.label}</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">{currentFiles.length} {currentFiles.length === 1 ? 'item retornado' : 'itens retornados'} pela API.</p>
            </div>

            <label className={`h-10 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black inline-flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" /> {uploading ? 'Enviando…' : 'Enviar arquivo'}
              <input type="file" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            <button
              type="button"
              onClick={() => void load(provider)}
              disabled={loading}
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center disabled:opacity-50"
              aria-label={`Atualizar arquivos do ${meta.label}`}
            >
              <Refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-14 text-center">
              <Refresh className="w-5 h-5 mx-auto animate-spin text-indigo-500" />
              <p className="mt-3 text-xs text-slate-400">Atualizando arquivos…</p>
            </div>
          ) : currentFiles.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentFiles.map((raw) => {
                const file = raw as DriveFile & OneDriveFile;
                const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('pt-BR') : 'Sem data';
                const size = fileSizeLabel(file.size);
                const viewUrl = file.webViewLink || file.webUrl;
                return (
                  <div key={file.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <FileIcon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{file.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{modified}{size ? ` · ${size}` : ''}</div>
                    </div>
                    {viewUrl ? (
                      <button type="button" onClick={() => window.open(viewUrl, '_blank', 'noopener,noreferrer')} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label={`Abrir ${file.name} na nuvem`}>
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    ) : null}
                    {provider === 'microsoft' && !file.isFolder ? (
                      <button type="button" onClick={() => void downloadMicrosoft(file)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label={`Baixar ${file.name}`}>
                        <Download className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-14 text-center">
              <FileIcon className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">Nenhum arquivo encontrado</h3>
              <p className="mt-1 text-xs text-slate-400">A API desta conta não retornou itens para a visualização atual.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
