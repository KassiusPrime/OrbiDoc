import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconBrandGithub as GitHub,
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
  IconChevronDown as ChevronDown,
  IconCloud as Cloud,
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
import { type OrbiDocAuthUser, subscribeToOrbiDocAuth } from '../services/firebase';
import type { GoogleUserProfile, MicrosoftUserProfile } from '../types';
import { OrbiDocAuthPanel } from './OrbiDocAuthPanel';
import { OrbiDocLogo } from './OrbiDocLogo';

interface OrbitProfileBadgeProps {
  user?: GoogleUserProfile | null;
  onUserChange?: (user: GoogleUserProfile | null) => void;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onNotification?: (message: string, type?: 'success' | 'error') => void;
}

type BusyProvider = 'google' | 'microsoft' | 'github' | null;

type AccountRowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpen?: () => void;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function initials(name?: string | null, email?: string | null): string {
  const source = name || email?.split('@')[0] || 'Orbit';
  const value = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return value || 'OR';
}

const AccountRow: React.FC<AccountRowProps> = ({
  icon,
  title,
  subtitle,
  connected,
  busy,
  onConnect,
  onDisconnect,
  onOpen,
}) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#09090B] p-3 flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/45 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate">{title}</div>
      <div className="mt-0.5 text-[8px] leading-relaxed text-slate-400 truncate">{subtitle}</div>
    </div>
    {connected ? (
      <div className="flex items-center gap-1.5 shrink-0">
        {onOpen ? <button type="button" onClick={onOpen} className="h-8 px-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[8px] font-black">Abrir</button> : null}
        <button type="button" onClick={onDisconnect} disabled={busy} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[8px] font-black text-slate-500 disabled:opacity-40">Desvincular</button>
      </div>
    ) : (
      <button type="button" onClick={onConnect} disabled={busy} className="h-8 px-2.5 rounded-lg bg-[#7C3AED] text-white text-[8px] font-black disabled:opacity-40">{busy ? 'Conectando…' : 'Conectar'}</button>
    )}
  </div>
);

export const OrbitProfileBadge: React.FC<OrbitProfileBadgeProps> = ({
  user,
  onUserChange,
  msUser,
  setMsUser,
  onNotification = () => undefined,
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyProvider>(null);
  const [orbitUser, setOrbitUser] = useState<OrbiDocAuthUser | null>(null);
  const [githubUser, setGitHubUser] = useState(() => getStoredGitHubUser());
  const [mobileSheet, setMobileSheet] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentGoogle = user ?? getStoredGoogleUser();
  const currentMicrosoft = msUser ?? getStoredMicrosoftUser();

  useEffect(() => subscribeToOrbiDocAuth(setOrbitUser), []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const sync = (): void => setMobileSheet(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const closeOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open || !mobileSheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
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

  const connectGoogle = async (): Promise<void> => {
    setBusy('google');
    try {
      const profile = await loginWithGooglePopup();
      onUserChange?.(profile);
      await rememberLinkedAccount('googleDrive', { accountId: profile.id, email: profile.email, displayName: profile.name, scopes: ['drive.file'] });
      onNotification(`Google Drive vinculado à Conta Orbit: ${profile.email}`, 'success');
    } catch (error) {
      onNotification(errorMessage(error, 'Falha ao conectar Google Drive.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const connectMicrosoft = async (): Promise<void> => {
    setBusy('microsoft');
    try {
      const profile = await loginWithMicrosoftPopup();
      setMsUser?.(profile);
      await rememberLinkedAccount('microsoft', { accountId: profile.id, email: profile.email, displayName: profile.name, scopes: ['User.Read', 'Files.ReadWrite'] });
      onNotification(`OneDrive vinculado à Conta Orbit: ${profile.email}`, 'success');
    } catch (error) {
      onNotification(errorMessage(error, 'Falha ao conectar OneDrive.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const connectGitHub = async (): Promise<void> => {
    setBusy('github');
    try {
      const profile = await loginWithGitHubApp();
      setGitHubUser(profile);
      await rememberLinkedAccount('github', { accountId: String(profile.id), email: profile.email, displayName: profile.name, login: profile.login, scopes: ['GitHub App installation permissions'] });
      onNotification(`GitHub vinculado à Conta Orbit: @${profile.login}`, 'success');
    } catch (error) {
      onNotification(errorMessage(error, 'Falha ao conectar GitHub.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const disconnectGoogle = async (): Promise<void> => {
    logoutGoogleUser();
    onUserChange?.(null);
    await forgetLinkedAccount('googleDrive');
    onNotification('Google Drive desvinculado.', 'success');
  };

  const disconnectMicrosoft = async (): Promise<void> => {
    logoutMicrosoftUser();
    setMsUser?.(null);
    await forgetLinkedAccount('microsoft');
    onNotification('OneDrive desvinculado.', 'success');
  };

  const disconnectGitHub = async (): Promise<void> => {
    logoutGitHubUser();
    setGitHubUser(null);
    await forgetLinkedAccount('github');
    onNotification('GitHub desvinculado.', 'success');
  };

  const avatar = orbitUser?.photoURL || currentGoogle?.picture || currentMicrosoft?.picture || githubUser?.avatarUrl;
  const primaryName = orbitUser?.displayName || orbitUser?.email?.split('@')[0] || currentGoogle?.name || currentMicrosoft?.name || githubUser?.name;
  const primaryEmail = orbitUser?.email || currentGoogle?.email || currentMicrosoft?.email || githubUser?.email;
  const connectedCount = Number(Boolean(currentGoogle)) + Number(Boolean(currentMicrosoft)) + Number(Boolean(githubUser));

  useEffect(() => setAvatarFailed(false), [avatar]);

  const panel = (
    <div
      ref={panelRef}
      className={mobileSheet
        ? 'orbidoc-account-panel fixed left-3 right-3 top-[72px] bottom-[calc(86px+env(safe-area-inset-bottom))] z-[105] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11] shadow-2xl'
        : 'orbidoc-account-panel absolute right-0 top-12 z-[105] flex w-[410px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-80px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0F0F11] shadow-2xl'}
    >
      <div className="h-1 shrink-0 bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#22D3EE]" />
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-[#27272A] shrink-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <OrbiDocLogo size="sm" />
            <div className="mt-3 flex items-center gap-1.5 text-xs font-black"><ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-300" /> Conta Orbit</div>
            <div className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Sua identidade do Orbispace é separada das permissões concedidas a Google Drive, OneDrive e GitHub.</div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500" aria-label="Fechar conta e conexões"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
        <OrbiDocAuthPanel onNotification={onNotification} onUserChange={setOrbitUser} />
        <section>
          <div className="px-1 mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400"><PlugConnected className="w-3.5 h-3.5" /> Conexões externas</div>
          <div className="space-y-2">
            <AccountRow icon={<Google className="w-4 h-4" />} title="Google Drive" subtitle={currentGoogle ? currentGoogle.email : 'drive.file somente após consentimento'} connected={Boolean(currentGoogle)} busy={busy === 'google'} onConnect={() => void connectGoogle()} onDisconnect={() => void disconnectGoogle()} />
            <AccountRow icon={<Microsoft className="w-4 h-4" />} title="OneDrive" subtitle={currentMicrosoft ? currentMicrosoft.email : isMicrosoftOAuthConfigured() ? 'Microsoft Graph / Files.ReadWrite' : 'Client ID do Entra ainda não configurado'} connected={Boolean(currentMicrosoft)} busy={busy === 'microsoft'} onConnect={() => void connectMicrosoft()} onDisconnect={() => void disconnectMicrosoft()} />
            <AccountRow icon={<GitHub className="w-4 h-4" />} title="GitHub Projects" subtitle={githubUser ? `@${githubUser.login} · GitHub App` : isGitHubAppConfigured() ? 'Escolha os repositórios permitidos na instalação' : 'GitHub App ainda não configurado'} connected={Boolean(githubUser)} busy={busy === 'github'} onConnect={() => void connectGitHub()} onDisconnect={() => void disconnectGitHub()} onOpen={githubUser ? () => { setOpen(false); window.dispatchEvent(new Event('orbidoc:open-github')); } : undefined} />
          </div>
        </section>
      </div>

      <div className="px-4 py-3 border-t border-slate-100 dark:border-[#27272A] bg-slate-50 dark:bg-[#09090B] text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2 shrink-0"><Cloud className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-600" /><span><strong>Vínculo não significa acesso irrestrito.</strong> Orbit sincroniza metadados não secretos do vínculo; tokens de terceiros permanecem fora dos documentos e do Nexus AI.</span></div>
    </div>
  );

  const avatarLabel = useMemo(() => initials(primaryName, primaryEmail), [primaryName, primaryEmail]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-10 max-w-[210px] px-1.5 sm:px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F0F11] hover:border-violet-400/50 flex items-center gap-2"
        aria-expanded={open}
        aria-label="Conta Orbit e conexões externas"
      >
        {avatar && !avatarFailed ? (
          <img src={avatar} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
        ) : primaryName || primaryEmail ? (
          <div className="w-7 h-7 rounded-lg bg-[#7C3AED] text-white flex items-center justify-center text-[9px] font-black shrink-0">{avatarLabel}</div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-violet-700 dark:text-violet-300" /></div>
        )}
        <div className="orbidoc-account-trigger-copy min-w-0 hidden sm:block text-left">
          <div className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate">{primaryName || 'Conta Orbit'}</div>
          <div className="text-[9px] text-slate-400 whitespace-nowrap">{orbitUser ? `Orbispace · ${connectedCount} vínculo(s)` : connectedCount ? `${connectedCount} serviço(s)` : 'Modo local'}</div>
        </div>
        <ChevronDown className="orbidoc-account-trigger-chevron w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
      </button>

      {open && (mobileSheet
        ? createPortal(<><button type="button" className="fixed inset-0 z-[104] bg-slate-950/45 backdrop-blur-sm" aria-label="Fechar conta e conexões" onClick={() => setOpen(false)} />{panel}</>, document.body)
        : panel)}
    </div>
  );
};
