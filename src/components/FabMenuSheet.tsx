import React from 'react';
import { 
  IconRobot, IconScan, IconFileText, IconTable, IconPhoto, IconMicrophone, 
  IconX, IconSparkles, IconPlus
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'motion/react';
import { TabType } from '../types';

interface FabMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (tab: TabType, extraAction?: string) => void;
}

export const FabMenuSheet: React.FC<FabMenuSheetProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  if (!isOpen) return null;

  const actions = [
    {
      id: 'chat',
      tab: 'chat' as TabType,
      title: 'Novo Chat IA',
      desc: 'Gemini 3.6 & ChatGPT-4o',
      icon: IconRobot,
      color: 'bg-indigo-500 text-white dark:bg-indigo-600',
    },
    {
      id: 'extract',
      tab: 'extract' as TabType,
      title: 'Escanear Documento',
      desc: 'PDFs, fotos & comprovantes',
      icon: IconScan,
      color: 'bg-cyan-500 text-white dark:bg-cyan-600',
    },
    {
      id: 'word',
      tab: 'word' as TabType,
      title: 'Novo Documento Word',
      desc: 'Editor completo de texto DOCX',
      icon: IconFileText,
      color: 'bg-blue-500 text-white dark:bg-blue-600',
    },
    {
      id: 'excel',
      tab: 'excel' as TabType,
      title: 'Nova Planilha Excel',
      desc: 'Tabelas, cálculo e exportação',
      icon: IconTable,
      color: 'bg-emerald-500 text-white dark:bg-emerald-600',
    },
    {
      id: 'image',
      tab: 'image' as TabType,
      title: 'Gerar Imagem com IA',
      desc: 'Arte, fotos e edições',
      icon: IconPhoto,
      color: 'bg-purple-500 text-white dark:bg-purple-600',
    },
    {
      id: 'audio',
      tab: 'audio' as TabType,
      title: 'Gravar Áudio / Voz',
      desc: 'Sintetizador e transcrição',
      icon: IconMicrophone,
      color: 'bg-rose-500 text-white dark:bg-rose-600',
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal / Bottom Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <IconSparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                  O que deseja criar?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Escolha uma ação rápida para abrir no OrbiDoc
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {actions.map((act) => (
              <motion.button
                key={act.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  onSelectAction(act.tab);
                  onClose();
                }}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:border-indigo-500/50 rounded-2xl flex items-center gap-3 text-left transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl ${act.color} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                  <act.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {act.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {act.desc}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

