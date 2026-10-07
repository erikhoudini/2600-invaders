'use strict';
// The Xtari look, sprite side. See docs/xtari-look.md for the rules these follow.
//
// Sprites are drawn as character art. Each character is one pixel in a palette colour, '.' is empty.
// Every moving thing has two frames (flame, thruster or wing), swapped at 7-12 frames a second, like
// a 2600 game that redraws a player object every other frame. Missiles fall nose-down with the flame
// above them; ships are left-right symmetric so they never need to be flipped.
const PCH = {
  w: P.wht, g: P.gry, y: P.yel, Y: P.olk, o: P.ora, O: P.org, r: P.rrd, R: P.dred, p: P.pnk,
  m: P.mag, M: P.lmag, u: P.lpur, U: P.pur, b: P.lblu, B: P.blu, n: P.dblu, e: P.lgrn, E: P.grn,
  t: P.tan, d: P.dolk, k: P.blk, P: P.dpur, q: P.dmag,
};
function rowsOf(art, over){ return art.map((r, i) => (over && over[i] !== undefined) ? over[i] : r); }
// mk(art, over, fps): over maps row index to the replacement row of the second frame
function mk(art, over, fps){
  const frame = a => ({
    data: a.map(r => Array.from(r, c => c === '.' ? 0 : 1)),
    px: a.map(r => Array.from(r, c => c === '.' ? null : PCH[c])),
  });
  const f = [frame(art)];
  if (over) f.push(frame(rowsOf(art, over)));
  return { w: art[0].length, h: art.length, col: PCH[art.join('').replace(/\./g, '')[0]] || P.wht, data: f[0].data, frames: f, fps: fps || 9 };
}
Object.assign(SPR, {
  // ---- falling things: nose down, flame above --------------------------------------------
  ipbm:     mk(['.y.', '.o.', 'rRr', '.r.', '.w.', '.r.', '.R.'], { 0: 'o.o', 1: '.y.' }, 12),
  icbm:     mk(['.y.', '.o.', 'OtO', '.O.', '.w.', 'OtO', '.O.', '.O.', '.R.'], { 0: 'o.o', 1: '.y.' }, 12),
  heavy:    mk(['.yyy.', '.ooo.', 'ttttt', 'tYYYt', 'ttttt', '.tYt.', '..t..'], { 0: '.oyo.', 1: '.yoy.' }, 10),
  colbomb:  mk(['.y.', '.o.', 'UuU', '.U.', '.U.', '.U.', 'UuU', '.U.', '.P.'], { 0: 'o.o', 1: '.y.' }, 12),
  rowbomb:  mk(['..o.y.o..', 'MMMMMMMMM', '..M.M.M..'], { 0: '..y.o.y..' }, 10),
  mini:     mk(['.e.', 'eEe', '.E.'], { 0: '.y.' }, 14),
  multi:    mk(['..y..', '..p..', 'ppwpp', '..p..', '..q..'], { 0: '..o..' }, 12),
  midsplit: mk(['.o.o.', 'ttttt', '.tkt.', 'tt.tt', '.t.t.'], { 0: 'o.o.o' }, 10),
  splitter: mk(['E...E', '.E.E.', '..e..', '.E.E.', 'E...E'], { 0: 'e...e', 4: 'e...e' }, 6),
  shrapnel: mk(['m.m.m', '.mqm.', 'm.w.m', '.mqm.', 'm.m.m'], { 0: '.m.m.', 4: '.m.m.' }, 6),
  heavybomb:mk(['..y..', '.ooo.', '.OOO.', 'OOtOO', 'OOtOO', 'ROtOR', '.ROR.', '..R..'], { 0: '.y.y.' }, 10),
  chute:    mk(['.M.', 'MwM', 'M.M'], { 1: 'MMM' }, 5),
  aegis:    mk(['.b.', 'bwb', 'bBb', '.b.', 'b.b', '.n.'], { 0: 'b.b' }, 8),
  meteor:   mk(['ww.', 'wgg', '.gg'], { 0: 'gw.' }, 14),
  lava:     mk(['.ooo.', 'oyyyo', 'oyyyo', 'oyyyo', '.ooo.'], { 0: '.yoy.', 4: '.oyo.' }, 8),
  shard:    mk(['.b.', 'bwb', 'bwb', 'bBb', '.b.'], { 1: 'bbb' }, 8),
  boulder:  mk(['.ggggg.', 'ggwwggg', 'gggggdg', 'gdgggdg', '.gggggg', '..ggg..'], null),
  // ---- new: weaver, a missile that snakes, and phantom, one that blinks to the beat --------
  weaver:   mk(['.y.y.', '..o..', '.eEe.', '..E..', '.eEe.', '..e..'], { 0: 'y...y', 2: '..E..', 3: '.eEe.', 4: '..E..' }, 8),
  phantom:  mk(['.b.b.', '.bbb.', 'bkbkb', 'bbbbb', 'bwbwb', '.b.b.'], { 0: '..b..', 5: 'b...b' }, 5),
  // ---- ships: symmetric, engine glow on the bottom row ----------------------------------------
  smart:    mk(['b...b', 'bbwbb', '.bBb.', '..n..', 'y...y'], { 0: '.b.b.', 4: '.o.o.' }, 9),
  scout:    mk(['...e...', '.eEEEe.', 'EEgEgEE', 'y.....y'], { 3: 'o.....o' }, 9),
  bomber:   mk(['...gwg...', '.ggggggg.', 'gkgkgkgkg', 'y.......y'], { 3: 'o.......o' }, 8),
  gunner:   mk(['...pwp...', '.ppppppp.', 'ppkpmpkpp', 'p.ppppp.p', 'y.......y'], { 4: 'o.......o' }, 8),
  carrier:  mk(['....uuu....', '..uuuuuuu..', 'uuUuuwuuUuu', 'uuuuuuuuuuu', '.UkUkUkUkU.', 'y.........y'], { 5: 'o.........o' }, 8),
  bandit:   mk(['...y...', '..mym..', 'mmmwmmm', '..mym..', '...y...'], { 0: '...w...', 4: '...w...' }, 14),
  platform: mk(['...UUUUUUU...', '.uuuuuuuuuuu.', 'uukuuUuUuukuu', '.UuuuuuuuuuU.', '..U...U...U..', '.y...y...y...'], { 5: '..y...y...y..' }, 6),
  satellite:mk(['......y......', '......w......', 'bbbb.yyy.bbbb', 'bBbbbyyybbbBb', 'bbbb.yyy.bbbb', '.....gyg.....', '......y......'], { 2: 'BBBB.yyy.BBBB', 4: 'BBBB.yyy.BBBB' }, 5),
  sapper:   mk(['....ywy....', '..ggggggg..', 'ggkgkgkgkgg', '.uYuYuYuYu.', 'y.........y'], { 3: '.YuYuYuYuY.', 4: 'o.........o' }, 7),
  bulwark:  mk(['gyg.............gyg', 'gggykykykykykykyggg', 'gggoooooooooooooggg', '.g...............g.'], { 0: 'gog.............gog', 1: 'gggkykykykykykykggg' }, 6),
  diver:    mk(['o.....o', '.rr.rr.', '.rRwRr.', '..rwr..', '..RwR..', '...r...'], { 0: '.o...o.' }, 12),
});
// Dying things break into their own pixels
function shatterSprite(e, strength){
  const spr = SPR[ETYPES[e.type].spr]; if (!spr) return;
  const fr = spr.frames[0], cx = e.x - spr.w / 2, cy = e.y - spr.h / 2;
  const every = spr.w * spr.h > 30 ? 2 : 1;
  let n = 0;
  for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++){
    const c = fr.px[j][i]; if (!c || (n++ % every)) continue;
    const dx = (i + 0.5 - spr.w / 2), dy = (j + 0.5 - spr.h / 2);
    spawnParticle(cx + i, cy + j, dx * 16 * strength + rnd(-14, 14), dy * 12 * strength + rnd(-34, 6), rnd(0.35, 0.8), c, 1);
  }
}
