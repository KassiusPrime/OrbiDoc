import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconBrandGithub as GitHub,
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
  IconChevronDown as ChevronDown,
  IconCloud as Cloud,
  IconFolderCode as FolderCode,
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
import {
  getStoredGitHubUser,
  isGitHubAppConfigured,
  loginWithGitHubApp,
  logoutGitHubUser,
} from '../services/githubProjects';
import { forgetLinkedAccount, rememberLinkedAccount } from '../services/linkedAccounts';
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
  const [busy, setBusy] = useState<'google' | 'microsoft' | 'github' | null>(null);
  const [orbiUser, setOrbiUser] = useState<OrbiDocAuthUser | null>(null);
  const [githubUser, setGitHubUser] = useState(() => getStoredGitHubUser());
  const [mobileSheet, setMobileSheet] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentGoogle = user ?? googleUser ?? getStoredGoogleUser();
  const currentMicrosoft = msUser ?? getStoredMicrosoftUser();

  const updateGoogle = (value: GoogleUserProfile | null) => {
    onUserChange?.(value);
    setGoogleUser?.(value);
  };
  const updateMicrosoft = (value: MicrosoftUserProfile | null) => setMsUser?.(value);

  useEffect(() => subscribeToOrbiDocAuth(setOrbiUser), []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const sync = () => setMobileSheet(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open || !mobileSheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileSheet, open]);

  useEffect(() => {
    if (!currentGoogle) return;
    void rememberLinkedAccount('googleDrive', {
      accountId: currentGoogle.id,
      email: currentGoogle.email,
      displayName: currentGoogle.name,
      scopes: ['drive.file'],
    });
  }, [currentGoogle?.id]);

  useEffect(() => {
    if (!currentMicrosoft) return;
    void rememberLinkedAccount('microsoft', {
      accountId: currentMicrosoft.id,
      email: currentMicrosoft.email,
      displayName: currentMicrosoft.name,
      scopes: ['User.Read', 'Files.ReadWrite'],
    });
  }, [currentMicrosoft?.id]);

  useEffect(() => {
    if (!githubUser) return;
    void rememberLinkedAccount('github', {
      accountId: String(githubUser.id),
      email: githubUser.email,
      displayName: githubUser.name,
      login: githubUser.login,
      scopes: ['GitHub App installation permissions'],
    });
  }, [githubUser?.id]);

  const connectGoogle = async () => {
    setBusy('google');
    try {
      const profile = await loginWithGooglePopup();
      updateGoogle(profile);
      await rememberLinkedAccount('googleDrive', { accountId: profile.id, email: profile.email, displayName: profile.name, scopes: ['drive.file'] });
      notify(`Conta Google vinculada ao OrbiDoc: ${profile.email}`, 'success');
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
      await rememberLinkedAccount('microsoft', { accountId: profile.id, email: profile.email, displayName: profile.name, scopes: ['User.Read', 'Files.ReadWrite'] });
      notify(`Conta Microsoft vinculada ao OrbiDoc: ${profile.email}`, 'success');
    } catch (error: any) {
      notify(error?.message || 'Falha ao conectar Microsoft.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const connectGitHub = async () => {
    setBusy('github');
    try {
      const profile = await loginWithGitHubApp();
      setGitHubUser(profile);
      await rememberLinkedAccount('github', { accountId: String(profile.id), email: profile.email, displayName: profile.name, login: profile.login, scopes: ['GitHub App installation permissions'] });
      notify(`GitHub vinculado ao OrbiDoc: @${profile.login}`, 'success');
    } catch (error: any) {
      notify(error?.message || 'Falha ao conectar GitHub.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const disconnectGoogle = async () => {
    logoutGoogleUser();
    updateGoogle(null);
    await forgetLinkedAccount('googleDrive');
    notify('Conta Google desvinculada.', 'success');
  };

  const disconnectMicrosoft = async () => {
    logoutMicrosoftUser();
    updateMicrosoft(null);
    await forgetLinkedAccount('microsoft');
    notify('Conta Microsoft desvinculada.', 'success');
  };

  const disconnectGitHub = async () => {
    logoutGitHubUser();
    setGitHubUser(null);
    await forgetLinkedAccount('github');
    notify('GitHub desvinculado.', 'success');
  };

  const avatar = orbiUser?.photoURL || currentGoogle?.picture || currentMicrosoft?.picture || githubUser?.avatarUrl;
  const primaryName = orbiUser?.displayName || orbiUser?.email?.split('@')[0] || currentGoogle?.name || currentMicrosoft?.name || githubUser?.name;
  const connectedCount = Number(Boolean(currentGoogle)) + Number(Boolean(currentMicrosoft)) + Number(Boolean(githubUser));

  const accountPanel = (
    <div
      ref={panelRef}
      className={mobileSheet
        ? 'orbidoc-account-panel fixed left-3 right-3 top-[72px] bottom-[calc(86px+env(safe-area-inset-bottom))] z-[105] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-slate-900 dark:text-slate-100 shadow-2xl'
        : 'orbidoc-account-panel absolute right-0 top-12 z-[105] flex w-[410px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-80px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-slate-900 dark:text-slate-100 shadow-2xl'}
    >
      <div className="h-1 shrink-0 bg-gradient-to-r from-[#3157F6] via-[#22D3EE] to-[#6D5EF7]" />
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <OrbiDocLogo size="sm" />
            <div className="mt-3 flex items-center gap-1.5 text-xs font-black text-[#0B1220] dark:text-white"><ShieldCheck className="w-4 h-4 text-[#3157F6] dark:text-[#7AA2FF]" /> Conta e conexões</div>
            <div className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Google Drive, OneDrive e GitHub podem ser vinculados ao mesmo workspace OrbiDoc sem compartilhar tokens entre provedores.</div>
          </div>
          <button onClick={() => setOpen(false)} className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500" aria-label="Fechar conta e conexões"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
        <OrbiDocAuthPanel onNotification={notify} onUserChange={setOrbiUser} />

        <section>
          <div className="px-1 mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400"><PlugConnected className="w-3.5 h-3.5" /> Serviços externos vinculáveis</div>
          <div className="space-y-2">
            <AccountRow icon={<Google className="w-4 h-4" />} title="Google Drive" subtitle={currentGoogle ? currentGoogle.email : 'Acesso Drive somente após consentimento'} connected={Boolean(currentGoogle)} busy={busy === 'google'} onConnect={connectGoogle} onDisconnect={() => void disconnectGoogle()} />
            <AccountRow icon={<Microsoft className="w-4 h-4" />} title="OneDrive" subtitle={currentMicrosoft ? currentMicrosoft.email : isMicrosoftOAuthConfigured() ? 'Microsoft Graph / OneDrive' : 'Requer Client ID gratuito do Entra'} connected={Boolean(currentMicrosoft)} busy={busy === 'microsoft'} onConnect={connectMicrosoft} onDisconnect={() => void disconnectMicrosoft()} />
            <AccountRow
              icon={<GitHub className="w-4 h-4" />}
              title="GitHub Projects"
              subtitle={githubUser ? `@${githubUser.login} · acesso por GitHub App` : isGitHubAppConfigured() ? 'Escolha os repositórios que o OrbiDoc poderá acessar' : 'Requer GitHub App configurado'}
              connected={Boolean(githubUser)}
              busy={busy === 'github'}
              onConnect={connectGitHub}
              onDisconnect={() => void disconnectGitHub()}
              onOpen={githubUser ? () => { setOpen(false); window.dispatchEvent(new Event('orbidoc:open-github')); } : undefined}
            />
          </div>
        </section>
      </div>

      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#080D18]/55 text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2 shrink-0"><Cloud className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#008CA8] dark:text-[#22D3EE]" /><span><strong>Vínculo não significa acesso irrestrito.</strong> O OrbiDoc sincroniza apenas metadados não secretos do vínculo com o UID. Tokens ficam na sessão do dispositivo; GitHub respeita os repositórios escolhidos na instalação e as permissões reais do usuário.</span></div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button onClick={() => setOpen((value) => !value)} className="h-10 max-w-[210px] px-1.5 sm:px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#3157F6]/40 dark:hover:border-[#7AA2FF]/40 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2" aria-expanded={open} aria-label="Conta OrbiDoc e conexões externas">
        {avatar ? <img src={avatar} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : orbiUser ? <div className="w-7 h-7 rounded-lg bg-[#3157F6] text-white flex items-center justify-center text-[9px] font-black shrink-0">{initialsFor(orbiUser)}</div> : <div className="w-7 h-7 rounded-lg bg-[#EFF4FF] dark:bg-[#0D1E5B]/70 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-[#3157F6] dark:text-[#7AA2FF]" /></div>}
        <div className="orbidoc-account-trigger-copy min-w-0 hidden sm:block text-left"><div className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate">{primaryName || 'Conta'}</div><div className="text-[9px] text-slate-400 whitespace-nowrap">{orbiUser ? `Conta OrbiDoc · ${connectedCount} vínculo(s)` : connectedCount ? `${connectedCount} serviço(s)` : 'Modo local'}</div></div>
        <ChevronDown className="orbidoc-account-trigger-chevron w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
      </button>

      {open && (mobileSheet ? createPortal(<><button type="button" className="fixed inset-0 z-[104] bg-slate-950/45 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Fechar conta e conexões" />{accountPanel}</>, document.body) : accountPanel)}
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
  onOpen?: () => void;
}> = ({ icon, title, subtitle, connected, busy, onConnect, onDisconnect, onOpen }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 hover:border-[#3157F6]/25 dark:hover:border-[#7AA2FF]/25">
    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1"><div className="text-xs font-black flex items-center gap-1.5">{title}{connected && <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]" />}</div><div className="text-[9px] text-slate-400 truncate mt-0.5">{subtitle}</div></div>
    {connected ? <div className="flex items-center gap-1">{onOpen && <button onClick={onOpen} title={`Abrir ${title}`} className="w-8 h-8 shrink-0 rounded-lg hover:bg-[#3157F6]/10 text-[#3157F6] flex items-center justify-center"><FolderCode className="w-4 h-4" /></button>}<button onClick={onDisconnect} title={`Desconectar ${title}`} className="w-8 h-8 shrink-0 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 flex items-center justify-center"><LogOut className="w-4 h-4" /></button></div> : <button onClick={onConnect} disabled={busy} className="h-8 px-2.5 shrink-0 rounded-lg bg-[#3157F6] hover:bg-[#2446D8] text-white text-[9px] font-black disabled:opacity-50">{busy ? 'Abrindo…' : 'Conectar'}</button>}
  </div>
);
