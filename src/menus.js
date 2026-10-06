'use strict';
// Menu backdrop and bottom-screen menus
// =====================================================================
//  MENU BACKDROP (top screen scene, bezel, bottom screen panel)
// =====================================================================
const MENU_STARS = [];
for(let i=0;i<60;i++) MENU_STARS.push({x:(i*47)%W, y:(i*89)%SH, b:(i*31)%7});

function menuEnv(){
  if (menuState === 'deploy') return WORLDS[clamp(deploySel, 0, WORLDS.length - 1)];
  if (menuState === 'gameover' || menuState === 'nameentry') return currentEnv;
  return WORLDS[clamp(camp.unlocked - 1, 0, WORLDS.length - 1)];
}

function drawMenuBackdrop(t, env){
  // Top screen scene
  ctx.fillStyle=P.blk; ctx.fillRect(0,0,W,SH);
  for (const s of MENU_STARS){
    if (s.b < 2) continue;
    if (s.b < 4) ctx.fillStyle = P.gry;
    else ctx.fillStyle = (0.5 + 0.5*Math.sin(t*3 + s.b)) > 0.5 ? P.wht : P.gry;
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  if (menuState !== 'loadout'){ const pa = ctx.globalAlpha; ctx.globalAlpha = 0.55; ctx.drawImage(getSunburst(), 0, 0); ctx.globalAlpha = pa; }
  activateSaturn(env);
  if (saturnFrames.length > 0){
    const frame = saturnFrames[Math.floor(t * 2) % SAT_FRAMES];
    if (frame){
      const size = Math.round(SAT_OFF * env.menuPlanet);
      ctx.drawImage(frame, 0, 0, SAT_OFF, SAT_OFF, Math.round(166 - size/2), Math.round(98 - size/2), size, size);
    }
  }
  const bottomY = SH - 36;
  const mn = env.menu;
  ctx.fillStyle = mn.hill;
  for (let x=0;x<W;x++){
    const h = 12 + Math.sin(x*0.07)*4 + Math.sin(x*0.19)*3;
    ctx.fillRect(x, bottomY - h, 1, h);
  }
  ctx.fillStyle = mn.floor; ctx.fillRect(0, bottomY, W, mn.floorH);
  ctx.fillStyle = mn.deep; ctx.fillRect(0, bottomY + mn.floorH, W, SH - bottomY - mn.floorH);
  if (mn.deep2){ ctx.fillStyle = mn.deep2; ctx.fillRect(0, bottomY + mn.floorH + 12, W, SH - bottomY - mn.floorH - 12); }

  if (menuState === 'title' || menuState === 'deploy' || menuState === 'scores' || menuState === 'stats' || menuState === 'options'){ drawSputnik(t); drawAttract(t, env); }

  // Bezel between screens
  ctx.fillStyle=P.blk;ctx.fillRect(0,SH,W,GAP);
  ctx.fillStyle=env.ground0;ctx.fillRect(0,SH,W,3);
  ctx.fillStyle=env.ground1;ctx.fillRect(0,SH+3,W,3);
  ctx.fillStyle=env.ground0;ctx.fillRect(0,BOT-6,W,6);

  // Bottom screen panel
  ctx.fillStyle=P.blk; ctx.fillRect(0,BOT,W,SH);
  for (const s of MENU_STARS){
    if (s.b < 4) continue;
    ctx.fillStyle = (0.5 + 0.5*Math.sin(t*3 + s.b)) > 0.5 ? P.gry : P.dblu;
    ctx.fillRect(s.x, BOT + s.y, 1, 1);
  }

  // Screen outlines
  ctx.fillStyle=env.ground0;
  ctx.fillRect(0,0,W,1);ctx.fillRect(0,SH-1,W,1);
  ctx.fillRect(0,BOT,W,1);ctx.fillRect(0,H-1,W,1);
  ctx.fillRect(0,0,1,SH);ctx.fillRect(W-1,0,1,SH);
  ctx.fillRect(0,BOT,1,SH);ctx.fillRect(W-1,BOT,1,SH);
}

// Top screen text that goes with each menu state
function drawMenuTop(t, env){
  if (menuState === 'loadout'){
    const s = 'LOADOUT PREVIEW';
    drawText(s, Math.round((W - textW(s)) / 2), 6, P.gry);
    return;
  }
  if (menuState === 'gameover'){
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = 0.72; ctx.fillStyle = P.blk; ctx.fillRect(0,0,W,SH);
    ctx.globalAlpha = prevA;
    const title = runVictory ? 'MISSION COMPLETE' : 'GAME OVER';
    const tw = textW2x(title);
    drawText2x(title, Math.round((W-tw)/2), 22, P.blk);
    drawText2x(title, Math.round((W-tw)/2), 20, runVictory ? P.lgrn : P.red);
    const mode = gameMode === 'rush' ? 'BOSS RUSH' : ((gameMode === 'wave' ? 'CAMPAIGN' : 'ENDLESS') + ' ' + currentEnv.name);
    drawText(mode, Math.round((W-textW(mode))/2), 40, P.lblu);
    const scoreStr = 'SCORE ' + String(score).padStart(6,'0');
    drawText2x(scoreStr, Math.round((W-textW2x(scoreStr))/2), 60, P.yel);
    const line = gameMode === 'wave' ? ('WAVE ' + formatWave(wave)) : (gameMode === 'rush' ? ('BOSSES ' + rush.bosses) : ('TIME ' + formatTime(endTime)));
    drawText(line, Math.round((W-textW(line))/2), 86, P.lblu);
    const ch = 'BEST X' + bestCombo;
    drawText(ch, Math.round((W-textW(ch))/2), 98, P.wht);
    const acc = runStats.shots > 0 ? Math.round(runStats.kills / runStats.shots * 100) : 0;
    const ks = 'KILLS ' + runStats.kills + '   ACC ' + acc + '%';
    drawText(ks, Math.round((W-textW(ks))/2), 110, P.lgrn);
    if (runMods.length){
      const ms = 'MODS X' + scoreMul.toFixed(2);
      drawText(ms, Math.round((W-textW(ms))/2), 122, P.yel);
    }
    return;
  }
  if (menuState === 'nameentry'){
    const title = 'HIGH SCORE!';
    const tw = textW2x(title);
    for (let i = 0; i < title.length; i++){
      const c = RAINBOW[(i + Math.floor(t*8)) % 7];
      drawText2x(title[i], Math.round((W-tw)/2) + i*8, 30, c);
    }
    if (pendingScore){
      const sc = 'SCORE ' + String(pendingScore.entry.score).padStart(6,'0');
      drawText(sc, Math.round((W-textW(sc))/2), 56, P.yel);
      const modeStr = pendingScore.mode === 'wave' ? 'CAMPAIGN' : (pendingScore.mode === 'rush' ? 'BOSS RUSH' : 'ENDLESS');
      drawText(modeStr, Math.round((W-textW(modeStr))/2), 68, P.lblu);
    }
    return;
  }
  // Title block: block letters at 3x with a red drop shadow
  const t1 = 'STRELA-10', t2 = 'S.O.S.F';
  drawTextN(t1, 11, 11, P.dred, 3); drawTextN(t1, 9, 9, P.yel, 3);
  drawTextN(t2, 11, 29, P.dred, 3); drawTextN(t2, 9, 27, P.wht, 3);
  ctx.fillStyle = P.rrd; ctx.fillRect(0, 46, 136, 11);
  ctx.fillStyle = P.yel; ctx.fillRect(0, 45, 136, 1); ctx.fillRect(0, 57, 136, 1);
  drawStar(4, 48, P.yel);
  drawText('SOVIET ORBITAL STRIKE FORCE', 16, 49, P.yel);
  drawText(env.name + ' OUTPOST', 9, 62, P.gry);
}

// =====================================================================
//  BOTTOM SCREEN MENUS (drawn with the context translated by BOT)
// =====================================================================
function drawRowBtn(label, y, sel, t, dim){
  if (sel){
    const blink = Math.sin(t*8) > -0.3;
    ctx.fillStyle = P.blk;
    ctx.fillRect(0, y - 3, W, 14);
    ctx.fillStyle = blink ? P.wht : P.yel;
    ctx.fillRect(0, y - 3, W, 1);
    ctx.fillRect(0, y + 10, W, 1);
    const slideAmt = Math.sin(t*4) * 0.5 + 0.5;
    ctx.fillRect(4 + Math.floor(slideAmt * 3), y + 4, 3, 3);
    ctx.fillRect(W - 8 - Math.floor(slideAmt * 3), y + 4, 3, 3);
    const display = '> ' + label + ' <';
    drawText2x(display, Math.round((W-textW2x(display))/2), y, blink ? P.wht : P.yel);
  } else {
    drawText2x(label, Math.round((W-textW2x(label))/2), y, dim ? P.dblu : P.gry);
  }
}

const MENU_BASE = ['CAMPAIGN', 'ENDLESS', 'LOADOUT', 'STATISTICS', 'HIGH SCORES', 'OPTIONS', 'BOSS RUSH'];
function menuItems(){
  const a = [];
  if (saveData) a.push('CONTINUE');
  a.push('CAMPAIGN', 'ENDLESS');
  if (rushUnlocked()) a.push('BOSS RUSH');
  a.push('LOADOUT', 'STATISTICS', 'HIGH SCORES', 'OPTIONS');
  return a;
}
const menuStep = n => n >= 8 ? 20 : (n === 7 ? 22 : 24);
const menuY0 = n => n >= 8 ? 6 : 14;

function menuDetail(label){
  if (label === 'CONTINUE') return 'WAVE ' + formatWave(saveData.wave);
  if (label === 'CAMPAIGN'){ const n = camp.clears.filter(c => c > 0).length; return n + '/5 HELD'; }
  if (label === 'ENDLESS'){ return stats.bestTime > 0 ? formatTime(stats.bestTime).slice(0, 5) : ''; }
  if (label === 'BOSS RUSH'){ return stats.bestRush > 0 ? ('BEST ' + stats.bestRush) : ''; }
  if (label === 'STATISTICS'){ return unlockedAch.length + '/' + ACHIEVEMENTS.length; }
  if (label === 'HIGH SCORES'){ const b = Math.max(stats.bestScoreWave || 0, stats.bestScoreEndless || 0); return b > 0 ? String(b) : ''; }
  return '';
}
function drawTitleMenu(t){
  const items = menuItems(), step = menuStep(items.length), y0 = menuY0(items.length);
  for (let i = 0; i < items.length; i++){
    const y = y0 + i * step;
    const sel = menuSelection === i;
    const label = items[i];
    const det = menuDetail(label);
    if (sel){
      const blink = Math.sin(t * 8) > -0.3;
      ctx.fillStyle = P.blk; ctx.fillRect(0, y - 4, W, 18);
      ctx.fillStyle = P.rrd; ctx.fillRect(0, y - 3, W, 16);
      ctx.fillStyle = blink ? P.yel : P.wht;
      ctx.fillRect(0, y - 4, W, 1); ctx.fillRect(0, y + 13, W, 1);
      drawStar(8 + Math.floor((Math.sin(t * 4) * 0.5 + 0.5) * 2), y + 1, P.yel);
      drawText2x(label, 24, y, P.blk);
      drawText2x(label, 23, y - 1, blink ? P.yel : P.wht);
      if (det) drawText(det, W - 8 - textW(det), y + 3, P.yel);
    } else {
      drawText2x(label, 23, y, P.gry);
      if (det) drawText(det, W - 8 - textW(det), y + 3, P.blu);
    }
  }
  const c1 = 'UP/DOWN  ENTER  ESC';
  drawText(c1, Math.round((W-textW(c1))/2), SH-14, P.gry);
}

// Deploy screen: choose which world to start on (campaign) or play (endless)
let deployMode = 'wave', deploySel = 0;
const DEPLOY_Y0 = 34, DEPLOY_STEP = 25;

function worldStatus(i){
  if (i >= camp.unlocked) return { locked:true, text:'LOCKED', col:P.dblu };
  if (deployMode === 'wave'){
    const c = camp.clears[i];
    return { locked:false, text: c > 0 ? ('CLEARED X' + c) : 'READY', col: c > 0 ? P.lgrn : P.yel };
  }
  const b = camp.endBest[i];
  return { locked:false, text: b > 0 ? ('BEST ' + formatTime(b)) : 'READY', col: b > 0 ? P.lblu : P.yel };
}

function openDeploy(mode){
  deployMode = mode;
  deploySel = clamp(runWorld, 0, camp.unlocked - 1);
  menuState = 'deploy';
  sfx('select');
}

function activateDeploy(i){
  if (i >= camp.unlocked){ sfx('locked'); return; }
  startGame(deployMode, i);
}

function drawDeployScreen(t){
  const title = deployMode === 'wave' ? 'CAMPAIGN' : 'ENDLESS';
  const tw = textW2x(title);
  menuHeader(title);
  const sub = 'SELECT OUTPOST';
  drawText(sub, Math.round((W-textW(sub))/2), 22, P.gry);
  for (let i = 0; i < WORLDS.length; i++){
    const w = WORLDS[i];
    const y = DEPLOY_Y0 + i * DEPLOY_STEP;
    const sel = deploySel === i;
    const st = worldStatus(i);
    if (sel){
      ctx.fillStyle = P.blk;
      ctx.fillRect(0, y - 3, W, 22);
      ctx.fillStyle = Math.sin(t*8) > -0.3 ? P.wht : P.yel;
      ctx.fillRect(0, y - 3, W, 1);
      ctx.fillRect(0, y + 18, W, 1);
    }
    const nameCol = st.locked ? P.dblu : (sel ? P.wht : P.gry);
    drawText2x((i + 1) + ' ' + w.name, 10, y, nameCol);
    drawText(st.text, W - 8 - textW(st.text), y + 2, st.col);
    drawText(st.locked ? 'HOLD THE PREVIOUS OUTPOST' : w.tag, 22, y + 12, st.locked ? P.blu : (sel ? P.lblu : P.blu));
  }
  const hint = 'UP/DOWN  ENTER  ESC';
  drawText(hint, Math.round((W-textW(hint))/2), SH-10, P.gry);
}

function cycleScores(d){
  const modes = rushUnlocked() ? ['wave', 'endless', 'rush'] : ['wave', 'endless'];
  scoresMode = modes[(Math.max(0, modes.indexOf(scoresMode)) + d + modes.length) % modes.length];
  sfx('move');
}
function drawScoresScreen(t){
  const modeName = scoresMode === 'wave' ? 'CAMPAIGN' : (scoresMode === 'rush' ? 'BOSS RUSH' : 'ENDLESS');
  const name = scoresMode === 'rush' ? 'ALL BOSSES' : 'ALL MOONS';
  const titleW = textW2x(modeName);
  menuHeader(modeName);
  const nameW = textW2x(name);
  drawText2x(name, Math.round((W-nameW)/2), 26, P.lblu);
  drawText('< LEFT/RIGHT >', Math.round((W-textW('< LEFT/RIGHT >'))/2), 42, P.gry);

  const scores = loadScores(scoresMode);

  if (scores.length === 0){
    const msg = 'NO SCORES YET';
    drawText2x(msg, Math.round((W-textW2x(msg))/2), 90, P.gry);
    const msg2 = 'PLAY A GAME TO RECORD';
    drawText(msg2, Math.round((W-textW(msg2))/2), 110, P.dblu);
  } else {
    drawText('RK', 6, 58, P.gry);
    drawText('NAME', 22, 58, P.gry);
    drawText('SCORE', 60, 58, P.gry);
    drawText('CHAIN', 108, 58, P.gry);
    drawText(scoresMode === 'wave' ? 'WAVE' : (scoresMode === 'rush' ? 'BOSS' : 'TIME'), 148, 58, P.gry);
    drawText('ACC', 180, 58, P.gry);
    ctx.fillStyle = P.dblu;
    ctx.fillRect(4, 64, W - 8, 1);

    for (let i=0;i<scores.length && i<6;i++){
      const s = scores[i];
      const y = 68 + i * 11;
      const rowCol = i===0 ? P.yel : (i===1 ? P.wht : P.gry);
      drawText((i+1) + '.', 6, y, rowCol);
      drawText((s.name || '---') + (s.mods && s.mods.length ? '*' : ''), 22, y, rowCol);
      drawText(String(s.score).padStart(6,'0'), 60, y, rowCol);
      drawText('X'+String(s.combo||0).padStart(2,'0'), 108, y, P.mag);
      drawText(scoreTail(scoresMode, s), 148, y, P.lblu);
      const acc = Math.round((s.accuracy||0) * 100);
      drawText(acc + '%', 180, y, acc >= 50 ? P.lgrn : P.gry);
    }
  }

  if (Math.sin(t*4) > -0.3){
    const back = 'ESC OR ENTER TO RETURN';
    drawText(back, Math.round((W-textW(back))/2), SH-14, P.yel);
  }
}

function drawStatsScreen(t){
  const title = statsPage === 0 ? 'STATISTICS' : 'ACHIEVEMENTS';
  const tw = textW2x(title);
  menuHeader(title);
  const nav = '< LEFT / RIGHT >  ' + (statsPage + 1) + '/4';
  drawText(nav, Math.round((W-textW(nav))/2), 22, P.gry);

  if (statsPage === 0) drawStatsPage(); else drawAchievementsPage(statsPage - 1);

  const back = 'ESC OR ENTER TO RETURN';
  drawText(back, Math.round((W-textW(back))/2), SH-10, P.yel);
}

function statLine(label, value, y, valueCol){
  drawText(label, 8, y, P.gry);
  drawText(value, W - 8 - textW(value), y, valueCol || P.wht);
}

function drawStatsPage(){
  const y0 = 32;
  const gap = 9;
  const acc = stats.totalShots > 0 ? Math.round(stats.totalKills / stats.totalShots * 100) : 0;
  const secs = Math.floor(stats.totalPlaytime);
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);

  statLine('GAMES PLAYED',    String(stats.gamesPlayed),      y0 + gap*0,  P.wht);
  statLine('CAMP / ENDLESS',  stats.gamesWave + '/' + stats.gamesEndless, y0 + gap*1, P.lblu);
  statLine('TOTAL KILLS',     String(stats.totalKills),       y0 + gap*2,  P.lgrn);
  statLine('TOTAL SHOTS',     String(stats.totalShots),       y0 + gap*3,  P.gry);
  statLine('ACCURACY',        acc + '%',                      y0 + gap*4,  acc >= 50 ? P.lgrn : P.org);
  statLine('BEST CHAIN',      'X' + stats.bestChain,          y0 + gap*5,  P.mag);
  statLine('BEST WAVE',       formatWave(stats.bestWave),     y0 + gap*6,  P.lblu);
  statLine('BEST TIME',       formatTime(stats.bestTime),     y0 + gap*7,  P.lblu);
  statLine('HI SCORE CAMP',   String(stats.bestScoreWave),    y0 + gap*8,  P.yel);
  statLine('HI SCORE ENDLESS',String(stats.bestScoreEndless), y0 + gap*9,  P.yel);
  statLine('PERFECT WAVES',   String(stats.perfectWaves),     y0 + gap*10, P.lgrn);
  statLine('CITIES LOST',     String(stats.citiesLost),       y0 + gap*11, P.red);
  statLine('BOSSES DOWN',     String(stats.bossKills),        y0 + gap*12, P.mag);
  statLine('ORBITALS',        String(stats.cratesCollected),  y0 + gap*13, P.lblu);
  statLine('PLAYTIME',        hh + 'H ' + mm + 'M',           y0 + gap*14, P.gry);
}

const ACH_PER_PAGE = 14;
function drawAchievementsPage(page){
  const ids = ACHIEVEMENTS.map(a => a.id);
  const unlocked = unlockedAch.filter(id => ids.includes(id)).length;
  const total = ACHIEVEMENTS.length;
  const header = unlocked + ' / ' + total + ' UNLOCKED';
  drawText(header, Math.round((W-textW(header))/2), 31, unlocked === total ? P.yel : P.lblu);

  const barW = W - 40;
  const bx = 20;
  const by = 39;
  ctx.fillStyle = P.dblu;
  ctx.fillRect(bx, by, barW, 2);
  ctx.fillStyle = P.yel;
  ctx.fillRect(bx, by, Math.round(barW * unlocked / total), 2);

  const startY = 47;
  const rowH = 17;
  const colW = W / 2;
  const first = page * ACH_PER_PAGE;

  for (let k = 0; k < ACH_PER_PAGE; k++){
    const i = first + k;
    if (i >= total) break;
    const a = ACHIEVEMENTS[i];
    const col = k % 2;
    const row = Math.floor(k / 2);
    const x = col * colW + 4;
    const y = startY + row * rowH;
    const isUnlocked = unlockedAch.includes(a.id);

    ctx.fillStyle = isUnlocked ? P.yel : P.dblu;
    ctx.fillRect(x, y + 1, 3, 3);
    if (isUnlocked){
      ctx.fillStyle = P.wht;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
    drawText(a.name, x + 6, y, isUnlocked ? P.wht : P.gry);
    drawText(a.desc, x + 6, y + 6, isUnlocked ? P.lgrn : P.blu);
    if (a.reward){
      ctx.fillStyle = isUnlocked ? P.lgrn : P.dblu;
      ctx.fillRect(x + colW - 14, y + 1, 4, 4);
    }
  }
}

function drawOptionsScreen(t){
  const title = 'OPTIONS';
  const tw = textW2x(title);
  menuHeader(title);

  for (let i = 0; i < 4; i++){
    const nameStr = optionName(i);
    const valStr = optionLabel(i);
    const y = 40 + i * 24;
    const selected = (optionsSelection === i);
    const rowCol = selected ? P.yel : P.gry;
    const valCol = selected ? P.wht : (opts.muted && i === 0 ? P.red : P.lblu);

    if (selected){
      ctx.fillStyle = P.blk;
      ctx.fillRect(0, y - 3, W, 14);
      ctx.fillStyle = P.yel;
      ctx.fillRect(0, y - 3, W, 1);
      ctx.fillRect(0, y + 10, W, 1);
      if (Math.sin(t*8) > -0.3) drawText('>', 4, y, P.wht);
    }

    drawText(nameStr, 12, y, rowCol);
    drawText(valStr, W - 8 - textW(valStr), y, valCol);

    if (selected && (i === 2 || i === 3)){
      const warn = optionsConfirm === i ? 'PRESS ENTER AGAIN' : 'IRREVERSIBLE';
      const warnCol = optionsConfirm === i ? P.red : P.dorg;
      drawText(warn, Math.round((W-textW(warn))/2), y + 13, warnCol);
    }
  }

  const backY = 40 + 4 * 24;
  const backSel = (optionsSelection === 4);
  if (backSel){
    ctx.fillStyle = P.blk;
    ctx.fillRect(0, backY - 3, W, 14);
    ctx.fillStyle = P.yel;
    ctx.fillRect(0, backY - 3, W, 1);
    ctx.fillRect(0, backY + 10, W, 1);
    if (Math.sin(t*8) > -0.3) drawText('>', 4, backY, P.wht);
  }
  drawText('BACK', 12, backY, backSel ? P.yel : P.gry);

  const hint = 'UP/DOWN  ENTER  ESC';
  drawText(hint, Math.round((W-textW(hint))/2), SH-10, P.gry);
}

// Name entry controls
const NAME_SLOT_W = 20, NAME_SLOT_GAP = 6, NAME_SLOT_Y = 44, NAME_SLOT_H = 22;
const NAME_CONFIRM_Y = 140;
const nameSlotX = i => Math.round((W - (NAME_SLOT_W*3 + NAME_SLOT_GAP*2)) / 2) + i * (NAME_SLOT_W + NAME_SLOT_GAP);

function drawNameEntryBottom(t){
  const head = 'ENTER YOUR INITIALS';
  drawText(head, Math.round((W-textW(head))/2), 16, P.gry);

  for (let i = 0; i < 3; i++){
    const x = nameSlotX(i);
    const active = (nameEntry.cursor === i);
    ctx.fillStyle = P.blk;
    ctx.fillRect(x, NAME_SLOT_Y, NAME_SLOT_W, NAME_SLOT_H);
    ctx.fillStyle = active ? (Math.sin(t*10) > 0 ? P.wht : P.yel) : P.dblu;
    ctx.fillRect(x, NAME_SLOT_Y, NAME_SLOT_W, 1);
    ctx.fillRect(x, NAME_SLOT_Y + NAME_SLOT_H - 1, NAME_SLOT_W, 1);
    ctx.fillRect(x, NAME_SLOT_Y, 1, NAME_SLOT_H);
    ctx.fillRect(x + NAME_SLOT_W - 1, NAME_SLOT_Y, 1, NAME_SLOT_H);
    const ch = nameEntry.letters[i];
    drawText2x(ch, x + Math.round((NAME_SLOT_W - 6)/2), NAME_SLOT_Y + 6, active ? P.wht : P.gry);
    if (active){
      drawText('^', x + NAME_SLOT_W/2 - 1, NAME_SLOT_Y - 8, P.yel);
      drawText('v', x + NAME_SLOT_W/2 - 1, NAME_SLOT_Y + NAME_SLOT_H + 4, P.yel);
    }
  }

  const l1 = 'UP/DOWN  LETTER';
  const l2 = 'LEFT/RIGHT  SLOT';
  drawText(l1, Math.round((W-textW(l1))/2), 100, P.gry);
  drawText(l2, Math.round((W-textW(l2))/2), 110, P.gry);

  drawRowBtn('CONFIRM', NAME_CONFIRM_Y, nameLock <= 0, t, nameLock > 0);
}

// Game over buttons
const GO_Y = [96, 122];
const GO_LABELS = ['RETRY', 'MENU'];

function scoreTail(mode, s){
  if (mode === 'wave') return formatWave(s.wave || 0);
  if (mode === 'rush') return 'B' + (s.wave || 0);
  return formatTime(s.time || 0).slice(0, 5);
}
function drawGameOverBottom(t){
  drawText('HIGH SCORES', Math.round((W-textW('HIGH SCORES'))/2), 8, P.gry);
  const scores = loadScores(gameMode);
  for (let i=0;i<scores.length && i<5;i++){
    const s = scores[i];
    const y = 20 + i * 10;
    const line = (i+1) + '. ' + (s.name||'---') + '  ' + String(s.score).padStart(6,'0') + '  ' +
      scoreTail(gameMode, s);
    drawText(line, Math.round((W-textW(line))/2), y, i===0 ? P.yel : P.gry);
  }
  const ready = gameOverTimer <= 0;
  for (let i=0;i<2;i++){
    drawRowBtn(GO_LABELS[i], GO_Y[i], ready && gameOverSel === i, t, !ready);
  }
  if (ready){
    const hint = 'UP/DOWN  ENTER  ESC MENU';
    drawText(hint, Math.round((W-textW(hint))/2), SH-14, P.gry);
  }
}
