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
  if (config.appName !== 'OrbiDoc') failures.push(`Capacitor appName precisa ser OrbiDoc (atual: ${config.appName}).`);
  if (config.webDir !== 'dist') failures.push(`Capacitor webDir precisa ser dist (atual: ${config.webDir}).`);
  if (config.server?.url) failures.push('capacitor.config.json contém server.url. Isso faria o app nativo depender de um servidor remoto.');
}

const main = read('src/main.tsx');
if (!main.includes('applyOrbiDocNativeRuntimeProfile')) failures.push('main.tsx não inicializa o perfil nativo.');
if (!main.includes('installNativeAiApiBridge')) failures.push('main.tsx não inicializa a ponte nativa de IA.');
if (!main.includes('installNativeFileOpenBridge')) failures.push('main.tsx não inicializa abertura de arquivos do Android.');
if (!main.includes('NativeAiSettingsLauncher')) failures.push('main.tsx não monta configurações BYOK de IA.');
if (!/if \(!nativeRuntime\)[\s\S]*registerSW/.test(main)) failures.push('main.tsx não protege o service worker contra execução no shell nativo.');

const nativeRuntime = read('src/lib/nativeRuntime.ts');
if (!nativeRuntime.includes('isNativePlatform')) failures.push('nativeRuntime.ts não detecta Capacitor nativo.');

const androidBridge = read('src/lib/nativeAndroidBridge.ts');
for (const token of ['getNativeAiCatalog', 'nativeAiComplete', 'saveNativeBlob', 'downloadNativeUrl', 'consumeOpenFile']) {
  if (!androidBridge.includes(token)) failures.push(`nativeAndroidBridge.ts não contém ${token}.`);
}

const fileSaver = read('src/lib/nativeFileSaver.ts');
if (!fileSaver.includes('saveNativeBlob') || !fileSaver.includes('downloadNativeUrl')) failures.push('nativeFileSaver.ts não encaminha exports para Downloads do Android.');

const vite = read('vite.config.ts');
if (!vite.includes('src/lib/nativeFileSaver.ts')) failures.push('Vite não redireciona file-saver para o adaptador nativo.');

const ocr = read('src/lib/ocrEngine.ts');
if (!ocr.includes('native-ocr/worker.min.js') || !ocr.includes('native-ocr/lang') || !ocr.includes('native-ocr/core')) failures.push('OCR não está apontando para assets locais no runtime nativo.');

const nativeAssetScript = read('scripts/prepare-native-offline-assets.mjs');
for (const token of ['@tesseract.js-data', "['por', 'eng']", 'tesseract.js-core']) {
  if (!nativeAssetScript.includes(token)) failures.push(`prepare-native-offline-assets.mjs não contém ${token}.`);
}

const bridgeScript = read('scripts/configure-native-android-bridge.mjs');
for (const token of ['AndroidKeyStore', 'MediaStore.Downloads', 'OrbiDocNativePlugin', 'android.intent.action.VIEW', 'android.intent.action.SEND']) {
  if (!bridgeScript.includes(token)) failures.push(`configure-native-android-bridge.mjs não contém ${token}.`);
}

for (const workflowFile of ['.github/workflows/ci.yml', '.github/workflows/android-native.yml']) {
  const workflow = read(workflowFile);
  if (!workflow.includes('@capacitor/android@8')) failures.push(`${workflowFile} não fixa Capacitor 8.`);
  if (!workflow.includes('configure-native-android-bridge.mjs')) failures.push(`${workflowFile} não injeta a ponte nativa Android.`);
  if (!workflow.includes('assembleDebug')) failures.push(`${workflowFile} não gera APK debug instalável.`);
}

const releaseWorkflow = read('.github/workflows/android-native.yml');
if (!releaseWorkflow.includes('bundleRelease')) warnings.push('Workflow Android ainda não gera AAB release.');
if (!releaseWorkflow.includes('assembleRelease')) warnings.push('Workflow Android ainda não gera APK release assinado.');

if (failures.length) {
  console.error('\nFalhas de prontidão nativa Android:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Native Android: shell Capacitor local, sem server.url e sem service worker obrigatório.');
console.log('Native Android: OCR por+eng configurado para assets empacotados no APK/AAB.');
console.log('Native Android: IA BYOK protegida pelo Android Keystore e chamadas diretas aos provedores.');
console.log('Native Android: exports encaminhados ao MediaStore em Downloads/OrbiDoc e intents de arquivos configuradas.');
warnings.forEach((warning) => console.log(`Aviso: ${warning}`));
