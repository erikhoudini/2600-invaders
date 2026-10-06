'use strict';
// Achievements
// =====================================================================
//  ACHIEVEMENTS
// =====================================================================
const ACHIEVEMENTS = [
  { id:'first',   name:'FIRST BLOOD',    desc:'Destroy 1 missile',          test:(s)=>s.totalKills>=1 },
  { id:'c5',      name:'CHAIN X5',       desc:'Reach a 5x chain',           test:(s)=>s.bestChain>=5,  reward:['shot',1] },
  { id:'c8',      name:'FRENZY X8',      desc:'Reach an 8x chain',          test:(s)=>s.bestChain>=8,  reward:['reticle',3] },
  { id:'c12',     name:'OVERDRIVE',      desc:'Reach a 12x chain',          test:(s)=>s.bestChain>=12, reward:['shot',6] },
  { id:'c20',     name:'RUNAWAY',        desc:'Reach a 20x chain',          test:(s)=>s.bestChain>=20 },
  { id:'c30',     name:'UNSTOPPABLE',    desc:'Reach a 30x chain',          test:(s)=>s.bestChain>=30 },
  { id:'r2',      name:'TITAN BOUND',    desc:'Reach Titan',                test:(s)=>s.bestWave>=9,   reward:['reticle',4] },
  { id:'r3',      name:'TWO-TONE',       desc:'Reach Iapetus',                   test:(s)=>s.bestWave>=17 },
  { id:'r4',      name:'GEYSER BOUND',   desc:'Reach Enceladus',            test:(s)=>s.bestWave>=25 },
  { id:'r5',      name:'LAST MOON',      desc:'Reach Mimas',               test:(s)=>s.bestWave>=33 },
  { id:'t120',    name:'SURVIVOR',       desc:'Survive 2:00 in Endless',    test:(s)=>s.bestTime>=120 },
  { id:'t300',    name:'ENDURER',        desc:'Survive 5:00 in Endless',    test:(s)=>s.bestTime>=300, reward:['city',3] },
  { id:'t600',    name:'MARATHON',       desc:'Survive 10:00 in Endless',   test:(s)=>s.bestTime>=600 },
  { id:'k100',    name:'CENTURION',      desc:'100 lifetime kills',         test:(s)=>s.totalKills>=100,  reward:['shot',2] },
  { id:'k500',    name:'ACE',            desc:'500 lifetime kills',         test:(s)=>s.totalKills>=500,  reward:['reticle',5] },
  { id:'k1000',   name:'LEGEND',         desc:'1000 lifetime kills',        test:(s)=>s.totalKills>=1000 },
  { id:'k2500',   name:'EXTERMINATOR',   desc:'2500 lifetime kills',        test:(s)=>s.totalKills>=2500 },
  { id:'acc50',   name:'SHARPSHOOTER',   desc:'50% accuracy (100+ shots)',  test:(s)=>s.totalShots>=100 && s.totalKills/s.totalShots>=0.5, reward:['reticle',6] },
  { id:'acc65',   name:'DEADEYE',        desc:'65% accuracy (300+ shots)',  test:(s)=>s.totalShots>=300 && s.totalKills/s.totalShots>=0.65 },
  { id:'perfect', name:'UNTOUCHABLE',    desc:'Perfect wave (all cities)',  test:(s)=>s.perfectWaves>=1,  reward:['shot',3] },
  { id:'s10k',    name:'ACE PILOT',      desc:'Score 10,000 in one game',   test:(s)=>Math.max(s.bestScoreWave, s.bestScoreEndless)>=10000, reward:['city',1] },
  { id:'s50k',    name:'HIGH ROLLER',    desc:'Score 50,000 in one game',   test:(s)=>Math.max(s.bestScoreWave, s.bestScoreEndless)>=50000, reward:['shot',7] },
  { id:'s250k',   name:'WARLORD',        desc:'Score 250,000 in one game',  test:(s)=>Math.max(s.bestScoreWave, s.bestScoreEndless)>=250000 },
  { id:'b1',      name:'WARDEN DOWN',    desc:'Defeat the Warden',          test:(s,c)=>c.bosses[0]>0, reward:['shot',4] },
  { id:'b2',      name:'LEVIATHAN SLAIN',desc:'Defeat the Leviathan',       test:(s,c)=>c.bosses[1]>0, reward:['blast',1] },
  { id:'b3',      name:'CYCLOPS BLINDED',desc:'Defeat the Cyclops',         test:(s,c)=>c.bosses[2]>0, reward:['blast',2] },
  { id:'b4',      name:'HYDRA SEVERED',  desc:'Defeat the Hydra',           test:(s,c)=>c.bosses[3]>0, reward:['blast',3] },
  { id:'b5',      name:'ARBITER FALLS',  desc:'Defeat the Arbiter',         test:(s,c)=>c.bosses[4]>0, reward:['blast',4] },
  { id:'bh',      name:'BOSS HUNTER',    desc:'Defeat all five bosses',     test:(s,c)=>c.bosses.every(v=>v>0), reward:['reticle',7] },
  { id:'w3',      name:'WORLD HOPPER',   desc:'Clear three worlds',         test:(s,c)=>c.clears.filter(v=>v>0).length>=3, reward:['blast',5] },
  { id:'cc',      name:'FULL CAMPAIGN',  desc:'Clear all five worlds',      test:(s,c)=>c.clears.every(v=>v>0), reward:['city',4] },
  { id:'cr10',    name:'ORBIT RAT',      desc:'Collect 10 orbitals',          test:(s)=>s.cratesCollected>=10, reward:['shot',5] },
  { id:'cr50',    name:'HOARDER',        desc:'Collect 50 orbitals',          test:(s)=>s.cratesCollected>=50, reward:['city',5] },
  { id:'fb',      name:'NO LOSSES',      desc:'Beat a boss with every city',test:(s,c)=>c.flawBoss>=1 },
  { id:'fw',      name:'IRON CITY',      desc:'Clear a world, no city lost',test:(s,c)=>c.flawWorld>=1, reward:['city',2] },
  { id:'mod',     name:'MODDED',         desc:'Clear a world with a mod on',test:(s,c)=>c.modWins>=1 },
];
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
