'use strict';
// High-score name entry
// =====================================================================
//  NAME ENTRY
// =====================================================================
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

function nameEntryMoveCursor(dir){
  nameEntry.cursor = (nameEntry.cursor + dir + 3) % 3;
  sfx('move');
}
function nameEntryChangeLetter(dir){
  const cur = LETTERS.indexOf(nameEntry.letters[nameEntry.cursor]);
  const next = (cur + dir + LETTERS.length) % LETTERS.length;
  nameEntry.letters[nameEntry.cursor] = LETTERS[next];
  sfx('tick');
}
function nameEntryConfirm(){
  if (nameLock > 0) return;
  if (!pendingScore) { menuState = 'title'; return; }
  const name = nameEntry.letters.join('');
  saveScore(pendingScore.mode, {...pendingScore.entry, name});
  pendingScore = null;
  menuState = 'gameover';
  gameOverTimer = 0.6;
  sfx('nameOk');
}
