import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const runtime = read('api/_lib/ollamaNexus.ts');
const web = read('api/_lib/zeroCostWebSearch.ts');
const server = read('server.ts');
const client = read('src/api/chat.ts');
const workspace = read('src/components/AiWorkspace.tsx');
const image = read('api/_lib/imageRuntime.ts');

const fail = (message) => {
  console.error(`Nexus self-hosted verification failed: ${message}`);
  process.exit(1);
};

const requireText = (source, pattern, message) => {
  if (!pattern.test(source)) fail(message);
};

const forbid = (source, pattern, message) => {
  if (pattern.test(source)) fail(message);
};

requireText(runtime, /OLLAMA_API_URL/, 'OLLAMA_API_URL não está no gateway.');
requireText(runtime, /\/api\/chat/, 'O gateway não aponta para /api/chat do Ollama.');
requireText(runtime, /stream:\s*true/, 'O gateway não usa streaming NDJSON do Ollama.');
requireText(runtime, /CONNECT_TIMEOUT_MS\s*=\s*10_000/, 'timeout de conexão de 10s ausente.');
requireText(runtime, /IDLE_TIMEOUT_MS\s*=\s*45_000/, 'timeout de ociosidade de 45s ausente.');
requireText(runtime, /receivedByte/, 'guard de retry pós-primeiro-byte ausente.');
requireText(web, /SEARXNG_URL/, 'SEARXNG_URL não está na busca Web.');
requireText(web, /searxng-selfhosted/, 'engine SearXNG ausente.');
requireText(web, /<web_data source="searxng_selfhosted" trust="untrusted">/, 'bloco de dados não confiáveis ausente.');
requireText(server, /from ['"]\.\/api\/_lib\/ollamaNexus\.js['"]/, 'server.ts não usa Ollama como gateway.');
requireText(client, /model\?: string/, 'cliente não envia modelo local.');
requireText(workspace, /Modelo local do Nexus AI/, 'seletor local não está na UI.');
requireText(image, /local-media-processor/, 'Real-ESRGAN local não está preservado.');

for (const source of [runtime, web, server, client, workspace, image]) {
  forbid(source, /openrouter\.ai\/api\/v1\/chat|api\.tavily\.com/, 'host remoto de inferência/busca encontrado no runtime ativo.');
  forbid(source, /PAID_MODEL_FORBIDDEN|ZERO_COST_INVARIANT_VIOLATED|max_price\s*:/, 'invariante OpenRouter legado encontrado no runtime ativo.');
  forbid(source, /generativelanguage\.googleapis\.com|api\.groq\.com/, 'provedor remoto legado encontrado no runtime ativo.');
  forbid(source, /pollinations\.ai|pollinations/, 'Pollinations encontrado no runtime ativo.');
}

if (exists('api/_lib/nexusFreeAI.ts') || exists('api/_lib/nexusAI.ts')) {
  fail('arquivos de gateway OpenRouter antigos ainda existem.');
}

console.log('Nexus self-hosted verification passed: Ollama + SearXNG, sem inferência remota.');
