import React from 'react';
import {
  IconArrowRight as ArrowRight,
  IconArrowsExchange as ArrowsExchange,
  IconCloud as Cloud,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconFolder as Folder,
  IconLayoutGrid as LayoutGrid,
  IconPencil as PenTool,
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

const createActions: Array<{
  label: string;
  hint: string;
  tab: TabType;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  { label: 'Documento', hint: 'DOCX e texto rico', tab: 'word', icon: FileText, accent: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  { label: 'Planilha', hint: 'XLSX e dados', tab: 'excel', icon: FileSpreadsheet, accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  { label: 'Apresentação', hint: 'PPTX e slides', tab: 'powerpoint', icon: Presentation, accent: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' },
  { label: 'Design', hint: 'Canvas visual', tab: 'canva', icon: PenTool, accent: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300' },
  { label: 'PDF & OCR', hint: 'Ler e digitalizar', tab: 'extract', icon: FileCheck, accent: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' },
  { label: 'Converter', hint: 'Formatos universais', tab: 'office', icon: ArrowsExchange, accent: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
];

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
    <div className="space-y-6 pb-10 animate-[fadeIn_0.2s_ease]">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F0F11] shadow-sm">
        <div className="px-5 sm:px-7 py-6 sm:py-8 flex flex-col xl:flex-row xl:items-center gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <LayoutGrid className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span>Orbit</span><span className="text-slate-300 dark:text-slate-700">/</span><span>Orbispace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {firstName ? `Olá, ${firstName}` : 'Seu Orbispace'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              OrbiDoc reúne documentos, planilhas, apresentações, dashboards e conversão. Nexus AI conecta essas ferramentas em um único assistente, sem seletor de modelos.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full xl:w-auto">
            <button onClick={() => onNavigate('projects')} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Folder className="w-4 h-4" /> Meus arquivos
            </button>
            <button onClick={onNewChat} className="h-11 px-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-violet-500/20">
              <Sparkles className="w-4 h-4" /> Nexus AI
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-7 py-3 bg-slate-50/70 dark:bg-slate-950/35 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            {cloudConnected ? <Cloud className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
            {cloudConnected ? 'Nuvem disponível' : 'Núcleo local disponível offline'}
          </span>
          <span>{projects.length} {projects.length === 1 ? 'arquivo/projeto' : 'arquivos/projetos'} no Orbispace</span>
          <span className="ml-auto hidden md:inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-300 font-black"><Sparkles className="w-3.5 h-3.5" /> Nexus AI · OpenRouter free-only</span>
        </div>
      </section>

      <section>
        <div className="mb-3 px-1 flex items-end justify-between gap-3">
          <div><h2 className="text-base font-black">OrbiDoc</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Crie, edite, converta e analise sem sair do Orbispace.</p></div>
          <button onClick={() => onNavigate('office')} className="text-xs font-bold text-violet-600 dark:text-violet-400 inline-flex items-center gap-1">Ver todas <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {createActions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => onNavigate(item.tab)} className="group min-h-[116px] rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F0F11] p-3.5 text-left hover:border-violet-300 dark:hover:border-violet-800 hover:shadow-md transition-all">
                <div className={`w-10 h-10 rounded-xl ${item.accent} flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
                <div className="mt-3.5 text-sm font-black group-hover:text-violet-600 dark:group-hover:text-violet-300">{item.label}</div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{item.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-8 overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F0F11] shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div><h2 className="text-base font-black">Recentes</h2><p className="mt-0.5 text-xs text-slate-500">Continue de onde parou.</p></div><button onClick={() => onNavigate('projects')} className="text-xs font-black text-violet-600 dark:text-violet-400">Explorar</button></div>
          {projects.length === 0 ? (
            <div className="px-5 py-12 text-center"><Folder className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" /><h3 className="mt-3 text-sm font-bold">Seu Orbispace está vazio</h3><p className="mt-1 text-xs text-slate-500">Crie o primeiro arquivo no OrbiDoc.</p></div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.slice(0, 7).map((project) => (
                <button key={project.id} onClick={() => onNavigate('projects')} className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FileText className="w-4 h-4 text-slate-500" /></div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-bold truncate">{project.title}</div><div className="text-[10px] text-slate-500 mt-0.5">{relativeDate(project.updatedAt)}</div></div><ArrowRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="xl:col-span-4">
          <div className="rounded-[28px] border border-violet-200/70 dark:border-violet-900/70 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-[#0F0F11] p-5 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
            <h2 className="mt-4 text-lg font-black">Nexus AI</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Um assistente único. O Orbit escolhe automaticamente a rota gratuita mais adequada para cada tarefa e mantém os modelos internos fora da interface.</p>
            <button onClick={onNewChat} className="mt-4 w-full h-10 rounded-xl bg-[#7C3AED] hover:bg-violet-700 text-white text-xs font-black inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Abrir Nexus AI</button>
          </div>
        </aside>
      </div>
    </div>
  );
};
