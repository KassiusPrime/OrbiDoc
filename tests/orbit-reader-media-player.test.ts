import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('legacy Office routes are read-only and the active navigation exposes Reader and Player', () => {
  const app = read('src/AppV5.tsx');
  assert.match(app, /id: 'reader', label: 'Leitor de documentos'/);
  assert.match(app, /id: 'player', label: 'Reprodutor'/);
  assert.match(app, /view === 'reader' \|\| view === 'word' \|\| view === 'excel' \|\| view === 'powerpoint' \|\| view === 'canva'/);
  assert.match(app, /<DocumentReaderWorkspace/);
  assert.match(app, /<MediaPlayerWorkspace/);
  assert.doesNotMatch(app, /import \{ DocumentEditor \}/);
  assert.doesNotMatch(app, /import \{ SpreadsheetEditor \}/);
  assert.doesNotMatch(app, /import \{ PresentationEditor \}/);
});

test('Nexus AI uses one internal header and explicit navigation callbacks', () => {
  const app = read('src/AppV5.tsx');
  const shell = read('src/components/CopilotShell.tsx');
  const workspace = read('src/components/AiWorkspace.tsx');
  assert.match(app, /view === 'chat' \|\| view === 'ai' \|\| view === 'compare' \? null/);
  assert.match(shell, /\{title\}/);
  assert.doesNotMatch(workspace, /<AIChatHeader/);
  assert.doesNotMatch(workspace, /document\.querySelectorAll/);
  assert.match(workspace, /onNavigate\?\.\('reader'\)/);
  assert.match(workspace, /onNavigate\?\.\('projects'\)/);
});

test('Orbit Player exposes its playback controls while clearly documenting browser codec limits', () => {
  const player = read('src/components/MediaPlayerWorkspace.tsx');
  for (const feature of ['setABPoint', 'requestPictureInPicture', 'SPEEDS', 'orbit_player_resume_v1', 'orbit_player_recent_streams_v2', 'onTouchStart', 'onDoubleClick', 'Subtitles', 'setActionHandler']) {
    assert.ok(player.includes(feature), `missing player feature: ${feature}`);
  }
  assert.match(player, /não incorpora LibVLC/);
  assert.match(player, /codec|codecs/);
});

test('image generation stays unavailable without configured credentials and validates the live model catalog', () => {
  const runtime = read('api/_lib/imageRuntime.ts');
  const route = read('api/image-status.ts');
  const ui = read('src/components/ImageWorkspace.tsx');
  assert.match(runtime, /getVerifiedImageGenerationStatus/);
  assert.match(runtime, /openrouter\.ai\/api\/v1\/images\/models/);
  assert.match(runtime, /PAID_IMAGE_MODEL_FORBIDDEN/);
  assert.match(runtime, /configuredCatalogModel\(model\)/);
  assert.match(route, /await getVerifiedImageGenerationStatus\(\)/);
  assert.match(ui, /\/api\/image-status/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /imageStatus\.message/);
});

test('Flaticon Uicons stylesheet and attribution are present', () => {
  assert.match(read('index.html'), /cdn-uicons\.flaticon\.com\/uicons-rounded-regular/);
  assert.match(read('src/components/OfficeSuiteHub.tsx'), /Uicons by Flaticon/);
  assert.match(read('src/components/DocumentReaderWorkspace.tsx'), /Uicons by Flaticon/);
  assert.match(read('src/components/MediaPlayerWorkspace.tsx'), /Uicons by Flaticon/);
});
