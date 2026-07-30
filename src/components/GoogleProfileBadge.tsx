import React, { useState, useEffect } from 'react';
import { 
  IconLogin, IconLogout, IconDatabase as IconHardDrive, IconFileText, IconLoader2, 
  IconShieldCheck, IconUser, IconCloud, IconX, IconRefresh, IconCheck
} from '@tabler/icons-react';
import { GoogleUserProfile, DriveFile } from '../types';
import { loginWithGooglePopup, logoutGoogleUser, listGoogleDriveFiles } from '../services/googleAuthDrive';
import { MicrosoftUserProfile, OneDriveFile, loginWithMicrosoftPopup, logoutMicrosoftUser, listOneDriveFiles, getStoredMicrosoftUser } from '../services/microsoftAuthOffice';
import { signInWithGoogleFirebase, signOutFirebase } from '../lib/firebase';

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
      // Primary: Firebase Auth Google Popup
      const { profile } = await signInWithGoogleFirebase();
      onUserChange(profile);
      onNotification(`Bem-vindo(a), ${profile.name}! Conta Google conectada e dados salvos no Firebase.`);
    } catch (err: any) {
      // Fallback to custom popup auth if Firebase popup is blocked
      try {
        const profile = await loginWithGooglePopup();
        onUserChange(profile);
        onNotification(`Bem-vindo(a), ${profile.name}! Conta Google ativada.`);
      } catch (fallbackErr: any) {
        onNotification(err.message || 'Falha no login do Google.', 'error');
      }
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

  const handleLogoutGoogle = async () => {
    await signOutFirebase().catch(() => {});
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
      {/* Consolidated Unified Auth Header Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 transition-all shadow-xs active:scale-95"
        title="Central de Contas Google & Microsoft"
      >
        <div className="flex items-center -space-x-1">
          {/* Google Icon Badge */}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center p-0.5 ${user ? 'bg-indigo-600 ring-2 ring-indigo-500/40 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2 0 10.04 0 12s.47 3.8 1.29 5.42l3.99-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
          </div>
          {/* Microsoft Icon Badge */}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center p-0.5 ${msUser ? 'bg-amber-500 ring-2 ring-amber-500/40 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H1z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H1z" />
            </svg>
          </div>
        </div>

        <span className="text-xs font-bold truncate max-w-[110px]">
          {user ? user.name.split(' ')[0] : msUser ? msUser.name.split(' ')[0] : 'Entrar Google'}
        </span>

        {(user || msUser) && (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </button>

      {/* Unified Account Manager Popup */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 z-50 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <IconShieldCheck className="w-4 h-4 text-emerald-500" />
              Central de Identidade & Nuvem
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-xs font-bold">
              <IconX className="w-4 h-4" />
            </button>
          </div>

          {/* Connected Accounts Status Card */}
          {(user || msUser) && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <IconShieldCheck className="w-5 h-5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-bold">Conta Ativa & Sincronizada</p>
                <p className="text-[10px] opacity-80">Documentos e chats salvos automaticamente no seu perfil do Google.</p>
              </div>
            </div>
          )}

          {/* Google Account Block */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2 0 10.04 0 12s.47 3.8 1.29 5.42l3.99-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Google Workspace
                    {user && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">Conectado</span>}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{user ? user.email : 'Google Drive & Docs'}</p>
                </div>
              </div>

              {user ? (
                <button
                  onClick={handleLogoutGoogle}
                  className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-xl text-[10px] font-bold transition-colors"
                >
                  Sair
                </button>
              ) : (
                <button
                  onClick={handleLoginGoogle}
                  disabled={isLoggingInGoogle}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                >
                  {isLoggingInGoogle ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconLogin className="w-3.5 h-3.5" />}
                  Entrar com Google
                </button>
              )}
            </div>

            {user && (
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <IconHardDrive className="w-3.5 h-3.5 text-indigo-500" />
                  Google Drive Cloud
                </span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                  {driveFiles.length} arquivos
                </span>
              </div>
            )}
          </div>

          {/* Microsoft Office 365 Account Block */}
          <div className="p-3.5 bg-amber-500/5 dark:bg-amber-950/20 rounded-2xl border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H1z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H1z" />
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Microsoft Office 365
                    {msUser && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">Vinculado</span>}
                  </h4>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate max-w-[150px]">{msUser ? msUser.email : 'OneDrive & Office Apps'}</p>
                </div>
              </div>

              {msUser ? (
                <button
                  onClick={handleLogoutMicrosoft}
                  className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-xl text-[10px] font-bold transition-colors"
                >
                  Sair
                </button>
              ) : (
                <button
                  onClick={handleLoginMicrosoft}
                  disabled={isLoggingInMs}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                >
                  {isLoggingInMs ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconLogin className="w-3.5 h-3.5" />}
                  Vincular Microsoft
                </button>
              )}
            </div>

            {msUser && (
              <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <IconCloud className="w-3.5 h-3.5 text-amber-600" />
                  OneDrive / Office 365
                </span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  {oneDriveFiles.length} docs
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center space-y-1">
            <p className="text-[10px] text-slate-400">
              Faça login com sua Conta do Google para sincronizar e salvar todos os seus chats e documentos na nuvem!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleProfileBadge;
