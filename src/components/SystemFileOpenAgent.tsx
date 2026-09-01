import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconChevronLeft as Back,
  IconCopy as Copy,
  IconDownload as Download,
  IconFile as FileIcon,
  IconFolderOpen as FolderOpen,
  IconSearch as Search,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { OrbiDocLogo } from './OrbiDocLogo';
import { dispatchProfessionalFile, isProfessionalOfficeFile } from './ProfessionalFileRouterAgent';
import { READER_ACCEPT, readArchiveEntry, readDocumentFile, releaseReaderDocument, type ReaderDocument } from '../lib/documentReader';

type LaunchFileHandle = { getFile: () => Promise<File> };
type LaunchParamsLike = { files?: LaunchFileHandle[] };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParamsLike) => void | Promise<void>) => void };

const launchQueue = () => (window as unknown as { launchQueue?: LaunchQueueLike }).launchQueue;
const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;

export const SystemFileOpenAgent: React.FC = () => {
  const documentRef = useRef<ReaderDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [archivePath, setArchivePath] = useState('');
  const [archiveContent, setArchiveContent] = useState<{ kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string } | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  const replaceDocument = (next: ReaderDocument | null) => {
    releaseReaderDocument(documentRef.current);
    documentRef.current = next;
    setDocument(next);
    setArchivePath('');
    setArchiveContent(null);
    setQuery('');
    setNotice('');
  };

  const loadFile = async (file: File) => {
    setError('');
    if (isProfessionalOfficeFile(file)) {
      replaceDocument(null);
      dispatchProfessionalFile(file);
      return;
    }
    replaceDocument(await readDocumentFile(file));
  };

  useEffect(() => {
    const queue = launchQueue();
    if (!queue) return;
    queue.setConsumer(async (params) => {
      const handle = params.files?.[0];
      if (!handle) return;
      try {
        await loadFile(await handle.getFile());
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo recebido pelo sistema.');
      }
    });
    return () => {};
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
    if (!document) return;
    setArchivePath(path);
    try {
      setError('');
      setArchiveContent(await readArchiveEntry(document, path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir este item do arquivo compactado.');
    }
  };

  const plainText = archivePath ? archiveContent?.text || '' : document?.text || '';
  const queryCount = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    if (!needle || !plainText) return 0;
    let count = 0;
    let start = 0;
    const haystack = plainText.toLocaleLowerCase('pt-BR');
    while ((start = haystack.indexOf(needle, start)) >= 0 && count < 10000) { count += 1; start += Math.max(1, needle.length); }
    return count;
  }, [plainText, query]);

  const archiveEntries = useMemo(() => {
    if (document?.kind !== 'zip') return [];
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return (document.archiveEntries || []).filter((entry) => !entry.directory && (!needle || entry.path.toLocaleLowerCase('pt-BR').includes(needle)));
  }, [document, query]);

  const copyText = async () => {
    if (!plainText) return;
    await navigator.clipboard.writeText(plainText);
    setNotice('Texto copiado.');
  };

  const downloadOriginal = () => {
    if (!document?.sourceFile) return;
    saveAs(document.sourceFile, document.name);
    setNotice('Cópia do arquivo preparada.');
  };

  if (!document && !error) return <input ref={inputRef} type="file" accept={READER_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file).catch((reason) => setError(reason instanceof Error ? reason.message : 'Falha ao abrir arquivo.')); event.target.value = ''; }} />;

  const renderContent = () => {
    if (error && !document) return <div className="h-full flex items-center justify-center p-8 text-center"><div><FileIcon className="w-12 h-12 mx-auto text-rose-400" /><div className="mt-3 text-sm font-black">Falha ao abrir arquivo</div><div className="mt-1 text-xs text-slate-500">{error}</div><button type="button" onClick={() => inputRef.current?.click()} className="mt-4 h-9 px-3 rounded-xl bg-[#3157F6] text-white text-[10px] font-black">Escolher outro arquivo</button></div></div>;
    if (!document) return null;
    if (document.kind === 'pdf' && document.objectUrl) return <iframe title={document.name} src={document.objectUrl} className="w-full h-full border-0 bg-white" />;
    if (document.kind === 'image' && document.objectUrl) return <div className="h-full flex items-center justify-center p-5 bg-slate-100 dark:bg-black/20"><img src={document.objectUrl} alt={document.name} className="max-w-full max-h-full object-contain rounded-xl shadow-xl" /></div>;
    if (document.kind === 'zip') {
      if (!archivePath) return <div className="h-full flex items-center justify-center p-8 text-center text-xs text-slate-400">Escolha um item do ZIP na coluna lateral. Arquivos binários continuam preservados mesmo quando não há pré-visualização.</div>;
      if (archiveContent?.kind === 'image' && archiveContent.dataUrl) return <div className="h-full flex items-center justify-center p-5"><img src={archiveContent.dataUrl} alt={archivePath} className="max-w-full max-h-full object-contain" /></div>;
      if (archiveContent?.html) return <article className="orbidoc-reader-prose p-5 sm:p-8 md:p-12 max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: archiveContent.html }} />;
      if (archiveContent?.text !== undefined) return <pre className="p-5 sm:p-8 whitespace-pre-wrap break-words max-w-5xl mx-auto text-sm">{archiveContent.text}</pre>;
      return <div className="h-full flex items-center justify-center text-xs text-slate-400">Item binário sem pré-visualização. Baixe o arquivo original para preservar todo o conteúdo.</div>;
    }
    if (document.html) return <article className="orbidoc-reader-prose p-5 sm:p-8 md:p-12 max-w-5xl mx-auto" dangerouslySetInnerHTML={{ __html: document.html }} />;
    if (document.text !== undefined) return <pre className="p-5 sm:p-8 md:p-12 whitespace-pre-wrap break-words max-w-5xl mx-auto text-sm leading-relaxed">{document.text}</pre>;
    return <div className="h-full flex items-center justify-center p-8 text-center"><div><FileIcon className="w-10 h-10 mx-auto text-slate-300" /><div className="mt-3 text-sm font-black">Pré-visualização indisponível</div><p className="mt-1 text-xs text-slate-400">O OrbiDoc reconheceu o arquivo, mas não tenta interpretar formatos binários desconhecidos.</p></div></div>;
  };

  return (
    <div className="fixed inset-0 z-[130] bg-[#F7F9FC] dark:bg-[#080D18] flex flex-col">
      <input ref={inputRef} type="file" accept={READER_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file).catch((reason) => setError(reason instanceof Error ? reason.message : 'Falha ao abrir arquivo.')); event.target.value = ''; }} />
      <header className="min-h-14 shrink-0 px-3 sm:px-5 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex flex-wrap items-center gap-2 sm:gap-3">
        <OrbiDocLogo size="sm" />
        <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-[140px] flex-1">
          <div className="text-xs font-black truncate">{document?.title || 'Abrir com OrbiDoc'}</div>
          <div className="text-[9px] text-slate-400 truncate">{document ? `${document.name} · ${document.extension.toUpperCase() || 'ARQUIVO'} · ${sizeLabel(document.size)}` : 'Arquivo recebido pelo sistema'}</div>
        </div>
        {document && (document.text || archiveContent?.text || document.kind === 'zip') && <div className="relative order-last sm:order-none w-full sm:w-52"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={document.kind === 'zip' ? 'Filtrar conteúdo do ZIP…' : 'Buscar no texto…'} className="w-full h-9 pl-8 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[10px] outline-none focus:border-[#3157F6]" />{query && document.kind !== 'zip' && <span className="absolute right-2.5 top-2.5 text-[9px] font-black text-slate-400">{queryCount}</span>}</div>}
        {plainText && <button type="button" onClick={() => void copyText()} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar texto extraído"><Copy className="w-4 h-4" /></button>}
        {document?.sourceFile && <button type="button" onClick={downloadOriginal} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Salvar cópia do arquivo original"><Download className="w-4 h-4" /></button>}
        <button type="button" onClick={() => inputRef.current?.click()} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Abrir outro arquivo"><FolderOpen className="w-4 h-4" /></button>
        <button onClick={close} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar arquivo"><X className="w-4 h-4" /></button>
      </header>
      {error && document && <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/30 text-[10px] font-bold text-rose-700 dark:text-rose-300">{error}</div>}
      {notice && <div role="status" className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/25 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{notice}</div>}
      <div className={`flex-1 min-h-0 grid ${document?.kind === 'zip' ? 'md:grid-cols-[300px_minmax(0,1fr)]' : ''}`}>
        {document?.kind === 'zip' && (
          <aside className="border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-[#101827] p-2">
            <div className="px-2 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Conteúdo do ZIP · {archiveEntries.length} item(ns)</div>
            <div className="space-y-1">
              {archiveEntries.map((entry) => <button key={entry.path} onClick={() => void openArchiveEntry(entry.path)} title={entry.path} className={`w-full px-2 py-2 rounded-lg text-left text-[9px] truncate ${archivePath === entry.path ? 'bg-[#3157F6] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{entry.path}</button>)}
            </div>
          </aside>
        )}
        <main className="min-w-0 min-h-0 overflow-auto bg-white dark:bg-[#0E1118]">{renderContent()}</main>
      </div>
      <footer className="min-h-10 shrink-0 px-3 sm:px-5 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-2 text-[9px] text-slate-400">
        <Back className="w-3.5 h-3.5 shrink-0" /><span className="min-w-0 truncate">Leitura local · nenhum arquivo é enviado automaticamente · {document ? `${document.mimeType} · ${document.kind}` : 'sem documento'}</span>
      </footer>
    </div>
  );
};
