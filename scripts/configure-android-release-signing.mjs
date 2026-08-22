import fs from 'node:fs';
import path from 'node:path';

const gradlePath = path.resolve('android/app/build.gradle');
if (!fs.existsSync(gradlePath)) throw new Error('android/app/build.gradle não encontrado. Execute cap add android primeiro.');

let gradle = fs.readFileSync(gradlePath, 'utf8');
const versionCode = Number(process.env.ORBIDOC_VERSION_CODE || 1);
const versionName = String(process.env.ORBIDOC_VERSION_NAME || '0.9.0').replace(/"/g, '');

if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error('ORBIDOC_VERSION_CODE precisa ser um inteiro positivo.');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

const shouldSign = process.env.ORBIDOC_SIGN_RELEASE === 'true';
if (shouldSign) {
  const required = ['ORBIDOC_KEYSTORE_PATH', 'ORBIDOC_KEYSTORE_PASSWORD', 'ORBIDOC_KEY_ALIAS', 'ORBIDOC_KEY_PASSWORD'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Variáveis de assinatura ausentes: ${missing.join(', ')}.`);

  if (!gradle.includes('signingConfigs {')) {
    const signing = `    signingConfigs {\n        release {\n            storeFile file(System.getenv("ORBIDOC_KEYSTORE_PATH"))\n            storePassword System.getenv("ORBIDOC_KEYSTORE_PASSWORD")\n            keyAlias System.getenv("ORBIDOC_KEY_ALIAS")\n            keyPassword System.getenv("ORBIDOC_KEY_PASSWORD")\n        }\n    }\n`;
    gradle = gradle.replace(/\n\s*buildTypes\s*\{/, `\n${signing}    buildTypes {`);
  }

  if (!/release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(gradle)) {
    gradle = gradle.replace(/(release\s*\{)/, '$1\n            signingConfig signingConfigs.release');
  }
}

fs.writeFileSync(gradlePath, gradle);
console.log(`Android Gradle: versão ${versionName} (${versionCode})${shouldSign ? ' com assinatura release por ambiente' : ''}.`);
