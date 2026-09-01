import React, { useState } from 'react';
import { IconFileTypePdf, IconScan } from '@tabler/icons-react';
import type { OcrItem, SavedProject } from '../types';
import { PdfOcrWorkspace } from './PdfOcrWorkspace';
import { PdfStudio } from './PdfStudio';

export interface PdfProductivityWorkspaceProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  items: OcrItem[];
  setItems: React.Dispatch<React.SetStateAction<OcrItem[]>>;
  onSaveToHistory?: (title: string, summary: string, details?: string, tags?: string[]) => void;
  onSendToChat?: (text: string) => void;
  onSendToAiText?: (text: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  exportAsTxt?: (text: string, name: string) => void;
  exportAsDocx?: (text: string, name: string) => void;
  exportAsPdf?: (text: string, name: string) => void;
  exportAsMd?: (text: string, name: string) => void;
}

export const PdfProductivityWorkspace: React.FC<PdfProductivityWorkspaceProps> = ({
  project,
  onProjectChange,
  ...ocrProps
}) => {
  const [mode, setMode] = useState<'pdf' | 'ocr'>('pdf');
  return (
    <div className="orbidoc-pdf-productivity-shell">
      <div className="orbidoc-pdf-mode-tabs" role="tablist" aria-label="Ferramentas PDF e OCR">
        <button type="button" role="tab" aria-selected={mode === 'pdf'} className={mode === 'pdf' ? 'is-active' : ''} onClick={() => setMode('pdf')}>
          <IconFileTypePdf /> PDF Studio
        </button>
        <button type="button" role="tab" aria-selected={mode === 'ocr'} className={mode === 'ocr' ? 'is-active' : ''} onClick={() => setMode('ocr')}>
          <IconScan /> OCR & extração
        </button>
      </div>
      <div className="orbidoc-pdf-mode-content">
        {mode === 'pdf'
          ? <PdfStudio project={project} onProjectChange={onProjectChange} showNotification={ocrProps.showNotification} />
          : <PdfOcrWorkspace {...ocrProps} />}
      </div>
    </div>
  );
};
