// Builds docs/xtari-look.html: the Xtari look guide, a single self-contained page. The palette and
// every sprite on it are read from the game's own source, so the guide cannot drift from the game.
//   node tools/make_doc.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const pBlock = read('src/core.js').match(/const P = \{[\s\S]*?\n\};/)[0];
const sprites = read('src/sprites.js').replace(/^'use strict';\n/, '');
const tpl = read('tools/xtari-template.html');
const out = tpl.replace('/*GAME_SOURCE*/', () => `${pBlock}\nconst SPR = {};\n${sprites}`);
fs.writeFileSync(path.join(root, 'docs', 'xtari-look.html'), out);
console.log('wrote docs/xtari-look.html (' + (out.length / 1024).toFixed(0) + ' KB)');
