// Local data model and persistence.
//
// Layout on the (virtual) SD card:
//   /ppt/data.json    full snapshot: "PPT1 <crc32>\n<json>"
//   /ppt/data.tmp     snapshot being written (atomic replace step 1)
//   /ppt/data.bak     previous good snapshot
//   /ppt/journal.log  append-only public submissions since the last snapshot,
//                     one "<crc32>|<json>" line each, with a monotonically
//                     increasing seq number
//   /ppt/export/...   CSV / JSON exports and backups
//
// Public submissions (vote, suggestion, comment) are a single journal append:
// a vote counts if and only if its line is on the card intact. Admin changes
// write a whole new snapshot, folding in and then truncating the journal.
// Boot loads the newest valid snapshot and replays journal lines with
// seq > snapshot.lastSeq, discarding a torn tail.
(function (PPT) {
  'use strict';

  const SD = PPT.SD;
  const { crc32, hashPin, randomHex } = PPT.Hash;

  const F = {
    data: '/ppt/data.json',
    tmp: '/ppt/data.tmp',
    bak: '/ppt/data.bak',
    journal: '/ppt/journal.log',
    resetPin: '/ppt/RESETPIN.TXT',
    exportDir: '/ppt/export/',
  };
  const CHECKPOINT_EVERY = 20;
  const PIN_ITERATIONS = 2000;
  const DEFAULT_PIN = '1234';

  const RESPONSE_SETS = [
    ['Good', 'Okay', 'Not great'],
    ['Yes', 'No'],
    ['Loved it', 'Liked it', 'Meh', 'Not for me'],
  ];

  function now() { return Date.now(); }

  function makePinRecord(pin, isDefault) {
    const salt = randomHex(8);
    return { salt, iterations: PIN_ITERATIONS, hash: hashPin(pin, salt, PIN_ITERATIONS), isDefault,
             fails: 0, lockUntil: 0 };
  }

  function seedState() {
    const t = now();
    return {
      format: 1,
      createdAt: t,
      lastSeq: 0,
      nextId: 10,
      venue: 'Corner Cafe',
      settings: {
        theme: 'paper',
        idle: 'lively',          // lively | calm | off
        modes: { vote: true, suggest: true, comment: true },
        confirmVotes: true,
        sessionTimeout: 60,      // seconds an abandoned public interaction may sit
        resultsSeconds: 12,
        thanksSeconds: 6,
        adminTimeout: 120,
        suggestLimit: 200,
        suggestPrompt: 'Got an idea for us?',
      },
      security: makePinRecord(DEFAULT_PIN, true),
      activePollId: 'p1',
      polls: [
        { id: 'p1', root: 'p1', rev: 1, status: 'active',
          question: 'Which seasonal drink should we add next?',
          choices: ['Pumpkin chai', 'Maple oat latte'], counts: [0, 0],
          createdAt: t, activatedAt: t, endedAt: null, archivedAt: null, replacedBy: null },
        { id: 'p2', root: 'p2', rev: 1, status: 'draft',
          question: 'Pick our next event night!',
          choices: ['Board games', 'Open mic', 'Trivia', 'Zine swap'], counts: [0, 0, 0, 0],
          createdAt: t, activatedAt: null, endedAt: null, archivedAt: null, replacedBy: null },
      ],
      prompts: [
        { id: 'c1', text: 'How was your visit today?', options: RESPONSE_SETS[0].slice(),
          enabled: true, retired: false, createdAt: t },
        { id: 'c2', text: 'Is the music volume right?', options: ['Yes', 'Too loud', 'Too quiet'],
          enabled: true, retired: false, createdAt: t },
      ],
      suggestions: [],
      comments: [],
      notices: [],
    };
  }

  function serialize(state) {
    const json = JSON.stringify(state);
    return 'PPT1 ' + crc32(json) + '\n' + json;
  }

  function parseSnapshot(text) {
    if (!text) return null;
    const nl = text.indexOf('\n');
    if (nl < 0 || !text.startsWith('PPT1 ')) return null;
    const crc = text.slice(5, nl);
    const json = text.slice(nl + 1);
    if (crc32(json) !== crc) return null;
    try { return JSON.parse(json); } catch (e) { return null; }
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  const Store = {
    F,
    RESPONSE_SETS,
    DEFAULT_PIN,
    state: null,
    ok: false,
    error: null,          // last storage error message, for the admin
    report: [],           // boot/integrity report lines
    journalCount: 0,
    lastCommit: null,
    seenSids: new Set(),

    // ---------- boot & recovery ----------
    boot() {
      this.report = [];
      this.state = null;
      this.ok = false;
      this.error = null;
      this.seenSids = new Set();
      try {
        if (!SD.present()) throw new SD.SDError('missing', 'No SD card');
        let st = null, source = null;
        for (const [path, label] of [[F.data, 'data.json'], [F.tmp, 'data.tmp'], [F.bak, 'data.bak']]) {
          const raw = SD.read(path);
          if (raw === null) continue;
          const parsed = parseSnapshot(raw);
          if (parsed) { st = parsed; source = label; break; }
          this.report.push('! ' + label + ' is damaged, skipped');
        }
        let fresh = false;
        if (!st) {
          if (this.report.length) {
            this.report.push('! No valid snapshot; starting fresh');
            this.state = seedState();
            this.state.notices.push('Data files were damaged and could not be recovered. Damaged copies kept.');
          } else {
            this.state = seedState();
            fresh = true;
          }
          st = this.state;
        } else {
          this.state = st;
          this.report.push('Loaded ' + source + (source !== 'data.json' ? ' (recovered)' : ''));
        }

        // Replay journal.
        const raw = SD.read(F.journal) || '';
        let replayed = 0, damaged = 0, skipped = 0;
        for (const line of raw.split('\n')) {
          if (!line) continue;
          const bar = line.indexOf('|');
          const json = line.slice(bar + 1);
          if (bar !== 8 || crc32(json) !== line.slice(0, 8)) { damaged++; continue; }
          let rec;
          try { rec = JSON.parse(json); } catch (e) { damaged++; continue; }
          if (rec.seq <= st.lastSeq) { skipped++; continue; }
          this._apply(st, rec);
          st.lastSeq = rec.seq;
          replayed++;
        }
        if (replayed) this.report.push('Replayed ' + replayed + ' journal entr' + (replayed === 1 ? 'y' : 'ies'));
        if (skipped) this.report.push('Skipped ' + skipped + ' already-saved entr' + (skipped === 1 ? 'y' : 'ies'));
        if (damaged) this.report.push('! Discarded ' + damaged + ' incomplete entr' + (damaged === 1 ? 'y' : 'ies') +
                                      ' (interrupted write)');

        // Forgot-PIN recovery file (candidate procedure, see docs).
        if (SD.read(F.resetPin) !== null) {
          st.security = makePinRecord(DEFAULT_PIN, true);
          st.notices.push('PIN was reset to the default by RESETPIN.TXT. Change it now.');
          this.report.push('! PIN reset via RESETPIN.TXT');
          SD.remove(F.resetPin);
        }

        this.ok = true;
        if (fresh || replayed || damaged || source !== 'data.json' || this.report.some((l) => l[0] === '!')) {
          this._commit();
        } else {
          this.journalCount = 0;
        }
        if (fresh) this.report.push('Created new terminal data');
        this.report.push('Storage OK');
      } catch (e) {
        if (e instanceof SD.PowerCut) throw e;
        this.ok = false;
        this.error = e.message;
        this.report.push('! ' + e.message);
      }
    },

    // ---------- snapshot commit (atomic replace) ----------
    _commit() {
      const text = serialize(this.state);
      SD.write(F.tmp, text);
      if (SD.read(F.tmp) !== text) throw new SD.SDError('verify', 'Write verification failed');
      if (SD.exists(F.data)) {
        if (SD.exists(F.bak)) SD.remove(F.bak);
        SD.rename(F.data, F.bak);
      }
      SD.rename(F.tmp, F.data);
      SD.write(F.journal, '');
      SD.flush();
      this.journalCount = 0;
      this.lastCommit = now();
    },

    // Admin mutation: apply, snapshot, roll back in memory on failure.
    mutate(fn) {
      if (!this.ok) throw new Error(this.error || 'Storage unavailable');
      const before = clone(this.state);
      try {
        const result = fn(this.state);
        this._commit();
        this.error = null;
        return result;
      } catch (e) {
        if (e instanceof SD.PowerCut) throw e;
        this.state = before;
        this.error = e.message;
        throw e;
      }
    },

    // ---------- public submissions (journal append) ----------
    // Returns true when durably recorded. Throws on failure; never reports false success.
    submit(rec) {
      if (!this.ok) throw new Error(this.error || 'Storage unavailable');
      if (rec.sid && this.seenSids.has(rec.sid)) return true; // duplicate tap / re-entry
      const st = this.state;
      const full = Object.assign({}, rec, { seq: st.lastSeq + 1, t: now() });
      const json = JSON.stringify(full);
      try {
        SD.append(F.journal, crc32(json) + '|' + json + '\n');
      } catch (e) {
        if (!(e instanceof SD.PowerCut)) this.error = e.message;
        throw e;
      }
      this._apply(st, full);
      st.lastSeq = full.seq;
      if (rec.sid) this.seenSids.add(rec.sid);
      this.journalCount++;
      if (this.journalCount >= CHECKPOINT_EVERY) {
        try { this._commit(); } catch (e) { if (e instanceof SD.PowerCut) throw e; /* journal still holds it */ }
      }
      return true;
    },

    _apply(st, rec) {
      if (rec.type === 'vote') {
        const p = st.polls.find((x) => x.id === rec.poll);
        if (p && rec.choice >= 0 && rec.choice < p.counts.length) {
          p.counts[rec.choice]++;
          p.lastVoteAt = rec.t;
        }
      } else if (rec.type === 'suggest') {
        st.suggestions.push({ id: rec.sid, text: rec.text, t: rec.t, status: 'new' });
      } else if (rec.type === 'comment') {
        st.comments.push({ id: rec.sid, prompt: rec.prompt, option: rec.option, label: rec.label,
                           t: rec.t, status: 'new' });
      }
    },

    newSid() { return now().toString(36) + '-' + randomHex(3); },
    nextId(st, prefix) { return prefix + (st.nextId++); },

    // ---------- queries ----------
    get settings() { return this.state.settings; },
    activePoll() {
      const st = this.state;
      return st && st.polls.find((p) => p.id === st.activePollId && p.status === 'active') || null;
    },
    poll(id) { return this.state.polls.find((p) => p.id === id) || null; },
    prompt(id) { return this.state.prompts.find((p) => p.id === id) || null; },
    enabledPrompts() { return this.state.prompts.filter((p) => p.enabled && !p.retired); },
    total(p) { return p.counts.reduce((a, b) => a + b, 0); },
    commentCounts(promptId, status = 'new') {
      const pr = this.prompt(promptId);
      const counts = pr.options.map(() => 0);
      for (const c of this.state.comments) {
        if (c.prompt === promptId && (status === 'any' || c.status === status) && c.option < counts.length) counts[c.option]++;
      }
      return counts;
    },
    newFeedback() {
      return {
        suggestions: this.state.suggestions.filter((s) => s.status === 'new').length,
        comments: this.state.comments.filter((c) => c.status === 'new').length,
      };
    },
    storage() {
      const files = SD.devFiles().filter((f) => f.path.startsWith('/ppt/'));
      const used = files.reduce((n, f) => n + f.size, 0);
      return { used, capacity: SD.sim.capacity, pct: used / SD.sim.capacity, files };
    },

    // ---------- security ----------
    pinLockRemaining() {
      return Math.max(0, Math.ceil((this.state.security.lockUntil - now()) / 1000));
    },
    // Returns 'ok' | 'wrong' | 'locked'
    verifyPin(pin) {
      const sec = this.state.security;
      if (this.pinLockRemaining() > 0) return 'locked';
      const ok = hashPin(pin, sec.salt, sec.iterations) === sec.hash;
      try {
        this.mutate((st) => {
          if (ok) { st.security.fails = 0; st.security.lockUntil = 0; return; }
          st.security.fails++;
          // 3 free tries, then 30s, 60s, 120s ... capped at 15 minutes.
          if (st.security.fails >= 3) {
            const tier = Math.floor(st.security.fails / 3) - 1;
            st.security.lockUntil = now() + Math.min(900, 30 * Math.pow(2, tier)) * 1000;
          }
        });
      } catch (e) {
        // Storage failure must not lock staff out of the diagnostics.
      }
      return ok ? 'ok' : 'wrong';
    },
    setPin(pin) {
      this.mutate((st) => { st.security = makePinRecord(pin, false); });
    },

    // ---------- polls ----------
    savePoll(id, fields) {
      return this.mutate((st) => {
        let p = id && st.polls.find((x) => x.id === id);
        if (!p) {
          p = { id: this.nextId(st, 'p'), rev: 1, status: 'draft', counts: [], createdAt: now(),
                activatedAt: null, endedAt: null, archivedAt: null, replacedBy: null };
          p.root = p.id;
          st.polls.push(p);
        }
        if (this.total(p) > 0) throw new Error('Poll has votes; create a revision instead');
        p.question = fields.question;
        p.choices = fields.choices.slice();
        p.counts = p.choices.map(() => 0);
        return p.id;
      });
    },
    // Copy a poll with votes into a new draft revision. The original stays intact.
    revisePoll(id) {
      return this.mutate((st) => {
        const src = st.polls.find((x) => x.id === id);
        const revs = st.polls.filter((x) => x.root === src.root).map((x) => x.rev);
        const p = { id: this.nextId(st, 'p'), root: src.root, rev: Math.max(...revs) + 1, status: 'draft',
                    question: src.question, choices: src.choices.slice(), counts: src.choices.map(() => 0),
                    createdAt: now(), activatedAt: null, endedAt: null, archivedAt: null, replacedBy: null,
                    revisionOf: src.id };
        st.polls.push(p);
        return p.id;
      });
    },
    duplicatePoll(id) {
      return this.mutate((st) => {
        const src = st.polls.find((x) => x.id === id);
        const p = { id: this.nextId(st, 'p'), rev: 1, status: 'draft', question: src.question,
                    choices: src.choices.slice(), counts: src.choices.map(() => 0), createdAt: now(),
                    activatedAt: null, endedAt: null, archivedAt: null, replacedBy: null };
        p.root = p.id;
        st.polls.push(p);
        return p.id;
      });
    },
    activatePoll(id) {
      this.mutate((st) => {
        const cur = st.polls.find((x) => x.id === st.activePollId && x.status === 'active');
        const p = st.polls.find((x) => x.id === id);
        if (cur && cur.id !== id) {
          cur.status = 'ended';
          cur.endedAt = now();
          if (cur.root === p.root) cur.replacedBy = p.id;
        }
        p.status = 'active';
        p.activatedAt = p.activatedAt || now();
        p.endedAt = null;
        st.activePollId = p.id;
      });
    },
    endPoll(id) {
      this.mutate((st) => {
        const p = st.polls.find((x) => x.id === id);
        p.status = 'ended';
        p.endedAt = now();
        if (st.activePollId === id) st.activePollId = null;
      });
    },
    archivePoll(id, archived) {
      this.mutate((st) => {
        const p = st.polls.find((x) => x.id === id);
        if (archived) { p.prevStatus = p.status === 'active' ? 'ended' : p.status; p.status = 'archived'; p.archivedAt = now(); }
        else { p.status = p.prevStatus || 'ended'; p.archivedAt = null; }
        if (st.activePollId === id && archived) st.activePollId = null;
      });
    },
    deletePoll(id) {
      this.mutate((st) => {
        st.polls = st.polls.filter((x) => x.id !== id);
        if (st.activePollId === id) st.activePollId = null;
      });
    },

    // ---------- feedback ----------
    setSuggestionStatus(id, status) {
      this.mutate((st) => { st.suggestions.find((s) => s.id === id).status = status; });
    },
    deleteSuggestion(id) {
      this.mutate((st) => { st.suggestions = st.suggestions.filter((s) => s.id !== id); });
    },
    archiveComments(promptId) {
      return this.mutate((st) => {
        let n = 0;
        st.comments.forEach((c) => { if (c.prompt === promptId && c.status === 'new') { c.status = 'archived'; n++; } });
        return n;
      });
    },
    archiveReviewed() {
      return this.mutate((st) => {
        let n = 0;
        st.suggestions.forEach((s) => { if (s.status === 'reviewed') { s.status = 'archived'; n++; } });
        return n;
      });
    },
    deleteArchivedFeedback() {
      return this.mutate((st) => {
        const before = st.suggestions.length + st.comments.length;
        st.suggestions = st.suggestions.filter((s) => s.status !== 'archived');
        st.comments = st.comments.filter((c) => c.status !== 'archived');
        return before - st.suggestions.length - st.comments.length;
      });
    },

    // ---------- comment prompts ----------
    savePrompt(id, fields) {
      return this.mutate((st) => {
        let p = id && st.prompts.find((x) => x.id === id);
        const hasResponses = p && st.comments.some((c) => c.prompt === p.id);
        const changed = p && (p.text !== fields.text || p.options.join('\u0001') !== fields.options.join('\u0001'));
        if (p && hasResponses && changed) {
          // Never reinterpret existing responses: retire and replace.
          p.retired = true;
          p.enabled = false;
          p = null;
        }
        if (!p) {
          p = { id: this.nextId(st, 'c'), createdAt: now(), retired: false };
          st.prompts.push(p);
        }
        p.text = fields.text;
        p.options = fields.options.slice();
        p.enabled = fields.enabled;
        return p.id;
      });
    },
    deletePrompt(id) {
      this.mutate((st) => {
        if (st.comments.some((c) => c.prompt === id)) {
          const p = st.prompts.find((x) => x.id === id);
          p.retired = true; p.enabled = false;
        } else {
          st.prompts = st.prompts.filter((x) => x.id !== id);
        }
      });
    },

    // ---------- settings ----------
    setSetting(key, value) { this.mutate((st) => { st.settings[key] = value; }); },
    setMode(mode, on) { this.mutate((st) => { st.settings.modes[mode] = on; }); },
    setVenue(name) { this.mutate((st) => { st.venue = name; }); },
    dismissNotices() { this.mutate((st) => { st.notices = []; }); },

    // ---------- export & backup ----------
    _stamp() {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    },
    exportCSV() {
      const st = this.state;
      const esc = (v) => {
        v = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      };
      const iso = (t) => (t ? new Date(t).toISOString() : '');
      const rows = (header, data) => [header, ...data].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
      const stamp = this._stamp();

      const pollRows = [];
      for (const p of st.polls) {
        const pct = PPT.percentages(p.counts);
        p.choices.forEach((c, i) => pollRows.push([p.id, p.root, p.rev, p.status, p.question, i + 1, c,
          p.counts[i], pct[i], this.total(p), iso(p.createdAt), iso(p.activatedAt), iso(p.endedAt)]));
      }
      const sugRows = st.suggestions.map((s) => [s.id, iso(s.t), s.status, s.text]);
      const comRows = [];
      for (const pr of st.prompts) {
        const counts = this.commentCounts(pr.id, 'any');
        pr.options.forEach((o, i) => comRows.push([pr.id, pr.text, i + 1, o, counts[i],
          st.comments.filter((c) => c.prompt === pr.id && c.option === i && c.status === 'archived').length]));
      }
      const files = [
        [F.exportDir + 'polls-' + stamp + '.csv', rows(['poll_id', 'poll_root', 'revision', 'status', 'question',
          'choice_no', 'choice', 'votes', 'percent', 'poll_total', 'created', 'activated', 'ended'], pollRows)],
        [F.exportDir + 'suggestions-' + stamp + '.csv', rows(['id', 'submitted', 'status', 'text'], sugRows)],
        [F.exportDir + 'comments-' + stamp + '.csv', rows(['prompt_id', 'prompt', 'option_no', 'option',
          'responses_total', 'responses_archived'], comRows)],
      ];
      files.forEach(([path, text]) => SD.write(path, text));
      return files.map((f) => f[0]);
    },
    exportBackup() {
      const path = F.exportDir + 'backup-' + this._stamp() + '.json';
      SD.write(path, JSON.stringify({ kind: 'ppt-backup', format: 1, savedAt: now(), state: this.state }, null, 1));
      return path;
    },
    listBackups() {
      return SD.list(F.exportDir).filter((p) => /backup-.*\.json$/.test(p)).sort().reverse();
    },
    restoreBackup(path) {
      const raw = SD.read(path);
      let doc;
      try { doc = JSON.parse(raw); } catch (e) { throw new Error('Backup file is damaged'); }
      if (!doc || doc.kind !== 'ppt-backup' || !doc.state || !Array.isArray(doc.state.polls)) {
        throw new Error('Not a terminal backup');
      }
      this.mutate((st) => {
        const keepSeq = st.lastSeq;
        Object.keys(st).forEach((k) => delete st[k]);
        Object.assign(st, clone(doc.state));
        st.lastSeq = Math.max(keepSeq, st.lastSeq); // journal seq must keep increasing
        st.notices = (st.notices || []).concat('Restored from ' + path.split('/').pop());
      });
    },

    checkIntegrity() {
      const lines = [];
      const snap = parseSnapshot(SD.read(F.data));
      lines.push(snap ? 'data.json OK' : '! data.json missing or damaged');
      const bak = SD.read(F.bak);
      if (bak !== null) lines.push(parseSnapshot(bak) ? 'data.bak OK' : '! data.bak damaged');
      const j = (SD.read(F.journal) || '').split('\n').filter(Boolean);
      const bad = j.filter((l) => crc32(l.slice(9)) !== l.slice(0, 8)).length;
      lines.push('Journal: ' + j.length + ' pending' + (bad ? ', ' + bad + ' damaged' : ''));
      return lines;
    },

    prepareShutdown() {
      this.mutate(() => {});
      SD.flush();
    },

    factoryReset() {
      if (!SD.present()) throw new Error('No SD card');
      for (const p of [F.data, F.tmp, F.bak, F.journal]) if (SD.exists(p)) SD.remove(p);
      this.boot();
    },
  };

  // Largest-remainder rounding so displayed percentages sum to 100.
  PPT.percentages = function (counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return counts.map(() => 0);
    const raw = counts.map((c) => (c * 100) / total);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
      if (left > 0) { out[i]++; left--; }
    });
    return out;
  };

  PPT.Store = Store;
})(window.PPT = window.PPT || {});
