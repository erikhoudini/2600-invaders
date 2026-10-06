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

let last=performance.now();
function loop(now){
  let dt=(now-last)/1000;last=now;
  if(dt>0.05)dt=0.05;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
