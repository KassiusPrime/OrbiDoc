import React, { useCallback, useState } from 'react';
import { SpreadsheetEditorStudio } from './SpreadsheetEditorStudio';
import { StudioPowerBar } from './StudioPowerBar';
import { SpreadsheetProPanel } from './SpreadsheetProPanel';
import { recalculateWorkbookFormulas, type FormulaWorkbook } from '../lib/spreadsheetFormulaEngine';
import type { SavedProject } from '../types';

export const SpreadsheetEditor: React.FC<React.ComponentProps<typeof SpreadsheetEditorStudio>> = (props) => {
  const [revision, setRevision] = useState(0);

  const persistWithFormulaEngine = useCallback((project: SavedProject) => {
    const workbook = project.content as FormulaWorkbook;
    if (!workbook?.sheets?.length) { props.onProjectChange(project); return; }
    const result = recalculateWorkbookFormulas(workbook);
    if (!result.changed) { props.onProjectChange(project); return; }
    const updated: SavedProject = { ...project, content: result.workbook, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(`orbidoc_spreadsheet_v4_${project.id}`, JSON.stringify({ workbook: result.workbook, title: updated.title, updatedAt: updated.updatedAt }));
    } catch { /* quota */ }
    props.onProjectChange(updated);
    setRevision((value) => value + 1);
  }, [props.onProjectChange]);

  return <div>
    <StudioPowerBar project={props.project} kind="excel" showNotification={props.showNotification} />
    <SpreadsheetProPanel project={props.project} onProjectChange={persistWithFormulaEngine} onApplied={() => setRevision((value) => value + 1)} showNotification={props.showNotification} />
    <SpreadsheetEditorStudio key={`${props.project.id}:${revision}`} {...props} onProjectChange={persistWithFormulaEngine} />
  </div>;
};