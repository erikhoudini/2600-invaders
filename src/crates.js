'use strict';
// Crates and world hazards
// =====================================================================
//  CRATES (shoot to collect) AND WORLD HAZARDS
// =====================================================================
const CRATE_TYPES = {
  ammo:   { letter:'A', col:P.lblu, name:'AMMO',   w:25 },
  blast:  { letter:'B', col:P.org,  name:'BLAST',  w:18 },
  rapid:  { letter:'R', col:P.yel,  name:'RAPID',  w:15 },
  shield: { letter:'S', col:P.lgrn, name:'SHIELD', w:12 },
  repair: { letter:'+', col:P.pnk,  name:'REPAIR', w:9 },
  slow:   { letter:'T', col:P.lpur, name:'SLOW',   w:12 },
  nuke:   { letter:'N', col:P.red,  name:'NUKE',   w:6 },
};
let crates = [];
let fxBlast = 0, fxRapid = 0, fxShield = 0, fxSlow = 0;

function pickCrateType(){
  const anyDead = installations.some(i => !i.alive);
  let total = 0;
  for (const k in CRATE_TYPES){ if (k === 'repair' && !anyDead) continue; total += CRATE_TYPES[k].w; }
  let r = Math.random() * total;
  for (const k in CRATE_TYPES){
    if (k === 'repair' && !anyDead) continue;
    r -= CRATE_TYPES[k].w;
    if (r <= 0) return k;
  }
  return 'ammo';
}
// Orbitals: power-ups that swing around the playfield for three 10 second laps
const ORBIT_LAP = 10, ORBIT_LAPS = 3;
let orbTimer = 12;
function spawnOrbital(type){
  const cap = gameMode === 'endless' ? 2 : 1;
  if (crates.length >= cap) return;
  crates.push({ type: type || pickCrateType(), t: 0, sway: Math.random() * 6.28, x: -14, y: 96, depth: 0, trail: [], lane: crates.length ? 1 : 0 });
  sfx('crate');
}
function dropCrate(){ spawnOrbital(); }
function maybeDropCrate(e){
  if (e.type === 'carrier'){ if (Math.random() < 0.4) spawnOrbital(); }
  else if (e.type === 'bandit') spawnOrbital();
}
function orbitPos(c){
  const lap = ORBIT_LAP * ORBIT_LAPS;
  const A = c.lane ? 100 : 118, B = c.lane ? 30 : 38, cy = c.lane ? 112 : 92;
  const th = c.t / ORBIT_LAP * Math.PI * 2;
  let x = 128 - A * Math.cos(th) + Math.sin(c.t * 1.9 + c.sway) * 2;
  let y = cy + B * Math.sin(th) + Math.sin(c.t * 2.7 + c.sway) * 3;
  c.depth = Math.sin(th);
  // slide in from the left, and out to the left after the last lap
  if (c.t < 0.8){ const k = easeOut(c.t / 0.8); x = lerp(-14, x, k); }
  else if (c.t > lap){ const k = clamp((c.t - lap) / 1.2, 0, 1); x = lerp(x, -18, k * k); }
  c.x = x; c.y = y;
}
function updateCrates(dt){
  for (const c of crates){
    c.t += dt;
    orbitPos(c);
    c.tt = (c.tt || 0) + dt;
    if (c.tt > 0.06){ c.tt = 0; c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 7) c.trail.shift(); }
  }
  crates = crates.filter(c => c.t < ORBIT_LAP * ORBIT_LAPS + 1.3);
  if (fxRapid > 0) fxRapid = Math.max(0, fxRapid - dt);
  if (fxSlow > 0) fxSlow = Math.max(0, fxSlow - dt);
  if (menuState === 'game' && !(boss && boss.state === 'warn') && waveState !== 'cleared' && waveState !== 'worldclear'){
    orbTimer -= dt;
    if (orbTimer <= 0){
      orbTimer = gameMode === 'endless' ? 11 + Math.random() * 5 : 24 + Math.random() * 8;
      spawnOrbital();
    }
  }
}
function collectCrate(c){
  c.t = 999;
  stats.cratesCollected++;
  const def = CRATE_TYPES[c.type];
  popups.push({ x: c.x, y: c.y - 10, text: def.name, t: 0, dur: 1.1, col: def.col, big: true });
  sfx('pickup');
  for (let i = 0; i < 10; i++) spawnParticle(c.x, c.y, rnd(-50, 50), rnd(-60, 20), rnd(0.3, 0.7), def.col, 1);
  addScore(100);
  switch (c.type){
    case 'ammo': sharedAmmo = ammoCap; break;
    case 'blast': fxBlast = 8; break;
    case 'rapid': fxRapid = 8; sharedAmmo = Math.max(sharedAmmo, 10); break;
    case 'shield': fxShield = 1; break;
    case 'slow': fxSlow = 6; break;
    case 'repair': {
      const dead = installations.find(i => !i.alive);
      if (dead){ dead.alive = true; baseHP = Math.min(maxBaseHP, baseHP + 1); booms.push(new Boom(dead.x, GROUND - 10, 'ring', { r: 24, dur: 0.6 })); }
      else sharedAmmo = ammoCap;
      break;
    }
    case 'nuke': {
      flashT = 0.8; shake = 1.4;
      sfx('nuke');
      const nb = [];
      for (let pass = 0; pass < 2; pass++){
        for (const e of enemies.slice()){ if (!e.dead){ e.dead = true; onEnemyKilled(e, nb); } }
      }
      for (const x of nb) booms.push(x);
      enemies = enemies.filter(e => !e.dead);
      if (boss && boss.state === 'fight'){
        for (const p of boss.parts){
          if (p.alive && !(p.armored && p.armored())){ damagePart(p, 6); if (!boss || boss.state !== 'fight') break; }
        }
      }
      break;
    }
  }
  checkAchievements();
}
function crateHits(){
  if (!crates.length) return;
  for (const b of booms){
    if (b.dead) continue;
    const p = b.p;
    if (p <= 0 || p >= 1) continue;
    for (const c of crates){
      if (c.t >= 999 || c.x < 4 || c.x > W - 4) continue;
      if (b.hitTest(c.x, c.y)) collectCrate(c);
    }
  }
  crates = crates.filter(c => c.t < 999);
}
function drawCrates(t){
  for (const c of crates){
    const def = CRATE_TYPES[c.type];
    const front = c.depth >= 0;
    const lap = ORBIT_LAP * ORBIT_LAPS;
    const fade = (c.t > lap - 3 && c.t < lap) ? (Math.sin(t * 18) > 0 ? 1 : 0.4) : 1;
    const prevA = ctx.globalAlpha;
    // trail
    for (let i = 0; i < c.trail.length; i++){
      ctx.globalAlpha = prevA * fade * (i + 1) / (c.trail.length + 2) * 0.7;
      ctx.fillStyle = def.col;
      ctx.fillRect(Math.round(c.trail[i].x), Math.round(c.trail[i].y), 1, 1);
    }
    ctx.globalAlpha = prevA * fade * (front ? 1 : 0.75);
    const x = Math.round(c.x), y = Math.round(c.y);
    const r = front ? 5 : 4;
    fillCircle(x, y, r + 1, P.blk);
    fillCircle(x, y, r, def.col);
    fillCircle(x, y, r - 2, Math.sin(t * 10 + c.sway) > 0 ? P.wht : def.col);
    ctx.fillStyle = P.wht;
    ctx.fillRect(x - 2, y - 3, 2, 1);
    if (front) drawText(def.letter, x - 1, y - 2, P.blk);
    ctx.globalAlpha = prevA;
  }
}
function drawEffects(t){
  let y = 36;
  const line = (s, col) => {
    drawText(s, 3, y + 1, P.blk);
    drawText(s, 2, y, col);
    y += 7;
  };
  if (fxRapid > 0) line('RAPID ' + Math.ceil(fxRapid), P.yel);
  if (fxBlast > 0) line('BLAST ' + fxBlast, P.org);
  if (fxSlow > 0) line('SLOW ' + Math.ceil(fxSlow), P.lpur);
  if (fxShield > 0) line('SHIELD', P.lgrn);
  if (fxShield > 0 && Math.sin(t * 8) > 0){
    ctx.fillStyle = P.lgrn;
    for (let x = 0; x < W; x += 6) ctx.fillRect(x, GROUND - 1, 3, 1);
  }
}

// ---------------------------------------------------------------------
//  Hazards: one signature event per world, announced a moment before it hits
// ---------------------------------------------------------------------
const HAZARDS = {
  europa:    { name:'METEOR SHOWER', tele:1.4 },
  titan:     { name:'METHANE STORM', tele:1.0 },
  io:        { name:'ROCK LAUNCH',   tele:1.3 },
  enceladus: { name:'ICE GEYSER',    tele:1.2 },
  triton:    { name:'BOULDER FIELD', tele:1.4 },
};
let hazardT = 20, hazardEv = null, gust = 0, gustT = 0;

function resetHazards(){ hazardT = 20; hazardEv = null; gust = 0; gustT = 0; }

function hazardAllowed(){
  if (boss) return false;
  if (gameMode === 'endless') return endTime > 15;
  return waveState === 'spawning' && !isBossWave(wave) && waveIn(wave) >= 2;
}

function startHazard(){
  const id = currentEnv.id, H0 = HAZARDS[id];
  const ev = { kind: id, t: 0, tele: H0.tele, fired: false, n: 0, xs: [], dir: Math.random() < 0.5 ? -1 : 1 };
  if (id === 'europa'){ for (let i = 0; i < 9; i++) ev.xs.push(rndi(12, W - 12)); }
  else if (id === 'io'){
    const cities = installations.filter(i => i.alive);
    for (let i = 0; i < 5; i++){ const c = cities.length ? pick(cities) : { x: rndi(20, W - 20) }; ev.xs.push(clamp(c.x + rnd(-30, 30), 10, W - 10)); }
  }
  else if (id === 'enceladus'){ ev.xs.push(rndi(30, W - 30)); }
  else if (id === 'triton'){ for (let i = 0; i < 4; i++) ev.xs.push(rndi(20, W - 20)); }
  hazardEv = ev;
  popups.push({ x: W / 2, y: 98, text: H0.name, t: 0, dur: 1.6, col: P.red, big: true });
  sfx('hazard');
  shake = Math.max(shake, 0.25);
}

function updateHazards(dt){
  if (gustT > 0){
    gustT -= dt;
    if (gustT <= 0) gust = 0;
  }
  if (!hazardEv){
    if (!hazardAllowed()) return;
    hazardT -= dt;
    if (hazardT <= 0) startHazard();
    return;
  }
  const ev = hazardEv;
  ev.t += dt;
  if (ev.kind === 'enceladus' && ev.t < ev.tele){
    spawnParticle(ev.xs[0] + rnd(-3, 3), GROUND - 2, rnd(-6, 6), rnd(-50, -25), 0.5, P.wht, 1);
  }
  if (ev.t < ev.tele) return;
  const k = ev.t - ev.tele;
  if (ev.kind === 'europa'){
    while (ev.n < ev.xs.length && k > ev.n * 0.16){
      spawnEnemy('meteor', ev.xs[ev.n] - ev.dir * 20, 24, ev.dir * rnd(26, 44), rnd(52, 72) * speedMul);
      ev.n++;
    }
    if (ev.n >= ev.xs.length) endHazard();
  } else if (ev.kind === 'io'){
    while (ev.n < ev.xs.length && k > ev.n * 0.28){
      spawnEnemy('lava', ev.xs[ev.n], GROUND - 4, rnd(-20, 20), -rnd(125, 150));
      sfx('lavaLaunch');
      for (let i = 0; i < 6; i++) spawnParticle(ev.xs[ev.n], GROUND - 4, rnd(-40, 40), rnd(-80, -20), rnd(0.3, 0.7), pick([P.yel, P.org, P.red]), 2);
      shake = Math.max(shake, 0.4);
      ev.n++;
    }
    if (ev.n >= ev.xs.length) endHazard();
  } else if (ev.kind === 'enceladus'){
    const total = 8;
    while (ev.n < total && k > ev.n * 0.1){
      spawnEnemy('shard', ev.xs[0] + rnd(-4, 4), GROUND - 4, rnd(-34, 34), -rnd(115, 155));
      for (let i = 0; i < 3; i++) spawnParticle(ev.xs[0], GROUND - 4, rnd(-20, 20), rnd(-90, -30), rnd(0.3, 0.6), P.wht, 1);
      ev.n++;
    }
    if (ev.n === 1) sfx('lavaLaunch');
    if (ev.n >= total) endHazard();
  } else if (ev.kind === 'triton'){
    while (ev.n < ev.xs.length && k > ev.n * 0.55){
      spawnEnemy('boulder', ev.xs[ev.n], 24, rnd(-10, 10), 24 * speedMul);
      ev.n++;
    }
    if (ev.n >= ev.xs.length) endHazard();
  } else if (ev.kind === 'titan'){
    if (!ev.fired){ ev.fired = true; gust = ev.dir * 3; gustT = 9; }
    if (k > 9) endHazard();
  }
}
function endHazard(){
  hazardEv = null;
  hazardT = Math.max(14, 30 - diffWave(Math.max(1, wave)) * 0.6) + rnd(0, 10);
  if (gameMode === 'endless') hazardT = 22 + rnd(0, 10);
}

function drawHazard(t){
  const ev = hazardEv;
  if (ev && ev.t < ev.tele){
    const on = Math.sin(t * 20) > -0.2;
    if (ev.kind === 'europa' || ev.kind === 'triton'){
      ctx.fillStyle = on ? P.red : P.wht;
      for (const x of ev.xs) { ctx.fillRect(Math.round(x), 26, 1, 4); ctx.fillRect(Math.round(x) - 1, 30, 3, 1); }
    } else if (ev.kind === 'io'){
      ctx.fillStyle = on ? P.yel : P.red;
      for (const x of ev.xs) { ctx.fillRect(Math.round(x) - 5, GROUND - 2, 11, 2); ctx.fillRect(Math.round(x) - 2, GROUND - 5, 5, 3); }
    } else if (ev.kind === 'enceladus'){
      ctx.fillStyle = on ? P.wht : P.lgrn;
      ctx.fillRect(Math.round(ev.xs[0]) - 6, GROUND - 2, 13, 2);
    }
  }
  if (gustT > 0){
    ctx.fillStyle = P.wht;
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = 0.5;
    const dirn = gust > 0 ? 1 : -1;
    for (let i = 0; i < 16; i++){
      const y = BOT + 8 + (i * 47) % (SH - 30);
      const x = ((i * 91 + t * 160 * dirn) % (W + 40) + (W + 40)) % (W + 40) - 20;
      ctx.fillRect(Math.round(x), y, 8 + (i % 3) * 4, 1);
    }
    for (let i = 0; i < 10; i++){
      const y = 22 + (i * 53) % (SH - 90);
      const x = ((i * 77 + t * 140 * dirn) % (W + 40) + (W + 40)) % (W + 40) - 20;
      ctx.fillRect(Math.round(x), y, 8 + (i % 3) * 4, 1);
    }
    ctx.globalAlpha = prevA;
  }
}
