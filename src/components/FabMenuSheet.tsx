import React, { useEffect } from 'react';
import {
  IconDownload as Download,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconHistory as History,
  IconLayoutGrid as Design,
  IconPhoto as Photo,
  IconPresentation as Presentation,
  IconScan as Scan,
  IconSparkles as Sparkles,
  IconTool as Tool,
  IconUser as User,
  IconX as X,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import type { TabType } from '../types';

interface FabMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (tab: TabType, extraAction?: string) => void;
}

const ACTIONS = [
  { id: 'word', tab: 'word' as TabType, title: 'Orbit Nova', desc: 'Documento · texto rico, DOCX e PDF', icon: FileText, color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300' },
  { id: 'excel', tab: 'excel' as TabType, title: 'Orbit Gravity', desc: 'Planilha · dados, fórmulas e XLSX', icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300' },
  { id: 'powerpoint', tab: 'powerpoint' as TabType, title: 'Orbit Aurora', desc: 'Apresentação · slides, layouts e PPTX', icon: Presentation, color: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/45 dark:text-fuchsia-300' },
  { id: 'canva', tab: 'canva' as TabType, title: 'Orbit Comet', desc: 'Design · canvas, mídia e composição', icon: Design, color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/45 dark:text-orange-300' },
  { id: 'extract', tab: 'extract' as TabType, title: 'Orbit Nebula', desc: 'PDF & OCR · ler, extrair e converter', icon: FileCheck, color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/45 dark:text-cyan-300' },
  { id: 'chat', tab: 'chat' as TabType, title: 'Nexus AI', desc: 'Assistente único do Orbit', icon: Sparkles, color: 'bg-violet-50 text-violet-700 dark:bg-violet-950/45 dark:text-violet-300' },
] as const;

const clickLauncher = (ariaLabel: string): void => {
  document.querySelector<HTMLButtonElement>(`button[aria-label="${ariaLabel}"]`)?.click();
};

const openAccount = (): void => {
  const account = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Conta Orbit e conexões externas"], button[aria-label="Conta OrbiDoc e conexões externas"]',
  );
  account?.click();
};

const openMediaTab = (label: 'Baixar por link' | 'Aprimorar imagem'): void => {
  clickLauncher('Abrir ferramentas de mídia e qualidade');
  let attempt = 0;
  const select = (): void => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((item) => item.textContent?.trim().includes(label));
    if (button) {
      button.click();
      return;
    }
    attempt += 1;
    if (attempt < 10) window.setTimeout(select, 40);
  };
  window.setTimeout(select, 20);
};

export const FabMenuSheet: React.FC<FabMenuSheetProps> = ({ isOpen, onClose, onSelectAction }) => {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  const runUtility = (action: () => void): void => {
    onClose();
    window.setTimeout(action, 50);
  };

  const utilities = [
    { id: 'account', title: 'Conta Orbit', desc: 'Perfil, segurança e conexões', icon: User, run: openAccount },
    { id: 'download', title: 'Downloader', desc: 'Salvar links no dispositivo', icon: Download, run: () => openMediaTab('Baixar por link') },
    { id: 'enhance', title: 'Aprimorar imagem', desc: 'HQ local e restauração', icon: Photo, run: () => openMediaTab('Aprimorar imagem') },
    { id: 'scan', title: 'Scan & Reader', desc: 'Scanner, leitor e OCR local', icon: Scan, run: () => clickLauncher('Abrir Scan e Reader') },
    { id: 'versions', title: 'Versões', desc: 'Snapshots e recuperação', icon: History, run: () => clickLauncher('Abrir histórico de versões') },
    { id: 'local', title: 'Utilitários', desc: 'Hash, Base64, JSON, UUID e mais', icon: Tool, run: () => window.dispatchEvent(new Event('orbidoc:open-local-tools')) },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="orbidoc-fab-overlay fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="orbit-quick-create-title"
            className="orbidoc-keyboard-safe-panel relative z-10 w-full max-w-2xl max-h-[92dvh] bg-white dark:bg-[#111318] rounded-t-[20px] sm:rounded-[20px] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-4 flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="w-9 h-9 rounded-[10px] bg-[#EEF3FF] dark:bg-[#111D4A] text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center shrink-0"><Sparkles className="w-4.5 h-4.5" /></div>
              <div className="min-w-0 flex-1">
                <h3 id="orbit-quick-create-title" className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Criar no Orbispace</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Criação, IA e utilitários no mesmo shell do Orbit.</p>
              </div>
              <button type="button" onClick={onClose} className="w-9 h-9 rounded-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center" aria-label="Fechar criação rápida"><X className="w-5 h-5" /></button>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
              <section>
                <div className="mb-2 px-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Criar</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <motion.button
                        key={action.id}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => { onSelectAction(action.tab); onClose(); }}
                        className="min-h-[72px] p-3 bg-white dark:bg-[#0B0D11] hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#7AA2FF] rounded-[14px] flex items-center gap-3 text-left group"
                      >
                        <div className={`w-10 h-10 rounded-[10px] ${action.color} flex items-center justify-center shrink-0`}><Icon className="w-5 h-5" /></div>
                        <div className="min-w-0"><h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs group-hover:text-[#3157F6] truncate">{action.title}</h4><p className="text-[9px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{action.desc}</p></div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 px-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Ferramentas</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {utilities.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} type="button" onClick={() => runUtility(item.run)} className="min-h-[96px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B0D11] hover:border-[#7AA2FF] p-3 text-left">
                        <div className="w-9 h-9 rounded-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></div>
                        <div className="mt-2 text-[10px] font-extrabold text-slate-800 dark:text-slate-100">{item.title}</div>
                        <div className="mt-0.5 text-[8px] leading-relaxed text-slate-400">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="orbidoc-fab-footer px-4 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button type="button" onClick={onClose} className="w-full h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-[10px] text-xs font-bold">Fechar</button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};
