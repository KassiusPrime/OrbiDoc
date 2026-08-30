import JSZip, { type JSZipObject } from 'jszip';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';

export type ReaderKind = 'pdf' | 'image' | 'media' | 'font' | 'html' | 'text' | 'markdown' | 'structured' | 'hex' | 'epub' | 'zip' | 'docx' | 'spreadsheet' | 'unsupported';

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
  mediaType?: 'audio' | 'video';
  archive?: JSZip;
  archiveEntries?: ReaderArchiveEntry[];
}

const CODE_EXTENSIONS = [
  'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'cs', 'kt', 'kts', 'go', 'rs', 'swift',
  'sql', 'sh', 'bash', 'zsh', 'ps1', 'php', 'rb', 'dart', 'lua', 'scala', 'gradle', 'vue', 'svelte', 'proto', 'graphql', 'gql', 'cmake', 'cmd', 'bat',
  'diff', 'patch', 'ini', 'cfg', 'conf', 'properties', 'env', 'yaml', 'yml', 'toml', 'plist', 'log',
];
const TEXT_EXTENSIONS = ['txt', 'json', 'xml', 'csv', 'tsv', ...CODE_EXTENSIONS];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'svg'];
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus', 'amr', 'mka'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', '3gp', 'flv'];
const FONT_EXTENSIONS = ['ttf', 'otf', 'ttc', 'otc', 'woff'];
const STRUCTURED_EXTENSIONS = ['ics', 'vcs', 'vcf', 'eml'];
const ZIP_PACKAGE_EXTENSIONS = ['zip', 'jar', 'apk', 'cbz', 'xpi', 'whl', 'vsix', 'nupkg', 'ipa', 'aar', 'appx', 'oxt'];
const OFFICE_ZIP_TEXT_EXTENSIONS = ['pptx', 'pptm', 'ppsx', 'potx', 'odt', 'odp', 'ott', 'otp', 'xps', 'oxps'];

export const READER_ACCEPT = [
  '.pdf', '.epub', ...ZIP_PACKAGE_EXTENSIONS.map((value) => `.${value}`), '.html', '.htm', '.xhtml', '.md', '.markdown',
  ...TEXT_EXTENSIONS.map((value) => `.${value}`), '.docx', '.xlsx', '.xls', ...OFFICE_ZIP_TEXT_EXTENSIONS.map((value) => `.${value}`),
  ...IMAGE_EXTENSIONS.map((value) => `.${value}`), ...AUDIO_EXTENSIONS.map((value) => `.${value}`), ...VIDEO_EXTENSIONS.map((value) => `.${value}`),
  ...FONT_EXTENSIONS.map((value) => `.${value}`), ...STRUCTURED_EXTENSIONS.map((value) => `.${value}`),
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

const textExtensions = new Set(TEXT_EXTENSIONS);
const imageExtensions = new Set(IMAGE_EXTENSIONS);
const audioExtensions = new Set(AUDIO_EXTENSIONS);
const videoExtensions = new Set(VIDEO_EXTENSIONS);
const fontExtensions = new Set(FONT_EXTENSIONS);
const structuredExtensions = new Set(STRUCTURED_EXTENSIONS);
const zipPackageExtensions = new Set(ZIP_PACKAGE_EXTENSIONS);
const officeZipTextExtensions = new Set(OFFICE_ZIP_TEXT_EXTENSIONS);
const archiveTextExtensions = new Set(['txt', 'md', 'markdown', 'html', 'htm', 'xhtml', ...TEXT_EXTENSIONS, 'svg']);

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
  return { id: crypto.randomUUID(), name: file.name, extension: 'epub', mimeType: file.type || 'application/epub+zip', kind: 'epub', size: file.size, title, html: chapters.join(''), text: plain.filter(Boolean).join('\n\n'), archive: zip };
}

async function readZip(file: File): Promise<ReaderDocument> {
  const extension = extensionOf(file.name);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).map((entry) => ({ path: entry.name, name: entry.name.split('/').filter(Boolean).pop() || entry.name, directory: entry.dir, kind: archiveEntryKind(entry) })).sort((a, b) => Number(a.directory) - Number(b.directory) || a.path.localeCompare(b.path));
  return { id: crypto.randomUUID(), name: file.name, extension, mimeType: file.type || 'application/zip', kind: 'zip', size: file.size, title: baseName(file.name), archive: zip, archiveEntries: entries };
}

async function readOfficeZipText(file: File, common: Omit<ReaderDocument, 'kind'>): Promise<ReaderDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const extension = common.extension;
  let paths: string[] = [];
  if (extension.startsWith('ppt') || extension === 'ppsx' || extension === 'potx') paths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path));
  else if (extension === 'xps' || extension === 'oxps') paths = Object.keys(zip.files).filter((path) => /documents\/\d+\/pages\/\d+\.fpage$/i.test(path));
  else paths = ['content.xml'].filter((path) => Boolean(zip.file(path)));
  paths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sections: string[] = [];
  const plain: string[] = [];
  for (let index = 0; index < paths.length; index += 1) {
    const entry = zip.file(paths[index]);
    if (!entry) continue;
    const xml = parseXml(await entry.async('string'));
    const text = (xml.documentElement?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const label = extension.startsWith('ppt') || extension === 'ppsx' || extension === 'potx' ? `Slide ${index + 1}` : `Parte ${index + 1}`;
    plain.push(`${label}\n${text}`);
    sections.push(`<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(text)}</p></section>`);
  }
  if (!sections.length) throw new Error(`O arquivo ${extension.toUpperCase()} foi reconhecido, mas esta versão não encontrou conteúdo textual legível para a prévia.`);
  return { ...common, kind: 'structured', html: sections.join(''), text: plain.join('\n\n') };
}

export async function readArchiveEntry(document: ReaderDocument, path: string): Promise<{ kind: 'text' | 'image' | 'binary'; text?: string; html?: string; dataUrl?: string }> {
  const entry = document.archive?.file(path);
  if (!entry) throw new Error('Item não encontrado no arquivo compactado.');
  const kind = archiveEntryKind(entry);
  const extension = extensionOf(path);
  if (kind === 'text') {
    const text = await entry.async('string');
    if (extension === 'html' || extension === 'htm' || extension === 'xhtml') return { kind, text: new DOMParser().parseFromString(text, 'text/html').body.textContent || '', html: sanitizeReaderHtml(text) };
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

function jsonTree(value: unknown, depth = 0): string {
  if (depth > 10) return '<span>…</span>';
  if (value === null) return '<span class="orbidoc-json-null">null</span>';
  if (typeof value !== 'object') return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
  return `<div class="orbidoc-json-tree">${entries.map(([key, child]) => `<details open><summary><strong>${escapeHtml(key)}</strong></summary><div>${jsonTree(child, depth + 1)}</div></details>`).join('')}</div>`;
}

function structuredPreview(extension: string, text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (extension === 'eml') {
    const divider = lines.findIndex((line) => !line.trim());
    const headerLines = divider >= 0 ? lines.slice(0, divider) : lines;
    const body = divider >= 0 ? lines.slice(divider + 1).join('\n') : '';
    const fields = ['From', 'To', 'Cc', 'Subject', 'Date'].map((name) => {
      const line = headerLines.find((candidate) => candidate.toLowerCase().startsWith(`${name.toLowerCase()}:`));
      return line ? `<div><strong>${name}</strong><span>${escapeHtml(line.slice(name.length + 1).trim())}</span></div>` : '';
    }).join('');
    return `<article class="orbidoc-structured-card"><div class="orbidoc-structured-fields">${fields}</div><pre>${escapeHtml(body)}</pre></article>`;
  }
  const wanted = extension === 'vcf' ? ['FN', 'ORG', 'TITLE', 'TEL', 'EMAIL', 'ADR', 'URL', 'BDAY'] : ['SUMMARY', 'DTSTART', 'DTEND', 'LOCATION', 'DESCRIPTION', 'ORGANIZER', 'ATTENDEE'];
  const fields = lines.map((line) => {
    const split = line.indexOf(':');
    if (split <= 0) return null;
    const rawKey = line.slice(0, split).split(';')[0].toUpperCase();
    if (!wanted.includes(rawKey)) return null;
    return [rawKey, line.slice(split + 1).trim()] as const;
  }).filter(Boolean) as Array<readonly [string, string]>;
  return `<article class="orbidoc-structured-card"><div class="orbidoc-structured-fields">${fields.map(([key, value]) => `<div><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join('')}</div><details><summary>Texto original</summary><pre>${escapeHtml(text)}</pre></details></article>`;
}

function looksTextual(bytes: Uint8Array) {
  if (!bytes.length) return true;
  let printable = 0;
  let nul = 0;
  for (const byte of bytes) {
    if (byte === 0) nul += 1;
    if (byte === 9 || byte === 10 || byte === 13 || byte >= 32) printable += 1;
  }
  return nul === 0 && printable / bytes.length >= 0.88;
}

function hexDump(bytes: Uint8Array) {
  const rows: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const hex = Array.from(chunk).map((byte) => byte.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = Array.from(chunk).map((byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.').join('');
    rows.push(`${offset.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
  }
  return rows.join('\n');
}

async function unknownFallback(file: File, common: Omit<ReaderDocument, 'kind'>): Promise<ReaderDocument> {
  const sampleSize = Math.min(file.size, 1024 * 1024);
  const sample = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());
  if (looksTextual(sample)) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(sample);
    return { ...common, kind: 'text', text: file.size > sampleSize ? `${text}\n\n[Prévia limitada ao primeiro 1 MB de ${file.name}.]` : text };
  }
  const hexSample = sample.slice(0, 256 * 1024);
  const suffix = file.size > hexSample.length ? `\n\n[Prévia hexadecimal limitada aos primeiros ${hexSample.length.toLocaleString('pt-BR')} bytes.]` : '';
  return { ...common, kind: 'hex', text: `${hexDump(hexSample)}${suffix}` };
}

export async function readDocumentFile(file: File): Promise<ReaderDocument> {
  if (file.size > 120 * 1024 * 1024) throw new Error('O leitor local aceita arquivos de até 120 MB nesta versão.');
  const extension = extensionOf(file.name);
  const common = { id: crypto.randomUUID(), name: file.name, extension, mimeType: file.type || 'application/octet-stream', size: file.size, title: baseName(file.name) };
  if (extension === 'epub') return readEpub(file);
  if (zipPackageExtensions.has(extension)) return readZip(file);
  if (extension === 'pdf') return { ...common, kind: 'pdf', objectUrl: URL.createObjectURL(file) };
  if (imageExtensions.has(extension)) return { ...common, kind: 'image', objectUrl: URL.createObjectURL(file) };
  if (audioExtensions.has(extension) || file.type.startsWith('audio/')) return { ...common, kind: 'media', mediaType: 'audio', objectUrl: URL.createObjectURL(file) };
  if (videoExtensions.has(extension) || file.type.startsWith('video/')) return { ...common, kind: 'media', mediaType: 'video', objectUrl: URL.createObjectURL(file) };
  if (fontExtensions.has(extension) || file.type.startsWith('font/')) return { ...common, kind: 'font', objectUrl: URL.createObjectURL(file) };
  if (extension === 'html' || extension === 'htm' || extension === 'xhtml') {
    const source = await file.text();
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    return { ...common, kind: 'html', html: sanitizeReaderHtml(source), text: parsed.body.textContent || '' };
  }
  if (extension === 'md' || extension === 'markdown') {
    const text = await file.text();
    return { ...common, kind: 'markdown', text, html: markdownToReaderHtml(text) };
  }
  if (extension === 'json') {
    const text = await file.text();
    try {
      const value = JSON.parse(text);
      return { ...common, kind: 'structured', text, html: `<section><h2>Estrutura JSON</h2>${jsonTree(value)}<details><summary>Fonte</summary><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></details></section>` };
    } catch {
      return { ...common, kind: 'text', text };
    }
  }
  if (structuredExtensions.has(extension)) {
    const text = await file.text();
    return { ...common, kind: 'structured', text, html: structuredPreview(extension, text) };
  }
  if (textExtensions.has(extension)) return { ...common, kind: 'text', text: await file.text() };
  if (extension === 'docx') {
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const html = sanitizeReaderHtml(result.value);
    return { ...common, kind: 'docx', html, text: new DOMParser().parseFromString(html, 'text/html').body.textContent || '' };
  }
  if (extension === 'xlsx' || extension === 'xls') {
    const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
    const html = workbook.SheetNames.map((name) => `<section class="orbidoc-sheet"><h2>${escapeHtml(name)}</h2>${xlsx.utils.sheet_to_html(workbook.Sheets[name])}</section>`).join('');
    const text = workbook.SheetNames.map((name) => `--- ${name} ---\n${xlsx.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n\n');
    return { ...common, kind: 'spreadsheet', html: sanitizeReaderHtml(html), text };
  }
  if (officeZipTextExtensions.has(extension)) return readOfficeZipText(file, common);
  return unknownFallback(file, common);
}

export function releaseReaderDocument(document?: ReaderDocument | null) {
  if (document?.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(document.objectUrl);
}
