import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => fs.readFile(path, 'utf8');

test('native creator exports are routed through the existing Android MediaStore bridge', async () => {
  const [main, agent, bridge] = await Promise.all([
    read('src/main.tsx'),
    read('src/components/NativeFileSaveAgent.tsx'),
    read('src/lib/nativeAndroidBridge.ts'),
  ]);

  assert.match(main, /NativeFileSaveAgent/);
  assert.match(agent, /saveNativeBlob/);
  assert.match(agent, /a\[download\]/);
  assert.match(agent, /startsWith\('blob:'\)/);
  assert.match(agent, /startsWith\('data:'\)/);
  assert.match(agent, /document\.addEventListener\('click', handleDownload, true\)/);
  assert.match(agent, /browserFallback/);
  assert.match(bridge, /saveBase64File/);
  assert.match(bridge, /orbidoc:native-download/);
});

test('all four creators opt into the same scoped adaptive UI system', async () => {
  const files = [
    ['src/components/DocumentEditor.tsx', 'word'],
    ['src/components/SpreadsheetEditor.tsx', 'excel'],
    ['src/components/PresentationEditor.tsx', 'powerpoint'],
    ['src/components/DesignEditor.tsx', 'canva'],
  ] as const;

  for (const [path, kind] of files) {
    const source = await read(path);
    assert.match(source, /orbidoc-creator-shell/, `${path} não usa o shell comum`);
    assert.ok(source.includes(`data-orbidoc-creator="${kind}"`), `${path} não identifica o criador ${kind}`);
  }
});

test('creator menus and touch targets work without hover-only input', async () => {
  const [main, css, powerBar] = await Promise.all([
    read('src/main.tsx'),
    read('src/orbidoc-creator-ui.css'),
    read('src/components/StudioPowerBar.tsx'),
  ]);

  assert.match(main, /orbidoc-creator-ui\.css/);
  assert.match(css, /\.group:focus-within > \.hidden/);
  assert.match(css, /@media \(max-width: 599px\)/);
  assert.match(css, /min-height: 44px/);
  assert.doesNotMatch(css, /\.orbidoc-creator-shell input[^\{]*\{[^}]*min-height: 44px/s, 'inputs de célula não devem ser inflados globalmente');
  assert.match(powerBar, /Downloads\/OrbiDoc/);
  assert.match(powerBar, /Android MediaStore/);
});

test('existing professional creator capabilities stay mounted after the UI consolidation', async () => {
  const [document, spreadsheet, presentation, design] = await Promise.all([
    read('src/components/DocumentEditor.tsx'),
    read('src/components/SpreadsheetEditor.tsx'),
    read('src/components/PresentationEditor.tsx'),
    read('src/components/DesignEditor.tsx'),
  ]);

  assert.match(document, /DocumentFindReplaceBar/);
  assert.match(document, /DocumentProPanel/);
  assert.match(spreadsheet, /SpreadsheetProPanel/);
  assert.match(spreadsheet, /recalculateWorkbookFormulas/);
  assert.match(presentation, /PresentationProPanel/);
  assert.match(design, /DesignProPanel/);
  assert.match(design, /DesignAdvancedPanel/);
});
