import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, Plus, FileText, FileSpreadsheet, Presentation, PenTool, 
  Search, Trash2, Edit3, Copy, Sparkles, Clock, ArrowRight,
  Upload, CheckCircle2, ShieldCheck, Tag, ExternalLink, Download, FileCheck, Layers
} from 'lucide-react';
import { TabType, SavedProject } from '../types';

interface ProjectsHubProps {
  onOpenProject: (project: SavedProject) => void;
  onCreateNewProject?: (type: 'word' | 'excel' | 'powerpoint' | 'canva' | 'extract' | 'chat') => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

const DEFAULT_PROJECTS: SavedProject[] = [
  {
    id: 'proj-1',
    title: 'Relatório Técnico e Proposta Comercial 2026',
    type: 'word',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    previewSnippet: 'Proposta de prestação de serviços com cronograma, orçamento detalhado e análise de riscos...',
    thumbnailColor: 'from-blue-600 to-indigo-700',
    tags: ['Comercial', 'Relatório', 'DOCX']
  },
  {
    id: 'proj-2',
    title: 'Balanço Financeiro & Fluxo de Caixa Pro',
    type: 'excel',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    previewSnippet: 'Planilha com fórmulas de SOMA, MÉDIA, projeção de receita trimestral e controle de custos.',
    thumbnailColor: 'from-emerald-600 to-teal-700',
    tags: ['Financeiro', 'Excel', 'XLSX']
  },
  {
    id: 'proj-3',
    title: 'Apresentação Executiva - Pitch de Vendas',
    type: 'powerpoint',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    previewSnippet: 'Deck de 10 slides com capa impactante, indicadores chave de desempenho e visão estratégica.',
    thumbnailColor: 'from-amber-500 to-orange-600',
    tags: ['Apresentação', 'Slides', 'PPTX']
  },
  {
    id: 'proj-4',
    title: 'Banner Promocional & Redes Sociais',
    type: 'canva',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    previewSnippet: 'Design gráfico visual com paleta de cores corporativa, formas vetoriais e tipografia.',
    thumbnailColor: 'from-pink-500 to-purple-600',
    tags: ['Design', 'Marketing', 'Canva']
  },
  {
    id: 'proj-5',
    title: 'Digitalização de Contrato de Prestação (OCR)',
    type: 'extract',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    previewSnippet: 'Texto extraído via Tesseract OCR de documento PDF escaneado com alta precisão.',
    thumbnailColor: 'from-cyan-600 to-blue-800',
    tags: ['OCR', 'PDF', 'Leitura']
  }
];

export const ProjectsHub: React.FC<ProjectsHubProps> = ({
  onOpenProject,
  onCreateNewProject,
  showNotification
}) => {
  const [projects, setProjects] = useState<SavedProject[]>(() => {
    try {
      const saved = localStorage.getItem('docswiss_projects_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_PROJECTS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('docswiss_projects_v1', JSON.stringify(projects));
    } catch {
      // ignore storage error
    }
  }, [projects]);

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja apagar este projeto da sua biblioteca?')) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (showNotification) showNotification('Projeto removido da biblioteca com sucesso.');
    }
  };

  const handleDuplicateProject = (e: React.MouseEvent, project: SavedProject) => {
    e.stopPropagation();
    const duplicated: SavedProject = {
      ...project,
      id: `proj-${Date.now()}`,
      title: `${project.title} (Cópia)`,
      updatedAt: new Date().toISOString(),
    };
    setProjects((prev) => [duplicated, ...prev]);
    if (showNotification) showNotification(`Cópia de "${project.title}" criada!`);
  };

  const handleSaveTitle = (id: string) => {
    if (!editTitleValue.trim()) {
      setEditingTitleId(null);
      return;
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: editTitleValue.trim(), updatedAt: new Date().toISOString() } : p))
    );
    setEditingTitleId(null);
    if (showNotification) showNotification('Título do projeto atualizado!');
  };

  const filteredProjects = projects.filter((p) => {
    const matchesFilter = selectedFilter === 'all' || p.type === selectedFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.previewSnippet?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const getTypeBadge = (type: SavedProject['type']) => {
    switch (type) {
      case 'word':
        return { label: 'Word Pro (.docx)', color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: FileText };
      case 'excel':
        return { label: 'Excel Pro (.xlsx)', color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: FileSpreadsheet };
      case 'powerpoint':
        return { label: 'PowerPoint (.pptx)', color: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Presentation };
      case 'canva':
        return { label: 'Canva Design (.canva)', color: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800', icon: PenTool };
      case 'extract':
        return { label: 'OCR & PDF (.pdf)', color: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800', icon: FileCheck };
      default:
        return { label: 'Documento', color: 'bg-slate-100 text-slate-700', icon: FileText };
    }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      
      {/* Top Banner - Canva Style Projects Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              DocSwiss Studio — Meus Projetos & Arquivos
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-black/20 px-3 py-1 rounded-full border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Salvo Localmente & Sincronizado</span>
            </div>
          </div>

          <div className="max-w-2xl space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              O que você gostaria de criar hoje?
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Clique em qualquer projeto abaixo para abrir em uma <strong>Página de Edição Dedicada</strong> em tela cheia, ou crie um novo documento instantaneamente.
            </p>
          </div>

          {/* New Project Quick Creation Cards */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <button
              onClick={() => onCreateNewProject?.('word')}
              className="group p-3.5 rounded-2xl bg-white/10 hover:bg-blue-600/30 border border-white/15 hover:border-blue-400/50 backdrop-blur-md transition-all text-left flex flex-col justify-between space-y-3 hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-blue-200 flex items-center justify-between">
                  <span>Novo Word Pro</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-300">Documento .docx</div>
              </div>
            </button>

            <button
              onClick={() => onCreateNewProject?.('excel')}
              className="group p-3.5 rounded-2xl bg-white/10 hover:bg-emerald-600/30 border border-white/15 hover:border-emerald-400/50 backdrop-blur-md transition-all text-left flex flex-col justify-between space-y-3 hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-emerald-200 flex items-center justify-between">
                  <span>Nova Planilha</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-300">Excel Pro .xlsx</div>
              </div>
            </button>

            <button
              onClick={() => onCreateNewProject?.('powerpoint')}
              className="group p-3.5 rounded-2xl bg-white/10 hover:bg-amber-600/30 border border-white/15 hover:border-amber-400/50 backdrop-blur-md transition-all text-left flex flex-col justify-between space-y-3 hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                <Presentation className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-amber-200 flex items-center justify-between">
                  <span>Novos Slides</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-300">PowerPoint .pptx</div>
              </div>
            </button>

            <button
              onClick={() => onCreateNewProject?.('canva')}
              className="group p-3.5 rounded-2xl bg-white/10 hover:bg-pink-600/30 border border-white/15 hover:border-pink-400/50 backdrop-blur-md transition-all text-left flex flex-col justify-between space-y-3 hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-md">
                <PenTool className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-pink-200 flex items-center justify-between">
                  <span>Novo Canva</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-300">Design Visual .canva</div>
              </div>
            </button>

            <button
              onClick={() => onCreateNewProject?.('extract')}
              className="group p-3.5 rounded-2xl bg-white/10 hover:bg-cyan-600/30 border border-white/15 hover:border-cyan-400/50 backdrop-blur-md transition-all text-left flex flex-col justify-between space-y-3 hover:scale-[1.02] active:scale-95 shadow-lg col-span-2 sm:col-span-1"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-200 flex items-center justify-between">
                  <span>Novo OCR & PDF</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-300">Escaneamento .pdf</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Todos os Projetos' },
            { id: 'word', label: 'Word Pro (.docx)' },
            { id: 'excel', label: 'Excel Pro (.xlsx)' },
            { id: 'powerpoint', label: 'PowerPoint (.pptx)' },
            { id: 'canva', label: 'Canva Design' },
            { id: 'extract', label: 'OCR & PDFs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nos meus projetos..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Projects Grid View */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Projetos Salvos ({filteredProjects.length})
          </h2>
          <span className="text-xs text-slate-400">Clique em qualquer item para abrir a Página do Documento</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum projeto encontrado</h3>
            <p className="text-xs text-slate-500">Tente ajustar a busca ou selecione "Todos os Projetos".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => {
              const badge = getTypeBadge(project.type);
              const BadgeIcon = badge.icon;
              const isEditingThisTitle = editingTitleId === project.id;

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project)}
                  className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between hover:-translate-y-1"
                >
                  {/* Top Color Thumbnail Strip */}
                  <div className={`h-24 bg-gradient-to-r ${project.thumbnailColor || 'from-indigo-600 to-purple-600'} p-4 flex flex-col justify-between relative overflow-hidden`}>
                    <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                      <BadgeIcon className="w-32 h-32 text-white" />
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${badge.color} shadow-sm flex items-center gap-1`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md p-1 rounded-lg">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleId(project.id);
                            setEditTitleValue(project.title);
                          }}
                          className="p-1 hover:bg-white/20 rounded text-white"
                          title="Renomear"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => handleDuplicateProject(e, project)}
                          className="p-1 hover:bg-white/20 rounded text-white"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => handleDeleteProject(e, project.id)}
                          className="p-1 hover:bg-red-500 rounded text-white"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-white/80 font-medium flex items-center gap-1 relative z-10">
                      <Clock className="w-3 h-3" />
                      Modificado {new Date(project.updatedAt).toLocaleDateString('pt-BR')} às {new Date(project.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      {isEditingThisTitle ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editTitleValue}
                            onChange={(e) => setEditTitleValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(project.id)}
                            className="flex-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-indigo-500 rounded text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTitle(project.id)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs font-bold"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {project.title}
                        </h3>
                      )}

                      {project.previewSnippet && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {project.previewSnippet}
                        </p>
                      )}
                    </div>

                    {/* Tags & Action CTA */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-normal">
                        <Tag className="w-3 h-3" />
                        <span>{project.tags?.join(', ') || 'Documento'}</span>
                      </div>

                      <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Abrir Página do Documento <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
