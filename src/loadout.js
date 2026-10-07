'use strict';
// Loadout: cosmetics and score mods
// =====================================================================
//  LOADOUT: cosmetics earned through achievements, and score mods
// =====================================================================
const RETICLES = ['CROSS', 'DOT', 'BOX', 'DIAMOND', 'BRACKETS', 'TICKS', 'SCOPE', 'CIRCLE'];
const SHOTS    = ['AMBER', 'TRACER', 'TWIN', 'WAVE', 'SPARK', 'BEAM', 'RAINBOW', 'STAR'];
const BLASTS   = ['SPECTRUM', 'FIRE', 'ICE', 'TOXIC', 'VIOLET', 'MONO'];
const CITIES   = ['DOME', 'TOWER', 'REACTOR', 'ARCOLOGY', 'FOUNDRY', 'PAGODA'];
const LOAD_CATS = ['reticle', 'shot', 'blast', 'city'];
const LOAD_LISTS = [RETICLES, SHOTS, BLASTS, CITIES];
const LOAD_TABS = ['RETICLE', 'SHOT', 'BLAST', 'CITY', 'MODS'];

const SHOT_STYLES = [
  { c1: P.yel,  c2: P.org,  head: P.wht },
  { c1: P.red,  c2: P.dred, head: P.pnk },
  { c1: P.lblu, c2: P.blu,  head: P.wht },
  { c1: P.lgrn, c2: P.grn,  head: P.wht },
  { c1: P.lmag, c2: P.mag,  head: P.wht },
  { c1: P.wht,  c2: P.gry,  head: P.wht },
  null,
  { c1: P.yel,  c2: P.tan,  head: P.yel },
];
const BLAST_PALS = [
  RAINBOW,
  [P.dred, P.red, P.org, P.yel, P.tan, P.wht, P.org],
  [P.dblu, P.blu, P.lblu, P.wht, P.lblu, P.blu, P.lpur],
  [P.dgrn, P.grn, P.lgrn, P.yel, P.lgrn, P.grn, P.olk],
  [P.dpur, P.pur, P.lpur, P.lmag, P.mag, P.lpur, P.pur],
  [P.gry, P.wht, P.gry, P.wht, P.gry, P.wht, P.gry],
];
const MODS = [
  { id:'rearm', name:'SLOW REARM', bonus:0.25, unlock:0, desc:'TURRETS RELOAD 50% SLOWER' },
  { id:'swift', name:'SWIFT',      bonus:0.35, unlock:1, desc:'ENEMIES MOVE 25% FASTER' },
  { id:'blind', name:'BLIND',      bonus:0.30, unlock:2, desc:'NO IMPACT WARNINGS' },
  { id:'heavy', name:'HEAVY RAIN', bonus:0.40, unlock:3, desc:'50% MORE MISSILES' },
  { id:'glass', name:'GLASS',      bonus:0.60, unlock:4, desc:'ONLY FOUR CITIES' },
];

const DEFAULT_LOADOUT = { reticle:0, shot:0, blast:0, city:0, mods:[] };
let loadout = Object.assign({}, DEFAULT_LOADOUT, safeLoad(KEY('load'), { reticle: opts.reticle || 0 }));
if (!Array.isArray(loadout.mods)) loadout.mods = [];
function saveLoadout(){ safeSave(KEY('load'), loadout); }

function rewardAch(cat, idx){ return ACHIEVEMENTS.find(a => a.reward && a.reward[0] === cat && a.reward[1] === idx); }
function itemUnlocked(cat, idx){
  if (DEV_UNLOCK_ALL || idx === 0) return true;
  if (cat === 'reticle' && idx < 3) return true;
  const a = rewardAch(cat, idx);
  return !a || unlockedAch.includes(a.id);
}
function modUnlocked(m){ return DEV_UNLOCK_ALL || camp.clears[m.unlock] > 0; }
function sanitizeLoadout(){
  for (let c = 0; c < LOAD_CATS.length; c++){
    const cat = LOAD_CATS[c];
    let v = loadout[cat];
    if (typeof v !== 'number' || v < 0 || v >= LOAD_LISTS[c].length || !itemUnlocked(cat, v)) v = 0;
    loadout[cat] = v;
  }
  loadout.mods = loadout.mods.filter(id => { const m = MODS.find(x => x.id === id); return m && modUnlocked(m); });
}
function applyLoadout(){
  sanitizeLoadout();
  blastPal = BLAST_PALS[loadout.blast] || RAINBOW;
  blastStyle = loadout.blast;
}
function modMult(ids){
  let m = 1;
  for (const id of ids){ const d = MODS.find(x => x.id === id); if (d) m += d.bonus; }
  return m;
}

// Each unlockable shot has its own trail shape, not just a color
function drawShotTrail(x0, y0, cx, cy, sc, alpha, t){
  const k = loadout.shot, dx = cx - x0, dy = cy - y0, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const dot = (x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); };
  if (k === 0 || k === 6 || k === 4){
    drawJaggedTrail(x0, y0, cx, cy, sc.c1, 1, alpha);
    drawJaggedTrail(x0, y0, cx, cy, sc.c2, 2, alpha);
    if (k === 4 && len > 6){
      const prevA = ctx.globalAlpha; ctx.globalAlpha = alpha;
      for (let i = 0; i < 6; i++){
        const d = ((i * 37 + Math.floor(t * 30) * 11) % Math.floor(len));
        const o = ((i % 2) ? 3 : -3) + ((i * 7) % 3 - 1);
        dot(x0 + ux * d + nx * o, y0 + uy * d + ny * o, i % 2 ? P.wht : sc.c1);
      }
      ctx.globalAlpha = prevA;
    }
    return;
  }
  const prevA = ctx.globalAlpha; ctx.globalAlpha = alpha;
  for (let d = 0; d < len; d++){
    const px = x0 + ux * d, py = y0 + uy * d;
    if (k === 1){ if (d % 6 < 4) dot(px, py, sc.c1, 1, 1); if (d % 6 < 2) dot(px + nx, py + ny, sc.c2); }
    else if (k === 2){ dot(px + nx * 2, py + ny * 2, sc.c1); dot(px - nx * 2, py - ny * 2, sc.c1); if (d % 7 === 0) dot(px, py, sc.c2); }
    else if (k === 3){ const w = Math.sin(d * 0.35 - t * 25) * 3; dot(px + nx * w, py + ny * w, sc.c1); dot(px + nx * w + 1, py + ny * w, sc.c2); }
    else if (k === 5){ dot(px, py, sc.c2); dot(px + nx, py + ny, sc.c1); dot(px - nx, py - ny, sc.c1); }
    else if (k === 7){ if (d % 4 === 0){ dot(px, py - 1, sc.c1, 1, 3); dot(px - 1, py, sc.c1, 3, 1); } else if (d % 4 === 2) dot(px, py, sc.c2); }
  }
  ctx.globalAlpha = prevA;
}
function drawShotHead(cx, cy){
  const k = loadout.shot, sc = shotColors(performance.now() / 1000);
  const x = Math.round(cx), y = Math.round(cy);
  ctx.fillStyle = sc.head;
  if (k === 1){ ctx.fillRect(x - 1, y - 1, 3, 3); }
  else if (k === 5){ ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = sc.c1; ctx.fillRect(x, y, 1, 1); }
  else if (k === 7){ ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 2, y, 5, 1); }
  else if (k === 2){ ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x, y - 1, 1, 2); }
  else { ctx.fillRect(x, y, 2, 1); ctx.fillRect(x, y - 1, 1, 1); }
}
function shotColors(t){
  if (loadout.shot === 6){
    const i = Math.floor(t * 18) % 7;
    return { c1: RAINBOW[i], c2: RAINBOW[(i + 3) % 7], head: P.wht };
  }
  return SHOT_STYLES[loadout.shot] || SHOT_STYLES[0];
}

// Run-time mod flags, captured when a run starts
let runMods = [], modSlow = false, modSwift = false, modBlind = false, modHeavy = false, modGlass = false;
let scoreMul = 1;
function captureMods(){
  runMods = loadout.mods.filter(id => { const m = MODS.find(x => x.id === id); return m && modUnlocked(m); });
  modSlow = runMods.includes('rearm'); modSwift = runMods.includes('swift'); modBlind = runMods.includes('blind');
  modHeavy = runMods.includes('heavy'); modGlass = runMods.includes('glass');
  scoreMul = modMult(runMods);
}
function addScore(n){ score += Math.round(n * scoreMul); }

// ---- Loadout screen -------------------------------------------------
let loadTab = 0, loadSel = 0;
const LOAD_Y0 = 44, LOAD_STEP = 15;
function loadCount(tab){ return tab === 4 ? MODS.length : LOAD_LISTS[tab].length; }
function loadEquipped(tab, i){
  if (tab === 4) return loadout.mods.includes(MODS[i].id);
  return loadout[LOAD_CATS[tab]] === i;
}
function loadUnlocked(tab, i){
  if (tab === 4) return modUnlocked(MODS[i]);
  return itemUnlocked(LOAD_CATS[tab], i);
}
function openLoadout(){
  menuState = 'loadout'; loadTab = 0; loadSel = loadout.reticle;
  demo.t = 0; demo.shots = []; demo.booms = []; demo.next = 0.4;
  sfx('select');
}
function loadMoveTab(d){
  loadTab = (loadTab + d + LOAD_TABS.length) % LOAD_TABS.length;
  loadSel = 0;
  if (loadTab < 4) loadSel = loadout[LOAD_CATS[loadTab]];
  sfx('move');
}
function activateLoad(i){
  loadSel = i;
  if (!loadUnlocked(loadTab, i)){ sfx('locked'); return; }
  if (loadTab === 4){
    const id = MODS[i].id;
    const at = loadout.mods.indexOf(id);
    if (at >= 0) loadout.mods.splice(at, 1); else loadout.mods.push(id);
    sfx('toggle');
  } else {
    loadout[LOAD_CATS[loadTab]] = i;
    applyLoadout();
    sfx('select');
  }
  saveLoadout();
}

function loadSelectTab(i){
  if (loadTab === i) return;
  loadTab = i; loadSel = i < 4 ? loadout[LOAD_CATS[i]] : 0; sfx('move');
}
function drawLoadoutScreen(t){
  uiHeader('LOADOUT', { shoulders: [() => loadMoveTab(-1), () => loadMoveTab(1)] });
  // tabs
  for (let i = 0; i < LOAD_TABS.length; i++){
    const x = 3 + i * 51, y = 24, w = 49, sel = loadTab === i;
    const c = sel ? UI_SELECT : UI_NORMAL;
    uiPlate(x, y, w, 13, c[0], c[1], c[2], c[3]);
    const s = LOAD_TABS[i];
    drawText(s, x + Math.round((w - textW(s)) / 2), y + 4, sel ? P.yel : P.wht);
    uiHit(x, y, w, 13, () => loadSelectTab(i));
  }
  const n = loadCount(loadTab);
  for (let i = 0; i < n; i++){
    const y = 41 + i * 15, sel = loadSel === i;
    const open = loadUnlocked(loadTab, i), eq = loadEquipped(loadTab, i);
    const name = loadTab === 4 ? MODS[i].name : LOAD_LISTS[loadTab][i];
    let st = '', stc;
    if (!open){ st = 'LOCKED'; }
    else if (loadTab === 4){ st = (eq ? 'ON  ' : 'OFF ') + 'X+' + Math.round(MODS[i].bonus * 100) + '%'; stc = eq ? P.lgrn : P.gry; }
    else if (eq){ st = 'EQUIPPED'; stc = P.lgrn; }
    uiButton(6, y, W - 12, 13, name, { sel, dim: !open, icon: !open ? 'lock' : (eq ? 'check' : null), detail: st, dcol: stc, slide: uiAnim('l' + i, sel ? 1 : 0), fn: () => activateLoad(i) });
  }
  // message line: unlock hint, mod text, or the score multiplier
  let foot = '', fc = P.lblu;
  if (loadTab === 4){
    const m = MODS[loadSel];
    foot = modUnlocked(m) ? m.desc : 'CLEAR ' + WORLDS[m.unlock].name + ' TO UNLOCK';
    const mult = 'SCORE X' + modMult(loadout.mods.filter(id => modUnlocked(MODS.find(x => x.id === id)))).toFixed(2);
    drawText(mult, Math.round((W - textW(mult)) / 2), 152, P.yel);
  } else if (!loadUnlocked(loadTab, loadSel)){
    const a = rewardAch(LOAD_CATS[loadTab], loadSel);
    foot = a ? ('EARN ' + a.name + ': ' + a.desc) : 'LOCKED';
  }
  if (foot){
    uiPlate(6, 160, W - 12, 13, P.blk, null, null, P.dblu);
    drawText(foot.toUpperCase(), Math.round((W - textW(foot)) / 2), 164, fc);
  }
  uiFooter([['L', 'TAB'], ['R', 'TAB'], ['A', 'EQUIP']], () => goToTitle(2));
}

// ---- Live preview on the top screen ---------------------------------
const demo = { t: 0, shots: [], booms: [], next: 0.4 };
function updateLoadoutDemo(dt){
  demo.t += dt;
  demo.next -= dt;
  const ax = 128 + Math.sin(demo.t * 0.9) * 74, ay = 64 + Math.sin(demo.t * 1.3) * 26;
  demo.ax = ax; demo.ay = ay;
  if (demo.next <= 0){
    demo.next = 0.95;
    demo.shots.push({ x0: 128, y0: SH - 40, x1: ax, y1: ay, t: 0, dur: Math.max(0.06, Math.hypot(ax - 128, ay - (SH - 40)) / 650) });
    sfx('fire');
  }
  for (const s of demo.shots){
    s.t += dt;
    if (s.t >= s.dur){ s.done = true; demo.booms.push(new Boom(s.x1, s.y1, 'circle', { r: 28, dur: 0.55, noBoss: true })); sfx('shotBoom'); }
  }
  demo.shots = demo.shots.filter(s => !s.done);
  for (const b of demo.booms) b.update(dt);
  demo.booms = demo.booms.filter(b => !b.dead);
  updateParticles(dt);
}
function drawLoadoutPreview(t, env){
  const prevEnv = currentEnv;
  currentEnv = env;
  const baseY = SH - 28;
  // ground strip for the demo
  ctx.fillStyle = env.ground0; ctx.fillRect(0, baseY, W, SH - baseY);
  ctx.fillStyle = env.ground1; ctx.fillRect(0, baseY, W, 3);
  ctx.fillStyle = env.ground2; ctx.fillRect(0, baseY + 3, W, 1);
  for (const x of [58, 128, 198]){
    drawHabitatDome({ x: x + (x === 128 ? 0 : 0), size: x === 128 ? 9 : 8, alive: true }, t, baseY);
  }
  const tur = { x: 128, y: baseY - 4, flash: 0, alive: true, cd: 0, dry: 0 };
  const ax = demo.ax || 128, ay = demo.ay || 64;
  const dx = ax - tur.x, dy = ay - tur.y, len = Math.hypot(dx, dy) || 1;
  const barrel = { x: tur.x + dx / len * 10, y: tur.y - 2 + dy / len * 10 };
  drawTurret(tur, barrel, null, baseY);
  const sc = shotColors(t);
  for (const s of demo.shots){
    const tt = clamp(s.t / s.dur, 0, 1);
    const cx = s.x0 + (s.x1 - s.x0) * tt, cy = s.y0 + (s.y1 - s.y0) * tt;
    drawShotTrail(s.x0, s.y0, cx, cy, sc, 1, t);
    drawShotHead(cx, cy);
  }
  for (const b of demo.booms) b.draw();
  drawParticles();
  const pulse = 1 + Math.sin(t * 8) * 0.5;
  drawReticle(ax, ay, Math.sin(t * 14) > -0.35 ? P.wht : P.yel, true, pulse, loadout.reticle);
  currentEnv = prevEnv;
}

let worldCityLoss = 0, bossCityLoss = 0;
