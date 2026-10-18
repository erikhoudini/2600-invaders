// Scene manager, main loop, hardware-button simulation, timeouts and overlays.
(function (PPT) {
  'use strict';

  const { C, Screen, onColor } = PPT.Gfx;
  const { UI, W, Store, SD } = PPT;

  const STILL_THERE_SECONDS = 10;
  const ADMIN_HOLD_SECONDS = 1.5;
  const CORNER_HOLD_SECONDS = 3;
  const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'];
  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', x: 'a', z: 'b',
                   s: 'x', a: 'y', q: 'l', w: 'r', Enter: 'start', Shift: 'select' };

  const App = {
    stack: [],
    admin: false,
    dialog: null,
    still: null,
    toastMsg: null,
    lastInput: performance.now(),
    btn: {},
    btnPrev: {},
    lrSince: 0,
    cornerSince: 0,
    lastTick: 0,
    halted: false,

    init(topCanvas, bottomCanvas) {
      this.top = new Screen(topCanvas);
      this.bot = new Screen(bottomCanvas);
      BUTTONS.forEach((b) => { this.btn[b] = false; this.btnPrev[b] = false; });
      this._bindInput(bottomCanvas);
      try { Store.boot(); } catch (e) { if (e instanceof SD.PowerCut) return this.halt(); throw e; }
      this.go(Store.ok ? 'landing' : 'nosd');
      requestAnimationFrame((t) => this.frame(t));
    },

    // ---------- navigation ----------
    make(name, args) {
      const factory = PPT.Scenes[name];
      if (!factory) throw new Error('No scene ' + name);
      const s = factory(args || {});
      s.name = name;
      s._t0 = performance.now();
      return s;
    },
    scene() { return this.stack[this.stack.length - 1]; },
    go(name, args) { this.stack = [this.make(name, args)]; this.dialog = null; this.still = null; },
    push(name, args) { this.stack.push(this.make(name, args)); },
    replace(name, args) { this.stack[this.stack.length - 1] = this.make(name, args); },
    pop(result) {
      if (this.stack.length > 1) this.stack.pop();
      const s = this.scene();
      if (s.onResume) s.onResume(result);
    },

    enterAdmin() {
      UI.active = null;
      if (!Store.ok) { this.go('diag'); return; }
      this.go('pin', { purpose: 'unlock' });
    },
    lock() {
      this.admin = false;
      this.go('landing');
    },

    // ---------- overlays ----------
    confirm(opts) { this.dialog = Object.assign({ cancel: 'Cancel', confirm: 'OK' }, opts); },
    alert(title, body) { this.dialog = { title, body, confirm: 'OK', single: true }; },
    toast(msg) { this.toastMsg = { msg, until: performance.now() + 2200 }; },

    // Run a storage action from an admin screen and report failures without crashing.
    // Returns the action's result (true if it had none), or undefined on failure.
    attempt(fn, okMsg) {
      try {
        const r = fn();
        if (okMsg) this.toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
        return r === undefined ? true : r;
      } catch (e) {
        if (e instanceof SD.PowerCut) { this.halt(); return undefined; }
        this.alert('Not saved', 'Storage error: ' + e.message + '. Nothing was changed.');
        return undefined;
      }
    },

    pad(name) { return this.btn[name] && !this.btnPrev[name]; },
    setButton(name, down) {
      if (down && !this.btn[name]) this.touchInput();
      this.btn[name] = down;
    },
    touchInput() { this.lastInput = performance.now(); },

    halt() {
      this.halted = true;
      this.top.clear(C.black);
      this.bot.clear(C.black);
    },

    // ---------- input ----------
    _bindInput(canvas) {
      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return [Math.floor(((e.clientX - r.left) / r.width) * 256), Math.floor(((e.clientY - r.top) / r.height) * 192)];
      };
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        const [x, y] = pos(e);
        UI.pointerDown(x, y);
        PPT.Tally.poke(x, y);
        this.touchInput();
        this.cornerSince = x < 12 && y < 12 ? performance.now() : 0;
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', (e) => { const [x, y] = pos(e); UI.pointerMove(x, y); });
      canvas.addEventListener('pointerup', (e) => { const [x, y] = pos(e); UI.pointerUp(x, y); this.cornerSince = 0; });
      canvas.addEventListener('pointercancel', () => { UI.pointerUp(-1, -1); this.cornerSince = 0; });

      window.addEventListener('keydown', (e) => {
        if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        this.touchInput();
        const s = this.scene();
        if (!this.dialog && !this.still && s && s.onKey && s.onKey(e)) { e.preventDefault(); return; }
        const b = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase && e.key.toLowerCase()];
        if (b) { this.setButton(b, true); e.preventDefault(); }
      });
      window.addEventListener('keyup', (e) => {
        const b = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase && e.key.toLowerCase()];
        if (b) this.setButton(b, false);
      });
      window.addEventListener('blur', () => BUTTONS.forEach((b) => (this.btn[b] = false)));
    },

    // ---------- loop ----------
    frame(now) {
      if (this.halted) return;
      requestAnimationFrame((t) => this.frame(t));
      try {
        this._frame(now);
      } catch (e) {
        if (e instanceof SD.PowerCut) { this.halt(); return; }
        console.error(e);
      }
      UI.endFrame();
      BUTTONS.forEach((b) => (this.btnPrev[b] = this.btn[b]));
    },

    _frame(now) {
      const s = this.scene();
      const idle = (now - this.lastInput) / 1000;

      // Staff gesture: hold L+R, or hold the top-left corner of the touchscreen.
      if (s.public) {
        if (this.btn.l && this.btn.r) {
          this.lrSince = this.lrSince || now;
          if ((now - this.lrSince) / 1000 >= ADMIN_HOLD_SECONDS) { this.lrSince = 0; this.enterAdmin(); return; }
        } else this.lrSince = 0;
        if (this.cornerSince && UI.ptr.down && (now - this.cornerSince) / 1000 >= CORNER_HOLD_SECONDS) {
          this.cornerSince = 0; this.enterAdmin(); return;
        }
      }

      // Calendar: apply today's scheduled poll and closed hours, about once a second.
      if (Store.ok && now - this.lastTick > 1000) {
        this.lastTick = now;
        try { Store.tickSchedule(); } catch (e) { if (e instanceof SD.PowerCut) throw e; }
        const resting = Store.restNow();
        if (resting && s.name === 'landing' && s.public) { this.go('resting'); return; }
        if (!resting && s.name === 'resting') { this.go('landing'); return; }
      }

      // Admin auto-lock.
      if (this.admin && Store.ok && idle > Store.state.settings.adminTimeout) { this.lock(); return; }

      // Abandoned public interaction.
      if (s.timed && !this.dialog && Store.ok) {
        if (!this.still && idle > Store.state.settings.sessionTimeout) {
          this.still = { since: now };
          PPT.Tally.get('still').reset().play('surprise');
        }
      }
      if (this.still && (now - this.still.since) / 1000 > STILL_THERE_SECONDS) {
        this.still = null;
        if (s.abandon) s.abandon();
        this.go('landing');
        return;
      }

      if (this.pad('b') && !this.dialog && !this.still && s.back) s.back();

      const t = (now - s._t0) / 1000;
      UI.inert = !!(this.dialog || this.still);
      s.top(this.top, t);
      s.bottom(this.bot, t);
      UI.inert = false;

      if (this.dialog) this._drawDialog(now);
      if (this.still) this._drawStill(now);
      if (this.toastMsg && now < this.toastMsg.until) {
        const th = W.theme();
        this.bot.rrect(16, 168, 224, 20, C.ink, 2);
        this.bot.textBlock(this.toastMsg.msg, 20, 170, 216, 16, C.white, { maxScale: 1 });
      }
    },

    _dim(g) {
      g.dither(0, 0, 256, 192, C.black);
    },

    _drawDialog() {
      const d = this.dialog;
      const g = this.top, b = this.bot;
      const th = W.theme();
      this._dim(g);
      g.rbox(16, 24, 224, 144, th.panel, d.danger ? C.coralD : C.ink, 3);
      g.rect(17, 25, 222, 20, d.danger ? C.coral : C.ink);
      g.text(d.title, 128, 32, C.white, 1, 'center');
      g.textBlock(d.body || '', 26, 52, 204, 108, th.text, { maxScale: 1 });

      this._dim(b);
      const close = (fn) => { this.dialog = null; if (fn) fn(); };
      if (d.single) {
        if (W.button(b, 'dlg-ok', 48, 120, 160, 50, { label: d.confirm, scale: 2, color: C.sea, dark: C.seaD })) close(d.onConfirm);
        return;
      }
      if (W.button(b, 'dlg-cancel', 8, 120, 116, 56, { label: d.cancel, scale: 2 })) close(d.onCancel);
      const cColor = d.danger ? C.coral : C.sea, cDark = d.danger ? C.coralD : C.seaD;
      const label = d.hold ? 'Hold to ' + d.confirm.toLowerCase() : d.confirm;
      if (W.button(b, 'dlg-ok', 132, 120, 116, 56, { label, scale: d.hold ? 1 : 2, color: cColor, dark: cDark, hold: d.hold })) {
        close(d.onConfirm);
      }
    },

    _drawStill(now) {
      const g = this.top, b = this.bot;
      const left = Math.max(0, Math.ceil(STILL_THERE_SECONDS - (now - this.still.since) / 1000));
      this._dim(g);
      g.rbox(28, 40, 200, 112, C.paper, C.ink, 3);
      W.mascot(g, 'still', 128, 92, 2, { mood: 'peek', shadowColor: C.paperDD, fg: C.ink });
      g.text('Still there?', 128, 100, C.ink, 2, 'center');
      g.text('Starting over in ' + left + '…', 128, 126, C.inkSoft, 1, 'center');
      this._dim(b);
      if (W.button(b, 'still-here', 24, 40, 208, 70, { label: "I'm still here", scale: 2, color: C.sea, dark: C.seaD })) {
        this.still = null;
        this.touchInput();
      }
      if (W.button(b, 'still-reset', 64, 124, 128, 34, { label: 'Start over' })) {
        const s = this.scene();
        this.still = null;
        if (s.abandon) s.abandon();
        this.go('landing');
      }
    },
  };

  PPT.App = App;
  PPT.Scenes = PPT.Scenes || {};
})(window.PPT = window.PPT || {});
