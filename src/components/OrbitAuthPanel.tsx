import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle as AlertTriangle,
  IconAt as At,
  IconBrandGoogle as Google,
  IconCheck as Check,
  IconCloud as Cloud,
  IconDeviceMobile as DeviceMobile,
  IconLoader2 as Loader,
  IconLock as Lock,
  IconLogout as LogOut,
  IconMailCheck as MailCheck,
  IconRefresh as Refresh,
  IconTrash as Trash,
  IconUser as User,
  IconUserPlus as UserPlus,
} from '@tabler/icons-react';
import {
  createOrbiDocAccount,
  deleteOrbiDocAccountAndCloudData,
  getFriendlyAuthError,
  isOrbiDocAuthConfigured,
  type OrbiDocAuthUser,
  resendOrbiDocVerification,
  resetOrbiDocPassword,
  signInOrbiDocAccount,
  signOutOrbiDocAccount,
  subscribeToOrbiDocAuth,
} from '../services/firebase';
import {
  deleteOrbiDocGoogleAccountAndCloudData,
  isCurrentOrbiDocGoogleUser,
  signInOrbiDocWithGoogle,
} from '../services/firebaseGoogleAuth';
import {
  createLocalOrbiDocAccount,
  deleteLocalOrbiDocAccount,
  signInLocalOrbiDocAccount,
  signOutLocalOrbiDocAccount,
  subscribeToLocalOrbiDocAccount,
  type LocalOrbiDocAuthUser,
} from '../services/localAccount';
import {
  clearOrbiDocAuthCapabilityCache,
  type PasswordAuthState,
  probeOrbiDocPasswordAuth,
} from '../services/authCapabilities';
import { WorkspaceBackupControls } from './WorkspaceBackupControls';

interface OrbitAuthPanelProps {
  onNotification?: (message: string, type?: 'success' | 'error') => void;
  onUserChange?: (user: OrbiDocAuthUser | null) => void;
  showBackupControls?: boolean;
}

type Mode = 'signin' | 'signup';
type AccountRoute = 'cloud' | 'local';
type BusyAction = 'signin' | 'signup' | 'google' | 'reset' | 'verify' | 'logout' | 'delete' | 'probe' | null;
type ActiveUser = OrbiDocAuthUser | LocalOrbiDocAuthUser;

const Field: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, type = 'text', value, onChange, autoComplete, placeholder, icon: Icon }) => (
  <label className="block">
    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
    <div className="mt-1 relative">
      <Icon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09090B] text-[11px] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
      />
    </div>
  </label>
);

function initials(user: ActiveUser): string {
  const source = user.displayName || user.email || 'Orbit';
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OR';
}

export const OrbitAuthPanel: React.FC<OrbitAuthPanelProps> = ({
  onNotification = () => undefined,
  onUserChange,
  showBackupControls = true,
}) => {
  const [cloudUser, setCloudUser] = useState<OrbiDocAuthUser | null>(null);
  const [localUser, setLocalUser] = useState<LocalOrbiDocAuthUser | null>(null);
  const [route, setRoute] = useState<AccountRoute>('cloud');
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [inlineError, setInlineError] = useState('');
  const [passwordAuthState, setPasswordAuthState] = useState<PasswordAuthState>('checking');

  const configured = isOrbiDocAuthConfigured();
  const user: ActiveUser | null = cloudUser || localUser;
  const isLocal = Boolean(localUser && !cloudUser);
  const isGoogle = Boolean(cloudUser && isCurrentOrbiDocGoogleUser());

  useEffect(() => subscribeToOrbiDocAuth(setCloudUser), []);
  useEffect(() => subscribeToLocalOrbiDocAccount(setLocalUser), []);
  useEffect(() => { onUserChange?.(cloudUser); }, [cloudUser, onUserChange]);

  useEffect(() => {
    if (!configured) {
      setPasswordAuthState('unavailable');
      setRoute('local');
      return;
    }
    let active = true;
    void probeOrbiDocPasswordAuth().then((state) => {
      if (active) setPasswordAuthState(state);
    });
    return () => { active = false; };
  }, [configured]);

  const displayName = useMemo(() => user?.displayName || user?.email?.split('@')[0] || 'Conta Orbit', [user]);

  const run = async (
    action: Exclude<BusyAction, null>,
    operation: () => Promise<unknown> | unknown,
    success?: string,
  ): Promise<boolean> => {
    setBusy(action);
    setInlineError('');
    try {
      await operation();
      if (success) onNotification(success, 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : getFriendlyAuthError(error);
      setInlineError(message);
      onNotification(message, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const refreshProviderState = async (): Promise<void> => {
    setBusy('probe');
    setPasswordAuthState('checking');
    clearOrbiDocAuthCapabilityCache();
    try {
      const state = await probeOrbiDocPasswordAuth();
      setPasswordAuthState(state);
      onNotification(
        state === 'enabled'
          ? 'Login em nuvem por e-mail e senha está ativo.'
          : 'E-mail/senha ainda não está disponível; Google e conta local continuam independentes.',
        state === 'enabled' ? 'success' : 'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (mode === 'signup' && password !== confirmPassword) {
      setInlineError('As senhas não coincidem.');
      return;
    }

    if (route === 'local') {
      if (mode === 'signup') {
        await run('signup', () => createLocalOrbiDocAccount(name, email, password), 'Conta Orbit local criada neste aparelho.');
      } else {
        await run('signin', () => signInLocalOrbiDocAccount(email, password), 'Sessão local do Orbit iniciada.');
      }
      return;
    }

    if (passwordAuthState !== 'enabled') {
      setInlineError('E-mail/senha não está disponível agora. Entre com Google ou use uma conta local.');
      return;
    }

    if (mode === 'signup') {
      await run('signup', () => createOrbiDocAccount(name, email, password), 'Conta Orbit em nuvem criada. Verifique seu e-mail.');
    } else {
      await run('signin', () => signInOrbiDocAccount(email, password), 'Você entrou na sua Conta Orbit.');
    }
  };

  const resetPassword = async (): Promise<void> => {
    if (route === 'local') {
      setInlineError('A conta local não usa recuperação por e-mail. Exporte um backup antes de recriá-la.');
      return;
    }
    if (passwordAuthState !== 'enabled') {
      setInlineError('A recuperação depende do provedor e-mail/senha do Firebase.');
      return;
    }
    await run('reset', () => resetOrbiDocPassword(email), 'Se o endereço estiver cadastrado, as instruções de recuperação serão enviadas.');
  };

  const logout = async (): Promise<void> => {
    if (isLocal) await run('logout', signOutLocalOrbiDocAccount, 'Sessão local encerrada; arquivos do Orbispace foram preservados.');
    else await run('logout', signOutOrbiDocAccount, 'Sessão em nuvem encerrada; arquivos locais foram preservados.');
  };

  const deleteAccount = async (): Promise<void> => {
    if (deletePhrase.trim().toUpperCase() !== 'EXCLUIR') {
      setInlineError('Digite EXCLUIR para confirmar a exclusão permanente.');
      return;
    }

    const completed = isLocal
      ? await run('delete', () => deleteLocalOrbiDocAccount(deletePassword), 'Conta Orbit local removida deste aparelho; arquivos locais foram preservados.')
      : isGoogle
        ? await run('delete', deleteOrbiDocGoogleAccountAndCloudData, 'Conta Orbit vinculada ao Google e dados associados na nuvem foram excluídos.')
        : await run('delete', () => deleteOrbiDocAccountAndCloudData(deletePassword), 'Conta Orbit e dados associados na nuvem foram excluídos.');

    if (completed) {
      setDeleteOpen(false);
      setDeletePassword('');
      setDeletePhrase('');
    }
  };

  if (user) {
    return (
      <div className="space-y-3">
        <section className="rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/40 dark:bg-violet-950/15 p-3.5">
          <div className="flex items-start gap-3">
            {'photoURL' in user && user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-11 h-11 rounded-xl object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center text-xs font-black">{initials(user)}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-black">
                {isLocal ? <DeviceMobile className="w-4 h-4 text-violet-600" /> : isGoogle ? <Google className="w-4 h-4 text-violet-600" /> : <Cloud className="w-4 h-4 text-violet-600" />}
                {isLocal ? 'Conta Orbit local' : isGoogle ? 'Conta Orbit com Google' : 'Conta Orbit em nuvem'}
              </div>
              <div className="mt-1 text-[11px] font-black truncate">{displayName}</div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
            </div>
          </div>

          {!isLocal && 'emailVerified' in user ? (
            <div className={`mt-3 rounded-xl px-3 py-2 flex items-center gap-2 text-[9px] ${user.emailVerified ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'}`}>
              {user.emailVerified ? <Check className="w-3.5 h-3.5" /> : <MailCheck className="w-3.5 h-3.5" />}
              <span className="font-bold flex-1">{user.emailVerified ? 'E-mail verificado' : 'E-mail ainda não verificado'}</span>
              {!user.emailVerified ? <button type="button" disabled={busy === 'verify'} onClick={() => void run('verify', resendOrbiDocVerification, 'Novo e-mail de verificação solicitado.')} className="font-black underline disabled:opacity-50">Reenviar</button> : null}
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">{isLocal ? 'Esta identidade existe somente neste dispositivo.' : isGoogle ? 'Google autentica a Conta Orbit; o acesso ao Drive continua separado e opcional.' : 'Firebase mantém a identidade em nuvem vinculada ao Orbispace.'}</div>
            <button type="button" disabled={busy === 'logout'} onClick={() => void logout()} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-1.5 disabled:opacity-50"><LogOut className="w-3.5 h-3.5" /> Sair</button>
          </div>
        </section>

        {showBackupControls ? <WorkspaceBackupControls /> : null}

        <section className="rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/10 p-3.5">
          {!deleteOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center"><Trash className="w-4 h-4" /></div>
              <div className="min-w-0 flex-1"><div className="text-[10px] font-black text-rose-700 dark:text-rose-300">Excluir Conta Orbit</div><div className="mt-0.5 text-[8px] text-slate-500 dark:text-slate-400">A identidade é removida; projetos locais não são apagados automaticamente.</div></div>
              <button type="button" onClick={() => { setDeleteOpen(true); setInlineError(''); }} className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-800 text-[8px] font-black text-rose-600">Excluir</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div><div className="text-[10px] font-black">Esta ação é permanente</div><div className="mt-0.5 text-[8px]">Digite EXCLUIR. Contas que usam senha também precisam da senha atual.</div></div></div>
              {!isGoogle ? <Field label="Senha atual" type="password" value={deletePassword} onChange={setDeletePassword} autoComplete="current-password" icon={Lock} /> : null}
              <Field label="Confirmação" value={deletePhrase} onChange={setDeletePhrase} placeholder="EXCLUIR" icon={AlertTriangle} />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setDeleteOpen(false); setDeletePhrase(''); setDeletePassword(''); }} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Cancelar</button>
                <button type="button" disabled={busy === 'delete'} onClick={() => void deleteAccount()} className="h-9 px-3 rounded-xl bg-rose-600 text-white text-[9px] font-black disabled:opacity-50">{busy === 'delete' ? 'Excluindo…' : 'Excluir permanentemente'}</button>
              </div>
            </div>
          )}
        </section>
        {inlineError ? <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-[9px] font-semibold text-rose-700 dark:text-rose-300">{inlineError}</div> : null}
      </div>
    );
  }

  const cloudEnabled = configured && passwordAuthState === 'enabled';

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button type="button" onClick={() => setRoute('cloud')} className={`h-9 rounded-xl text-[9px] font-black ${route === 'cloud' ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-900' : 'border border-slate-200 dark:border-slate-700 text-slate-500'}`}><Cloud className="inline w-3.5 h-3.5 mr-1.5" /> Nuvem</button>
        <button type="button" onClick={() => setRoute('local')} className={`h-9 rounded-xl text-[9px] font-black ${route === 'local' ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-900' : 'border border-slate-200 dark:border-slate-700 text-slate-500'}`}><DeviceMobile className="inline w-3.5 h-3.5 mr-1.5" /> Local</button>
      </div>

      {route === 'cloud' ? (
        <button type="button" disabled={busy === 'google' || !configured} onClick={() => void run('google', signInOrbiDocWithGoogle, 'Você entrou na sua Conta Orbit com Google.')} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#09090B] text-[10px] font-black flex items-center justify-center gap-2 disabled:opacity-50"><Google className="w-4 h-4" /> Continuar com Google</button>
      ) : null}

      <div className="my-3 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /><span className="text-[8px] uppercase tracking-widest font-black text-slate-400">{route === 'cloud' ? 'ou e-mail' : 'conta deste aparelho'}</span><div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>

      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        {mode === 'signup' ? <Field label="Nome" value={name} onChange={setName} autoComplete="name" icon={User} /> : null}
        <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" icon={At} />
        <Field label="Senha" type="password" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} icon={Lock} />
        {mode === 'signup' ? <Field label="Confirmar senha" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" icon={Lock} /> : null}

        {inlineError ? <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-[9px] font-semibold text-rose-700 dark:text-rose-300">{inlineError}</div> : null}

        <button type="submit" disabled={busy === 'signin' || busy === 'signup' || (route === 'cloud' && !cloudEnabled)} className="w-full h-10 rounded-xl bg-[#7C3AED] hover:bg-violet-700 text-white text-[10px] font-black flex items-center justify-center gap-2 disabled:opacity-45">
          {busy === 'signin' || busy === 'signup' ? <Loader className="w-4 h-4 animate-spin" /> : mode === 'signup' ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          {mode === 'signup' ? 'Criar Conta Orbit' : 'Entrar'}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-2 text-[9px]">
        <button type="button" onClick={() => { setMode((current) => current === 'signin' ? 'signup' : 'signin'); setInlineError(''); }} className="font-black text-violet-700 dark:text-violet-300">{mode === 'signin' ? 'Criar conta' : 'Já tenho conta'}</button>
        {mode === 'signin' ? <button type="button" onClick={() => void resetPassword()} className="font-bold text-slate-500">Esqueci a senha</button> : null}
      </div>

      {route === 'cloud' && passwordAuthState !== 'enabled' ? (
        <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-[9px] leading-relaxed text-amber-800 dark:text-amber-200">
          E-mail/senha está {passwordAuthState === 'checking' ? 'sendo verificado' : 'indisponível'}. Google e conta local continuam disponíveis.
          <button type="button" disabled={busy === 'probe'} onClick={() => void refreshProviderState()} className="ml-2 font-black underline inline-flex items-center gap-1"><Refresh className={`w-3 h-3 ${busy === 'probe' ? 'animate-spin' : ''}`} /> Verificar</button>
        </div>
      ) : null}
    </div>
  );
};
