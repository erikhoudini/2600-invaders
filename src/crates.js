'use strict';
// Crates and world hazards
// =====================================================================
//  CRATES (shoot to collect) AND WORLD HAZARDS
// =====================================================================
const CRATE_TYPES = {
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
  // Repair only returns a lost city in Endless; in the campaign a city is gone until the next planet
  const anyDead = turrets.some(t => !t.alive) || (gameMode === 'endless' && installations.some(i => !i.alive));
  let total = 0;
  for (const k in CRATE_TYPES){ if (k === 'repair' && !anyDead) continue; total += CRATE_TYPES[k].w; }
  let r = Math.random() * total;
  for (const k in CRATE_TYPES){
    if (k === 'repair' && !anyDead) continue;
    r -= CRATE_TYPES[k].w;
    if (r <= 0) return k;
  }
  return 'blast';
}
// Powerups fly across the top screen on an arc, leave on the far side, and come back
// after a pause. Each one makes POWERUP_PASSES appearances before it is gone for good.
const POWERUP_PASS = 8.5;        // seconds to cross the screen
const POWERUP_WAIT = 7;          // seconds off screen between appearances
const POWERUP_PASSES = 3;        // the first appearance plus two returns
let orbTimer = 12;
function startPass(c){
  c.state = 'fly'; c.t = 0; c.trail = [];
  c.dir = c.pass % 2 === 0 ? c.dir0 : -c.dir0;      // alternate sides each time
  c.baseY = rnd(114, 126); c.arcH = rnd(54, 74); c.sway = Math.random() * 6.28;
  orbitPos(c);
}
function spawnOrbital(type){
  if (crates.length >= 1) return;
  const c = { type: type || pickCrateType(), pass: 0, dir0: Math.random() < 0.5 ? 1 : -1, x: -20, y: 100, trail: [], wait: 0, tt: 0 };
  startPass(c);
  crates.push(c);
  sfx('crate');
}
function dropCrate(){ spawnOrbital(); }
function maybeDropCrate(e){
  if (e.type === 'carrier'){ if (Math.random() < 0.4) spawnOrbital(); }
  else if (e.type === 'bandit') spawnOrbital();
  else if (e.type === 'platform'){ if (Math.random() < 0.5) spawnOrbital(); }
}
// An arc that rises from one edge, peaks mid-screen and comes down on the other side, with a slight wobble
function orbitPos(c){
  const u = clamp(c.t / POWERUP_PASS, 0, 1);
  const lead = -14, span = W + 28;
  c.x = (c.dir > 0 ? lead + span * u : W - lead - span * u) + Math.sin(c.t * 1.9 + c.sway) * 2;
  c.y = c.baseY - c.arcH * Math.sin(Math.PI * u) + Math.sin(c.t * 3.1 + c.sway) * 3;
}
function updateCrates(dt){
  for (const c of crates){
    if (c.state === 'wait'){
      c.wait -= dt;
      if (c.wait <= 0){ startPass(c); sfx('crate'); }
      continue;
    }
    c.t += dt;
    orbitPos(c);
    c.tt += dt;
    if (c.tt > 0.06){ c.tt = 0; c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 7) c.trail.shift(); }
    if (c.t >= POWERUP_PASS){
      c.pass++;
      if (c.pass >= POWERUP_PASSES) c.t = 999;
      else { c.state = 'wait'; c.wait = POWERUP_WAIT; c.trail = []; c.x = -40; }
    }
  }
  crates = crates.filter(c => c.t < 999);
  if (fxRapid > 0) fxRapid = Math.max(0, fxRapid - dt);
  if (fxSlow > 0) fxSlow = Math.max(0, fxSlow - dt);
  if (menuState === 'game' && !(boss && boss.state === 'warn') && waveState !== 'cleared' && waveState !== 'worldclear'){
    orbTimer -= dt;
    if (orbTimer <= 0){
      orbTimer = gameMode === 'endless' ? 9 + Math.random() * 4 : 16 + Math.random() * 6;
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
    case 'blast': fxBlast = 8; break;
    case 'rapid': fxRapid = 8; for (const t of turrets) t.cd = Math.min(t.cd, 0.1); break;
    case 'shield': fxShield = 1; break;
    case 'slow': fxSlow = 6; break;
    case 'repair': {
      const downTurret = turrets.find(t => !t.alive);
      const dead = installations.find(i => !i.alive);
      if (downTurret) rebuildTurret(downTurret);
      else if (dead && gameMode === 'endless'){ dead.alive = true; baseHP = Math.min(maxBaseHP, baseHP + 1); booms.push(new Boom(dead.x, GROUND - 10, 'ring', { r: 24, dur: 0.6 })); }
      else addScore(250);
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
      if (c.t >= 999 || c.state !== 'fly' || c.x < 4 || c.x > W - 4) continue;
      if (b.hitTest(c.x, c.y)) collectCrate(c);
    }
  }
  crates = crates.filter(c => c.t < 999);
}
// Powerups are Sputniks drawn like a 2600 sprite: a blocky body in one flat colour whose
// scanlines alternate with white, a pixel icon cut out of it, and swept-back antennae.
const SPUTNIK_BODY = ['..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..'];
const CRATE_ICONS = {
  blast:  ['X.X', '.X.', 'X.X'],
  rapid:  ['.XX', 'XX.', '.X.'],
  shield: ['XXX', 'X.X', '.X.'],
  repair: ['.X.', 'XXX', '.X.'],
  slow:   ['XXX', '.X.', 'XXX'],
  nuke:   ['.X.', 'X.X', '.X.'],
};
function drawCrates(t){
  for (const c of crates){
    if (c.state !== 'fly') continue;
    const def = CRATE_TYPES[c.type];
    const prevA = ctx.globalAlpha;
    const lastPass = c.pass === POWERUP_PASSES - 1;
    const fade = (lastPass && c.t > POWERUP_PASS - 2.5) ? (Math.sin(t * 18) > 0 ? 1 : 0.4) : 1;
    ctx.globalAlpha = prevA * fade;
    for (let i = 0; i < c.trail.length; i += 2){
      ctx.fillStyle = def.col;
      ctx.fillRect(Math.round(c.trail[i].x), Math.round(c.trail[i].y), 1, 1);
    }
    const x = Math.round(c.x) - 3, y = Math.round(c.y) - 3;
    const back = -c.dir;                                   // antennae sweep away from the direction of travel
    const flick = Math.floor(t * 8) & 1;                   // scanlines swap colours a few times a second
    // antennae: black shadow first, then the white lines
    for (let pass = 0; pass < 2; pass++){
      ctx.fillStyle = pass ? P.wht : P.blk;
      const o = pass ? 0 : 1;
      for (let k = 4; k <= 11; k++){
        const dy = k >= 8 ? 3 : (k >= 6 ? 2 : 1);
        ctx.fillRect(x + 3 + back * k + o, y + 3 - dy + o, 1, 1);
        ctx.fillRect(x + 3 + back * k + o, y + 3 + dy + o, 1, 1);
      }
    }
    // body: shadow, then colour by scanline
    for (let j = 0; j < 7; j++){
      for (let i = 0; i < 7; i++) if (SPUTNIK_BODY[j][i] === 'X'){ ctx.fillStyle = P.blk; ctx.fillRect(x + i + 1, y + j + 1, 1, 1); }
    }
    for (let j = 0; j < 7; j++){
      ctx.fillStyle = ((j + flick) & 1) ? P.wht : def.col;
      for (let i = 0; i < 7; i++) if (SPUTNIK_BODY[j][i] === 'X') ctx.fillRect(x + i, y + j, 1, 1);
    }
    const icon = CRATE_ICONS[c.type];
    if (icon){
      ctx.fillStyle = P.blk;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (icon[j][i] === 'X') ctx.fillRect(x + 2 + i, y + 2 + j, 1, 1);
    }
    if (Math.sin(t * 7 + c.sway) > 0.2){ ctx.fillStyle = P.rrd; ctx.fillRect(x + 3 + back * 11, y + 3 - 3, 1, 1); }
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
  const w = windNow + gust * 1.5;
  if (Math.abs(w) > 1.5){
    const n = clamp(Math.round(Math.abs(w) / 2.5), 1, 5), dir = w > 0 ? 1 : -1;
    drawText('WIND', 3, y + 1, P.blk); drawText('WIND', 2, y, P.lblu);
    const x0 = dir > 0 ? 28 : 28 + n * 3 + 3, yy = y + 2;
    ctx.fillStyle = P.lblu;
    for (let i = 0; i < n; i++){
      const x = x0 + dir * i * 3;
      ctx.fillRect(x, yy - 2, 1, 1); ctx.fillRect(x + dir, yy - 1, 1, 1); ctx.fillRect(x + dir * 2, yy, 1, 1);
      ctx.fillRect(x + dir, yy + 1, 1, 1); ctx.fillRect(x, yy + 2, 1, 1);
    }
    y += 7;
  }
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
    if (!ev.fired){ ev.fired = true; gust = ev.dir * 5; gustT = 9; }
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
