// Injected into the page as a classic script, so it shares the game's global scope.
const SKILLS = {
  expert:  { think: 0.12, acc: 0.97, err: 4,  lead: 1.0,  hold: 0.45 },
  good:    { think: 0.20, acc: 0.92, err: 7,  lead: 0.95, hold: 0.55 },
  average: { think: 0.35, acc: 0.85, err: 12, lead: 0.7,  hold: 0.7 },
  novice:  { think: 0.55, acc: 0.70, err: 20, lead: 0.3,  hold: 0.9 },
};
function shieldDownAt(e, dt){          // will this enemy's shield be down dt seconds from now?
  if (!ETYPES[e.type].shield) return true;
  let i = e.shI, t = e.shT, up = e.shieldUp, left = dt;
  while (left > t){ left -= t; i = (i + 1) % SHIELD_PATTERN.length; t = SHIELD_PATTERN[i][1]; up = !!SHIELD_PATTERN[i][0]; }
  return !up;
}
function botThink(bot, now){
  let best = null, bu = 1e9;
  for (const e of enemies){
    if (e.dead) continue;
    const T = ETYPES[e.type], S = speedOf(T);
    if (bot.held.get(e) > now) continue;
    let urg;
    if (T.passing){
      if (e.type === 'platform' || e.type === 'satellite'){ urg = e.type === 'satellite' ? 4 : 9; }
      else if (e.dropPoints && e.dropIndex < e.dropPoints.length) urg = 4.5 + e.dropIndex * 0.3;
      else continue;
    } else if (e.vy > 0 && e.y > 6 && e.y < GROUND - 36){
      urg = (GROUND - e.y) / (e.vy * S * 1.17);
    } else continue;
    if (urg < bu){ bu = urg; best = e; }
  }
  if (boss && boss.state === 'fight' && bu > 3.2){                      // nothing pressing: work on the boss
    const parts = boss.parts.filter(q => q.alive && !(q.armored && q.armored()));
    if (parts.length && Math.random() < bot.sk.acc){
      const q = parts[Math.floor(Math.random() * parts.length)];
      aim.x = clamp(q.wx + rnd(-bot.sk.err, bot.sk.err), 5, W - 6); aim.y = clamp(q.wy + rnd(-bot.sk.err, bot.sk.err), 5, H - 6);
      _cachedActiveTurret = computeActiveTurret(); if (pickTurret()) fire();
      return;
    }
  }
  if (!best || Math.random() > bot.sk.acc) return;
  const T = ETYPES[best.type], S = speedOf(T);
  // lead the target, and for shields pick the moment the shield will be down on arrival
  let d = Math.hypot(best.x - 128, best.y - 380) / SHOT_SPEED;
  if (!shieldDownAt(best, d)) return;
  const lead = bot.sk.lead;
  let px = best.x + best.vx * S * d * lead, py = best.y + best.vy * S * d * lead;
  if (T.passing && best.dropPoints){                 // aim where the next bomb will be released
    const prog = best.fromLeft ? (best.x + 14) / (W + 28) : (W + 14 - best.x) / (W + 28);
    // just track the ship itself
  }
  const err = bot.sk.err * (1 + d * 0.4);
  aim.x = clamp(px + rnd(-err, err), 5, W - 6);
  aim.y = clamp(py + rnd(-err, err), 5, H - 6);
  _cachedActiveTurret = computeActiveTurret();
  if (pickTurret()){ fire(); bot.held.set(best, now + bot.sk.hold + d); }
}
// Plays campaign waves 1..n of one world; returns a record per wave
function playWorld(world, skillName, nWaves){
  const sk = SKILLS[skillName];
  startGame('wave', 0); setWorld(world); wave = world * WAVES_PER_WORLD; waveBannerT = 0; orbTimer = 1e9; satT = 1e9;
  nextWave();
  const bot = { sk, held: new Map() };
  const rec = [];
  let t = 0, th = 0, cur = null;
  const begin = () => ({ w: wave, t0: t, cities0: installations.filter(i => i.alive).length, turrets0: turrets.filter(x => x.alive).length, idle: 0, frames: 0, peak: 0, kills0: runStats.kills, shots0: runStats.shots, hits0: JSON.stringify(tele.cityHits) });
  cur = begin();
  while (menuState === 'game' && rec.length < nWaves && t < 60 * 15){
    th -= 1 / 60;
    if (th <= 0){ th = sk.think * rnd(0.8, 1.3); botThink(bot, t); }
    update(1 / 60); t += 1 / 60;
    if (waveState === 'spawning'){
      cur.frames++;
      if (enemies.length === 0 && choreo.q.length === 0 && t - cur.t0 > 3) cur.idle++;
      cur.peak = Math.max(cur.peak, enemies.length);
    }
    if (waveState === 'cleared' || waveState === 'worldclear'){
      rec.push({ w: formatWave(cur.w), secs: Math.round(t - cur.t0), lost: cur.cities0 - installations.filter(i => i.alive).length, turretsLost: cur.turrets0 - turrets.filter(x => x.alive).length, idlePct: Math.round(100 * cur.idle / Math.max(1, cur.frames)), peak: cur.peak, kills: runStats.kills - cur.kills0, shots: runStats.shots - cur.shots0, citiesLeft: installations.filter(i => i.alive).length });
      if (waveState === 'worldclear') break;
      waveClearTimer = Math.min(waveClearTimer, 0.05);
      for (let k = 0; k < 20 && waveState !== 'spawning' && menuState === 'game'; k++){ update(1 / 60); t += 1 / 60; }   // until the next wave begins
      cur = begin();
      bot.held.clear();
    }
  }
  const over = menuState !== 'game';
  return { rec, over, wavesDone: rec.length, citiesEnd: installations.filter(i => i.alive).length };
}
function playEndless(skillName, secs){
  const sk = SKILLS[skillName];
  startGame('endless', 0); waveBannerT = 0; orbTimer = 1e9; satT = 1e9;
  const bot = { sk, held: new Map() };
  let t = 0, th = 0, idle = 0, frames = 0; const marks = [];
  while (menuState === 'game' && t < secs){
    th -= 1 / 60; if (th <= 0){ th = sk.think * rnd(0.8, 1.3); botThink(bot, t); }
    update(1 / 60); t += 1 / 60; frames++;
    if (enemies.length === 0 && choreo.q.length === 0 && t > 5) idle++;
    if (Math.abs(t % 60) < 1 / 60 + 1e-9 || (frames % 3600 === 0)) marks.push({ t: Math.round(t), cities: installations.filter(i => i.alive).length, turrets: turrets.filter(x => x.alive).length, score, diff: endDiff() });
  }
  return { survived: Math.round(t), over: menuState !== 'game', marks, idlePct: Math.round(100 * idle / Math.max(1, frames)) };
}
