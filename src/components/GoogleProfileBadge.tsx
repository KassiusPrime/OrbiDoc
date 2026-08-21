import React, { useEffect, useRef, useState } from 'react';
import {
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
  IconChevronDown as ChevronDown,
  IconCloud as Cloud,
  IconLogout as LogOut,
  IconPlugConnected as PlugConnected,
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
import { OrbiDocAuthUser, subscribeToOrbiDocAuth } from '../services/firebase';
import { GoogleUserProfile, MicrosoftUserProfile } from '../types';
import { OrbiDocAuthPanel } from './OrbiDocAuthPanel';
import { OrbiDocLogo } from './OrbiDocLogo';

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

const initialsFor = (user: OrbiDocAuthUser) => {
  const source = user.displayName || user.email || 'OrbiDoc';
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OD';
};

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
  const [orbiUser, setOrbiUser] = useState<OrbiDocAuthUser | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentGoogle = user ?? googleUser ?? getStoredGoogleUser();
  const currentMicrosoft = msUser ?? getStoredMicrosoftUser();

  const updateGoogle = (value: GoogleUserProfile | null) => {
    onUserChange?.(value);
    setGoogleUser?.(value);
  };
  const updateMicrosoft = (value: MicrosoftUserProfile | null) => setMsUser?.(value);

  useEffect(() => subscribeToOrbiDocAuth(setOrbiUser), []);

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

  const avatar = orbiUser?.photoURL || currentGoogle?.picture || currentMicrosoft?.picture;
  const primaryName = orbiUser?.displayName || orbiUser?.email?.split('@')[0] || currentGoogle?.name || currentMicrosoft?.name;
  const connectedCount = Number(Boolean(currentGoogle)) + Number(Boolean(currentMicrosoft));

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="h-10 max-w-[210px] px-1.5 sm:px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#3157F6]/40 dark:hover:border-[#7AA2FF]/40 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
        aria-expanded={open}
        aria-label="Conta OrbiDoc e conexões externas"
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-7 h-7 rounded-lg object-cover" referrerPolicy="no-referrer" />
        ) : orbiUser ? (
          <div className="w-7 h-7 rounded-lg bg-[#3157F6] text-white flex items-center justify-center text-[9px] font-black">{initialsFor(orbiUser)}</div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-[#EFF4FF] dark:bg-[#0D1E5B]/70 flex items-center justify-center"><User className="w-4 h-4 text-[#3157F6] dark:text-[#7AA2FF]" /></div>
        )}
        <div className="min-w-0 hidden sm:block text-left">
          <div className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate">{primaryName || 'Conta'}</div>
          <div className="text-[9px] text-slate-400">{orbiUser ? 'Conta OrbiDoc' : connectedCount ? `${connectedCount} serviço(s)` : 'Modo local'}</div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[80] w-[min(390px,calc(100vw-24px))] max-h-[calc(100dvh-80px)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] shadow-2xl">
          <div className="h-1 sticky top-0 z-10 bg-gradient-to-r from-[#3157F6] via-[#22D3EE] to-[#6D5EF7]" />
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <OrbiDocLogo size="sm" />
                <div className="mt-3 flex items-center gap-1.5 text-xs font-black text-[#0B1220] dark:text-white"><ShieldCheck className="w-4 h-4 text-[#3157F6] dark:text-[#7AA2FF]" /> Conta e conexões</div>
                <div className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">A conta OrbiDoc usa e-mail e senha. Google e Microsoft ficam opcionais apenas para conectar serviços externos.</div>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500" aria-label="Fechar conta e conexões"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            <OrbiDocAuthPanel onNotification={notify} onUserChange={setOrbiUser} />

            <section>
              <div className="px-1 mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400"><PlugConnected className="w-3.5 h-3.5" /> Serviços externos opcionais</div>
              <div className="space-y-2">
                <AccountRow
                  icon={<Google className="w-4 h-4" />}
                  title="Google Drive"
                  subtitle={currentGoogle ? currentGoogle.email : 'Somente se você quiser acessar o Drive'}
                  connected={Boolean(currentGoogle)}
                  busy={busy === 'google'}
                  onConnect={connectGoogle}
                  onDisconnect={disconnectGoogle}
                />
                <AccountRow
                  icon={<Microsoft className="w-4 h-4" />}
                  title="OneDrive"
                  subtitle={currentMicrosoft ? currentMicrosoft.email : isMicrosoftOAuthConfigured() ? 'Microsoft Graph / OneDrive' : 'Opcional · requer Client ID do Entra'}
                  connected={Boolean(currentMicrosoft)}
                  busy={busy === 'microsoft'}
                  onConnect={connectMicrosoft}
                  onDisconnect={disconnectMicrosoft}
                />
              </div>
            </section>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#080D18]/55 text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2"><Cloud className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#008CA8] dark:text-[#22D3EE]" /><span><strong>Conta não significa upload automático.</strong> O workspace permanece local-first. Google Drive, OneDrive e futura sincronização OrbiDoc são recursos separados.</span></div>
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
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 hover:border-[#3157F6]/25 dark:hover:border-[#7AA2FF]/25">
    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">{icon}</div>
    <div className="min-w-0 flex-1"><div className="text-xs font-black flex items-center gap-1.5">{title}{connected && <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]" />}</div><div className="text-[9px] text-slate-400 truncate mt-0.5">{subtitle}</div></div>
    {connected ? <button onClick={onDisconnect} title={`Desconectar ${title}`} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center"><LogOut className="w-4 h-4" /></button> : <button onClick={onConnect} disabled={busy} className="h-8 px-2.5 rounded-lg bg-[#3157F6] hover:bg-[#2446D8] text-white text-[9px] font-black disabled:opacity-50">{busy ? 'Abrindo…' : 'Conectar'}</button>}
  </div>
);
