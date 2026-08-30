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

type ActionTab = {
  kind: 'action';
  id: 'create';
  label: 'Criar';
  icon: typeof IconPlus;
};

type BottomTab = NavigationTab | ActionTab;

const TABS: BottomTab[] = [
  { kind: 'navigation', id: 'home', label: 'Início', icon: IconHome },
  { kind: 'navigation', id: 'projects', label: 'Arquivos', icon: IconFolder },
  { kind: 'action', id: 'create', label: 'Criar', icon: IconPlus },
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
    className="orbidoc-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/96 dark:bg-[#101827]/96 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-8px_24px_rgba(15,23,42,0.07)] px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))]"
  >
    <div className="max-w-lg mx-auto grid grid-cols-5 items-stretch justify-items-stretch gap-0.5">
      {TABS.map((tab) => {
        if (tab.kind === 'action') {
          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={spring}
              onClick={onOpenFab}
              aria-label="Criar ou abrir ferramentas"
              className="relative min-w-0 min-h-[54px] px-1 py-1 flex flex-col items-center justify-center rounded-xl text-[#3157F6] dark:text-[#7AA2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3157F6] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#101827]"
            >
              <span className="w-10 h-8 rounded-xl bg-[#3157F6] text-white flex items-center justify-center shadow-sm shadow-[#3157F6]/20">
                <IconPlus className="w-5 h-5 stroke-[2.4]" />
              </span>
              <span className="mt-0.5 text-[10px] leading-tight font-bold">Criar</span>
            </motion.button>
          );
        }

        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <motion.button
            type="button"
            key={tab.id}
            whileTap={{ scale: 0.94 }}
            transition={spring}
            onClick={() => onNavigate(tab.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
            className="relative min-w-0 min-h-[54px] px-1 py-1 flex flex-col items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3157F6] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#101827]"
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
                animate={{ y: active ? -1 : 0, scale: active ? 1.04 : 1 }}
                transition={spring}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
              </motion.div>
            </div>
            <motion.span
              className={`mt-0.5 text-[10px] leading-tight font-semibold truncate max-w-full ${active ? 'text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 dark:text-slate-400'}`}
              animate={{ opacity: active ? 1 : 0.88 }}
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