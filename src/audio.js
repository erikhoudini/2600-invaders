'use strict';
// Atari 2600 TIA sound chip emulation
// =====================================================================
//  AUDIO: Atari 2600 TIA sound chip emulation
//  Every effect is a list of per-frame register writes (AUDC waveform,
//  AUDF divider, AUDV volume) at 60 Hz, run through the chip's polynomial
//  counters at its native 31.4 kHz audio clock and held per sample, so the
//  aliasing and grit of the real hardware come through.
// =====================================================================
const TIA_CLOCK = 31468.5;
const TIA_FPS = 60;
const TIA_BIT4  = [1,1,0,1,1,1,0,0,0,0,1,0,1,0,0];
const TIA_BIT5  = [0,0,1,0,1,1,0,0,1,1,1,1,1,0,0,0,1,1,0,1,1,1,0,1,0,1,0,0,0,0,1];
const TIA_DIV31 = [].concat(new Array(18).fill(0), new Array(13).fill(1));

class TIAChannel {
  constructor(){
    this.p4=0; this.p5=0; this.d31=0; this.d6=0; this.d93=0;
    this.lfsr=0x1ff; this.cnt=1; this.out=1;
  }
  // One tick of the 31.4 kHz audio clock
  tick(audc, audf){
    if (--this.cnt > 0) return;
    this.cnt = audf + 1;
    switch (audc & 15){
      case 0: case 11: this.out = 1; break;
      case 1: this.p4 = (this.p4 + 1) % 15; this.out = TIA_BIT4[this.p4]; break;
      case 2: {
        const before = TIA_DIV31[this.d31];
        this.d31 = (this.d31 + 1) % 31;
        if (!before && TIA_DIV31[this.d31]) this.p4 = (this.p4 + 1) % 15;
        this.out = TIA_BIT4[this.p4];
        break;
      }
      case 3:
        this.p5 = (this.p5 + 1) % 31;
        if (TIA_BIT5[this.p5]) this.p4 = (this.p4 + 1) % 15;
        this.out = TIA_BIT4[this.p4];
        break;
      case 4: case 5: this.out ^= 1; break;
      case 6: case 10: this.d31 = (this.d31 + 1) % 31; this.out = TIA_DIV31[this.d31]; break;
      case 7: case 9: this.p5 = (this.p5 + 1) % 31; this.out = TIA_BIT5[this.p5]; break;
      case 8: {
        const l = this.lfsr;
        this.lfsr = (((l ^ (l >> 4)) & 1) << 8) | (l >> 1);
        this.out = l & 1;
        break;
      }
      case 12: case 13: this.d6 = (this.d6 + 1) % 6; this.out = this.d6 < 3 ? 1 : 0; break;
      case 14: this.d93 = (this.d93 + 1) % 93; this.out = TIA_DIV31[Math.floor(this.d93 / 3)]; break;
      case 15:
        this.d6 = (this.d6 + 1) % 6;
        if (this.d6 === 0) this.p5 = (this.p5 + 1) % 31;
        this.out = TIA_BIT5[this.p5];
        break;
    }
  }
}

// Voices sit lower and grittier: higher dividers on tones, a darker noise floor
const TIA_TONAL = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15]);
function deepF(audc, f){
  if (audc === 8) return Math.min(31, f + 6);
  if (TIA_TONAL.has(audc)) return Math.min(31, Math.round(f * 1.5 + 7));
  return f;
}
function tiaRender(frames, sr){
  const spf = sr / TIA_FPS;
  const total = Math.ceil(frames.length * spf);
  const buf = actx.createBuffer(1, total, sr);
  const d = buf.getChannelData(0);
  const ch = new TIAChannel();
  const step = TIA_CLOCK / sr;
  let acc = 0;
  for (let i = 0; i < total; i++){
    const f = frames[Math.min(frames.length - 1, Math.floor(i / spf))];
    acc += step;
    while (acc >= 1){ acc -= 1; ch.tick(f[0], deepF(f[0], f[1])); }
    d[i] = (ch.out - 0.5) * (f[2] / 15);
  }
  const fade = Math.min(total, Math.floor(sr * 0.004));
  for (let i = 0; i < fade; i++) d[total - 1 - i] *= i / fade;
  return buf;
}

// Frame builders. seg ramps AUDF and AUDV across n frames.
const tSeg = (c, f0, f1, v0, v1, n) => {
  const a = [];
  for (let i = 0; i < n; i++){
    const t = n > 1 ? i / (n - 1) : 0;
    a.push([c, Math.round(f0 + (f1 - f0) * t), Math.round(v0 + (v1 - v0) * t)]);
  }
  return a;
};
const tHold = (c, f, v, n) => tSeg(c, f, f, v, v, n);
const tCat = (...s) => [].concat(...s);

// pri: higher priority sounds steal a voice when all are busy. gap: minimum seconds between retriggers.
const SFX_DEFS = {
  fire:      { pri:1, gap:0.05,  f:() => tSeg(12, 2, 14, 11, 0, 7) },
  dry:       { pri:1, gap:0.08,  f:() => tSeg(8, 28, 31, 8, 0, 3) },
  shotBoom:  { pri:0, gap:0.03,  f:() => tSeg(8, 2, 10, 7, 0, 5) },
  puff:      { pri:0, gap:0.04,  f:() => tSeg(8, 14, 26, 8, 0, 9) },
  killS:     { pri:1, gap:0.025, f:() => tSeg(8, 5, 18, 10, 0, 9) },
  killM:     { pri:1, gap:0.025, f:() => tSeg(8, 8, 24, 13, 0, 16) },
  killL:     { pri:2, gap:0.025, f:() => tCat(tSeg(8, 10, 28, 15, 12, 14), tSeg(8, 26, 31, 12, 0, 14)) },
  combo:     { pri:1, gap:0.03,  f:(lv) => { const n = Math.max(1, 13 - lv); return tCat(tHold(12, n, 9, 2), tSeg(12, n, n, 9, 0, 3)); } },
  tier:      { pri:2, gap:0,     f:(i) => { const b = Math.max(3, 12 - i * 2); return tCat(tHold(12, b + 2, 11, 3), tHold(12, b, 11, 3), tSeg(12, Math.max(1, b - 2), Math.max(1, b - 2), 12, 0, 8)); } },
  bigbang:   { pri:3, gap:0.2,   f:() => tCat(tSeg(8, 10, 31, 15, 10, 30), tSeg(3, 20, 31, 12, 0, 40)) },
  cityHit:   { pri:3, gap:0.1,   f:() => tCat(tSeg(8, 4, 28, 15, 14, 20), tSeg(3, 24, 31, 13, 0, 40)) },
  dropHeavy: { pri:1, gap:0.06,  f:() => tCat(tSeg(6, 14, 8, 12, 10, 5), tSeg(6, 8, 16, 10, 0, 6)) },
  comboBreak:{ pri:1, gap:0.1,   f:() => tSeg(6, 6, 26, 12, 0, 12) },
  boss:      { pri:2, gap:0.5,   f:() => tCat(tHold(14, 2, 14, 8), tHold(14, 5, 14, 8), tSeg(14, 9, 12, 14, 0, 18)) },
  bandit:    { pri:2, gap:0.2,   f:() => tCat(...Array.from({ length: 8 }, (_, i) => tHold(12, i % 2 ? 5 : 2, 13, 2)), tSeg(8, 6, 26, 14, 0, 24)) },
  wave:      { pri:2, gap:0.2,   f:() => tCat(tHold(12, 14, 10, 3), tHold(12, 10, 10, 3), tHold(12, 7, 12, 3), tSeg(12, 4, 4, 13, 0, 8)) },
  waveClear: { pri:2, gap:0.2,   f:() => tCat(tHold(12, 9, 11, 4), tHold(12, 7, 11, 4), tHold(12, 5, 11, 4), tSeg(12, 3, 3, 12, 0, 12)) },
  gameOver:  { pri:3, gap:0.5,   f:() => tCat(tHold(6, 4, 13, 10), tHold(6, 8, 13, 10), tHold(6, 14, 12, 10), tSeg(6, 22, 31, 11, 0, 24)) },
  unlock:    { pri:2, gap:0.2,   f:() => tCat(tHold(12, 8, 11, 3), tHold(12, 6, 11, 3), tHold(12, 4, 11, 3), tSeg(12, 2, 2, 12, 0, 10)) },
  swap:      { pri:1, gap:0.05,  f:() => tCat(tHold(4, 7, 9, 2), tHold(4, 4, 9, 2)) },
  move:      { pri:1, gap:0.03,  f:() => tHold(12, 9, 8, 2) },
  tick:      { pri:1, gap:0.02,  f:() => tHold(12, 10, 8, 2) },
  toggle:    { pri:1, gap:0.03,  f:() => tSeg(12, 5, 3, 10, 0, 4) },
  select:    { pri:1, gap:0.05,  f:() => tCat(tHold(12, 6, 10, 3), tSeg(12, 3, 3, 10, 0, 5)) },
  back:      { pri:1, gap:0.05,  f:() => tCat(tHold(12, 6, 9, 2), tSeg(12, 12, 12, 9, 0, 4)) },
  warn:      { pri:1, gap:0.05,  f:() => tCat(tHold(6, 10, 11, 3), tSeg(6, 14, 14, 11, 0, 5)) },
  nameOk:    { pri:2, gap:0.1,   f:() => tCat(tHold(12, 8, 10, 3), tSeg(12, 4, 4, 12, 0, 8)) },
  worldClear:{ pri:3, gap:0.5,   f:() => tCat(tHold(12, 10, 12, 4), tHold(12, 8, 12, 4), tHold(12, 6, 12, 4), tHold(12, 5, 12, 4), tHold(12, 4, 13, 5), tSeg(12, 3, 3, 13, 0, 22)) },
  victory:   { pri:3, gap:1.0,   f:() => tCat(tHold(12, 12, 12, 4), tHold(12, 9, 12, 4), tHold(12, 7, 12, 4), tHold(12, 5, 12, 4), tHold(12, 7, 12, 4), tHold(12, 5, 12, 4), tHold(12, 4, 13, 4), tHold(12, 3, 13, 8), tSeg(12, 2, 2, 14, 0, 30)) },
  warning:   { pri:3, gap:0.5,   f:() => tCat(tHold(4, 10, 13, 8), tHold(4, 16, 13, 8), tHold(4, 10, 13, 8), tHold(4, 16, 13, 8), tSeg(4, 16, 16, 13, 0, 6)) },
  bossHit:   { pri:1, gap:0.03,  f:() => tCat(tHold(8, 2, 12, 1), tSeg(12, 4, 8, 10, 0, 3)) },
  clank:     { pri:1, gap:0.05,  f:() => tCat(tHold(12, 3, 10, 1), tSeg(12, 1, 1, 8, 0, 5)) },
  partKill:  { pri:2, gap:0.05,  f:() => tCat(tSeg(8, 3, 26, 15, 12, 16), tSeg(3, 18, 31, 12, 0, 26)) },
  bossDie:   { pri:3, gap:0.5,   f:() => tCat(tSeg(8, 2, 31, 15, 13, 60), tSeg(3, 8, 31, 14, 0, 80)) },
  laserCharge:{ pri:2, gap:0.3,  f:() => tSeg(12, 26, 3, 5, 13, 90) },
  laserFire: { pri:3, gap:0.2,   f:() => tSeg(6, 3, 6, 14, 10, 54) },
  bossShot:  { pri:0, gap:0.06,  f:() => tSeg(12, 9, 3, 8, 0, 6) },
  crate:     { pri:1, gap:0.1,   f:() => tCat(tHold(12, 7, 9, 2), tHold(12, 5, 9, 2), tSeg(12, 7, 7, 9, 0, 4)) },
  pickup:    { pri:2, gap:0.05,  f:() => tCat(tHold(12, 9, 11, 2), tHold(12, 6, 11, 2), tHold(12, 4, 12, 2), tSeg(12, 2, 2, 12, 0, 8)) },
  nuke:      { pri:3, gap:0.5,   f:() => tCat(tSeg(8, 2, 31, 15, 14, 40), tSeg(3, 6, 31, 14, 0, 70)) },
  shieldHit: { pri:2, gap:0.1,   f:() => tCat(tHold(12, 3, 12, 3), tSeg(12, 6, 14, 12, 0, 10)) },
  hazard:    { pri:2, gap:0.5,   f:() => tCat(tSeg(6, 24, 14, 11, 14, 30), tSeg(6, 14, 22, 14, 0, 24)) },
  lavaLaunch:{ pri:1, gap:0.12,  f:() => tCat(tSeg(8, 14, 4, 10, 12, 8), tSeg(8, 4, 20, 12, 0, 10)) },
  deploy:    { pri:2, gap:0.2,   f:() => tCat(tSeg(3, 22, 4, 9, 14, 12), tSeg(8, 3, 14, 14, 0, 16)) },
  locked:    { pri:1, gap:0.08,  f:() => tCat(tHold(4, 20, 10, 3), tHold(4, 27, 10, 6)) },
};

const MAX_VOICES = 6;
let actx = null, master = null, voices = [];
const tiaBufs = {};

function audioInit(){
  if (!actx){
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = actx.createDynamicsCompressor();
      master = actx.createGain();
      master.gain.value = 0.5;
      master.connect(comp);
      comp.connect(actx.destination);
    } catch(e){ actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}

function sfx(name, arg){
  if (!actx || opts.muted) return;
  const def = SFX_DEFS[name];
  if (!def) return;
  const now = actx.currentTime;
  if (def.last !== undefined && now - def.last < def.gap) return;
  const key = arg === undefined ? name : name + ':' + arg;
  let buf = tiaBufs[key];
  if (!buf){ buf = tiaRender(def.f(arg), actx.sampleRate); tiaBufs[key] = buf; }
  voices = voices.filter(v => v.end > now);
  if (voices.length >= MAX_VOICES){
    let lo = 0;
    for (let i = 1; i < voices.length; i++) if (voices[i].pri < voices[lo].pri) lo = i;
    if (voices[lo].pri > def.pri) return;
    try { voices[lo].src.stop(); } catch(e){}
    voices.splice(lo, 1);
  }
  const src = actx.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  src.start();
  voices.push({ src, pri: def.pri, end: now + buf.duration });
  def.last = now;
}
