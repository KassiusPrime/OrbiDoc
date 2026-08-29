import React from 'react';
import { IconClock as Recent, IconCloud as Services, IconFolder as Files, IconHome as Home, IconSettings as Settings } from '@tabler/icons-react';

export type HostDestination = 'home' | 'projects' | 'services' | 'history' | 'settings';

type Props = { active: HostDestination | string; onNavigate: (destination: HostDestination) => void };

const ITEMS = [
  { id: 'home' as const, label: 'Início', icon: Home },
  { id: 'projects' as const, label: 'Arquivos', icon: Files },
  { id: 'services' as const, label: 'Serviços', icon: Services },
  { id: 'history' as const, label: 'Recentes', icon: Recent },
  { id: 'settings' as const, label: 'Ajustes', icon: Settings },
];

export const HostBottomNav: React.FC<Props> = ({ active, onNavigate }) => <nav className="orbidoc-bottom-nav lg:hidden fixed left-0 right-0 bottom-0 z-40 border-t border-[#DCE3EE] dark:border-slate-800 bg-white/96 dark:bg-[#101827]/96 backdrop-blur-xl pb-[max(8px,env(safe-area-inset-bottom))]" aria-label="Navegação principal">
  <div className="max-w-xl mx-auto grid grid-cols-5 px-1 pt-1.5">
    {ITEMS.map((item) => { const Icon = item.icon; const selected = active === item.id; return <button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={selected ? 'page' : undefined} className={`min-h-[54px] rounded-xl flex flex-col items-center justify-center gap-1 text-[9px] font-black ${selected ? 'text-[#3157F6] dark:text-[#7AA2FF] bg-[#E8EEFF]/55 dark:bg-[#0D1E5B]/35' : 'text-slate-500 dark:text-slate-400'}`}><Icon className="w-4.5 h-4.5" /><span>{item.label}</span></button>; })}
  </div>
</nav>;
