import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignJustified as AlignJustify,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconBold as Bold,
  IconCopy as Copy,
  IconDownload as Download,
  IconFileText as FileText,
  IconHighlight as Highlight,
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
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';

interface DocumentEditorProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

const EMPTY_DOCUMENT = '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>';

const sanitizeTitle = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Documento';

const htmlToText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr').forEach((node) => node.append('\n'));
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `docswiss_document_v2_${project.id}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Novo documento');
  const [html, setHtml] = useState(() => {
    try {
      const local = localStorage.getItem(storageKey);
      if (local) return JSON.parse(local).html || EMPTY_DOCUMENT;
    } catch { /* ignore invalid draft */ }
    return typeof project.content === 'string' && project.content.trim() ? project.content : EMPTY_DOCUMENT;
  });
  const [lastSaved, setLastSaved] = useState<string>('');
  const [search, setSearch] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
  }, [project.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const updated: SavedProject = {
        ...project,
        title,
        content: html,
        previewSnippet: htmlToText(html).slice(0, 180),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify({ html, title, updatedAt: updated.updatedAt }));
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [html, title, project.id]);

  const stats = useMemo(() => {
    const text = htmlToText(html);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars: text.length, pages: Math.max(1, Math.ceil(words / 550)) };
  }, [html]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
  };

  const block = (tag: string) => exec('formatBlock', tag);

  const insertTable = () => {
    const rows = Math.max(1, Math.min(20, Number(window.prompt('Número de linhas:', '3')) || 3));
    const cols = Math.max(1, Math.min(12, Number(window.prompt('Número de colunas:', '3')) || 3));
    const cells = Array.from({ length: rows }, (_, row) => `<tr>${Array.from({ length: cols }, (_, col) => `<td>${row === 0 ? `Coluna ${col + 1}` : '&nbsp;'}</td>`).join('')}</tr>`).join('');
    exec('insertHTML', `<table><tbody>${cells}</tbody></table><p><br></p>`);
  };

  const insertLink = () => {
    const url = window.prompt('URL do link:');
    if (url) exec('createLink', url);
  };

  const insertImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione uma imagem válida.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification('A imagem precisa ter menos de 10 MB.', 'error');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    exec('insertHTML', `<figure><img src="${dataUrl}" alt="${file.name.replace(/"/g, '')}" style="max-width:100%;height:auto"><figcaption>${file.name}</figcaption></figure><p><br></p>`);
  };

  const importDocument = async (file?: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    try {
      if (extension === 'docx') {
        const module = await import('mammoth');
        const mammoth = (module as any).default || module;
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        setHtml(result.value || '<p></p>');
      } else if (extension === 'html' || extension === 'htm') {
        const source = await file.text();
        const doc = new DOMParser().parseFromString(source, 'text/html');
        setHtml(doc.body.innerHTML || '<p></p>');
      } else if (extension === 'txt' || extension === 'md') {
        const text = await file.text();
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        setHtml(escaped.split(/\r?\n/).map((line) => `<p>${line || '<br>'}</p>`).join(''));
      } else {
        throw new Error('Use DOCX, HTML, TXT ou MD para importar no editor.');
      }
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      showNotification(`${file.name} importado.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao importar documento.', 'error');
    }
  };

  const exportAs = async (format: 'pdf' | 'docx' | 'html' | 'txt') => {
    const base = sanitizeTitle(title).replace(/\.(docx|pdf|html|txt)$/i, '');
    try {
      if (format === 'html') {
        const source = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title></head><body>${html}</body></html>`;
        saveAs(new Blob([source], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      } else if (format === 'txt') {
        saveAs(new Blob([htmlToText(html)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      } else {
        const source = new File([`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title></head><body>${html}</body></html>`], `${base}.html`, { type: 'text/html' });
        const result = await convertFile(source, format);
        saveAs(result.blob, result.fileName);
        if (result.warnings.length) showNotification(result.warnings[0], 'error');
      }
      onSaveToHistory?.({ type: 'word', title: base, summary: htmlToText(html).slice(0, 180), details: htmlToText(html), tags: ['Documento', format.toUpperCase()] });
      showNotification(`Documento exportado como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na exportação.', 'error');
    }
  };

  const runAi = async (action: 'improve' | 'summarize' | 'expand') => {
    const text = htmlToText(html);
    if (!text.trim()) return;
    setAiBusy(true);
    const instruction = action === 'improve'
      ? 'Reescreva este documento com maior clareza e profissionalismo, preservando a estrutura e o sentido. Retorne em HTML simples usando h1/h2/h3, p, ul/ol e strong quando apropriado.'
      : action === 'summarize'
        ? 'Crie um resumo executivo fiel deste documento. Retorne em HTML simples e estruturado.'
        : 'Expanda este documento com detalhes úteis e coerentes, sem inventar fatos específicos não fornecidos. Retorne em HTML simples e estruturado.';
    try {
      const result = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: instruction },
        { role: 'user', content: text },
      ]);
      const doc = new DOMParser().parseFromString(result, 'text/html');
      const clean = doc.body.innerHTML || result;
      setHtml(clean.replace(/^```html\s*/i, '').replace(/```$/i, ''));
      showNotification('Documento atualizado pela IA.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha na IA.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const matches = useMemo(() => {
    if (!search.trim()) return 0;
    const source = htmlToText(html).toLowerCase();
    const query = search.toLowerCase();
    let count = 0;
    let index = 0;
    while ((index = source.indexOf(query, index)) >= 0) { count += 1; index += query.length || 1; }
    return count;
  }, [html, search]);

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-950 overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="h-12 px-3 sm:px-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-900 dark:text-white outline-none" aria-label="Nome do documento" />
          <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando localmente…'}</span>
          <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.html,.htm,.txt,.md" onChange={(event) => { importDocument(event.target.files?.[0]); event.target.value = ''; }} />
          <button onClick={() => fileInputRef.current?.click()} className="h-8 px-2.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Importar</button>
          <button onClick={() => window.print()} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center" title="Imprimir"><Printer className="w-4 h-4" /></button>
          <div className="relative group"><button className="h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar</button><div className="hidden group-hover:block absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['docx','pdf','html','txt'] as const).map((format) => <button key={format} onClick={() => exportAs(format)} className="w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
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
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <label title="Cor do texto" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"><input type="color" className="w-5 h-5 border-0 bg-transparent" onChange={(event) => exec('foreColor', event.target.value)} /></label>
          <label title="Destaque" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"><Highlight className="w-4 h-4" /><input type="color" className="sr-only" defaultValue="#fff59d" onChange={(event) => exec('hiliteColor', event.target.value)} /></label>
          <ToolbarButton title="Link" onClick={insertLink}><Link /></ToolbarButton>
          <ToolbarButton title="Tabela" onClick={insertTable}><Table /></ToolbarButton>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { insertImage(event.target.files?.[0]); event.target.value = ''; }} />
          <ToolbarButton title="Imagem" onClick={() => imageInputRef.current?.click()}><Photo /></ToolbarButton>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <div className="relative group"><button disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1 disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" /> {aiBusy ? 'IA…' : 'Copiloto'}</button><div className="hidden group-hover:block absolute left-0 top-8 z-30 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1"><button onClick={() => runAi('improve')} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">Melhorar documento</button><button onClick={() => runAi('expand')} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">Expandir conteúdo</button><button onClick={() => runAi('summarize')} className="w-full px-3 py-2 text-left rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">Resumo executivo</button></div></div>
          <div className="ml-auto flex items-center gap-1"><Search className="w-3.5 h-3.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Localizar" className="h-8 w-24 sm:w-36 rounded-lg bg-slate-100 dark:bg-slate-950 px-2 text-[10px] outline-none" />{search && <span className="text-[9px] text-slate-400 whitespace-nowrap">{matches} ocorrência(s)</span>}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-7 lg:p-10">
        <div className="mx-auto origin-top transition-transform" style={{ width: 'min(210mm, calc(100vw - 40px))', transform: `scale(${zoom / 100})`, transformOrigin: 'top center', marginBottom: `${Math.max(0, zoom - 100) * 8}px` }}>
          <div className="docswiss-page bg-white text-slate-900 shadow-lg min-h-[297mm] px-[18mm] sm:px-[22mm] py-[20mm] sm:py-[24mm]">
            <div ref={editorRef} contentEditable suppressContentEditableWarning spellCheck className="docswiss-rich-editor min-h-[245mm] outline-none text-[11pt] leading-[1.6]" onInput={(event) => setHtml(event.currentTarget.innerHTML)} onPaste={() => window.setTimeout(() => editorRef.current && setHtml(editorRef.current.innerHTML), 0)} />
          </div>
        </div>
      </div>

      <div className="h-9 shrink-0 px-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
        <span>{stats.pages} pág.</span><span>{stats.words} palavras</span><span>{stats.chars} caracteres</span>
        <div className="ml-auto flex items-center gap-2"><button onClick={() => navigator.clipboard.writeText(htmlToText(html))} className="hover:text-indigo-600 inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Copiar texto</button><input type="range" min="70" max="140" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20" /><span>{zoom}%</span></div>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ title: string; onClick?: () => void; children: React.ReactElement }> = ({ title, onClick, children }) => (
  <button type="button" title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">{children}</button>
);
