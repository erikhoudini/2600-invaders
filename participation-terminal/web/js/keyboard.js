// Stylus keyboard for the lower screen. Used by Suggest and by admin text fields.
(function (PPT) {
  'use strict';

  const { C, measure } = PPT.Gfx;
  const { W, UI } = PPT;

  const ROWS = {
    abc: ['qwertyuiop', "asdfghjkl'", 'zxcvbnm,.?'],
    sym: ['1234567890', '-/:;()&@"#', ".,?!'%+=*$"],
  };

  function create(text = '', max = 200, opts = {}) {
    const kb = { text, max, mode: 'abc', shift: false, caps: false, autoCap: opts.autoCap !== false,
                 digitsOnly: !!opts.digitsOnly, pop: null };
    applyAutoCap(kb);
    return kb;
  }

  function applyAutoCap(kb) {
    if (!kb.autoCap || kb.caps) return;
    kb.shift = kb.text.length === 0 || /[.!?]\s$/.test(kb.text);
  }

  function type(kb, ch) {
    if (kb.text.length >= kb.max) return false;
    if (!PPT.Font.supports(ch)) return false;
    if (ch === ' ' && (kb.text === '' || kb.text.endsWith('  '))) return false;
    kb.text += ch;
    if (kb.shift && !kb.caps && /[a-zA-Z]/.test(ch)) kb.shift = false;
    applyAutoCap(kb);
    return true;
  }

  function backspace(kb) {
    kb.text = kb.text.slice(0, -1);
    applyAutoCap(kb);
  }

  // Returns 'back' | 'send' | null.
  function draw(g, kb, opts = {}) {
    const th = W.theme();
    const t = performance.now() / 1000;
    let ev = null;

    // Bar
    g.rect(0, 0, 256, 21, th.panel);
    g.rect(0, 21, 256, 1, th.panelEdge);
    if (W.button(g, 'kb-back', 2, 2, 46, 18, { label: '← Back' })) ev = 'back';
    g.text(opts.title || '', 54, 7, th.text);
    const left = kb.max - kb.text.length;
    g.text(kb.text.length + '/' + kb.max, 250, 7, left <= 10 ? C.coralD : th.soft, 1, 'right');

    // One-line preview strip with cursor (the full text is on the upper screen).
    g.rbox(4, 24, 248, 17, th.panel, th.panelEdge, 2);
    let shown = kb.text;
    while (measure(shown) > 236) shown = shown.slice(1);
    const tw = g.text(shown, 9, 29, th.text);
    if (Math.floor(t * 2) % 2 === 0) g.rect(9 + tw + (shown ? 2 : 0), 28, 1, 9, C.coral);
    if (!kb.text && opts.placeholder) g.text(opts.placeholder, 14, 29, th.soft);

    // Keys
    const rows = kb.digitsOnly ? ['123', '456', '789'] : ROWS[kb.mode];
    const upper = kb.shift || kb.caps;
    let popKey = null;
    rows.forEach((row, ri) => {
      const y = 44 + ri * 36;
      [...row].forEach((ch, ci) => {
        const x = 4 + ci * 25;
        const label = upper && kb.mode === 'abc' ? ch.toUpperCase() : ch;
        const id = 'kb-' + ri + '-' + ci;
        const r = UI.region(id, x, y, 23, 34);
        if (r.pressed) popKey = { label, x, y };
        W.face(g, x, y, 23, 34, { label, scale: 2, flat: true }, r.pressed);
        if (r.clicked) type(kb, label);
      });
    });

    const y = 152;
    const shiftOn = kb.shift || kb.caps;
    if (W.button(g, 'kb-shift', 4, y, 36, 34, { label: kb.caps ? '↑↑' : '↑', scale: 2, latched: shiftOn && kb.mode === 'abc',
                                                disabled: kb.mode !== 'abc', color: shiftOn ? C.marigoldL : undefined })) {
      if (kb.caps) { kb.caps = false; kb.shift = false; }
      else if (kb.shift && kb._lastShift && t - kb._lastShift < 0.4) { kb.caps = true; }
      else kb.shift = !kb.shift;
      kb._lastShift = t;
    }
    if (W.button(g, 'kb-mode', 42, y, 36, 34, { label: kb.mode === 'abc' ? '123' : 'abc' })) {
      kb.mode = kb.mode === 'abc' ? 'sym' : 'abc';
    }
    if (W.button(g, 'kb-space', 80, y, 96, 34, { label: 'space' })) type(kb, ' ');
    if (W.button(g, 'kb-bs', 178, y, 36, 34, { label: '←', scale: 2, color: C.paperD, dark: C.paperDD, repeat: true })) backspace(kb);
    const canSend = kb.text.trim().length > 0 || opts.allowEmpty;
    if (W.button(g, 'kb-send', 216, y, 36, 34, { label: opts.sendLabel || 'Next', color: C.sea, dark: C.seaD,
                                                 disabled: !canSend })) ev = 'send';

    // DS-style key pop-up
    if (popKey) {
      const px = Math.max(2, Math.min(222, popKey.x - 6));
      const py = Math.max(0, popKey.y - 30);
      g.rbox(px, py, 34, 32, C.white, C.ink, 2);
      g.text(popKey.label, px + 17, py + 6, C.ink, 3, 'center');
    }
    return ev;
  }

  // Physical keyboard support for prototyping speed.
  function onKey(kb, e) {
    if (e.key === 'Backspace') { backspace(kb); return 'handled'; }
    if (e.key === 'Enter') return 'send';
    if (e.key === 'Escape') return 'back';
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      if (kb.digitsOnly && !/[0-9]/.test(e.key)) return 'handled';
      const wasShift = kb.shift;
      kb.shift = false;
      type(kb, e.key);
      if (!kb.caps && wasShift && !/[a-zA-Z]/.test(e.key)) applyAutoCap(kb);
      return 'handled';
    }
    return null;
  }

  PPT.Keyboard = { create, draw, onKey, type, backspace };
})(window.PPT = window.PPT || {});
