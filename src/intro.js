'use strict';
// Press start screen and first-launch briefing
// =====================================================================
//  INTRO: press start screen and first-launch briefing
// =====================================================================
const INTRO_IMG = [new Image(), new Image()];
INTRO_IMG[0].src = 'assets/intro-0.png';
INTRO_IMG[1].src = 'assets/intro-1.png';
const BRIEF_PAGES = [
  ['2057.', '', 'COMMUNISM HAS SPREAD ACROSS THE SOLAR SYSTEM.', '', 'THE SATURN SOVIETS POWER THE PEOPLE\'S STATE.'],
  ['EACH MOON, A POWER SOURCE.', '', 'LYSENKO\'S STUDIES.', 'THE BLACK CUBE OF SATURN\'S POLES.', '', 'UNLIMITED POWER ACROSS THE STARS.'],
  ['PROTECT THE ENERGY GENERATORS FROM CAPITALIST ATTACKS.', '', 'IF THE CAPITALISTS WIN, IT\'S BACK TO LANDLORDS, AND PAYING RENT.'],
  ['THE FATE OF THE WORKING CLASS IS IN YOUR HANDS.'],
];
let briefPage = 0;
function wrapText(str, maxChars){
  const out = [], words = str.split(' ');
  let line = '';
  for (const w of words){
    if ((line + (line ? ' ' : '') + w).length > maxChars){ out.push(line); line = w; }
    else line = line + (line ? ' ' : '') + w;
  }
  if (line) out.push(line);
  return out;
}
// The art is four flat colours. To give it a 2600 raster feel, a banded tint is multiplied over it
// (the way a 2600 kernel changes colour between scanlines), with fine scanlines and a slow sweep.
// Only compositing is used, so it also works from file:// where reading pixels back is blocked.
const INTRO_BANDS = [
  ['#ffffff', '#fff6d0', '#ffe9a8', '#ffd98a', '#f2bf74', '#e8a362'],
  ['#e8a362', '#f2bf74', '#ffd98a', '#ffe9a8', '#fff6d0', '#ffffff'],
];
const introTint = [];
function introTintFor(i){
  if (introTint[i]) return introTint[i];
  const c = document.createElement('canvas'); c.width = W; c.height = SH;
  const g = c.getContext('2d');
  const bands = INTRO_BANDS[i], bh = SH / bands.length;
  for (let b = 0; b < bands.length; b++){ g.fillStyle = bands[b]; g.fillRect(0, Math.round(b * bh), W, Math.ceil(bh)); }
  g.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 1; y < SH; y += 2) g.fillRect(0, y, W, 1);        // scanlines
  return (introTint[i] = c);
}
function drawIntroImg(i, t){
  const im = INTRO_IMG[i];
  if (!(im.complete && im.naturalWidth)){ ctx.fillStyle = P.dred; ctx.fillRect(0, 0, W, SH); return; }
  ctx.drawImage(im, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(introTintFor(i), 0, 0);
  ctx.globalCompositeOperation = 'screen';                       // a soft highlight sweeping down the screen
  const sy = Math.floor(((t || 0) * 38) % (SH + 60)) - 30;
  for (let k = 0; k < 6; k++){
    ctx.fillStyle = 'rgba(255,230,160,' + (0.05 - k * 0.007).toFixed(3) + ')';
    ctx.fillRect(0, sy + k * 2, W, 2);
  }
  ctx.restore();
}
function drawPressTop(t){ drawIntroImg(0, t); }
function drawPressBottom(t){
  drawIntroImg(1, t);
  if (Math.sin(t * 5) > -0.2){
    const s = Math.floor(t / 1.8) % 2 ? 'TOUCH TO BEGIN' : 'PRESS START';
    drawText2x(s, Math.round((W - textW2x(s)) / 2), 172, P.blk);
    drawText2x(s, Math.round((W - textW2x(s)) / 2), 171, P.yel);
  }
}
function drawBriefTop(t){
  ctx.fillStyle = P.blk; ctx.fillRect(0, 0, W, SH);
  ctx.fillStyle = P.rrd; ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, SH - 3, W, 3);
  ctx.fillStyle = P.yel; ctx.fillRect(0, 3, W, 1); ctx.fillRect(0, SH - 4, W, 1);
  const lines = [];
  for (const raw of BRIEF_PAGES[briefPage]){
    if (raw === '') lines.push('');
    else for (const l of wrapText(raw, 30)) lines.push(l);
  }
  const lh = 14, y0 = Math.round((SH - lines.length * lh) / 2);
  for (let i = 0; i < lines.length; i++){
    if (!lines[i]) continue;
    const col = (briefPage === 0 && i === 0) ? P.yel : P.wht;
    drawText2x(lines[i], Math.round((W - textW2x(lines[i])) / 2), y0 + i * lh, col);
  }
  const pg = (briefPage + 1) + '/' + BRIEF_PAGES.length;
  drawText(pg, W - 8 - textW(pg), SH - 14, P.gry);
}
function drawBriefBottom(t){
  drawIntroImg(1, t);
  if (Math.sin(t * 5) > -0.2){
    const s = briefPage < BRIEF_PAGES.length - 1 ? 'NEXT' : 'BEGIN';
    drawText2x(s, Math.round((W - textW2x(s)) / 2), 172, P.blk);
    drawText2x(s, Math.round((W - textW2x(s)) / 2), 171, P.yel);
  }
}
function introAdvance(){
  audioInit();
  if (menuState === 'press'){
    let seen = false;
    try { seen = !!localStorage.getItem(KEY('intro')); } catch(e){}
    sfx('select');
    if (seen){ menuState = 'title'; }
    else { menuState = 'briefing'; briefPage = 0; }
    return;
  }
  if (menuState === 'briefing'){
    sfx('select');
    if (briefPage < BRIEF_PAGES.length - 1){ briefPage++; return; }
    try { localStorage.setItem(KEY('intro'), '1'); } catch(e){}
    menuState = 'title';
  }
}

const DEFAULT_STATS = {
  gamesPlayed: 0, gamesWave: 0, gamesEndless: 0,
  totalKills: 0, totalShots: 0,
  bestChain: 0, bestWave: 0, bestTime: 0,
  bestScoreWave: 0, bestScoreEndless: 0,
  bestRush: 0, totalPlaytime: 0, citiesLost: 0, perfectWaves: 0, bossKills: 0, cratesCollected: 0,
};
// Quick save (campaign only): one slot, consumed when continued
let saveData = safeLoad(KEY('save'), null);
if (saveData && !(saveData.v === 2 && Array.isArray(saveData.inst))) saveData = null;
function clearSave(){ saveData = null; try { localStorage.removeItem(KEY('save')); } catch(e){} }
const DEFAULT_OPTS = { muted: false, music: true, shake: true, reticle: 0, difficulty: 1 };

let stats = Object.assign({}, DEFAULT_STATS, safeLoad(KEY('stats'), {}));
let opts  = Object.assign({}, DEFAULT_OPTS,  safeLoad(KEY('opts'),  {}));
if (![0, 1, 2].includes(opts.difficulty)) opts.difficulty = 1;
let unlockedAch = safeLoad(KEY('ach'), []);
const DEFAULT_CAMP = { unlocked:1, clears:[0,0,0,0,0], endBest:[0,0,0,0,0], bosses:[0,0,0,0,0], flawBoss:0, flawWorld:0, modWins:0 };
function sanitizeCamp(c){
  const o = Object.assign({}, DEFAULT_CAMP, c || {});
  const arr5 = a => { const r = []; for (let i = 0; i < 5; i++) r.push((Array.isArray(a) && typeof a[i] === 'number' && a[i] >= 0) ? a[i] : 0); return r; };
  const num = v => (typeof v === 'number' && v >= 0) ? v : 0;
  o.clears = arr5(o.clears); o.endBest = arr5(o.endBest); o.bosses = arr5(o.bosses);
  o.flawBoss = num(o.flawBoss); o.flawWorld = num(o.flawWorld); o.modWins = num(o.modWins);
  o.unlocked = DEV_UNLOCK_ALL ? 5 : Math.max(1, Math.min(5, Math.floor(Number(o.unlocked) || 1)));
  return o;
}
let camp = sanitizeCamp(safeLoad(KEY('camp'), {}));
function saveCamp(){ safeSave(KEY('camp'), camp); }
if (!Array.isArray(unlockedAch)) unlockedAch = [];

function saveStats(){ safeSave(KEY('stats'), stats); }
function saveOpts(){ safeSave(KEY('opts'), opts); }
function saveAch(){ safeSave(KEY('ach'), unlockedAch); }

// High scores are cached in memory so the menus never parse storage per frame
const scoreCache = { wave: null, endless: null, rush: null };
function loadScores(mode){
  if (scoreCache[mode]) return scoreCache[mode];
  const s = safeLoad(KEY('scores_' + mode), []);
  scoreCache[mode] = Array.isArray(s) ? s : [];
  return scoreCache[mode];
}
function saveScore(mode, entry){
  let scores = loadScores(mode).slice();
  scores.push(entry);
  scores.sort((a,b)=>b.score-a.score);
  scores = scores.slice(0, 8);
  scoreCache[mode] = scores;
  safeSave(KEY('scores_' + mode), scores);
  return scores;
}
function clearScores(){
  scoreCache.wave = []; scoreCache.endless = []; scoreCache.rush = [];
  safeSave(KEY('scores_wave'), []);
  safeSave(KEY('scores_endless'), []);
  safeSave(KEY('scores_rush'), []);
}
