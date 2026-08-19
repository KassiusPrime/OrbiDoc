export type ConvertibleFormat =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'txt'
  | 'png'
  | 'jpg'
  | 'webp'
  | 'avif'
  | 'xlsx'
  | 'csv';

export interface ConversionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  pdfScale?: number;
  ocrLanguage?: string;
  forceOcrPdf?: boolean;
}

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  warnings: string[];
}

const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif']);
const TEXT_FORMATS = new Set(['txt', 'md', 'json', 'xml']);

const MIME_BY_FORMAT: Record<ConvertibleFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
};

const cleanBaseName = (name: string) =>
  name.replace(/\.[^/.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'arquivo';

export function getFileExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return extension === 'jpeg' ? 'jpg' : extension;
}

export function getSupportedOutputs(file: File): ConvertibleFormat[] {
  const extension = getFileExtension(file);

  if (IMAGE_FORMATS.has(extension)) {
    return (['png', 'jpg', 'webp', 'avif', 'pdf', 'txt', 'html', 'docx'] as ConvertibleFormat[])
      .filter((format) => format !== extension);
  }

  if (extension === 'pdf') return ['txt', 'html', 'docx', 'png', 'jpg', 'webp', 'avif'];
  if (extension === 'docx') return ['html', 'txt', 'pdf'];
  if (extension === 'html' || extension === 'htm') return ['txt', 'pdf', 'docx'];
  if (extension === 'xlsx' || extension === 'xls') return ['csv', 'html', 'txt', 'pdf', 'docx'];
  if (extension === 'csv') return ['xlsx', 'html', 'txt', 'pdf', 'docx'];
  if (TEXT_FORMATS.has(extension)) return ['html', 'pdf', 'docx'];

  return [];
}

export function isSupportedInput(file: File): boolean {
  return getSupportedOutputs(file).length > 0;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToHtml(text: string, title: string) {
  let list: 'ul' | 'ol' | null = null;
  const parts: string[] = [];
  const closeList = () => {
    if (list) parts.push(`</${list}>`);
    list = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeList();
      parts.push('<p><br></p>');
      continue;
    }
    if (/^###\s+/.test(trimmed)) { closeList(); parts.push(`<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`); continue; }
    if (/^##\s+/.test(trimmed)) { closeList(); parts.push(`<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`); continue; }
    if (/^#\s+/.test(trimmed)) { closeList(); parts.push(`<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`); continue; }
    if (/^[-*•]\s+/.test(trimmed)) {
      if (list !== 'ul') { closeList(); list = 'ul'; parts.push('<ul>'); }
      parts.push(`<li>${escapeHtml(trimmed.replace(/^[-*•]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (list !== 'ol') { closeList(); list = 'ol'; parts.push('<ol>'); }
      parts.push(`<li>${escapeHtml(trimmed.replace(/^\d+[.)]\s+/, ''))}</li>`);
      continue;
    }
    if (/^>\s+/.test(trimmed)) { closeList(); parts.push(`<blockquote>${escapeHtml(trimmed.replace(/^>\s+/, ''))}</blockquote>`); continue; }
    closeList();
    parts.push(`<p>${escapeHtml(rawLine)}</p>`);
  }
  closeList();

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#172033;line-height:1.65}h1,h2,h3{line-height:1.25;color:#0f172a}blockquote{border-left:4px solid #6366f1;margin:18px 0;padding:8px 16px;background:#f8fafc}pre{white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px}ul,ol{padding-left:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}</style></head><body>${parts.join('\n')}</body></html>`;
}

function htmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr').forEach((node) => node.append('\n'));
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

type StructuredBlock = {
  kind: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'number' | 'quote' | 'code';
  text: string;
};

function textToBlocks(text: string): StructuredBlock[] {
  let inCode = false;
  let codeBuffer: string[] = [];
  const blocks: StructuredBlock[] = [];

  const flushCode = () => {
    if (codeBuffer.length) blocks.push({ kind: 'code', text: codeBuffer.join('\n') });
    codeBuffer = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) { codeBuffer.push(rawLine); continue; }
    if (!trimmed) continue;
    if (/^###\s+/.test(trimmed)) blocks.push({ kind: 'h3', text: trimmed.replace(/^###\s+/, '') });
    else if (/^##\s+/.test(trimmed)) blocks.push({ kind: 'h2', text: trimmed.replace(/^##\s+/, '') });
    else if (/^#\s+/.test(trimmed)) blocks.push({ kind: 'h1', text: trimmed.replace(/^#\s+/, '') });
    else if (/^[-*•]\s+/.test(trimmed)) blocks.push({ kind: 'bullet', text: trimmed.replace(/^[-*•]\s+/, '') });
    else if (/^\d+[.)]\s+/.test(trimmed)) blocks.push({ kind: 'number', text: trimmed.replace(/^\d+[.)]\s+/, '') });
    else if (/^>\s+/.test(trimmed)) blocks.push({ kind: 'quote', text: trimmed.replace(/^>\s+/, '') });
    else blocks.push({ kind: 'paragraph', text: rawLine });
  }
  if (inCode) flushCode();
  return blocks;
}

function htmlToBlocks(html: string): StructuredBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: StructuredBlock[] = [];

  doc.body.querySelectorAll('h1,h2,h3,p,li,blockquote,pre,table').forEach((element) => {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent || '').trim();
    if (!text) return;
    if (tag === 'h1') blocks.push({ kind: 'h1', text });
    else if (tag === 'h2') blocks.push({ kind: 'h2', text });
    else if (tag === 'h3') blocks.push({ kind: 'h3', text });
    else if (tag === 'li') blocks.push({ kind: 'bullet', text });
    else if (tag === 'blockquote') blocks.push({ kind: 'quote', text });
    else if (tag === 'pre') blocks.push({ kind: 'code', text });
    else if (tag === 'table') {
      const rows = Array.from(element.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => (cell.textContent || '').trim()).join('\t'));
      blocks.push({ kind: 'code', text: rows.join('\n') });
    } else blocks.push({ kind: 'paragraph', text });
  });
  return blocks.length ? blocks : textToBlocks(htmlToPlainText(html));
}

async function blocksToPdf(blocks: StructuredBlock[], title: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = width - margin * 2;
  let y = 20;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed <= height - 18) return;
    pdf.addPage();
    y = 20;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(15, 23, 42);
  const titleLines = pdf.splitTextToSize(title, contentWidth);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 7 + 5;

  let numberIndex = 1;
  for (const block of blocks) {
    let fontSize = 11;
    let style: 'normal' | 'bold' | 'italic' = 'normal';
    let indent = 0;
    let prefix = '';
    let spacing = 5.2;

    if (block.kind === 'h1') { fontSize = 18; style = 'bold'; spacing = 7; numberIndex = 1; }
    if (block.kind === 'h2') { fontSize = 15; style = 'bold'; spacing = 6.5; numberIndex = 1; }
    if (block.kind === 'h3') { fontSize = 13; style = 'bold'; spacing = 6; numberIndex = 1; }
    if (block.kind === 'bullet') { prefix = '• '; indent = 4; numberIndex = 1; }
    else if (block.kind === 'number') { prefix = `${numberIndex++}. `; indent = 4; }
    else if (block.kind !== 'number') numberIndex = 1;
    if (block.kind === 'quote') { style = 'italic'; indent = 5; }
    if (block.kind === 'code') { fontSize = 9; spacing = 4.4; }

    pdf.setFont(block.kind === 'code' ? 'courier' : 'helvetica', style);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(block.kind === 'quote' ? 71 : 30, block.kind === 'quote' ? 85 : 41, block.kind === 'quote' ? 105 : 59);
    const lines = pdf.splitTextToSize(`${prefix}${block.text}`, contentWidth - indent);
    const blockHeight = Math.max(1, lines.length) * spacing + (block.kind.startsWith('h') ? 3 : 2);
    addPageIfNeeded(blockHeight);

    if (block.kind === 'quote') {
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y - 3, margin, y + Math.max(spacing, lines.length * spacing - 2));
    }
    if (block.kind === 'code') {
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y - 4, contentWidth, blockHeight, 2, 2, 'F');
    }
    pdf.text(lines, margin + indent, y);
    y += blockHeight;
  }

  return pdf.output('blob');
}

async function blocksToDocx(blocks: StructuredBlock[], title: string) {
  const docx = await import('docx');
  const numberingReference = 'docswiss-numbering';
  const children: any[] = [new docx.Paragraph({ text: title, heading: docx.HeadingLevel.TITLE, spacing: { after: 240 } })];

  for (const block of blocks) {
    if (block.kind === 'h1') { children.push(new docx.Paragraph({ text: block.text, heading: docx.HeadingLevel.HEADING_1 })); continue; }
    if (block.kind === 'h2') { children.push(new docx.Paragraph({ text: block.text, heading: docx.HeadingLevel.HEADING_2 })); continue; }
    if (block.kind === 'h3') { children.push(new docx.Paragraph({ text: block.text, heading: docx.HeadingLevel.HEADING_3 })); continue; }
    if (block.kind === 'bullet') { children.push(new docx.Paragraph({ text: block.text, bullet: { level: 0 } })); continue; }
    if (block.kind === 'number') { children.push(new docx.Paragraph({ text: block.text, numbering: { reference: numberingReference, level: 0 } })); continue; }
    if (block.kind === 'quote') {
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: block.text, italics: true, color: '475569' })], indent: { left: 420 } }));
      continue;
    }
    if (block.kind === 'code') {
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: block.text, font: 'Courier New', size: 18 })], shading: { fill: 'F8FAFC' } }));
      continue;
    }
    children.push(new docx.Paragraph({ text: block.text, spacing: { after: 120 } }));
  }

  const document = new docx.Document({
    numbering: {
      config: [{
        reference: numberingReference,
        levels: [{
          level: 0,
          format: docx.LevelFormat.DECIMAL,
          text: '%1.',
          alignment: docx.AlignmentType.START,
          style: { paragraph: { indent: { left: 720, hanging: 260 } } },
        }],
      }],
    },
    sections: [{ children }],
  });
  return docx.Packer.toBlob(document);
}

async function loadImage(file: File) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('O navegador não conseguiu decodificar esta imagem.')); };
    image.src = url;
  });
}

async function imageToCanvas(file: File, options: ConversionOptions) {
  const image = await loadImage(file);
  const sourceWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const sourceHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;
  if (!sourceWidth || !sourceHeight) throw new Error('A imagem não possui dimensões válidas.');
  const maxWidth = options.maxWidth && options.maxWidth > 0 ? options.maxWidth : sourceWidth;
  const maxHeight = options.maxHeight && options.maxHeight > 0 ? options.maxHeight : sourceHeight;
  const ratio = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível neste navegador.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image as CanvasImageSource, 0, 0, width, height);
  if ('close' in image && typeof image.close === 'function') image.close();
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg' | 'webp' | 'avif', quality = 0.9) {
  let renderCanvas = canvas;
  if (format === 'jpg') {
    renderCanvas = document.createElement('canvas');
    renderCanvas.width = canvas.width;
    renderCanvas.height = canvas.height;
    const context = renderCanvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível neste navegador.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(canvas, 0, 0);
  }

  const mime = MIME_BY_FORMAT[format];
  const blob = await new Promise<Blob>((resolve, reject) => {
    renderCanvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Falha ao codificar ${format.toUpperCase()}.`)), mime, quality);
  });
  if (blob.type !== mime && format === 'avif') throw new Error('Este navegador não oferece codificação AVIF. Use PNG, JPG ou WebP.');
  return blob;
}

async function imageToPdf(file: File, options: ConversionOptions) {
  const canvas = await imageToCanvas(file, options);
  const { jsPDF } = await import('jspdf');
  const landscape = canvas.width > canvas.height;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
  const width = canvas.width * ratio;
  const height = canvas.height * ratio;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, 'FAST');
  return pdf.output('blob');
}

async function readPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = (workerModule as any).default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

async function pdfToImageArchive(file: File, target: 'png' | 'jpg' | 'webp' | 'avif', options: ConversionOptions): Promise<ConversionResult> {
  const pdf = await readPdf(file);
  const quality = Math.min(1, Math.max(0.1, options.quality ?? 0.9));
  const scale = Math.min(3, Math.max(1, options.pdfScale ?? 1.75));
  const pageBlobs: Blob[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível.');
    await page.render({ canvasContext: context, viewport }).promise;
    pageBlobs.push(await canvasToBlob(canvas, target, quality));
  }

  const base = cleanBaseName(file.name);
  if (pageBlobs.length === 1) {
    return { blob: pageBlobs[0], fileName: `${base}.${target}`, mimeType: MIME_BY_FORMAT[target], warnings: [] };
  }

  const JSZipModule = await import('jszip');
  const JSZip = (JSZipModule as any).default || JSZipModule;
  const zip = new JSZip();
  pageBlobs.forEach((blob, index) => zip.file(`${base}_pagina_${String(index + 1).padStart(2, '0')}.${target}`, blob));
  const archive = await zip.generateAsync({ type: 'blob' });
  return { blob: archive, fileName: `${base}_${target}_paginas.zip`, mimeType: 'application/zip', warnings: [`O PDF tinha ${pageBlobs.length} páginas; as imagens foram entregues em um ZIP.`] };
}

async function runOcr(file: File, options: ConversionOptions) {
  const { processFileOcr } = await import('./ocrEngine');
  const text = await processFileOcr(file, {
    language: options.ocrLanguage || 'por+eng',
    enhanceContrast: true,
    forceOcrPdf: Boolean(options.forceOcrPdf),
  });
  return text.trim();
}

async function docxToHtml(file: File) {
  const module = await import('mammoth');
  const mammoth = (module as any).default || module;
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return { html: result.value as string, warnings: (result.messages || []).map((item: any) => String(item.message || item)) };
}

async function spreadsheetToData(file: File) {
  const module = await import('xlsx');
  const XLSX = (module as any).default || module;
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('A planilha não contém abas legíveis.');
  const sheet = workbook.Sheets[sheetName];
  return {
    XLSX,
    workbook,
    sheet,
    sheetName,
    csv: XLSX.utils.sheet_to_csv(sheet),
    html: XLSX.utils.sheet_to_html(sheet),
    rows: XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][],
  };
}

async function csvToXlsx(file: File) {
  const module = await import('xlsx');
  const XLSX = (module as any).default || module;
  const workbook = XLSX.read(await file.text(), { type: 'string' });
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([array], { type: MIME_BY_FORMAT.xlsx });
}

const rowsToText = (rows: any[][]) => rows.map((row) => row.map((value) => String(value ?? '')).join('\t')).join('\n');

async function textResult(text: string, base: string, target: 'txt' | 'html' | 'docx' | 'pdf', warnings: string[]): Promise<ConversionResult> {
  if (target === 'txt') return { blob: new Blob([text], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
  if (target === 'html') {
    const html = textToHtml(text, base);
    return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
  }
  if (target === 'docx') return { blob: await blocksToDocx(textToBlocks(text), base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
  return { blob: await blocksToPdf(textToBlocks(text), base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
}

export async function convertFile(file: File, target: ConvertibleFormat, options: ConversionOptions = {}): Promise<ConversionResult> {
  const extension = getFileExtension(file);
  const supported = getSupportedOutputs(file);
  if (!supported.includes(target)) throw new Error(`Conversão de .${extension || 'desconhecido'} para .${target} não é suportada neste dispositivo.`);

  const base = cleanBaseName(file.name);
  const warnings: string[] = [];
  const quality = Math.min(1, Math.max(0.1, options.quality ?? 0.9));

  if (IMAGE_FORMATS.has(extension)) {
    if (target === 'pdf') return { blob: await imageToPdf(file, options), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    if (target === 'png' || target === 'jpg' || target === 'webp' || target === 'avif') {
      const canvas = await imageToCanvas(file, options);
      const blob = await canvasToBlob(canvas, target, quality);
      return { blob, fileName: `${base}.${target}`, mimeType: MIME_BY_FORMAT[target], warnings };
    }
    warnings.push('Imagem → texto usa OCR local. A fidelidade depende da resolução, contraste, idioma e qualidade do arquivo original.');
    const text = await runOcr(file, options);
    if (!text) warnings.push('O OCR não encontrou texto legível na imagem.');
    return textResult(text, base, target as 'txt' | 'html' | 'docx', warnings);
  }

  if (extension === 'pdf') {
    if (target === 'png' || target === 'jpg' || target === 'webp' || target === 'avif') return pdfToImageArchive(file, target, options);
    warnings.push('PDF → texto/documento preserva o conteúdo legível; layouts vetoriais complexos, formulários e posicionamento absoluto podem ser simplificados.');
    const text = await runOcr(file, options);
    if (!text) warnings.push('Nenhum texto legível foi encontrado no PDF.');
    return textResult(text, base, target as 'txt' | 'html' | 'docx', warnings);
  }

  if (extension === 'docx') {
    const converted = await docxToHtml(file);
    warnings.push(...converted.warnings);
    if (target === 'html') {
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(base)}</title></head><body>${converted.html}</body></html>`;
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    if (target === 'txt') return { blob: new Blob([htmlToPlainText(converted.html)], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    warnings.push('DOCX → PDF preserva a hierarquia textual principal; caixas flutuantes, cabeçalhos especiais e outros recursos avançados do Word podem ser simplificados.');
    return { blob: await blocksToPdf(htmlToBlocks(converted.html), base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
  }

  if (extension === 'html' || extension === 'htm') {
    const html = await file.text();
    if (target === 'txt') return { blob: new Blob([htmlToPlainText(html)], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    if (target === 'pdf') return { blob: await blocksToPdf(htmlToBlocks(html), base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    return { blob: await blocksToDocx(htmlToBlocks(html), base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const data = await spreadsheetToData(file);
    if (target === 'csv') return { blob: new Blob(['\ufeff', data.csv], { type: MIME_BY_FORMAT.csv }), fileName: `${base}.csv`, mimeType: MIME_BY_FORMAT.csv, warnings };
    if (target === 'html') {
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(base)}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}</style></head><body><h1>${escapeHtml(base)}</h1>${data.html}</body></html>`;
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    const text = rowsToText(data.rows);
    if (target === 'txt') return { blob: new Blob([text], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    warnings.push('A conversão de planilha usa a primeira aba. Fórmulas são exportadas pelos valores disponíveis e recursos avançados de Excel podem ser simplificados.');
    if (target === 'docx') return { blob: await blocksToDocx([{ kind: 'code', text }], base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
    return { blob: await blocksToPdf([{ kind: 'code', text }], base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
  }

  if (extension === 'csv' && target === 'xlsx') return { blob: await csvToXlsx(file), fileName: `${base}.xlsx`, mimeType: MIME_BY_FORMAT.xlsx, warnings };

  if (extension === 'csv') {
    const text = await file.text();
    if (target === 'html') {
      const rows = text.split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((cell) => `<td>${escapeHtml(cell)}</td>`).join(''));
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(base)}</title></head><body><table>${rows.map((row) => `<tr>${row}</tr>`).join('')}</table></body></html>`;
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    if (target === 'txt') return { blob: new Blob([text], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    if (target === 'docx') return { blob: await blocksToDocx([{ kind: 'code', text }], base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
    return { blob: await blocksToPdf([{ kind: 'code', text }], base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
  }

  if (TEXT_FORMATS.has(extension)) {
    const text = await file.text();
    return textResult(text, base, target as 'html' | 'pdf' | 'docx', warnings);
  }

  throw new Error(`Não foi possível concluir a conversão de ${file.name} para ${target.toUpperCase()}.`);
}
