import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownToReaderHtml, READER_ACCEPT } from '../src/lib/documentReader';

test('universal reader advertises office, ebook, archive, code and image formats', () => {
  for (const extension of [
    '.pdf', '.epub', '.zip', '.html', '.txt', '.md', '.docx', '.xlsx', '.ods', '.pptx', '.jpg', '.svg', '.yaml', '.sql', '.py',
  ]) {
    assert.ok(READER_ACCEPT.includes(extension), extension);
  }
});

test('markdown reader creates headings, lists, quotes and code blocks', () => {
  const html = markdownToReaderHtml('# Título\n\n- item\n\n> nota\n\n```\nconst value = 1;\n```');
  assert.match(html, /<h1>Título<\/h1>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>item<\/li>/);
  assert.match(html, /<blockquote>nota<\/blockquote>/);
  assert.match(html, /<pre><code>/);
});

test('markdown reader escapes raw markup instead of executing it', () => {
  const html = markdownToReaderHtml('<script>alert(1)</script>');
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
