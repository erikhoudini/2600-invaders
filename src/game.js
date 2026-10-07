'use strict';
// Game state, waves, Endless and Boss Rush modes
// =====================================================================
//  GAME STATE
// =====================================================================
const GROUND = H - 16;
const HORIZON = BOT + 60;

let menuState = 'title';
let menuSelection = 0;
let gameMode = 'wave';
let scoresMode = 'wave';
let statsPage = 0;
let optionsSelection = 0;
let optionsConfirm = -1;
let gameOverSel = 0;
let endTime = 0;

let enemies,booms,shots,popups,turrets;
let aim = {x:128, y:GROUND-30};

let score,combo,comboTimer,bestCombo;
let baseHP,maxBaseHP;
let wave,spawnRemaining,waveState,waveClearTimer;
let totalSpawnCount = 0, totalSpawned = 0;
let speedMul,shake,flashT,gameOverTimer,fireCooldown,warningT;
let installations,waveBannerT;
let turretBarrels=[],fadingTrails=[];
let windPhase=0, windNow=0;
let snowPool=[];
const MAX_SNOW = 30;
let worldCanvas = null;

let nextBossAt = 0, pulseCount = 0, endBosses = 0;
let roundBest = 0, waveBonus = 0, endStage = 1;
let dangerLevel = 0;
let lastKillAt = -999;
let achTimer = 1;
let nameLock = 0;

let _cachedActiveTurret = null;
let _cachedComboTier = null;

let hitStop = 0;
let scorches = [];                 // burn marks where missiles hit bare ground
let runStats = { kills:0, shots:0, perfect:false, time:0 };

let nameEntry = { letters: ['A','A','A'], cursor: 0 };
let pendingScore = null;

// Two ranges of jagged peaks, lit on the left and shaded on the right. The far range sits at
// oy+2 and the near range at oy+6; used by the playfield and by the cover screen.
function drawMountains(wc, env, oy){
  const farPeaks=[]; let x=-30;
  while(x<W+30){const pw=rndi(22,42),ph=rndi(6,13);farPeaks.push({x,pw,ph});x+=pw-Math.floor(pw*0.35);}
  const nearPeaks=[]; x=-30;
  while(x<W+30){const pw=rndi(16,32),ph=rndi(10,20);nearPeaks.push({x,pw,ph});x+=pw-Math.floor(pw*0.30);}
  const layers = [
    {peaks:farPeaks, lit:env.mountFar.lit, shd:env.mountFar.shd, yBase:oy+2},
    {peaks:nearPeaks,lit:env.mountNear.lit,shd:env.mountNear.shd,yBase:oy+6},
  ];
  for(const layer of layers){
    for(const peak of layer.peaks){
      const peakX = peak.x + peak.pw/2;
      wc.fillStyle = layer.lit;
      for(let px=Math.floor(peak.x);px<=Math.floor(peakX);px++){
        if(px<0||px>=W)continue;
        const tt=(px-peak.x)/(peakX-peak.x);
        const yTop=layer.yBase-peak.ph*tt;
        for(let y=Math.round(yTop);y<layer.yBase;y++)wc.fillRect(px,y,1,1);
      }
      wc.fillStyle = layer.shd;
      for(let px=Math.ceil(peakX);px<=Math.ceil(peak.x+peak.pw);px++){
        if(px<0||px>=W)continue;
        const tt=(peak.x+peak.pw-px)/(peak.x+peak.pw-peakX);
        const yTop=layer.yBase-peak.ph*tt;
        for(let y=Math.round(yTop);y<layer.yBase;y++)wc.fillRect(px,y,1,1);
      }
    }
  }
}
function createWorldCanvas(){
  const top = HORIZON - 20;
  const h = GROUND - top;
  const c = document.createElement('canvas');
  c.width = W; c.height = h;
  const wc = c.getContext('2d');
  const oy = 20;
  wc.fillStyle=P.wht; wc.fillRect(0,oy,W,1);
  wc.fillStyle=currentEnv.mountNear.lit; wc.fillRect(0,oy+1,W,1);
  drawMountains(wc, currentEnv, oy);
  const snowTop = oy + 2;
  const snowH = GROUND - HORIZON - 2;
  const bands = currentEnv.snowBands.length;
  const bandH = Math.ceil(snowH / bands);
  for(let i=0;i<bands;i++){
    wc.fillStyle = currentEnv.snowBands[i];
    const y0 = snowTop + i*bandH;
    const bh = (i===bands-1) ? (GROUND - (top+y0)) : bandH;
    wc.fillRect(0, y0, W, bh);
  }
  worldCanvas = c;
}

function setWorld(wi){
  curWorld = wi;
  worldCityLoss = 0;
  currentEnv = WORLDS[wi];
  createWorldCanvas();
  createCloudLayers(currentEnv);
  activateSaturn(currentEnv);
  preRenderStars();
  initSnow();
  warmSaturn(WORLDS[(wi + 1) % WORLDS.length]);
  fadingTrails = [];
  resetHazards();
}

function startGame(mode, wi){
  keepAwake();
  captureMods();
  gameMode = mode;
  paused = false; pauseSel = 0; pauseConfirm = false;
  if (mode === 'endless' || mode === 'rush') wi = 0;
  else {
    if (wi === undefined) wi = runWorld;
    wi = clamp(wi, 0, camp.unlocked - 1);
  }
  runWorld = wi;
  runVictory = false;
  resetGame();
  setWorld(wi);
  orbTimer = (mode === 'endless') ? 6 : 9;
  runStats = { kills:0, shots:0, perfect:true, time:0 }; hitStop = 0; waveRoster = []; scorches = [];
  if (mode === 'endless'){
    wave = 1;
    speedMul = 1.0;
    spawnRemaining = 999999;
    waveState = 'spawning';
    endTime = 0;
    endStage = 1; resetEndless();
    setBanner(currentEnv.name, 'ENDLESS', 2.0);
  } else if (mode === 'rush'){
    rushReset();
    rushBegin('interlude');
  } else {
    wave = wi * WAVES_PER_WORLD;
    nextWave();
  }
  sfx('deploy');
  menuState = 'game';
}

function resetGame(){
  enemies=[];booms=[];shots=[];popups=[];particles=[];fadingTrails=[];toasts=[];
  turrets=[
    {x:40, y:GROUND-22, flash:0, alive:true, rebuildT:0, cd:0, dry:0},
    {x:128,y:GROUND-22, flash:0, alive:true, rebuildT:0, cd:0, dry:0},
    {x:216,y:GROUND-22, flash:0, alive:true, rebuildT:0, cd:0, dry:0},
  ];
  turretBarrels = turrets.map(t=>({x:t.x, y:t.y-6}));
  aim = {x:128, y:GROUND-30};
  score=0;combo=0;comboTimer=0;bestCombo=0;roundBest=0;waveBonus=0;endStage=1;
  wave=0;speedMul=1;
  spawnRemaining=0;
  waveState='idle';waveClearTimer=0;
  totalSpawnCount = 0; totalSpawned = 0;
  shake=0;flashT=0;gameOverTimer=0;fireCooldown=0;
  warningT=0;waveBannerT=0;
  nextBossAt = 0; pulseCount = 0; endBosses = 0; endStage = 1; resetEndless();
  dangerLevel = 0;
  lastKillAt = -999;
  achTimer = 1;
  _cachedActiveTurret = null;
  _cachedComboTier = null;
  boss = null;
  crates = []; fxBlast = 0; fxRapid = 0; fxShield = 0; fxSlow = 0;
  resetHazards(); resetSatellites(); choreoReset();
  installations=[
    {x:12,size:8,alive:true},{x:68,size:9,alive:true},{x:98,size:9,alive:true},
    {x:158,size:9,alive:true},{x:188,size:9,alive:true},{x:244,size:8,alive:true},
  ];
  // One life per city, so the game ends exactly when the last city falls
  if (modGlass) installations = [1, 2, 3, 4].map(i => installations[i]);
  maxBaseHP = installations.length;
  baseHP = maxBaseHP;
  endTime = 0;
}

function initSnow(){
  snowPool = [];
  for(let i=0;i<MAX_SNOW;i++){
    snowPool.push({
      x:rnd(-10,W+10), y:rnd(BOT,H),
      vx:rnd(-8,8), vy:rnd(12,30),
      size:Math.random()<0.2?2:1, t:0, life:rnd(6,14),
    });
  }
}
function updateSnowfall(dt, wind){
  for(const s of snowPool){
    s.t+=dt;
    s.x+=(s.vx+wind)*dt;
    s.y+=s.vy*dt;
    s.x+=Math.sin(s.t*2+s.y*0.05)*6*dt;
    if(s.y>H+5||s.x<-20||s.x>W+20||s.t>s.life){
      s.x=rnd(-10,W+10);s.y=BOT-10;s.t=0;s.life=rnd(6,14);
    }
  }
}
function drawSnowfall(){
  const prevA = ctx.globalAlpha;
  for(const s of snowPool){
    const alpha = Math.min(1,s.t*0.5)*(1-Math.max(0,(s.y-GROUND)/(H-GROUND)));
    if(alpha<=0)continue;
    ctx.globalAlpha=alpha*0.7;
    ctx.fillStyle=currentEnv.snowCol;
    ctx.fillRect(Math.round(s.x),Math.round(s.y),s.size,s.size);
  }
  ctx.globalAlpha=prevA;
}

// Visual only: a Boom would also hit-test against the missile or ship that made it
function launchSparks(x, y, col){
  for (let i = 0; i < 6; i++) spawnParticle(x, y, rnd(-26, 26), rnd(-8, 22), rnd(0.2, 0.4), col, 1);
}
const platformCount = () => enemies.reduce((n, e) => n + (e.type === 'platform' && !e.dead ? 1 : 0), 0);
function platformCap(){
  const d = gameMode === 'endless' ? endDiff() : diffWave(wave);
  return d >= (gameMode === 'endless' ? 8 : 12) ? 2 : 1;
}
let curParent = null;       // the enemy whose update is running, so what it spawns keeps its pattern tag
let bossFiring = false;      // set while a boss runs its attacks, so its missiles come out faster
function spawnEnemy(type,x,y,vx,vy,o){
  if (type === 'platform' && platformCount() >= platformCap()) type = 'ipbm';
  const T=ETYPES[type];
  if(x===undefined){
    const fromLeft=Math.random()<0.5;
    x=fromLeft?-14:W+14;
    vx=(fromLeft?1:-1)*(T.vx+rnd(-2,5));
  }
  if(y===undefined){
    if (T.lane) y = BOT + rndi(14, 34);                                   // platforms ride just under the clouds
    else if (T.lowChance && Math.random() < T.lowChance) y = BOT + rndi(10, T.passing ? 95 : 65);   // bottom screen
    else y = T.passing ? rndi(30, BOT-40) : rndi(20, BOT-30);
  }
  if (T.homing && !T.passing && vy === undefined && T.vy > 0){
    const alive = installations.filter(i => i.alive).concat(turrets.filter(t => t.alive));
    if (alive.length > 0){
      let nearest = alive[0], bestD = Math.abs(alive[0].x - x);
      for (const c of alive){
        const d = Math.abs(c.x - x);
        if (d < bestD){ bestD = d; nearest = c; }
      }
      const fallTime = (GROUND - y) / (T.vy * speedMul * (T.noAccel ? 1 : 1 + MISSILE_BOOST / 2) * speedOf(T));
      if (fallTime > 0.3){
        const targetVx = (nearest.x - x) / fallTime;
        vx = (vx === undefined ? T.vx : vx) * (1 - T.homing) + targetVx * T.homing + rnd(-1.4, 1.4);
      }
    }
  }
  if (bossFiring && !T.passing && !T.dodge){
    // scale the whole velocity so a missile aimed at a city still lands on it
    vx = (vx !== undefined ? vx : T.vx) * BOSS_MISSILE;
    vy = (vy !== undefined ? vy : T.vy * speedMul) * BOSS_MISSILE;
  }
  enemies.push({
    type,x,y,
    vx: vx!==undefined?vx:T.vx,
    vy: vy!==undefined?vy:T.vy*speedMul,
    dead:false, trail:[], trailTimer:0,
    spawnFx: (curParent && !bossFiring && curParent.pat !== 'hazard' && (!T.passing || T.wall)) ? 0.3 : 0, life: T.wall ? ((o && o.life) || T.life) : undefined, wallCd: 0,
    dive: T.diver ? 0 : undefined, tx: o && o.target, diveAt: o && o.diveAt, telT: 0,
    fromLeft: (vx!==undefined?vx:T.vx)>0,
    pat: (o && o.pat) || (curParent && curParent.pat) || (bossFiring ? 'boss' : undefined),
    dropPoints: (o && o.drops) ? o.drops.slice() : (T.drops ? T.drops.slice() : null),
    dropIndex: 0,
    wobble:(o && o.ph !== undefined) ? o.ph : Math.random()*6.28,
    hasSplit: false,
    fallI: 0,
    opened: false, openT: 0,
    shI: 0, shT: 0, shieldUp: !!T.shield, shFlash: 0, hurt: 0, hp: T.hp || 1, hitBy: -1,
    launchT: 1.3 + Math.random() * 0.8,
    startY: y,
    totalFall: Math.max(1, GROUND - y),
  });
  if (T.shield){
    const e = enemies[enemies.length - 1];
    e.shI = (o && o.shI !== undefined) ? o.shI : rndi(0, SHIELD_PATTERN.length - 1);
    e.shT = SHIELD_PATTERN[e.shI][1];
    e.shieldUp = !!SHIELD_PATTERN[e.shI][0];
  }
}

const FORMATIONS = ['line','vee','column','diag','block','ring','twin'];
function formationPoints(pattern, n, cx, y0){
  const pts = [];
  const mid = (n - 1) / 2;
  if (pattern === 'line'){
    for (let i = 0; i < n; i++) pts.push({ x: cx + (i - mid) * 10, y: y0 });
  } else if (pattern === 'vee'){
    for (let i = 0; i < n; i++){ const o = Math.abs(i - mid); pts.push({ x: cx + (i - mid) * 9, y: y0 + (mid - o) * 7 }); }
  } else if (pattern === 'column'){
    for (let i = 0; i < n; i++) pts.push({ x: cx + rnd(-2, 2), y: y0 + i * 8 });
  } else if (pattern === 'diag'){
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) pts.push({ x: cx + (i - mid) * 9 * dir, y: y0 + i * 6 });
  } else if (pattern === 'block'){
    const cols = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) pts.push({ x: cx + ((i % cols) - (cols - 1) / 2) * 10, y: y0 + Math.floor(i / cols) * 9 });
  } else if (pattern === 'ring'){
    const r = 11 + n;
    for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; pts.push({ x: cx + Math.cos(a) * r, y: y0 + 22 + Math.sin(a) * r * 0.8 }); }
  } else {
    const half = Math.ceil(n / 2);
    for (let i = 0; i < n; i++){
      const left = i < half, k = left ? i : i - half, m = (left ? half : n - half);
      pts.push({ x: cx + (left ? -34 : 34) + (k - (m - 1) / 2) * 9, y: y0 + (k % 2) * 6 });
    }
  }
  for (const q of pts){ q.x = clamp(q.x, 8, W - 8); q.y = clamp(q.y, 6, 120); }
  return pts;
}
function pickFormation(dw){
  if (themeFormation && Math.random() < 0.55) return themeFormation;
  const bag = ['line','vee'];
  if (dw >= 2) bag.push('column','diag');
  if (dw >= 3) bag.push('block','ring');
  if (dw >= 5) bag.push('twin');
  return pick(bag);
}
function typePool(w, env){
  const p=['ipbm','ipbm','ipbm','smart','scout','scout','platform'];
  if(w>=2){p.push('smart');p.push('smart');p.push('bomber');p.push('platform');}
  if(w>=3){p.push('splitter'); p.push('splitter');}
  if(w>=3){p.push('chute'); p.push('aegis');}
  if(w>=4){p.push('heavy'); p.push('multi'); p.push('gunner'); p.push('weaver');}
  if(w>=6){p.push('phantom');}
  if(w>=5){p.push('shrapnel'); p.push('bomber'); p.push('smart'); p.push('smart');}
  if(w>=6){p.push('icbm'); p.push('midsplit'); p.push('carrier'); p.push('aegis');}
  if(w>=7){p.push('scout'); p.push('colbomb');}
  if(w>=8){p.push('bomber'); p.push('rowbomb'); p.push('gunner'); p.push('chute'); p.push('smart'); p.push('smart');}
  if(w>=9){p.push('bandit');}
  if(w>=10){p.push('colbomb'); p.push('rowbomb'); p.push('gunner');}
  if(env && env.favor) for(const f of env.favor){ if(w>=f[1]){ p.push(f[0]); p.push(f[0]); } }
  return p;
}

// Campaign waves are numbered globally (1..40); each world is 8 waves ending in a boss
const worldOf = gw => Math.floor((gw - 1) / WAVES_PER_WORLD);
const waveIn  = gw => ((gw - 1) % WAVES_PER_WORLD) + 1;
const formatWave = gw => (gw > 0 ? (worldOf(gw) + 1) + '-' + waveIn(gw) : '--');
// each planet starts four waves above the last, and the last two climb a little faster
const diffWave = gw => Math.max(1, (gameMode === 'rush' ? Math.min(24, 6 + rush.n) : Math.round(worldOf(gw) * 4 + waveIn(gw) + Math.max(0, worldOf(gw) - 2) * 1.5)) + DIFFICULTY_SHIFT[opts.difficulty]);
const waveFlow = () => gameMode === 'wave' || gameMode === 'rush';
const isBossWave = gw => waveIn(gw) === WAVES_PER_WORLD;

let bannerMain = '', bannerSub = '', bannerDur = 2.0;
let runWorld = 0;
let runVictory = false;

function setBanner(main, sub, dur){
  bannerMain = main; bannerSub = sub || ''; bannerDur = dur || 2.0; waveBannerT = bannerDur;
}

function nextWave(fw){
  if (fw !== undefined) wave = fw - 1;
  wave++;
  if (gameMode !== 'rush' && wave > stats.bestWave) stats.bestWave = wave;
  runStats.perfect = true;
  roundBest = 0; waveBonus = 0; themeFormation = null; bossSpawned = false;
  const dw = diffWave(wave);
  speedMul=Math.min(2.1,1+(dw-1)*0.05);
  // The wave is a script of phrases; its length is what the boss plan and the progress bar count
  choreoReset();
  choreo.phrases = composeWave(dw, worldOf(wave), isBossWave(wave), gameMode === 'rush' && !isBossWave(wave));
  spawnRemaining = totalSpawnCount = choreo.phrases.length;
  waveRoster = rosterOf(choreo.phrases);
  totalSpawned = 0;
  choreo.gapT = 2.4;                                  // a moment to read the banner before the first phrase
  waveState='spawning';
  flashT=0.25;
  let sub = '';
  if (waveIn(wave) === 1) sub = currentEnv.name;
  else if (isBossWave(wave)) sub = 'BOSS WAVE';
  else sub = slogan(wave * 5 + worldOf(wave));
  if (gameMode === 'rush'){
    if (isBossWave(wave)) setBanner('BOSS ' + (rush.bosses + 1), BOSS_NAMES[worldOf(wave)], 2.2);
    else setBanner('WAVE', currentEnv.name, 1.6);
  } else setBanner(formatWave(wave), sub, 2.0);
  sfx('wave');
  if (isBossWave(wave)) onBossWaveStart();
}

function onBossWaveStart(){ bossSpawned = false; boss = null; themeFormation = ['line','column','ring','vee','twin'][worldOf(wave)]; }

function worldClear(){
  const wi = worldOf(wave);
  camp.clears[wi]++;
  const firstWin = wi >= WORLDS.length - 1 && camp.clears[wi] === 1;
  if (worldCityLoss === 0) camp.flawWorld++;
  if (runMods.length) camp.modWins++;
  const was = camp.unlocked;
  camp.unlocked = Math.min(WORLDS.length, Math.max(camp.unlocked, wi + 2));
  saveCamp();
  const last = wi >= WORLDS.length - 1;
  waveState = 'worldclear'; waveClearTimer = 3.6;
  setBanner(last ? 'MISSION COMPLETE' : 'OUTPOST HELD', last ? '' : ('NEXT ' + WORLDS[wi+1].name), 3.4);
  flashT = 0.5; shake = Math.max(shake, 0.6);
  sfx(last ? 'victory' : 'worldClear');
  if (camp.unlocked > was) pushToast('UNLOCKED ' + WORLDS[camp.unlocked-1].name, P.yel);
  if (firstWin) pushToast('UNLOCKED BOSS RUSH', P.yel);
  checkAchievements();
}

function advanceWorld(){
  const wi = worldOf(wave) + 1;
  // Lives only reset when you move to a new planet
  for (const inst of installations) inst.alive = true;
  baseHP = maxBaseHP;
  for (const t of turrets) if (!t.alive) rebuildTurret(t);
  setWorld(wi);
  nextWave();
  popups.push({ x: W / 2, y: 112, text: 'DEFENSES RESTORED', t: 0, dur: 1.8, col: P.lgrn, big: true });
}

function onEnemyKilled(e,outBooms){
  const T=ETYPES[e.type];const ex=e.x,ey=e.y;
  runStats.kills++;
  stats.totalKills++;
  maybeDropCrate(e, T);
  if (T.pts >= 25) shatterSprite(e, T.r >= 24 ? 1.4 : 1);
  agitKill(e, T);
  if (T.pts >= 100 && hitStop < 0.05) hitStop = T.pts >= 250 ? 0.08 : 0.045;
  if (e.poster !== undefined) unlockPoster(e.poster);
  const now = performance.now() / 1000;
  const momentum = (now - lastKillAt) < 0.35;
  lastKillAt = now;

  const prevCombo = combo;
  combo++;
  if (momentum) combo++;
  if (combo > stats.bestChain) stats.bestChain = combo;

  comboTimer = comboTimerMax(combo);
  if(combo>bestCombo)bestCombo=combo;
  if(combo>roundBest)roundBest=combo;

  const prevTier = getComboTier(prevCombo);
  const curTier = getComboTier(combo);
  if (curTier !== prevTier && curTier.name){
    popups.push({x: W/2, y: H/2 - 30, text: curTier.name, t: 0, dur: 1.1, col: curTier.col, big: true});
    flashT = Math.max(flashT, 0.10 + (curTier.min * 0.008));
    shake = Math.max(shake, 0.15 + curTier.min * 0.02);
    sfx('tier', COMBO_TIERS.indexOf(curTier));
  }

  const pts = Math.round(T.pts * combo * (momentum ? 1.2 : 1));
  addScore(pts);
  const popCol = momentum ? P.wht : (curTier.name ? curTier.col : P.wht);
  popups.push({
    x: ex, y: ey,
    text: (combo > 1 ? 'X'+combo+' ' : '') + '+' + pts,
    t: 0, dur: 0.9, col: popCol, big: curTier.big || momentum
  });
  sfx(T.r >= 34 ? 'killL' : (T.r >= 20 ? 'killM' : 'killS'));
  if(combo>1)sfx('combo',Math.min(combo,14));
  if(e.trail.length>1){
    fadingTrails.push({points:e.trail.slice(),dimCol:T.trailDim,life:0.7,maxLife:0.7});
  }
  e.trail=[];

  if (T.r >= 24){
    outBooms.push(new Boom(ex,ey,'flash',{r:14,dur:0.28}));
  }
  if(combo>=5)shake=Math.max(shake,0.3);
  if(combo>=10){shake=1.0;flashT=Math.max(flashT,0.15);}

  const nb0 = outBooms.length;
  switch(T.death){
    case 'flash': outBooms.push(new Boom(ex,ey,'flash',{r:12,dur:0.3})); break;
    case 'xblast':
      outBooms.push(new Boom(ex,ey,'circle',{r:12,dur:0.4}));
      outBooms.push(new Boom(ex,ey,'xcross',{r:34,dur:0.6,delay:0.04}));
      break;
    case 'pop': outBooms.push(new Boom(ex,ey,'circle',{r:17,dur:0.42})); break;
    case 'flak': {
      outBooms.push(new Boom(ex,ey,'circle',{r:T.r,dur:0.5}));
      for (let i = -2; i <= 2; i++){
        if (i === 0) continue;
        outBooms.push(new Boom(ex + i * 17, ey + (Math.abs(i) === 2 ? 5 : -4), 'circle', { r: 16, dur: 0.45, delay: 0.06 + Math.abs(i) * 0.06 }));
      }
      break;
    }
    case 'blast': outBooms.push(new Boom(ex,ey,'circle',{r:T.r,dur:0.6})); break;
    case 'smartkill':
      outBooms.push(new Boom(ex,ey,'circle',{r:T.r,dur:0.55}));
      outBooms.push(new Boom(ex,ey,'ring',{r:T.r*1.7,dur:0.7,delay:0.05}));
      break;
    case 'burst': outBooms.push(new Boom(ex,ey,'burst',{r:32,dur:0.7})); break;
    case 'nova': outBooms.push(new Boom(ex,ey,'nova',{r:48,dur:0.95})); break;
    case 'bigbang':
      outBooms.push(new Boom(ex,ey,'nova',{r:85,dur:1.15}));
      outBooms.push(new Boom(ex,ey,'ring',{r:120,dur:1.5,delay:0.1}));
      shake = Math.max(shake, 1.4); flashT = Math.max(flashT, 0.35);
      sfx('bigbang');
      break;
    case 'split':
      outBooms.push(new Boom(ex,ey,'circle',{r:18,dur:0.45}));
      // Minis fall toward the cities, and only spawn if they have room to fall
      if (ey >= SH && ey < GROUND - 40){
        const mvy = ETYPES.mini.vy * speedMul;
        spawnEnemy('mini', ex-8, ey-4, -16, mvy);
        spawnEnemy('mini', ex+8, ey-4,  16, mvy);
      }
      break;
    case 'sat':
      outBooms.push(new Boom(ex,ey,'nova',{r:40,dur:0.8}));
      outBooms.push(new Boom(ex,ey,'ring',{r:70,dur:1.1,delay:0.08}));
      for (let i = 0; i < 16; i++) spawnParticle(ex, ey, rnd(-90, 90), rnd(-90, 60), rnd(0.5, 1.2), pick([P.yel, P.wht, P.org, P.lblu]), 2);
      shake = Math.max(shake, 0.4);
      break;
    case 'platform':
      outBooms.push(new Boom(ex,ey,'nova',{r:46,dur:0.9}));
      outBooms.push(new Boom(ex-12,ey+3,'circle',{r:20,dur:0.5,delay:0.12}));
      outBooms.push(new Boom(ex+12,ey+3,'circle',{r:20,dur:0.5,delay:0.2}));
      shake = Math.max(shake, 0.5);
      sfx('bigbang');
      break;
    case 'midkill': outBooms.push(new Boom(ex,ey,'circle',{r:T.r,dur:0.5})); break;
    case 'shrapnel':
      outBooms.push(new Boom(ex,ey,'diamond',{r:16,dur:0.45}));
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2+0.4;
        outBooms.push(new Boom(ex+Math.cos(a)*22,ey+Math.sin(a)*22,'diamond',{r:14,dur:0.5,delay:0.05+i*0.05}));
      }
      break;
    case 'mirv':
      outBooms.push(new Boom(ex,ey,'circle',{r:24,dur:0.5}));
      // Warheads fan out sideways and fall; vy is left unset so they home on a city
      spawnEnemy('ipbm',ex-7,ey-4,-10);
      spawnEnemy('ipbm',ex,  ey-4,  0);
      spawnEnemy('ipbm',ex+7,ey-4, 10);
      break;
    case 'heavy': outBooms.push(new Boom(ex,ey,'nova',{r:42,dur:0.85})); break;
    case 'boulder':
      outBooms.push(new Boom(ex,ey,'circle',{r:22,dur:0.5}));
      if (ey < GROUND - 60){
        for (let i = -1; i <= 1; i++) spawnEnemy('meteor', ex + i * 8, ey, i * 22 + rnd(-6, 6), rnd(40, 60) * speedMul);
      }
      break;
    case 'bandit':
      outBooms.push(new Boom(ex,ey,'nova',{r:60,dur:1.1}));
      for(const e2 of enemies){if(e2!==e&&!e2.dead){e2.dead=true;onEnemyKilled(e2,outBooms);}}
      flashT=0.6;shake=1.2;
      sfx('bandit');
      break;
    case 'vcol':
      outBooms.push(new Boom(ex,ey,'vcol',{r:80,dur:0.8}));
      outBooms.push(new Boom(ex, ey-50, 'ring', {r:20, dur:0.55, delay:0.15}));
      outBooms.push(new Boom(ex, ey+50, 'ring', {r:20, dur:0.55, delay:0.15}));
      break;
    case 'hcol':
      outBooms.push(new Boom(ex,ey,'hcol',{r:90,dur:0.8}));
      outBooms.push(new Boom(ex-60, ey, 'ring', {r:20, dur:0.55, delay:0.15}));
      outBooms.push(new Boom(ex+60, ey, 'ring', {r:20, dur:0.55, delay:0.15}));
      break;
    case 'multi':
      outBooms.push(new Boom(ex,ey,'circle',{r:14,dur:0.4}));
      outBooms.push(new Boom(ex,ey,'cross',{r:34,dur:0.6,delay:0.05}));
      break;
  }
  const grow = 1 + Math.min(0.45, combo * 0.02);
  for (let i = nb0; i < outBooms.length; i++){
    const nb = outBooms[i];
    nb.chain = combo;
    if (nb.kind === 'vcol' || nb.kind === 'hcol') continue;
    if (nb.rmax < 70) nb.rmax *= grow;
  }
}

function mirrorY(y){if(y<SH)return BOT+Math.min(y,SH-4);return clamp(y-BOT,4,SH-4);}
function skipGap(y,dir){if(y>SH-4&&y<BOT+4)return dir>0?BOT+5:SH-5;return y;}
function swapScreen(){if(aim.y<SH){aim.y=BOT+clamp(aim.y,6,SH-6);}else{aim.y=clamp(aim.y-BOT,6,SH-6);}sfx('swap');}
function moveAim(dx,dy){
  aim.x=clamp(aim.x+dx,5,W-6);let ny=aim.y+dy;
  if((aim.y<SH-4&&ny>=SH-4)||(aim.y>BOT+4&&ny<=BOT+4)||(aim.y>=SH-4&&aim.y<=BOT+4))ny=skipGap(ny,dy);
  aim.y=clamp(ny,5,H-6);
}

function computeActiveTurret(){
  let best=null,bestD=Infinity;
  for(const t of turrets){
    if (!t.alive) continue;
    const d = Math.abs(t.x - aim.x);
    if (d < bestD){ bestD = d; best = t; }
  }
  return best;
}

// The nearest turret that is loaded. Each turret reloads on its own, so with three guns you
// rotate between them and, with one down, you have to choose your shots.
function pickTurret(){
  let best = null, bestD = Infinity;
  for (const t of turrets){
    if (!t.alive || t.cd > 0) continue;
    const d = Math.abs(t.x - aim.x);
    if (d < bestD){ bestD = d; best = t; }
  }
  return best;
}
function rearmTime(){ return REARM * (fxRapid > 0 ? 0.25 : 1) * (modSlow ? 1.5 : 1); }
function fire(){
  if(menuState!=='game'||fireCooldown>0)return;
  const best = pickTurret();
  if(!best){                                         // everything is reloading, or every turret is down
    for (const t of turrets) if (t.alive) t.dry = 0.18;
    tip('dry', 'ALL TURRETS ARE RELOADING. WAIT FOR ONE TO CHARGE, OR AIM WITH PATIENCE.');
    fireCooldown = 0.08; sfx('dry'); return;
  }
  runStats.shots++;
  stats.totalShots++;
  if (runStats.shots === 6) tip('lead', 'SHOTS TAKE TIME TO TRAVEL. AIM AHEAD OF MOVING TARGETS.');
  best.flash=0.10; best.cd = rearmTime(); fireCooldown = 0.07;
  let blastR = 28;
  if (fxBlast > 0){ blastR = 44; fxBlast--; }
  const tx = aim.x, ty = aim.y;
  const dx=tx-best.x,dy=ty-best.y;const dist=Math.hypot(dx,dy);
  shots.push({x0:best.x,y0:best.y-4,x1:tx,y1:ty,t:0,dur:Math.max(0.08,dist/SHOT_SPEED),r:blastR});
  sfx('fire');
  for(let i=0;i<3;i++)spawnParticle(best.x+rnd(-2,2),best.y-6,rnd(-20,20),rnd(-40,-20),0.2,P.yel,1);
}

// ---------------------------------------------------------------------
//  Endless: a director paces the screen in build, surge and lull phases,
//  keeps the number of falling missiles under a cap, and shifts the stage
//  (arena, speed, mix) as the score climbs.
// ---------------------------------------------------------------------
const edir = { raidAt: 55, shiftAt: 80 };
const MOON_SHIFT = 80;
// Difficulty climbs slowly with time alone
function endDiff(){ return Math.max(1, Math.min(26, 1 + Math.floor(endTime / 36)) + Math.round(DIFFICULTY_SHIFT[opts.difficulty] / 2)); }
function resetEndless(){ edir.raidAt = 55; edir.shiftAt = MOON_SHIFT; choreoReset(); }
function fallingCount(){
  let n = 0;
  for (const e of enemies) if (!e.dead && !ETYPES[e.type].passing && e.vy > 0) n++;
  return n;
}
// Every so often the backdrop moves on to the next moon
function endlessMoonShift(){
  endStage++;
  setWorld((curWorld + 1) % WORLDS.length);
  setBanner(currentEnv.name, 'ENDLESS', 2.4);
  sfx('worldClear');
  flashT = Math.max(flashT, 0.4);
  // A new moon is a fresh sky, not a fresh start: cities and turrets stay as they are
  spawnOrbital();
  choreo.gapT = Math.max(choreo.gapT, 3.5);
}
function updateEndless(dt){
  if (endTime >= edir.shiftAt){ edir.shiftAt += MOON_SHIFT; endlessMoonShift(); }
  const dd = endDiff(), dw = Math.round(dd * 1.5);
  speedMul = Math.min(2.5, 1 + (dd - 1) * 0.055);
  choreoStep(dt);
  if (endTime >= edir.raidAt){                         // an air raid cuts the queue every so often
    edir.raidAt += 55;
    choreo.phrases.unshift({ ids: ['raid'], gap: 2.5, bump: 0, offset: 1 });
    choreo.gapT = Math.min(choreo.gapT, 0.5);
    popups.push({x: W/2, y: SH/2, text:'AIR RAID', t: 0, dur: 1.4, col: P.mag, big: true});
  }
  // The director composes five phrases at a time, always ending on a climax, then breathes
  if (!choreo.phrases.length){
    choreo.phrases = composeWave(dw, curWorld, false, false, 5);
    choreo.gapT = Math.max(choreo.gapT, 2.2);
  }
  phraseStep(dt, dw, null);
}

// ---------------------------------------------------------------------
//  Boss Rush: the bosses loop in random order, with a short regular wave
//  between each. Built on the campaign wave machinery.
// ---------------------------------------------------------------------
const rush = { n:0, bosses:0, phase:'interlude', order:[], next:0, last:-1 };
const rushUnlocked = () => DEV_UNLOCK_ALL || camp.clears[WORLDS.length - 1] > 0;
function rushPickBoss(){
  if (!rush.order.length){
    const o = [0, 1, 2, 3, 4];
    for (let i = o.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = o[i]; o[i] = o[j]; o[j] = t; }
    if (o[0] === rush.last){ const t = o[0]; o[0] = o[1]; o[1] = t; }
    rush.order = o;
  }
  rush.last = rush.order.shift();
  return rush.last;
}
function rushReset(){ rush.n = 0; rush.bosses = 0; rush.order = []; rush.last = -1; rush.next = rushPickBoss(); }
function rushBegin(kind){
  rush.phase = kind;
  const wi = rush.next;
  if (wi !== curWorld) setWorld(wi);
  runWorld = wi;
  nextWave(wi * WAVES_PER_WORLD + (kind === 'boss' ? WAVES_PER_WORLD : rndi(2, 6)));
}
function rushAdvance(){
  rush.n++;
  if (rush.phase === 'boss'){
    rush.bosses++;
    if (rush.bosses > (stats.bestRush || 0)){ stats.bestRush = rush.bosses; saveStats(); }
    for (const inst of installations){ if (!inst.alive){ inst.alive = true; baseHP = Math.min(maxBaseHP, baseHP + 1); break; } }
    rush.next = rushPickBoss();
    rushBegin('interlude');
  } else rushBegin('boss');
}

function update(dt){
  musicUpdate(dt);
  if (foeCd > 0) foeCd -= dt;
  for (const s of scorches) s.t += dt;
  if (scorches.length && scorches[0].t > 40) scorches.shift();
  windPhase+=dt;
  if(shake>0)shake=Math.max(0,shake-dt*3);
  if(flashT>0)flashT=Math.max(0,flashT-dt*2.5);
  if(fireCooldown>0)fireCooldown-=dt;
  if(warningT>0)warningT=Math.max(0,warningT-dt);
  if(waveBannerT>0)waveBannerT=Math.max(0,waveBannerT-dt);

  updateToasts(dt);
  if (menuState === 'game' && !paused) updateTips(dt);

  if(menuState!=='game'){
    if(menuState==='gameover') gameOverTimer -= dt;
    else if(menuState==='nameentry') nameLock -= dt;
    else if(menuState==='loadout') updateLoadoutDemo(dt);
    else updateAttract(dt);
    return;
  }

  if (paused) return;
  if (hitStop > 0){ hitStop -= dt; return; }
  runStats.time += dt;
  if (installations.some(i => i.alive) && installations.filter(i => i.alive).length <= 2){ lowCityT -= dt; if (lowCityT <= 0){ lowCityT = 7; sfx('warn'); } } else lowCityT = 1.5;

  achTimer -= dt;
  if (achTimer <= 0){ achTimer = 1; checkAchievements(); }

  _cachedActiveTurret = computeActiveTurret();
  _cachedComboTier = getComboTier(combo);

  let dangerTarget = 0;
  for (const e of enemies){
    if (e.vy > 0 && e.y > GROUND - 60){
      dangerTarget = Math.max(dangerTarget, (e.y - (GROUND - 60)) / 60);
    }
  }
  dangerTarget = clamp(dangerTarget, 0, 1);
  dangerLevel += (dangerTarget - dangerLevel) * Math.min(1, dt * 4);

  updateParticles(dt);
  for(const ft of fadingTrails)ft.life-=dt;
  fadingTrails=fadingTrails.filter(ft=>ft.life>0);
  // Steady drift plus a slow swell, so the wind changes strength and direction over time
  windNow = Math.sin(windPhase*0.3)*4 + Math.sin(windPhase*0.9)*1.5 + Math.sin(windPhase*0.11+1.3)*3;
  updateSnowfall(dt, (windNow + gust * 1.5) * 2.2);

  if (gameMode === 'endless') endTime += dt;
  for(let i=0;i<turrets.length;i++){
    const t=turrets[i];const b=turretBarrels[i];
    const dx=aim.x-t.x,dy=aim.y-t.y;
    const len=Math.hypot(dx,dy)||1;
    b.x+=(t.x+dx/len*10-b.x)*dt*20;
    b.y+=(t.y-2+dy/len*10-b.y)*dt*20;
  }
  for(const t of turrets){
    if (t.flash>0) t.flash=Math.max(0,t.flash-dt);
    if (t.cd>0) t.cd=Math.max(0,t.cd-dt);
    if (t.dry>0) t.dry=Math.max(0,t.dry-dt);
    if (!t.alive){
      t.rebuildT -= dt;
      if (Math.random() < dt * 7) spawnParticle(t.x + rnd(-5, 5), t.y + rnd(0, 6), rnd(-6, 6), rnd(-26, -12), rnd(0.5, 1.0), pick([P.gry, P.dolk, P.gry]), 1);
      if (t.rebuildT <= 0) rebuildTurret(t);
    }
  }
  let ax=0,ay=0;
  if(keys['ArrowLeft']||keys['KeyA'])ax-=1;
  if(keys['ArrowRight']||keys['KeyD'])ax+=1;
  if(keys['ArrowUp']||keys['KeyW'])ay-=1;
  if(keys['ArrowDown']||keys['KeyS'])ay+=1;
  if(ax||ay){const sp=118*dt;const l=Math.hypot(ax,ay)||1;moveAim(ax/l*sp,ay/l*sp);}

  for(const s of shots){
    s.t+=dt;
    if(s.t>=s.dur){s.done=true;booms.push(new Boom(s.x1,s.y1,'circle',{r:s.r||28,dur:0.55}));sfx('shotBoom');}
  }
  shots=shots.filter(s=>!s.done);

  const enemyCount = enemies.length;
  const groundY=GROUND;
  for(let ei=0; ei<enemyCount; ei++){
    const e = enemies[ei];
    if(!e || e.dead) continue;
    const T=ETYPES[e.type];
    curParent = e;
    e.wobble+=dt*3;
    if (e.spawnFx > 0) e.spawnFx -= dt;
    if (T.wall){
      e.life -= dt;
      if (e.life <= 0){ for (let i = 0; i < 14; i++) spawnParticle(e.x + rnd(-18, 18), e.y + rnd(-2, 3), rnd(-30, 30), rnd(-20, 20), rnd(0.3, 0.7), P.yel, 1); e.dead = true; continue; }
    }
    if (e.rebound > 0){ e.rebound -= dt; if (e.rebound <= 0) e.vy = e.vyKeep; }
    if (e.wallCd > 0) e.wallCd -= dt;
    if(T.dodge){
      for(const b of booms){
        if(b.p>0&&b.p<0.6){
          const dx=e.x-b.x,dy=e.y-b.y;
          if(Math.hypot(dx,dy)<48)e.x+=(dx>0?1:-1)*12*dt;
        }
      }
    }
    const edt = dt * (fxSlow > 0 ? 0.45 : 1) * (modSwift ? 1.25 : 1);
    if (T.ay) e.vy += T.ay * edt;
    const falling = e.vy > 0 && !T.passing;
    if (gust && falling) e.vx += gust * edt * 0.6;
    if (e.type === 'chute'){
      if (!e.opened && e.y >= CLOUD_TOP){ e.opened = true; e.openT = 0; sfx('crate'); }
      if (e.opened){
        e.openT += edt;
        e.vy += (CHUTE_SLOW * speedMul - e.vy) * Math.min(1, edt * 7);
        e.vx -= e.vx * Math.min(1, edt * 1.5);
        if (e.y >= CLOUD_BOTTOM - 4 || e.openT > 5){
          // The canopy is cut loose and three missiles fan out toward the cities
          launchSparks(e.x, e.y, P.lmag);
          for (let i = -1; i <= 1; i++) spawnEnemy('ipbm', e.x + i * 6, e.y + 3, i * 11);
          sfx('dropHeavy');
          e.dead = true;
          continue;
        }
      }
    }
    // Falling missiles speed up on the way down, ending the fall MISSILE_BOOST faster
    let k = 1;
    if (falling && !T.ay && !T.noAccel) k += MISSILE_BOOST * clamp((e.y - e.startY) / e.totalFall, 0, 1);
    // Wind builds across the gap, and is much stronger on the bottom screen
    const windK = 1 + (WIND_BOTTOM - 1) * clamp((e.y - SH) / (BOT - SH), 0, 1);
    if (falling) e.x += windNow * WIND_DRIFT * windK * edt * (e.opened ? 2.2 : 1);
    const sp = speedOf(T);
    if (T.diver){
      if (e.dive === 0){
        const prog = e.fromLeft ? (e.x + 14) / (W + 28) : (W + 14 - e.x) / (W + 28);
        if (prog >= e.diveAt){ e.dive = 1; e.telT = 0.8; e.vx = 0; sfx('warn'); }
      } else if (e.dive === 1){
        e.telT -= edt;
        if (e.telT <= 0){
          e.dive = 2;
          const ft = (GROUND - e.y) / DIVE_SPEED;
          e.vx = (e.tx - e.x) / ft / sp; e.vy = DIVE_SPEED / sp;
          launchSparks(e.x, e.y + 4, P.wht); sfx('dropHeavy');
        }
      }
    }
    if (T.wave) e.x += T.wave[0] * Math.cos(e.wobble * T.wave[1] / 3) * edt;
    const prevY = e.y;
    e.x += e.vx*edt*k*sp; e.y += e.vy*edt*k*sp;
    if (falling && e.vy > 0 && !(e.wallCd > 0)){
      for (const w of enemies){
        if (w.dead || w.type !== 'bulwark' || w.y < prevY || w.y > e.y + 1 || Math.abs(e.x - w.x) > 19) continue;
        const side = Math.abs(e.x - w.x) < 3 ? (Math.random() < 0.5 ? -1 : 1) : (e.x > w.x ? 1 : -1);   // off the nearer end
        e.vyKeep = e.vy; e.vy = -e.vy * 0.55; e.rebound = 0.3; e.wallCd = 0.6;
        e.vx = side * (Math.abs(e.vx) + 58); e.y = w.y - 2; w.shFlash = 0.18;
        for (let i = 0; i < 5; i++) spawnParticle(e.x, w.y, side * rnd(10, 50), rnd(-40, -5), rnd(0.15, 0.35), pick([P.wht, P.yel]), 1);
        sfx('shieldHit');
        break;
      }
    }
    if (T.bob) e.y = e.startY + Math.sin(e.wobble * 1.4) * T.bob;      // satellites ride a gentle wave
    if (T.fallDrops && e.fallI < T.fallDrops.length && e.y > SH * 0.4 && e.y < GROUND - 70){
      const prog = (e.y - e.startY) / e.totalFall;
      if (prog >= T.fallDrops[e.fallI]){
        e.fallI++;
        launchSparks(e.x, e.y + 4, P.wht);
        spawnEnemy('ipbm', e.x, e.y + 5, rnd(-6, 6));
        sfx('dropHeavy');
      }
    }
    if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
    if (T.shield){
      e.shT -= edt;
      if (e.shT <= 0){
        e.shI = (e.shI + 1) % SHIELD_PATTERN.length;
        e.shT = SHIELD_PATTERN[e.shI][1];
        e.shieldUp = !!SHIELD_PATTERN[e.shI][0];
      }
      if (e.shFlash > 0) e.shFlash = Math.max(0, e.shFlash - dt);
      if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
      if (T.launch) e.launchT -= edt;
      if (T.launch && e.launchT <= 0 && e.x > 14 && e.x < W - 14){
        e.launchT = rnd(1.5, 2.5);
        launchSparks(e.x, e.y + 5, P.yel);
        spawnEnemy(pick(['ipbm','ipbm','ipbm','smart','mini']), e.x + rnd(-5, 5), e.y + 6, 0);
        sfx('dropHeavy');
      }
    }
    if (falling){
      // Missiles rebound off the side walls of both screens
      if (e.bounceCd > 0) e.bounceCd -= dt;
      const hitL = e.x < 0, hitR = e.x > W;
      if (hitL || hitR){
        e.x = hitL ? -e.x : 2 * W - e.x;
        e.vx = (hitL ? 1 : -1) * (Math.abs(e.vx) + 6);
        if (!(e.bounceCd > 0)){
          e.bounceCd = 0.25;
          for (let i = 0; i < 3; i++) spawnParticle(hitL ? 1 : W - 1, e.y, (hitL ? 1 : -1) * rnd(10, 40), rnd(-20, 20), rnd(0.15, 0.3), P.wht, 1);
        }
      }
    }
    e.trailTimer+=dt;
    if(e.trailTimer>0.035){
      e.trailTimer=0;
      e.trail.push({x:e.x,y:e.y});
      if(e.trail.length>45)e.trail.shift();
    }
    if(T.splitAt && !e.hasSplit){
      const progress = (e.y - e.startY) / e.totalFall;
      if(progress >= T.splitAt){
        e.hasSplit = true;
        const count = T.splitCount || 3;
        for(let i=0;i<count;i++){
          const spread = (i - (count-1)/2) * 14;
          spawnEnemy('mini', e.x + spread, e.y, spread*1.2, T.vy || 24);
        }
        e.dead = true;
        continue;
      }
    }
    if(e.dropPoints && e.dropIndex < e.dropPoints.length){
      const progress = e.fromLeft ? (e.x + 14) / (W + 28) : (W + 14 - e.x) / (W + 28);
      if(progress >= e.dropPoints[e.dropIndex]){
        e.dropIndex++;
        if (T.deploys){
          booms.push(new Boom(e.x, e.y + 8, 'flash', { r: 9, dur: 0.3 }));
          spawnEnemy(T.deploys, e.x, clamp(e.y + 26, 54, 150), 0, 0);
          sfx('dropHeavy');
        } else if (T.dropsHeavy){
          booms.push(new Boom(e.x, e.y + 6, 'flash', { r: 10, dur: 0.35 }));
          spawnEnemy('heavybomb', e.x, e.y + 6, 0, 32);
          sfx('dropHeavy');
        } else {
          spawnEnemy('ipbm', e.x, e.y + 6, 0, 30);
        }
      }
    }
    if(e.x<-40||e.x>W+40||e.y>H+30||e.y<-40){e.dead=true;continue;}
    if(e.y>=groundY&&e.vy>0){
      e.dead=true;
      if (e.x < 0 || e.x > W) continue;

      const hitTurret = turrets.find(t => t.alive && Math.abs(t.x - e.x) < 11);
      if (hitTurret){ tele.turretHits[e.pat || '?'] = (tele.turretHits[e.pat || '?'] || 0) + 1; destroyTurret(hitTurret); continue; }

      let hitDome = null;
      for(const inst of installations){
        if(inst.alive && Math.abs(inst.x - e.x) < inst.size + 8){
          hitDome = inst;
          break;
        }
      }

      if (!hitDome){
        booms.push(new Boom(e.x, GROUND - 4, 'circle', {r:14, dur:0.4, foe:true}));
        scorches.push({ x: Math.round(e.x), t: 0 }); if (scorches.length > 30) scorches.shift();
        for(let i=0;i<5;i++){
          spawnParticle(e.x,GROUND-4,rnd(-30,30),rnd(-50,-10),rnd(0.4,0.8),P.tan,1);
        }
        sfx('puff');
        continue;
      }

      tele.cityHits[e.pat || '?'] = (tele.cityHits[e.pat || '?'] || 0) + 1;
      if (damageCity(hitDome, e.x)) return;
    }
    if(e.y>BOT*0.8&&e.y<groundY&&e.vy>0)warningT=Math.max(warningT,0.1);
  }
  curParent = null;
  enemies=enemies.filter(e=>!e.dead);
  updateBooms(dt);updatePopups(dt);
  crateHits(); updateCrates(dt); curParent = { pat: 'hazard' }; updateHazards(dt); curParent = null; updateSatellites(dt);
  if(boss){ bossBoomHits(); if(boss) updateBoss(dt); if(menuState!=='game') return; }
  if(comboTimer>0){
    comboTimer-=dt;
    if(comboTimer<=0){
      if(combo>=3){
        popups.push({x:aim.x,y:aim.y-10,text:'COMBO BREAK',t:0,dur:0.7,col:P.red});
        sfx('comboBreak');
      }
      combo=0;
    }
  }

  if (gameMode === 'endless'){
    updateEndless(dt);
  } else {  // campaign and boss rush share the wave machinery
    if(waveState==='spawning'){
      updateBossPlan();
      choreoStep(dt);
      if (spawnRemaining > 0 && !(boss && (boss.state === 'warn' || boss.state === 'dying'))){
        if (phraseStep(dt, diffWave(wave), boss)){ spawnRemaining--; totalSpawned++; }
      } else if(spawnRemaining <= 0 && choreo.q.length === 0 && !boss && enemies.length===0 && shots.length===0){
        waveState='cleared';waveClearTimer=4.2;
        if (runStats.perfect){
          stats.perfectWaves++;
          pushToast('PERFECT WAVE!', P.lgrn);
        }
        // Standing cities pay out, and a flawless wave pays extra. Nothing is restored: what is lost stays lost until the next planet.
        let bonus = 0;
        for(const inst of installations)if(inst.alive)bonus+=500;
        if (runStats.perfect) bonus += 1000;
        if(bonus>0){addScore(bonus);waveBonus=Math.round(bonus*scoreMul);}
        sfx('waveClear');
        checkAchievements();
      }
    } else if(waveState==='cleared'){
      waveClearTimer-=dt;
      if(waveClearTimer<=0){
        if (gameMode === 'rush') rushAdvance();
        else if (isBossWave(wave)) worldClear(); else nextWave();
      }
    } else if(waveState==='worldclear'){
      waveClearTimer-=dt;
      if(waveClearTimer<=0){
        if (worldOf(wave) >= WORLDS.length - 1){ gameOver(true); return; }
        advanceWorld();
      }
    }
  }
}

// A turret is destroyed: it is out of action until it rebuilds itself, the wave ends, or a repair crate arrives
function destroyTurret(t){
  t.alive = false; t.rebuildT = TURRET_REBUILD;
  booms.push(new Boom(t.x, t.y, 'nova', { r: 22, dur: 0.6, noBoss: true, foe: true }));
  for (let i = 0; i < 12; i++) spawnParticle(t.x, t.y, rnd(-60, 60), rnd(-70, 10), rnd(0.4, 1.0), pick([P.yel, P.org, P.wht, P.gry]), 2);
  shake = Math.max(shake, 0.8); flashT = Math.max(flashT, 0.12); buzz(50);
  tip('turret', 'A DOWNED TURRET REBUILDS ITSELF AFTER A WHILE. REPAIR CRATES FIX IT AT ONCE.');
  popups.push({ x: t.x, y: t.y - 16, text: 'TURRET DOWN', t: 0, dur: 1.3, col: P.org, big: true });
  sfx('cityHit');
  if (turrets.every(u => !u.alive)) popups.push({ x: W / 2, y: GROUND - 60, text: 'NO TURRETS', t: 0, dur: 1.6, col: P.red, big: true });
}
function rebuildTurret(t){
  t.alive = true; t.rebuildT = 0; t.flash = 0.25;
  for (let i = 0; i < 6; i++) spawnParticle(t.x + rnd(-6, 6), t.y, rnd(-20, 20), rnd(-40, -10), rnd(0.3, 0.7), P.lgrn, 1);
  popups.push({ x: t.x, y: t.y - 16, text: 'WORKERS REPAIRED THE TURRET', t: 0, dur: 1.3, col: P.lgrn, big: false });
  sfx('pickup');
}

// A city is lost. Returns true when that ends the run
function damageCity(inst, ex){
  buzz([40, 30, 60]);
  if (fxShield > 0){
    fxShield--;
    sfx('shieldHit');
    shake = Math.max(shake, 0.6); flashT = Math.max(flashT, 0.2);
    booms.push(new Boom(ex, GROUND - 8, 'ring', { r: 30, dur: 0.6 }));
    popups.push({ x: ex, y: GROUND - 30, text: 'SHIELD', t: 0, dur: 1.0, col: P.lgrn, big: true });
    return false;
  }
  inst.alive = false;
  baseHP--;
  worldCityLoss++; bossCityLoss++;
  stats.citiesLost++;
  runStats.perfect = false;
  combo=0;comboTimer=0;lastKillAt = -999;
  shake=1.4;flashT=0.6;warningT=0.4;hitStop=0.12;musicDip();
  sfx('cityHit');
  popups.push({ x: W / 2, y: GROUND - 52, text: 'A COLLECTIVE HAS FALLEN', t: 0, dur: 1.6, col: P.red, big: false });
  if (gameMode === 'wave') tip('city', 'LOSE A CITY AND IT STAYS LOST UNTIL THE NEXT PLANET. SHOOT BOMBS BEFORE THEY LAND.');
  booms.push(new Boom(ex, GROUND - 2, 'mushroom', {r:44, dur:1.6, foe:true}));
  for(let i=0;i<14;i++){
    spawnParticle(ex,GROUND-4,rnd(-80,80),rnd(-110,-30),rnd(0.6,1.2),Math.random()<0.5?P.wht:P.tan,2);
  }
  if(baseHP<=0){gameOver();return true;}
  return false;
}

const boomHitsEnemy = (b, e) => b.hitTest(e.x, e.y) || (ETYPES[e.type].wide && (b.hitTest(e.x - 7, e.y) || b.hitTest(e.x + 7, e.y)));
// Returns true when the platform is destroyed. Shield absorbs blasts; each blast counts once.
function platformHit(e, b){
  if (e.hitBy === b.id) return false;
  e.hitBy = b.id;
  if (e.shieldUp){
    e.shFlash = 0.25;
    sfx('shieldHit');
    for (let i = 0; i < 4; i++) spawnParticle(e.x + rnd(-8, 8), e.y + rnd(-6, 2), rnd(-30, 30), rnd(-30, 10), rnd(0.2, 0.4), P.lblu, 1);
    return false;
  }
  e.hp--;
  e.hurt = 0.4;
  sfx('bossHit');
  for (let i = 0; i < 6; i++) spawnParticle(e.x + rnd(-6, 6), e.y, rnd(-40, 40), rnd(-40, 10), rnd(0.3, 0.6), P.yel, 1);
  if (e.hp > 0){
    if (ETYPES[e.type].shield){ e.shI = 0; e.shT = SHIELD_PATTERN[0][1]; e.shieldUp = true; }
    return false;
  }
  return true;
}
function updateBooms(dt){
  for(const b of booms)b.update(dt);
  const newBooms=[];
  for(const b of booms){
    if(b.dead)continue;
    const p=b.p;if(p<=0||p>=1)continue;
    const ec = enemies.length;
    let kills = 0;
    for(let i=0;i<ec;i++){
      const e = enemies[i];
      if(!e || e.dead) continue;
      if(boomHitsEnemy(b,e)){
        if (e.type === 'phantom' && phantomDim()) continue;
        if ((ETYPES[e.type].shield || ETYPES[e.type].hp > 1) && !platformHit(e,b)) continue;
        e.dead=true; kills++; onEnemyKilled(e,newBooms);
      }
    }
    if (kills > 0) b.kills = (b.kills || 0) + kills;
    if (!b.foe && b.kills >= 3 && b.kills > (b.paid || 2)){
      const n = b.kills, add = 100 * (n - (b.paid || 2)) * (n - 2);
      b.paid = n; score += add;
      popups.push({ x: b.x, y: b.y - 18, text: 'X' + n + ' BLAST +' + add, t: 0, dur: 1.2, col: P.yel, big: true });
      sfx('tier', Math.min(4, n - 3));
    }
  }
  if(newBooms.length)for(const nb of newBooms)booms.push(nb);
  enemies=enemies.filter(e=>!e.dead);
  booms=booms.filter(b=>!b.dead);
}
function updatePopups(dt){for(const p of popups){p.t+=dt;p.y-=14*dt;}popups=popups.filter(p=>p.t<p.dur);}

// Records the finished (or abandoned) run into lifetime stats
function recordRun(){
  stats.gamesPlayed++;
  if (gameMode === 'wave') stats.gamesWave++; else stats.gamesEndless++;
  if (gameMode === 'rush' && rush.bosses > (stats.bestRush || 0)) stats.bestRush = rush.bosses;
  stats.totalPlaytime += runStats.time;
  if (gameMode === 'endless' && endTime > stats.bestTime) stats.bestTime = endTime;
  if (gameMode === 'endless' && endTime > camp.endBest[runWorld]){ camp.endBest[runWorld] = endTime; saveCamp(); }
  if (gameMode === 'wave' && score > stats.bestScoreWave) stats.bestScoreWave = score;
  if (gameMode === 'endless' && score > stats.bestScoreEndless) stats.bestScoreEndless = score;
  checkAchievements();
  saveStats();
}

function gameOver(victory){
  runVictory = !!victory;
  combo = 0;
  comboTimer = 0;
  recordRun();

  const entry = {
    score,
    wave: (gameMode === 'wave') ? wave : (gameMode === 'rush' ? rush.bosses : null),
    world: runWorld,
    victory: !!victory,
    mods: runMods.slice(),
    time: runStats.time,
    combo: bestCombo,
    accuracy: runStats.shots > 0 ? runStats.kills / runStats.shots : 0,
    name: 'AAA',
    date: Date.now(),
  };

  const scores = loadScores(gameMode);
  const qualifies = entry.score > 0 && (scores.length < 8 || entry.score > scores[scores.length-1].score);

  gameOverSel = 0;
  if (qualifies){
    pendingScore = { entry, mode: gameMode };
    nameEntry = { letters: ['A','A','A'], cursor: 0 };
    nameLock = 0.7;
    menuState = 'nameentry';
  } else {
    saveScore(gameMode, entry);
    menuState = 'gameover';
    gameOverTimer = 1.6;
    sfx(victory ? 'victory' : 'gameOver');
  }
}
