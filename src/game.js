'use strict';
// Game state, waves, Endless and Boss Rush modes
// =====================================================================
//  GAME STATE
// =====================================================================
const GROUND = H - 16;
const HORIZON = BOT + 60;
const SHARED_MAX = 30;
const ENDLESS_AMMO_REGEN = 0.5;      // seconds per round regained in Endless
const BONUS_CITY_STEP = 10000;       // score interval for a restored city
let sharedAmmo = SHARED_MAX;

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
let wave,spawnRemaining,spawnTimer,spawnInterval,waveState,waveClearTimer;
let totalSpawnCount = 0, totalSpawned = 0;
let speedMul,shake,flashT,gameOverTimer,fireCooldown,warningT;
let installations,waveBannerT;
let turretBarrels=[],fadingTrails=[];
let windPhase=0;
let snowPool=[];
const MAX_SNOW = 30;
let worldCanvas = null;

let spawnBurstLeft = 0;
let spawnBurstPause = 0;
let nextBossAt = 0, pulseCount = 0, endBosses = 0;
let roundBest = 0, waveBonus = 0, endStage = 1;
let dangerLevel = 0;
let lastKillAt = -999;
let ammoRegenT = 0;
let nextBonusCityAt = BONUS_CITY_STEP;
let achTimer = 1;
let nameLock = 0;

let _cachedActiveTurret = null;
let _cachedComboTier = null;

let runStats = { kills:0, shots:0, perfect:false, time:0 };

let nameEntry = { letters: ['A','A','A'], cursor: 0 };
let pendingScore = null;

function createWorldCanvas(){
  const top = HORIZON - 20;
  const h = GROUND - top;
  const c = document.createElement('canvas');
  c.width = W; c.height = h;
  const wc = c.getContext('2d');
  const oy = 20;
  wc.fillStyle=P.wht; wc.fillRect(0,oy,W,1);
  wc.fillStyle=currentEnv.mountNear.lit; wc.fillRect(0,oy+1,W,1);
  const farPeaks=[]; let x=-30;
  while(x<W+30){const pw=rndi(22,42),ph=rndi(6,13);farPeaks.push({x,pw,ph});x+=pw-Math.floor(pw*0.35);}
  const nearPeaks=[]; x=-30;
  while(x<W+30){const pw=rndi(16,32),ph=rndi(10,20);nearPeaks.push({x,pw,ph});x+=pw-Math.floor(pw*0.30);}
  const layers = [
    {peaks:farPeaks, lit:currentEnv.mountFar.lit, shd:currentEnv.mountFar.shd, yBase:oy+2},
    {peaks:nearPeaks,lit:currentEnv.mountNear.lit,shd:currentEnv.mountNear.shd,yBase:oy+6},
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
  fadingTrails = [];
  resetHazards();
}

function startGame(mode, wi){
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
  orbTimer = (mode === 'endless') ? 6 : 14;
  runStats = { kills:0, shots:0, perfect:true, time:0 };
  if (mode === 'endless'){
    wave = 1;
    speedMul = 1.0;
    spawnRemaining = 999999;
    spawnInterval = 0.55;
    spawnTimer = 0.5;
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
    {x:40, y:GROUND-22, flash:0},
    {x:128,y:GROUND-22, flash:0},
    {x:216,y:GROUND-22, flash:0},
  ];
  turretBarrels = turrets.map(t=>({x:t.x, y:t.y-6}));
  aim = {x:128, y:GROUND-30};
  score=0;combo=0;comboTimer=0;bestCombo=0;roundBest=0;waveBonus=0;endStage=1;
  sharedAmmo = ammoCap;
  wave=0;speedMul=1;
  spawnRemaining=0;spawnTimer=0;spawnInterval=1.5;
  waveState='idle';waveClearTimer=0;
  totalSpawnCount = 0; totalSpawned = 0;
  shake=0;flashT=0;gameOverTimer=0;fireCooldown=0;
  warningT=0;waveBannerT=0;
  spawnBurstLeft = 0;
  spawnBurstPause = 0;
  nextBossAt = 0; pulseCount = 0; endBosses = 0; endStage = 1; resetEndless();
  dangerLevel = 0;
  lastKillAt = -999;
  ammoRegenT = 0;
  nextBonusCityAt = BONUS_CITY_STEP;
  achTimer = 1;
  _cachedActiveTurret = null;
  _cachedComboTier = null;
  boss = null;
  crates = []; fxBlast = 0; fxRapid = 0; fxShield = 0; fxSlow = 0;
  resetHazards();
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

function spawnEnemy(type,x,y,vx,vy){
  const T=ETYPES[type];
  if(x===undefined){
    const fromLeft=Math.random()<0.5;
    x=fromLeft?-14:W+14;
    vx=(fromLeft?1:-1)*(T.vx+rnd(-2,5));
  }
  if(y===undefined) y = T.passing ? rndi(30, BOT-40) : rndi(20, BOT-30);
  if (T.homing && !T.passing && vy === undefined && T.vy > 0){
    const alive = installations.filter(i => i.alive);
    if (alive.length > 0){
      let nearest = alive[0], bestD = Math.abs(alive[0].x - x);
      for (const c of alive){
        const d = Math.abs(c.x - x);
        if (d < bestD){ bestD = d; nearest = c; }
      }
      const fallTime = (GROUND - y) / (T.vy * speedMul);
      if (fallTime > 0.3){
        const targetVx = (nearest.x - x) / fallTime;
        vx = (vx === undefined ? T.vx : vx) * (1 - T.homing) + targetVx * T.homing + rnd(-1.4, 1.4);
      }
    }
  }
  enemies.push({
    type,x,y,
    vx: vx!==undefined?vx:T.vx,
    vy: vy!==undefined?vy:T.vy*speedMul,
    dead:false, trail:[], trailTimer:0,
    fromLeft: (vx!==undefined?vx:T.vx)>0,
    dropPoints: T.drops ? T.drops.slice() : null,
    dropIndex: 0,
    wobble:Math.random()*6.28,
    hasSplit: false,
    startY: y,
    totalFall: Math.max(1, GROUND - y),
  });
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
// Spawns a tight formation and returns how many missiles it holds
function spawnCluster(pool, dw, forceN, forcePattern){
  const eligible = pool.filter(t => !ETYPES[t].passing);
  if (eligible.length === 0) return 0;
  dw = dw || 1;
  const pattern = forcePattern || pickFormation(dw);
  const n = forceN || clamp(rndi(3, 5) + Math.floor(dw / 3), 3, 8);
  const t = pick(eligible);
  const pts = formationPoints(pattern, n, rndi(34, W - 34), rndi(8, 34));
  // Some formations carry a leader whose blast suits the shape
  let leader = null;
  if (n >= 4 && Math.random() < 0.45){
    const want = { line:'rowbomb', column:'colbomb', ring:'heavy', block:'heavy', twin:'rowbomb', vee:'multi', diag:'multi' }[pattern];
    if (pool.includes(want)) leader = want;
  }
  const li = Math.floor(pts.length / 2);
  for (let i = 0; i < pts.length; i++) spawnEnemy(leader && i === li ? leader : t, pts[i].x, pts[i].y);
  return pts.length;
}

function typePool(w, env){
  const p=['ipbm','ipbm','ipbm'];
  if(w>=2){p.push('smart');p.push('scout');}
  if(w>=3){p.push('splitter'); p.push('splitter');}
  if(w>=4){p.push('heavy'); p.push('multi');}
  if(w>=5){p.push('shrapnel'); p.push('bomber');}
  if(w>=6){p.push('icbm'); p.push('midsplit');}
  if(w>=7){p.push('scout'); p.push('colbomb');}
  if(w>=8){p.push('bomber'); p.push('rowbomb'); p.push('gunner');}
  if(w>=9){p.push('bandit'); p.push('carrier');}
  if(w>=10){p.push('colbomb'); p.push('rowbomb'); p.push('gunner');}
  if(env && env.favor) for(const f of env.favor){ if(w>=f[1]){ p.push(f[0]); p.push(f[0]); } }
  return p;
}

// Campaign waves are numbered globally (1..40); each world is 8 waves ending in a boss
const worldOf = gw => Math.floor((gw - 1) / WAVES_PER_WORLD);
const waveIn  = gw => ((gw - 1) % WAVES_PER_WORLD) + 1;
const formatWave = gw => (gw > 0 ? (worldOf(gw) + 1) + '-' + waveIn(gw) : '--');
const diffWave = gw => gameMode === 'rush' ? Math.min(22, 6 + rush.n) : worldOf(gw) * 3 + waveIn(gw);
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
  speedMul=Math.min(1.9,1+(dw-1)*0.05);
  spawnRemaining=Math.min(58,Math.floor(10+dw*2.5));
  if (modHeavy) spawnRemaining = Math.floor(spawnRemaining * 1.5);
  if (isBossWave(wave)) spawnRemaining = Math.floor(spawnRemaining * 1.3);
  if (gameMode === 'rush' && !isBossWave(wave)) spawnRemaining = Math.floor(spawnRemaining * 0.45);
  totalSpawnCount = spawnRemaining;
  totalSpawned = 0;
  spawnInterval=Math.max(0.35,1.15-dw*0.05);
  spawnTimer=2.6;waveState='spawning';
  sharedAmmo = ammoCap;
  spawnBurstLeft = Math.min(5, 3 + Math.floor(dw / 2));
  spawnBurstPause = 0;
  flashT=0.25;
  let sub = '';
  if (waveIn(wave) === 1) sub = currentEnv.name;
  else if (isBossWave(wave)) sub = 'BOSS WAVE';
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
  let n = 3;
  for (const inst of installations){
    if (!inst.alive && n > 0){ inst.alive = true; baseHP = Math.min(maxBaseHP, baseHP + 1); n--; }
  }
  setWorld(wi);
  nextWave();
}

function onEnemyKilled(e,outBooms){
  const T=ETYPES[e.type];const ex=e.x,ey=e.y;
  runStats.kills++;
  stats.totalKills++;
  maybeDropCrate(e, T);
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
    const d = Math.abs(t.x - aim.x);
    if (d < bestD){ bestD = d; best = t; }
  }
  return best;
}

function fire(){
  if(menuState!=='game'||fireCooldown>0)return;
  if (sharedAmmo <= 0 && fxRapid <= 0){ sfx('dry'); return; }
  const best = _cachedActiveTurret || computeActiveTurret();
  if(!best) return;
  const free = fxRapid > 0;
  if (!free) sharedAmmo--;
  runStats.shots++;
  stats.totalShots++;
  best.flash=0.10;fireCooldown=free?0.05:0.10;
  let blastR = 28;
  if (fxBlast > 0){ blastR = 44; fxBlast--; }
  const tx = aim.x, ty = aim.y;
  const dx=tx-best.x,dy=ty-best.y;const dist=Math.hypot(dx,dy);
  shots.push({x0:best.x,y0:best.y-4,x1:tx,y1:ty,t:0,dur:Math.max(0.06,dist/650),r:blastR});
  sfx('fire');
  for(let i=0;i<3;i++)spawnParticle(best.x+rnd(-2,2),best.y-6,rnd(-20,20),rnd(-40,-20),0.2,P.yel,1);
}

// ---------------------------------------------------------------------
//  Endless: a director paces the screen in build, surge and lull phases,
//  keeps the number of falling missiles under a cap, and shifts the stage
//  (arena, speed, mix) as the score climbs.
// ---------------------------------------------------------------------
const edir = { phase:'build', t:0, len:14, timer:0, raidAt:60, cycles:0, shiftAt:80 };
const MOON_SHIFT = 80;
// Difficulty climbs slowly with time alone
function endDiff(){ return Math.min(14, 1 + Math.floor(endTime / 50)); }
function resetEndless(){
  edir.phase = 'build'; edir.t = 0; edir.len = 12; edir.timer = 1.0; edir.raidAt = 55; edir.cycles = 0; edir.shiftAt = MOON_SHIFT;
}
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
  for (const inst of installations){ if (!inst.alive){ inst.alive = true; baseHP = Math.min(maxBaseHP, baseHP + 1); break; } }
  spawnOrbital();
  edir.phase = 'lull'; edir.t = 0; edir.len = 4.5; edir.timer = 1;
}
function updateEndless(dt){
  if (endTime >= edir.shiftAt){ edir.shiftAt += MOON_SHIFT; endlessMoonShift(); }
  const dd = endDiff();
  speedMul = Math.min(2.0, 1 + (dd - 1) * 0.05);
  edir.t += dt;
  edir.timer -= dt;
  const cap = Math.min(18, 6 + Math.floor(dd * 1.2)) * (modHeavy ? 1.4 : 1);
  const fall = fallingCount();
  if (edir.phase === 'build'){
    if (edir.timer <= 0 && fall < cap){
      const pool = typePool(dd, currentEnv);
      if (Math.random() < 0.28 && fall < cap - 4) spawnCluster(pool, dd, rndi(3, 4 + Math.floor(dd / 4)));
      else spawnEnemy(pick(pool));
      edir.timer = Math.max(0.5, 1.45 - dd * 0.07) * (modHeavy ? 0.7 : 1) * rnd(0.8, 1.25);
    }
    if (edir.t >= edir.len){ edir.phase = 'surge'; edir.t = 0; edir.len = 6.5; edir.timer = 0.2; }
  } else if (edir.phase === 'surge'){
    if (edir.timer <= 0 && fall < cap + 5){
      const pool = typePool(dd, currentEnv);
      spawnCluster(pool, dd, clamp(5 + Math.floor(dd / 3), 5, 9));
      sfx('warn');
      edir.timer = 2.4;
    }
    if (edir.t >= edir.len){ edir.phase = 'lull'; edir.t = 0; edir.len = 3.6; edir.timer = 99; }
  } else {
    if (edir.t >= edir.len){
      edir.phase = 'build'; edir.t = 0; edir.len = 11 + Math.random() * 6; edir.timer = 0.6; edir.cycles++;
    }
  }
  if (endTime >= edir.raidAt){
    edir.raidAt += 55;
    const fromLeft = Math.random() < 0.5;
    spawnEnemy('carrier', fromLeft ? -12 : W + 12, rndi(40, BOT - 60), (fromLeft ? 1 : -1) * 14);
    if (dd >= 4) spawnEnemy('bandit', fromLeft ? W + 12 : -12, rndi(40, BOT - 60), (fromLeft ? -1 : 1) * 80);
    popups.push({x: W/2, y: SH/2, text:'AIR RAID', t: 0, dur: 1.4, col: P.mag, big: true});
    sfx('boss');
  }
}

// ---------------------------------------------------------------------
//  Boss Rush: the bosses loop in random order, with a short regular wave
//  between each. Built on the campaign wave machinery.
// ---------------------------------------------------------------------
const rush = { n:0, bosses:0, phase:'interlude', order:[], next:0, last:-1 };
const rushUnlocked = () => camp.clears[WORLDS.length - 1] > 0;
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
  windPhase+=dt;
  if(shake>0)shake=Math.max(0,shake-dt*3);
  if(flashT>0)flashT=Math.max(0,flashT-dt*2.5);
  if(fireCooldown>0)fireCooldown-=dt;
  if(warningT>0)warningT=Math.max(0,warningT-dt);
  if(waveBannerT>0)waveBannerT=Math.max(0,waveBannerT-dt);

  updateToasts(dt);

  if(menuState!=='game'){
    if(menuState==='gameover') gameOverTimer -= dt;
    else if(menuState==='nameentry') nameLock -= dt;
    else if(menuState==='loadout') updateLoadoutDemo(dt);
    else updateAttract(dt);
    return;
  }

  if (paused) return;
  runStats.time += dt;

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
  const wind=Math.sin(windPhase*0.3)*4+Math.sin(windPhase*0.9)*1.5;
  updateSnowfall(dt,wind);

  if (gameMode === 'endless') endTime += dt;
  const regenEvery = (boss && boss.state === 'fight') ? 0.2 : (gameMode === 'endless' ? ENDLESS_AMMO_REGEN : 0);
  if (regenEvery > 0){
    ammoRegenT += dt;
    if (ammoRegenT >= regenEvery){
      ammoRegenT -= regenEvery;
      if (sharedAmmo < ammoCap) sharedAmmo++;
    }
  }

  for(let i=0;i<turrets.length;i++){
    const t=turrets[i];const b=turretBarrels[i];
    const dx=aim.x-t.x,dy=aim.y-t.y;
    const len=Math.hypot(dx,dy)||1;
    b.x+=(t.x+dx/len*10-b.x)*dt*20;
    b.y+=(t.y-2+dy/len*10-b.y)*dt*20;
  }
  for(const t of turrets)if(t.flash>0)t.flash=Math.max(0,t.flash-dt);
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
    e.wobble+=dt*3;
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
    if (gust && e.vy > 0 && !T.passing) e.vx += gust * edt * 0.5;
    e.x+=e.vx*edt;e.y+=e.vy*edt;
    if (e.y > SH && e.vy > 0){
      if (e.x < 16 && e.vx < 0) e.vx = Math.abs(e.vx) * 0.5;
      if (e.x > W - 16 && e.vx > 0) e.vx = -Math.abs(e.vx) * 0.5;
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
        if (T.dropsHeavy){
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

      let hitDome = null;
      for(const inst of installations){
        if(inst.alive && Math.abs(inst.x - e.x) < inst.size + 8){
          hitDome = inst;
          break;
        }
      }

      if (!hitDome){
        booms.push(new Boom(e.x, GROUND - 4, 'circle', {r:14, dur:0.4}));
        for(let i=0;i<5;i++){
          spawnParticle(e.x,GROUND-4,rnd(-30,30),rnd(-50,-10),rnd(0.4,0.8),P.tan,1);
        }
        sfx('puff');
        continue;
      }

      if (damageCity(hitDome, e.x)) return;
    }
    if(e.y>BOT*0.8&&e.y<groundY&&e.vy>0)warningT=Math.max(warningT,0.1);
  }
  enemies=enemies.filter(e=>!e.dead);
  updateBooms(dt);updatePopups(dt);
  crateHits(); updateCrates(dt); updateHazards(dt);
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
      if(spawnBurstPause > 0){
        spawnBurstPause -= dt;
      } else if(spawnRemaining > 0 && !(boss && (boss.state === 'warn' || boss.state === 'dying'))){
        spawnTimer -= dt * ((boss && boss.state === 'fight') ? 0.55 : 1);
        if(spawnTimer <= 0){
          spawnTimer = spawnInterval;
          spawnRemaining--;
          totalSpawned++;
          spawnBurstLeft--;
          if (Math.random() < 0.55 && spawnRemaining > 3){
            const cn = spawnCluster(typePool(diffWave(wave), currentEnv), diffWave(wave));
            spawnRemaining = Math.max(0, spawnRemaining-cn);
            totalSpawned += cn;
            spawnBurstLeft -= 2;
          } else {
            spawnEnemy(pick(typePool(diffWave(wave), currentEnv)));
          }
          if (spawnBurstLeft <= 0){
            spawnBurstLeft = Math.min(6, 3 + Math.floor(wave / 2));
            spawnBurstPause = 1.5 + Math.random() * 0.9;
          }
        }
      } else if(spawnRemaining <= 0 && !boss && enemies.length===0 && shots.length===0){
        waveState='cleared';waveClearTimer=4.2;
        if (runStats.perfect){
          stats.perfectWaves++;
          pushToast('PERFECT WAVE!', P.lgrn);
        }
        let bonus = sharedAmmo * 25;
        for(const inst of installations)if(inst.alive)bonus+=500;
        if(bonus>0){addScore(bonus);waveBonus=Math.round(bonus*scoreMul);}
        sfx('waveClear');
        // One city is restored each time the score crosses a new 10,000 mark
        while(score >= nextBonusCityAt){
          nextBonusCityAt += BONUS_CITY_STEP;
          for(const inst of installations){
            if(!inst.alive){inst.alive=true;baseHP=Math.min(maxBaseHP,baseHP+1);break;}
          }
        }
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

// A city is lost. Returns true when that ends the run
function damageCity(inst, ex){
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
  shake=1.4;flashT=0.6;warningT=0.4;
  sfx('cityHit');
  booms.push(new Boom(ex, GROUND - 2, 'mushroom', {r:44, dur:1.6}));
  for(let i=0;i<14;i++){
    spawnParticle(ex,GROUND-4,rnd(-80,80),rnd(-110,-30),rnd(0.6,1.2),Math.random()<0.5?P.wht:P.tan,2);
  }
  if(baseHP<=0){gameOver();return true;}
  return false;
}

function updateBooms(dt){
  for(const b of booms)b.update(dt);
  const newBooms=[];
  for(const b of booms){
    if(b.dead)continue;
    const p=b.p;if(p<=0||p>=1)continue;
    const ec = enemies.length;
    for(let i=0;i<ec;i++){
      const e = enemies[i];
      if(!e || e.dead) continue;
      if(b.hitTest(e.x,e.y)){ e.dead=true; onEnemyKilled(e,newBooms); }
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
