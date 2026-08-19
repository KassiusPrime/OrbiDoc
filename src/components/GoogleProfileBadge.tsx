import React, { useEffect, useRef, useState } from 'react';
import {
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
  IconChevronDown as ChevronDown,
  IconCloud as Cloud,
  IconLogout as LogOut,
  IconShieldCheck as ShieldCheck,
  IconUser as User,
  IconX as X,
} from '@tabler/icons-react';
import {
  getStoredGoogleUser,
  loginWithGooglePopup,
  logoutGoogleUser,
} from '../services/googleAuthDrive';
import {
  getStoredMicrosoftUser,
  isMicrosoftOAuthConfigured,
  loginWithMicrosoftPopup,
  logoutMicrosoftUser,
} from '../services/microsoftAuthOffice';
import { GoogleUserProfile, MicrosoftUserProfile } from '../types';

interface GoogleProfileBadgeProps {
  user?: GoogleUserProfile | null;
  onUserChange?: (user: GoogleUserProfile | null) => void;
  googleUser?: GoogleUserProfile | null;
  setGoogleUser?: React.Dispatch<React.SetStateAction<GoogleUserProfile | null>>;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onNotification?: (message: string, type?: 'success' | 'error') => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

export const GoogleProfileBadge: React.FC<GoogleProfileBadgeProps> = ({
  user,
  onUserChange,
  googleUser,
  setGoogleUser,
  msUser,
  setMsUser,
  onNotification,
  showNotification,
}) => {
  const notify = onNotification || showNotification || (() => {});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'google' | 'microsoft' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentGoogle = user ?? googleUser ?? getStoredGoogleUser();
  const currentMicrosoft = msUser ?? getStoredMicrosoftUser();

  const updateGoogle = (value: GoogleUserProfile | null) => {
    onUserChange?.(value);
    setGoogleUser?.(value);
  };
  const updateMicrosoft = (value: MicrosoftUserProfile | null) => setMsUser?.(value);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const connectGoogle = async () => {
    setBusy('google');
    try {
      const profile = await loginWithGooglePopup();
      updateGoogle(profile);
      notify(`Conta Google conectada: ${profile.email}`, 'success');
    } catch (error: any) {
      notify(error?.message || 'Falha ao conectar Google.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const connectMicrosoft = async () => {
    setBusy('microsoft');
    try {
      const profile = await loginWithMicrosoftPopup();
      updateMicrosoft(profile);
      notify(`Conta Microsoft conectada: ${profile.email}`, 'success');
    } catch (error: any) {
      notify(error?.message || 'Falha ao conectar Microsoft.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const disconnectGoogle = () => {
    logoutGoogleUser();
    updateGoogle(null);
    notify('Conta Google desconectada.', 'success');
  };

  const disconnectMicrosoft = () => {
    logoutMicrosoftUser();
    updateMicrosoft(null);
    notify('Conta Microsoft desconectada.', 'success');
  };

  const avatar = currentGoogle?.picture || currentMicrosoft?.picture;
  const primaryName = currentGoogle?.name || currentMicrosoft?.name;
  const connectedCount = Number(Boolean(currentGoogle)) + Number(Boolean(currentMicrosoft));

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="h-10 max-w-[190px] px-1.5 sm:px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
        aria-expanded={open}
        aria-label="Central de contas"
      >
        {avatar ? <img src={avatar} alt="" className="w-7 h-7 rounded-lg object-cover" referrerPolicy="no-referrer" /> : <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><User className="w-4 h-4 text-slate-500" /></div>}
        <div className="min-w-0 hidden sm:block text-left"><div className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate">{primaryName || 'Contas'}</div><div className="text-[9px] text-slate-400">{connectedCount ? `${connectedCount} conectada(s)` : 'Modo local'}</div></div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[80] w-[min(340px,calc(100vw-24px))] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" /><div className="flex-1"><div className="text-xs font-black">Central de contas</div><div className="text-[9px] text-slate-400">Autenticação e acesso à nuvem são opcionais.</div></div><button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button></div>

          <div className="p-3 space-y-2">
            <AccountRow
              icon={<Google className="w-4 h-4" />}
              title="Google"
              subtitle={currentGoogle ? currentGoogle.email : 'Google Drive e perfil'}
              connected={Boolean(currentGoogle)}
              busy={busy === 'google'}
              onConnect={connectGoogle}
              onDisconnect={disconnectGoogle}
            />
            <AccountRow
              icon={<Microsoft className="w-4 h-4" />}
              title="Microsoft"
              subtitle={currentMicrosoft ? currentMicrosoft.email : isMicrosoftOAuthConfigured() ? 'OneDrive e Microsoft Graph' : 'Requer Client ID do Entra'}
              connected={Boolean(currentMicrosoft)}
              busy={busy === 'microsoft'}
              onConnect={connectMicrosoft}
              onDisconnect={disconnectMicrosoft}
            />
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2"><Cloud className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><strong>Conectado não significa sincronizado.</strong> O OrbiDoc mantém a biblioteca local separada. A página Nuvem mostra somente os arquivos que Google Drive ou OneDrive retornarem pelas APIs.</span></div>
        </div>
      )}
    </div>
  );
};

const AccountRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}> = ({ icon, title, subtitle, connected, busy, onConnect, onDisconnect }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">{icon}</div>
    <div className="min-w-0 flex-1"><div className="text-xs font-black flex items-center gap-1.5">{title}{connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}</div><div className="text-[9px] text-slate-400 truncate mt-0.5">{subtitle}</div></div>
    {connected ? <button onClick={onDisconnect} title={`Desconectar ${title}`} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center"><LogOut className="w-4 h-4" /></button> : <button onClick={onConnect} disabled={busy} className="h-8 px-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] font-black disabled:opacity-50">{busy ? 'Abrindo…' : 'Conectar'}</button>}
  </div>
);
