import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, HardDrive, FileText, ExternalLink, RefreshCw, Loader2, ShieldCheck, User, Cloud } from 'lucide-react';
import { GoogleUserProfile, DriveFile } from '../types';
import { loginWithGooglePopup, logoutGoogleUser, listGoogleDriveFiles } from '../services/googleAuthDrive';
import { MicrosoftUserProfile, OneDriveFile, loginWithMicrosoftPopup, logoutMicrosoftUser, listOneDriveFiles, getStoredMicrosoftUser } from '../services/microsoftAuthOffice';

interface AuthProfileBadgeProps {
  user: GoogleUserProfile | null;
  onUserChange: (user: GoogleUserProfile | null) => void;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onMsUserChange?: (user: MicrosoftUserProfile | null) => void;
  onNotification: (msg: string, type?: 'success' | 'error') => void;
}

export const GoogleProfileBadge: React.FC<AuthProfileBadgeProps> = ({
  user,
  onUserChange,
  msUser: propMsUser,
  setMsUser: setMsUserProp,
  onMsUserChange,
  onNotification,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [isLoggingInMs, setIsLoggingInMs] = useState(false);
  const [msUser, setMsUser] = useState<MicrosoftUserProfile | null>(propMsUser || getStoredMicrosoftUser());

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [oneDriveFiles, setOneDriveFiles] = useState<OneDriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  useEffect(() => {
    if (propMsUser !== undefined) {
      setMsUser(propMsUser);
    }
  }, [propMsUser]);

  useEffect(() => {
    if (isOpen) {
      if (user) loadDriveFiles();
      if (msUser) loadOneDriveFiles();
    }
  }, [user, msUser, isOpen]);

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

  const loadOneDriveFiles = async () => {
    if (!msUser) return;
    try {
      const files = await listOneDriveFiles(msUser);
      setOneDriveFiles(files);
    } catch (err: any) {
      console.warn('OneDrive error:', err.message);
    }
  };

  const handleLoginGoogle = async () => {
    setIsLoggingInGoogle(true);
    try {
      const profile = await loginWithGooglePopup();
      onUserChange(profile);
      onNotification(`Bem-vindo(a), ${profile.name}! Login Google ativado com sucesso.`);
    } catch (err: any) {
      onNotification(err.message || 'Falha no login do Google.', 'error');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleLoginMicrosoft = async () => {
    setIsLoggingInMs(true);
    try {
      const profile = await loginWithMicrosoftPopup();
      setMsUser(profile);
      if (onMsUserChange) onMsUserChange(profile);
      onNotification(`Conectado à Conta Office 365 (${profile.email}) com sucesso!`);
    } catch (err: any) {
      onNotification(err.message || 'Falha na autenticação Microsoft / Office.', 'error');
    } finally {
      setIsLoggingInMs(false);
    }
  };

  const handleLogoutGoogle = () => {
    logoutGoogleUser();
    onUserChange(null);
    setIsOpen(false);
    onNotification('Sessão do Google encerrada.');
  };

  const handleLogoutMicrosoft = () => {
    logoutMicrosoftUser();
    setMsUser(null);
    if (onMsUserChange) onMsUserChange(null);
    setIsOpen(false);
    onNotification('Sessão da Conta Office 365 encerrada.');
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Google Button or Active Badge */}
      {!user ? (
        <button
          onClick={handleLoginGoogle}
          disabled={isLoggingInGoogle}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-slate-700 transition-all shadow-sm"
        >
          {isLoggingInGoogle ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          ) : (
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
          <span>Google</span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 p-1 pl-2.5 pr-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-full border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
        >
          <span className="text-xs font-semibold max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
          {user.picture ? (
            <img src={user.picture} alt="" className="w-5 h-5 rounded-full ring-2 ring-indigo-500/50 object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              {user.name.charAt(0)}
            </div>
          )}
        </button>
      )}

      {/* Microsoft Office 365 Button or Badge */}
      {!msUser ? (
        <button
          onClick={handleLoginMicrosoft}
          disabled={isLoggingInMs}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-semibold border border-amber-500/30 transition-all shadow-sm"
        >
          {isLoggingInMs ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          ) : (
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          )}
          <span>Office 365</span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 p-1 pl-2.5 pr-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded-full border border-amber-500/30 transition-all shadow-sm"
        >
          <span className="text-xs font-bold max-w-[80px] truncate">{msUser.name.split(' ')[0]}</span>
          <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-extrabold">
            MS
          </div>
        </button>
      )}

      {/* Unified Account Manager Popup */}
      {isOpen && (
        <div className="absolute right-0 top-10 w-88 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 z-50 space-y-4 animate-[fadeIn_0.2s_ease]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Nuvem & Contas Conectadas
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
              ✕
            </button>
          </div>

          {/* Google Account Block */}
          {user ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="w-8 h-8 rounded-full ring-2 ring-indigo-500/50 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</h4>
                    <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogoutGoogle}
                  className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                >
                  Sair
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                  Google Drive Cloud
                </span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  Sincronizado ({driveFiles.length})
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLoginGoogle}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-slate-700"
            >
              Conectar Google Drive
            </button>
          )}

          {/* Microsoft Office 365 Account Block */}
          {msUser ? (
            <div className="p-3 bg-amber-500/5 dark:bg-amber-950/20 rounded-2xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
                    MS
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{msUser.name}</h4>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate max-w-[150px]">{msUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogoutMicrosoft}
                  className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                >
                  Sair
                </button>
              </div>

              <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Cloud className="w-3.5 h-3.5 text-amber-600" />
                  OneDrive / Microsoft 365
                </span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  Conectado ({oneDriveFiles.length})
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLoginMicrosoft}
              className="w-full p-3 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-amber-800"
            >
              Conectar Conta Office 365 / OneDrive
            </button>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[10px] text-slate-400">
              Pronto para importação e exportação direta para Google Drive & Microsoft Office 365.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
