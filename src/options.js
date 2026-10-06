'use strict';
// Options
// =====================================================================
//  OPTIONS
// =====================================================================
function cycleOption(idx){
  if (idx === 0){ opts.muted = !opts.muted; }
  else if (idx === 1){ opts.shake = !opts.shake; }
  else if (idx === 2){ clearScores(); pushToast('SCORES CLEARED', P.red); }
  else if (idx === 3){
    stats = Object.assign({}, DEFAULT_STATS);
    unlockedAch = [];
    camp = sanitizeCamp({});
    loadout = Object.assign({}, DEFAULT_LOADOUT, { mods: [] });
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
  if (idx === 2) return 'CLEAR';
  if (idx === 3) return 'CLEAR';
  return '';
}
function optionName(idx){
  if (idx === 0) return 'SOUND';
  if (idx === 1) return 'SCREEN SHAKE';
  if (idx === 2) return 'RESET SCORES';
  if (idx === 3) return 'RESET PROGRESS';
  return '';
}
const OPTIONS_COUNT = 5;
