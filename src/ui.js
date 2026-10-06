'use strict';
// DS-style UI kit: bevelled touch buttons, header and footer chrome, button glyphs, pixel icons,
// stylus feedback and page transitions. Every menu is drawn on the bottom (touch) screen in its
// own local coordinates, and touch hit regions are registered while drawing, so what you tap is
// always exactly what was drawn.
const FOOT_H = 15, FOOT_Y = SH - FOOT_H;
const ui = { hits: [], prev: [], stylus: null, anim: {}, dt: 0, lastT: 0, key: '', xT: 1 };

// Called once per rendered frame, before any menu is drawn
function uiFrame(t){
  ui.dt = Math.min(0.05, Math.max(0, t - (ui.lastT || t)));
  ui.lastT = t;
  ui.prev = ui.hits;
  ui.hits = [];
}
function uiHit(x, y, w, h, fn){ ui.hits.push({ x, y, w, h, fn }); }
// Local (bottom-screen) coordinates in, true when something was tapped
function uiTap(px, py){
  for (let i = ui.prev.length - 1; i >= 0; i--){
    const h = ui.prev[i];
    if (px >= h.x && px < h.x + h.w && py >= h.y && py < h.y + h.h){ h.fn(px, py); return true; }
  }
  return false;
}
function uiAnim(key, target, speed){
  const cur = ui.anim[key] || 0;
  ui.anim[key] = cur + (target - cur) * Math.min(1, ui.dt * (speed || 16));
  return ui.anim[key];
}
function uiStylus(absX, absY){ ui.stylus = { x: absX, y: absY, t0: performance.now() / 1000 }; }
// Ring that spreads out from the last touch, drawn in absolute coordinates over everything
function uiDrawStylus(t){
  const s = ui.stylus;
  if (!s) return;
  const age = t - s.t0;
  if (age > 0.4){ ui.stylus = null; return; }
  const r = 2 + age * 30, a = 1 - age / 0.4;
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * a;
  ctx.fillStyle = P.wht;
  for (let k = 0; k < 20; k++){
    const ang = k / 20 * Math.PI * 2;
    ctx.fillRect(Math.round(s.x + Math.cos(ang) * r), Math.round(s.y + Math.sin(ang) * r), 1, 1);
  }
  ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1); ctx.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3);
  ctx.globalAlpha = prevA;
}
// Menu pages slide in from the right
function uiTransition(key){
  if (key !== ui.key){ ui.key = key; ui.xT = 0; }
  ui.xT = Math.min(1, ui.xT + ui.dt / 0.16);
  const e = easeOut(ui.xT);
  return { dx: Math.round((1 - e) * 22), a: 0.25 + 0.75 * e };
}

// ---- Pixel icons (7x7) ---------------------------------------------
const UI_ICONS = {
  flag:   ['1111000', '1111100', '1111000', '1000000', '1000000', '1000000', '1000000'],
  endless:['0000000', '0110110', '1001001', '1001001', '0110110', '0000000', '0000000'],
  skull:  ['0111110', '1111111', '1011101', '1111111', '0111110', '0101010', '0000000'],
  cross:  ['0001000', '0001000', '0001000', '1110111', '0001000', '0001000', '0001000'],
  bars:   ['0000001', '0000101', '0010101', '0010101', '1010101', '1010101', '1111111'],
  trophy: ['1111111', '1111111', '0111110', '0011100', '0001000', '0001000', '0111110'],
  cog:    ['0010100', '1111111', '0111110', '1110111', '0111110', '1111111', '0010100'],
  play:   ['1000000', '1100000', '1110000', '1111000', '1110000', '1100000', '1000000'],
  lock:   ['0011100', '0100010', '0100010', '1111111', '1111111', '1110111', '1111111'],
  check:  ['0000001', '0000011', '1000110', '1101100', '0111000', '0010000', '0000000'],
  left:   ['0001000', '0010000', '0100000', '1000000', '0100000', '0010000', '0001000'],
  right:  ['0001000', '0000100', '0000010', '0000001', '0000010', '0000100', '0001000'],
  star:   STAR_SPR,
};
function uiIcon(name, x, y, col){
  const g = UI_ICONS[name];
  if (!g) return;
  ctx.fillStyle = P.blk;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (g[j][i] === '1') ctx.fillRect(x + i + 1, y + j + 1, 1, 1);
  ctx.fillStyle = col;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (g[j][i] === '1') ctx.fillRect(x + i, y + j, 1, 1);
}
const MENU_ICONS = { 'CONTINUE':'play', 'CAMPAIGN':'flag', 'ENDLESS':'endless', 'BOSS RUSH':'skull', 'LOADOUT':'cross', 'STATISTICS':'bars', 'HIGH SCORES':'trophy', 'OPTIONS':'cog' };

// ---- Button glyphs: the DS face buttons and keys ----------------------
// Returns the width drawn, so callers can lay hints out in a row.
function uiGlyph(kind, x, y){
  if (kind === 'A' || kind === 'B' || kind === 'X' || kind === 'Y'){
    const col = { A: P.rrd, B: P.yel, X: P.blu, Y: P.grn }[kind];
    fillCircle(x + 5, y + 5, 5, P.blk);
    fillCircle(x + 5, y + 5, 4, col);
    ctx.fillStyle = P.pnk; ctx.fillRect(x + 3, y + 2, 2, 1);
    drawText(kind, x + 4, y + 3, kind === 'B' ? P.blk : P.wht);
    return 11;
  }
  if (kind === 'DPAD'){
    ctx.fillStyle = P.blk; ctx.fillRect(x + 3, y, 5, 11); ctx.fillRect(x, y + 3, 11, 5);
    ctx.fillStyle = P.gry; ctx.fillRect(x + 4, y + 1, 3, 9); ctx.fillRect(x + 1, y + 4, 9, 3);
    ctx.fillStyle = P.wht; ctx.fillRect(x + 4, y + 1, 3, 1); ctx.fillRect(x + 1, y + 4, 1, 3);
    ctx.fillStyle = P.dblu; ctx.fillRect(x + 5, y + 5, 1, 1);
    return 12;
  }
  if (kind === 'L' || kind === 'R'){
    ctx.fillStyle = P.blk; ctx.fillRect(x, y + 1, 15, 8);
    ctx.fillStyle = P.gry; ctx.fillRect(x + 1, y + 2, 13, 6);
    ctx.fillStyle = P.wht; ctx.fillRect(x + 1, y + 2, 13, 1);
    if (kind === 'L'){ ctx.fillStyle = P.blk; ctx.fillRect(x, y + 1, 2, 2); } else { ctx.fillStyle = P.blk; ctx.fillRect(x + 13, y + 1, 2, 2); }
    drawText(kind, x + 6, y + 3, P.blk);
    return 16;
  }
  if (kind === 'START' || kind === 'SELECT'){
    const w = textW(kind) + 6;
    ctx.fillStyle = P.blk; ctx.fillRect(x, y + 1, w, 8);
    ctx.fillStyle = P.gry; ctx.fillRect(x + 1, y + 2, w - 2, 6);
    ctx.fillStyle = P.wht; ctx.fillRect(x + 1, y + 2, w - 2, 1);
    drawText(kind, x + 3, y + 3, P.blk);
    return w + 1;
  }
  if (kind === 'TOUCH'){
    ctx.fillStyle = P.blk;
    for (let k = 0; k < 8; k++) ctx.fillRect(x + 1 + k, y + 9 - k, 2, 2);
    ctx.fillStyle = P.wht;
    for (let k = 1; k < 7; k++) ctx.fillRect(x + 1 + k, y + 9 - k, 1, 1);
    ctx.fillStyle = P.yel; ctx.fillRect(x, y + 9, 2, 2);
    return 11;
  }
  return 0;
}

// ---- Plates and buttons ------------------------------------------------
// A chamfered, bevelled plate: the building block of every button and panel
function uiPlate(x, y, w, h, fill, hi, lo, edge){
  ctx.fillStyle = edge;
  ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (hi){ ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 1, w - 4, 1); ctx.fillRect(x + 1, y + 2, 1, h - 4); }
  if (lo){ ctx.fillStyle = lo; ctx.fillRect(x + 2, y + h - 2, w - 4, 1); ctx.fillRect(x + w - 2, y + 2, 1, h - 4); }
}
const UI_NORMAL = [P.dblu, P.blu, P.blk, P.blk];       // fill, highlight, shadow, edge
const UI_SELECT = [P.rrd, P.pnk, P.dred, P.yel];
const UI_LOCKED = [P.blk, null, null, P.dblu];
// o: sel, dim, icon, detail, dcol, scale (1|2), align, slide (0..1), fn
function uiButton(x, y, w, h, label, o){
  o = o || {};
  const sel = !!o.sel, dim = !!o.dim;
  x += Math.round((o.slide || 0) * 3);
  const c = dim ? UI_LOCKED : (sel ? UI_SELECT : UI_NORMAL);
  uiPlate(x, y, w, h, c[0], c[1], c[2], c[3]);
  if (sel){                                           // a glint that sweeps across the selected button
    const gx = Math.floor((performance.now() / 1000 * 70) % (w + 30)) - 15;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip();
    ctx.fillStyle = P.red;
    for (let k = 0; k < h; k++) ctx.fillRect(x + gx + (h - k) * 0.6, y + 2 + k, 3, 1);
    ctx.restore();
  }
  const sc = o.scale || 1;
  let tx = x + 8;
  if (o.icon){ uiIcon(o.icon, x + 6, y + Math.floor((h - 7) / 2), dim ? P.blu : (sel ? P.yel : P.lblu)); tx = x + 18; }
  const textH = 5 * sc, ty = y + Math.floor((h - textH) / 2) + (sc === 2 ? 0 : 0);
  const tw = sc === 2 ? textW2x(label) : textW(label);
  if (o.align === 'center') tx = x + Math.round((w - tw) / 2);
  const col = dim ? P.blu : (sel ? P.yel : P.wht);
  drawTextS(label, tx + 1, ty + 1, P.blk, undefined, sc);
  drawTextS(label, tx, ty, col, undefined, sc);
  if (o.detail){
    const dw = textW(o.detail);
    drawText(o.detail, x + w - 7 - dw, y + Math.floor((h - 5) / 2), o.dcol || (sel ? P.yel : P.lblu));
  }
  if (o.fn) uiHit(x, y, w, h, o.fn);
}
// A small button for chevrons and shoulder keys
function uiMini(x, y, w, h, icon, fn, on){
  const c = on ? UI_SELECT : UI_NORMAL;
  uiPlate(x, y, w, h, c[0], c[1], c[2], c[3]);
  uiIcon(icon, x + Math.floor((w - 7) / 2), y + Math.floor((h - 7) / 2), P.wht);
  if (fn) uiHit(x, y, w, h, fn);
}
// On/off switch
function uiSwitch(x, y, on){
  ctx.fillStyle = P.blk; ctx.fillRect(x, y, 24, 10);
  ctx.fillStyle = on ? P.grn : P.dblu; ctx.fillRect(x + 1, y + 1, 22, 8);
  ctx.fillStyle = on ? P.lgrn : P.blu; ctx.fillRect(x + 1, y + 1, 22, 1);
  const kx = on ? x + 14 : x + 1;
  ctx.fillStyle = P.blk; ctx.fillRect(kx - 1, y, 11, 10);
  ctx.fillStyle = P.wht; ctx.fillRect(kx, y + 1, 9, 8);
  ctx.fillStyle = P.gry; ctx.fillRect(kx, y + 8, 9, 1);
  drawText(on ? 'ON' : 'OFF', on ? x + 3 : x + 12, y + 3, on ? P.blk : P.gry);
}

// ---- Header and footer ------------------------------------------------
// o: sub (small text under the bar), shoulders (touch L/R callbacks)
function uiHeader(title, o){
  o = o || {};
  ctx.fillStyle = P.rrd; ctx.fillRect(0, 0, W, 19);
  ctx.fillStyle = P.red; ctx.fillRect(0, 1, W, 1);
  ctx.fillStyle = P.dred; ctx.fillRect(0, 17, W, 2);
  ctx.fillStyle = P.yel; ctx.fillRect(0, 19, W, 1);
  ctx.fillStyle = P.blk; ctx.fillRect(0, 20, W, 1);
  if (!o.shoulders){ drawStar(6, 5, P.yel); drawStar(W - 13, 5, P.yel); }
  const tw = textW2x(title), tx = Math.round((W - tw) / 2);
  drawText2x(title, tx + 1, 5, P.blk);
  drawText2x(title, tx, 4, P.yel);
  if (o.shoulders){
    uiGlyph('L', 4, 4); uiHit(0, 0, 30, 19, o.shoulders[0]);
    uiGlyph('R', W - 20, 4); uiHit(W - 30, 0, 30, 19, o.shoulders[1]);
  }
}
// items: [[glyph, label], ...] shown at the right; back: callback for the soft BACK button
function uiFooter(items, back){
  ctx.fillStyle = P.blk; ctx.fillRect(0, FOOT_Y, W, FOOT_H);
  ctx.fillStyle = P.dblu; ctx.fillRect(0, FOOT_Y, W, 1);
  ctx.fillStyle = P.blu; ctx.fillRect(0, FOOT_Y + 1, W, 1);
  let left = 4;
  if (back){
    uiPlate(left, FOOT_Y + 3, 48, 11, UI_NORMAL[0], UI_NORMAL[1], UI_NORMAL[2], UI_NORMAL[3]);
    uiGlyph('B', left + 2, FOOT_Y + 3);
    drawText('BACK', left + 15, FOOT_Y + 6, P.wht);
    uiHit(left, FOOT_Y, 52, FOOT_H, back);
    left += 52;
  }
  // measure the hints, then draw them right-aligned
  const widths = items.map(([g, s]) => (g === 'DPAD' ? 12 : g === 'L' || g === 'R' ? 16 : g === 'START' || g === 'SELECT' ? textW(g) + 7 : g === 'TOUCH' ? 11 : 11) + 3 + textW(s) + 7);
  let x = W - 4 - widths.reduce((a, b) => a + b, 0) + 7;
  for (let i = 0; i < items.length; i++){
    const [g, s] = items[i];
    const gw = uiGlyph(g, x, FOOT_Y + 3);
    drawText(s, x + gw + 3, FOOT_Y + 6, P.gry);
    x += widths[i];
  }
}
// Page dots, e.g. for the statistics pages
function uiDots(n, cur, y){
  const w = n * 8 - 3, x0 = Math.round((W - w) / 2);
  for (let i = 0; i < n; i++){
    ctx.fillStyle = P.blk; ctx.fillRect(x0 + i * 8, y, 5, 5);
    ctx.fillStyle = i === cur ? P.yel : P.dblu; ctx.fillRect(x0 + i * 8 + 1, y + 1, 3, 3);
  }
}

// ---- Bottom-screen background (absolute coordinates) --------------------
let uiHatch = null;
function uiBackground(t, env){
  ctx.fillStyle = P.blk; ctx.fillRect(0, BOT, W, SH);
  // horizon glow in raster bands rising from the bottom edge
  const bands = 9, bh = Math.ceil(SH / bands / 1.4);
  const prevA = ctx.globalAlpha;
  for (let i = 0; i < bands; i++){
    ctx.globalAlpha = prevA * (1 - i / bands) * 0.26;
    ctx.fillStyle = env.ground1;
    ctx.fillRect(0, BOT + SH - (i + 1) * bh, W, bh);
  }
  // slow diagonal hatch
  if (!uiHatch){
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const g = c.getContext('2d'); g.fillStyle = '#ffffff';
    for (let k = 0; k < 12; k++) g.fillRect(k, 11 - k, 1, 1);
    uiHatch = ctx.createPattern(c, 'repeat');
  }
  ctx.globalAlpha = prevA * 0.05;
  ctx.save();
  ctx.translate(Math.floor(t * 6) % 12, Math.floor(t * 3) % 12);
  ctx.fillStyle = uiHatch; ctx.fillRect(-12, BOT - 12, W + 24, SH + 24);
  ctx.restore();
  ctx.globalAlpha = prevA;
  for (const s of MENU_STARS){
    if (s.b < 4) continue;
    ctx.fillStyle = (0.5 + 0.5 * Math.sin(t * 3 + s.b)) > 0.5 ? P.gry : P.dblu;
    ctx.fillRect(s.x, BOT + s.y, 1, 1);
  }
}

// World thumbnail: sky bands, a small planet, two ranges of peaks and the ground
function uiWorldThumb(env, x, y, w, h, locked){
  ctx.fillStyle = P.blk; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  const sky = env.skyBands, skyH = Math.round(h * 0.72), n = sky.length;
  for (let k = 0; k < n; k++){
    const y0 = y + Math.floor(k * skyH / n), y1 = y + Math.floor((k + 1) * skyH / n);
    ctx.fillStyle = sky[k]; ctx.fillRect(x, y0, w, Math.max(1, y1 - y0));
  }
  fillCircle(x + Math.round(w * 0.68), y + Math.round(h * 0.3), 3.5, env.snowCol);
  ctx.fillStyle = env.mountFar.lit;
  for (let i = 0; i < w; i++){ const m = 3 + Math.abs(((i * 5 + 7) % 14) - 7) * 0.5; ctx.fillRect(x + i, y + skyH - Math.round(m), 1, Math.round(m)); }
  ctx.fillStyle = env.mountNear.lit;
  for (let i = 0; i < w; i++){ const m = 1 + Math.abs(((i * 3 + 2) % 10) - 5) * 0.55; ctx.fillRect(x + i, y + skyH - Math.round(m), 1, Math.round(m)); }
  ctx.fillStyle = env.ground1; ctx.fillRect(x, y + skyH, w, h - skyH);
  ctx.fillStyle = env.ground0; ctx.fillRect(x, y + h - 2, w, 2);
  if (locked){
    const pa = ctx.globalAlpha; ctx.globalAlpha = pa * 0.7; ctx.fillStyle = P.blk; ctx.fillRect(x, y, w, h); ctx.globalAlpha = pa;
    uiIcon('lock', x + Math.floor((w - 7) / 2), y + Math.floor((h - 7) / 2), P.blu);
  }
}
