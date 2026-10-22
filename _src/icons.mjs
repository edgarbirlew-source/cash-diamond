// Draws the app icons with canvas in headless Chromium and saves PNGs to dist/icons.
import { chromium } from 'playwright';
import fs from 'fs';

const draw = `(size, safe) => {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const s = size / 512, INK = '#22170f';
  x.scale(s, s);
  // sky-blue background with 90s stripes
  x.fillStyle = '#1d4fa3'; x.fillRect(0, 0, 512, 512);
  x.save(); x.globalAlpha = .12; x.fillStyle = '#fff';
  for (let k = -512; k < 1024; k += 56) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 28, 0); x.lineTo(k + 28 - 512, 512); x.lineTo(k - 512, 512); x.fill(); }
  x.restore();
  const z = safe ? 0.78 : 1; x.translate(256, 256); x.scale(z, z); x.translate(-256, -256);
  // gold diamond behind the ball
  x.beginPath(); x.moveTo(256, 40); x.lineTo(472, 256); x.lineTo(256, 472); x.lineTo(40, 256); x.closePath();
  x.fillStyle = '#ffd23f'; x.fill(); x.lineWidth = 18; x.strokeStyle = INK; x.stroke();
  // baseball
  x.beginPath(); x.arc(256, 256, 150, 0, 7); x.fillStyle = '#fff6d6'; x.fill(); x.lineWidth = 16; x.stroke();
  x.save(); x.beginPath(); x.arc(256, 256, 142, 0, 7); x.clip();
  x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.arc(286, 286, 150, 0, 7); x.fill(); x.restore();
  x.strokeStyle = '#e8392e'; x.lineWidth = 9; x.lineCap = 'round';
  for (const side of [-1, 1]) {
    x.beginPath(); x.arc(256 + side * 215, 256, 150, Math.PI - .78 + (side > 0 ? 0 : Math.PI), Math.PI + .78 + (side > 0 ? 0 : Math.PI)); x.stroke();
    for (let t = -0.62; t <= 0.63; t += 0.155) {
      const a = (side > 0 ? Math.PI : 0) + t, cx = 256 + side * 215 + Math.cos(a) * 150, cy = 256 + Math.sin(a) * 150;
      const nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx;
      x.beginPath(); x.moveTo(cx - nx * 16 - tx * 6, cy - ny * 16 - ty * 6); x.lineTo(cx + nx * 2 + tx * 6, cy + ny * 2 + ty * 6); x.stroke();
    }
  }
  // green cash badge
  x.beginPath(); x.arc(370, 372, 78, 0, 7); x.fillStyle = '#3fae5a'; x.fill(); x.lineWidth = 14; x.strokeStyle = INK; x.stroke();
  x.font = '900 118px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 14; x.strokeText('$', 370, 378); x.fillStyle = '#fff'; x.fillText('$', 370, 378);
  return c.toDataURL('image/png').split(',')[1];
}`;

const b = await chromium.launch(); const p = await b.newPage();
fs.mkdirSync('dist/icons', { recursive: true });
for (const [name, size, safe] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['maskable-512', 512, 1], ['apple-touch-icon', 180, 0]]) {
  const data = await p.evaluate(`(${draw})(${size}, ${safe})`);
  fs.writeFileSync(`dist/icons/${name}.png`, Buffer.from(data, 'base64'));
}
await b.close(); console.log('icons done');
