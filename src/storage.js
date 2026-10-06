'use strict';
// localStorage persistence helpers
// =====================================================================
//  PERSISTENCE
// =====================================================================
const STORAGE_VERSION = 'v7';
const KEY = k => 'orbital_' + STORAGE_VERSION + '_' + k;
function safeLoad(key, fallback){
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function safeSave(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
}
