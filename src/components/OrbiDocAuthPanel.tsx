import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle as AlertTriangle,
  IconAt as At,
  IconCheck as Check,
  IconCloud as Cloud,
  IconDeviceMobile as DeviceMobile,
  IconKey as Key,
  IconLoader2 as Loader,
  IconLock as Lock,
  IconLogout as LogOut,
  IconMailCheck as MailCheck,
  IconRefresh as Refresh,
  IconShieldCheck as ShieldCheck,
  IconTrash as Trash,
  IconUser as User,
  IconUserPlus as UserPlus,
} from '@tabler/icons-react';
import {
  createOrbiDocAccount,
  deleteOrbiDocAccountAndCloudData,
  getFriendlyAuthError,
  isOrbiDocAuthConfigured,
  OrbiDocAuthUser,
  resendOrbiDocVerification,
  resetOrbiDocPassword,
  signInOrbiDocAccount,
  signOutOrbiDocAccount,
  subscribeToOrbiDocAuth,
} from '../services/firebase';
import {
  createLocalOrbiDocAccount,
  deleteLocalOrbiDocAccount,
  hasLocalOrbiDocAccount,
  signInLocalOrbiDocAccount,
  signOutLocalOrbiDocAccount,
  subscribeToLocalOrbiDocAccount,
  type LocalOrbiDocAuthUser,
} from '../services/localAccount';
import {
  clearOrbiDocAuthCapabilityCache,
  PasswordAuthState,
  probeOrbiDocPasswordAuth,
} from '../services/authCapabilities';
import { WorkspaceBackupControls } from './WorkspaceBackupControls';

interface OrbiDocAuthPanelProps {
  onNotification?: (message: string, type?: 'success' | 'error') => void;
  onUserChange?: (user: OrbiDocAuthUser | null) => void;
}

type Mode = 'signin' | 'signup';
type AccountRoute = 'cloud' | 'local';
type BusyAction = 'signin' | 'signup' | 'reset' | 'verify' | 'logout' | 'delete' | 'probe' | null;

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
        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] outline-none focus:border-[#3157F6] focus:ring-2 focus:ring-[#3157F6]/10"
      />
    </div>
  </label>
);

const initialsFor = (user: OrbiDocAuthUser) => {
  const source = user.displayName || user.email || 'OrbiDoc';
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OD';
};

export const OrbiDocAuthPanel: React.FC<OrbiDocAuthPanelProps> = ({ onNotification = () => {}, onUserChange }) => {
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
  const user = cloudUser || localUser;
  const isLocal = Boolean(user && (user as LocalOrbiDocAuthUser).source === 'local');

  useEffect(() => subscribeToOrbiDocAuth(setCloudUser), []);
  useEffect(() => subscribeToLocalOrbiDocAccount(setLocalUser), []);
  useEffect(() => { onUserChange?.(user); }, [user, onUserChange]);

  useEffect(() => {
    if (!configured) {
      setPasswordAuthState('unavailable');
      setRoute('local');
      return;
    }
    let active = true;
    void probeOrbiDocPasswordAuth().then((state) => {
      if (!active) return;
      setPasswordAuthState(state);
      if (state !== 'enabled') setRoute('local');
    });
    return () => { active = false; };
  }, [configured]);

  const displayName = useMemo(() => user?.displayName || user?.email?.split('@')[0] || 'Conta OrbiDoc', [user]);

  const run = async (action: Exclude<BusyAction, null>, operation: () => Promise<unknown> | unknown, success?: string) => {
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

  const refreshProviderState = async () => {
    setBusy('probe');
    setPasswordAuthState('checking');
    clearOrbiDocAuthCapabilityCache();
    const state = await probeOrbiDocPasswordAuth();
    setPasswordAuthState(state);
    setBusy(null);
    if (state === 'enabled') {
      setRoute('cloud');
      onNotification('Login em nuvem por e-mail e senha está ativo.', 'success');
    } else if (state === 'disabled') onNotification('O Firebase ainda mantém e-mail/senha desativado. A conta local continua disponível.', 'error');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'signup' && password !== confirmPassword) {
      setInlineError('As senhas não coincidem.');
      return;
    }

    if (route === 'local') {
      if (mode === 'signup') {
        await run('signup', () => createLocalOrbiDocAccount(name, email, password), 'Conta local criada e vinculada a este aparelho.');
      } else {
        await run('signin', () => signInLocalOrbiDocAccount(email, password), 'Você entrou na conta local deste aparelho.');
      }
      return;
    }

    if (passwordAuthState !== 'enabled') {
      setInlineError('O Firebase ainda não habilitou e-mail/senha. Use a conta local ou atualize o status.');
      return;
    }
    if (mode === 'signup') await run('signup', () => createOrbiDocAccount(name, email, password), 'Conta em nuvem criada.');
    else await run('signin', () => signInOrbiDocAccount(email, password), 'Você entrou na sua conta OrbiDoc em nuvem.');
  };

  const resetPassword = async () => {
    if (route === 'local') {
      setInlineError('Conta local não usa recuperação por e-mail. Se ainda estiver logado, exporte um backup antes de excluir/recriar a conta.');
      return;
    }
    if (passwordAuthState !== 'enabled') {
      setInlineError('A recuperação de senha ficará disponível quando e-mail/senha estiver ativo no Firebase.');
      return;
    }
    await run('reset', () => resetOrbiDocPassword(email), 'Se o endereço estiver cadastrado, o Firebase enviará instruções de recuperação.');
  };

  const logout = async () => {
    if (isLocal) await run('logout', signOutLocalOrbiDocAccount, 'Sessão local encerrada. Seus arquivos permaneceram no aparelho.');
    else await run('logout', signOutOrbiDocAccount, 'Sessão em nuvem encerrada. Seus arquivos locais permaneceram no aparelho.');
  };

  const deleteAccount = async () => {
    if (deletePhrase.trim().toUpperCase() !== 'EXCLUIR') {
      setInlineError('Digite EXCLUIR para confirmar a exclusão permanente.');
      return;
    }
    const completed = isLocal
      ? await run('delete', () => deleteLocalOrbiDocAccount(deletePassword), 'Conta local removida deste aparelho. Os arquivos do workspace não foram apagados.')
      : await run('delete', () => deleteOrbiDocAccountAndCloudData(deletePassword), 'Conta OrbiDoc e dados associados na nuvem foram excluídos. Projetos locais foram preservados.');
    if (completed) {
      setDeleteOpen(false);
      setDeletePassword('');
      setDeletePhrase('');
    }
  };

  if (user) {
    return (
      <div className="space-y-3">
        <section className="rounded-2xl border border-[#3157F6]/20 dark:border-[#7AA2FF]/20 bg-[#F7F9FC] dark:bg-[#080D18]/60 p-3.5">
          <div className="flex items-start gap-3">
            {user.photoURL ? <img src={user.photoURL} alt="" className="w-11 h-11 rounded-xl object-cover" /> : <div className="w-11 h-11 rounded-xl bg-[#3157F6] text-white flex items-center justify-center text-xs font-black">{initialsFor(user)}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">{isLocal ? <DeviceMobile className="w-4 h-4 text-[#3157F6]" /> : <Cloud className="w-4 h-4 text-[#3157F6]" />} {isLocal ? 'Conta local OrbiDoc' : 'Conta OrbiDoc em nuvem'}</div>
              <div className="mt-1 text-[11px] font-black truncate">{displayName}</div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
            </div>
          </div>

          {isLocal ? (
            <div className="mt-3 rounded-xl px-3 py-2 bg-cyan-50 dark:bg-cyan-950/25 text-cyan-800 dark:text-cyan-200 text-[9px] leading-relaxed"><strong>Vinculada a este aparelho.</strong> A senha é verificada localmente com PBKDF2/SHA-256 + salt aleatório. Esta identidade não sincroniza entre dispositivos nem envia credenciais para um servidor.</div>
          ) : !user.isAnonymous ? (
            <div className={`mt-3 rounded-xl px-3 py-2 flex items-center gap-2 text-[9px] ${user.emailVerified ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'}`}>
              {user.emailVerified ? <Check className="w-3.5 h-3.5" /> : <MailCheck className="w-3.5 h-3.5" />}
              <span className="font-bold flex-1">{user.emailVerified ? 'E-mail verificado' : 'E-mail ainda não verificado'}</span>
              {!user.emailVerified && <button disabled={busy === 'verify'} onClick={() => void run('verify', resendOrbiDocVerification, 'Novo e-mail de verificação solicitado.')} className="font-black underline disabled:opacity-50">Reenviar</button>}
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">{isLocal ? 'A sessão local permanece ativa neste dispositivo até você sair.' : 'A sessão Firebase permanece neste dispositivo e pode vincular perfil/preferências ao UID.'}</div>
            <button disabled={busy === 'logout'} onClick={() => void logout()} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-1.5 disabled:opacity-50"><LogOut className="w-3.5 h-3.5" /> Sair</button>
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/10 p-3.5">
          {!deleteOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center"><Trash className="w-4 h-4" /></div>
              <div className="min-w-0 flex-1"><div className="text-[10px] font-black text-rose-700 dark:text-rose-300">{isLocal ? 'Excluir conta local' : 'Excluir conta e dados da nuvem'}</div><div className="mt-0.5 text-[8px] text-slate-500 dark:text-slate-400">{isLocal ? 'Remove a identidade e hash de senha deste aparelho. Não apaga automaticamente os arquivos locais.' : 'Remove a identidade Firebase e os registros de nuvem associados.'}</div></div>
              <button onClick={() => { setDeleteOpen(true); setInlineError(''); }} className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-800 text-[8px] font-black text-rose-600">Excluir</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div><div className="text-[10px] font-black">Esta ação é permanente</div><div className="mt-1 text-[8px] text-slate-600 dark:text-slate-400">Os projetos existentes somente no workspace local são preservados.</div></div></div>
              <Field label={isLocal ? 'Senha local' : 'Senha atual'} type="password" value={deletePassword} onChange={setDeletePassword} autoComplete="current-password" placeholder="Confirme sua senha" icon={Lock} />
              <Field label="Digite EXCLUIR" value={deletePhrase} onChange={setDeletePhrase} autoComplete="off" placeholder="EXCLUIR" icon={Trash} />
              {inlineError && <div className="rounded-xl bg-rose-100/70 dark:bg-rose-950/30 px-3 py-2 text-[9px] font-semibold text-rose-700 dark:text-rose-300">{inlineError}</div>}
              <div className="grid grid-cols-2 gap-2"><button onClick={() => { setDeleteOpen(false); setInlineError(''); }} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Cancelar</button><button disabled={busy === 'delete' || !deletePassword || deletePhrase.trim().toUpperCase() !== 'EXCLUIR'} onClick={() => void deleteAccount()} className="h-9 rounded-xl bg-rose-600 text-white text-[9px] font-black disabled:opacity-40">{busy === 'delete' ? 'Excluindo…' : 'Excluir permanentemente'}</button></div>
            </div>
          )}
        </section>

        <WorkspaceBackupControls onNotification={onNotification} />
      </div>
    );
  }

  const cloudEnabled = configured && passwordAuthState === 'enabled';
  const localExists = hasLocalOrbiDocAccount();

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#3157F6]/20 dark:border-[#7AA2FF]/20 bg-[#F7F9FC] dark:bg-[#080D18]/60 p-3.5">
        <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/70 flex items-center justify-center"><User className="w-5 h-5 text-[#3157F6]" /></div><div className="min-w-0 flex-1"><div className="text-xs font-black">Conta OrbiDoc</div><div className="mt-0.5 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Entre em nuvem quando o Firebase permitir ou use uma conta local segura e gratuita neste aparelho.</div></div></div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
          <button type="button" onClick={() => { setRoute('cloud'); setInlineError(''); }} className={`h-9 rounded-lg text-[9px] font-black inline-flex items-center justify-center gap-1.5 ${route === 'cloud' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6]' : 'text-slate-500'}`}><Cloud className="w-3.5 h-3.5" /> Nuvem</button>
          <button type="button" onClick={() => { setRoute('local'); setInlineError(''); }} className={`h-9 rounded-lg text-[9px] font-black inline-flex items-center justify-center gap-1.5 ${route === 'local' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6]' : 'text-slate-500'}`}><DeviceMobile className="w-3.5 h-3.5" /> Local</button>
        </div>

        {route === 'cloud' && !cloudEnabled && (
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/25 p-3 text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><div className="text-[10px] font-black">{passwordAuthState === 'checking' ? 'Verificando Firebase…' : passwordAuthState === 'disabled' ? 'E-mail/senha desativados no Firebase' : 'Firebase indisponível agora'}</div><p className="mt-1 text-[9px] leading-relaxed">{passwordAuthState === 'disabled' ? 'O backend responde PASSWORD_LOGIN_DISABLED. Isso exige ativação administrativa no Firebase Console. Enquanto isso, a conta local funciona normalmente.' : 'O modo local não depende do Firebase e continua disponível.'}</p></div></div>
            <button disabled={busy === 'probe'} onClick={() => void refreshProviderState()} className="mt-2 h-8 px-3 rounded-lg border border-amber-300 dark:border-amber-800 text-[9px] font-black inline-flex items-center gap-1.5 disabled:opacity-50">{busy === 'probe' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Refresh className="w-3.5 h-3.5" />} Atualizar status</button>
          </div>
        )}

        {route === 'local' && (
          <div className="mt-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/25 border border-cyan-200 dark:border-cyan-900 p-3 text-[9px] leading-relaxed text-cyan-800 dark:text-cyan-200"><strong>Conta local:</strong> funciona offline, fica vinculada somente a este aparelho e armazena apenas salt + hash PBKDF2/SHA-256. Não é uma conta de nuvem e não sincroniza documentos.</div>
        )}

        {(route === 'local' || cloudEnabled) && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
              <button type="button" onClick={() => { setMode('signin'); setInlineError(''); }} className={`h-8 rounded-lg text-[9px] font-black ${mode === 'signin' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6]' : 'text-slate-500'}`}>Entrar</button>
              <button type="button" onClick={() => { setMode('signup'); setInlineError(''); }} className={`h-8 rounded-lg text-[9px] font-black ${mode === 'signup' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6]' : 'text-slate-500'}`}>{route === 'local' && localExists ? 'Conta já criada' : 'Criar conta'}</button>
            </div>

            <form onSubmit={(event) => void submit(event)} className="mt-3 space-y-2.5">
              {mode === 'signup' && <Field label="Nome" value={name} onChange={setName} autoComplete="name" placeholder="Seu nome" icon={UserPlus} />}
              <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="voce@exemplo.com" icon={At} />
              <Field label="Senha" type="password" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'Mínimo de 8 caracteres' : 'Sua senha'} icon={Lock} />
              {mode === 'signup' && <Field label="Confirmar senha" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Repita a senha" icon={Key} />}
              {inlineError && <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-[9px] font-semibold text-rose-700 dark:text-rose-300">{inlineError}</div>}
              <button disabled={Boolean(busy) || (route === 'local' && mode === 'signup' && localExists)} type="submit" className="w-full h-10 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center justify-center gap-2 disabled:opacity-50">{busy === 'signin' || busy === 'signup' ? <Loader className="w-4 h-4 animate-spin" /> : mode === 'signup' ? <UserPlus className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}{mode === 'signup' ? (route === 'local' ? 'Criar conta local' : 'Criar conta em nuvem') : (route === 'local' ? 'Entrar neste aparelho' : 'Entrar no OrbiDoc')}</button>
            </form>
            {mode === 'signin' && <button type="button" disabled={busy === 'reset'} onClick={() => void resetPassword()} className="mt-2 w-full h-8 text-[9px] font-bold text-[#3157F6] hover:underline disabled:opacity-50">{route === 'local' ? 'Como funciona a senha local?' : 'Esqueci minha senha'}</button>}
          </>
        )}

        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-start gap-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><MailCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#008CA8]" /><span>Conta, backup/sync e serviços externos são separados. Entrar nunca envia automaticamente seus projetos locais.</span></div>
      </section>
      <WorkspaceBackupControls onNotification={onNotification} />
    </div>
  );
};