import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { TOGGLE_LINK_COMMAND, LinkNode } from '@lexical/link';
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import {
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconChecklist,
  IconDownload,
  IconIndentDecrease,
  IconIndentIncrease,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMinus,
  IconPhoto,
  IconPrinter,
  IconSubscript,
  IconSuperscript,
  IconTable,
  IconUnderline,
  IconUpload,
} from '@tabler/icons-react';
import { exportRichHtmlToDocx } from '../lib/richDocumentExport';
import { pickLocalFile, saveLocalFile, type OrbiDocFileSystemFileHandle } from '../lib/fileSystemAccess';
import {
  createDebouncedAutosave,
  saveDocumentLocal,
  saveLocalAsset,
  type AutosaveStatus,
} from '../services/offlinePersistence';
import { type HistoryItem, type SavedProject } from '../types';
import { queueGoogleDriveEntitySync } from '../services/driveSyncQueue';
import { $createOrbiDocImageNode, OrbiDocImageNode } from '../editor/lexical/OrbiDocImageNode';
import { OFFICE_FONTS } from '../lib/officeStudio';
import { LexicalFindReplacePlugin } from './LexicalFindReplacePlugin';

export interface DocumentEditorLexicalProps {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  engineProvider?: string;
  engineModel?: string;
}

type PageMargin = 'narrow' | 'normal' | 'wide';

type PersistedSnapshot = {
  editorState: ReturnType<EditorState['toJSON']>;
  html: string;
  text: string;
  title: string;
};

const EMPTY_HTML = '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>';
const PAGE_MARGIN_PX: Record<PageMargin, number> = { narrow: 40, normal: 72, wide: 96 };
const SAFE_FILE_NAME = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Documento';

const theme = {
  paragraph: 'orbidoc-lexical-paragraph',
  quote: 'orbidoc-lexical-quote',
  heading: {
    h1: 'orbidoc-lexical-h1',
    h2: 'orbidoc-lexical-h2',
    h3: 'orbidoc-lexical-h3',
    h4: 'orbidoc-lexical-h4',
  },
  list: {
    nested: { listitem: 'orbidoc-lexical-list-nested' },
    ol: 'orbidoc-lexical-ol',
    ul: 'orbidoc-lexical-ul',
    listitem: 'orbidoc-lexical-list-item',
    listitemChecked: 'orbidoc-lexical-check-checked',
    listitemUnchecked: 'orbidoc-lexical-check-unchecked',
  },
  link: 'orbidoc-lexical-link',
  text: {
    bold: 'orbidoc-lexical-bold',
    italic: 'orbidoc-lexical-italic',
    underline: 'orbidoc-lexical-underline',
    strikethrough: 'orbidoc-lexical-strikethrough',
    underlineStrikethrough: 'orbidoc-lexical-underline-strikethrough',
    subscript: 'orbidoc-lexical-subscript',
    superscript: 'orbidoc-lexical-superscript',
  },
  table: 'orbidoc-lexical-table',
  tableCell: 'orbidoc-lexical-table-cell',
  tableCellHeader: 'orbidoc-lexical-table-cell-header',
  tableRow: 'orbidoc-lexical-table-row',
};

function createInitialEditorState(project: SavedProject) {
  const content = project.content;
  if (content && typeof content === 'object' && content.root) return JSON.stringify(content);
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.root) return content;
    } catch {
      // Fall back to HTML import.
    }
  }

  const sourceHtml = typeof content === 'string' && content.trim() ? content : EMPTY_HTML;
  return (editor: LexicalEditor) => {
    const dom = new DOMParser().parseFromString(sourceHtml, 'text/html');
    const nodes = $generateNodesFromDOM(editor, dom);
    const root = $getRoot();
    root.clear();
    root.append(...nodes);
    if (!root.getChildrenSize()) root.append($createParagraphNode());
  };
}

function editorHtml(editor: LexicalEditor) {
  let html = '';
  editor.getEditorState().read(() => {
    html = $generateHtmlFromNodes(editor, null);
  });
  return html;
}

function editorText(editor: LexicalEditor) {
  let text = '';
  editor.getEditorState().read(() => {
    text = $getRoot().getTextContent();
  });
  return text;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function ToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="orbidoc-ribbon-button">
      {children}
    </button>
  );
}

function LexicalToolbar({
  projectId,
  title,
  setTitle,
  margin,
  setMargin,
  zoom,
  setZoom,
  showNotification,
}: {
  projectId: string;
  title: string;
  setTitle: (value: string) => void;
  margin: PageMargin;
  setMargin: (value: PageMargin) => void;
  zoom: number;
  setZoom: (value: number) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}) {
  const [editor] = useLexicalComposerContext();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [fileHandle, setFileHandle] = useState<OrbiDocFileSystemFileHandle | null>(null);

  const applyInlineStyle = (property: string, value: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $patchStyleText(selection, { [property]: value });
    });
  };

  const setBlock = (tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'quote') => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (tag === 'p') $setBlocksType(selection, () => $createParagraphNode());
      else if (tag === 'quote') $setBlocksType(selection, () => $createQuoteNode());
      else $setBlocksType(selection, () => $createHeadingNode(tag));
    });
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let html = '';
      if (extension === 'docx') {
        const imported = await import('mammoth');
        const mammoth = (imported as any).default || imported;
        const result = await mammoth.convertToHtml(
          { arrayBuffer: await file.arrayBuffer() },
          {
            convertImage: mammoth.images.imgElement(async (image: any) => ({
              src: `data:${image.contentType};base64,${await image.read('base64')}`,
            })),
          },
        );
        html = result.value || '<p></p>';
      } else if (extension === 'html' || extension === 'htm') {
        const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
        html = parsed.body.innerHTML;
      } else if (extension === 'txt' || extension === 'md') {
        const text = await file.text();
        html = text
          .split(/\r?\n/)
          .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
          .join('');
      } else {
        throw new Error('Use DOCX, HTML, TXT ou MD.');
      }

      editor.update(() => {
        const dom = new DOMParser().parseFromString(html, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
        if (!root.getChildrenSize()) root.append($createParagraphNode());
      });
      setTitle(file.name.replace(/\.[^/.]+$/, '') || title);
      showNotification(`${file.name} importado no editor profissional.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao importar documento.', 'error');
    }
  };

  const insertImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione uma imagem válida.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showNotification('A imagem deve ter no máximo 20 MB.', 'error');
      return;
    }

    try {
      const assetId = crypto.randomUUID();
      const dataUrl = await readFileAsDataUrl(file);
      await saveLocalAsset({
        id: assetId,
        entityId: projectId,
        entityType: 'document',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        blob: file,
      });
      editor.update(() => {
        $insertNodes([
          $createOrbiDocImageNode({
            src: dataUrl,
            altText: file.name,
            caption: file.name,
            assetId,
          }),
        ]);
      });
      showNotification('Imagem inserida e armazenada localmente no IndexedDB.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao inserir imagem.', 'error');
    }
  };

  const insertLink = () => {
    const raw = window.prompt('URL do link:');
    if (!raw) return;
    try {
      const url = new URL(raw, window.location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error();
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, raw);
    } catch {
      showNotification('Use um link HTTP, HTTPS ou mailto válido.', 'error');
    }
  };

  const exportFile = async (format: 'docx' | 'html' | 'txt') => {
    const base = SAFE_FILE_NAME(title.replace(/\.(docx|html|txt)$/i, ''));
    try {
      if (format === 'docx') {
        const result = await exportRichHtmlToDocx(editorHtml(editor), base);
        const saved = await saveLocalFile(result.blob, {
          suggestedName: `${base}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extensions: ['.docx'],
          existingHandle: fileHandle?.name.endsWith('.docx') ? fileHandle : null,
        });
        if (saved.handle) setFileHandle(saved.handle);
        if (result.warnings.length) showNotification(result.warnings[0].message, 'success');
        else showNotification('DOCX gerado inteiramente no dispositivo.', 'success');
      } else if (format === 'html') {
        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title></head><body>${editorHtml(editor)}</body></html>`;
        await saveLocalFile(html, { suggestedName: `${base}.html`, mimeType: 'text/html;charset=utf-8', extensions: ['.html'] });
      } else {
        await saveLocalFile(editorText(editor), { suggestedName: `${base}.txt`, mimeType: 'text/plain;charset=utf-8', extensions: ['.txt'] });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || `Falha ao exportar ${format.toUpperCase()}.`, 'error');
    }
  };

  const openNative = async () => {
    try {
      const picked = await pickLocalFile([
        {
          description: 'Documentos',
          accept: {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/html': ['.html', '.htm'],
            'text/plain': ['.txt', '.md'],
          },
        },
      ]);
      if (!picked) {
        importInputRef.current?.click();
        return;
      }
      setFileHandle(picked.handle);
      await importFile(picked.file);
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Não foi possível abrir o arquivo.', 'error');
    }
  };

  const tableAction = (action: 'row+' | 'row-' | 'col+' | 'col-' | 'merge' | 'unmerge') => {
    editor.update(() => {
      const selection = $getSelection();
      if (!selection) return;
      if (action === 'row+') $insertTableRow__EXPERIMENTAL(true);
      else if (action === 'row-') $deleteTableRow__EXPERIMENTAL();
      else if (action === 'col+') $insertTableColumn__EXPERIMENTAL(true);
      else if (action === 'col-') $deleteTableColumn__EXPERIMENTAL();
      else if (action === 'unmerge') $unmergeCell();
      else if (action === 'merge' && $isTableSelection(selection)) {
        const cells = selection.getNodes().filter($isTableCellNode);
        if (cells.length > 1) $mergeCells(cells);
      }
    });
  };

  return (
    <div className="orbidoc-productivity-ribbon" role="toolbar" aria-label="Ferramentas do documento">
      <div className="orbidoc-ribbon-row orbidoc-ribbon-document-row">
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="orbidoc-document-title-input" aria-label="Título do documento" />
        <ToolbarButton title="Abrir arquivo local" onClick={() => void openNative()}><IconUpload /></ToolbarButton>
        <button type="button" className="orbidoc-ribbon-text-button" onClick={() => void exportFile('docx')}><IconDownload /> DOCX</button>
        <button type="button" className="orbidoc-ribbon-text-button" onClick={() => void exportFile('html')}>HTML</button>
        <button type="button" className="orbidoc-ribbon-text-button" onClick={() => void exportFile('txt')}>TXT</button>
        <button type="button" className="orbidoc-ribbon-text-button" onClick={() => window.print()}><IconPrinter /> PDF</button>
        <input ref={importInputRef} className="hidden" type="file" accept=".docx,.html,.htm,.txt,.md" onChange={(event) => void importFile(event.target.files?.[0])} />
      </div>

      <div className="orbidoc-ribbon-row">
        <select defaultValue="p" onChange={(event) => setBlock(event.target.value as any)} className="orbidoc-ribbon-select" aria-label="Estilo de parágrafo">
          <option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="h4">Título 4</option><option value="quote">Citação</option>
        </select>
        <select defaultValue="Inter" onChange={(event) => applyInlineStyle('font-family', event.target.value)} className="orbidoc-ribbon-select" aria-label="Fonte">
          {OFFICE_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
        </select>
        <select defaultValue="12" onChange={(event) => applyInlineStyle('font-size', `${event.target.value}px`)} className="orbidoc-ribbon-select orbidoc-font-size-select" aria-label="Tamanho da fonte">
          {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <ToolbarButton title="Negrito" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}><IconBold /></ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}><IconItalic /></ToolbarButton>
        <ToolbarButton title="Sublinhado" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}><IconUnderline /></ToolbarButton>
        <ToolbarButton title="Tachado" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>S̶</ToolbarButton>
        <ToolbarButton title="Sobrescrito" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')}><IconSuperscript /></ToolbarButton>
        <ToolbarButton title="Subscrito" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')}><IconSubscript /></ToolbarButton>
        <label className="orbidoc-color-control" title="Cor do texto">A<input type="color" defaultValue="#111827" onChange={(event) => applyInlineStyle('color', event.target.value)} /></label>
        <label className="orbidoc-color-control" title="Marca-texto">▰<input type="color" defaultValue="#fff59d" onChange={(event) => applyInlineStyle('background-color', event.target.value)} /></label>
      </div>

      <div className="orbidoc-ribbon-row">
        <ToolbarButton title="Desfazer" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}><IconArrowBackUp /></ToolbarButton>
        <ToolbarButton title="Refazer" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}><IconArrowForwardUp /></ToolbarButton>
        <ToolbarButton title="Alinhar à esquerda" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}><IconAlignLeft /></ToolbarButton>
        <ToolbarButton title="Centralizar" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}><IconAlignCenter /></ToolbarButton>
        <ToolbarButton title="Alinhar à direita" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}><IconAlignRight /></ToolbarButton>
        <ToolbarButton title="Justificar" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')}><IconAlignJustified /></ToolbarButton>
        <ToolbarButton title="Diminuir recuo" onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}><IconIndentDecrease /></ToolbarButton>
        <ToolbarButton title="Aumentar recuo" onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}><IconIndentIncrease /></ToolbarButton>
        <ToolbarButton title="Lista com marcadores" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}><IconList /></ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}><IconListNumbers /></ToolbarButton>
        <ToolbarButton title="Checklist" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}><IconChecklist /></ToolbarButton>
        <ToolbarButton title="Link" onClick={insertLink}><IconLink /></ToolbarButton>
        <ToolbarButton title="Divisor horizontal" onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}><IconMinus /></ToolbarButton>
        <ToolbarButton title="Inserir imagem local" onClick={() => imageInputRef.current?.click()}><IconPhoto /></ToolbarButton>
        <ToolbarButton title="Inserir tabela 4 × 4" onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '4', rows: '4', includeHeaders: true })}><IconTable /></ToolbarButton>
        <input ref={imageInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => void insertImage(event.target.files?.[0])} />
      </div>

      <div className="orbidoc-ribbon-row orbidoc-table-actions">
        <span className="orbidoc-ribbon-group-label">Tabela</span>
        <button type="button" onClick={() => tableAction('row+')} className="orbidoc-ribbon-text-button">+ linha</button>
        <button type="button" onClick={() => tableAction('row-')} className="orbidoc-ribbon-text-button">− linha</button>
        <button type="button" onClick={() => tableAction('col+')} className="orbidoc-ribbon-text-button">+ coluna</button>
        <button type="button" onClick={() => tableAction('col-')} className="orbidoc-ribbon-text-button">− coluna</button>
        <button type="button" onClick={() => tableAction('merge')} className="orbidoc-ribbon-text-button">Mesclar</button>
        <button type="button" onClick={() => tableAction('unmerge')} className="orbidoc-ribbon-text-button">Desmesclar</button>
        <span className="orbidoc-ribbon-divider" />
        <label className="orbidoc-ribbon-inline-label">Margens
          <select value={margin} onChange={(event) => setMargin(event.target.value as PageMargin)} className="orbidoc-ribbon-select">
            <option value="narrow">Estreitas</option><option value="normal">Normais</option><option value="wide">Largas</option>
          </select>
        </label>
        <label className="orbidoc-ribbon-inline-label">Zoom
          <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="orbidoc-ribbon-select">
            {[50, 67, 75, 90, 100, 110, 125, 150, 175, 200].map((value) => <option key={value} value={value}>{value}%</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function PersistencePlugin({
  project,
  title,
  onProjectChange,
  onStatus,
}: {
  project: SavedProject;
  title: string;
  onProjectChange: (project: SavedProject) => void;
  onStatus: (status: AutosaveStatus, savedAt?: Date) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const autosave = useMemo(
    () => createDebouncedAutosave<PersistedSnapshot>(async (snapshot) => {
      onStatus('saving');
      const updatedAt = new Date().toISOString();
      const origin = project.cloudOrigin?.provider === 'googleDrive' ? project.cloudOrigin : undefined;
      const rawBlob = origin && (origin.fileName.toLowerCase().endsWith('.docx') || origin.mimeType.includes('wordprocessingml'))
        ? (await exportRichHtmlToDocx(snapshot.html, snapshot.title)).blob
        : new Blob([snapshot.html], { type: 'text/html;charset=utf-8' });
      await saveDocumentLocal({
        id: project.id,
        title: snapshot.title,
        contentJSON: snapshot.editorState,
        rawBlob,
        updatedAt,
        driveFileId: origin?.fileId,
        driveVersion: origin?.version,
        driveModifiedTime: origin?.modifiedTime,
        isSynced: false,
        syncState: origin && !navigator.onLine ? 'modified-offline' : 'local',
        fileName: origin?.fileName || `${SAFE_FILE_NAME(snapshot.title)}.docx`,
        mimeType: origin?.mimeType || rawBlob.type || 'text/html;charset=utf-8',
      });
      if (origin) await queueGoogleDriveEntitySync('document', project.id);
      onProjectChange({
        ...project,
        title: snapshot.title,
        content: snapshot.editorState,
        previewSnippet: snapshot.text.trim().slice(0, 180),
        updatedAt,
      });
      onStatus('saved', new Date());
    }),
    [project.id],
  );

  useEffect(() => () => autosave.dispose(), [autosave]);

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState) => {
        let html = '';
        let text = '';
        editorState.read(() => {
          html = $generateHtmlFromNodes(editor, null);
          text = $getRoot().getTextContent();
        });
        autosave.schedule({ editorState: editorState.toJSON(), html, text, title });
      }}
    />
  );
}

function DocumentMetrics({ onMetrics }: { onMetrics: (metrics: { words: number; chars: number; minutes: number }) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerTextContentListener((text) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    onMetrics({ words, chars: text.length, minutes: Math.max(1, Math.ceil(words / 220)) });
  }), [editor, onMetrics]);
  return null;
}

export const DocumentEditorLexical: React.FC<DocumentEditorLexicalProps> = ({
  project,
  onProjectChange,
  showNotification = () => {},
}) => {
  const [title, setTitle] = useState(project.title || 'Novo documento');
  const [margin, setMargin] = useState<PageMargin>('normal');
  const [zoom, setZoom] = useState(100);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [metrics, setMetrics] = useState({ words: 0, chars: 0, minutes: 1 });

  const initialConfig = useMemo(() => ({
    namespace: `OrbiDocDocument:${project.id}`,
    theme,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      HorizontalRuleNode,
      OrbiDocImageNode,
    ],
    editorState: createInitialEditorState(project),
    onError(error: Error) {
      console.error('OrbiDoc Lexical editor error', error);
      showNotification('O editor encontrou um erro e preservou o último estado local.', 'error');
    },
  }), [project.id]);

  return (
    <section className="orbidoc-document-workspace" aria-label="Editor profissional de documentos">
      <LexicalComposer initialConfig={initialConfig}>
        <LexicalToolbar
          projectId={project.id}
          title={title}
          setTitle={setTitle}
          margin={margin}
          setMargin={setMargin}
          zoom={zoom}
          setZoom={setZoom}
          showNotification={showNotification}
        />
        <div className="orbidoc-document-canvas" style={{ ['--orbidoc-document-zoom' as any]: String(zoom / 100) }}>
          <div
            className="orbidoc-a4-page orbidoc-lexical-page"
            style={{ padding: `${PAGE_MARGIN_PX[margin]}px`, transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <RichTextPlugin
              contentEditable={<ContentEditable className="orbidoc-rich-editor orbidoc-lexical-editor" aria-label="Conteúdo do documento" spellCheck />}
              placeholder={<div className="orbidoc-lexical-placeholder">Comece a escrever…</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <TablePlugin hasCellMerge hasCellBackgroundColor hasTabHandler />
        <HorizontalRulePlugin />
        <LexicalFindReplacePlugin />
        <PersistencePlugin project={project} title={title} onProjectChange={onProjectChange} onStatus={(status, savedAt) => { setAutosaveStatus(status); if (savedAt) setLastSaved(savedAt); }} />
        <DocumentMetrics onMetrics={setMetrics} />
      </LexicalComposer>
      <footer className="orbidoc-document-statusbar">
        <span>{autosaveStatus === 'saving' ? 'Salvando localmente…' : autosaveStatus === 'saved' ? 'Salvo localmente' : 'Pronto'}</span>
        {lastSaved ? <span>{lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
        <span>{metrics.words} palavras</span>
        <span>{metrics.chars} caracteres</span>
        <span>~{metrics.minutes} min de leitura</span>
        <span>Lexical · offline-first</span>
      </footer>
    </section>
  );
};
