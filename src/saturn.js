'use strict';
// Pre-rendered Saturn
// =====================================================================
//  PRE-RENDERED SATURN
// =====================================================================
const SAT_OFF = 96;
const SAT_FRAMES = 24;
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
  { r1: 1.14, r2: 1.42, shades: [P.dolk, P.olk, P.olk, P.yel] },
  { r1: 1.46, r2: 1.98, shades: [P.org, P.tan, P.tan, P.yel] },
  { r1: 2.08, r2: 2.32, shades: [P.dorg, P.org, P.org, P.tan] },
  { r1: 2.40, r2: 2.62, shades: [P.dolk, P.olk, P.olk, P.yel] },
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

// One frame of the planet, drawn pixel by pixel in flat colours like a 2600 sprite:
// scanline bands, hard shading steps, a black outline and solid ring bands. `ph` runs 0..1
// over one full turn, so the frames loop without a seam.
function renderSaturnFrame(ph, env){
  const c = document.createElement('canvas');
  c.width = SAT_OFF; c.height = SAT_OFF;
  const sc = c.getContext('2d');
  const cx = SAT_OFF / 2, cy = SAT_OFF / 2, R = SAT_PLANET_R;
  const PL = PLANETS[env.planetKey];
  const tilt = Math.max(0.2, Math.sin(env.saturnTilt));
  const rot = ph * Math.PI * 2, TAU = Math.PI * 2;
  const nb = PL.bands.length, SP = PL.spot;
  const LX = -0.52, LY = -0.55, LZ = 0.65;
  const TH = [-0.2, 0.12, 0.5];                        // shading steps: dark limb, shade, lit, highlight
  const N_CELL = 12;
  for (let py = 0; py < SAT_OFF; py++){
    for (let px = 0; px < SAT_OFF; px++){
      const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      const inDisc = d2 <= R * R;
      let col = null;
      // ring: the pixel's place on the ring plane gives its radius and angle
      let ringCol = null;
      if (PL.rings){
        const ry = dy / tilt;
        const r = Math.sqrt(dx * dx + ry * ry) / R;
        if (r >= 1.1 && r <= 2.7){
          for (const band of PL.rings){
            if (r < band.r1 || r > band.r2) continue;
            const dens = 0.5 + 0.5 * Math.sin(Math.atan2(-ry, dx) * 3 - rot);
            ringCol = band.shades[Math.min(3, Math.floor(dens * 4))];
            break;
          }
        }
      }
      const front = dy > 0;                              // near side of the ring
      if (ringCol && (front || !inDisc)){ col = ringCol; }
      else if (inDisc){
        const nx = dx / R, ny = dy / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const bi = Math.min(nb - 1, Math.floor((ny + 1) / 2 * nb));
        const lon = ((Math.atan2(nx, nz) + rot) % TAU + TAU) % TAU;
        const cell = Math.floor(lon / TAU * N_CELL);
        const dot = nx * LX + ny * LY + nz * LZ;
        let tier = dot > TH[2] ? 3 : dot > TH[1] ? 2 : dot > TH[0] ? 1 : 0;
        // every other scanline steps down along the terminator, which reads as a hatched edge
        if ((py & 1) && (Math.abs(dot - TH[0]) < 0.07 || Math.abs(dot - TH[1]) < 0.07 || Math.abs(dot - TH[2]) < 0.07)) tier = Math.max(0, tier - 1);
        // blocky cloud cells drift round with the planet
        if ((((bi * 7 + cell * 13) ^ (bi * 3 + cell * 5)) & 3) === 0) tier = Math.max(0, tier - 1);
        col = PL.bands[bi][tier];
        if (SP){
          const lat = Math.asin(clamp(-ny, -1, 1));
          let dl = lon - (((SP.lon) % TAU) + TAU) % TAU; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const a = dl * Math.cos(lat), b = lat - SP.lat, rr = SP.size * 0.5;
          if (a * a * 1.6 + b * b * 3.2 < rr * rr) col = SP.shades[tier];
        }
      } else if (d2 <= (R + 1.2) * (R + 1.2)){
        col = P.blk;
      }
      if (col){ sc.fillStyle = col; sc.fillRect(px, py, 1, 1); }
    }
  }
  // Hexagon at the pole with the black cube at its centre
  const hx = cx, hy = cy - R * 0.74, hr = R * 0.34;
  const line = (x0, y0, x1, y1, col) => {
    sc.fillStyle = col;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1;
    for (let i = 0; i <= n; i++) sc.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
  };
  for (let k = 0; k < 6; k++){
    const a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU;
    line(hx + Math.cos(a0) * hr, hy + Math.sin(a0) * hr * 0.36, hx + Math.cos(a1) * hr, hy + Math.sin(a1) * hr * 0.36, P.dolk);
  }
  sc.fillStyle = P.blk; sc.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 2);
  sc.fillStyle = P.gry; sc.fillRect(Math.round(hx) - 1, Math.round(hy) - 2, 3, 1);
  return c;
}
function preRenderSaturn(env){
  const key = env.id;
  if (saturnFramesByEnv[key]) return;
  const frames = [];
  for (let i = 0; i < SAT_FRAMES; i++) frames.push(renderSaturnFrame(i / SAT_FRAMES, env));
  saturnFramesByEnv[key] = frames;
}
// Warm the next moon's planet one frame at a time while the game is idle, so arriving there costs nothing
const saturnWarm = {};
function warmSaturn(env){
  const key = env.id;
  if (saturnFramesByEnv[key] || saturnWarm[key]) return;
  const frames = saturnWarm[key] = [];
  const step = () => {
    if (saturnFramesByEnv[key]) return;
    if (frames.length < SAT_FRAMES){ frames.push(renderSaturnFrame(frames.length / SAT_FRAMES, env)); setTimeout(step, 24); }
    else saturnFramesByEnv[key] = frames;
  };
  setTimeout(step, 400);
}
function activateSaturn(env){
  const key = env.id;
  if (!saturnFramesByEnv[key]) preRenderSaturn(env);
  saturnFrames = saturnFramesByEnv[key] || [];
}
