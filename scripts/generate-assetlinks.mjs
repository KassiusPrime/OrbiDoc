import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('public/.well-known');
const outFile = path.join(outDir, 'assetlinks.json');
const packageName = (process.env.ANDROID_PACKAGE_NAME || 'app.orbidoc.workspace').trim();
const fingerprint = (process.env.ANDROID_SHA256_CERT_FINGERPRINT || '').trim().toUpperCase();
const appLinksEnabled = String(process.env.ANDROID_APP_LINKS_ENABLED || 'false').toLowerCase() === 'true';
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

fs.mkdirSync(outDir, { recursive: true });

if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
  console.error('ANDROID_PACKAGE_NAME inválido. Exemplo: app.orbidoc.workspace');
  process.exit(1);
}

let payload = [];
if (appLinksEnabled) {
  if (!fingerprint) {
    console.error('ANDROID_APP_LINKS_ENABLED=true exige ANDROID_SHA256_CERT_FINGERPRINT da chave de assinatura de produção.');
    process.exit(1);
  }
  if (!fingerprintPattern.test(fingerprint)) {
    console.error('ANDROID_SHA256_CERT_FINGERPRINT inválido. Use 32 pares hexadecimais separados por dois-pontos.');
    process.exit(1);
  }

  payload = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ];
  console.log(`Android App Links verificados configurados para ${packageName}.`);
} else {
  console.log('Android App Links estão desativados; assetlinks.json será publicado como []. Isso é intencional e não impede APK/AAB Capacitor, Play Store, PWA ou abertura local de arquivos.');
}

fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');