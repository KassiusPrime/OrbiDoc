import React from 'react';
import {
  IconArrowRight as ArrowRight,
  IconCloud as Cloud,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconFolder as Folder,
  IconPalette as Palette,
  IconPresentation as Presentation,
  IconSparkles as Sparkles,
  IconWifiOff as WifiOff,
} from '@tabler/icons-react';
import type { GoogleUserProfile, MicrosoftUserProfile, SavedProject, TabType } from '../types';

interface HomeDashboardProps {
  onNavigate: (tab: TabType) => void;
  onNewChat: () => void;
  recentHistory: unknown[];
  recentProjects: SavedProject[];
  recentChats: unknown[];
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
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
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 2) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  if (hours < 24) return `Há ${hours} h`;
  if (days < 7) return `Há ${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

const projectIcon = (type: SavedProject['type']) => {
  if (type === 'excel') return FileSpreadsheet;
  if (type === 'powerpoint') return Presentation;
  if (type === 'canva') return Palette;
  if (type === 'extract') return FileCheck;
  if (type === 'chat') return Sparkles;
  return FileText;
};

const quickCreate: Array<{ type: SavedProject['type']; label: string; tab: TabType; icon: React.ComponentType<{ className?: string }>; tone: string }> = [
  { type: 'word', label: 'Documento', tab: 'word', icon: FileText, tone: 'text-blue-400' },
  { type: 'excel', label: 'Planilha', tab: 'excel', icon: FileSpreadsheet, tone: 'text-emerald-400' },
  { type: 'powerpoint', label: 'Apresentação', tab: 'powerpoint', icon: Presentation, tone: 'text-orange-400' },
  { type: 'canva', label: 'Design', tab: 'canva', icon: Palette, tone: 'text-fuchsia-400' },
  { type: 'extract', label: 'PDF & OCR', tab: 'extract', icon: FileCheck, tone: 'text-cyan-400' },
];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate, onNewChat, recentProjects, googleUser, microsoftUser }) => {
  const projects = readPersistedProjects(recentProjects)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const accountName = googleUser?.name || microsoftUser?.name;
  const firstName = accountName?.split(' ')[0];
  const cloudConnected = Boolean(googleUser || microsoftUser);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-500">Orbispace</div>
          <h1 className="mt-1 text-xl font-medium tracking-tight">{firstName ? `Olá, ${firstName}` : 'Seu Orbispace'}</h1>
          <p className="mt-1 text-xs text-slate-500">Continue de onde parou ou crie um arquivo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onNavigate('office')} className="h-9 rounded-lg border border-slate-700/60 px-3 text-xs font-medium text-slate-300 hover:bg-white/5">
            Criar <span className="ml-1 text-slate-500">⌄</span>
          </button>
          <button type="button" onClick={onNewChat} className="h-9 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 text-xs font-medium text-violet-300 hover:bg-violet-500/10">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />Nexus AI
          </button>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Continuar</h2>
          <button type="button" onClick={() => onNavigate('projects')} className="text-[11px] font-medium text-slate-500 hover:text-slate-300">Ver arquivos</button>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800/80 px-5 py-12 text-center">
            <Folder className="mx-auto h-8 w-8 text-slate-700" />
            <h3 className="mt-3 text-sm font-medium">Nenhum arquivo</h3>
            <p className="mt-1 text-xs text-slate-500">Crie um documento para começar.</p>
            <button type="button" onClick={() => onNavigate('word')} className="mt-4 h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500">
              Criar documento
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/6 overflow-hidden rounded-xl border border-white/6">
            {projects.slice(0, 10).map((project) => {
              const Icon = projectIcon(project.type);
              const status = project.type === 'chat' ? 'Conversa' : project.type === 'word' ? 'Documento' : project.type === 'excel' ? 'Planilha' : project.type === 'powerpoint' ? 'Apresentação' : project.type === 'extract' ? 'PDF & OCR' : 'Design';
              return (
                <button key={project.id} type="button" onClick={() => onNavigate('projects')} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-white/[0.04]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-slate-500"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-200">{project.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{status} · {relativeDate(project.updatedAt)}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-700 transition-colors group-hover:text-slate-400" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 text-sm font-medium">Criar rápido</div>
        <div className="flex max-w-full flex-wrap gap-2">
          {quickCreate.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.type} type="button" onClick={() => onNavigate(item.tab)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 text-[11px] font-medium text-slate-400 transition-colors duration-150 hover:border-slate-600 hover:bg-white/5 hover:text-slate-200">
                <Icon className={`h-3.5 w-3.5 ${item.tone}`} />{item.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/6 pt-3 text-[10px] text-slate-500">
        <span>{projects.length} {projects.length === 1 ? 'local' : 'locais'}</span>
        <span className="inline-flex items-center gap-1.5">
          {cloudConnected ? <Cloud className="h-3 w-3 text-slate-500" /> : <WifiOff className="h-3 w-3 text-slate-600" />}
          Nuvem opcional
        </span>
      </div>
    </div>
  );
};
