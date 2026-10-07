'use strict';
// Choreography: waves are composed from named patterns with deliberate timing, not random spawns.
//
// A wave is a list of phrases. A phrase is one pattern (or two played together) followed by a gap.
// Patterns place enemies on a timeline: a missile aimed at a particular city lands at a known moment,
// a bomber drops its bombs over known columns. Learn the rhythm and you can pre-place blasts, hold
// fire for a pincer to close, or break a ripple in the middle. Everything is a plain data event, so
// a quick save can store what is still to come.
const tele = { runs: {}, cityHits: {}, turretHits: {} };     // per-pattern counts, read by the balance tests
const choreo = { ambT: 3, ran: false, patId: '', q: [], clock: 0, base: 0, phrases: [], gapT: 0, waited: 0, label: '', labelT: 0 };
let edgeWarns = [];                     // entry warnings for flyers: { side, y, t }

function choreoReset(){
  choreo.ambT = 3; choreo.ran = false; choreo.q = []; choreo.clock = 0; choreo.base = 0; choreo.phrases = []; choreo.gapT = 1.6; choreo.waited = 0;
  choreo.label = ''; choreo.labelT = 0; edgeWarns = [];
}
function later(delay, ev){ ev.t = choreo.clock + choreo.base + delay; ev.pat = choreo.patId; choreo.q.push(ev); }
function runChoreoEvent(e){
  if (e.k === 'warn'){ edgeWarns.push({ side: e.side, y: e.y, t: 0 }); if (e.snd) sfx('warn'); }
  else spawnEnemy(e.type, e.x, e.y, e.vx, e.vy, Object.assign({ pat: e.pat }, e.o));
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
function dropOn(type, tx, delay, lat, y0, o){
  const T = ETYPES[type];
  y0 = y0 === undefined ? -6 : y0;
  if (lat === undefined) lat = rnd(-14, 14);
  const ft = fallTime(type, y0);
  let x = tx - lat * ft, sway = 0;
  if (T.wave){                                          // a weaver's sway is known in advance, so aim off by exactly that
    const f = T.wave[1], A = T.wave[0] / f, p0 = ((o && o.ph) || 0) * f / 3;
    sway = A * (Math.sin(p0 + f * ft) - Math.sin(p0));
  }
  x = clamp(x - sway, 6, W - 6);
  lat = (tx - sway - x) / ft;
  later(delay, { k: 'spawn', type, x, y: y0, vx: lat, vy: T.vy * speedMul, o });
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
// run(dw) schedules the pattern and returns how long its own events take. Each one has a minimum
// difficulty and grows with it: more of them, faster, and eventually in combination.
const PAT = {
  // Missiles land on neighbouring columns one after another. Later, a second ripple runs the other way.
  ripple: { name: 'RIPPLE', min: 1, w: 5, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(3 + Math.floor(dw / 3), 3, 9), step = Math.max(0.16, 0.44 - dw * 0.016);
    const fwd = sideSign(), seq = fwd ? xs : xs.slice().reverse();
    const type = i => (dw >= 7 && i === n - 1) ? 'heavy' : (dw >= 5 && i % 4 === 3 ? 'icbm' : 'ipbm');
    for (let i = 0; i < n; i++) dropOn(type(i), seq[i % seq.length], 0.3 + i * step, rnd(-8, 8));
    if (dw >= 8){                                           // the counter-ripple, meeting it in the middle
      const back = seq.slice().reverse();
      for (let i = 0; i < n - 1; i++) dropOn('ipbm', back[i % back.length], 0.5 + i * step, rnd(-8, 8));
    }
    return 0.5 + n * step;
  } },
  // Two missiles come in from opposite sides and close on the same column: wait for them to meet
  pincer: { name: 'PINCER', min: 1, w: 4, kind: 'm', run(dw){
    const xs = targetCols(), pairs = clamp(1 + Math.floor(dw / 4), 1, 4);
    for (let p = 0; p < pairs; p++){
      const tx = pick(xs), d = p * Math.max(0.8, 1.15 - dw * 0.02) + 0.3, lat = 26 + dw * 1.2;
      const type = dw >= 9 && p % 2 ? 'icbm' : 'ipbm';
      dropOn(type, tx, d, lat); dropOn(type, tx, d, -lat);
    }
    return pairs * 1.0 + 0.3;
  } },
  // A downpour of small missiles at random columns, hard and brief
  rain: { name: 'RAIN', min: 3, w: 3, kind: 'm', run(dw){
    const n = clamp(6 + Math.floor(dw * 1.1), 6, 24), xs = targetCols();
    let t = 0.2;
    for (let i = 0; i < n; i++){
      dropOn(Math.random() < 0.75 ? 'mini' : 'ipbm', clamp(pick(xs) + rnd(-20, 20), 8, W - 8), t);
      t += rnd(0.1, 0.3) * Math.max(0.6, 1 - dw * 0.02);
    }
    return t;
  } },
  // A bomber crosses and drops a stick of bombs over fixed columns, sometimes with a gap
  stick: { name: 'BOMBING RUN', min: 1, w: 5, kind: 'f', run(dw){
    const type = dw >= 9 ? 'carrier' : (dw >= 5 ? 'gunner' : 'bomber');
    const n = clamp(3 + Math.floor(dw / 4), 3, 7);
    const mk = left => {
      let cols = evenCols(n, 40, 216);
      if (dw >= 4 && cols.length > 3) cols.splice(rndi(1, cols.length - 2), 1);          // the gap
      return cols.map(c => colProg(c, left)).sort((a, b) => a - b);
    };
    const left = sideSign();
    flyer(type, left, flyY(), 0, { drops: mk(left), snd: true });
    if (dw >= 10) flyer('bomber', !left, flyY(), 1.4, { drops: mk(!left) });            // and one from the other side
    return dw >= 10 ? 3.6 : 2.6;
  } },
  // Scouts cross from opposite sides and arrive over the same column together
  crossing: { name: 'CROSSFIRE', min: 2, w: 3, kind: 'f', run(dw){
    const c = clamp(1 + Math.floor(dw / 5), 1, 4);
    for (let i = 0; i < c; i++){
      const d = i * 1.4, off = rnd(-30, 30), y1 = rndi(40, 80), y2 = rndi(90, 130);
      flyer('scout', true,  y1, d, { drops: [colProg(128 + off, true)],  snd: i === 0 });
      flyer('scout', false, y2, d, { drops: [colProg(128 + off, false)] });
      if (dw >= 8) flyer('scout', Math.random() < 0.5, BOT + rndi(20, 70), d + 0.4, { drops: [colProg(128 + off + rnd(-40, 40), true)] });
    }
    return c * 1.4 + 0.8;
  } },
  // Vertical ships zig-zag in from alternating sides
  sweep: { name: 'SWEEP', min: 3, w: 3, kind: 'f', run(dw){
    const n = clamp(2 + Math.floor(dw / 3), 2, 7), step = Math.max(0.45, 0.8 - dw * 0.015);
    let left = sideSign();
    for (let i = 0; i < n; i++){
      later(i * step, { k: 'spawn', type: 'smart', x: left ? -14 : W + 14, y: rndi(14, 90), vx: (left ? 1 : -1) * ETYPES.smart.vx, vy: ETYPES.smart.vy * speedMul });
      left = !left;
    }
    return n * step;
  } },
  // Scouts in a V: their bombs fall one after another across the screen
  vee: { name: 'SQUADRON', min: 3, w: 3, kind: 'f', run(dw){
    const n = clamp(3 + 2 * Math.floor(dw / 8), 3, 7), left = sideSign(), mid = (n - 1) / 2, base = rndi(60, 90);
    for (let i = 0; i < n; i++){
      const col = 128 + (i - mid) * (n > 5 ? 32 : 44);
      flyer('scout', left, clamp(base + Math.abs(i - mid) * 14, 36, 130), i * 0.3, { drops: [colProg(col, left)], snd: i === 0 });
    }
    return n * 0.3 + 1.2;
  } },
  // Two shielded missiles with their shields out of step: shoot whichever is open
  aegisPair: { name: 'AEGIS PAIR', min: 5, w: 2, kind: 'm', run(dw){
    const xs = targetCols(), a = pick(xs);
    let b = pick(xs); for (let k = 0; k < 4 && Math.abs(b - a) < 30; k++) b = pick(xs);
    const T = ETYPES.aegis;
    later(0.4, { k: 'spawn', type: 'aegis', x: a, y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 0 } });
    later(0.4, { k: 'spawn', type: 'aegis', x: b, y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 2 } });
    if (dw >= 9) later(1.6, { k: 'spawn', type: 'aegis', x: pick(xs), y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 1 } });
    if (dw >= 14) later(2.8, { k: 'spawn', type: 'aegis', x: pick(xs), y: -6, vx: 0, vy: T.vy * speedMul, o: { shI: 3 } });
    return dw >= 14 ? 3.0 : (dw >= 9 ? 1.8 : 0.8);
  } },
  // Weavers snake sideways as they fall, in a travelling wave: the snaking nets out, so each still lands on its column
  weave: { name: 'WEAVERS', min: 2, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(3 + Math.floor(dw / 3), 3, 8), step = Math.max(0.3, 0.62 - dw * 0.012), seq = sideSign() ? xs : xs.slice().reverse();
    for (let i = 0; i < n; i++) dropOn(dw >= 12 && i % 3 === 2 ? 'icbm' : 'weaver', seq[i % seq.length], 0.3 + i * step, 0, undefined, { ph: i * 0.9 });
    return 0.5 + n * step;
  } },
  // Phantoms fade out together on a fixed beat and cannot be hit while faded: fire as they come back
  ghosts: { name: 'PHANTOMS', min: 4, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(3 + Math.floor(dw / 4), 3, 7);
    for (let i = 0; i < n; i++) dropOn('phantom', xs[i % xs.length], 0.3 + i * 0.25, rnd(-6, 6));
    return 0.5 + n * 0.25;
  } },
  // Divers cruise in, stop and flash with a line to their target, then dive at it: shoot them while they hang
  dive: { name: 'DIVERS', min: 3, w: 3, kind: 'f', run(dw){
    const xs = targetCols(), n = clamp(1 + Math.floor(dw / 5), 1, 4);
    for (let i = 0; i < n; i++){
      const left = sideSign(), tx = pick(xs), y = rndi(26, 90);
      flyer('diver', left, y, i * 1.1, { target: tx, diveAt: Math.min(0.97, colProg(tx + (left ? -45 : 45), left)), snd: i === 0 });
    }
    return n * 1.1 + 1.8;
  } },
  // A sapper crosses and hangs orbital walls in the sky; missiles that follow bounce off them
  bulwark: { name: 'ORBITAL WALLS', min: 7, w: 3, kind: 'f', run(dw){
    const left = sideSign(), xs = targetCols();
    flyer('sapper', left, rndi(22, 56), 0, { snd: true });
    if (dw >= 14) flyer('sapper', !left, rndi(22, 56), 1.8);
    const n = clamp(4 + Math.floor(dw / 4), 4, 8);
    for (let i = 0; i < n; i++) dropOn(i % 3 === 2 ? 'icbm' : 'ipbm', xs[(i * 2) % xs.length], 3.4 + i * 0.4, rnd(-8, 8));
    return 3.4 + n * 0.4;
  } },
  // Parachutes drop in a staggered line; each splits into three just under the clouds
  chutes: { name: 'PARACHUTES', min: 4, w: 3, kind: 'm', run(dw){
    const n = clamp(2 + Math.floor(dw / 4), 2, 5), cols = evenCols(n, 40, 216);
    if (Math.random() < 0.5) cols.reverse();
    for (let i = 0; i < n; i++) later(0.3 + i * 0.6, { k: 'spawn', type: 'chute', x: cols[i], y: -6, vx: rnd(-6, 6), vy: ETYPES.chute.vy * speedMul });
    return n * 0.6 + 0.4;
  } },
  // Big, slow ordnance, one at a time, with room to deal with each
  heavyHit: { name: 'HEAVY ORDNANCE', min: 5, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(1 + Math.floor(dw / 6), 1, 4), sp = Math.max(1.0, 2.0 - dw * 0.04);
    const types = dw >= 10 ? ['colbomb', 'rowbomb', 'heavy', 'icbm'] : ['heavy', 'icbm', 'midsplit'];
    for (let i = 0; i < n; i++) dropOn(pick(types), pick(xs), 0.3 + i * sp, rnd(-10, 10));
    return n * sp;
  } },
  // A whole formation at once
  wall: { name: 'WALL', min: 2, w: 3, kind: 'm', run(dw){
    const pool = typePool(dw, currentEnv).filter(t => !ETYPES[t].passing && !ETYPES[t].noCluster && !ETYPES[t].shield);
    const t = pick(pool.length ? pool : ['ipbm']);
    const pts = formationPoints(pickFormation(dw), clamp(4 + Math.floor(dw / 3), 4, 10), rndi(50, W - 50), rndi(8, 30));
    for (const p of pts) later(0.3, { k: 'spawn', type: t, x: p.x, y: p.y });
    return 1.0;
  } },
  // TIMED STRIKE: missiles of different weights are launched at different moments so that they all
  // land at once. The slow heavy one is already on its way when the fast ones appear.
  synchro: { name: 'TIMED STRIKE', min: 6, w: 4, kind: 'm', run(dw){
    const xs = targetCols().slice(), n = clamp(3 + Math.floor(dw / 5), 3, 6);
    for (let i = xs.length - 1; i > 0; i--){ const j = rndi(0, i); [xs[i], xs[j]] = [xs[j], xs[i]]; }
    const types = ['heavy', 'icbm', 'ipbm', 'mini', 'ipbm', 'mini'].slice(0, n);
    const fts = types.map(t => fallTime(t, -6)), T = Math.max(...fts) + 0.5;
    types.forEach((t, i) => dropOn(t, xs[i % xs.length], T - fts[i], 0));
    return T - Math.min(...fts);
  } },
  // Three volleys: the odd columns, the even columns, then everything
  barrage: { name: 'BARRAGE', min: 5, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), gap = Math.max(0.9, 1.4 - dw * 0.02);
    const sets = [xs.filter((_, i) => i % 2 === 0), xs.filter((_, i) => i % 2 === 1), xs];
    sets.forEach((set, v) => set.forEach((x, i) => dropOn(v === 2 && i % 3 === 1 ? 'icbm' : 'ipbm', x, 0.3 + v * gap + i * 0.06, rnd(-6, 6))));
    return 0.3 + 3 * gap;
  } },
  // A platform comes in under the clouds with an escort of scouts
  platformRaid: { name: 'PLATFORM', min: 6, w: 2, kind: 'f', run(dw){
    const left = sideSign();
    flyer('platform', left, BOT + rndi(14, 34), 0, { snd: true });
    flyer('scout', left, rndi(50, 100), 1.2, { drops: [colProg(100, left)] });
    flyer('scout', left, rndi(50, 100), 1.8, { drops: [colProg(160, left)] });
    if (dw >= 14) flyer('platform', !left, BOT + rndi(14, 34), 2.4);
    return 3.0;
  } },
  // Three bombers at different heights weave their bombs between each other
  fleet: { name: 'BOMBER FLEET', min: 8, w: 3, kind: 'f', run(dw){
    const ys = [rndi(40, 60), rndi(80, 100), BOT + rndi(24, 60)], left = sideSign();
    ys.forEach((y, i) => {
      const dir = i % 2 ? !left : left, cols = evenCols(4, 36 + i * 22, 200 + i * 10);
      flyer(i === 0 ? 'gunner' : 'bomber', dir, y, i * 0.9, { drops: cols.map(c => colProg(c, dir)).sort((a, b) => a - b), snd: i === 0 });
    });
    return 3.8;
  } },
  // Splitting warheads, staggered so each bursts at a different moment
  mirvs: { name: 'MIRV STORM', min: 9, w: 3, kind: 'm', run(dw){
    const xs = targetCols(), n = clamp(2 + Math.floor(dw / 8), 2, 4);
    for (let i = 0; i < n; i++) dropOn(i % 2 ? 'icbm' : 'midsplit', pick(xs), 0.3 + i * 1.5, rnd(-12, 12));
    return n * 1.5;
  } },
  // A carrier with heavy bombs on a strict rhythm and an escort
  raid: { name: 'AIR RAID', min: 9, w: 2, kind: 'f', run(dw){
    const left = sideSign(), cols = evenCols(dw >= 14 ? 5 : 4, 50, 206);
    flyer('carrier', left, rndi(44, 90), 0, { drops: cols.map(c => colProg(c, left)), snd: true });
    flyer('scout', !left, rndi(50, 120), 1.5, { drops: [colProg(128, !left)] });
    if (dw >= 14) flyer('scout', left, BOT + rndi(20, 60), 2.4, { drops: [colProg(90, left)] });
    return 3.4;
  } },
};
// What each world leans on
const THEME = [
  { ripple: 2, pincer: 1.6, stick: 1.5, synchro: 1.3, weave: 1.3, dive: 1.2 },
  { rain: 2, barrage: 1.6, stick: 1.5, sweep: 1.5, dive: 1.6 },
  { heavyHit: 2, wall: 1.5, synchro: 1.6, mirvs: 1.6, crossing: 1.3, ghosts: 1.8, bulwark: 1.5 },
  { chutes: 2, aegisPair: 1.5, sweep: 1.4, mirvs: 1.3, weave: 1.6, ghosts: 1.4, bulwark: 1.3 },
  { platformRaid: 2, raid: 1.6, fleet: 1.8, vee: 1.4, barrage: 1.4, dive: 1.8, bulwark: 2 },
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
  let count = forceCount || (isShort ? 2 : clamp(4 + Math.floor(dw * 0.5), 4, 13) + (isBoss ? 2 : 0));
  if (modHeavy) count = Math.ceil(count * 1.4);
  const A = weightedPick(missiles, wt);
  const B = flyers.length ? weightedPick(flyers, wt) : A;
  const C = weightedPick(avail.filter(id => id !== A && id !== B), wt) || A;
  const gapBase = Math.max(0.5, 3.1 - dw * 0.1);
  const stack = clamp((dw - 15) * 0.04, 0, 0.9);              // chance of an extra pattern layered onto a phrase
  const out = [];
  for (let i = 0; i < count; i++){
    const stage = count > 1 ? i / (count - 1) : 1;
    let ids, gap = gapBase * rnd(0.9, 1.15), bump = Math.round(stage * 2);
    if (i === 0){ ids = [A]; bump = 0; gap += 0.6; }
    else if (i === count - 1 && count > 3){ ids = dw >= 12 ? [A, B, C] : [A, B]; bump += 1; gap = 1.2; }   // the climax
    else if (i % 3 === 2){ ids = [A, B]; gap += 0.9; }                                                  // call and response, then a breather
    else if (Math.random() < 0.25) ids = [C];
    else ids = [i % 2 ? B : A];
    if (isShort && i === 0) ids = [B];
    ids = [...new Set(ids)];
    for (let k = 0; k < 2 && ids.length < 4 && Math.random() < stack; k++){
      const more = avail.filter(x => !ids.includes(x));
      if (more.length) ids.push(weightedPick(more, wt));
    }
    out.push({ ids, gap, bump, offset: Math.max(0.4, 1.1 - dw * 0.025) });
  }
  return out;
}
// Which enemies each pattern brings, for the roster shown under the wave banner
const PAT_ROSTER = {
  ripple: ['ipbm', 'icbm', 'heavy'], pincer: ['ipbm', 'icbm'], rain: ['mini', 'ipbm'], stick: ['bomber', 'gunner', 'carrier'],
  crossing: ['scout'], sweep: ['smart'], vee: ['scout'], aegisPair: ['aegis'], chutes: ['chute'],
  heavyHit: ['heavy', 'colbomb', 'rowbomb', 'midsplit'], wall: [], synchro: ['heavy', 'ipbm', 'mini'], barrage: ['ipbm', 'icbm'],
  platformRaid: ['platform', 'scout'], fleet: ['gunner', 'bomber'], mirvs: ['midsplit', 'icbm'], raid: ['carrier', 'scout'],
  weave: ['weaver'], ghosts: ['phantom'], dive: ['diver'], bulwark: ['sapper', 'bulwark'],
};
let waveRoster = [];
function rosterOf(phrases){
  const seen = []; for (const ph of phrases) for (const id of ph.ids) for (const t of (PAT_ROSTER[id] || [])) if (!seen.includes(t)) seen.push(t);
  return seen.slice(0, 8);
}
const PAT_TIPS = {
  ripple: 'RIPPLE: THEY LAND ONE AFTER ANOTHER ALONG THE LINE. BREAK IT IN THE MIDDLE.',
  pincer: 'PINCER: TWO MISSILES CLOSE ON ONE COLUMN. WAIT FOR THEM TO MEET, THEN ONE BLAST TAKES BOTH.',
  rain: 'RAIN: MANY SMALL MISSILES AT ONCE. ONE WELL PLACED BLAST CHAINS THROUGH THEM.',
  stick: 'BOMBING RUN: IT DROPS OVER FIXED COLUMNS. SHOOT IT BEFORE IT REACHES THE FIRST ONE.',
  crossing: 'CROSSFIRE: THE SCOUTS MEET OVER THE MIDDLE AND DROP TOGETHER.',
  sweep: 'SWEEP: VERTICAL SHIPS ZIG-ZAG DOWN AND DROP MISSILES ON THE WAY.',
  vee: 'SQUADRON: THEIR BOMBS FALL ONE AFTER ANOTHER ACROSS THE SCREEN.',
  aegisPair: 'AEGIS PAIR: THE SHIELDS PULSE OUT OF STEP. SHOOT WHICHEVER IS OPEN.',
  chutes: 'PARACHUTES: THEY SLOW IN THE CLOUDS, THEN SPLIT INTO THREE. HIT THEM WHILE THEY DRIFT.',
  heavyHit: 'HEAVY ORDNANCE: BIG SLOW BOMBS. THEY NEED A DIRECT HIT.',
  wall: 'WALL: A WHOLE FORMATION AT ONCE. ONE BIG BLAST CAN CHAIN THROUGH IT.',
  synchro: 'TIMED STRIKE: THE SLOW ONE WAS LAUNCHED FIRST, SO THEY ALL LAND AT THE SAME MOMENT.',
  barrage: 'BARRAGE: THREE VOLLEYS. ODD COLUMNS, EVEN COLUMNS, THEN EVERYTHING.',
  platformRaid: 'PLATFORM: IT LAUNCHES MISSILES. HIT IT WHEN ITS SHIELD DROPS.',
  fleet: 'BOMBER FLEET: THREE BOMBERS WEAVE THEIR BOMBS BETWEEN EACH OTHER.',
  mirvs: 'MIRV STORM: THE WARHEADS SPLIT IN THREE MID-FALL. HIT THEM BEFORE THEY BURST.',
  weave: 'WEAVERS: THEY SNAKE LEFT AND RIGHT BUT LAND ON THEIR COLUMN. SHOOT WHERE THEY ARE GOING, NOT WHERE THEY ARE.',
  ghosts: 'PHANTOMS: THEY FADE OUT TOGETHER ON A BEAT AND CANNOT BE HIT WHILE FADED. FIRE AS THEY RETURN.',
  dive: 'DIVERS: THEY STOP AND FLASH WITH A LINE TO THEIR TARGET, THEN DIVE. THEY ARE EASY TO HIT WHILE THEY HANG.',
  bulwark: 'ORBITAL WALLS: A SAPPER HANGS THEM IN THE SKY. EVERY MISSILE BOUNCES OFF. SHOOT THE WALL WHEN ITS SHIELD DROPS, THREE TIMES, BEFORE IT LAPSES.',
  raid: 'AIR RAID: THE CARRIER DROPS HEAVY BOMBS ON A STRICT RHYTHM. BREAK ITS SHIELD.',
};
function runPhrase(ph, dw){
  let dur = 0; const names = [];
  ph.ids.forEach((id, i) => {
    choreo.base = i * ph.offset; choreo.patId = id; tele.runs[id] = (tele.runs[id] || 0) + 1;
    if (PAT_TIPS[id] && gameMode !== 'rush') tip('pat_' + id, PAT_TIPS[id]);
    dur = Math.max(dur, PAT[id].run(dw + (ph.bump || 0)) + choreo.base);
    names.push(PAT[id].name);
  });
  choreo.base = 0;
  choreo.label = names.join(' + '); choreo.labelT = 2.2;
  return dur;
}
// Starts the next phrase when its turn comes; returns true on the frame one starts.
// It waits a little if the sky is already crowded.
// From mid-campaign on, a steady drizzle of single missiles runs underneath the patterns, so there is
// never a fully clean moment to reset in.
function ambientStep(dt, dw, bossNow){
  const rate = clamp((dw - 5) * 0.045, 0, 2.2) * (bossNow && bossNow.state === 'fight' ? 0.5 : 1);
  if (rate <= 0 || !choreo.ran) return;
  choreo.ambT -= dt;
  if (choreo.ambT > 0) return;
  choreo.ambT = rnd(0.7, 1.3) / rate;
  choreo.patId = 'drizzle'; choreo.base = 0;
  const r = Math.random();
  dropOn(r < 0.6 ? 'ipbm' : (r < 0.85 ? 'mini' : (dw >= 10 ? 'icbm' : 'ipbm')), pick(targetCols()), 0.1);
}
function phraseStep(dt, dw, bossNow){
  ambientStep(dt, dw, bossNow);
  choreo.gapT -= dt * (bossNow && bossNow.state === 'fight' ? 0.75 : 1);
  // The sky is clear and nothing is queued: the player is ahead, so do not make them wait out the full rest
  if (choreo.ran && choreo.gapT > 0.7 && choreo.q.length === 0 && !enemies.some(e => !e.dead)) choreo.gapT = 0.7;
  if (choreo.gapT > 0 || !choreo.phrases.length) return false;
  if (fallingCount() > 7 + Math.floor(dw / 2) && choreo.waited < 3){ choreo.waited += dt; return false; }
  choreo.waited = 0;
  const ph = choreo.phrases.shift();
  choreo.ran = true;
  if (gameMode === 'wave') tip('fire', 'TAP TO FIRE. EACH TURRET RELOADS ON ITS OWN, SO ROTATE BETWEEN THEM.');
  choreo.gapT = runPhrase(ph, dw) + ph.gap;
  return true;
}
