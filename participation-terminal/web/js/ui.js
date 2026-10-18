// Immediate-mode touch input for the lower screen, plus shared widgets.
// Scenes redraw every frame and declare hit regions as they draw, the same
// way a libnds main loop would poll touchRead() and redraw.
(function (PPT) {
  'use strict';

  const { C, CHOICE, measure, truncate, onColor } = PPT.Gfx;

  const UI = {
    ptr: { x: 0, y: 0, down: false },
    pressAt: null,
    releaseAt: null,
    active: null,
    inert: false,       // set while a dialog covers the scene
    holdStart: 0,

    pointerDown(x, y) { this.ptr = { x, y, down: true }; this.pressAt = { x, y }; this.releaseAt = null; },
    pointerMove(x, y) { this.ptr.x = x; this.ptr.y = y; },
    pointerUp(x, y) { this.ptr = { x, y, down: false }; this.releaseAt = { x, y }; },

    endFrame() {
      this.pressAt = null;
      if (this.releaseAt) { this.releaseAt = null; this.active = null; }
    },

    // Returns { pressed, clicked, held } for a rectangle.
    region(id, x, y, w, h, disabled) {
      const inside = (p) => p && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
      if (this.inert || disabled) return { pressed: false, clicked: false, held: 0 };
      if (inside(this.pressAt)) { this.active = id; this.holdStart = performance.now(); }
      const mine = this.active === id;
      const pressed = mine && this.ptr.down && inside(this.ptr);
      const clicked = mine && inside(this.releaseAt);
      return { pressed, clicked, held: pressed ? (performance.now() - this.holdStart) / 1000 : 0 };
    },
  };

  // ---------- widgets ----------
  const W = {};

  W.theme = () => PPT.Gfx.THEMES[(PPT.Store.state && PPT.Store.state.settings.theme) || 'paper'];

  W.bg = function (g, th = W.theme()) {
    g.clear(th.bg);
    for (let y = 4; y < 192; y += 8) for (let x = (y % 16 === 4 ? 4 : 8); x < 256; x += 8) g.rect(x, y, 1, 1, th.dots);
  };

  // Top-screen header band.
  W.header = function (g, label, opts = {}) {
    const th = W.theme();
    const band = opts.band || th.band, bandD = opts.bandD || th.bandD;
    g.rect(0, 0, 256, 16, band);
    g.rect(0, 16, 256, 2, bandD);
    const venue = PPT.Store.state ? PPT.Store.state.venue : '';
    g.text(truncate(opts.left !== undefined ? opts.left : venue, 160), 6, 4, onColor(band));
    if (label) {
      const w = measure(label) + 10;
      g.rrect(250 - w, 3, w, 11, bandD, 1);
      g.text(label, 245, 5, C.white, 1, 'right');
    }
  };

  // Draws a bevelled key face. Shared by buttons and keyboard keys.
  W.face = function (g, x, y, w, h, opts, down) {
    const th = W.theme();
    const fill = opts.color || th.key;
    const dark = opts.dark || th.keyD;
    const depth = opts.depth !== undefined ? opts.depth : h >= 30 ? 3 : 2;
    const fy = down ? y + depth - 1 : y;
    g.rrect(x, y + depth, w, h - depth, opts.disabled ? th.panelEdge : dark, 2);
    g.rrect(x, fy, w, h - depth, opts.disabled ? th.panelEdge : fill, 2);
    if (!opts.flat && !opts.disabled) g.rect(x + 3, fy + 1, w - 6, 1, opts.light || 'rgba(255,255,255,0.35)');
    const fg = opts.disabled ? th.soft : (opts.textColor || onColor(fill));
    const inner = { x: x + 4, y: fy + 2, w: w - 8, h: h - depth - 4 };
    if (opts.icon) {
      const s = PPT.Sprites.size(opts.icon);
      const isc = opts.iconScale || 1;
      const hasLabel = !!opts.label;
      const iy = hasLabel ? inner.y + Math.max(2, Math.floor((inner.h - s.h * isc - 14) / 2)) : inner.y + (inner.h - s.h * isc) / 2;
      g.sprite(opts.icon, x + (w - s.w * isc) / 2, iy, Object.assign({ scale: isc, outline: fg }, opts.iconPal || {}));
      if (hasLabel) g.text(opts.label, x + w / 2, iy + s.h * isc + 4, fg, 1, 'center');
    } else if (opts.label !== undefined) {
      g.textBlock(opts.label, inner.x, inner.y, inner.w, inner.h, fg,
        { maxScale: opts.scale || 1, minScale: 1, align: opts.align || 'center' });
    }
    if (opts.badge) {
      const bw = measure(String(opts.badge)) + 6;
      g.rrect(x + w - bw - 3, fy + 3, bw, 11, C.coral, 1);
      g.text(String(opts.badge), x + w - bw / 2 - 3, fy + 5, C.white, 1, 'center');
    }
    return { fy, depth, fg };
  };

  // A chunky bevelled button. Returns true when clicked.
  W.button = function (g, id, x, y, w, h, opts = {}) {
    const r = UI.region(id, x, y, w, h, opts.disabled);
    const { fy, depth, fg } = W.face(g, x, y, w, h, opts, r.pressed || opts.latched);
    if (opts.hold && r.pressed) {
      const p = Math.min(1, r.held / opts.hold);
      g.rect(x + 3, fy + h - depth - 5, (w - 6) * p, 2, fg);
      if (p >= 1 && !W._holdFired[id]) { W._holdFired[id] = true; return true; }
    }
    if (opts.hold) { if (!r.pressed) W._holdFired[id] = false; return false; }
    if (opts.repeat) {
      if (r.pressed && r.held > 0.45) {
        const t = performance.now();
        if (t - (W._rep[id] || 0) > 80) { W._rep[id] = t; W._repeated[id] = true; return true; }
        return false;
      }
      if (r.clicked) { const did = W._repeated[id]; W._repeated[id] = false; return !did; }
      if (!r.pressed) W._repeated[id] = false;
      return false;
    }
    return r.clicked;
  };
  W._holdFired = {};
  W._rep = {};
  W._repeated = {};

  // Admin top bar on the lower screen: back button + title (+ optional right button).
  W.topBar = function (g, title, opts = {}) {
    const th = W.theme();
    g.rect(0, 0, 256, 22, th.panel);
    g.rect(0, 22, 256, 1, th.panelEdge);
    let back = false;
    if (opts.back !== false) back = W.button(g, 'bar-back', 2, 2, 46, 19, { label: '← Back' });
    g.text(truncate(title, opts.right ? 120 : 190), opts.back === false ? 6 : 54, 8, th.text);
    let right = false;
    if (opts.right) right = W.button(g, 'bar-right', 254 - opts.rightW, 2, opts.rightW, 19,
      { label: opts.right, color: C.sea, dark: C.seaD });
    return { back, right };
  };

  W.chip = function (g, label, x, y, color) {
    const w = measure(label) + 6;
    g.rrect(x, y, w, 11, color, 1);
    g.text(label, x + 3, y + 2, onColor(color));
    return w;
  };

  W.statusColor = (s) => ({ active: C.sea, draft: C.marigold, ended: C.inkFaint, archived: C.peri,
                            new: C.coral, reviewed: C.sea }[s] || C.inkFaint);

  // Scrollable list with arrow buttons. state = { scroll }. Returns clicked index or -1.
  W.list = function (g, id, state, items, x, y, w, h, opts = {}) {
    const th = W.theme();
    const rowH = opts.rowH || 22;
    const vis = Math.floor(h / rowH);
    const max = Math.max(0, items.length - vis);
    state.scroll = Math.max(0, Math.min(state.scroll || 0, max));
    const listW = items.length > vis ? w - 22 : w;
    let hit = -1;
    if (!items.length) {
      g.textBlock(opts.empty || 'Nothing here yet.', x, y, w, h, th.soft, { maxScale: 1 });
      return -1;
    }
    for (let i = 0; i < vis && i + state.scroll < items.length; i++) {
      const idx = i + state.scroll;
      const ry = y + i * rowH;
      const r = UI.region(id + ':' + idx, x, ry, listW, rowH - 2);
      g.rrect(x, ry, listW, rowH - 2, r.pressed ? th.panelEdge : th.panel, 2);
      opts.render(g, items[idx], x + 4, ry, listW - 8, rowH - 2, idx);
      if (r.clicked) hit = idx;
    }
    if (items.length > vis) {
      const ax = x + w - 20;
      if (W.button(g, id + ':up', ax, y, 20, Math.floor(h / 2) - 2, { label: '▲', disabled: state.scroll === 0 })) state.scroll -= vis - 1;
      if (W.button(g, id + ':dn', ax, y + Math.floor(h / 2), 20, Math.floor(h / 2) - 2, { label: '▼', disabled: state.scroll >= max })) state.scroll += vis - 1;
    }
    if (PPT.App.pad('up')) state.scroll = Math.max(0, state.scroll - 1);
    if (PPT.App.pad('down')) state.scroll = Math.min(max, state.scroll + 1);
    return hit;
  };

  // Settings-style row: label left, value right. Returns clicked.
  W.row = function (g, id, x, y, w, h, label, value, opts = {}) {
    const th = W.theme();
    const r = UI.region(id, x, y, w, h, opts.disabled);
    g.rrect(x, y, w, h, r.pressed ? th.panelEdge : th.panel, 2);
    g.text(truncate(label, w - 12 - (value ? measure(String(value)) + 8 : 0)), x + 5, y + Math.floor((h - 7) / 2),
      opts.disabled ? th.soft : th.text);
    if (value !== undefined && value !== null) {
      g.text(truncate(String(value), w * 0.6), x + w - 5, y + Math.floor((h - 7) / 2), opts.valueColor || th.soft, 1, 'right');
    }
    return r.clicked;
  };

  W.easeOut = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

  // The mascot. mood: 'idle' | 'happy'
  W.tally = function (g, x, y, scale, t, opts = {}) {
    const lively = opts.lively !== false;
    let name = opts.mood === 'happy' ? 'tallyHappy' : 'tally';
    if (name === 'tally' && lively && (t % 4.2) > 4.05) name = 'tallyBlink';
    const bob = lively ? Math.round(Math.sin(t * (opts.mood === 'happy' ? 9 : 2.4)) * (opts.mood === 'happy' ? 3 : 1.5)) : 0;
    const col = opts.color || CHOICE[3];
    g.sprite(name, x, y + bob, { scale, main: col.base, shade: col.dark, flip: opts.flip });
  };

  // Results bars. progress 0..1. highlight = chosen index or -1.
  W.resultBars = function (g, labels, counts, x, y, w, h, progress, highlight = -1, palette = CHOICE) {
    const th = W.theme();
    const n = labels.length;
    const pct = PPT.percentages(counts);
    const rowH = Math.floor(h / n);
    const big = n <= 2;
    for (let i = 0; i < n; i++) {
      const ry = y + i * rowH;
      const col = palette[i % 4];
      const p = W.easeOut(progress * 1.25 - i * 0.12);
      const lbl = (i === highlight ? '✓ ' : '') + labels[i];
      const nums = Math.round(pct[i] * p) + '% — ' + counts[i] + (counts[i] === 1 ? ' vote' : ' votes');
      const numsW = measure(nums);
      const lscale = big && measure(lbl, 2) <= w - numsW - 8 ? 2 : 1;
      g.text(truncate(lbl, w - numsW - 8, lscale), x, ry + (lscale === 2 ? 0 : 1), i === highlight ? col.dark : th.text, lscale);
      g.text(nums, x + w, ry + (lscale === 2 ? 5 : 1), th.text, 1, 'right');
      const by = ry + (lscale === 2 ? 18 : 11);
      const bh = Math.max(8, Math.min(big ? 20 : 12, rowH - (by - ry) - 4));
      g.rrect(x, by, w, bh, th.panelEdge, 2);
      const fw = Math.round((w - 2) * (pct[i] / 100) * p);
      if (fw > 0) {
        g.rrect(x + 1, by + 1, Math.max(3, fw), bh - 2, col.base, 1);
        g.rect(x + 2, by + 2, Math.max(1, fw - 2), 1, col.light);
      }
      if (i === highlight) g.frame(x - 2, by - 2, w + 4, bh + 4, col.dark);
    }
  };

  // Deterministic decorative confetti.
  W.confetti = function (g, t, area = { x: 0, y: 0, w: 256, h: 192 }, density = 26) {
    const cols = [C.coral, C.sea, C.peri, C.marigold];
    for (let i = 0; i < density; i++) {
      const sx = (i * 97 + 13) % area.w;
      const speed = 18 + ((i * 37) % 23);
      const yy = (((i * 53) % area.h) + t * speed) % area.h;
      const xx = sx + Math.round(Math.sin(t * 2 + i) * 4);
      const s = 1 + (i % 2);
      g.rect(area.x + xx, area.y + yy, s + 1, s, cols[i % 4]);
    }
  };

  PPT.UI = UI;
  PPT.W = W;
})(window.PPT = window.PPT || {});
