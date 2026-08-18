import React from 'react';
import {
  IconRobot as Bot,
  IconPhotoPlus as ImagePlus,
  IconFolder as Folder,
  IconSparkles as Sparkles,
  IconFileSpreadsheet as FileSpreadsheet,
  IconPresentation as Presentation,
  IconPencil as PenTool,
  IconClock as Clock,
  IconDatabase as HardDrive,
  IconChevronRight as ChevronRight,
  IconEdit as Edit3,
  IconSearch as Search,
  IconCloud as Cloud,
  IconWifiOff as WifiOff,
  IconLayoutGrid as LayoutGrid,
  IconFileCheck as FileCheck,
  IconArrowRight as ArrowRight,
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import {
  TabType,
  HistoryItem,
  SavedProject,
  ChatSession,
  GoogleUserProfile,
  MicrosoftUserProfile,
} from '../types';

interface HomeDashboardProps {
  onNavigate: (tab: TabType) => void;
  onNewChat: () => void;
  recentHistory: HistoryItem[];
  recentProjects: SavedProject[];
  recentChats: ChatSession[];
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
  activeEngineLabel: string;
}

const readPersistedProjects = (fallback: SavedProject[]) => {
  try {
    const saved = localStorage.getItem('docswiss_projects_v1');
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? parsed as SavedProject[] : fallback;
  } catch {
    return fallback;
  }
};

const getProjectMeta = (type: SavedProject['type']) => {
  switch (type) {
    case 'word':
      return { label: 'Documento', icon: Edit3, iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300' };
    case 'excel':
      return { label: 'Planilha', icon: FileSpreadsheet, iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300' };
    case 'powerpoint':
      return { label: 'Apresentação', icon: Presentation, iconClass: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300' };
    case 'canva':
      return { label: 'Design', icon: PenTool, iconClass: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-300' };
    case 'extract':
      return { label: 'PDF / OCR', icon: FileCheck, iconClass: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300' };
    default:
      return { label: 'Projeto', icon: Folder, iconClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  }
};

const formatRelativeDate = (iso?: string) => {
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

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  onNewChat,
  recentHistory,
  recentProjects,
  recentChats,
  googleUser,
  microsoftUser,
  activeEngineLabel,
}) => {
  const projects = readPersistedProjects(recentProjects)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const accountName = googleUser?.name || microsoftUser?.name;
  const firstName = accountName?.split(' ')[0];
  const cloudConnected = Boolean(googleUser || microsoftUser);

  const createActions = [
    { label: 'Documento', description: 'Word Pro', icon: Edit3, tab: 'word' as TabType, className: 'bg-blue-600 text-white' },
    { label: 'Planilha', description: 'Excel Pro', icon: FileSpreadsheet, tab: 'excel' as TabType, className: 'bg-emerald-600 text-white' },
    { label: 'Apresentação', description: 'PowerPoint Pro', icon: Presentation, tab: 'powerpoint' as TabType, className: 'bg-orange-600 text-white' },
    { label: 'Design', description: 'Canva Studio', icon: PenTool, tab: 'canva' as TabType, className: 'bg-fuchsia-600 text-white' },
    { label: 'Digitalizar', description: 'PDF e OCR', icon: FileCheck, tab: 'extract' as TabType, className: 'bg-cyan-600 text-white' },
    { label: 'Imagem com IA', description: 'Estúdio visual', icon: ImagePlus, tab: 'image' as TabType, className: 'bg-violet-600 text-white' },
  ];

  return (
    <div className="space-y-6 pb-10 animate-[fadeIn_0.2s_ease]">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-7 py-5 sm:py-6 flex flex-col xl:flex-row xl:items-center gap-5 xl:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Área de trabalho DocSwiss</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="truncate">{activeEngineLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {firstName ? `Olá, ${firstName}.` : 'Sua área de trabalho.'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Crie, encontre e continue documentos sem sair do mesmo ambiente. Arquivos locais funcionam mesmo sem conta conectada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 xl:w-auto w-full">
            <button
              onClick={() => onNavigate('projects')}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Folder className="w-4.5 h-4.5" />
              Meus arquivos
            </button>
            <button
              onClick={onNewChat}
              className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Sparkles className="w-4.5 h-4.5" />
              Perguntar à IA
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-7 py-3 bg-slate-50/70 dark:bg-slate-950/40 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            {cloudConnected ? <Cloud className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
            {cloudConnected ? 'Conta conectada' : 'Modo local ativo'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <HardDrive className="w-4 h-4 text-indigo-500" />
            {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'} na biblioteca
          </span>
          <button
            onClick={() => onNavigate('history')}
            className="ml-auto text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
          >
            Histórico
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3 px-1">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Criar novo</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Comece direto no formato que você precisa.</p>
          </div>
          <button
            onClick={() => onNavigate('office')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Ver todos
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {createActions.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(item.tab)}
                className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-left hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all min-h-[120px]"
              >
                <div className={`w-10 h-10 rounded-xl ${item.className} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Arquivos recentes</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Continue de onde parou.</p>
            </div>
            <button
              onClick={() => onNavigate('projects')}
              className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Explorar
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Folder className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">Sua biblioteca está vazia</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Crie um documento para ele aparecer aqui.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.slice(0, 6).map((project) => {
                const meta = getProjectMeta(project.type);
                const Icon = meta.icon;
                return (
                  <button
                    key={project.id}
                    onClick={() => onNavigate(project.type as TabType)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${meta.iconClass} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {project.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{meta.label}</span>
                        <span>•</span>
                        <span>{formatRelativeDate(project.updatedAt)}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="xl:col-span-4 space-y-5">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white">Assistente</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">IA dentro do seu fluxo de trabalho.</p>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={onNewChat}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white p-4 text-left transition-colors"
              >
                <Bot className="w-5 h-5" />
                <div className="font-bold text-sm mt-3">Novo chat com IA</div>
                <div className="text-xs text-indigo-100 mt-0.5">Analise documentos, escreva e revise conteúdo.</div>
              </button>
              <button
                onClick={() => onNavigate('ai')}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
              >
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Studio de texto</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Resumir, melhorar e traduzir</div>
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Atividade</h2>
            </div>
            <div className="p-4 space-y-3">
              {recentChats[0] ? (
                <button onClick={() => onNavigate('chat')} className="w-full text-left group">
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">CHAT RECENTE</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{recentChats[0].title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{formatRelativeDate(recentChats[0].updatedAt)}</div>
                </button>
              ) : recentHistory[0] ? (
                <button onClick={() => onNavigate('history')} className="w-full text-left group">
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">ÚLTIMA ATIVIDADE</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{recentHistory[0].title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{recentHistory[0].summary}</div>
                </button>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">Nenhuma atividade registrada ainda.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
