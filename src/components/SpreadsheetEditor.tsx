import React, { useCallback, useState } from 'react';
import { SpreadsheetEditorStudio } from './SpreadsheetEditorStudio';
import { SpreadsheetProPanel } from './SpreadsheetProPanel';
import { recalculateWorkbookFormulas, type FormulaWorkbook } from '../lib/spreadsheetFormulaEngine';
import type { SavedProject } from '../types';

/**
 * Wrapper da surface Planilha.
 *
 * Mesma gramática da surface Documento: o Studio é o dono da context bar, da
 * toolbar, da grade protagonista e da status bar; aqui só vive o painel "Pro",
 * injetado no drawer avançado do Studio. A antiga moldura (OrbitEditorFrame)
 * adicionava uma terceira faixa permanente acima da grade — violação V1 da
 * auditoria da Fase 0.
 */
export const SpreadsheetEditor: React.FC<React.ComponentProps<typeof SpreadsheetEditorStudio>> = (props) => {
  const [revision, setRevision] = useState(0);
  const { onProjectChange } = props;

  const persistWithFormulaEngine = useCallback((project: SavedProject) => {
    const workbook = project.content as FormulaWorkbook;
    if (!workbook?.sheets?.length) { onProjectChange(project); return; }
    const result = recalculateWorkbookFormulas(workbook);
    if (!result.changed) { onProjectChange(project); return; }
    const updated: SavedProject = { ...project, content: result.workbook, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(`orbidoc_spreadsheet_v4_${project.id}`, JSON.stringify({ workbook: result.workbook, title: updated.title, updatedAt: updated.updatedAt }));
    } catch { /* quota */ }
    onProjectChange(updated);
    setRevision((value) => value + 1);
  }, [onProjectChange]);

  return (
    <SpreadsheetEditorStudio
      key={`${props.project.id}:${revision}`}
      {...props}
      onProjectChange={persistWithFormulaEngine}
      advancedTools={(
        <SpreadsheetProPanel
          project={props.project}
          onProjectChange={persistWithFormulaEngine}
          onApplied={() => setRevision((value) => value + 1)}
          showNotification={props.showNotification}
        />
      )}
    />
  );
};
