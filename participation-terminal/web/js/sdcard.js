// Virtual SD card backed by localStorage.
// This is a MOCK of the DS filesystem (libfat / DSi SD). It exists so the storage
// strategy — atomic replace, append-only journal, failure handling — can be
// exercised in the browser. Real behaviour must be validated on hardware.
(function (PPT) {
  'use strict';

  const PREFIX = 'ppt-sd:';
  const SIM_KEY = 'ppt-sim';

  class PowerCut extends Error {}
  class SDError extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  }

  const sim = Object.assign(
    { missing: false, full: false, capacity: 512 * 1024, powerCutNextWrite: false },
    safeJSON(localStorage.getItem(SIM_KEY)) || {}
  );

  function safeJSON(s) {
    try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  const log = [];
  const listeners = [];

  function note(op, path, ok, extra) {
    log.push({ t: Date.now(), op, path, ok, extra });
    if (log.length > 60) log.shift();
    listeners.forEach((fn) => fn());
  }

  function saveSim() {
    localStorage.setItem(SIM_KEY, JSON.stringify(sim));
    listeners.forEach((fn) => fn());
  }

  function keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return out.sort();
  }

  function byteLen(s) {
    return new TextEncoder().encode(s).length;
  }

  function used() {
    return keys().reduce((n, p) => n + byteLen(localStorage.getItem(PREFIX + p) || ''), 0);
  }

  function requireCard(op, path) {
    if (sim.missing) {
      note(op, path, false, 'no card');
      throw new SDError('missing', 'No SD card');
    }
  }

  function checkSpace(op, path, newBytes, oldBytes) {
    if (sim.full || used() - oldBytes + newBytes > sim.capacity) {
      note(op, path, false, 'card full');
      throw new SDError('full', 'SD card is full');
    }
  }

  // Simulated power loss: half the bytes land, then the page reloads.
  function maybeCut(op, path, write) {
    if (!sim.powerCutNextWrite) return false;
    sim.powerCutNextWrite = false;
    saveSim();
    write();
    note(op, path, false, 'POWER CUT');
    setTimeout(() => location.reload(), 0);
    throw new PowerCut('Power cut during write');
  }

  const SD = {
    sim,
    log,
    PowerCut,
    SDError,

    present() { return !sim.missing; },
    onChange(fn) { listeners.push(fn); },
    setSim(patch) { Object.assign(sim, patch); saveSim(); },

    list(dir = '') {
      requireCard('list', dir);
      return keys().filter((p) => p.startsWith(dir));
    },

    exists(path) {
      requireCard('stat', path);
      return localStorage.getItem(PREFIX + path) !== null;
    },

    read(path) {
      requireCard('read', path);
      const v = localStorage.getItem(PREFIX + path);
      return v;
    },

    size(path) {
      const v = localStorage.getItem(PREFIX + path);
      return v === null ? 0 : byteLen(v);
    },

    write(path, text) {
      requireCard('write', path);
      const old = SD.size(path);
      checkSpace('write', path, byteLen(text), old);
      maybeCut('write', path, () => localStorage.setItem(PREFIX + path, text.slice(0, text.length >> 1)));
      try {
        localStorage.setItem(PREFIX + path, text);
      } catch (e) {
        note('write', path, false, 'quota');
        throw new SDError('full', 'SD card is full');
      }
      note('write', path, true, byteLen(text) + 'B');
    },

    append(path, text) {
      requireCard('append', path);
      checkSpace('append', path, byteLen(text), 0);
      const cur = localStorage.getItem(PREFIX + path) || '';
      maybeCut('append', path, () => localStorage.setItem(PREFIX + path, cur + text.slice(0, text.length >> 1)));
      try {
        localStorage.setItem(PREFIX + path, cur + text);
      } catch (e) {
        note('append', path, false, 'quota');
        throw new SDError('full', 'SD card is full');
      }
      note('append', path, true, byteLen(text) + 'B');
    },

    // FAT rename is not guaranteed atomic either; the store tolerates a crash between steps.
    rename(from, to) {
      requireCard('rename', from);
      const v = localStorage.getItem(PREFIX + from);
      if (v === null) return;
      localStorage.setItem(PREFIX + to, v);
      localStorage.removeItem(PREFIX + from);
      note('rename', from + ' -> ' + to, true);
    },

    remove(path) {
      requireCard('delete', path);
      localStorage.removeItem(PREFIX + path);
      note('delete', path, true);
    },

    // Flush is a no-op here; on hardware this maps to fflush/fsync where the runtime supports it.
    flush() {
      requireCard('flush', '');
      note('flush', '', true);
    },

    // Dev-only helpers (bypass failure simulation).
    devWipe() {
      keys().forEach((p) => localStorage.removeItem(PREFIX + p));
      note('wipe', '*', true);
    },
    devRead(path) { return localStorage.getItem(PREFIX + path); },
    devWrite(path, text) { localStorage.setItem(PREFIX + path, text); note('dev-write', path, true); },
    devFiles() { return keys().map((p) => ({ path: p, size: SD.size(p) })); },
    used,
  };

  PPT.SD = SD;
})(window.PPT = window.PPT || {});
