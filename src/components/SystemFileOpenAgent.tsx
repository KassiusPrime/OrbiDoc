import React, { useEffect, useRef, useState } from 'react';
import { IconChevronLeft as Back, IconFile as FileIcon, IconX as X } from '@tabler/icons-react';
import { OrbiDocLogo } from './OrbiDocLogo';
import { readArchiveEntry, readDocumentFile, releaseReaderDocument, type ReaderDocument } from '../lib/documentReader';
import { ORBIDOC_OPEN_FILE_EVENT, type OrbiDocOpenFileDetail } from '../lib/systemFileOpen';

type LaunchFileHandle = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: LaunchFileHandle[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void | Promise<void>) => void };

const launchQueue = () => (window as unknown as { launchQueue?: LaunchQueueLike }).launchQueue;

const SOURCE_LABELS: Record<NonNullable<OrbiDocOpenFileDetail['source']>, string> = {
  local: 'Arquivo local',
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  github: 'GitHub',
  share: 'Compartilhado com OrbiDoc',
  system: 'Sistema',
};

const FontPreview: React.FC<{ document: ReaderDocument }> = ({ document: readerDocument }) => {
  const [family, setFamily] = useState('system-ui');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!readerDocument.objectUrl || typeof FontFace === 'undefined') return;
    const name = `OrbiDocPreview_${readerDocument.id.replace(/-/g, '')}`;
    const face = new FontFace(name, `url(${readerDocument.objectUrl})`);
    let active = true;
    face.load().then((loaded) => {
      if (!active) return;
      document.fonts.add(loaded);
      setFamily(name);
    }).catch(() => active && setError('O navegador reconheceu o arquivo de fonte, mas não conseguiu renderizar esta variante.'));
    return () => { active = false; try { document.fonts.delete(face); } catch { /* browser cleanup is best effort */ } };
  }, [readerDocument.id, readerDocument.objectUrl]);

  if (error) return <div className="h-full flex items-center justify-center p-8 text-center text-xs text-slate-400">{error}</div>;
  return <div className="max-w-5xl mx-auto p-6 sm:p-10 space-y-8">
    <div><div className="text-[9px] uppercase tracking-[0.16em] font-black text-slate-400">Prévia de fonte</div><h1 className="mt-2 text-2xl font-black">{readerDocument.name}</h1></div>
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 sm:p-8" style={{ fontFamily: family }}>
      <p className="text-4xl sm:text-6xl leading-tight">OrbiDoc Aa Bb Cc 0123</p>
      <p className="mt-6 text-2xl">Documentos em órbita. Inteligência em conexão.</p>
      <p className="mt-6 text-base leading-relaxed">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 !?.,:;()[]{} @#%&amp;*</p>
    </div>
    <div className="grid sm:grid-cols-3 gap-3">{[16, 24, 36].map((size) => <div key={size} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className="text-[9px] font-black text-slate-400">{size}px</div><div className="mt-2 truncate" style={{ fontFamily: family, fontSize: size }}>OrbiDoc Workspace</div></div>)}</div>
  </div>;
};

export const SystemFileOpenAgent: React.FC = () => {
  const documentRef = useRef<ReaderDocument | null>(null);
  const [readerDocument, setReaderDocument] = useState<ReaderDocument | null>(null);
  const [source, setSource] = useState<OrbiDocOpenFileDetail['source']>('system');
  const [archivePath, setArchivePath] = useState('');
  const [archiveContent, setArchiveContent] = useState<{ kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string } | null>(null);
  const [error, setError] = useState('');

  const replaceDocument = (next: ReaderDocument | null) => {
    releaseReaderDocument(documentRef.current);
    documentRef.current = next;
    setReaderDocument(next);
    setArchivePath('');
    setArchiveContent(null);
  };

  const openFile = async (file: File, nextSource: OrbiDocOpenFileDetail['source'] = 'system') => {
    try {
      setError('');
      setSource(nextSource);
      replaceDocument(await readDocumentFile(file));
    } catch (reason) {
      setSource(nextSource);
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo recebido pelo OrbiDoc.');
    }
  };

  useEffect(() => {
    const queue = launchQueue();
    if (queue) {
      queue.setConsumer(async (params) => {
        const handle = params.files?.[0];
        if (!handle) return;
        try { await openFile(await handle.getFile(), 'system'); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo recebido pelo sistema.'); }
      });
    }

    const handleInternalOpen = (event: Event) => {
      const detail = (event as CustomEvent<OrbiDocOpenFileDetail>).detail;
      if (!detail?.file) return;
      void openFile(detail.file, detail.source || 'local');
    };
    window.addEventListener(ORBIDOC_OPEN_FILE_EVENT, handleInternalOpen as EventListener);
    return () => window.removeEventListener(ORBIDOC_OPEN_FILE_EVENT, handleInternalOpen as EventListener);
  }, []);

  useEffect(() => () => {
    releaseReaderDocument(documentRef.current);
    documentRef.current = null;
  }, []);

  const close = () => {
    replaceDocument(null);
    setError('');
  };

  const openArchiveEntry = async (path: string) => {
    if (!readerDocument) return;
    setArchivePath(path);
    try {
      setError('');
      setArchiveContent(await readArchiveEntry(readerDocument, path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir este item do arquivo compactado.');
    }
  };

  if (!readerDocument && !error) return null;

  const renderContent = () => {
    if (error && !readerDocument) return <div className="h-full flex items-center justify-center p-8 text-center"><div><FileIcon className="w-12 h-12 mx-auto text-rose-400" /><div className="mt-3 text-sm font-black">Falha ao abrir arquivo</div><div className="mt-1 text-xs text-slate-500">{error}</div></div></div>;
    if (!readerDocument) return null;
    if (readerDocument.kind === 'pdf' && readerDocument.objectUrl) return <iframe title={readerDocument.name} src={readerDocument.objectUrl} className="w-full h-full border-0 bg-white" />;
    if (readerDocument.kind === 'image' && readerDocument.objectUrl) return <div className="h-full flex items-center justify-center p-5 bg-slate-100 dark:bg-black/20"><img src={readerDocument.objectUrl} alt={readerDocument.name} className="max-w-full max-h-full object-contain rounded-xl shadow-xl" /></div>;
    if (readerDocument.kind === 'media' && readerDocument.objectUrl) {
      if (readerDocument.mediaType === 'audio') return <div className="h-full flex items-center justify-center p-6"><div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-6"><div className="text-sm font-black truncate">{readerDocument.name}</div><audio src={readerDocument.objectUrl} controls className="mt-5 w-full" /></div></div>;
      return <div className="h-full flex items-center justify-center bg-black p-2 sm:p-5"><video src={readerDocument.objectUrl} controls playsInline className="max-w-full max-h-full" /></div>;
    }
    if (readerDocument.kind === 'font') return <FontPreview document={readerDocument} />;
    if (readerDocument.kind === 'zip') {
      if (!archivePath) return <div className="h-full flex items-center justify-center p-8 text-center text-xs text-slate-400">Escolha um item do pacote na coluna lateral.</div>;
      if (archiveContent?.kind === 'image' && archiveContent.dataUrl) return <div className="h-full flex items-center justify-center p-5"><img src={archiveContent.dataUrl} alt={archivePath} className="max-w-full max-h-full object-contain" /></div>;
      if (archiveContent?.html) return <article className="orbidoc-reader-prose p-8 md:p-12 max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: archiveContent.html }} />;
      if (archiveContent?.text !== undefined) return <pre className="p-8 whitespace-pre-wrap break-words max-w-5xl mx-auto text-sm">{archiveContent.text}</pre>;
      return <div className="h-full flex items-center justify-center text-xs text-slate-400">Item binário sem pré-visualização.</div>;
    }
    if (readerDocument.html) return <article className="orbidoc-reader-prose p-8 md:p-12 max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: readerDocument.html }} />;
    if (readerDocument.text !== undefined) return <pre className={`p-8 md:p-12 whitespace-pre-wrap break-words max-w-5xl mx-auto leading-relaxed ${readerDocument.kind === 'hex' ? 'font-mono text-[11px]' : 'text-sm'}`}>{readerDocument.text}</pre>;
    return <div className="h-full flex items-center justify-center text-xs text-slate-400">Este formato foi reconhecido, mas ainda não possui uma superfície dedicada.</div>;
  };

  return (
    <div className="fixed inset-0 z-[130] bg-[#F6F8FC] dark:bg-[#080D18] flex flex-col">
      <header className="h-14 shrink-0 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3">
        <OrbiDocLogo size="sm" />
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black truncate">{readerDocument?.title || 'Abrir com OrbiDoc'}</div>
          <div className="text-[9px] text-slate-400 truncate">{readerDocument ? `${SOURCE_LABELS[source || 'system']} · ${readerDocument.name} · ${(readerDocument.extension || 'arquivo').toUpperCase()}` : SOURCE_LABELS[source || 'system']}</div>
        </div>
        {readerDocument && <span className="hidden sm:inline-flex px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-wide text-slate-500">{readerDocument.kind}</span>}
        <button onClick={close} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar arquivo"><X className="w-4 h-4" /></button>
      </header>
      {error && readerDocument && <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/30 text-[10px] font-bold text-rose-700 dark:text-rose-300">{error}</div>}
      <div className={`flex-1 min-h-0 grid ${readerDocument?.kind === 'zip' ? 'md:grid-cols-[280px_minmax(0,1fr)]' : ''}`}>
        {readerDocument?.kind === 'zip' && (
          <aside className="border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-[#101827] p-2">
            <div className="px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Conteúdo do pacote</div>
            <div className="space-y-1">
              {readerDocument.archiveEntries?.filter((entry) => !entry.directory).map((entry) => (
                <button key={entry.path} onClick={() => void openArchiveEntry(entry.path)} title={entry.path} className={`w-full px-2 py-2 rounded-lg text-left text-[9px] truncate ${archivePath === entry.path ? 'bg-[#3157F6] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{entry.path}</button>
              ))}
            </div>
          </aside>
        )}
        <main className="min-w-0 min-h-0 overflow-auto bg-white dark:bg-[#0E1118]">{renderContent()}</main>
      </div>
      <footer className="min-h-10 shrink-0 px-3 sm:px-5 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-2 text-[9px] text-slate-400">
        <Back className="w-3.5 h-3.5 shrink-0" /><span>Fechar retorna ao workspace. A abertura é local; arquivos de serviços conectados só são transferidos quando você escolhe explicitamente uma ação de nuvem.</span>
      </footer>
    </div>
  );
};