'use strict';
// Music: an original march in D minor, played on the same emulated TIA as the sound effects.
//
// The chip has two voices, so the score has two: a bass on the 31-step tone (AUDC 6), whose coarse
// dividers sit nicely on D, G and A, and a lead on the pure square (AUDC 12), which is in tune for
// D4 to E5. Both are rendered once into loops. The calm, driving and urgent versions of the main
// theme share a tempo and a length, so the game can swap between them in the middle of a bar without
// the beat moving. The boss and menu themes have their own.
const MUS_K = { 6: TIA_CLOCK / 31, 12: TIA_CLOCK / 6 };       // Hz at AUDF 0
const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteHz(name){
  const m = /^([A-G])([b#]?)(\d)$/.exec(name);
  const semis = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}
const tiaNote = (audc, name) => Math.max(0, Math.min(31, Math.round(MUS_K[audc] / noteHz(name) - 1)));

// A voice is a list of [note | null, beats]; a note is plucked (decays) or held (sustains)
function voiceFrames(audc, notes, bpm, vol, decay){
  const fpb = 60 * 60 / bpm, out = [];                      // frames per beat
  let at = 0;
  for (const [n, beats] of notes){
    const sf = Math.round(at * fpb), ef = Math.round((at + beats) * fpb);
    for (let f = sf; f < ef; f++){
      const k = f - sf;
      let v = 0;
      if (n){
        v = decay ? Math.max(0, vol - Math.floor(k / decay)) : vol;
        if (ef - f <= 2) v = 0;                              // a gap between notes
      }
      out[f] = [audc, n ? tiaNote(audc, n) : 0, v];
    }
    at += beats;
  }
  return out;
}
// Two voices into one mono loop of exactly `sec` seconds
function tiaMixLoop(a, b, sec){
  const sr = actx.sampleRate, spf = sr / TIA_FPS, total = Math.round(sec * sr);
  const buf = actx.createBuffer(1, total, sr), d = buf.getChannelData(0);
  const ca = new TIAChannel(), cb = new TIAChannel(), step = TIA_CLOCK / sr;
  let acc = 0;
  for (let i = 0; i < total; i++){
    const k = Math.floor(i / spf);
    const fa = a[Math.min(a.length - 1, k)], fb = b[Math.min(b.length - 1, k)];
    acc += step;
    while (acc >= 1){ acc -= 1; ca.tick(fa[0], fa[1]); cb.tick(fb[0], fb[1]); }
    d[i] = ((ca.out - 0.5) * fa[2] + (cb.out - 0.5) * fb[2]) / 30;
  }
  const fade = Math.floor(sr * 0.003);                       // the loop starts and ends on silence
  for (let i = 0; i < fade; i++){ d[i] *= i / fade; d[total - 1 - i] *= i / fade; }
  return buf;
}

// ---- The score ---------------------------------------------------------------------------
const ROOT  = ['D2', 'D2', 'Bb1', 'A1', 'D2', 'G2', 'A1', 'A1'];      // i  i  VI  V  i  iv  V  V
const FIFTH = ['A2', 'A2', 'F2', 'E2', 'A2', 'D3', 'E2', 'E2'];
const OCT   = ['D3', 'D3', 'Bb2', 'A2', 'D3', 'G3', 'A2', 'A2'];
const PAD   = ['F4', 'A4', 'D5', 'E5', 'A4', 'Bb4', 'E5', 'A4'];
const MOTIF = [
  [['A4', 1.5], ['D5', .5], ['E5', 1], ['D5', 1]],
  [['D5', 2], ['C5', 1], ['A4', 1]],
  [['Bb4', 1.5], ['C5', .5], ['D5', 2]],
  [['E5', 1], ['A4', 1], ['C5', 1], ['A4', 1]],
  [['A4', 1], ['C5', 1], ['E5', 1], ['D5', 1]],
  [['Bb4', 1.5], ['A4', .5], ['G4', 2]],
  [['A4', 1], ['E5', 1], ['A4', 1], ['E5', 1]],
  [['A4', 3], [null, 1]],
];
const ARP = [
  ['D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'A4', 'D5'], ['D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'A4', 'F4'],
  ['D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4', 'Bb4', 'D5'], ['A4', 'E5', 'A4', 'C5', 'A4', 'E5', 'A4', 'C5'],
  ['D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'A4', 'D5'], ['G4', 'Bb4', 'D5', 'Bb4', 'G4', 'Bb4', 'D5', 'Bb4'],
  ['A4', 'E5', 'A4', 'C5', 'A4', 'E5', 'A4', 'E5'], ['A4', 'E5', 'A4', 'E5', 'A4', 'C5', 'A4', 'E5'],
];
const cat = (...x) => [].concat(...x);
const rep = (x, n) => cat(...Array.from({ length: n }, () => x));
const TRACK_DEFS = {
  // The main theme at three intensities, all at 126 bpm, 8 bars
  calm(){
    const bass = cat(...ROOT.map((r, i) => [[r, 1], [null, 1], [FIFTH[i], 1], [null, 1]]));
    const lead = PAD.map(n => [n, 4]);
    return { bpm: 126, bars: 8, a: voiceFrames(6, bass, 126, 9, 4), b: voiceFrames(12, lead, 126, 3, 0) };
  },
  drive(){
    const bass = cat(...ROOT.map((r, i) => [[r, 1], [r, .5], [r, .5], [FIFTH[i], 1], [r, 1]]));
    const lead = cat(...MOTIF);
    return { bpm: 126, bars: 8, a: voiceFrames(6, bass, 126, 11, 5), b: voiceFrames(12, lead, 126, 8, 7) };
  },
  urgent(){
    const bass = cat(...ROOT.map((r, i) => rep([[r, .5], [OCT[i], .5]], 4)));
    const lead = cat(...ARP.map(bar => bar.map(n => [n, .5])));
    return { bpm: 126, bars: 8, a: voiceFrames(6, bass, 126, 12, 3), b: voiceFrames(12, lead, 126, 8, 4) };
  },
  // Boss: faster, a chromatic ostinato underneath, stabs on top
  boss(){
    const bar = [['D2', .5], ['D2', .5], ['Eb2', .5], ['D2', .5], ['D3', .5], ['D2', .5], ['Eb2', .5], ['D2', .5]];
    const bass = rep(bar, 8);
    const stab = [['D5', .5], [null, 1], ['Ab4', .5], [null, 2]];
    const stab2 = [['A4', .5], [null, .5], ['A4', .5], [null, .5], ['Eb5', 1], [null, 1]];
    const lead = cat(stab, stab, stab, stab2, stab, stab, stab2, stab2);
    return { bpm: 150, bars: 8, a: voiceFrames(6, bass, 150, 12, 3), b: voiceFrames(12, lead, 150, 9, 6) };
  },
  // Menus: the theme at walking pace, long bass notes
  menu(){
    const bass = cat(...ROOT.map((r, i) => [[r, 2], [FIFTH[i], 2]]));
    const lead = cat(...MOTIF);
    return { bpm: 92, bars: 8, a: voiceFrames(6, bass, 92, 8, 9), b: voiceFrames(12, lead, 92, 6, 10) };
  },
};
const musicBufs = {};
function musicBuf(name){
  if (!musicBufs[name]){
    const t = TRACK_DEFS[name](), sec = t.bars * 4 * 60 / t.bpm;
    musicBufs[name] = { buf: tiaMixLoop(t.a, t.b, sec), len: sec };
  }
  return musicBufs[name];
}

// ---- Playback ----------------------------------------------------------------------------
const MUS_GAIN = 0.4;
let musGain = null, musCur = null, musName = null, musDuck = 0;
function musicStart(){
  if (!actx || musGain) return;
  musGain = actx.createGain(); musGain.gain.value = 0;
  musGain.connect(master);
  let i = 0; const names = ['menu', 'calm', 'drive', 'urgent', 'boss'];
  const next = () => { if (i < names.length){ try { musicBuf(names[i++]); } catch (e) {} setTimeout(next, 250); } };
  setTimeout(next, 50);                                          // render the loops a little at a time
}
function musicTo(name){
  if (!actx || !musGain || name === musName) return;
  const now = actx.currentTime, old = musCur;
  musName = name;
  if (old){
    old.g.gain.cancelScheduledValues(now); old.g.gain.setValueAtTime(old.g.gain.value, now); old.g.gain.linearRampToValueAtTime(0, now + 0.06);
    try { old.src.stop(now + 0.08); } catch (e) {}
  }
  musCur = null;
  if (!name) return;
  const m = musicBuf(name), src = actx.createBufferSource(), g = actx.createGain();
  src.buffer = m.buf; src.loop = true;
  // tracks that share a tempo carry on from the same point in the bar
  let off = 0;
  if (old && old.bpm === TRACK_DEFS_BPM[name]) off = (now - old.t0 + old.off) % m.len;
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 0.06);
  src.connect(g); g.connect(musGain); src.start(now, off);
  musCur = { src, g, t0: now, off, bpm: TRACK_DEFS_BPM[name] };
}
const TRACK_DEFS_BPM = { calm: 126, drive: 126, urgent: 126, boss: 150, menu: 92 };

// What the game wants to hear. A rise in tension is answered quickly, a fall slowly.
let musCheck = 0, musHold = 0;
function musicWanted(){
  if (!actx || opts.muted || opts.music === false) return null;
  if (menuState === 'game'){
    if (boss) return 'boss';
    if (waveState === 'cleared' || waveState === 'worldclear') return 'calm';
    const live = enemies.length, cities = installations.filter(i => i.alive).length;
    return (live >= 9 || (cities <= 2 && live >= 2)) ? 'urgent' : (live >= 3 ? 'drive' : 'calm');
  }
  if (menuState === 'gameover') return null;
  return 'menu';
}
function musicUpdate(dt){
  if (!actx) return;
  if (!musGain) musicStart();
  musCheck -= dt;
  if (musCheck <= 0){
    musCheck = 0.25;
    const w = musicWanted();
    // hold a drop in intensity for three seconds before taking it
    if (menuState === 'game' && w && musName && TRACK_DEFS_BPM[w] === 126 && TRACK_DEFS_BPM[musName] === 126){
      const order = ['calm', 'drive', 'urgent'];
      if (order.indexOf(w) < order.indexOf(musName)){ musHold += 0.25; if (musHold < 3) { applyDuck(dt); return; } }
      musHold = 0;
    }
    musicTo(w);
  }
  applyDuck(dt);
}
// Quieter in the pause menu, a dip when a city falls
function musicDip(){ musDuck = 0.7; }
function applyDuck(dt){
  if (!musGain) return;
  if (musDuck > 0) musDuck -= dt;
  const target = (paused ? 0.25 : 1) * (musDuck > 0 ? 0.2 : 1) * MUS_GAIN;
  musGain.gain.setTargetAtTime(target, actx.currentTime, 0.05);
}
