import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle as AlertTriangle,
  IconArrowRight as ArrowRight,
  IconCircleCheck as CircleCheck,
  IconKey as Key,
  IconLoader2 as Loader,
  IconLock as Lock,
  IconMailCheck as MailCheck,
  IconShieldCheck as ShieldCheck,
} from '@tabler/icons-react';
import { OrbiDocLogo } from './OrbiDocLogo';
import {
  completeOrbiDocEmailAction,
  parseOrbiDocEmailAction,
  previewOrbiDocEmailAction,
  safeOrbiDocContinueUrl,
  type OrbiDocEmailActionPreview,
  type OrbiDocEmailActionRequest,
} from '../services/firebaseEmailActions';

type PageState = 'checking' | 'ready' | 'saving' | 'success' | 'error';

const copyFor = (mode?: string) => {
  if (mode === 'resetPassword') return {
    eyebrow: 'Segurança da conta',
    title: 'Crie uma nova senha',
    description: 'Defina uma nova credencial para voltar ao seu workspace OrbiDoc com segurança.',
    successTitle: 'Senha atualizada',
    successText: 'Sua nova senha já pode ser usada para entrar no OrbiDoc.',
  };
  if (mode === 'recoverEmail') return {
    eyebrow: 'Proteção da conta',
    title: 'Restaurar endereço de e-mail',
    description: 'Confirme esta solicitação para reverter a alteração de endereço associada à sua conta.',
    successTitle: 'Endereço restaurado',
    successText: 'O endereço anterior foi restaurado com sucesso.',
  };
  return {
    eyebrow: 'Verificação de identidade',
    title: 'Confirme seu e-mail',
    description: 'Valide seu endereço para reforçar a segurança da conta e concluir a configuração do OrbiDoc.',
    successTitle: 'E-mail verificado',
    successText: 'Sua identidade foi confirmada. Você já pode voltar ao seu workspace.',
  };
};

export const OrbiDocAuthActionPage: React.FC = () => {
  const [request, setRequest] = useState<OrbiDocEmailActionRequest | null>(null);
  const [preview, setPreview] = useState<OrbiDocEmailActionPreview | null>(null);
  const [state, setState] = useState<PageState>('checking');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const copy = useMemo(() => copyFor(request?.mode), [request?.mode]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const parsed = parseOrbiDocEmailAction();
        const details = await previewOrbiDocEmailAction(parsed);
        if (!active) return;
        setRequest(parsed);
        setPreview(details);
        setState('ready');
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Não foi possível validar este link.');
        setState('error');
      }
    })();
    return () => { active = false; };
  }, []);

  const complete = async () => {
    if (!request) return;
    if (request.mode === 'resetPassword') {
      if (password.length < 8) {
        setError('Use pelo menos 8 caracteres na nova senha.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As duas senhas precisam ser iguais.');
        return;
      }
    }

    setError('');
    setState('saving');
    try {
      await completeOrbiDocEmailAction(request, password);
      setState('success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir esta ação.');
      setState('error');
    }
  };

  const returnUrl = safeOrbiDocContinueUrl(request?.continueUrl);

  return (
    <main className="min-h-[100dvh] bg-[#F7F9FC] dark:bg-[#080D18] text-slate-950 dark:text-white relative overflow-hidden flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute -top-44 -left-44 w-[520px] h-[520px] rounded-full border border-[#3157F6]/10" />
      <div className="pointer-events-none absolute -bottom-56 -right-44 w-[620px] h-[620px] rounded-full border border-[#22D3EE]/10" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(49,87,246,0.08),transparent_38%)]" />

      <section className="relative w-full max-w-[560px]">
        <div className="flex justify-center mb-7"><OrbiDocLogo size="lg" /></div>
        <div className="rounded-[30px] overflow-hidden border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#101827]/95 shadow-2xl shadow-slate-900/10 dark:shadow-black/35 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-[#3157F6] via-[#22D3EE] to-[#6D5EF7]" />
          <div className="p-6 sm:p-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/60 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center">
              {state === 'success' ? <CircleCheck className="w-7 h-7" /> : request?.mode === 'resetPassword' ? <Key className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
            </div>

            <div className="mt-5 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3157F6] dark:text-[#7AA2FF]">{copy.eyebrow}</div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-[-0.04em]">{state === 'success' ? copy.successTitle : copy.title}</h1>
              <p className="mt-2 text-[12px] sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">{state === 'success' ? copy.successText : copy.description}</p>
            </div>

            {state === 'checking' && (
              <div className="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-5 flex items-center gap-3">
                <Loader className="w-5 h-5 animate-spin text-[#3157F6]" />
                <div><div className="text-[11px] font-black">Validando link seguro…</div><div className="mt-0.5 text-[9px] text-slate-500">O código é conferido diretamente com o Firebase Authentication.</div></div>
              </div>
            )}

            {preview?.email && state !== 'success' && state !== 'error' && (
              <div className="mt-6 rounded-2xl border border-[#3157F6]/15 bg-[#3157F6]/5 px-4 py-3 flex items-center gap-3">
                <MailCheck className="w-5 h-5 text-[#3157F6] shrink-0" />
                <div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Conta</div><div className="text-[11px] font-black truncate">{preview.email}</div></div>
              </div>
            )}

            {request?.mode === 'resetPassword' && state === 'ready' && (
              <div className="mt-5 space-y-3">
                <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Nova senha</span><div className="relative mt-1"><Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-xs focus:border-[#3157F6] focus:ring-2 focus:ring-[#3157F6]/10" placeholder="Mínimo de 8 caracteres" /></div></label>
                <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Confirmar senha</span><div className="relative mt-1"><Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-xs focus:border-[#3157F6] focus:ring-2 focus:ring-[#3157F6]/10" placeholder="Repita a nova senha" /></div></label>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/25 px-4 py-3 flex items-start gap-2 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span className="text-[10px] font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {state === 'ready' && (
              <button type="button" onClick={() => void complete()} className="mt-6 w-full h-12 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[11px] font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-[#3157F6]/20">
                {request?.mode === 'resetPassword' ? 'Salvar nova senha' : request?.mode === 'recoverEmail' ? 'Restaurar e-mail' : 'Verificar meu e-mail'} <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {state === 'saving' && (
              <button type="button" disabled className="mt-6 w-full h-12 rounded-xl bg-[#3157F6] text-white text-[11px] font-black inline-flex items-center justify-center gap-2 opacity-80"><Loader className="w-4 h-4 animate-spin" /> Concluindo com segurança…</button>
            )}

            {(state === 'success' || state === 'error') && (
              <a href={returnUrl} className="mt-6 w-full h-12 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[11px] font-black inline-flex items-center justify-center gap-2">Voltar ao OrbiDoc <ArrowRight className="w-4 h-4" /></a>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-slate-400"><ShieldCheck className="w-3.5 h-3.5" /> Código de uso único validado diretamente pelo Firebase · OrbiDoc nunca solicita sua senha por e-mail.</div>
      </section>
    </main>
  );
};
