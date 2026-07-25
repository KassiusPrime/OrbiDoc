import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Search,
  X,
  Loader2,
  Download,
  Link2,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  size?: string;
  modifiedTime?: string;
}

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
}) => {
  const [accessToken, setAccessToken] = useState<string>(() => {
    return localStorage.getItem('gdrive_access_token') || '';
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [pastedUrl, setPastedUrl] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Load Google Drive API script dynamically if needed
  useEffect(() => {
    if (accessToken && isOpen) {
      fetchDriveFiles(accessToken);
    }
  }, [isOpen, accessToken]);

  const handleConnectDrive = () => {
    setErrorMessage(null);
    setStatusNotice('Conectando ao Google Drive...');

    // Try Google Identity Services GIS token client if available
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: '', // Empty or default AI Studio client ID
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              localStorage.setItem('gdrive_access_token', response.access_token);
              setStatusNotice('Conectado com sucesso!');
              fetchDriveFiles(response.access_token);
            } else {
              setErrorMessage('Não foi possível obter o token de acesso do Google.');
              setStatusNotice(null);
            }
          },
        });
        client.requestAccessToken();
        return;
      } catch (err: any) {
        console.warn('GIS Token client error:', err);
      }
    }

    // Fallback prompt for OAuth Token if popped in separate flow
    const token = window.prompt(
      'Cole seu Token de Acesso do Google Drive (ou use o login de demonstração):'
    );
    if (token) {
      setAccessToken(token.trim());
      localStorage.setItem('gdrive_access_token', token.trim());
      fetchDriveFiles(token.trim());
    } else {
      setStatusNotice(null);
    }
  };

  const fetchDriveFiles = async (token: string) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,iconLink,thumbnailLink,size,modifiedTime)&q=trashed%3Dfalse`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 401) {
        setErrorMessage('Sessão expirada. Conecte sua conta do Google Drive novamente.');
        setAccessToken('');
        localStorage.removeItem('gdrive_access_token');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro ${res.status}`);
      }

      const data = await res.json();
      setFiles(data.files || []);
      setStatusNotice('Arquivos do Google Drive carregados.');
    } catch (err: any) {
      console.error('Erro ao buscar arquivos do Google Drive:', err);
      setErrorMessage(`Falha na API do Drive: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAndSelect = async (driveFile: GoogleDriveFile) => {
    setDownloadingId(driveFile.id);
    setErrorMessage(null);

    try {
      let fetchUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`;
      let mimeType = driveFile.mimeType;

      // Se for um arquivo nativo do Google Docs / Sheets
      if (driveFile.mimeType === 'application/vnd.google-apps.document') {
        fetchUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=application/pdf`;
        mimeType = 'application/pdf';
        driveFile.name = driveFile.name.endsWith('.pdf') ? driveFile.name : `${driveFile.name}.pdf`;
      } else if (driveFile.mimeType === 'application/vnd.google-apps.spreadsheet') {
        fetchUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/csv`;
        mimeType = 'text/csv';
        driveFile.name = driveFile.name.endsWith('.csv') ? driveFile.name : `${driveFile.name}.csv`;
      }

      const response = await fetch(fetchUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo (${response.status})`);
      }

      const blob = await response.blob();
      const file = new File([blob], driveFile.name, { type: mimeType });

      onSelectFile(file);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Erro no download do Google Drive: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePastedUrlImport = async () => {
    if (!pastedUrl.trim()) return;

    // Extrair ID de URL do Google Drive
    // Formatos: https://drive.google.com/file/d/1ABC123xyz/view
    // ou https://docs.google.com/document/d/1ABC123xyz/edit
    const match = pastedUrl.match(/\/(?:file\/d|document\/d|spreadsheets\/d)\/([a-zA-Z0-9_-]+)/);
    const fileId = match ? match[1] : pastedUrl.trim();

    if (!fileId) {
      setErrorMessage('URL ou ID do Google Drive inválido.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      if (accessToken) {
        // Tentar obter dados via API do Drive
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (metaRes.ok) {
          const meta = await metaRes.json();
          await handleDownloadAndSelect(meta);
          return;
        }
      }

      // Se não houver token ou for link público, tentar download export
      const exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(exportUrl);
      
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], `google_drive_file_${fileId.substring(0, 6)}.pdf`, {
          type: blob.type || 'application/pdf',
        });
        onSelectFile(file);
        onClose();
      } else {
        throw new Error('Não foi possível acessar o arquivo sem autenticação. Conecte sua conta do Google Drive.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao importar arquivo do link do Drive.');
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (fileTypeFilter === 'pdf') return f.mimeType.includes('pdf') || f.name.endsWith('.pdf');
    if (fileTypeFilter === 'image') return f.mimeType.includes('image');
    if (fileTypeFilter === 'doc')
      return (
        f.mimeType.includes('document') ||
        f.mimeType.includes('word') ||
        f.name.endsWith('.docx') ||
        f.name.endsWith('.txt')
      );
    if (fileTypeFilter === 'sheet')
      return (
        f.mimeType.includes('sheet') ||
        f.mimeType.includes('excel') ||
        f.name.endsWith('.xlsx') ||
        f.name.endsWith('.csv')
      );

    return true;
  });

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('image')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel'))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    if (mimeType.includes('document') || mimeType.includes('word'))
      return <FileCode className="w-5 h-5 text-indigo-500" />;
    return <Folder className="w-5 h-5 text-amber-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-blue-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[10px] flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Google Drive Studio
                <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Integrado
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione documentos, PDFs ou imagens do seu Google Drive para OCR e Chat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status and Error Banners */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusNotice && !errorMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{statusNotice}</span>
            </div>
          )}

          {/* Import via Link */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-500" />
              Importar por Link Direto do Google Drive
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pastedUrl}
                onChange={(e) => setPastedUrl(e.target.value)}
                placeholder="Cole a URL do arquivo (ex: https://drive.google.com/file/d/...)"
                className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-600"
              />
              <button
                onClick={handlePastedUrlImport}
                disabled={loading || !pastedUrl.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Importar
              </button>
            </div>
          </div>

          {/* Connect Button or Search Bar */}
          {!accessToken ? (
            <div className="text-center py-8 bg-slate-50/70 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Conectar Conta Google Drive
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Acesse seus documentos salvos diretamente no seu Google Drive sem sair do app.
                </p>
              </div>
              <button
                onClick={handleConnectDrive}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 mx-auto transition-all"
              >
                <HardDrive className="w-4 h-4" />
                Autorizar Acesso ao Google Drive
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                <div className="relative w-full sm:w-auto flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar arquivos no seu Google Drive..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  {['all', 'pdf', 'doc', 'image', 'sheet'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFileTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        fileTypeFilter === type
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {type === 'all' ? 'Todos' : type.toUpperCase()}
                    </button>
                  ))}

                  <button
                    onClick={() => fetchDriveFiles(accessToken)}
                    title="Atualizar arquivos"
                    className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Files Grid / List */}
              {loading ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Carregando seus arquivos do Google Drive...
                  </p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  Nenhum arquivo do Drive encontrado para o filtro digitado.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {filteredFiles.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => handleDownloadAndSelect(f)}
                      className="p-3 bg-white dark:bg-slate-800/90 hover:bg-indigo-50/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl cursor-pointer flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg shrink-0">
                          {getFileIcon(f.mimeType)}
                        </div>
                        <div className="overflow-hidden">
                          <h5 className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {f.name}
                          </h5>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {f.mimeType.split('.').pop()?.split('/').pop()?.toUpperCase() || 'Arquivo'}
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={downloadingId === f.id}
                        className="p-2 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-900 rounded-lg transition-colors"
                      >
                        {downloadingId === f.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between items-center">
          <span className="text-[11px] text-slate-400">
            Acesso seguro em conformidade com Google OAuth 2.0 API v3
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
