import React, { useMemo } from 'react';
import {
  IconChartBar as ChartBar,
  IconClock as Clock,
  IconFile as File,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconHistory as History,
  IconPencil as Pencil,
  IconPresentation as Presentation,
} from '@tabler/icons-react';
import { HistoryItem, SavedProject } from '../types';

interface AnalyticsWorkspaceProps {
  projects: SavedProject[];
  history: HistoryItem[];
}

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  word: { label: 'Documentos', icon: FileText },
  excel: { label: 'Planilhas', icon: FileSpreadsheet },
  powerpoint: { label: 'Apresentações', icon: Presentation },
  canva: { label: 'Designs', icon: Pencil },
  extract: { label: 'PDF / OCR', icon: FileCheck },
  chat: { label: 'Conversas', icon: File },
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
};

export const AnalyticsWorkspace: React.FC<AnalyticsWorkspaceProps> = ({ projects, history }) => {
  const metrics = useMemo(() => {
    const now = Date.now();
    const last7 = now - 7 * 86_400_000;
    const last30 = now - 30 * 86_400_000;
    const recent7 = projects.filter((project) => new Date(project.updatedAt).getTime() >= last7).length;
    const recent30History = history.filter((item) => new Date(item.timestamp).getTime() >= last30).length;
    const byType = projects.reduce<Record<string, number>>((acc, project) => {
      acc[project.type] = (acc[project.type] || 0) + 1;
      return acc;
    }, {});
    const historyByType = history.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    const updated = projects.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const oldest = projects.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    return { recent7, recent30History, byType, historyByType, updated, oldest };
  }, [projects, history]);

  const maxType = Math.max(1, ...Object.values(metrics.byType));

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><ChartBar className="w-4 h-4" /> Analytics do workspace</div>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Dados reais da sua biblioteca local</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">Nada aqui usa números simulados: os indicadores abaixo são derivados dos projetos e do histórico presentes neste dispositivo.</p>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={File} label="Projetos" value={String(projects.length)} hint="biblioteca local" />
        <Metric icon={History} label="Histórico" value={String(history.length)} hint="registros locais" />
        <Metric icon={Clock} label="Ativos em 7 dias" value={String(metrics.recent7)} hint="projetos modificados" />
        <Metric icon={ChartBar} label="Atividades em 30 dias" value={String(metrics.recent30History)} hint="eventos do histórico" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-black">Biblioteca por tipo</h2><p className="text-[10px] text-slate-500 mt-0.5">Quantidade real de projetos salvos.</p></div>
          <div className="p-5 space-y-4">
            {Object.entries(TYPE_META).filter(([type]) => type !== 'chat').map(([type, meta]) => {
              const Icon = meta.icon;
              const count = metrics.byType[type] || 0;
              return <div key={type}><div className="flex items-center gap-2 text-xs"><Icon className="w-4 h-4 text-indigo-500" /><span className="font-bold text-slate-700 dark:text-slate-200">{meta.label}</span><strong className="ml-auto">{count}</strong></div><div className="mt-1.5 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${count ? Math.max(4, count / maxType * 100) : 0}%` }} /></div></div>;
            })}
          </div>
        </section>

        <section className="xl:col-span-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-black">Atividade registrada</h2><p className="text-[10px] text-slate-500 mt-0.5">Tipos presentes no histórico.</p></div>
          <div className="p-5 grid grid-cols-2 gap-3">{Object.entries(metrics.historyByType).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, count]) => <div key={type} className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3"><div className="text-[10px] uppercase font-black tracking-wide text-slate-400">{type}</div><div className="mt-1 text-xl font-black text-slate-900 dark:text-white">{count}</div></div>)}</div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div><h2 className="text-sm font-black">Modificados recentemente</h2><p className="text-[10px] text-slate-500 mt-0.5">Últimos projetos na biblioteca.</p></div>{metrics.oldest && <span className="hidden sm:inline text-[10px] text-slate-400">Biblioteca desde {new Date(metrics.oldest.createdAt).toLocaleDateString('pt-BR')}</span>}</div>
        {metrics.updated.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{metrics.updated.slice(0, 10).map((project) => { const meta = TYPE_META[project.type] || TYPE_META.chat; const Icon = meta.icon; return <div key={project.id} className="px-5 py-3.5 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></div><div className="min-w-0 flex-1"><div className="text-xs font-bold truncate">{project.title}</div><div className="text-[10px] text-slate-400 mt-0.5">{meta.label}</div></div><div className="text-[10px] text-slate-400 text-right">{formatDate(project.updatedAt)}</div></div>; })}</div> : <div className="p-10 text-center text-xs text-slate-400">Nenhum projeto salvo ainda.</div>}
      </section>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string }> = ({ icon: Icon, label, value, hint }) => <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><Icon className="w-5 h-5 text-indigo-500" /><div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</div><div className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</div><div className="mt-0.5 text-[10px] text-slate-400">{hint}</div></div>;
