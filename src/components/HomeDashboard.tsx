import React from 'react';
import {
  IconArrowRight as ArrowRight,
  IconArrowsExchange as ArrowsExchange,
  IconCloud as Cloud,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconFolder as Folder,
  IconLayoutDashboard as LayoutDashboard,
  IconPalette as Palette,
  IconPresentation as Presentation,
  IconSparkles as Sparkles,
  IconWifiOff as WifiOff,
} from '@tabler/icons-react';
import type {
  ChatSession,
  GoogleUserProfile,
  HistoryItem,
  MicrosoftUserProfile,
  SavedProject,
  TabType,
} from '../types';

interface HomeDashboardProps {
  onNavigate: (tab: TabType) => void;
  onNewChat: () => void;
  recentHistory: HistoryItem[];
  recentProjects: SavedProject[];
  recentChats: ChatSession[];
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
  /** @deprecated Nexus AI is unified; retained while older shells migrate. */
  activeEngineLabel: string;
}

const readPersistedProjects = (fallback: SavedProject[]): SavedProject[] => {
  try {
    const saved = localStorage.getItem('orbidoc_projects_v1');
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? parsed as SavedProject[] : fallback;
  } catch {
    return fallback;
  }
};

const relativeDate = (iso?: string): string => {
  if (!iso) return 'Recentemente';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return 'Recentemente';
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 2) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  if (hours < 24) return `Há ${hours} h`;
  if (days < 7) return `Há ${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

const moduleActions: Array<{
  name: string;
  type: string;
  hint: string;
  tab: TabType;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  { name: 'Orbit Nova', type: 'Documento', hint: 'Texto rico · DOCX · PDF', tab: 'word', icon: FileText, accent: 'bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300' },
  { name: 'Orbit Gravity', type: 'Planilha', hint: 'Dados · fórmulas · XLSX', tab: 'excel', icon: FileSpreadsheet, accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300' },
  { name: 'Orbit Aurora', type: 'Apresentação', hint: 'Slides · layouts · PPTX', tab: 'powerpoint', icon: Presentation, accent: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/45 dark:text-fuchsia-300' },
  { name: 'Orbit Comet', type: 'Design', hint: 'Canvas · mídia · export', tab: 'canva', icon: Palette, accent: 'bg-orange-50 text-orange-700 dark:bg-orange-950/45 dark:text-orange-300' },
  { name: 'Orbit Nebula', type: 'PDF & OCR', hint: 'Ler · extrair · converter', tab: 'extract', icon: FileCheck, accent: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/45 dark:text-cyan-300' },
  { name: 'Apps & Converter', type: 'Ferramentas', hint: 'Formatos e utilitários', tab: 'office', icon: ArrowsExchange, accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
];

const projectIcon = (type: SavedProject['type']) => {
  if (type === 'excel') return FileSpreadsheet;
  if (type === 'powerpoint') return Presentation;
  if (type === 'canva') return Palette;
  if (type === 'extract') return FileCheck;
  if (type === 'chat') return Sparkles;
  return FileText;
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  onNewChat,
  recentProjects,
  googleUser,
  microsoftUser,
}) => {
  const projects = readPersistedProjects(recentProjects)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const accountName = googleUser?.name || microsoftUser?.name;
  const firstName = accountName?.split(' ')[0];
  const cloudConnected = Boolean(googleUser || microsoftUser);

  return (
    <div className="space-y-5 pb-8 animate-[fadeIn_0.18s_ease]">
      <section className="orbit-workspace-surface overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Orbit</span><span className="text-slate-300 dark:text-slate-700">/</span><span>Orbispace</span>
            </div>
            <h1 className="orbit-page-title mt-1">{firstName ? `Orbispace de ${firstName}` : 'Seu Orbispace'}</h1>
            <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Arquivos, projetos e ferramentas do OrbiDoc em uma área de trabalho única. Sem banners promocionais e sem trocar de produto entre módulos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onNavigate('projects')} className="h-10 px-3 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111318] text-xs font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Folder className="w-4 h-4" /> Meus arquivos
            </button>
            <button onClick={onNewChat} className="h-10 px-3 rounded-[10px] bg-[#3157F6] hover:bg-[#2446D8] text-white text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Nexus AI
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 sm:px-5 py-2.5 bg-slate-50/70 dark:bg-slate-950/25 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            {cloudConnected ? <Cloud className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
            {cloudConnected ? 'Conta de nuvem vinculada' : 'Núcleo local disponível offline'}
          </span>
          <span>{projects.length} {projects.length === 1 ? 'item recente' : 'itens recentes'}</span>
          <span className="ml-auto hidden md:inline-flex items-center gap-1.5 font-semibold text-slate-500"><Sparkles className="w-3.5 h-3.5 text-[#6750D8]" /> Nexus AI · free-only · modelos internos ocultos</span>
        </div>
      </section>

      <section className="orbit-feature-bar">
        <span className="h-9 w-9 shrink-0 rounded-[10px] bg-[#F2EFFF] dark:bg-[#211B43] text-[#6750D8] dark:text-[#B8AEFF] inline-flex items-center justify-center"><Sparkles className="w-4.5 h-4.5" /></span>
        <div className="orbit-feature-bar__copy">
          <div className="orbit-feature-bar__title">Nexus AI no contexto do Orbispace</div>
          <div className="orbit-feature-bar__description">Pesquisa · análise · documentos · código · arquivos · ações do OrbiDoc</div>
        </div>
        <button onClick={onNewChat} className="h-8 px-2.5 rounded-[8px] text-[10px] font-bold text-[#3157F6] hover:bg-[#EEF3FF] dark:hover:bg-[#111D4A]">Abrir</button>
      </section>

      <section>
        <div className="mb-2.5 px-0.5 flex items-end justify-between gap-3">
          <div>
            <h2 className="orbit-section-title">OrbiDoc</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Comece pela ferramenta certa; o shell permanece o mesmo.</p>
          </div>
          <button onClick={() => onNavigate('office')} className="text-[11px] font-bold text-[#3157F6] inline-flex items-center gap-1">Ver todas <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2.5">
          {moduleActions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.name} onClick={() => onNavigate(item.tab)} className="group min-h-[108px] rounded-[14px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111318] p-3 text-left hover:border-[#7AA2FF] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-9 h-9 rounded-[10px] ${item.accent} flex items-center justify-center`}><Icon className="w-4.5 h-4.5" /></div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#3157F6]" />
                </div>
                <div className="mt-2.5 text-xs font-extrabold">{item.name}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-500">{item.type}</div>
                <div className="mt-0.5 text-[9px] text-slate-400">{item.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-8 orbit-workspace-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-extrabold">Recentes</h2><p className="mt-0.5 text-[10px] text-slate-500">Continue de onde parou.</p></div>
            <button onClick={() => onNavigate('projects')} className="text-[10px] font-bold text-[#3157F6]">Explorar arquivos</button>
          </div>
          {projects.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Folder className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="mt-2.5 text-sm font-bold">Seu Orbispace está vazio</h3>
              <p className="mt-1 text-xs text-slate-500">Crie o primeiro arquivo pelo OrbiDoc ou importe um arquivo existente.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.slice(0, 8).map((project) => {
                const Icon = projectIcon(project.type);
                return (
                  <button key={project.id} onClick={() => onNavigate('projects')} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/45">
                    <div className="w-9 h-9 rounded-[10px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Icon className="w-4 h-4 text-slate-500" /></div>
                    <div className="min-w-0 flex-1"><div className="text-xs sm:text-sm font-bold truncate">{project.title}</div><div className="text-[9px] text-slate-500 mt-0.5">{relativeDate(project.updatedAt)}</div></div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="xl:col-span-4 space-y-3">
          <div className="orbit-workspace-surface p-4">
            <div className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-[#3157F6]" /><h2 className="text-sm font-extrabold">Status do Orbispace</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-[10px] bg-slate-50 dark:bg-slate-900 p-2.5"><div className="text-slate-400">Arquivos locais</div><div className="mt-1 text-base font-bold">{projects.length}</div></div>
              <div className="rounded-[10px] bg-slate-50 dark:bg-slate-900 p-2.5"><div className="text-slate-400">Nuvem</div><div className="mt-1 text-xs font-bold">{cloudConnected ? 'Conectada' : 'Opcional'}</div></div>
            </div>
          </div>
          <button onClick={onNewChat} className="w-full orbit-workspace-surface p-4 text-left hover:border-[#7AA2FF]">
            <div className="flex items-center gap-2 text-[#6750D8]"><Sparkles className="w-4 h-4" /><span className="text-xs font-extrabold">Continuar com Nexus AI</span></div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Abra o assistente sem perder o contexto do seu Orbispace.</p>
          </button>
        </aside>
      </div>
    </div>
  );
};
