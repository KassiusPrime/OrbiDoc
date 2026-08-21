import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_TARGET_SDK = 36;
const dist = path.resolve('dist');
const failures = [];
const warnings = [];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { failures.push(`${file} não é JSON válido.`); return null; }
}

const manifestPath = path.join(dist, 'manifest.webmanifest');
const assetlinksPath = path.join(dist, '.well-known', 'assetlinks.json');
const privacyPath = path.join(dist, 'privacy.html');
const deletionPath = path.join(dist, 'delete-account.html');
if (!fs.existsSync(manifestPath)) failures.push('dist/manifest.webmanifest ausente. Execute o build antes da auditoria Play Store.');
if (!fs.existsSync(assetlinksPath)) failures.push('dist/.well-known/assetlinks.json ausente.');
if (!fs.existsSync(privacyPath)) failures.push('dist/privacy.html ausente. A distribuição precisa publicar uma política de privacidade acessível.');
if (!fs.existsSync(deletionPath)) failures.push('dist/delete-account.html ausente. Apps que criam contas precisam publicar um recurso web de exclusão de conta.');

const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
if (manifest) {
  if (manifest.name !== 'OrbiDoc') failures.push('O manifesto Android precisa usar o nome OrbiDoc.');
  if (manifest.short_name !== 'OrbiDoc') failures.push('O short_name do manifesto precisa usar OrbiDoc.');
  if (manifest.display !== 'standalone') failures.push(`display deve ser standalone para o shell Android (atual: ${manifest.display}).`);
  if (manifest.start_url !== '/') failures.push(`start_url deve ser / (atual: ${manifest.start_url}).`);
  if (manifest.scope !== '/') failures.push(`scope deve ser / (atual: ${manifest.scope}).`);
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const icon512 = icons.some((icon) => icon.sizes === '512x512' && String(icon.purpose || '').includes('any'));
  const maskable = icons.some((icon) => String(icon.purpose || '').split(/\s+/).includes('maskable'));
  if (!icon512) failures.push('Play/PWA readiness: ícone 512x512 purpose=any ausente.');
  if (!maskable) failures.push('Play/PWA readiness: ícone maskable ausente.');
  if (!Array.isArray(manifest.file_handlers) || !manifest.file_handlers.length) failures.push('file_handlers ausentes no manifesto final; “Abrir com OrbiDoc” não ficará disponível onde suportado.');
  if (!manifest.launch_handler) failures.push('launch_handler ausente no manifesto final.');
}

if (fs.existsSync(privacyPath)) {
  const privacy = fs.readFileSync(privacyPath, 'utf8');
  if (!/Política de Privacidade/i.test(privacy)) failures.push('privacy.html não contém uma política de privacidade reconhecível.');
  if (!/Firebase/i.test(privacy)) warnings.push('Revise privacy.html caso Firebase Authentication continue habilitado.');
  if (!/inteligência artificial|\bIA\b/i.test(privacy)) warnings.push('Revise privacy.html caso os recursos de IA continuem habilitados.');
  if (!/delete-account\.html/i.test(privacy)) failures.push('privacy.html precisa apontar para o recurso público de exclusão de conta.');
}

if (fs.existsSync(deletionPath)) {
  const deletion = fs.readFileSync(deletionPath, 'utf8');
  if (!/Excluir (sua )?conta OrbiDoc/i.test(deletion)) failures.push('delete-account.html não identifica claramente o fluxo de exclusão da conta OrbiDoc.');
  if (!/EXCLUIR/.test(deletion)) failures.push('delete-account.html não contém uma confirmação explícita para exclusão permanente.');
  if (!/deleteUser/.test(deletion)) failures.push('delete-account.html não contém o fluxo de remoção da identidade Firebase.');
  if (/__ORBIDOC_FIREBASE_CONFIG__|__ORBIDOC_FIRESTORE_DATABASE_ID__/.test(deletion)) failures.push('delete-account.html ainda contém placeholders de Firebase; a configuração pública não foi injetada no build.');
}

const packageName = String(process.env.ANDROID_PACKAGE_NAME || '').trim();
const fingerprint = String(process.env.ANDROID_SHA256_CERT_FINGERPRINT || '').trim().replace(/^"|"$/g, '');
const targetSdk = Number(process.env.ANDROID_TARGET_SDK || REQUIRED_TARGET_SDK);
const publicUrl = String(process.env.VITE_PUBLIC_APP_URL || '').trim();

if (!Number.isFinite(targetSdk) || targetSdk < REQUIRED_TARGET_SDK) failures.push(`ANDROID_TARGET_SDK=${process.env.ANDROID_TARGET_SDK || targetSdk} é insuficiente. Novos pacotes OrbiDoc devem mirar API ${REQUIRED_TARGET_SDK}.`);
if (packageName && !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) failures.push(`ANDROID_PACKAGE_NAME inválido: ${packageName}.`);
if (fingerprint && !/^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(fingerprint)) failures.push('ANDROID_SHA256_CERT_FINGERPRINT precisa conter 32 bytes hexadecimais separados por dois-pontos.');
if (publicUrl && !/^https:\/\/[^\s/]+(?:\/.*)?$/.test(publicUrl)) failures.push('VITE_PUBLIC_APP_URL precisa ser uma URL HTTPS pública.');

if (fs.existsSync(assetlinksPath)) {
  const assetlinks = readJson(assetlinksPath);
  if (Array.isArray(assetlinks)) {
    if (packageName && fingerprint) {
      const relation = assetlinks.find((entry) => entry?.target?.namespace === 'android_app' && entry?.target?.package_name === packageName);
      if (!relation) failures.push(`assetlinks.json não contém o package ${packageName}.`);
      else {
        const fingerprints = relation?.target?.sha256_cert_fingerprints || [];
        if (!fingerprints.some((value) => String(value).toUpperCase() === fingerprint.toUpperCase())) failures.push('assetlinks.json não contém o SHA-256 configurado.');
      }
    } else if (assetlinks.length) {
      warnings.push('assetlinks.json possui registros Android, mas as variáveis de assinatura não estão presentes nesta execução do CI.');
    }
  }
}

const gradleCandidates = [
  path.resolve('android/app/build.gradle'),
  path.resolve('android/app/build.gradle.kts'),
];
for (const file of gradleCandidates) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/targetSdk(?:Version)?\s*(?:=\s*)?(\d+)/);
  if (!match) failures.push(`${path.relative(process.cwd(), file)} existe, mas targetSdk não pôde ser verificado.`);
  else if (Number(match[1]) < REQUIRED_TARGET_SDK) failures.push(`${path.relative(process.cwd(), file)} usa targetSdk ${match[1]}; atualize para ${REQUIRED_TARGET_SDK}.`);
}

if (!packageName || !fingerprint) {
  warnings.push('Assinatura TWA ainda não configurada. A PWA/WebAPK pode ser instalada normalmente, mas um AAB de Play Store só fica verificável depois de definir ANDROID_PACKAGE_NAME e o SHA-256 do certificado de assinatura da distribuição.');
}

if (failures.length) {
  console.error('\nFalhas de prontidão Google Play:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Google Play: estrutura PWA/TWA compatível e alvo Android mínimo fixado em API ${REQUIRED_TARGET_SDK}.`);
warnings.forEach((warning) => console.log(`Aviso: ${warning}`));
console.log('A auditoria estrutural não substitui assinatura do AAB, Data Safety, testes da Play Console nem a revisão final da loja.');