'use strict';
// Toasts
// =====================================================================
//  TOASTS (always drawn on the top screen)
// =====================================================================
let toasts = [];
function pushToast(text, color){
  toasts.push({ text, color, t:0, dur: 2.8 });
  if (toasts.length > 3) toasts.shift();
}
function updateToasts(dt){
  for (const t of toasts) t.t += dt;
  toasts = toasts.filter(t => t.t < t.dur);
}
function drawToasts(){
  for (let i = 0; i < toasts.length; i++){
    const t = toasts[i];
    const a = Math.min(1, t.t*3) * (1 - Math.max(0, (t.t - (t.dur - 0.6)) / 0.6));
    const y = 40 + i * 12;
    const tw = textW(t.text);
    const px = Math.round((W - tw)/2);
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = P.blk;
    ctx.fillRect(px - 3, y - 1, tw + 6, 8);
    ctx.globalAlpha = a;
    drawText(t.text, px, y, t.color);
    ctx.globalAlpha = prevA;
  }
}
