'use strict';
// Enemy types
// =====================================================================
//  ENEMY TYPES
// =====================================================================
const ETYPES={
  ipbm:    { spr:'ipbm',    vy:20, vx:8,   homing:0.70, death:'blast',    r:20, pts:25,  trailCol:P.red,  trailDim:P.dred },
  smart:   { spr:'smart',   vy:16, vx:20,  homing:0.95, death:'smartkill',r:26, pts:50,  trailCol:P.lblu, trailDim:P.dblu, dodge:true },
  scout:   { spr:'scout',   vy:0,  vx:60,  homing:0,    death:'xblast',    r:14, pts:60,  trailCol:P.grn,  trailDim:P.dgrn, passing:true, drops:[0.5] },
  bomber:  { spr:'bomber',  vy:0,  vx:24,  homing:0,    death:'flak',    r:24, pts:100, trailCol:P.gry,  trailDim:P.blk,  passing:true, drops:[0.35,0.5,0.65] },
  gunner:  { spr:'gunner',  vy:0,  vx:18,  homing:0,    death:'burst',    r:22, pts:150, trailCol:P.pnk,  trailDim:P.dmag, passing:true, drops:[0.25,0.4,0.55,0.7,0.85] },
  carrier: { spr:'carrier', vy:0,  vx:14,  homing:0,    death:'nova',     r:40, pts:250, trailCol:P.lpur, trailDim:P.dpur, passing:true, drops:[0.28,0.42,0.56,0.70], dropsHeavy:true },
  bandit:  { spr:'bandit',  vy:0,  vx:80,  homing:0,    death:'bandit',   r:30, pts:2000,trailCol:P.mag,  trailDim:P.dmag, passing:true, drops:[] },
  splitter:{ spr:'splitter',vy:22, vx:4,   homing:0.55, death:'split',    r:18, pts:40,  trailCol:P.grn,  trailDim:P.dgrn },
  shrapnel:{ spr:'shrapnel',vy:24, vx:6,   homing:0.55, death:'shrapnel', r:16, pts:40,  trailCol:P.mag,  trailDim:P.dmag },
  icbm:    { spr:'icbm',    vy:18, vx:3,   homing:0.85, death:'mirv',     r:24, pts:75,  trailCol:P.org,  trailDim:P.dorg },
  heavy:   { spr:'heavy',   vy:14, vx:0,   homing:0.75, death:'heavy',    r:34, pts:60,  trailCol:P.yel,  trailDim:P.dolk },
  colbomb: { spr:'colbomb', vy:16, vx:4,   homing:0.65, death:'vcol',     r:70, pts:120, trailCol:P.pur,  trailDim:P.dpur },
  rowbomb: { spr:'rowbomb', vy:14, vx:6,   homing:0.65, death:'hcol',     r:80, pts:120, trailCol:P.lmag, trailDim:P.dmag },
  multi:   { spr:'multi',   vy:22, vx:0,   homing:0.75, death:'multi',    r:14, pts:90,  trailCol:P.pnk,  trailDim:P.dmag },
  midsplit:{ spr:'midsplit',vy:24, vx:0,   homing:0.70, death:'midkill',  r:20, pts:70,  trailCol:P.tan,  trailDim:P.dorg, splitAt:0.45, splitCount:3 },
  mini:    { spr:'mini',    vy:30, vx:12,  homing:0.35, death:'pop',      r:12, pts:15,  trailCol:P.lgrn, trailDim:P.dgrn },
  heavybomb:{ spr:'heavybomb', vy:32, vx:0, homing:0, death:'bigbang', r:55, pts:30, trailCol:P.yel, trailDim:P.dorg },
  meteor:  { spr:'meteor',  vy:55, vx:0,   homing:0,    death:'flash',    r:10, pts:20,  trailCol:P.wht,  trailDim:P.gry },
  lava:    { spr:'lava',    vy:0,  vx:0,   homing:0,    death:'blast',    r:16, pts:45,  trailCol:P.yel,  trailDim:P.dorg, ay:95 },
  shard:   { spr:'shard',   vy:0,  vx:0,   homing:0,    death:'flash',    r:11, pts:30,  trailCol:P.wht,  trailDim:P.lblu, ay:72 },
  boulder: { spr:'boulder', vy:24, vx:0,   homing:0,    death:'boulder',  r:20, pts:80,  trailCol:P.gry,  trailDim:P.blk },
};
