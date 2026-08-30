import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { OcrItem, SavedProject, SlideData } from '../types';
import { sanitizeRichHtml } from './richDocument';
import type { OrbiDocOpenFileDetail } from './systemFileOpen';

export type WorkspaceEditorRoute = 'word' | 'excel' | 'powerpoint' | 'extract';

export type ImportedWorkspaceFile = {
  route: WorkspaceEditorRoute;
  project: SavedProject;
  ocrItems?: OcrItem[];
  cleanup?: () => void;
};

const DEFAULT_ROWS = 80;
const DEFAULT_COLS = 20;

const extensionOf = (file: File) => file.name.split('.').pop()?.toLowerCase() || '';
const baseName = (name: string) => name.replace(/\.[^/.]+$/, '').trim() || 'Arquivo';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colName = (index: number) => {
  let value = Math.max(0, index) + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

const sourceLabel = (source: OrbiDocOpenFileDetail['source']) => ({
  local: 'Arquivo local',
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  github: 'GitHub',
  share: 'Compartilhado com OrbiDoc',
  system: 'Sistema',
}[source || 'local']);

export function resolveWorkspaceEditor(file: File): WorkspaceEditorRoute | null {
  const extension = extensionOf(file);
  const mime = (file.type || '').toLowerCase();
  if (['docx', 'html', 'htm', 'txt', 'md', 'markdown'].includes(extension) || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'word';
  if (['xlsx', 'xls', 'csv'].includes(extension) || mime.includes('spreadsheet') || mime === 'text/csv') return 'excel';
  if (extension === 'pptx' || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'powerpoint';
  if (extension === 'pdf' || mime === 'application/pdf') return 'extract';
  return null;
}

const textToHtml = (text: string) => {
  const parts: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => { if (list) parts.push(`</${list}>`); list = null; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); parts.push('<p><br></p>'); continue; }
    if (/^###\s+/.test(line)) { close(); parts.push(`<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`); continue; }
    if (/^##\s+/.test(line)) { close(); parts.push(`<h2>${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`); continue; }
    if (/^#\s+/.test(line)) { close(); parts.push(`<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`); continue; }
    if (/^[-*•]\s+/.test(line)) { if (list !== 'ul') { close(); list = 'ul'; parts.push('<ul>'); } parts.push(`<li>${escapeHtml(line.replace(/^[-*•]\s+/, ''))}</li>`); continue; }
    if (/^\d+[.)]\s+/.test(line)) { if (list !== 'ol') { close(); list = 'ol'; parts.push('<ol>'); } parts.push(`<li>${escapeHtml(line.replace(/^\d+[.)]\s+/, ''))}</li>`); continue; }
    close(); parts.push(`<p>${escapeHtml(raw)}</p>`);
  }
  close();
  return parts.join('');
};

async function importDocumentContent(file: File) {
  const extension = extensionOf(file);
  if (extension === 'docx') {
    const module = await import('mammoth');
    const mammoth = (module as any).default || module;
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      { convertImage: mammoth.images.imgElement(async (image: any) => ({ src: `data:${image.contentType};base64,${await image.read('base64')}` })) },
    );
    return sanitizeRichHtml(result.value || '<p></p>');
  }
  if (extension === 'html' || extension === 'htm') {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    return sanitizeRichHtml(doc.body.innerHTML || '<p></p>');
  }
  return sanitizeRichHtml(textToHtml(await file.text()));
}

async function importSpreadsheetContent(file: File) {
  const extension = extensionOf(file);
  const loaded = extension === 'csv'
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellStyles: true });

  const sheets = loaded.SheetNames.map((name) => {
    const worksheet = loaded.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: '' });
    const cells: Record<string, any> = {};
    matrix.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
      const key = `${colName(colIndex)}${rowIndex + 1}`;
      const source = worksheet[key] as any;
      cells[key] = {
        value: String(value ?? ''),
        formula: source?.f ? `=${source.f}` : undefined,
        bold: Boolean(source?.s?.font?.bold),
        italic: Boolean(source?.s?.font?.italic),
      };
    }));
    return {
      id: crypto.randomUUID(),
      name,
      rows: Math.max(DEFAULT_ROWS, matrix.length + 10),
      cols: Math.max(DEFAULT_COLS, Math.max(0, ...matrix.map((row) => row.length)) + 3),
      cells,
      columnWidths: {},
    };
  });
  if (!sheets.length) throw new Error('A planilha não contém abas legíveis.');
  return { version: 4, sheets, activeSheetId: sheets[0].id };
}

type ImportedSlide = SlideData & { elements: any[]; background?: string };
const slideNumber = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] || 0);
const nodeText = (node: Element) => Array.from(node.getElementsByTagName('a:t')).map((item) => item.textContent || '').join('').trim();

function parsePptxSlide(xml: string, notes = ''): ImportedSlide {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Um slide do PPTX contém XML inválido.');
  let title = '';
  let subtitle = '';
  const paragraphs: string[] = [];
  Array.from(doc.getElementsByTagName('p:sp')).forEach((shape) => {
    const text = nodeText(shape);
    if (!text) return;
    const placeholder = shape.getElementsByTagName('p:ph')[0];
    const type = placeholder?.getAttribute('type') || '';
    if ((type === 'title' || type === 'ctrTitle') && !title) { title = text; return; }
    if (type === 'subTitle' && !subtitle) { subtitle = text; return; }
    const shapeParagraphs = Array.from(shape.getElementsByTagName('a:p')).map(nodeText).filter(Boolean);
    if (shapeParagraphs.length) paragraphs.push(...shapeParagraphs);
    else paragraphs.push(text);
  });
  if (!title) title = paragraphs.shift() || 'Slide importado';
  const bullets = paragraphs.filter((value, index, source) => value && source.indexOf(value) === index).slice(0, 20);
  return {
    id: crypto.randomUUID(),
    title,
    subtitle: subtitle || undefined,
    bullets,
    bgGradient: '',
    layout: subtitle && !bullets.length ? 'title' : 'content',
    notes,
    elements: [],
  };
}

async function importPresentationContent(file: File) {
  if (file.size > 40 * 1024 * 1024) throw new Error('Use um PPTX de até 40 MB nesta importação.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (!paths.length) throw new Error('O PPTX não contém slides legíveis.');
  if (paths.length > 120) throw new Error('Este PPTX possui mais de 120 slides. Divida a apresentação antes de importar.');
  const slides: ImportedSlide[] = [];
  for (const path of paths) {
    const number = slideNumber(path);
    const xml = await zip.file(path)?.async('string');
    if (!xml) continue;
    const notesXml = await zip.file(`ppt/notesSlides/notesSlide${number}.xml`)?.async('string');
    let notes = '';
    if (notesXml) {
      const notesDoc = new DOMParser().parseFromString(notesXml, 'application/xml');
      notes = Array.from(notesDoc.getElementsByTagName('a:t')).map((item) => item.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
    }
    slides.push(parsePptxSlide(xml, notes));
  }
  if (!slides.length) throw new Error('Nenhum slide utilizável foi encontrado.');
  return { version: 4, title: baseName(file.name), slides, theme: 'orbi', fontFamily: 'Inter, system-ui, sans-serif' };
}

export async function importWorkspaceFile(
  file: File,
  source: OrbiDocOpenFileDetail['source'] = 'local',
): Promise<ImportedWorkspaceFile> {
  const route = resolveWorkspaceEditor(file);
  if (!route) throw new Error('Este formato deve continuar no leitor universal.');
  const now = new Date().toISOString();
  const project: SavedProject = {
    id: crypto.randomUUID(),
    title: baseName(file.name),
    type: route,
    createdAt: now,
    updatedAt: now,
    previewSnippet: `${sourceLabel(source)} · ${file.name}`,
    tags: ['Importado', sourceLabel(source)],
  };

  if (route === 'word') project.content = await importDocumentContent(file);
  else if (route === 'excel') project.content = await importSpreadsheetContent(file);
  else if (route === 'powerpoint') project.content = await importPresentationContent(file);
  else {
    const url = URL.createObjectURL(file);
    const item: OcrItem = {
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      text: '',
      status: 'completed',
      progress: 100,
      timestamp: now,
      fileUrl: url,
      fileType: file.type || 'application/pdf',
      tags: ['PDF', sourceLabel(source)],
    };
    project.content = { ocrItems: [{ ...item, fileUrl: undefined }] };
    return { route, project, ocrItems: [item], cleanup: () => URL.revokeObjectURL(url) };
  }

  return { route, project };
}
