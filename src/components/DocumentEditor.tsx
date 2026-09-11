import React, { useCallback, useEffect, useState } from 'react';
import {
  IconAdjustmentsHorizontal as Adjustments,
  IconFileSearch as FindIcon,
  IconListSearch as Outline,
  IconSection as Section,
  IconX as X,
} from '@tabler/icons-react';
import { DocumentEditorStudio } from './DocumentEditorStudio';
import { DocumentFindReplaceBar } from './DocumentFindReplaceBar';
import { DocumentOutlinePane } from './DocumentOutlinePane';
import { DocumentProPanel } from './DocumentProPanel';
import { OrbitResizablePane, useMediaQuery } from './orbit/OrbitResizable';
import { OrbitProjectActions, useOrbitFocusMode } from './orbit/OrbitProjectTools';

type DrawerTab = 'outline' | 'find' | 'pro' | 'project';

const TABS: Array<{ id: DrawerTab; label: string; icon: React.ReactElement }> = [
  { id: 'outline', label: 'Estrutura', icon: <Outline className="w-3.5 h-3.5" /> },
  { id: 'find', label: 'Localizar', icon: <FindIcon className="w-3.5 h-3.5" /> },
  { id: 'pro', label: 'Documento Pro', icon: <Section className="w-3.5 h-3.5" /> },
  { id: 'project', label: 'Projeto', icon: <Adjustments className="w-3.5 h-3.5" /> },
];

/**
 * Shell mínimo do editor de documentos.
 *
 * Segue a hierarquia do Google Docs: tudo que é essencial fica na barra de
 * contexto, na toolbar e na barra de status (todas dentro do Studio). O que é
 * avançado — estrutura, localizar/substituir, painel Pro e ações de projeto —
 * só aparece no drawer lateral, aberto pelo botão "Avançado" ou por Ctrl+H.
 */
export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorStudio>> = (props) => {
  const compact = useMediaQuery('(max-width: 1023px)');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('outline');
  const [searchQuery, setSearchQuery] = useState('');
  const [focus, setFocus] = useOrbitFocusMode();

  const openFind = useCallback(() => { setTab('find'); setAdvancedOpen(true); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+H/Ctrl+F abrem direto o localizar/substituir completo, como no Docs.
        if (key === 'h' || key === 'f') { event.preventDefault(); openFind(); }
        return;
      }
      if (key === 'escape') setAdvancedOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openFind]);

  const drawer = (
    <>
      <div className="orbit-drawer-tabs" role="tablist" aria-label="Ferramentas avançadas do documento">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
            className="orbit-drawer-tab"
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="orbit-drawer-body" role="tabpanel">
        {tab === 'outline' ? <DocumentOutlinePane /> : null}

        {tab === 'find' ? (
          <div className="p-2.5">
            <DocumentFindReplaceBar
              showNotification={props.showNotification}
              alwaysOpen
              embedded
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onRequestClose={() => setAdvancedOpen(false)}
            />
          </div>
        ) : null}

        {tab === 'pro' ? (
          <div className="orbit-drawer-narrow p-2.5 [&_section]:!mb-0">
            <DocumentProPanel showNotification={props.showNotification} defaultOpen />
          </div>
        ) : null}

        {tab === 'project' ? (
          <div className="p-2.5">
            <p className="mb-2 text-[10px] leading-relaxed text-[var(--workspace-muted)]">
              Autosave local contínuo. Crie versões restauráveis, exporte um backup portátil ou consulte os atalhos do editor.
            </p>
            <OrbitProjectActions
              project={props.project}
              kind="word"
              showNotification={props.showNotification}
              focusActive={focus}
              onToggleFocus={() => setFocus((value) => !value)}
            />
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="orbit-editor-surface">
      <div className="orbit-editor-body">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <DocumentEditorStudio
            {...props}
            advancedOpen={advancedOpen}
            onToggleAdvanced={() => setAdvancedOpen((value) => !value)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchSubmit={openFind}
          />
        </div>

        {advancedOpen ? (
          compact ? (
            <div
              className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-sm flex justify-end"
              onMouseDown={(event) => { if (event.target === event.currentTarget) setAdvancedOpen(false); }}
            >
              <aside role="dialog" aria-modal="false" aria-label="Ferramentas avançadas do documento" className="orbit-drawer w-[min(92vw,28rem)]">
                <DrawerHeader onClose={() => setAdvancedOpen(false)} />
                {drawer}
              </aside>
            </div>
          ) : (
            <OrbitResizablePane
              storageKey="doc-advanced"
              handle="start"
              defaultSize={380}
              min={320}
              max={620}
              label="Ferramentas avançadas do documento"
              className="orbit-drawer"
            >
              <DrawerHeader onClose={() => setAdvancedOpen(false)} />
              {drawer}
            </OrbitResizablePane>
          )
        ) : null}
      </div>
    </div>
  );
};

const DrawerHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="h-10 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--workspace-border)]">
    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--workspace-muted)]">Avançado</span>
    <kbd className="orbit-kbd hidden sm:inline-flex">Ctrl + H</kbd>
    <button type="button" onClick={onClose} className="ml-auto w-7 h-7 rounded-lg hover:bg-[var(--workspace-surface-muted)]" aria-label="Fechar ferramentas avançadas">
      <X className="w-3.5 h-3.5 mx-auto" />
    </button>
  </div>
);
