import React, { useState } from 'react';
import {
  IconArrowRight as ArrowRight,
  IconArrowsExchange as ArrowsExchange,
  IconChartBar as ChartBar,
  IconChevronLeft as ChevronLeft,
  IconCircleCheck as CheckCircle2,
  IconCloud as Cloud,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconLayoutGrid as Grid,
  IconPhoto as Photo,
  IconPencil as PenTool,
  IconPlus as Plus,
  IconPresentation as Presentation,
  IconSchool as School,
  IconTemplate as Template,
} from '@tabler/icons-react';
import { TabType, MicrosoftUserProfile } from '../types';
import { UniversalConverter } from './UniversalConverter';

export interface OfficeSuiteHubProps {
  onSelectTool?: (tool: TabType) => void;
  onOpenTool?: (tool: TabType) => void;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onLoginMs?: () => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

type HubView = 'apps' | 'converter';

const APPS = [
  {
    id: 'word' as TabType,
    title: 'Documentos',
    subtitle: 'Editor profissional de texto',
    description: 'Relatórios, trabalhos, atas e propostas com estilos, fontes, tabelas, imagens, margens, revisão por IA e exportação.',
    icon: FileText,
    accent: 'bg-blue-600',
    iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    capabilities: ['DOCX', 'PDF', '19 fontes', 'Modelos'],
  },
  {
    id: 'excel' as TabType,
    title: 'Planilhas',
    subtitle: 'Dados, fórmulas e análise',
    description: 'Intervalos, fórmulas, formatação em lote, múltiplas abas, ordenação, gráficos rápidos e importação do Excel/Sheets.',
    icon: FileSpreadsheet,
    accent: 'bg-emerald-600',
    iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    capabilities: ['XLSX', 'CSV', 'Fórmulas', 'Insights'],
  },
  {
    id: 'powerpoint' as TabType,
    title: 'Apresentações',
    subtitle: 'Slides e objetos livres',
    description: 'Slides 16:9 com temas, caixas de texto, imagens, formas, camadas, guias inteligentes, notas e exportação PPTX/PDF.',
    icon: Presentation,
    accent: 'bg-orange-600',
    iconClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
    capabilities: ['PPTX', 'Formas', 'Snap', 'Temas'],
  },
  {
    id: 'canva' as TabType,
    title: 'Design',
    subtitle: 'Estúdio visual livre',
    description: 'Crie peças com 19 fontes, formas, imagens, camadas, atalhos, redimensionamento e guias de alinhamento ao mover objetos.',
    icon: PenTool,
    accent: 'bg-fuchsia-600',
    iconClass: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300',
    capabilities: ['PNG/JPG', '19 fontes', '8 formas', 'Snap'],
  },
  {
    id: 'extract' as TabType,
    title: 'PDF & OCR',
    subtitle: 'Leitura e digitalização',
    description: 'Extraia texto de PDFs e imagens, organize resultados e continue o trabalho em outros aplicativos do OrbiDoc.',
    icon: FileCheck,
    accent: 'bg-cyan-600',
    iconClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
    capabilities: ['PDF', 'OCR', 'Imagem', 'Exportação'],
  },
];

const TEMPLATES = [
  { title: 'Relatório empresarial', detail: 'Resumo executivo, análise e plano de ação', type: 'word' as TabType, icon: FileText },
  { title: 'Trabalho escolar', detail: 'Capa, introdução, desenvolvimento e referências', type: 'word' as TabType, icon: School },
  { title: 'Orçamento e controle', detail: 'Previsto, realizado e variações', type: 'excel' as TabType, icon: FileSpreadsheet },
  { title: 'Pitch de projeto', detail: 'Problema, solução, resultados e próximos passos', type: 'powerpoint' as TabType, icon: Presentation },
  { title: 'Revisão executiva', detail: 'Indicadores, resultados e plano de ação', type: 'powerpoint' as TabType, icon: ChartBar },
  { title: 'Peça visual', detail: 'Canvas livre para post, pôster ou capa', type: 'canva' as TabType, icon: PenTool },
];

export const OfficeSuiteHub: React.FC<OfficeSuiteHubProps> = ({ onSelectTool, onOpenTool, msUser, showNotification }) => {
  const [view, setView] = useState<HubView>('apps');
  const open = (tool: TabType) => { onOpenTool?.(tool); onSelectTool?.(tool); };

  if (view === 'converter') {
    return <div className="space-y-4 animate-[fadeIn_0.2s_ease]"><button onClick={() => setView('apps')} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /> Voltar aos aplicativos</button><UniversalConverter showNotification={showNotification} /></div>;
  }

  return <div className="space-y-6 animate-[fadeIn_0.2s_ease]">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-7 py-6 flex flex-col xl:flex-row xl:items-center gap-5"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><Grid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /><span>Workspace de produtividade</span></div><h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">Crie o trabalho inteiro no OrbiDoc</h1><p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">Documentos, dados, apresentações, design, PDF e conversão trabalham como uma suíte única para tarefas escolares e empresariais.</p></div><div className="flex flex-col sm:flex-row gap-2.5"><button onClick={() => setView('converter')} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold flex items-center justify-center gap-2"><ArrowsExchange className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" /> Converter arquivos</button><button onClick={() => open('word')} className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm"><Plus className="w-4.5 h-4.5" /> Novo documento</button></div></div>
      <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-7 py-3 bg-slate-50/70 dark:bg-slate-950/30 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Editores locais disponíveis sem login</span><span className="inline-flex items-center gap-1.5"><ArrowsExchange className="w-4 h-4 text-indigo-500" /> DOCX · XLSX · PPTX · PDF · PNG · JPG · WebP · AVIF e mais</span>{msUser && <span className="inline-flex items-center gap-1.5"><Cloud className="w-4 h-4 text-blue-500" /> Microsoft: {msUser.email}</span>}</div>
    </section>

    <section><div className="mb-3 px-1"><h2 className="text-base font-black text-slate-900 dark:text-white">Aplicativos</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cada editor possui recursos próprios, mas compartilha fontes, identidade e fluxos do workspace.</p></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">{APPS.map((app) => { const Icon = app.icon; return <button key={app.id} onClick={() => open(app.id)} className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-left overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"><div className={`absolute inset-x-0 top-0 h-1 ${app.accent}`} /><div className="p-4 pt-5"><div className="flex items-start justify-between gap-3"><div className={`w-11 h-11 rounded-xl ${app.iconClass} flex items-center justify-center`}><Icon className="w-5 h-5" /></div><ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" /></div><div className="mt-4 text-sm font-black text-slate-900 dark:text-white">{app.title}</div><div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{app.subtitle}</div><p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[64px]">{app.description}</p><div className="mt-3 flex flex-wrap gap-1">{app.capabilities.map((capability) => <span key={capability} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{capability}</span>)}</div></div></button>; })}</div></section>

    <section className="grid grid-cols-1 xl:grid-cols-12 gap-4"><div className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"><Template className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Começar com uma estrutura pronta</h2><p className="text-[11px] text-slate-500 dark:text-slate-400">Os próprios editores oferecem modelos especializados para tarefas comuns.</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2">{TEMPLATES.map((template) => { const Icon = template.icon; return <button key={template.title} onClick={() => open(template.type)} className="p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 sm:[&:nth-child(odd)]:border-r"><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"><Icon className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{template.title}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{template.detail}</div></div><ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500" /></button>; })}</div></div><button onClick={() => setView('converter')} className="xl:col-span-4 rounded-3xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-5 text-left hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"><div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><ArrowsExchange className="w-5 h-5" /></div><h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">Conversão universal</h2><p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Transforme documentos, planilhas e imagens em lote e continue trabalhando no formato que fizer mais sentido.</p><div className="mt-4 inline-flex items-center gap-2 text-xs font-black text-indigo-700 dark:text-indigo-300">Abrir conversor <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></div></button></section>

    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><Photo className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div><div><h3 className="text-sm font-black text-slate-900 dark:text-white">Compatibilidade e fidelidade continuam explícitas</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">O OrbiDoc preserva recursos editáveis quando o formato suporta isso e informa quando uma exportação precisa simplificar algo. O objetivo é produzir trabalho utilizável, não apenas imitar a aparência de outra suíte.</p></div></div></section>
  </div>;
};
