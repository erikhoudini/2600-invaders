'use strict';
// Pre-rendered Saturn
// =====================================================================
//  PRE-RENDERED SATURN
// =====================================================================
const SAT_OFF = 96;
const SAT_FRAMES = 16;
const SAT_PLANET_R = 15;
const saturnFramesByEnv = {};
let saturnFrames = [];

const SAT_BAND_SHADES = [
  [P.blk, P.dorg, P.dorg, P.org],
  [P.dorg, P.org, P.org, P.tan],
  [P.dorg, P.org, P.tan, P.tan],
  [P.org, P.tan, P.tan, P.yel],
  [P.org, P.tan, P.yel, P.yel],
  [P.org, P.tan, P.tan, P.yel],
  [P.dorg, P.org, P.tan, P.tan],
  [P.dorg, P.org, P.org, P.tan],
  [P.blk, P.dorg, P.dorg, P.org],
];
const RING_BANDS = [
  { r1: 1.12, r2: 1.36, shades: [P.dolk, P.olk, P.olk, P.yel] },
  { r1: 1.36, r2: 1.50, shades: [P.dorg, P.org, P.tan, P.tan] },
  { r1: 1.50, r2: 1.72, shades: [P.org, P.tan, P.tan, P.yel] },
  { r1: 1.72, r2: 1.94, shades: [P.org, P.tan, P.yel, P.wht] },
  { r1: 1.94, r2: 2.10, shades: [P.dorg, P.org, P.org, P.tan] },
  { r1: 2.22, r2: 2.44, shades: [P.dolk, P.olk, P.olk, P.yel] },
  { r1: 2.44, r2: 2.56, shades: [P.dorg, P.dorg, P.org, P.org] },
];
const GRS_SHADES = [P.dred, P.red, P.red, P.pnk];
const BANDS_JUPITER = [
  [P.dorg, P.org, P.tan, P.tan],
  [P.dred, P.red, P.red, P.pnk],
  [P.dorg, P.org, P.tan, P.yel],
  [P.org, P.tan, P.yel, P.wht],
  [P.dorg, P.org, P.tan, P.tan],
  [P.dred, P.red, P.pnk, P.pnk],
  [P.dorg, P.org, P.org, P.tan],
  [P.org, P.tan, P.tan, P.yel],
  [P.blk, P.dorg, P.dorg, P.org],
];
const BANDS_NEPTUNE = [
  [P.blk, P.dblu, P.dblu, P.blu],
  [P.dblu, P.blu, P.blu, P.lblu],
  [P.dblu, P.blu, P.lblu, P.lblu],
  [P.blu, P.lblu, P.lblu, P.wht],
  [P.blu, P.lblu, P.wht, P.wht],
  [P.blu, P.lblu, P.lblu, P.wht],
  [P.dblu, P.blu, P.lblu, P.lblu],
  [P.dblu, P.blu, P.blu, P.lblu],
  [P.blk, P.dblu, P.dblu, P.blu],
];
const BANDS_ICE = [
  [P.blk, P.dgrn, P.dgrn, P.grn],
  [P.dgrn, P.grn, P.grn, P.lgrn],
  [P.dgrn, P.grn, P.lgrn, P.lgrn],
  [P.grn, P.lgrn, P.lgrn, P.wht],
  [P.grn, P.lgrn, P.wht, P.wht],
  [P.grn, P.lgrn, P.lgrn, P.wht],
  [P.dgrn, P.grn, P.lgrn, P.lgrn],
  [P.dgrn, P.grn, P.grn, P.lgrn],
  [P.blk, P.dgrn, P.dgrn, P.grn],
];
const ICE_RING_SHADES = [
  [P.dgrn, P.grn, P.grn, P.lgrn], [P.grn, P.lgrn, P.lgrn, P.wht],
  [P.grn, P.lgrn, P.wht, P.wht], [P.dgrn, P.grn, P.lgrn, P.lgrn],
];
const PLANETS = {
  saturn:  { bands:SAT_BAND_SHADES, rings:RING_BANDS, spot:{ lat:-0.12, lon:Math.PI*0.7, size:0.32, shades:GRS_SHADES }, rot:0.06 },
  jupiter: { bands:BANDS_JUPITER, rings:null, spot:{ lat:-0.30, lon:Math.PI*0.65, size:0.40, shades:[P.dred, P.red, P.pnk, P.pnk] }, rot:0.08 },
  neptune: { bands:BANDS_NEPTUNE, rings:null, spot:{ lat:-0.22, lon:Math.PI*0.7, size:0.30, shades:[P.blk, P.dblu, P.dblu, P.blu] }, rot:0.07 },
  ice:     { bands:BANDS_ICE, rings:RING_BANDS.map((b, i) => ({ r1:b.r1, r2:b.r2, shades:ICE_RING_SHADES[i % 4] })), spot:null, rot:0.05 },
};

function renderSaturnFrame(t, env){
  const c = document.createElement('canvas');
  c.width = SAT_OFF; c.height = SAT_OFF;
  const sc = c.getContext('2d');
  sc.imageSmoothingEnabled = false;
  const cx = SAT_OFF/2, cy = SAT_OFF/2, R = SAT_PLANET_R;
  const PL = PLANETS[env.planetKey];
  const sinT = Math.sin(env.saturnTilt);
  const LX = -0.52, LY = -0.55, LZ = 0.65;
  const N_LON = 12, N_LAT = 9;
  const rotation = t * PL.rot;
  const N_SEG = 24;
  const ringSegs = [];
  for(let s=0; s<N_SEG; s++){
    const a0 = (s/N_SEG) * Math.PI * 2;
    const a1 = ((s+1)/N_SEG) * Math.PI * 2;
    const aMid = (a0+a1)/2;
    const isNear = Math.sin(aMid) > 0;
    if(PL.rings) for(const band of PL.rings){
      ringSegs.push({ a0, a1, aMid, r1: band.r1*R, r2: band.r2*R, shades: band.shades, isNear });
    }
  }
  function drawSegs(near){
    for(const seg of ringSegs){
      if(seg.isNear !== near) continue;
      const phase = seg.aMid + t * 0.4;
      const dens = 0.5 + 0.5 * Math.sin(phase * 3);
      const shadeIdx = Math.min(3, Math.floor(dens * 4));
      sc.fillStyle = seg.shades[shadeIdx];
      const c0 = Math.cos(seg.a0), s0 = Math.sin(seg.a0);
      const c1 = Math.cos(seg.a1), s1 = Math.sin(seg.a1);
      const aX = c0 * seg.r1, aY = -s0 * seg.r1 * sinT;
      const bX = c0 * seg.r2, bY = -s0 * seg.r2 * sinT;
      const cX = c1 * seg.r2, cY = -s1 * seg.r2 * sinT;
      const dX = c1 * seg.r1, dY = -s1 * seg.r1 * sinT;
      sc.beginPath();
      sc.moveTo(cx + aX, cy + aY); sc.lineTo(cx + bX, cy + bY);
      sc.lineTo(cx + cX, cy + cY); sc.lineTo(cx + dX, cy + dY);
      sc.closePath(); sc.fill();
    }
  }
  drawSegs(false);
  // Great red spot center is constant per frame, so compute it once outside the loops
  const SP = PL.spot;
  const grsWorldLon = (SP ? SP.lon : 0) + rotation;
  const grsLat = SP ? SP.lat : 0;
  const grsSY = Math.sin(grsLat), grsSR = Math.cos(grsLat);
  const grsSX = grsSR*Math.cos(grsWorldLon);
  const grsSZ = grsSR*Math.sin(grsWorldLon);
  const grsCos = Math.cos(SP ? SP.size : 0);
  for(let i=0;i<N_LAT;i++){
    const lat0 = -Math.PI/2 + (i/N_LAT)*Math.PI;
    const lat1 = -Math.PI/2 + ((i+1)/N_LAT)*Math.PI;
    const y0 = Math.sin(lat0), y1 = Math.sin(lat1);
    const rr0 = Math.cos(lat0), rr1 = Math.cos(lat1);
    for(let j=0;j<N_LON;j++){
      const lon0 = (j/N_LON)*Math.PI*2 + rotation;
      const lon1 = ((j+1)/N_LON)*Math.PI*2 + rotation;
      const c0 = Math.cos(lon0), s0 = Math.sin(lon0);
      const c1 = Math.cos(lon1), s1 = Math.sin(lon1);
      const x00=rr0*c0, z00=rr0*s0;
      const x01=rr1*c0, z01=rr1*s0;
      const x11=rr1*c1, z11=rr1*s1;
      const x10=rr0*c1, z10=rr0*s1;
      const fcx=(x00+x01+x11+x10)*0.25;
      const fcy=(y0+y1)*0.5;
      const fcz=(z00+z01+z11+z10)*0.25;
      const fl=Math.sqrt(fcx*fcx+fcy*fcy+fcz*fcz)||1;
      const nnx=fcx/fl, nny=fcy/fl, nnz=fcz/fl;
      if(nnz<0.06) continue;
      const dot = nnx*LX + nny*LY + nnz*LZ;
      let tier;
      if(dot > 0.62) tier = 3; else if(dot > 0.28) tier = 2;
      else if(dot > -0.02) tier = 1; else tier = 0;
      let col = PL.bands[i][tier];
      if(SP && nnx*grsSX + nny*grsSY + nnz*grsSZ > grsCos) col = SP.shades[tier];
      sc.fillStyle = col;
      sc.beginPath();
      sc.moveTo(cx + x00*R, cy - y0*R); sc.lineTo(cx + x01*R, cy - y1*R);
      sc.lineTo(cx + x11*R, cy - y1*R); sc.lineTo(cx + x10*R, cy - y0*R);
      sc.closePath(); sc.fill();
    }
  }
  drawSegs(true);
  // Hexagon at the pole with the black cube at its centre
  {
    const hx = cx + Math.sin(rotation * 0.0) * 0, hy = cy - R * 0.74, hr = R * 0.34;
    const line = (x0, y0, x1, y1, col) => {
      sc.fillStyle = col;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1;
      for (let i = 0; i <= n; i++) sc.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
    };
    for (let k = 0; k < 6; k++){
      const a0 = k / 6 * Math.PI * 2, a1 = (k + 1) / 6 * Math.PI * 2;
      line(hx + Math.cos(a0) * hr, hy + Math.sin(a0) * hr * 0.36, hx + Math.cos(a1) * hr, hy + Math.sin(a1) * hr * 0.36, P.dolk);
    }
    sc.fillStyle = P.blk; sc.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 2);
    sc.fillStyle = P.gry; sc.fillRect(Math.round(hx) - 1, Math.round(hy) - 2, 3, 1);
  }
  return c;
}
function preRenderSaturn(env){
  const key = env.id;
  if (saturnFramesByEnv[key]) return;
  const frames = [];
  const totalTime = 15.7;
  for (let i = 0; i < SAT_FRAMES; i++){
    frames.push(renderSaturnFrame((i / SAT_FRAMES) * totalTime, env));
  }
  saturnFramesByEnv[key] = frames;
}
function activateSaturn(env){
  const key = env.id;
  if (!saturnFramesByEnv[key]) preRenderSaturn(env);
  saturnFrames = saturnFramesByEnv[key] || [];
}
