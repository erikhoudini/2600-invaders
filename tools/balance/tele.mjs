import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2]);
const worlds = (process.argv[3] || '0,1,2,3,4').split(',').map(Number);
const skills = (process.argv[4] || 'expert,good,average,novice').split(',');
const reps = Number(process.argv[5] || 2);
const url = process.argv[6] || 'http://127.0.0.1:8770/index.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 512, height: 816 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto(url); await p.waitForTimeout(500);
await p.addScriptTag({ content: fs.readFileSync(new URL('./bot.js', import.meta.url), 'utf8') });
const all = {};
for (const w of worlds) for (const sk of skills){
  const runs = [];
  for (let r = 0; r < reps; r++) runs.push(await p.evaluate(([w, sk, DIFF]) => { for (const k of ['cityHits', 'turretHits', 'runs']) for (const id in tele[k]) delete tele[k][id]; opts.difficulty = DIFF; const res = playWorld(w, sk, 8); res.cityHits = Object.assign({}, tele.cityHits); res.turretHits = Object.assign({}, tele.turretHits); res.runs = Object.assign({}, tele.runs); return res; }, [w, sk, Number(process.argv[8] || 1)]));
  all[w + ':' + sk] = runs;
}
fs.writeFileSync(process.argv[7] || 'tele.json', JSON.stringify(all));
// summary table
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('world/skill', 16), pad('waves', 7), pad('cities lost per wave (avg of runs)', 44), 'idle%  secs/wave  end cities  over');
for (const key of Object.keys(all)){
  const runs = all[key]; const nW = 8;
  const lost = Array.from({ length: nW }, (_, i) => { const v = runs.map(r => r.rec[i] ? r.rec[i].lost : null).filter(x => x !== null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '-'; });
  const recs = runs.flatMap(r => r.rec);
  const avg = f => recs.length ? Math.round(recs.reduce((a, r) => a + f(r), 0) / recs.length) : 0;
  console.log(pad(key, 16), pad(runs.map(r => r.wavesDone).join('/'), 7), pad(lost.join(' '), 44), pad(avg(r => r.idlePct), 6), pad(avg(r => r.secs), 10), pad(runs.map(r => r.citiesEnd).join('/'), 11), runs.map(r => r.over ? 'X' : '.').join(''));
}
console.log('errors:', JSON.stringify(errs));
await b.close();
