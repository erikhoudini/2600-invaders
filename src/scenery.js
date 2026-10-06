'use strict';
// Stars, atmosphere, clouds
// =====================================================================
//  STARS, ATMOSPHERE, CLOUDS
// =====================================================================
let starCanvas = null;
const starData = [];
function preRenderStars(){
  starData.length = 0;
  for(let i=0;i<30;i++)starData.push({x:rndi(2,W-3),y:rndi(4,SH-3),layer:0,tw:0});
  for(let i=0;i<14;i++)starData.push({x:rndi(2,W-3),y:rndi(4,SH-3),layer:1,tw:rnd(0,6.28)});
  for(let i=0;i<6;i++)starData.push({x:rndi(2,W-3),y:rndi(4,SH-3),layer:2,tw:rnd(0,6.28)});
  const c = document.createElement('canvas');
  c.width = W; c.height = SH;
  const sc = c.getContext('2d');
  sc.imageSmoothingEnabled = false;
  for (const s of starData){
    if (s.layer === 1){ sc.fillStyle=P.gry; sc.fillRect(s.x,s.y,1,1); }
  }
  starCanvas = c;
}
function drawStars(t){
  if (starCanvas) ctx.drawImage(starCanvas, 0, 0);
  for (const s of starData){
    if (s.layer !== 2) continue;
    const tw = 0.5 + 0.5*Math.sin(t*4+s.tw);
    ctx.fillStyle = tw > 0.5 ? P.wht : P.gry;
    ctx.fillRect(s.x,s.y,1,1);
  }
}

const CLOUD_TOP = SH - 58;
const CLOUD_BOTTOM = SH;
const CLOUD_CANVAS_H = 66;
let cloudFarCanvas = null, cloudNearCanvas = null;
const ATMO_BAND_H = 3;

function drawAtmosphere(){
  const bands = currentEnv.atmoBands;
  const y0 = CLOUD_TOP - bands.length * ATMO_BAND_H;
  for(let i = 0; i < bands.length; i++){
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, y0 + i * ATMO_BAND_H, W, ATMO_BAND_H);
  }
}
function makeCloudLayer(opacity, darkCol, lightCol, cloudCount, sizeRange){
  const c = document.createElement('canvas');
  c.width = W; c.height = CLOUD_CANVAS_H;
  const cc = c.getContext('2d');
  cc.imageSmoothingEnabled = false;
  for(let i=0; i<cloudCount; i++){
    const cx = rnd(-15, W + 15);
    const cy = rnd(10, CLOUD_CANVAS_H - 12);
    const cw = rndi(sizeRange[0], sizeRange[1]);
    const ch = rndi(5, Math.round(cw * 0.35));
    const blobs = rndi(5, 8);
    cc.fillStyle = darkCol;
    cc.globalAlpha = opacity * 0.75;
    for(let b=0; b<blobs; b++){
      const bx = cx + rnd(-cw/2, cw/2);
      const by = cy + 2 + rnd(-ch/4, ch/4);
      const bw = rndi(Math.max(3, Math.floor(cw/3)), cw);
      const bh = rndi(2, Math.max(3, Math.floor(ch/2)));
      cc.fillRect(Math.floor(bx), Math.floor(by), bw, bh);
    }
    cc.fillStyle = lightCol;
    cc.globalAlpha = opacity;
    for(let b=0; b<blobs; b++){
      const bx = cx + rnd(-cw/2, cw/2);
      const by = cy + rnd(-ch/2, ch/4);
      const bw = rndi(Math.max(3, Math.floor(cw/3)), cw);
      const bh = rndi(2, Math.max(3, Math.floor(ch/2)));
      cc.fillRect(Math.floor(bx), Math.floor(by), bw, bh);
    }
  }
  cc.globalAlpha = 1;
  return c;
}
function createCloudLayers(env){
  cloudFarCanvas  = makeCloudLayer(env.cloudOpacityFar,  env.cloudFarDark,  env.cloudFarLight,  14, [22, 42]);
  cloudNearCanvas = makeCloudLayer(env.cloudOpacityNear, env.cloudNearDark, env.cloudNearLight, 10, [28, 52]);
}
function drawCloudBand(t){
  const y = CLOUD_TOP - 8;
  const off1 = (t * 4) % W;
  ctx.drawImage(cloudFarCanvas, Math.round(-off1), y);
  ctx.drawImage(cloudFarCanvas, Math.round(W - off1), y);
  const off2 = (t * 10) % W;
  ctx.drawImage(cloudNearCanvas, Math.round(-(W - off2)), y);
  ctx.drawImage(cloudNearCanvas, Math.round(off2), y);
}
function cloudAlphaAtY(y){
  if(y < CLOUD_TOP || y > CLOUD_BOTTOM) return 1;
  const depth = (y - CLOUD_TOP) / (CLOUD_BOTTOM - CLOUD_TOP);
  const dip = currentEnv.cloudDip;
  const a = 1 - dip * Math.sin(depth * Math.PI);
  return Math.max(0.65, a);
}
