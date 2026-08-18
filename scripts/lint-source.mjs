import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const ROOTS = ['src', 'api'];
const ROOT_FILES = ['server.ts', 'vite.config.ts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const CONFLICT_MARKERS = ['<<<<<<<', '=======', '>>>>>>>'];

async function walk(entry) {
  const info = await stat(entry).catch(() => null);
  if (!info) return [];
  if (info.isFile()) return EXTENSIONS.has(path.extname(entry)) ? [entry] : [];
  if (!info.isDirectory()) return [];

  const children = await readdir(entry);
  const nested = await Promise.all(children.map((child) => walk(path.join(entry, child))));
  return nested.flat();
}

function loaderFor(file) {
  const ext = path.extname(file);
  if (ext === '.tsx') return 'tsx';
  if (ext === '.ts') return 'ts';
  if (ext === '.jsx') return 'jsx';
  return 'js';
}

const files = [
  ...(await Promise.all(ROOTS.map((root) => walk(root)))).flat(),
  ...(await Promise.all(ROOT_FILES.map((file) => walk(file)))).flat(),
].sort();

const failures = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');

  const marker = CONFLICT_MARKERS.find((candidate) => source.includes(candidate));
  if (marker) {
    failures.push(`${file}: contém marcador de conflito Git (${marker}).`);
    continue;
  }

  try {
    await transform(source, {
      loader: loaderFor(file),
      target: 'es2022',
      jsx: 'automatic',
      sourcemap: false,
      logLevel: 'silent',
      sourcefile: file,
    });
  } catch (error) {
    const detail = error?.errors?.[0];
    const location = detail?.location
      ? `${detail.location.file || file}:${detail.location.line}:${detail.location.column}`
      : file;
    failures.push(`${location}: ${detail?.text || error?.message || String(error)}`);
  }
}

if (failures.length) {
  console.error(`Source lint failed with ${failures.length} error(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Source lint passed: ${files.length} source files parsed successfully.`);
