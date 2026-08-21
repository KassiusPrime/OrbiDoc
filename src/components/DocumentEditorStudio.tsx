import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlignCenter as AlignCenter,
  IconAlignJustified as AlignJustify,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconArrowBackUp as Undo,
  IconArrowForwardUp as Redo,
  IconBold as Bold,
  IconClearFormatting as ClearFormatting,
  IconDownload as Download,
  IconFileText as FileText,
  IconIndentDecrease as Outdent,
  IconIndentIncrease as Indent,
  IconItalic as Italic,
  IconLink as Link,
  IconList as List,
  IconListNumbers as ListNumbers,
  IconMinus as Minus,
  IconPhoto as Photo,
  IconPrinter as Printer,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconStrikethrough as Strikethrough,
  IconTable as Table,
  IconUnderline as Underline,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { convertFile } from '../lib/fileConversion';
import { richHtmlToDocxBlob, richHtmlToText, sanitizeRichHtml } from '../lib/richDocument';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';
import { OFFICE_FONTS } from '../lib/officeStudio';

interface DocumentEditorStudioProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type PageSize = 'a4' | 'letter';
type MarginMode = 'narrow' | 'normal' | 'wide';
type PageSetup = { size: PageSize; margins: MarginMode; lineHeight: number };

const EMPTY_DOCUMENT = '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>';
const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Documento';
const PAGE_WIDTH: Record<PageSize, number> = { a4: 794, letter: 816 };
const PAGE_HEIGHT: Record<PageSize, number> = { a4: 1123, letter: 1056 };
const MARGINS: Record<MarginMode, number> = { narrow: 42, normal: 70, wide: 96 };

const DOCUMENT_TEMPLATES = {
  report: '<h1 style="text-align:center">RELATÓRIO</h1><p style="text-align:center"><strong>Título do projeto ou área</strong></p><p><br></p><h2>Resumo executivo</h2><p>Apresente objetivo, contexto e principais conclusões.</p><h2>Contexto</h2><p>Descreva os fatos e dados relevantes.</p><h2>Análise</h2><p>Organize evidências, indicadores e interpretação.</p><h2>Recomendações</h2><ol><li>Primeira recomendação</li><li>Segunda recomendação</li></ol><h2>Próximos passos</h2><p>Defina responsáveis, prazos e entregas.</p>',
  school: '<h1 style="text-align:center">TÍTULO DO TRABALHO</h1><p style="text-align:center">Nome do aluno</p><p style="text-align:center">Turma · Disciplina · Professor(a)</p><p style="text-align:center">Cidade · Ano</p><p><br></p><h2>Introdução</h2><p>Apresente o tema, objetivo e justificativa.</p><h2>Desenvolvimento</h2><p>Construa a argumentação com dados, conceitos e fontes.</p><h2>Conclusão</h2><p>Retome o objetivo e sintetize os principais aprendizados.</p><h2>Referências</h2><p>Liste as fontes utilizadas.</p>',
  minutes: '<h1>ATA DE REUNIÃO</h1><p><strong>Data:</strong> </p><p><strong>Horário:</strong> </p><p><strong>Participantes:</strong> </p><p><strong>Pauta:</strong> </p><hr><h2>Decisões</h2><ul><li>Decisão 1</li></ul><h2>Plano de ação</h2><table><tbody><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>Observações</h2><p></p>',
  proposal: '<h1>PROPOSTA</h1><p><strong>Cliente / Projeto:</strong> </p><p><strong>Data:</strong> </p><h2>Objetivo</h2><p></p><h2>Escopo</h2><ul><li>Entrega principal</li><li>Entrega complementar</li></ul><h2>Cronograma</h2><table><tbody><tr><th>Etapa</th><th>Período</th><th>Responsável</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>Investimento / Recursos</h2><p></p><h2>Condições e próximos passos</h2><p></p>',
} as const;

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
    if (/^[-*•]\s+/.test(trimmed)) { if (list !== 'ul') { closeList(); list = 'ul'; parts.push('<ul>'); } parts.push(`<li>${escape(trimmed.replace(/^[-*•]\s+/, ''))}</li>`); continue; }
    if (/^\d+[.)]\s+/.test(trimmed)) { if (list !== 'ol') { closeList(); list = 'ol'; parts.push('<ol>'); } parts.push(`<li>${escape(trimmed.replace(/^\d+[.)]\s+/, ''))}</li>`); continue; }
    closeList(); parts.push(`<p>${escape(raw)}</p>`);
  }
  closeList();
  return parts.join('');
};

export const DocumentEditorStudio: React.FC<DocumentEditorStudioProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const storageKey = `orbidoc_document_v4_${project.id}`;
  const setupKey = `orbidoc_document_page_v1_${project.id}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(project.title || 'Novo documento');
  const [html, setHtml] = useState(() => {
    try { const local = localStorage.getItem(storageKey); if (local) return sanitizeRichHtml(JSON.parse(local).html || EMPTY_DOCUMENT); } catch { /* fallback */ }
    return typeof project.content === 'string' && project.content.trim() ? sanitizeRichHtml(project.content) : EMPTY_DOCUMENT;
  });
  const [pageSetup, setPageSetup] = useState<PageSetup>(() => {
    try { const value = localStorage.getItem(setupKey); if (value) return JSON.parse(value); } catch { /* defaults */ }
    return { size: 'a4', margins: 'normal', lineHeight: 1.5 };
  });
  const [lastSaved, setLastSaved] = useState('');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(100);
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
  }, [project.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const safeHtml = sanitizeRichHtml(html);
      const updated: SavedProject = { ...project, title, content: safeHtml, previewSnippet: richHtmlToText(safeHtml).slice(0, 180), updatedAt: new Date().toISOString() };
      try { localStorage.setItem(storageKey, JSON.stringify({ html: safeHtml, title, updatedAt: updated.updatedAt })); localStorage.setItem(setupKey, JSON.stringify(pageSetup)); } catch { /* storage quota */ }
      onProjectChange(updated);
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [html, title, pageSetup, project.id]);

  const normalizeLegacyFormatting = () => {
    const root = editorRef.current;
    if (!root) return;
    root.querySelectorAll('font').forEach((font) => {
      const span = document.createElement('span');
      const face = font.getAttribute('face');
      const size = font.getAttribute('size');
      const color = font.getAttribute('color');
      if (face) span.style.fontFamily = face;
      if (size) span.style.fontSize = size === '7' ? '18px' : size === '6' ? '16px' : size === '5' ? '14px' : size === '4' ? '13px' : '12px';
      if (color) span.style.color = color;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  };

  const syncFromEditor = () => {
    normalizeLegacyFormatting();
    if (editorRef.current) setHtml(sanitizeRichHtml(editorRef.current.innerHTML));
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    normalizeLegacyFormatting();
    syncFromEditor();
  };

  const applyFontSize = (size: number) => {
    editorRef.current?.focus();
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
    syncFromEditor();
  };

  const insertTable = () => {
    const rows = Math.max(1, Math.min(30, Number(window.prompt('Número de linhas:', '4')) || 4));
    const cols = Math.max(1, Math.min(12, Number(window.prompt('Número de colunas:', '4')) || 4));
    const body = Array.from({ length: rows }, (_, row) => `<tr>${Array.from({ length: cols }, (_, col) => `<${row === 0 ? 'th' : 'td'}>${row === 0 ? `Coluna ${col + 1}` : '&nbsp;'}</${row === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('');
    exec('insertHTML', `<table><tbody>${body}</tbody></table><p><br></p>`);
  };

  const insertLink = () => {
    const raw = window.prompt('URL do link:');
    if (!raw) return;
    try { const url = new URL(raw, window.location.origin); if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error(); exec('createLink', raw); }
    catch { showNotification('Use um link HTTP, HTTPS ou e-mail válido.', 'error'); }
  };

  const insertImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showNotification('Selecione uma imagem válida.', 'error'); return; }
    if (file.size > 15 * 1024 * 1024) { showNotification('A imagem precisa ter menos de 15 MB.', 'error'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file); });
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
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage: mammoth.images.imgElement(async (image: any) => ({ src: `data:${image.contentType};base64,${await image.read('base64')}` })) });
        nextHtml = result.value || '<p></p>';
        if (result.messages?.length) showNotification('DOCX importado; recursos específicos do Word podem ser simplificados.', 'success');
      } else if (extension === 'html' || extension === 'htm') {
        const doc = new DOMParser().parseFromString(await file.text(), 'text/html'); nextHtml = doc.body.innerHTML || '<p></p>';
      } else if (extension === 'txt' || extension === 'md') nextHtml = markdownishTextToHtml(await file.text());
      else throw new Error('Use DOCX, HTML, TXT ou MD.');
      const safe = sanitizeRichHtml(nextHtml);
      setHtml(safe); setTitle(file.name.replace(/\.[^/.]+$/, ''));
      window.queueMicrotask(() => { if (editorRef.current) editorRef.current.innerHTML = safe; });
      showNotification(`${file.name} importado.`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao importar documento.', 'error'); }
  };

  const exportAs = async (format: 'docx' | 'pdf' | 'html' | 'txt') => {
    const base = cleanFileName(title.replace(/\.(docx|pdf|html|txt)$/i, ''));
    const safeHtml = sanitizeRichHtml(html);
    setExportBusy(true);
    try {
      if (format === 'docx') saveAs(await richHtmlToDocxBlob(safeHtml, base), `${base}.docx`);
      else if (format === 'txt') saveAs(new Blob([richHtmlToText(safeHtml)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      else if (format === 'html') {
        const source = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:900px;margin:40px auto;line-height:${pageSetup.lineHeight}}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px}img{max-width:100%;height:auto}.orbidoc-page-break{break-after:page}</style></head><body>${safeHtml}</body></html>`;
        saveAs(new Blob([source], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      } else {
        const source = new File([`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{line-height:${pageSetup.lineHeight}}</style></head><body>${safeHtml}</body></html>`], `${base}.html`, { type: 'text/html' });
        const result = await convertFile(source, 'pdf'); saveAs(result.blob, result.fileName);
      }
      const plain = richHtmlToText(safeHtml);
      onSaveToHistory?.({ type: 'word', title: base, summary: plain.slice(0, 180), details: plain, tags: ['Documento', format.toUpperCase()] });
      showNotification(`Documento exportado como ${format.toUpperCase()}.`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha na exportação.', 'error'); }
    finally { setExportBusy(false); }
  };

  const runAi = async (action: 'improve' | 'summarize' | 'expand') => {
    const text = richHtmlToText(html);
    if (!text.trim()) return;
    setAiBusy(true);
    const instruction = action === 'improve' ? 'Reescreva com clareza, correção e linguagem profissional, preservando fatos. Retorne apenas HTML simples e estruturado.' : action === 'summarize' ? 'Crie um resumo executivo fiel e estruturado. Retorne apenas HTML simples.' : 'Expanda o texto com contexto e organização sem inventar fatos específicos. Retorne apenas HTML simples.';
    try {
      const result = await sendToVercel(engineProvider, engineModel, [{ role: 'system', content: instruction }, { role: 'user', content: text }]);
      const safe = sanitizeRichHtml(result.replace(/^```html\s*/i, '').replace(/```$/i, '').trim());
      if (!richHtmlToText(safe).trim()) throw new Error('A IA não retornou conteúdo editável.');
      setHtml(safe); window.queueMicrotask(() => { if (editorRef.current) editorRef.current.innerHTML = safe; });
      showNotification('Documento atualizado pela IA.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha na IA.', 'error'); }
    finally { setAiBusy(false); }
  };

  const stats = useMemo(() => { const text = richHtmlToText(html); const words = text.trim() ? text.trim().split(/\s+/).length : 0; return { words, chars: text.length, pages: Math.max(1, Math.ceil(words / 520)) }; }, [html]);
  const matches = useMemo(() => { const query = search.trim().toLowerCase(); if (!query) return 0; const source = richHtmlToText(html).toLowerCase(); let count = 0; let index = 0; while ((index = source.indexOf(query, index)) >= 0) { count += 1; index += query.length; } return count; }, [html, search]);

  const applyTemplate = (key: keyof typeof DOCUMENT_TEMPLATES) => {
    if (richHtmlToText(html).trim() && !window.confirm('Substituir o conteúdo atual pelo modelo selecionado?')) return;
    const safe = sanitizeRichHtml(DOCUMENT_TEMPLATES[key]); setHtml(safe); window.queueMicrotask(() => { if (editorRef.current) editorRef.current.innerHTML = safe; });
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-950 overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="min-h-12 px-3 sm:px-4 py-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 flex-wrap">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-[180px] flex-1 bg-transparent text-sm font-black outline-none" aria-label="Nome do documento" />
          <span className="hidden md:inline text-[10px] text-slate-400">{lastSaved ? `Salvo ${lastSaved}` : 'Salvando…'}</span>
          <select defaultValue="" onChange={(event) => { if (event.target.value) applyTemplate(event.target.value as keyof typeof DOCUMENT_TEMPLATES); event.target.value = ''; }} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold"><option value="">Modelos…</option><option value="report">Relatório empresarial</option><option value="school">Trabalho escolar</option><option value="minutes">Ata de reunião</option><option value="proposal">Proposta</option></select>
          <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.html,.htm,.txt,.md" onChange={(event) => { void importDocument(event.target.files?.[0]); event.target.value = ''; }} />
          <button onClick={() => fileInputRef.current?.click()} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Importar</button>
          <button onClick={() => window.print()} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Imprimir"><Printer className="w-4 h-4 mx-auto" /></button>
          <div className="relative group"><button disabled={exportBusy} className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />{exportBusy ? 'Exportando…' : 'Exportar'}</button><div className="hidden group-hover:block absolute right-0 top-8 z-40 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">{(['docx','pdf','html','txt'] as const).map((format) => <button key={format} onClick={() => void exportAs(format)} className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{format.toUpperCase()}</button>)}</div></div>
        </div>

        <div className="px-2 sm:px-3 py-2 flex items-center gap-1 overflow-x-auto">
          <select onChange={(event) => exec('formatBlock', event.target.value)} defaultValue="p" className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold"><option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="blockquote">Citação</option><option value="pre">Código</option></select>
          <select onChange={(event) => exec('fontName', event.target.value)} defaultValue={OFFICE_FONTS[0].value} className="h-8 max-w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold">{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select>
          <select onChange={(event) => applyFontSize(Number(event.target.value))} defaultValue="15" className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold">{[10,11,12,14,15,16,18,20,24,28,32,36,48,60].map((size) => <option key={size} value={size}>{size}</option>)}</select>
          <ToolbarButton title="Desfazer" onClick={() => exec('undo')}><Undo /></ToolbarButton><ToolbarButton title="Refazer" onClick={() => exec('redo')}><Redo /></ToolbarButton>
          <ToolbarButton title="Negrito" onClick={() => exec('bold')}><Bold /></ToolbarButton><ToolbarButton title="Itálico" onClick={() => exec('italic')}><Italic /></ToolbarButton><ToolbarButton title="Sublinhado" onClick={() => exec('underline')}><Underline /></ToolbarButton><ToolbarButton title="Tachado" onClick={() => exec('strikeThrough')}><Strikethrough /></ToolbarButton>
          <label className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Cor do texto"><input type="color" className="w-5 h-5" onChange={(event) => exec('foreColor', event.target.value)} /></label><label className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" title="Marca-texto"><input type="color" defaultValue="#fff59d" className="w-5 h-5" onChange={(event) => exec('hiliteColor', event.target.value)} /></label>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <ToolbarButton title="Alinhar à esquerda" onClick={() => exec('justifyLeft')}><AlignLeft /></ToolbarButton><ToolbarButton title="Centralizar" onClick={() => exec('justifyCenter')}><AlignCenter /></ToolbarButton><ToolbarButton title="Alinhar à direita" onClick={() => exec('justifyRight')}><AlignRight /></ToolbarButton><ToolbarButton title="Justificar" onClick={() => exec('justifyFull')}><AlignJustify /></ToolbarButton>
          <ToolbarButton title="Lista" onClick={() => exec('insertUnorderedList')}><List /></ToolbarButton><ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListNumbers /></ToolbarButton><ToolbarButton title="Diminuir recuo" onClick={() => exec('outdent')}><Outdent /></ToolbarButton><ToolbarButton title="Aumentar recuo" onClick={() => exec('indent')}><Indent /></ToolbarButton>
          <ToolbarButton title="Link" onClick={insertLink}><Link /></ToolbarButton><ToolbarButton title="Tabela" onClick={insertTable}><Table /></ToolbarButton><ToolbarButton title="Linha horizontal" onClick={() => exec('insertHorizontalRule')}><Minus /></ToolbarButton>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void insertImage(event.target.files?.[0]); event.target.value = ''; }} /><ToolbarButton title="Imagem" onClick={() => imageInputRef.current?.click()}><Photo /></ToolbarButton>
          <ToolbarButton title="Limpar formatação" onClick={() => exec('removeFormat')}><ClearFormatting /></ToolbarButton>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button onClick={() => void runAi('improve')} disabled={aiBusy} className="h-8 px-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-black inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Melhorar</button><button onClick={() => void runAi('summarize')} disabled={aiBusy} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold">Resumir</button><button onClick={() => void runAi('expand')} disabled={aiBusy} className="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold">Expandir</button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[190px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar no documento…" className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-100 dark:bg-slate-950 text-[10px] outline-none" /></div>{search && <span className="text-[10px] text-slate-400">{matches} ocorrência(s)</span>}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-400"><span>{stats.words} palavras</span><span>{stats.chars} caracteres</span><span>{stats.pages} pág.</span><select value={pageSetup.size} onChange={(event) => setPageSetup((current) => ({ ...current, size: event.target.value as PageSize }))} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"><option value="a4">A4</option><option value="letter">Carta</option></select><select value={pageSetup.margins} onChange={(event) => setPageSetup((current) => ({ ...current, margins: event.target.value as MarginMode }))} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"><option value="narrow">Margem estreita</option><option value="normal">Margem normal</option><option value="wide">Margem larga</option></select><select value={pageSetup.lineHeight} onChange={(event) => setPageSetup((current) => ({ ...current, lineHeight: Number(event.target.value) }))} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"><option value="1.2">1,2</option><option value="1.5">1,5</option><option value="2">2,0</option></select><select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"><option value="75">75%</option><option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option></select></div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-7 bg-slate-200/60 dark:bg-slate-950">
        <div className="mx-auto bg-white text-slate-900 shadow-lg origin-top" style={{ width: PAGE_WIDTH[pageSetup.size], maxWidth: '100%', minHeight: PAGE_HEIGHT[pageSetup.size], padding: MARGINS[pageSetup.margins], transform: `scale(${zoom / 100})`, transformOrigin: 'top center', marginBottom: `${Math.max(0, (zoom - 100) * 8)}px` }}>
          <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncFromEditor} onBlur={syncFromEditor} className="orbidoc-rich-editor min-h-[820px] outline-none text-[15px]" style={{ lineHeight: pageSetup.lineHeight }} />
        </div>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ title: string; onClick: () => void; children: React.ReactElement }> = ({ title, onClick, children }) => <button type="button" title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 [&>svg]:w-4 [&>svg]:h-4">{children}</button>;
