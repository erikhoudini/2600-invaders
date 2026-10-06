'use strict';
// Particles and explosions
// =====================================================================
//  PARTICLES
// =====================================================================
const MAX_PARTICLES = 180;
let particles = [];
function spawnParticle(x,y,vx,vy,life,col,size){
  if(particles.length >= MAX_PARTICLES) return;
  particles.push({x,y,vx,vy,t:0,life:life||0.6,col,size:size||1,g:size===2?60:30});
}
function spawnExplosionParticles(x,y,intensity,col){
  const n = 3 + intensity * 2;
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const sp = rnd(30, 80) * (intensity * 0.5 + 0.6);
    spawnParticle(x, y, Math.cos(a)*sp, Math.sin(a)*sp, rnd(0.3, 0.7), col, Math.random()<0.3?2:1);
  }
  for(let i=0;i<2;i++)spawnParticle(x + rnd(-4,4), y + rnd(-4,4), rnd(-8,8), rnd(-14,-4), rnd(0.6,1.0), P.gry, 2);
}
function updateParticles(dt){
  for(const p of particles){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;p.vx*=0.96;p.vy*=0.98;}
  particles = particles.filter(p=>p.t<p.life);
}
function drawParticles(){
  const prevA = ctx.globalAlpha;
  for(const p of particles){
    ctx.globalAlpha = (1 - p.t/p.life) * (Math.sin(p.t*40+p.x)>0?1:0.7);
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = prevA;
}

// =====================================================================
//  EXPLOSIONS
// =====================================================================
let hueCounter=0;
let blastPal = RAINBOW, blastStyle = 0;
class Boom{
  constructor(x,y,kind,o){
    o=o||{};this.x=x;this.y=y;this.kind=kind;this.t=0;
    this.delay=o.delay||0;this.dur=o.dur||0.55;this.rmax=o.r||24;
    this.hue=(hueCounter++)%7;this.dead=false;
    this.sparksSpawned=false;
    this.intensity=Math.min(3,Math.max(1,Math.round(this.rmax/22)));
    this.mushroomColors = [P.dorg, P.org, P.tan, P.yel, P.wht];
    this.noBoss = !!o.noBoss; this.hits = null;
  }
  get p(){if(this.t<this.delay)return 0;return clamp((this.t-this.delay)/this.dur,0,1);}
  update(dt){
    this.t+=dt;const p=this.p;
    if(p>0.15&&!this.sparksSpawned&&this.kind!=='flash'&&this.kind!=='ring'&&this.kind!=='mushroom'){
      this.sparksSpawned=true;
      spawnExplosionParticles(this.x,this.y,this.intensity,blastPal[this.hue]);
    }
    if(this.t>=this.delay+this.dur)this.dead=true;
  }
  hitTest(px,py){
    const p=this.p;if(p<=0||p>=1)return false;
    const s=Math.sin(Math.PI*p);
    if(this.kind==='circle'||this.kind==='nova'||this.kind==='flash'||this.kind==='diamond'){
      const r=this.rmax*s;const dx=px-this.x,dy=py-this.y;
      if(this.kind==='diamond') return Math.abs(dx)+Math.abs(dy) < r*1.3;
      return dx*dx+dy*dy<r*r;
    }
    if(this.kind==='ring'){
      const r=this.rmax*s;const dx=px-this.x,dy=py-this.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      return Math.abs(d - r) < 6;
    }
    if(this.kind==='xcross'){
      const r=this.rmax*s*0.8,dx=Math.abs(px-this.x),dy=Math.abs(py-this.y);
      return Math.abs(dx-dy) < 7 && Math.max(dx,dy) < r;
    }
    if(this.kind==='vcol') return Math.abs(px-this.x) < 8 && Math.abs(py-this.y) < this.rmax*s;
    if(this.kind==='hcol') return Math.abs(py-this.y) < 8 && Math.abs(px-this.x) < this.rmax*s;
    if(this.kind==='burst'){
      const r=this.rmax*s;const dx=px-this.x,dy=py-this.y;
      const d=Math.sqrt(dx*dx+dy*dy);if(d>r) return false;
      const ang = Math.atan2(dy,dx);
      const sector = ang * 8 / (Math.PI*2);
      const frac = Math.abs(sector - Math.round(sector)) * 2;
      return d < r * (1 - frac*0.6);
    }
    if(this.kind==='cross'){
      const r=this.rmax*s;const dx=Math.abs(px-this.x), dy=Math.abs(py-this.y);
      return (dx < 6 && dy < r) || (dy < 6 && dx < r);
    }
    if(this.kind==='mushroom'){
      const growT = Math.min(1, p * 1.8);
      const stemH = this.rmax * 2.4 * growT;
      const capR = this.rmax * 0.9 * growT;
      const capX = this.x, capY = this.y - stemH * 0.7;
      const dx = px - capX, dy = py - capY;
      if (dx*dx + dy*dy < capR*capR) return true;
      if (Math.abs(px - this.x) < 8 && py > this.y - stemH && py < this.y + 2) return true;
      return false;
    }
    return false;
  }
  // Unlockable blast shapes, layered on the normal fireball
  styleFx(r,c1,c2,c3,p){
    const x=this.x,y=this.y,k=blastStyle,tt=this.t;
    if(k===1){
      for(let i=-3;i<=3;i++){
        const h=Math.round(r*(0.45+0.4*Math.abs(Math.sin(tt*22+i*1.9)))*(1-Math.abs(i)*0.1));
        const bx=Math.round(x+i*r*0.3), base=Math.round(y-r*0.75);
        ctx.fillStyle=c2;ctx.fillRect(bx-2,base-Math.round(h*0.5),5,Math.round(h*0.5)+2);
        ctx.fillStyle=c1;ctx.fillRect(bx-1,base-Math.round(h*0.8),3,Math.round(h*0.8)+1);
        ctx.fillStyle=c3;ctx.fillRect(bx,base-h,1,h);
      }
    } else if(k===2){
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3+p*0.6;
        const len=r*1.35;
        for(let d=r*0.5;d<len;d+=1){
          ctx.fillStyle=d>len-3?c1:P.wht;
          ctx.fillRect(Math.round(x+Math.cos(a)*d),Math.round(y+Math.sin(a)*d),1,1);
        }
        const ex=Math.round(x+Math.cos(a)*len),ey=Math.round(y+Math.sin(a)*len);
        ctx.fillStyle=c2;ctx.fillRect(ex-1,ey-1,3,3);
      }
    } else if(k===3){
      for(let i=0;i<7;i++){
        const a=i*0.9+p*3.2,d=r*(0.55+0.5*((i*0.37+p*1.3)%1));
        const bx=x+Math.cos(a)*d,by=y+Math.sin(a)*d-p*r*0.5,br=Math.max(2,r*0.17);
        fillCircle(bx,by,br,c3);
        ctx.fillStyle=P.wht;ctx.fillRect(Math.round(bx-br*0.4),Math.round(by-br*0.4),1,1);
      }
    } else if(k===4){
      for(const f of [0.8,0.48]){
        const rr=r*f,steps=Math.ceil(rr*7);
        ctx.fillStyle=P.dpur;
        for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2;ctx.fillRect(Math.round(x+Math.cos(a)*rr),Math.round(y+Math.sin(a)*rr),1,1);}
      }
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3+p*11,rr=r*1.18;
        fillCircle(x+Math.cos(a)*rr,y+Math.sin(a)*rr,Math.max(1,r*0.1),P.lmag);
      }
    } else if(k===5){
      const prevA=ctx.globalAlpha;ctx.globalAlpha=0.5;ctx.fillStyle=P.blk;
      for(let dy=-Math.floor(r);dy<=r;dy+=2){
        const w=Math.sqrt(Math.max(0,r*r-dy*dy));
        if(w>1)ctx.fillRect(Math.round(x-w),Math.round(y+dy),Math.round(w*2),1);
      }
      ctx.globalAlpha=prevA;
    }
  }
  // Does this explosion touch a box? Used for boss parts
  overlapBox(cx,cy,hw,hh){
    const p=this.p;if(p<=0||p>=1)return false;
    const s=Math.sin(Math.PI*p),k=this.kind,r=this.rmax*s;
    const ax=Math.abs(this.x-cx),ay=Math.abs(this.y-cy);
    if(k==='circle'||k==='nova'||k==='flash'||k==='burst'||k==='diamond'){
      const dx=Math.max(ax-hw,0),dy=Math.max(ay-hh,0);return dx*dx+dy*dy<r*r;
    }
    if(k==='ring'){
      const nx=Math.max(ax-hw,0),ny=Math.max(ay-hh,0),near=Math.sqrt(nx*nx+ny*ny);
      const far=Math.sqrt((ax+hw)*(ax+hw)+(ay+hh)*(ay+hh));
      return near<r+5&&far>r-5;
    }
    if(k==='xcross'){const rr=r*0.8,dx=Math.max(ax-hw,0),dy=Math.max(ay-hh,0);return dx*dx+dy*dy<rr*rr;}
    if(k==='vcol')return ax<hw+8&&ay<hh+r;
    if(k==='hcol')return ay<hh+8&&ax<hw+r;
    if(k==='cross')return (ax<hw+6&&ay<hh+r)||(ay<hh+6&&ax<hw+r);
    return false;
  }
  draw(){
    const p=this.p;if(p<=0)return;
    const s=Math.sin(Math.PI*p);
    const idx=(this.hue+Math.floor(p*7))%7;
    const c1=blastPal[idx],c2=blastPal[(idx+3)%7],c3=blastPal[(idx+5)%7];
    if(this.kind==='circle'){
      const r=this.rmax*s;
      if(p<0.10)fillCircle(this.x,this.y,r*1.3,P.wht);
      if(p>0.05&&p<0.35){
        const ringR=r*1.5;const prevA=ctx.globalAlpha;
        ctx.globalAlpha=(1-(p-0.05)/0.3)*0.55;ctx.fillStyle=c1;
        const steps=Math.ceil(ringR*8);
        for(let i=0;i<steps;i++){
          const a=(i/steps)*Math.PI*2;
          ctx.fillRect(Math.round(this.x+Math.cos(a)*ringR),Math.round(this.y+Math.sin(a)*ringR),1,1);
        }
        ctx.globalAlpha=prevA;
      }
      fillCircle(this.x,this.y,r,c1);
      fillCircle(this.x,this.y,r*0.62,c2);
      fillCircle(this.x,this.y,r*0.30,c3);
      if(r>6)fillCircle(this.x,this.y,r*0.12,P.wht);
      if(blastStyle>0 && !this.noBoss && r>3)this.styleFx(r,c1,c2,c3,p);
    }
    else if(this.kind==='flash'){
      const r=this.rmax*s;
      if(p<0.5){fillCircle(this.x,this.y,r*1.4,P.wht);fillCircle(this.x,this.y,r*0.7,c1);}
      else {fillCircle(this.x,this.y,r*0.6,c2);}
    }
    else if(this.kind==='ring'){
      const r=this.rmax*s;const prevA=ctx.globalAlpha;
      ctx.globalAlpha=1-p*0.7;
      const steps=Math.ceil(r*8);
      for(let i=0;i<steps;i++){
        const a=(i/steps)*Math.PI*2;
        ctx.fillStyle = i%4===0 ? c1 : c2;
        ctx.fillRect(Math.round(this.x+Math.cos(a)*r),Math.round(this.y+Math.sin(a)*r),1,1);
      }
      if(r>10){
        const r2=r*0.6;const steps2=Math.ceil(r2*6);
        for(let i=0;i<steps2;i++){
          const a=(i/steps2)*Math.PI*2;
          ctx.fillStyle=c3;
          ctx.fillRect(Math.round(this.x+Math.cos(a)*r2),Math.round(this.y+Math.sin(a)*r2),1,1);
        }
      }
      ctx.globalAlpha=prevA;
    }
    else if(this.kind==='diamond'){
      const r=this.rmax*s;
      ctx.fillStyle=c1;
      for(let dy=-r;dy<=r;dy++){const w=r-Math.abs(dy);if(w>0)ctx.fillRect(Math.round(this.x-w),Math.round(this.y+dy),Math.round(w*2),1);}
      ctx.fillStyle=c2;
      for(let dy=-r*0.6;dy<=r*0.6;dy++){const w=r*0.6-Math.abs(dy);if(w>0)ctx.fillRect(Math.round(this.x-w),Math.round(this.y+dy),Math.round(w*2),1);}
      ctx.fillStyle=P.wht;const rr=r*0.2;
      for(let dy=-rr;dy<=rr;dy++){const w=rr-Math.abs(dy);if(w>0)ctx.fillRect(Math.round(this.x-w),Math.round(this.y+dy),Math.round(w*2),1);}
    }
    else if(this.kind==='vcol'){
      const halfH=this.rmax*s,halfW=8;
      const x0=Math.round(this.x-halfW),y0=Math.round(this.y-halfH);
      ctx.fillStyle=c1;ctx.fillRect(x0,y0,halfW*2,halfH*2);
      ctx.fillStyle=c2;ctx.fillRect(x0+2,y0+3,halfW*2-4,Math.max(0,halfH*2-6));
      ctx.fillStyle=c3;ctx.fillRect(x0+4,y0+6,halfW*2-8,Math.max(0,halfH*2-12));
      if(s>0.3){ctx.fillStyle=P.wht;ctx.fillRect(Math.round(this.x)-1,y0+8,2,Math.max(0,halfH*2-16));}
    }
    else if(this.kind==='hcol'){
      const halfW=this.rmax*s,halfH=8;
      const x0=Math.round(this.x-halfW),y0=Math.round(this.y-halfH);
      ctx.fillStyle=c1;ctx.fillRect(x0,y0,halfW*2,halfH*2);
      ctx.fillStyle=c2;ctx.fillRect(x0+3,y0+2,Math.max(0,halfW*2-6),halfH*2-4);
      ctx.fillStyle=c3;ctx.fillRect(x0+6,y0+4,Math.max(0,halfW*2-12),halfH*2-8);
      if(s>0.3){ctx.fillStyle=P.wht;ctx.fillRect(x0+8,Math.round(this.y)-1,Math.max(0,halfW*2-16),2);}
    }
    else if(this.kind==='burst'){
      const r=this.rmax*s;const petals=8;
      for(let i=0;i<petals;i++){
        const a=(i/petals)*Math.PI*2;
        const ex=this.x+Math.cos(a)*r,ey=this.y+Math.sin(a)*r;
        fillCircle(ex,ey,r*0.22,i%2===0?c1:c2);
      }
      fillCircle(this.x,this.y,r*0.5,c3);
      fillCircle(this.x,this.y,r*0.2,P.wht);
    }
    else if(this.kind==='xcross'){
      const r=this.rmax*s*0.8;
      for(const [ax,ay] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        for(let i=0;i<r;i+=1){
          ctx.fillStyle=i<r*0.5?c1:c2;
          ctx.fillRect(Math.round(this.x+ax*i)-2,Math.round(this.y+ay*i)-2,5,5);
        }
      }
      fillCircle(this.x,this.y,r*0.4,c3);
      fillCircle(this.x,this.y,r*0.18,P.wht);
    }
    else if(this.kind==='cross'){
      const r=this.rmax*s;const arms=[[0,-1],[0,1],[-1,0],[1,0]];
      for(const [ax,ay] of arms){
        for(let i=0;i<r;i++){
          ctx.fillStyle=i<r*0.5?c1:c2;
          ctx.fillRect(Math.round(this.x+ax*i)-3,Math.round(this.y+ay*i)-3,6,6);
        }
      }
      fillCircle(this.x,this.y,r*0.45,c3);
      fillCircle(this.x,this.y,r*0.2,P.wht);
    }
    else if(this.kind==='nova'){
      const r=this.rmax*s;
      if(p<0.1)fillCircle(this.x,this.y,r*1.2,P.wht);
      fillCircle(this.x,this.y,r,c1);
      fillCircle(this.x,this.y,r*0.7,c2);
      fillCircle(this.x,this.y,r*0.4,c3);
      fillCircle(this.x,this.y,r*0.15,P.wht);
      const rr=r*1.3;const prevA=ctx.globalAlpha;
      ctx.globalAlpha=1-p;
      const steps=Math.ceil(rr*8);
      for(let i=0;i<steps;i++){
        const a=(i/steps)*Math.PI*2;
        ctx.fillStyle=c1;
        ctx.fillRect(Math.round(this.x+Math.cos(a)*rr),Math.round(this.y+Math.sin(a)*rr),1,1);
      }
      ctx.globalAlpha=prevA;
    }
    else if(this.kind==='mushroom'){
      const growT = Math.min(1, p * 1.8);
      const fadeT = Math.max(0, (p - 0.55) / 0.45);
      const alpha = 1 - fadeT;
      const stemH = this.rmax * 2.4 * growT;
      const capR = this.rmax * 0.9 * growT;
      const stemW = 10 * (0.6 + growT * 0.4);
      const capX = this.x, capY = this.y - stemH * 0.7;
      const mc = this.mushroomColors;
      const prevA = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = mc[0];
      ctx.fillRect(Math.round(this.x - stemW/2), Math.round(this.y - stemH), Math.round(stemW), Math.round(stemH + 2));
      ctx.fillStyle = mc[1];
      ctx.fillRect(Math.round(this.x - stemW/2 + 2), Math.round(this.y - stemH + 2), Math.round(stemW - 4), Math.round(stemH));
      ctx.fillStyle = mc[2];
      ctx.fillRect(Math.round(this.x - stemW/2 + 4), Math.round(this.y - stemH + 4), Math.round(stemW - 8), Math.round(stemH - 2));
      fillCircle(capX, capY, capR, mc[0]);
      fillCircle(capX, capY, capR * 0.82, mc[1]);
      fillCircle(capX, capY, capR * 0.60, mc[2]);
      fillCircle(capX, capY, capR * 0.38, mc[3]);
      fillCircle(capX, capY, capR * 0.15, mc[4]);
      for (let i = 0; i < 6; i++){
        const a = (i/6) * Math.PI * 2 + p * 2;
        const bx = capX + Math.cos(a) * capR * 0.72;
        const by = capY + Math.sin(a) * capR * 0.72;
        fillCircle(bx, by, capR * 0.28, mc[1]);
      }
      ctx.globalAlpha = prevA;
    }
  }
}

const COMBO_TIERS = [
  { min: 1,   name: '',          col: P.wht, big: false },
  { min: 3,   name: 'CHAIN',     col: P.yel, big: false },
  { min: 5,   name: 'RAMPAGE',   col: P.org, big: true  },
  { min: 8,   name: 'FRENZY',    col: P.mag, big: true  },
  { min: 12,  name: 'OVERDRIVE', col: P.pnk, big: true  },
];
function getComboTier(c){
  let t = COMBO_TIERS[0];
  for(const tier of COMBO_TIERS) if (c >= tier.min) t = tier;
  return t;
}
function comboTimerMax(c){ return Math.min(2.8, 1.8 + c * 0.06); }
