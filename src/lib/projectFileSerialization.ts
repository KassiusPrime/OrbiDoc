import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import { richHtmlToDocxBlob, sanitizeRichHtml } from './richDocument';
import type { StudioElement, StudioShape } from './officeStudio';
import type { ExcelCell, SavedProject, SlideData } from '../types';

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const PPTX_WIDTH = 13.333;
const PPTX_HEIGHT = 7.5;

type SpreadsheetCell = ExcelCell & { underline?: boolean; format?: string; decimals?: number };
type SpreadsheetSheet = { id: string; name: string; rows: number; cols: number; cells: Record<string, SpreadsheetCell> };
type SpreadsheetWorkbook = { version?: number; sheets: SpreadsheetSheet[]; activeSheetId?: string };
type StudioSlide = SlideData & { elements?: StudioElement[]; background?: string };
type DeckState = { title?: string; slides: StudioSlide[]; theme?: string; fontFamily?: string };

const THEMES: Record<string, { bg: string; text: string; accent: string }> = {
  orbi: { bg: '#F7F9FC', text: '#0B1220', accent: '#3157F6' },
  light: { bg: '#FFFFFF', text: '#0F172A', accent: '#2563EB' },
  dark: { bg: '#080D18', text: '#F8FAFC', accent: '#7AA2FF' },
  corporate: { bg: '#F8FAFC', text: '#0F172A', accent: '#1D4ED8' },
  emerald: { bg: '#ECFDF5', text: '#052E16', accent: '#059669' },
  warm: { bg: '#FFF7ED', text: '#431407', accent: '#EA580C' },
};

const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'arquivo';
const fontFace = (stack?: string) => String(stack || 'Arial').split(',')[0].replace(/["']/g, '').trim() || 'Arial';

const parseCell = (key: string) => {
  const match = key.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let column = 0;
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
  return { column: column - 1, row: Number(match[2]) - 1 };
};

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

function spreadsheetBlob(project: SavedProject) {
  const workbook = project.content as SpreadsheetWorkbook;
  if (!workbook?.sheets?.length) throw new Error('A planilha não possui abas serializáveis.');
  const output = XLSX.utils.book_new();
  workbook.sheets.forEach((sheet, index) => {
    let maxRow = 0;
    let maxCol = 0;
    Object.keys(sheet.cells || {}).forEach((key) => {
      const position = parseCell(key);
      if (!position) return;
      maxRow = Math.max(maxRow, position.row);
      maxCol = Math.max(maxCol, position.column);
    });
    const data = Array.from({ length: maxRow + 1 }, (_, row) => Array.from({ length: maxCol + 1 }, (_, col) => sheet.cells?.[`${colName(col)}${row + 1}`]?.value || ''));
    const worksheet = XLSX.utils.aoa_to_sheet(data.length ? data : [['']]);
    Object.entries(sheet.cells || {}).forEach(([key, cell]) => {
      if (!cell.formula) return;
      const numeric = Number(cell.value);
      worksheet[key] = Number.isFinite(numeric)
        ? { t: 'n', v: numeric, f: cell.formula.replace(/^=/, '') }
        : { t: 's', v: String(cell.value ?? ''), f: cell.formula.replace(/^=/, '') };
    });
    const safeName = String(sheet.name || `Planilha${index + 1}`).replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || `Planilha${index + 1}`;
    XLSX.utils.book_append_sheet(output, worksheet, safeName);
  });
  const bytes = XLSX.write(output, { type: 'array', bookType: 'xlsx' });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function presentationBlob(project: SavedProject) {
  const deck = project.content as DeckState;
  if (!deck?.slides?.length) throw new Error('A apresentação não possui slides serializáveis.');
  const theme = THEMES[deck.theme || 'orbi'] || THEMES.orbi;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'OrbiDoc';
  pptx.title = deck.title || project.title;
  const face = fontFace(deck.fontFamily);

  for (const source of deck.slides) {
    const slide = pptx.addSlide();
    const bg = source.background || theme.bg;
    slide.background = { color: bg.replace('#', '') };
    const textColor = theme.text.replace('#', '');
    const accent = theme.accent.replace('#', '');
    if (source.layout === 'title') {
      slide.addText(source.title, { x: 0.85, y: 2.1, w: 11.65, h: 1.05, fontFace: face, fontSize: 30, bold: true, color: textColor, align: 'center', margin: 0 });
      if (source.subtitle) slide.addText(source.subtitle, { x: 1.3, y: 3.28, w: 10.7, h: 0.55, fontFace: face, fontSize: 16, color: accent, align: 'center', margin: 0 });
    } else if (source.layout === 'quote') {
      slide.addText(`“${source.title}”`, { x: 1, y: 1.7, w: 11.3, h: 2.5, fontFace: face, fontSize: 28, italic: true, bold: true, color: textColor, align: 'center', valign: 'mid' as any, margin: 0.05 });
      if (source.subtitle) slide.addText(source.subtitle, { x: 2, y: 4.6, w: 9.3, h: 0.5, fontFace: face, fontSize: 14, color: accent, align: 'right', margin: 0 });
    } else {
      slide.addText(source.title, { x: 0.72, y: 0.48, w: 11.9, h: 0.65, fontFace: face, fontSize: 24, bold: true, color: textColor, margin: 0 });
      if (source.bullets?.length) slide.addText(source.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), { x: 0.9, y: 1.5, w: source.layout === 'two-column' ? 5.4 : 11.2, h: 4.8, fontFace: face, fontSize: 18, color: textColor, breakLine: true, valign: 'top', margin: 0.06 });
    }

    const shapeTypes = (pptx as any).ShapeType || {};
    for (const element of source.elements || []) {
      const x = element.x / SLIDE_WIDTH * PPTX_WIDTH;
      const y = element.y / SLIDE_HEIGHT * PPTX_HEIGHT;
      const w = element.width / SLIDE_WIDTH * PPTX_WIDTH;
      const h = element.height / SLIDE_HEIGHT * PPTX_HEIGHT;
      if (element.type === 'text') {
        slide.addText(element.content, { x, y, w, h, fontFace: fontFace(element.fontFamily), fontSize: Math.max(8, element.fontSize * 0.75), bold: element.fontWeight >= 700, color: element.fill.replace('#', ''), align: element.textAlign, rotate: element.rotation, margin: 0.02, transparency: Math.round((1 - element.opacity) * 100) });
      } else if (element.type === 'image' && element.content) {
        slide.addImage({ data: element.content, x, y, w, h, rotate: element.rotation, transparency: Math.round((1 - element.opacity) * 100) });
      } else if (element.type === 'shape') {
        const map: Record<StudioShape, string> = { rectangle: 'rect', rounded: 'roundRect', circle: 'ellipse', triangle: 'triangle', diamond: 'diamond', arrow: 'rightArrow', star: 'star5', line: 'line' };
        const shape = shapeTypes[map[element.shape || 'rectangle']] || map[element.shape || 'rectangle'];
        slide.addShape(shape as any, {
          x, y, w, h, rotate: element.rotation,
          fill: element.shape === 'line' ? { color: 'FFFFFF', transparency: 100 } : { color: element.fill.replace('#', ''), transparency: Math.round((1 - element.opacity) * 100) },
          line: { color: (element.stroke === 'transparent' ? element.fill : element.stroke).replace('#', ''), width: Math.max(1, element.strokeWidth || (element.shape === 'line' ? 3 : 0.5)), transparency: element.stroke === 'transparent' && element.shape !== 'line' ? 100 : 0 },
        });
      }
    }
    if (source.notes) slide.addNotes(source.notes);
  }

  return await pptx.write({ outputType: 'blob' }) as Blob;
}

export async function serializeProjectToSourceFile(project: SavedProject): Promise<File> {
  const extension = project.type === 'word' ? 'docx' : project.type === 'excel' ? 'xlsx' : project.type === 'powerpoint' ? 'pptx' : '';
  if (!extension) throw new Error('Este editor ainda não possui save-back para o formato de origem.');
  const name = `${cleanFileName(project.title)}.${extension}`;
  if (project.type === 'word') {
    const html = typeof project.content === 'string' ? sanitizeRichHtml(project.content) : '<p></p>';
    return new File([await richHtmlToDocxBlob(html, project.title)], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  if (project.type === 'excel') return new File([spreadsheetBlob(project)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return new File([await presentationBlob(project)], name, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}
