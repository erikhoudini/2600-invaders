import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2]);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 512, height: 816 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8770/index.html'); await p.waitForTimeout(500);
await p.addScriptTag({ content: fs.readFileSync(new URL('./bot.js', import.meta.url), 'utf8') });
for (const sk of ['expert', 'good', 'average', 'novice']){
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await p.evaluate(sk => playEndless(sk, 900), sk));
  console.log(sk.padEnd(8), 'survived(s):', runs.map(r => r.survived + (r.over ? 'X' : '+')).join(' '), ' idle%:', runs.map(r => r.idlePct).join('/'), ' cities@2/4/6/8min:', runs.map(r => [2,4,6,8].map(m => { const k = r.marks.find(x => x.t >= m * 60 - 1); return k ? k.cities : '-'; }).join(',')).join(' | '));
}
console.log('errors', JSON.stringify(errs));
await b.close();
