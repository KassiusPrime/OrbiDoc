import React, { useState } from 'react';
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
import type { SavedProject } from '../../types';
import { OrbitResizablePane, useMediaQuery } from './OrbitResizable';
import { OrbitShortcutsDialog, useOrbitFocusMode, useProjectTools, type OrbitEditorKind } from './OrbitProjectTools';

export type { OrbitEditorKind } from './OrbitProjectTools';

const DOCK_LABEL: Record<OrbitEditorKind, string> = {
  word: 'Ferramentas do documento',
  excel: 'Ferramentas da planilha',
  powerpoint: 'Ferramentas da apresentação',
  canva: 'Ferramentas do design',
};

export { useOrbitFocusMode };

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
 * Moldura única para os apps do workspace que ainda mantêm uma barra de ações
 * acima do conteúdo (planilha, apresentação e design).
 *
 * Antes cada editor empilhava três a quatro banners de largura total acima do
 * conteúdo (Studio Pro + painéis Pro + localizar/substituir), consumindo até
 * 280px verticais dentro de uma área que já rolava. Aqui tudo isso vira uma
 * barra de 40px + uma doca lateral redimensionável, no mesmo espírito de
 * Google Docs/Sheets e do painel de tarefas do Office.
 *
 * O editor de documentos não usa mais esta moldura: ele segue a hierarquia do
 * Google Docs (context bar + toolbar + página + status bar) e leva as
 * ferramentas avançadas para um drawer, conforme as instruções v2.
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
  const { backup, snapshot } = useProjectTools(project, showNotification);

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

      <OrbitShortcutsDialog kind={kind} open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
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
