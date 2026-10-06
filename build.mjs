// Bundles the project into one self-contained HTML file (dist/strela-10.html):
// CSS and scripts inlined, PNGs embedded as data URIs. Handy for sharing the game
// as a single file; development doesn't need it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href).trimEnd()}\n</style>`);

// Scripts concatenate in page order, wrapped in one function like a classic bundle.
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>\n?/g)].map(m => m[1]);
let js = srcs.map(s => read(s).replace(/^'use strict';\n/, '')).join('\n');
js = js.replace(/'(assets\/[^']+\.png)'/g, (_, p) =>
  `'data:image/png;base64,${fs.readFileSync(path.join(root, p)).toString('base64')}'`);
html = html.replace(/<script src="[^"]+"><\/script>\n?/g, '');
html = html.replace('</body>', `<script>\n(() => {\n'use strict';\n${js}\n})();\n</script>\n</body>`);

// The gallery builds its image paths at runtime, so embed every poster as a data URI in a lookup table
const galDir = path.join(root, 'assets', 'gallery');
const gallery = {};
if (fs.existsSync(galDir)){
  for (const f of fs.readdirSync(galDir).sort()) if (f.endsWith('.png')) gallery[f.slice(0, -4)] = 'data:image/png;base64,' + fs.readFileSync(path.join(galDir, f)).toString('base64');
}
html = html.replace('<script>\n(() => {', `<script>\nconst GALLERY_DATA = ${JSON.stringify(gallery)};\n</script>\n<script>\n(() => {`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'strela-10.html');
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
