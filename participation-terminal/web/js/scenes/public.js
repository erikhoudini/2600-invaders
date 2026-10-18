// Public mode: landing, vote → confirm → results, suggest, comment, thanks.
// Upper screen = presentation and context. Lower screen = input and action.
(function (PPT) {
  'use strict';

  const { C, CHOICE, RESPONSE, measure } = PPT.Gfx;
  const { W, App, Store, Keyboard } = PPT;
  const S = PPT.Scenes;

  const settings = () => Store.state.settings;

  // Navigation inside a preview stays on the admin stack.
  const nav = (preview) => (preview ? App.replace.bind(App) : App.go.bind(App));

  const INVITES = ['Tap your answer below!', 'Results show after you vote.', 'No names needed.'];

  // Small speech bubble next to the mascot, tail pointing left at it.
  function bubble(g, x, y, w, text) {
    const th = W.theme();
    g.rbox(x, y, w, 22, th.panel, th.panelEdge, 2);
    g.rect(x - 2, y + 9, 3, 3, th.panelEdge);
    g.rect(x - 1, y + 10, 2, 1, th.panel);
    g.text(text, x + w / 2, y + 8, th.text, 1, 'center');
  }

  const longIdle = () => (performance.now() - App.lastInput) / 1000 > 45;

  // Shared so admin screens can show what visitors will see.
  function drawLandingTop(g, t, opts = {}) {
    const th = W.theme();
    const poll = opts.poll;
    const idleMode = opts.idle || settings().idle;
    const anim = idleMode !== 'off';
    const key = opts.key || 'landing';
    const level = idleMode === 'off' ? 0 : idleMode === 'calm' ? 1 : 2;
    W.bg(g, th);
    const modes = settings().modes;

    if (poll) {
      W.header(g, opts.preview ? 'PREVIEW' : 'VOTE', opts.preview ? { band: C.ink, bandD: C.black } : {});
      g.rbox(8, 24, 240, 120, th.panel, th.panelEdge, 3);
      g.textBlock(poll.question, 16, 30, 224, 108, th.text, { maxScale: 2 });
      // Tally reacts to whichever answer is being pressed.
      const held = W.pressed();
      const m = held && /^choice-/.test(held) ? { mood: 'listen', wide: true } : { mood: 'invite' };
      W.mascot(g, key, 30, 184, 2, Object.assign({ level, longIdle: longIdle() }, m));
      const line = level === 2 ? INVITES[Math.floor(t / 6) % INVITES.length] : INVITES[0];
      bubble(g, 58, 156, 150, line);
      const bob = anim ? Math.round(Math.abs(Math.sin(t * 3)) * 3) : 0;
      g.text('\u2193', 224, 156 + bob, C.coral, 2);
      return;
    }

    W.header(g, 'HELLO');
    if (!modes.suggest && !modes.comment) {
      W.mascot(g, key, 128, 86, 3, { mood: 'sleep', level });
      g.stext('Back soon!', 128, 100, th.text, th.dots, 2, 'center');
      g.textBlock('Participation is paused for now.', 16, 128, 224, 30, th.soft, { maxScale: 1 });
      return;
    }
    g.stext('Have your say!', 128, 26, th.text, th.dots, 2, 'center');
    // Tally shows off the props for the enabled modes, swapping with a hop.
    const props = [];
    if (modes.suggest) props.push({ name: 'bulb' });
    if (modes.comment) props.push({ name: 'speech', main: C.periL, shade: C.peri });
    const slot = Math.floor(t / 3.5);
    const actor = PPT.Tally.get(key);
    if (props.length > 1 && level === 2 && actor._slot !== slot) { actor._slot = slot; actor.play('hop'); }
    W.mascot(g, key, 112, 122, 3, { mood: 'present', prop: props[slot % props.length], level, longIdle: longIdle() });
    const what = modes.suggest && modes.comment ? 'Share an idea or tell us how we\u2019re doing.'
      : modes.suggest ? 'Share an idea with us.' : 'Tell us how we\u2019re doing.';
    g.textBlock(what, 16, 134, 224, 24, th.text, { maxScale: 1 });
    const bob = anim ? Math.round(Math.abs(Math.sin(t * 3)) * 3) : 0;
    g.text('\u2193 Tap below to start \u2193', 128, 168 + bob, C.coralD, 1, 'center');
  }

  function choiceButtons(g, poll, area, onPick) {
    const n = poll.choices.length;
    const gap = 6;
    const cols = 2, rows = n > 2 ? 2 : 1;
    const bw = Math.floor((area.w - gap) / cols);
    const bh = Math.floor((area.h - gap * (rows - 1)) / rows);
    poll.choices.forEach((label, i) => {
      const x = area.x + (i % 2) * (bw + gap);
      const y = area.y + Math.floor(i / 2) * (bh + gap);
      const col = CHOICE[i];
      if (W.button(g, 'choice-' + i, x, y, bw, bh, { label, scale: 2, color: col.base, dark: col.dark })) onPick(i);
    });
  }

  function secondaryButtons(g, y, h, preview) {
    const modes = settings().modes;
    const items = [];
    if (modes.suggest) items.push(['suggest', 'Suggest', 'bulb', CHOICE[3]]);
    if (modes.comment) items.push(['comment', 'Comment', 'speech', CHOICE[2]]);
    if (!items.length) return null;
    const gap = 6;
    const bw = Math.floor((244 - gap * (items.length - 1)) / items.length);
    let picked = null;
    items.forEach(([key, label, icon, col], i) => {
      const x = 6 + i * (bw + gap);
      const r = PPT.UI.region('sec-' + key, x, y, bw, h, preview);
      const { fy } = W.face(g, x, y, bw, h, {}, r.pressed);
      const tw = measure(label, 1) + 14;
      const sx = x + Math.floor((bw - tw) / 2);
      g.sprite(icon, sx, fy + (h - 3 - 10) / 2, { main: col.base, shade: col.dark });
      g.text(label, sx + 14, fy + (h - 3 - 7) / 2, W.theme().text);
      if (r.clicked) picked = key;
    });
    return picked;
  }

  function startMode(key) {
    if (key === 'suggest') App.go('suggest');
    if (key === 'comment') {
      const p = nextPrompt();
      if (p) App.go('comment', { promptId: p.id });
    }
  }

  // Comment prompts rotate between visitors.
  let promptCursor = 0;
  function nextPrompt() {
    const list = Store.enabledPrompts();
    if (!list.length) return null;
    return list[promptCursor++ % list.length];
  }

  // ---------- Landing ----------
  S.landing = (args) => {
    const preview = !!args.preview;
    if (!preview) PPT.Tally.get('landing').reset().play('enter');
    return {
      public: !preview,
      poll() {
        if (preview) return Store.poll(args.pollId);
        return settings().modes.vote ? Store.activePoll() : null;
      },
      back() { if (preview) App.pop(); },
      top(g, t) {
        if (!preview && !PPT.SD.present()) { App.go('nosd'); return; }
        drawLandingTop(g, t, { poll: this.poll(), preview, key: preview ? 'preview' : 'landing' });
      },
      bottom(g, t) {
        const th = W.theme();
        W.bg(g, th);
        const poll = this.poll();
        const modes = settings().modes;
        if (poll) {
          const hasSecondary = !preview && (modes.suggest || modes.comment);
          choiceButtons(g, poll, { x: 6, y: 6, w: 244, h: hasSecondary ? 140 : (preview ? 150 : 180) }, (i) => {
            if (settings().confirmVotes || preview) nav(preview)('confirm', { pollId: poll.id, choice: i, preview });
            else submitVote(poll, i, Store.newSid(), false);
          });
          if (hasSecondary) startMode(secondaryButtons(g, 152, 34, false));
          if (preview && W.button(g, 'pv-exit', 6, 162, 244, 26, { label: 'Exit preview', color: C.ink, dark: C.black })) App.pop();
          return;
        }
        const items = [];
        if (modes.suggest) items.push(['suggest', 'Suggest', 'Share an idea', 'bulb', CHOICE[3]]);
        if (modes.comment && Store.enabledPrompts().length) items.push(['comment', 'Comment', 'Quick feedback', 'speech', CHOICE[1]]);
        if (!items.length) {
          W.mascot(g, 'paused', 128, 120, 3, { mood: 'sleep' });
          return;
        }
        const gap = 6, bw = Math.floor((244 - gap * (items.length - 1)) / items.length);
        items.forEach(([key, label, sub, icon, col], i) => {
          const x = 6 + i * (bw + gap);
          const r = PPT.UI.region('tile-' + key, x, 6, bw, 180);
          const { fy } = W.face(g, x, 6, bw, 180, { color: col.base, dark: col.dark, depth: 4 }, r.pressed);
          g.sprite(icon, x + bw / 2 - 18, fy + 34, { scale: 4, main: C.white, shade: col.light, white: col.base });
          g.text(label, x + bw / 2, fy + 100, PPT.Gfx.onColor(col.base), 2, 'center');
          g.textBlock(sub, x + 6, fy + 124, bw - 12, 20, PPT.Gfx.onColor(col.base), { maxScale: 1 });
          if (r.clicked) startMode(key);
        });
      },
    };
  };

  function submitVote(poll, choice, sid, preview) {
    if (preview) { App.replace('results', { pollId: poll.id, choice, preview }); return; }
    try {
      Store.submit({ type: 'vote', sid, poll: poll.id, choice });
      App.go('results', { pollId: poll.id, choice });
    } catch (e) {
      if (e instanceof PPT.SD.PowerCut) throw e;
      App.go('error', { what: 'vote' });
    }
  }

  // ---------- Confirm ----------
  S.confirm = (args) => {
    const sid = Store.newSid(); // one submission id per confirm screen: repeated taps can't double count
    PPT.Tally.get('confirm').reset().play('hop');
    let committing = false;
    const preview = !!args.preview;
    return {
      public: !preview,
      timed: !preview,
      back() { nav(preview)('landing', preview ? { preview, pollId: args.pollId } : {}); },
      top(g) {
        const th = W.theme();
        const poll = Store.poll(args.pollId);
        W.bg(g, th);
        W.header(g, preview ? 'PREVIEW' : 'VOTE', preview ? { band: C.ink, bandD: C.black } : {});
        g.textBlock(poll.question, 12, 22, 232, 30, th.soft, { maxScale: 1 });
        g.text('Your answer', 152, 58, th.text, 1, 'center');
        const col = CHOICE[args.choice];
        g.rrect(68, 72, 172, 72, col.dark, 3);
        g.rrect(68, 70, 172, 70, col.base, 3);
        g.textBlock(poll.choices[args.choice], 76, 74, 156, 62, PPT.Gfx.onColor(col.base), { maxScale: 2 });
        // Tally holds up a ballot in the chosen colour; it lights up while "Count my vote" is held.
        const held = W.pressed() === 'confirm-yes';
        W.mascot(g, 'confirm', 34, 140, 2, { mood: held ? 'happy' : 'hold', prop: { name: 'card', color: col.base },
                                            lookAt: held ? null : { x: 1, y: 0 } });
        g.textBlock('Results appear after you vote.', 12, 158, 232, 24, th.soft, { maxScale: 1 });
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const poll = Store.poll(args.pollId);
        if (W.button(g, 'confirm-yes', 8, 8, 240, 112, { label: '✓ Count my vote', scale: 2,
                                                        color: C.sea, dark: C.seaD, depth: 4 }) && !committing) {
          committing = true;
          submitVote(poll, args.choice, sid, preview);
        }
        if (W.button(g, 'confirm-change', 8, 130, 240, 54, { label: '← Change answer', scale: 1 })) this.back();
      },
    };
  };

  // ---------- Results ----------
  S.results = (args) => {
    const preview = !!args.preview;
    PPT.Tally.get('results').reset().play('jump');
    return {
      public: !preview,
      done() { preview ? App.replace('landing', { preview, pollId: args.pollId }) : App.go('landing'); },
      back() { this.done(); },
      top(g, t) {
        const th = W.theme();
        const poll = Store.poll(args.pollId);
        W.bg(g, th);
        W.header(g, preview ? 'PREVIEW' : 'RESULTS', preview ? { band: C.ink, bandD: C.black } : {});
        g.textBlock(poll.question, 10, 22, 236, 20, th.text, { maxScale: 1 });
        W.resultBars(g, poll.choices, poll.counts, 12, 48, 232, 124, t / 0.9, args.choice);
        const total = Store.total(poll);
        g.text(total + (total === 1 ? ' response so far' : ' responses so far'), 128, 180, th.soft, 1, 'center');
      },
      bottom(g, t) {
        const th = W.theme();
        W.bg(g, th);
        if (settings().idle !== 'off') W.confetti(g, t, { x: 0, y: 0, w: 256, h: 120 });
        g.stext(preview ? 'Preview only' : 'Thanks for voting!', 128, 12, th.text, th.dots, 2, 'center');
        W.mascot(g, 'results', 128, 116, 3, { mood: 'celebrate' });
        if (preview) g.text('This vote was not counted.', 128, 28, C.coralD, 1, 'center');
        if (W.button(g, 'results-done', 48, 124, 160, 48, { label: 'Done', scale: 2, color: C.sea, dark: C.seaD })) this.done();
        const dur = settings().resultsSeconds;
        g.rect(48, 180, 160, 3, th.panelEdge);
        g.rect(48, 180, Math.max(0, 160 * (1 - t / dur)), 3, C.sea);
        if (t > dur) this.done();
      },
    };
  };

  // ---------- Suggest ----------
  S.suggest = (args) => {
    const kb = Keyboard.create(args.text || '', settings().suggestLimit);
    const tally = PPT.Tally.get('suggest').reset();
    let lastLen = kb.text.length;
    return {
      public: true,
      timed: true,
      abandon() { kb.text = ''; },
      back() {
        if (!kb.text.trim()) { App.go('landing'); return; }
        App.confirm({ title: 'Discard your idea?', body: 'What you typed will be cleared.',
                      confirm: 'Discard', cancel: 'Keep it', danger: true, onConfirm: () => App.go('landing') });
      },
      send() { if (kb.text.trim()) App.go('suggestReview', { text: kb.text.trim() }); },
      onKey(e) {
        const r = Keyboard.onKey(kb, e);
        if (r === 'send') this.send();
        else if (r === 'back') this.back();
        return !!r;
      },
      top(g, t) {
        const th = W.theme();
        W.bg(g, th);
        W.header(g, 'SUGGEST');
        g.textBlock(settings().suggestPrompt, 10, 22, 188, 30, th.text, { maxScale: 2, align: 'left' });
        g.rbox(8, 56, 240, 112, th.panel, th.panelEdge, 3);
        if (kb.text) {
          g.textBlock(kb.text, 16, 62, 224, 100, th.text, { maxScale: kb.text.length < 40 ? 2 : 1, valign: 'top', align: 'left' });
        } else {
          g.textBlock('Type your idea on the keyboard below.', 16, 62, 224, 100, th.soft, { maxScale: 1 });
        }
        g.text('Anonymous — no names needed.', 10, 176, th.soft);
        const left = kb.max - kb.text.length;
        // Tally sits on the text box: thinking while it's empty, nodding along as you type.
        if (kb.text.length > lastLen) tally.play(left <= 0 ? 'surprise' : 'nod');
        lastLen = kb.text.length;
        const mood = !kb.text ? { mood: 'think' } : left <= 0 ? { mood: 'worried' } : { mood: 'listen', wide: left <= 20 };
        W.mascot(g, 'suggest', 224, 58, 2, Object.assign({ shadow: false }, mood));
        g.text(left + ' left', 246, 176, left <= 10 ? C.coralD : th.soft, 1, 'right');
      },
      bottom(g) {
        W.bg(g);
        const ev = Keyboard.draw(g, kb, { title: 'Your idea', sendLabel: 'Next' });
        if (ev === 'back') this.back();
        if (ev === 'send') this.send();
      },
    };
  };

  S.suggestReview = (args) => {
    const sid = Store.newSid();
    PPT.Tally.get('suggest').play('wave');
    let committing = false;
    return {
      public: true,
      timed: true,
      back() { App.go('suggest', { text: args.text }); },
      top(g) {
        const th = W.theme();
        W.bg(g, th);
        W.header(g, 'SUGGEST');
        g.stext('Send this idea?', 12, 26, th.text, th.dots, 2);
        g.rbox(8, 48, 240, 120, th.panel, th.panelEdge, 3);
        g.textBlock(args.text, 16, 54, 224, 108, th.text, { maxScale: args.text.length < 50 ? 2 : 1 });
        g.text('Only staff can read suggestions.', 128, 176, th.soft, 1, 'center');
        const held = W.pressed() === 'sug-send';
        W.mascot(g, 'suggest', 224, 50, 2, { shadow: false, mood: held ? 'happy' : 'present', prop: held ? null : { name: 'bulb' } });
      },
      bottom(g) {
        W.bg(g);
        if (W.button(g, 'sug-send', 8, 8, 240, 112, { label: '✓ Send it', scale: 2, color: C.sea, dark: C.seaD, depth: 4 }) && !committing) {
          committing = true;
          try {
            Store.submit({ type: 'suggest', sid, text: args.text });
            App.go('thanks', { kind: 'suggest' });
          } catch (e) {
            if (e instanceof PPT.SD.PowerCut) throw e;
            App.go('error', { what: 'suggestion' });
          }
        }
        if (W.button(g, 'sug-edit', 8, 130, 240, 54, { label: '← Keep editing' })) this.back();
      },
    };
  };

  // ---------- Comment ----------
  // Rough mood for a response label, so Tally can react. Purely decorative.
  function sentiment(label) {
    const l = label.toLowerCase();
    if (/\b(meh|okay|ok|fine|so-so)\b/.test(l)) return 'flat';
    if (/\b(not|no|too|bad|poor|didn't|don't)\b/.test(l)) return 'sad';
    if (/\b(good|great|love|loved|like|liked|yes|perfect|right|amazing)\b/.test(l)) return 'happy';
    return 'listen';
  }

  S.comment = (args) => {
    const sid = Store.newSid();
    PPT.Tally.get('comment').reset().play('enter');
    let committing = false;
    return {
      public: true,
      timed: true,
      back() { App.go('landing'); },
      top(g, t) {
        const th = W.theme();
        const p = Store.prompt(args.promptId);
        W.bg(g, th);
        W.header(g, 'COMMENT');
        g.rbox(8, 24, 240, 120, th.panel, th.panelEdge, 3);
        g.textBlock(p.text, 16, 30, 224, 108, th.text, { maxScale: 2 });
        // Tally previews a reaction to whichever response is being pressed.
        const held = W.pressed();
        const i = held && /^opt-/.test(held) ? Number(held.slice(4)) : -1;
        const feel = i >= 0 ? sentiment(p.options[i]) : null;
        const m = feel === 'happy' ? { mood: 'happy' } : feel === 'sad' ? { mood: 'sad' }
          : feel === 'flat' ? { mood: 'idle', mouth: 'flat' } : feel ? { mood: 'listen', wide: true } : { mood: 'invite' };
        W.mascot(g, 'comment', 30, 184, 2, m);
        bubble(g, 58, 156, 120, 'Tap one below.');
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const p = Store.prompt(args.promptId);
        const n = p.options.length;
        const gap = 6;
        const cols = n === 4 ? 2 : n;
        const rows = n === 4 ? 2 : 1;
        const bw = Math.floor((244 - gap * (cols - 1)) / cols);
        const bh = Math.floor((140 - gap * (rows - 1)) / rows);
        p.options.forEach((label, i) => {
          const x = 6 + (i % cols) * (bw + gap);
          const y = 6 + Math.floor(i / cols) * (bh + gap);
          const col = RESPONSE[i % 4];
          if (W.button(g, 'opt-' + i, x, y, bw, bh, { label, scale: 2, color: col.base, dark: col.dark }) && !committing) {
            committing = true;
            try {
              Store.submit({ type: 'comment', sid, prompt: p.id, option: i, label });
              App.go('thanks', { kind: 'comment' });
            } catch (e) {
              if (e instanceof PPT.SD.PowerCut) throw e;
              App.go('error', { what: 'comment' });
            }
          }
        });
        if (W.button(g, 'cmt-back', 6, 152, 100, 34, { label: '← Back' })) this.back();
      },
    };
  };

  // ---------- Thanks ----------
  S.thanks = (args) => (PPT.Tally.get('thanks').reset().play('jump'), {
    public: true,
    back() { App.go('landing'); },
    top(g, t) {
      const th = W.theme();
      W.bg(g, th);
      W.header(g, args.kind === 'suggest' ? 'SUGGEST' : 'COMMENT');
      g.stext('Thank you!', 128, 24, th.text, th.dots, 2, 'center');
      W.mascot(g, 'thanks', 128, 138, 3, { mood: 'celebrate', fx: args.kind === 'suggest' ? 'hearts' : 'sparkles' });
      g.textBlock(args.kind === 'suggest' ? 'Your idea was saved for the staff.' : 'Your feedback was saved.',
        16, 150, 224, 30, th.text, { maxScale: 1 });
    },
    bottom(g, t) {
      const th = W.theme();
      W.bg(g, th);
      if (settings().idle !== 'off') W.confetti(g, t);
      if (W.button(g, 'thanks-done', 48, 60, 160, 56, { label: 'Done', scale: 2, color: C.sea, dark: C.seaD })) this.back();
      const dur = settings().thanksSeconds;
      g.rect(48, 128, 160, 3, th.panelEdge);
      g.rect(48, 128, Math.max(0, 160 * (1 - t / dur)), 3, C.sea);
      if (t > dur) this.back();
    },
  });

  // ---------- Errors ----------
  // Never claims success. Shown when a submission could not be written.
  S.error = (args) => (PPT.Tally.get('error').reset().play('shake'), {
    public: true,
    back() { App.go('landing'); },
    top(g) {
      const th = W.theme();
      W.bg(g, th);
      W.header(g, 'SORRY', { band: C.coral, bandD: C.coralD });
      W.mascot(g, 'error', 128, 70, 2, { mood: 'worried' });
      g.stext('Not saved', 128, 80, th.text, th.dots, 2, 'center');
      g.textBlock('Your ' + (args.what || 'response') + ' could not be saved right now. Please let a staff member know.',
        20, 106, 216, 50, th.text, { maxScale: 1 });
    },
    bottom(g, t) {
      W.bg(g);
      if (W.button(g, 'err-ok', 48, 60, 160, 56, { label: 'OK', scale: 2 })) this.back();
      if (t > 15) this.back();
    },
  });

  // Storage unavailable at startup or removed while running.
  S.nosd = () => ({
    public: true,
    lastTry: 0,
    top(g, t) {
      const th = W.theme();
      g.clear(th.bg);
      W.mascot(g, 'nosd', 128, 84, 3, { mood: 'sleep' });
      g.stext('Taking a short break', 128, 96, th.text, th.dots, 2, 'center');
      g.textBlock('Please let a staff member know.', 16, 122, 224, 20, th.soft, { maxScale: 1 });
    },
    bottom(g, t) {
      const th = W.theme();
      g.clear(th.bg);
      g.text('Storage unavailable', 128, 90, th.soft, 1, 'center');
      // Card reinserted (simulator only): recover automatically.
      if (PPT.SD.present() && t - this.lastTry > 1) {
        this.lastTry = t;
        PPT.Store.boot();
        if (PPT.Store.ok) App.go('landing');
      }
    },
  });

  PPT.Public = { drawLandingTop, nextPrompt };
})(window.PPT = window.PPT || {});
