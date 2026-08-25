import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'firebase-applet-config.json');
const deletionPath = path.join(root, 'dist', 'delete-account.html');

if (!fs.existsSync(configPath)) {
  throw new Error('firebase-applet-config.json não foi encontrado.');
}
if (!fs.existsSync(deletionPath)) {
  throw new Error('dist/delete-account.html não foi encontrado. Execute o vite build antes desta etapa.');
}

const fallback = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const pick = (name, fallbackValue = '') => String(process.env[name] || fallbackValue || '').trim();

const firebaseConfig = {
  apiKey: pick('VITE_FIREBASE_API_KEY', fallback.apiKey),
  authDomain: pick('VITE_FIREBASE_AUTH_DOMAIN', fallback.authDomain),
  projectId: pick('VITE_FIREBASE_PROJECT_ID', fallback.projectId),
  storageBucket: pick('VITE_FIREBASE_STORAGE_BUCKET', fallback.storageBucket),
  messagingSenderId: pick('VITE_FIREBASE_MESSAGING_SENDER_ID', fallback.messagingSenderId),
  appId: pick('VITE_FIREBASE_APP_ID', fallback.appId),
};
const databaseId = pick('VITE_FIREBASE_DATABASE_ID', fallback.firestoreDatabaseId);

const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = required.filter((key) => !firebaseConfig[key]);
if (missing.length) {
  throw new Error(`Configuração Firebase incompleta para delete-account.html: ${missing.join(', ')}.`);
}

let html = fs.readFileSync(deletionPath, 'utf8');
const configToken = '__ORBIDOC_FIREBASE_CONFIG__';
const databaseToken = '__ORBIDOC_FIRESTORE_DATABASE_ID__';
if (!html.includes(configToken) || !html.includes(databaseToken)) {
  throw new Error('Os placeholders esperados não existem em dist/delete-account.html.');
}

html = html
  .replace(configToken, JSON.stringify(firebaseConfig))
  .replace(databaseToken, JSON.stringify(databaseId));

if (html.includes(configToken) || html.includes(databaseToken)) {
  throw new Error('Falha ao resolver os placeholders Firebase de delete-account.html.');
}

fs.writeFileSync(deletionPath, html);
console.log(`Account deletion page: Firebase ${firebaseConfig.projectId} configurado para o build.`);
