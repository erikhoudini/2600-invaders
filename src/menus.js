'use strict';
// Menu backdrop and bottom-screen menus
// =====================================================================
//  MENU BACKDROP (top screen scene, bezel, bottom screen panel)
// =====================================================================
const MENU_STARS = [];
for(let i=0;i<60;i++) MENU_STARS.push({x:(i*47)%W, y:(i*89)%SH, b:(i*31)%7});

const menuMountainCache = {};
function menuMountains(env){
  let c = menuMountainCache[env.id];
  if (!c){
    c = document.createElement('canvas'); c.width = W; c.height = 30;
    drawMountains(c.getContext('2d'), env, 22);          // near range ends at y=28, on the floor line
    menuMountainCache[env.id] = c;
  }
  return c;
}
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
    const frame = saturnFrames[Math.floor(t * 1.5) % SAT_FRAMES];
    if (frame){
      const size = Math.round(SAT_OFF * env.menuPlanet);
      ctx.drawImage(frame, 0, 0, SAT_OFF, SAT_OFF, Math.round(166 - size/2), Math.round(98 - size/2), size, size);
    }
  }
  const bottomY = SH - 36;
  const mn = env.menu;
  ctx.drawImage(menuMountains(env), 0, bottomY - 28);
  ctx.fillStyle = mn.floor; ctx.fillRect(0, bottomY, W, mn.floorH);
  ctx.fillStyle = mn.deep; ctx.fillRect(0, bottomY + mn.floorH, W, SH - bottomY - mn.floorH);
  if (mn.deep2){ ctx.fillStyle = mn.deep2; ctx.fillRect(0, bottomY + mn.floorH + 12, W, SH - bottomY - mn.floorH - 12); }

  if (menuState === 'title' || menuState === 'deploy' || menuState === 'scores' || menuState === 'stats' || menuState === 'options'){ drawSputnik(t); drawAttract(t, env); }

  // Bezel between screens
  ctx.fillStyle=P.blk;ctx.fillRect(0,SH,W,GAP);
  ctx.fillStyle=env.ground0;ctx.fillRect(0,BOT-6,W,6);

  // Bottom screen (touch screen) background
  uiBackground(t, env);

  // Screen outlines
  ctx.fillStyle=env.ground0;
  ctx.fillRect(0,BOT,W,1);ctx.fillRect(0,H-1,W,1);
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
    const qs = runVictory ? WIN_LINES[score % WIN_LINES.length] : LOSS_LINES[score % LOSS_LINES.length];
    drawText(qs, Math.round((W-textW(qs))/2), 32, runVictory ? P.yel : P.pnk);
    drawStar(Math.round(W/2) - 50, 21, P.rrd); drawStar(Math.round(W/2) + 43, 21, P.rrd);
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
  if (DEV_UNLOCK_ALL) drawText('DEV BUILD - ALL UNLOCKED', 9, 71, P.org);
}

// =====================================================================
//  BOTTOM SCREEN MENUS (drawn with the context translated by BOT)
//  Every screen is built from the DS UI kit in ui.js: bevelled touch buttons, a header, a footer
//  with the button legend, and hit regions registered as they are drawn.
// =====================================================================
const MENU_BASE = ['CAMPAIGN', 'ENDLESS', 'LOADOUT', 'STATISTICS', 'HIGH SCORES', 'OPTIONS', 'BOSS RUSH', 'GALLERY'];
function menuItems(){
  const a = [];
  if (saveData) a.push('CONTINUE');
  a.push('CAMPAIGN', 'ENDLESS');
  if (rushUnlocked()) a.push('BOSS RUSH');
  a.push('LOADOUT', 'GALLERY', 'STATISTICS', 'HIGH SCORES', 'OPTIONS');
  return a;
}
function menuDetail(label){
  if (label === 'CONTINUE') return 'WAVE ' + formatWave(saveData.wave);
  if (label === 'CAMPAIGN'){ const n = camp.clears.filter(c => c > 0).length; return n + '/5 HELD'; }
  if (label === 'ENDLESS'){ return stats.bestTime > 0 ? formatTime(stats.bestTime).slice(0, 5) : ''; }
  if (label === 'BOSS RUSH'){ return stats.bestRush > 0 ? ('BEST ' + stats.bestRush) : ''; }
  if (label === 'GALLERY'){ return POSTERS.filter((_, i) => posterOwned(i)).length + '/' + POSTERS.length; }
  if (label === 'STATISTICS'){ return unlockedAch.length + '/' + ACHIEVEMENTS.length; }
  if (label === 'HIGH SCORES'){ const b = Math.max(stats.bestScoreWave || 0, stats.bestScoreEndless || 0); return b > 0 ? String(b) : ''; }
  return '';
}
function drawTitleMenu(t){
  const items = menuItems(), n = items.length;
  const step = Math.min(24, Math.floor(158 / n)), h = step - 3;
  const y0 = 8 + Math.floor((158 - n * step) / 2);
  for (let i = 0; i < n; i++){
    const label = items[i], sel = menuSelection === i;
    uiButton(6, y0 + i * step, W - 12, h, label, {
      sel, scale: 2, icon: MENU_ICONS[label], detail: menuDetail(label),
      slide: uiAnim('m' + i, sel ? 1 : 0),
      fn: () => { menuSelection = i; activateTitleItem(i); },
    });
  }
  uiFooter([['DPAD', 'MOVE'], ['A', 'SELECT']]);
}

// Deploy screen: choose which world to start on (campaign) or play (endless)
let deployMode = 'wave', deploySel = 0;
const DEPLOY_Y0 = 33, DEPLOY_STEP = 28;

function worldStatus(i){
  if (i >= camp.unlocked) return { locked:true, text:'LOCKED', col:P.blu };
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
  uiHeader(deployMode === 'wave' ? 'CAMPAIGN' : 'ENDLESS');
  const sub = 'SELECT AN OUTPOST';
  drawText(sub, Math.round((W - textW(sub)) / 2), 25, P.gry);
  for (let i = 0; i < WORLDS.length; i++){
    const w = WORLDS[i];
    const y = DEPLOY_Y0 + i * DEPLOY_STEP, h = 25;
    const sel = deploySel === i;
    const st = worldStatus(i);
    const c = st.locked ? UI_LOCKED : (sel ? UI_SELECT : UI_NORMAL);
    const x = 6 + Math.round(uiAnim('d' + i, sel ? 1 : 0) * 3);
    uiPlate(x, y, W - 12, h, c[0], c[1], c[2], c[3]);
    uiHit(6, y, W - 12, h, () => { if (deploySel === i) activateDeploy(i); else { deploySel = i; sfx('move'); } });
    uiWorldThumb(w, x + 5, y + 4, 36, 17, st.locked);
    drawTextS((i + 1) + ' ' + w.name, x + 49, y + 5, P.blk, undefined, 2);
    drawTextS((i + 1) + ' ' + w.name, x + 48, y + 4, st.locked ? P.blu : (sel ? P.yel : P.wht), undefined, 2);
    drawText(st.locked ? 'HOLD THE PREVIOUS OUTPOST' : w.tag, x + 48, y + 16, st.locked ? P.blu : (sel ? P.wht : P.lblu));
    if (st.locked) uiIcon('lock', W - 24, y + 9, P.blu);
    else {
      if (deployMode === 'wave' && camp.clears[i] > 0) uiIcon('star', W - 24, y + 4, P.yel);
      drawText(st.text, W - 12 - textW(st.text), y + (deployMode === 'wave' && camp.clears[i] > 0 ? 14 : 10), st.col);
    }
  }
  uiFooter([['DPAD', 'MOVE'], ['A', 'DEPLOY']], () => goToTitle(deployMode === 'wave' ? 0 : 1));
}

function cycleScores(d){
  const modes = rushUnlocked() ? ['wave', 'endless', 'rush'] : ['wave', 'endless'];
  scoresMode = modes[(Math.max(0, modes.indexOf(scoresMode)) + d + modes.length) % modes.length];
  sfx('move');
}
function drawScoresScreen(t){
  const modes = rushUnlocked() ? ['wave', 'endless', 'rush'] : ['wave', 'endless'];
  uiHeader('HIGH SCORES', { shoulders: [() => cycleScores(-1), () => cycleScores(1)] });
  const modeName = scoresMode === 'wave' ? 'CAMPAIGN' : (scoresMode === 'rush' ? 'BOSS RUSH' : 'ENDLESS');
  const name = scoresMode === 'rush' ? 'ALL BOSSES' : 'ALL MOONS';
  uiMini(5, 24, 22, 17, 'left', () => cycleScores(-1));
  uiMini(W - 27, 24, 22, 17, 'right', () => cycleScores(1));
  drawTextS(modeName, Math.round((W - textW2x(modeName)) / 2) + 1, 26, P.blk, undefined, 2);
  drawText2x(modeName, Math.round((W - textW2x(modeName)) / 2), 25, P.yel);
  drawText(name, Math.round((W - textW(name)) / 2), 36, P.lblu);
  uiDots(modes.length, Math.max(0, modes.indexOf(scoresMode)), 45);

  const scores = loadScores(scoresMode);
  if (scores.length === 0){
    uiPlate(28, 70, W - 56, 52, P.blk, null, null, P.dblu);
    const msg = 'NO SCORES YET';
    drawText2x(msg, Math.round((W - textW2x(msg)) / 2), 82, P.gry);
    const msg2 = 'PLAY A GAME TO RECORD ONE';
    drawText(msg2, Math.round((W - textW(msg2)) / 2), 102, P.blu);
  } else {
    ctx.fillStyle = P.dblu; ctx.fillRect(4, 54, W - 8, 10);
    ctx.fillStyle = P.blu; ctx.fillRect(4, 54, W - 8, 1);
    const hy = 57;
    drawText('RK', 8, hy, P.lblu); drawText('NAME', 24, hy, P.lblu); drawText('SCORE', 58, hy, P.lblu);
    drawText('CHAIN', 106, hy, P.lblu);
    drawText(scoresMode === 'wave' ? 'WAVE' : (scoresMode === 'rush' ? 'BOSS' : 'TIME'), 148, hy, P.lblu);
    drawText('ACC', 184, hy, P.lblu);
    for (let i = 0; i < scores.length && i < 8; i++){
      const s = scores[i];
      const y = 66 + i * 13;
      if (i % 2 === 0){ ctx.fillStyle = P.dblu; const pa = ctx.globalAlpha; ctx.globalAlpha = pa * 0.35; ctx.fillRect(4, y - 2, W - 8, 12); ctx.globalAlpha = pa; }
      const rowCol = i === 0 ? P.yel : (i === 1 ? P.wht : (i === 2 ? P.tan : P.gry));
      if (i < 3) uiIcon('star', 7, y - 1, [P.yel, P.gry, P.org][i]); else drawText(String(i + 1), 10, y + 1, rowCol);
      drawText((s.name || '---') + (s.mods && s.mods.length ? '*' : ''), 24, y + 1, rowCol);
      drawText(String(s.score).padStart(6, '0'), 58, y + 1, rowCol);
      drawText('X' + String(s.combo || 0).padStart(2, '0'), 106, y + 1, P.mag);
      drawText(scoreTail(scoresMode, s), 148, y + 1, P.lblu);
      const acc = Math.round((s.accuracy || 0) * 100);
      drawText(acc + '%', 184, y + 1, acc >= 50 ? P.lgrn : P.gry);
    }
  }
  uiFooter([['L', 'MODE'], ['R', 'MODE']], () => goToTitle());
}

function drawStatsScreen(t){
  const prev = () => { statsPage = (statsPage + STATS_PAGES - 1) % STATS_PAGES; sfx('move'); };
  const next = () => { statsPage = (statsPage + 1) % STATS_PAGES; sfx('move'); };
  uiHeader(statsPage === 0 ? 'STATISTICS' : 'ACHIEVEMENTS', { shoulders: [prev, next] });
  uiDots(STATS_PAGES, statsPage, 25);
  if (statsPage === 0) drawStatsPage(); else drawAchievementsPage(statsPage - 1);
  uiFooter([['L', 'PAGE'], ['R', 'PAGE']], () => goToTitle());
}

function statLine(label, value, y, valueCol, zebra){
  if (zebra){ const pa = ctx.globalAlpha; ctx.globalAlpha = pa * 0.35; ctx.fillStyle = P.dblu; ctx.fillRect(4, y - 2, W - 8, 9); ctx.globalAlpha = pa; }
  drawText(label, 8, y, P.gry);
  drawText(value, W - 8 - textW(value), y, valueCol || P.wht);
}

function drawStatsPage(){
  const y0 = 34;
  const gap = 9;
  const acc = stats.totalShots > 0 ? Math.round(stats.totalKills / stats.totalShots * 100) : 0;
  const secs = Math.floor(stats.totalPlaytime);
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const rows = [
    ['GAMES PLAYED',    String(stats.gamesPlayed),      P.wht],
    ['CAMP / ENDLESS',  stats.gamesWave + '/' + stats.gamesEndless, P.lblu],
    ['TOTAL KILLS',     String(stats.totalKills),       P.lgrn],
    ['TOTAL SHOTS',     String(stats.totalShots),       P.gry],
    ['ACCURACY',        acc + '%',                      acc >= 50 ? P.lgrn : P.org],
    ['BEST CHAIN',      'X' + stats.bestChain,          P.mag],
    ['BEST WAVE',       formatWave(stats.bestWave),     P.lblu],
    ['BEST TIME',       formatTime(stats.bestTime),     P.lblu],
    ['HI SCORE CAMP',   String(stats.bestScoreWave),    P.yel],
    ['HI SCORE ENDLESS',String(stats.bestScoreEndless), P.yel],
    ['PERFECT WAVES',   String(stats.perfectWaves),     P.lgrn],
    ['CITIES LOST',     String(stats.citiesLost),       P.red],
    ['BOSSES DOWN',     String(stats.bossKills),        P.mag],
    ['POWERUPS',        String(stats.cratesCollected),  P.lblu],
    ['PLAYTIME',        hh + 'H ' + mm + 'M',           P.gry],
  ];
  for (let i = 0; i < rows.length; i++) statLine(rows[i][0], rows[i][1], y0 + i * gap, rows[i][2], i % 2 === 0);
}

const ACH_PER_PAGE = 14;
const STATS_PAGES = 1 + Math.ceil(ACHIEVEMENTS.length / ACH_PER_PAGE);   // one stats page, then the achievements
function drawAchievementsPage(page){
  const ids = ACHIEVEMENTS.map(a => a.id);
  const unlocked = unlockedAch.filter(id => ids.includes(id)).length;
  const total = ACHIEVEMENTS.length;
  const header = unlocked + ' / ' + total + ' UNLOCKED';
  drawText(header, Math.round((W - textW(header)) / 2), 33, unlocked === total ? P.yel : P.lblu);
  const barW = W - 40, bx = 20, by = 41;
  ctx.fillStyle = P.blk; ctx.fillRect(bx - 1, by - 1, barW + 2, 4);
  ctx.fillStyle = P.dblu; ctx.fillRect(bx, by, barW, 2);
  ctx.fillStyle = P.yel; ctx.fillRect(bx, by, Math.round(barW * unlocked / total), 2);

  const startY = 47, rowH = 18, colW = W / 2;
  const first = page * ACH_PER_PAGE;
  for (let k = 0; k < ACH_PER_PAGE; k++){
    const i = first + k;
    if (i >= total) break;
    const a = ACHIEVEMENTS[i];
    const x = (k % 2) * colW + 4, y = startY + Math.floor(k / 2) * rowH;
    const got = unlockedAch.includes(a.id);
    uiPlate(x, y, colW - 8, rowH - 2, got ? P.dgrn : P.blk, got ? P.grn : null, got ? P.blk : null, got ? P.grn : P.dblu);
    uiIcon(got ? 'check' : 'lock', x + 4, y + 4, got ? P.lgrn : P.blu);
    drawText(a.name, x + 14, y + 3, got ? P.wht : P.gry);
    drawText(a.desc, x + 14, y + 9, got ? P.lgrn : P.blu);
    if (a.reward) uiIcon('star', x + colW - 19, y + 2, got ? P.yel : P.dblu);
  }
}

const OPTION_DESCS = ['EFFECTS AND MUSIC', 'SCREEN KICK AND PHONE BUZZ', 'HINTS ABOUT NEW THINGS', 'MOVES EVERY WAVE UP OR DOWN', 'ERASES ALL HIGH SCORES', 'ERASES UNLOCKS AND CAMPAIGN'];
function drawOptionsScreen(t){
  uiHeader('OPTIONS');
  const RH = 20, PITCH = 22;
  for (let i = 0; i < 6; i++){
    const y = 25 + i * PITCH, sel = optionsSelection === i;
    const c = sel ? UI_SELECT : UI_NORMAL;
    const x = 6 + Math.round(uiAnim('o' + i, sel ? 1 : 0) * 3);
    uiPlate(x, y, W - 12, RH, c[0], c[1], c[2], c[3]);
    uiHit(6, y, W - 12, RH, () => { optionsSelection = i; activateOption(i); });
    drawText2x(optionName(i), x + 9, y + 3, P.blk);
    drawText2x(optionName(i), x + 8, y + 2, sel ? P.yel : P.wht);
    const confirming = optionsConfirm === i && (i === 4 || i === 5);
    drawText(confirming ? 'TAP AGAIN TO CONFIRM' : OPTION_DESCS[i], x + 8, y + 13, confirming ? P.yel : (sel ? P.wht : P.lblu));
    if (i === 0){
      uiSwitch(W - 36, y + 8, !opts.muted); drawText('FX', W - 29, y + 2, sel ? P.wht : P.lblu);
      uiSwitch(W - 76, y + 8, opts.music !== false && !opts.muted); drawText('MUSIC', W - 77, y + 2, sel ? P.wht : P.lblu);
      uiHit(W - 80, y, 36, RH, () => { opts.music = !(opts.music !== false); saveOpts(); sfx('toggle'); optionsSelection = 0; });
    }
    else if (i === 1) uiSwitch(W - 36, y + 5, opts.shake);
    else if (i === 2) uiSwitch(W - 36, y + 5, opts.tips);
    else if (i === 3){                                    // three segments: easy, normal, hard
      for (let k = 0; k < 3; k++){
        const on = opts.difficulty === k, bx = W - 74 + k * 22;
        uiPlate(bx, y + 3, 21, 13, on ? [P.dgrn, P.rrd, P.red][k] : P.blk, null, null, on ? P.yel : P.dblu);
        drawText(['E', 'N', 'H'][k], bx + 9, y + 7, on ? P.wht : P.blu);
        uiHit(bx, y + 3, 21, 13, () => { opts.difficulty = k; saveOpts(); sfx('toggle'); optionsSelection = 3; });
      }
    } else {
      uiPlate(W - 46, y + 3, 36, 13, confirming ? P.rrd : P.dred, confirming ? P.pnk : P.red, P.blk, P.blk);
      drawText(confirming ? 'SURE?' : 'CLEAR', W - 46 + Math.round((36 - textW(confirming ? 'SURE?' : 'CLEAR')) / 2), y + 7, P.wht);
    }
  }
  const backSel = optionsSelection === 6;
  uiButton(W / 2 - 50, 158, 100, 16, 'BACK', { sel: backSel, scale: 2, align: 'center', icon: 'left', fn: () => { optionsSelection = 6; activateOption(6); } });
  uiFooter([['DPAD', 'MOVE'], ['A', 'CHANGE']], leaveOptions);
}

// Name entry: initials slots, an on-screen keyboard and a confirm button
const NAME_SLOT_W = 24, NAME_SLOT_GAP = 6, NAME_SLOT_Y = 26, NAME_SLOT_H = 22;
const NAME_KEYS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789 '];
const NAME_KEY_W = 22, NAME_KEY_H = 14, NAME_KEY_X0 = 8, NAME_KEY_Y0 = 56, NAME_KEY_STEP = 17;
const NAME_CONFIRM_Y = 130;
const nameSlotX = i => Math.round((W - (NAME_SLOT_W * 3 + NAME_SLOT_GAP * 2)) / 2) + i * (NAME_SLOT_W + NAME_SLOT_GAP);
function nameTypeKey(ch){
  nameEntry.letters[nameEntry.cursor] = ch;
  if (nameEntry.cursor < 2) nameEntry.cursor++;
  sfx('tick');
}
function nameDelete(){
  if (nameEntry.letters[nameEntry.cursor] === ' ' && nameEntry.cursor > 0) nameEntry.cursor--;
  nameEntry.letters[nameEntry.cursor] = ' ';
  sfx('back');
}
function drawNameEntryBottom(t){
  uiHeader('INITIALS');
  for (let i = 0; i < 3; i++){
    const x = nameSlotX(i), active = nameEntry.cursor === i;
    uiPlate(x, NAME_SLOT_Y, NAME_SLOT_W, NAME_SLOT_H, P.blk, null, null, active ? (Math.sin(t * 10) > 0 ? P.wht : P.yel) : P.dblu);
    const ch = nameEntry.letters[i];
    drawTextS(ch, x + 9, NAME_SLOT_Y + 7, P.dblu, undefined, 2);
    drawText2x(ch, x + 8, NAME_SLOT_Y + 6, active ? P.yel : P.wht);
    uiHit(x, NAME_SLOT_Y, NAME_SLOT_W, NAME_SLOT_H, () => { nameEntry.cursor = i; sfx('move'); });
  }
  const cur = nameEntry.letters[nameEntry.cursor];
  for (let r = 0; r < NAME_KEYS.length; r++){
    const row = NAME_KEYS[r];
    for (let c = 0; c < row.length; c++){
      const ch = row[c], x = NAME_KEY_X0 + c * (NAME_KEY_W + 2), y = NAME_KEY_Y0 + r * NAME_KEY_STEP;
      const on = ch === cur;
      uiButton(x, y, NAME_KEY_W, NAME_KEY_H, ch === ' ' ? 'SPC' : ch, { sel: on, align: 'center', fn: () => nameTypeKey(ch) });
    }
  }
  const dx = NAME_KEY_X0 + 7 * (NAME_KEY_W + 2), dy = NAME_KEY_Y0 + 3 * NAME_KEY_STEP;
  uiButton(dx, dy, NAME_KEY_W * 2 + 2, NAME_KEY_H, 'DEL', { align: 'center', fn: nameDelete });
  const ready = nameLock <= 0;
  uiButton(W / 2 - 60, NAME_CONFIRM_Y, 120, 24, 'CONFIRM', { sel: ready, dim: !ready, scale: 2, align: 'center', icon: 'check', fn: () => nameEntryConfirm() });
  uiFooter([['TOUCH', 'TYPE'], ['DPAD', 'EDIT'], ['A', 'OK']]);
}

// Game over buttons
const GO_Y = [102, 130];
const GO_LABELS = ['RETRY', 'MENU'];

function scoreTail(mode, s){
  if (mode === 'wave') return formatWave(s.wave || 0);
  if (mode === 'rush') return 'B' + (s.wave || 0);
  return formatTime(s.time || 0).slice(0, 5);
}
function drawGameOverBottom(t){
  uiHeader('HIGH SCORES');
  const scores = loadScores(gameMode);
  for (let i = 0; i < scores.length && i < 5; i++){
    const s = scores[i], y = 27 + i * 12;
    if (i % 2 === 0){ const pa = ctx.globalAlpha; ctx.globalAlpha = pa * 0.35; ctx.fillStyle = P.dblu; ctx.fillRect(14, y - 2, W - 28, 11); ctx.globalAlpha = pa; }
    const col = i === 0 ? P.yel : (i === 1 ? P.wht : P.gry);
    if (i < 3) uiIcon('star', 18, y - 1, [P.yel, P.gry, P.org][i]); else drawText(String(i + 1), 21, y + 1, col);
    drawText((s.name || '---'), 34, y + 1, col);
    drawText(String(s.score).padStart(6, '0'), 70, y + 1, col);
    drawText(scoreTail(gameMode, s), W - 18 - textW(scoreTail(gameMode, s)), y + 1, P.lblu);
  }
  if (!scores.length) drawText('NO SCORES YET', Math.round((W - textW('NO SCORES YET')) / 2), 48, P.gry);
  const ready = gameOverTimer <= 0;
  const icons = ['play', 'left'];
  for (let i = 0; i < 2; i++){
    uiButton(24, GO_Y[i], W - 48, 24, GO_LABELS[i], { sel: ready && gameOverSel === i, dim: !ready, scale: 2, icon: icons[i], align: 'center', slide: uiAnim('g' + i, ready && gameOverSel === i ? 1 : 0), fn: () => { gameOverSel = i; activateGameOver(i); } });
  }
  if (ready) uiFooter([['DPAD', 'MOVE'], ['A', 'SELECT']], () => goToTitle(0));
}
