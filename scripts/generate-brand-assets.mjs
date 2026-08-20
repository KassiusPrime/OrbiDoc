import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const render = (source, width) => new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng();
const standard = readFileSync('public/brand/orbidoc-app-icon.svg', 'utf8');
const maskable = readFileSync('public/brand/orbidoc-app-maskable.svg', 'utf8');
const symbol = readFileSync('public/brand/orbidoc-symbol-light.svg', 'utf8');

for (const [file, source, size] of [
  ['public/logo.png', standard, 512],
  ['public/logo-192.png', standard, 192],
  ['public/logo-512.png', standard, 512],
  ['public/logo-maskable-192.png', maskable, 192],
  ['public/logo-maskable-512.png', maskable, 512],
  ['public/apple-touch-icon.png', standard, 180],
  ['public/favicon-32.png', symbol, 32],
]) {
  writeFileSync(file, render(source, size));
}

console.log('OrbiDoc brand assets generated.');
