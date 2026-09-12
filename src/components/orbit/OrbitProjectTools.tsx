import React, { useCallback, useEffect, useState } from 'react';
import {
  IconArrowsMaximize as Maximize,
  IconArrowsMinimize as Minimize,
  IconDeviceFloppy as Save,
  IconDownload as Download,
  IconKeyboard as Keyboard,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { snapshotAllProjects } from '../../lib/projectVersions';
import type { SavedProject } from '../../types';

export type OrbitEditorKind = 'word' | 'excel' | 'powerpoint' | 'canva';

export const ORBIT_SHORTCUTS: Record<OrbitEditorKind, Array<[string, string]>> = {
  word: [
    ['Ctrl/Cmd + B', 'Negrito'],
    ['Ctrl/Cmd + I', 'Itálico'],
    ['Ctrl/Cmd + Z', 'Desfazer'],
    ['Ctrl/Cmd + H', 'Localizar e substituir'],
    ['Alt + Z', 'Modo foco (tela cheia)'],
  ],
  excel: [
    ['Setas', 'Navegar entre células'],
    ['Enter / Tab', 'Avançar linha / coluna'],
    ['Shift + clique', 'Selecionar intervalo'],
    ['Arrastar borda do cabeçalho', 'Redimensionar coluna ou linha'],
    ['Alt + Z', 'Modo foco (tela cheia)'],
  ],
  powerpoint: [
    ['Arrastar', 'Mover elemento'],
    ['Arrastar alça', 'Redimensionar elemento'],
    ['Shift ao redimensionar', 'Preservar proporção'],
    ['Alt + Z', 'Modo foco (tela cheia)'],
  ],
  canva: [
    ['Ctrl/Cmd + Z', 'Desfazer'],
    ['Ctrl/Cmd + D', 'Duplicar elemento'],
    ['Setas / Shift + setas', 'Mover 1px / 10px'],
    ['Delete', 'Excluir elemento'],
    ['Alt + Z', 'Modo foco (tela cheia)'],
  ],
};

/** Modo foco global: esconde sidebar, header e bottom nav do shell. */
export const useOrbitFocusMode = () => {
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (focus) document.documentElement.dataset.orbitFocus = 'true';
    else delete document.documentElement.dataset.orbitFocus;
    return () => { delete document.documentElement.dataset.orbitFocus; };
  }, [focus]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'z') { event.preventDefault(); setFocus((value) => !value); }
      if (event.key === 'Escape') setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return [focus, setFocus] as const;
};

/**
 * Ações de projeto compartilhadas por todos os editores: criar versão
 * restaurável e exportar um backup portátil. Vive fora da moldura para poder
 * ser usado tanto na barra do editor quanto dentro do drawer "Avançado".
 */
export const useProjectTools = (
  project: SavedProject,
  showNotification: (message: string, type?: 'success' | 'error') => void = () => {},
) => {
  const backup = useCallback(() => {
    try {
      const payload = JSON.stringify({ format: 'orbidoc-project', version: 1, exportedAt: new Date().toISOString(), project }, null, 2);
      const safe = (project.title || 'projeto').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'projeto';
      saveAs(new Blob([payload], { type: 'application/json;charset=utf-8' }), `${safe}.orbidoc-project.json`);
      showNotification('Backup do projeto exportado.', 'success');
    } catch (error: unknown) {
      showNotification(error instanceof Error ? error.message : 'Falha ao exportar backup.', 'error');
    }
  }, [project, showNotification]);

  const snapshot = useCallback(() => {
    const count = snapshotAllProjects(true);
    showNotification(
      count ? 'Versão local criada. Restaure em Histórico de versões.' : 'Não foi possível criar a versão.',
      count ? 'success' : 'error',
    );
  }, [showNotification]);

  return { backup, snapshot };
};

export const OrbitShortcutsDialog: React.FC<{ kind: OrbitEditorKind; open: boolean; onClose: () => void }> = ({ kind, open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[145] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-label="Atalhos do editor" className="w-full max-w-md rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-2xl overflow-hidden">
        <header className="h-12 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center">
          <div className="flex-1 text-sm font-black">Atalhos do editor</div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
            <X className="w-4 h-4 mx-auto" />
          </button>
        </header>
        <div className="p-4 space-y-2">
          {ORBIT_SHORTCUTS[kind].map(([shortcut, action]) => (
            <div key={shortcut} className="flex items-center gap-3">
              <kbd className="min-w-36 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[9px] font-black text-center">{shortcut}</kbd>
              <span className="text-xs text-slate-600 dark:text-slate-300">{action}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

type ProjectActionsProps = {
  project: SavedProject;
  kind: OrbitEditorKind;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  focusActive?: boolean;
  onToggleFocus?: () => void;
  className?: string;
};

/**
 * Bloco compacto de ações do projeto usado dentro do drawer avançado.
 * Substitui o antigo banner "Studio Pro" de largura total.
 */
export const OrbitProjectActions: React.FC<ProjectActionsProps> = ({
  project,
  kind,
  showNotification = () => {},
  focusActive = false,
  onToggleFocus,
  className = '',
}) => {
  const { backup, snapshot } = useProjectTools(project, showNotification);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <button type="button" onClick={snapshot} className="orbit-drawer-action">
        <Save className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
        <span className="flex-1 text-left">Criar versão restaurável</span>
      </button>
      <button type="button" onClick={backup} className="orbit-drawer-action">
        <Download className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
        <span className="flex-1 text-left">Backup portátil do projeto</span>
      </button>
      <button type="button" onClick={() => setShortcutsOpen(true)} className="orbit-drawer-action">
        <Keyboard className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Atalhos do editor</span>
      </button>
      {onToggleFocus ? (
        <button type="button" onClick={onToggleFocus} data-active={focusActive} className="orbit-drawer-action">
          {focusActive ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          <span className="flex-1 text-left">Modo foco</span>
          <kbd className="orbit-kbd">Alt + Z</kbd>
        </button>
      ) : null}
      <OrbitShortcutsDialog kind={kind} open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};
