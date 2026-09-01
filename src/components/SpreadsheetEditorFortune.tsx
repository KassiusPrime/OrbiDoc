import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import {
  IconDatabase,
  IconDownload,
  IconFileSpreadsheet,
  IconUpload,
  IconWifiOff,
} from '@tabler/icons-react';
import type { HistoryItem, SavedProject } from '../types';
import { pickLocalFile, saveLocalFile, type OrbiDocFileSystemFileHandle } from '../lib/fileSystemAccess';
import {
  fortuneSheetToCsvBlob,
  fortuneSheetsToXlsxBlob,
  migrateLegacyWorkbook,
  normalizePtBrFormula,
  xlsxArrayBufferToFortuneSheets,
  type FortuneSheet,
} from '../lib/fortuneSpreadsheet';
import { createDebouncedAutosave, saveSheetLocal, type AutosaveStatus } from '../services/offlinePersistence';
import { queueGoogleDriveEntitySync } from '../services/driveSyncQueue';

export interface SpreadsheetEditorFortuneProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

const safeFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Planilha';

const countPopulatedCells = (sheets: FortuneSheet[]) => sheets.reduce((total, sheet) => {
  if (sheet.celldata?.length) return total + sheet.celldata.length;
  if (!sheet.data?.length) return total;
  return total + sheet.data.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}, 0);

export const SpreadsheetEditorFortune: React.FC<SpreadsheetEditorFortuneProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
}) => {
  const workbookRef = useRef<WorkbookInstance>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Nova planilha');
  const [sheets, setSheets] = useState<FortuneSheet[]>(() => migrateLegacyWorkbook(project.content));
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [fileHandle, setFileHandle] = useState<OrbiDocFileSystemFileHandle | null>(null);

  const autosave = useMemo(
    () => createDebouncedAutosave<{ sheets: FortuneSheet[]; title: string }>(async (snapshot) => {
      setStatus('saving');
      const updatedAt = new Date().toISOString();
      const origin = project.cloudOrigin?.provider === 'googleDrive' ? project.cloudOrigin : undefined;
      const rawBlob = origin?.fileName.toLowerCase().endsWith('.csv')
        ? fortuneSheetToCsvBlob(snapshot.sheets[0])
        : fortuneSheetsToXlsxBlob(snapshot.sheets);
      await saveSheetLocal({
        id: project.id,
        title: snapshot.title,
        workbookData: snapshot.sheets,
        rawBlob,
        updatedAt,
        driveFileId: origin?.fileId,
        driveVersion: origin?.version,
        driveModifiedTime: origin?.modifiedTime,
        isSynced: false,
        syncState: origin && !navigator.onLine ? 'modified-offline' : 'local',
        fileName: origin?.fileName || `${safeFileName(snapshot.title)}.xlsx`,
        mimeType: origin?.mimeType || rawBlob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if (origin) await queueGoogleDriveEntitySync('sheet', project.id);
      onProjectChange({
        ...project,
        title: snapshot.title,
        content: snapshot.sheets,
        previewSnippet: `${snapshot.sheets.length} aba(s) · ${countPopulatedCells(snapshot.sheets)} célula(s) preenchida(s)`,
        updatedAt,
      });
      setStatus('saved');
      setLastSaved(new Date());
    }),
    [project.id, onProjectChange],
  );

  React.useEffect(() => () => autosave.dispose(), [autosave]);

  const commitWorkbook = useCallback((next: FortuneSheet[]) => {
    setSheets(next);
    autosave.schedule({ sheets: next, title });
  }, [autosave, title]);

  React.useEffect(() => {
    autosave.schedule({ sheets, title });
  }, [title]);

  const importWorkbook = async (file?: File, handle?: OrbiDocFileSystemFileHandle | null) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    try {
      let imported: FortuneSheet[];
      if (extension === 'xlsx' || extension === 'xls' || extension === 'ods' || extension === 'csv' || extension === 'tsv') {
        imported = xlsxArrayBufferToFortuneSheets(await file.arrayBuffer());
      } else {
        throw new Error('Use XLSX, XLS, ODS, CSV ou TSV.');
      }
      if (!imported.length) throw new Error('O arquivo não contém planilhas legíveis.');
      setSheets(imported);
      setTitle(file.name.replace(/\.[^/.]+$/, '') || title);
      setRevision((value) => value + 1);
      setFileHandle(handle || null);
      autosave.schedule({ sheets: imported, title: file.name.replace(/\.[^/.]+$/, '') || title });
      showNotification(`${file.name} importado no motor FortuneSheet.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao importar planilha.', 'error');
    }
  };

  const openFile = async () => {
    try {
      const picked = await pickLocalFile([
        {
          description: 'Planilhas',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
            'text/csv': ['.csv'],
            'text/tab-separated-values': ['.tsv'],
          },
        },
      ]);
      if (!picked) {
        fallbackInputRef.current?.click();
        return;
      }
      await importWorkbook(picked.file, picked.handle);
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Falha ao abrir planilha.', 'error');
    }
  };

  const currentSheets = () => {
    const live = workbookRef.current?.getAllSheets?.() as FortuneSheet[] | undefined;
    return live?.length ? live : sheets;
  };

  const exportXlsx = async () => {
    try {
      const activeSheets = currentSheets();
      const base = safeFileName(title.replace(/\.xlsx$/i, ''));
      const blob = fortuneSheetsToXlsxBlob(activeSheets);
      const existing = fileHandle?.name.toLowerCase().endsWith('.xlsx') ? fileHandle : null;
      const result = await saveLocalFile(blob, {
        suggestedName: `${base}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extensions: ['.xlsx'],
        existingHandle: existing,
      });
      if (result.handle) setFileHandle(result.handle);
      showNotification(result.method === 'overwrite' ? 'Planilha sobrescrita no disco local.' : 'XLSX gerado localmente.', 'success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Falha ao exportar XLSX.', 'error');
    }
  };

  const exportCsv = async () => {
    try {
      const activeSheets = currentSheets();
      const first = activeSheets[0];
      if (!first) throw new Error('Não há uma aba para exportar.');
      const base = safeFileName(`${title}-${first.name}`);
      await saveLocalFile(fortuneSheetToCsvBlob(first), {
        suggestedName: `${base}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        extensions: ['.csv'],
      });
      showNotification(`CSV da aba ${first.name} gerado localmente.`, 'success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Falha ao exportar CSV.', 'error');
    }
  };

  const onChange = useCallback((next: FortuneSheet[]) => {
    commitWorkbook(next);
  }, [commitWorkbook]);

  const hooks = useMemo(() => ({
    afterUpdateCell: (row: number, column: number, _oldValue: any, newValue: any) => {
      const formula = typeof newValue?.f === 'string' ? newValue.f : '';
      if (!formula) return;
      const normalized = normalizePtBrFormula(formula);
      if (normalized === formula) return;
      window.queueMicrotask(() => {
        workbookRef.current?.setCellValue(row, column, normalized, { type: 'f' });
      });
    },
  }), []);

  return (
    <section className="orbidoc-sheet-workspace" aria-label="Editor profissional de planilhas">
      <header className="orbidoc-sheet-commandbar">
        <div className="orbidoc-sheet-title-wrap">
          <IconFileSpreadsheet />
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Título da planilha" />
        </div>
        <button type="button" onClick={() => void openFile()}><IconUpload /> Abrir</button>
        <button type="button" onClick={() => void exportXlsx()}><IconDownload /> XLSX</button>
        <button type="button" onClick={() => void exportCsv()}><IconDownload /> CSV</button>
        <div className="orbidoc-sheet-formula-help" title="As fórmulas em português são normalizadas para o motor local">
          <IconDatabase /> SOMA · MÉDIA · SE · PROCV · CONT.SE
        </div>
        <input
          ref={fallbackInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.ods,.csv,.tsv"
          onChange={(event) => void importWorkbook(event.target.files?.[0])}
        />
      </header>

      <div className="orbidoc-fortune-host" key={`${project.id}:${revision}`}>
        <Workbook
          ref={workbookRef}
          data={sheets as any}
          onChange={onChange as any}
          hooks={hooks as any}
          lang="en"
          allowEdit
          showToolbar
          showFormulaBar
          showSheetTabs
          forceCalculation
          currency="BRL"
          row={100}
          column={26}
          addRows={50}
          defaultColWidth={88}
          defaultRowHeight={22}
          toolbarItems={[
            'undo', 'redo', '|', 'currency-format', 'percentage-format', 'number-decrease', 'number-increase', 'format', '|',
            'font', 'font-size', 'bold', 'italic', 'strike-through', 'underline', '|', 'font-color', 'background', 'border',
            'merge-cell', '|', 'horizontal-align', 'vertical-align', 'text-wrap', '|', 'freeze', 'filter', 'quick-formula',
          ]}
        />
      </div>

      <footer className="orbidoc-sheet-statusbar">
        <span>{status === 'saving' ? 'Salvando localmente…' : status === 'saved' ? 'Salvo localmente' : 'Pronto'}</span>
        {lastSaved ? <span>{lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
        <span>{sheets.length} aba(s)</span>
        <span>{countPopulatedCells(sheets)} célula(s)</span>
        {!navigator.onLine ? <span className="orbidoc-sheet-offline"><IconWifiOff /> Modificado offline</span> : null}
        <span>FortuneSheet · SheetJS · IndexedDB</span>
      </footer>
    </section>
  );
};
