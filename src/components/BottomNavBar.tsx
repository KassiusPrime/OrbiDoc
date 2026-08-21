import React from 'react';
import {
  IconApps,
  IconFolder,
  IconHome,
  IconPlus,
  IconRobot,
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import { TabType } from '../types';

interface BottomNavBarProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
  onOpenFab: () => void;
}

const TABS = [
  { id: 'home' as TabType, label: 'Início', icon: IconHome },
  { id: 'projects' as TabType, label: 'Arquivos', icon: IconFolder },
  { id: 'fab', label: 'Criar', icon: IconPlus, isFab: true },
  { id: 'chat' as TabType, label: 'Assistente', icon: IconRobot },
  { id: 'office' as TabType, label: 'Apps', icon: IconApps },
] as const;

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onNavigate,
  onOpenFab,
}) => (
  <nav
    aria-label="Navegação principal"
    className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#101827]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]"
  >
    <div className="max-w-lg mx-auto grid grid-cols-5 items-end justify-items-center">
      {TABS.map((tab) => {
        if (tab.isFab) {
          return (
            <div key="fab" className="relative -top-3 flex justify-center col-span-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={onOpenFab}
                aria-label="Criar novo"
                className="w-14 h-14 rounded-2xl bg-[#3157F6] hover:bg-[#2446D8] text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 border-4 border-white dark:border-[#101827] focus-visible:ring-2 focus-visible:ring-[#7AA2FF]"
              >
                <IconPlus className="w-6 h-6 stroke-[2.4]" />
              </motion.button>
              <span className="absolute -bottom-4 text-[10px] font-bold text-slate-600 dark:text-slate-300">Criar</span>
            </div>
          );
        }

        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
            className="relative min-w-[56px] min-h-[52px] px-2 pt-1 pb-1 flex flex-col items-center justify-center rounded-xl active:scale-95 transition-transform"
          >
            <div className={`w-9 h-8 rounded-xl flex items-center justify-center transition-colors ${active ? 'bg-[#EFF4FF] dark:bg-[#0D1E5B]/60 text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 dark:text-slate-400'}`}>
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
            </div>
            <span className={`mt-0.5 text-[10px] leading-tight font-semibold ${active ? 'text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 dark:text-slate-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  </nav>
);
