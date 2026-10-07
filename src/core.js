'use strict';
// Canvas setup, helpers, palette and per-world environments

// Development build: every world, loadout item, mod, Boss Rush and gallery poster is unlocked from the start.
// Set to false for a release build (achievements and progress then gate things again).
const DEV_UNLOCK_ALL = true;

const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
const W = 256, SH = 192, GAP = 24, BOT = SH + GAP, H = BOT + SH;
cvs.width = W; cvs.height = H;
ctx.imageSmoothingEnabled = false;

function fit(){
  const dpr=window.devicePixelRatio||1;
  const s=Math.min(window.innerWidth/W,window.innerHeight/H);
  const sd=s*dpr, n=Math.floor(sd);
  // Whole device-pixel multiples keep pixel art even; fall back to fractional on small screens
  const use=(n>=2&&n/sd>=0.85)?n/dpr:s;
  cvs.style.width=Math.floor(W*use)+'px';cvs.style.height=Math.floor(H*use)+'px';
}
addEventListener('resize',fit);fit();

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp = (a, b, k) => a + (b - a) * k;
const rnd=(a,b)=>a+Math.random()*(b-a);
const rndi=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];

const P = {
  blk:'#000000', gry:'#909090', wht:'#dcdcdc',
  dolk:'#444400', olk:'#a0a034', yel:'#e8e85c',
  dorg:'#702800', org:'#ac783c', tan:'#dcb468',
  dred:'#880000', red:'#c05858', rrd:'#d02828', ora:'#e85a10', pnk:'#eca0a0',
  dmag:'#78005c', mag:'#b0589c', lmag:'#dc9cd0',
  dpur:'#480078', pur:'#8c58b8', lpur:'#c49cec',
  dblu:'#000088', blu:'#505cc0', lblu:'#90a4ec',
  dgrn:'#003c00', grn:'#5c9c5c', lgrn:'#a4e4a4',
};
const RAINBOW = [P.red, P.org, P.yel, P.grn, P.lblu, P.blu, P.mag];

const ENV = {
  europa: {
    id:'europa', name:'RHEA', tag:'CRATERED ICE',
    skyBands: [P.blk, P.blk, P.dblu, P.blu, P.blu, P.lblu, P.lblu],
    snowBands:[P.wht, P.lblu, P.lblu, P.blu, P.blu, P.dblu, P.dblu],
    atmoBands:[P.blk, P.blk, P.gry, P.gry, P.wht, P.wht],
    mountFar:{lit:P.blu, shd:P.dblu},
    mountNear:{lit:P.lblu, shd:P.blu},
    cloudFarDark:P.blu, cloudFarLight:P.lblu,
    cloudNearDark:P.lblu, cloudNearLight:P.wht,
    cloudOpacityFar:0.75, cloudOpacityNear:0.55, cloudDip:0.30,
    ground0:P.dblu, ground1:P.blu, ground2:P.lblu,
    planetKey:'saturn', saturnTilt:0.58, saturnScale:1.5, saturnCX:178, saturnCY:62, menuPlanet:1.4,
    domeColors:[P.blu, P.wht, P.lblu, P.blu, P.dblu], winCol:P.lblu,
    hazeColor:P.lblu, snowCol:P.wht, topFx:'none', groundFx:'ice',
    menu:{hill:P.lblu, floor:P.blu, floorH:20, deep:P.dblu, deep2:null},
    favor:[['splitter',2],['smart',3]],
  },
  titan: {
    id:'titan', name:'TITAN', tag:'METHANE SEAS',
    skyBands: [P.blk, P.blk, P.dpur, P.dorg, P.org, P.org, P.tan],
    snowBands:[P.dorg, P.org, P.org, P.tan, P.dorg, P.dorg, P.dpur],
    atmoBands:[P.blk, P.blk, P.dorg, P.dorg, P.org, P.tan],
    mountFar:{lit:P.dorg, shd:P.blk},
    mountNear:{lit:P.org, shd:P.dorg},
    cloudFarDark:P.dorg, cloudFarLight:P.org,
    cloudNearDark:P.org, cloudNearLight:P.tan,
    cloudOpacityFar:0.95, cloudOpacityNear:0.90, cloudDip:0.35,
    ground0:P.dpur, ground1:P.dblu, ground2:P.blu,
    planetKey:'saturn', saturnTilt:0.36, saturnScale:2.0, saturnCX:128, saturnCY:52, menuPlanet:1.6,
    domeColors:[P.dorg, P.tan, P.yel, P.org, P.dorg], winCol:P.yel,
    hazeColor:P.tan, snowCol:P.tan, topFx:'aurora', groundFx:'tar',
    menu:{hill:P.tan, floor:P.org, floorH:14, deep:P.dblu, deep2:P.dpur},
    favor:[['heavy',2],['bomber',3],['carrier',9]],
  },
  io: {
    id:'io', name:'IAPETUS', tag:'THE TWO-TONE MOON',
    skyBands: [P.blk, P.blk, P.dolk, P.dorg, P.gry, P.gry, P.wht],
    snowBands:[P.wht, P.gry, P.gry, P.dolk, P.dolk, P.blk, P.blk],
    atmoBands:[P.blk, P.blk, P.dolk, P.dolk, P.gry, P.wht],
    mountFar:{lit:P.gry, shd:P.dolk},
    mountNear:{lit:P.wht, shd:P.gry},
    cloudFarDark:P.dolk, cloudFarLight:P.gry,
    cloudNearDark:P.gry, cloudNearLight:P.wht,
    cloudOpacityFar:0.75, cloudOpacityNear:0.55, cloudDip:0.30,
    ground0:P.blk, ground1:P.dolk, ground2:P.gry,
    planetKey:'saturn', saturnTilt:0.44, saturnScale:1.7, saturnCX:150, saturnCY:60, menuPlanet:1.5,
    domeColors:[P.gry, P.wht, P.wht, P.gry, P.dolk], winCol:P.yel,
    hazeColor:P.gry, snowCol:P.wht, topFx:'none', groundFx:'lava',
    menu:{hill:P.gry, floor:P.dolk, floorH:14, deep:P.blk, deep2:null},
    favor:[['icbm',2],['shrapnel',3],['multi',4]],
  },
  enceladus: {
    id:'enceladus', name:'ENCELADUS', tag:'ICE GEYSERS',
    skyBands: [P.blk, P.blk, P.dgrn, P.grn, P.grn, P.lgrn, P.lgrn],
    snowBands:[P.wht, P.lgrn, P.lgrn, P.grn, P.grn, P.dgrn, P.dgrn],
    atmoBands:[P.blk, P.blk, P.dgrn, P.dgrn, P.grn, P.lgrn],
    mountFar:{lit:P.grn, shd:P.dgrn},
    mountNear:{lit:P.lgrn, shd:P.grn},
    cloudFarDark:P.grn, cloudFarLight:P.lgrn,
    cloudNearDark:P.lgrn, cloudNearLight:P.wht,
    cloudOpacityFar:0.70, cloudOpacityNear:0.50, cloudDip:0.28,
    ground0:P.dgrn, ground1:P.grn, ground2:P.lgrn,
    planetKey:'saturn', saturnTilt:0.34, saturnScale:2.2, saturnCX:150, saturnCY:58, menuPlanet:1.6,
    domeColors:[P.grn, P.wht, P.lgrn, P.grn, P.dgrn], winCol:P.lblu,
    hazeColor:P.lgrn, snowCol:P.wht, topFx:'frost', groundFx:'frost',
    menu:{hill:P.wht, floor:P.lgrn, floorH:14, deep:P.grn, deep2:P.dgrn},
    favor:[['smart',2],['scout',2],['midsplit',4],['gunner',8]],
  },
  triton: {
    id:'triton', name:'MIMAS', tag:'HERSCHEL CRATER',
    skyBands: [P.blk, P.blk, P.dpur, P.dmag, P.mag, P.lmag, P.pnk],
    snowBands:[P.pnk, P.lmag, P.lmag, P.mag, P.mag, P.dmag, P.dmag],
    atmoBands:[P.blk, P.blk, P.dpur, P.dpur, P.mag, P.lmag],
    mountFar:{lit:P.mag, shd:P.dmag},
    mountNear:{lit:P.lmag, shd:P.mag},
    cloudFarDark:P.dmag, cloudFarLight:P.mag,
    cloudNearDark:P.mag, cloudNearLight:P.lmag,
    cloudOpacityFar:0.80, cloudOpacityNear:0.60, cloudDip:0.32,
    ground0:P.dpur, ground1:P.pur, ground2:P.lpur,
    planetKey:'saturn', saturnTilt:0.46, saturnScale:1.8, saturnCX:70, saturnCY:60, menuPlanet:1.5,
    domeColors:[P.pur, P.wht, P.lpur, P.pur, P.dpur], winCol:P.yel,
    hazeColor:P.lmag, snowCol:P.lmag, topFx:'shimmer', groundFx:'nitro',
    menu:{hill:P.lmag, floor:P.mag, floorH:14, deep:P.dmag, deep2:P.dpur},
    favor:[['colbomb',2],['rowbomb',3],['gunner',4],['carrier',6]],
  },
};
const WORLDS = [ENV.europa, ENV.titan, ENV.io, ENV.enceladus, ENV.triton];
const WAVES_PER_WORLD = 8;
let currentEnv = ENV.europa;
let curWorld = 0;
