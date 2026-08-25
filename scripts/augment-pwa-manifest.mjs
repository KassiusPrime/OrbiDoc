import fs from 'node:fs/promises';
import path from 'node:path';

const manifestPath = path.resolve('dist/manifest.json');
const legacyManifestPath = path.resolve('dist/manifest.webmanifest');

const fileHandlers = [{
  action: '/',
  accept: {
    'application/pdf': ['.pdf'],
    'application/epub+zip': ['.epub'],
    'application/zip': ['.zip'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/plain': ['.txt', '.md', '.markdown', '.csv', '.log'],
    'text/html': ['.html', '.htm'],
    'application/json': ['.json'],
    'application/xml': ['.xml'],
    'text/xml': ['.xml'],
    'text/css': ['.css'],
    'text/javascript': ['.js', '.jsx', '.ts', '.tsx'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg', '.jfif'],
    'image/webp': ['.webp'],
    'image/avif': ['.avif'],
    'image/gif': ['.gif'],
    'image/bmp': ['.bmp'],
    'image/tiff': ['.tif', '.tiff'],
    'image/svg+xml': ['.svg'],
  },
}];

try {
  const source = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(source);
  manifest.file_handlers = fileHandlers;
  manifest.launch_handler = { client_mode: ['focus-existing', 'auto'] };

  const normalized = `${JSON.stringify(manifest, null, 2)}\n`;
  await Promise.all([
    fs.writeFile(manifestPath, normalized, 'utf8'),
    fs.writeFile(legacyManifestPath, normalized, 'utf8'),
  ]);

  console.log(`PWA manifest: canonical /manifest.json + legacy /manifest.webmanifest synchronized; ${Object.keys(fileHandlers[0].accept).length} MIME groups registered.`);
} catch (error) {
  console.error('Failed to augment PWA manifest with file handlers:', error);
  process.exitCode = 1;
}
