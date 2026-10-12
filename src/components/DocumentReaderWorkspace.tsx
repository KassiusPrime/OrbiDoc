import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconBook2,
  IconChevronLeft,
  IconFile,
  IconFileTypePdf,
  IconFolderOpen,
  IconSearch,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import {
  READER_ACCEPT,
  readArchiveEntry,
  readDocumentFile,
  releaseReaderDocument,
  type ReaderDocument,
} from '../lib/documentReader';
import { sanitizeRichHtml } from '../lib/richDocument';
import type { SavedProject } from '../types';

interface DocumentReaderWorkspaceProps {
  initialProject?: SavedProject | null;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type ArchivePreview = { path: string; kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string };

const safeHtml = (html: string) => sanitizeRichHtml(html);
const escapeHtml = (text: string) => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const bytes = (value: number) => value < 1024 * 1024
  ? `${Math.max(1, Math.round(value / 1024))} KB`
  : `${(value / (1024 * 1024)).toFixed(1)} MB`;

function projectToReaderDocument(project: SavedProject): ReaderDocument {
  const content = project.content;
  const common = {
    id: `saved-${project.id}`,
    name: project.title || 'Documento salvo',
    extension: project.type,
    mimeType: 'application/x-orbit-saved-project',
    size: typeof content === 'string' ? content.length : JSON.stringify(content ?? {}).length,
    title: project.title || 'Documento salvo',
  };
  if (project.type === 'word') {
    const raw = typeof content === 'string' ? content : String((content as { html?: unknown } | null)?.html || '');
    const html = safeHtml(raw || '<p>Este documento salvo não contém uma prévia legível.</p>');
    const text = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    return { ...common, kind: 'docx', html, text };
  }
  if (project.type === 'excel') {
    const workbook = content && typeof content === 'object' ? content as { sheets?: Array<{ name?: string; cells?: Record<string, { value?: unknown; formula?: string }> }> } : {};
    const sections = (workbook.sheets || []).map((sheet) => {
      const cells = Object.entries(sheet.cells || {}).filter(([, cell]) => cell && (cell.value !== '' || cell.formula));
      const getAddress = (address: string) => {
        const match = /^([A-Z]+)([1-9][0-9]*)$/i.exec(address);
        if (!match) return { row: 0, column: 0 };
        let column = 0;
        for (const character of match[1].toUpperCase()) column = column * 26 + character.charCodeAt(0) - 64;
        return { row: Number(match[2]) - 1, column: column - 1 };
      };
      const ordered = cells.map(([address, cell]) => ({ address, cell, ...getAddress(address) }))
        .sort((a, b) => a.row - b.row || a.column - b.column);
      const rowIds = [...new Set(ordered.map((cell) => cell.row))];
      const rows = rowIds.map((row) => {
        const rowCells = ordered.filter((cell) => cell.row === row);
        return `<tr>${rowCells.map(({ address, cell }) => `<td><small>${escapeHtml(address)}</small><div>${escapeHtml(String(cell.value ?? cell.formula ?? ''))}</div></td>`).join('')}</tr>`;
      }).join('');
      return `<section><h2>${escapeHtml(sheet.name || 'Planilha')}</h2><table><tbody>${rows || '<tr><td>Esta aba não contém células visíveis.</td></tr>'}</tbody></table></section>`;
    }).join('') || '<p>O projeto não contém abas legíveis.</p>';
    return { ...common, kind: 'spreadsheet', html: safeHtml(sections), text: JSON.stringify(content, null, 2) };
  }
  if (project.type === 'powerpoint') {
    const deck = content && typeof content === 'object' ? content as { title?: string; slides?: Array<{ title?: string; subtitle?: string; bullets?: string[]; notes?: string; elements?: Array<{ type?: string; content?: string }> }> } : {};
    const slides = (deck.slides || []).map((slide, index) => `
      <section class="orbit-reader-slide">
        <h2>Slide ${index + 1} · ${escapeHtml(slide.title || 'Sem título')}</h2>
        ${slide.subtitle ? `<p><strong>${escapeHtml(slide.subtitle)}</strong></p>` : ''}
        ${slide.bullets?.length ? `<ul>${slide.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        ${(slide.elements || []).filter((element) => element.content?.trim()).map((element) => `<p>${escapeHtml(element.content || '')}</p>`).join('')}
        ${slide.notes ? `<blockquote>Notas: ${escapeHtml(slide.notes)}</blockquote>` : ''}
      </section>`).join('') || '<p>Esta apresentação não contém slides legíveis.</p>';
    return { ...common, kind: 'presentation', html: safeHtml(`<h1>${escapeHtml(deck.title || project.title)}</h1>${slides}`), text: JSON.stringify(content, null, 2) };
  }
  if (project.type === 'canva') {
    return {
      ...common,
      kind: 'text',
      text: typeof content === 'string' ? content : JSON.stringify(content ?? {}, null, 2),
    };
  }
  return { ...common, kind: 'unsupported' };
}

const KIND_LABELS: Record<string, string> = {
  pdf: 'PDF', image: 'Imagem', html: 'HTML', text: 'Texto', markdown: 'Markdown',
  epub: 'eBook EPUB', zip: 'Arquivo ZIP', docx: 'Documento', spreadsheet: 'Planilha',
  presentation: 'Apresentação', unsupported: 'Formato desconhecido',
};

export const DocumentReaderWorkspace: React.FC<DocumentReaderWorkspaceProps> = ({
  initialProject = null,
  showNotification = () => {},
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const documentsRef = useRef<ReaderDocument[]>([]);
  const [documents, setDocuments] = useState<ReaderDocument[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [archivePreview, setArchivePreview] = useState<ArchivePreview | null>(null);

  const active = documents.find((document) => document.id === activeId) || documents[0] || null;
  const activeText = active?.text || '';
  const matchCount = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle || !activeText) return 0;
    let count = 0;
    let index = 0;
    const source = activeText.toLocaleLowerCase();
    while ((index = source.indexOf(needle, index)) !== -1) { count += 1; index += needle.length; }
    return count;
  }, [activeText, query]);

  useEffect(() => {
    if (!initialProject) return;
    const document = projectToReaderDocument(initialProject);
    setDocuments((current) => {
      const kept = current.filter((item) => item.id !== document.id);
      return [document, ...kept];
    });
    setActiveId(document.id);
    setError('');
    setArchivePreview(null);
  }, [initialProject?.id, initialProject?.updatedAt]);

  useEffect(() => { documentsRef.current = documents; }, [documents]);
  useEffect(() => () => documentsRef.current.forEach((document) => releaseReaderDocument(document)), []);

  const openFiles = useCallback(async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    setLoading(true);
    setError('');
    const accepted: ReaderDocument[] = [];
    const failures: string[] = [];
    for (const file of selected.slice(0, 40)) {
      try {
        accepted.push(await readDocumentFile(file));
      } catch (cause) {
        failures.push(`${file.name}: ${cause instanceof Error ? cause.message : 'falha na leitura'}`);
      }
    }
    if (accepted.length) {
      setDocuments((current) => [...accepted, ...current.filter((item) => !accepted.some((newItem) => newItem.name === item.name && newItem.size === item.size && newItem.id === item.id))]);
      setActiveId(accepted[0].id);
      setQuery('');
      setArchivePreview(null);
      showNotification(`${accepted.length} arquivo(s) aberto(s) para leitura.`, 'success');
    }
    if (failures.length) {
      const message = failures.slice(0, 3).join('\n');
      setError(message);
      showNotification(failures[0], 'error');
    }
    if (!accepted.length && !failures.length) setError('Não há arquivos compatíveis para abrir.');
    setLoading(false);
  }, [showNotification]);

  const closeDocument = (document: ReaderDocument) => {
    releaseReaderDocument(document);
    const remaining = documents.filter((item) => item.id !== document.id);
    setDocuments(remaining);
    if (activeId === document.id) setActiveId(remaining[0]?.id || '');
    setArchivePreview(null);
    setQuery('');
  };

  const openArchiveEntry = async (path: string) => {
    if (!active) return;
    try {
      const preview = await readArchiveEntry(active, path);
      setArchivePreview({ path, ...preview });
    } catch (cause) {
      showNotification(cause instanceof Error ? cause.message : 'Não foi possível ler esse item do arquivo.', 'error');
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void openFiles(event.dataTransfer.files);
  };

  return (
    <div className="orbit-reader mx-auto flex min-h-[calc(100dvh-9.5rem)] w-full max-w-[1500px] flex-col gap-4 pb-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#101827] sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
            <i className="fi fi-rr-book text-[27px]" aria-hidden="true" />
            <IconBook2 className="hidden h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Orbit Reader · somente leitura</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Seus arquivos, sem alterar o original.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">Leia PDF, DOCX, XLSX, PPTX, EPUB, Markdown, textos, imagens e pacotes ZIP diretamente no dispositivo. O leitor não salva alterações por cima dos arquivos de origem.</p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#3157F6] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#2446D8]">
            <IconFolderOpen className="h-4 w-4" /> Abrir arquivos
          </button>
          <input ref={inputRef} type="file" multiple accept={READER_ACCEPT} className="hidden" onChange={(event) => { if (event.target.files) void openFiles(event.target.files); event.currentTarget.value = ''; }} />
        </div>
      </section>

      <div
        onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
        onDrop={onDrop}
        className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-[#101827] ${dragging ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'}`}
      >
        {dragging ? <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-blue-500/10 backdrop-blur-[2px]"><div className="rounded-2xl border border-blue-400/50 bg-white px-6 py-5 text-center shadow-xl dark:bg-slate-900"><IconUpload className="mx-auto h-8 w-8 text-blue-500" /><div className="mt-2 text-sm font-bold">Solte os arquivos para abrir</div></div></div> : null}

        {documents.length ? (
          <>
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              {documents.map((document) => (
                <div key={document.id} className={`flex max-w-[240px] shrink-0 items-center gap-1 rounded-xl border px-2 py-1.5 ${active?.id === document.id ? 'border-blue-500/40 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <button type="button" onClick={() => { setActiveId(document.id); setArchivePreview(null); setQuery(''); }} title={document.name} className="flex min-w-0 items-center gap-2 text-left text-xs">
                    {document.kind === 'pdf' ? <IconFileTypePdf className="h-4 w-4 shrink-0" /> : <IconFile className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{document.title}</span>
                  </button>
                  <button type="button" onClick={() => closeDocument(document)} aria-label={`Fechar ${document.name}`} className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10"><IconX className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => inputRef.current?.click()} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><IconUpload className="h-4 w-4" /> Adicionar</button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{active?.title}</h2>
                <p className="mt-0.5 text-[10px] text-slate-500">{active ? `${KIND_LABELS[active.kind] || active.kind} · ${bytes(active.size)} · ${active.extension.toUpperCase() || 'ARQUIVO'}` : ''}</p>
              </div>
              <label className="relative flex h-9 min-w-[180px] max-w-full flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-400 dark:border-slate-700 dark:bg-slate-950 sm:max-w-[280px]">
                <IconSearch className="h-4 w-4 shrink-0" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar dentro do arquivo…" className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none dark:text-slate-100" aria-label="Buscar no documento" />
                {query ? <span className="shrink-0 text-[9px] font-medium text-slate-500">{matchCount} resultado(s)</span> : null}
              </label>
              {active?.sourceFile ? <button type="button" onClick={() => saveAsSource(active.sourceFile!)} className="hidden h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 md:inline-flex">Baixar original</button> : null}
            </div>

            <div className="min-h-[420px] flex-1 overflow-auto bg-slate-50 p-4 dark:bg-[#0B1220] sm:p-6">
              {active && archivePreview ? (
                <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#101827]">
                  <div className="mb-3 flex items-center gap-2"><button onClick={() => setArchivePreview(null)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Voltar ao arquivo"><IconChevronLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1 truncate text-sm font-semibold">{archivePreview.path}</div></div>
                  {archivePreview.kind === 'image' && archivePreview.dataUrl ? <img src={archivePreview.dataUrl} alt={archivePreview.path} className="mx-auto max-h-[70dvh] max-w-full object-contain" /> : archivePreview.html ? <article className="orbidoc-rich-editor" dangerouslySetInnerHTML={{ __html: safeHtml(archivePreview.html) }} /> : archivePreview.text ? <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">{archivePreview.text}</pre> : <p className="text-sm text-slate-500">Este item é binário e não tem visualização de texto neste leitor.</p>}
                </div>
              ) : active ? <ReaderPreview document={active} query={query} /> : (
                <div className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"><i className="fi fi-rr-folder-open text-[34px]" aria-hidden="true" /></div>
                  <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">Comece por um arquivo</h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">Arraste arquivos para esta área ou toque em “Abrir arquivos”. A leitura acontece no dispositivo sempre que o formato permitir.</p>
                  <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><IconUpload className="h-4 w-4" /> Selecionar arquivos</button>
                </div>
              )}
            </div>

            {active?.kind === 'zip' && active.archiveEntries?.length ? (
              <div className="max-h-40 shrink-0 overflow-auto border-t border-slate-200 px-3 py-2 dark:border-slate-800">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Conteúdo do ZIP · {active.archiveEntries.length} itens</div>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {active.archiveEntries.map((entry) => <button key={entry.path} type="button" disabled={entry.directory} onClick={() => void openArchiveEntry(entry.path)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:hover:bg-slate-800"><IconFile className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{entry.path}</span></button>)}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex min-h-[440px] flex-1 flex-col items-center justify-center p-5 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800"><i className="fi fi-rr-file text-[28px]" aria-hidden="true" /></div>
            <h2 className="mt-4 text-base font-semibold">Leitor pronto</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">O leitor não executa scripts de documentos. Os arquivos continuam no seu dispositivo até que você escolha outro destino explicitamente.</p>
            {loading ? <p className="mt-3 text-xs font-medium text-blue-600">Lendo arquivos…</p> : null}
            {error ? <pre className="mt-4 max-w-full whitespace-pre-wrap text-left text-xs text-rose-500">{error}</pre> : null}
            <div className="mt-5 flex flex-wrap justify-center gap-2">{['PDF','DOCX','XLSX','PPTX','EPUB','TXT','MD','HTML','CSV','ZIP'].map((format) => <span key={format} className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-medium text-slate-500 dark:border-slate-700">{format}</span>)}</div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
        <span>Somente leitura · processamento local para formatos suportados</span>
        <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer" className="shrink-0 hover:text-blue-500">Uicons by Flaticon</a>
      </div>
    </div>
  );
};

function saveAsSource(file: File) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(file);
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ReaderPreview: React.FC<{ document: ReaderDocument; query: string }> = ({ document, query }) => {
  if (document.kind === 'pdf' && document.objectUrl) {
    return <iframe title={document.name} src={document.objectUrl} className="mx-auto h-[70dvh] min-h-[520px] w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800" />;
  }
  if (document.kind === 'image' && document.objectUrl) {
    return <div className="flex min-h-[400px] items-center justify-center"><img src={document.objectUrl} alt={document.name} className="max-h-[75dvh] max-w-full rounded-xl object-contain shadow-sm" /></div>;
  }
  if (document.html) {
    return <article className="orbidoc-rich-editor mx-auto min-h-[420px] max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm dark:border-slate-800 sm:p-8" dangerouslySetInnerHTML={{ __html: safeHtml(document.html) }} />;
  }
  if (document.kind === 'unsupported') {
    return <div className="mx-auto max-w-xl py-16 text-center"><IconFile className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-3 text-sm font-semibold">Formato sem visualizador nesta versão</h3><p className="mt-1 text-xs text-slate-500">O arquivo não foi executado nem alterado. Você ainda pode baixá-lo novamente pelo botão do cabeçalho.</p></div>;
  }
  const source = document.text || '';
  if (!query.trim()) return <pre className="mx-auto max-w-5xl whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-800 shadow-sm dark:border-slate-800 dark:bg-[#101827] dark:text-slate-200 sm:p-8">{source}</pre>;
  const escaped = escapeHtml(source);
  const needle = query.trim();
  const parts = escaped.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return <pre className="mx-auto max-w-5xl whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-800 shadow-sm dark:border-slate-800 dark:bg-[#101827] dark:text-slate-200 sm:p-8">{parts.map((part, index) => part.toLocaleLowerCase() === needle.toLocaleLowerCase() ? <mark key={index} className="rounded bg-amber-200 px-0.5 text-slate-900">{part}</mark> : part)}</pre>;
};
