// One-off script: regenerate PWA icons from public/logo simple.svg.
// Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const src = resolve(root, 'public', 'logo simple.svg');
const outDir = resolve(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const bg = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a, matches manifest background_color

async function render(size, filename, padPct = 0) {
  const inner = Math.round(size * (1 - padPct * 2));
  const offset = Math.round((size - inner) / 2);
  const logo = await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(resolve(outDir, filename));
  console.log(`wrote ${filename}`);
}

await render(192, 'icon-192.png', 0.10);
await render(512, 'icon-512.png', 0.10);
// Maskable: Android crops to a circle, so logo must sit inside an 80% safe zone.
await render(512, 'icon-maskable-512.png', 0.20);
