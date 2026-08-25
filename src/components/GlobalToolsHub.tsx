import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowsMaximize,
  IconDownload,
  IconHistory,
  IconPhoto,
  IconScan,
  IconShieldLock,
  IconSparkles,
  IconTool,
  IconUser,
  IconX,
} from '@tabler/icons-react';

const clickLauncher = (ariaLabel: string) => {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${ariaLabel}"]`);
  if (!button) throw new Error(`A ferramenta “${ariaLabel}” não está disponível nesta tela.`);
  button.click();
};

const openMediaTab = (label: 'Baixar por link' | 'Aprimorar imagem') => {
  clickLauncher('Abrir ferramentas de mídia e qualidade');
  let attempt = 0;
  const select = () => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((item) => item.textContent?.trim().includes(label));
    if (button) {
      button.click();
      return;
    }
    attempt += 1;
    if (attempt < 12) window.setTimeout(select, 40);
  };
  window.setTimeout(select, 20);
};

export const GlobalToolsHub: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const restoreTriggerFocus = () => window.requestAnimationFrame(() => triggerRef.current?.focus());

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => {
          const next = !value;
          if (!next) restoreTriggerFocus();
          return next;
        });
      }
      if (event.key === 'Escape') {
        setOpen((value) => {
          if (value) restoreTriggerFocus();
          return false;
        });
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const actions = useMemo(() => [
    {
      id: 'scan',
      title: 'Scan & Reader',
      detail: 'Scanner, leitor universal e OCR local',
      icon: IconScan,
      run: () => clickLauncher('Abrir Scan e Reader'),
    },
    {
      id: 'enhance',
      title: 'Aprimorar imagem',
      detail: 'HQ local e restauração de imagem',
      icon: IconPhoto,
      run: () => openMediaTab('Aprimorar imagem'),
    },
    {
      id: 'download',
      title: 'Downloader',
      detail: 'Salvar links diretos com segurança',
      icon: IconDownload,
      run: () => openMediaTab('Baixar por link'),
    },
    {
      id: 'resize',
      title: 'Redimensionar imagens',
      detail: 'Lote, presets e formatos locais',
      icon: IconArrowsMaximize,
      run: () => window.dispatchEvent(new Event('orbidoc:open-image-resizer')),
    },
    {
      id: 'versions',
      title: 'Histórico de versões',
      detail: 'Snapshots e recuperação de projetos',
      icon: IconHistory,
      run: () => clickLauncher('Abrir histórico de versões'),
    },
    {
      id: 'local',
      title: 'Ferramentas locais',
      detail: 'Texto, hash, Base64, UUID e utilidades',
      icon: IconTool,
      run: () => window.dispatchEvent(new Event('orbidoc:open-local-tools')),
    },
    {
      id: 'lab',
      title: 'Laboratório offline',
      detail: 'Diff, CSV/JSON, regex e privacidade',
      icon: IconShieldLock,
      run: () => window.dispatchEvent(new Event('orbidoc:open-advanced-tools')),
    },
    {
      id: 'account',
      title: 'Conta e conexões',
      detail: 'Conta OrbiDoc, Google e Microsoft',
      icon: IconUser,
      run: () => clickLauncher('Conta OrbiDoc e conexões externas'),
    },
  ], []);

  const closeHub = () => {
    setOpen(false);
    restoreTriggerFocus();
  };

  const run = (operation: () => void) => {
    setNotice('');
    setOpen(false);
    window.setTimeout(() => {
      try {
        operation();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Não foi possível abrir a ferramenta.');
        setOpen(true);
      }
    }, 40);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="orbidoc-tools-hub-trigger hidden lg:inline-flex fixed z-[73] h-11 px-4 rounded-2xl bg-white/96 dark:bg-[#101827]/96 border border-slate-200 dark:border-slate-700 shadow-lg text-[10px] font-black text-slate-700 dark:text-slate-100 items-center gap-2 hover:border-[#3157F6]/40"
        aria-label="Abrir central de ferramentas"
        aria-expanded={open}
        title="Central de Ferramentas · Ctrl/Cmd+K"
      >
        <IconSparkles className="w-4.5 h-4.5 text-[#3157F6] dark:text-[#7AA2FF]" />
        Ferramentas
        <kbd className="ml-1 rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[8px] font-bold text-slate-400">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[194] bg-[#080D18]/60 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orbidoc-tools-hub-title"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeHub(); }}
        >
          <section className="orbidoc-keyboard-safe-panel w-full max-w-3xl max-h-[min(88dvh,760px)] overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#080D18] shadow-2xl flex flex-col">
            <header className="shrink-0 px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/60 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center">
                <IconSparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="orbidoc-tools-hub-title" className="text-sm font-black">Central de Ferramentas</h2>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Um único ponto para utilidades globais. Ctrl/Cmd+K abre ou fecha esta central.</p>
              </div>
              <button type="button" autoFocus onClick={closeHub} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar central de ferramentas">
                <IconX className="w-4 h-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => run(action.run)}
                      className="min-h-[76px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] hover:border-[#3157F6]/35 hover:bg-[#EFF4FF]/70 dark:hover:bg-[#0D1E5B]/25 p-3.5 flex items-center gap-3 text-left"
                    >
                      <span className="w-10 h-10 shrink-0 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/55 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-slate-800 dark:text-slate-100">{action.title}</span>
                        <span className="block mt-0.5 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">{action.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {notice && <div role="alert" className="mt-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-[10px] font-bold text-rose-700 dark:text-rose-300">{notice}</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
};