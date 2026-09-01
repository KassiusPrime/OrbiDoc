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

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onNavigate, onOpenFab }) => (
  <nav
    aria-label="Navegação principal"
    className="orbidoc-bottom-nav orbit-mobile-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/98 dark:bg-[#111318]/98 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1.5 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
  >
    <div className="max-w-lg mx-auto grid grid-cols-5 items-center justify-items-center">
      {TABS.map((tab) => {
        if (tab.kind === 'fab') {
          return (
            <motion.button
              key="fab"
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={spring}
              onClick={onOpenFab}
              aria-label="Criar novo"
              className="min-w-[58px] min-h-[54px] px-2 flex flex-col items-center justify-center rounded-[12px] text-[#3157F6] dark:text-[#7AA2FF]"
            >
              <span className="w-10 h-8 rounded-[10px] bg-[#3157F6] text-white flex items-center justify-center shadow-sm">
                <IconPlus className="w-5 h-5 stroke-[2.3]" />
              </span>
              <span className="mt-0.5 text-[10px] leading-tight font-semibold">Criar</span>
            </motion.button>
          );
        }

        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <motion.button
            type="button"
            key={tab.id}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            onClick={() => onNavigate(tab.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
            className={`min-w-[58px] min-h-[54px] px-2 flex flex-col items-center justify-center rounded-[12px] ${active ? 'text-[#3157F6] dark:text-[#7AA2FF]' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <span className={`w-10 h-8 rounded-[10px] flex items-center justify-center ${active ? 'bg-[#EEF3FF] dark:bg-[#111D4A]' : ''}`}>
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
            </span>
            <span className="mt-0.5 text-[10px] leading-tight font-semibold">{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  </nav>
);
