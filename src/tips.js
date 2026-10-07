'use strict';
// One-time tips. The wave patterns are the game's language, so the first time each one appears
// (and the first time you meet shields, turret loss, satellites and so on) a short note says how to
// read it. Tips are remembered, and cleared by Reset Progress.
let tipsSeen = safeLoad(KEY('tips'), []);
if (!Array.isArray(tipsSeen)) tipsSeen = [];
let tipQ = [], tipNow = null;
function tip(id, text){
  if (tipsSeen.includes(id) || tipQ.some(t => t.id === id) || (tipNow && tipNow.id === id)) return;
  tipsSeen.push(id);
  safeSave(KEY('tips'), tipsSeen);
  tipQ.push({ id, lines: wrapText(text.toUpperCase(), 50), t: 0, dur: 2.6 + text.length * 0.045 });
}
function resetTips(){ tipsSeen = []; tipQ = []; tipNow = null; safeSave(KEY('tips'), tipsSeen); }
function updateTips(dt){
  if (!tipNow && tipQ.length) tipNow = tipQ.shift();
  if (tipNow){ tipNow.t += dt; if (tipNow.t > tipNow.dur) tipNow = null; }
}
function drawTip(t){
  if (!tipNow) return;
  const k = Math.min(1, tipNow.t * 5, (tipNow.dur - tipNow.t) * 5);
  const lines = tipNow.lines, h = 21 + lines.length * 8, y = 120 + Math.round((1 - k) * 8);
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * 0.94 * Math.max(0, k);
  uiPlate(14, y, W - 28, h, P.blk, null, null, P.yel);
  drawStar(18, y + 3, P.rrd);
  drawText('COMRADE, A WORD', 28, y + 4, P.yel);
  for (let i = 0; i < lines.length; i++) drawText(lines[i], 20, y + 15 + i * 8, P.wht);
  ctx.globalAlpha = pa;
}
