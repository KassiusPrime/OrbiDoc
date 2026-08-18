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
}

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  warnings: string[];
}

const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif']);
const TEXT_FORMATS = new Set(['txt', 'md', 'json', 'xml', 'csv']);

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
  if (extension === 'jpeg') return 'jpg';
  return extension;
}

export function getSupportedOutputs(file: File): ConvertibleFormat[] {
  const extension = getFileExtension(file);

  if (IMAGE_FORMATS.has(extension)) {
    return ['png', 'jpg', 'webp', 'avif', 'pdf'].filter((format) => format !== extension) as ConvertibleFormat[];
  }

  if (extension === 'pdf') return ['txt', 'html', 'docx', 'png', 'jpg', 'webp'];
  if (extension === 'docx') return ['html', 'txt', 'pdf'];
  if (extension === 'html' || extension === 'htm') return ['txt', 'pdf', 'docx'];
  if (extension === 'xlsx' || extension === 'xls') return ['csv', 'html', 'txt', 'pdf'];
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
  const body = text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<p><br></p>';
      if (/^###\s+/.test(trimmed)) return `<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`;
      if (/^##\s+/.test(trimmed)) return `<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`;
      if (/^#\s+/.test(trimmed)) return `<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`;
      if (/^[-*•]\s+/.test(trimmed)) return `<li>${escapeHtml(trimmed.replace(/^[-*•]\s+/, ''))}</li>`;
      if (/^>\s+/.test(trimmed)) return `<blockquote>${escapeHtml(trimmed.replace(/^>\s+/, ''))}</blockquote>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n')
    .replace(/(?:<li>.*?<\/li>\n?)+/gs, (list) => `<ul>${list}</ul>`);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#172033;line-height:1.65}h1,h2,h3{line-height:1.25;color:#0f172a}blockquote{border-left:4px solid #6366f1;margin:18px 0;padding:8px 16px;background:#f8fafc}pre{white-space:pre-wrap}ul{padding-left:24px}</style></head><body>${body}</body></html>`;
}

function htmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr').forEach((node) => {
    node.append('\n');
  });
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
    if (!codeBuffer.length) return;
    blocks.push({ kind: 'code', text: codeBuffer.join('\n') });
    codeBuffer = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }
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

  const walk = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent || '').trim();
    if (!text) return;
    if (tag === 'h1') blocks.push({ kind: 'h1', text });
    else if (tag === 'h2') blocks.push({ kind: 'h2', text });
    else if (tag === 'h3') blocks.push({ kind: 'h3', text });
    else if (tag === 'li') blocks.push({ kind: 'bullet', text });
    else if (tag === 'blockquote') blocks.push({ kind: 'quote', text });
    else if (tag === 'pre' || tag === 'code') blocks.push({ kind: 'code', text });
    else if (tag === 'p' || tag === 'div') blocks.push({ kind: 'paragraph', text });
  };

  doc.body.querySelectorAll('h1,h2,h3,p,div,li,blockquote,pre').forEach(walk);
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

  for (const block of blocks) {
    let fontSize = 11;
    let style: 'normal' | 'bold' | 'italic' = 'normal';
    let indent = 0;
    let prefix = '';
    let spacing = 5.2;

    if (block.kind === 'h1') { fontSize = 18; style = 'bold'; spacing = 7; }
    if (block.kind === 'h2') { fontSize = 15; style = 'bold'; spacing = 6.5; }
    if (block.kind === 'h3') { fontSize = 13; style = 'bold'; spacing = 6; }
    if (block.kind === 'bullet') { prefix = '• '; indent = 4; }
    if (block.kind === 'number') { prefix = '– '; indent = 4; }
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
  const paragraphs: any[] = [
    new docx.Paragraph({
      text: title,
      heading: docx.HeadingLevel.TITLE,
      spacing: { after: 240 },
    }),
  ];

  blocks.forEach((block) => {
    if (block.kind === 'h1') {
      paragraphs.push(new docx.Paragraph({ text: block.text, heading: docx.HeadingLevel.HEADING_1 }));
      return;
    }
    if (block.kind === 'h2') {
      paragraphs.push(new docx.Paragraph({ text: block.text, heading: docx.HeadingLevel.HEADING_2 }));
      return;
    }
    if (block.kind === 'h3') {
      paragraphs.push(new docx.Paragraph({ text: block.text, heading: docx.HeadingLevel.HEADING_3 }));
      return;
    }
    if (block.kind === 'bullet' || block.kind === 'number') {
      paragraphs.push(new docx.Paragraph({ text: block.text, bullet: { level: 0 } }));
      return;
    }
    if (block.kind === 'quote') {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: block.text, italics: true, color: '475569' })],
        indent: { left: 420 },
      }));
      return;
    }
    if (block.kind === 'code') {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: block.text, font: 'Courier New', size: 18 })],
        shading: { fill: 'F8FAFC' },
      }));
      return;
    }
    paragraphs.push(new docx.Paragraph({ text: block.text, spacing: { after: 120 } }));
  });

  const document = new docx.Document({ sections: [{ children: paragraphs }] });
  return docx.Packer.toBlob(document);
}

async function loadImage(file: File) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to HTMLImageElement for codecs handled outside createImageBitmap.
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('O navegador não conseguiu decodificar esta imagem.'));
    };
    image.src = url;
  });
}

async function imageToCanvas(file: File, options: ConversionOptions) {
  const image = await loadImage(file);
  const sourceWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const sourceHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;
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
  const mime = MIME_BY_FORMAT[format];
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

  const blob = await new Promise<Blob>((resolve, reject) => {
    renderCanvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Falha ao codificar ${format.toUpperCase()}.`)), mime, quality);
  });

  if (format === 'avif' && blob.type !== 'image/avif') {
    throw new Error('Este navegador consegue abrir AVIF, mas não oferece codificação AVIF via Canvas. Use WebP/PNG ou um navegador mais recente.');
  }
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
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, width, height, undefined, 'FAST');
  return pdf.output('blob');
}

async function readPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = (workerModule as any).default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

async function extractPdfText(file: File) {
  const pdf = await readPdf(file);
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(text);
  }
  return pages;
}

async function pdfToImageArchive(file: File, target: 'png' | 'jpg' | 'webp', options: ConversionOptions): Promise<ConversionResult> {
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
    return {
      blob: pageBlobs[0],
      fileName: `${base}.${target}`,
      mimeType: MIME_BY_FORMAT[target],
      warnings: [],
    };
  }

  const JSZipModule = await import('jszip');
  const JSZip = (JSZipModule as any).default || JSZipModule;
  const zip = new JSZip();
  pageBlobs.forEach((blob, index) => zip.file(`${base}_pagina_${String(index + 1).padStart(2, '0')}.${target}`, blob));
  const archive = await zip.generateAsync({ type: 'blob' });
  return {
    blob: archive,
    fileName: `${base}_${target}_paginas.zip`,
    mimeType: 'application/zip',
    warnings: [`O PDF tinha ${pageBlobs.length} páginas; elas foram entregues em um ZIP.`],
  };
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
  const text = await file.text();
  const workbook = XLSX.read(text, { type: 'string' });
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([array], { type: MIME_BY_FORMAT.xlsx });
}

function rowsToText(rows: any[][]) {
  return rows.map((row) => row.map((value) => String(value ?? '')).join('\t')).join('\n');
}

export async function convertFile(file: File, target: ConvertibleFormat, options: ConversionOptions = {}): Promise<ConversionResult> {
  const extension = getFileExtension(file);
  const supported = getSupportedOutputs(file);
  if (!supported.includes(target)) {
    throw new Error(`Conversão de .${extension || 'desconhecido'} para .${target} não é suportada neste dispositivo.`);
  }

  const base = cleanBaseName(file.name);
  const warnings: string[] = [];
  const quality = Math.min(1, Math.max(0.1, options.quality ?? 0.9));

  if (IMAGE_FORMATS.has(extension)) {
    if (target === 'pdf') {
      return { blob: await imageToPdf(file, options), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    }
    const canvas = await imageToCanvas(file, options);
    const blob = await canvasToBlob(canvas, target as 'png' | 'jpg' | 'webp' | 'avif', quality);
    return { blob, fileName: `${base}.${target}`, mimeType: MIME_BY_FORMAT[target], warnings };
  }

  if (extension === 'pdf') {
    if (target === 'png' || target === 'jpg' || target === 'webp') {
      return pdfToImageArchive(file, target, options);
    }
    const pages = await extractPdfText(file);
    const text = pages.map((page, index) => `# Página ${index + 1}\n\n${page}`).join('\n\n---\n\n');
    if (target === 'txt') {
      return { blob: new Blob([pages.join('\n\n--- Página seguinte ---\n\n')], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    }
    if (target === 'html') {
      const html = textToHtml(text, base);
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    if (target === 'docx') {
      warnings.push('PDF → DOCX preserva o conteúdo textual e a separação por páginas, mas não reconstrói com precisão absoluta o layout vetorial do PDF original.');
      return { blob: await blocksToDocx(textToBlocks(text), base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
    }
  }

  if (extension === 'docx') {
    const converted = await docxToHtml(file);
    warnings.push(...converted.warnings);
    if (target === 'html') {
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(base)}</title></head><body>${converted.html}</body></html>`;
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    const plainText = htmlToPlainText(converted.html);
    if (target === 'txt') {
      return { blob: new Blob([plainText], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    }
    if (target === 'pdf') {
      warnings.push('DOCX → PDF preserva a hierarquia textual principal; recursos avançados do Word, como caixas flutuantes e alguns elementos complexos, podem ser simplificados.');
      return { blob: await blocksToPdf(htmlToBlocks(converted.html), base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    }
  }

  if (extension === 'html' || extension === 'htm') {
    const html = await file.text();
    if (target === 'txt') {
      return { blob: new Blob([htmlToPlainText(html)], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    }
    if (target === 'pdf') {
      return { blob: await blocksToPdf(htmlToBlocks(html), base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    }
    if (target === 'docx') {
      return { blob: await blocksToDocx(htmlToBlocks(html), base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
    }
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const data = await spreadsheetToData(file);
    if (target === 'csv') {
      return { blob: new Blob(['\ufeff', data.csv], { type: MIME_BY_FORMAT.csv }), fileName: `${base}.csv`, mimeType: MIME_BY_FORMAT.csv, warnings };
    }
    if (target === 'html') {
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(base)}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}</style></head><body><h1>${escapeHtml(base)}</h1>${data.html}</body></html>`;
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    const text = rowsToText(data.rows);
    if (target === 'txt') {
      return { blob: new Blob([text], { type: MIME_BY_FORMAT.txt }), fileName: `${base}.txt`, mimeType: MIME_BY_FORMAT.txt, warnings };
    }
    if (target === 'pdf') {
      warnings.push('Planilha → PDF usa uma representação textual/tabular da primeira aba para evitar cortes silenciosos.');
      return { blob: await blocksToPdf([{ kind: 'code', text }], base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    }
  }

  if (extension === 'csv' && target === 'xlsx') {
    return { blob: await csvToXlsx(file), fileName: `${base}.xlsx`, mimeType: MIME_BY_FORMAT.xlsx, warnings };
  }

  if (TEXT_FORMATS.has(extension)) {
    const text = await file.text();
    if (target === 'html') {
      const html = textToHtml(text, base);
      return { blob: new Blob([html], { type: MIME_BY_FORMAT.html }), fileName: `${base}.html`, mimeType: MIME_BY_FORMAT.html, warnings };
    }
    if (target === 'pdf') {
      return { blob: await blocksToPdf(textToBlocks(text), base), fileName: `${base}.pdf`, mimeType: MIME_BY_FORMAT.pdf, warnings };
    }
    if (target === 'docx') {
      return { blob: await blocksToDocx(textToBlocks(text), base), fileName: `${base}.docx`, mimeType: MIME_BY_FORMAT.docx, warnings };
    }
  }

  throw new Error(`Não foi possível concluir a conversão de ${file.name} para ${target.toUpperCase()}.`);
}
