import React, { useEffect, useState } from 'react';
import { IconScan as Scan, IconX as X } from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { OcrItem } from '../types';
import { OrbiDocLogo } from './OrbiDocLogo';
import { ScanReaderWorkspace } from './ScanReaderWorkspace';

const OCR_KEY = 'orbidoc_scan_reader_ocr_v1';
const HISTORY_KEY = 'orbidoc_history_v2';

const readStored = <T,>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const QuickScanReaderLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OcrItem[]>(() => readStored<OcrItem>(OCR_KEY));
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => { localStorage.setItem(OCR_KEY, JSON.stringify(items.slice(0, 100))); }, [items]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    document.documentElement.classList.toggle('orbidoc-overlay-open', open);
    return () => document.documentElement.classList.remove('orbidoc-overlay-open');
  }, [open]);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const saveHistory = (title: string, summary: string, details?: string, tags?: string[]) => {
    const history = readStored<any>(HISTORY_KEY);
    history.unshift({
      id: crypto.randomUUID(),
      type: 'ocr',
      title,
      summary,
      details,
      tags,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 250)));
    window.dispatchEvent(new Event('orbidoc:history-updated'));
  };

  const saveText = (text: string, name: string, type: 'txt' | 'md') => {
    const base = name.replace(/\.[^/.]+$/, '') || 'OrbiDoc';
    saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${base}.${type}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[72] right-4 bottom-[84px] lg:bottom-5 h-12 lg:h-11 px-3 lg:px-4 rounded-2xl bg-[#3157F6] hover:bg-[#2446D8] text-white shadow-xl shadow-[#3157F6]/25 inline-flex items-center gap-2 text-[10px] font-black active:scale-95 transition-transform"
        aria-label="Abrir Scan e Reader"
        title="Scan & Reader · Ctrl+Shift+O"
      >
        <Scan className="w-5 h-5" />
        <span className="hidden lg:inline">Scan & Reader</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-[#F7F9FC] dark:bg-[#080D18] flex flex-col">
          <header className="h-14 shrink-0 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#101827]/95 backdrop-blur flex items-center gap-3">
            <OrbiDocLogo size="sm" />
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="min-w-0 flex-1"><div className="text-xs font-black">Scan & Reader</div><div className="text-[9px] text-slate-400">Scanner, leitor universal e OCR local</div></div>
            <div className="hidden md:block text-[9px] text-slate-400">Ctrl+Shift+O</div>
            <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar Scan e Reader"><X className="w-4 h-4" /></button>
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
            <ScanReaderWorkspace
              items={items}
              setItems={setItems}
              onSaveToHistory={saveHistory}
              onSendToChat={(text) => { navigator.clipboard?.writeText(text).then(() => notify('Texto copiado. Abra o Assistente IA para usar no chat.', 'success')).catch(() => notify('Não foi possível copiar o texto.', 'error')); }}
              onSendToAiText={(text) => { navigator.clipboard?.writeText(text).then(() => notify('Texto copiado para uso no Assistente IA.', 'success')).catch(() => notify('Não foi possível copiar o texto.', 'error')); }}
              showNotification={notify}
              exportAsTxt={(text, name) => saveText(text, name, 'txt')}
              exportAsMd={(text, name) => saveText(text, name, 'md')}
            />
          </main>
          {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`fixed z-[120] top-16 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-white'}`}>{notice.message}</div>}
        </div>
      )}
    </>
  );
};
