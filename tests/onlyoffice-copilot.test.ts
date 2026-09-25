import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('office workspaces route through ONLYOFFICE', () => {
  const app = read('src/AppV5.tsx');
  assert.match(app, /OnlyOfficeEditor/);
  assert.match(app, /kind="word"/);
  assert.match(app, /kind="excel"/);
  assert.match(app, /kind="powerpoint"/);
  assert.match(app, /view === 'canva'/);
  assert.match(app, /currentProject\('canva'\)[\s\S]*OnlyOfficeEditor/);
  assert.doesNotMatch(app, /<DocumentEditor /);
  assert.doesNotMatch(app, /<SpreadsheetEditor /);
  assert.doesNotMatch(app, /<PresentationEditor /);
});

test('ONLYOFFICE config endpoint fails closed without server bridge settings', () => {
  const route = read('api/onlyoffice/config.ts');
  assert.match(route, /ONLYOFFICE_NOT_CONFIGURED/);
  assert.match(route, /ONLYOFFICE_JWT_SECRET/);
  assert.match(route, /FIREBASE_AUTH_REQUIRED/);
  assert.match(route, /encryptBridgeToken/);
});

test('Nexus exposes Copilot-inspired navigation and contextual rail', () => {
  const shell = read('src/components/CopilotShell.tsx');
  const ai = read('src/components/AiWorkspace.tsx');
  assert.match(shell, /Novo chat/);
  assert.match(shell, /Contexto/);
  assert.doesNotMatch(shell, /hidden md:flex shrink-0 flex-col border-r/);
  assert.match(ai, /orbidoc:nexus-new-chat/);
});


test('Orbit workspace speed dial keeps one blue action FAB and hides it from Nexus AI', () => {
    const source = read('src/AppV5.tsx');
    const dial = read('src/components/orbit/OrbitSpeedDial.tsx');
    expect(source).toContain('OrbitSpeedDial');
    expect(source).toContain("hidden={view === 'chat' || view === 'ai' || view === 'compare'}");
    expect(dial).toContain('aria-haspopup="menu"');
    expect(dial).toContain('aria-expanded={open}');
    expect(dial).toContain('prefers-reduced-motion');
    expect(dial).toContain('active:scale-95');
});
