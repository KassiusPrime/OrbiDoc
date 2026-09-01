import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const warnings = [];
const root = process.cwd();

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`${file} ausente.`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

let config = null;
try {
  config = JSON.parse(read('capacitor.config.json'));
} catch {
  failures.push('capacitor.config.json inválido.');
}

if (config) {
  if (config.appId !== 'app.orbidoc.workspace') failures.push(`Capacitor appId inesperado: ${config.appId}.`);
  if (config.appName !== 'Orbit') failures.push(`Capacitor appName precisa ser Orbit (atual: ${config.appName}).`);
  if (config.webDir !== 'dist') failures.push(`Capacitor webDir precisa ser dist (atual: ${config.webDir}).`);
  if (config.server?.url) failures.push('capacitor.config.json contém server.url; o núcleo nativo não deve depender de uma URL remota para abrir.');
}

const main = read('src/main.tsx');
if (!main.includes('applyOrbiDocNativeRuntimeProfile')) failures.push('main.tsx não inicializa o perfil nativo.');
if (!main.includes('installNativeFileOpenBridge')) failures.push('main.tsx não inicializa abertura de arquivos do Android.');
if (!main.includes('installAiInternetAgent')) failures.push('main.tsx não monta a detecção central de consultas atuais/web.');
if (!/if \(!nativeRuntime\)[\s\S]*registerSW/.test(main)) failures.push('main.tsx não protege o service worker contra execução no shell nativo.');

const nativeRuntime = read('src/lib/nativeRuntime.ts');
if (!nativeRuntime.includes('isNativePlatform')) failures.push('nativeRuntime.ts não detecta Capacitor nativo.');

const aiInternet = read('src/lib/aiInternet.ts');
for (const token of ['shouldUseAiInternet', 'ORBIT_NEXUS_WEB', 'webSearch: true']) {
  if (!aiInternet.includes(token)) failures.push(`aiInternet.ts não contém ${token}.`);
}

const androidBridge = read('src/lib/nativeAndroidBridge.ts');
for (const token of ['installNativeAiApiBridge(): false', 'saveNativeBlob', 'downloadNativeUrl', 'consumeOpenFile']) {
  if (!androidBridge.includes(token)) failures.push(`nativeAndroidBridge.ts não contém ${token}.`);
}
if (/gemini|groq|setAiKey|listAiModels/i.test(androidBridge)) failures.push('nativeAndroidBridge.ts ainda contém roteamento/provedores de IA próprios do Android.');

const nexus = read('api/_lib/nexusAI.ts');
for (const token of ['createOpenRouter', 'openrouter/free', 'PAID_MODEL_FORBIDDEN', 'CircuitBreaker']) {
  if (!nexus.includes(token)) failures.push(`nexusAI.ts não contém ${token}.`);
}

const nativeNetwork = read('src/lib/nativeNetwork.ts');
if (!nativeNetwork.includes('fetchNativeUrlPayload')) failures.push('nativeNetwork.ts não expõe o transporte nativo de URLs.');

const linkDownloader = read('src/lib/linkDownloader.ts');
if (!linkDownloader.includes('fetchNativeUrlPayload') || !linkDownloader.includes("transport: 'native'")) failures.push('linkDownloader.ts não usa o transporte nativo no APK.');

const fileSaver = read('src/lib/nativeFileSaver.ts');
if (!fileSaver.includes('saveNativeBlob') || !fileSaver.includes('downloadNativeUrl')) failures.push('nativeFileSaver.ts não encaminha exports para Downloads do Android.');

const vite = read('vite.config.ts');
if (!vite.includes('src/lib/nativeFileSaver.ts')) failures.push('Vite não redireciona file-saver para o adaptador nativo.');

const ocrFacade = read('src/lib/ocrEngine.ts');
if (!ocrFacade.includes("import('./ocrEngineImpl')")) failures.push('ocrEngine.ts não carrega a implementação pesada de OCR sob demanda.');
const ocr = read('src/lib/ocrEngineImpl.ts');
if (!ocr.includes('native-ocr/worker.min.js') || !ocr.includes('native-ocr/lang') || !ocr.includes('native-ocr/core')) failures.push('Implementação OCR não aponta para assets locais no runtime nativo.');

const nativeAssetScript = read('scripts/prepare-native-offline-assets.mjs');
for (const token of ['@tesseract.js-data', "['por', 'eng']", 'tesseract.js-core']) {
  if (!nativeAssetScript.includes(token)) failures.push(`prepare-native-offline-assets.mjs não contém ${token}.`);
}

const bridgeScript = read('scripts/configure-native-android-bridge.mjs');
for (const token of ['MediaStore.Downloads', 'OrbiDocNativePlugin', 'android.intent.action.VIEW', 'android.intent.action.SEND']) {
  if (!bridgeScript.includes(token)) failures.push(`configure-native-android-bridge.mjs não contém ${token}.`);
}

const networkScript = read('scripts/configure-native-android-network.mjs');
for (const token of ['fetchUrlPayload', 'HttpURLConnection', '300L * 1024L * 1024L']) {
  if (!networkScript.includes(token)) failures.push(`configure-native-android-network.mjs não contém ${token}.`);
}

for (const workflowFile of ['.github/workflows/ci.yml', '.github/workflows/android-native.yml']) {
  const workflow = read(workflowFile);
  if (!workflow.includes('@capacitor/android@8')) failures.push(`${workflowFile} não fixa Capacitor 8.`);
  if (!workflow.includes('configure-native-android-bridge.mjs')) failures.push(`${workflowFile} não injeta a ponte nativa Android.`);
  if (!workflow.includes('configure-native-android-network.mjs')) failures.push(`${workflowFile} não injeta o transporte nativo de URLs.`);
  if (workflow.includes('configure-native-ai-web.mjs')) failures.push(`${workflowFile} ainda injeta IA multi-provider dentro do APK.`);
  if (!workflow.includes('verify:nexus')) failures.push(`${workflowFile} não valida a política Nexus AI free-only.`);
  if (!workflow.includes('assembleDebug')) failures.push(`${workflowFile} não gera APK debug instalável.`);
}

const releaseWorkflow = read('.github/workflows/android-native.yml');
if (!releaseWorkflow.includes('bundleRelease')) warnings.push('Workflow Android ainda não gera AAB release.');
if (!releaseWorkflow.includes('assembleRelease')) warnings.push('Workflow Android ainda não gera APK release assinado.');
if (!releaseWorkflow.includes('apksigner')) warnings.push('Workflow Android ainda não verifica assinatura do APK release.');

if (failures.length) {
  console.error('\nFalhas de prontidão nativa Android:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Orbit Android: shell Capacitor local, sem server.url e sem service worker obrigatório.');
console.log('Orbit Android: OCR por+eng lazy-loaded e configurado para assets empacotados no APK/AAB.');
console.log('Orbit Android: Nexus AI não possui runtime paralelo no WebView; usa o mesmo backend OpenRouter free-only da Web/PWA.');
console.log('Orbit Android: exports seguem para MediaStore/Downloads e intents de arquivos permanecem habilitadas.');
warnings.forEach((warning) => console.log(`Aviso: ${warning}`));
