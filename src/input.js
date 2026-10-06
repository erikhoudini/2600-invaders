'use strict';
// Input
// =====================================================================
//  INPUT
// =====================================================================
const keys={};
// In the menus the keyboard follows the DS layout: X is A (confirm), Z or Backspace is B (back),
// and Q / E are the L / R shoulder buttons
const DS_KEYMAP = { KeyX: 'Enter', KeyZ: 'Escape', Backspace: 'Escape', KeyQ: 'ArrowLeft', KeyE: 'ArrowRight' };
addEventListener('keydown',e=>{
  audioInit();
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter','Escape','Backspace'].includes(e.code))e.preventDefault();
  if(!keys[e.code]){
    const inMenu = menuState !== 'game' || paused;
    onPress(inMenu ? (DS_KEYMAP[e.code] || e.code) : e.code);
  }
  keys[e.code]=true;
});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;pointerDown=false;});
