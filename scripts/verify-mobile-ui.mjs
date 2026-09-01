import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const [main, platform, overlaySafety, viewportAgent, windowScript, nativeWorkflow, ciWorkflow, installHub, localTools, fabMenu, experienceShell, orbitShell, orbitSystem, nexus, bottomNav, home] = await Promise.all([
  read('src/main.tsx'),
  read('src/platform.css'),
  read('src/orbidoc-overlay-safety.css'),
  read('src/components/NativeViewportAgent.tsx'),
  read('scripts/configure-native-android-window.mjs'),
  read('.github/workflows/android-native.yml'),
  read('.github/workflows/ci.yml'),
  read('src/components/BrowserGuideModal.tsx'),
  read('src/components/LocalUtilitiesLauncher.tsx'),
  read('src/components/FabMenuSheet.tsx'),
  read('src/components/OrbiDocExperienceShell.tsx'),
  read('src/components/orbit/OrbitAppShell.tsx'),
  read('src/orbit-system.css'),
  read('src/components/AiWorkspace.tsx'),
  read('src/components/BottomNavBar.tsx'),
  read('src/components/HomeDashboard.tsx'),
]);

const assertions = [
  [main.includes('NativeViewportAgent'), 'NativeViewportAgent não está montado no app.'],
  [main.includes('LocalUtilitiesLauncher'), 'Ferramentas locais gratuitas não estão montadas.'],
  [main.includes('OrbitAppShell'), 'OrbitAppShell V2 não envolve o produto.'],
  [main.includes("./orbit-system.css"), 'Design tokens Orbit V2 não são carregados.'],
  [!main.includes('<AiRuntimeStatus'), 'Telemetria interna do Nexus AI ainda está exposta como launcher global.'],
  [main.includes("./orbidoc-overlay-safety.css"), 'Regras globais de overlays fullscreen não são carregadas.'],

  [orbitShell.includes('data-orbit-shell="v2"'), 'OrbitAppShell não expõe sua versão estrutural.'],
  [orbitShell.includes('orbit-skip-link'), 'OrbitAppShell não oferece skip link.'],
  [orbitShell.includes('orbit-offline-banner'), 'OrbitAppShell não possui estado offline explícito.'],
  [orbitShell.includes('nenhuma chamada remota') || orbitShell.includes('tarefas remotas'), 'OrbitAppShell não comunica degradação remota offline.'],

  [orbitSystem.includes('--orbit-space-1'), 'Design System não centraliza spacing.'],
  [orbitSystem.includes('--orbit-radius-xl: 20px'), 'Design System não limita radius XL a 20px.'],
  [orbitSystem.includes('--orbit-z-sheet: 70'), 'Escala global de z-index não está definida.'],
  [orbitSystem.includes('--orbit-blue: #3157f6'), 'Orbit Blue não está centralizado no Design System.'],
  [orbitSystem.includes('@media (max-width: 599px)'), 'Design System não possui breakpoint mobile explícito.'],
  [orbitSystem.includes('@media (min-width: 600px) and (max-width: 1023px)'), 'Design System não possui breakpoint tablet explícito.'],
  [orbitSystem.includes('@media (min-width: 1024px)'), 'Design System não possui breakpoint desktop explícito.'],
  [orbitSystem.includes('@media (min-width: 1440px)'), 'Design System não possui breakpoint web-large explícito.'],
  [orbitSystem.includes('prefers-reduced-motion'), 'Design System não respeita reduced motion.'],

  [platform.includes('--orbidoc-visual-height'), 'CSS não usa a altura visual dinâmica.'],
  [platform.includes("data-orbidoc-keyboard='open'"), 'CSS não possui estado específico para teclado virtual.'],
  [platform.includes('safe-area-inset-top'), 'Safe area superior não está configurada.'],
  [platform.includes('safe-area-inset-bottom'), 'Safe area inferior não está configurada.'],
  [platform.includes('orbidoc-install-overlay'), 'Hub de instalação não recebeu safe areas próprias.'],
  [platform.includes('orbidoc-native-download-notice'), 'Avisos de download não respeitam hotbar/gesture area.'],
  [platform.includes('[class~="min-h-[560px]"]'), 'Piso legado de 560px não é neutralizado no mobile.'],
  [platform.includes('[class~="h-[calc(100dvh-7.5rem)]"]'), 'Workspace Nexus não está vinculado ao visualViewport no mobile.'],
  [platform.includes('orbidoc-fab-footer'), 'Criação rápida não reserva a barra de gesto inferior.'],
  [platform.includes('orbidoc-onboarding-footer'), 'Onboarding não reserva a barra de gesto inferior.'],
  [platform.includes('orbidoc-launch-screen'), 'Splash não recebeu safe areas do sistema.'],

  [overlaySafety.includes('.fixed.inset-0.flex.flex-col'), 'Workspaces fullscreen não seguem a altura visual real.'],
  [overlaySafety.includes('var(--orbidoc-visual-height'), 'Camada fullscreen não usa visualViewport.'],
  [overlaySafety.includes('> footer:last-child'), 'Rodapés fullscreen não reservam a barra de gestos.'],
  [overlaySafety.includes('orientation: landscape'), 'Workspaces fullscreen não têm proteção para paisagem baixa.'],
  [viewportAgent.includes('window.visualViewport'), 'visualViewport não está sendo observado.'],
  [viewportAgent.includes('scrollIntoView'), 'Campos focados não são revelados após abertura do teclado.'],
  [windowScript.includes('WindowCompat.enableEdgeToEdge'), 'Android não ativa edge-to-edge explicitamente.'],
  [windowScript.includes('SOFT_INPUT_ADJUST_RESIZE'), 'Android não usa adjustResize para o teclado.'],
  [nativeWorkflow.includes('configure-native-android-window.mjs'), 'Workflow release não aplica configuração de janela Android.'],
  [ciWorkflow.includes('configure-native-android-window.mjs'), 'CI APK não aplica configuração de janela Android.'],

  [installHub.includes('isOrbiDocNativeRuntime'), 'Hub de instalação não distingue APK nativo de PWA.'],
  [installHub.includes('orbidoc-keyboard-safe-panel'), 'Hub de instalação pode ultrapassar o viewport/teclado.'],
  [!installHub.includes('Gere o AAB com PWABuilder/Bubblewrap'), 'Hub ainda instrui PWABuilder/Bubblewrap como pacote Android principal.'],
  [localTools.includes('utf8ToBase64') && localTools.includes('base64ToUtf8'), 'Ferramentas locais não incluem Base64 UTF-8 offline.'],
  [localTools.includes('crypto.randomUUID()'), 'Ferramentas locais não incluem UUID offline.'],
  [localTools.includes('sha256File') && localTools.includes('file.arrayBuffer()'), 'Ferramentas locais não calculam SHA-256 de arquivo no dispositivo.'],

  [fabMenu.includes('Orbit Nova') && fabMenu.includes('Orbit Gravity') && fabMenu.includes('Orbit Aurora') && fabMenu.includes('Orbit Comet') && fabMenu.includes('Orbit Nebula'), 'Create Sheet não usa nomenclatura cósmica oficial.'],
  [fabMenu.includes('orbidoc-fab-footer'), 'Bottom sheet de criação rápida não identifica o footer seguro.'],
  [fabMenu.includes("document.body.style.overflow = 'hidden'"), 'Bottom sheet de criação rápida não bloqueia scroll do fundo.'],
  [fabMenu.includes('rounded-t-[20px]'), 'Create Sheet ainda usa radius excessivo fora do Design System.'],

  [nexus.includes('Virtuoso'), 'Nexus AI não virtualiza a conversa.'],
  [nexus.includes('orbit-context-strip'), 'Nexus AI não possui contextual toolbar compacta.'],
  [nexus.includes('orbit-feature-bar'), 'Nexus AI não usa Feature Bar compartilhada.'],
  [nexus.includes('Como posso ajudar?'), 'Estado vazio do Nexus AI não segue a referência.'],
  [nexus.includes('Resumir') && nexus.includes('Analisar') && nexus.includes('Pesquisar') && nexus.includes('Programar'), 'Nexus AI não expõe chips compactos de ação.'],
  [nexus.includes('Pergunte ao Nexus AI'), 'Composer do Nexus AI não está identificado.'],
  [nexus.includes('Orbit está offline') && nexus.includes('nenhuma chamada remota foi simulada'), 'Nexus AI não falha honestamente quando offline.'],
  [nexus.includes('Abrir no Orbit Nova'), 'Nexus AI não oferece continuidade contextual para documentos.'],
  [!/<select|<optgroup/.test(nexus), 'Nexus AI voltou a expor seletor de provider/modelo.'],

  [bottomNav.includes("label: 'Início'") && bottomNav.includes("label: 'Arquivos'") && bottomNav.includes("label: 'Criar'") && bottomNav.includes("label: 'Assistente'") && bottomNav.includes("label: 'Apps'"), 'Bottom navigation não segue a arquitetura mobile oficial.'],
  [bottomNav.includes('orbidoc-bottom-nav'), 'Bottom navigation não possui hook estável para safe-area/IME.'],
  [home.includes('Orbit Nova') && home.includes('Orbit Gravity') && home.includes('Orbit Aurora') && home.includes('Orbit Comet') && home.includes('Orbit Nebula'), 'Orbispace Home não usa nomenclatura oficial dos módulos.'],
  [!home.includes('text-3xl font-black') && !home.includes('rounded-[28px]'), 'Orbispace Home ainda conserva hero/card excessivo da interface antiga.'],

  [experienceShell.includes('isOrbiDocNativeRuntime'), 'Splash/onboarding não reconhecem runtime Android nativo.'],
  [experienceShell.includes('orbidoc-keyboard-safe-panel'), 'Onboarding não usa painel limitado ao viewport visível.'],
  [experienceShell.includes('orbidoc-onboarding-footer'), 'Onboarding não identifica o footer protegido por safe area.'],
  [experienceShell.includes('overflow-y-auto overscroll-contain'), 'Conteúdo do onboarding não é rolável em telas baixas/paisagem.'],
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`Auditoria mobile falhou:\n- ${failures.join('\n- ')}`);
console.log('Orbit UI audit OK: V2 shell, design tokens, Nexus tool layout, safe areas, keyboard/IME, bottom navigation, create sheet and offline honesty are wired.');
