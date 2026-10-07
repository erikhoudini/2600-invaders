# Balance tools

A human-like bot and telemetry harness for tuning the wave design. They drive the real game in headless
Chromium, so they need a static server and Playwright.

```sh
python3 -m http.server 8770 &                      # from the repo root
PW=$(npm root -g)/playwright
node tools/balance/tele.mjs $PW 0,1,2,3,4 expert,good,average,novice 3 http://127.0.0.1:8770/index.html out.json 1
node tools/balance/pat.cjs out.json                 # which patterns cost cities
node tools/balance/tele-end.mjs $PW                # Endless survival by skill
```

`tele.mjs` args: playwright path, worlds, skills, runs per cell, url, output file, difficulty (0 easy, 1 normal, 2 hard).
It prints cities lost per wave, idle time (an empty sky waiting for the next phrase), seconds per wave and the
cities left at the end of each world. `bot.js` holds the four skill levels (reaction time, aim error, lead).
Enemies carry a `pat` tag (the pattern that spawned them, or `boss` / `hazard` / `drizzle`), and `tele` in
`src/patterns.js` counts what hit your cities.
