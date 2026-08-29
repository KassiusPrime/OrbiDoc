import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => fs.readFile(path, 'utf8');

test('OrbiDoc uses a service-host shell instead of a toolbox dashboard', async () => {
  const [main, app, settings] = await Promise.all([
    read('src/main.tsx'),
    read('src/AppV6.tsx'),
    read('src/components/SettingsWorkspace.tsx'),
  ]);

  assert.match(main, /App from '\.\/AppV6'/);
  assert.doesNotMatch(main, /GoogleProfileBadge/);
  assert.doesNotMatch(main, /GlobalToolsHub/);
  assert.match(app, /Início/);
  assert.match(app, /Arquivos/);
  assert.match(app, /Serviços/);
  assert.match(app, /Recentes/);
  assert.match(app, /Abrir configurações/);
  assert.doesNotMatch(app, /setTheme\(\(current\)/, 'tema não deve ser alternado por botão do cabeçalho');
  assert.match(settings, /Aparência/);
  assert.match(settings, /Conta/);
  assert.match(settings, /Conexões/);
  assert.match(settings, /Armazenamento e privacidade/);
});

test('connected services share one file browser and can open files internally', async () => {
  const [browser, access, opener] = await Promise.all([
    read('src/components/ServiceBrowserWorkspace.tsx'),
    read('src/services/connectedFileAccess.ts'),
    read('src/components/SystemFileOpenAgent.tsx'),
  ]);

  assert.match(browser, /Google Drive/);
  assert.match(browser, /OneDrive/);
  assert.match(browser, /GitHub/);
  assert.match(browser, /openFileInsideOrbiDoc/);
  assert.match(access, /@microsoft\.graph\.downloadUrl/);
  assert.match(access, /application\/vnd\.google-apps\.document/);
  assert.match(access, /application\/vnd\.google-apps\.spreadsheet/);
  assert.match(access, /application\/vnd\.google-apps\.presentation/);
  assert.match(opener, /ORBIDOC_OPEN_FILE_EVENT/);
  assert.match(opener, /google-drive/);
  assert.match(opener, /onedrive/);
  assert.match(opener, /github/);
});

test('GitHub public browsing never asks the browser to persist a PAT', async () => {
  const [github, settings] = await Promise.all([
    read('src/services/githubFiles.ts'),
    read('src/components/SettingsWorkspace.tsx'),
  ]);

  assert.match(github, /api\.github\.com/);
  assert.match(github, /application\/vnd\.github\.raw\+json/);
  assert.doesNotMatch(github, /localStorage/);
  assert.doesNotMatch(github, /sessionStorage/);
  assert.doesNotMatch(github, /personal[_ -]?access[_ -]?token/i);
  assert.match(settings, /GitHub App/);
  assert.match(settings, /PAT pessoal/);
});

test('appearance and external account authorization live in Settings', async () => {
  const settings = await read('src/components/SettingsWorkspace.tsx');
  assert.match(settings, /ThemePreference = 'system' \| 'light' \| 'dark'/);
  assert.match(settings, /onThemeChange\('system'\)/);
  assert.match(settings, /OrbiDocAuthPanel/);
  assert.match(settings, /loginWithGooglePopup/);
  assert.match(settings, /loginWithMicrosoftPopup/);
  assert.match(settings, /Conta OrbiDoc continua separada/);
});
