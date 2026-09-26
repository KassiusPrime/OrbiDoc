import JSZip, { type JSZipObject } from 'jszip';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';

export type ReaderKind = 'pdf' | 'image' | 'html' | 'text' | 'markdown' | 'epub' | 'zip' | 'docx' | 'spreadsheet' | 'presentation' | 'unsupported';

export interface ReaderArchiveEntry {
  path: string;
  name: string;
  directory: boolean;
  kind: 'text' | 'image' | 'binary';
}

export interface ReaderDocument {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  kind: ReaderKind;
  size: number;
  title: string;
  text?: string;
  html?: string;
  objectUrl?: string;
  archive?: JSZip;
  archiveEntries?: ReaderArchiveEntry[];
  sourceFile?: File;
}

export const READER_ACCEPT = [
  '.pdf', '.epub', '.zip', '.html', '.htm', '.txt', '.log', '.md', '.markdown', '.json', '.jsonc', '.xml', '.csv', '.tsv',
  '.css', '.scss', '.sass', '.less', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.yaml', '.yml', '.toml', '.ini', '.sql', '.py', '.java', '.kt', '.go', '.rs', '.sh',
  '.docx', '.xlsx', '.xls', '.ods', '.pptx', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.svg',
].join(',');

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const baseName = (name: string) => name.replace(/\.[^/.]+$/, '') || name;
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export function sanitizeReaderHtml(source: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'text/html');
  document.querySelectorAll('script, iframe, object, embed, form, input, button, textarea, select, meta[http-equiv]').forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on')) element.removeAttribute(attribute.name);
      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) element.removeAttribute(attribute.name);
    });
  });
  return document.body.innerHTML;
}

export function markdownToReaderHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let inCode = false;
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  for (const raw of lines) {
    if (/^```/.test(raw.trim())) {
      closeList();
      if (!inCode) output.push('<pre><code>'); else output.push('</code></pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { output.push(`${escapeHtml(raw)}\n`); continue; }
    const line = raw.trim();
    if (!line) { closeList(); output.push('<p><br></p>'); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { closeList(); const level = heading[1].length; output.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`); continue; }
    if (/^[-*+]\s+/.test(line)) {
      if (list !== 'ul') { closeList(); list = 'ul'; output.push('<ul>'); }
      output.push(`<li>${escapeHtml(line.replace(/^[-*+]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      if (list !== 'ol') { closeList(); list = 'ol'; output.push('<ol>'); }
      output.push(`<li>${escapeHtml(line.replace(/^\d+[.)]\s+/, ''))}</li>`);
      continue;
    }
    if (/^>\s+/.test(line)) { closeList(); output.push(`<blockquote>${escapeHtml(line.replace(/^>\s+/, ''))}</blockquote>`); continue; }
    closeList();
    output.push(`<p>${escapeHtml(raw)}</p>`);
  }
  closeList();
  if (inCode) output.push('</code></pre>');
  return output.join('');
}

const textExtensions = new Set([
  'txt', 'log', 'json', 'jsonc', 'xml', 'csv', 'tsv', 'css', 'scss', 'sass', 'less', 'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx',
  'yaml', 'yml', 'toml', 'ini', 'sql', 'py', 'java', 'kt', 'kts', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cs', 'sh', 'bash', 'zsh', 'ps1',
]);
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'svg']);
const archiveTextExtensions = new Set([...textExtensions, 'md', 'markdown', 'html', 'htm', 'svg']);

const archiveEntryKind = (entry: JSZipObject): ReaderArchiveEntry['kind'] => {
  const extension = extensionOf(entry.name);
  if (archiveTextExtensions.has(extension)) return 'text';
  if (imageExtensions.has(extension)) return 'image';
  return 'binary';
};

const parseXml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');
const elementsByLocalName = (root: Document | Element, name: string) => Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === name);
const dirname = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
const normalizePath = (path: string) => {
  const parts: string[] = [];
  path.split('/').forEach((part) => { if (!part || part === '.') return; if (part === '..') parts.pop(); else parts.push(part); });
  return parts.join('/');
};

async function dataUrlForZipFile(entry: JSZipObject, mediaType = 'application/octet-stream') {
  const base64 = await entry.async('base64');
  return `data:${mediaType};base64,${base64}`;
}

async function resolveEpubAssets(zip: JSZip, html: string, chapterPath: string, manifestTypes: Map<string, string>) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const base = dirname(chapterPath);
  for (const node of Array.from(document.querySelectorAll('[src]'))) {
    const src = node.getAttribute('src');
    if (!src || /^(data:|https?:|blob:|#)/i.test(src)) continue;
    const clean = src.split('#')[0].split('?')[0];
    const resolved = normalizePath(`${base}${clean}`);
    const entry = zip.file(resolved);
    if (!entry) continue;
    const mediaType = manifestTypes.get(resolved) || (resolved.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
    if (mediaType.startsWith('image/') || mediaType.startsWith('font/')) node.setAttribute('src', await dataUrlForZipFile(entry, mediaType));
  }
  for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) link.remove();
  return sanitizeReaderHtml(document.body.innerHTML);
}

async function readEpub(file: File): Promise<ReaderDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('EPUB inválido: META-INF/container.xml não encontrado.');
  const containerXml = parseXml(await container.async('string'));
  const rootfile = elementsByLocalName(containerXml, 'rootfile')[0];
  const packagePath = rootfile?.getAttribute('full-path');
  if (!packagePath) throw new Error('EPUB inválido: pacote OPF não encontrado.');
  const packageEntry = zip.file(packagePath);
  if (!packageEntry) throw new Error('EPUB inválido: arquivo OPF ausente.');
  const packageXml = parseXml(await packageEntry.async('string'));
  const packageDir = dirname(packagePath);
  const manifest = new Map<string, { href: string; mediaType: string }>();
  const manifestTypes = new Map<string, string>();
  elementsByLocalName(packageXml, 'item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') || 'application/octet-stream';
    if (id && href) {
      const fullPath = normalizePath(`${packageDir}${href.split('#')[0]}`);
      manifest.set(id, { href: fullPath, mediaType });
      manifestTypes.set(fullPath, mediaType);
    }
  });
  const spineIds = elementsByLocalName(packageXml, 'itemref').map((item) => item.getAttribute('idref')).filter(Boolean) as string[];
  const titleNode = elementsByLocalName(packageXml, 'title')[0];
  const title = titleNode?.textContent?.trim() || baseName(file.name);
  const chapters: string[] = [];
  const plain: string[] = [];
  for (let index = 0; index < spineIds.length; index += 1) {
    const item = manifest.get(spineIds[index]);
    if (!item) continue;
    const entry = zip.file(item.href);
    if (!entry) continue;
    const raw = await entry.async('string');
    const html = await resolveEpubAssets(zip, raw, item.href, manifestTypes);
    const chapterDocument = new DOMParser().parseFromString(html, 'text/html');
    plain.push(chapterDocument.body.textContent?.replace(/\s+/g, ' ').trim() || '');
    chapters.push(`<article class="orbidoc-epub-chapter" data-chapter="${index + 1}"><div class="orbidoc-epub-chapter-label">Capítulo ${index + 1}</div>${html}</article>`);
  }
  return { id: crypto.randomUUID(), name: file.name, extension: 'epub', mimeType: file.type || 'application/epub+zip', kind: 'epub', size: file.size, title, html: chapters.join(''), text: plain.filter(Boolean).join('\n\n'), archive: zip, sourceFile: file };
}

async function readZip(file: File): Promise<ReaderDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).map((entry) => ({ path: entry.name, name: entry.name.split('/').filter(Boolean).pop() || entry.name, directory: entry.dir, kind: archiveEntryKind(entry) })).sort((a, b) => Number(a.directory) - Number(b.directory) || a.path.localeCompare(b.path));
  return { id: crypto.randomUUID(), name: file.name, extension: 'zip', mimeType: file.type || 'application/zip', kind: 'zip', size: file.size, title: baseName(file.name), archive: zip, archiveEntries: entries, sourceFile: file };
}

async function readPptx(file: File): Promise<ReaderDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0));
  if (!slidePaths.length) throw new Error('PPTX inválido: nenhum slide foi encontrado.');
  const html: string[] = [];
  const plain: string[] = [];
  for (let index = 0; index < slidePaths.length; index += 1) {
    const entry = zip.file(slidePaths[index]);
    if (!entry) continue;
    const xml = parseXml(await entry.async('string'));
    const texts = elementsByLocalName(xml, 't').map((node) => node.textContent?.trim() || '').filter(Boolean);
    const slideText = texts.join(' ');
    plain.push(`Slide ${index + 1}\n${slideText}`);
    html.push(`<section class="orbidoc-pptx-slide"><div class="orbidoc-epub-chapter-label">Slide ${index + 1}</div><div>${texts.length ? texts.map((text) => `<p>${escapeHtml(text)}</p>`).join('') : '<p><em>Slide sem texto extraível.</em></p>'}</div></section>`);
  }
  return { id: crypto.randomUUID(), name: file.name, extension: 'pptx', mimeType: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'presentation', size: file.size, title: baseName(file.name), html: html.join(''), text: plain.join('\n\n'), archive: zip, sourceFile: file };
}

export async function readArchiveEntry(document: ReaderDocument, path: string): Promise<{ kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string }> {
  const entry = document.archive?.file(path);
  if (!entry) throw new Error('Item não encontrado no ZIP.');
  const kind = archiveEntryKind(entry);
  const extension = extensionOf(path);
  if (kind === 'text') {
    const text = await entry.async('string');
    if (extension === 'html' || extension === 'htm') return { kind, text: new DOMParser().parseFromString(text, 'text/html').body.textContent || '', html: sanitizeReaderHtml(text) };
    if (extension === 'md' || extension === 'markdown') return { kind, text, html: markdownToReaderHtml(text) };
    if (extension === 'svg') return { kind: 'image', dataUrl: await dataUrlForZipFile(entry, 'image/svg+xml') };
    return { kind, text };
  }
  if (kind === 'image') {
    const mime = extension === 'svg' ? 'image/svg+xml' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return { kind, dataUrl: await dataUrlForZipFile(entry, mime) };
  }
  return { kind: 'binary' };
}

export async function readDocumentFile(file: File): Promise<ReaderDocument> {
  if (file.size > 120 * 1024 * 1024) throw new Error('O leitor local aceita arquivos de até 120 MB nesta versão.');
  const extension = extensionOf(file.name);
  const common = { id: crypto.randomUUID(), name: file.name, extension, mimeType: file.type || 'application/octet-stream', size: file.size, title: baseName(file.name), sourceFile: file };
  if (extension === 'epub') return readEpub(file);
  if (extension === 'zip') return readZip(file);
  if (extension === 'pptx') return readPptx(file);
  if (extension === 'pdf') return { ...common, kind: 'pdf', objectUrl: URL.createObjectURL(file) };
  if (imageExtensions.has(extension)) return { ...common, kind: 'image', objectUrl: URL.createObjectURL(file) };
  if (extension === 'html' || extension === 'htm') {
    const source = await file.text();
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    return { ...common, kind: 'html', html: sanitizeReaderHtml(source), text: parsed.body.textContent || '' };
  }
  if (extension === 'md' || extension === 'markdown') {
    const text = await file.text();
    return { ...common, kind: 'markdown', text, html: markdownToReaderHtml(text) };
  }
  if (textExtensions.has(extension)) return { ...common, kind: 'text', text: await file.text() };
  if (extension === 'docx') {
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const html = sanitizeReaderHtml(result.value);
    return { ...common, kind: 'docx', html, text: new DOMParser().parseFromString(html, 'text/html').body.textContent || '' };
  }
  if (extension === 'xlsx' || extension === 'xls' || extension === 'ods') {
    const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
    const html = workbook.SheetNames.map((name) => `<section class="orbidoc-sheet"><h2>${escapeHtml(name)}</h2>${xlsx.utils.sheet_to_html(workbook.Sheets[name])}</section>`).join('');
    const text = workbook.SheetNames.map((name) => `--- ${name} ---\n${xlsx.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n\n');
    return { ...common, kind: 'spreadsheet', html: sanitizeReaderHtml(html), text };
  }
  return { ...common, kind: 'unsupported' };
}

export function releaseReaderDocument(document?: ReaderDocument | null) {
  if (document?.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(document.objectUrl);
}
