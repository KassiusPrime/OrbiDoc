import React, { useMemo, useState } from 'react';
import { IconChevronRight as ChevronRight, IconFileCode as FileCode, IconFolder as Folder, IconFolderOpen as FolderOpen } from '@tabler/icons-react';
import type { GitHubTreeEntry } from '../../services/githubProjects';

type Node = {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  children: Node[];
};

type Props = {
  entries: GitHubTreeEntry[];
  selectedPath: string | null;
  onSelect: (entry: GitHubTreeEntry) => void;
  /** Apenas arquivos de texto são clicáveis. */
  isSelectable: (entry: GitHubTreeEntry) => boolean;
};

const buildTree = (entries: GitHubTreeEntry[]): Node => {
  const root: Node = { name: '', path: '', type: 'tree', children: [] };
  const index = new Map<string, Node>([['', root]]);

  for (const entry of entries) {
    if (entry.type === 'commit') continue;
    const parts = entry.path.split('/');
    let parentPath = '';
    for (let position = 0; position < parts.length; position += 1) {
      const name = parts[position];
      const path = parentPath ? `${parentPath}/${name}` : name;
      const isLast = position === parts.length - 1;
      let node = index.get(path);
      if (!node) {
        node = {
          name,
          path,
          type: isLast ? (entry.type === 'tree' ? 'tree' : 'blob') : 'tree',
          size: isLast ? entry.size : undefined,
          children: [],
        };
        index.set(path, node);
        index.get(parentPath)?.children.push(node);
      }
      parentPath = path;
    }
  }

  const sort = (node: Node) => {
    node.children.sort((left, right) => {
      if (left.type !== right.type) return left.type === 'tree' ? -1 : 1;
      return left.name.localeCompare(right.name, 'pt-BR');
    });
    node.children.forEach(sort);
  };
  sort(root);
  return root;
};

const formatSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Árvore de arquivos do repositório.
 *
 * Faz parte do protagonista da surface Repo (é o "IDE" do objeto), por isso é
 * a única exceção permitida à regra "uma sidebar por surface" do design system.
 * Nós reutilizam a árvore de caminhos plana devolvida pela API do GitHub, sem
 * exigir chamadas extras por diretório.
 */
export const RepoTree: React.FC<Props> = ({ entries, selectedPath, onSelect, isSelectable }) => {
  const root = useMemo(() => buildTree(entries), [entries]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const needle = filter.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    return entries.filter((entry) => entry.type === 'blob' && entry.path.toLowerCase().includes(needle)).slice(0, 200);
  }, [entries, needle]);

  const toggle = (path: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  const renderNodes = (nodes: Node[], depth: number): React.ReactNode => nodes.map((node) => {
    const padding = { paddingLeft: `${8 + depth * 12}px` };
    if (node.type === 'tree') {
      const isCollapsed = collapsed.has(node.path);
      return (
        <React.Fragment key={node.path}>
          <button
            type="button"
            onClick={() => toggle(node.path)}
            className="orbit-repo-node"
            style={padding}
            aria-expanded={!isCollapsed}
          >
            <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
            {isCollapsed ? <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" /> : <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
            <span className="truncate">{node.name}</span>
          </button>
          {isCollapsed ? null : renderNodes(node.children, depth + 1)}
        </React.Fragment>
      );
    }
    const selectable = isSelectable({ path: node.path, type: 'blob', sha: '', mode: '' } as GitHubTreeEntry);
    return (
      <button
        key={node.path}
        type="button"
        disabled={!selectable}
        onClick={() => onSelect({ path: node.path, type: 'blob', sha: '', mode: '', size: node.size } as GitHubTreeEntry)}
        data-active={selectedPath === node.path}
        className={`orbit-repo-node ${selectable ? '' : 'is-muted'}`}
        style={{ ...padding, paddingLeft: `${24 + depth * 12}px` }}
        title={selectable ? node.path : `${node.path} · binário ou não suportado`}
      >
        <FileCode className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.size ? <span className="shrink-0 text-[9px] text-slate-400">{formatSize(node.size)}</span> : null}
      </button>
    );
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 p-2">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar arquivos…"
          aria-label="Filtrar arquivos do repositório"
          className="w-full h-7 px-2 rounded-md bg-[var(--workspace-surface-muted)] text-[11px] outline-none"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto pb-2">
        {matches ? (
          matches.length ? matches.map((entry) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => onSelect(entry)}
              data-active={selectedPath === entry.path}
              className="orbit-repo-node"
              style={{ paddingLeft: '10px' }}
              title={entry.path}
            >
              <FileCode className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate flex-1 text-left">{entry.path}</span>
            </button>
          )) : <p className="px-3 py-6 text-center text-[11px] text-[var(--workspace-muted)]">Nenhum arquivo corresponde ao filtro.</p>
        ) : renderNodes(root.children, 0)}
      </div>
    </div>
  );
};
