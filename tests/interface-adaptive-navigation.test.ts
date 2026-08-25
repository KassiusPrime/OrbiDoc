import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => fs.readFile(path, 'utf8');

test('window-size classes drive adaptive navigation instead of device identity', async () => {
  const [profile, bottomNav, adaptive] = await Promise.all([
    read('src/lib/platformProfile.ts'),
    read('src/components/BottomNavBar.tsx'),
    read('src/orbidoc-adaptive-shell.css'),
  ]);

  assert.match(profile, /OrbiDocWindowClass = 'compact' \| 'medium' \| 'expanded'/);
  assert.match(profile, /width < 600/);
  assert.match(profile, /width < 1024/);
  assert.match(profile, /orbidocWindowClass/);
  assert.match(profile, /orbidoc-window-\$\{windowClass\}/);
  assert.match(bottomNav, /orbidoc-bottom-nav/);
  assert.doesNotMatch(bottomNav, /-top-3/);
  assert.match(bottomNav, /min-h-\[54px\]/);
  assert.match(adaptive, /min-width: 600px/);
  assert.match(adaptive, /max-width: 1023px/);
  assert.match(adaptive, /--orbidoc-rail-width/);
  assert.match(adaptive, /grid-template-columns: 1fr/);
});

test('short landscape windows do not inherit the legacy 560px application floor', async () => {
  const adaptive = await read('src/orbidoc-adaptive-shell.css');
  assert.match(adaptive, /orbidoc-window-compact \.orbidoc-app-root > div/);
  assert.match(adaptive, /orbidoc-window-medium \.orbidoc-app-root > div/);
  assert.match(adaptive, /min-height: 0 !important/);
  assert.match(adaptive, /--orbidoc-visual-height/);
});

test('global utilities are consolidated instead of stacking floating launchers', async () => {
  const [main, adaptive, hub, fab] = await Promise.all([
    read('src/main.tsx'),
    read('src/orbidoc-adaptive-shell.css'),
    read('src/components/GlobalToolsHub.tsx'),
    read('src/components/FabMenuSheet.tsx'),
  ]);

  assert.match(main, /GlobalToolsHub/);
  assert.match(main, /orbidoc-adaptive-shell\.css/);
  for (const label of [
    'Abrir ferramentas de mídia e qualidade',
    'Abrir histórico de versões',
    'Abrir Scan e Reader',
    'Abrir redimensionador de imagens',
  ]) assert.ok(adaptive.includes(`button[aria-label='${label}']`), `launcher ainda não consolidado: ${label}`);

  assert.match(hub, /Central de Ferramentas/);
  assert.match(hub, /Ctrl\/Cmd\+K/);
  assert.match(hub, /orbidoc:open-image-resizer/);
  assert.match(hub, /orbidoc:open-local-tools/);
  assert.match(hub, /orbidoc:open-advanced-tools/);
  assert.match(fab, /Redimensionar/);
  assert.match(fab, /Laboratório offline/);
});

test('keyboard shortcuts and focus remain safe inside editors', async () => {
  const [viewport, adaptive] = await Promise.all([
    read('src/components/NativeViewportAgent.tsx'),
    read('src/orbidoc-adaptive-shell.css'),
  ]);

  assert.match(viewport, /new Set\(\['m', 'o', 'h', 'k', 'r'\]\)/);
  assert.match(viewport, /stopImmediatePropagation/);
  assert.match(viewport, /scrollIntoView/);
  assert.match(adaptive, /:focus-visible/);
  assert.match(adaptive, /outline: 2px solid/);
  assert.match(adaptive, /scroll-margin-block/);
});

test('medium rail handles keyboard and modal state without hidden interaction', async () => {
  const adaptive = await read('src/orbidoc-adaptive-shell.css');
  assert.match(adaptive, /orbidoc-window-medium\[data-orbidoc-keyboard='open'\]\[data-orbidoc-modal='closed'\] \.orbidoc-bottom-nav/);
  assert.match(adaptive, /orbidoc-window-medium\[data-orbidoc-modal='open'\] \.orbidoc-bottom-nav/);
  assert.match(adaptive, /translateX\(-120%\)/);
  assert.match(adaptive, /pointer-events: none !important/);
  assert.match(adaptive, /pointer-events: auto !important/);
});
