import React, { useEffect, useState } from 'react';
import {
  IconCheck as Check,
  IconLock as Lock,
  IconSparkles as Sparkles,
  IconX as X,
} from '@tabler/icons-react';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import {
  FREE_ENTITLEMENT,
  isOrbiDocPremium,
  subscribeToOrbiDocEntitlement,
  type OrbiDocEntitlement,
} from '../services/entitlements';

const FREE_FEATURES = [
  'Documentos, planilhas, apresentações e design local-first',
  'OCR e utilitários locais essenciais',
  'Conta local ou Firebase opcional',
  'Exportação e leitura de arquivos compatíveis',
];

const PREMIUM_FEATURES = [
  'Tudo do plano Free',
  'BYOK: Gemini, Groq e OpenRouter com suas próprias chaves',
  'Modelos e ferramentas profissionais avançadas',
  'Sincronização e recursos de nuvem prioritários',
  'Templates Pro e exportações avançadas',
  'Novos recursos Premium enquanto a assinatura estiver ativa',
];

export const PricingLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [entitlement, setEntitlement] = useState<OrbiDocEntitlement>(FREE_ENTITLEMENT);
  const native = isOrbiDocNativeRuntime();
  const premium = isOrbiDocPremium(entitlement);

  useEffect(() => subscribeToOrbiDocEntitlement(setEntitlement), []);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('orbidoc:open-pricing', show);
    return () => window.removeEventListener('orbidoc:open-pricing', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;

  return <div className="fixed inset-0 z-[185] bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="pricing-title">
    <div className="w-full max-w-4xl max-h-[94dvh] overflow-hidden rounded-t-[28px] sm:rounded-[30px] bg-[#F7F9FC] dark:bg-[#080D18] border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
      <header className="shrink-0 p-4 sm:p-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#101827]/80 backdrop-blur-xl">
        <div className="w-10 h-10 rounded-2xl bg-[#3157F6]/10 text-[#3157F6] flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#3157F6]">OrbiDoc Premium</div><h2 id="pricing-title" className="text-sm font-black">Escolha quanto poder você precisa</h2></div>
        <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Fechar planos"><X className="w-4 h-4" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {premium && <div className="mb-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/25 px-4 py-3 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Sua conta já possui acesso {entitlement.plan === 'supreme' ? 'Supreme' : 'Premium'}.</div>}
        <div className="grid md:grid-cols-2 gap-4">
          <PlanCard title="Free" kicker="Local-first" description="Uma suíte produtiva completa para criar, converter e organizar arquivos sem assinatura." features={FREE_FEATURES} action="Plano atual / gratuito" />
          <PlanCard premium title="Premium" kicker="Para uso avançado" description="Desbloqueia IA com chaves próprias e a camada profissional comercial do OrbiDoc." features={PREMIUM_FEATURES} action={premium ? 'Premium ativo' : native ? 'Assinar pelo Google Play' : 'Assinar no OrbiDoc Web'} />
        </div>

        {!premium && <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 flex items-start gap-3"><Lock className="w-4 h-4 text-[#3157F6] mt-0.5 shrink-0" /><div className="text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-200">Cobrança ainda não conectada neste build.</strong> Na Web, o checkout será Stripe e o entitlement será atualizado por webhook. No app distribuído pelo Google Play, recursos digitais Premium serão vendidos com Play Billing e verificados no backend. Nenhum botão aqui simula uma assinatura que não existe.</div></div>}

        <div className="mt-4 text-center text-[8px] text-slate-400">Supreme é um papel privado de proprietário/administração e não é vendido como plano público.</div>
      </div>
    </div>
  </div>;
};

const PlanCard: React.FC<{ title: string; kicker: string; description: string; features: string[]; action: string; premium?: boolean }> = ({ title, kicker, description, features, action, premium = false }) => <section className={`rounded-[24px] border p-5 ${premium ? 'border-[#3157F6]/35 bg-white dark:bg-[#101827] shadow-xl shadow-[#3157F6]/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827]'}`}>
  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#3157F6]">{kicker}</div>
  <h3 className="mt-1 text-2xl font-black tracking-[-0.04em]">{title}</h3>
  <p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
  <div className="mt-4 space-y-2">{features.map((feature) => <div key={feature} className="flex items-start gap-2 text-[9px] leading-relaxed"><span className="w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center shrink-0"><Check className="w-3 h-3" /></span><span>{feature}</span></div>)}</div>
  <button type="button" disabled className={`mt-5 w-full h-10 rounded-xl text-[10px] font-black ${premium ? 'bg-[#3157F6] text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'} opacity-80 cursor-default`}>{action}</button>
</section>;
