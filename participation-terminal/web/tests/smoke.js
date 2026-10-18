// Headless walkthrough of the main flows. Saves screenshots to tests/shots/.
// Run: NODE_PATH=$(npm root -g) node tests/smoke.js
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(400);

  const box = await page.locator('#bottom').boundingBox();
  const tap = async (x, y, hold = 0) => {
    const px = box.x + (x / 256) * box.width, py = box.y + (y / 192) * box.height;
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.waitForTimeout(hold || 60);
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  const shot = (name) => page.locator('#device').screenshot({ path: path.join(OUT, name + '.png') });
  const scene = () => page.evaluate(() => PPT.App.scene().name);
  const expect = async (want, label) => {
    const got = await scene();
    if (got !== want) { errors.push(`${label}: expected scene ${want}, got ${got}`); }
  };

  await shot('01-landing');
  await tap(60, 70);                     // choice A
  await expect('confirm', 'pick answer');
  await shot('02-confirm');
  await tap(128, 60);                    // count my vote
  await page.waitForTimeout(1100);
  await expect('results', 'confirm vote');
  await shot('03-results');
  const counts = await page.evaluate(() => PPT.Store.activePoll().counts);
  if (counts[0] !== 1) errors.push('vote not recorded: ' + counts);
  await tap(128, 148);                   // done
  await expect('landing', 'done');

  // Suggest
  await tap(64, 168);
  await expect('suggest', 'open suggest');
  await page.keyboard.type('More plants by the window');
  await shot('04-suggest');
  await page.keyboard.press('Enter');
  await expect('suggestReview', 'review');
  await shot('05-suggest-review');
  await tap(128, 60);
  await expect('thanks', 'send suggestion');
  await shot('06-thanks');
  await tap(128, 88);

  // Comment
  await tap(190, 168);
  await expect('comment', 'open comment');
  await shot('07-comment');
  await tap(40, 70);
  await expect('thanks', 'comment submit');
  await tap(128, 88);

  // Staff access with L+R
  await page.keyboard.down('q'); await page.keyboard.down('w');
  await page.waitForTimeout(1700);
  await page.keyboard.up('q'); await page.keyboard.up('w');
  await expect('pin', 'L+R gesture');
  await page.keyboard.type('1234');
  await shot('08-pin');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await expect('adminHome', 'pin unlock');
  await shot('09-admin-home');

  await tap(34, 42);  await expect('polls', 'polls');  await shot('10-polls');
  await tap(100, 37); await expect('pollDetail', 'poll detail'); await shot('11-poll-detail');
  await tap(26, 10);  await tap(26, 10);
  await tap(158, 42); await expect('inbox', 'inbox'); await shot('12-inbox');
  await tap(100, 82); await expect('suggestion', 'suggestion'); await shot('13-suggestion');
  await tap(26, 10);  await tap(26, 10);
  await tap(220, 42); await expect('history', 'history'); await tap(100, 37); await shot('14-history-detail');
  await tap(26, 10);  await tap(26, 10);
  await tap(34, 122); await expect('appearance', 'appearance'); await shot('15-appearance');
  await tap(100, 37); // cycle theme
  await shot('16-theme-sea');
  await tap(100, 37); // night
  await shot('17-theme-night');
  await tap(100, 37); // back to paper
  await tap(26, 10);
  await tap(96, 122); await expect('records', 'records'); await shot('18-records');
  await tap(26, 10);
  await tap(158, 122); await expect('settings', 'settings'); await shot('19-settings');
  await tap(26, 10);
  await tap(96, 42); await expect('calendar', 'calendar'); await shot('19b-calendar');
  await tap(26, 10);

  // Storage failure: card full -> no false success
  await page.evaluate(() => PPT.SD.setSim({ full: true }));
  await tap(128, 178); // lock
  await expect('landing', 'lock');
  await tap(190, 70); await tap(128, 60);
  await expect('error', 'full card vote');
  await shot('20-error');
  const after = await page.evaluate(() => PPT.Store.activePoll().counts);
  if (after[1] !== 0) errors.push('vote counted despite full card');
  await page.evaluate(() => PPT.SD.setSim({ full: false }));

  // Power cut mid-write, then recovery
  await tap(128, 88); // OK -> landing
  await page.evaluate(() => PPT.SD.setSim({ powerCutNextWrite: true }));
  await tap(190, 70); await tap(128, 60);
  await page.waitForTimeout(800);
  await page.waitForFunction(() => window.PPT && PPT.App && PPT.App.stack.length);
  const rep = await page.evaluate(() => ({ report: PPT.Store.report, counts: PPT.Store.activePoll().counts }));
  console.log('After power cut:', JSON.stringify(rep));
  if (rep.counts[1] !== 0) errors.push('torn vote was counted');
  await shot('21-after-power-cut');

  await browser.close();
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('Smoke test passed. Screenshots in ' + OUT);
})();
