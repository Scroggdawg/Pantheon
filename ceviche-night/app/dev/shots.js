// Screenshots of the phone guide in known states: node ceviche-night/app/dev/shots.js [name-filter]
// Writes dev/shots/<variant>-<name>.png for iPhone 13 light, iPhone 13 dark and a 375x667 phone.
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, [path.join(__dirname, 'build-preview.js')], { stdio: 'ignore' });
const URL = 'file://' + path.join(__dirname, 'preview.html');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] || '';

const VARIANTS = [
  { id: 'ip13-light', ctx: { ...devices['iPhone 13'], colorScheme: 'light' } },
  { id: 'ip13-dark', ctx: { ...devices['iPhone 13'], colorScheme: 'dark' } },
  { id: 'se-light', ctx: { ...devices['iPhone 13'], viewport: { width: 375, height: 667 }, colorScheme: 'light' } }
];

// runs in the page: a private clock and a fast cook
function helpers() {
  window.S = {
    init: function () {
      var c = window.__cook; window.__t = c.now; c.setClock(function () { return window.__t; }); c.setGuard(0);
    },
    step: function () { var c = window.__cook; return c.focus ? c.engine.stepById(c.plan, c.focus) : null; },
    // do steps the way the projection does until `stop(step, cook)` says so
    walk: function (stop) {
      var c = window.__cook, E = c.engine, P = c.plan, g = 0;
      while (g++ < 500) {
        var st = this.step();
        if (stop(st, c)) return true;
        if (st) { window.__t += E.stepMins(st) * 60000; c.act('complete', st.id, st.kind === 'choice' ? { value: st.choice.options[0].value } : undefined); continue; }
        var mode = c.mode, s = c.state;
        if (mode === 'away') { window.__t = Math.max(window.__t, E.anchorMs(s, 'backHome')); c.act('complete', P.steps.filter(function (x) { return x.move === 'backHome'; })[0].id); continue; }
        if (mode === 'drive') { window.__t += (s.anchors.arrive - s.anchors.leavePm) * 60000; c.act('complete', P.steps.filter(function (x) { return x.move === 'arrive'; })[0].id); continue; }
        if (mode !== 'free') return false;
        var u = E.nextUnlock(P, s, c.now);
        if (!u) return false;
        window.__t = u.at;
        if (u.reason === 'move') c.act('complete', u.stepId); else c.tick();
      }
      return false;
    },
    score: function (st) { return (st.need ? 1 : 0) + (st.into ? 1 : 0) + (st.look ? 1 : 0) + (st.warn ? 1 : 0); },
    length: function (st) { return JSON.stringify([st.body, st.need, st.into, st.look, st.warn, st.tip]).length; }
  };
}

async function tab(p, name) {
  await p.locator('#tabs .tab[data-tab="' + name + '"]').click();
  await p.waitForFunction(t => document.querySelector('#tabs .tab[aria-current="page"]').getAttribute('data-tab') === t, name);
}
async function dish(p, i) {
  await p.evaluate(n => { location.hash = '#dish-' + __cook.plan.dishes[n].id; }, i);
  await p.waitForFunction(() => !!document.querySelector('#view .dish'));
}

const SHOTS = [
  { name: '01-tonight', time: '2026-11-22T22:00:00', run: async p => { } },
  { name: '01b-tonight-open', time: '2026-11-22T22:00:00', run: async p => { await p.locator('#view [data-act="tonight-tick"]').nth(0).click(); await p.locator('#view [data-act="toggle"]').nth(1).click(); await p.evaluate(() => { document.getElementById('page').scrollTop = 150; }); } },
  { name: '02-step-normal', run: async p => { await p.evaluate(() => S.walk(st => st && !st.kind && !st.timer && st.body.length >= 3 && st.need && !st.warn)); } },
  { name: '03-step-need-into-look', run: async p => { await p.evaluate(() => { const best = __cook.plan.steps.slice().sort((a, b) => S.score(b) - S.score(a) || b.body.length - a.body.length)[0]; S.walk(st => st && st.id === best.id); }); } },
  { name: '03a-step-need-into-look-end', run: async p => { await p.evaluate(() => { const best = __cook.plan.steps.slice().sort((a, b) => S.score(b) - S.score(a) || b.body.length - a.body.length)[0]; S.walk(st => st && st.id === best.id); const pg = document.getElementById('page'); pg.scrollTop = pg.scrollHeight; }); } },
  { name: '03b-step-warning', run: async p => { await p.evaluate(() => { const best = __cook.plan.steps.filter(s => s.warn).sort((a, b) => S.score(b) - S.score(a))[0]; S.walk(st => st && st.id === best.id); }); } },
  { name: '03c-step-warning-end', run: async p => { await p.evaluate(() => { const best = __cook.plan.steps.filter(s => s.warn).sort((a, b) => S.score(b) - S.score(a))[0]; S.walk(st => st && st.id === best.id); const pg = document.getElementById('page'); pg.scrollTop = pg.scrollHeight; }); } },
  { name: '04-timer-running', run: async p => { await p.evaluate(() => { S.walk(st => st && st.timer); __cook.act('startTimer', __cook.focus); window.__t += 6000; __cook.tick(); }); } },
  { name: '04b-timer-start', run: async p => { await p.evaluate(() => { S.walk(st => st && st.timer); }); } },
  { name: '04c-timer-done', run: async p => { await p.evaluate(() => { S.walk(st => st && st.timer); __cook.act('startTimer', __cook.focus); window.__t += S.step().timer.secs * 1000 + 500; __cook.tick(); }); } },
  { name: '05-check', run: async p => { await p.evaluate(() => S.walk(st => st && st.kind === 'check')); } },
  { name: '05b-check-giveup', run: async p => { await p.evaluate(() => { S.walk(st => st && st.kind === 'check'); window.__t = __cook.engine.anchorMs(__cook.state, 'leaveAm') - 30 * 60000; __cook.tick(); }); } },
  { name: '05c-choice', run: async p => { await p.evaluate(() => S.walk(st => st && st.kind === 'choice')); } },
  { name: '06-checklist', run: async p => { await p.evaluate(() => S.walk(st => st && st.kind === 'checklist')); await p.locator('#view .tick').nth(0).click(); await p.locator('#view .tick').nth(1).click(); } },
  { name: '06b-checklist-cooler', run: async p => { await p.evaluate(() => S.walk(st => st && st.items === 'cooler')); await p.locator('#view .tick').nth(0).click(); } },
  { name: '07-free', run: async p => { await p.evaluate(() => { S.walk((st, c) => !st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'wait'); window.__t += 95000; __cook.tick(); }); } },
  { name: '07b-free-leave', run: async p => { await p.evaluate(() => { S.walk((st, c) => !st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'move'); __cook.tick(); }); } },
  { name: '07c-away', run: async p => { await p.evaluate(() => { S.walk((st, c) => !st && c.mode === 'away'); __cook.tick(); }); } },
  { name: '07d-move-step', run: async p => { await p.evaluate(() => { S.walk((st, c) => !st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'move'); window.__t = __cook.engine.anchorMs(__cook.state, 'leaveAm') + 30000; __cook.tick(); }); } },
  { name: '08-alert', run: async p => { await p.evaluate(() => {
      const c = __cook, E = c.engine;
      S.walk((st, cc) => st && !st.kind && !st.timer && E.waitsView(cc.plan, cc.state, cc.now).some(w => w.urgent && !w.elapsed && w.gatedStepId !== st.id));
      const w = E.waitsView(c.plan, c.state, c.now).filter(x => x.urgent && !x.elapsed)[0];
      window.__t = w.endsAt + 4000; c.tick();
    }); } },
  { name: '08b-alert-lap', run: async p => { await p.evaluate(() => {
      const c = __cook, E = c.engine;
      S.walk((st, cc) => E.waitsView(cc.plan, cc.state, cc.now).some(w => w.laps.length && !w.elapsed));
      const w = E.waitsView(c.plan, c.state, c.now).filter(x => x.laps.length)[0];
      window.__t = w.laps[0].at + 5000; c.tick();
    }); } },
  { name: '09-day', run: async p => { await p.evaluate(() => { let n = 0; S.walk(st => st && ++n > 14); }); await tab(p, 'day'); } },
  { name: '09b-day-top', run: async p => { await p.evaluate(() => { let n = 0; S.walk(st => st && ++n > 14); }); await tab(p, 'day'); await p.evaluate(() => { document.getElementById('page').scrollTop = 0; }); } },
  { name: '09d-day-scrolled', run: async p => { await p.evaluate(() => { let n = 0; S.walk(st => st && ++n > 14); }); await tab(p, 'day'); await p.evaluate(() => { document.getElementById('page').scrollTop += 330; }); } },
  { name: '09e-day-later', run: async p => { await p.evaluate(() => { S.walk((st, c) => c.engine.location(c.plan, c.state) === 'hers' && !!st); }); await tab(p, 'day'); await p.evaluate(() => { document.getElementById('page').scrollTop -= 260; }); } },
  { name: '09c-step-sheet', run: async p => { await p.evaluate(() => { let n = 0; S.walk(st => st && ++n > 14); }); await tab(p, 'day'); await p.locator('#view .srow:not(.done):not(.next)').nth(2).click(); } },
  { name: '10-dishes', run: async p => { await p.evaluate(() => { let n = 0; S.walk(st => st && ++n > 14); }); await tab(p, 'dishes'); } },
  { name: '11-dish-steps', run: async p => { await p.evaluate(() => { let n = 0; S.walk(st => st && ++n > 14); }); await dish(p, 2); } },
  { name: '11b-dish-ingredients', run: async p => { await dish(p, 1); await p.locator('#view [data-seg="ingredients"]').click(); } },
  { name: '11c-dish-gear', run: async p => { await dish(p, 0); await p.locator('#view [data-seg="gear"]').click(); } },
  { name: '11d-dish-end', run: async p => { await dish(p, 0); await p.evaluate(() => { const pg = document.getElementById('page'); pg.scrollTop = pg.scrollHeight; }); } },
  { name: '12-setup', run: async p => { await tab(p, 'setup'); } },
  { name: '12b-setup-times', run: async p => { await tab(p, 'setup'); await p.evaluate(() => { const h = [...document.querySelectorAll('#view .h2')].filter(e => e.textContent === 'Times')[0]; document.getElementById('page').scrollTop = h.offsetTop - 12; }); } },
  { name: '12c-setup-end', run: async p => { await tab(p, 'setup'); await p.locator('#view [data-act="reset-ask"]').click(); await p.evaluate(() => { const pg = document.getElementById('page'); pg.scrollTop = pg.scrollHeight; }); } },
  { name: '13-glossary', run: async p => { await p.evaluate(() => S.walk(st => st && /\[\[/.test(JSON.stringify(st.body)))); await p.locator('#view .term').first().click(); } },
  { name: '13b-help', run: async p => { await p.evaluate(() => S.walk(st => st && /\[\[/.test(JSON.stringify(st.body)))); await p.locator('#view [data-act="help"]').click(); } },
  { name: '14-preview', time: '2026-11-22T22:00:00', run: async p => { await p.locator('#actions [data-act="preview-enter"]').click(); await p.locator('#actions [data-act="done"]').click(); } },
  { name: '15-longest-step', run: async p => { await p.evaluate(() => { const best = __cook.plan.steps.slice().sort((a, b) => S.length(b) - S.length(a))[0]; S.walk(st => st && st.id === best.id); }); } },
  { name: '15b-longest-step-end', run: async p => { await p.evaluate(() => { const best = __cook.plan.steps.slice().sort((a, b) => S.length(b) - S.length(a))[0]; S.walk(st => st && st.id === best.id); const pg = document.getElementById('page'); pg.scrollTop = pg.scrollHeight; }); } },
  { name: '16-done', run: async p => { await p.evaluate(() => { S.walk((st, c) => c.mode === 'done'); }); } },
  { name: '13c-help-ask', init: () => {
      window.claude = { use: name => Promise.resolve(name === 'sample' ? (input, o) => new Promise(res => setTimeout(() => { const t = 'Hold the lime over the jar. Scrape only the thin green skin with the small holes of the grater. Turn the lime as you go. Stop when you see white. The white part tastes bitter.'; o.onText({ text: t, delta: t }); res({ text: t, truncated: false, modelTierApplied: 'quick' }); }, 10)) : null) };
    }, run: async p => {
      await p.evaluate(() => S.walk(st => st && /\[\[/.test(JSON.stringify(st.body)) && st.dish !== 'day' && st.body.length > 2));
      await p.locator('#view [data-act="help"]').click();
      await p.locator('#sheet-layer [data-act="ask-preset"]').first().click();
      await p.waitForFunction(() => /Hold the lime/.test(document.querySelector('#sheet-layer').textContent));
      await p.evaluate(() => { const sc = document.querySelector('#sheet-layer .sheet-scroll'); const a = document.querySelector('#sheet-layer [data-role="answer"]'); sc.scrollTop = a.closest('.block').offsetTop - 16; });
    } },
  { name: '18-early-step', run: async p => { await p.evaluate(() => { S.walk((st, c) => !st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'time'); }); await p.locator('#actions [data-act="do-now"]').click(); } },
  { name: '18b-free-start-now', run: async p => { await p.evaluate(() => { S.walk((st, c) => !st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'time'); }); } },
  { name: '19-optional-step', run: async p => { await p.evaluate(() => S.walk(st => st && st.optional)); } },
  { name: '19b-leave-soon', run: async p => { await p.evaluate(() => { S.walk(st => st && st.optional); window.__t = __cook.engine.anchorMs(__cook.state, 'leaveAm') - 7.5 * 60000; __cook.tick(); }); } },
  { name: '17-last-hour', run: async p => { await p.evaluate(() => { const E = __cook.engine; S.walk((st, c) => st && E.waitsView(c.plan, c.state, c.now).length >= 2 && E.location(c.plan, c.state) === 'hers'); }); } }
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const v of VARIANTS) {
    for (const shot of SHOTS) {
      if (only && shot.name.indexOf(only) < 0 && v.id.indexOf(only) < 0) continue;
      const ctx = await browser.newContext(v.ctx);
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(v.id + ' ' + shot.name + ': ' + e.message));
      if (shot.init) await page.addInitScript(shot.init);
      await page.addInitScript(helpers);
      await page.clock.install({ time: new Date(shot.time || '2026-11-23T06:58:00') });
      await page.goto(URL);
      await page.waitForFunction(() => !!window.__cook && !!window.S);
      await page.evaluate(() => window.S.init());
      try { await shot.run(page); } catch (e) { errors.push(v.id + ' ' + shot.name + ': ' + e.message.split('\n')[0]); }
      await page.evaluate(() => window.__cook.tick());
      await page.waitForTimeout(260);                      // let the 200 ms enter animation finish
      await page.screenshot({ path: path.join(OUT, v.id + '-' + shot.name + '.png') });
      await ctx.close();
    }
  }
  // a laptop, for the record
  if (!only || 'laptop'.indexOf(only) >= 0) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
      const page = await ctx.newPage();
      await page.addInitScript(helpers);
      await page.clock.install({ time: new Date('2026-11-23T06:58:00') });
      await page.goto(URL);
      await page.waitForFunction(() => !!window.__cook && !!window.S);
      await page.evaluate(() => { window.S.init(); let n = 0; S.walk(st => st && ++n > 12); window.__cook.tick(); });
      await page.waitForTimeout(260);
      await page.screenshot({ path: path.join(OUT, 'laptop-' + scheme + '-step.png') });
      await ctx.close();
    }
  }
  await browser.close();
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
  console.log('wrote screenshots to dev/shots/');
})();
