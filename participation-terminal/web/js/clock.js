// The DS real-time clock, and calendar helpers.
//
// On hardware the date and time come from the console's RTC, which the owner
// sets in System Settings (homebrew reads it; it doesn't set it). If the clock
// battery dies the RTC falls back to 1 Jan 2000, so every clock-driven feature
// checks plausible() and pauses itself rather than acting on a wrong date.
//
// In the browser the clock is the computer's time plus an adjustable offset,
// so the dev panel can jump days ahead to test schedules.
(function (PPT) {
  'use strict';

  const KEY = 'ppt-clock';
  let offset = 0;
  try { offset = Number(localStorage.getItem(KEY)) || 0; } catch (e) { /* private mode */ }
  const listeners = [];

  function save() {
    try { localStorage.setItem(KEY, String(offset)); } catch (e) { /* ignore */ }
    listeners.forEach((fn) => fn());
  }

  const Clock = {
    now() { return Date.now() + offset; },
    date() { return new Date(this.now()); },
    set(ms) { offset = ms - Date.now(); save(); },
    shift(ms) { offset += ms; save(); },
    reset() { offset = 0; save(); },
    simulated() { return Math.abs(offset) > 60000; },
    plausible() { const y = this.date().getFullYear(); return y >= 2024 && y <= 2099; },
    onChange(fn) { listeners.push(fn); },
  };

  // ---------- calendar helpers (local time, weeks start on Monday) ----------
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                  'September', 'October', 'November', 'December'];
  const pad = (n) => String(n).padStart(2, '0');

  const Cal = {
    DAYS,
    MONTHS,
    key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    // Noon avoids daylight-saving edges when adding days.
    parse(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); },
    add(key, n) { const d = Cal.parse(key); d.setDate(d.getDate() + n); return Cal.key(d); },
    weekday(key) { return (Cal.parse(key).getDay() + 6) % 7; },
    weekStart(key) { return Cal.add(key, -Cal.weekday(key)); },
    diff(a, b) { return Math.round((Cal.parse(b) - Cal.parse(a)) / 86400000); },
    short(key) {
      const d = Cal.parse(key);
      return DAYS[Cal.weekday(key)].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
    },
    long(key) {
      const d = Cal.parse(key);
      return DAYS[Cal.weekday(key)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    },
    relative(key, today) {
      const n = Cal.diff(today, key);
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      if (n === -1) return 'Yesterday';
      return n > 0 ? 'In ' + n + ' days' : -n + ' days ago';
    },
    hhmm(h) { return pad(h) + ':00'; },
    time(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    // 6 rows x 7 day keys covering the month containing `key`.
    monthGrid(year, month) {
      const first = Cal.key(new Date(year, month, 1, 12));
      const start = Cal.weekStart(first);
      return Array.from({ length: 42 }, (_, i) => Cal.add(start, i));
    },
  };

  PPT.Clock = Clock;
  PPT.Cal = Cal;
})(window.PPT = window.PPT || {});
