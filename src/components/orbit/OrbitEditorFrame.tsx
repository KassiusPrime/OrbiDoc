import React, { useCallback, useEffect, useState } from 'react';
import {
  IconArrowsMaximize as Maximize,
  IconArrowsMinimize as Minimize,
  IconDeviceFloppy as Save,
  IconDownload as Download,
  IconKeyboard as Keyboard,
  IconLayoutSidebarRightCollapse as DockClose,
  IconLayoutSidebarRightExpand as DockOpen,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { snapshotAllProjects } from '../../lib/projectVersions';
import type { SavedProject } from '../../types';
import { OrbitResizablePane, useMediaQuery } from './OrbitResizable';

export type OrbitEditorKind = 'word' | 'excel' | 'powerpoint' | 'canva';

const SHORTCUTS: Record<OrbitEditorKind, Array<[string, string]>> = {
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

const DOCK_LABEL: Record<OrbitEditorKind, string> = {
  word: 'Ferramentas do documento',
  excel: 'Ferramentas da planilha',
  powerpoint: 'Ferramentas da apresentação',
  canva: 'Ferramentas do design',
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

export interface OrbitEditorFrameProps {
  kind: OrbitEditorKind;
  project: SavedProject;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  /** Painéis avançados, exibidos numa doca lateral redimensionável. */
  tools?: React.ReactNode;
  /** Controles extras específicos do editor, exibidos na barra densa. */
  chrome?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Moldura única para os apps do workspace.
 *
 * Antes cada editor empilhava três a quatro banners de largura total acima do
 * conteúdo (Studio Pro + painéis Pro + localizar/substituir), consumindo até
 * 280px verticais dentro de uma área que já rolava. Aqui tudo isso vira uma
 * barra de 40px + uma doca lateral redimensionável, no mesmo espírito de
 * Google Docs/Sheets e do painel de tarefas do Office.
 */
export const OrbitEditorFrame: React.FC<OrbitEditorFrameProps> = ({
  kind,
  project,
  showNotification = () => {},
  tools,
  chrome,
  children,
}) => {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [focus, setFocus] = useOrbitFocusMode();
  const compact = useMediaQuery('(max-width: 1023px)');

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

  return (
    <div className="orbit-editor-surface">
      <div className="orbit-editor-chrome">
        <button type="button" onClick={snapshot} className="orbit-chip" title="Criar uma versão local restaurável">
          <Save className="w-3.5 h-3.5" /> Versão
        </button>
        <button type="button" onClick={backup} className="orbit-chip" title="Exportar backup portátil do projeto">
          <Download className="w-3.5 h-3.5" /> Backup
        </button>
        <button type="button" onClick={() => setShortcutsOpen(true)} className="orbit-chip" title="Atalhos do editor">
          <Keyboard className="w-3.5 h-3.5" /> Atalhos
        </button>

        {chrome ? <><span className="orbit-chrome-divider" />{chrome}</> : null}

        <div className="flex-1 min-w-[8px]" />

        <button
          type="button"
          onClick={() => setFocus(!focus)}
          data-active={focus}
          className="orbit-chip"
          title="Modo foco: usa a tela inteira para o conteúdo (Alt + Z)"
        >
          {focus ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Foco</span>
        </button>

        {tools ? (
          <button
            type="button"
            onClick={() => setDockOpen((value) => !value)}
            data-active={dockOpen}
            className="orbit-chip"
            title={DOCK_LABEL[kind]}
          >
            {dockOpen ? <DockClose className="w-3.5 h-3.5" /> : <DockOpen className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Ferramentas</span>
          </button>
        ) : null}
      </div>

      <div className="orbit-editor-body">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</div>

        {tools && dockOpen ? (
          compact ? (
            <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-sm flex justify-end" onMouseDown={(event) => { if (event.target === event.currentTarget) setDockOpen(false); }}>
              <aside className="w-[min(92vw,380px)] h-full bg-[var(--workspace-bg)] border-l border-[var(--workspace-border)] flex flex-col">
                <DockHeader label={DOCK_LABEL[kind]} onClose={() => setDockOpen(false)} />
                <div className="orbit-tool-dock__scroll">{tools}</div>
              </aside>
            </div>
          ) : (
            <OrbitResizablePane
              storageKey={`tools-${kind}`}
              handle="start"
              defaultSize={340}
              min={280}
              max={620}
              label={DOCK_LABEL[kind]}
              className="orbit-tool-dock"
            >
              <DockHeader label={DOCK_LABEL[kind]} onClose={() => setDockOpen(false)} />
              <div className="orbit-tool-dock__scroll">{tools}</div>
            </OrbitResizablePane>
          )
        ) : null}
      </div>

      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-[145] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShortcutsOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-label="Atalhos do editor" className="w-full max-w-md rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-2xl overflow-hidden">
            <header className="h-12 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center">
              <div className="flex-1 text-sm font-black">Atalhos do editor</div>
              <button type="button" onClick={() => setShortcutsOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
                <X className="w-4 h-4 mx-auto" />
              </button>
            </header>
            <div className="p-4 space-y-2">
              {SHORTCUTS[kind].map(([shortcut, action]) => (
                <div key={shortcut} className="flex items-center gap-3">
                  <kbd className="min-w-36 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[9px] font-black text-center">{shortcut}</kbd>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{action}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

const DockHeader: React.FC<{ label: string; onClose: () => void }> = ({ label, onClose }) => (
  <div className="h-10 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--workspace-border)]">
    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--workspace-muted)] truncate">{label}</span>
    <button type="button" onClick={onClose} className="ml-auto w-7 h-7 rounded-lg hover:bg-[var(--workspace-surface-muted)]" aria-label="Fechar painel de ferramentas">
      <X className="w-3.5 h-3.5 mx-auto" />
    </button>
  </div>
);
