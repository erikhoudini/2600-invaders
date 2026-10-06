'use strict';
// Input
// =====================================================================
//  INPUT
// =====================================================================
const keys={};
addEventListener('keydown',e=>{
  audioInit();
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter','Escape'].includes(e.code))e.preventDefault();
  if(!keys[e.code])onPress(e.code);
  keys[e.code]=true;
});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;pointerDown=false;});
