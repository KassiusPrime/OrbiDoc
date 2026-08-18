import React from 'react';
import { PdfOcrWorkspace } from './PdfOcrWorkspace';
import { OcrItem } from '../types';

export interface OcrPreviewWorkspaceProps {
  items?: OcrItem[];
  setItems?: React.Dispatch<React.SetStateAction<OcrItem[]>>;
  ocrList?: OcrItem[];
  setOcrList?: React.Dispatch<React.SetStateAction<OcrItem[]>>;
  onSaveToHistory?: (title: string, summary: string, details?: string, tags?: string[]) => void;
  onSendToChat?: (text: string) => void;
  onSendToAiText?: (text: string) => void;
  onNotification?: (msg: string, type?: 'success' | 'error') => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  exportAsTxt?: (text: string, name: string) => void;
  exportAsDocx?: (text: string, name: string) => void;
  exportAsPdf?: (text: string, name: string) => void;
  exportAsMd?: (text: string, name: string) => void;
  onOpenCustomPdf?: (text: string, fileName: string) => void;
  setIsGoogleDriveOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SORTED_LANGUAGES = [
  { code: 'de', name: 'Alemão', ocrCode: 'deu' },
  { code: 'es', name: 'Espanhol', ocrCode: 'spa' },
  { code: 'fr', name: 'Francês', ocrCode: 'fra' },
  { code: 'en', name: 'Inglês', ocrCode: 'eng' },
  { code: 'it', name: 'Italiano', ocrCode: 'ita' },
  { code: 'ja', name: 'Japonês', ocrCode: 'jpn' },
  { code: 'pt-BR', name: 'Português (Brasil)', ocrCode: 'por' },
].sort((a, b) => a.name.localeCompare(b.name));

export const OcrPreviewWorkspace: React.FC<OcrPreviewWorkspaceProps> = ({
  items,
  setItems,
  ocrList,
  setOcrList,
  onSaveToHistory,
  onSendToChat,
  onSendToAiText,
  onNotification,
  showNotification,
  exportAsTxt,
  exportAsDocx,
  exportAsPdf,
  exportAsMd,
}) => {
  const sourceItems = items || ocrList || [];
  const updateItems = setItems || setOcrList;
  if (!updateItems) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">O workspace PDF/OCR precisa de um estado de documentos válido.</div>;
  }

  return (
    <PdfOcrWorkspace
      items={sourceItems}
      setItems={updateItems}
      onSaveToHistory={onSaveToHistory}
      onSendToChat={onSendToChat}
      onSendToAiText={onSendToAiText}
      showNotification={onNotification || showNotification}
      exportAsTxt={exportAsTxt}
      exportAsDocx={exportAsDocx}
      exportAsPdf={exportAsPdf}
      exportAsMd={exportAsMd}
    />
  );
};
