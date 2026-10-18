// "Tally", the terminal's mascot.
//
// The body is a procedurally rasterised speech bubble, so it can squash and
// stretch while staying pixel-crisp. Face, floating mitten hands, props and
// effects are tiny pixel patterns layered on top. Everything is drawn into a
// small logical buffer and blitted at an integer pixel scale.
//
// Each on-screen appearance is an Actor (keyed, so it keeps its own blink and
// animation timers across frames). A scene picks a mood; one-shot actions
// (hop, wave, shake ...) layer over it; touches on the lower screen make
// every visible Tally glance towards the stylus.
(function (PPT) {
  'use strict';

  const { C } = PPT.Gfx;

  const BW = 72, BH = 64;      // logical buffer
  const AX = 36, AY = 56;      // ground anchor inside the buffer
  const W0 = 20, H0 = 18;      // resting body size
  const HA = W0 / 2, HB = 8;   // half sizes used for hand placement

  // Pixel patterns. k ink, m main, s shade, h highlight, w white, r mouth,
  // x effect colour, '.' transparent.
  const P = {
    eyeOpen: ['kw', 'kk', 'kk'],
    eyeBlink: ['kk'],
    eyeHappy: ['.k.', 'k.k'],
    eyeSleep: ['kkk'],
    eyeWide: ['.kk.', 'kkwk', 'kkkk', '.kk.'],
    eyeStar: ['.k.', 'kwk', '.k.'],
    eyeSqueezeL: ['k..', '.kk', 'k..'],
    eyeSqueezeR: ['..k', 'kk.', '..k'],

    mouthSmile: ['k....k', '.kkkk.'],
    mouthSmirk: ['k..k', '.kk.'],
    mouthGrin: ['kkkkkk', 'krrrrk', '.krrk.', '..kk..'],
    mouthO: ['.kk.', 'krrk', '.kk.'],
    mouthOSmall: ['.k.', 'k.k', '.k.'],
    mouthFlat: ['kkkk'],
    mouthWobble: ['k.k.k', '.k.k.'],
    mouthSad: ['.kkkk.', 'k....k'],

    hand: ['.kk.', 'kmmk', 'kmmk', '.kk.'],
    point: ['.kk.', 'kmmk', 'kmmk', '.kmk', '.kmk', '..k.'],
    tail: ['.kmmk', 'kmmk.', 'kmk..', 'kk...'],
    shine: ['.hh', 'h..'],

    sparkleBig: ['..x..', '..x..', 'xxwxx', '..x..', '..x..'],
    sparkleSmall: ['.x.', 'xwx', '.x.'],
    heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],
    zee: ['kkkk', '..k.', '.k..', 'kkkk'],
    drop: ['.x.', '.x.', 'xxx', 'xwx', '.x.'],
    exclaim: ['kk', 'kk', 'kk', '..', 'kk'],
    question: ['.kkk.', 'k...k', '...k.', '..k..', '.....', '..k..'],
    card: ['kkkkkkkk', 'kxxxxxxk', 'kxxxxwxk', 'kxxxwxxk', 'kxwwxxxk', 'kxxwxxxk', 'kkkkkkkk'],
  };

  const EYES = {
    open: { p: P.eyeOpen, dx: 0, dy: 0 },
    blink: { p: P.eyeBlink, dx: 0, dy: 1 },
    happy: { p: P.eyeHappy, dx: 0, dy: 0 },
    sleep: { p: P.eyeSleep, dx: 0, dy: 2 },
    wide: { p: P.eyeWide, dx: -1, dy: -1 },
    star: { p: P.eyeStar, dx: 0, dy: 0 },
  };
  const MOUTHS = { smile: P.mouthSmile, smirk: P.mouthSmirk, grin: P.mouthGrin, o: P.mouthO, oSmall: P.mouthOSmall,
                   flat: P.mouthFlat, wobble: P.mouthWobble, sad: P.mouthSad };

  const DUR = { hop: 0.55, jump: 0.9, wave: 1.6, point: 1.8, nod: 0.28, shake: 0.55, surprise: 0.75, enter: 0.65 };

  const now = () => performance.now() / 1000;
  const rand = (n) => Math.floor(Math.random() * n);

  let lastPoke = { x: 128, y: 96, t: -99 };

  function level() {
    const s = PPT.Store && PPT.Store.state;
    const v = s ? s.settings.idle : 'lively';
    return v === 'off' ? 0 : v === 'calm' ? 1 : 2;
  }

  // ---------- rendering ----------
  const buf = document.createElement('canvas');
  buf.width = BW;
  buf.height = BH;
  const bx = buf.getContext('2d');

  function pat(rows, x, y, pal) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const col = pal[row[c]];
        if (!col) continue;
        bx.fillStyle = col;
        bx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }
  function dot(x, y, color, w = 1, h = 1) {
    bx.fillStyle = color;
    bx.fillRect(x, y, w, h);
  }

  const bodyCache = new Map();
  function body(w, h, pal) {
    const key = w + 'x' + h + pal.m + pal.s + pal.k;
    let c = bodyCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const a = w / 2, b = h / 2, cx = (w - 1) / 2, cy = (h - 1) / 2, n = 2.5;
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h &&
      Math.pow(Math.abs((x - cx) / a), n) + Math.pow(Math.abs((y - cy) / b), n) <= 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        let col = pal.m;
        if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) col = pal.k;
        else if ((x > cx && !inside(x + 2, y)) || (y > cy && !inside(x, y + 2))) col = pal.s;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    bodyCache.set(key, c);
    return c;
  }

  function render(g, x, gy, px, p, o) {
    const pal = {
      k: o.outline || C.ink, m: o.main || C.marigold, s: o.shade || C.marigoldD, h: C.white, w: C.white,
      r: C.coralD, x: C.coral,
    };
    const fg = o.fg || C.ink;
    bx.clearRect(0, 0, BW, BH);

    const bw = Math.round(W0 * (1 + p.k));
    const bh = Math.round(H0 * (1 - p.k));
    const left = AX - Math.floor(bw / 2) + p.dx;
    const top = AY - bh - p.jump;
    const ccx = left + Math.floor(bw / 2);
    const cy = top + Math.floor(bh / 2);

    // Ground shadow shrinks as Tally leaves the ground.
    if (o.shadow !== false) {
      const sc = o.shadowColor || C.paperDD;
      const sw = Math.max(6, Math.round(bw * 0.8 - p.jump * 0.6));
      dot(AX - Math.floor(sw / 2) + p.dx, AY, sc, sw, 1);
      dot(AX - Math.floor(sw / 2) + 2 + p.dx, AY + 1, sc, Math.max(2, sw - 4), 1);
    }

    pat(P.tail, ccx - Math.round(bw * 0.3) - 2, top + bh - 1, pal);
    bx.drawImage(body(bw, bh, pal), left, top);
    pat(P.shine, ccx - Math.round(bw * 0.28) - 1, top + 2, pal);

    // Face
    const ex = Math.max(3, Math.round(bw * 0.21));
    const ey = top + Math.round(bh * 0.3) + p.look.y;
    const lx = ccx - ex - 1 + p.look.x;
    const rx = ccx + ex - 1 + p.look.x;
    if (p.eyes === 'squeeze') {
      pat(P.eyeSqueezeL, lx - 1, ey, pal);
      pat(P.eyeSqueezeR, rx, ey, pal);
    } else {
      const eye = EYES[p.eyes] || EYES.open;
      pat(eye.p, lx + eye.dx, ey + eye.dy, pal);
      pat(eye.p, rx + eye.dx, ey + eye.dy, pal);
    }
    if (p.brows === 'worry') {
      dot(lx - 1, ey - 2, pal.k); dot(lx, ey - 2, pal.k); dot(lx + 1, ey - 3, pal.k);
      dot(rx + 2, ey - 2, pal.k); dot(rx + 1, ey - 2, pal.k); dot(rx, ey - 3, pal.k);
    } else if (p.brows === 'up') {
      dot(lx - 1, ey - 3, pal.k, 3, 1);
      dot(rx, ey - 3, pal.k, 3, 1);
    }
    if (p.blush) {
      dot(lx - 2, ey + 3, C.coralL, 2, 1);
      dot(rx + 2, ey + 3, C.coralL, 2, 1);
    }
    const mouth = MOUTHS[p.mouth] || MOUTHS.smile;
    pat(mouth, ccx - Math.floor(mouth[0].length / 2) + Math.round(p.look.x / 2), top + Math.round(bh * 0.62), pal);

    // Prop
    if (p.prop) {
      const pr = p.prop;
      const size = pr.name === 'card' ? { w: 8, h: 7 } : PPT.Sprites.size(pr.name);
      const bob = pr.bob || 0;
      let pxl, pyl;
      if (pr.at === 'side') { pxl = ccx + HA + 4; pyl = cy - size.h + 1 + bob; }
      else { pxl = ccx - Math.floor(size.w / 2); pyl = top - size.h - 1 + bob; }
      if (pr.name === 'card') pat(P.card, pxl, pyl, Object.assign({}, pal, { x: pr.color || C.sea }));
      else PPT.Sprites.draw({ ctx: bx }, pr.name, pxl, pyl, { main: pr.main || C.marigoldL, shade: pr.shade || C.marigold, outline: pal.k, white: pr.white });
    }

    // Hands (after face so they can cover the eyes)
    for (const h of [p.hl, p.hr]) {
      if (!h) continue;
      pat(h[2] === 'point' ? P.point : P.hand, ccx + h[0] - 2, cy + h[1] - 2, pal);
    }

    // Effects
    for (const f of p.fx) drawFx(f, ccx, top, bw, bh, pal, fg);

    g.ctx.drawImage(buf, 0, 0, BW, BH, Math.round(x - AX * px), Math.round(gy - AY * px), BW * px, BH * px);
  }

  const FX_COLORS = [C.coral, C.sea, C.peri, C.marigold];
  function drawFx(f, ccx, top, bw, bh, pal, fg) {
    const t = f.t;
    const ink = Object.assign({}, pal, { k: fg });
    if (f.type === 'sparkles') {
      for (let i = 0; i < 3; i++) {
        const ang = t * 1.4 + i * 2.1;
        const x = Math.round(ccx + Math.cos(ang) * (bw / 2 + 7)) - 2;
        const y = Math.round(top + bh / 2 + Math.sin(ang) * (bh / 2 + 5)) - 2;
        const big = (Math.floor(t * 3) + i) % 3 === 0;
        pat(big ? P.sparkleBig : P.sparkleSmall, big ? x : x + 1, big ? y : y + 1, Object.assign({}, pal, { x: FX_COLORS[i] }));
      }
    } else if (f.type === 'hearts') {
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.55 + i * 0.5) % 1;
        if (ph > 0.85) continue;
        const x = i ? ccx + bw / 2 + 1 : ccx - bw / 2 - 6;
        pat(P.heart, Math.round(x + Math.sin(ph * 6) * 1.5), Math.round(top - 2 - ph * 14), Object.assign({}, pal, { x: C.coral }));
      }
    } else if (f.type === 'zzz') {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.45 + i / 3) % 1;
        if (ph > 0.9) continue;
        pat(P.zee, Math.round(ccx + bw / 2 - 3 + ph * 9), Math.round(top + 1 - ph * 18), ink);
      }
    } else if (f.type === 'drop') {
      pat(P.drop, ccx + Math.floor(bw / 2) - 3, top + 1 + Math.floor(f.phase * 5), Object.assign({}, pal, { x: C.seaL }));
    } else if (f.type === 'exclaim') {
      pat(P.exclaim, ccx + Math.floor(bw / 2) - 1, top - 8, ink);
    } else if (f.type === 'question') {
      pat(P.question, ccx + Math.floor(bw / 2) - 2, top - 9 + (Math.floor(t * 2) % 2), ink);
    } else if (f.type === 'think') {
      for (let i = 0; i < f.n; i++) dot(ccx + bw / 2 + i * 3, top - 1 - i * 3, fg, 2, 2);
    }
  }

  // ---------- behaviour ----------
  class Actor {
    constructor() { this.reset(); }

    reset() {
      const t = now();
      this.action = null;
      this.nextBlink = t + 0.8 + Math.random() * 2;
      this.blinkUntil = 0;
      this.nextGlance = t + 2 + Math.random() * 3;
      this.glance = null;
      this.nextAttract = t + 2.5 + Math.random() * 3;
      this.seenPoke = lastPoke.t;
      this.mood = null;
      this.moodSince = t;
      return this;
    }

    play(name) {
      this.action = { name, start: now(), dur: DUR[name] || 0.6 };
      return this;
    }

    draw(g, x, gy, px, o = {}) {
      render(g, x, gy, px, this.pose(now(), o), o);
    }

    pose(t, o) {
      const lvl = o.level !== undefined ? o.level : level();
      const mood = o.mood || 'idle';
      if (mood !== this.mood) { this.mood = mood; this.moodSince = t; }
      const T = t - this.moodSince;
      const p = { k: 0, jump: 0, dx: 0, eyes: 'open', look: { x: 0, y: 0 }, brows: null, mouth: 'smile', blush: false,
                  hl: [-HA - 1, 3, 'hand'], hr: [HA, 3, 'hand'], prop: o.prop ? Object.assign({}, o.prop) : null, fx: [] };

      // Ambient life: breathing, blinking, glancing, following the stylus.
      if (lvl >= 1) {
        if (Math.sin(t * 2.2) > 0.55) p.k = 0.07;
        if (t >= this.nextBlink) {
          this.blinkUntil = t + 0.13;
          this.nextBlink = t + (Math.random() < 0.2 ? 0.3 : 2.2 + Math.random() * 3.2);
        }
        if (lvl >= 2 && t >= this.nextGlance) {
          const dirs = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
          this.glance = Object.assign({ until: t + 0.7 + Math.random() * 0.8 }, dirs[rand(dirs.length)]);
          this.nextGlance = t + 3 + Math.random() * 4;
        }
        if (this.glance && t < this.glance.until) p.look = { x: this.glance.x, y: this.glance.y };
        if (lastPoke.t > this.seenPoke) {
          this.seenPoke = lastPoke.t;
          if (!this.action) this.play('nod');
        }
        if (t - lastPoke.t < 1.2) p.look = { x: lastPoke.x < 96 ? -1 : lastPoke.x > 160 ? 1 : 0, y: 1 };
        if (p.prop) p.prop.bob = Math.sin(t * 3) > 0 ? 0 : 1;
      } else {
        this.action = null;
      }

      switch (mood) {
        case 'invite':
          if (lvl >= 2 && !this.action && t >= this.nextAttract) {
            const pool = o.longIdle ? ['jump', 'wave', 'point', 'wave'] : ['wave', 'point', 'hop'];
            this.play(pool[rand(pool.length)]);
            this.nextAttract = t + (o.longIdle ? 5 : 7) + Math.random() * 4;
          }
          break;
        case 'happy':
          p.eyes = 'happy'; p.mouth = 'grin'; p.blush = true;
          break;
        case 'celebrate': {
          p.eyes = 'happy'; p.mouth = 'grin'; p.blush = true;
          const bob = lvl >= 1 ? (Math.floor(t * 6) % 2) : 0;
          p.hl = [-HA - 3, -HB - 1 + bob, 'hand'];
          p.hr = [HA + 2, -HB - bob, 'hand'];
          if (lvl >= 2 && !this.action && t >= this.nextAttract) { this.play('jump'); this.nextAttract = t + 2.4; }
          if (lvl >= 1) p.fx.push({ type: o.fx || 'sparkles', t });
          break;
        }
        case 'think':
          p.hr = [3, 7, 'hand'];
          if (t - lastPoke.t >= 1.2) p.look = { x: -1, y: -1 };
          p.mouth = 'smirk';
          if (lvl >= 1) p.fx.push({ type: 'think', n: 1 + (Math.floor(t * 2) % 3) });
          break;
        case 'listen':
          if (t - lastPoke.t >= 1.2) p.look = { x: 0, y: 1 };
          p.eyes = o.wide ? 'wide' : 'open';
          p.mouth = o.wide ? 'o' : 'smile';
          break;
        case 'worried':
          p.brows = 'worry'; p.mouth = 'wobble';
          p.hl = [-HA + 2, 6, 'hand']; p.hr = [HA - 3, 6, 'hand'];
          if (lvl >= 1) p.fx.push({ type: 'drop', phase: (T * 0.7) % 1 });
          break;
        case 'sad':
          p.brows = 'worry'; p.mouth = 'sad'; p.look = { x: 0, y: 1 };
          break;
        case 'sleep':
          p.eyes = 'sleep'; p.mouth = 'oSmall';
          p.k = lvl >= 1 && Math.sin(t * 1.3) > 0 ? 0.09 : 0;
          p.hl = [-HA, 5, 'hand']; p.hr = [HA - 1, 5, 'hand'];
          p.look = { x: 0, y: 0 };
          if (lvl >= 1) p.fx.push({ type: 'zzz', t });
          break;
        case 'shy':
          // Eyes squeezed shut, paws up: "not looking!"
          p.eyes = 'squeeze'; p.hl = [-HA + 1, -3, 'hand']; p.hr = [HA - 2, -3, 'hand'];
          p.blush = true; p.mouth = 'smirk'; p.look = { x: 0, y: 0 };
          break;
        case 'peek':
          if (t - lastPoke.t >= 1.2) p.look = { x: Math.sin(T * 2.4) > 0 ? 1 : -1, y: 0 };
          p.mouth = 'o';
          p.hr = [HA + 2, -HB + (Math.floor(t * 5) % 2), 'hand'];
          p.fx.push({ type: 'question', t });
          break;
        case 'shrug':
          p.hl = [-HA - 4, -3, 'hand']; p.hr = [HA + 3, -3, 'hand'];
          p.brows = 'up'; p.mouth = 'flat';
          break;
        case 'present':
          p.hr = [HA + 3, 1, 'hand'];
          if (p.prop) p.prop.at = 'side';
          break;
        case 'hold':
          p.hl = [-6, -HB - 3, 'hand']; p.hr = [5, -HB - 3, 'hand'];
          break;
        default:
          break;
      }
      if (o.eyes) p.eyes = o.eyes;
      if (o.mouth) p.mouth = o.mouth;
      if (o.lookAt) p.look = o.lookAt;

      if (t < this.blinkUntil && (p.eyes === 'open' || p.eyes === 'wide') && mood !== 'shy') p.eyes = 'blink';

      if (this.action) {
        const q = (t - this.action.start) / this.action.dur;
        if (q >= 1) this.action = null;
        else applyAction(p, this.action.name, q, t);
      }
      return p;
    }
  }

  function arc(p, q, h) {
    if (q < 0.18) p.k = 0.16;
    else if (q < 0.82) { p.jump = Math.round(h * Math.sin(Math.PI * (q - 0.18) / 0.64)); p.k = -0.1; }
    else p.k = 0.16 * (1 - (q - 0.82) / 0.18);
  }

  function applyAction(p, name, q, t) {
    switch (name) {
      case 'hop': arc(p, q, 4); break;
      case 'jump':
        arc(p, q, 7);
        p.eyes = 'happy'; p.mouth = 'grin'; p.blush = true;
        if (q > 0.15 && q < 0.85) { p.hl = [-HA - 3, -HB - 1, 'hand']; p.hr = [HA + 2, -HB - 1, 'hand']; }
        break;
      case 'wave': {
        const up = Math.floor(t * 7) % 2;
        p.hr = [HA + 2 + up, -HB + 1 + up, 'hand'];
        p.mouth = 'grin';
        if (q > 0.15 && q < 0.85) p.eyes = 'happy';
        break;
      }
      case 'point':
        p.hr = [HA - 1, 7 + (Math.floor(t * 4) % 2), 'point'];
        p.look = { x: 1, y: 1 };
        p.mouth = q < 0.3 ? 'o' : 'smile';
        break;
      case 'nod':
        p.k = 0.12 * Math.sin(Math.PI * q);
        p.look = { x: p.look.x, y: 1 };
        break;
      case 'shake':
        p.dx = Math.round(Math.sin(q * Math.PI * 6) * 1.5);
        p.mouth = 'flat'; p.brows = 'worry'; p.eyes = 'open';
        break;
      case 'surprise':
        p.eyes = 'wide'; p.mouth = 'o';
        p.fx.push({ type: 'exclaim', t });
        if (q < 0.35) p.jump = Math.round(3 * Math.sin(Math.PI * q / 0.35));
        break;
      case 'enter':
        if (q < 0.6) { const r = q / 0.6; p.jump = Math.round((1 - r) * (1 - r) * 26); p.k = -0.12; }
        else p.k = 0.2 * (1 - (q - 0.6) / 0.4);
        break;
      default: break;
    }
  }

  const actors = new Map();

  PPT.Tally = {
    P,
    get(key) {
      let a = actors.get(key);
      if (!a) { a = new Actor(); actors.set(key, a); }
      return a;
    },
    poke(x, y) { lastPoke = { x, y, t: now() }; },
    // Height above the ground line at a given pixel scale, for layout.
    height(px) { return (H0 + 3) * px; },
  };
})(window.PPT = window.PPT || {});
