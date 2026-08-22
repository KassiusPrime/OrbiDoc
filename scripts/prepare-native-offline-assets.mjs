import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const output = path.join(dist, 'native-ocr');
const coreOutput = path.join(output, 'core');
const langOutput = path.join(output, 'lang');

if (!fs.existsSync(dist)) {
  throw new Error('dist/ não existe. Execute o build web antes de preparar os assets nativos.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(coreOutput, { recursive: true });
fs.mkdirSync(langOutput, { recursive: true });

const workerCandidates = [
  path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js.map'),
];
const worker = workerCandidates.find((candidate) => fs.existsSync(candidate));
if (!worker) throw new Error('Worker local do tesseract.js não encontrado em node_modules.');
fs.copyFileSync(worker, path.join(output, 'worker.min.js'));

const coreRoot = path.join(root, 'node_modules', 'tesseract.js-core');
if (!fs.existsSync(coreRoot)) throw new Error('tesseract.js-core não encontrado em node_modules.');
const coreFiles = fs.readdirSync(coreRoot).filter((name) => /^tesseract-core.*\.(?:js|wasm)$/.test(name));
if (!coreFiles.length) throw new Error('Arquivos WASM/core do Tesseract não foram encontrados.');
for (const name of coreFiles) fs.copyFileSync(path.join(coreRoot, name), path.join(coreOutput, name));

function findLanguageFile(language) {
  const base = path.join(root, 'node_modules', '@tesseract.js-data', language);
  const candidates = [
    path.join(base, '4.0.0_best_int', `${language}.traineddata.gz`),
    path.join(base, '4.0.0', `${language}.traineddata.gz`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

for (const language of ['por', 'eng']) {
  const source = findLanguageFile(language);
  if (!source) {
    throw new Error(`Dados OCR offline de ${language} ausentes. Instale @tesseract.js-data/${language}@1 antes desta etapa.`);
  }
  fs.copyFileSync(source, path.join(langOutput, `${language}.traineddata.gz`));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  languages: ['por', 'eng'],
  worker: 'worker.min.js',
  coreFiles,
  runtime: 'tesseract.js',
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));

const totalBytes = fs.readdirSync(langOutput)
  .map((name) => fs.statSync(path.join(langOutput, name)).size)
  .reduce((sum, size) => sum + size, 0);
console.log(`Native OCR: por+eng empacotados (${(totalBytes / 1024 / 1024).toFixed(1)} MB de dados de idioma).`);
