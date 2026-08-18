import React from 'react';
import {
  IconFileText as FileText,
  IconFileSpreadsheet as FileSpreadsheet,
  IconPresentation as Presentation,
  IconPencil as PenTool,
  IconArrowRight as ArrowRight,
  IconPlus as Plus,
  IconCloud as Cloud,
  IconCircleCheck as CheckCircle2,
  IconAlertCircle as AlertCircle,
  IconLayoutGrid as Grid,
  IconTemplate as Template,
  IconFileCheck as FileCheck,
} from '@tabler/icons-react';
import { TabType, MicrosoftUserProfile } from '../types';

export interface OfficeSuiteHubProps {
  onSelectTool?: (tool: TabType) => void;
  onOpenTool?: (tool: TabType) => void;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onLoginMs?: () => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

const APPS = [
  {
    id: 'word' as TabType,
    title: 'Documento',
    subtitle: 'Word Pro',
    description: 'Textos, relatórios, contratos e documentos longos.',
    icon: FileText,
    iconClass: 'bg-blue-600 text-white',
    softClass: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    id: 'excel' as TabType,
    title: 'Planilha',
    subtitle: 'Excel Pro',
    description: 'Tabelas, fórmulas, controles e análises de dados.',
    icon: FileSpreadsheet,
    iconClass: 'bg-emerald-600 text-white',
    softClass: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    id: 'powerpoint' as TabType,
    title: 'Apresentação',
    subtitle: 'PowerPoint Pro',
    description: 'Slides, pitch decks, aulas e apresentações executivas.',
    icon: Presentation,
    iconClass: 'bg-orange-600 text-white',
    softClass: 'bg-orange-50 dark:bg-orange-950/40',
  },
  {
    id: 'canva' as TabType,
    title: 'Design',
    subtitle: 'Canva Studio',
    description: 'Peças visuais, banners, cartões e layouts gráficos.',
    icon: PenTool,
    iconClass: 'bg-fuchsia-600 text-white',
    softClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
  },
  {
    id: 'extract' as TabType,
    title: 'PDF & OCR',
    subtitle: 'Leitor inteligente',
    description: 'Digitalização, leitura e extração de documentos.',
    icon: FileCheck,
    iconClass: 'bg-cyan-600 text-white',
    softClass: 'bg-cyan-50 dark:bg-cyan-950/40',
  },
];

const TEMPLATES = [
  { title: 'Relatório executivo', type: 'word' as TabType, icon: FileText },
  { title: 'Fluxo de caixa', type: 'excel' as TabType, icon: FileSpreadsheet },
  { title: 'Pitch de projeto', type: 'powerpoint' as TabType, icon: Presentation },
  { title: 'Post para redes', type: 'canva' as TabType, icon: PenTool },
];

export const OfficeSuiteHub: React.FC<OfficeSuiteHubProps> = ({
  onSelectTool,
  onOpenTool,
  msUser,
}) => {
  const open = (tool: TabType) => {
    onOpenTool?.(tool);
    onSelectTool?.(tool);
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s_ease]">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Grid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Aplicativos de produtividade</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Central de criação</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Um ponto de entrada único para documentos, planilhas, apresentações, designs e PDFs.
            </p>
          </div>

          <button
            onClick={() => open('word')}
            className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4.5 h-4.5" />
            Novo documento
          </button>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50/60 dark:bg-slate-950/30 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Editores locais disponíveis</span>
          {msUser ? (
            <span className="inline-flex items-center gap-1.5"><Cloud className="w-4 h-4 text-blue-500" /> Microsoft conectado: {msUser.email}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-amber-500" /> Microsoft 365 aguardando OAuth oficial</span>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 px-1">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Aplicativos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Abra uma estação de trabalho dedicada.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {APPS.map((app) => {
            const Icon = app.icon;
            return (
              <button
                key={app.id}
                onClick={() => open(app.id)}
                className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-left overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
              >
                <div className={`${app.softClass} p-4 min-h-[104px] flex items-start justify-between`}>
                  <div className={`w-11 h-11 rounded-xl ${app.iconClass} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{app.title}</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{app.subtitle}</div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{app.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Template className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Começar com um modelo</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Atalhos para os formatos mais comuns.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.title}
                onClick={() => open(template.type)}
                className="p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{template.title}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Abrir editor</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
