import React from 'react';
import {
  IconArrowsExchange as ArrowsExchange,
  IconArrowRight as ArrowRight,
  IconCloud as Cloud,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconFolder as Folder,
  IconLayoutGrid as LayoutGrid,
  IconPencil as PenTool,
  IconPresentation as Presentation,
  IconRobot as Bot,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconWifiOff as WifiOff,
} from '@tabler/icons-react';
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

const projectMeta = (type: SavedProject['type']) => {
  switch (type) {
    case 'word': return { label: 'Documento', icon: FileText, iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' };
    case 'excel': return { label: 'Planilha', icon: FileSpreadsheet, iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' };
    case 'powerpoint': return { label: 'Apresentação', icon: Presentation, iconClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' };
    case 'canva': return { label: 'Design', icon: PenTool, iconClass: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300' };
    case 'extract': return { label: 'PDF / OCR', icon: FileCheck, iconClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' };
    default: return { label: 'Projeto', icon: Folder, iconClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  }
};

const relativeDate = (iso?: string) => {
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
    { label: 'Documento', hint: 'Texto e DOCX', icon: FileText, tab: 'word' as TabType, iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
    { label: 'Planilha', hint: 'Dados e XLSX', icon: FileSpreadsheet, tab: 'excel' as TabType, iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
    { label: 'Apresentação', hint: 'Slides e PPTX', icon: Presentation, tab: 'powerpoint' as TabType, iconClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' },
    { label: 'Design', hint: 'Peças visuais', icon: PenTool, tab: 'canva' as TabType, iconClass: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300' },
    { label: 'PDF & OCR', hint: 'Ler e digitalizar', icon: FileCheck, tab: 'extract' as TabType, iconClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' },
    { label: 'Converter', hint: 'PDF, DOCX, imagens', icon: ArrowsExchange, tab: 'office' as TabType, iconClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' },
  ];

  return (
    <div className="space-y-6 pb-10 animate-[fadeIn_0.2s_ease]">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-7 py-6 sm:py-7 flex flex-col xl:flex-row xl:items-center gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Workspace</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="truncate">{cloudConnected ? 'Conta conectada' : 'Modo local'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {firstName ? `Olá, ${firstName}` : 'Bem-vindo ao DocSwiss'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Seus documentos, conversões e ferramentas em um único ambiente. Comece um arquivo novo ou continue exatamente de onde parou.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full xl:w-auto">
            <button onClick={() => onNavigate('projects')} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold flex items-center justify-center gap-2">
              <Folder className="w-4 h-4" /> Meus arquivos
            </button>
            <button onClick={onNewChat} className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm">
              <Sparkles className="w-4 h-4" /> Perguntar à IA
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-7 py-3 bg-slate-50/70 dark:bg-slate-950/35 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            {cloudConnected ? <Cloud className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
            {cloudConnected ? 'Nuvem disponível' : 'Arquivos locais continuam disponíveis'}
          </span>
          <span>{projects.length} {projects.length === 1 ? 'arquivo/projeto' : 'arquivos/projetos'} na biblioteca</span>
          <span className="ml-auto hidden md:inline text-slate-400">IA selecionada: {activeEngineLabel}</span>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3 px-1">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Criar ou converter</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Escolha o tipo de trabalho; as cores identificam o app, não a página inteira.</p>
          </div>
          <button onClick={() => onNavigate('office')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">Ver central <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {createActions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => onNavigate(item.tab)} className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-left hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all min-h-[116px]">
                <div className={`w-10 h-10 rounded-xl ${item.iconClass} flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
                <div className="mt-3.5 text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{item.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Recentes</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Trabalhos modificados por último.</p>
            </div>
            <button onClick={() => onNavigate('projects')} className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Explorar</button>
          </div>

          {projects.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Folder className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">Sua biblioteca está vazia</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Crie um documento, planilha ou apresentação para começar.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.slice(0, 7).map((project) => {
                const meta = projectMeta(project.type);
                const Icon = meta.icon;
                return (
                  <button key={project.id} onClick={() => onNavigate('projects')} className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                    <div className={`w-10 h-10 rounded-xl ${meta.iconClass} flex items-center justify-center shrink-0`}><Icon className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{project.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2"><span>{meta.label}</span><span>•</span><span>{relativeDate(project.updatedAt)}</span></div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="xl:col-span-4 space-y-4">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 flex items-center justify-center"><Bot className="w-5 h-5" /></div>
              <h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">Assistente DocSwiss</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Pergunte sobre documentos, gere conteúdo, revise texto ou use arquivos como contexto. O app agora identifica o modelo que realmente respondeu e deixa fallback visível.</p>
              <button onClick={onNewChat} className="mt-4 w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Novo chat</button>
            </div>
            {recentChats.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-[11px] text-slate-500 dark:text-slate-400">{recentChats.length} conversa(s) salva(s) no histórico.</div>
            )}
          </div>

          <button onClick={() => onNavigate('office')} className="w-full rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-md group">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"><ArrowsExchange className="w-5 h-5" /></div>
            <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">Conversor universal</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">PDF, DOCX, HTML, TXT, XLSX, CSV, PNG, JPG, WebP e AVIF em uma fila de conversão local.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400">Abrir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5" /></span>
          </button>
        </aside>
      </div>
    </div>
  );
};
