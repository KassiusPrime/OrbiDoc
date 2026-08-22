import React, { useEffect, useMemo, useState } from 'react';
import {
  IconArrowRight as ArrowRight,
  IconCloud as Cloud,
  IconFileText as FileText,
  IconLock as Lock,
  IconSparkles as Sparkles,
  IconX as X,
} from '@tabler/icons-react';
import { OrbiDocLogo } from './OrbiDocLogo';

const ONBOARDING_KEY = 'orbidoc_onboarding_v1';

type ExperiencePhase = 'splash' | 'splash-exit' | 'onboarding' | 'ready';

function hasSeenOnboarding() {
  try { return localStorage.getItem(ONBOARDING_KEY) === 'done'; } catch { return false; }
}

function isStandaloneDisplay() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

const onboardingCards = [
  {
    icon: FileText,
    eyebrow: 'Documentos em órbita',
    title: 'Crie, converta e organize sem trocar de ambiente',
    text: 'Documentos, planilhas, apresentações, PDF/OCR e imagens ficam reunidos no mesmo workspace.',
    tone: 'text-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/60',
  },
  {
    icon: Sparkles,
    eyebrow: 'Inteligência em conexão',
    title: 'Use IA quando ela acrescentar valor',
    text: 'O Nebula Violet identifica recursos inteligentes sem transformar cada tela em um painel de efeitos.',
    tone: 'text-[#6D5EF7] bg-[#F3F0FF] dark:bg-[#221D52]/55',
  },
  {
    icon: Cloud,
    eyebrow: 'Local primeiro',
    title: 'Sua conta e a nuvem continuam opcionais',
    text: 'Você pode começar no modo local. Google Drive e Microsoft podem ser conectados depois em Entrar e conectar.',
    tone: 'text-[#008CA8] bg-[#ECFEFF] dark:bg-[#063A45]/55',
  },
] as const;

const launchMessages = [
  'Preparando a interface',
  'Carregando recursos locais',
  'Workspace pronto',
] as const;

export const OrbiDocExperienceShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [phase, setPhase] = useState<ExperiencePhase>('splash');
  const [launchStage, setLaunchStage] = useState(0);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const standalone = useMemo(() => isStandaloneDisplay(), []);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setPhase(hasSeenOnboarding() ? 'ready' : 'onboarding');
      return;
    }

    const total = standalone ? 760 : 560;
    const stageOne = window.setTimeout(() => setLaunchStage(1), Math.round(total * 0.33));
    const stageTwo = window.setTimeout(() => setLaunchStage(2), Math.round(total * 0.67));
    const beginExit = window.setTimeout(() => setPhase('splash-exit'), total);
    const finish = window.setTimeout(() => {
      setPhase(hasSeenOnboarding() ? 'ready' : 'onboarding');
    }, total + 180);

    return () => {
      window.clearTimeout(stageOne);
      window.clearTimeout(stageTwo);
      window.clearTimeout(beginExit);
      window.clearTimeout(finish);
    };
  }, [standalone]);

  const finishOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch { /* storage can be unavailable */ }
    setPhase('ready');
  };

  const showSplash = phase === 'splash' || phase === 'splash-exit';

  return (
    <>
      <div className="orbidoc-app-root">{children}</div>

      {showSplash && (
        <div
          className={`orbidoc-launch-screen fixed inset-0 z-[140] overflow-hidden bg-[#F7F9FC] dark:bg-[#080D18] text-[#0B1220] dark:text-white flex items-center justify-center px-6 ${phase === 'splash-exit' ? 'is-exiting' : ''}`}
          role="status"
          aria-live="polite"
          aria-label="Iniciando OrbiDoc"
        >
          <div className="pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full border border-[#3157F6]/10 dark:border-[#7AA2FF]/10" />
          <div className="pointer-events-none absolute -bottom-36 -left-24 w-96 h-96 rounded-full border border-[#22D3EE]/10" />
          <div className="orbidoc-launch-stage relative w-full max-w-sm text-center">
            <div className="orbidoc-launch-orbit">
              <div className="orbidoc-launch-logo flex justify-center"><OrbiDocLogo size="xl" className="scale-110" /></div>
            </div>
            <p className="mt-5 text-sm font-semibold tracking-[-0.01em] text-slate-600 dark:text-slate-300">Documentos em órbita. Inteligência em conexão.</p>
            <div className="orbidoc-launch-progress mt-7 h-1 w-44 mx-auto rounded-full bg-[#3157F6]/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-[#3157F6] dark:bg-[#7AA2FF] transition-[width] duration-200 ease-out" style={{ width: `${34 + launchStage * 33}%` }} />
            </div>
            <div key={launchStage} className="orbidoc-launch-status mt-3 text-[10px] font-bold tracking-[0.04em] text-slate-400 dark:text-slate-500">{launchMessages[launchStage]}</div>
            <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300 dark:text-slate-600">{standalone ? 'OrbiDoc App' : 'OrbiDoc Workspace'}</div>
          </div>
        </div>
      )}

      {phase === 'onboarding' && (
        <div className="fixed inset-0 z-[135] bg-[#080D18]/55 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="orbidoc-onboarding-title">
          <div className="relative w-full sm:max-w-[720px] rounded-t-[30px] sm:rounded-[30px] border border-white/10 bg-white dark:bg-[#101827] shadow-2xl overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#3157F6] via-[#22D3EE] to-[#6D5EF7]" />
            <div className="px-5 sm:px-7 pt-6 sm:pt-7 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <OrbiDocLogo size="md" />
                <div className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#3157F6] dark:text-[#7AA2FF]">Primeiros passos</div>
                <h1 id="orbidoc-onboarding-title" className="mt-1 text-2xl sm:text-3xl font-black tracking-[-0.035em] text-[#0B1220] dark:text-white">Um workspace completo, sem ruído visual.</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">O OrbiDoc usa Orbital Azure para orientar ações e mantém o conteúdo como protagonista.</p>
              </div>
              <button onClick={finishOnboarding} className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500" aria-label="Pular introdução"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 sm:px-7 py-6">
              <div className="hidden md:grid grid-cols-3 gap-3">
                {onboardingCards.map((card) => {
                  const Icon = card.icon;
                  return <div key={card.title} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#080D18]/55 p-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.tone}`}><Icon className="w-5 h-5" /></div><div className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{card.eyebrow}</div><h2 className="mt-1 text-sm font-black text-[#0B1220] dark:text-white leading-snug">{card.title}</h2><p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{card.text}</p></div>;
                })}
              </div>

              <div className="md:hidden">
                {(() => {
                  const card = onboardingCards[onboardingIndex];
                  const Icon = card.icon;
                  return <div key={card.title} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#080D18]/55 p-5 min-h-[220px] animate-[orbidoc-view-in_0.22s_ease_both]"><div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.tone}`}><Icon className="w-5 h-5" /></div><div className="mt-5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{card.eyebrow}</div><h2 className="mt-1 text-lg font-black text-[#0B1220] dark:text-white leading-snug">{card.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{card.text}</p></div>;
                })()}
                <div className="mt-4 flex justify-center gap-1.5">{onboardingCards.map((card, index) => <button key={card.title} onClick={() => setOnboardingIndex(index)} className={`h-1.5 rounded-full transition-all duration-200 ${index === onboardingIndex ? 'w-7 bg-[#3157F6]' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} aria-label={`Ir para etapa ${index + 1}`} />)}</div>
              </div>
            </div>

            <div className="px-5 sm:px-7 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080D18]/45 flex flex-col-reverse sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400"><Lock className="w-3.5 h-3.5 shrink-0 text-[#008CA8]" /> Login não é obrigatório para abrir o workspace.</div>
              <div className="sm:ml-auto flex gap-2">
                <button onClick={finishOnboarding} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-xs font-bold text-slate-600 dark:text-slate-300">Pular</button>
                <button onClick={() => { if (onboardingIndex < onboardingCards.length - 1 && window.innerWidth < 768) setOnboardingIndex((value) => value + 1); else finishOnboarding(); }} className="h-10 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-xs font-black inline-flex items-center gap-2">{onboardingIndex < onboardingCards.length - 1 && typeof window !== 'undefined' && window.innerWidth < 768 ? 'Continuar' : 'Entrar no OrbiDoc'} <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};