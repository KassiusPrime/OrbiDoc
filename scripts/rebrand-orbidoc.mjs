import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', 'dist', '.vercel']);
const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.yml', '.yaml', '.txt', '.lock', '.toml']);
const replacements = [
  ['DocuTools Pro', 'OrbiDoc'],
  ['DOCSWISS', 'ORBIDOC'],
  ['DocSwiss', 'OrbiDoc'],
  ['docswiss', 'orbidoc'],
  ['doc-swiss', 'orbidoc'],
  ['DOCPLUS', 'ORBIDOC'],
  ['DocPlus+', 'OrbiDoc'],
  ['DocPlus', 'OrbiDoc'],
  ['docplus', 'orbidoc'],
];

const legacyMigration = `const PREFIXES: Array<[string, string]> = [
  ['docswiss_', 'orbidoc_'],
  ['docplus_', 'orbidoc_'],
];

function migrateStorage(storage: Storage) {
  const entries: Array<[string, string]> = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const match = PREFIXES.find(([legacy]) => key.startsWith(legacy));
    if (!match) continue;
    const [legacy, current] = match;
    const nextKey = current + key.slice(legacy.length);
    if (storage.getItem(nextKey) == null) {
      const value = storage.getItem(key);
      if (value != null) entries.push([nextKey, value]);
    }
  }
  for (const [key, value] of entries) storage.setItem(key, value);
}

export function migrateLegacyBrandStorage() {
  if (typeof window === 'undefined') return;
  try { migrateStorage(window.localStorage); } catch {}
  try { migrateStorage(window.sessionStorage); } catch {}
}
`;

const brandModule = `export const ORBIDOC_BRAND = {
  name: 'OrbiDoc',
  shortName: 'OrbiDoc',
  productLine: 'Workspace inteligente',
  storagePrefix: 'orbidoc',
  repository: 'KassiusPrime/OrbiDoc',
  preferredHost: 'orbidoc.vercel.app',
} as const;
`;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel === 'scripts/rebrand-orbidoc.mjs' || rel === '.github/workflows/orbidoc-rebrand.yml') continue;
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file);
  if (!textExts.has(ext) && base !== 'bun.lock') continue;
  let before;
  try { before = fs.readFileSync(file, 'utf8'); } catch { continue; }
  let after = before;
  for (const [from, to] of replacements) after = after.split(from).join(to);
  if (after !== before) fs.writeFileSync(file, after);
}

fs.writeFileSync(path.join(root, 'src/lib/legacyBrandMigration.ts'), legacyMigration);
fs.writeFileSync(path.join(root, 'src/lib/brand.ts'), brandModule);

const mainPath = path.join(root, 'src/main.tsx');
let main = fs.readFileSync(mainPath, 'utf8');
if (!main.includes("legacyBrandMigration")) {
  main = main.replace("import './index.css';", "import { migrateLegacyBrandStorage } from './lib/legacyBrandMigration';\nimport './index.css';");
  main = main.replace('registerSW({', 'migrateLegacyBrandStorage();\n\nregisterSW({');
  fs.writeFileSync(mainPath, main);
}

function renameEntries(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) renameEntries(full);
    let nextName = entry.name;
    for (const [from, to] of replacements) nextName = nextName.split(from).join(to);
    if (nextName !== entry.name) {
      const target = path.join(dir, nextName);
      if (!fs.existsSync(target)) fs.renameSync(full, target);
    }
  }
}
renameEntries(root);

for (const removable of ['scripts/rebrand-orbidoc.mjs', '.github/workflows/orbidoc-rebrand.yml']) {
  const target = path.join(root, removable);
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
}

console.log('OrbiDoc rebrand applied with legacy storage migration.');
