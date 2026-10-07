'use strict';
// Choreography: waves are composed from named patterns with deliberate timing, not random spawns.
//
// A wave is a list of phrases. A phrase is one pattern (or two played together) followed by a gap.
// Patterns place enemies on a timeline: a missile aimed at a particular city lands at a known moment,
// a bomber drops its bombs over known columns. Learn the rhythm and you can pre-place blasts, hold
// fire for a pincer to close, or break a ripple in the middle. Everything is a plain data event, so
// a quick save can store what is still to come.
const choreo = { q: [], clock: 0, base: 0, phrases: [], gapT: 0, waited: 0, label: '', labelT: 0 };
let edgeWarns = [];                     // entry warnings for flyers: { side, y, t }

function choreoReset(){
  choreo.q = []; choreo.clock = 0; choreo.base = 0; choreo.phrases = []; choreo.gapT = 1.6; choreo.waited = 0;
  choreo.label = ''; choreo.labelT = 0; edgeWarns = [];
}
function later(delay, ev){ ev.t = choreo.clock + choreo.base + delay; choreo.q.push(ev); }
function runChoreoEvent(e){
  if (e.k === 'warn'){ edgeWarns.push({ side: e.side, y: e.y, t: 0 }); if (e.snd) sfx('warn'); }
  else spawnEnemy(e.type, e.x, e.y, e.vx, e.vy, e.o);
}
function choreoStep(dt){
  choreo.clock += dt;
  if (choreo.q.length){
    const due = choreo.q.filter(e => e.t <= choreo.clock);
    if (due.length){
      choreo.q = choreo.q.filter(e => e.t > choreo.clock);
      due.sort((a, b) => a.t - b.t);
      for (const e of due) runChoreoEvent(e);
    }
  }
  if (choreo.labelT > 0) choreo.labelT -= dt;
  for (const w of edgeWarns) w.t += dt;
  edgeWarns = edgeWarns.filter(w => w.t < 0.9);
}

// ---- Geometry helpers -------------------------------------------------------
// The columns that matter: every standing city and turret, left to right
function targetCols(){
  const a = installations.filter(i => i.alive).map(i => i.x).concat(turrets.filter(t => t.alive).map(t => t.x));
  a.sort((x, y) => x - y);
  return a.length ? a : [128];
}
const evenCols = (n, lo, hi) => Array.from({ length: n }, (_, i) => Math.round(n === 1 ? (lo + hi) / 2 : lo + (hi - lo) * i / (n - 1)));
function fallTime(type, y0){
  const T = ETYPES[type];
  return (GROUND - y0) / (T.vy * speedMul * speedOf(T) * (1 + MISSILE_BOOST / 2));
}
// A missile that comes down on column tx, drifting sideways at lat px/s on the way
function dropOn(type, tx, delay, lat, y0){
  const T = ETYPES[type];
  y0 = y0 === undefined ? -6 : y0;
  if (lat === undefined) lat = rnd(-14, 14);
  let x = tx - lat * fallTime(type, y0);
  x = clamp(x, 6, W - 6);
  lat = (tx - x) / fallTime(type, y0);
  later(delay, { k: 'spawn', type, x, y: y0, vx: lat, vy: T.vy * speedMul });
}
// Progress along the screen at which a flyer passes column col
const colProg = (col, fromLeft) => fromLeft ? (col + 14) / (W + 28) : (W + 14 - col) / (W + 28);
const flyY = () => Math.random() < 0.4 ? BOT + rndi(14, 84) : rndi(36, 118);
function flyer(type, fromLeft, y, delay, o){
  const T = ETYPES[type];
  later(delay, { k: 'warn', side: fromLeft ? 0 : 1, y, snd: !!(o && o.snd) });
  later(delay + 0.85, { k: 'spawn', type, x: fromLeft ? -14 : W + 14, y, vx: (fromLeft ? 1 : -1) * T.vx, vy: 0, o });
}
const sideSign = () => Math.random() < 0.5;

// ---- The patterns -----------------------------------------------------------------
// run(dw, off) schedules the pattern and returns how long its own events take.
const PAT = {
  // Missiles land on neighbouring columns one after another, left to right or back
  ripple: { name: 'RIPPLE', min: 1, w: 5, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(3 + Math.floor(dw / 4), 3, 7), step = Math.max(0.22, 0.44 - dw * 0.012);
    const seq = sideSign() ? xs : xs.slice().reverse();
    const type = dw >= 7 && Math.random() < 0.4 ? 'icbm' : 'ipbm';
    for (let i = 0; i < n; i++) dropOn(type, seq[i % seq.length], 0.3 + i * step, rnd(-8, 8));
    return 0.3 + n * step;
  } },
  // Two missiles come in from opposite sides and close on the same column: wait for them to meet
  pincer: { name: 'PINCER', min: 1, w: 4, kind: 'm', run(dw){
    const xs = targetCols(), pairs = clamp(1 + Math.floor(dw / 5), 1, 3);
    for (let p = 0; p < pairs; p++){
      const tx = pick(xs), d = p * 1.15 + 0.3, lat = 26 + dw;
      dropOn('ipbm', tx, d, lat); dropOn('ipbm', tx, d, -lat);
    }
    return pairs * 1.15 + 0.3;
  } },
  // A downpour of small missiles at random columns, hard and brief
  rain: { name: 'RAIN', min: 2, w: 3, kind: 'm', run(dw){
    const n = clamp(6 + Math.floor(dw * 0.8), 6, 16), xs = targetCols();
    let t = 0.2;
    for (let i = 0; i < n; i++){
      dropOn(Math.random() < 0.75 ? 'mini' : 'ipbm', clamp(pick(xs) + rnd(-20, 20), 8, W - 8), t);
      t += rnd(0.12, 0.34);
    }
    return t;
  } },
  // A bomber crosses and drops a stick of bombs over fixed columns, sometimes with a gap
  stick: { name: 'BOMBING RUN', min: 1, w: 5, kind: 'f', run(dw){
    const left = sideSign(), type = dw >= 9 ? 'carrier' : (dw >= 5 ? 'gunner' : 'bomber');
    const n = clamp(3 + Math.floor(dw / 5), 3, 6);
    let cols = evenCols(n, 40, 216);
    if (dw >= 4 && cols.length > 3) cols.splice(rndi(1, cols.length - 2), 1);          // the gap
    const drops = cols.map(c => colProg(c, left)).sort((a, b) => a - b);
    flyer(type, left, flyY(), 0, { drops, snd: true });
    return 2.6;
  } },
  // Two scouts cross from opposite sides and arrive over the middle together
  crossing: { name: 'CROSSFIRE', min: 2, w: 3, kind: 'f', run(dw){
    const c = clamp(1 + Math.floor(dw / 6), 1, 3);
    for (let i = 0; i < c; i++){
      const d = i * 1.5, off = rnd(-30, 30), y1 = rndi(40, 80), y2 = rndi(90, 130);
      flyer('scout', true,  y1, d, { drops: [colProg(128 + off, true)],  snd: i === 0 });
      flyer('scout', false, y2, d, { drops: [colProg(128 + off, false)] });
    }
    return c * 1.5 + 0.8;
  } },
  // Vertical ships zig-zag in from alternating sides
  sweep: { name: 'SWEEP', min: 2, w: 3, kind: 'f', run(dw){
    const n = clamp(2 + Math.floor(dw / 4), 2, 5);
    let left = sideSign();
    for (let i = 0; i < n; i++){
      later(i * 0.8, { k: 'spawn', type: 'smart', x: left ? -14 : W + 14, y: rndi(14, 90), vx: (left ? 1 : -1) * ETYPES.smart.vx, vy: ETYPES.smart.vy * speedMul });
      left = !left;
    }
    return n * 0.8;
  } },
  // Scouts in a V: their bombs fall one after another across the screen
  vee: { name: 'SQUADRON', min: 3, w: 3, kind: 'f', run(dw){
    const n = clamp(3 + Math.floor(dw / 8), 3, 5), left = sideSign(), mid = (n - 1) / 2, base = rndi(60, 90);
    for (let i = 0; i < n; i++){
      const col = 128 + (i - mid) * 44;
      flyer('scout', left, clamp(base + Math.abs(i - mid) * 14, 36, 130), i * 0.32, { drops: [colProg(col, left)], snd: i === 0 });
    }
    return n * 0.32 + 1.2;
  } },
  // Two shielded missiles with their shields out of step: shoot whichever is open
  aegisPair: { name: 'AEGIS PAIR', min: 3, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), a = pick(xs);
    let b = pick(xs); for (let k = 0; k < 4 && Math.abs(b - a) < 30; k++) b = pick(xs);
    const T = ETYPES.aegis;
    later(0.4, { k: 'spawn', type: 'aegis', x: a, y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 0 } });
    later(0.4, { k: 'spawn', type: 'aegis', x: b, y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 2 } });
    if (dw >= 9){ later(1.6, { k: 'spawn', type: 'aegis', x: pick(xs), y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 1 } }); }
    return 1.8;
  } },
  // Parachutes drop in a staggered line; each splits into three just under the clouds
  chutes: { name: 'PARACHUTES', min: 3, w: 3, kind: 'm', run(dw){
    const n = clamp(2 + Math.floor(dw / 5), 2, 4), cols = evenCols(n, 40, 216);
    if (Math.random() < 0.5) cols.reverse();
    for (let i = 0; i < n; i++) later(0.3 + i * 0.6, { k: 'spawn', type: 'chute', x: cols[i], y: -6, vx: rnd(-6, 6), vy: ETYPES.chute.vy * speedMul });
    return n * 0.6 + 0.4;
  } },
  // Big, slow ordnance, one at a time, with room to deal with each
  heavyHit: { name: 'HEAVY ORDNANCE', min: 4, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(1 + Math.floor(dw / 8), 1, 3);
    const types = dw >= 10 ? ['colbomb', 'rowbomb', 'heavy', 'icbm'] : ['heavy', 'icbm', 'midsplit'];
    for (let i = 0; i < n; i++) dropOn(pick(types), pick(xs), 0.3 + i * 2.0, rnd(-10, 10));
    return n * 2.0;
  } },
  // A whole formation at once
  wall: { name: 'WALL', min: 2, w: 3, kind: 'm', run(dw){
    const pool = typePool(dw, currentEnv).filter(t => !ETYPES[t].passing && !ETYPES[t].noCluster && !ETYPES[t].shield);
    const t = pick(pool.length ? pool : ['ipbm']);
    const pts = formationPoints(pickFormation(dw), clamp(4 + Math.floor(dw / 4), 4, 8), rndi(50, W - 50), rndi(8, 30));
    for (const p of pts) later(0.3, { k: 'spawn', type: t, x: p.x, y: p.y });
    return 1.0;
  } },
  // A platform comes in under the clouds with an escort of scouts
  platformRaid: { name: 'PLATFORM', min: 4, w: 2, kind: 'f', run(dw){
    const left = sideSign();
    flyer('platform', left, BOT + rndi(14, 34), 0, { snd: true });
    flyer('scout', left, rndi(50, 100), 1.2, { drops: [colProg(100, left)] });
    flyer('scout', left, rndi(50, 100), 1.8, { drops: [colProg(160, left)] });
    return 3.0;
  } },
  // A carrier with heavy bombs on a strict rhythm and an escort
  raid: { name: 'AIR RAID', min: 7, w: 2, kind: 'f', run(dw){
    const left = sideSign(), cols = evenCols(4, 50, 206);
    flyer('carrier', left, rndi(44, 90), 0, { drops: cols.map(c => colProg(c, left)), snd: true });
    flyer('scout', !left, rndi(50, 120), 1.5, { drops: [colProg(128, !left)] });
    return 3.4;
  } },
};
// What each world leans on
const THEME = [
  { ripple: 2, pincer: 1.6, stick: 1.5 },
  { rain: 2, stick: 1.6, sweep: 1.6 },
  { heavyHit: 2, wall: 1.6, crossing: 1.6 },
  { chutes: 2, aegisPair: 2, sweep: 1.4 },
  { platformRaid: 2, raid: 1.6, vee: 1.6, pincer: 1.4 },
];
const weightedPick = (ids, w) => {
  let tot = 0; for (const id of ids) tot += w(id);
  let r = Math.random() * tot;
  for (const id of ids){ r -= w(id); if (r <= 0) return id; }
  return ids[ids.length - 1];
};

// ---- Composing a wave ------------------------------------------------------------------
// Opens with an easy statement of a motif, answers it with a second pattern, builds with the two
// played together, rests, and finishes on the strongest thing the wave knows.
function composeWave(dw, world, isBoss, isShort, forceCount){
  const avail = Object.keys(PAT).filter(id => PAT[id].min <= dw);
  const wt = id => PAT[id].w * ((THEME[world] || {})[id] || 1);
  const missiles = avail.filter(id => PAT[id].kind === 'm'), flyers = avail.filter(id => PAT[id].kind === 'f');
  let count = forceCount || (isShort ? 2 : clamp(4 + Math.floor(dw * 0.5), 4, 11) + (isBoss ? 2 : 0));
  if (modHeavy) count = Math.ceil(count * 1.4);
  const A = weightedPick(missiles, wt);
  const B = flyers.length ? weightedPick(flyers, wt) : A;
  const C = weightedPick(avail, wt);
  const gapBase = Math.max(1.4, 3.1 - dw * 0.08);
  const out = [];
  for (let i = 0; i < count; i++){
    const stage = count > 1 ? i / (count - 1) : 1;
    let ids, gap = gapBase * rnd(0.9, 1.15), bump = Math.round(stage * 2);
    if (i === 0){ ids = [A]; bump = 0; gap += 0.6; }
    else if (i === count - 1 && count > 3){ ids = [A, B]; bump += 1; gap = 1.2; }
    else if (i % 3 === 2){ ids = [A, B]; gap += 0.9; }                   // call and response, then a breather
    else if (Math.random() < 0.25) ids = [C];
    else ids = [i % 2 ? B : A];
    if (isShort && i === 0) ids = [B];
    out.push({ ids: [...new Set(ids)], gap, bump, offset: 1.1 });
  }
  return out;
}
function runPhrase(ph, dw){
  let dur = 0; const names = [];
  ph.ids.forEach((id, i) => {
    choreo.base = i * ph.offset;
    dur = Math.max(dur, PAT[id].run(dw + (ph.bump || 0)) + choreo.base);
    names.push(PAT[id].name);
  });
  choreo.base = 0;
  choreo.label = names.join(' + '); choreo.labelT = 2.2;
  return dur;
}
// Starts the next phrase when its turn comes; returns true on the frame one starts.
// It waits a little if the sky is already crowded.
function phraseStep(dt, dw, bossNow){
  choreo.gapT -= dt * (bossNow && bossNow.state === 'fight' ? 0.75 : 1);
  if (choreo.gapT > 0 || !choreo.phrases.length) return false;
  if (fallingCount() > 7 + Math.floor(dw / 2) && choreo.waited < 3){ choreo.waited += dt; return false; }
  choreo.waited = 0;
  const ph = choreo.phrases.shift();
  choreo.gapT = runPhrase(ph, dw) + ph.gap;
  return true;
}
