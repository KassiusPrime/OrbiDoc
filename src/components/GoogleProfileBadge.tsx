import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, HardDrive, FileText, ExternalLink, RefreshCw, Loader2, ShieldCheck, CheckCircle2, User } from 'lucide-react';
import { GoogleUserProfile, DriveFile } from '../types';
import { loginWithGooglePopup, logoutGoogleUser, listGoogleDriveFiles } from '../services/googleAuthDrive';

interface GoogleProfileBadgeProps {
  user: GoogleUserProfile | null;
  onUserChange: (user: GoogleUserProfile | null) => void;
  onNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const GoogleProfileBadge: React.FC<GoogleProfileBadgeProps> = ({ user, onUserChange, onNotification }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      loadDriveFiles();
    }
  }, [user, isOpen]);

  const loadDriveFiles = async () => {
    if (!user?.accessToken) return;
    setIsLoadingDrive(true);
    try {
      const files = await listGoogleDriveFiles(user.accessToken);
      setDriveFiles(files);
    } catch (err: any) {
      console.warn('Drive files error:', err.message);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const profile = await loginWithGooglePopup();
      onUserChange(profile);
      onNotification(`Bem-vindo(a), ${profile.name}! Login do Google efetuado com sucesso.`);
    } catch (err: any) {
      onNotification(err.message || 'Falha no login do Google.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logoutGoogleUser();
    onUserChange(null);
    setIsOpen(false);
    onNotification('Sessão do Google encerrada.');
  };

  if (!user) {
    return (
      <button
        onClick={handleLogin}
        disabled={isLoggingIn}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-slate-700 transition-all shadow-sm"
      >
        {isLoggingIn ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2 0 10.04 0 12s.47 3.8 1.29 5.42l3.99-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
        )}
        <span>Entrar com Google</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-2.5 pr-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-full border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
      >
        <span className="text-xs font-semibold max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
        {user.picture ? (
          <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full ring-2 ring-indigo-500/50 object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
            {user.name.charAt(0)}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 z-50 space-y-4 animate-[fadeIn_0.2s_ease]">
          {/* User Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-11 h-11 rounded-2xl ring-2 ring-indigo-500/50 object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Privacy & Scope Badge */}
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Acesso Privado ao Drive</span>
              <span className="text-[11px] opacity-90">O app acessa apenas arquivos criados pelo DocSwiss (Scope: drive.file).</span>
            </div>
          </div>

          {/* Google Drive Files */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                Seu Google Drive
              </span>
              <button onClick={loadDriveFiles} className="text-slate-400 hover:text-indigo-500 p-1">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingDrive ? (
              <div className="p-4 text-center text-slate-400 text-xs flex justify-center items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Carregando arquivos do Drive...
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-slate-400 text-xs">
                Nenhum documento salvo no Drive ainda.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700/50"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate text-[11px] font-medium">{file.name}</span>
                    </div>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-500 hover:text-indigo-600 p-1"
                        title="Abrir no Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-300 dark:hover:text-red-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da Conta Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
