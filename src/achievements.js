'use strict';
// Achievements
// =====================================================================
//  ACHIEVEMENTS
// =====================================================================
// Rewards climb in difficulty: the first few come within a campaign world or two, the last ones
// need long Endless runs, flawless worlds, no-loss boss fights and Boss Rush.
const bestScore = s => Math.max(s.bestScoreWave, s.bestScoreEndless);
const ACHIEVEMENTS = [
  // -- chains
  { id:'first',   name:'FIRST BLOOD',    desc:'Destroy 1 missile',           test:(s)=>s.totalKills>=1 },
  { id:'c10',     name:'CHAIN X10',      desc:'Reach a 10x chain',           test:(s)=>s.bestChain>=10, reward:['reticle',3] },
  { id:'c16',     name:'FRENZY X16',     desc:'Reach a 16x chain',           test:(s)=>s.bestChain>=16, reward:['shot',2] },
  { id:'c25',     name:'OVERDRIVE X25',  desc:'Reach a 25x chain',           test:(s)=>s.bestChain>=25 },
  { id:'c40',     name:'RUNAWAY X40',    desc:'Reach a 40x chain',           test:(s)=>s.bestChain>=40, reward:['shot',6] },
  { id:'c60',     name:'UNSTOPPABLE X60',desc:'Reach a 60x chain',           test:(s)=>s.bestChain>=60 },
  // -- campaign progress
  { id:'r2',      name:'TITAN BOUND',    desc:'Reach Titan',                 test:(s)=>s.bestWave>=9 },
  { id:'r3',      name:'TWO-TONE',       desc:'Reach Iapetus',               test:(s)=>s.bestWave>=17, reward:['reticle',4] },
  { id:'r4',      name:'GEYSER BOUND',   desc:'Reach Enceladus',             test:(s)=>s.bestWave>=25 },
  { id:'r5',      name:'LAST MOON',      desc:'Reach Mimas',                 test:(s)=>s.bestWave>=33 },
  { id:'w3',      name:'WORLD HOPPER',   desc:'Clear three worlds',          test:(s,c)=>c.clears.filter(v=>v>0).length>=3 },
  { id:'cc',      name:'FULL CAMPAIGN',  desc:'Clear all five worlds',       test:(s,c)=>c.clears.every(v=>v>0), reward:['city',4] },
  { id:'fw',      name:'IRON CITY',      desc:'Clear a world, no city lost', test:(s,c)=>c.flawWorld>=1, reward:['city',2] },
  { id:'fw3',     name:'IRON UNION',     desc:'Clear 3 worlds, no losses',test:(s,c)=>c.flawWorld>=3, reward:['reticle',7] },
  { id:'mod',     name:'MODDED',         desc:'Clear a world with a mod on', test:(s,c)=>c.modWins>=1 },
  // -- endless
  { id:'t180',    name:'SURVIVOR',       desc:'Survive 3:00 in Endless',     test:(s)=>s.bestTime>=180 },
  { id:'t360',    name:'ENDURER',        desc:'Survive 6:00 in Endless',     test:(s)=>s.bestTime>=360, reward:['city',3] },
  { id:'t720',    name:'MARATHON',       desc:'Survive 12:00 in Endless',    test:(s)=>s.bestTime>=720, reward:['reticle',5] },
  { id:'t1200',   name:'LAST LIGHT',     desc:'Survive 20:00 in Endless',    test:(s)=>s.bestTime>=1200 },
  // -- kills
  { id:'k400',    name:'VETERAN',        desc:'400 lifetime kills',          test:(s)=>s.totalKills>=400,   reward:['shot',1] },
  { id:'k1500',   name:'ACE',            desc:'1500 lifetime kills',         test:(s)=>s.totalKills>=1500 },
  { id:'k2500',   name:'EXTERMINATOR',   desc:'2500 lifetime kills',         test:(s)=>s.totalKills>=2500,  reward:['shot',4] },
  { id:'k6000',   name:'LEGEND',         desc:'6000 lifetime kills',         test:(s)=>s.totalKills>=6000 },
  { id:'k15000',  name:'EXTINCTION',     desc:'15000 lifetime kills',        test:(s)=>s.totalKills>=15000 },
  // -- accuracy
  { id:'acc60',   name:'SHARPSHOOTER',   desc:'60% accuracy (300+ shots)',   test:(s)=>s.totalShots>=300 && s.totalKills/s.totalShots>=0.6, reward:['reticle',6] },
  { id:'acc75',   name:'DEADEYE',        desc:'75% accuracy (800+ shots)',   test:(s)=>s.totalShots>=800 && s.totalKills/s.totalShots>=0.75, reward:['shot',5] },
  // -- perfect waves
  { id:'p5',      name:'UNTOUCHABLE',    desc:'5 perfect waves',             test:(s)=>s.perfectWaves>=5,  reward:['shot',3] },
  { id:'p25',     name:'FLAWLESS',       desc:'25 perfect waves',            test:(s)=>s.perfectWaves>=25 },
  // -- score
  { id:'s25k',    name:'ACE PILOT',      desc:'Score 25,000 in one game',    test:(s)=>bestScore(s)>=25000,   reward:['city',1] },
  { id:'s100k',   name:'HIGH ROLLER',    desc:'Score 100,000 in one game',   test:(s)=>bestScore(s)>=100000 },
  { id:'s400k',   name:'WARLORD',        desc:'Score 400,000 in one game',   test:(s)=>bestScore(s)>=400000,  reward:['shot',7] },
  { id:'s1m',     name:'POLITBURO',      desc:'Score 1,000,000 in one game', test:(s)=>bestScore(s)>=1000000 },
  // -- bosses
  { id:'b1',      name:'WARDEN DOWN',    desc:'Defeat the Warden',           test:(s,c)=>c.bosses[0]>0, reward:['blast',1] },
  { id:'b2',      name:'LEVIATHAN SLAIN',desc:'Defeat the Leviathan',        test:(s,c)=>c.bosses[1]>0, reward:['blast',2] },
  { id:'b3',      name:'CYCLOPS BLINDED',desc:'Defeat the Cyclops',          test:(s,c)=>c.bosses[2]>0 },
  { id:'b4',      name:'HYDRA SEVERED',  desc:'Defeat the Hydra',            test:(s,c)=>c.bosses[3]>0 },
  { id:'b5',      name:'ARBITER FALLS',  desc:'Defeat the Arbiter',          test:(s,c)=>c.bosses[4]>0 },
  { id:'bh',      name:'BOSS HUNTER',    desc:'Defeat all five bosses',      test:(s,c)=>c.bosses.every(v=>v>0), reward:['blast',3] },
  { id:'fb',      name:'NO LOSSES',      desc:'Beat a boss with every city', test:(s,c)=>c.flawBoss>=1 },
  { id:'fb3',     name:'CLEAN KILLS',    desc:'Beat 3 bosses, no losses', test:(s,c)=>c.flawBoss>=3, reward:['blast',4] },
  { id:'rush5',   name:'RUSH HOUR',      desc:'Down 5 bosses in Boss Rush',  test:(s)=>(s.bestRush||0)>=5, reward:['blast',5] },
  // -- powerups
  { id:'cr15',    name:'ORBIT RAT',      desc:'Collect 15 powerups',         test:(s)=>s.cratesCollected>=15 },
  { id:'cr60',    name:'HOARDER',        desc:'Collect 60 powerups',         test:(s)=>s.cratesCollected>=60, reward:['city',5] },
];
// Unlocks recorded under ids that no longer exist would inflate the progress count
unlockedAch = unlockedAch.filter(id => ACHIEVEMENTS.some(a => a.id === id));
const ACH_CAT_NAMES = { reticle:'RETICLE', shot:'SHOT', blast:'BLAST', city:'CITY' };

function checkAchievements(){
  const newly = [];
  for (const a of ACHIEVEMENTS){
    if (unlockedAch.includes(a.id)) continue;
    if (a.test(stats, camp)){ unlockedAch.push(a.id); newly.push(a); }
  }
  if (newly.length > 0){
    saveAch();
    sfx('unlock');
    for (const a of newly){
      pushToast('UNLOCKED: ' + a.name, P.yel);
      if (a.reward){
        const lists = { reticle:RETICLES, shot:SHOTS, blast:BLASTS, city:CITIES };
        pushToast('NEW ' + ACH_CAT_NAMES[a.reward[0]] + ': ' + lists[a.reward[0]][a.reward[1]], P.lgrn);
      }
    }
  }
}
