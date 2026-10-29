// Bundle src/native.js and put the store build of the game in www/, with the fonts on board (works offline).
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
mkdirSync('www', { recursive: true });
await build({ entryPoints: ['src/native.js'], bundle: true, format: 'iife', minify: true, outfile: 'www/native.js', target: 'es2020' });
cpSync('src/fonts', 'www/fonts', { recursive: true });
let html = readFileSync('dist-store/index.html', 'utf8');
const link = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
if (!link.test(html)) throw new Error('font link not found');
html = html.replace(link, '<link rel="stylesheet" href="fonts/fonts.css">');
writeFileSync('www/index.html', html);
console.log('www ready');
