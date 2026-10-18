# Public Participation Terminal

An offline Nintendo DS / DSi XL appliance that lets visitors to a café, bar, bookshop or
community space **Vote**, **Suggest** and **Comment**. Staff run everything on the console itself.

- Design document: [`docs/product-design.md`](docs/product-design.md)
- Browser prototype: [`web/`](web/)

## Running the prototype

No build step and no dependencies. Open `web/index.html` in a browser, or serve the folder:

```sh
cd participation-terminal/web
python3 -m http.server 8000   # then visit http://localhost:8000
```

Each screen is drawn into a real 256×192 canvas and scaled with nearest-neighbour filtering
(2× by default), with the DSi XL's gap between the screens. There is no console frame or
on-screen buttons, just the two screens. The lower screen is the only touch surface, as on
hardware.

| Action | How |
| --- | --- |
| Touch | Mouse or finger on the lower screen |
| Staff access | Hold **L+R** for 1.5 s (keys **Q+W**, or the "Hold for staff access" button in the panel), or hold the top-left corner of the touchscreen for 3 s |
| Default PIN | `1234` (the admin home warns until it is changed) |
| D-pad / A / B | Arrow keys / X / Z. B goes back on admin screens |
| Typing | The physical keyboard works on text-entry screens, for speed |

The side panel is for prototyping only: change scale and screen gap, move the simulated DS clock
(+1 hour/day/week, set a date, or simulate a flat clock battery), inject SD-card faults
(missing, full, small capacity, power cut on the next write, corrupt `data.json`, drop the
`RESETPIN.TXT` recovery file), add test data, and browse or download files on the virtual card.

## What's in the prototype

**Public mode**
- Landing that is also the poll: question on top, 2 answers side by side or 4 in a 2×2 grid,
  with smaller Suggest and Comment buttons underneath. With no active poll, Suggest and Comment
  get large tiles instead.
- Vote → confirm ("Count my vote" / "Change answer") → animated result bars showing
  percentage *and* raw count, the visitor's own answer marked, and "N responses so far"
  (never "people"). Results are never shown before voting.
- Suggest: stylus QWERTY keyboard with DS-style key pop-ups, a draft shown large on the top
  screen, a 200-character limit (configurable), a review step, and a warning before
  discarding typed text.
- Comment: rotating owner-defined prompts with 2–4 one-tap responses.
- "Still there?" after the visitor timeout, then a reset that clears any draft.
- Error screens that never claim success when a write fails.

**Admin mode** (all on-device)
- Home: active poll, new-feedback counts, storage gauge, warnings.
- Poll Manager: create/edit drafts with a live preview, preview as a visitor (votes not
  counted), activate (one active poll at a time), end, archive, duplicate, delete. Editing a
  poll that has votes creates a **new revision**, so the old one keeps its results.
- Feedback Inbox: suggestions filtered by new/reviewed/archived, mark reviewed, archive,
  delete; comment tallies per prompt, with "archive and restart".
- Results & History: every activated poll and revision with dates and lineage.
- Appearance & Behaviour: theme (Paper / Sea glass / Night), idle animation, enabled modes,
  confirmation step, timeouts, suggestion length and prompt, comment prompts.
- Records & Storage: CSV export, JSON backup and restore, archive and delete, integrity check,
  "Prepare for shutdown".
- Terminal Settings: venue name, change PIN, auto-lock, forgot-PIN procedure, erase all data
  (hold to confirm).

## Storage design (meant to carry over to the DS)

```
/ppt/data.json     snapshot  "PPT1 <crc32>\n<json>"
/ppt/data.tmp      written first, verified, then renamed into place
/ppt/data.bak      previous good snapshot
/ppt/journal.log   one "<crc32>|<json>" line per public submission, with a seq number
/ppt/export/       CSV exports and JSON backups
```

- A vote, suggestion or comment is one journal append. It counts if and only if its line is
  on the card intact, and the visitor sees success only after the append returns.
- Admin changes write a whole new snapshot (tmp → verify → rename), which folds in the
  journal and then truncates it. Every 20 submissions also trigger a checkpoint.
- On boot: load `data.json`, else `data.tmp`, else `data.bak`. Then replay journal lines with
  `seq > lastSeq` and discard a torn last line. Replay never double-counts.
- Each confirm screen has its own submission ID, so a double tap can't record twice.
- PIN: salted, iterated SHA-256 (2000 rounds; tune on hardware), with escalating lockouts
  after 3 failures that persist across restarts.

The virtual SD card (`web/js/sdcard.js`) is a **mock** backed by `localStorage`. The real
filesystem behaviour (libfat vs. DSi SD, rename atomicity, flush semantics) still needs testing
on hardware.

## Code layout

```
web/
  index.html          device shell + dev panel
  css/shell.css
  js/font.js          5px proportional bitmap font (converts 1:1 to a tile font)
  js/gfx.js           256×192 drawing primitives, palette, themes
  js/sprites.js       original pixel-art icons
  js/mascot.js        "Tally" the mascot: procedural body, moods, actions, effects
  js/hash.js          SHA-256 + CRC-32
  js/clock.js         DS real-time clock (simulated offset) + calendar helpers
  js/sdcard.js        virtual SD card with fault injection (mock)
  js/store.js         data model, journal/snapshot persistence, exports
  js/ui.js            immediate-mode touch regions and shared widgets
  js/keyboard.js      stylus keyboard
  js/app.js           scene stack, main loop, buttons, timeouts, dialogs
  js/scenes/public.js visitor flows
  js/scenes/admin.js  staff flows
  js/scenes/calendar.js  calendar, week planner, day detail, calendar options
  js/devpanel.js      prototype-only controls
  tests/check-assets.js   validates font and sprite tables (node)
  tests/smoke.js          headless walkthrough with screenshots (Playwright)
```

The UI is immediate-mode: each frame, a scene redraws both screens and declares its touch
regions. This is how a libnds main loop works (`scanKeys` / `touchRead` then redraw), so
scene logic should port with few structural changes.

To produce the single self-contained HTML file:

```sh
python3 tools/bundle.py            # writes dist/participation-terminal.html
```

```sh
node web/tests/check-assets.js
NODE_PATH=$(npm root -g) node web/tests/smoke.js   # needs Playwright
```

## Prototype choices for open decisions (§16)

These are placeholders to test, not decisions:

| Open question | Prototype default |
| --- | --- |
| Product name | Not chosen. The mascot is called "Tally" (see below) |
| Active-poll policy | One at a time; activating another ends the current one |
| Idle state | Landing stays on the question; Lively / Calm / Off setting |
| Session timeout | 60 s, then a 10 s "Still there?" (configurable 30–120 s) |
| Results reveal | Horizontal bars, readable in under 1 s; 12 s auto-return; Done dismisses early |
| Comment configuration | Presets (Good/Okay/Not great, Yes/No, 4-step) or custom 2–4 options; prompts rotate |
| Suggestion limit | 200 characters (100–280 selectable) |
| PIN recovery | `RESETPIN.TXT` in `/ppt/` on the card resets the PIN to 1234 at boot; needs physical card access |
| Export schema | `polls-*.csv`, `suggestions-*.csv`, `comments-*.csv`, `backup-*.json` (see `store.js`) |
| Retention | Manual only: archive, then delete archived |

## Calendar features (optional, from the DS clock)

The DS has a built-in real-time clock, which the owner sets in System Settings. Everything below
uses it, and all of it is **off by default** except the passive daily tallies.

- **Daily tallies (always on):** each vote, suggestion and comment is also counted under its
  calendar day. These are counts only; nothing personal is stored.
- **Calendar (admin → Calendar, or the date tile):** a touchscreen month grid. Each day shows
  activity dots, a coloured stripe for its scheduled poll, and a ring for today. The top screen
  shows the selected day's votes per poll, suggestions and comments. Tapping a selected day opens
  that day's breakdown and its suggestions.
- **Week planner:** assign a poll (or "no poll") to each of the seven days, pick or create polls
  from there, and copy a week forward. With **Poll schedule** on, the terminal switches to the
  day's poll at the start of each day. A manual switch by staff holds until the next day. Days
  with nothing planned either keep the current poll or show none (your choice).
- **Day starts at:** 00:00 to 06:00, so a bar open past midnight counts late votes on the right
  day and doesn't switch polls mid-shift.
- **Closed hours:** outside opening times visitors see a resting screen with Tally asleep and
  the reopening time. Staff access still works.
- **Show date to visitors:** puts the date in the visitor header. When the schedule is on,
  Tally's speech bubble can also say "Today's question!" or "New question tomorrow!".
- **Per-day results:** Results & History shows votes by day for each poll, and the CSV export
  adds `daily-*.csv`.
- **Clock sanity:** if the clock battery dies, the DS resets to 1 Jan 2000. The terminal treats
  any year outside 2024–2099 as unset: it warns on the admin home, and pauses the schedule and
  closed hours rather than acting on a wrong date. Submissions still save.

## Tally, the mascot

Tally is an original speech-bubble character (not a Mii or Everybody Votes figure). Its body is
rasterised in code, so it can squash and stretch while staying pixel-crisp. The face, floating
mitten hands, props and effects are small pixel patterns layered on top.

- **Moods** set by each screen: invite, happy, celebrate, think, listen, worried, sad, sleep,
  shy, peek, shrug, present, hold.
- **One-shot actions:** hop, jump, wave, point (down at the touchscreen), nod, shake,
  surprise, and a drop-in entrance.
- **Ambient life:** irregular blinks (sometimes a double blink), two-frame breathing, glances,
  and a ground shadow that shrinks as Tally leaves the ground.
- **Reacts to the visitor:** glances towards wherever the touchscreen is pressed. It previews a
  reaction while an answer is held, nods along as you type a suggestion, shakes its head at a
  wrong PIN, and squeezes its eyes shut while the PIN is entered.
- **Where it appears:** the landing poll and the no-poll landing (showing the bulb and speech
  props for the enabled modes), the confirm screen (holding a ballot in your answer's colour),
  results, Suggest (sitting on the text box), Comment, thanks, errors, "Still there?", the
  PIN screen, admin home, empty lists, "safe to switch off" and the storage-break screen.
- **Idle animation setting:** Lively = everything; Calm = blinks, breathing and reactions only,
  no attention-seeking actions; Off = still poses.
- **Effects** (sparkles, hearts) are decorative and never stand for vote counts.

## Known gaps

- If `data.json` is damaged *after* a successful write (not during one), recovery falls back to
  `data.bak`, which lacks the submissions folded in by the last checkpoint. Keeping the previous
  journal segment until the next checkpoint would close this; it is worth doing in the DS build.
- No sound, by design. A key-click option could be added later.
- The touch regions are tuned with a mouse. Stylus accuracy, key sizes and text legibility need
  checking on a DSi XL.
