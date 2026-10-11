import assert from 'node:assert/strict';
import test from 'node:test';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import * as PptxGenModule from 'pptxgenjs';
import JSZip from 'jszip';
import mammoth from 'mammoth';

const PptxGen = ((PptxGenModule as unknown as { default?: { default?: unknown } }).default as { default?: unknown } | undefined)?.default ?? (PptxGenModule as unknown as { default?: unknown }).default ?? PptxGenModule;

const hasZipSignature = (value: Uint8Array) =>
  value.length > 4 && value[0] === 0x50 && value[1] === 0x4b;

test('DOCX fixture survives ZIP inspection and text extraction', async () => {
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Orbit compatibility fixture', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: 'Preserve bold emphasis.', bold: true })] }),
        new Paragraph({ text: 'Second paragraph for round-trip validation.' }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(document);
  assert.ok(hasZipSignature(buffer), 'DOCX must be an OOXML ZIP container');

  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file('word/document.xml'), 'DOCX must contain word/document.xml');
  assert.ok(zip.file('[Content_Types].xml'), 'DOCX must declare OOXML content types');

  const extracted = await mammoth.extractRawText({ buffer });
  assert.match(extracted.value, /Orbit compatibility fixture/);
  assert.match(extracted.value, /Preserve bold emphasis/);
  assert.match(extracted.value, /Second paragraph for round-trip validation/);
});

test('XLSX fixture round-trips cell values, formulas, and workbook metadata', async () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Item', 'Quantity', 'Total'],
    ['Papel', 3, { t: 'n', f: 'B2*5', v: 15 }],
    ['Caneta', 2, { t: 'n', f: 'B3*2', v: 4 }],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orçamento');
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  assert.ok(hasZipSignature(bytes), 'XLSX must be an OOXML ZIP container');

  const zip = await JSZip.loadAsync(bytes);
  assert.ok(zip.file('xl/workbook.xml'), 'XLSX must contain xl/workbook.xml');
  assert.ok(zip.file('xl/worksheets/sheet1.xml'), 'XLSX must contain its first worksheet');

  const reopened = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
  const reopenedSheet = reopened.Sheets['Orçamento'];
  assert.ok(reopenedSheet);
  assert.equal(reopenedSheet.A2.v, 'Papel');
  assert.equal(reopenedSheet.B2.v, 3);
  assert.equal(reopenedSheet.C2.f, 'B2*5');
  assert.equal(reopenedSheet.C2.v, 15);
  assert.equal(reopened.SheetNames[0], 'Orçamento');
});

test('PPTX fixture contains presentation, slide, and relationship parts', async () => {
  const presentation = new (PptxGen as new () => InstanceType<typeof import('pptxgenjs').default>)();
  presentation.layout = 'LAYOUT_WIDE';
  presentation.author = 'Orbit test suite';
  presentation.subject = 'Office format compatibility';
  const slide = presentation.addSlide();
  slide.addText('Orbit compatibility fixture', { x: 0.6, y: 0.5, w: 8, h: 0.6, bold: true, fontSize: 24 });
  slide.addText('OOXML structure check', { x: 0.6, y: 1.3, w: 8, h: 0.4, fontSize: 16 });
  const output = await presentation.write({ outputType: 'nodebuffer' }) as Buffer;
  assert.ok(hasZipSignature(output), 'PPTX must be an OOXML ZIP container');

  const zip = await JSZip.loadAsync(output);
  assert.ok(zip.file('ppt/presentation.xml'), 'PPTX must contain ppt/presentation.xml');
  assert.ok(zip.file('ppt/slides/slide1.xml'), 'PPTX must contain its first slide');
  assert.ok(zip.file('ppt/_rels/presentation.xml.rels'), 'PPTX must contain presentation relationships');

  const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(slideXml, /Orbit compatibility fixture/);
  assert.match(slideXml, /OOXML structure check/);
});
