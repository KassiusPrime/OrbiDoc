import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Word, Sheets, and Slides route to Orbit-owned editor engines', () => {
  const app = read('src/AppV5.tsx');
  assert.match(app, /import \\{ DocumentEditor \\} from '\\.\\/components\\/DocumentEditor'/);
  assert.match(app, /import \\{ SpreadsheetEditor \\} from '\\.\\/components\\/SpreadsheetEditor'/);
  assert.match(app, /import \\{ PresentationEditor \\} from '\\.\\/components\\/PresentationEditor'/);
  assert.match(app, /<DocumentEditor key=\\{project\\.id\\}/);
  assert.match(app, /<SpreadsheetEditor key=\\{project\\.id\\}/);
  assert.match(app, /<PresentationEditor key=\\{project\\.id\\}/);
  assert.doesNotMatch(app, /OnlyOfficeEditor/);
});
test('ONLYOFFICE routes are registered before JSON body parsing in the shared Express server', () => {
  const server = read('server.ts');
  const callbackRoute = server.indexOf("app.post('/api/onlyoffice/callback'");
  const bodyParser = server.indexOf("app.use(express.json({ limit: '12mb' }))");
  assert.ok(callbackRoute >= 0 && bodyParser > callbackRoute, 'callback must receive the raw request stream');
  assert.match(server, /onlyOfficeConfigHandler/);
  assert.match(server, /onlyOfficeDocumentHandler/);
  assert.match(server, /onlyOfficeCallbackHandler/);
});

test('ONLYOFFICE config endpoint fails closed without server bridge settings', () => {
  const route = read('api/_lib/onlyofficeConfigHandler.ts');
  assert.match(route, /ONLYOFFICE_NOT_CONFIGURED/);
  assert.match(route, /ONLYOFFICE_JWT_SECRET/);
  assert.match(route, /FIREBASE_AUTH_REQUIRED/);
  assert.match(route, /encryptBridgeToken/);
  assert.match(route, /VERCEL_URL/);
  assert.match(route, /PUBLIC_ORIGIN_NOT_CONFIGURED/);
});

test('ONLYOFFICE serverless bridge lazy-loads office-generation dependencies', () => {
  const storage = read('api/_lib/onlyofficeStorage.ts');
  assert.doesNotMatch(storage, /^import .* from ['"](?:docx|xlsx|pptxgenjs)['"]/m);
  assert.match(storage, /await import\(['"]docx['"]\)/);
  assert.match(storage, /await import\(['"]xlsx['"]\)/);
  assert.match(storage, /await import\(['"]pptxgenjs['"]\)/);
});

test('ONLYOFFICE callback restricts download URLs to the configured Document Server origin', () => {
  const route = read('api/_lib/onlyofficeCallbackHandler.ts');
  assert.match(route, /trustedDownloadUrl/);
  assert.match(route, /target\.origin === server\.origin/);
  assert.match(route, /redirect: 'error'/);
  assert.match(route, /UNTRUSTED_DOCUMENT_URL/);
});

test('ONLYOFFICE callback limits request body size and validates document kind', () => {
  const route = read('api/_lib/onlyofficeCallbackHandler.ts');
  assert.match(route, /MAX_CALLBACK_BODY_BYTES/);
  assert.match(route, /CALLBACK_PAYLOAD_TOO_LARGE/);
  assert.match(route, /word.*excel.*powerpoint/s);
  assert.match(route, /typeof body\.key !== 'string'/);
});

test('Nexus exposes Copilot-inspired navigation and contextual rail', () => {
  const shell = read('src/components/CopilotShell.tsx');
  const ai = read('src/components/AiWorkspace.tsx');
  assert.match(shell, /Novo chat/);
  assert.match(shell, /Contexto/);
  assert.doesNotMatch(shell, /hidden md:flex shrink-0 flex-col border-r/);
  assert.match(ai, /orbidoc:nexus-new-chat/);
});
