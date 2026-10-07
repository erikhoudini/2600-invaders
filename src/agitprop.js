'use strict';
// Agitprop: the voice of the game. Eighties Cold War hyperbole, with us as the good guys.
// The enemy is the capitalist aggressor; we are the people, the plan and the Motherland. All text is
// upper case, since that is all the bitmap font draws.
const SLOGANS = [
  'FOR THE MOTHERLAND', 'THE PEOPLE ARE WATCHING', 'EVERY WORKER A DEFENDER', 'LONG LIVE THE FIVE-YEAR PLAN',
  'IMPERIALISM WILL FALL', 'ONWARD, COMRADES', 'THE SKY BELONGS TO THE PEOPLE', 'PRODUCE MORE. FIRE MORE.',
  'THE PLAN DOES NOT WAIT', 'SOLIDARITY ACROSS THE MOONS', 'HISTORY IS ON OUR SIDE', 'NO LANDLORDS IN SPACE',
];
const PLAN_LINES = ['THE PLAN IS FULFILLED', 'OUTPUT EXCEEDS QUOTA', 'THE SKY IS WON, COMRADES', 'THE PEOPLE THANK YOU', 'GLORY TO THE WORKERS', 'ANOTHER VICTORY FOR LABOUR'];
const LOSS_LINES = ['THE STRUGGLE CONTINUES, COMRADE.', 'THE PEOPLE WILL REMEMBER.', 'THE REVOLUTION IS NOT OVER.', 'A SETBACK, NOT AN END.'];
const WIN_LINES = ['THE MOTHERLAND IS SAFE.', 'THE PLAN IS COMPLETE. GLORY!', 'THE WORKERS HAVE WON THE SKY.'];
// What the enemy is called when it dies
const FOES = {
  ipbm: 'IMPERIALIST MISSILE', icbm: 'WARMONGER MISSILE', heavy: 'BOURGEOIS BOMB', scout: 'CAPITALIST SPY', bomber: 'CAPITALIST BOMBER',
  gunner: 'WARMONGER GUNSHIP', carrier: 'IMPERIALIST CARRIER', smart: 'REVISIONIST DODGER', platform: 'ORBITAL WARMONGER',
  bandit: 'BOURGEOIS BANDIT', diver: 'REVANCHIST DIVER', sapper: 'IMPERIALIST SAPPER', bulwark: 'WALL OF CAPITAL', weaver: 'REVISIONIST WEAVER', phantom: 'BOURGEOIS PHANTOM',
  aegis: 'ARMOURED IMPERIALIST', chute: 'PARATROOPER OF CAPITAL', midsplit: 'SPLITTER OF WORKERS', satellite: 'SPUTNIK OF FREEDOM',
};
const slogan = i => SLOGANS[((i % SLOGANS.length) + SLOGANS.length) % SLOGANS.length];
const planLine = () => pick(PLAN_LINES);
let foeCd = 0;
// A name over a significant kill, now and then
function agitKill(e, T){
  const name = FOES[e.type]; if (!name || T.pts < 90 || foeCd > 0 || Math.random() > 0.45) return;
  foeCd = 1.4;
  popups.push({ x: clamp(e.x, 56, W - 56), y: e.y - 14, text: name + ' DOWN', t: 0, dur: 1.2, col: P.yel });
}
const planLineFor = w => PLAN_LINES[w % PLAN_LINES.length];
