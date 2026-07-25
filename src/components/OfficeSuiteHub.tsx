import React from 'react';
import { 
  FileText, FileSpreadsheet, Presentation, PenTool, ArrowUpRight, 
  ExternalLink, Sparkles, FolderOpen, Plus, Cloud, CheckCircle2, ShieldCheck,
  FileCode, Layers, Cpu, Compass
} from 'lucide-react';
import { TabType, MicrosoftUserProfile } from '../types';

export interface OfficeSuiteHubProps {
  onSelectTool?: (tool: TabType) => void;
  onOpenTool?: (tool: TabType) => void;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onLoginMs?: () => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

export const OfficeSuiteHub: React.FC<OfficeSuiteHubProps> = ({ 
  onSelectTool, 
  onOpenTool,
  msUser, 
  setMsUser,
  onLoginMs,
  showNotification
}) => {
  const handleSelect = (tool: TabType) => {
    if (onOpenTool) onOpenTool(tool);
    if (onSelectTool) onSelectTool(tool);
  };
  const officeTools = [
    {
      id: 'word' as TabType,
      title: 'DocSwiss Word Pro',
      category: 'Processador de Texto',
      icon: FileText,
      color: 'from-blue-600 to-indigo-700',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      description: 'Editor de documentos profissional com formatação rica, tabelas, numeração de páginas, exportação para DOCX, PDF e integração Microsoft Word.',
      templates: ['Relatório Executivo', 'Contrato Comercial', 'Carta de Apresentação', 'Declaração'],
    },
    {
      id: 'excel' as TabType,
      title: 'DocSwiss Excel Pro',
      category: 'Planilhas & Dados',
      icon: FileSpreadsheet,
      color: 'from-emerald-600 to-teal-700',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      description: 'Gradi de planilhas inteligentes com suporte a fórmulas matematicas, soma, média, exportação XLSX/CSV e análise automática com IA.',
      templates: ['Orçamento Mensal', 'Fluxo de Caixa', 'Controle de Estoque', 'Cronograma'],
    },
    {
      id: 'powerpoint' as TabType,
      title: 'DocSwiss PowerPoint Pro',
      category: 'Apresentações IA',
      icon: Presentation,
      color: 'from-amber-500 to-orange-600',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      description: 'Gerador e editor de slides profissional com layouts modernos, temas elegantes, notas do orador e inteligência artificial integrada.',
      templates: ['Pitch Deck de Vendas', 'Apresentação de Projeto', 'Relatório Trimestral', 'Treinamento'],
    },
    {
      id: 'canva' as TabType,
      title: 'DocSwiss Canva Studio',
      category: 'Design & Visual',
      icon: PenTool,
      color: 'from-pink-500 to-purple-600',
      badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
      description: 'Studio de design visual interativo com canvas de desenho, vetores, formas geometrics, texto estilizado e exportação de artes em PNG.',
      templates: ['Banner Promocional', 'Post Redes Sociais', 'Cartão de Visita', 'Infográfico'],
    },
  ].sort((a, b) => a.title.localeCompare(b.title)); // Alphabetically ordered

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      {/* Hero Suite Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 top-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Central Microsoft Office 365 & Design Suite
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Produtividade Completa para PC & Nuvem
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Acesse seus aplicativos profissionais em um ambiente dedicado e otimizado. Crie, edite e exporte projetos do Word, Excel, PowerPoint e Canva Studio com integração nativa ao Microsoft 365 e Google Drive.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {msUser ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-xs font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Conta Microsoft Conectada ({msUser.email})
              </div>
            ) : (
              <button
                onClick={onLoginMs}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg transition-all"
              >
                <Cloud className="w-4 h-4" />
                Conectar Conta Office 365 / OneDrive
              </button>
            )}

            <button
              onClick={() => handleSelect('word')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl text-xs border border-white/20 backdrop-blur-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          </div>
        </div>
      </div>

      {/* Office Applications Suite Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-500" />
            Aplicativos do Suite (Ordem Alfabética)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Clique para abrir a estação de trabalho completa
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {officeTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => handleSelect(tool.id)}
                className="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm hover:shadow-xl border border-slate-200/80 dark:border-slate-800 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.color} text-white flex items-center justify-center shadow-lg`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          {tool.title}
                        </h4>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${tool.badgeColor}`}>
                          {tool.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 transition-all">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tool.description}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Modelos de Início Rápido:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {tool.templates.map((tpl, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 text-[11px] font-medium rounded-lg border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                        >
                          {tpl}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                    Abrir Estação de Trabalho
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Suporta importação & exportação Microsoft
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
