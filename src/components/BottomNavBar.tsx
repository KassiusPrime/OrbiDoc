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

type NavigationTab = {
  kind: 'navigation';
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type FabTab = {
  kind: 'fab';
  id: 'fab';
  label: 'Criar';
  icon: typeof IconPlus;
};

type BottomTab = NavigationTab | FabTab;

const TABS: BottomTab[] = [
  { kind: 'navigation', id: 'home', label: 'Início', icon: IconHome },
  { kind: 'navigation', id: 'projects', label: 'Arquivos', icon: IconFolder },
  { kind: 'fab', id: 'fab', label: 'Criar', icon: IconPlus },
  { kind: 'navigation', id: 'chat', label: 'Assistente', icon: IconRobot },
  { kind: 'navigation', id: 'office', label: 'Apps', icon: IconApps },
];

const spring = { type: 'spring' as const, stiffness: 430, damping: 34, mass: 0.72 };

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
        if (tab.kind === 'fab') {
          return (
            <div key="fab" className="relative -top-3 flex justify-center col-span-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -1 }}
                transition={spring}
                onClick={onOpenFab}
                aria-label="Criar novo"
                className="relative w-14 h-14 rounded-2xl bg-[#3157F6] hover:bg-[#2446D8] text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 border-4 border-white dark:border-[#101827] focus-visible:ring-2 focus-visible:ring-[#7AA2FF] overflow-hidden"
              >
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[inherit] bg-white/0"
                  whileTap={{ backgroundColor: 'rgba(255,255,255,.13)' }}
                />
                <motion.span
                  animate={{ rotate: 0, scale: 1 }}
                  whileTap={{ rotate: 90, scale: 0.9 }}
                  transition={spring}
                  className="relative z-10"
                >
                  <IconPlus className="w-6 h-6 stroke-[2.4]" />
                </motion.span>
              </motion.button>
              <span className="absolute -bottom-4 text-[10px] font-bold text-slate-600 dark:text-slate-300">Criar</span>
            </div>
          );
        }

        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <motion.button
            type="button"
            key={tab.id}
            whileTap={{ scale: 0.93 }}
            transition={spring}
            onClick={() => onNavigate(tab.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
            className="relative min-w-[56px] min-h-[52px] px-2 pt-1 pb-1 flex flex-col items-center justify-center rounded-xl"
          >
            <div className="relative w-10 h-8 rounded-xl flex items-center justify-center">
              {active && (
                <motion.div
                  layoutId="orbidoc-bottom-active-pill"
                  className="absolute inset-0 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/60"
                  transition={spring}
                />
              )}
              <motion.div
                className={`relative z-10 ${active ? 'text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 dark:text-slate-400'}`}
                animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }}
                transition={spring}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
              </motion.div>
            </div>
            <motion.span
              className={`mt-0.5 text-[10px] leading-tight font-semibold ${active ? 'text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 dark:text-slate-400'}`}
              animate={{ opacity: active ? 1 : 0.86 }}
              transition={{ duration: 0.16 }}
            >
              {tab.label}
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  </nav>
);