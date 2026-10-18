// Original pixel-art sprites. Palette keys:
//   k = outline, m = main, h = highlight, s = shade, w = white, . = transparent
// Single-colour icons use only 'k' and are tinted at draw time.
(function (PPT) {
  'use strict';

  const DATA = {
    // "Tally", the terminal's speech-bubble mascot. 16x15.
    tally: [
      '....kkkkkkkk....',
      '..kkmmmmmmmmkk..',
      '.kmmhhmmmmmmmmk.',
      '.kmhhmmmmmmmmmk.',
      'kmmhmmmmmmmmmmmk',
      'kmmmmkkmmmmkkmmk',
      'kmmmmkkmmmmkkmmk',
      'kmmmmmmmmmmmmmmk',
      'kmmmmkmmmmmmkmmk',
      'kmmmmmkkkkkkmmmk',
      '.kmmmmmmmmmmmsk.',
      '..kkmmmmmmmmskk.',
      '....kkmmmskkk...',
      '....kmmkkk......',
      '....kk..........',
    ],
    tallyBlink: [
      '....kkkkkkkk....',
      '..kkmmmmmmmmkk..',
      '.kmmhhmmmmmmmmk.',
      '.kmhhmmmmmmmmmk.',
      'kmmhmmmmmmmmmmmk',
      'kmmmmmmmmmmmmmmk',
      'kmmmmkkmmmmkkmmk',
      'kmmmmmmmmmmmmmmk',
      'kmmmmkmmmmmmkmmk',
      'kmmmmmkkkkkkmmmk',
      '.kmmmmmmmmmmmsk.',
      '..kkmmmmmmmmskk.',
      '....kkmmmskkk...',
      '....kmmkkk......',
      '....kk..........',
    ],
    tallyHappy: [
      '....kkkkkkkk....',
      '..kkmmmmmmmmkk..',
      '.kmmhhmmmmmmmmk.',
      '.kmhhmmmmmmmmmk.',
      'kmmhmmmmmmmmmmmk',
      'kmmmmkkmmmmkkmmk',
      'kmmmkmmkmmkmmkmk',
      'kmmmmmmmmmmmmmmk',
      'kmmmmkkkkkkkkmmk',
      'kmmmmmkssssskmmk',
      '.kmmmmmkkkkkmsk.',
      '..kkmmmmmmmmskk.',
      '....kkmmmskkk...',
      '....kmmkkk......',
      '....kk..........',
    ],

    // 9x10 icons
    bulb: [
      '..kkkkk..',
      '.kmmmmmk.',
      'kmmhmmmmk',
      'kmhmmmmmk',
      'kmmmmmmmk',
      '.kmmmmmk.',
      '..kmmmk..',
      '..kkkkk..',
      '..ksssk..',
      '...kkk...',
    ],
    speech: [
      '.kkkkkkk.',
      'kmmmmmmmk',
      'kmwwwwwmk',
      'kmmmmmmmk',
      'kmwwwmmmk',
      'kmmmmmmmk',
      '.kkmkkkk.',
      '..kmk....',
      '..kk.....',
    ],
    ballot: [
      'kkkkkkkkk',
      'kwwwwwwwk',
      'kwwwwwkwk',
      'kwwwwkwwk',
      'kwkwkwwwk',
      'kwwkwwwwk',
      'kwwwwwwwk',
      'kkkkkkkkk',
    ],

    // Single-colour admin icons
    iconBars: [
      '......kk.',
      '......kk.',
      '...kk.kk.',
      '...kk.kk.',
      'kk.kk.kk.',
      'kk.kk.kk.',
      'kk.kk.kk.',
      'kkkkkkkkk',
    ],
    iconInbox: [
      'kkkkkkkkk',
      'kk.....kk',
      'k.k...k.k',
      'k..k.k..k',
      'k...k...k',
      'k.......k',
      'kkkkkkkkk',
    ],
    iconClock: [
      '..kkkkk..',
      '.k.....k.',
      'k...k...k',
      'k...k...k',
      'k...kkk.k',
      'k.......k',
      '.k.....k.',
      '..kkkkk..',
    ],
    iconStar: [
      '....k....',
      '...kkk...',
      'kkkkkkkkk',
      '.kkkkkkk.',
      '..kkkkk..',
      '..kk.kk..',
      '.kk...kk.',
    ],
    iconCard: [
      '..kkkkkkk',
      '.kk.k.k.k',
      'kkk.k.k.k',
      'k.......k',
      'k.......k',
      'k.......k',
      'k.......k',
      'kkkkkkkkk',
    ],
    iconGear: [
      '....k....',
      '.k.kkk.k.',
      '..kkkkk..',
      'kkkk.kkkk',
      '..kkkkk..',
      '.k.kkk.k.',
      '....k....',
    ],
    iconLock: [
      '..kkk..',
      '.k...k.',
      '.k...k.',
      'kkkkkkk',
      'kkk.kkk',
      'kkk.kkk',
      'kkkkkkk',
    ],

    // Decorative pictogram figure, 5x8. Never used as a count of people.
    figure: [
      '.kkk.',
      '.kkk.',
      '..k..',
      'kkkkk',
      '.kkk.',
      '.kkk.',
      '.k.k.',
      '.k.k.',
    ],
  };

  const cache = new Map();

  function size(name) {
    const d = DATA[name];
    return { w: d[0].length, h: d.length };
  }

  // opts: scale, main, shade, hi, outline, flip
  function draw(screen, name, x, y, opts = {}) {
    const d = DATA[name];
    if (!d) return;
    const C = PPT.Gfx.C;
    const scale = opts.scale || 1;
    const pal = {
      k: opts.outline || C.ink,
      m: opts.main || C.marigold,
      h: opts.hi || C.white,
      s: opts.shade || C.marigoldD,
      w: opts.white || C.white,
    };
    const key = [name, scale, pal.k, pal.m, pal.h, pal.s, pal.w, !!opts.flip].join('|');
    let img = cache.get(key);
    if (!img) {
      img = document.createElement('canvas');
      img.width = d[0].length * scale;
      img.height = d.length * scale;
      const ctx = img.getContext('2d');
      d.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const c = pal[row[rx]];
          if (!c) continue;
          ctx.fillStyle = c;
          const px = opts.flip ? row.length - 1 - rx : rx;
          ctx.fillRect(px * scale, ry * scale, scale, scale);
        }
      });
      cache.set(key, img);
    }
    screen.ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  PPT.Sprites = { DATA, draw, size };
})(window.PPT = window.PPT || {});
