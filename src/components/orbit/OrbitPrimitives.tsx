import React from 'react';
import { IconChevronLeft, IconX } from '@tabler/icons-react';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const OrbitWorkspace: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'main' | 'section' | 'div' }> = ({ as = 'section', className, children, ...props }) => {
  const Element = as;
  return <Element className={cx('orbit-workspace-surface min-w-0', className)} {...props}>{children}</Element>;
};

export const OrbitHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onBack?: () => void;
  className?: string;
}> = ({ title, subtitle, leading, trailing, onBack, className }) => (
  <header className={cx('orbit-header min-h-14 sm:min-h-16 shrink-0 border-b border-[var(--orbit-border)] bg-[var(--orbit-surface)] px-3 sm:px-4 flex items-center gap-2 sm:gap-3', className)}>
    {leading}
    {onBack ? (
      <button type="button" onClick={onBack} className="h-10 w-10 rounded-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Voltar">
        <IconChevronLeft className="h-5 w-5" />
      </button>
    ) : null}
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm sm:text-[15px] font-extrabold tracking-[-0.01em]">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-[10px] text-[var(--orbit-muted)]">{subtitle}</div> : null}
    </div>
    {trailing ? <div className="ml-auto flex items-center gap-1.5">{trailing}</div> : null}
  </header>
);

export const OrbitToolbar: React.FC<{
  children: React.ReactNode;
  label?: string;
  className?: string;
  compact?: boolean;
}> = ({ children, label = 'Ferramentas contextuais', className, compact = false }) => (
  <div role="toolbar" aria-label={label} className={cx('orbit-context-strip', compact ? 'px-2 py-1.5' : 'px-2.5 sm:px-4 py-2', className)}>
    {children}
  </div>
);

export const OrbitToolbarGroup: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cx('inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] p-1', className)} {...props}>{children}</div>
);

export const OrbitFeatureBar: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className }) => (
  <div className={cx('orbit-feature-bar', className)}>
    {icon ? <span className="h-8 w-8 shrink-0 rounded-[10px] bg-[var(--orbit-nexus-soft)] text-[var(--orbit-nexus)] inline-flex items-center justify-center">{icon}</span> : null}
    <div className="orbit-feature-bar__copy">
      <div className="orbit-feature-bar__title">{title}</div>
      {description ? <div className="orbit-feature-bar__description">{description}</div> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export const OrbitPanel: React.FC<React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }> = ({ className, elevated = false, children, ...props }) => (
  <div className={cx(elevated ? 'orbit-elevated-surface' : 'orbit-workspace-surface', className)} {...props}>{children}</div>
);

export const OrbitCard: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode }> = ({ icon, title, description, className, ...props }) => (
  <button type="button" className={cx('min-h-20 rounded-[14px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] p-3 text-left hover:border-[var(--orbit-focus)] transition-colors', className)} {...props}>
    {icon ? <div className="mb-2">{icon}</div> : null}
    <div className="text-xs font-extrabold">{title}</div>
    {description ? <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--orbit-muted)]">{description}</div> : null}
  </button>
);

export const OrbitStatusBadge: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger'; className?: string }> = ({ children, tone = 'neutral', className }) => {
  const tones = {
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    success: 'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-950/45 text-amber-700 dark:text-amber-300',
    danger: 'bg-rose-50 dark:bg-rose-950/45 text-rose-700 dark:text-rose-300',
  };
  return <span className={cx('inline-flex min-h-6 items-center rounded-[8px] px-2 py-1 text-[10px] font-bold', tones[tone], className)}>{children}</span>;
};

export const OrbitEmptyState: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className }) => (
  <div className={cx('px-5 py-8 sm:py-10 text-center', className)}>
    {icon ? <div className="mx-auto mb-2.5 h-10 w-10 rounded-[12px] bg-slate-100 dark:bg-slate-800 text-slate-500 inline-flex items-center justify-center">{icon}</div> : null}
    <div className="text-sm font-extrabold">{title}</div>
    {description ? <div className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-[var(--orbit-muted)]">{description}</div> : null}
    {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
  </div>
);

export const OrbitBottomSheet: React.FC<{
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, title, description, onClose, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <button type="button" aria-label="Fechar painel" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" className="orbidoc-keyboard-safe-panel relative z-10 w-full max-w-2xl max-h-[92dvh] overflow-hidden rounded-t-[20px] sm:rounded-[20px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] shadow-2xl flex flex-col">
        <header className="shrink-0 border-b border-[var(--orbit-border)] px-4 py-3 flex items-start gap-3">
          <div className="min-w-0 flex-1"><div className="text-sm font-extrabold">{title}</div>{description ? <div className="mt-0.5 text-[10px] text-[var(--orbit-muted)]">{description}</div> : null}</div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><IconX className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-[var(--orbit-border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer> : null}
      </section>
    </div>
  );
};
