import React, { useMemo, useState } from 'react';
import {
  IconCopy as Copy,
  IconDotsVertical as More,
  IconFileCheck as FileCheck,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconFolder as Folder,
  IconLayoutGrid as Grid,
  IconList as List,
  IconPencil as Pencil,
  IconPlus as Plus,
  IconPresentation as Presentation,
  IconSearch as Search,
  IconStar as Star,
  IconStarFilled as StarFilled,
  IconTrash as Trash,
} from '@tabler/icons-react';
import { SavedProject } from '../types';

export interface ProjectLibraryWorkspaceProps {
  projects: SavedProject[];
  onOpenProject: (project: SavedProject) => void;
  onCreateProject: (type: SavedProject['type']) => void;
  onUpdateProject: (project: SavedProject) => void;
  onDeleteProject: (id: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type ViewMode = 'grid' | 'list';
type Filter = 'all' | SavedProject['type'] | 'favorite';
type SortMode = 'updated' | 'created' | 'title';

const META: Record<SavedProject['type'], { label: string; icon: React.ComponentType<{ className?: string }>; iconClass: string }> = {
  word: { label: 'Documento', icon: FileText, iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  excel: { label: 'Planilha', icon: FileSpreadsheet, iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  powerpoint: { label: 'Apresentação', icon: Presentation, iconClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' },
  canva: { label: 'Design', icon: Pencil, iconClass: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300' },
  extract: { label: 'PDF / OCR', icon: FileCheck, iconClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' },
  chat: { label: 'Conversa', icon: FileText, iconClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' },
};

const isFavorite = (project: SavedProject) => project.tags?.includes('Favorito') ?? false;
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const ProjectLibraryWorkspace: React.FC<ProjectLibraryWorkspaceProps> = ({ projects, onOpenProject, onCreateProject, onUpdateProject, onDeleteProject, showNotification = () => {} }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortMode>('updated');
  const [view, setView] = useState<ViewMode>('grid');
  const [menuId, setMenuId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesFilter = filter === 'all' || filter === project.type || (filter === 'favorite' && isFavorite(project));
      const haystack = `${project.title} ${project.previewSnippet || ''} ${(project.tags || []).join(' ')}`.toLowerCase();
      return matchesFilter && (!normalized || haystack.includes(normalized));
    }).slice().sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      const key = sort === 'created' ? 'createdAt' : 'updatedAt';
      return new Date(b[key]).getTime() - new Date(a[key]).getTime();
    });
  }, [projects, query, filter, sort]);

  const toggleFavorite = (project: SavedProject) => {
    const tags = new Set(project.tags || []);
    if (tags.has('Favorito')) tags.delete('Favorito'); else tags.add('Favorito');
    onUpdateProject({ ...project, tags: [...tags], updatedAt: new Date().toISOString() });
    setMenuId(null);
  };
  const rename = (project: SavedProject) => {
    const value = window.prompt('Novo nome do arquivo:', project.title)?.trim();
    if (!value || value === project.title) return;
    onUpdateProject({ ...project, title: value, updatedAt: new Date().toISOString() });
    showNotification('Arquivo renomeado.', 'success');
    setMenuId(null);
  };
  const duplicate = (project: SavedProject) => {
    const now = new Date().toISOString();
    const clone: SavedProject = { ...project, id: crypto.randomUUID(), title: `${project.title} — cópia`, createdAt: now, updatedAt: now, content: typeof structuredClone === 'function' ? structuredClone(project.content) : project.content };
    onUpdateProject(clone);
    showNotification('Cópia criada.', 'success');
    setMenuId(null);
  };
  const remove = (project: SavedProject) => {
    if (!window.confirm(`Excluir “${project.title}” deste dispositivo?`)) return;
    onDeleteProject(project.id);
    showNotification('Arquivo removido da biblioteca local.', 'success');
    setMenuId(null);
  };
  const newActions: Array<{ type: SavedProject['type']; label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = [
    { type: 'word', label: 'Documento', icon: FileText, className: 'text-blue-600' },
    { type: 'excel', label: 'Planilha', icon: FileSpreadsheet, className: 'text-emerald-600' },
    { type: 'powerpoint', label: 'Apresentação', icon: Presentation, className: 'text-orange-600' },
    { type: 'canva', label: 'Design', icon: Pencil, className: 'text-fuchsia-600' },
    { type: 'extract', label: 'PDF / OCR', icon: FileCheck, className: 'text-cyan-600' },
  ];

  return <div className="max-w-[1500px] mx-auto space-y-5">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"><div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center gap-4"><div className="flex-1 min-w-0"><div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Folder className="w-4 h-4" /> Biblioteca local</div><h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Projetos OrbiDoc</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Documentos, planilhas, apresentações, designs e sessões OCR salvos neste dispositivo.</p></div><div className="flex flex-wrap gap-2">{newActions.map((action) => { const Icon = action.icon; return <button key={action.type} onClick={() => onCreateProject(action.type)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-black inline-flex items-center gap-2"><Icon className={`w-4 h-4 ${action.className}`} />{action.label}</button>; })}</div></div></section>
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-visible">
      <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-3 lg:items-center"><div className="relative flex-1 max-w-xl"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar projetos…" className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-transparent focus:border-indigo-300 text-xs outline-none" /></div><div className="flex items-center gap-2 overflow-x-auto"><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-[11px] font-bold"><option value="all">Todos os tipos</option><option value="favorite">Favoritos</option><option value="word">Documentos</option><option value="excel">Planilhas</option><option value="powerpoint">Apresentações</option><option value="canva">Designs</option><option value="extract">PDF / OCR</option></select><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-[11px] font-bold"><option value="updated">Modificados recentemente</option><option value="created">Criados recentemente</option><option value="title">Nome A–Z</option></select><div className="flex bg-slate-100 dark:bg-slate-950 rounded-xl p-1"><button onClick={() => setView('grid')} className={`w-8 h-8 rounded-lg flex items-center justify-center ${view === 'grid' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-400'}`}><Grid className="w-4 h-4" /></button><button onClick={() => setView('list')} className={`w-8 h-8 rounded-lg flex items-center justify-center ${view === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-400'}`}><List className="w-4 h-4" /></button></div></div></div>
      {filtered.length === 0 ? <div className="p-14 text-center"><Folder className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" /><h2 className="mt-3 text-sm font-black">Nenhum projeto encontrado</h2><p className="mt-1 text-xs text-slate-500">Crie um arquivo novo ou ajuste os filtros.</p><button onClick={() => onCreateProject('word')} className="mt-4 h-10 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Novo documento</button></div> : view === 'grid' ? <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">{filtered.map((project) => { const meta = META[project.type]; const Icon = meta.icon; return <article key={project.id} className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-md group"><button onClick={() => onOpenProject(project)} className="w-full text-left p-4"><div className="flex items-start gap-3"><div className={`w-11 h-11 rounded-xl ${meta.iconClass} flex items-center justify-center`}><Icon className="w-5 h-5" /></div><div className="min-w-0 flex-1 pr-7"><h3 className="text-sm font-black truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{project.title}</h3><div className="mt-1 text-[10px] text-slate-400">{meta.label} · {formatDate(project.updatedAt)}</div></div></div><p className="mt-4 h-8 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{project.previewSnippet || 'Sem prévia disponível.'}</p></button><button onClick={() => setMenuId(menuId === project.id ? null : project.id)} className="absolute right-3 top-3 w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><More className="w-4 h-4 text-slate-400" /></button>{isFavorite(project) && <StarFilled className="absolute right-4 bottom-4 w-4 h-4 text-amber-400" />}{menuId === project.id && <FileMenu project={project} onOpen={() => onOpenProject(project)} onRename={() => rename(project)} onDuplicate={() => duplicate(project)} onFavorite={() => toggleFavorite(project)} onDelete={() => remove(project)} />}</article>; })}</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map((project) => { const meta = META[project.type]; const Icon = meta.icon; return <div key={project.id} className="relative px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"><button onClick={() => onOpenProject(project)} className="min-w-0 flex-1 flex items-center gap-3 text-left"><div className={`w-9 h-9 rounded-xl ${meta.iconClass} flex items-center justify-center`}><Icon className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="text-xs font-black truncate">{project.title}</div><div className="text-[10px] text-slate-400">{meta.label}</div></div><div className="hidden md:block w-44 text-[10px] text-slate-400">{formatDate(project.updatedAt)}</div>{isFavorite(project) && <StarFilled className="w-4 h-4 text-amber-400" />}</button><button onClick={() => setMenuId(menuId === project.id ? null : project.id)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><More className="w-4 h-4 text-slate-400" /></button>{menuId === project.id && <FileMenu project={project} onOpen={() => onOpenProject(project)} onRename={() => rename(project)} onDuplicate={() => duplicate(project)} onFavorite={() => toggleFavorite(project)} onDelete={() => remove(project)} />}</div>; })}</div>}
    </section>
  </div>;
};

const FileMenu: React.FC<{ project: SavedProject; onOpen: () => void; onRename: () => void; onDuplicate: () => void; onFavorite: () => void; onDelete: () => void }> = ({ project, onOpen, onRename, onDuplicate, onFavorite, onDelete }) => <div className="absolute right-3 top-12 z-30 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={onOpen} className="w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">Abrir</button><button onClick={onRename} className="w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"><Pencil className="w-3.5 h-3.5" /> Renomear</button><button onClick={onDuplicate} className="w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Duplicar</button><button onClick={onFavorite} className="w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2">{isFavorite(project) ? <StarFilled className="w-3.5 h-3.5 text-amber-400" /> : <Star className="w-3.5 h-3.5" />}{isFavorite(project) ? 'Remover favorito' : 'Favoritar'}</button><div className="my-1 border-t border-slate-100 dark:border-slate-800" /><button onClick={onDelete} className="w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-2"><Trash className="w-3.5 h-3.5" /> Excluir</button></div>;
