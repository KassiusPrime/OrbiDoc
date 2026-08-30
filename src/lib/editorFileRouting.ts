import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { OFFICE_FONTS } from './officeStudio';
import { sanitizeRichHtml } from './richDocument';
import type { ExcelCell, OrbiDocFileOrigin, OrbiDocFileSource, SavedProject, SlideData } from '../types';

export type EditorRoute = Extract<SavedProject['type'], 'word' | 'excel' | 'powerpoint'>;

type SpreadsheetCell = ExcelCell & { underline?: boolean; format?: 'general' | 'currency' | 'percent' | 'date'; decimals?: number };
type SpreadsheetSheet = { id: string; name: string; rows: number; cols: number; cells: Record<string, SpreadsheetCell>; columnWidths?: Record<number, number> };
type SpreadsheetWorkbook = { version: 4; sheets: SpreadsheetSheet[]; activeSheetId: string };
type ImportedSlide = SlideData & { elements: any[]; background?: string };

const DEFAULT_ROWS = 80;
const DEFAULT_COLS = 20;

const extensionOf = (name: string) => name.split('.').pop()?.trim().toLowerCase() || '';
const baseName = (name: string) => name.replace(/\.[^/.]+$/, '') || 'Arquivo';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const textToHtml = (text: string) => text.split(/\r?\n/).map((line) => {
  const trimmed = line.trim();
  if (!trimmed) return '<p><br></p>';
  if (/^###\s+/.test(trimmed)) return `<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`;
  if (/^##\s+/.test(trimmed)) return `<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`;
  if (/^#\s+/.test(trimmed)) return `<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`;
  return `<p>${escapeHtml(line)}</p>`;
}).join('');

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

export function editorRouteForFile(file: Pick<File, 'name' | 'type'>): EditorRoute | null {
  const extension = extensionOf(file.name);
  if (['docx', 'html', 'htm', 'txt', 'md', 'markdown'].includes(extension)) return 'word';
  if (['xlsx', 'xls', 'xlsm', 'xltx', 'csv', 'tsv'].includes(extension)) return 'excel';
  if (extension === 'pptx') return 'powerpoint';
  return null;
}

export const canRouteFileToEditor = (file: Pick<File, 'name' | 'type'>) => Boolean(editorRouteForFile(file));

function normalizeOrigin(
  file: File,
  route: EditorRoute,
  source: OrbiDocFileSource,
  origin?: Partial<OrbiDocFileOrigin>,
): OrbiDocFileOrigin {
  const extension = extensionOf(file.name);
  const canonical = route === 'word' ? 'docx' : route === 'excel' ? 'xlsx' : 'pptx';
  const cloudWritable = source === 'google-drive' || source === 'onedrive';
  return {
    ...origin,
    source,
    providerName: origin?.providerName || file.name,
    mimeType: origin?.mimeType || file.type || 'application/octet-stream',
    originalExtension: origin?.originalExtension || extension,
    readOnly: origin?.readOnly ?? !(cloudWritable && extension === canonical),
    openedAt: origin?.openedAt || new Date().toISOString(),
  };
}

async function importWord(file: File) {
  const extension = extensionOf(file.name);
  if (extension === 'docx') {
    const module = await import('mammoth');
    const mammoth = (module as any).default || module;
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      { convertImage: mammoth.images.imgElement(async (image: any) => ({ src: `data:${image.contentType};base64,${await image.read('base64')}` })) },
    );
    return {
      content: sanitizeRichHtml(result.value || '<p></p>'),
      preview: String((result.value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 180) || 'Documento importado.',
    };
  }
  if (extension === 'html' || extension === 'htm') {
    const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
    const content = sanitizeRichHtml(parsed.body.innerHTML || '<p></p>');
    return { content, preview: parsed.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Documento HTML importado.' };
  }
  const text = await file.text();
  return { content: sanitizeRichHtml(textToHtml(text)), preview: text.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Documento de texto importado.' };
}

async function importSpreadsheet(file: File): Promise<{ content: SpreadsheetWorkbook; preview: string }> {
  const extension = extensionOf(file.name);
  const loaded = extension === 'csv' || extension === 'tsv'
    ? XLSX.read(await file.text(), { type: 'string', FS: extension === 'tsv' ? '\t' : ',' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellStyles: true });

  const sheets: SpreadsheetSheet[] = loaded.SheetNames.map((name) => {
    const worksheet = loaded.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: '' });
    const rows = Math.max(DEFAULT_ROWS, matrix.length + 10);
    const cols = Math.max(DEFAULT_COLS, Math.max(0, ...matrix.map((row) => row.length)) + 3);
    const cells: Record<string, SpreadsheetCell> = {};
    matrix.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
      const key = `${colName(columnIndex)}${rowIndex + 1}`;
      const source = worksheet[key] as any;
      cells[key] = {
        value: String(value ?? ''),
        formula: source?.f ? `=${source.f}` : undefined,
        bold: Boolean(source?.s?.font?.bold),
        italic: Boolean(source?.s?.font?.italic),
      };
    }));
    return { id: crypto.randomUUID(), name, rows, cols, cells, columnWidths: {} };
  });
  if (!sheets.length) throw new Error('A planilha não contém abas legíveis.');
  return {
    content: { version: 4, sheets, activeSheetId: sheets[0].id },
    preview: `${sheets.length} aba(s) importada(s) · ${Object.keys(sheets[0].cells).length} célula(s) na primeira aba.`,
  };
}

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

async function importPresentation(file: File) {
  if (file.size > 40 * 1024 * 1024) throw new Error('Use um PPTX de até 40 MB nesta importação estrutural.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => slideNumber(a) - slideNumber(b));
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
  const title = baseName(file.name);
  return {
    content: { version: 4, title, slides, theme: 'orbi', fontFamily: OFFICE_FONTS[0].value },
    preview: `${slides.length} slide(s) importado(s) · texto e notas editáveis.`,
  };
}

export async function createEditorProjectFromFile(
  file: File,
  source: OrbiDocFileSource = 'local',
  origin?: Partial<OrbiDocFileOrigin>,
): Promise<SavedProject> {
  const route = editorRouteForFile(file);
  if (!route) throw new Error('Este arquivo não possui um editor nativo associado.');
  const imported = route === 'word' ? await importWord(file) : route === 'excel' ? await importSpreadsheet(file) : await importPresentation(file);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: baseName(file.name),
    type: route,
    createdAt: now,
    updatedAt: now,
    previewSnippet: imported.preview,
    tags: ['Importado', extensionOf(file.name).toUpperCase()],
    content: imported.content,
    origin: normalizeOrigin(file, route, source, origin),
  };
}
