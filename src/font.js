'use strict';
// Bitmap text
// =====================================================================
//  BITMAP TEXT (glyphs are cached per character, color and scale)
// =====================================================================
const FONT={
 'A':'010,101,111,101,101','B':'110,101,110,101,110','C':'011,100,100,100,011',
 'D':'110,101,101,101,110','E':'111,100,110,100,111','F':'111,100,110,100,100',
 'G':'011,100,101,101,011','H':'101,101,111,101,101','I':'111,010,010,010,111',
 'J':'001,001,001,101,010','K':'101,101,110,101,101','L':'100,100,100,100,111',
 'M':'101,111,111,101,101','N':'110,101,101,101,101','O':'010,101,101,101,010',
 'P':'110,101,110,100,100','Q':'010,101,101,111,011','R':'110,101,110,101,101',
 'S':'011,100,010,001,110','T':'111,010,010,010,010','U':'101,101,101,101,011',
 'V':'101,101,101,101,010','W':'101,101,111,111,101','X':'101,101,010,101,101',
 'Y':'101,101,010,010,010','Z':'111,001,010,100,111',
 '0':'111,101,101,101,111','1':'010,110,010,010,111','2':'110,001,010,100,111',
 '3':'111,001,011,001,111','4':'101,101,111,001,001','5':'111,100,110,001,110',
 '6':'011,100,111,101,111','7':'111,001,010,010,010','8':'111,101,111,101,111',
 '9':'111,101,111,001,110',
 '-':'000,000,111,000,000','.':'000,000,000,000,010',':':'000,010,000,010,000',
 '!':'010,010,010,000,010','?':'110,001,010,000,010','/':'001,001,010,100,100',
 '>':'100,010,001,010,100','<':'001,010,100,010,001','*':'101,010,111,010,101',
 '+':'000,010,111,010,000',' ':'000,000,000,000,000','%':'101,001,010,100,101',
 '#':'101,111,101,111,101',
 ',':'000,000,000,010,100',"'":'010,010,000,000,000','=':'000,111,000,111,000','^':'010,101,000,000,000',
};
const glyphCache = new Map();
function getGlyph(ch,col,sc){
  const key = ch + col + sc;
  let c = glyphCache.get(key);
  if (c !== undefined) return c;
  const g = FONT[ch];
  if (!g){ glyphCache.set(key, null); return null; }
  c = document.createElement('canvas');
  c.width = 3*sc; c.height = 5*sc;
  const gc = c.getContext('2d');
  gc.fillStyle = col;
  const rows = g.split(',');
  for (let j=0;j<5;j++) for (let k=0;k<3;k++) if (rows[j][k]==='1') gc.fillRect(k*sc,j*sc,sc,sc);
  glyphCache.set(key, c);
  return c;
}
function textW(s){return s.length*4-1;}
function textW2x(s){return s.length*8-2;}
function drawTextS(s,x,y,col,alpha,sc){
  s=String(s).toUpperCase();
  const prevA=ctx.globalAlpha;
  if(alpha!==undefined)ctx.globalAlpha=alpha;
  let cx=Math.round(x); const yy=Math.round(y); const adv=4*sc;
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch!==' '){const g=getGlyph(ch,col,sc);if(g)ctx.drawImage(g,cx,yy);}
    cx+=adv;
  }
  ctx.globalAlpha=prevA;
}
function drawText(s,x,y,col,alpha){drawTextS(s,x,y,col,alpha,1);}
function drawText2x(s,x,y,col,alpha){drawTextS(s,x,y,col,alpha,2);}

const SPR = {
  ipbm:    { w:3, h:6, col:P.red,  data:[[0,1,0],[0,1,0],[1,1,1],[0,1,0],[1,0,1],[1,0,1]] },
  smart:   { w:5, h:4, col:P.lblu, data:[[1,0,1,0,1],[0,1,1,1,0],[1,1,1,1,1],[0,1,0,1,0]] },
  scout:   { w:5, h:3, col:P.grn,  data:[[1,0,0,0,1],[1,1,1,1,1],[0,1,0,1,0]] },
  bomber:  { w:7, h:3, col:P.gry,  data:[[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[1,0,1,0,1,0,1]] },
  bandit:  { w:5, h:5, col:P.mag,  data:[[0,0,1,0,0],[0,1,1,1,0],[1,1,0,1,1],[0,1,1,1,0],[0,0,1,0,0]] },
  splitter:{ w:5, h:5, col:P.grn,  data:[[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]] },
  shrapnel:{ w:5, h:5, col:P.mag,  data:[[1,0,1,0,1],[0,1,0,1,0],[1,0,0,0,1],[0,1,0,1,0],[1,0,1,0,1]] },
  icbm:    { w:3, h:8, col:P.org,  data:[[0,1,0],[0,1,0],[1,1,1],[0,1,0],[0,1,0],[1,1,1],[0,1,0],[0,1,0]] },
  heavy:   { w:5, h:6, col:P.yel,  data:[[0,1,1,1,0],[1,1,1,1,1],[1,0,0,0,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]] },
  colbomb: { w:3, h:9, col:P.pur,  data:[[0,1,0],[0,1,0],[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1],[0,1,0],[0,1,0]] },
  rowbomb: { w:9, h:3, col:P.lmag, data:[[0,0,1,0,1,0,1,0,0],[1,1,1,1,1,1,1,1,1],[0,0,1,0,1,0,1,0,0]] },
  mini:    { w:3, h:3, col:P.lgrn, data:[[1,0,1],[0,1,0],[1,0,1]] },
  multi:   { w:5, h:5, col:P.pnk,  data:[[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },
  midsplit:{ w:5, h:5, col:P.tan,  data:[[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[1,0,1,0,1],[0,1,0,1,0]] },
  gunner:  { w:7, h:4, col:P.pnk,  data:[[0,1,1,1,1,1,0],[1,1,0,1,0,1,1],[1,1,1,1,1,1,1],[0,1,0,0,0,1,0]] },
  carrier: { w:9, h:4, col:P.lpur, data:[[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,0,1,0,1,1],[0,1,0,0,0,0,0,1,0]] },
  meteor:  { w:3, h:3, col:P.wht,  data:[[1,1,0],[1,1,1],[0,1,1]] },
  lava:    { w:5, h:5, col:P.org,  data:[[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0]] },
  shard:   { w:3, h:5, col:P.lblu, data:[[0,1,0],[1,1,1],[1,1,1],[1,1,1],[0,1,0]] },
  boulder: { w:7, h:6, col:P.gry,  data:[[0,1,1,1,1,0,0],[1,1,1,1,1,1,0],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,1],[0,0,1,1,1,0,0]] },
  heavybomb:{ w:5, h:8, col:P.org, data:[[0,0,1,0,0],[0,1,1,1,0],[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[1,1,0,1,1],[0,1,0,1,0],[0,1,0,1,0]] },
};

function drawSprite2600(spr, cx, cy, alpha){
  const w=spr.w, h=spr.h;
  const ox=Math.round(cx-w/2), oy=Math.round(cy-h/2);
  const prevA = ctx.globalAlpha;
  const a = (alpha !== undefined) ? alpha : 1;
  ctx.globalAlpha = prevA * a;
  ctx.fillStyle=P.blk;
  for(let j=0;j<h;j++){const row=spr.data[j];for(let i=0;i<w;i++){if(row[i])ctx.fillRect(ox+i+1,oy+j+1,1,1);}}
  ctx.fillStyle=spr.col;
  for(let j=0;j<h;j++){const row=spr.data[j];for(let i=0;i<w;i++){if(row[i])ctx.fillRect(ox+i,oy+j,1,1);}}
  ctx.globalAlpha=prevA;
}

function fillCircle(cx,cy,r,col){
  if(r<0.5)return;ctx.fillStyle=col;
  const R=Math.ceil(r);
  for(let dy=-R;dy<=R;dy++){
    const d2=r*r-dy*dy;if(d2<=0)continue;
    const dx=Math.sqrt(d2);
    const x0=Math.round(cx-dx),x1=Math.round(cx+dx);
    if(x1>x0)ctx.fillRect(x0,Math.round(cy+dy),x1-x0,1);
  }
}

function drawJaggedTrail(x0,y0,x1,y1,col,density,alpha){
  const dx=x1-x0, dy=y1-y0;
  const dist=Math.hypot(dx,dy);
  if(dist<1)return;
  const steps=Math.max(1,Math.ceil(dist));
  const prevA=ctx.globalAlpha;
  ctx.fillStyle=col;
  if(alpha!==undefined)ctx.globalAlpha=alpha;
  const den = density || 1;
  ctx.beginPath();
  for(let i=0;i<=steps;i+=den){
    const t=i/steps;
    ctx.rect(Math.round(x0+dx*t),Math.round(y0+dy*t),1,1);
  }
  ctx.fill();
  ctx.globalAlpha=prevA;
}
