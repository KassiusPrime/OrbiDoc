import React, { useEffect, useState } from 'react';
import {
  IconBrandGoogle as Google,
  IconCloudCheck as CloudCheck,
  IconDeviceLaptop as DeviceLaptop,
  IconLock as Lock,
  IconOrbit as Orbit,
  IconShieldCheck as ShieldCheck,
  IconX as X,
} from '@tabler/icons-react';
import { getCurrentOrbiDocUser, type OrbiDocAuthUser, subscribeToOrbiDocAuth } from '../services/firebase';
import { getCurrentLocalOrbiDocUser, subscribeToLocalOrbiDocAccount } from '../services/localAccount';
import { OrbiDocAuthPanel } from './OrbiDocAuthPanel';
import { OrbiDocLogo } from './OrbiDocLogo';

const AUTH_ENTRY_KEY = 'orbidoc_auth_entry_v1';

function hasDismissedEntry() {
  try { return Boolean(localStorage.getItem(AUTH_ENTRY_KEY)); } catch { return false; }
}

function markEntry(value: 'signed-in' | 'continue-local') {
  try { localStorage.setItem(AUTH_ENTRY_KEY, value); } catch { /* storage can be unavailable */ }
}

export const OrbiDocLoginScreen: React.FC = () => {
  const [cloudUser, setCloudUser] = useState<OrbiDocAuthUser | null>(() => getCurrentOrbiDocUser());
  const [localUser, setLocalUser] = useState(() => getCurrentLocalOrbiDocUser());
  const [dismissed, setDismissed] = useState(hasDismissedEntry);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => subscribeToOrbiDocAuth(setCloudUser), []);
  useEffect(() => subscribeToLocalOrbiDocAccount(setLocalUser), []);

  useEffect(() => {
    if (!cloudUser && !localUser) return;
    markEntry('signed-in');
    setDismissed(true);
  }, [cloudUser, localUser]);

  if (dismissed || cloudUser || localUser) return null;

  const continueWithoutAccount = () => {
    markEntry('continue-local');
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[130] bg-[#F7F9FC] dark:bg-[#080D18] text-slate-900 dark:text-white overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-labelledby="orbidoc-login-title">
      <div className="min-h-full grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="relative hidden lg:flex overflow-hidden border-r border-slate-200/70 dark:border-white/10 px-10 xl:px-16 py-12 flex-col justify-between">
          <div className="absolute -top-44 -left-44 w-[560px] h-[560px] rounded-full border border-[#3157F6]/10" />
          <div className="absolute -bottom-52 -right-44 w-[620px] h-[620px] rounded-full border border-[#22D3EE]/10" />
          <div className="relative">
            <OrbiDocLogo size="lg" />
            <div className="mt-16 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#3157F6]/15 bg-[#3157F6]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#3157F6] dark:text-[#7AA2FF]"><Orbit className="w-3.5 h-3.5" /> Orbital Document</div>
              <h1 id="orbidoc-login-title" className="mt-5 text-4xl xl:text-5xl font-black tracking-[-0.05em] leading-[1.04]">Seu workspace, em qualquer dispositivo.</h1>
              <p className="mt-4 max-w-lg text-sm xl:text-base leading-relaxed text-slate-500 dark:text-slate-400">Entre para vincular o workspace ao seu UID e sincronizar projetos e preferências. O OrbiDoc continua local-first: login nunca é obrigatório para criar e editar arquivos.</p>
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-3 max-w-2xl">
            <Feature icon={Google} title="Google" text="Login rápido pelo Firebase, sem acesso automático ao Drive." />
            <Feature icon={CloudCheck} title="Sincronização" text="Projetos e preferências isolados pela sua conta." />
            <Feature icon={ShieldCheck} title="Local-first" text="Você pode continuar usando o app sem criar conta." />
          </div>
        </section>

        <section className="min-h-full flex items-center justify-center px-4 sm:px-7 py-6 sm:py-10">
          <div className="w-full max-w-[500px]">
            <div className="lg:hidden flex items-center justify-between mb-6">
              <OrbiDocLogo size="md" />
              <button type="button" onClick={continueWithoutAccount} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500" aria-label="Continuar sem conta"><X className="w-4 h-4" /></button>
            </div>

            <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xl shadow-slate-900/5 dark:shadow-black/25 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#3157F6] via-[#22D3EE] to-[#6D5EF7]" />
              <div className="p-4 sm:p-6">
                <div className="mb-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3157F6] dark:text-[#7AA2FF]">Bem-vindo ao OrbiDoc</div>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">Entrar ou criar conta</h2>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Use Google para entrar com poucos cliques ou mantenha e-mail/senha. A conexão com Google Drive é outra permissão, separada e opcional.</p>
                </div>

                {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mb-3 rounded-xl px-3 py-2 text-[10px] font-semibold ${notice.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>{notice.message}</div>}

                <OrbiDocAuthPanel
                  showBackupControls={false}
                  onUserChange={(user) => {
                    if (!user) return;
                    markEntry('signed-in');
                    setCloudUser(user);
                  }}
                  onNotification={(message, type = 'success') => setNotice({ message, type })}
                />
              </div>
            </div>

            <button type="button" onClick={continueWithoutAccount} className="mt-4 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#101827]/70 hover:bg-white dark:hover:bg-[#101827] text-xs font-black inline-flex items-center justify-center gap-2"><DeviceLaptop className="w-4 h-4" /> Continuar sem conta</button>
            <div className="mt-3 px-2 flex items-start gap-2 text-[9px] leading-relaxed text-slate-400"><Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>Sem conta, seus arquivos continuam locais neste dispositivo. Você pode entrar depois pelo botão de perfil no topo do OrbiDoc.</span></div>
          </div>
        </section>
      </div>
    </div>
  );
};

const Feature: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}> = ({ icon: Icon, title, text }) => (
  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/55 dark:bg-white/[0.035] backdrop-blur-sm p-4">
    <div className="w-9 h-9 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/60 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></div>
    <div className="mt-3 text-xs font-black">{title}</div>
    <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
  </div>
);
