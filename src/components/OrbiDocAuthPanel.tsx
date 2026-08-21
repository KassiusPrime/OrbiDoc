import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAt as At,
  IconCheck as Check,
  IconKey as Key,
  IconLoader2 as Loader,
  IconLock as Lock,
  IconLogout as LogOut,
  IconMailCheck as MailCheck,
  IconShieldCheck as ShieldCheck,
  IconUser as User,
  IconUserPlus as UserPlus,
} from '@tabler/icons-react';
import {
  createOrbiDocAccount,
  getFriendlyAuthError,
  isOrbiDocAuthConfigured,
  OrbiDocAuthUser,
  resendOrbiDocVerification,
  resetOrbiDocPassword,
  signInOrbiDocAccount,
  signOutOrbiDocAccount,
  subscribeToOrbiDocAuth,
} from '../services/firebase';
import { WorkspaceBackupControls } from './WorkspaceBackupControls';

interface OrbiDocAuthPanelProps {
  onNotification?: (message: string, type?: 'success' | 'error') => void;
  onUserChange?: (user: OrbiDocAuthUser | null) => void;
}

type Mode = 'signin' | 'signup';
type BusyAction = 'signin' | 'signup' | 'reset' | 'verify' | 'logout' | null;

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
        className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] outline-none focus:border-[#3157F6] focus:ring-2 focus:ring-[#3157F6]/10"
      />
    </div>
  </label>
);

const initialsFor = (user: OrbiDocAuthUser) => {
  const source = user.displayName || user.email || 'OrbiDoc';
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OD';
};

export const OrbiDocAuthPanel: React.FC<OrbiDocAuthPanelProps> = ({ onNotification = () => {}, onUserChange }) => {
  const [user, setUser] = useState<OrbiDocAuthUser | null>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [inlineError, setInlineError] = useState('');
  const configured = isOrbiDocAuthConfigured();

  useEffect(() => subscribeToOrbiDocAuth((next) => {
    setUser(next);
    onUserChange?.(next);
  }), [onUserChange]);

  const displayName = useMemo(() => user?.displayName || user?.email?.split('@')[0] || (user?.isAnonymous ? 'Convidado' : 'Conta OrbiDoc'), [user]);

  const run = async (action: Exclude<BusyAction, null>, operation: () => Promise<unknown>, success?: string) => {
    setBusy(action);
    setInlineError('');
    try {
      await operation();
      if (success) onNotification(success, 'success');
    } catch (error) {
      const message = getFriendlyAuthError(error);
      setInlineError(message);
      onNotification(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setInlineError('As senhas não coincidem.');
        return;
      }
      await run('signup', () => createOrbiDocAccount(name, email, password), 'Conta criada. Enviamos um e-mail de verificação quando o provedor permite.');
      return;
    }
    await run('signin', () => signInOrbiDocAccount(email, password), 'Você entrou na sua conta OrbiDoc.');
  };

  const resetPassword = async () => {
    await run('reset', () => resetOrbiDocPassword(email), 'Se o endereço estiver cadastrado, o Firebase enviará as instruções de recuperação.');
  };

  if (user) {
    return (
      <div className="space-y-3">
        <section className="rounded-2xl border border-[#3157F6]/20 dark:border-[#7AA2FF]/20 bg-[#F7F9FC] dark:bg-[#080D18]/60 p-3.5">
          <div className="flex items-start gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-11 h-11 rounded-xl object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-[#3157F6] text-white flex items-center justify-center text-xs font-black">{initialsFor(user)}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white"><ShieldCheck className="w-4 h-4 text-[#3157F6] dark:text-[#7AA2FF]" /> Conta OrbiDoc</div>
              <div className="mt-1 text-[11px] font-black truncate">{displayName}</div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{user.email || 'Sessão temporária'}</div>
            </div>
          </div>

          {!user.isAnonymous && (
            <div className={`mt-3 rounded-xl px-3 py-2 flex items-center gap-2 text-[9px] ${user.emailVerified ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'}`}>
              {user.emailVerified ? <Check className="w-3.5 h-3.5" /> : <MailCheck className="w-3.5 h-3.5" />}
              <span className="font-bold flex-1">{user.emailVerified ? 'E-mail verificado' : 'E-mail ainda não verificado'}</span>
              {!user.emailVerified && <button disabled={busy === 'verify'} onClick={() => void run('verify', resendOrbiDocVerification, 'Novo e-mail de verificação solicitado.')} className="font-black underline disabled:opacity-50">Reenviar</button>}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Sua conta identifica você no OrbiDoc. Os arquivos continuam locais até você ativar uma sincronização.</div>
            <button disabled={busy === 'logout'} onClick={() => void run('logout', signOutOrbiDocAccount, 'Sessão encerrada. Seus arquivos locais permaneceram neste dispositivo.')} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><LogOut className="w-3.5 h-3.5" /> Sair</button>
          </div>
        </section>
        <WorkspaceBackupControls onNotification={onNotification} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#3157F6]/20 dark:border-[#7AA2FF]/20 bg-[#F7F9FC] dark:bg-[#080D18]/60 p-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/70 flex items-center justify-center"><User className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" /></div>
          <div className="min-w-0 flex-1"><div className="text-xs font-black text-slate-900 dark:text-white">Conta OrbiDoc</div><div className="mt-0.5 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Entre com e-mail e senha. Google e Microsoft não são necessários para usar o workspace.</div></div>
        </div>

        {!configured ? (
          <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-[9px] leading-relaxed text-amber-800 dark:text-amber-200">A configuração Firebase desta instalação está incompleta. O modo local continua funcionando normalmente.</div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
              <button type="button" onClick={() => { setMode('signin'); setInlineError(''); }} className={`h-8 rounded-lg text-[9px] font-black ${mode === 'signin' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500'}`}>Entrar</button>
              <button type="button" onClick={() => { setMode('signup'); setInlineError(''); }} className={`h-8 rounded-lg text-[9px] font-black ${mode === 'signup' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500'}`}>Criar conta</button>
            </div>

            <form onSubmit={(event) => void submit(event)} className="mt-3 space-y-2.5">
              {mode === 'signup' && <Field label="Nome" value={name} onChange={setName} autoComplete="name" placeholder="Seu nome" icon={UserPlus} />}
              <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="voce@exemplo.com" icon={At} />
              <Field label="Senha" type="password" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'Mínimo de 8 caracteres' : 'Sua senha'} icon={Lock} />
              {mode === 'signup' && <Field label="Confirmar senha" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Repita a senha" icon={Key} />}
              {inlineError && <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-[9px] font-semibold text-rose-700 dark:text-rose-300">{inlineError}</div>}
              <button disabled={Boolean(busy)} type="submit" className="w-full h-9 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {busy === 'signin' || busy === 'signup' ? <Loader className="w-4 h-4 animate-spin" /> : mode === 'signup' ? <UserPlus className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {mode === 'signup' ? 'Criar conta gratuita' : 'Entrar no OrbiDoc'}
              </button>
            </form>

            {mode === 'signin' && <button type="button" disabled={busy === 'reset'} onClick={() => void resetPassword()} className="mt-2 w-full h-8 text-[9px] font-bold text-[#3157F6] dark:text-[#7AA2FF] hover:underline disabled:opacity-50">Esqueci minha senha</button>}
          </>
        )}

        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-start gap-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><MailCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#008CA8] dark:text-[#22D3EE]" /><span>O modo local continua disponível sem cadastro. Entrar em uma conta não envia automaticamente seus documentos para a nuvem.</span></div>
      </section>
      <WorkspaceBackupControls onNotification={onNotification} />
    </div>
  );
};
