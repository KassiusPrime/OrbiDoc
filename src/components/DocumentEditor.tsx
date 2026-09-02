import React, { useState } from 'react';
import { IconListSearch as Outline } from '@tabler/icons-react';
import { DocumentEditorStudio } from './DocumentEditorStudio';
import { DocumentFindReplaceBar } from './DocumentFindReplaceBar';
import { DocumentOutlinePane } from './DocumentOutlinePane';
import { DocumentProPanel } from './DocumentProPanel';
import { OrbitEditorFrame } from './orbit/OrbitEditorFrame';
import { OrbitResizablePane, useMediaQuery } from './orbit/OrbitResizable';

export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorStudio>> = (props) => {
  const compact = useMediaQuery('(max-width: 1023px)');
  const [outlineOpen, setOutlineOpen] = useState(false);

  return (
    <OrbitEditorFrame
      kind="word"
      project={props.project}
      showNotification={props.showNotification}
      tools={<DocumentProPanel showNotification={props.showNotification} />}
      chrome={(
        <button
          type="button"
          onClick={() => setOutlineOpen((value) => !value)}
          data-active={outlineOpen}
          className="orbit-chip"
          title="Painel de estrutura do documento"
        >
          <Outline className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Estrutura</span>
        </button>
      )}
    >
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {outlineOpen && !compact ? (
          <OrbitResizablePane
            storageKey="doc-outline"
            handle="end"
            defaultSize={250}
            min={180}
            max={420}
            label="painel de estrutura"
            className="border-r border-[var(--workspace-border)] bg-[var(--workspace-bg)]"
          >
            <DocumentOutlinePane />
          </OrbitResizablePane>
        ) : null}

        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-2 pt-2 [&>*]:!mb-0">
            <DocumentFindReplaceBar showNotification={props.showNotification} />
          </div>
          <DocumentEditorStudio {...props} />
        </div>

        {outlineOpen && compact ? (
          <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-sm flex" onMouseDown={(event) => { if (event.target === event.currentTarget) setOutlineOpen(false); }}>
            <aside className="w-[min(86vw,300px)] h-full bg-[var(--workspace-bg)] border-r border-[var(--workspace-border)] flex flex-col">
              <DocumentOutlinePane />
            </aside>
          </div>
        ) : null}
      </div>
    </OrbitEditorFrame>
  );
};
