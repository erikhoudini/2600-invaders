'use strict';
// Boot and main loop
// =====================================================================
//  BOOT
// =====================================================================
applyLoadout();
currentEnv = ENV.europa;
createWorldCanvas();
createCloudLayers(currentEnv);
preRenderSaturn(ENV.europa);
activateSaturn(ENV.europa);
preRenderStars();
resetGame();
initSnow();
menuState = 'press';

const autoPause = () => { if (menuState === 'game' && !paused) setPaused(true); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autoPause();
  else { last = performance.now(); keepAwake(); }
});
addEventListener('pagehide', autoPause);

let last=performance.now();
function loop(now){
  let dt=(now-last)/1000;last=now;
  // Long frames are played out in small steps, so the game keeps its speed below 20 fps
  // (and a hidden tab doesn't fast-forward the game when it comes back)
  let rem = Math.min(dt, 0.25);
  while (rem > 1e-4){
    const step = Math.min(rem, 0.05);
    update(step);
    rem -= step;
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
