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
  { id: 'word', tab: 'word' as TabType, title: 'Novo documento', desc: 'OrbiDoc · texto, DOCX, PDF e Nexus AI', icon: FileText, color: 'bg-blue-600 text-white' },
  { id: 'excel', tab: 'excel' as TabType, title: 'Nova planilha', desc: 'OrbiDoc · dados, fórmulas, XLSX e CSV', icon: FileSpreadsheet, color: 'bg-emerald-600 text-white' },
  { id: 'powerpoint', tab: 'powerpoint' as TabType, title: 'Nova apresentação', desc: 'OrbiDoc · slides, layouts e PPTX', icon: Presentation, color: 'bg-orange-600 text-white' },
  { id: 'canva', tab: 'canva' as TabType, title: 'Novo design', desc: 'Peças visuais e composição gráfica', icon: Design, color: 'bg-fuchsia-600 text-white' },
  { id: 'extract', tab: 'extract' as TabType, title: 'PDF & OCR', desc: 'Digitalizar, extrair e organizar conteúdo', icon: FileCheck, color: 'bg-cyan-600 text-white' },
  { id: 'chat', tab: 'chat' as TabType, title: 'Nexus AI', desc: 'Assistente unificado do Orbit com roteamento gratuito automático', icon: Sparkles, color: 'bg-[#7C3AED] text-white' },
] as const;

const clickLauncher = (ariaLabel: string): void => {
  document.querySelector<HTMLButtonElement>(`button[aria-label="${ariaLabel}"]`)?.click();
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
    { id: 'account', title: 'Conta Orbit', desc: 'Login, sincronização e conexões externas', icon: User, run: () => clickLauncher('Conta OrbiDoc e conexões externas') },
    { id: 'download', title: 'Downloader', desc: 'Salvar links diretos no armazenamento do dispositivo', icon: Download, run: () => openMediaTab('Baixar por link') },
    { id: 'enhance', title: 'Melhorar imagem', desc: 'HQ local e restauração sem trocar de assistente', icon: Photo, run: () => openMediaTab('Aprimorar imagem') },
    { id: 'scan', title: 'Scan & Reader', desc: 'Scanner, leitor universal e OCR local', icon: Scan, run: () => clickLauncher('Abrir Scan e Reader') },
    { id: 'versions', title: 'Versões', desc: 'Snapshots locais e recuperação', icon: History, run: () => clickLauncher('Abrir histórico de versões') },
    { id: 'local', title: 'Ferramentas locais', desc: 'Texto, JSON, senha, hash, Base64, URL e UUID', icon: Tool, run: () => window.dispatchEvent(new Event('orbidoc:open-local-tools')) },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="orbidoc-fab-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-[#09090B]/70 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="orbit-quick-create-title"
            className="orbidoc-keyboard-safe-panel relative z-10 w-full max-w-2xl max-h-[92dvh] bg-white dark:bg-[#0F0F11] rounded-t-[28px] sm:rounded-[28px] shadow-2xl border border-slate-200/80 dark:border-[#27272A] flex flex-col overflow-hidden"
          >
            <div className="p-5 sm:p-6 pb-4 flex items-start gap-3 border-b border-slate-100 dark:border-[#27272A] shrink-0">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-[#7C3AED] dark:text-[#A78BFA] flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <h3 id="orbit-quick-create-title" className="font-black text-slate-900 dark:text-slate-100 text-base">Criar no Orbispace</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">OrbiDoc, Nexus AI e utilitários essenciais em uma única superfície móvel.</p>
              </div>
              <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center" aria-label="Fechar criação rápida"><X className="w-5 h-5" /></button>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
              <section>
                <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Criar e conversar</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <motion.button
                        key={action.id}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => { onSelectAction(action.tab); onClose(); }}
                        className="p-3.5 bg-slate-50 dark:bg-[#09090B] hover:bg-violet-50 dark:hover:bg-violet-950/25 border border-slate-200/70 dark:border-slate-700/70 hover:border-violet-400/50 rounded-2xl flex items-center gap-3 text-left group"
                      >
                        <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center shadow-sm shrink-0`}><Icon className="w-5 h-5" /></div>
                        <div className="min-w-0"><h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-violet-700 dark:group-hover:text-violet-300 truncate">{action.title}</h4><p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{action.desc}</p></div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Ferramentas e conta</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {utilities.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} type="button" onClick={() => runUtility(item.run)} className="min-h-[104px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#09090B] hover:border-violet-400/50 p-3 text-left">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-[#7C3AED] dark:text-[#A78BFA] flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></div>
                        <div className="mt-2 text-[10px] font-black text-slate-800 dark:text-slate-100">{item.title}</div>
                        <div className="mt-0.5 text-[8px] leading-relaxed text-slate-400">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="orbidoc-fab-footer p-4 border-t border-slate-100 dark:border-[#27272A] shrink-0">
              <button type="button" onClick={onClose} className="w-full h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold">Fechar</button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};
