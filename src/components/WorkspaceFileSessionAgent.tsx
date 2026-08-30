import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconChevronLeft as Back, IconCloud as Cloud, IconFile as FileIcon, IconX as X } from '@tabler/icons-react';
import { DocumentEditor } from './DocumentEditor';
import { OrbiDocLogo } from './OrbiDocLogo';
import { PdfOcrWorkspace } from './PdfOcrWorkspace';
import { PresentationEditor } from './PresentationEditor';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import type { HistoryItem, OcrItem, SavedProject } from '../types';
import { ORBIDOC_OPEN_FILE_EVENT, openFileInsideOrbiDoc, type OrbiDocOpenFileDetail } from '../lib/systemFileOpen';
import { importWorkspaceFile, resolveWorkspaceEditor, type ImportedWorkspaceFile } from '../lib/workspaceFileImport';

type LaunchFileHandle = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: LaunchFileHandle[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void | Promise<void>) => void };

type Session = ImportedWorkspaceFile & {
  file: File;
  source: OrbiDocOpenFileDetail['source'];
};

const launchQueue = () => (window as unknown as { launchQueue?: LaunchQueueLike }).launchQueue;

const SOURCE_LABELS: Record<NonNullable<OrbiDocOpenFileDetail['source']>, string> = {
  local: 'Dispositivo',
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  github: 'GitHub',
  share: 'Compartilhado',
  system: 'Sistema',
};

const ROUTE_LABELS: Record<ImportedWorkspaceFile['route'], string> = {
  word: 'Documento',
  excel: 'Planilha',
  powerpoint: 'Apresentação',
  extract: 'PDF & OCR',
};

const noopHistory = (_item: Omit<HistoryItem, 'id' | 'timestamp'>) => {};

export const WorkspaceFileSessionAgent: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [project, setProject] = useState<SavedProject | null>(null);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [loading, setLoading] = useState<{ file: File; source: OrbiDocOpenFileDetail['source'] } | null>(null);
  const [error, setError] = useState('');
  const bypassRef = useRef(false);
  const generationRef = useRef(0);
  const sessionRef = useRef<Session | null>(null);

  const cleanupSession = useCallback(() => {
    sessionRef.current?.cleanup?.();
    sessionRef.current = null;
    setSession(null);
    setProject(null);
    setOcrItems([]);
    setError('');
  }, []);

  const beginSession = useCallback(async (file: File, source: OrbiDocOpenFileDetail['source'] = 'local') => {
    const route = resolveWorkspaceEditor(file);
    if (!route) return false;
    const generation = ++generationRef.current;
    setLoading({ file, source });
    setError('');
    try {
      const imported = await importWorkspaceFile(file, source);
      if (generation !== generationRef.current) {
        imported.cleanup?.();
        return true;
      }
      sessionRef.current?.cleanup?.();
      const next: Session = { ...imported, file, source };
      sessionRef.current = next;
      setSession(next);
      setProject(imported.project);
      setOcrItems(imported.ocrItems || []);
      return true;
    } catch (reason) {
      if (generation === generationRef.current) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível abrir este arquivo no editor do OrbiDoc.');
      }
      return true;
    } finally {
      if (generation === generationRef.current) setLoading(null);
    }
  }, []);

  useLayoutEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OrbiDocOpenFileDetail>).detail;
      if (!detail?.file) return;
      if (bypassRef.current) {
        bypassRef.current = false;
        return;
      }
      if (!resolveWorkspaceEditor(detail.file)) return;
      event.stopImmediatePropagation();
      void beginSession(detail.file, detail.source || 'local');
    };
    window.addEventListener(ORBIDOC_OPEN_FILE_EVENT, handleOpen as EventListener);
    return () => window.removeEventListener(ORBIDOC_OPEN_FILE_EVENT, handleOpen as EventListener);
  }, [beginSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const queue = launchQueue();
      if (!queue) return;
      queue.setConsumer(async (params) => {
        const handle = params.files?.[0];
        if (!handle) return;
        const file = await handle.getFile();
        if (resolveWorkspaceEditor(file)) await beginSession(file, 'system');
        else openFileInsideOrbiDoc(file, 'system');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [beginSession]);

  useEffect(() => () => {
    generationRef.current += 1;
    sessionRef.current?.cleanup?.();
  }, []);

  const close = () => {
    generationRef.current += 1;
    setLoading(null);
    cleanupSession();
  };

  const openInReader = () => {
    const source = session?.source || loading?.source || 'local';
    const file = session?.file || loading?.file;
    if (!file) return;
    generationRef.current += 1;
    cleanupSession();
    setLoading(null);
    bypassRef.current = true;
    window.setTimeout(() => openFileInsideOrbiDoc(file, source), 0);
  };

  const showNotification = (_message: string, _type: 'success' | 'error' = 'success') => {
    // Editors already surface their own state. The focused session deliberately avoids
    // adding another global toast layer over the file workspace.
  };

  if (!session && !loading && !error) return null;

  const source = session?.source || loading?.source || 'local';
  const file = session?.file || loading?.file;
  const route = session?.route || (file ? resolveWorkspaceEditor(file) : null);

  const renderEditor = () => {
    if (loading) return <div className="h-full flex items-center justify-center p-8"><div className="text-center"><div className="w-9 h-9 rounded-full border-2 border-[#3157F6]/20 border-t-[#3157F6] animate-spin mx-auto" /><div className="mt-3 text-sm font-black">Preparando {file?.name}</div><div className="mt-1 text-[10px] text-slate-400">O arquivo está sendo convertido para o workspace editável local.</div></div></div>;
    if (error || !session || !project) return <div className="h-full flex items-center justify-center p-8 text-center"><div className="max-w-md"><FileIcon className="w-11 h-11 mx-auto text-rose-400" /><h2 className="mt-3 text-sm font-black">Não foi possível abrir no editor</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">{error || 'A sessão do arquivo não pôde ser criada.'}</p><div className="mt-4 flex justify-center gap-2"><button onClick={openInReader} className="h-10 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black">Tentar leitor universal</button><button onClick={close} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black">Fechar</button></div></div></div>;

    if (session.route === 'word') return <DocumentEditor project={project} onProjectChange={setProject} onSaveToHistory={noopHistory} showNotification={showNotification} />;
    if (session.route === 'excel') return <SpreadsheetEditor project={project} onProjectChange={setProject} onSaveToHistory={noopHistory} showNotification={showNotification} />;
    if (session.route === 'powerpoint') return <PresentationEditor project={project} onProjectChange={setProject} onSaveToHistory={noopHistory} showNotification={showNotification} />;
    return <PdfOcrWorkspace items={ocrItems} setItems={setOcrItems} onSaveToHistory={() => {}} showNotification={showNotification} />;
  };

  return <div className="fixed inset-0 z-[129] bg-[#F6F8FC] dark:bg-[#080D18] text-[#101827] dark:text-slate-100 flex flex-col" data-orbidoc-file-session="true">
    <header className="min-h-14 shrink-0 px-3 sm:px-4 border-b border-[#DCE5F0] dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-2 sm:gap-3 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <button type="button" onClick={close} className="w-9 h-9 rounded-xl hover:bg-[#EEF3FA] dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar sessão do arquivo"><Back className="w-4 h-4" /></button>
      <OrbiDocLogo size="sm" />
      <div className="hidden sm:block h-5 w-px bg-[#DCE5F0] dark:bg-slate-700" />
      <div className="min-w-0 flex-1 py-1">
        <div className="text-[11px] sm:text-xs font-black truncate">{file?.name || project?.title || 'Arquivo'}</div>
        <div className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[8px] sm:text-[9px] text-slate-400"><Cloud className="w-3 h-3 shrink-0" /><span className="truncate">{SOURCE_LABELS[source || 'local']}{route ? ` · ${ROUTE_LABELS[route]}` : ''} · sessão local editável</span></div>
      </div>
      {source === 'github' ? <span className="hidden md:inline-flex h-7 px-2.5 rounded-full bg-slate-100 dark:bg-slate-800 items-center text-[8px] font-black text-slate-500">Origem somente leitura</span> : source !== 'local' && source !== 'system' ? <span className="hidden md:inline-flex h-7 px-2.5 rounded-full bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 items-center text-[8px] font-black text-[#2446D8] dark:text-[#AFC4FF]">Save-back em preparação</span> : null}
      <button type="button" onClick={close} className="w-9 h-9 rounded-xl hover:bg-[#EEF3FA] dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="w-4 h-4" /></button>
    </header>
    <main className="flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:p-4"><div className="max-w-[1700px] mx-auto min-h-full">{renderEditor()}</div></main>
    <footer className="min-h-9 shrink-0 px-3 sm:px-4 py-2 border-t border-[#DCE5F0] dark:border-slate-800 bg-white dark:bg-[#101827] text-[8px] sm:text-[9px] text-slate-400 flex items-center gap-2">
      <span className="truncate">O arquivo foi importado para uma sessão local do editor. Use Exportar/Salvar cópia no próprio editor; sincronização de volta para a origem será habilitada somente quando o conector puder preservar versão e conflito com segurança.</span>
    </footer>
  </div>;
};
