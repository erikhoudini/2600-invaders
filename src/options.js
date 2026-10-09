'use strict';
// Options
// =====================================================================
//  OPTIONS
// =====================================================================
function cycleOption(idx, dir){
  if (idx === 0){ opts.muted = !opts.muted; if (!opts.muted) opts.music = true; }
  else if (idx === 1){ opts.shake = !opts.shake; }
  else if (idx === 2){ opts.tips = !opts.tips; if (!opts.tips) tipQ = [], tipNow = null; }
  else if (idx === 3){ opts.difficulty = (opts.difficulty + (dir || 1) + 3) % 3; }
  else if (idx === 4){ clearScores(); pushToast('SCORES CLEARED', P.red); }
  else if (idx === 5){
    stats = Object.assign({}, DEFAULT_STATS);
    unlockedAch = [];
    camp = sanitizeCamp({});
    loadout = Object.assign({}, DEFAULT_LOADOUT, { mods: [] });
    resetGallery(); resetTips();
    applyLoadout();
    saveStats(); saveAch(); saveCamp(); saveLoadout();
    pushToast('PROGRESS CLEARED', P.red);
  }
  saveOpts();
  sfx('toggle');
}
function optionLabel(idx){
  if (idx === 0) return opts.muted ? 'OFF' : 'ON';
  if (idx === 1) return opts.shake ? 'ON' : 'OFF';
  if (idx === 2) return opts.tips ? 'ON' : 'OFF';
  if (idx === 3) return DIFFICULTY_NAMES[opts.difficulty];
  if (idx === 4) return 'CLEAR';
  if (idx === 5) return 'CLEAR';
  return '';
}
function optionName(idx){
  if (idx === 0) return 'SOUND';
  if (idx === 1) return 'SCREEN SHAKE';
  if (idx === 2) return 'TIPS';
  if (idx === 3) return 'DIFFICULTY';
  if (idx === 4) return 'RESET SCORES';
  if (idx === 5) return 'RESET PROGRESS';
  return '';
}
const OPTIONS_COUNT = 7;
const DIFFICULTY_NAMES = ['EASY', 'NORMAL', 'HARD'];
const DIFFICULTY_SHIFT = [-3, 0, 3];          // moves every wave up or down the difficulty curve
const DIFFICULTY_SCORE = [0.8, 1, 1.25];       // and the score follows
