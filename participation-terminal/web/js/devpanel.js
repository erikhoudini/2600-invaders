// Prototype-only controls: device scale, simulated hardware buttons, SD-card
// failure injection, test data and a view of the virtual card's files.
(function (PPT) {
  'use strict';

  const { App, SD, Store } = PPT;
  const $ = (id) => document.getElementById(id);
  const PREFS = 'ppt-shell';

  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch (e) { return {}; }
  }
  function savePrefs(p) {
    try { localStorage.setItem(PREFS, JSON.stringify(Object.assign(prefs(), p))); } catch (e) { /* ignore */ }
  }

  // ---------- device scale & gap ----------
  const device = document.documentElement;
  function applyLayout() {
    const p = prefs();
    const gap = p.gap !== undefined ? p.gap : 78;
    let scale = p.scale || '2';
    $('opt-scale').value = scale;
    $('opt-gap').value = String(gap);
    if (scale === 'fit') {
      scale = Math.max(1, (window.innerHeight - 140) / (384 + gap + 40));
    }
    device.style.setProperty('--scale', scale);
    device.style.setProperty('--gap', gap);
  }
  $('opt-scale').addEventListener('change', (e) => { savePrefs({ scale: e.target.value }); applyLayout(); });
  $('opt-gap').addEventListener('change', (e) => { savePrefs({ gap: Number(e.target.value) }); applyLayout(); });
  window.addEventListener('resize', () => { if (prefs().scale === 'fit') applyLayout(); });
  applyLayout();

  // ---------- hardware buttons ----------
  document.querySelectorAll('[data-btn]').forEach((el) => {
    const name = el.dataset.btn;
    const set = (down) => { App.setButton(name, down); el.classList.toggle('down-state', down); };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(true); e.preventDefault(); });
    el.addEventListener('pointerup', () => set(false));
    el.addEventListener('pointercancel', () => set(false));
  });
  const lr = $('hold-lr');
  const setLR = (down) => { App.setButton('l', down); App.setButton('r', down); lr.classList.toggle('on', down); };
  lr.addEventListener('pointerdown', (e) => { lr.setPointerCapture(e.pointerId); setLR(true); });
  lr.addEventListener('pointerup', () => setLR(false));
  lr.addEventListener('pointercancel', () => setLR(false));

  // ---------- SD simulation ----------
  const sim = SD.sim;
  $('sim-missing').checked = sim.missing;
  $('sim-full').checked = sim.full;
  $('sim-capacity').value = String(sim.capacity);
  $('sim-missing').addEventListener('change', (e) => SD.setSim({ missing: e.target.checked }));
  $('sim-full').addEventListener('change', (e) => SD.setSim({ full: e.target.checked }));
  $('sim-capacity').addEventListener('change', (e) => SD.setSim({ capacity: Number(e.target.value) }));
  $('sim-cut').addEventListener('click', () => { App.halt(); setTimeout(() => location.reload(), 350); });
  $('sim-cut-next').addEventListener('click', () => SD.setSim({ powerCutNextWrite: !sim.powerCutNextWrite }));
  $('sim-corrupt').addEventListener('click', () => {
    const raw = SD.devRead(Store.F.data);
    if (raw === null) return;
    SD.devWrite(Store.F.data, raw.slice(0, Math.floor(raw.length * 0.6)) + '\u0000garbage');
    status('data.json damaged. Use "Power cut now" to restart and watch recovery.');
  });
  $('sim-resetpin').addEventListener('click', () => {
    SD.devWrite(Store.F.resetPin, '');
    status('RESETPIN.TXT placed. Restart (Power cut now) to apply.');
  });

  let statusMsg = '';
  function status(msg) { statusMsg = msg; render(); }

  // ---------- test data ----------
  const SAMPLE_SUGGESTIONS = [
    'Oat milk cortado please!', 'Board game night on Tuesdays?', 'More outlets near the window seats.',
    'A small zine library shelf by the door.', 'Could the music be a bit quieter in the mornings?',
    'Gluten-free pastries on weekends', 'Host a repair cafe once a month', 'Local art on the back wall',
  ];
  function guard(fn) {
    try { fn(); } catch (e) { status('Write failed: ' + e.message + ' (nothing was counted)'); }
  }
  $('data-votes').addEventListener('click', () => guard(() => {
    const p = Store.activePoll();
    if (!p) return status('No active poll.');
    for (let i = 0; i < 10; i++) {
      // Skew so results are not uniform.
      const r = Math.random();
      const c = Math.min(p.choices.length - 1, Math.floor(Math.pow(r, 1.6) * p.choices.length));
      Store.submit({ type: 'vote', sid: Store.newSid(), poll: p.id, choice: c });
    }
    status('Added 10 votes to "' + p.question + '"');
  }));
  $('data-sugs').addEventListener('click', () => guard(() => {
    for (let i = 0; i < 3; i++) {
      const text = SAMPLE_SUGGESTIONS[Math.floor(Math.random() * SAMPLE_SUGGESTIONS.length)];
      Store.submit({ type: 'suggest', sid: Store.newSid(), text });
    }
    status('Added 3 suggestions');
  }));
  $('data-comments').addEventListener('click', () => guard(() => {
    const ps = Store.enabledPrompts();
    if (!ps.length) return status('No enabled comment prompts.');
    for (let i = 0; i < 8; i++) {
      const p = ps[i % ps.length];
      const o = Math.min(p.options.length - 1, Math.floor(Math.pow(Math.random(), 1.4) * p.options.length));
      Store.submit({ type: 'comment', sid: Store.newSid(), prompt: p.id, option: o, label: p.options[o] });
    }
    status('Added 8 comment responses');
  }));
  $('data-wipe').addEventListener('click', () => {
    if (!confirm('Wipe the virtual SD card and restart with fresh sample data?')) return;
    SD.devWipe();
    location.reload();
  });

  // ---------- file list & log ----------
  let pending = false;
  function render() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const parts = [];
      if (sim.missing) parts.push('Card removed.');
      if (sim.full) parts.push('Card full: every write fails.');
      if (sim.powerCutNextWrite) parts.push('Armed: power will cut halfway through the next write.');
      if (statusMsg) parts.push(statusMsg);
      $('sim-status').textContent = parts.join(' ');
      $('sim-cut-next').classList.toggle('on', sim.powerCutNextWrite);

      const files = SD.devFiles();
      const ul = $('files');
      ul.innerHTML = '';
      if (!files.length) ul.innerHTML = '<li><span>(empty)</span></li>';
      for (const f of files) {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = f.path;
        const right = document.createElement('span');
        right.textContent = f.size + ' B';
        const view = document.createElement('a');
        view.textContent = 'view';
        view.onclick = () => {
          const peek = $('peek');
          const txt = SD.devRead(f.path) || '';
          peek.hidden = !peek.hidden && peek.dataset.path === f.path;
          peek.dataset.path = f.path;
          peek.textContent = f.path + '\n\n' + (txt.length > 6000 ? txt.slice(0, 6000) + '\n…' : txt || '(empty)');
        };
        const dl = document.createElement('a');
        dl.textContent = 'save';
        dl.onclick = () => {
          const blob = new Blob([SD.devRead(f.path) || ''], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = f.path.split('/').pop();
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        };
        right.append(view, dl);
        li.append(name, right);
        ul.append(li);
      }

      const ol = $('log');
      ol.innerHTML = '';
      SD.log.slice().reverse().forEach((e) => {
        const li = document.createElement('li');
        const d = new Date(e.t);
        li.textContent = d.toTimeString().slice(0, 8) + ' ' + e.op + ' ' + e.path + (e.extra ? ' (' + e.extra + ')' : '');
        if (!e.ok) li.className = 'bad';
        ol.append(li);
      });
    });
  }
  SD.onChange(render);
  render();
})(window.PPT = window.PPT || {});
