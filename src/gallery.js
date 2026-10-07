'use strict';
// Gallery: Soviet space posters, unlocked by shooting down rare, very fast satellites.
// Credits come from art/source/spaceposters.txt. The text is upper case because that is all the
// game's bitmap font draws.
const POSTERS = [
  { title: 'THE ROAD IS OPEN FOR HUMANS',                           artist: 'KONSTANTIN IVANOV',                  year: '1960',           note: '' },
  { title: 'THE FAIRYTALE BECAME TRUTH',                            artist: 'ARTIST UNKNOWN',                     year: '1961',           note: 'FEATURING YURI GAGARIN, THE FIRST MAN IN SPACE.' },
  { title: 'GLORY TO THE FIRST WOMAN COSMONAUT',                    artist: 'ARTIST UNKNOWN',                     year: '1963',           note: 'FEATURING VALENTINA TERESHKOVA, THE FIRST WOMAN IN SPACE.' },
  { title: 'TEKHNIKA MOLODEZHI',                                    artist: 'MAGAZINE COVER',                     year: 'SEPTEMBER 1964', note: 'TEKHNIKA MOLODEZHI WAS A POPULAR YOUTH SCIENCE MAGAZINE IN THE USSR.' },
  { title: 'GLORY OF THE SPACE HEROES - GLORY OF THE SOVIET PEOPLE!', artist: 'BORIS BEREZOVSKY',                 year: '1963',           note: '' },
  { title: 'IN THE NAME OF PEACE',                                  artist: 'IRAKLII TOIDZE',                     year: '1959',           note: '' },
  { title: 'THROUGH THE WORLDS AND CENTURIES',                      artist: 'MIRON LUKIANOV, VASILY OSTROVSKY',   year: 'JULY 1965',      note: '' },
  { title: 'OUR TRIUMPH IN SPACE IS A HYMN TO THE SOVIET NATION!',  artist: 'V. P. VIKTOROV',                     year: '1963',           note: '' },
  { title: 'QUALITY IS THE GUARANTEE OF PROGRESS!',                 artist: 'A. MERKUSHEV',                       year: '1980S',          note: '' },
  { title: 'AFTER FLYING AROUND THE EARTH IN MY SPACESHIP',         artist: 'ARTIST NOT LISTED',                  year: '1975',           note: 'FEATURING YURI GAGARIN, THE FIRST MAN IN SPACE.' },
  { title: 'PEACE IN SPACE',                                        artist: 'ARTIST UNKNOWN',                     year: '1980S',          note: '' },
  { title: 'IN HONOR OF THE APOLLO-SOYUZ MISSION',                  artist: 'ARTIST UNKNOWN',                     year: '1975',           note: '' },
];

// ---- What the player owns ---------------------------------------------
function sanitizeGallery(a){
  if (!Array.isArray(a)) return [];
  return [...new Set(a.filter(i => Number.isInteger(i) && i >= 0 && i < POSTERS.length))].sort((x, y) => x - y);
}
let galleryUnlocked = sanitizeGallery(safeLoad(KEY('gallery'), []));
function saveGallery(){ safeSave(KEY('gallery'), galleryUnlocked); }
// The gallery shows every poster in a dev build, but satellites still go by what you have really found
const posterOwned = i => DEV_UNLOCK_ALL || galleryUnlocked.includes(i);
function resetGallery(){ galleryUnlocked = []; saveGallery(); }

function unlockPoster(i){
  if (galleryUnlocked.includes(i)) return false;
  galleryUnlocked = sanitizeGallery(galleryUnlocked.concat(i));
  saveGallery();
  sfx('unlock');
  flashT = Math.max(flashT, 0.3);
  pushToast('POSTER UNLOCKED: ' + POSTERS[i].title.slice(0, 26).trim(), P.yel);
  pushToast(galleryUnlocked.length + '/' + POSTERS.length + ' IN THE GALLERY', P.lgrn);
  checkAchievements();
  return true;
}

// ---- Satellites -------------------------------------------------------
// Rare, very fast and carrying a poster. One poster travels on each satellite, and a poster you
// already own never rides again, so every satellite is a one-time chance at something new.
const SAT_ROLL = [90, 170];         // seconds between chances
const SAT_CHANCE = 0.25;            // chance that a roll sends one
const SAT_CAP = { wave: 2, endless: 3 };   // at most this many per run
let satT = 60, satRun = 0;
function resetSatellites(){ satT = rnd(60, 110); satRun = 0; }
function nextLockedPoster(){
  const locked = [];
  for (let i = 0; i < POSTERS.length; i++) if (!galleryUnlocked.includes(i)) locked.push(i);
  return locked.length ? pick(locked) : -1;
}
function spawnSatellite(idx){
  const fromLeft = Math.random() < 0.5;
  spawnEnemy('satellite', fromLeft ? -14 : W + 14, rndi(26, 96), (fromLeft ? 1 : -1) * ETYPES.satellite.vx);
  enemies[enemies.length - 1].poster = idx;
  popups.push({ x: W / 2, y: 112, text: 'SATELLITE!', t: 0, dur: 1.3, col: P.yel, big: true });
  sfx('warn');
  tip('sat', 'SHOOT THE SATELLITE FOR A POSTER. IT IS FAST AND ONLY PASSES ONCE.');
}
function updateSatellites(dt){
  if (gameMode === 'rush' || boss) return;
  if (waveState === 'cleared' || waveState === 'worldclear') return;
  satT -= dt;
  if (satT > 0) return;
  satT = rnd(SAT_ROLL[0], SAT_ROLL[1]);
  if (satRun >= (SAT_CAP[gameMode] || 2) || enemies.some(e => e.type === 'satellite')) return;
  const idx = nextLockedPoster();
  if (idx < 0) return;
  if (Math.random() > SAT_CHANCE + (galleryUnlocked.length === 0 ? 0.25 : 0)) return;   // a nudge for the very first one
  spawnSatellite(idx);
  satRun++;
}
