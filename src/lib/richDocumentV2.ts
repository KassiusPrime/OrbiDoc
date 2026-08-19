const ALLOWED_TAGS = new Set([
  'H1','H2','H3','H4','H5','H6','P','DIV','BR','HR','STRONG','B','EM','I','U','S','STRIKE','BLOCKQUOTE','PRE','CODE',
  'UL','OL','LI','A','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','FIGURE','FIGCAPTION','IMG','SPAN','SUB','SUP',
]);

const safeUrl = (value: string, image = false) => {
  const trimmed = value.trim();
  if (image && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') return trimmed;
  } catch { /* invalid */ }
  return '';
};

export function sanitizeRichHtml(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,textarea,select,meta,link,svg,math').forEach((node) => node.remove());
  for (const element of Array.from(doc.body.querySelectorAll('*'))) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (element.tagName === 'A' && name === 'href') {
        const value = safeUrl(attribute.value);
        if (value) {
          element.setAttribute('href', value);
          element.setAttribute('rel', 'noopener noreferrer');
        } else element.removeAttribute('href');
        continue;
      }
      if (element.tagName === 'IMG' && name === 'src') {
        const value = safeUrl(attribute.value, true);
        if (value) element.setAttribute('src', value);
        else element.remove();
        continue;
      }
      if (name === 'style') {
        const safeDeclarations = attribute.value
          .split(';')
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => /^(text-align|color|background-color|font-weight|font-style|text-decoration|font-family|font-size|max-width|width|height)\s*:/i.test(item) && !/url\s*\(|expression\s*\(|javascript:/i.test(item));
        if (safeDeclarations.length) element.setAttribute('style', safeDeclarations.join(';'));
        else element.removeAttribute('style');
        continue;
      }
      const common = new Set(['class', 'title', 'colspan', 'rowspan', 'alt']);
      if (!common.has(name) && !(element.tagName === 'A' && ['rel','target'].includes(name))) element.removeAttribute(attribute.name);
    }
  }
  return doc.body.innerHTML;
}

export function richHtmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeRichHtml(html), 'text/html');
  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,figcaption').forEach((node) => node.append('\n'));
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

const parseCssColor = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return hex[1].toUpperCase();
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
};

export async function richHtmlToDocxBlob(html: string, title: string): Promise<Blob> {
  const docx = await import('docx');
  const document = new DOMParser().parseFromString(sanitizeRichHtml(html), 'text/html');
  const numberingReference = 'docswiss-numbering';

  const textRuns = (node: Node, inherited: Record<string, any> = {}): any[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return text ? [new docx.TextRun({ text, ...inherited })] : [];
    }
    if (!(node instanceof Element)) return [];
    const style = node.getAttribute('style') || '';
    const next: Record<string, any> = { ...inherited };
    if (['STRONG','B'].includes(node.tagName) || /font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) next.bold = true;
    if (['EM','I'].includes(node.tagName) || /font-style\s*:\s*italic/i.test(style)) next.italics = true;
    if (node.tagName === 'U' || /text-decoration[^;]*underline/i.test(style)) next.underline = { type: docx.UnderlineType.SINGLE };
    if (['S','STRIKE'].includes(node.tagName) || /text-decoration[^;]*line-through/i.test(style)) next.strike = true;
    const color = parseCssColor(style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1] || null);
    if (color) next.color = color;
    const font = style.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.replace(/["']/g, '').split(',')[0]?.trim();
    if (font) next.font = font;
    const sizePx = Number(style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1]);
    if (Number.isFinite(sizePx) && sizePx > 0) next.size = Math.round(sizePx * 1.5);
    if (node.tagName === 'BR') return [new docx.TextRun({ break: 1 })];
    if (node.tagName === 'A' && node.getAttribute('href')) {
      const children = Array.from(node.childNodes).flatMap((child) => textRuns(child, { ...next, color: next.color || '2563EB', underline: { type: docx.UnderlineType.SINGLE } }));
      return [new docx.ExternalHyperlink({ link: node.getAttribute('href')!, children })];
    }
    return Array.from(node.childNodes).flatMap((child) => textRuns(child, next));
  };

  const paragraphFrom = (element: Element, options: Record<string, any> = {}) => {
    const style = element.getAttribute('style') || '';
    const alignmentValue = style.match(/text-align\s*:\s*(left|center|right|justify)/i)?.[1]?.toLowerCase();
    const alignment = alignmentValue === 'center' ? docx.AlignmentType.CENTER
      : alignmentValue === 'right' ? docx.AlignmentType.RIGHT
        : alignmentValue === 'justify' ? docx.AlignmentType.JUSTIFIED
          : undefined;
    return new docx.Paragraph({ children: textRuns(element), alignment, spacing: { after: 120 }, ...options });
  };

  const children: any[] = [];
  const walkBlock = (element: Element, listType?: 'bullet' | 'number', level = 0) => {
    if (/^H[1-6]$/.test(element.tagName)) {
      const heading = ({
        H1: docx.HeadingLevel.HEADING_1,
        H2: docx.HeadingLevel.HEADING_2,
        H3: docx.HeadingLevel.HEADING_3,
        H4: docx.HeadingLevel.HEADING_4,
        H5: docx.HeadingLevel.HEADING_5,
        H6: docx.HeadingLevel.HEADING_6,
      } as Record<string, any>)[element.tagName];
      children.push(paragraphFrom(element, { heading }));
      return;
    }
    if (element.tagName === 'UL' || element.tagName === 'OL') {
      Array.from(element.children).filter((child) => child.tagName === 'LI').forEach((child) => walkBlock(child, element.tagName === 'OL' ? 'number' : 'bullet', level));
      return;
    }
    if (element.tagName === 'LI') {
      const opts = listType === 'number'
        ? { numbering: { reference: numberingReference, level: Math.min(level, 2) } }
        : { bullet: { level: Math.min(level, 2) } };
      children.push(paragraphFrom(element, opts));
      Array.from(element.children).filter((child) => child.tagName === 'UL' || child.tagName === 'OL').forEach((child) => walkBlock(child, undefined, level + 1));
      return;
    }
    if (element.tagName === 'BLOCKQUOTE') {
      children.push(paragraphFrom(element, { indent: { left: 420 }, border: { left: { color: '6366F1', style: docx.BorderStyle.SINGLE, size: 16, space: 10 } } }));
      return;
    }
    if (element.tagName === 'PRE') {
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: element.textContent || '', font: 'Courier New', size: 18 })], shading: { fill: 'F8FAFC' }, spacing: { after: 140 } }));
      return;
    }
    if (element.tagName === 'TABLE') {
      const rows = Array.from(element.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr')).map((row) => new docx.TableRow({
        children: Array.from(row.children)
          .filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH')
          .map((cell) => new docx.TableCell({
            children: [paragraphFrom(cell)],
            columnSpan: Math.max(1, Number(cell.getAttribute('colspan')) || 1),
            rowSpan: Math.max(1, Number(cell.getAttribute('rowspan')) || 1),
          })),
      }));
      if (rows.length) children.push(new docx.Table({ rows, width: { size: 100, type: docx.WidthType.PERCENTAGE } }));
      return;
    }
    if (element.tagName === 'FIGURE') {
      const img = element.querySelector(':scope > img');
      const src = img?.getAttribute('src') || '';
      if (src.startsWith('data:image/')) {
        try {
          const base64 = src.split(',')[1] || '';
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          const type = src.includes('jpeg') || src.includes('jpg') ? 'jpg' : src.includes('gif') ? 'gif' : 'png';
          children.push(new docx.Paragraph({
            children: [new docx.ImageRun({ data: bytes, transformation: { width: 520, height: 320 }, type: type as any })],
            alignment: docx.AlignmentType.CENTER,
          }));
        } catch { /* preserve caption if image conversion fails */ }
      }
      const caption = element.querySelector(':scope > figcaption');
      if (caption) children.push(paragraphFrom(caption, { alignment: docx.AlignmentType.CENTER }));
      return;
    }
    if (element.tagName === 'HR') {
      children.push(new docx.Paragraph({ border: { bottom: { color: 'CBD5E1', style: docx.BorderStyle.SINGLE, size: 8, space: 1 } } }));
      return;
    }
    if (['P','DIV','FIGCAPTION'].includes(element.tagName)) {
      children.push(paragraphFrom(element));
      return;
    }
    if (element.tagName === 'IMG') return;
    Array.from(element.children).forEach((child) => walkBlock(child));
  };

  Array.from(document.body.children).forEach((element) => walkBlock(element));
  if (!children.length) children.push(new docx.Paragraph({ text: richHtmlToText(html) }));

  const doc = new docx.Document({
    title,
    creator: 'DocSwiss',
    numbering: {
      config: [{
        reference: numberingReference,
        levels: [0, 1, 2].map((level) => ({
          level,
          format: docx.LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: docx.AlignmentType.START,
          style: { paragraph: { indent: { left: 720 + level * 360, hanging: 260 } } },
        })),
      }],
    },
    sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children }],
  });
  return docx.Packer.toBlob(doc);
}
