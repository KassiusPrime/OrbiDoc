import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const failures = [];
const requireFile = (relative) => {
  const full = path.join(dist, relative);
  if (!fs.existsSync(full)) failures.push(`Arquivo ausente: dist/${relative}`);
  return full;
};

const manifestPath = requireFile('manifest.webmanifest');
requireFile('sw.js');
requireFile('logo-192.png');
requireFile('logo-512.png');
requireFile('logo-maskable-192.png');
requireFile('logo-maskable-512.png');
const assetlinksPath = requireFile('.well-known/assetlinks.json');

let manifest = null;
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { failures.push('manifest.webmanifest não é JSON válido.'); }
}

if (manifest) {
  if (manifest.name !== 'DocSwiss') failures.push(`manifest.name deve ser DocSwiss (atual: ${manifest.name}).`);
  if (manifest.short_name !== 'DocSwiss') failures.push(`manifest.short_name deve ser DocSwiss (atual: ${manifest.short_name}).`);
  if (manifest.lang !== 'pt-BR') failures.push(`manifest.lang deve ser pt-BR (atual: ${manifest.lang}).`);
  if (manifest.start_url !== '/') failures.push(`manifest.start_url deve ser / (atual: ${manifest.start_url}).`);
  if (manifest.scope !== '/') failures.push(`manifest.scope deve ser / (atual: ${manifest.scope}).`);
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) failures.push(`display inválido para instalação: ${manifest.display}.`);

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const has192 = icons.some((icon) => icon.sizes === '192x192' && String(icon.purpose || '').includes('any'));
  const has512 = icons.some((icon) => icon.sizes === '512x512' && String(icon.purpose || '').includes('any'));
  const hasMaskable = icons.some((icon) => String(icon.purpose || '').split(/\s+/).includes('maskable'));
  if (!has192) failures.push('Manifesto precisa de ícone PNG 192x192 purpose=any.');
  if (!has512) failures.push('Manifesto precisa de ícone PNG 512x512 purpose=any.');
  if (!hasMaskable) failures.push('Manifesto precisa de ao menos um ícone maskable.');
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

if (failures.length) {
  console.error('\nFalhas de validação PWA/WebAPK/TWA:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PWA/WebAPK: manifesto, service worker, ícones e assetlinks passaram na validação estrutural.');
if (!process.env.ANDROID_PACKAGE_NAME || !process.env.ANDROID_SHA256_CERT_FINGERPRINT) {
  console.log('TWA: assinatura ainda não configurada; isso não bloqueia a instalação PWA/WebAPK pelo Chrome.');
}
