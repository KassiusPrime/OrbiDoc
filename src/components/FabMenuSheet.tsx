import React from 'react';
import {
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconLayoutGrid as Design,
  IconPresentation as Presentation,
  IconRobot as Robot,
  IconSparkles as Sparkles,
  IconX as X,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import { TabType } from '../types';

interface FabMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (tab: TabType, extraAction?: string) => void;
}

const ACTIONS = [
  {
    id: 'word',
    tab: 'word' as TabType,
    title: 'Novo documento',
    desc: 'Texto, DOCX, PDF e assistência de IA',
    icon: FileText,
    color: 'bg-blue-600 text-white',
  },
  {
    id: 'excel',
    tab: 'excel' as TabType,
    title: 'Nova planilha',
    desc: 'Dados, fórmulas, XLSX e CSV',
    icon: FileSpreadsheet,
    color: 'bg-emerald-600 text-white',
  },
  {
    id: 'powerpoint',
    tab: 'powerpoint' as TabType,
    title: 'Nova apresentação',
    desc: 'Slides, layouts e exportação PPTX',
    icon: Presentation,
    color: 'bg-orange-600 text-white',
  },
  {
    id: 'canva',
    tab: 'canva' as TabType,
    title: 'Novo design',
    desc: 'Peças visuais e composição gráfica',
    icon: Design,
    color: 'bg-fuchsia-600 text-white',
  },
  {
    id: 'extract',
    tab: 'extract' as TabType,
    title: 'PDF & OCR',
    desc: 'Digitalizar, extrair e organizar conteúdo',
    icon: FileCheck,
    color: 'bg-cyan-600 text-white',
  },
  {
    id: 'chat',
    tab: 'chat' as TabType,
    title: 'Novo chat com IA',
    desc: 'Use o modelo disponível selecionado no OrbiDoc',
    icon: Robot,
    color: 'bg-[#6D5EF7] text-white',
  },
] as const;

export const FabMenuSheet: React.FC<FabMenuSheetProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => (
  <AnimatePresence>
    {isOpen ? (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#080D18]/65 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="orbidoc-quick-create-title"
          className="relative z-10 w-full max-w-lg bg-white dark:bg-[#101827] rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800"
        >
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/60 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="orbidoc-quick-create-title" className="font-black text-slate-900 dark:text-slate-100 text-base">Criar no OrbiDoc</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Escolha o tipo de trabalho e abra diretamente no editor correspondente.</p>
            </div>
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center" aria-label="Fechar criação rápida">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => {
                    onSelectAction(action.tab);
                    onClose();
                  }}
                  className="p-3.5 bg-slate-50 dark:bg-[#080D18]/55 hover:bg-[#EFF4FF] dark:hover:bg-[#0D1E5B]/35 border border-slate-200/70 dark:border-slate-700/70 hover:border-[#3157F6]/35 rounded-2xl flex items-center gap-3 text-left group"
                >
                  <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center shadow-sm shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-[#3157F6] dark:group-hover:text-[#7AA2FF] truncate">{action.title}</h4>
                    <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{action.desc}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button type="button" onClick={onClose} className="mt-4 w-full h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold">
            Cancelar
          </button>
        </motion.div>
      </div>
    ) : null}
  </AnimatePresence>
);
