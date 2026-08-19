import React, { useEffect, useMemo, useState } from 'react';
import {
  IconFolder as Folder,
  IconFileText as FileText,
  IconSearch as Search,
  IconX as X,
  IconLoader2 as Loader2,
  IconCloud as Cloud,
  IconCircleCheck as CheckCircle2,
  IconAlertCircle as AlertCircle,
  IconFileSpreadsheet as FileSpreadsheet,
  IconPresentation as Presentation,
  IconRefresh as RefreshCw,
  IconLogin as Login,
  IconLogout as Logout,
  IconLink as Link,
} from '@tabler/icons-react';
import { DriveFile, GoogleUserProfile } from '../types';
import {
  getStoredGoogleUser,
  loginWithGooglePopup,
  logoutGoogleUser,
  listGoogleDriveFiles,
} from '../services/googleAuthDrive';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File) => void;
  onNotification?: (msg: string, type?: 'error' | 'success') => void;
}

const GOOGLE_DOC = 'application/vnd.google-apps.document';
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';
const GOOGLE_SLIDES = 'application/vnd.google-apps.presentation';

const getFileMeta = (mimeType: string) => {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return { label: 'Planilha', icon: FileSpreadsheet, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300' };
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return { label: 'Apresentação', icon: Presentation, className: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300' };
  }
  if (mimeType.includes('folder')) {
    return { label: 'Pasta', icon: Folder, className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300' };
  }
  return { label: mimeType.includes('pdf') ? 'PDF' : 'Documento', icon: FileText, className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' };
};

const formatSize = (size?: string) => {
  const bytes = Number(size || 0);
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const extractDriveId = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d)\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) ? trimmed : '');
};

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  onNotification = () => {},
}) => {
  const [user, setUser] = useState<GoogleUserProfile | null>(() => getStoredGoogleUser());
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'document' | 'sheet' | 'presentation'>('all');
  const [pastedLink, setPastedLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async (profile: GoogleUserProfile) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listGoogleDriveFiles(profile.accessToken);
      setFiles(result.filter((file) => !file.mimeType.includes('folder')));
    } catch (err: any) {
      const message = err?.message || 'Não foi possível carregar o Google Drive.';
      setError(message);
      if (/401|token|credencial|autoriz/i.test(message)) {
        logoutGoogleUser();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const stored = getStoredGoogleUser();
    setUser(stored);
    if (stored) void loadFiles(stored);
  }, [isOpen]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return files.filter((file) => {
      const matchesSearch = !query || file.name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (typeFilter === 'document') return file.mimeType.includes('document') || file.mimeType.includes('pdf') || file.mimeType.includes('word');
      if (typeFilter === 'sheet') return file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel') || file.mimeType.includes('csv');
      if (typeFilter === 'presentation') return file.mimeType.includes('presentation') || file.mimeType.includes('powerpoint');
      return true;
    });
  }, [files, searchQuery, typeFilter]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const profile = await loginWithGooglePopup();
      setUser(profile);
      await loadFiles(profile);
      onNotification(`Google Drive conectado como ${profile.email}.`, 'success');
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar ao Google Drive.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    logoutGoogleUser();
    setUser(null);
    setFiles([]);
    setError(null);
    onNotification('Sessão Google removida deste navegador.', 'success');
  };

  const fetchDriveBlob = async (driveFile: Pick<DriveFile, 'id' | 'name' | 'mimeType'>) => {
    if (!user) throw new Error('Conecte sua Conta Google primeiro.');

    let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}?alt=media`;
    let mimeType = driveFile.mimeType;
    let fileName = driveFile.name;

    if (driveFile.mimeType === GOOGLE_DOC) {
      mimeType = 'application/pdf';
      url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}/export?mimeType=${encodeURIComponent(mimeType)}`;
      if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
    } else if (driveFile.mimeType === GOOGLE_SHEET) {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}/export?mimeType=${encodeURIComponent(mimeType)}`;
      if (!fileName.toLowerCase().endsWith('.xlsx')) fileName += '.xlsx';
    } else if (driveFile.mimeType === GOOGLE_SLIDES) {
      mimeType = 'application/pdf';
      url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFile.id)}/export?mimeType=${encodeURIComponent(mimeType)}`;
      if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    if (response.status === 401) {
      logoutGoogleUser();
      setUser(null);
      throw new Error('Sua sessão Google expirou. Conecte novamente.');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || `Falha ao baixar o arquivo (${response.status}).`);
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || mimeType });
  };

  const openFile = async (driveFile: DriveFile) => {
    setDownloadingId(driveFile.id);
    setError(null);
    try {
      const file = await fetchDriveBlob(driveFile);
      onSelectFile(file);
      onNotification(`${driveFile.name} importado do Google Drive.`, 'success');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao importar o arquivo.');
    } finally {
      setDownloadingId(null);
    }
  };

  const importFromLink = async () => {
    const id = extractDriveId(pastedLink);
    if (!id) {
      setError('Cole um link válido do Google Drive ou um ID de arquivo.');
      return;
    }
    if (!user) {
      setError('Conecte sua Conta Google para importar um link do Drive com segurança.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,modifiedTime`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (!metadataResponse.ok) throw new Error('Não foi possível acessar esse arquivo com a conta conectada.');
      const metadata = await metadataResponse.json();
      const file = await fetchDriveBlob(metadata);
      onSelectFile(file);
      onNotification(`${metadata.name} importado do Google Drive.`, 'success');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao importar o link do Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-4xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-black text-slate-900 dark:text-white">Google Drive</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Importe arquivos usando a mesma sessão Google do DocSwiss.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </header>

        {!user ? (
          <div className="flex-1 min-h-[420px] p-6 flex items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 flex items-center justify-center"><Cloud className="w-7 h-7" /></div>
              <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">Conectar ao Drive</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">O DocSwiss usa OAuth real. Nenhum token manual ou conta de demonstração é aceito.</p>
              <button onClick={connect} disabled={connecting} className="mt-5 h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Login className="w-4 h-4" />}
                Entrar com Google
              </button>
              {error && <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs"><AlertCircle className="w-4 h-4 inline mr-1" />{error}</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold"><CheckCircle2 className="w-4 h-4" /> {user.email}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => void loadFiles(user)} disabled={loading} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800" title="Atualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                <button onClick={disconnect} className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Desconectar"><Logout className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar no Drive..." className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto">
                  {[['all','Todos'],['document','Docs/PDF'],['sheet','Planilhas'],['presentation','Slides']].map(([value,label]) => (
                    <button key={value} onClick={() => setTypeFilter(value as typeof typeFilter)} className={`h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap ${typeFilter === value ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={pastedLink} onChange={(e) => setPastedLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void importFromLink()} placeholder="Cole um link do Google Drive..." className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:border-blue-500" />
                </div>
                <button onClick={() => void importFromLink()} disabled={!pastedLink.trim() || loading} className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40">Importar link</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[320px]">
              {error && <div className="m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

              {loading && files.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" />Carregando seus arquivos...</div>
              ) : filteredFiles.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center px-6"><Folder className="w-10 h-10 text-slate-300 dark:text-slate-700" /><div className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">Nenhum arquivo encontrado</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">O escopo Drive File mostra arquivos disponíveis para este app.</div></div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredFiles.map((driveFile) => {
                    const meta = getFileMeta(driveFile.mimeType);
                    const Icon = meta.icon;
                    return (
                      <button key={driveFile.id} onClick={() => void openFile(driveFile)} disabled={downloadingId === driveFile.id} className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-60 group">
                        <div className={`w-10 h-10 rounded-xl ${meta.className} flex items-center justify-center shrink-0`}><Icon className="w-5 h-5" /></div>
                        <div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">{driveFile.name}</div><div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{meta.label} • {formatSize(driveFile.size)}{driveFile.modifiedTime ? ` • ${new Date(driveFile.modifiedTime).toLocaleDateString('pt-BR')}` : ''}</div></div>
                        {downloadingId === driveFile.id ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <span className="text-[11px] font-bold text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100">Importar</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
