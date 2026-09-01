import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconRotateClockwise,
  IconCopy,
  IconDownload,
  IconFilePlus,
  IconHighlight,
  IconLayoutSidebarLeftExpand,
  IconSearch,
  IconTextCaption,
  IconTrash,
  IconUnderline,
  IconUpload,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import { PDFDocument, degrees } from 'pdf-lib';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { SavedProject } from '../types';
import { orbiDocDb } from '../db/orbidocDb';
import { pickLocalFile, saveLocalFile, type OrbiDocFileSystemFileHandle } from '../lib/fileSystemAccess';
import { createDebouncedAutosave, savePdfLocal, type AutosaveStatus } from '../services/offlinePersistence';
import { queueGoogleDriveEntitySync } from '../services/driveSyncQueue';

export type PdfAnnotation = {
  id: string;
  page: number;
  type: 'highlight' | 'underline' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  createdAt: string;
};

export interface PdfStudioProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type PdfJsModule = typeof import('pdfjs-dist');
type AnnotationMode = PdfAnnotation['type'] | null;

let pdfJsPromise: Promise<PdfJsModule> | null = null;
async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

const safeName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Documento';

function PdfPageView({
  pdf,
  pageNumber,
  scale,
  query,
  annotations,
  annotationMode,
  onAddAnnotation,
  onRemoveAnnotation,
}: {
  pdf: any;
  pageNumber: number;
  scale: number;
  query: string;
  annotations: PdfAnnotation[];
  annotationMode: AnnotationMode;
  onAddAnnotation: (annotation: Omit<PdfAnnotation, 'id' | 'createdAt'>) => void;
  onRemoveAnnotation: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let renderTask: any;
    void (async () => {
      const pdfjs = await loadPdfJs();
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setSize({ width: viewport.width, height: viewport.height });
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext('2d');
      if (!context) return;
      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
      if (cancelled) return;
      textLayer.replaceChildren();
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.setProperty('--scale-factor', String(viewport.scale));
      const textContent = await page.getTextContent();
      const TextLayer = (pdfjs as any).TextLayer;
      if (TextLayer) {
        const layer = new TextLayer({ textContentSource: textContent, container: textLayer, viewport });
        await layer.render();
      } else {
        const task = (pdfjs as any).renderTextLayer?.({ textContentSource: textContent, container: textLayer, viewport });
        await task?.promise;
      }
      if (query.trim()) {
        const needle = query.trim().toLocaleLowerCase('pt-BR');
        textLayer.querySelectorAll('span').forEach((span) => {
          const text = span.textContent?.toLocaleLowerCase('pt-BR') || '';
          if (text.includes(needle)) span.classList.add('orbidoc-pdf-search-hit');
        });
      }
    })().catch((error) => console.error('PDF page render failed', error));
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdf, pageNumber, scale, query]);

  const onOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!annotationMode || !size.width || !size.height) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    let text: string | undefined;
    if (annotationMode === 'text') {
      text = window.prompt('Texto da anotação:')?.trim();
      if (!text) return;
    }
    onAddAnnotation({
      page: pageNumber,
      type: annotationMode,
      x: Math.min(.82, x),
      y: Math.min(.94, y),
      width: annotationMode === 'text' ? .18 : .16,
      height: annotationMode === 'text' ? .06 : annotationMode === 'underline' ? .012 : .035,
      text,
    });
  };

  return (
    <div className="orbidoc-pdf-page-wrap" style={{ width: size.width || undefined, height: size.height || undefined }}>
      <canvas ref={canvasRef} className="orbidoc-pdf-canvas" />
      <div ref={textLayerRef} className="textLayer orbidoc-pdf-text-layer" />
      <div
        className={`orbidoc-pdf-annotation-layer ${annotationMode ? 'is-annotating' : ''}`}
        onClick={onOverlayClick}
        aria-label={annotationMode ? `Adicionar anotação ${annotationMode}` : 'Camada de anotações'}
      >
        {annotations.map((annotation) => (
          <button
            type="button"
            key={annotation.id}
            title="Clique duplo para remover"
            className={`orbidoc-pdf-annotation ${annotation.type}`}
            style={{
              left: `${annotation.x * 100}%`,
              top: `${annotation.y * 100}%`,
              width: `${annotation.width * 100}%`,
              height: `${annotation.height * 100}%`,
            }}
            onDoubleClick={(event) => { event.stopPropagation(); onRemoveAnnotation(annotation.id); }}
          >
            {annotation.type === 'text' ? annotation.text : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function PdfThumbnail({ pdf, pageNumber, selected, onSelect }: { pdf: any; pageNumber: number; selected: boolean; onSelect: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: any;
    void pdf.getPage(pageNumber).then((page: any) => {
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = 118 / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return;
      task = page.render({ canvasContext: context, viewport });
      return task.promise;
    }).catch(() => undefined);
    return () => { cancelled = true; task?.cancel?.(); };
  }, [pdf, pageNumber]);
  return (
    <button type="button" className={`orbidoc-pdf-thumbnail ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <canvas ref={canvasRef} />
      <span>Página {pageNumber}</span>
    </button>
  );
}

export const PdfStudio: React.FC<PdfStudioProps> = ({ project, onProjectChange, showNotification = () => {} }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [fileName, setFileName] = useState(`${safeName(project.title)}.pdf`);
  const [fileHandle, setFileHandle] = useState<OrbiDocFileSystemFileHandle | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>(null);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [basePageSize, setBasePageSize] = useState({ width: 595, height: 842 });

  useEffect(() => {
    let active = true;
    void orbiDocDb.pdf_store.get(project.id).then(async (record) => {
      if (!active || !record?.pdfBlob?.size) return;
      const bytes = new Uint8Array(await record.pdfBlob.arrayBuffer());
      setPdfBytes(bytes);
      setFileName(record.fileName || `${safeName(record.title)}.pdf`);
      setAnnotations(Array.isArray(record.annotationsJSON) ? record.annotationsJSON as PdfAnnotation[] : []);
    });
    return () => { active = false; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    let document: any;
    if (!pdfBytes?.length) { setPdf(null); return; }
    void loadPdfJs().then((pdfjs) => pdfjs.getDocument({ data: pdfBytes.slice() }).promise).then(async (loaded) => {
      if (cancelled) { loaded.destroy?.(); return; }
      document = loaded;
      setPdf(loaded);
      setPageNumber((value) => Math.min(Math.max(1, value), loaded.numPages));
      const first = await loaded.getPage(1);
      const viewport = first.getViewport({ scale: 1 });
      if (!cancelled) setBasePageSize({ width: viewport.width, height: viewport.height });
    }).catch((error) => showNotification(error?.message || 'Não foi possível abrir o PDF.', 'error'));
    return () => { cancelled = true; document?.destroy?.(); };
  }, [pdfBytes]);

  const autosave = useMemo(() => createDebouncedAutosave<{ bytes: Uint8Array; annotations: PdfAnnotation[]; fileName: string }>(async (snapshot) => {
    setStatus('saving');
    const updatedAt = new Date().toISOString();
    const blob = new Blob([snapshot.bytes.slice()], { type: 'application/pdf' });
    const origin = project.cloudOrigin?.provider === 'googleDrive' ? project.cloudOrigin : undefined;
    await savePdfLocal({
      id: project.id,
      title: project.title || snapshot.fileName.replace(/\.pdf$/i, ''),
      pdfBlob: blob,
      annotationsJSON: snapshot.annotations,
      updatedAt,
      fileName: origin?.fileName || snapshot.fileName,
      driveFileId: origin?.fileId,
      driveVersion: origin?.version,
      driveModifiedTime: origin?.modifiedTime,
      isSynced: false,
      syncState: origin && !navigator.onLine ? 'modified-offline' : 'local',
    });
    if (origin) await queueGoogleDriveEntitySync('pdf', project.id);
    onProjectChange({
      ...project,
      content: {
        ...(typeof project.content === 'object' && project.content ? project.content : {}),
        pdfStudio: { fileName: snapshot.fileName, annotationCount: snapshot.annotations.length, pageCount: pdf?.numPages || 0 },
      },
      previewSnippet: `${pdf?.numPages || 0} página(s) · ${snapshot.annotations.length} anotação(ões)`,
      updatedAt,
    });
    setStatus('saved');
    setLastSaved(new Date());
  }), [project.id, onProjectChange, pdf?.numPages]);

  useEffect(() => () => autosave.dispose(), [autosave]);
  useEffect(() => {
    if (pdfBytes?.length) autosave.schedule({ bytes: pdfBytes, annotations, fileName });
  }, [pdfBytes, annotations, fileName]);

  const openPdf = async (file?: File, handle?: OrbiDocFileSystemFileHandle | null) => {
    if (!file) return;
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      showNotification('Selecione um arquivo PDF.', 'error');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setPdfBytes(bytes);
      setFileName(file.name);
      setFileHandle(handle || null);
      setAnnotations([]);
      setSelectedPages(new Set());
      setQuery('');
      setSearchResults([]);
      showNotification(`${file.name} aberto localmente.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao abrir PDF.', 'error');
    }
  };

  const nativeOpen = async () => {
    try {
      const picked = await pickLocalFile([{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]);
      if (!picked) { fileInputRef.current?.click(); return; }
      await openPdf(picked.file, picked.handle);
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Falha ao abrir PDF.', 'error');
    }
  };

  const savePdf = async () => {
    if (!pdfBytes) return;
    try {
      const result = await saveLocalFile(new Blob([pdfBytes.slice()], { type: 'application/pdf' }), {
        suggestedName: safeName(fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`),
        mimeType: 'application/pdf',
        extensions: ['.pdf'],
        existingHandle: fileHandle,
      });
      if (result.handle) setFileHandle(result.handle);
      showNotification(result.method === 'overwrite' ? 'PDF sobrescrito no disco.' : 'PDF salvo localmente.', 'success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Falha ao salvar PDF.', 'error');
    }
  };

  const searchPdf = useCallback(async () => {
    if (!pdf || !query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const needle = query.trim().toLocaleLowerCase('pt-BR');
      const matches: number[] = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const content = await page.getTextContent();
        const text = content.items.map((item: any) => item.str || '').join(' ').toLocaleLowerCase('pt-BR');
        if (text.includes(needle)) matches.push(index);
      }
      setSearchResults(matches);
      if (matches[0]) setPageNumber(matches[0]);
      showNotification(matches.length ? `${matches.length} página(s) encontrada(s).` : 'Nenhuma ocorrência encontrada.', matches.length ? 'success' : 'error');
    } finally {
      setSearching(false);
    }
  }, [pdf, query]);

  const applyPdfBytes = async (bytes: Uint8Array, message: string) => {
    setPdfBytes(bytes);
    setSelectedPages(new Set());
    showNotification(message, 'success');
  };

  const rotatePages = async (delta = 90) => {
    if (!pdfBytes) return;
    const targets = selectedPages.size ? [...selectedPages] : [pageNumber];
    const document = await PDFDocument.load(pdfBytes.slice());
    targets.forEach((page) => {
      const target = document.getPage(page - 1);
      const current = target.getRotation().angle || 0;
      target.setRotation(degrees((current + delta) % 360));
    });
    await applyPdfBytes(new Uint8Array(await document.save()), `${targets.length} página(s) rotacionada(s).`);
  };

  const deletePages = async () => {
    if (!pdfBytes || !pdf) return;
    const targets = [...selectedPages].sort((a, b) => b - a);
    if (!targets.length) targets.push(pageNumber);
    if (targets.length >= pdf.numPages) {
      showNotification('O PDF precisa manter ao menos uma página.', 'error');
      return;
    }
    const document = await PDFDocument.load(pdfBytes.slice());
    targets.forEach((page) => document.removePage(page - 1));
    const deleted = new Set(targets);
    const nextAnnotations = annotations.filter((annotation) => !deleted.has(annotation.page)).map((annotation) => ({
      ...annotation,
      page: annotation.page - targets.filter((removed) => removed < annotation.page).length,
    }));
    setAnnotations(nextAnnotations);
    setPageNumber(1);
    await applyPdfBytes(new Uint8Array(await document.save()), `${targets.length} página(s) excluída(s).`);
  };

  const extractPages = async () => {
    if (!pdfBytes) return;
    const targets = (selectedPages.size ? [...selectedPages] : [pageNumber]).sort((a, b) => a - b);
    const source = await PDFDocument.load(pdfBytes.slice());
    const target = await PDFDocument.create();
    const copied = await target.copyPages(source, targets.map((page) => page - 1));
    copied.forEach((page) => target.addPage(page));
    const bytes = await target.save();
    await saveLocalFile(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' }), {
      suggestedName: `${safeName(fileName.replace(/\.pdf$/i, ''))}-paginas-${targets.join('-')}.pdf`,
      mimeType: 'application/pdf',
      extensions: ['.pdf'],
    });
    showNotification(`${targets.length} página(s) extraída(s) em novo PDF.`, 'success');
  };

  const mergePdf = async (file?: File) => {
    if (!file || !pdfBytes) return;
    try {
      const target = await PDFDocument.load(pdfBytes.slice());
      const source = await PDFDocument.load(await file.arrayBuffer());
      const pages = await target.copyPages(source, source.getPageIndices());
      pages.forEach((page) => target.addPage(page));
      await applyPdfBytes(new Uint8Array(await target.save()), `${source.getPageCount()} página(s) adicionada(s) de ${file.name}.`);
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao mesclar PDF.', 'error');
    }
  };

  const fitWidth = () => {
    const width = stageRef.current?.clientWidth || 900;
    const sidebarAllowance = sidebarOpen ? 20 : 20;
    setZoom(Math.max(50, Math.min(300, Math.floor(((width - sidebarAllowance - 32) / basePageSize.width) * 100))));
  };
  const fitPage = () => {
    const width = stageRef.current?.clientWidth || 900;
    const height = stageRef.current?.clientHeight || 900;
    const factor = Math.min((width - 32) / basePageSize.width, (height - 32) / basePageSize.height);
    setZoom(Math.max(50, Math.min(300, Math.floor(factor * 100))));
  };

  const toggleSelected = (page: number) => setSelectedPages((current) => {
    const next = new Set(current);
    if (next.has(page)) next.delete(page); else next.add(page);
    return next;
  });

  const addAnnotation = (annotation: Omit<PdfAnnotation, 'id' | 'createdAt'>) => {
    setAnnotations((current) => [...current, { ...annotation, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  };

  if (!pdfBytes || !pdf) {
    return (
      <section className="orbidoc-pdf-empty">
        <div className="orbidoc-pdf-empty-card">
          <IconUpload />
          <h2>Abrir PDF</h2>
          <p>Leitura, seleção de texto, busca, anotações e manipulação acontecem localmente no dispositivo.</p>
          <button type="button" onClick={() => void nativeOpen()}>Selecionar PDF</button>
          <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,.pdf" onChange={(event) => void openPdf(event.target.files?.[0])} />
        </div>
      </section>
    );
  }

  const scale = zoom / 100;
  const currentAnnotations = annotations.filter((annotation) => annotation.page === pageNumber);

  return (
    <section className="orbidoc-pdf-studio">
      <header className="orbidoc-pdf-toolbar">
        <button type="button" onClick={() => setSidebarOpen((value) => !value)} title="Miniaturas"><IconLayoutSidebarLeftExpand /></button>
        <button type="button" onClick={() => void nativeOpen()}><IconUpload /> Abrir</button>
        <button type="button" onClick={() => void savePdf()}><IconDownload /> Salvar</button>
        <button type="button" onClick={() => mergeInputRef.current?.click()}><IconFilePlus /> Mesclar</button>
        <input ref={mergeInputRef} type="file" className="hidden" accept="application/pdf,.pdf" onChange={(event) => void mergePdf(event.target.files?.[0])} />
        <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,.pdf" onChange={(event) => void openPdf(event.target.files?.[0])} />
        <span className="orbidoc-pdf-divider" />
        <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} title="Diminuir zoom"><IconZoomOut /></button>
        <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom do PDF">
          {[50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300].map((value) => <option key={value} value={value}>{value}%</option>)}
        </select>
        <button type="button" onClick={() => setZoom((value) => Math.min(300, value + 10))} title="Aumentar zoom"><IconZoomIn /></button>
        <button type="button" onClick={fitWidth}>Largura</button>
        <button type="button" onClick={fitPage}>Página</button>
        <span className="orbidoc-pdf-divider" />
        <button type="button" className={annotationMode === 'highlight' ? 'is-active' : ''} onClick={() => setAnnotationMode((mode) => mode === 'highlight' ? null : 'highlight')} title="Marca-texto"><IconHighlight /></button>
        <button type="button" className={annotationMode === 'underline' ? 'is-active' : ''} onClick={() => setAnnotationMode((mode) => mode === 'underline' ? null : 'underline')} title="Sublinhar"><IconUnderline /></button>
        <button type="button" className={annotationMode === 'text' ? 'is-active' : ''} onClick={() => setAnnotationMode((mode) => mode === 'text' ? null : 'text')} title="Caixa de texto"><IconTextCaption /></button>
        <span className="orbidoc-pdf-divider" />
        <button type="button" onClick={() => void rotatePages()}><IconRotateClockwise /> Girar</button>
        <button type="button" onClick={() => void extractPages()}><IconCopy /> Extrair</button>
        <button type="button" onClick={() => void deletePages()} className="danger"><IconTrash /> Excluir</button>
      </header>

      <div className="orbidoc-pdf-searchbar">
        <IconSearch />
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchPdf(); }} placeholder="Buscar dentro do PDF…" />
        <button type="button" onClick={() => void searchPdf()} disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
        {searchResults.length ? <span>{searchResults.length} página(s): {searchResults.join(', ')}</span> : null}
      </div>

      <div className="orbidoc-pdf-body">
        {sidebarOpen ? (
          <aside className="orbidoc-pdf-thumbnails">
            {Array.from({ length: pdf.numPages }, (_, index) => index + 1).map((page) => (
              <div key={page} className="orbidoc-pdf-thumbnail-row">
                <input type="checkbox" checked={selectedPages.has(page)} onChange={() => toggleSelected(page)} aria-label={`Selecionar página ${page}`} />
                <PdfThumbnail pdf={pdf} pageNumber={page} selected={pageNumber === page} onSelect={() => setPageNumber(page)} />
              </div>
            ))}
          </aside>
        ) : null}
        <main ref={stageRef} className="orbidoc-pdf-stage">
          <PdfPageView
            pdf={pdf}
            pageNumber={pageNumber}
            scale={scale}
            query={query}
            annotations={currentAnnotations}
            annotationMode={annotationMode}
            onAddAnnotation={addAnnotation}
            onRemoveAnnotation={(id) => setAnnotations((current) => current.filter((annotation) => annotation.id !== id))}
          />
        </main>
      </div>

      <footer className="orbidoc-pdf-statusbar">
        <span>{fileName}</span>
        <span>Página {pageNumber} de {pdf.numPages}</span>
        <span>{zoom}%</span>
        <span>{annotations.length} anotação(ões)</span>
        <span>{status === 'saving' ? 'Salvando localmente…' : status === 'saved' ? 'Salvo localmente' : 'Pronto'}</span>
        {lastSaved ? <span>{lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
        <span>PDF.js · pdf-lib · IndexedDB</span>
      </footer>
    </section>
  );
};
