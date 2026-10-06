'use strict';
// Enemy types
const MISSILE_SPEED = 1.15;      // every falling missile is this much faster than its listed speed
const FLYER_SHARE = 0.6;        // share of spawn events that are horizontal flyers (fliers, bombers, gunners, carriers)
const TURRET_REBUILD = 16;      // seconds for a destroyed turret to come back on its own
const MISSILE_BOOST = 0.35;     // falling missiles end their fall this much faster than they start
const WIND_DRIFT = 1.1;         // px/s of sideways drift per unit of wind
const SHIELD_PATTERN = [[1, 1.5], [0, 0.85], [1, 0.6], [0, 0.85]];   // [shield up?, seconds]
const CHUTE_SLOW = 11;
const SHIP_SPEED = 1.725;        // ships (fliers, smart ships and platforms) move this much faster than their base speed
const WIND_BOTTOM = 2.5;        // wind strength on the bottom screen, relative to the top
const BOSS_TEMPO = 1.5;         // bosses attack this much faster
const BOSS_MISSILE = 1.15;      // and their missiles fall this much faster
const BOSS_DROP = 62;           // bosses hover this far lower, in the cloud band          // descent speed under the canopy
// =====================================================================
//  ENEMY TYPES
// =====================================================================
const ETYPES={
  ipbm:    { spr:'ipbm',    vy:20, vx:8,   homing:0.70, death:'blast',    r:20, pts:25,  trailCol:P.red,  trailDim:P.dred },
  smart:   { spr:'smart',   vy:16, vx:20,  homing:0.95, death:'smartkill',r:26, pts:50,  trailCol:P.lblu, trailDim:P.dblu, dodge:true, fallDrops:[0.3,0.62], lowChance:0.55 },
  scout:   { spr:'scout',   vy:0,  vx:60,  homing:0,    death:'xblast',    r:14, pts:60,  trailCol:P.grn,  trailDim:P.dgrn, passing:true, drops:[0.3,0.7], lowChance:0.6 },
  bomber:  { spr:'bomber',  vy:0,  vx:30,  homing:0,    death:'flak',    r:24, pts:100, trailCol:P.gry,  trailDim:P.blk,  passing:true, drops:[0.35,0.5,0.65], lowChance:0.6 },
  gunner:  { spr:'gunner',  vy:0,  vx:24,  homing:0,    death:'burst',    r:22, pts:150, trailCol:P.pnk,  trailDim:P.dmag, passing:true, drops:[0.25,0.4,0.55,0.7,0.85], lowChance:0.6 },
  carrier: { spr:'carrier', vy:0,  vx:20,  homing:0,    death:'nova',     r:40, pts:250, trailCol:P.lpur, trailDim:P.dpur, passing:true, drops:[0.28,0.42,0.56,0.70], dropsHeavy:true, lowChance:0.6 },
  bandit:  { spr:'bandit',  vy:0,  vx:80,  homing:0,    death:'bandit',   r:30, pts:2000,trailCol:P.mag,  trailDim:P.dmag, passing:true, drops:[], lowChance:0.6, noShipBoost:true },
  splitter:{ spr:'splitter',vy:22, vx:4,   homing:0.55, death:'split',    r:18, pts:40,  trailCol:P.grn,  trailDim:P.dgrn },
  shrapnel:{ spr:'shrapnel',vy:24, vx:6,   homing:0.55, death:'shrapnel', r:16, pts:40,  trailCol:P.mag,  trailDim:P.dmag },
  icbm:    { spr:'icbm',    vy:21, vx:3,   homing:0.85, death:'mirv',     r:24, pts:75,  trailCol:P.org,  trailDim:P.dorg },
  heavy:   { spr:'heavy',   vy:19, vx:0,   homing:0.75, death:'heavy',    r:34, pts:60,  trailCol:P.yel,  trailDim:P.dolk },
  colbomb: { spr:'colbomb', vy:20, vx:4,   homing:0.65, death:'vcol',     r:70, pts:120, trailCol:P.pur,  trailDim:P.dpur },
  rowbomb: { spr:'rowbomb', vy:19, vx:6,   homing:0.65, death:'hcol',     r:80, pts:120, trailCol:P.lmag, trailDim:P.dmag },
  multi:   { spr:'multi',   vy:22, vx:0,   homing:0.75, death:'multi',    r:14, pts:90,  trailCol:P.pnk,  trailDim:P.dmag },
  midsplit:{ spr:'midsplit',vy:24, vx:0,   homing:0.70, death:'midkill',  r:20, pts:70,  trailCol:P.tan,  trailDim:P.dorg, splitAt:0.45, splitCount:3 },
  mini:    { spr:'mini',    vy:30, vx:12,  homing:0.35, death:'pop',      r:12, pts:15,  trailCol:P.lgrn, trailDim:P.dgrn },
  heavybomb:{ spr:'heavybomb', vy:32, vx:0, homing:0, death:'bigbang', r:55, pts:30, trailCol:P.yel, trailDim:P.dorg },
  meteor:  { spr:'meteor',  vy:55, vx:0,   homing:0,    death:'flash',    r:10, pts:20,  trailCol:P.wht,  trailDim:P.gry },
  lava:    { spr:'lava',    vy:0,  vx:0,   homing:0,    death:'blast',    r:16, pts:45,  trailCol:P.yel,  trailDim:P.dorg, ay:95 },
  shard:   { spr:'shard',   vy:0,  vx:0,   homing:0,    death:'flash',    r:11, pts:30,  trailCol:P.wht,  trailDim:P.lblu, ay:72 },
  // Satellite: rare and very fast; the one that carries a gallery poster
  satellite:{ spr:'satellite', vy:0, vx:150, homing:0, death:'sat', r:18, pts:1500, trailCol:P.yel, trailDim:P.org, passing:true, noShipBoost:true, wide:true, bob:9 },
  // Aegis: an ordinary missile in a shield that pulses on the platforms' timing; shoot it while the shield is down
  aegis:   { spr:'aegis',   vy:21, vx:6,   homing:0.7,  death:'blast',    r:20, pts:140, trailCol:P.lblu, trailDim:P.dblu, shield:true, hp:1, shieldR:[7, 8], noCluster:true },
  // Parachute: drops fast above the clouds, then slows under a canopy and splits into three missiles
  chute:   { spr:'chute',   vy:72, vx:0,   homing:0,    death:'blast',    r:18, pts:90,  trailCol:P.lmag, trailDim:P.dmag, noAccel:true, noCluster:true },
  // Orbital platform: rides in below the clouds behind a pulsing shield and launches missiles
  platform:{ spr:'platform',vy:0,  vx:15,  homing:0,    death:'platform', r:26, pts:400, trailCol:P.lpur, trailDim:P.dpur, passing:true, shield:true, hp:2, lane:true, wide:true, launch:true, shieldR:[12, 8] },
  boulder: { spr:'boulder', vy:24, vx:0,   homing:0,    death:'boulder',  r:20, pts:80,  trailCol:P.gry,  trailDim:P.blk },
};
// How much faster than its listed speed an enemy moves: ships have their own boost, missiles theirs
const speedOf = T => (T.passing || T.dodge) ? (T.noShipBoost ? 1 : SHIP_SPEED) : (T.noAccel || T.ay ? 1 : MISSILE_SPEED);
