import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconChevronLeft as Back, IconCloud as Cloud, IconDeviceFloppy as Save, IconFile as FileIcon, IconX as X } from '@tabler/icons-react';
import { DocumentEditor } from './DocumentEditor';
import { OrbiDocLogo } from './OrbiDocLogo';
import { PdfOcrWorkspace } from './PdfOcrWorkspace';
import { PresentationEditor } from './PresentationEditor';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import type { HistoryItem, OcrItem, OrbiDocFileOrigin, SavedProject } from '../types';
import { ORBIDOC_OPEN_FILE_EVENT, openFileInsideOrbiDoc, type OrbiDocOpenFileDetail } from '../lib/systemFileOpen';
import { importWorkspaceFile, resolveWorkspaceEditor, type ImportedWorkspaceFile } from '../lib/workspaceFileImport';
import { canSaveProjectToOrigin, ConnectedFileConflictError, saveProjectToConnectedOrigin } from '../services/connectedFileSave';

type LaunchFileHandle = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: LaunchFileHandle[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void | Promise<void>) => void };

type Session = ImportedWorkspaceFile & {
  file: File;
  source: OrbiDocOpenFileDetail['source'];
};

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

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
  const [notice, setNotice] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
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
    setNotice('');
    setSaveState('idle');
  }, []);

  const beginSession = useCallback(async (
    file: File,
    source: OrbiDocOpenFileDetail['source'] = 'local',
    origin?: Partial<OrbiDocFileOrigin>,
  ) => {
    const route = resolveWorkspaceEditor(file);
    if (!route) return false;
    const generation = ++generationRef.current;
    setLoading({ file, source });
    setError('');
    setNotice('');
    setSaveState('idle');
    try {
      const imported = await importWorkspaceFile(file, source || 'local', origin);
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
      void beginSession(detail.file, detail.source || 'local', detail.origin);
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

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice(message);
    if (type === 'error') setSaveState((state) => state === 'saving' ? 'error' : state);
  };

  const saveBack = async () => {
    if (!project || !canSaveProjectToOrigin(project) || saveState === 'saving') return;
    setSaveState('saving');
    setNotice('Validando a versão remota antes de salvar…');
    try {
      const origin = await saveProjectToConnectedOrigin(project);
      setProject((current) => current ? { ...current, origin } : current);
      setSaveState('saved');
      setNotice(`Salvo em ${SOURCE_LABELS[origin.source]}. A referência de versão foi atualizada.`);
    } catch (reason) {
      if (reason instanceof ConnectedFileConflictError) {
        setSaveState('conflict');
        setNotice(reason.message);
      } else {
        setSaveState('error');
        setNotice(reason instanceof Error ? reason.message : 'Falha ao salvar o arquivo na origem.');
      }
    }
  };

  if (!session && !loading && !error) return null;

  const source = session?.source || loading?.source || 'local';
  const file = session?.file || loading?.file;
  const route = session?.route || (file ? resolveWorkspaceEditor(file) : null);
  const writableOrigin = Boolean(project && canSaveProjectToOrigin(project));

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
      {writableOrigin ? <button type="button" onClick={() => void saveBack()} disabled={saveState === 'saving'} className="h-9 px-3 rounded-xl bg-[#3157F6] text-white text-[9px] sm:text-[10px] font-black inline-flex items-center gap-1.5 disabled:opacity-50"><Save className="w-3.5 h-3.5" />{saveState === 'saving' ? 'Validando…' : saveState === 'saved' ? 'Salvo' : 'Salvar na origem'}</button> : source === 'github' || project?.origin?.readOnly ? <span className="hidden md:inline-flex h-7 px-2.5 rounded-full bg-slate-100 dark:bg-slate-800 items-center text-[8px] font-black text-slate-500">Origem somente leitura</span> : null}
      <button type="button" onClick={close} className="w-9 h-9 rounded-xl hover:bg-[#EEF3FA] dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="w-4 h-4" /></button>
    </header>
    {notice && <div className={`shrink-0 px-3 sm:px-4 py-2 border-b text-[9px] font-bold ${saveState === 'conflict' || saveState === 'error' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200' : 'bg-[#EEF3FA] dark:bg-[#0D1E5B]/25 border-[#DCE5F0] dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>{notice}</div>}
    <main className="flex-1 min-h-0 overflow-auto p-2 sm:p-3 lg:p-4"><div className="max-w-[1700px] mx-auto min-h-full">{renderEditor()}</div></main>
    <footer className="min-h-9 shrink-0 px-3 sm:px-4 py-2 border-t border-[#DCE5F0] dark:border-slate-800 bg-white dark:bg-[#101827] text-[8px] sm:text-[9px] text-slate-400 flex items-center gap-2">
      <span className="truncate">{writableOrigin ? 'Salvar na origem valida a revisão remota antes de substituir o conteúdo. Se houver conflito, nenhuma versão é sobrescrita.' : 'Use Exportar/Salvar cópia no editor. Esta origem não oferece save-back seguro nesta sessão.'}</span>
    </footer>
  </div>;
};
