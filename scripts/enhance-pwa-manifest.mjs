import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(process.cwd(), 'dist/manifest.webmanifest');
if (!fs.existsSync(manifestPath)) {
  console.error('manifest.webmanifest não encontrado após o build.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.file_handlers = [
  {
    action: '/',
    name: 'Abrir com OrbiDoc',
    accept: {
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub'],
      'application/zip': ['.zip'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt', '.md'],
      'text/html': ['.html', '.htm'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/xml': ['.xml'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/avif': ['.avif'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tif', '.tiff'],
      'image/svg+xml': ['.svg']
    }
  }
];
manifest.handle_links = 'preferred';
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('OrbiDoc PWA manifest enriquecido com file_handlers.');
