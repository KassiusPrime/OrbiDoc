import React, { useEffect, useState } from 'react';
import { IconChevronLeft as Back, IconFile as FileIcon, IconX as X } from '@tabler/icons-react';
import { OrbiDocLogo } from './OrbiDocLogo';
import { readArchiveEntry, readDocumentFile, releaseReaderDocument, type ReaderDocument } from '../lib/documentReader';

type LaunchFileHandle = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: LaunchFileHandle[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void | Promise<void>) => void };

const launchQueue = () => (window as unknown as { launchQueue?: LaunchQueueLike }).launchQueue;

export const SystemFileOpenAgent: React.FC = () => {
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [archivePath, setArchivePath] = useState('');
  const [archiveContent, setArchiveContent] = useState<{ kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const queue = launchQueue();
    if (!queue) return;
    queue.setConsumer(async (params) => {
      const handle = params.files?.[0];
      if (!handle) return;
      try {
        setError('');
        const file = await handle.getFile();
        setDocument((previous) => {
          releaseReaderDocument(previous);
          return previous;
        });
        const next = await readDocumentFile(file);
        setArchivePath('');
        setArchiveContent(null);
        setDocument(next);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo recebido pelo sistema.');
      }
    });
    return () => {};
  }, []);

  useEffect(() => () => releaseReaderDocument(document), [document]);

  const close = () => {
    releaseReaderDocument(document);
    setDocument(null);
    setArchivePath('');
    setArchiveContent(null);
    setError('');
  };

  const openArchiveEntry = async (path: string) => {
    if (!document) return;
    setArchivePath(path);
    try {
      setArchiveContent(await readArchiveEntry(document, path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir este item do arquivo compactado.');
    }
  };

  if (!document && !error) return null;

  const renderContent = () => {
    if (error && !document) return <div className="h-full flex items-center justify-center p-8 text-center"><div><FileIcon className="w-12 h-12 mx-auto text-rose-400" /><div className="mt-3 text-sm font-black">Falha ao abrir arquivo</div><div className="mt-1 text-xs text-slate-500">{error}</div></div></div>;
    if (!document) return null;
    if (document.kind === 'pdf' && document.objectUrl) return <iframe title={document.name} src={document.objectUrl} className="w-full h-full border-0 bg-white" />;
    if (document.kind === 'image' && document.objectUrl) return <div className="h-full flex items-center justify-center p-5 bg-slate-100 dark:bg-black/20"><img src={document.objectUrl} alt={document.name} className="max-w-full max-h-full object-contain rounded-xl shadow-xl" /></div>;
    if (document.kind === 'zip') {
      if (!archivePath) return <div className="h-full flex items-center justify-center p-8 text-center text-xs text-slate-400">Escolha um item do ZIP na coluna lateral.</div>;
      if (archiveContent?.kind === 'image' && archiveContent.dataUrl) return <div className="h-full flex items-center justify-center p-5"><img src={archiveContent.dataUrl} alt={archivePath} className="max-w-full max-h-full object-contain" /></div>;
      if (archiveContent?.html) return <article className="orbidoc-reader-prose p-8 md:p-12 max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: archiveContent.html }} />;
      if (archiveContent?.text !== undefined) return <pre className="p-8 whitespace-pre-wrap break-words max-w-5xl mx-auto text-sm">{archiveContent.text}</pre>;
      return <div className="h-full flex items-center justify-center text-xs text-slate-400">Item binário sem pré-visualização.</div>;
    }
    if (document.html) return <article className="orbidoc-reader-prose p-8 md:p-12 max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: document.html }} />;
    if (document.text !== undefined) return <pre className="p-8 md:p-12 whitespace-pre-wrap break-words max-w-5xl mx-auto text-sm leading-relaxed">{document.text}</pre>;
    return <div className="h-full flex items-center justify-center text-xs text-slate-400">Este formato não possui pré-visualização dedicada.</div>;
  };

  return (
    <div className="fixed inset-0 z-[130] bg-[#F7F9FC] dark:bg-[#080D18] flex flex-col">
      <header className="h-14 shrink-0 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3">
        <OrbiDocLogo size="sm" />
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black truncate">{document?.title || 'Abrir com OrbiDoc'}</div>
          <div className="text-[9px] text-slate-400 truncate">{document ? `${document.name} · ${document.extension.toUpperCase()}` : 'Arquivo recebido pelo sistema'}</div>
        </div>
        <button onClick={close} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar arquivo"><X className="w-4 h-4" /></button>
      </header>
      {error && document && <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/30 text-[10px] font-bold text-rose-700 dark:text-rose-300">{error}</div>}
      <div className={`flex-1 min-h-0 grid ${document?.kind === 'zip' ? 'md:grid-cols-[280px_minmax(0,1fr)]' : ''}`}>
        {document?.kind === 'zip' && (
          <aside className="border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-[#101827] p-2">
            <div className="px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Conteúdo do ZIP</div>
            <div className="space-y-1">
              {document.archiveEntries?.filter((entry) => !entry.directory).map((entry) => (
                <button key={entry.path} onClick={() => void openArchiveEntry(entry.path)} title={entry.path} className={`w-full px-2 py-2 rounded-lg text-left text-[9px] truncate ${archivePath === entry.path ? 'bg-[#3157F6] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{entry.path}</button>
              ))}
            </div>
          </aside>
        )}
        <main className="min-w-0 min-h-0 overflow-auto bg-white dark:bg-[#0E1118]">{renderContent()}</main>
      </div>
      <footer className="h-10 shrink-0 px-3 sm:px-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-2 text-[9px] text-slate-400">
        <Back className="w-3.5 h-3.5" /><span>Fechar retorna ao workspace. O arquivo é lido localmente e não é enviado automaticamente.</span>
      </footer>
    </div>
  );
};
