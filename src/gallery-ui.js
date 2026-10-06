'use strict';
// Gallery screens, designed for two screens and a stylus:
//   grid  the touch screen holds a 4x3 grid of thumbnails; the top screen is a framed museum wall
//   card  the top screen shows a trading card; the touch screen has the credits and flip buttons
//   zoom  both screens become one tall viewport on a single poster: drag to pan, double-tap or A to zoom
const GAL_COLS = 4, GAL_ROWS = 3, VIEW_H = SH * 2;      // zoom viewport: both screens, 192 + 192
let galView = 'grid', galSel = 0, galZoom = 0, galFlipT = 1, galCapT = 0, galTapT = 0, galDrag = null;
const galPan = { x: 0, y: 0 };
const galImgs = {};
UI_ICONS.frame = ['1111111', '1000001', '1001101', '1011101', '1111101', '1000001', '1111111'];
MENU_ICONS['GALLERY'] = 'frame';
UI_ICONS.zoom = ['0111000', '1000100', '1000100', '1000100', '0111010', '0000101', '0000011'];

function galImg(i, kind){
  const k = i + kind;
  let im = galImgs[k];
  if (!im){
    const key = 'p' + String(i + 1).padStart(2, '0') + '-' + kind;
    im = galImgs[k] = new Image();
    im.src = (typeof GALLERY_DATA !== 'undefined' && GALLERY_DATA[key]) || 'assets/gallery/' + key + '.png';   // GALLERY_DATA exists in the single-file build
  }
  return im.complete && im.naturalWidth ? im : null;
}
function openGallery(){
  menuState = 'gallery'; galView = 'grid';
  galSel = galleryUnlocked.length ? galleryUnlocked[0] : 0;
  for (const i of galleryUnlocked) galImg(i, 'thumb');
  sfx('select');
}

// ---- Navigation ---------------------------------------------------------
function galStep(d){                                    // flip to the next poster you own
  const o = galleryUnlocked;
  if (!o.length) return;
  const k = o.indexOf(galSel);
  galSel = o[k < 0 ? 0 : (k + d + o.length) % o.length];
  galFlipT = 0; galPan.x = galPan.y = 0; galCapT = 0;
  sfx('move');
}
function galOpenCard(){
  if (!posterOwned(galSel)){ sfx('locked'); return; }
  galView = 'card'; galFlipT = 0; sfx('select');
}
function galOpenZoom(){ galView = 'zoom'; galZoom = 0; galPan.x = galPan.y = 0; galCapT = 0; sfx('select'); }
function galToggleZoom(){
  galZoom = 1 - galZoom; galPan.x = galPan.y = 0; sfx(galZoom ? 'select' : 'back');
}
function galBack(){
  if (galView === 'zoom'){ galView = 'card'; galFlipT = 0; sfx('back'); }
  else if (galView === 'card'){ galView = 'grid'; sfx('back'); }
  else goToTitle(7);
}
function galMoveSel(dc, dr){
  const c = ((galSel % GAL_COLS) + dc + GAL_COLS) % GAL_COLS, r = ((Math.floor(galSel / GAL_COLS)) + dr + GAL_ROWS) % GAL_ROWS;
  galSel = r * GAL_COLS + c; galFlipT = 0; sfx('move');
}
function galKey(code){
  const a = code === 'Enter' || code === 'Space';
  if (galView === 'grid'){
    if (code === 'ArrowLeft') galMoveSel(-1, 0);
    else if (code === 'ArrowRight') galMoveSel(1, 0);
    else if (code === 'ArrowUp') galMoveSel(0, -1);
    else if (code === 'ArrowDown') galMoveSel(0, 1);
    else if (a) galOpenCard();
    else if (code === 'Escape') galBack();
  } else if (galView === 'card'){
    if (code === 'ArrowLeft') galStep(-1);
    else if (code === 'ArrowRight') galStep(1);
    else if (a) galOpenZoom();
    else if (code === 'Escape') galBack();
  } else {
    if (a) galToggleZoom();
    else if (code === 'Escape') galBack();
    else if (!galZoom && code === 'ArrowLeft') galStep(-1);
    else if (!galZoom && code === 'ArrowRight') galStep(1);
  }
}
// Stylus: drag pans the zoomed poster, a horizontal swipe flips cards, a quick double tap toggles zoom
function galPointerDown(p){ galDrag = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: 0 }; }
function galPointerMove(p){
  const d = galDrag;
  if (!d) return;
  const dx = p.x - d.lx, dy = p.y - d.ly;
  d.lx = p.x; d.ly = p.y; d.moved += Math.abs(dx) + Math.abs(dy);
  if (galView === 'zoom' && galZoom){ galPan.x -= dx; galPan.y -= dy; }
}
function galPointerUp(p){
  const d = galDrag;
  galDrag = null;
  if (!d) return;
  const dx = p.x - d.sx, dy = p.y - d.sy;
  const swipe = Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 1.5;
  if (swipe && (galView === 'card' || (galView === 'zoom' && !galZoom))){ galStep(dx < 0 ? 1 : -1); return; }
  if (galView === 'zoom' && d.moved < 6){
    const now = performance.now();
    if (now - galTapT < 320){ galToggleZoom(); galTapT = 0; } else galTapT = now;
  }
}

// ---- Drawing --------------------------------------------------------------
function drawGallery(t){
  if (galView === 'zoom'){ drawGalleryZoom(t); return; }
  const env = menuEnv();
  drawGalleryTop(t, env);
  ctx.fillStyle = P.blk; ctx.fillRect(0, SH, W, GAP);
  uiBackground(t, env);
  ctx.fillStyle = env.ground0; ctx.fillRect(0, BOT - 6, W, 6);
  const tr = uiTransition('gallery-' + galView);
  ctx.save();
  ctx.translate(tr.dx, BOT);
  const pa = ctx.globalAlpha; ctx.globalAlpha = pa * tr.a;
  if (galView === 'grid') drawGalleryGrid(t); else drawGalleryCard(t);
  ctx.globalAlpha = pa;
  ctx.restore();
}

// Dark gallery room with a soft spotlight
function drawGalleryRoom(t, env){
  ctx.fillStyle = P.blk; ctx.fillRect(0, 0, W, SH);
  const pa = ctx.globalAlpha;
  for (let i = 0; i < 8; i++){
    ctx.globalAlpha = pa * (0.05 + i * 0.012);
    ctx.fillStyle = env.ground0;
    ctx.fillRect(0, SH - (i + 1) * 12, W, 12);
  }
  ctx.globalAlpha = pa * 0.07; ctx.fillStyle = P.wht;
  for (let y = 0; y < SH; y += 2){ const hw = 30 + y * 0.55; ctx.fillRect(128 - hw, y, hw * 2, 2); }
  ctx.globalAlpha = pa;
  for (const s of MENU_STARS){
    if (s.b < 5) continue;
    ctx.fillStyle = (0.5 + 0.5 * Math.sin(t * 3 + s.b)) > 0.5 ? P.gry : P.dblu;
    ctx.fillRect(s.x, s.y, 1, 1);
  }
}
function drawGalleryTop(t, env){
  drawGalleryRoom(t, env);
  if (galView === 'grid') drawWall(t); else drawTradingCard(t);
}
// Wrapped, centred lines; returns the y after the last line
function galLines(str, cx, y, maxChars, col, step){
  for (const l of wrapText(str, maxChars)){ drawText(l, Math.round(cx - textW(l) / 2), y, col); y += step || 7; }
  return y;
}

// Grid view, top screen: the selected poster framed on the wall, with a brass plaque
function drawWall(t){
  const i = galSel, owned = posterOwned(i), p = POSTERS[i];
  const im = owned ? galImg(i, 'wall') : null;
  const iw = im ? im.width : 150, ih = im ? im.height : 100;
  const x = Math.round(128 - iw / 2), y = 8 + Math.round((148 - ih) / 2);
  uiPlate(x - 6, y - 6, iw + 12, ih + 12, P.dorg, P.tan, P.blk, P.org);          // gold frame
  ctx.fillStyle = P.blk; ctx.fillRect(x - 2, y - 2, iw + 4, ih + 4);
  if (im){
    ctx.drawImage(im, x, y);
    const gx = Math.floor((t * 50) % (iw + 80)) - 40;                              // a slow glint across the glass
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, iw, ih); ctx.clip();
    ctx.globalAlpha = 0.16; ctx.fillStyle = P.wht;
    for (let k = 0; k < ih; k += 2) ctx.fillRect(x + gx + (ih - k) * 0.5, y + k, 6, 2);
    ctx.restore(); ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = P.dblu; ctx.fillRect(x, y, iw, ih);
    for (let k = 0; k < 22; k++) { ctx.fillStyle = k % 3 ? P.blu : P.dblu; ctx.fillRect(x + (k * 37 + 11) % iw, y + (k * 53 + 7) % ih, 1, 1); }
    uiIcon('lock', 128 - 3, y + Math.floor(ih / 2) - 10, P.blu);
    drawText2x('?', 125, y + Math.floor(ih / 2) + 2, P.blu);
  }
  // plaque
  uiPlate(24, 166, 208, 24, P.dorg, P.org, P.blk, P.tan);
  if (owned){
    const ty = galLines(p.title, 128, 170, 48, P.yel);
    drawText(p.artist + ' - ' + p.year, Math.round(128 - textW(p.artist + ' - ' + p.year) / 2), ty, P.tan);
  } else {
    drawText('NOT YET INTERCEPTED', Math.round(128 - textW('NOT YET INTERCEPTED') / 2), 170, P.tan);
    drawText('SHOOT DOWN THE FAST SATELLITES', Math.round(128 - textW('SHOOT DOWN THE FAST SATELLITES') / 2), 178, P.wht);
  }
}

// Card view, top screen: a trading card with a holographic glint
function drawTradingCard(t){
  const i = galSel, p = POSTERS[i];
  galFlipT = Math.min(1, galFlipT + ui.dt / 0.24);
  const sx = Math.max(0.05, Math.abs(Math.cos((1 - easeOut(galFlipT)) * Math.PI / 2)));
  ctx.save();
  ctx.translate(128, 96); ctx.scale(sx, 1); ctx.translate(-128, -96);
  const cx = 58, cy = 4, cw = 140, ch = 184;
  uiPlate(cx, cy, cw, ch, P.dblu, P.blu, P.blk, P.tan);
  uiPlate(cx + 3, cy + 3, cw - 6, ch - 6, P.blk, null, null, P.dorg);
  // header: number and a star
  drawText('NO. ' + String(i + 1).padStart(2, '0') + '/' + POSTERS.length, cx + 8, cy + 8, P.tan);
  drawStar(cx + cw - 16, cy + 6, P.yel);
  // art window
  const ax = cx + 8, ay = cy + 18, aw = 124, ah = 120;
  ctx.fillStyle = P.dblu; ctx.fillRect(ax - 1, ay - 1, aw + 2, ah + 2);
  ctx.fillStyle = P.blk; ctx.fillRect(ax, ay, aw, ah);
  const im = galImg(i, 'card');
  if (im){
    const ix = ax + Math.floor((aw - im.width) / 2), iy = ay + Math.floor((ah - im.height) / 2);
    ctx.drawImage(im, ix, iy);
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    const gx = ((t * 38) % (aw + 120)) - 60;
    ctx.globalAlpha = 0.2;
    for (let k = 0; k < ah; k += 2){ ctx.fillStyle = (k >> 3) & 1 ? P.lblu : P.wht; ctx.fillRect(ax + gx + (ah - k) * 0.7, ay + k, 9, 2); }
    ctx.restore(); ctx.globalAlpha = 1;
  } else drawText('LOADING', ax + 44, ay + 58, P.gry);
  // credits
  let y = galLines(p.title, 128, cy + 143, 31, P.yel);
  y = galLines(p.artist, 128, y + 1, 31, P.lblu);
  drawText(p.year, Math.round(128 - textW(p.year) / 2), y + 1, P.tan);
  ctx.restore();
}

// Grid view, touch screen
function drawGalleryGrid(t){
  uiHeader('GALLERY');
  const n = galleryUnlocked.length, txt = n + '/' + POSTERS.length + ' POSTERS';
  drawText(txt, Math.round((W - textW(txt)) / 2), 22, n === POSTERS.length ? P.yel : P.lblu);
  for (let i = 0; i < POSTERS.length; i++){
    const x = 5 + (i % GAL_COLS) * 62, y = 28 + Math.floor(i / GAL_COLS) * 46, w = 60, h = 44;
    const owned = posterOwned(i), sel = galSel === i;
    const c = sel ? UI_SELECT : (owned ? UI_NORMAL : UI_LOCKED);
    uiPlate(x, y, w, h, c[0], c[1], c[2], c[3]);
    if (owned){
      const im = galImg(i, 'thumb');
      if (im) ctx.drawImage(im, x + Math.floor((w - im.width) / 2), y + Math.floor((h - im.height) / 2));
    } else {
      uiIcon('lock', x + 26, y + 15, P.blu);
      drawText('?', x + 29, y + 26, P.blu);
    }
    ctx.fillStyle = P.blk; ctx.fillRect(x + 3, y + 3, 11, 7);
    drawText(String(i + 1), x + 5, y + 4, owned ? P.yel : P.blu);
    if (sel){                                           // marching outline on the selected cell
      ctx.fillStyle = Math.sin(t * 10) > 0 ? P.wht : P.yel;
      ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
      ctx.fillRect(x + 1, y + 1, 1, h - 2); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    }
    uiHit(x, y, w, h, () => { if (galSel === i) galOpenCard(); else { galSel = i; galFlipT = 0; sfx('move'); } });
  }
  uiFooter([['DPAD', 'MOVE'], ['A', 'VIEW']], galBack);
}

// Card view, touch screen
function drawGalleryCard(t){
  const i = galSel, p = POSTERS[i];
  uiHeader('NO. ' + String(i + 1).padStart(2, '0') + ' OF ' + POSTERS.length, { shoulders: [() => galStep(-1), () => galStep(1)] });
  uiPlate(6, 26, W - 12, 86, P.blk, null, null, P.dblu);
  let y = galLines(p.title, 128, 32, 56, P.yel, 8);
  drawText('BY ' + p.artist, Math.round(128 - textW('BY ' + p.artist) / 2), y + 2, P.lblu);
  drawText(p.year, Math.round(128 - textW(p.year) / 2), y + 11, P.tan);
  if (p.note) galLines(p.note, 128, y + 24, 56, P.gry, 7);
  uiMini(6, 120, 42, 30, 'left', () => galStep(-1));
  uiButton(54, 120, 148, 30, 'ZOOM', { sel: true, scale: 2, align: 'center', icon: 'zoom', fn: galOpenZoom });
  uiMini(208, 120, 42, 30, 'right', () => galStep(1));
  uiGlyph('TOUCH', 78, 157);
  drawText('SWIPE TO FLIP CARDS', 92, 160, P.gry);
  uiFooter([['L', 'PREV'], ['R', 'NEXT'], ['A', 'ZOOM']], galBack);
}

// Zoom view: both screens form one 256 x 384 viewport onto the poster
function drawGalleryZoom(t){
  ctx.fillStyle = P.blk; ctx.fillRect(0, 0, W, H);
  const im = galImg(galSel, galZoom ? 'hi' : 'fit');
  if (im){
    const iw = im.width, ih = im.height;
    const maxX = Math.max(0, iw - W), maxY = Math.max(0, ih - VIEW_H);
    if (galZoom){
      const sp = 170 * ui.dt;
      if (keys['ArrowLeft']) galPan.x -= sp; if (keys['ArrowRight']) galPan.x += sp;
      if (keys['ArrowUp']) galPan.y -= sp; if (keys['ArrowDown']) galPan.y += sp;
    }
    galPan.x = clamp(galPan.x, 0, maxX); galPan.y = clamp(galPan.y, 0, maxY);
    const ox = iw < W ? Math.round((W - iw) / 2) : -Math.round(galPan.x);
    const oy = ih < VIEW_H ? Math.round((VIEW_H - ih) / 2) : -Math.round(galPan.y);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, SH); ctx.clip(); ctx.drawImage(im, ox, oy); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, BOT, W, SH); ctx.clip(); ctx.drawImage(im, ox, oy - SH + BOT); ctx.restore();
    // minimap, so you always know where you are when zoomed in
    if (galZoom){
      const mw = 26, mh = Math.max(8, Math.round(mw * ih / iw));
      ctx.save(); ctx.translate(W - mw - 6, BOT + 6);
      ctx.fillStyle = P.blk; ctx.fillRect(-1, -1, mw + 2, mh + 2);
      ctx.fillStyle = P.dblu; ctx.fillRect(0, 0, mw, mh);
      const vx = galPan.x / iw * mw, vy = galPan.y / ih * mh, vw = Math.min(mw, W / iw * mw), vh = Math.min(mh, VIEW_H / ih * mh);
      ctx.fillStyle = P.yel; ctx.fillRect(Math.round(vx), Math.round(vy), Math.round(vw), 1); ctx.fillRect(Math.round(vx), Math.round(vy + vh) - 1, Math.round(vw), 1);
      ctx.fillRect(Math.round(vx), Math.round(vy), 1, Math.round(vh)); ctx.fillRect(Math.round(vx + vw) - 1, Math.round(vy), 1, Math.round(vh));
      ctx.restore();
    }
  } else drawText('LOADING', Math.round((W - textW('LOADING')) / 2), 90, P.gry);
  ctx.fillStyle = P.blk; ctx.fillRect(0, SH, W, GAP);
  ctx.fillStyle = P.dblu; ctx.fillRect(0, SH, W, 1); ctx.fillRect(0, BOT - 1, W, 1);
  // caption, shown for a few seconds
  galCapT += ui.dt;
  if (galCapT < 3.4){
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * Math.min(1, (3.4 - galCapT) * 2) * 0.88;
    uiPlate(10, 6, W - 20, 25, P.blk, null, null, P.tan);
    const p = POSTERS[galSel];
    const ty = galLines(p.title, 128, 10, 56, P.yel);
    drawText(p.artist + ' - ' + p.year, Math.round(128 - textW(p.artist + ' - ' + p.year) / 2), ty, P.lblu);
    ctx.globalAlpha = pa;
  }
  // soft buttons on the touch screen
  ctx.save(); ctx.translate(0, BOT);
  const pa = ctx.globalAlpha; ctx.globalAlpha = pa * 0.92;
  uiPlate(4, SH - 17, 50, 13, UI_NORMAL[0], UI_NORMAL[1], UI_NORMAL[2], UI_NORMAL[3]);
  uiGlyph('B', 6, SH - 17); drawText('BACK', 19, SH - 13, P.wht); uiHit(2, SH - 20, 56, 18, galBack);
  const zl = galZoom ? 'ZOOM OUT' : 'ZOOM IN';
  const zw = textW(zl) + 22;
  uiPlate(W - zw - 4, SH - 17, zw, 13, UI_SELECT[0], UI_SELECT[1], UI_SELECT[2], UI_SELECT[3]);
  uiGlyph('A', W - zw - 2, SH - 17); drawText(zl, W - zw + 11, SH - 13, P.yel); uiHit(W - zw - 6, SH - 20, zw + 8, 18, galToggleZoom);
  ctx.globalAlpha = pa;
  ctx.restore();
}
