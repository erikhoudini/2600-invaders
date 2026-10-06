# STRELA-10

Soviet Orbital Strike Force: a dual-screen, Atari 2600-styled missile-defense game that runs in the browser on a single `<canvas>`. No dependencies and no build step.

## Run it

```sh
npm start            # serves the project at http://localhost:8000
```

Any static file server works. Opening `index.html` directly from disk also works, but serve it over HTTP if you want to read pixels back from the canvas (browsers treat `file://` images as cross-origin).

## Controls

The game is presented as a DS title: everything but the top-screen scene is on the touch screen.

| DS | Touch | Keyboard |
| --- | --- | --- |
| Stylus | tap buttons, tap the screens to aim and fire | mouse |
| D-pad | | arrow keys |
| A / B | | `X` or `Enter` / `Z`, `Backspace` or `Esc` |
| L / R | tap the shoulder keys in the header | `Q` / `E` |
| START (pause) | the pause button, bottom-right | `P` or `Esc` |
| Swap screens while playing | | `Shift`, `Tab`, `Q` or `E` |

## Layout

```
index.html        page shell; loads the scripts below in order
css/style.css     page and canvas styling
assets/           intro-screen art (PNG)
src/              game code, one file per system
build.mjs         optional: bundle everything into dist/strela-10.html
```

The files in `src/` are classic scripts that share one global scope, loaded in the order listed in `index.html`. A file can use the top-level consts, lets and functions of any file loaded before it. Roughly:

| File | Contents |
| --- | --- |
| `core.js` | canvas setup, helpers, palette, per-world environments |
| `font.js`, `audio.js` | bitmap text; Atari 2600 TIA sound emulation |
| `storage.js`, `achievements.js`, `options.js`, `toasts.js` | persistence and meta systems |
| `intro.js` | press-start screen and briefing |
| `saturn.js`, `scenery.js`, `effects.js` | backdrops, particles, explosions |
| `enemies.js`, `game.js`, `bosses.js`, `crates.js` | gameplay: waves, Endless and Boss Rush, bosses, crates and hazards |
| `gallery.js`, `gallery-ui.js` | the poster gallery: data and unlocks; grid, card and zoom screens |
| `ui.js` | the DS UI kit: touch buttons, header/footer, button glyphs, stylus feedback |
| `loadout.js`, `name-entry.js`, `menus.js`, `pause.js` | menus and screens, built on `ui.js` |
| `render.js` | gameplay, HUD and screen rendering |
| `input.js`, `main.js` | input; boot and main loop |

## Gallery

Twelve Soviet space posters, unlocked by shooting down the rare **satellites**: gold, panelled, very
fast (150 px/s, faster than any ship) and carrying a poster you don't own yet. A satellite is a
one-time chance per poster; once you own a poster it never rides again. They show up about once every
ten minutes of play, at most two per campaign run and three in Endless.

The gallery is built for two screens and a stylus:

- **Grid**: a 4x3 grid on the touch screen, with the selected poster framed on the top screen.
- **Card**: a trading card on the top screen with the credits on the touch screen. Swipe, or use L / R, to flip.
- **Zoom**: both screens become one tall viewport. Drag to pan, double-tap or press A to zoom in and out.

Posters are palettized to the game's own colours. To rebuild `assets/gallery/` from `art/source/`:

```sh
python3 tools/make_gallery.py        # needs python3, numpy and Pillow
```

Poster credits are in `art/source/spaceposters.txt` and appear on each card. Reset Progress in Options
also clears the gallery.

## Single-file build

```sh
npm run build        # writes dist/strela-10.html (CSS, JS and images inlined)
```

Use that file to share or host the game as one page.
