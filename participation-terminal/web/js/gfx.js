// Drawing primitives for one 256x192 DS screen.
// Everything is integer-pixel; text uses the bitmap font in font.js.
(function (PPT) {
  'use strict';

  const W = 256, H = 192;

  const C = {
    marigold: '#F4B544', marigoldD: '#C98A1E', marigoldL: '#FAD58C',
    coral: '#EE6B55', coralD: '#BF4734', coralL: '#F6A597',
    sea: '#57AFA0', seaD: '#3A8073', seaL: '#9AD2C8',
    peri: '#697BC3', periD: '#4A5A9E', periL: '#A8B3E0',
    paper: '#FFF4DB', paperD: '#F2E2BC', paperDD: '#E0CB9C',
    ink: '#34343F', inkSoft: '#6E6C78', inkFaint: '#A9A49A',
    white: '#FFFFFF', black: '#16161C',
  };

  // Answer colours are fixed across themes so that "B" is always sea glass.
  const CHOICE = [
    { base: C.coral, dark: C.coralD, light: C.coralL },
    { base: C.sea, dark: C.seaD, light: C.seaL },
    { base: C.peri, dark: C.periD, light: C.periL },
    { base: C.marigold, dark: C.marigoldD, light: C.marigoldL },
  ];
  // Comment responses read best warm-to-cool reversed: good = sea, okay = marigold, not great = coral.
  const RESPONSE = [CHOICE[1], CHOICE[3], CHOICE[0], CHOICE[2]];

  const THEMES = {
    paper: {
      name: 'Paper', bg: C.paper, dots: C.paperD, band: C.coral, bandD: C.coralD, bandText: C.white,
      text: C.ink, soft: C.inkSoft, panel: C.white, panelEdge: C.paperDD, key: C.white, keyD: C.paperDD, accent: C.seaD,
    },
    sea: {
      name: 'Sea glass', bg: '#E3F2EE', dots: '#CDE6DF', band: C.sea, bandD: C.seaD, bandText: C.white,
      text: C.ink, soft: '#5D6B6F', panel: C.white, panelEdge: '#B4D6CE', key: C.white, keyD: '#B4D6CE', accent: C.seaD,
    },
    night: {
      name: 'Night', bg: '#2A2A34', dots: '#33333F', band: C.peri, bandD: C.periD, bandText: C.white,
      text: C.paper, soft: '#B9B4C4', panel: '#3B3B48', panelEdge: '#1E1E26', key: '#4A4A59', keyD: '#1E1E26', accent: C.seaL,
    },
  };

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function contrast(a, b) {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // Pick ink or white, whichever reads better on a fill.
  function onColor(fill) {
    return contrast(fill, C.ink) >= contrast(fill, C.white) ? C.ink : C.white;
  }

  const glyphCache = new Map();
  const patternCache = new Map();
  function glyphImage(ch, color, scale) {
    const key = ch + '|' + color + '|' + scale;
    let img = glyphCache.get(key);
    if (img) return img;
    const g = PPT.Font.get(ch);
    img = document.createElement('canvas');
    img.width = Math.max(1, g.w) * scale;
    img.height = 9 * scale;
    const ctx = img.getContext('2d');
    ctx.fillStyle = color;
    g.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    glyphCache.set(key, img);
    return img;
  }

  function advance(ch) {
    return ch === ' ' ? 3 : PPT.Font.get(ch).w + 1;
  }

  function measure(str, scale = 1) {
    let w = 0;
    for (const ch of String(str)) w += advance(ch);
    return Math.max(0, w - 1) * scale;
  }

  // Word-wrap to a pixel width. Words longer than a line are broken by character.
  function wrap(str, maxW, scale = 1) {
    const out = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const cand = line ? line + ' ' + word : word;
        if (measure(cand, scale) <= maxW) { line = cand; continue; }
        if (line) out.push(line);
        line = '';
        let piece = '';
        for (const ch of word) {
          if (measure(piece + ch, scale) > maxW && piece) { out.push(piece); piece = ''; }
          piece += ch;
        }
        line = piece;
      }
      out.push(line);
    }
    return out;
  }

  function truncate(str, maxW, scale = 1) {
    str = String(str);
    if (measure(str, scale) <= maxW) return str;
    while (str.length && measure(str + '…', scale) > maxW) str = str.slice(0, -1);
    return str.replace(/\s+$/, '') + '…';
  }

  class Screen {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.W = W;
      this.H = H;
    }

    clear(color) { this.rect(0, 0, W, H, color); }

    rect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    frame(x, y, w, h, color, t = 1) {
      this.rect(x, y, w, t, color);
      this.rect(x, y + h - t, w, t, color);
      this.rect(x, y, t, h, color);
      this.rect(x + w - t, y, t, h, color);
    }

    // Pixel-rounded rectangle. r is 1..3.
    rrect(x, y, w, h, color, r = 2) {
      const inset = [[], [1], [2, 1], [3, 1, 1]][r] || [];
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      for (let i = 0; i < inset.length && i < h / 2; i++) {
        this.rect(x + inset[i], y + i, w - inset[i] * 2, 1, color);
        this.rect(x + inset[i], y + h - 1 - i, w - inset[i] * 2, 1, color);
      }
      this.rect(x, y + inset.length, w, h - inset.length * 2, color);
    }

    // Rounded outline drawn as an outer fill then an inner fill.
    rbox(x, y, w, h, fill, edge, r = 2) {
      this.rrect(x, y, w, h, edge, r);
      this.rrect(x + 1, y + 1, w - 2, h - 2, fill, Math.max(0, r - 1));
    }

    hline(x, y, w, color) { this.rect(x, y, w, 1, color); }
    vline(x, y, h, color) { this.rect(x, y, 1, h, color); }

    // Checkerboard fill, used to dim a screen under a dialog.
    dither(x, y, w, h, color) {
      let pat = patternCache.get(color);
      if (!pat) {
        const c = document.createElement('canvas');
        c.width = c.height = 2;
        const cx = c.getContext('2d');
        cx.fillStyle = color;
        cx.fillRect(0, 0, 1, 1);
        cx.fillRect(1, 1, 1, 1);
        pat = this.ctx.createPattern(c, 'repeat');
        patternCache.set(color, pat);
      }
      this.ctx.fillStyle = pat;
      this.ctx.fillRect(x, y, w, h);
    }

    // y is the top of the cap height. Returns the drawn width.
    text(str, x, y, color, scale = 1, align = 'left') {
      str = String(str);
      const w = measure(str, scale);
      let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
      y = Math.round(y);
      for (const ch of str) {
        if (ch !== ' ') this.ctx.drawImage(glyphImage(ch, color, scale), cx, y);
        cx += advance(ch) * scale;
      }
      return w;
    }

    // Text with a 1px drop shadow, used for headlines.
    stext(str, x, y, color, shadow, scale = 1, align = 'left') {
      this.text(str, x + 1, y + 1, shadow, scale, align);
      return this.text(str, x, y, color, scale, align);
    }

    // Fit text into a box: tries the largest scale first, then shrinks, then truncates.
    textBlock(str, x, y, w, h, color, opts = {}) {
      const { maxScale = 2, minScale = 1, align = 'center', valign = 'middle', gap = 0, shadow = null } = opts;
      let scale = maxScale, lines;
      for (; scale >= minScale; scale--) {
        lines = wrap(str, w, scale);
        if (lines.length * (PPT.Font.LINE_H * scale + gap) - gap - scale <= h) break;
      }
      if (scale < minScale) {
        scale = minScale;
        const lh = PPT.Font.LINE_H * scale + gap;
        const max = Math.max(1, Math.floor((h + gap + scale) / lh));
        lines = wrap(str, w, scale);
        if (lines.length > max) {
          lines = lines.slice(0, max);
          lines[max - 1] = truncate(lines[max - 1] + '…', w, scale);
        }
      }
      const lh = PPT.Font.LINE_H * scale + gap;
      const total = lines.length * lh - gap - scale;
      let ty = valign === 'middle' ? y + Math.floor((h - total) / 2) : valign === 'bottom' ? y + h - total : y;
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
      for (const line of lines) {
        if (shadow) this.stext(line, tx, ty, color, shadow, scale, align);
        else this.text(line, tx, ty, color, scale, align);
        ty += lh;
      }
      return { scale, lines: lines.length, height: total };
    }

    sprite(name, x, y, opts = {}) {
      PPT.Sprites.draw(this, name, x, y, opts);
    }
  }

  PPT.Gfx = { W, H, C, CHOICE, RESPONSE, THEMES, Screen, measure, wrap, truncate, onColor, contrast };
})(window.PPT = window.PPT || {});
