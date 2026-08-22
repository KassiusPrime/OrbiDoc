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
if (!/if \(!nativeRuntime\)[\s\S]*registerSW/.test(main)) failures.push('main.tsx não protege o service worker contra execução no shell nativo.');

const nativeRuntime = read('src/lib/nativeRuntime.ts');
if (!nativeRuntime.includes('isNativePlatform')) failures.push('nativeRuntime.ts não detecta Capacitor nativo.');

const pwaInstall = read('src/lib/pwaInstall.ts');
if (!pwaInstall.includes('isOrbiDocNativeRuntime')) failures.push('pwaInstall.ts não reconhece o app nativo como instalado.');

const ocr = read('src/lib/ocrEngine.ts');
if (!ocr.includes('native-ocr/worker.min.js') || !ocr.includes('native-ocr/lang') || !ocr.includes('native-ocr/core')) failures.push('OCR não está apontando para assets locais no runtime nativo.');

const nativeAssetScript = read('scripts/prepare-native-offline-assets.mjs');
for (const token of ['@tesseract.js-data', "['por', 'eng']", 'tesseract.js-core']) {
  if (!nativeAssetScript.includes(token)) failures.push(`prepare-native-offline-assets.mjs não contém ${token}.`);
}

const workflow = read('.github/workflows/android-native.yml');
if (workflow) {
  if (!workflow.includes('@capacitor/android@8')) failures.push('Workflow Android não fixa Capacitor 8.');
  if (!workflow.includes('assembleDebug')) failures.push('Workflow Android não gera APK debug instalável.');
  if (!workflow.includes('bundleRelease')) warnings.push('Workflow Android ainda não gera AAB release.');
  if (!workflow.includes('assembleRelease')) warnings.push('Workflow Android ainda não gera APK release assinado.');
}

if (failures.length) {
  console.error('\nFalhas de prontidão nativa Android:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Native Android: shell Capacitor local, sem server.url e sem service worker obrigatório.');
console.log('Native Android: OCR por+eng configurado para assets empacotados no APK/AAB.');
warnings.forEach((warning) => console.log(`Aviso: ${warning}`));
