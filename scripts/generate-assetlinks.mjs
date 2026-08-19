import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('public/.well-known');
const outFile = path.join(outDir, 'assetlinks.json');
const packageName = (process.env.ANDROID_PACKAGE_NAME || '').trim();
const fingerprint = (process.env.ANDROID_SHA256_CERT_FINGERPRINT || '').trim().toUpperCase();
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

fs.mkdirSync(outDir, { recursive: true });

let payload = [];
if (packageName && fingerprint) {
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
    console.error('ANDROID_PACKAGE_NAME inválido. Exemplo: app.orbidoc.workspace');
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
  console.log(`Digital Asset Links configurado para ${packageName}.`);
} else {
  console.warn('Android TWA: ANDROID_PACKAGE_NAME/ANDROID_SHA256_CERT_FINGERPRINT não configurados; assetlinks.json será publicado como []. Chrome WebAPK/PWA continua funcionando, mas TWA não poderá ser verificada até configurar a assinatura.');
}

fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
