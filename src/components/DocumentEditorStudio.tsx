import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAdjustmentsHorizontal as Adjustments,
  IconAlignCenter as AlignCenter,
  IconAlignJustified as AlignJustify,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconArrowBackUp as Undo,
  IconArrowForwardUp as Redo,
  IconBold as Bold,
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconClearFormatting as ClearFormatting,
  IconDownload as Download,
  IconFileStack as Templates,
  IconFileText as FileText,
  IconIndentDecrease as Outdent,
  IconIndentIncrease as Indent,
  IconItalic as Italic,
  IconLink as Link,
  IconList as List,
  IconListNumbers as ListNumbers,
  IconLoader2 as Loader,
  IconMinus as Minus,
  IconPhoto as Photo,
  IconPrinter as Printer,
  IconSearch as Search,
  IconSparkles as Sparkles,
  IconStrikethrough as Strikethrough,
  IconTable as Table,
  IconUnderline as Underline,
  IconUpload as Upload,
  IconX as X,
  IconZoomIn as ZoomIn,
  IconZoomOut as ZoomOut,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { convertFile } from '../lib/fileConversion';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';
import { richHtmlToDocxBlob, richHtmlToText, sanitizeRichHtml } from '../lib/richDocument';
import { sendToVercel } from '../api/chat';
import { HistoryItem, SavedProject } from '../types';
import { OFFICE_FONTS } from '../lib/officeStudio';
import { OrbitToolbar } from './orbit/OrbitPrimitives';

interface DocumentEditorStudioProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
  /**
   * Conteúdo do drawer lateral "Avançado" (Localizar/Substituir, Documento Pro,
   * Studio Pro…). Fica fora do fluxo vertical da página e só aparece quando o
   * usuário abre o botão flutuante. Quando omitido, o botão não é renderizado.
   */
  advancedTools?: React.ReactNode;
}

type PageSize = 'a4' | 'letter';
type MarginMode = 'narrow' | 'normal' | 'wide';
type PageSetup = { size: PageSize; margins: MarginMode; lineHeight: number };
type ExportFormat = 'docx' | 'pdf' | 'html' | 'txt';
type AiAction = 'improve' | 'summarize' | 'expand';
type OpenMenu = 'export' | 'ai' | 'templates' | null;

const EMPTY_DOCUMENT = '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>';
const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Documento';
const PAGE_WIDTH: Record<PageSize, number> = { a4: 794, letter: 816 };
const PAGE_HEIGHT: Record<PageSize, number> = { a4: 1123, letter: 1056 };
const MARGINS: Record<MarginMode, number> = { narrow: 42, normal: 70, wide: 96 };
const PRINT_MARGINS_MM: Record<MarginMode, number> = { narrow: 12, normal: 19, wide: 25 };
const ZOOM_STEPS = [50, 75, 90, 100, 110, 125, 150, 200];
const WIDE_LAYOUT_QUERY = '(min-width: 1024px)';
const EXPORT_OPTIONS: Array<[ExportFormat, string]> = [['docx', 'Word (DOCX)'], ['pdf', 'PDF'], ['html', 'Página web (HTML)'], ['txt', 'Texto simples (TXT)']];
const AI_ACTIONS: Array<{ id: AiAction; label: string; hint: string; instruction: string }> = [
  { id: 'improve', label: 'Melhorar escrita', hint: 'Clareza, correção e tom profissional', instruction: 'Reescreva com clareza, correção e linguagem profissional, preservando fatos. Retorne apenas HTML simples e estruturado.' },
  { id: 'summarize', label: 'Resumir', hint: 'Resumo executivo fiel ao conteúdo', instruction: 'Crie um resumo executivo fiel e estruturado. Retorne apenas HTML simples.' },
  { id: 'expand', label: 'Expandir', hint: 'Mais contexto, sem inventar fatos', instruction: 'Expanda o texto com contexto e organização sem inventar fatos específicos. Retorne apenas HTML simples.' },
];

const DOCUMENT_TEMPLATES = {
  report: '<h1 style="text-align:center">RELATÓRIO</h1><p style="text-align:center"><strong>Título do projeto ou área</strong></p><p><br></p><h2>Resumo executivo</h2><p>Apresente objetivo, contexto e principais conclusões.</p><h2>Contexto</h2><p>Descreva os fatos e dados relevantes.</p><h2>Análise</h2><p>Organize evidências, indicadores e interpretação.</p><h2>Recomendações</h2><ol><li>Primeira recomendação</li><li>Segunda recomendação</li></ol><h2>Próximos passos</h2><p>Defina responsáveis, prazos e entregas.</p>',
  school: '<h1 style="text-align:center">TÍTULO DO TRABALHO</h1><p style="text-align:center">Nome do aluno</p><p style="text-align:center">Turma · Disciplina · Professor(a)</p><p style="text-align:center">Cidade · Ano</p><p><br></p><h2>Introdução</h2><p>Apresente o tema, objetivo e justificativa.</p><h2>Desenvolvimento</h2><p>Construa a argumentação com dados, conceitos e fontes.</p><h2>Conclusão</h2><p>Retome o objetivo e sintetize os principais aprendizados.</p><h2>Referências</h2><p>Liste as fontes utilizadas.</p>',
  minutes: '<h1>ATA DE REUNIÃO</h1><p><strong>Data:</strong> </p><p><strong>Horário:</strong> </p><p><strong>Participantes:</strong> </p><p><strong>Pauta:</strong> </p><hr><h2>Decisões</h2><ul><li>Decisão 1</li></ul><h2>Plano de ação</h2><table><tbody><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>Observações</h2><p></p>',
  proposal: '<h1>PROPOSTA</h1><p><strong>Cliente / Projeto:</strong> </p><p><strong>Data:</strong> </p><h2>Objetivo</h2><p></p><h2>Escopo</h2><ul><li>Entrega principal</li><li>Entrega complementar</li></ul><h2>Cronograma</h2><table><tbody><tr><th>Etapa</th><th>Período</th><th>Responsável</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>Investimento / Recursos</h2><p></p><h2>Condições e próximos passos</h2><p></p>',
} as const;

const TEMPLATE_OPTIONS: Array<[keyof typeof DOCUMENT_TEMPLATES, string]> = [
  ['report', 'Relatório empresarial'],
  ['school', 'Trabalho escolar'],
  ['minutes', 'Ata de reunião'],
  ['proposal', 'Proposta'],
];

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

/** Segue o breakpoint `lg` do Tailwind para alternar drawer inline (desktop) e overlay (mobile). */
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches));
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);
  return matches;
};

/** Estado do teclado virtual publicado pelo NativeViewportAgent (mobile/APK). */
const useSoftKeyboard = () => {
  const [open, setOpen] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.orbidocKeyboard === 'open');
  useEffect(() => {
    const onVisibility = (event: Event) => setOpen(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    window.addEventListener('orbidoc:keyboard-visibility', onVisibility);
    return () => window.removeEventListener('orbidoc:keyboard-visibility', onVisibility);
  }, []);
  return open;
};

/** Botões da toolbar não podem roubar o foco/seleção do editor. */
const keepEditorSelection = (event: React.MouseEvent) => event.preventDefault();

export const DocumentEditorStudio: React.FC<DocumentEditorStudioProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
  onSaveToHistory,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
  advancedTools,
}) => {
  const storageKey = `orbidoc_document_v4_${project.id}`;
  const setupKey = `orbidoc_document_page_v1_${project.id}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const templatesMenuRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const focusFindOnOpenRef = useRef(false);
  const searchCursorRef = useRef(0);
  const wideLayout = useMediaQuery(WIDE_LAYOUT_QUERY);
  const softKeyboardOpen = useSoftKeyboard();
  const hasAdvancedTools = Boolean(advancedTools);

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
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
  }, [project.id]);

  // Auto-save: rascunho local (localStorage) + projeto do Orbispace.
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

  // Ctrl/Cmd+H abre o drawer focando Localizar/Substituir; Esc fecha o drawer.
  useEffect(() => {
    if (!hasAdvancedTools) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        focusFindOnOpenRef.current = true;
        setAdvancedOpen(true);
        return;
      }
      if (event.key === 'Escape' && advancedOpen) setAdvancedOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasAdvancedTools, advancedOpen]);

  useEffect(() => {
    if (!advancedOpen) return;
    const focusFind = focusFindOnOpenRef.current;
    focusFindOnOpenRef.current = false;
    window.requestAnimationFrame(() => {
      const findInput = drawerRef.current?.querySelector<HTMLInputElement>('[data-orbidoc-find-input]');
      if (focusFind && findInput) { findInput.focus(); findInput.select(); }
      else if (!wideLayout) drawerCloseRef.current?.focus();
    });
  }, [advancedOpen]);

  useEffect(() => {
    if (!menu) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if ([exportMenuRef, aiMenuRef, templatesMenuRef].every((ref) => !ref.current?.contains(target))) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointerDown); window.removeEventListener('keydown', onKey); };
  }, [menu]);

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

  const replaceDocument = (nextHtml: string) => {
    const safe = sanitizeRichHtml(nextHtml);
    setHtml(safe);
    window.queueMicrotask(() => { if (editorRef.current) editorRef.current.innerHTML = safe; });
    return safe;
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
      replaceDocument(nextHtml);
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      showNotification(`${file.name} importado.`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao importar documento.', 'error'); }
  };

  const exportAs = async (format: ExportFormat) => {
    setMenu(null);
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

  // Impressão em iframe isolado: sai apenas a folha, com @page no tamanho/margens escolhidos,
  // independentemente do zoom da tela e do shell do app.
  const printDocument = () => {
    setMenu(null);
    if (isOrbiDocNativeRuntime()) { showNotification('No app Android, use Exportar → PDF para imprimir ou compartilhar.', 'error'); return; }
    const safeHtml = sanitizeRichHtml(html);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    frame.srcdoc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${cleanFileName(title)}</title><style>@page{size:${pageSetup.size === 'a4' ? 'A4' : 'letter'};margin:${PRINT_MARGINS_MM[pageSetup.margins]}mm}body{margin:0;color:#0f172a;font-family:Aptos,Calibri,Carlito,'Segoe UI',Arial,sans-serif;font-size:11pt;line-height:${pageSetup.lineHeight}}h1{font-size:2rem;line-height:1.2;margin:0 0 .65em}h2{font-size:1.5rem;line-height:1.25;margin:1.2em 0 .5em}h3{font-size:1.2rem;margin:1em 0 .4em}p{margin:0 0 .8em}blockquote{margin:1em 0;padding:.7em 1em;border-left:4px solid #3157F6;background:#F7F9FC;color:#475569}pre{white-space:pre-wrap;padding:.9em 1em;border:1px solid #D9E2F0;border-radius:8px;background:#F7F9FC;font-family:'Courier New',monospace;font-size:.9em}table{width:100%;border-collapse:collapse;margin:1em 0}td,th{border:1px solid #CBD5E1;padding:.55em .65em;vertical-align:top}th{background:#F1F5F9}img{max-width:100%;height:auto}figure{margin:1em 0}figcaption{margin-top:.35em;color:#64748B;font-size:.8em;text-align:center}a{color:#3157F6}.orbidoc-page-break{break-after:page}</style></head><body>${safeHtml}</body></html>`;
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) { frame.remove(); return; }
      const cleanup = () => window.setTimeout(() => frame.remove(), 400);
      win.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(cleanup, 60_000);
      win.focus();
      win.print();
    };
    document.body.appendChild(frame);
  };

  const runAi = async (action: AiAction) => {
    setMenu(null);
    const text = richHtmlToText(html);
    if (!text.trim()) { showNotification('Escreva algo antes de acionar o Nexus AI.', 'error'); return; }
    const instruction = (AI_ACTIONS.find((item) => item.id === action) || AI_ACTIONS[0]).instruction;
    setAiBusy(true);
    try {
      const result = await sendToVercel(engineProvider, engineModel, [{ role: 'system', content: instruction }, { role: 'user', content: text }]);
      const safe = sanitizeRichHtml(result.replace(/^```html\s*/i, '').replace(/```$/i, '').trim());
      if (!richHtmlToText(safe).trim()) throw new Error('A IA não retornou conteúdo editável.');
      replaceDocument(safe);
      showNotification('Documento atualizado pela IA.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha na IA.', 'error'); }
    finally { setAiBusy(false); }
  };

  const applyTemplate = (key: keyof typeof DOCUMENT_TEMPLATES) => {
    setMenu(null);
    if (richHtmlToText(html).trim() && !window.confirm('Substituir o conteúdo atual pelo modelo selecionado?')) return;
    replaceDocument(DOCUMENT_TEMPLATES[key]);
  };

  const stats = useMemo(() => { const text = richHtmlToText(html); const words = text.trim() ? text.trim().split(/\s+/).length : 0; return { words, chars: text.length, pages: Math.max(1, Math.ceil(words / 520)) }; }, [html]);
  const matches = useMemo(() => { const query = search.trim().toLowerCase(); if (!query) return 0; const source = richHtmlToText(html).toLowerCase(); let count = 0; let index = 0; while ((index = source.indexOf(query, index)) >= 0) { count += 1; index += query.length; } return count; }, [html, search]);

  // Enter na busca da status bar seleciona a próxima ocorrência diretamente na folha.
  const jumpToNextMatch = () => {
    const root = editorRef.current;
    const query = search.trim();
    if (!root || !query) return;
    const target = query.toLocaleLowerCase('pt-BR');
    const found: Array<{ node: Text; start: number }> = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const source = (node.nodeValue || '').toLocaleLowerCase('pt-BR');
      let index = source.indexOf(target);
      while (index >= 0) { found.push({ node: node as Text, start: index }); index = source.indexOf(target, index + Math.max(1, target.length)); }
      node = walker.nextNode();
    }
    if (!found.length) { showNotification('Nenhuma ocorrência encontrada.', 'error'); return; }
    const match = found[searchCursorRef.current % found.length];
    searchCursorRef.current += 1;
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, Math.min(match.node.length, match.start + query.length));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    match.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // Clicar na margem da folha (fora do texto) posiciona o cursor no fim do documento.
  const focusPageEnd = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !editorRef.current) return;
    event.preventDefault();
    editorRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const stepZoom = (direction: 1 | -1) => setZoom((current) => {
    const index = ZOOM_STEPS.indexOf(current);
    const nextIndex = index < 0 ? ZOOM_STEPS.indexOf(100) : Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction));
    return ZOOM_STEPS[nextIndex];
  });

  const savedLabel = lastSaved ? `Salvo ${lastSaved}` : 'Salvando…';
  const pageMargin = MARGINS[pageSetup.margins];
  const showDrawer = hasAdvancedTools && advancedOpen;
  const showFab = hasAdvancedTools && !advancedOpen && !softKeyboardOpen;
  const menuItemClass = 'w-full px-3 py-2 text-left text-[11px] font-bold rounded-[8px] hover:bg-slate-100 dark:hover:bg-slate-800';
  const selectClass = 'h-8 rounded-[8px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] px-2 text-[11px] font-bold';
  const statusSelectClass = 'h-7 rounded-[8px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] px-1.5 text-[11px]';
  const ghostButtonClass = 'h-8 px-2 sm:px-2.5 rounded-[8px] hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold inline-flex items-center gap-1 shrink-0';
  const menuPanelClass = 'absolute right-0 top-9 z-40 rounded-[12px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] shadow-xl p-1';

  const drawerPanel = (
    <aside
      ref={drawerRef}
      id="orbidoc-advanced-drawer"
      role={wideLayout ? 'complementary' : 'dialog'}
      aria-modal={wideLayout ? undefined : true}
      aria-label="Ferramentas avançadas"
      className={`relative z-10 flex min-h-0 flex-col border-l border-[var(--orbit-border)] bg-[var(--orbit-surface)] ${wideLayout ? 'w-[360px] shrink-0' : 'h-full w-full max-w-[400px] shadow-2xl'}`}
    >
      <header className="h-12 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--orbit-border)]">
        <Adjustments className="w-4 h-4 text-[#3157F6] shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black leading-tight">Ferramentas avançadas</div>
          <div className="text-[10px] text-[var(--orbit-muted)] truncate">Localizar · Documento Pro · Studio Pro</div>
        </div>
        <button ref={drawerCloseRef} type="button" onClick={() => setAdvancedOpen(false)} className="w-9 h-9 rounded-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar ferramentas avançadas"><X className="w-4 h-4" /></button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">{advancedTools}</div>
    </aside>
  );

  return (
    <div className="orbidoc-document-studio relative h-full min-h-0 flex flex-col overflow-clip rounded-[12px] lg:rounded-[16px] border border-[var(--orbit-border)] bg-[var(--orbit-surface)] text-slate-900 dark:text-slate-100">
      {/* Context bar: título · estado de salvamento · modelos / importar / exportar */}
      <div className="h-12 shrink-0 px-2 sm:px-3 flex items-center gap-1.5 sm:gap-2 border-b border-[var(--orbit-border)]">
        <FileText className="w-5 h-5 text-[#3157F6] shrink-0" aria-hidden="true" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-[6rem] flex-1 h-8 px-1.5 rounded-[8px] bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 text-sm font-extrabold outline-none" aria-label="Nome do documento" />
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-[var(--orbit-muted)]" title={savedLabel}>
          {lastSaved ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Loader className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
          <span className="hidden sm:inline">{savedLabel}</span>
        </span>
        <div ref={templatesMenuRef} className="relative shrink-0">
          <button type="button" onClick={() => setMenu((current) => current === 'templates' ? null : 'templates')} aria-haspopup="menu" aria-expanded={menu === 'templates'} title="Modelos de documento" className={ghostButtonClass}>
            <Templates className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Modelos</span><ChevronDown className="w-3.5 h-3.5 hidden sm:inline" aria-hidden="true" />
          </button>
          {menu === 'templates' && (
            <div role="menu" aria-label="Modelos de documento" className={`${menuPanelClass} w-52`}>
              {TEMPLATE_OPTIONS.map(([key, label]) => <button key={key} type="button" role="menuitem" onClick={() => applyTemplate(key)} className={menuItemClass}>{label}</button>)}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.html,.htm,.txt,.md" onChange={(event) => { void importDocument(event.target.files?.[0]); event.target.value = ''; }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={ghostButtonClass} title="Importar DOCX, HTML, TXT ou MD"><Upload className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Importar</span></button>
        <div ref={aiMenuRef} className="relative shrink-0">
          <button type="button" disabled={aiBusy} onClick={() => setMenu((current) => current === 'ai' ? null : 'ai')} aria-haspopup="menu" aria-expanded={menu === 'ai'} title="Nexus AI · melhorar, resumir ou expandir o documento" className="h-8 px-2 sm:px-2.5 rounded-[8px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-950/70 disabled:opacity-60 text-violet-700 dark:text-violet-300 text-[11px] font-black inline-flex items-center gap-1">
            {aiBusy ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{aiBusy ? 'Nexus AI…' : 'Nexus AI'}</span>
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {menu === 'ai' && (
            <div role="menu" aria-label="Ações do Nexus AI" className={`${menuPanelClass} w-60`}>
              {AI_ACTIONS.map((action) => (
                <button key={action.id} type="button" role="menuitem" onClick={() => void runAi(action.id)} className={menuItemClass}>
                  <span className="block">{action.label}</span>
                  <span className="block text-[10px] font-medium text-[var(--orbit-muted)]">{action.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={exportMenuRef} className="relative shrink-0">
          <button type="button" disabled={exportBusy} onClick={() => setMenu((current) => current === 'export' ? null : 'export')} aria-haspopup="menu" aria-expanded={menu === 'export'} className="h-8 px-2.5 rounded-[8px] bg-[#3157F6] hover:bg-[#2446D8] disabled:opacity-60 text-white text-[11px] font-black inline-flex items-center gap-1">
            {exportBusy ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{exportBusy ? 'Exportando…' : 'Exportar'}</span>
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {menu === 'export' && (
            <div role="menu" aria-label="Formatos de exportação" className={`${menuPanelClass} w-48`}>
              {EXPORT_OPTIONS.map(([format, label]) => <button key={format} type="button" role="menuitem" onClick={() => void exportAs(format)} className={menuItemClass}>{label}</button>)}
              <div className="my-1 h-px bg-[var(--orbit-border)]" role="separator" />
              <button type="button" role="menuitem" onClick={printDocument} className={`${menuItemClass} inline-flex items-center gap-2`}><Printer className="w-4 h-4" aria-hidden="true" /> Imprimir</button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar de formatação: rola horizontalmente no touch, quebra linha no desktop */}
      <OrbitToolbar label="Formatação do documento" compact className="sticky top-0 z-20 shrink-0 lg:flex-wrap border-b border-[var(--orbit-border)] bg-[var(--orbit-surface)]">
        <div className="flex items-center gap-1">
          <select onChange={(event) => exec('formatBlock', event.target.value)} defaultValue="p" aria-label="Estilo de parágrafo" className={selectClass}><option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="blockquote">Citação</option><option value="pre">Código</option></select>
          <select onChange={(event) => exec('fontName', event.target.value)} defaultValue={OFFICE_FONTS[0].value} aria-label="Fonte" className={`${selectClass} max-w-28`}>{OFFICE_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select>
          <select onChange={(event) => applyFontSize(Number(event.target.value))} defaultValue="15" aria-label="Tamanho da fonte" className={selectClass}>{[10, 11, 12, 14, 15, 16, 18, 20, 24, 28, 32, 36, 48, 60].map((size) => <option key={size} value={size}>{size}</option>)}</select>
        </div>
        <ToolbarDivider />
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Desfazer" onClick={() => exec('undo')}><Undo /></ToolbarButton>
          <ToolbarButton title="Refazer" onClick={() => exec('redo')}><Redo /></ToolbarButton>
        </div>
        <ToolbarDivider />
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Negrito" onClick={() => exec('bold')}><Bold /></ToolbarButton>
          <ToolbarButton title="Itálico" onClick={() => exec('italic')}><Italic /></ToolbarButton>
          <ToolbarButton title="Sublinhado" onClick={() => exec('underline')}><Underline /></ToolbarButton>
          <ToolbarButton title="Tachado" onClick={() => exec('strikeThrough')}><Strikethrough /></ToolbarButton>
          <label className="w-8 h-8 rounded-[8px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer" title="Cor do texto"><input type="color" aria-label="Cor do texto" className="w-5 h-5 cursor-pointer" onChange={(event) => exec('foreColor', event.target.value)} /></label>
          <label className="w-8 h-8 rounded-[8px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer" title="Marca-texto"><input type="color" aria-label="Marca-texto" defaultValue="#fff59d" className="w-5 h-5 cursor-pointer" onChange={(event) => exec('hiliteColor', event.target.value)} /></label>
        </div>
        <ToolbarDivider />
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Alinhar à esquerda" onClick={() => exec('justifyLeft')}><AlignLeft /></ToolbarButton>
          <ToolbarButton title="Centralizar" onClick={() => exec('justifyCenter')}><AlignCenter /></ToolbarButton>
          <ToolbarButton title="Alinhar à direita" onClick={() => exec('justifyRight')}><AlignRight /></ToolbarButton>
          <ToolbarButton title="Justificar" onClick={() => exec('justifyFull')}><AlignJustify /></ToolbarButton>
        </div>
        <ToolbarDivider />
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Lista com marcadores" onClick={() => exec('insertUnorderedList')}><List /></ToolbarButton>
          <ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListNumbers /></ToolbarButton>
          <ToolbarButton title="Diminuir recuo" onClick={() => exec('outdent')}><Outdent /></ToolbarButton>
          <ToolbarButton title="Aumentar recuo" onClick={() => exec('indent')}><Indent /></ToolbarButton>
        </div>
        <ToolbarDivider />
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Inserir link" onClick={insertLink}><Link /></ToolbarButton>
          <ToolbarButton title="Inserir tabela" onClick={insertTable}><Table /></ToolbarButton>
          <ToolbarButton title="Linha horizontal" onClick={() => exec('insertHorizontalRule')}><Minus /></ToolbarButton>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void insertImage(event.target.files?.[0]); event.target.value = ''; }} />
          <ToolbarButton title="Inserir imagem" onClick={() => imageInputRef.current?.click()}><Photo /></ToolbarButton>
          <ToolbarButton title="Limpar formatação" onClick={() => exec('removeFormat')}><ClearFormatting /></ToolbarButton>
        </div>
      </OrbitToolbar>

      {/* Folha protagonista + (desktop) drawer inline */}
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="orbidoc-editor-canvas flex-1 min-h-0 overflow-auto overscroll-contain bg-[#f1f4f9] dark:bg-[#0b0d11] px-2 pt-3 pb-16 sm:px-8 sm:pt-8 sm:pb-20">
            <div
              className="orbidoc-page mx-auto bg-white text-slate-900 border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_32px_-14px_rgba(15,23,42,0.28)] cursor-text"
              style={{ width: PAGE_WIDTH[pageSetup.size], maxWidth: zoom > 100 ? 'none' : '100%', minHeight: PAGE_HEIGHT[pageSetup.size], padding: pageMargin, boxSizing: 'border-box', zoom: zoom / 100 }}
              onMouseDown={focusPageEnd}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncFromEditor}
                onBlur={syncFromEditor}
                className="orbidoc-rich-editor outline-none text-[15px]"
                style={{ lineHeight: pageSetup.lineHeight, minHeight: PAGE_HEIGHT[pageSetup.size] - pageMargin * 2 }}
              />
            </div>
          </div>

          {showFab ? (
            <button
              type="button"
              onMouseDown={keepEditorSelection}
              onClick={() => setAdvancedOpen(true)}
              aria-expanded={false}
              title="Ferramentas avançadas · Ctrl+H para localizar e substituir"
              className="orbidoc-advanced-fab absolute right-3 bottom-3 sm:right-5 sm:bottom-5 z-20 h-11 pl-3 pr-4 rounded-full bg-[#3157F6] hover:bg-[#2446D8] text-white shadow-lg shadow-[#3157F6]/25 inline-flex items-center gap-2 text-[11px] font-black active:scale-95 transition-transform"
            >
              <Adjustments className="w-4 h-4" aria-hidden="true" /> Avançado
            </button>
          ) : null}
        </div>

        {showDrawer && wideLayout ? drawerPanel : null}
      </div>

      {/* Status bar: contagem · busca · página · zoom */}
      <div className="min-h-9 shrink-0 pl-2 pr-16 sm:pl-3 lg:pr-3 py-1 flex items-center gap-2 sm:gap-3 border-t border-[var(--orbit-border)] bg-[var(--orbit-surface)] text-[11px] text-[var(--orbit-muted)] overflow-x-auto [scrollbar-width:none] whitespace-nowrap">
        <span className="shrink-0 font-semibold">{stats.words} palavras</span>
        <span className="hidden md:inline shrink-0">{stats.chars} caracteres</span>
        <span className="shrink-0">{stats.pages} pág.</span>
        <label className="relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); searchCursorRef.current = 0; }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); jumpToNextMatch(); } }}
            placeholder="Buscar no documento"
            aria-label="Buscar no documento"
            className="h-7 w-36 sm:w-44 pl-7 pr-2 rounded-[8px] bg-slate-100 dark:bg-slate-800 text-[11px] outline-none"
          />
        </label>
        {search.trim() ? <span className="shrink-0">{matches} ocorrência(s)</span> : null}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <select value={pageSetup.size} onChange={(event) => setPageSetup((current) => ({ ...current, size: event.target.value as PageSize }))} aria-label="Tamanho da página" className={statusSelectClass}><option value="a4">A4</option><option value="letter">Carta</option></select>
          <select value={pageSetup.margins} onChange={(event) => setPageSetup((current) => ({ ...current, margins: event.target.value as MarginMode }))} aria-label="Margens" className={statusSelectClass}><option value="narrow">Margem estreita</option><option value="normal">Margem normal</option><option value="wide">Margem larga</option></select>
          <select value={pageSetup.lineHeight} onChange={(event) => setPageSetup((current) => ({ ...current, lineHeight: Number(event.target.value) }))} aria-label="Espaçamento entre linhas" className={`${statusSelectClass} hidden sm:block`}><option value="1.2">1,2</option><option value="1.5">1,5</option><option value="2">2,0</option></select>
          <div className="inline-flex items-center rounded-[8px] border border-[var(--orbit-border)]">
            <button type="button" onClick={() => stepZoom(-1)} disabled={zoom <= ZOOM_STEPS[0]} className="w-7 h-7 rounded-l-[8px] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center" aria-label="Diminuir zoom"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setZoom(100)} className="h-7 min-w-11 px-1 text-[11px] font-bold tabular-nums hover:bg-slate-100 dark:hover:bg-slate-800" title="Redefinir zoom">{zoom}%</button>
            <button type="button" onClick={() => stepZoom(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} className="w-7 h-7 rounded-r-[8px] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center" aria-label="Aumentar zoom"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Mobile/tablet: drawer sobreposto à folha, contido no editor */}
      {showDrawer && !wideLayout ? (
        <div className="absolute inset-0 z-30 flex justify-end">
          <button type="button" aria-label="Fechar ferramentas avançadas" onClick={() => setAdvancedOpen(false)} className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />
          {drawerPanel}
        </div>
      ) : null}
    </div>
  );
};

const ToolbarDivider: React.FC = () => <span className="w-px h-6 bg-[var(--orbit-border)]" aria-hidden="true" />;

const ToolbarButton: React.FC<{ title: string; onClick: () => void; children: React.ReactElement }> = ({ title, onClick, children }) => (
  <button type="button" title={title} aria-label={title} onMouseDown={keepEditorSelection} onClick={onClick} className="w-8 h-8 rounded-[8px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 [&>svg]:w-4 [&>svg]:h-4">{children}</button>
);
