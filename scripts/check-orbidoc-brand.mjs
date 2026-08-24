import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', 'dist', '.vercel']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.yml', '.yaml', '.txt', '.toml']);
const banned = ['DocSwiss', 'DocPlus+', 'DocPlus', 'DocuTools Pro', 'docswiss', 'docplus', 'docutools-pro'];
const legacyFirestoreDatabaseId = 'ai-studio-docswiss-116c7e86-02a0-4cef-95a3-4f36aa66518a';

// Infrastructure identifiers created before the OrbiDoc rename cannot be renamed in-place.
// They are allowed only where Firebase must address that exact existing database; this does
// not permit legacy product branding in source UI, copy, manifests, documentation or assets.
const allowedFragments = new Map([
  ['firebase-applet-config.json', [legacyFirestoreDatabaseId]],
  ['firebase.json', [legacyFirestoreDatabaseId]],
  ['.github/workflows/firebase-production.yml', [legacyFirestoreDatabaseId]],
  ['src/lib/legacyBrandMigration.ts', ["'docswiss_'", "'docplus_'"]],
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const failures = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel === 'scripts/check-orbidoc-brand.mjs') continue;
  const ext = path.extname(file).toLowerCase();
  if (!textExtensions.has(ext) && path.basename(file) !== 'bun.lock') continue;

  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const fragment of allowedFragments.get(rel) || []) content = content.split(fragment).join('');

  for (const token of banned) {
    if (content.includes(token)) failures.push(`${rel}: contém referência legada "${token}"`);
  }
}

if (failures.length) {
  console.error('Brand audit falhou. Referências antigas fora da allowlist:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('OrbiDoc brand audit passed: nenhuma referência legada indevida encontrada.');
