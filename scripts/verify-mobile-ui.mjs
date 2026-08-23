import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const [main, platform, viewportAgent, windowScript, nativeWorkflow, ciWorkflow, installHub, nativeAi, localTools] = await Promise.all([
  read('src/main.tsx'),
  read('src/platform.css'),
  read('src/components/NativeViewportAgent.tsx'),
  read('scripts/configure-native-android-window.mjs'),
  read('.github/workflows/android-native.yml'),
  read('.github/workflows/ci.yml'),
  read('src/components/BrowserGuideModal.tsx'),
  read('src/components/NativeAiSettingsLauncher.tsx'),
  read('src/components/LocalUtilitiesLauncher.tsx'),
]);

const assertions = [
  [main.includes('NativeViewportAgent'), 'NativeViewportAgent não está montado no app.'],
  [main.includes('LocalUtilitiesLauncher'), 'Ferramentas locais gratuitas não estão montadas.'],
  [platform.includes('--orbidoc-visual-height'), 'CSS não usa a altura visual dinâmica.'],
  [platform.includes("data-orbidoc-keyboard='open'"), 'CSS não possui estado específico para teclado virtual.'],
  [platform.includes('safe-area-inset-top'), 'Safe area superior não está configurada.'],
  [platform.includes('safe-area-inset-bottom'), 'Safe area inferior não está configurada.'],
  [platform.includes('orbidoc-install-overlay'), 'Hub de instalação não recebeu safe areas próprias.'],
  [platform.includes('orbidoc-native-ai-overlay'), 'Configurações nativas de IA não receberam safe areas próprias.'],
  [platform.includes('orbidoc-native-download-notice'), 'Avisos de download não respeitam hotbar/gesture area.'],
  [viewportAgent.includes('window.visualViewport'), 'visualViewport não está sendo observado.'],
  [viewportAgent.includes('scrollIntoView'), 'Campos focados não são revelados após abertura do teclado.'],
  [windowScript.includes('WindowCompat.enableEdgeToEdge'), 'Android não ativa edge-to-edge explicitamente.'],
  [windowScript.includes('SOFT_INPUT_ADJUST_RESIZE'), 'Android não usa adjustResize para o teclado.'],
  [nativeWorkflow.includes('configure-native-android-window.mjs'), 'Workflow release não aplica configuração de janela Android.'],
  [ciWorkflow.includes('configure-native-android-window.mjs'), 'CI APK não aplica configuração de janela Android.'],
  [installHub.includes('isOrbiDocNativeRuntime'), 'Hub de instalação não distingue APK nativo de PWA.'],
  [installHub.includes('orbidoc-keyboard-safe-panel'), 'Hub de instalação pode ultrapassar o viewport/teclado.'],
  [!installHub.includes('Gere o AAB com PWABuilder/Bubblewrap'), 'Hub ainda instrui PWABuilder/Bubblewrap como pacote Android principal.'],
  [!installHub.includes('Play Store / TWA'), 'Hub ainda apresenta TWA como caminho principal da Play Store.'],
  [nativeAi.includes('orbidoc-keyboard-safe-panel'), 'Modal de chave de IA não está protegido contra teclado.'],
  [nativeAi.includes("document.body.style.overflow = 'hidden'"), 'Modal de IA não bloqueia o scroll do fundo.'],
  [nativeAi.includes('autoCapitalize="off"') && nativeAi.includes('spellCheck={false}'), 'Campo de API key pode sofrer autocorreção/capitalização.'],
  [localTools.includes('utf8ToBase64') && localTools.includes('base64ToUtf8'), 'Ferramentas locais não incluem Base64 UTF-8 offline.'],
  [localTools.includes('crypto.randomUUID()'), 'Ferramentas locais não incluem UUID offline.'],
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`Auditoria mobile falhou:\n- ${failures.join('\n- ')}`);
console.log('Mobile UI audit OK: safe areas, keyboard viewport, native install/AI panels and free local tools are wired.');
