import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignJustified as AlignJustify,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconBold as Bold,
  IconDownload as Download,
  IconFileText as FileText,
  IconItalic as Italic,
  IconLink as Link,
  IconList as List,
  IconListNumbers as ListNumbers,
  IconPhoto as Photo,
  IconPrinter as Printer,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconTable as Table,
  IconUnderline as Underline,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { convertFile } from '../lib/fileConversion';
import { richHtmlToDocxBlob, richHtmlToText, sanitizeRichHtml } from '../lib/richDocument';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';

interface DocumentEditorProProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

const EMPTY_DOCUMENT = '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>';
const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Documento';

const markdownishTextToHtml = (text: string) => {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => { if (list) parts.push(`</${list}>`); list = null; };
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) { closeList(); parts.push('<p><br></p>'); continue; }
    if (/^###\s+/.test(trimmed)) { closeList(); parts.push(`<h3>${escape(trimmed.replace(/^###\s+/, ''))}</h3>`); continue; }
    if (/^##\s+/.test(trimmed)) { closeList(); parts.push(`<h2>${escape(trimmed.replace(/^##\s+/, ''))}</h2>`); continue; }
    if (/^#\s+/.test(trimmed)) { closeList(); parts.push(`<h1>${escape(trimmed.replace(/^#\s+/, ''))}</h1>`); continue; }
    if (/^[-*•]\s+/.test(trimmed)) {
      if (list !== 'ul') { closeList(); list = 'ul'; parts.push('<ul>'); }
      parts.push(`<li>${escape(trimmed.replace(/^[-*•]\s+/, ''))}</li>`); continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (list !== 'ol') { closeList(); list = 'ol'; parts.push('<ol>'); }
      parts.push(`<li>${escape(trimmed.replace(/^\d+[.)]\s+/, ''))}</li>`); continue;
    }
    if (/^>\s+/.test(trimmed)) { closeList(); parts.push(`<blockquote>${escape(trimmed.replace(/^>\s+/, ''))}</blockquote>`); continue; }
    closeList(); parts.push(`<p>${escape(raw)}</p>`);
  }
  closeList();
  return parts.join('');
};

export const DocumentEditorPro: React.FC<DocumentEditorProProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_document_v3_${project.id}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Novo documento');
  const [html, setHtml] = useState(() => {
    try {
      const local = localStorage.getItem(storageKey);
      if (local) return sanitizeRichHtml(JSON.parse(local).html || EMPTY_DOCUMENT);
    } catch { /* project fallback */ }
    return typeof project.content === 'string' && project.content.trim() ? sanitizeRichHtml(project.content) : EMPTY_DOCUMENT;
  });
  const [lastSaved, setLastSaved] = useState('');
  const [search, setSearch] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
  }, [project.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const safeHtml = sanitizeRichHtml(html);
      const updated: SavedProject = {
        ...project,
        title,
        content: safeHtml,
        previewSnippet: richHtmlToText(safeHtml).slice(0, 180),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify({ html: safeHtml, title, updatedAt: updated.updatedAt }));
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [html, title, project.id]);

  const syncFromEditor = () => {
    if (!editorRef.current) return;
    setHtml(sanitizeRichHtml(editorRef.current.innerHTML));
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  };

  const block = (tag: string) => exec('formatBlock', tag);

  const insertTable = () => {
    const rows = Math.max(1, Math.min(20, Number(window.prompt('Número de linhas:', '3')) || 3));
    const cols = Math.max(1, Math.min(12, Number(window.prompt('Número de colunas:', '3')) || 3));
    const cells = Array.from({ length: rows }, (_, row) => `<tr>${Array.from({ length: cols }, (_, col) => `<${row === 0 ? 'th' : 'td'}>${row === 0 ? `Coluna ${col + 1}` : '&nbsp;'}</${row === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('');
    exec('insertHTML', `<table><tbody>${cells}</tbody></table><p><br></p>`);
  };

  const insertLink = () => {
    const raw = window.prompt('URL do link:');
    if (!raw) return;
    try {
      const url = new URL(raw, window.location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error();
      exec('createLink', raw);
    } catch {
      showNotification('Use um link HTTP, HTTPS ou e-mail válido.', 'error');
    }
  };

  const insertImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showNotification('Selecione uma imagem válida.', 'error'); return; }
    if (file.size > 12 * 1024 * 1024) { showNotification('A imagem precisa ter menos de 12 MB.', 'error'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    exec('insertHTML', `<figure><img src="${dataUrl}" alt="Imagem inserida" style="max-width:100%;height:auto"><figcaption>${file.name.replace(/[<>]/g, '')}</figcaption></figure><p><br></p>`);
  };

  const importDocument = async (file?: File) => {
    if (!file) return;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let nextHtml = '';
      if (extension === 'docx') {
        const module = await import('mammoth');
        const mammoth = (module as any).default || module;
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
          convertImage: mammoth.images.imgElement(async (image: any) => ({ src: `data:${image.contentType};base64,${await image.read('base64')}` })),
        });
        nextHtml = result.value || '<p></p>';
        if (result.messages?.length) showNotification('DOCX importado; alguns recursos avançados do Word podem ser simplificados.', 'success');
      } else if (extension === 'html' || extension === 'htm') {
        const source = await file.text();
        const doc = new DOMParser().parseFromString(source, 'text/html');
        nextHtml = doc.body.innerHTML || '<p></p>';
      } else if (extension === 'txt' || extension === 'md') {
        nextHtml = markdownishTextToHtml(await file.text());
      } else throw new Error('Use DOCX, HTML, TXT ou MD para importar no editor.');
      setHtml(sanitizeRichHtml(nextHtml));
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      showNotification(`${file.name} importado.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao importar documento.', 'error');
    }
  };

  const exportAs = async (format: 'pdf' | 'docx' | 'html' | 'txt') => {
    const base = cleanFileName(title.replace(/\.(docx|pdf|html|txt)$/i, ''));
    const safeHtml = sanitizeRichHtml(html);
    setExportBusy(true);
    try {
      let warning = '';
      if (format === 'html') {
        const source = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${base}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;line-height:1.6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px}img{max-width:100%;height:auto}</style></head><body>${safeHtml}</body></html>`;
        saveAs(new Blob([source], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      } else if (format === 'txt') {
        saveAs(new Blob([richHtmlToText(safeHtml)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      } else if (format === 'docx') {
        saveAs(await richHtmlToDocxBlob(safeHtml, base), `${base}.docx`);
      } else {
        const source = new File([`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title></head><body>${safeHtml}</body></html>`], `${base}.html`, { type: 'text/html' });
        const result = await convertFile(source, 'pdf');
        saveAs(result.blob, result.fileName);
        warning = result.warnings[0] || '';
      }
      const plain = richHtmlToText(safeHtml);
      onSaveToHistory?.({ type: 'word', title: base, summary: plain.slice(0, 180), details: plain, tags: ['Documento', format.toUpperCase()] });
      showNotification(warning ? `Exportado. ${warning}` : `Documento exportado como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na exportação.', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const runAi = async (action: 'improve' | 'summarize' | 'expand') => {
    const text = richHtmlToText(html);
    if (!text.trim()) return;
    setAiBusy(true);
    const instruction = action === 'improve'
      ? 'Reescreva o documento com maior clareza e profissionalismo, preservando sentido e hierarquia. Retorne somente HTML simples usando h1/h2/h3, p, ul/ol/li, strong, em, blockquote e table quando apropriado.'
      : action === 'summarize'
        ? 'Crie um resumo executivo fiel. Retorne somente HTML simples e estruturado; não use scripts, estilos, iframes ou recursos externos.'
        : 'Expanda o documento com detalhes úteis e coerentes, sem inventar fatos específicos. Retorne somente HTML simples e estruturado; não use scripts, estilos, iframes ou recursos externos.';
    try {
      const result = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: instruction },
        { role: 'user', content: text },
      ]);
      const cleaned = result.replace(/^```html\s*/i, '').replace(/```$/i, '').trim();
      const safe = sanitizeRichHtml(cleaned);
      if (!richHtmlToText(safe).trim()) throw new Error('A IA não retornou conteúdo editável.');
      setHtml(safe);
      showNotification('Documento atualizado pela IA.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na IA.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const stats = useMemo(() => {
    const text = richHtmlToText(html);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars: text.length, pages: Math.max(1, Math.ceil(words / 550)) };
  }, [html]);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return 0;
    const source = richHtmlToText(html).toLowerCase();
    let count = 0;
    let index = 0;
    while ((index = source.indexOf(query, index)) >= 0) { count += 1; index += query.length; }
    return count;
  }, [html, search]);

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-950 overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="h-12 px-3 sm:px-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome do documento" />
          <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando localmente…'}</span>
          <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.html,.htm,.txt,.md" onChange={(event) => { void importDocument(event.target.files?.[0]); event.target.value = ''; }} />
          <button onClick={() => fileInputRef.current?.click()} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Importar</button>
          <button onClick={() => window.print()} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center" title="Imprimir"><Printer className="w-4 h-4" /></button>
          <div className="relative group"><button disabled={exportBusy} className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Download className="w-3.5 h-3.5" />{exportBusy ? 'Exportando…' : 'Exportar'}</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['docx','pdf','html','txt'] as const).map((format) => <button key={format} onClick={() => void exportAs(format)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
        </div>

        <div className="px-2 sm:px-3 py-2 flex items-center gap-1 overflow-x-auto">
          <select onChange={(event) => block(event.target.value)} defaultValue="p" className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold"><option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="blockquote">Citação</option><option value="pre">Código</option></select>
          <select onChange={(event) => exec('fontName', event.target.value)} defaultValue="Aptos" className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold"><option>Aptos</option><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option></select>
          <ToolbarButton title="Negrito" onClick={() => exec('bold')}><Bold /></ToolbarButton>
          <ToolbarButton title="Itálico" onClick={() => exec('italic')}><Italic /></ToolbarButton>
          <ToolbarButton title="Sublinhado" onClick={() => exec('underline')}><Underline /></ToolbarButton>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <ToolbarButton title="Esquerda" onClick={() => exec('justifyLeft')}><AlignLeft /></ToolbarButton>
          <ToolbarButton title="Centro" onClick={() => exec('justifyCenter')}><AlignCenter /></ToolbarButton>
          <ToolbarButton title="Direita" onClick={() => exec('justifyRight')}><AlignRight /></ToolbarButton>
          <ToolbarButton title="Justificar" onClick={() => exec('justifyFull')}><AlignJustify /></ToolbarButton>
          <ToolbarButton title="Lista" onClick={() => exec('insertUnorderedList')}><List /></ToolbarButton>
          <ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListNumbers /></ToolbarButton>
          <ToolbarButton title="Link" onClick={insertLink}><Link /></ToolbarButton>
          <ToolbarButton title="Tabela" onClick={insertTable}><Table /></ToolbarButton>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void insertImage(event.target.files?.[0]); event.target.value = ''; }} />
          <ToolbarButton title="Imagem" onClick={() => imageInputRef.current?.click()}><Photo /></ToolbarButton>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button onClick={() => void runAi('improve')} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" /> Melhorar</button>
          <button onClick={() => void runAi('summarize')} disabled={aiBusy} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold">Resumir</button>
          <button onClick={() => void runAi('expand')} disabled={aiBusy} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold">Expandir</button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar no documento…" className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-100 dark:bg-slate-950 text-[10px] outline-none" /></div>{search && <span className="text-[10px] text-slate-400">{matches} ocorrência(s)</span>}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-400"><span>{stats.words} palavras</span><span>{stats.pages} pág.</span><select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"><option value="75">75%</option><option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option></select></div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-7 bg-slate-200/60 dark:bg-slate-950">
        <div className="mx-auto bg-white text-slate-900 shadow-lg min-h-[1123px] p-[70px] origin-top" style={{ width: '794px', maxWidth: '100%', transform: `scale(${zoom / 100})`, marginBottom: `${Math.max(0, (zoom - 100) * 8)}px` }}>
          <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncFromEditor} onBlur={syncFromEditor} className="docswiss-rich-editor min-h-[900px] outline-none text-[15px] leading-7" />
        </div>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ title: string; onClick: () => void; children: React.ReactElement }> = ({ title, onClick, children }) => <button type="button" title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 [&>svg]:w-4 [&>svg]:h-4">{children}</button>;
