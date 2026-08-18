import React, { useMemo, useState, useEffect } from 'react';
import {
  IconFolderOpen as FolderOpen,
  IconPlus as Plus,
  IconFileText as FileText,
  IconFileSpreadsheet as FileSpreadsheet,
  IconPresentation as Presentation,
  IconPencil as PenTool,
  IconSearch as Search,
  IconTrash as Trash2,
  IconEdit as Edit3,
  IconCopy as Copy,
  IconClock as Clock,
  IconDownload as Download,
  IconFileCheck as FileCheck,
  IconLayoutGrid as Grid,
  IconStack2 as List,
  IconStar as Star,
  IconTag as Tag,
  IconDatabase as HardDrive,
  IconArrowsSort as ArrowsSort,
  IconX as X,
} from '@tabler/icons-react';
import { SavedProject } from '../types';
import { BatchExportModal } from './BatchExportModal';

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
    previewSnippet: 'Proposta de prestação de serviços com cronograma, orçamento detalhado e análise de riscos.',
    tags: ['Comercial', 'Relatório'],
  },
  {
    id: 'proj-2',
    title: 'Balanço Financeiro & Fluxo de Caixa',
    type: 'excel',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    previewSnippet: 'Planilha com projeções, receitas, custos e fluxo de caixa.',
    tags: ['Financeiro', 'Planilha'],
  },
  {
    id: 'proj-3',
    title: 'Apresentação Executiva - Pitch de Vendas',
    type: 'powerpoint',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    previewSnippet: 'Deck executivo com indicadores, proposta de valor e próximos passos.',
    tags: ['Apresentação', 'Vendas'],
  },
  {
    id: 'proj-4',
    title: 'Banner Promocional & Redes Sociais',
    type: 'canva',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    previewSnippet: 'Peças visuais e identidade para campanha digital.',
    tags: ['Design', 'Marketing'],
  },
  {
    id: 'proj-5',
    title: 'Digitalização de Contrato de Prestação',
    type: 'extract',
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    previewSnippet: 'Documento escaneado e convertido em texto pesquisável.',
    tags: ['OCR', 'PDF'],
  },
];

const typeMeta = {
  word: { label: 'Documento', icon: FileText, iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300' },
  excel: { label: 'Planilha', icon: FileSpreadsheet, iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300' },
  powerpoint: { label: 'Apresentação', icon: Presentation, iconClass: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300' },
  canva: { label: 'Design', icon: PenTool, iconClass: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-300' },
  extract: { label: 'PDF / OCR', icon: FileCheck, iconClass: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300' },
  chat: { label: 'Chat IA', icon: FileText, iconClass: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300' },
} as const;

const formatDate = (date: string) => {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? 'Sem data' : value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const ProjectsHub: React.FC<ProjectsHubProps> = ({
  onOpenProject,
  onCreateNewProject,
  showNotification = () => {},
}) => {
  const [projects, setProjects] = useState<SavedProject[]>(() => {
    try {
      const saved = localStorage.getItem('docswiss_projects_v1');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PROJECTS;
    } catch {
      return DEFAULT_PROJECTS;
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | SavedProject['type']>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'type'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('docswiss_project_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('docswiss_projects_v1', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('docswiss_project_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      const matchesType = selectedFilter === 'all' || project.type === selectedFilter;
      const matchesSearch = !query
        || project.title.toLowerCase().includes(query)
        || project.previewSnippet?.toLowerCase().includes(query)
        || project.tags?.some((tag) => tag.toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });

    return filtered.sort((a, b) => {
      const aFavorite = favorites.includes(a.id) ? 1 : 0;
      const bFavorite = favorites.includes(b.id) ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      if (sortBy === 'name') return a.title.localeCompare(b.title, 'pt-BR');
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, selectedFilter, searchQuery, sortBy, favorites]);

  const toggleFavorite = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const duplicateProject = (event: React.MouseEvent, project: SavedProject) => {
    event.stopPropagation();
    const now = new Date().toISOString();
    const duplicate: SavedProject = {
      ...project,
      id: `proj-${Date.now()}`,
      title: `${project.title} (Cópia)`,
      createdAt: now,
      updatedAt: now,
    };
    setProjects((current) => [duplicate, ...current]);
    showNotification('Cópia criada na biblioteca.');
  };

  const deleteProject = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (!window.confirm('Apagar este projeto da biblioteca local?')) return;
    setProjects((current) => current.filter((project) => project.id !== id));
    setFavorites((current) => current.filter((item) => item !== id));
    showNotification('Projeto removido da biblioteca.');
  };

  const beginRename = (event: React.MouseEvent, project: SavedProject) => {
    event.stopPropagation();
    setEditingTitleId(project.id);
    setEditTitleValue(project.title);
  };

  const saveRename = (id: string) => {
    const title = editTitleValue.trim();
    if (title) {
      setProjects((current) => current.map((project) => project.id === id
        ? { ...project, title, updatedAt: new Date().toISOString() }
        : project));
      showNotification('Nome do projeto atualizado.');
    }
    setEditingTitleId(null);
  };

  const createItems = [
    { type: 'word' as const, label: 'Documento', icon: FileText, className: 'bg-blue-600' },
    { type: 'excel' as const, label: 'Planilha', icon: FileSpreadsheet, className: 'bg-emerald-600' },
    { type: 'powerpoint' as const, label: 'Apresentação', icon: Presentation, className: 'bg-orange-600' },
    { type: 'canva' as const, label: 'Design', icon: PenTool, className: 'bg-fuchsia-600' },
    { type: 'extract' as const, label: 'PDF / OCR', icon: FileCheck, className: 'bg-cyan-600' },
  ];

  return (
    <div className="space-y-5 animate-[fadeIn_0.2s_ease]">
      <header className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Biblioteca local</span>
              <span>•</span>
              <span>{projects.length} itens</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Meus arquivos</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize documentos, planilhas, apresentações, designs e digitalizações em um único lugar.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsBatchExportOpen(true)}
              className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button
              onClick={() => onCreateNewProject?.('word')}
              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-3 bg-slate-50/60 dark:bg-slate-950/30 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-indigo-500" /> Offline-first</span>
          <span className="inline-flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500" /> {favorites.length} favoritos</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> Ordenação persistente nesta sessão</span>
        </div>
      </header>

      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Criar rapidamente</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Como no Canva: escolha o formato e entre direto no editor.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {createItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => onCreateNewProject?.(item.type)}
                className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-left hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
              >
                <div className={`w-9 h-9 ${item.className} text-white rounded-xl flex items-center justify-center shadow-sm`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{item.label}</span>
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Pesquisar arquivos, tags ou conteúdo..."
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto">
              {[
                ['all', 'Todos'],
                ['word', 'Word'],
                ['excel', 'Excel'],
                ['powerpoint', 'Slides'],
                ['canva', 'Design'],
                ['extract', 'PDF'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSelectedFilter(value as typeof selectedFilter)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${selectedFilter === value
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <ArrowsSort className="w-4 h-4" />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="bg-transparent outline-none cursor-pointer">
                <option value="updated">Recentes</option>
                <option value="name">Nome</option>
                <option value="type">Tipo</option>
              </select>
            </label>

            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600' : 'text-slate-400'}`} title="Grade">
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600' : 'text-slate-400'}`} title="Lista">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="py-16 px-5 text-center">
            <Search className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">Nenhum arquivo encontrado</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tente outro filtro ou termo de pesquisa.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredProjects.map((project) => {
              const meta = typeMeta[project.type];
              const Icon = meta.icon;
              const favorite = favorites.includes(project.id);
              return (
                <article
                  key={project.id}
                  onClick={() => onOpenProject(project)}
                  className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-white dark:hover:bg-slate-800/60 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-11 h-11 rounded-xl ${meta.iconClass} flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
                      <button onClick={(event) => toggleFavorite(event, project.id)} className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${favorite ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`} title="Favoritar">
                        <Star className="w-4 h-4" fill={favorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {editingTitleId === project.id ? (
                      <div className="mt-4" onClick={(event) => event.stopPropagation()}>
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={(event) => setEditTitleValue(event.target.value)}
                          onKeyDown={(event) => { if (event.key === 'Enter') saveRename(project.id); if (event.key === 'Escape') setEditingTitleId(null); }}
                          onBlur={() => saveRename(project.id)}
                          className="w-full h-9 px-2.5 rounded-lg border border-indigo-400 bg-white dark:bg-slate-900 text-sm font-bold outline-none"
                        />
                      </div>
                    ) : (
                      <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white line-clamp-2 min-h-10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{project.title}</h3>
                    )}

                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 min-h-8">{project.previewSnippet || 'Projeto DocSwiss'}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(project.tags || []).slice(0, 2).map((tag) => <span key={tag} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{tag}</span>)}
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400"><span className="font-bold text-slate-700 dark:text-slate-300">{meta.label}</span> • {formatDate(project.updatedAt)}</div>
                    <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
                      <button onClick={(event) => beginRename(event, project)} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Renomear"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={(event) => duplicateProject(event, project)} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={(event) => deleteProject(event, project.id)} className="p-1.5 text-slate-400 hover:text-rose-600" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50 dark:bg-slate-950/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span className="col-span-6">Nome</span><span className="col-span-2">Tipo</span><span className="col-span-2">Modificado</span><span className="col-span-2 text-right">Ações</span>
            </div>
            {filteredProjects.map((project) => {
              const meta = typeMeta[project.type];
              const Icon = meta.icon;
              const favorite = favorites.includes(project.id);
              return (
                <div key={project.id} onClick={() => onOpenProject(project)} className="grid grid-cols-12 gap-3 px-4 md:px-5 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group">
                  <div className="col-span-9 md:col-span-6 min-w-0 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${meta.iconClass} flex items-center justify-center shrink-0`}><Icon className="w-4.5 h-4.5" /></div>
                    <div className="min-w-0"><div className="text-sm font-bold text-slate-900 dark:text-white truncate">{project.title}</div><div className="md:hidden text-[10px] text-slate-500 mt-0.5">{meta.label} • {formatDate(project.updatedAt)}</div></div>
                  </div>
                  <div className="hidden md:block md:col-span-2 text-xs text-slate-600 dark:text-slate-300">{meta.label}</div>
                  <div className="hidden md:block md:col-span-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(project.updatedAt)}</div>
                  <div className="col-span-3 md:col-span-2 flex justify-end gap-0.5">
                    <button onClick={(event) => toggleFavorite(event, project.id)} className={`p-1.5 ${favorite ? 'text-amber-500' : 'text-slate-300'}`}><Star className="w-4 h-4" fill={favorite ? 'currentColor' : 'none'} /></button>
                    <button onClick={(event) => duplicateProject(event, project)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Copy className="w-4 h-4" /></button>
                    <button onClick={(event) => deleteProject(event, project.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap gap-3 items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{filteredProjects.length} de {projects.length} itens</span>
          <span className="inline-flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Favoritos aparecem primeiro</span>
        </div>
      </section>

      <BatchExportModal
        isOpen={isBatchExportOpen}
        onClose={() => setIsBatchExportOpen(false)}
        projects={projects}
        showNotification={showNotification}
      />
    </div>
  );
};
