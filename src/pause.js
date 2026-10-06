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
  const s1 = 'PAUSED';
  drawText2x(s1, Math.round((W - textW2x(s1)) / 2), 88, P.yel);
  ctx.save(); ctx.translate(0, BOT);
  const items = pauseItems();
  for (let i = 0; i < items.length; i++) drawRowBtn(items[i], PAUSE_Y0 + i * PAUSE_STEP, pauseSel === i, t);
  const hint = gameMode === 'wave' ? 'SAVE KEEPS THIS WAVE' : 'ESC TO RESUME';
  drawText(hint, Math.round((W - textW(hint)) / 2), SH - 14, P.gry);
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
    v: 1, world: curWorld, runWorld, wave, score, bestCombo, baseHP,
    inst: installations.map(i => ({ x: i.x, size: i.size, alive: i.alive })),
    sharedAmmo, spawnRemaining, totalSpawnCount, totalSpawned, spawnTimer, spawnInterval,
    spawnBurstLeft, spawnBurstPause, speedMul, waveState, waveClearTimer,
    roundBest, waveBonus, nextBonusCityAt, orbTimer, worldCityLoss,
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
  sharedAmmo = sv.sharedAmmo; spawnRemaining = sv.spawnRemaining; totalSpawnCount = sv.totalSpawnCount;
  totalSpawned = sv.totalSpawned; spawnTimer = sv.spawnTimer; spawnInterval = sv.spawnInterval;
  spawnBurstLeft = sv.spawnBurstLeft; spawnBurstPause = sv.spawnBurstPause; speedMul = sv.speedMul;
  waveState = sv.waveState; waveClearTimer = sv.waveClearTimer;
  roundBest = sv.roundBest; waveBonus = sv.waveBonus; nextBonusCityAt = sv.nextBonusCityAt;
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
  else if (label === 'STATISTICS'){ menuState = 'stats'; statsPage = 0; sfx('select'); }
  else if (label === 'HIGH SCORES'){ menuState = 'scores'; scoresMode = 'wave'; sfx('select'); }
  else if (label === 'OPTIONS'){ menuState = 'options'; optionsSelection = 0; optionsConfirm = -1; optFromPause = false; sfx('select'); }
}
function leaveOptions(){
  if (optFromPause){ optFromPause = false; menuState = 'game'; paused = true; sfx('back'); }
  else goToTitle();
}
function activateOption(i){
  if (i === 4){ leaveOptions(); return; }
  if (i === 2 || i === 3){
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
    if (code === 'ArrowLeft' || code === 'ArrowRight'){ statsPage = (statsPage + (code === 'ArrowRight' ? 1 : 3)) % 4; sfx('move'); }
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
      if (optionsSelection === 0 || optionsSelection === 1) cycleOption(optionsSelection);
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
const nearRow = (py, y) => Math.abs(py - (y + 5)) < 13;

cvs.addEventListener('pointerdown',ev=>{
  audioInit();ev.preventDefault();cvs.setPointerCapture(ev.pointerId);pointerDown=true;
  const p = canvasPos(ev);

  if (menuState === 'game'){
    const pb = PAUSE_BTN;
    if (paused){
      const ly = p.y - BOT, n = pauseItems().length;
      for (let i = 0; i < n; i++){
        if (nearRow(ly, PAUSE_Y0 + i * PAUSE_STEP)){ pauseSel = i; activatePause(i); return; }
      }
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

  if (menuState === 'press' || menuState === 'briefing'){ if (canvasPos(ev).y >= BOT) introAdvance(); return; }
  // Every menu is on the bottom screen, so convert to its local coordinates
  p.y -= BOT;
  if (p.y < 0) return;

  if (menuState === 'title'){
    const items = menuItems(), st = menuStep(items.length), yy0 = menuY0(items.length);
    for (let i=0;i<items.length;i++){
      if (Math.abs(p.y - (yy0 + i*st + 5)) < st / 2){
        menuSelection = i;
        activateTitleItem(i);
        return;
      }
    }
    return;
  }
  if (menuState === 'loadout'){
    if (p.y > SH - 22){ goToTitle(2); return; }
    if (p.y >= 20 && p.y < 36){
      for (let i = 0; i < LOAD_TABS.length; i++){
        const x = 4 + i * 50;
        if (p.x >= x && p.x < x + 48){ if (loadTab !== i){ loadTab = i - 0; loadMoveTab(0); loadTab = i; loadSel = i < 4 ? loadout[LOAD_CATS[i]] : 0; } return; }
      }
      return;
    }
    const n = loadCount(loadTab);
    for (let i = 0; i < n; i++){
      const y = LOAD_Y0 + i * LOAD_STEP;
      if (p.y >= y - 3 && p.y < y + 12){ activateLoad(i); return; }
    }
    return;
  }
  if (menuState === 'deploy'){
    if (p.y > SH - 22){ goToTitle(deployMode === 'wave' ? 0 : 1); return; }
    for (let i = 0; i < WORLDS.length; i++){
      const y = DEPLOY_Y0 + i * DEPLOY_STEP;
      if (p.y >= y - 3 && p.y < y + 22){
        if (deploySel === i) activateDeploy(i);
        else { deploySel = i; sfx('move'); }
        return;
      }
    }
    return;
  }
  if (menuState === 'scores'){
    if (p.y < 50){ cycleScores(p.x < W/2 ? -1 : 1); }
    else if (p.y > SH - 30){ goToTitle(); }
    return;
  }
  if (menuState === 'stats'){
    if (p.y < 30){ statsPage = (statsPage + (p.x < W/2 ? 3 : 1)) % 4; sfx('move'); }
    else if (p.y > SH - 30){ goToTitle(); }
    return;
  }
  if (menuState === 'options'){
    for (let i = 0; i < 4; i++){
      if (nearRow(p.y, 40 + i * 24)){ optionsSelection = i; activateOption(i); return; }
    }
    if (nearRow(p.y, 40 + 4 * 24)){ optionsSelection = 4; activateOption(4); }
    return;
  }
  if (menuState === 'nameentry'){
    if (p.y >= NAME_SLOT_Y - 12 && p.y <= NAME_SLOT_Y + NAME_SLOT_H + 12){
      for (let i = 0; i < 3; i++){
        const x = nameSlotX(i);
        if (p.x >= x && p.x < x + NAME_SLOT_W){
          nameEntry.cursor = i;
          nameEntryChangeLetter(p.y < NAME_SLOT_Y + NAME_SLOT_H/2 ? -1 : 1);
          return;
        }
      }
    }
    if (nearRow(p.y, NAME_CONFIRM_Y)) nameEntryConfirm();
    return;
  }
  if (menuState === 'gameover'){
    for (let i=0;i<2;i++){
      if (nearRow(p.y, GO_Y[i])){ gameOverSel = i; activateGameOver(i); return; }
    }
  }
});
cvs.addEventListener('pointermove',ev=>{
  if(!pointerDown) return;
  if (menuState !== 'game' || paused) return;
  ev.preventDefault();
  const p = canvasPos(ev);
  aim.x=clamp(p.x,5,W-6);
  let y=p.y;
  if(y>SH-4&&y<BOT+4)y=(y<(SH+BOT)/2)?SH-5:BOT+5;
  aim.y=clamp(y,5,H-6);
});
cvs.addEventListener('pointerup',()=>{pointerDown=false;});
cvs.addEventListener('pointercancel',()=>{pointerDown=false;});
cvs.addEventListener('contextmenu',e=>e.preventDefault());
