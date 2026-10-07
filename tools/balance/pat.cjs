const all = JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));
const want = (process.argv[3]||'average,good,expert').split(',');
const agg = {};
for (const key of Object.keys(all)){
  const sk = key.split(':')[1];
  for (const r of all[key]){
    agg[sk] = agg[sk] || { hits:{}, runs:{} };
    for (const id in r.cityHits) agg[sk].hits[id] = (agg[sk].hits[id]||0) + r.cityHits[id];
    for (const id in r.turretHits) agg[sk].hits[id] = (agg[sk].hits[id]||0) + r.turretHits[id];
    for (const id in r.runs) agg[sk].runs[id] = (agg[sk].runs[id]||0) + r.runs[id];
  }
}
const ids = new Set(); for (const sk of want) for (const id of Object.keys(Object.assign({}, agg[sk].runs, agg[sk].hits))) ids.add(id);
console.log('hits per 10 phrase-runs (city+turret)     ' + want.map(s => s.padStart(9)).join(''));
for (const id of [...ids].sort()){
  console.log(id.padEnd(40) + want.map(sk => { const h = agg[sk].hits[id]||0, r = agg[sk].runs[id]||0; return (r ? (10*h/r).toFixed(1) : (h? '('+h+')' : '-')).padStart(9); }).join(''));
}
