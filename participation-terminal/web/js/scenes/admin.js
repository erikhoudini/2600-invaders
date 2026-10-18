// Administrator mode. Reached by holding L+R (or the top-left touchscreen corner)
// and entering the PIN. Everything here is operable on the device itself.
(function (PPT) {
  'use strict';

  const { C, CHOICE, RESPONSE, measure, truncate } = PPT.Gfx;
  const { W, App, Store, Keyboard, SD } = PPT;
  const S = PPT.Scenes;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const dShort = (t) => { if (!t) return '—'; const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate(); };
  const dLong = (t) => { if (!t) return '—'; const d = new Date(t); return dShort(t) + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const kb = (n) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

  const ADMIN_HEADER = { band: C.ink, bandD: C.black };

  function adminTop(g, label) {
    const th = W.theme();
    W.bg(g, th);
    W.header(g, label, Object.assign({ left: 'STAFF · ' + Store.state.venue }, ADMIN_HEADER));
    return th;
  }

  // Lines of text on the upper screen. Lines starting with '!' are warnings.
  function lines(g, list, x, y, opts = {}) {
    const th = W.theme();
    const w = opts.w || 240;
    for (const raw of list) {
      if (raw === '') { y += 6; continue; }
      const warn = raw[0] === '!';
      const text = warn ? raw.slice(1).trim() : raw;
      const wrapped = PPT.Gfx.wrap(text, w - (warn ? 10 : 0));
      if (warn) g.text('!', x, y, C.coralD);
      for (const l of wrapped) {
        if (y > 184) return y;
        g.text(l, x + (warn ? 8 : 0), y, warn ? C.coralD : opts.color || th.text);
        y += 10;
      }
    }
    return y;
  }

  // Two-column grid of action buttons.
  function actions(g, list, y0, opts = {}) {
    const h = opts.h || 32, gap = 4;
    list.forEach((a, i) => {
      if (!a) return;
      const wide = a.wide;
      const col = wide ? 0 : i % 2;
      const row = opts.rows ? opts.rows[i] : Math.floor(i / 2);
      const w = wide ? 244 : 120;
      const x = 6 + col * 124;
      const y = y0 + row * (h + gap);
      const color = a.danger ? C.coral : a.primary ? C.sea : undefined;
      const dark = a.danger ? C.coralD : a.primary ? C.seaD : undefined;
      if (W.button(g, 'act-' + a.label, x, y, w, h, { label: a.label, color, dark, disabled: a.disabled })) a.run();
    });
  }

  function storageBar(g, x, y, w) {
    const th = W.theme();
    const s = Store.storage();
    const col = s.pct > 0.95 ? C.coral : s.pct > 0.8 ? C.marigold : C.sea;
    g.rrect(x, y, w, 8, th.panelEdge, 1);
    g.rect(x + 1, y + 1, Math.max(1, Math.round((w - 2) * Math.min(1, s.pct))), 6, col);
    return s;
  }

  function warnings() {
    const out = [];
    const sec = Store.state.security;
    if (Store.error) out.push('! Storage error: ' + Store.error);
    if (sec.isDefault) out.push('! Default PIN in use. Change it in Settings.');
    const s = Store.storage();
    if (s.pct > 0.95) out.push('! Storage almost full. Export and delete old records.');
    else if (s.pct > 0.8) out.push('! Storage over 80% full.');
    Store.report.filter((l) => l[0] === '!').forEach((l) => out.push(l));
    Store.state.notices.forEach((n) => out.push('! ' + n));
    return out;
  }

  // ---------- PIN ----------
  S.pin = (args) => {
    const purpose = args.purpose || 'unlock';
    const st = { digits: '', msg: '', shake: 0, stage: purpose === 'unlock' ? 'enter' : 'new', first: '' };
    const titles = { enter: 'Enter staff PIN', new: 'Choose a new PIN', confirm: 'Enter it again' };
    const tally = PPT.Tally.get('pin').reset().play('wave');

    function cancel() {
      if (purpose === 'unlock') App.go('landing');
      else App.pop();
    }
    function submit() {
      const d = st.digits;
      st.digits = '';
      if (st.stage === 'enter') {
        const r = Store.verifyPin(d);
        if (r === 'ok') { App.admin = true; App.go('adminHome'); return; }
        st.msg = r === 'locked' ? '' : 'Wrong PIN';
        st.shake = performance.now();
        tally.play('shake');
      } else if (st.stage === 'new') {
        if (d.length < 4) { st.msg = 'Use at least 4 digits'; st.shake = performance.now(); return; }
        if (d === Store.DEFAULT_PIN) { st.msg = 'Choose something other than 1234'; st.shake = performance.now(); return; }
        st.first = d; st.stage = 'confirm'; st.msg = '';
      } else {
        if (d !== st.first) { st.msg = "PINs didn't match. Try again."; st.stage = 'new'; st.shake = performance.now(); return; }
        App.attempt(() => Store.setPin(d), 'PIN changed');
        App.pop();
      }
    }
    function key(k) {
      st.msg = '';
      if (tally.action && tally.action.name === 'wave') tally.action = null; // look away at once
      if (k === 'del') st.digits = st.digits.slice(0, -1);
      else if (k === 'ok') { if (st.digits.length) submit(); }
      else if (st.digits.length < 8) st.digits += k;
    }

    return {
      public: false,
      back: cancel,
      onKey(e) {
        if (/^[0-9]$/.test(e.key)) { key(e.key); return true; }
        if (e.key === 'Backspace') { key('del'); return true; }
        if (e.key === 'Enter') { key('ok'); return true; }
        if (e.key === 'Escape') { cancel(); return true; }
        return false;
      },
      top(g) {
        const th = W.theme();
        W.bg(g, th);
        W.header(g, 'STAFF', Object.assign({ left: Store.state.venue }, ADMIN_HEADER));
        // Tally covers its eyes while digits are entered.
        const lock = Store.pinLockRemaining();
        const mood = lock > 0 ? { mood: 'sad' } : st.digits.length ? { mood: 'shy' } : { mood: 'idle' };
        W.mascot(g, 'pin', 128, 62, 2, mood);
        g.text(titles[st.stage], 128, 70, th.text, 2, 'center');
        const n = Math.max(4, st.digits.length);
        const since = (performance.now() - st.shake) / 1000;
        const dx = since < 0.35 ? Math.round(Math.sin(since * 60) * 4) : 0;
        const bw = 18, gap = 6, total = n * bw + (n - 1) * gap;
        for (let i = 0; i < n; i++) {
          const x = 128 - total / 2 + i * (bw + gap) + dx;
          g.rbox(x, 94, bw, 22, th.panel, th.panelEdge, 2);
          if (i < st.digits.length) g.rrect(x + 5, 101, 8, 8, th.text, 2);
        }
        if (lock > 0) g.textBlock('Too many attempts. Try again in ' + lock + 's.', 16, 128, 224, 24, C.coralD, { maxScale: 1 });
        else if (st.msg) g.text(st.msg, 128, 132, C.coralD, 1, 'center');
        if (purpose === 'unlock' && !st.digits.length) g.text('Default PIN: 1234 (prototype)', 128, 176, th.soft, 1, 'center');
      },
      bottom(g) {
        W.bg(g);
        const bar = W.topBar(g, purpose === 'unlock' ? 'Staff access' : 'Change PIN');
        if (bar.back) { cancel(); return; }
        const locked = Store.pinLockRemaining() > 0;
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
        keys.forEach((k, i) => {
          const x = 4 + (i % 3) * 84, y = 26 + Math.floor(i / 3) * 41;
          const label = k === 'del' ? '←' : k === 'ok' ? 'OK' : k;
          const o = { label, scale: 2, disabled: locked && k !== 'del' };
          if (k === 'ok') { o.color = C.sea; o.dark = C.seaD; }
          if (W.button(g, 'pin-' + k, x, y, 80, 39, o)) key(k);
        });
      },
    };
  };

  // Storage diagnostics, reachable without a PIN only when no data can be read.
  S.diag = () => ({
    public: false,
    back() { App.go(Store.ok ? 'landing' : 'nosd'); },
    top(g) {
      const th = W.theme();
      W.bg(g, th);
      W.header(g, 'STORAGE', Object.assign({ left: 'STAFF' }, ADMIN_HEADER));
      g.text('Storage problem', 10, 26, th.text, 2);
      W.mascot(g, 'diag', 222, 52, 2, { mood: 'worried' });
      lines(g, [SD.present() ? 'SD card detected but not usable.' : '! No SD card detected.', '',
                ...Store.report, '', 'Insert the SD card, then tap Try again.',
                'Visitor submissions are refused until storage works.'], 10, 52);
    },
    bottom(g) {
      W.bg(g);
      W.topBar(g, 'Diagnostics', { back: false });
      if (W.button(g, 'diag-retry', 8, 40, 240, 60, { label: 'Try again', scale: 2, color: C.sea, dark: C.seaD })) {
        Store.boot();
        if (Store.ok) App.go('pin', { purpose: 'unlock' });
        else App.toast('Still no usable storage');
      }
      if (W.button(g, 'diag-back', 8, 112, 240, 40, { label: 'Back to public screen' })) this.back();
    },
  });

  // ---------- Home ----------
  S.adminHome = () => (PPT.Tally.get('admin').reset().play('wave'), {
    public: false,
    back() { App.lock(); },
    top(g) {
      const th = adminTop(g, 'ADMIN');
      const poll = Store.activePoll();
      g.text('Active poll', 10, 24, th.soft);
      if (poll) {
        g.text(truncate(poll.question, 236), 10, 35, th.text);
        g.text(plural(Store.total(poll), 'response') + ' · since ' + dShort(poll.activatedAt), 10, 46, th.soft);
      } else {
        g.text('None — visitors see Suggest and Comment only.', 10, 35, th.text);
      }
      const fb = Store.newFeedback();
      g.text('New feedback', 10, 62, th.soft);
      g.text(plural(fb.suggestions, 'suggestion') + ', ' + plural(fb.comments, 'comment'), 10, 73, th.text);
      const s = storageBar(g, 10, 100, 236);
      g.text('Storage ' + kb(s.used) + ' of ' + kb(s.capacity), 10, 89, th.soft);
      const warn = warnings();
      lines(g, warn.length ? warn : ['Everything looks good.'], 10, 116, { w: 190 });
      const serious = Store.error || Store.storage().pct > 0.95;
      W.mascot(g, 'admin', 224, 184, 2, { mood: serious ? 'worried' : warn.length ? 'think' : 'happy' });
    },
    bottom(g) {
      W.bg(g);
      const fb = Store.newFeedback();
      const tiles = [
        ['Polls', 'iconBars', 'polls'],
        ['Inbox', 'iconInbox', 'inbox', fb.suggestions + fb.comments],
        ['Results', 'iconClock', 'history'],
        ['Appearance', 'iconStar', 'appearance'],
        ['Records', 'iconCard', 'records'],
        ['Settings', 'iconGear', 'settings'],
      ];
      tiles.forEach(([label, icon, scene, badge], i) => {
        const x = 4 + (i % 3) * 84, y = 4 + Math.floor(i / 3) * 80;
        if (W.button(g, 'home-' + scene, x, y, 80, 76, { label, icon, iconScale: 2, badge: badge || null })) App.push(scene);
      });
      if (W.button(g, 'home-lock', 4, 166, 248, 24, { label: 'Lock and return to public screen', color: C.ink, dark: C.black })) App.lock();
    },
  });

  // ---------- Generic text entry ----------
  S.textEntry = (args) => {
    const k = Keyboard.create(args.value || '', args.max || 120, { autoCap: args.autoCap !== false });
    return {
      public: false,
      back() { App.pop(null); },
      onKey(e) {
        const r = Keyboard.onKey(k, e);
        if (r === 'send') this.done();
        else if (r === 'back') this.back();
        return !!r;
      },
      done() { if (k.text.trim() || args.allowEmpty) App.pop({ key: args.key, value: k.text.trim() }); },
      top(g) {
        const th = adminTop(g, 'EDIT');
        g.text(args.title, 10, 24, th.text, 2);
        g.rbox(8, 46, 240, 122, th.panel, th.panelEdge, 3);
        if (k.text) g.textBlock(k.text, 16, 52, 224, 110, th.text, { maxScale: k.text.length < 40 ? 2 : 1, align: 'left', valign: 'top' });
        if (args.hint) g.textBlock(args.hint, 10, 172, 236, 18, th.soft, { maxScale: 1, align: 'left' });
      },
      bottom(g) {
        W.bg(g);
        const ev = Keyboard.draw(g, k, { title: args.title, sendLabel: 'Done', allowEmpty: args.allowEmpty });
        if (ev === 'back') this.back();
        if (ev === 'send') this.done();
      },
    };
  };

  // ---------- Poll Manager ----------
  const STATUS_ORDER = { active: 0, draft: 1, ended: 2, archived: 3 };

  S.polls = () => {
    const st = { scroll: 0, archived: false };
    return {
      public: false,
      back() { App.pop(); },
      items() {
        return Store.state.polls
          .filter((p) => st.archived || p.status !== 'archived')
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.createdAt - a.createdAt));
      },
      top(g) {
        const th = adminTop(g, 'POLLS');
        const ps = Store.state.polls;
        const count = (s) => ps.filter((p) => p.status === s).length;
        g.text('Poll Manager', 10, 24, th.text, 2);
        lines(g, [
          count('active') + ' active · ' + count('draft') + ' drafts · ' + count('ended') + ' ended · ' + count('archived') + ' archived',
          '',
          'One poll is active at a time. Activating a poll ends the current one; its results are kept.',
          '',
          'Editing a poll that already has votes creates a new revision, so past results keep their meaning.',
        ], 10, 48, { w: 236 });
      },
      bottom(g) {
        W.bg(g);
        const bar = W.topBar(g, 'Polls', { right: '+ New', rightW: 50 });
        if (bar.back) return this.back();
        if (bar.right) return App.push('pollEdit', {});
        const items = this.items();
        const hit = W.list(g, 'polls', st, items, 4, 26, 248, 138, {
          rowH: 23,
          empty: 'No polls yet. Tap + New.',
          render(g2, p, x, y, w) {
            const cw = W.chip(g2, p.status.toUpperCase(), x, y + 5, W.statusColor(p.status));
            g2.text(truncate(p.question, w - cw - 6), x + cw + 5, y + 7, W.theme().text);
          },
        });
        if (hit >= 0) App.push('pollDetail', { id: items[hit].id });
        const nArch = Store.state.polls.filter((p) => p.status === 'archived').length;
        if (W.button(g, 'polls-arch', 4, 168, 248, 22, { label: st.archived ? 'Hide archived' : 'Show archived (' + nArch + ')' })) {
          st.archived = !st.archived;
        }
      },
    };
  };

  function drawPollSummary(g, p, y0) {
    const th = W.theme();
    let x = 10;
    x += W.chip(g, p.status.toUpperCase(), x, y0, W.statusColor(p.status)) + 4;
    g.text('Rev ' + p.rev + ' · ' + p.id + (p.revisionOf ? ' (from ' + p.revisionOf + ')' : ''), x, y0 + 2, th.soft);
    const r = g.textBlock(p.question, 10, y0 + 16, 236, 34, th.text, { maxScale: 2, align: 'left', valign: 'top' });
    let y = y0 + 20 + r.height;
    const total = Store.total(p);
    p.choices.forEach((c, i) => {
      g.rrect(10, y, 8, 8, CHOICE[i].base, 1);
      g.text(truncate(c, 180), 22, y + 1, th.text);
      g.text(String(p.counts[i]), 246, y + 1, th.soft, 1, 'right');
      y += 12;
    });
    g.text(plural(total, 'response') + ' · created ' + dShort(p.createdAt) +
      (p.activatedAt ? ' · active ' + dShort(p.activatedAt) : '') + (p.endedAt ? '–' + dShort(p.endedAt) : ''), 10, y + 4, th.soft);
  }

  S.pollDetail = (args) => ({
    public: false,
    back() { App.pop(); },
    top(g) {
      const p = Store.poll(args.id);
      adminTop(g, 'POLL');
      if (p) drawPollSummary(g, p, 24);
    },
    bottom(g) {
      W.bg(g);
      const p = Store.poll(args.id);
      const bar = W.topBar(g, 'Poll');
      if (bar.back || !p) return this.back();
      const total = Store.total(p);
      const cur = Store.activePoll();
      const edit = () => {
        if (!total) return App.push('pollEdit', { id: p.id });
        App.confirm({
          title: 'Create a revision?',
          body: 'This poll has ' + plural(total, 'vote') + '. Editing makes revision ' + (p.rev + 1) +
                ' as a new draft. This version and its results stay in history unchanged.',
          confirm: 'Revise',
          onConfirm: () => {
            const id = App.attempt(() => Store.revisePoll(p.id));
            if (id) { App.replace('pollDetail', { id }); App.push('pollEdit', { id }); }
          },
        });
      };
      const activate = () => {
        const go = () => App.attempt(() => Store.activatePoll(p.id), 'Poll is now live');
        if (cur && cur.id !== p.id) {
          App.confirm({ title: 'Switch active poll?', body: 'This ends "' + truncate(cur.question, 400) +
                        '" (' + plural(Store.total(cur), 'vote') + '). Its results are kept in history.',
                        confirm: 'Activate', onConfirm: go });
        } else go();
      };
      const del = () => App.confirm({
        title: 'Delete poll?',
        body: total ? 'This permanently deletes the poll and its ' + plural(total, 'recorded vote') +
                      '. This cannot be undone. Archive it instead to keep the history.'
                    : 'This draft will be removed.',
        confirm: 'Delete', danger: true, hold: total ? 2 : 0,
        onConfirm: () => { if (App.attempt(() => Store.deletePoll(p.id), 'Poll deleted')) App.pop(); },
      });
      const preview = () => App.push('landing', { preview: true, pollId: p.id });
      const results = () => App.push('historyDetail', { id: p.id });
      const archive = (on) => App.attempt(() => Store.archivePoll(p.id, on), on ? 'Archived' : 'Restored');
      const end = () => App.confirm({ title: 'End this poll?', body: 'Visitors will no longer see it. Its ' +
                                      plural(total, 'vote') + ' stay in Results and History.', confirm: 'End poll',
                                      onConfirm: () => App.attempt(() => Store.endPoll(p.id), 'Poll ended') });
      const dup = () => { const id = App.attempt(() => Store.duplicatePoll(p.id), 'Copied as a new draft'); if (id) App.replace('pollDetail', { id }); };

      const sets = {
        draft: [{ label: 'Edit', run: edit }, { label: 'Preview', run: preview },
                { label: 'Activate', run: activate, primary: true }, { label: 'Delete', run: del, danger: true }],
        active: [{ label: 'Preview', run: preview }, { label: 'Results', run: results },
                 { label: total ? 'Edit (revise)' : 'Edit', run: edit }, { label: 'End poll', run: end, danger: true }],
        ended: [{ label: 'Results', run: results }, { label: 'Activate again', run: activate, primary: true },
                { label: 'Duplicate', run: dup }, { label: 'Archive', run: archive.bind(null, true) },
                { label: 'Delete', run: del, danger: true }],
        archived: [{ label: 'Results', run: results }, { label: 'Unarchive', run: archive.bind(null, false) },
                   { label: 'Delete', run: del, danger: true }],
      };
      actions(g, sets[p.status], 30);
    },
  });

  S.pollEdit = (args) => {
    const src = args.id ? Store.poll(args.id) : null;
    const f = { question: src ? src.question : '', choices: src ? src.choices.slice() : ['', ''] };
    const spare = ['', ''];
    let dirty = false;
    const sample = () => ({ question: f.question || 'Your question appears here', choices: f.choices.map((c, i) => c || 'Answer ' + 'ABCD'[i]) });
    return {
      public: false,
      back() {
        if (!dirty) return App.pop();
        App.confirm({ title: 'Discard changes?', body: 'Your edits to this poll will be lost.', confirm: 'Discard',
                      danger: true, onConfirm: () => App.pop() });
      },
      onResume(r) {
        if (!r) return;
        dirty = true;
        if (r.key === 'q') f.question = r.value;
        else f.choices[r.key] = r.value;
      },
      top(g, t) {
        PPT.Public.drawLandingTop(g, t, { poll: sample(), preview: true, idle: 'calm', key: 'edit' });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, src ? 'Edit poll' : 'New poll');
        if (bar.back) return this.back();
        if (W.row(g, 'pe-q', 4, 26, 248, 20, 'Question', f.question ? truncate(f.question, 150) : 'Tap to write')) {
          App.push('textEntry', { title: 'Question', value: f.question, max: 120, key: 'q', hint: 'Keep it short; it is shown large on the top screen.' });
        }
        g.text('Answers', 8, 55, th.text);
        [2, 4].forEach((n, i) => {
          if (W.button(g, 'pe-n' + n, 64 + i * 46, 50, 42, 18, { label: n + '', latched: f.choices.length === n,
                         color: f.choices.length === n ? C.marigold : undefined, dark: f.choices.length === n ? C.marigoldD : undefined })) {
            if (f.choices.length !== n) {
              dirty = true;
              if (n === 4) f.choices = f.choices.concat(spare);
              else { spare.splice(0, 2, ...f.choices.slice(2)); f.choices = f.choices.slice(0, 2); }
            }
          }
        });
        f.choices.forEach((c, i) => {
          const y = 72 + i * 22;
          g.rrect(4, y, 6, 20, CHOICE[i].base, 1);
          if (W.row(g, 'pe-c' + i, 12, y, 240, 20, 'Answer ' + 'ABCD'[i], c || 'Tap to write')) {
            App.push('textEntry', { title: 'Answer ' + 'ABCD'[i], value: c, max: 40, key: i, hint: 'Short labels fit best on the buttons.' });
          }
        });
        const valid = f.question.trim() && f.choices.every((c) => c.trim());
        if (W.button(g, 'pe-save', 4, 162, 248, 28, { label: valid ? 'Save draft' : 'Fill in all fields to save', color: C.sea, dark: C.seaD, disabled: !valid })) {
          const id = App.attempt(() => Store.savePoll(src && src.id, f), 'Saved');
          if (id) { dirty = false; if (src) App.pop(); else App.replace('pollDetail', { id }); }
        }
      },
    };
  };

  // ---------- Feedback inbox ----------
  const FILTERS = ['new', 'reviewed', 'archived', 'all'];

  S.inbox = () => {
    const st = { tab: 'suggest', filter: 'new', scroll: 0, pscroll: 0 };
    return {
      public: false,
      back() { App.pop(); },
      sugs() {
        return Store.state.suggestions.filter((s) => st.filter === 'all' || s.status === st.filter).slice().reverse();
      },
      prompts() {
        return Store.state.prompts.filter((p) => !p.retired || Store.state.comments.some((c) => c.prompt === p.id));
      },
      top(g) {
        const th = adminTop(g, 'INBOX');
        const sg = Store.state.suggestions;
        const n = (s) => sg.filter((x) => x.status === s).length;
        g.text('Feedback Inbox', 10, 24, th.text, 2);
        lines(g, [
          'Suggestions: ' + n('new') + ' new, ' + n('reviewed') + ' reviewed, ' + n('archived') + ' archived',
          'Comments: ' + Store.state.comments.filter((c) => c.status === 'new').length + ' new responses',
          '',
          'Feedback is private to staff and never shown to visitors.',
          '',
          'Archive keeps a record; Delete removes it for good.',
        ], 10, 48, { w: 236 });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Feedback Inbox');
        if (bar.back) return this.back();
        const fb = Store.newFeedback();
        [['suggest', 'Suggestions (' + fb.suggestions + ')'], ['comment', 'Comments (' + fb.comments + ')']].forEach(([k, label], i) => {
          const on = st.tab === k;
          if (W.button(g, 'tab-' + k, 4 + i * 125, 26, 123, 20, { label, latched: on, color: on ? C.marigold : undefined, dark: on ? C.marigoldD : undefined })) st.tab = k;
        });
        if (st.tab === 'suggest') {
          if (W.button(g, 'inbox-filter', 4, 49, 248, 18, { label: 'Showing: ' + st.filter + '  ▶' })) {
            st.filter = FILTERS[(FILTERS.indexOf(st.filter) + 1) % FILTERS.length];
            st.scroll = 0;
          }
          const items = this.sugs();
          const hit = W.list(g, 'sugs', st, items, 4, 70, 248, 120, {
            rowH: 24, empty: st.filter === 'new' ? 'No new suggestions.' : 'Nothing here.',
            render(g2, s, x, y, w) {
              g2.rrect(x, y + 7, 7, 7, W.statusColor(s.status), 1);
              g2.text(dShort(s.t), x + 11, y + 8, th.soft);
              g2.text(truncate(s.text, w - 52), x + 48, y + 8, th.text);
            },
          });
          if (hit >= 0) App.push('suggestion', { id: items[hit].id, ids: items.map((s) => s.id) });
        } else {
          const items = this.prompts();
          const hit = W.list(g, 'prompts', { get scroll() { return st.pscroll; }, set scroll(v) { st.pscroll = v; } }, items, 4, 50, 248, 140, {
            rowH: 24,
            render(g2, p, x, y, w) {
              const n = Store.commentCounts(p.id).reduce((a, b) => a + b, 0);
              const tag = n + ' new' + (p.retired ? ' · retired' : '');
              g2.text(truncate(p.text, w - measure(tag) - 8), x, y + 8, th.text);
              g2.text(tag, x + w, y + 8, th.soft, 1, 'right');
            },
          });
          if (hit >= 0) App.push('commentDetail', { id: items[hit].id });
        }
      },
    };
  };

  S.suggestion = (args) => {
    let id = args.id;
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'SUGGESTION');
        const s = Store.state.suggestions.find((x) => x.id === id);
        if (!s) return;
        const cw = W.chip(g, s.status.toUpperCase(), 10, 24, W.statusColor(s.status));
        g.text('Received ' + dLong(s.t), 16 + cw, 26, th.soft);
        const i = args.ids.indexOf(id);
        if (i >= 0) g.text(i + 1 + ' of ' + args.ids.length, 246, 26, th.soft, 1, 'right');
        g.rbox(8, 40, 240, 144, th.panel, th.panelEdge, 3);
        g.textBlock(s.text, 16, 46, 224, 132, th.text, { maxScale: s.text.length < 60 ? 2 : 1, align: 'left', valign: 'top' });
      },
      bottom(g) {
        W.bg(g);
        const s = Store.state.suggestions.find((x) => x.id === id);
        const bar = W.topBar(g, 'Suggestion');
        if (bar.back || !s) return this.back();
        const i = args.ids.indexOf(id);
        const step = (d) => {
          let j = i + d;
          while (j >= 0 && j < args.ids.length && !Store.state.suggestions.some((x) => x.id === args.ids[j])) j += d;
          if (j >= 0 && j < args.ids.length) id = args.ids[j];
        };
        actions(g, [
          { label: s.status === 'reviewed' ? 'Mark as new' : 'Mark reviewed', primary: s.status !== 'reviewed',
            run: () => App.attempt(() => Store.setSuggestionStatus(s.id, s.status === 'reviewed' ? 'new' : 'reviewed')) },
          { label: s.status === 'archived' ? 'Unarchive' : 'Archive',
            run: () => App.attempt(() => Store.setSuggestionStatus(s.id, s.status === 'archived' ? 'reviewed' : 'archived'),
                                   s.status === 'archived' ? 'Moved back to reviewed' : 'Archived') },
          { label: '◀ Previous', run: () => step(-1), disabled: i <= 0 },
          { label: 'Next ▶', run: () => step(1), disabled: i < 0 || i >= args.ids.length - 1 },
          { label: 'Delete permanently', danger: true, wide: true,
            run: () => App.confirm({ title: 'Delete suggestion?', body: 'This removes the text from the terminal for good. Archive instead to keep a record.',
                                     confirm: 'Delete', danger: true,
                                     onConfirm: () => { const j = i; App.attempt(() => Store.deleteSuggestion(s.id), 'Deleted');
                                       const next = args.ids.slice(j + 1).find((x) => Store.state.suggestions.some((y) => y.id === x));
                                       if (next) id = next; else App.pop(); } }) },
        ], 32, { h: 34 });
      },
    };
  };

  S.commentDetail = (args) => ({
    public: false,
    back() { App.pop(); },
    top(g) {
      const th = adminTop(g, 'COMMENTS');
      const p = Store.prompt(args.id);
      if (!p) return;
      g.textBlock(p.text, 10, 22, 236, 20, th.text, { maxScale: 1, align: 'left' });
      const counts = Store.commentCounts(p.id);
      const total = counts.reduce((a, b) => a + b, 0);
      W.resultBars(g, p.options, counts, 12, 46, 232, 116, 9, -1, RESPONSE);
      const arch = Store.state.comments.filter((c) => c.prompt === p.id && c.status === 'archived').length;
      const first = Store.state.comments.find((c) => c.prompt === p.id && c.status === 'new');
      g.text(plural(total, 'response') + (first ? ' since ' + dShort(first.t) : '') + ' · ' + arch + ' archived', 10, 178, th.soft);
    },
    bottom(g) {
      W.bg(g);
      const th = W.theme();
      const p = Store.prompt(args.id);
      const bar = W.topBar(g, 'Comment responses');
      if (bar.back || !p) return this.back();
      const n = Store.commentCounts(p.id).reduce((a, b) => a + b, 0);
      lines(g, ['Archiving moves these responses into the records and restarts the counts shown here.',
                '', 'Archived responses stay in exports until deleted from Records.'], 8, 32, { w: 240 });
      if (W.button(g, 'cd-arch', 8, 120, 240, 40, { label: 'Archive ' + plural(n, 'response') + ' & restart', disabled: !n })) {
        App.confirm({ title: 'Archive responses?', body: 'Archive ' + plural(n, 'response') + ' for "' + p.text + '"?',
                      confirm: 'Archive', onConfirm: () => App.attempt(() => Store.archiveComments(p.id), (k) => 'Archived ' + k) });
      }
    },
  });

  // ---------- Results & history ----------
  function historyItems() {
    return Store.state.polls.filter((p) => p.activatedAt).sort((a, b) => b.activatedAt - a.activatedAt);
  }

  S.history = () => {
    const st = { scroll: 0 };
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'HISTORY');
        g.text('Results & History', 10, 24, th.text, 2);
        lines(g, [plural(historyItems().length, 'poll') + ' with results.', '',
                  'Totals count responses, not unique people: the terminal cannot tell visitors apart.', '',
                  'Each revision keeps its own question, answers and counts.'], 10, 48, { w: 236 });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Results & History');
        if (bar.back) return this.back();
        const items = historyItems();
        const hit = W.list(g, 'hist', st, items, 4, 26, 248, 164, {
          rowH: 23, empty: 'No poll has been activated yet.',
          render(g2, p, x, y, w) {
            const cw = W.chip(g2, p.status.toUpperCase(), x, y + 5, W.statusColor(p.status));
            const tot = String(Store.total(p));
            g2.text(truncate(p.question, w - cw - measure(tot) - 12), x + cw + 5, y + 7, th.text);
            g2.text(tot, x + w, y + 7, th.soft, 1, 'right');
          },
        });
        if (hit >= 0) App.push('historyDetail', { id: items[hit].id });
      },
    };
  };

  S.historyDetail = (args) => {
    let id = args.id;
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'RESULTS');
        const p = Store.poll(id);
        if (!p) return;
        g.textBlock(p.question, 10, 22, 236, 20, th.text, { maxScale: 1, align: 'left' });
        W.resultBars(g, p.choices, p.counts, 12, 46, 232, 124, 9);
        g.text(plural(Store.total(p), 'response') + ' (not unique people)', 128, 178, th.soft, 1, 'center');
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const p = Store.poll(id);
        const bar = W.topBar(g, 'Poll results');
        if (bar.back || !p) return this.back();
        const items = historyItems();
        const i = items.findIndex((x) => x.id === p.id);
        const info = [
          'Status: ' + p.status + ' · revision ' + p.rev + ' · id ' + p.id,
          'Active: ' + dLong(p.activatedAt) + (p.endedAt ? ' to ' + dLong(p.endedAt) : ' (ongoing)'),
          p.lastVoteAt ? 'Last response: ' + dLong(p.lastVoteAt) : 'No responses yet',
        ];
        if (p.revisionOf) info.push('Revised from ' + p.revisionOf);
        if (p.replacedBy) info.push('Replaced by ' + p.replacedBy);
        lines(g, info, 8, 30, { w: 240 });
        actions(g, [
          { label: '◀ Newer', run: () => (id = items[i - 1].id), disabled: i <= 0 },
          { label: 'Older ▶', run: () => (id = items[i + 1].id), disabled: i < 0 || i >= items.length - 1 },
        ], 150);
      },
    };
  };

  // ---------- Appearance & behaviour ----------
  const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];

  S.appearance = () => {
    const st = { scroll: 0 };
    const set = (k, v) => App.attempt(() => Store.setSetting(k, v));
    const mode = (k) => App.attempt(() => Store.setMode(k, !Store.state.settings.modes[k]));
    return {
      public: false,
      back() { App.pop(); },
      onResume(r) { if (r && r.key === 'prompt') set('suggestPrompt', r.value); },
      rows() {
        const s = Store.state.settings;
        const onoff = (v) => (v ? 'On' : 'Off');
        return [
          ['Theme', PPT.Gfx.THEMES[s.theme].name, () => set('theme', cycle(Object.keys(PPT.Gfx.THEMES), s.theme))],
          ['Idle animation', { lively: 'Lively', calm: 'Calm', off: 'Off' }[s.idle], () => set('idle', cycle(['lively', 'calm', 'off'], s.idle))],
          ['Vote', onoff(s.modes.vote), () => mode('vote')],
          ['Suggest', onoff(s.modes.suggest), () => mode('suggest')],
          ['Comment', onoff(s.modes.comment), () => mode('comment')],
          ['Confirm before counting a vote', onoff(s.confirmVotes), () => set('confirmVotes', !s.confirmVotes)],
          ['Visitor timeout', s.sessionTimeout + 's', () => set('sessionTimeout', cycle([30, 45, 60, 90, 120], s.sessionTimeout))],
          ['Results shown for', s.resultsSeconds + 's', () => set('resultsSeconds', cycle([6, 8, 12, 15, 20], s.resultsSeconds))],
          ['Suggestion length', s.suggestLimit + ' chars', () => set('suggestLimit', cycle([100, 140, 200, 280], s.suggestLimit))],
          ['Suggest prompt ▶', truncate(s.suggestPrompt, 90), () => App.push('textEntry', { title: 'Suggest prompt', value: s.suggestPrompt, max: 60, key: 'prompt' })],
          ['Comment prompts ▶', Store.enabledPrompts().length + ' on', () => App.push('prompts')],
        ];
      },
      top(g, t) {
        PPT.Public.drawLandingTop(g, t, { poll: Store.state.settings.modes.vote ? Store.activePoll() : null, key: 'appearance' });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Appearance & Behaviour');
        if (bar.back) return this.back();
        const rows = this.rows();
        const hit = W.list(g, 'appr', st, rows, 4, 26, 248, 164, {
          rowH: 23,
          render(g2, r, x, y, w) {
            g2.text(truncate(r[0], w - measure(String(r[1])) - 10), x + 2, y + 7, th.text);
            g2.text(String(r[1]), x + w - 2, y + 7, th.accent, 1, 'right');
          },
        });
        if (hit >= 0) rows[hit][2]();
      },
    };
  };

  S.prompts = () => {
    const st = { scroll: 0 };
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'PROMPTS');
        g.text('Comment prompts', 10, 24, th.text, 2);
        lines(g, ['Visitors who tap Comment get the enabled prompts in rotation.', '',
                  'Prompts with responses are never rewritten: editing one retires it and starts a new prompt, so old counts keep their meaning.', '',
                  plural(Store.state.prompts.filter((p) => p.retired).length, 'retired prompt') + ' kept for records.'], 10, 48, { w: 236 });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Comment prompts', { right: '+ New', rightW: 50 });
        if (bar.back) return this.back();
        if (bar.right) return App.push('promptEdit', {});
        const items = Store.state.prompts.filter((p) => !p.retired);
        const hit = W.list(g, 'pl', st, items, 4, 26, 248, 164, {
          rowH: 23, empty: 'No prompts. Tap + New.',
          render(g2, p, x, y, w) {
            const cw = W.chip(g2, p.enabled ? 'ON' : 'OFF', x, y + 5, p.enabled ? C.sea : C.inkFaint);
            g2.text(truncate(p.text, w - cw - 6), x + cw + 5, y + 7, th.text);
          },
        });
        if (hit >= 0) App.push('promptEdit', { id: items[hit].id });
      },
    };
  };

  S.promptEdit = (args) => {
    const src = args.id ? Store.prompt(args.id) : null;
    const f = { text: src ? src.text : '', options: src ? src.options.slice() : Store.RESPONSE_SETS[0].slice(), enabled: src ? src.enabled : true };
    const presetIdx = () => Store.RESPONSE_SETS.findIndex((s) => s.join('|') === f.options.join('|'));
    let custom = presetIdx() < 0;
    let dirty = false;
    const hasResponses = () => src && Store.state.comments.some((c) => c.prompt === src.id);
    return {
      public: false,
      back() {
        if (!dirty) return App.pop();
        App.confirm({ title: 'Discard changes?', body: 'Your edits to this prompt will be lost.', confirm: 'Discard', danger: true, onConfirm: () => App.pop() });
      },
      onResume(r) {
        if (!r) return;
        dirty = true;
        if (r.key === 'text') f.text = r.value; else f.options[r.key] = r.value;
      },
      top(g) {
        const th = adminTop(g, 'PREVIEW');
        g.rbox(8, 24, 240, 90, th.panel, th.panelEdge, 3);
        g.textBlock(f.text || 'Your prompt appears here', 16, 30, 224, 78, f.text ? th.text : th.soft, { maxScale: 2 });
        const n = f.options.length, bw = Math.floor((240 - 4 * (n - 1)) / n);
        f.options.forEach((o, i) => {
          const col = RESPONSE[i % 4];
          g.rrect(8 + i * (bw + 4), 124, bw, 40, col.base, 2);
          g.textBlock(o || '?', 12 + i * (bw + 4), 128, bw - 8, 32, PPT.Gfx.onColor(col.base), { maxScale: 1 });
        });
        if (hasResponses()) g.textBlock('! Has responses: saving changes retires this prompt and creates a new one.', 8, 170, 240, 20, C.coralD, { maxScale: 1, align: 'left' });
      },
      bottom(g) {
        W.bg(g);
        const bar = W.topBar(g, src ? 'Edit prompt' : 'New prompt');
        if (bar.back) return this.back();
        if (W.row(g, 'pr-text', 4, 26, 248, 20, 'Prompt', f.text ? truncate(f.text, 160) : 'Tap to write')) {
          App.push('textEntry', { title: 'Prompt', value: f.text, max: 80, key: 'text' });
        }
        const pi = presetIdx();
        const presetName = custom ? 'Custom' : Store.RESPONSE_SETS[pi].join(' / ');
        if (W.row(g, 'pr-preset', 4, 48, 248, 20, 'Responses', presetName)) {
          dirty = true;
          const next = custom ? 0 : pi + 1;
          if (next >= Store.RESPONSE_SETS.length) { custom = true; f.options = f.options.slice(); }
          else { custom = false; f.options = Store.RESPONSE_SETS[next].slice(); }
        }
        let y = 70;
        if (custom) {
          f.options.forEach((o, i) => {
            if (W.row(g, 'pr-o' + i, 4, y, 248, 18, 'Option ' + (i + 1), o || 'Tap to write')) {
              App.push('textEntry', { title: 'Option ' + (i + 1), value: o, max: 20, key: i });
            }
            y += 20;
          });
          if (W.button(g, 'pr-add', 4, y, 122, 18, { label: '+ Add option', disabled: f.options.length >= 4 })) { f.options.push(''); dirty = true; }
          if (W.button(g, 'pr-rem', 130, y, 122, 18, { label: '− Remove last', disabled: f.options.length <= 2 })) { f.options.pop(); dirty = true; }
          y += 20;
        }
        if (W.row(g, 'pr-en', 4, y, 248, 18, 'Shown to visitors', f.enabled ? 'On' : 'Off')) { f.enabled = !f.enabled; dirty = true; }
        const valid = f.text.trim() && f.options.every((o) => o.trim());
        const save = () => {
          const id = App.attempt(() => Store.savePrompt(src && src.id, f), 'Saved');
          if (id) { dirty = false; App.pop(); }
        };
        if (W.button(g, 'pr-save', 4, 164, src ? 160 : 248, 26, { label: 'Save', color: C.sea, dark: C.seaD, disabled: !valid })) {
          const changed = src && (src.text !== f.text || src.options.join('|') !== f.options.join('|'));
          if (changed && hasResponses()) {
            App.confirm({ title: 'Start a new prompt?', body: 'This prompt has responses. Saving retires it (its responses stay in records) and creates a new prompt with your changes.',
                          confirm: 'Save', onConfirm: save });
          } else save();
        }
        if (src && W.button(g, 'pr-del', 168, 164, 84, 26, { label: hasResponses() ? 'Retire' : 'Delete', color: C.coral, dark: C.coralD })) {
          App.confirm({ title: hasResponses() ? 'Retire prompt?' : 'Delete prompt?',
                        body: hasResponses() ? 'Visitors will stop seeing it. Its responses stay in records.' : 'This prompt has no responses and will be removed.',
                        confirm: hasResponses() ? 'Retire' : 'Delete', danger: true,
                        onConfirm: () => { if (App.attempt(() => Store.deletePrompt(src.id), 'Done')) App.pop(); } });
        }
      },
    };
  };

  // ---------- Records & storage ----------
  S.records = () => {
    const st = { scroll: 0 };
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'RECORDS');
        const s = storageBar(g, 10, 36, 236);
        g.text('SD card · ' + kb(s.used) + ' of ' + kb(s.capacity) + ' (' + Math.round(s.pct * 100) + '%)', 10, 24, th.text);
        const f = (name) => { const x = s.files.find((v) => v.path === '/ppt/' + name); return x ? kb(x.size) : '—'; };
        const exports = s.files.filter((v) => v.path.startsWith('/ppt/export/'));
        const st2 = Store.state;
        lines(g, [
          'data.json ' + f('data.json') + ' · data.bak ' + f('data.bak') + ' · journal ' + f('journal.log'),
          exports.length + ' export files (' + kb(exports.reduce((n, v) => n + v.size, 0)) + ')',
          Store.journalCount + ' submissions since last checkpoint' + (Store.lastCommit ? ' (' + dLong(Store.lastCommit) + ')' : ''),
          '',
          st2.polls.length + ' polls · ' + st2.suggestions.length + ' suggestions · ' + st2.comments.length + ' comments',
          '',
          'Last start-up:',
          ...Store.report,
        ], 10, 50, { w: 236 });
      },
      rows() {
        const st2 = Store.state;
        const reviewed = st2.suggestions.filter((s) => s.status === 'reviewed').length;
        const archived = st2.suggestions.filter((s) => s.status === 'archived').length + st2.comments.filter((c) => c.status === 'archived').length;
        return [
          ['Export CSV files', () => {
            const files = App.attempt(() => Store.exportCSV());
            if (files) App.alert('Exported', 'Saved to SD:/ppt/export/\n' + files.map((p) => p.split('/').pop()).join('\n'));
          }],
          ['Full backup (JSON)', () => {
            const p = App.attempt(() => Store.exportBackup());
            if (p) App.alert('Backup saved', 'SD:' + p + '\n\nCopy it to a computer to keep it safe.');
          }],
          ['Restore from backup ▶', () => App.push('restore')],
          ['Archive reviewed suggestions (' + reviewed + ')', () => {
            if (!reviewed) return App.toast('No reviewed suggestions');
            App.confirm({ title: 'Archive reviewed?', body: 'Move ' + plural(reviewed, 'reviewed suggestion') + ' to the archive. Nothing is deleted.',
                          confirm: 'Archive', onConfirm: () => App.attempt(() => Store.archiveReviewed(), (n) => 'Archived ' + n) });
          }],
          ['Delete archived feedback (' + archived + ')', () => {
            if (!archived) return App.toast('Nothing archived');
            App.confirm({ title: 'Delete archived?', body: 'Permanently delete ' + plural(archived, 'archived item') +
                          ' (suggestions and comment responses). Polls are not affected. Export first if you want a copy.',
                          confirm: 'Delete', danger: true, hold: 2, onConfirm: () => App.attempt(() => Store.deleteArchivedFeedback(), (n) => 'Deleted ' + n) });
          }],
          ['Check data integrity', () => {
            try { App.alert('Integrity check', Store.checkIntegrity().map((l) => (l[0] === '!' ? '✕ ' + l.slice(1).trim() : '✓ ' + l)).join('\n')); }
            catch (e) { App.alert('Integrity check', 'Could not read storage: ' + e.message); }
          }],
          ['Prepare for shutdown / card removal', () => App.push('shutdown')],
        ];
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Records & Storage');
        if (bar.back) return this.back();
        const rows = this.rows();
        const hit = W.list(g, 'rec', st, rows, 4, 26, 248, 164, {
          rowH: 23, render(g2, r, x, y, w) { g2.text(truncate(r[0], w), x + 2, y + 7, th.text); },
        });
        if (hit >= 0) rows[hit][1]();
      },
    };
  };

  S.restore = () => {
    const st = { scroll: 0 };
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'RESTORE');
        g.text('Restore from backup', 10, 24, th.text, 2);
        lines(g, ['Backups are read from SD:/ppt/export/.', '', '! Restoring replaces all current polls, feedback and settings with the backup.',
                  '', 'Make a fresh backup first if you might need the current data.'], 10, 48, { w: 236 });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Choose a backup');
        if (bar.back) return this.back();
        let items = [];
        try { items = Store.listBackups(); } catch (e) { /* card missing */ }
        const hit = W.list(g, 'bk', st, items, 4, 26, 248, 164, {
          rowH: 23, empty: 'No backups found on the SD card.',
          render(g2, p, x, y, w) { g2.text(truncate(p.split('/').pop(), w), x + 2, y + 7, th.text); },
        });
        if (hit >= 0) {
          const p = items[hit];
          App.confirm({ title: 'Restore this backup?', body: p.split('/').pop() + '\n\nCurrent data will be replaced.', confirm: 'Restore',
                        danger: true, hold: 2, onConfirm: () => { if (App.attempt(() => Store.restoreBackup(p), 'Backup restored')) App.go('adminHome'); } });
        }
      },
    };
  };

  S.shutdown = () => {
    let ok = false, err = null;
    try { Store.prepareShutdown(); ok = true; } catch (e) { if (e instanceof SD.PowerCut) throw e; err = e.message; }
    return {
      public: false,
      back() { App.pop(); },
      top(g, t) {
        const th = W.theme();
        g.clear(ok ? C.sea : C.coral);
        if (ok) {
          W.mascot(g, 'shutdown', 128, 86, 3, { mood: 'sleep', shadowColor: C.seaD, fg: C.white });
          g.text('Safe to switch off', 128, 100, C.white, 2, 'center');
          g.textBlock('All data is saved. You can power off the console or remove the SD card.', 20, 128, 216, 40, C.white, { maxScale: 1 });
        } else {
          W.mascot(g, 'shutdown', 128, 70, 2, { mood: 'worried', shadowColor: C.coralD, fg: C.white });
          g.text('Not safe yet', 128, 76, C.white, 2, 'center');
          g.textBlock('Could not finish saving: ' + err + '. Do not remove the card.', 20, 100, 216, 50, C.white, { maxScale: 1 });
        }
      },
      bottom(g) {
        W.bg(g);
        if (W.button(g, 'sd-resume', 32, 70, 192, 52, { label: 'Resume', scale: 2 })) this.back();
      },
    };
  };

  // ---------- Terminal settings ----------
  S.settings = () => {
    const st = { scroll: 0 };
    return {
      public: false,
      back() { App.pop(); },
      onResume(r) { if (r && r.key === 'venue') App.attempt(() => Store.setVenue(r.value), 'Saved'); },
      rows() {
        const s = Store.state.settings;
        return [
          ['Venue name', Store.state.venue, () => App.push('textEntry', { title: 'Venue name', value: Store.state.venue, max: 28, key: 'venue' })],
          ['Change PIN ▶', Store.state.security.isDefault ? 'default!' : 'set', () => App.push('pin', { purpose: 'change' })],
          ['Admin auto-lock', s.adminTimeout / 60 + ' min', () => App.attempt(() => Store.setSetting('adminTimeout', cycle([60, 120, 300, 600], s.adminTimeout)))],
          ['End session & lock now', '', () => App.lock()],
          ['Forgot-PIN procedure ▶', '', () => App.push('info', { title: 'Forgot PIN', body: [
            'Candidate procedure (decision still open):', '',
            '1. Power off and remove the SD card.',
            '2. On a computer, create an empty file named RESETPIN.TXT in the /ppt folder.',
            '3. Reinsert the card and start the terminal.',
            '4. The PIN resets to 1234 and a warning shows until it is changed.', '',
            'Requires physical access to the card, so it adds no public bypass.',
            'In this prototype: Dev panel → "Drop RESETPIN.TXT", then Power cut.'] })],
          ['Erase all terminal data ▶', '', () => App.confirm({
            title: 'Erase everything?', danger: true, confirm: 'Erase', hold: 3,
            body: 'Deletes all polls, votes, suggestions, comments and settings, and resets the PIN to 1234. Export files on the card are kept.',
            onConfirm: () => { App.attempt(() => Store.factoryReset()); App.admin = false; App.go(Store.ok ? 'landing' : 'nosd'); },
          })],
          ['About this prototype ▶', '', () => App.push('info', { title: 'About', body: [
            'Public Participation Terminal', 'Browser prototype of the DS/DSi application.', '',
            'Hardware behaviour (SD card, power, buttons) is simulated and must be verified on a DSi XL.', '',
            'Data format 1 · journal + snapshot storage'] })],
        ];
      },
      top(g) {
        const th = adminTop(g, 'SETTINGS');
        const sec = Store.state.security;
        g.text('Terminal Settings', 10, 24, th.text, 2);
        lines(g, [
          'Venue: ' + Store.state.venue,
          sec.isDefault ? '! PIN: default (1234). Change it before deploying.' : 'PIN: set (salted hash, ' + sec.iterations + ' rounds)',
          'Admin locks after ' + Store.state.settings.adminTimeout / 60 + ' min without input.',
          '',
          'Open admin from the public screen by holding L+R for 1.5s, or by holding the top-left corner of the touchscreen for 3s.',
        ], 10, 48, { w: 236 });
      },
      bottom(g) {
        W.bg(g);
        const th = W.theme();
        const bar = W.topBar(g, 'Terminal Settings');
        if (bar.back) return this.back();
        const rows = this.rows();
        const hit = W.list(g, 'set', st, rows, 4, 26, 248, 164, {
          rowH: 23,
          render(g2, r, x, y, w) {
            g2.text(truncate(r[0], w - measure(String(r[1])) - 10), x + 2, y + 7, th.text);
            g2.text(String(r[1]), x + w - 2, y + 7, r[1] === 'default!' ? C.coralD : th.accent, 1, 'right');
          },
        });
        if (hit >= 0) rows[hit][2]();
      },
    };
  };

  S.info = (args) => ({
    public: false,
    back() { App.pop(); },
    top(g) {
      const th = adminTop(g, 'INFO');
      g.text(args.title, 10, 24, th.text, 2);
      lines(g, args.body, 10, 48, { w: 236 });
    },
    bottom(g) {
      W.bg(g);
      if (W.topBar(g, args.title).back) this.back();
    },
  });
})(window.PPT = window.PPT || {});
