'use strict';
// Pause, quick save and continue
// =====================================================================
//  PAUSE, QUICK SAVE AND CONTINUE
// =====================================================================
let paused = false, pauseSel = 0, pauseConfirm = false, optFromPause = false;
const PAUSE_BTN = { x: W - 19, y: BOT + 4, w: 15, h: 13 };
function pauseItems(){
  const a = ['RESUME'];
  if (gameMode === 'wave') a.push('SAVE AND QUIT');
  a.push('OPTIONS', pauseConfirm ? 'CONFIRM QUIT' : 'QUIT TO MENU');
  return a;
}
const PAUSE_Y0 = 52, PAUSE_STEP = 28;
function setPaused(v){
  if (paused === v) return;
  paused = v; pauseSel = 0; pauseConfirm = false;
  pointerDown = false;
  sfx(v ? 'select' : 'back');
}
function drawPauseButton(t){
  const b = PAUSE_BTN;
  ctx.globalAlpha = 0.7; ctx.fillStyle = P.blk; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.gry;
  ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
  ctx.fillRect(b.x, b.y, 1, b.h); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
  ctx.fillStyle = P.wht;
  ctx.fillRect(b.x + 4, b.y + 3, 2, 7); ctx.fillRect(b.x + 9, b.y + 3, 2, 7);
}
function drawPauseOverlay(t){
  ctx.globalAlpha = 0.72; ctx.fillStyle = P.blk;
  ctx.fillRect(0, 0, W, SH); ctx.fillRect(0, BOT, W, SH);
  ctx.globalAlpha = 1;
  // top screen: status banner
  const s1 = 'PAUSED';
  uiPlate(64, 70, 128, 46, P.blk, null, null, P.yel);
  drawText2x(s1, Math.round((W - textW2x(s1)) / 2) + 1, 79, P.dred);
  drawText2x(s1, Math.round((W - textW2x(s1)) / 2), 78, P.yel);
  const st = gameMode === 'wave' ? 'WAVE ' + formatWave(wave) : (gameMode === 'rush' ? 'BOSS RUSH' : 'ENDLESS ' + formatTime(endTime).slice(0, 5));
  drawText(st, Math.round((W - textW(st)) / 2), 99, P.lblu);
  const sc = 'SCORE ' + String(score).padStart(6, '0');
  drawText(sc, Math.round((W - textW(sc)) / 2), 106, P.gry);
  // bottom screen: a dialog window with the choices
  ctx.save(); ctx.translate(0, BOT);
  const items = pauseItems();
  const wx = 24, wy = 14, ww = W - 48, wh = 18 + items.length * 28 + 22;
  uiPlate(wx, wy, ww, wh, P.blk, null, null, P.yel);
  ctx.fillStyle = P.rrd; ctx.fillRect(wx + 1, wy + 1, ww - 2, 14);
  ctx.fillStyle = P.dred; ctx.fillRect(wx + 1, wy + 14, ww - 2, 2);
  drawStar(wx + 5, wy + 4, P.yel);
  drawText('PAUSE MENU', wx + 16, wy + 6, P.yel);
  for (let i = 0; i < items.length; i++){
    uiButton(wx + 8, wy + 22 + i * 28, ww - 16, 24, items[i], { sel: pauseSel === i, scale: 2, align: 'center', slide: uiAnim('p' + i, pauseSel === i ? 1 : 0), fn: () => { pauseSel = i; activatePause(i); } });
  }
  const hint = gameMode === 'wave' ? 'SAVE KEEPS THIS WAVE' : 'PROGRESS IS NOT SAVED';
  drawText(hint, Math.round((W - textW(hint)) / 2), wy + wh - 11, P.gry);
  uiFooter([['DPAD', 'MOVE'], ['A', 'SELECT'], ['B', 'RESUME']]);
  ctx.restore();
}
function activatePause(i){
  const label = pauseItems()[i];
  if (label === 'RESUME') setPaused(false);
  else if (label === 'SAVE AND QUIT'){
    writeSave(); paused = false; menuState = 'title'; menuSelection = 0; sfx('select');
    pushToast('RUN SAVED', P.lgrn);
  }
  else if (label === 'OPTIONS'){ optFromPause = true; menuState = 'options'; optionsSelection = 0; optionsConfirm = -1; sfx('select'); }
  else if (label === 'QUIT TO MENU'){ pauseConfirm = true; sfx('warn'); }
  else if (label === 'CONFIRM QUIT'){
    recordRun(); paused = false; menuState = 'title'; menuSelection = 0; sfx('back');
  }
}
function pauseKey(code){
  const n = pauseItems().length;
  if (code === 'ArrowUp'){ pauseSel = (pauseSel + n - 1) % n; pauseConfirm = false; sfx('move'); }
  if (code === 'ArrowDown'){ pauseSel = (pauseSel + 1) % n; pauseConfirm = false; sfx('move'); }
  if (code === 'Enter' || code === 'Space') activatePause(pauseSel);
  if (code === 'Escape' || code === 'KeyP') setPaused(false);
}

function snapshotRun(){
  const slim = o => Object.assign({}, o, { trail: [] });
  let bs = null;
  if (boss && boss.state !== 'dead' && boss.state !== 'dying'){
    bs = { idx: boss.idx, visit: boss.visit, parts: boss.parts.map(q => ({ id: q.id, hp: q.hp, alive: q.alive })) };
  }
  return {
    v: 2, world: curWorld, runWorld, wave, score, bestCombo, baseHP,
    inst: installations.map(i => ({ x: i.x, size: i.size, alive: i.alive })),
    spawnRemaining, totalSpawnCount, totalSpawned, speedMul, waveState, waveClearTimer,
    roundBest, waveBonus, orbTimer, worldCityLoss,
    choreo: { q: choreo.q, clock: choreo.clock, phrases: choreo.phrases, gapT: choreo.gapT },
    fx: [fxBlast, fxRapid, fxShield, fxSlow],
    enemies: enemies.filter(e => !e.dead).map(slim),
    crates: crates.map(slim),
    boss: bs, bossSpawned, themeFormation,
    mods: runMods.slice(),
    runStats: { kills: runStats.kills, shots: runStats.shots, perfect: runStats.perfect, time: runStats.time },
  };
}
function writeSave(){ saveData = snapshotRun(); safeSave(KEY('save'), saveData); }
function continueRun(){
  const sv = saveData;
  if (!sv) return;
  const keep = loadout.mods; loadout.mods = sv.mods || []; captureMods(); loadout.mods = keep;
  gameMode = 'wave'; runWorld = sv.runWorld; runVictory = false;
  paused = false; pauseSel = 0; pauseConfirm = false;
  resetGame();
  setWorld(sv.world);
  installations = sv.inst.map(i => ({ x: i.x, size: i.size, alive: i.alive }));
  maxBaseHP = installations.length; baseHP = clamp(sv.baseHP, 0, maxBaseHP);
  score = sv.score; bestCombo = sv.bestCombo; wave = sv.wave;
  spawnRemaining = sv.spawnRemaining; totalSpawnCount = sv.totalSpawnCount;
  totalSpawned = sv.totalSpawned; speedMul = sv.speedMul;
  choreoReset();
  if (sv.choreo){ choreo.q = sv.choreo.q || []; choreo.clock = sv.choreo.clock || 0; choreo.phrases = sv.choreo.phrases || []; choreo.gapT = sv.choreo.gapT || 1; }
  waveState = sv.waveState; waveClearTimer = sv.waveClearTimer;
  roundBest = sv.roundBest; waveBonus = sv.waveBonus;
  orbTimer = sv.orbTimer; worldCityLoss = sv.worldCityLoss || 0;
  fxBlast = sv.fx[0]; fxRapid = sv.fx[1]; fxShield = sv.fx[2]; fxSlow = sv.fx[3];
  enemies = sv.enemies; crates = (sv.crates || []).filter(c => c.state);
  bossSpawned = !!sv.bossSpawned; themeFormation = sv.themeFormation || null;
  runStats = sv.runStats;
  boss = null;
  if (sv.boss){
    spawnBoss(sv.boss.idx);
    boss.visit = sv.boss.visit;
    for (const q of sv.boss.parts){
      const part = boss.parts.find(x => x.id === q.id);
      if (part){ part.hp = q.hp; part.alive = q.alive; }
    }
    boss.state = 'warn'; boss.t = 1.3; boss.warned = 1; boss.life = 1.4; boss.layout();
    bossSpawned = true;
  }
  clearSave();
  menuState = 'game';
  paused = true; pauseSel = 0;
  sfx('deploy');
}

function goToTitle(sel){
  menuState = 'title';
  if (sel !== undefined){ const k = menuItems().indexOf(MENU_BASE[sel]); menuSelection = k >= 0 ? k : 0; }
  menuSelection = clamp(menuSelection, 0, menuItems().length - 1);
  sfx('back');
}
function activateTitleItem(i){
  const label = menuItems()[i];
  if (label === 'CONTINUE') continueRun();
  else if (label === 'CAMPAIGN') openDeploy('wave');
  else if (label === 'ENDLESS') startGame('endless', 0);
  else if (label === 'BOSS RUSH') startGame('rush', 0);
  else if (label === 'LOADOUT') openLoadout();
  else if (label === 'GALLERY') openGallery();
  else if (label === 'STATISTICS'){ menuState = 'stats'; statsPage = 0; sfx('select'); }
  else if (label === 'HIGH SCORES'){ menuState = 'scores'; scoresMode = 'wave'; sfx('select'); }
  else if (label === 'OPTIONS'){ menuState = 'options'; optionsSelection = 0; optionsConfirm = -1; optFromPause = false; sfx('select'); }
}
function leaveOptions(){
  if (optFromPause){ optFromPause = false; menuState = 'game'; paused = true; sfx('back'); }
  else goToTitle();
}
function activateOption(i){
  if (i === 6){ leaveOptions(); return; }
  if (i === 4 || i === 5){
    if (optionsConfirm === i){ cycleOption(i); optionsConfirm = -1; }
    else { optionsConfirm = i; sfx('warn'); }
  } else {
    cycleOption(i);
  }
}
function activateGameOver(i){
  if (gameOverTimer > 0) return;
  if (i === 0) startGame(gameMode, runWorld); else goToTitle(gameMode === 'wave' ? 0 : (gameMode === 'rush' ? 6 : 1));
}

function onPress(code){
  if (menuState === 'press' || menuState === 'briefing'){ if (code === 'Enter' || code === 'Space') introAdvance(); return; }
  if(code==='KeyM'){ opts.muted = !opts.muted; saveOpts(); sfx('select'); return; }

  if (menuState === 'title'){
    const nItems = menuItems().length;
    if (code === 'ArrowUp'){ menuSelection = (menuSelection + nItems - 1) % nItems; sfx('move'); }
    if (code === 'ArrowDown'){ menuSelection = (menuSelection + 1) % nItems; sfx('move'); }
    if (code === 'Enter' || code === 'Space') activateTitleItem(menuSelection);
    return;
  }

  if (menuState === 'gallery'){ galKey(code); return; }

  if (menuState === 'loadout'){
    const n = loadCount(loadTab);
    if (code === 'ArrowLeft') loadMoveTab(-1);
    if (code === 'ArrowRight') loadMoveTab(1);
    if (code === 'ArrowUp'){ loadSel = (loadSel + n - 1) % n; sfx('move'); }
    if (code === 'ArrowDown'){ loadSel = (loadSel + 1) % n; sfx('move'); }
    if (code === 'Enter' || code === 'Space') activateLoad(loadSel);
    if (code === 'Escape') goToTitle(2);
    return;
  }

  if (menuState === 'deploy'){
    const n = WORLDS.length;
    if (code === 'ArrowUp'){ deploySel = (deploySel + n - 1) % n; sfx('move'); }
    if (code === 'ArrowDown'){ deploySel = (deploySel + 1) % n; sfx('move'); }
    if (code === 'Enter' || code === 'Space') activateDeploy(deploySel);
    if (code === 'Escape') goToTitle(deployMode === 'wave' ? 0 : 1);
    return;
  }

  if (menuState === 'scores'){
    if (code === 'ArrowLeft' || code === 'ArrowRight') cycleScores(code === 'ArrowRight' ? 1 : -1);
    if (code === 'Enter' || code === 'Space' || code === 'Escape') goToTitle();
    return;
  }

  if (menuState === 'stats'){
    if (code === 'ArrowLeft' || code === 'ArrowRight'){ statsPage = (statsPage + (code === 'ArrowRight' ? 1 : STATS_PAGES - 1)) % STATS_PAGES; sfx('move'); }
    if (code === 'Enter' || code === 'Space' || code === 'Escape') goToTitle();
    return;
  }

  if (menuState === 'options'){
    if (code === 'ArrowUp'){
      optionsSelection = (optionsSelection + OPTIONS_COUNT - 1) % OPTIONS_COUNT;
      optionsConfirm = -1;
      sfx('move');
    }
    if (code === 'ArrowDown'){
      optionsSelection = (optionsSelection + 1) % OPTIONS_COUNT;
      optionsConfirm = -1;
      sfx('move');
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight'){
      if (optionsSelection <= 3) cycleOption(optionsSelection, code === 'ArrowRight' ? 1 : -1);
    }
    if (code === 'Enter' || code === 'Space') activateOption(optionsSelection);
    if (code === 'Escape') leaveOptions();
    return;
  }

  if (menuState === 'nameentry'){
    if (code === 'ArrowLeft'){ nameEntryMoveCursor(-1); }
    if (code === 'ArrowRight'){ nameEntryMoveCursor(1); }
    if (code === 'ArrowUp'){ nameEntryChangeLetter(-1); }
    if (code === 'ArrowDown'){ nameEntryChangeLetter(1); }
    if (code === 'Enter' || code === 'Space' || code === 'Escape'){ nameEntryConfirm(); }
    return;
  }

  if (menuState === 'gameover'){
    if (gameOverTimer <= 0){
      if (code === 'ArrowUp' || code === 'ArrowDown'){ gameOverSel = 1 - gameOverSel; sfx('move'); }
      if (code === 'Enter' || code === 'Space') activateGameOver(gameOverSel);
      if (code === 'Escape') goToTitle(0);
    }
    return;
  }

  if (menuState === 'game'){
    if (paused){ pauseKey(code); return; }
    if (code === 'Escape' || code === 'KeyP'){ setPaused(true); return; }
    if (code === 'Space' || code === 'Enter') fire();
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Tab' || code === 'KeyQ' || code === 'KeyE') swapScreen();
  }
}

let pointerDown=false;
function canvasPos(ev){
  const r=cvs.getBoundingClientRect();
  return {x:(ev.clientX-r.left)/r.width*W, y:(ev.clientY-r.top)/r.height*H};
}

cvs.addEventListener('pointerdown',ev=>{
  audioInit();ev.preventDefault();cvs.setPointerCapture(ev.pointerId);pointerDown=true;
  const p = canvasPos(ev);

  if (menuState === 'game'){
    const pb = PAUSE_BTN;
    if (paused){
      uiStylus(p.x, p.y);
      if (p.y >= BOT) uiTap(p.x, p.y - BOT);
      return;
    }
    if (p.x >= pb.x - 4 && p.x < pb.x + pb.w + 4 && p.y >= pb.y - 2 && p.y < pb.y + pb.h + 4){ setPaused(true); return; }
    aim.x=clamp(p.x,5,W-6);
    let y=p.y;
    if(y>SH-4&&y<BOT+4)y=(y<(SH+BOT)/2)?SH-5:BOT+5;
    aim.y=clamp(y,5,H-6);
    fire();
    return;
  }

  if (menuState === 'press' || menuState === 'briefing'){ if (p.y >= BOT){ uiStylus(p.x, p.y); introAdvance(); } return; }
  if (menuState === 'gallery'){
    uiStylus(p.x, p.y);
    const hit = p.y >= BOT && uiTap(p.x, p.y - BOT);
    if (!hit) galPointerDown(p);                      // otherwise it is a drag, a swipe or a double tap
    return;
  }
  // Every menu lives on the bottom screen; its buttons registered their own hit regions while drawing
  if (p.y < BOT) return;
  uiStylus(p.x, p.y);
  uiTap(p.x, p.y - BOT);
});
cvs.addEventListener('pointermove',ev=>{
  if(!pointerDown) return;
  if (menuState === 'gallery'){ ev.preventDefault(); galPointerMove(canvasPos(ev)); return; }
  if (menuState !== 'game' || paused) return;
  ev.preventDefault();
  const p = canvasPos(ev);
  aim.x=clamp(p.x,5,W-6);
  let y=p.y;
  if(y>SH-4&&y<BOT+4)y=(y<(SH+BOT)/2)?SH-5:BOT+5;
  aim.y=clamp(y,5,H-6);
});
cvs.addEventListener('pointerup',ev=>{ pointerDown=false; if (menuState === 'gallery') galPointerUp(canvasPos(ev)); });
cvs.addEventListener('pointercancel',()=>{pointerDown=false;});
cvs.addEventListener('contextmenu',e=>e.preventDefault());
