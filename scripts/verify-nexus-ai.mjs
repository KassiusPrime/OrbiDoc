import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const runtime = read('api/_lib/nexusAI.ts');
const web = read('api/_lib/zeroCostWebSearch.ts');
const client = read('src/api/chat.ts');
const workspace = read('src/components/AiWorkspace.tsx');
const server = read('server.ts');
const nativeBridge = read('src/lib/nativeAndroidBridge.ts');
const imageRuntime = read('api/_lib/imageRuntime.ts');
const manifest = read('vite.config.ts');

const requiredRuntimeTokens = [
  'createOpenRouter',
  'generateText',
  'streamText',
  'openrouter/free',
  'CircuitBreaker',
  'PAID_MODEL_FORBIDDEN',
  "endsWith(':free')",
  'maxRetries: 0',
  'fallbackUsed',
  'Nexus AI',
];
for (const token of requiredRuntimeTokens) {
  if (!runtime.includes(token)) failures.push(`nexusAI.ts não contém ${token}.`);
}

const modelMatches = [...runtime.matchAll(/['"]([a-z0-9_.-]+\/[a-z0-9_.:-]+)['"]/gi)].map((match) => match[1]);
const internalModels = [...new Set(modelMatches.filter((model) => model === 'openrouter/free' || model.includes(':free')))].sort();
if (internalModels.length < 2) failures.push('Pool interno do Nexus AI parece pequeno ou ausente.');
for (const model of internalModels) {
  if (model !== 'openrouter/free' && !model.endsWith(':free')) failures.push(`Modelo não gratuito no pool: ${model}.`);
}

for (const forbidden of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'ai-gateway.vercel.sh', 'openrouter:web_search', 'openrouter:web_fetch']) {
  if (runtime.includes(forbidden)) failures.push(`Runtime Nexus AI contém integração proibida: ${forbidden}.`);
}

if (!web.includes('tavily-free')) failures.push('Pesquisa zero-cost não identifica o motor gratuito.');
if (!web.includes('não fará fallback para uma busca paga')) failures.push('Pesquisa zero-cost não documenta fail-closed.');
for (const paidWebToken of ['openrouter:web_search', 'openrouter:web_fetch', "id: 'web'"]) {
  if (web.includes(paidWebToken)) failures.push(`Pesquisa zero-cost contém ferramenta paga: ${paidWebToken}.`);
}

if (!client.includes('provider/model are deliberately ignored')) failures.push('Cliente ainda pode aparentar controlar o modelo interno.');
if (!workspace.includes('Nexus AI')) failures.push('UI não apresenta Nexus AI.');
if (/<select|<optgroup/.test(workspace)) failures.push('UI Nexus AI ainda contém seletor de modelo/provedor.');
if (!workspace.includes('Virtuoso')) failures.push('Lista de mensagens não está virtualizada.');
if (!server.includes('nexusAI.complete') || !server.includes('nexusAI.stream')) failures.push('Servidor local não usa Nexus AI unificado.');
if (/runChatV2|streamChatV2|hydrateGatewayRuntimeAuth/.test(server)) failures.push('Servidor ainda referencia runtime multi-provider antigo.');
if (!nativeBridge.includes('installNativeAiApiBridge(): false')) failures.push('Android ainda pode interceptar a IA e divergir do backend Nexus.');

if (!imageRuntime.includes('PAID_IMAGE_MODEL_FORBIDDEN')) failures.push('Runtime de imagem não bloqueia explicitamente modelos pagos.');
if (!imageRuntime.includes("endsWith(':free')")) failures.push('Runtime de imagem não exige variante :free.');
if (/ai-gateway\.vercel|GEMINI_API_KEY|GROQ_API_KEY/.test(imageRuntime)) failures.push('Runtime de imagem ainda referencia provedor de IA proibido.');

if (!manifest.includes('name: "Orbit"') || !manifest.includes('short_name: "Orbit"')) failures.push('Manifest PWA não está nomeado Orbit.');
if (/pollinations/i.test(manifest)) failures.push('Manifest/cache ainda referencia geração de imagem fora da política OpenRouter.');

if (failures.length) {
  console.error('\nFalhas da política Nexus AI:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Nexus AI: ${internalModels.length} rotas gratuitas detectadas; nenhuma rota paga permitida.`);
console.log('Nexus AI: Vercel AI SDK + OpenRouter são a única superfície de inferência remota do assistente.');
console.log('Nexus AI: pesquisa Web opera em modo zero-spend e falha fechada quando a cota gratuita termina.');
console.log('Orbit: Web/PWA/Android compartilham o mesmo backend de IA; seleção de modelos não é exposta ao usuário.');
