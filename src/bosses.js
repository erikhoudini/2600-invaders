'use strict';
// Bosses: Warden, Leviathan, Cyclops, Hydra, Arbiter
// =====================================================================
//  BOSSES
//  Each boss is a set of hit parts plus an attack script. Attacks are
//  ordinary missiles launched from the boss, so every existing rule
//  (trails, impact warnings, chain explosions) applies to them.
// =====================================================================
const BOSS_NAMES = ['WARDEN', 'LEVIATHAN', 'CYCLOPS', 'HYDRA', 'ARBITER'];
const easeOut = u => 1 - (1 - u) * (1 - u);
const BOSS_AWAY = 170 + BOSS_DROP;       // how far a boss climbs to leave the screen

// Rows of [halfWidth, color, innerHalfWidth, innerColor]: one color per scanline, like a 2600 sprite
function drawRows(cx, cy, rows, flash){
  const h = rows.length, y0 = Math.round(cy - h / 2), x = Math.round(cx);
  ctx.fillStyle = P.blk;
  for (let j = 0; j < h; j++){ const hw = rows[j][0]; if (hw > 0) ctx.fillRect(x - hw + 1, y0 + j + 1, hw * 2, 1); }
  for (let j = 0; j < h; j++){
    const r = rows[j], hw = r[0];
    if (hw <= 0) continue;
    ctx.fillStyle = flash ? P.wht : r[1];
    ctx.fillRect(x - hw, y0 + j, hw * 2, 1);
    if (!flash && r.length > 2){ ctx.fillStyle = r[3]; ctx.fillRect(x - r[2], y0 + j, r[2] * 2, 1); }
  }
}
function scaleRows(rows, sx, sy){
  const h = Math.round(rows.length * sy), out = [];
  for (let j = 0; j < h; j++){
    const r = rows[Math.min(rows.length - 1, Math.floor(j / sy))];
    const n = [Math.max(1, Math.round(r[0] * sx)), r[1]];
    if (r.length > 2){ n.push(Math.max(1, Math.round(r[2] * sx))); n.push(r[3]); }
    out.push(n);
  }
  return out;
}
function shapeRows(widths, cols){ return widths.map((w, i) => [w, cols[Math.min(i, cols.length - 1)]]); }
function discRows(R, cols, hi){
  const rows = [];
  for (let dy = -R; dy <= R; dy++){
    const hw = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
    const k = Math.min(cols.length - 1, Math.floor((dy + R) / (2 * R + 1) * cols.length));
    const row = [hw, cols[k]];
    if (hi && dy < -R * 0.15 && hw > 3){ row.push(Math.round(hw * 0.5)); row.push(hi); }
    rows.push(row);
  }
  return rows;
}

let boss = null, bossSpawned = false;

function mkPart(id, hw, hh, hp, extra){
  return Object.assign({ id, hw, hh, hp, maxhp: hp, alive: true, flash: 0, wx: 0, wy: 0, armored: null }, extra || {});
}
function randomCityX(){
  const alive = installations.filter(i => i.alive);
  return alive.length ? pick(alive).x + rnd(-4, 4) : rndi(20, W - 20);
}
// Fires a missile from (x,y) that lands on tx, so salvos can be spread across the cities
function launchAt(type, x, y, tx, speedScale){
  const T = ETYPES[type];
  const vy = T.vy * speedMul * (speedScale || 1);
  const ft = Math.max(0.3, (GROUND - y) / vy);
  spawnEnemy(type, x, y, (tx - x) / ft, vy);
  sfx('bossShot');
}
function bossBlast(x, y, r){
  booms.push(new Boom(x, y, 'circle', { r, dur: 0.45, noBoss: true }));
}

function spawnBoss(idx){
  const makers = [makeWarden, makeLeviathan, makeCyclops, makeHydra, makeArbiter];
  boss = makers[idx]();
  boss.idx = idx;
  boss.life = 0; boss.t = 0; boss.state = 'warn'; boss.dyingT = 0; boss.warned = 0;
  boss.offY = 0; boss.visit = 1; boss.visitT = 0; boss.visitLen = 15; boss.moveT = 0;
  bossCityLoss = 0;
  boss.layout();
  sfx('warning');
}

function bossAlive(){ return boss && boss.state !== 'dead'; }

// The boss shows up in three visits spread across the wave
const BOSS_VISITS = [0.12, 0.48, 0.82];
let themeFormation = null;
function bossWaveProgress(){ return totalSpawnCount > 0 ? totalSpawned / totalSpawnCount : 1; }
function updateBossPlan(){
  if (!isBossWave(wave) || waveState !== 'spawning') return;
  const prog = spawnRemaining <= 0 ? 1 : bossWaveProgress();
  if (!boss){
    if (!bossSpawned && prog >= BOSS_VISITS[0]){ bossSpawned = true; spawnBoss(worldOf(wave)); }
    return;
  }
  if (boss.state === 'away'){
    const need = BOSS_VISITS[Math.min(boss.visit, BOSS_VISITS.length - 1)];
    if (prog >= need && (boss.awayT || 0) >= 7){ boss.state = 'enter'; boss.moveT = 0; boss.visit++; boss.visitT = 0; sfx('warning'); }
  }
}
function bossOffset(b){
  if (b.state === 'leave') return -BOSS_AWAY * easeOut(clamp(b.moveT / 1.3, 0, 1));
  if (b.state === 'away') return -BOSS_AWAY;
  if (b.state === 'enter') return -BOSS_AWAY * (1 - easeOut(clamp(b.moveT / 1.3, 0, 1)));
  return 0;
}
function updateBoss(dt){
  const b = boss;
  b.t += dt;
  for (const p of b.parts) if (p.flash > 0) p.flash -= dt;
  if (b.state === 'warn'){
    b.life += dt;
    b.layout();
    if (b.t > 1.0 && !b.warned){ b.warned = 1; sfx('warning'); }
    if (b.t >= 2.2){ b.state = 'fight'; b.t = 0; b.visitT = 0; }
    return;
  }
  if (b.state === 'fight'){
    b.offY = 0;
    b.visitT += dt;
    bossFiring = true;
    b.update(dt * BOSS_TEMPO);
    bossFiring = false;
    const final = b.visit >= BOSS_VISITS.length;
    if (!final && (b.visitT >= b.visitLen || b.barFrac() <= 1 - b.visit / BOSS_VISITS.length + 0.02)){
      b.state = 'leave'; b.moveT = 0;
      popups.push({ x: W / 2, y: 70, text: 'RETREATING', t: 0, dur: 1.4, col: P.lblu, big: true });
      sfx('warning');
    }
    return;
  }
  if (b.state === 'leave' || b.state === 'enter'){
    b.moveT += dt; b.life += dt;
    b.layout();
    b.offY = bossOffset(b);
    for (const p of b.parts) p.wy += b.offY;
    if (b.moveT >= 1.3){
      if (b.state === 'leave'){
        b.state = 'away'; b.offY = -BOSS_AWAY; b.awayT = 0;
        // the retreat leaves a gift
        spawnOrbital();
        const fromLeft = Math.random() < 0.5;
        spawnEnemy('carrier', fromLeft ? -12 : W + 12, rndi(40, 90), (fromLeft ? 1 : -1) * 14);
      } else { b.state = 'fight'; b.offY = 0; b.visitT = 0; b.t = 0; }
    }
    return;
  }
  if (b.state === 'away'){
    b.life += dt; b.awayT = (b.awayT || 0) + dt; b.layout(); b.offY = -BOSS_AWAY;
    for (const p of b.parts) p.wy += b.offY;
    return;
  }
  if (b.state === 'dying') updateBossDeath(dt);
}

function bossBoomHits(){
  const b = boss;
  if (!b || b.state !== 'fight') return;
  for (const bm of booms){
    if (bm.dead || bm.noBoss) continue;
    const p = bm.p;
    if (p <= 0 || p >= 1) continue;
    for (const part of b.parts){
      if (!part.alive) continue;
      if (!bm.overlapBox(part.wx, part.wy, part.hw, part.hh)) continue;
      if (!bm.hits) bm.hits = new Set();
      if (bm.hits.has(part.id)) continue;
      bm.hits.add(part.id);
      if (part.armored && part.armored()){
        sfx('clank');
        spawnParticle(bm.x, bm.y, rnd(-30, 30), rnd(-30, 0), 0.3, P.wht, 1);
        continue;
      }
      damagePart(part, (bm.rmax >= 60 ? 2 : 1) + ((bm.chain || 0) >= 8 ? 1 : 0));
      if (!boss || boss.state !== 'fight') return;
    }
  }
}

function damagePart(part, d){
  if (boss && boss.state === 'fight' && boss.visit < BOSS_VISITS.length && boss.barFrac() <= 1 - boss.visit / BOSS_VISITS.length + 0.01){
    sfx('clank'); return;
  }
  if (part.dmgMul) d *= part.dmgMul();
  part.hp -= d;
  part.flash = 0.07;
  addScore(25 * d);
  if (part.onHit) part.onHit(d);
  sfx('bossHit');
  for (let i = 0; i < 2; i++) spawnParticle(part.wx + rnd(-part.hw, part.hw), part.wy + rnd(-part.hh, part.hh), rnd(-40, 40), rnd(-40, 10), 0.3, P.yel, 1);
  if (part.hp <= 0){
    part.hp = 0; part.alive = false;
    sfx('partKill');
    shake = Math.max(shake, 0.7); flashT = Math.max(flashT, 0.15);
    booms.push(new Boom(part.wx, part.wy, 'nova', { r: 26, dur: 0.7, noBoss: true }));
    for (let i = 0; i < 10; i++) spawnParticle(part.wx, part.wy, rnd(-70, 70), rnd(-70, 40), rnd(0.4, 0.9), pick([P.wht, P.yel, P.org]), 2);
    popups.push({ x: part.wx, y: part.wy, text: '+' + (500), t: 0, dur: 1.0, col: P.yel, big: false });
    dropCrate(part.wx, part.wy + 10);
    addScore(500);
    if (boss.onPartDead) boss.onPartDead(part);
    if (boss.isDead()) startBossDeath();
  }
}

function startBossDeath(){
  const b = boss;
  b.state = 'dying'; b.dyingT = 0; b.nextBoom = 0;
  // Everything still in flight goes up with it
  const nb = [];
  for (let pass = 0; pass < 2; pass++){
    for (const e of enemies.slice()){ if (!e.dead){ e.dead = true; onEnemyKilled(e, nb); } }
  }
  for (const x of nb) booms.push(x);
  enemies = enemies.filter(e => !e.dead);
  sfx('bossDie');
  shake = 1.6; flashT = 0.5;
}

function updateBossDeath(dt){
  const b = boss;
  b.dyingT += dt;
  b.life += dt * 0.3;
  b.nextBoom -= dt;
  shake = Math.max(shake, 0.5);
  if (b.nextBoom <= 0){
    b.nextBoom = 0.11;
    const bx = b.deathX(), by = b.deathY();
    const ox = rnd(-b.deathW, b.deathW), oy = rnd(-b.deathH, b.deathH);
    booms.push(new Boom(bx + ox, by + oy, 'circle', { r: rndi(12, 26), dur: 0.5, noBoss: true }));
    sfx('puff');
  }
  if (b.dyingT >= (b.deathTime || 2.4)){
    const bx = b.deathX(), by = b.deathY();
    booms.push(new Boom(bx, by, 'nova', { r: 90, dur: 1.3, noBoss: true }));
    booms.push(new Boom(bx, by, 'ring', { r: 130, dur: 1.6, delay: 0.1, noBoss: true }));
    sfx('bigbang');
    shake = 1.8; flashT = 0.7;
    addScore(b.score);
    popups.push({ x: W / 2, y: 70, text: 'BOSS DOWN', t: 0, dur: 2.0, col: P.yel, big: true });
    popups.push({ x: W / 2, y: 90, text: '+' + b.score, t: 0, dur: 2.0, col: P.wht, big: true });
    stats.bossKills++;
    camp.bosses[b.idx]++;
    if (bossCityLoss === 0) camp.flawBoss++;
    saveCamp();
    boss = null;
    checkAchievements();
  }
}

// Shared UI ----------------------------------------------------------
function drawBossBackdrop(){
  const b = boss;
  if (!b) return;
  let k = 0.6 * easeOut(clamp(b.life / 1.4, 0, 1));
  if (b.state === 'dying') k *= Math.max(0, 1 - b.dyingT / (b.deathTime || 2.4));
  k *= clamp(1 + (b.offY || 0) / BOSS_AWAY, 0, 1);
  if (k <= 0.01) return;
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = k;
  ctx.fillStyle = P.blk;
  ctx.fillRect(1, 24, W - 2, CLOUD_TOP - 24);
  ctx.globalAlpha = prevA;
}

function drawBossBar(t){
  const b = boss;
  if (!b || b.state === 'warn' || b.state === 'away') return;
  const bx = 34, bw = W - 68, by = 27;
  ctx.fillStyle = P.blk; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
  ctx.fillStyle = P.dred; ctx.fillRect(bx, by, bw, 3);
  const f = b.state === 'dying' ? 0 : clamp(b.barFrac(), 0, 1);
  const col = f < 0.3 ? (Math.sin(t * 14) > 0 ? P.wht : P.red) : (f < 0.6 ? P.org : P.red);
  ctx.fillStyle = col; ctx.fillRect(bx, by, Math.round(bw * f), 2);
  ctx.fillStyle = P.pnk; ctx.fillRect(bx, by, Math.round(bw * f), 1);
  drawText(b.name, bx, by + 5, P.gry);
  if (b.drawPips) b.drawPips(bx + bw, by + 5);
}

function drawBossWarning(t){
  const b = boss;
  if (!b || b.state !== 'warn') return;
  const on = Math.sin(t * 16) > -0.2;
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = 0.14 + (on ? 0.08 : 0);
  ctx.fillStyle = P.red; ctx.fillRect(0, 0, W, SH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.blk; ctx.fillRect(0, 70, W, 30);
  const off = Math.floor(t * 40) % 16;
  for (let x = -16; x < W + 16; x += 16){
    ctx.fillStyle = P.red;
    ctx.fillRect(x + off, 70, 8, 2);
    ctx.fillRect(W - x - off - 8, 98, 8, 2);
  }
  const s = 'WARNING';
  const tw = textW2x(s);
  drawText2x(s, Math.round((W - tw) / 2), 76, on ? P.red : P.wht);
  const nm = b.name;
  drawText(nm, Math.round((W - textW(nm)) / 2), 90, P.yel);
  ctx.globalAlpha = prevA;
}

// ---------------------------------------------------------------------
//  WARDEN (Europa): two gun pods guard an armored core
// ---------------------------------------------------------------------
function makeWarden(){
  const hull = scaleRows(shapeRows([5, 10, 15, 20, 24, 28, 30, 30, 27, 22, 16, 8],
    [P.wht, P.lblu, P.lblu, P.lblu, P.blu, P.blu, P.wht, P.lblu, P.blu, P.dblu, P.dblu, P.blk]), 1.25, 1.35);
  const podRows = scaleRows(shapeRows([3, 5, 6, 6, 5, 3], [P.wht, P.gry, P.gry, P.lblu, P.dblu, P.blk]), 1.4, 1.6);
  const coreRows = discRows(10, [P.pnk, P.red, P.red, P.red, P.dred, P.dred]);
  const L = mkPart('L', 9, 9, 22), R = mkPart('R', 9, 9, 22);
  const C = mkPart('C', 11, 11, 34, { armored: () => L.alive || R.alive });
  const b = {
    name: 'WARDEN', parts: [L, R, C], x: 128, y: 46, cd: [1.6, 2.6], coreCd: 1.0, shots: 0, coreN: 0, score: 3000,
    deathW: 34, deathH: 14, deathX(){ return this.x; }, deathY(){ return this.y; },
    isDead(){ return !C.alive; },
    barFrac(){ return ((L.alive ? L.hp : 0) + (R.alive ? R.hp : 0) + (C.alive ? C.hp : 0)) / (L.maxhp + R.maxhp + C.maxhp); },
    layout(){
      const intro = easeOut(clamp(this.life / 1.8, 0, 1));
      this.x = 128 + Math.sin(this.life * 0.55) * (62 * intro);
      this.y = 56 + BOSS_DROP + Math.sin(this.life * 1.1) * 3 - (1 - intro) * 90;
      L.wx = this.x - 46; L.wy = this.y + 13; R.wx = this.x + 46; R.wy = this.y + 13;
      C.wx = this.x; C.wy = this.y - 15;
    },
    update(dt){
      this.life += dt; this.layout();
      const enr = this.barFrac() < 0.5 ? 1 : 0;
      const pods = [L, R];
      for (let i = 0; i < 2; i++){
        if (!pods[i].alive) continue;
        this.cd[i] -= dt;
        if (this.cd[i] <= 0){
          this.cd[i] = 1.9 - enr * 0.5 + rnd(-0.3, 0.3);
          this.shots++;
          const tx = randomCityX();
          launchAt('ipbm', pods[i].wx, pods[i].wy + 8, tx, 1);
          if (this.shots % 3 === 0){
            launchAt('ipbm', pods[i].wx, pods[i].wy + 8, tx - 24, 1);
            launchAt('ipbm', pods[i].wx, pods[i].wy + 8, tx + 24, 1);
          }
        }
      }
      if (!L.alive && !R.alive && C.alive){
        this.coreCd -= dt;
        if (this.coreCd <= 0){
          this.coreCd = 0.9 - enr * 0.25; this.coreN++;
          launchAt('ipbm', C.wx, C.wy + 8, randomCityX(), 1.1);
          if (this.coreN % 5 === 0) spawnEnemy('heavybomb', C.wx, C.wy + 10, 0, 32);
          if (this.coreN % 4 === 0) spawnEnemy('smart', C.wx, C.wy + 10, 0);
        }
      }
    },
    draw(t){
      const dead = this.state === 'dying';
      const fl = dead && Math.sin(t * 40) > 0;
      for (const p of [L, R]){
        if (p.alive || dead) drawRows(p.wx, p.wy, podRows, p.flash > 0 || (dead && fl));
      }
      drawRows(this.x, this.y, hull, dead && fl);
      // rim lights
      for (let k = -30; k <= 30; k += 6){
        ctx.fillStyle = Math.sin(t * 6 + k) > 0 ? P.yel : P.red;
        ctx.fillRect(Math.round(this.x + k), Math.round(this.y), 2, 1);
      }
      if (C.alive || dead) drawRows(C.wx, C.wy, coreRows, C.flash > 0 || (dead && fl));
      if (C.alive && C.armored()){
        ctx.fillStyle = Math.sin(t * 18) > 0 ? P.lblu : P.wht;
        for (let a = 0; a < 16; a++){
          if ((a + Math.floor(t * 10)) % 2) continue;
          const ang = a / 16 * Math.PI * 2;
          ctx.fillRect(Math.round(C.wx + Math.cos(ang) * 14), Math.round(C.wy + Math.sin(ang) * 14), 1, 1);
        }
      }
    },
  };
  return b;
}

// ---------------------------------------------------------------------
//  LEVIATHAN (Titan): a weaving serpent; cut the body to expose the head
// ---------------------------------------------------------------------
function makeLeviathan(){
  const N = 7;
  const segs = [];
  for (let i = 0; i < N; i++) segs.push(mkPart('s' + i, 9, 9, 9, { dropCd: 3 + i * 0.7 + rnd(0, 2), charge: 0 }));
  const aliveSegs = () => segs.filter(s => s.alive).length;
  const head = mkPart('H', 12, 11, 30, { armored: () => aliveSegs() > 3 });
  const segRows = discRows(8, [P.tan, P.org, P.org, P.dorg, P.dorg, P.dorg], P.yel);
  const headRows = scaleRows(shapeRows([3, 6, 8, 9, 9, 8, 6, 3], [P.yel, P.tan, P.org, P.org, P.red, P.dred, P.dorg, P.blk]), 1.4, 1.5);
  const b = {
    name: 'LEVIATHAN', parts: segs.concat([head]), pt: 0, spit: 2.5, score: 4000,
    deathW: 80, deathH: 24, deathX(){ return head.wx; }, deathY(){ return head.wy; },
    isDead(){ return !head.alive; },
    barFrac(){ let hp = 0; for (const s of segs) if (s.alive) hp += s.hp; if (head.alive) hp += head.hp; return hp / (N * 9 + 30); },
    posAt(pt){ return { x: 128 + Math.sin(pt * 0.5) * 104, y: 56 + BOSS_DROP + Math.sin(pt * 1.3) * 20 }; },
    layout(){
      const intro = easeOut(clamp(this.life / 1.8, 0, 1));
      const off = (1 - intro) * 80;
      const hp = this.posAt(this.pt);
      head.wx = hp.x; head.wy = hp.y - off;
      for (let i = 0; i < N; i++){
        const sp = this.posAt(this.pt - (i + 1) * 0.34);
        segs[i].wx = sp.x; segs[i].wy = sp.y - off;
      }
    },
    update(dt){
      this.life += dt;
      const enr = this.barFrac() < 0.5 ? 1 : 0;
      this.pt += dt * (1 + enr * 0.5);
      this.layout();
      for (const s of segs){
        if (!s.alive) continue;
        if (s.charge > 0){
          s.charge -= dt;
          if (s.charge <= 0){
            if (enr && Math.random() < 0.3) spawnEnemy('heavybomb', s.wx, s.wy + 8, 0, 32);
            else spawnEnemy('ipbm', s.wx, s.wy + 8, rnd(-10, 10), 28 * speedMul);
            sfx('bossShot');
            s.dropCd = (enr ? 1.8 : 2.7) + rnd(0, 2.0);
          }
        } else {
          s.dropCd -= dt;
          if (s.dropCd <= 0) s.charge = 0.6;
        }
      }
      if (head.alive){
        this.spit -= dt;
        if (this.spit <= 0){
          this.spit = enr ? 2.0 : 2.8;
          spawnEnemy('smart', head.wx, head.wy + 8, 0);
          sfx('bossShot');
        }
      }
    },
    onPartDead(p){
      if (p === head){ for (const s of segs) if (s.alive){ s.alive = false; bossBlast(s.wx, s.wy, 16); } }
    },
    draw(t){
      const dead = this.state === 'dying';
      const fl = dead && Math.sin(t * 40) > 0;
      for (let i = N - 1; i >= 0; i--){
        const s = segs[i];
        if (!s.alive && !dead) continue;
        if (!s.alive && dead && head.alive) continue;
        const rows = (s.charge > 0 && Math.sin(t * 30) > 0) ? discRows(8, [P.wht, P.yel, P.yel, P.org, P.org, P.dorg]) : segRows;
        drawRows(s.wx, s.wy, rows, s.flash > 0 || fl);
      }
      drawRows(head.wx, head.wy, headRows, head.flash > 0 || fl);
      ctx.fillStyle = P.red;
      ctx.fillRect(Math.round(head.wx) - 6, Math.round(head.wy) - 2, 3, 3);
      ctx.fillRect(Math.round(head.wx) + 3, Math.round(head.wy) - 2, 3, 3);
      ctx.fillStyle = P.wht;
      ctx.fillRect(Math.round(head.wx) - 6, Math.round(head.wy) - 2, 1, 1);
      ctx.fillRect(Math.round(head.wx) + 3, Math.round(head.wy) - 2, 1, 1);
      if (head.alive && head.armored()){
        ctx.fillStyle = Math.sin(t * 18) > 0 ? P.yel : P.wht;
        for (let a = 0; a < 14; a++){
          if ((a + Math.floor(t * 10)) % 2) continue;
          const ang = a / 14 * Math.PI * 2;
          ctx.fillRect(Math.round(head.wx + Math.cos(ang) * 12), Math.round(head.wy + Math.sin(ang) * 11), 1, 1);
        }
      }
    },
  };
  return b;
}

// ---------------------------------------------------------------------
//  CYCLOPS (Io): an eye that burns cities with a charged laser
//  Hit it while it charges to break the beam.
// ---------------------------------------------------------------------
function makeCyclops(){
  const R = 27;
  const housing = discRows(R, [P.dorg, P.org, P.org, P.tan, P.tan, P.org, P.dorg, P.dred, P.dred]);
  const sclera = discRows(17, [P.wht, P.wht, P.pnk, P.pnk, P.wht]);
  const iris = discRows(10, [P.yel, P.org, P.red, P.red, P.dred]);
  const pupil = discRows(5, [P.blk]);
  const E = mkPart('E', 14, 14, 62);
  const lz = { s: 'idle', t: 2.2, targets: [], hits: 0, stun: 0 };
  const b = {
    name: 'CYCLOPS', parts: [E], x: 128, y: 62, lid: 1, lidState: 'opening', openT: 0, closedT: 0, fanN: 0, fanCd: 0, score: 4500, lz,
    deathW: 20, deathH: 20, deathX(){ return this.x; }, deathY(){ return this.y; },
    isDead(){ return !E.alive; },
    barFrac(){ return E.hp / E.maxhp; },
    layout(){
      const intro = easeOut(clamp(this.life / 1.8, 0, 1));
      this.x = 128; this.y = 62 + BOSS_DROP - (1 - intro) * 90;
      E.wx = this.x; E.wy = this.y;
    },
    pickTargets(n){
      const alive = installations.filter(i => i.alive).slice();
      const out = [];
      while (out.length < n && alive.length){ out.push(alive.splice(rndi(0, alive.length - 1), 1)[0]); }
      return out;
    },
    update(dt){
      this.life += dt; this.layout();
      const enr = this.barFrac() < 0.5;
      if (this.lidState === 'open'){
        this.lid = Math.max(0, this.lid - dt * 3);
        this.openT += dt;
        if (lz.s === 'idle'){
          lz.t -= dt;
          if (lz.t <= 0){
            lz.targets = this.pickTargets(enr ? 2 : 1);
            if (lz.targets.length){ lz.s = 'charge'; lz.t = enr ? 1.1 : 1.4; lz.hits = 0; sfx('laserCharge'); }
            else lz.t = 1;
          }
        } else if (lz.s === 'charge'){
          lz.t -= dt;
          if (lz.hits >= 3){
            lz.s = 'stun'; lz.stun = 2.2; lz.targets = [];
            popups.push({ x: this.x, y: this.y + 34, text: 'INTERRUPT', t: 0, dur: 1.2, col: P.wht, big: true });
            sfx('partKill'); shake = Math.max(shake, 0.6);
            addScore(300);
          } else if (lz.t <= 0){
            lz.s = 'fire'; lz.t = 0.9;
            for (const c of lz.targets){ if (c.alive){ if (damageCity(c, c.x)) return; } }
            sfx('laserFire'); shake = Math.max(shake, 1.0); flashT = Math.max(flashT, 0.25);
          }
        } else if (lz.s === 'fire'){
          lz.t -= dt;
          if (lz.t <= 0){ lz.s = 'cool'; lz.t = 1.0; lz.targets = []; }
        } else if (lz.s === 'cool'){
          lz.t -= dt;
          if (lz.t <= 0){ lz.s = 'idle'; lz.t = enr ? 0.8 : 1.6; }
        } else if (lz.s === 'stun'){
          lz.stun -= dt;
          if (lz.stun <= 0){ lz.s = 'cool'; lz.t = 0.8; }
        }
        if (this.openT > (enr ? 6 : 8) && (lz.s === 'idle' || lz.s === 'cool')){ this.lidState = 'closing'; }
      } else if (this.lidState === 'closing'){
        this.lid = Math.min(1, this.lid + dt * 3);
        if (this.lid >= 1){ this.lidState = 'closed'; this.closedT = enr ? 3.0 : 2.6; this.fanN = 0; this.fanCd = 0.3; lz.s = 'idle'; lz.t = 1.5; }
      } else if (this.lidState === 'closed'){
        this.closedT -= dt;
        this.fanCd -= dt;
        if (this.fanCd <= 0 && this.fanN < (enr ? 8 : 6)){
          this.fanCd = 0.32; this.fanN++;
          launchAt('ipbm', this.x + rnd(-14, 14), this.y + 24, randomCityX(), 1);
        }
        if (this.closedT <= 0) this.lidState = 'opening';
      } else if (this.lidState === 'opening'){
        this.lid = Math.max(0, this.lid - dt * 3);
        if (this.lid <= 0){ this.lidState = 'open'; this.openT = 0; }
      }
    },
    draw(t){
      const dead = this.state === 'dying';
      const fl = dead && Math.sin(t * 40) > 0;
      const flash = E.flash > 0 || fl;
      drawRows(this.x, this.y, housing, flash);
      // studs on the housing
      ctx.fillStyle = P.blk;
      for (let a = 0; a < 12; a++){
        const ang = a / 12 * Math.PI * 2;
        ctx.fillRect(Math.round(this.x + Math.cos(ang) * 24), Math.round(this.y + Math.sin(ang) * 24), 1, 1);
      }
      const open = 1 - this.lid;
      if (open > 0.05){
        drawRows(this.x, this.y, sclera, flash);
        const trackX = lz.targets.length && lz.s === 'charge' ? clamp((lz.targets[0].x - 128) * 0.06, -6, 6) : clamp((aim.x - 128) * 0.05, -6, 6);
        const px = this.x + trackX, py = this.y + clamp((mirrorY(aim.y) - this.y) * 0.02, -2, 3);
        drawRows(px, py, iris, flash);
        const charging = lz.s === 'charge' && Math.sin(t * 24) > 0;
        drawRows(px, py, charging ? discRows(5, [P.wht]) : pupil, false);
        if (lz.s === 'stun'){ ctx.fillStyle = Math.sin(t * 20) > 0 ? P.wht : P.yel; ctx.fillRect(Math.round(px) - 2, Math.round(py) - 1, 5, 3); }
        else { ctx.fillStyle = P.wht; ctx.fillRect(Math.round(px) - 2, Math.round(py) - 3, 2, 2); }
      }
      // eyelids close from top and bottom
      if (this.lid > 0.01){
        const reach = this.lid * 18;
        for (let dy = -17; dy <= 17; dy++){
          const hw = Math.round(Math.sqrt(Math.max(0, 17 * 17 - dy * dy)));
          const top = dy < -17 + reach, bot = dy > 17 - reach;
          if (!top && !bot) continue;
          const edge = (top && dy >= -17 + reach - 1) || (bot && dy <= 17 - reach + 1);
          ctx.fillStyle = edge ? P.blk : (top ? P.dred : P.dorg);
          ctx.fillRect(Math.round(this.x - hw), Math.round(this.y + dy), hw * 2, 1);
        }
      }
      if (E.alive && this.lid > 0.55){
        ctx.fillStyle = Math.sin(t * 18) > 0 ? P.yel : P.wht;
        for (let a = 0; a < 18; a++){
          if ((a + Math.floor(t * 10)) % 2) continue;
          const ang = a / 18 * Math.PI * 2;
          ctx.fillRect(Math.round(this.x + Math.cos(ang) * 30), Math.round(this.y + Math.sin(ang) * 30), 1, 1);
        }
      }
    },
    drawFront(t){
      if (this.state !== 'fight') return;
      if (lz.s !== 'charge' && lz.s !== 'fire') return;
      for (const c of lz.targets){
        const x0 = this.x, vy0 = this.y + 6, x1 = c.x, vy1 = GROUND - 6;
        if (lz.s === 'charge'){
          if (Math.sin(t * 22) < 0) continue;
          ctx.fillStyle = P.red;
          for (let vy = Math.ceil(vy0); vy < vy1; vy += 4){
            const sy = vy < SH ? vy : vy + GAP;
            if (sy > SH - 1 && sy < BOT) continue;
            ctx.fillRect(Math.round(x0 + (x1 - x0) * (vy - vy0) / (vy1 - vy0)), sy, 1, 2);
          }
          ctx.fillStyle = Math.sin(t * 22) > 0.5 ? P.wht : P.red;
          ctx.fillRect(Math.round(c.x) - 6, GROUND - 3, 13, 1);
        } else {
          const fl2 = Math.floor(t * 30) % 3;
          const cols = [P.wht, P.yel, P.pnk];
          for (let vy = Math.ceil(vy0); vy < vy1; vy++){
            const sy = vy < SH ? vy : vy + GAP;
            if (sy > SH - 1 && sy < BOT) continue;
            const xx = Math.round(x0 + (x1 - x0) * (vy - vy0) / (vy1 - vy0));
            ctx.fillStyle = P.red; ctx.fillRect(xx - 5, sy, 10, 1);
            ctx.fillStyle = P.org; ctx.fillRect(xx - 3, sy, 6, 1);
            ctx.fillStyle = cols[fl2]; ctx.fillRect(xx - 1, sy, 2, 1);
          }
        }
      }
    },
  };
  E.dmgMul = () => (lz.s === 'stun' ? 2 : 1);
  E.armored = () => b.lid > 0.55;
  E.onHit = () => { if (lz.s === 'charge') lz.hits++; };
  return b;
}

// ---------------------------------------------------------------------
//  HYDRA (Enceladus): three heads that grow back; the body only opens
//  when two or more heads are down
// ---------------------------------------------------------------------
function makeHydra(){
  const heads = [0, 1, 2].map(i => mkPart('h' + i, 12, 11, 14, { anchor: (i - 1) * 62, regrow: 0, cd: 2 + i * 1.1 }));
  const deadHeads = () => heads.filter(h => !h.alive).length;
  const body = mkPart('B', 19, 17, 34, { openT: 0, armored: () => body.openT <= 0 });
  const bodyRows = discRows(18, [P.lgrn, P.grn, P.grn, P.dgrn, P.dgrn, P.dgrn], P.wht);
  const headRows = scaleRows(shapeRows([2, 5, 7, 8, 8, 7, 5, 3], [P.wht, P.lgrn, P.lgrn, P.grn, P.grn, P.dgrn, P.dgrn, P.blk]), 1.4, 1.5);
  const neckRows = discRows(4, [P.lgrn, P.grn, P.dgrn]);
  const b = {
    name: 'HYDRA', parts: [body].concat(heads), bodyCd: 1.5, bodyN: 0, score: 5000,
    deathW: 44, deathH: 34, deathX(){ return body.wx; }, deathY(){ return body.wy + 14; },
    isDead(){ return !body.alive; },
    barFrac(){ return body.hp / body.maxhp; },
    layout(){
      const intro = easeOut(clamp(this.life / 1.8, 0, 1));
      const off = (1 - intro) * 80;
      body.wx = 128 + Math.sin(this.life * 0.4) * 14; body.wy = 46 + BOSS_DROP - off;
      for (let i = 0; i < 3; i++){
        const h = heads[i];
        h.wx = body.wx + h.anchor + Math.sin(this.life * 0.8 + i * 2.1) * 22;
        h.wy = 90 + BOSS_DROP + Math.sin(this.life * 1.1 + i * 1.7) * 12 - off;
      }
    },
    update(dt){
      this.life += dt; this.layout();
      const enr = body.hp / body.maxhp < 0.5 ? 1 : 0;
      if (body.openT > 0) body.openT -= dt;
      else if (deadHeads() >= 2){ body.openT = 8; sfx('warning'); popups.push({ x: body.wx, y: body.wy + 22, text: 'CORE OPEN', t: 0, dur: 1.2, col: P.lgrn, big: false }); }
      for (let i = 0; i < 3; i++){
        const h = heads[i];
        if (!h.alive){
          if (body.alive){
            h.regrow -= dt;
            if (h.regrow <= 0){ h.alive = true; h.hp = 10; h.maxhp = 10; h.flash = 0.2; h.cd = 1.5; sfx('bossShot'); }
          }
          continue;
        }
        h.cd -= dt;
        if (h.cd <= 0){
          h.cd = (2.8 - enr * 0.7) + rnd(-0.3, 0.5);
          const tx = randomCityX();
          if (i === 0){
            launchAt('ipbm', h.wx, h.wy + 6, tx, 1);
            launchAt('ipbm', h.wx, h.wy + 6, tx - 26, 1);
            launchAt('ipbm', h.wx, h.wy + 6, tx + 26, 1);
          } else if (i === 1){
            spawnEnemy('smart', h.wx, h.wy + 8, 0);
            sfx('bossShot');
          } else {
            launchAt('splitter', h.wx, h.wy + 6, tx, 1);
          }
        }
      }
      if (body.alive && !body.armored()){
        this.bodyCd -= dt;
        if (this.bodyCd <= 0){
          this.bodyCd = 1.1 - enr * 0.3; this.bodyN++;
          launchAt('ipbm', body.wx + rnd(-8, 8), body.wy + 12, randomCityX(), 1.1);
        }
      }
    },
    onPartDead(p){
      if (p === body){ for (const h of heads) if (h.alive){ h.alive = false; bossBlast(h.wx, h.wy, 14); } }
      else p.regrow = 16;
    },
    drawPips(x, y){
      for (let i = 0; i < 3; i++){
        ctx.fillStyle = heads[i].alive ? P.lgrn : P.dgrn;
        ctx.fillRect(x - 3 - i * 5, y, 3, 3);
      }
    },
    draw(t){
      const dead = this.state === 'dying';
      const fl = dead && Math.sin(t * 40) > 0;
      for (let i = 0; i < 3; i++){
        const h = heads[i];
               const sx = body.wx + h.anchor * 0.3, sy = body.wy + 10;
        const n = h.alive || dead ? 8 : 3;
        for (let k = 1; k <= n; k++){
          const u = k / 8;
          const nx = sx + (h.wx - sx) * u + Math.sin(u * 5 + this.life * 3 + i) * 3;
          const ny = sy + (h.wy - sy) * u + (h.alive || dead ? 0 : u * 6);
          drawRows(nx, ny, neckRows, fl);
        }
      }
      drawRows(body.wx, body.wy, bodyRows, body.flash > 0 || fl);
      // core eye on the body
      if (!body.armored() || dead){
        ctx.fillStyle = Math.sin(t * 14) > 0 ? P.red : P.pnk;
        ctx.fillRect(Math.round(body.wx) - 5, Math.round(body.wy) + 2, 10, 8);
        ctx.fillStyle = P.blk;
        ctx.fillRect(Math.round(body.wx) - 1, Math.round(body.wy) + 3, 2, 6);
      } else {
        ctx.fillStyle = P.blk;
        ctx.fillRect(Math.round(body.wx) - 5, Math.round(body.wy) + 2, 10, 8);
        ctx.fillStyle = Math.sin(t * 18) > 0 ? P.lgrn : P.wht;
        for (let a = 0; a < 18; a++){
          if ((a + Math.floor(t * 10)) % 2) continue;
          const ang = a / 18 * Math.PI * 2;
          ctx.fillRect(Math.round(body.wx + Math.cos(ang) * 22), Math.round(body.wy + Math.sin(ang) * 20), 1, 1);
        }
      }
      for (const h of heads){
        if (!h.alive && !dead) continue;
        drawRows(h.wx, h.wy, headRows, h.flash > 0 || fl);
        ctx.fillStyle = P.red;
        ctx.fillRect(Math.round(h.wx) - 6, Math.round(h.wy) - 3, 3, 3);
        ctx.fillRect(Math.round(h.wx) + 3, Math.round(h.wy) - 3, 3, 3);
        const open = h.cd < 0.5;
        ctx.fillStyle = P.blk;
        ctx.fillRect(Math.round(h.wx) - 4, Math.round(h.wy) + 3, 8, open ? 4 : 1);
      }
    },
  };
  return b;
}

// ---------------------------------------------------------------------
//  ARBITER (Triton): shield plates, then the core, then a final rage
// ---------------------------------------------------------------------
function makeArbiter(){
  const plates = [0, 1, 2, 3].map(i => mkPart('p' + i, 9, 9, 14, { ang: i * Math.PI / 2, cd: 2 + i * 0.8 }));
  const core = mkPart('C', 15, 15, 50, { armored: () => plates.some(p => p.alive) });
  const coreRows = scaleRows([
    [2, P.wht], [4, P.pnk], [6, P.lmag], [8, P.lmag], [10, P.mag], [12, P.mag],
    [13, P.pur, 4, P.yel], [13, P.pur, 5, P.red], [12, P.dmag, 4, P.blk], [10, P.dmag], [8, P.dpur], [6, P.dpur], [4, P.blk], [2, P.blk],
  ], 1.25, 1.35);
  const plateRows = scaleRows(shapeRows([5, 6, 6, 6, 6, 5], [P.lpur, P.pur, P.pur, P.dpur, P.dpur, P.blk]), 1.4, 1.6);
  const b = {
    name: 'ARBITER', parts: [core].concat(plates), x: 128, y: 56, coreN: 0, coreCd: 2, ringCd: 3, carrierCd: 12, raged: false, score: 8000,
    deathW: 34, deathH: 26, deathX(){ return this.x; }, deathY(){ return this.y; }, deathTime: 3.2,
    isDead(){ return !core.alive; },
    barFrac(){ let hp = 0; for (const p of plates) if (p.alive) hp += p.hp; if (core.alive) hp += core.hp; return hp / (4 * 14 + 50); },
    layout(){
      const intro = easeOut(clamp(this.life / 1.8, 0, 1));
      const open = !plates.some(p => p.alive);
      const amp = open ? 70 : 30;
      this.x = 128 + Math.sin(this.life * 0.7) * amp * intro;
      this.y = 62 + BOSS_DROP + Math.sin(this.life * 1.4) * (open ? 14 : 6) - (1 - intro) * 90;
      core.wx = this.x; core.wy = this.y;
      for (const p of plates){
        const a = p.ang + this.life * 0.9;
        p.wx = this.x + Math.cos(a) * 52; p.wy = this.y + Math.sin(a) * 30;
      }
    },
    update(dt){
      this.life += dt; this.layout();
      for (const p of plates){
        if (!p.alive) continue;
        p.cd -= dt;
        if (p.cd <= 0){
          p.cd = (this.raged ? 2.1 : 3.0) + rnd(-0.4, 0.6);
          if (Math.random() < 0.3) { spawnEnemy('smart', p.wx, p.wy + 8, 0); sfx('bossShot'); }
          else launchAt('ipbm', p.wx, p.wy + 8, randomCityX(), 1);
        }
      }
      if (core.alive && !core.armored()){
        this.coreCd -= dt;
        if (this.coreCd <= 0){
          this.coreCd = this.raged ? 1.8 : 2.8; this.coreN++;
          spawnEnemy(this.coreN % 2 ? 'colbomb' : 'rowbomb', core.wx, core.wy + 14, rnd(-12, 12));
          sfx('bossShot');
          if (this.coreN % 3 === 0) launchAt('ipbm', core.wx, core.wy + 14, randomCityX(), 1.1);
        }
      }
      if (!this.raged && core.alive && core.hp <= core.maxhp * 0.4){
        this.raged = true;
        popups.push({ x: W / 2, y: 100, text: 'ENRAGED', t: 0, dur: 1.5, col: P.red, big: true });
        sfx('warning'); shake = Math.max(shake, 1.0); flashT = Math.max(flashT, 0.4);
        for (let i = 0; i < 2; i++){ plates[i * 2].alive = true; plates[i * 2].hp = 9; plates[i * 2].maxhp = 9; plates[i * 2].flash = 0.3; }
      }
      if (this.raged && core.alive){
        this.ringCd -= dt;
        if (this.ringCd <= 0){
          this.ringCd = 4.2;
          for (let i = 0; i < 9; i++){
            const a = Math.PI * (0.12 + 0.76 * i / 8);
            spawnEnemy('ipbm', core.wx, core.wy + 10, Math.cos(a) * 42, Math.sin(a) * 40 * speedMul);
          }
          sfx('boss');
        }
        this.carrierCd -= dt;
        if (this.carrierCd <= 0){
          this.carrierCd = 16;
          const left = Math.random() < 0.5;
          spawnEnemy('carrier', left ? -12 : W + 12, rndi(40, 100), (left ? 1 : -1) * 14);
        }
      }
    },
    draw(t){
      const dead = this.state === 'dying';
      const fl = dead && Math.sin(t * 40) > 0;
      // faint orbit track
      ctx.fillStyle = P.dpur;
      for (let a = 0; a < 40; a++){
        const ang = a / 40 * Math.PI * 2;
        ctx.fillRect(Math.round(this.x + Math.cos(ang) * 52), Math.round(this.y + Math.sin(ang) * 30), 1, 1);
      }
      for (const p of plates){
        if (!p.alive && !dead) continue;
        drawRows(p.wx, p.wy, plateRows, p.flash > 0 || fl);
      }
      drawRows(core.wx, core.wy, coreRows, core.flash > 0 || fl);
      if (core.alive && core.armored()){
        ctx.fillStyle = Math.sin(t * 18) > 0 ? P.lpur : P.wht;
        for (let a = 0; a < 20; a++){
          if ((a + Math.floor(t * 10)) % 2) continue;
          const ang = a / 20 * Math.PI * 2;
          ctx.fillRect(Math.round(core.wx + Math.cos(ang) * 21), Math.round(core.wy + Math.sin(ang) * 21), 1, 1);
        }
      }
    },
  };
  return b;
}
