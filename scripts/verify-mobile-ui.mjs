import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const [main, platform, viewportAgent, windowScript, nativeWorkflow, ciWorkflow] = await Promise.all([
  read('src/main.tsx'),
  read('src/platform.css'),
  read('src/components/NativeViewportAgent.tsx'),
  read('scripts/configure-native-android-window.mjs'),
  read('.github/workflows/android-native.yml'),
  read('.github/workflows/ci.yml'),
]);

const assertions = [
  [main.includes('NativeViewportAgent'), 'NativeViewportAgent não está montado no app.'],
  [main.includes('LocalUtilitiesLauncher'), 'Ferramentas locais gratuitas não estão montadas.'],
  [platform.includes('--orbidoc-visual-height'), 'CSS não usa a altura visual dinâmica.'],
  [platform.includes("data-orbidoc-keyboard='open'"), 'CSS não possui estado específico para teclado virtual.'],
  [platform.includes('safe-area-inset-top'), 'Safe area superior não está configurada.'],
  [platform.includes('safe-area-inset-bottom'), 'Safe area inferior não está configurada.'],
  [viewportAgent.includes('window.visualViewport'), 'visualViewport não está sendo observado.'],
  [viewportAgent.includes('scrollIntoView'), 'Campos focados não são revelados após abertura do teclado.'],
  [windowScript.includes('WindowCompat.enableEdgeToEdge'), 'Android não ativa edge-to-edge explicitamente.'],
  [windowScript.includes('SOFT_INPUT_ADJUST_RESIZE'), 'Android não usa adjustResize para o teclado.'],
  [nativeWorkflow.includes('configure-native-android-window.mjs'), 'Workflow release não aplica configuração de janela Android.'],
  [ciWorkflow.includes('configure-native-android-window.mjs'), 'CI APK não aplica configuração de janela Android.'],
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`Auditoria mobile falhou:\n- ${failures.join('\n- ')}`);
console.log('Mobile UI audit OK: safe areas, keyboard viewport, edge-to-edge and local tools are wired.');
