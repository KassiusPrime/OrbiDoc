import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const failures = [];
const requireFile = (relative) => {
  const full = path.join(dist, relative);
  if (!fs.existsSync(full)) failures.push(`Arquivo ausente: dist/${relative}`);
  return full;
};

const manifestPath = requireFile('manifest.json');
const legacyManifestPath = requireFile('manifest.webmanifest');
requireFile('sw.js');
requireFile('logo-192.png');
requireFile('logo-512.png');
requireFile('logo-maskable-192.png');
requireFile('logo-maskable-512.png');
const assetlinksPath = requireFile('.well-known/assetlinks.json');

let manifest = null;
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { failures.push('manifest.json não é JSON válido.'); }
}

if (fs.existsSync(manifestPath) && fs.existsSync(legacyManifestPath)) {
  try {
    const canonical = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const legacy = JSON.parse(fs.readFileSync(legacyManifestPath, 'utf8'));
    if (JSON.stringify(canonical) !== JSON.stringify(legacy)) failures.push('manifest.json e manifest.webmanifest precisam ser equivalentes.');
  } catch {
    failures.push('Alias manifest.webmanifest não é JSON válido.');
  }
}

if (manifest) {
  if (manifest.id !== '/') failures.push(`manifest.id deve ser / (atual: ${manifest.id}).`);
  if (manifest.name !== 'Orbit') failures.push(`manifest.name deve ser Orbit (atual: ${manifest.name}).`);
  if (manifest.short_name !== 'Orbit') failures.push(`manifest.short_name deve ser Orbit (atual: ${manifest.short_name}).`);
  if (manifest.lang !== 'pt-BR') failures.push(`manifest.lang deve ser pt-BR (atual: ${manifest.lang}).`);
  if (manifest.dir !== 'ltr') failures.push(`manifest.dir deve ser ltr (atual: ${manifest.dir}).`);
  if (manifest.start_url !== '/') failures.push(`manifest.start_url deve ser / (atual: ${manifest.start_url}).`);
  if (manifest.scope !== '/') failures.push(`manifest.scope deve ser / (atual: ${manifest.scope}).`);
  if (manifest.orientation !== 'any') failures.push(`manifest.orientation deve ser any (atual: ${manifest.orientation}).`);
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) failures.push(`display inválido para instalação: ${manifest.display}.`);
  if (!manifest.theme_color) failures.push('Manifesto precisa de theme_color.');
  if (!manifest.background_color) failures.push('Manifesto precisa de background_color.');
  if (!manifest.description || !/Orbit/i.test(manifest.description) || /AI Cloud|Vercel/i.test(manifest.description)) {
    failures.push('Descrição do manifesto precisa identificar Orbit/Orbispace/OrbiDoc, não conteúdo genérico de plataforma.');
  }
  if (!Array.isArray(manifest.categories) || !manifest.categories.includes('productivity')) failures.push('Manifesto precisa incluir a categoria productivity.');
  if (manifest.prefer_related_applications !== false) failures.push('prefer_related_applications deve ser false enquanto o PWA for instalável diretamente.');

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const has192 = icons.some((icon) => icon.sizes === '192x192' && String(icon.purpose || '').includes('any'));
  const has512 = icons.some((icon) => icon.sizes === '512x512' && String(icon.purpose || '').includes('any'));
  const hasMaskable = icons.some((icon) => String(icon.purpose || '').split(/\s+/).includes('maskable'));
  const externalIcons = icons.filter((icon) => /^https?:\/\//i.test(String(icon.src || '')));
  if (!has192) failures.push('Manifesto precisa de ícone PNG 192x192 purpose=any.');
  if (!has512) failures.push('Manifesto precisa de ícone PNG 512x512 purpose=any.');
  if (!hasMaskable) failures.push('Manifesto precisa de ao menos um ícone maskable.');
  if (externalIcons.length) failures.push('Ícones do manifesto devem ser assets locais do Orbit, não URLs externas.');

  const handlers = Array.isArray(manifest.file_handlers) ? manifest.file_handlers : [];
  if (!handlers.length) failures.push('Manifesto precisa registrar file_handlers para “Abrir com Orbit” e encaminhar arquivos ao OrbiDoc.');
  const accepted = handlers[0]?.accept || {};
  const requiredMimeTypes = [
    'application/pdf',
    'application/epub+zip',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'text/plain',
  ];
  requiredMimeTypes.forEach((mime) => {
    if (!accepted[mime]) failures.push(`file_handlers precisa aceitar ${mime}.`);
  });
  if (!manifest.launch_handler) failures.push('Manifesto precisa de launch_handler para reusar uma janela instalada existente.');
}

if (fs.existsSync(assetlinksPath)) {
  try {
    const assetlinks = JSON.parse(fs.readFileSync(assetlinksPath, 'utf8'));
    if (!Array.isArray(assetlinks)) failures.push('assetlinks.json precisa ser um array JSON.');
    if (process.env.ANDROID_PACKAGE_NAME && process.env.ANDROID_SHA256_CERT_FINGERPRINT && assetlinks.length === 0) {
      failures.push('As variáveis Android estão definidas, mas assetlinks.json ficou vazio.');
    }
  } catch {
    failures.push('assetlinks.json não é JSON válido.');
  }
}

const androidConfigured = Boolean(process.env.ANDROID_PACKAGE_NAME || process.env.ANDROID_SHA256_CERT_FINGERPRINT);
const targetSdk = Number(process.env.ANDROID_TARGET_SDK || 36);
if (androidConfigured && (!Number.isFinite(targetSdk) || targetSdk < 36)) {
  failures.push(`ANDROID_TARGET_SDK precisa ser 36 ou superior para o pacote Play Store atual (atual: ${process.env.ANDROID_TARGET_SDK || 'inválido'}).`);
}

if (failures.length) {
  console.error('\nFalhas de validação Orbit PWA/WebAPK:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Orbit PWA: manifesto canônico, alias, service worker, ícones, metadados, file handlers do OrbiDoc e assetlinks passaram na validação estrutural.');
if (!process.env.ANDROID_PACKAGE_NAME || !process.env.ANDROID_SHA256_CERT_FINGERPRINT) {
  console.log('Distribuição Android nativa continua independente da PWA; assinatura release ainda precisa das credenciais reais do proprietário.');
} else {
  console.log(`Identidade Android configurada; targetSdk validado em ${targetSdk}.`);
}
