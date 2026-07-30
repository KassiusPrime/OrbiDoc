import React from 'react';
import { 
  IconHome, IconRobot, IconApps, IconPlus, IconPalette 
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import { TabType } from '../types';

interface BottomNavBarProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
  onOpenFab: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onNavigate,
  onOpenFab,
}) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Início', icon: IconHome },
    { id: 'chat' as TabType, label: 'IA & Chat', icon: IconRobot },
    { id: 'fab', label: 'Criar', icon: IconPlus, isFab: true },
    { id: 'office' as TabType, label: 'Documentos', icon: IconApps },
    { id: 'image' as TabType, label: 'Estúdio IA', icon: IconPalette },
  ];

  return (
    <nav
      aria-label="Navegação Principal"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-xl px-2 py-1.5 transition-colors duration-200"
    >
      <div className="max-w-lg mx-auto grid grid-cols-5 items-center justify-items-center relative">
        {tabs.map((t) => {
          if (t.isFab) {
            return (
              <div key="fab" className="relative -top-4 flex justify-center items-center col-span-1">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={onOpenFab}
                  aria-label="Ações Rápidas (Criar Novo Chat, Documento ou Digitalizar)"
                  title="Ações Rápidas (Novo Chat, Documento, Scan...)"
                  className="w-[60px] h-[60px] rounded-full bg-[#1976D2] dark:bg-[#1E88E5] text-white flex items-center justify-center shadow-lg shadow-blue-500/30 border-4 border-slate-50 dark:border-[#121212] focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-200"
                >
                  <IconPlus className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                </motion.button>
              </div>
            );
          }

          const isActive = activeTab === t.id;
          const Icon = t.icon;

          return (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id as TabType)}
              aria-label={`Navegar para ${t.label}`}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center py-1 px-2.5 relative min-w-[52px] min-h-[48px] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1976D2] dark:focus-visible:ring-[#1E88E5] active:scale-95 transition-all duration-200"
            >
              <div
                className={`p-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-[#1976D2] dark:text-[#1E88E5]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} aria-hidden="true" />
              </div>

              <span
                className={`text-[12px] font-medium leading-tight mt-0.5 transition-colors duration-200 ${
                  isActive
                    ? 'text-[#1976D2] dark:text-[#1E88E5] font-bold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </span>

              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-[#1976D2] dark:bg-[#1E88E5]"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

