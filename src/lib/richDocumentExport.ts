type ExportWarning = { message: string };

export interface RichDocxResult {
  blob: Blob;
  warnings: ExportWarning[];
}

const colorFromStyle = (value?: string | null) => {
  if (!value) return undefined;
  const hex = value.match(/#([0-9a-f]{6})/i)?.[1];
  if (hex) return hex.toUpperCase();
  const rgb = value.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return undefined;
  return [rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('').toUpperCase();
};

const pixelsToHalfPoints = (value?: string | null) => {
  if (!value) return undefined;
  const px = Number.parseFloat(value);
  if (!Number.isFinite(px)) return undefined;
  return Math.max(12, Math.round(px * 1.5));
};

const safeText = (value: string) => value.replace(/\u00a0/g, ' ');

export async function exportRichHtmlToDocx(html: string, title: string): Promise<RichDocxResult> {
  const docx = await import('docx');
  const source = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const warnings: ExportWarning[] = [];
  const children: any[] = [];

  const runChildren = (node: Node, inherited: Record<string, any> = {}): any[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = safeText(node.textContent || '');
      return text ? [new docx.TextRun({ text, ...inherited })] : [];
    }
    if (!(node instanceof HTMLElement)) return [];

    const tag = node.tagName.toLowerCase();
    const style = getComputedStyle(node);
    const next = { ...inherited };

    if (tag === 'strong' || tag === 'b' || Number(style.fontWeight) >= 600 || style.fontWeight === 'bold') next.bold = true;
    if (tag === 'em' || tag === 'i' || style.fontStyle === 'italic') next.italics = true;
    if (tag === 'u' || style.textDecorationLine.includes('underline')) next.underline = { type: docx.UnderlineType.SINGLE };
    if (tag === 's' || tag === 'strike' || style.textDecorationLine.includes('line-through')) next.strike = true;
    const color = colorFromStyle(style.color);
    if (color) next.color = color;
    const size = pixelsToHalfPoints(style.fontSize);
    if (size) next.size = size;
    const font = style.fontFamily?.split(',')[0]?.replace(/["']/g, '').trim();
    if (font) next.font = font;
    const background = colorFromStyle(style.backgroundColor);
    if (background && background !== '000000' && background !== 'FFFFFF') next.highlight = 'yellow';

    if (tag === 'br') return [new docx.TextRun({ text: '', break: 1, ...inherited })];
    if (tag === 'a') {
      const href = node.getAttribute('href');
      const linkRuns = Array.from(node.childNodes).flatMap((child) => runChildren(child, { ...next, color: next.color || '2563EB', underline: { type: docx.UnderlineType.SINGLE } }));
      if (href) return [new docx.ExternalHyperlink({ link: href, children: linkRuns.length ? linkRuns : [new docx.TextRun({ text: node.textContent || href, color: '2563EB', underline: { type: docx.UnderlineType.SINGLE } })] })];
      return linkRuns;
    }

    return Array.from(node.childNodes).flatMap((child) => runChildren(child, next));
  };

  const paragraphAlignment = (element: HTMLElement) => {
    const align = (element.style.textAlign || getComputedStyle(element).textAlign).toLowerCase();
    if (align === 'center') return docx.AlignmentType.CENTER;
    if (align === 'right') return docx.AlignmentType.RIGHT;
    if (align === 'justify') return docx.AlignmentType.JUSTIFIED;
    return docx.AlignmentType.LEFT;
  };

  const makeParagraph = (element: HTMLElement, options: Record<string, any> = {}) => {
    const runs = Array.from(element.childNodes).flatMap((node) => runChildren(node));
    return new docx.Paragraph({
      children: runs.length ? runs : [new docx.TextRun('')],
      alignment: paragraphAlignment(element),
      spacing: { after: 120, line: 276 },
      ...options,
    });
  };

  const tableFromElement = (table: HTMLTableElement) => {
    const rows = Array.from(table.rows).map((row) => new docx.TableRow({
      children: Array.from(row.cells).map((cell) => {
        const blocks = Array.from(cell.childNodes)
          .filter((node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent || '').trim())
          .map((node) => node instanceof HTMLElement && ['p', 'div'].includes(node.tagName.toLowerCase())
            ? makeParagraph(node)
            : new docx.Paragraph({ children: runChildren(node), spacing: { after: 60 } }));
        return new docx.TableCell({
          children: blocks.length ? blocks : [new docx.Paragraph('')],
          shading: cell.tagName.toLowerCase() === 'th' || row.rowIndex === 0 ? { fill: 'F1F5F9' } : undefined,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
        });
      }),
    }));
    return new docx.Table({
      rows,
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top: { style: docx.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
        bottom: { style: docx.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
        left: { style: docx.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
        right: { style: docx.BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
        insideHorizontal: { style: docx.BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        insideVertical: { style: docx.BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      },
    });
  };

  const walkBlock = (element: HTMLElement, listContext?: { ordered: boolean; index: number }) => {
    const tag = element.tagName.toLowerCase();
    if (tag === 'table') {
      children.push(tableFromElement(element as HTMLTableElement));
      children.push(new docx.Paragraph(''));
      return;
    }
    if (tag === 'img' || tag === 'figure') {
      warnings.push({ message: 'Imagens incorporadas permanecem no editor/HTML/PDF, mas o exportador DOCX atual preserva primeiro texto, tabelas e estilos. Imagens no DOCX podem ser simplificadas.' });
      const caption = element.tagName.toLowerCase() === 'figure' ? element.querySelector('figcaption')?.textContent : element.getAttribute('alt');
      if (caption) children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: `[Imagem: ${caption}]`, italics: true, color: '64748B' })] }));
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li').forEach((item, index) => walkBlock(item as HTMLElement, { ordered, index: index + 1 }));
      return;
    }
    if (tag === 'li') {
      if (listContext?.ordered) {
        const runs = [new docx.TextRun({ text: `${listContext.index}. `, bold: true }), ...Array.from(element.childNodes).filter((node) => !(node instanceof HTMLElement && ['ul', 'ol'].includes(node.tagName.toLowerCase()))).flatMap((node) => runChildren(node))];
        children.push(new docx.Paragraph({ children: runs, indent: { left: 360 }, spacing: { after: 80 } }));
      } else {
        children.push(new docx.Paragraph({ children: Array.from(element.childNodes).filter((node) => !(node instanceof HTMLElement && ['ul', 'ol'].includes(node.tagName.toLowerCase()))).flatMap((node) => runChildren(node)), bullet: { level: 0 }, spacing: { after: 80 } }));
      }
      Array.from(element.children).filter((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase())).forEach((nested) => walkBlock(nested as HTMLElement));
      return;
    }

    const heading = tag === 'h1' ? docx.HeadingLevel.HEADING_1
      : tag === 'h2' ? docx.HeadingLevel.HEADING_2
        : tag === 'h3' ? docx.HeadingLevel.HEADING_3
          : undefined;
    if (heading) {
      children.push(makeParagraph(element, { heading, spacing: { before: 180, after: 100 } }));
      return;
    }
    if (tag === 'blockquote') {
      children.push(makeParagraph(element, { indent: { left: 480 }, border: { left: { style: docx.BorderStyle.SINGLE, size: 12, color: '6366F1', space: 8 } }, shading: { fill: 'F8FAFC' } }));
      return;
    }
    if (tag === 'pre') {
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: element.textContent || '', font: 'Courier New', size: 18 })], shading: { fill: 'F8FAFC' }, spacing: { before: 120, after: 120 } }));
      return;
    }
    if (['p', 'div', 'section', 'article'].includes(tag)) {
      children.push(makeParagraph(element));
      return;
    }

    if ((element.textContent || '').trim()) children.push(makeParagraph(element));
  };

  Array.from(source.body.children).forEach((element) => walkBlock(element as HTMLElement));
  if (!children.length) children.push(new docx.Paragraph(''));

  const document = new docx.Document({
    creator: 'OrbiDoc',
    title,
    description: 'Documento exportado pelo OrbiDoc',
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  return {
    blob: await docx.Packer.toBlob(document),
    warnings: Array.from(new Map(warnings.map((warning) => [warning.message, warning])).values()),
  };
}
