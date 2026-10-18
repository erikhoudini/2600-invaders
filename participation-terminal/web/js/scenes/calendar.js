// Calendar (admin): month view with daily activity, a week planner for
// scheduled polls, and the optional clock-driven settings. Every feature
// here is optional; the daily tallies behind the month view are always kept.
(function (PPT) {
  'use strict';

  const { C, CHOICE, measure, truncate } = PPT.Gfx;
  const { W, App, Store, Cal, Clock } = PPT;
  const { adminTop, lines, plural } = PPT.Admin;
  const S = PPT.Scenes;

  // A stable colour per poll, so the same poll reads the same across the month.
  function pollColor(id) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return CHOICE[h % 4];
  }

  function scheduleLabel(day) {
    const e = Store.scheduled(day);
    if (e === null) return 'No poll';
    if (e) { const p = Store.poll(e); return p ? p.question : '(deleted poll)'; }
    return null;
  }

  // ---------- Month view ----------
  S.calendar = (args) => {
    const st = { sel: args.day || Store.today() };
    const d0 = Cal.parse(st.sel);
    st.y = d0.getFullYear();
    st.m = d0.getMonth();

    function move(n) {
      st.sel = Cal.add(st.sel, n);
      const d = Cal.parse(st.sel);
      st.y = d.getFullYear();
      st.m = d.getMonth();
    }
    function month(n) {
      const d = new Date(st.y, st.m + n, 1, 12);
      st.y = d.getFullYear();
      st.m = d.getMonth();
      st.sel = Cal.key(d);
    }

    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'CALENDAR');
        const today = Store.today();
        const day = st.sel;
        const future = Cal.diff(today, day) > 0;
        g.textBlock(Cal.long(day), 10, 22, 236, 18, th.text, { maxScale: 2, align: 'left' });
        g.text(Cal.relative(day, today) + (Store.cal().schedule ? '' : ' · schedule off'), 10, 42, th.soft);

        let y = 56;
        const sched = scheduleLabel(day);
        if (sched !== null) {
          const e = Store.scheduled(day);
          const cw = W.chip(g, 'SCHEDULED', 10, y, e ? pollColor(e).base : C.inkFaint);
          g.text(truncate(sched, 228 - cw), 16 + cw, y + 2, th.text);
        } else if (day === today) {
          const p = Store.activePoll();
          g.text(p ? 'Live now: ' + truncate(p.question, 180) : 'No poll live', 10, y + 2, th.text);
        } else if (future) {
          g.text(Store.cal().schedule && Store.cal().unscheduled === 'none' ? 'Nothing scheduled: no poll'
            : 'Nothing scheduled: current poll continues', 10, y + 2, th.soft);
        }
        y += 18;

        if (future) {
          lines(g, ['Nothing recorded yet.'], 10, y);
        } else {
          const s = Store.dayStats(day);
          g.text(plural(s.votes, 'vote') + ' · ' + plural(s.s, 'suggestion') + ' · ' + plural(s.c, 'comment'), 10, y, th.text);
          y += 14;
          for (const id of Object.keys(s.polls).slice(0, 3)) {
            const p = Store.poll(id);
            const counts = s.polls[id];
            const total = counts.reduce((a, b) => a + b, 0);
            g.text(truncate(p ? p.question : id, 180), 10, y, th.soft);
            g.text(String(total), 246, y, th.soft, 1, 'right');
            // One stacked bar per poll, segment colours = answer colours.
            let x = 10;
            counts.forEach((n, i) => {
              const w = total ? Math.round((n / total) * 236) : 0;
              g.rect(x, y + 10, w, 6, CHOICE[i].base);
              x += w;
            });
            if (!total) g.rect(10, y + 10, 236, 6, th.panelEdge);
            y += 22;
          }
          if (!s.votes && !s.s && !s.c) g.text('A quiet day.', 10, y, th.soft);
        }
        const s = Store.dayStats(day);
        const busy = s.votes + s.s + s.c;
        W.mascot(g, 'calendar', 226, 186, 2, { mood: future ? 'think' : busy >= 10 ? 'happy' : busy ? 'idle' : 'sleep' });
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const bar = W.topBar(g, Cal.MONTHS[st.m] + ' ' + st.y);
        if (bar.back) return this.back();
        if (W.button(g, 'cal-prev', 198, 2, 26, 19, { label: '◀' })) month(-1);
        if (W.button(g, 'cal-next', 228, 2, 26, 19, { label: '▶' })) month(1);
        if (App.pad('left')) move(-1);
        if (App.pad('right')) move(1);
        if (App.pad('up')) move(-7);
        if (App.pad('down')) move(7);

        'MTWTFSS'.split('').forEach((ch, i) => g.text(ch, 2 + i * 36 + 18, 26, i >= 5 ? C.coralD : th.soft, 1, 'center'));
        const today = Store.today();
        const grid = Cal.monthGrid(st.y, st.m);
        grid.forEach((key, i) => {
          const x = 2 + (i % 7) * 36, y = 36 + Math.floor(i / 7) * 21;
          const inMonth = Cal.parse(key).getMonth() === st.m;
          const r = PPT.UI.region('cal-' + key, x, y, 35, 20);
          const sel = key === st.sel;
          g.rrect(x, y, 35, 20, sel ? C.marigoldL : r.pressed ? th.panelEdge : inMonth ? th.panel : th.bg, 2);
          g.text(String(Cal.parse(key).getDate()), x + 3, y + 3, sel ? C.ink : inMonth ? th.text : th.soft);
          if (key === today) g.frame(x, y, 35, 20, C.coral, 1);
          const e = Store.scheduled(key);
          if (e) g.rect(x + 2, y + 15, 31, 3, pollColor(e).base);
          else if (e === null) g.dither(x + 2, y + 15, 31, 3, th.soft);
          const s = Store.dayStats(key);
          const n = s.votes + s.s + s.c;
          const dots = n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3;
          for (let k = 0; k < dots; k++) g.rect(x + 30 - k * 4, y + 4, 2, 2, C.sea);
          if (r.clicked) {
            if (sel) App.push('dayDetail', { day: key });
            else { st.sel = key; if (!inMonth) { const d = Cal.parse(key); st.y = d.getFullYear(); st.m = d.getMonth(); } }
          }
        });

        if (W.button(g, 'cal-today', 2, 166, 56, 24, { label: 'Today' })) { st.sel = today; const d = Cal.parse(today); st.y = d.getFullYear(); st.m = d.getMonth(); }
        if (W.button(g, 'cal-week', 62, 166, 96, 24, { label: 'Plan this week', color: C.sea, dark: C.seaD })) {
          App.push('weekPlan', { monday: Cal.weekStart(st.sel) });
        }
        if (W.button(g, 'cal-opts', 162, 166, 92, 24, { label: 'Options' })) App.push('calendarSettings');
      },
    };
  };

  // ---------- One day in detail ----------
  S.dayDetail = (args) => {
    const st = { scroll: 0 };
    const day = args.day;
    const inDay = (t) => Store.dayKey(t) === day;
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'DAY');
        g.text(Cal.long(day), 10, 24, th.text, 2);
        const s = Store.dayStats(day);
        const ids = Object.keys(s.polls);
        let y = 46;
        if (ids.length) {
          // The day's busiest poll, as full result bars for that day only.
          ids.sort((a, b) => s.polls[b].reduce((x, z) => x + z, 0) - s.polls[a].reduce((x, z) => x + z, 0));
          const p = Store.poll(ids[0]);
          if (p) {
            g.text(truncate(p.question, 236), 10, y, th.soft);
            const bh = Math.min(100, p.choices.length * 25);
            W.resultBars(g, p.choices, s.polls[p.id], 12, y + 14, 232, bh, 9);
            y += bh + 18;
          }
        }
        const byPrompt = {};
        for (const c of Store.state.comments) {
          if (!inDay(c.t)) continue;
          (byPrompt[c.prompt] = byPrompt[c.prompt] || []).push(c.label);
        }
        const out = [];
        for (const id in byPrompt) {
          const pr = Store.prompt(id);
          const tally = {};
          byPrompt[id].forEach((l) => (tally[l] = (tally[l] || 0) + 1));
          out.push(truncate(pr ? pr.text : id, 230));
          out.push('  ' + Object.entries(tally).map(([k, v]) => k + ' ' + v).join(' · '));
        }
        if (!ids.length && !out.length) out.push('No votes or comments on this day.');
        lines(g, out, 10, y, { w: 236 });
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const bar = W.topBar(g, 'Suggestions · ' + Cal.short(day));
        if (bar.back) return this.back();
        const items = Store.state.suggestions.filter((s) => inDay(s.t));
        const hit = W.list(g, 'day-sugs', st, items, 4, 26, 248, 164, {
          rowH: 24, empty: 'No suggestions on this day.',
          render(g2, s, x, y, w) {
            g2.rrect(x, y + 7, 7, 7, W.statusColor(s.status), 1);
            g2.text(Cal.time(new Date(s.t)), x + 11, y + 8, th.soft);
            g2.text(truncate(s.text, w - 46), x + 42, y + 8, th.text);
          },
        });
        if (hit >= 0) App.push('suggestion', { id: items[hit].id, ids: items.map((s) => s.id) });
      },
    };
  };

  // ---------- Week planner ----------
  S.weekPlan = (args) => {
    const st = { monday: args.monday };
    return {
      public: false,
      back() { App.pop(); },
      top(g) {
        const th = adminTop(g, 'WEEK');
        const c = Store.cal();
        const sun = Cal.add(st.monday, 6);
        g.text('Week of ' + Cal.short(st.monday).slice(4), 10, 24, th.text, 2);
        let n = 0;
        for (let i = 0; i < 7; i++) if (Store.scheduled(Cal.add(st.monday, i)) !== undefined) n++;
        lines(g, [
          Cal.short(st.monday) + ' – ' + Cal.short(sun) + ' · ' + n + ' of 7 days planned',
          '',
          c.schedule ? 'Polls switch automatically at ' + Cal.hhmm(c.dayStart) + ' each day.'
                     : '! The schedule is off. Turn it on in Calendar → Options to switch polls automatically.',
          'Days with nothing planned ' + (c.unscheduled === 'none' ? 'show no poll.' : 'keep the current poll.'),
          '',
          'A poll can run on several days. Its votes add up, and each day’s share is kept for the calendar.',
          '',
          'You can still switch polls by hand; the schedule takes over again the next day.',
        ], 10, 48, { w: 236 });
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const bar = W.topBar(g, 'Plan the week');
        if (bar.back) return this.back();
        const today = Store.today();
        for (let i = 0; i < 7; i++) {
          const day = Cal.add(st.monday, i);
          const past = Cal.diff(today, day) < 0;
          const y = 26 + i * 20;
          const r = PPT.UI.region('wk-' + day, 4, y, 248, 18, past);
          g.rrect(4, y, 248, 18, r.pressed ? th.panelEdge : past ? th.bg : th.panel, 2);
          if (day === today) g.frame(4, y, 248, 18, C.coral, 1);
          g.text(Cal.short(day).slice(0, 6), 9, y + 6, past ? th.soft : th.text);
          const e = Store.scheduled(day);
          if (e) g.rect(48, y + 4, 4, 10, pollColor(e).base);
          const label = scheduleLabel(day);
          g.text(truncate(label === null ? '—' : label, 190), 56, y + 6, label === null || past ? th.soft : th.text);
          if (r.clicked) App.push('pollPicker', { day });
        }
        if (W.button(g, 'wk-prev', 4, 168, 40, 22, { label: '◀' })) st.monday = Cal.add(st.monday, -7);
        if (W.button(g, 'wk-copy', 48, 168, 160, 22, { label: 'Copy to next week' })) {
          const next = Cal.add(st.monday, 7);
          App.confirm({
            title: 'Copy this week?',
            body: 'Copy the planned days to the week of ' + Cal.short(next).slice(4) + '. Days planned there already are replaced.',
            confirm: 'Copy',
            onConfirm: () => {
              const n = App.attempt(() => Store.copyWeek(st.monday), (k) => 'Copied ' + plural(k, 'day'));
              if (n !== undefined) st.monday = next;
            },
          });
        }
        if (W.button(g, 'wk-next', 212, 168, 40, 22, { label: '▶' })) st.monday = Cal.add(st.monday, 7);
      },
    };
  };

  // ---------- Choosing a poll for a day ----------
  const STATUS_ORDER = { active: 0, draft: 1, ended: 2 };
  S.pollPicker = (args) => {
    const st = { scroll: 0 };
    const day = args.day;
    const pick = (val) => { if (App.attempt(() => Store.setSchedule(day, val), 'Planned for ' + Cal.short(day))) App.pop(); };
    return {
      public: false,
      back() { App.pop(); },
      onResume(r) { if (r && r.picked) pick(r.picked); },
      items() {
        const polls = Store.state.polls.filter((p) => p.status !== 'archived')
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt - a.createdAt);
        return [{ kind: 'clear' }, { kind: 'none' }, ...polls.map((p) => ({ kind: 'poll', p })), { kind: 'new' }];
      },
      top(g) {
        const th = adminTop(g, 'SCHEDULE');
        g.text(Cal.long(day), 10, 24, th.text, 2);
        const cur = scheduleLabel(day);
        lines(g, ['Currently: ' + (cur === null ? 'nothing planned' : cur), '',
                  '"No poll" turns voting off for the day; Suggest and Comment stay open.', '',
                  '"Clear" removes the plan, so the day follows the Unscheduled days option.'], 10, 48, { w: 236 });
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const bar = W.topBar(g, 'Choose a poll');
        if (bar.back) return this.back();
        const items = this.items();
        const hit = W.list(g, 'pick', st, items, 4, 26, 248, 164, {
          rowH: 23,
          render(g2, it, x, y, w) {
            if (it.kind === 'clear') return g2.text('Clear (nothing planned)', x + 2, y + 7, th.soft);
            if (it.kind === 'none') return g2.text('No poll this day', x + 2, y + 7, th.text);
            if (it.kind === 'new') return g2.text('+ New poll…', x + 2, y + 7, C.seaD);
            g2.rect(x, y + 4, 4, 13, pollColor(it.p.id).base);
            const cw = W.chip(g2, it.p.status.toUpperCase(), x + 7, y + 5, W.statusColor(it.p.status));
            g2.text(truncate(it.p.question, w - cw - 14), x + cw + 12, y + 7, th.text);
          },
        });
        if (hit >= 0) {
          const it = items[hit];
          if (it.kind === 'clear') pick(undefined);
          else if (it.kind === 'none') pick(null);
          else if (it.kind === 'new') App.push('pollEdit', { pickFor: day });
          else pick(it.p.id);
        }
      },
    };
  };

  // ---------- Options ----------
  const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];

  S.calendarSettings = () => {
    const st = { scroll: 0 };
    const set = (k, v) => App.attempt(() => Store.setCal(k, v));
    return {
      public: false,
      back() { App.pop(); },
      rows() {
        const c = Store.cal();
        const onoff = (v) => (v ? 'On' : 'Off');
        return [
          ['Poll schedule', onoff(c.schedule), () => set('schedule', !c.schedule)],
          ['Day starts at', Cal.hhmm(c.dayStart), () => set('dayStart', cycle([0, 3, 4, 5, 6], c.dayStart))],
          ['Unscheduled days', c.unscheduled === 'none' ? 'No poll' : 'Keep current', () => set('unscheduled', c.unscheduled === 'none' ? 'keep' : 'none')],
          ['Closed hours', onoff(c.rest), () => set('rest', !c.rest)],
          ['Closed from', Cal.hhmm(c.restFrom), () => set('restFrom', cycle([18, 19, 20, 21, 22, 23, 0, 1, 2], c.restFrom))],
          ['Open again at', Cal.hhmm(c.restTo), () => set('restTo', cycle([5, 6, 7, 8, 9, 10, 11, 12], c.restTo))],
          ['Show date to visitors', onoff(c.showDate), () => set('showDate', !c.showDate)],
          ['About the DS clock ▶', '', () => App.push('info', { title: 'DS clock', body: [
            'Dates and times come from the console’s built-in clock.', '',
            'Set it in the DS System Settings before deploying. This app reads the clock but cannot change it.', '',
            'If the clock battery runs flat the date resets to 2000. The terminal notices, warns on the admin home, and pauses schedules and closed hours until the clock is set.', '',
            'Votes and feedback still save; their timestamps will just be wrong.'] })],
        ];
      },
      top(g) {
        const th = adminTop(g, 'OPTIONS');
        const d = Clock.date();
        g.text('Calendar options', 10, 24, th.text, 2);
        lines(g, [
          (Clock.plausible() ? 'DS clock: ' : '! DS clock: ') + Cal.long(Cal.key(d)) + ' ' + d.getFullYear() + ', ' + Cal.time(d),
          '',
          'Everything here is optional and off by default.',
          '',
          'Day starts at: votes and switches before this hour count as the previous day (useful for late bars).',
          'Closed hours: outside opening times visitors see a resting screen. Staff access still works.',
        ], 10, 48, { w: 236 });
      },
      bottom(g) {
        const th = W.theme();
        W.bg(g, th);
        const bar = W.topBar(g, 'Calendar options');
        if (bar.back) return this.back();
        const rows = this.rows();
        const hit = W.list(g, 'calopt', st, rows, 4, 26, 248, 164, {
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
})(window.PPT = window.PPT || {});
