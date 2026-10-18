// Validates the bitmap font and sprite tables: consistent row widths, legal
// characters and glyph heights. Run: node tests/check-assets.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ({}) });
const ctx = { window: {}, document: { createElement: fakeCanvas }, performance: { now: () => 0 } };
ctx.window.PPT = { Gfx: { C: {} } };
vm.createContext(ctx);
for (const f of ['font.js', 'sprites.js', 'mascot.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
}
const PPT = ctx.window.PPT;
let errors = 0;
const fail = (msg) => { console.error('FAIL ' + msg); errors++; };

for (const [ch, g] of Object.entries(PPT.Font.glyphs)) {
  if (g.rows.length > 9) fail(`glyph ${JSON.stringify(ch)} has ${g.rows.length} rows (max 9)`);
  if (g.w > 5) fail(`glyph ${JSON.stringify(ch)} is ${g.w}px wide (max 5)`);
  g.rows.forEach((r) => { if (/[^#.]/.test(r)) fail(`glyph ${JSON.stringify(ch)} has illegal chars in "${r}"`); });
}
for (let c = 32; c < 127; c++) {
  if (!PPT.Font.supports(String.fromCharCode(c)) && !'{}'.includes(String.fromCharCode(c))) {
    fail(`printable ASCII ${JSON.stringify(String.fromCharCode(c))} missing`);
  }
}
for (const [name, rows] of Object.entries(PPT.Sprites.DATA)) {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) fail(`sprite ${name} row ${i} is ${r.length} wide, expected ${w}`);
    if (/[^kmhsw.]/.test(r)) fail(`sprite ${name} row ${i} has illegal chars`);
  });
}
for (const [name, rows] of Object.entries(PPT.Tally.P)) {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) fail(`mascot pattern ${name} row ${i} is ${r.length} wide, expected ${w}`);
    if (/[^kmhswrx.]/.test(r)) fail(`mascot pattern ${name} row ${i} has illegal chars`);
  });
}
console.log(errors ? `${errors} problem(s)` : `OK: ${Object.keys(PPT.Font.glyphs).length} glyphs, ${Object.keys(PPT.Sprites.DATA).length} sprites, ${Object.keys(PPT.Tally.P).length} mascot patterns`);
process.exit(errors ? 1 : 0);
