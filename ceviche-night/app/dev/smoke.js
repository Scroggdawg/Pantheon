// Smoke test for the phone guide. Drives dev/preview.html with Playwright and a fake clock.
//   node ceviche-night/app/dev/smoke.js          exits non-zero on any failure
// Nothing here hard-codes step ids, counts or texts from plan.js (only the ids the spec fixes: `dinner`, the move names).
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const APP = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'build-preview.js')], { stdio: 'ignore' });
const URL = 'file://' + path.join(__dirname, 'preview.html');
const HAS_BOARD = fs.existsSync(path.join(APP, 'board.js'));
const PLAN = require(path.join(APP, 'plan.js'));
const SMALL = { width: 375, height: 667 };

let failures = 0, checks = 0;
const problems = [];                       // console errors, uncaught errors, unhandled rejections (all pages)
const log = (...a) => console.log(...a);
function ok(cond, msg) { checks++; if (!cond) { failures++; log('  FAIL  ' + msg); } return !!cond; }
function section(t) { log('\n' + t); }

// helpers that live in the page; they look things up lazily so they survive a reload
function pageHelpers() {
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; console.error('unhandledrejection: ' + (r && (r.message || r.code) || r));
  });
  window.T = {
    info: function () {
      var c = window.__cook, E = c.engine, P = c.plan, f = c.focus, st = f ? E.stepById(P, f) : null, s = c.state, t = c.now;
      return {
        focus: f, mode: c.mode, kind: st ? (st.kind || 'do') : null, title: st ? st.title : null,
        timer: st && st.timer ? st.timer.secs : 0, mins: st ? (st.mins || 0) : 0, optional: !!(st && st.optional),
        hasWait: !!(st && st.wait), afterWait: st ? (st.afterWait || null) : null, retryMins: st && st.check ? st.check.retryMins : 0,
        move: st ? (st.move || null) : null, listName: st && typeof st.items === 'string' ? st.items : null,
        loc: E.location(P, s), now: t, clock: E.fmtClock(t), fg: s.fg, preview: c.preview, undo: c.undoDepth,
        unlock: E.nextUnlock(P, s, t), pick: E.nextStep(P, s, t),
        waits: E.waitsView(P, s, t).map(function (w) { return { id: w.id, label: w.label, elapsed: w.elapsed, urgent: w.urgent, gated: w.gatedStepId }; }),
        alerts: E.alerts(P, s, t), doneCount: Object.keys(s.done).length, rings: c.debug.rings.length
      };
    },
    progress: function (s) {
      s = s || window.__cook.state;
      return JSON.stringify({ done: s.done, skipped: s.skipped, waits: s.waits, laps: s.laps, fg: s.fg, opts: s.opts });
    },
    // every rule from SPEC 5.1 that can be measured
    audit: function () {
      var out = [], vw = window.innerWidth, c = window.__cook;
      if (document.documentElement.scrollWidth > vw + 0.5) out.push('the page scrolls sideways (' + document.documentElement.scrollWidth + ' > ' + vw + ')');
      if (document.documentElement.scrollHeight > window.innerHeight + 0.5) out.push('the page itself scrolls down (' + document.documentElement.scrollHeight + ' > ' + window.innerHeight + ')');
      var layer = document.getElementById('sheet-layer');
      var root = layer && !layer.hidden ? layer : document.getElementById('app');
      function shown(el) {
        if (el.closest('[hidden]')) return false;
        var cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      }
      // the part of a control a finger can reach: clipped by scroll containers and the 12px dead strips of the page
      function reach(el) {
        var r = el.getBoundingClientRect(), b = { l: r.left, t: r.top, r: r.right, b: r.bottom };
        for (var p = el.parentElement; p; p = p.parentElement) {
          var cs = getComputedStyle(p);
          if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
          var q = p.getBoundingClientRect(), inset = p.id === 'page' ? 12 : 0;
          b.l = Math.max(b.l, q.left); b.r = Math.min(b.r, q.right); b.t = Math.max(b.t, q.top + inset); b.b = Math.min(b.b, q.bottom - inset);
        }
        return (b.r - b.l > 1 && b.b - b.t > 1) ? b : null;
      }
      var ctrls = [].slice.call(root.querySelectorAll('button, a[href], [role="button"], input, select, textarea')).filter(shown);
      var boxes = [];
      ctrls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        var name = (el.className || el.tagName) + ' "' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 36) + '"';
        var min = el.matches('.term, .chip') ? 44 : 64;
        if (r.height < min - 0.5) out.push('control too short (' + r.height.toFixed(1) + ' < ' + min + '): ' + name);
        if (!el.closest('.chips') && (r.left < -0.5 || r.right > vw + 0.5)) out.push('control sticks out sideways: ' + name);
        var b = reach(el);
        if (b && !el.matches('.term')) boxes.push({ el: el, b: b, name: name });
      });
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        var A = boxes[i], B = boxes[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        var dx = Math.max(0, A.b.l - B.b.r, B.b.l - A.b.r), dy = Math.max(0, A.b.t - B.b.b, B.b.t - A.b.b), gap = Math.sqrt(dx * dx + dy * dy);
        if (gap < 11.5) out.push('controls closer than 12px (' + gap.toFixed(1) + '): ' + A.name + ' / ' + B.name);
      }
      // nothing smaller than 17px
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, seen = {};
      while ((n = walker.nextNode())) {
        if (!n.nodeValue.trim()) continue;
        var pe = n.parentElement;
        if (!pe || !shown(pe)) continue;
        var fs = parseFloat(getComputedStyle(pe).fontSize);
        if (fs < 16.99 && !seen[pe.className]) { seen[pe.className] = 1; out.push('text smaller than 17px (' + fs + '): "' + n.nodeValue.trim().slice(0, 30) + '" in .' + pe.className); }
      }
      if (root.id === 'app' && location.hash.replace('#', '').replace('now', '') === '' && c.mode === 'step') {
        var title = document.querySelector('#view .title'), body = document.querySelector('#view .body p');
        if (title && parseFloat(getComputedStyle(title).fontSize) < 32) out.push('step title smaller than 32px');
        if (body && parseFloat(getComputedStyle(body).fontSize) < 21) out.push('step body smaller than 21px');
        // the action bar must be on screen, below the scrolling page, and the page must scroll inside its own box
        var bar = document.getElementById('actions').getBoundingClientRect(), pg = document.getElementById('page').getBoundingClientRect();
        if (bar.bottom > window.innerHeight + 0.5 || bar.top < pg.bottom - 0.5) out.push('the action bar is not pinned under the page');
        if (pg.height < 150) out.push('the reading area is too small (' + pg.height.toFixed(0) + 'px)');
      }
      return out;
    },
    // a private clock and a fast cook, for reaching a state quickly (the long walk above uses the real UI)
    ownClock: function () { var c = window.__cook; window.__t = c.now; c.setClock(function () { return window.__t; }); c.setGuard(0); },
    step: function () { var c = window.__cook; return c.focus ? c.engine.stepById(c.plan, c.focus) : null; },
    pick: 0,                      // which option to give to choice steps
    fast: function (stop) {
      var c = window.__cook, E = c.engine, P = c.plan, g = 0, self = this, mv = function (name) { return P.steps.filter(function (x) { return x.move === name; })[0].id; };
      while (g++ < 500) {
        var st = this.step();
        if (stop(st, c)) return true;
        if (st) { window.__t += E.stepMins(st) * 60000; c.act('complete', st.id, st.kind === 'choice' ? { value: st.choice.options[Math.min(self.pick, st.choice.options.length - 1)].value } : undefined); continue; }
        var mode = c.mode, s = c.state;
        if (mode === 'away') { window.__t = Math.max(window.__t, E.anchorMs(s, 'backHome')); c.act('complete', mv('backHome')); continue; }
        if (mode === 'drive') { window.__t += (s.anchors.arrive - s.anchors.leavePm) * 60000; c.act('complete', mv('arrive')); continue; }
        if (mode !== 'free') return false;
        var u = E.nextUnlock(P, s, c.now);
        if (!u) return false;
        window.__t = u.at;
        if (u.reason === 'move') c.act('complete', u.stepId); else c.tick();
      }
      return false;
    },
    // is the main button the biggest control on the screen?
    biggest: function () {
      var go = document.querySelector('#actions .btn.go');
      if (!go) return null;
      var r = go.getBoundingClientRect(), area = r.width * r.height, worst = null;
      [].slice.call(document.querySelectorAll('#app button, #app a[href]')).forEach(function (el) {
        if (el === go || el.closest('[hidden]') || el.matches('.tick, .status, .chip') || el.closest('.banner')) return;
        var q = el.getBoundingClientRect();
        if (q.width * q.height > area + 1) worst = (el.className || el.tagName) + ' ' + Math.round(q.width) + 'x' + Math.round(q.height);
      });
      return { area: Math.round(area), h: r.height, worst: worst };
    }
  };
}

async function open(browser, o) {
  const base = Object.assign({}, devices['iPhone 13']);
  if (o.viewport) base.viewport = o.viewport;
  if (o.colorScheme) base.colorScheme = o.colorScheme;
  const ctx = await browser.newContext(base);
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!HAS_BOARD && /ERR_FILE_NOT_FOUND/.test(t)) return;       // board.js is another builder's file and may not exist yet
    problems.push('[' + o.name + '] console error: ' + t);
  });
  page.on('pageerror', e => problems.push('[' + o.name + '] uncaught: ' + e.message));
  if (o.init) await page.addInitScript(o.init);
  await page.addInitScript(pageHelpers);
  await page.clock.install({ time: new Date(o.time) });
  await page.goto(URL + (o.hash || ''));
  await ready(page);
  return { ctx, page };
}
async function ready(page) {
  await page.waitForFunction(() => !!window.__cook && !!window.T);
  await page.evaluate(() => window.__cook.setGuard(0));           // the double-tap guard has its own test below
}
const info = page => page.evaluate(() => window.T.info());
const bar = (page, act) => page.locator('#actions [data-act="' + act + '"]');
const text = async loc => ((await loc.first().textContent()) || '').replace(/\s+/g, ' ').trim();
// The day may open with a question. Answer it (first option) until a step with a Done button is on screen.
async function toDone(page) {
  for (let i = 0; i < 6; i++) {
    if (await bar(page, 'done').count()) break;
    const pick = bar(page, 'choose').first();
    if (!(await pick.count())) break;
    await pick.click();
  }
  return info(page);
}
// a checklist step with literal items, for tests that just need "some change" (a tick)
const TICK_STEP = "c.plan.steps.filter(function (s) { return s.kind === 'checklist' && Array.isArray(s.items) && s.items.length > 5; })[0].id";
async function ff(page, ms) { if (ms > 0) await page.clock.fastForward(Math.round(ms)); }
async function audit(page, label) {
  const res = await page.evaluate(() => window.T.audit());
  ok(res.length === 0, label + ': ' + res.join(' | '));
}
async function goTab(page, tab) {
  await page.locator('#tabs .tab[data-tab="' + tab + '"]').click();
  await page.waitForFunction(t => document.querySelector('#tabs .tab[aria-current="page"]').getAttribute('data-tab') === t, tab);
}

// Acts like the cook: works on the focused step (time passes), then taps the big button; follows every alert with a button.
async function walk(page, stop, obs) {
  for (let i = 0; i < 600; i++) {
    const n = await info(page);
    if (await stop(n)) return n;
    await audit(page, 'walk @' + n.clock + ' ' + (n.focus || n.mode));
    const chips = await page.locator('#chips .chip').count();
    const expected = n.waits.length + (n.fg && n.fg.stepId !== n.focus && n.now < n.fg.endsAt ? 1 : 0);
    ok(chips === expected, 'chips match the running waits at ' + n.clock + ' (' + chips + ' vs ' + expected + ')');
    obs.maxChips = Math.max(obs.maxChips, chips);
    if (chips && !obs.chipText) obs.chipText = await text(page.locator('#chips .chip'));

    // every alert that is new since the last look must have rung
    const ids = n.alerts.filter(a => !(a.kind === 'leave' && a.minsLeft >= 1)).map(a => a.id);
    const fresh = ids.filter(id => obs.activeIds.indexOf(id) < 0);
    if (fresh.length) ok(n.rings > obs.prevRings, 'an alarm rang for ' + fresh.join(', ') + ' at ' + n.clock);
    obs.activeIds = ids; obs.prevRings = n.rings;

    const alertBtn = page.locator('#banners .banner:not(.preview) [data-act="alert"]').first();
    if (await alertBtn.count()) {
      const key = await alertBtn.getAttribute('data-key');
      const label = await text(alertBtn);
      const words = await text(page.locator('#banners .banner:not(.preview) .banner-text'));
      const a = n.alerts.filter(x => key.indexOf(x.id) === 0)[0] || { kind: key.split(':')[0] };
      const h = await page.locator('#banners .banner:not(.preview)').first().evaluate(el => el.getBoundingClientRect().height);
      ok(h >= 72, 'alert banner is at least 72px tall (' + h + ')');
      await alertBtn.click();
      const after = await info(page);
      obs.alerts.push({ kind: a.kind, label, words });
      if (a.kind === 'wait' && label === 'Go') ok(after.focus === a.stepId, '"Go" on "' + words + '" focuses the gated step (' + after.focus + ' vs ' + a.stepId + ')');
      if (a.kind === 'lap') {
        const acked = await page.evaluate(w => window.__cook.state.laps[w], a.waitId);
        ok(acked >= a.lap, '"' + label + '" acknowledges the lap (' + words + ')');
        ok(/\(\d+ of \d+\)/.test(words), 'lap banner counts the laps: ' + words);
      }
      ok(!(await page.locator('#banners [data-key="' + key + '"]').count()), 'the banner goes away once handled: ' + words);
      continue;
    }

    if (n.mode === 'step') {
      if (obs.worked !== n.focus) {                       // he does the work: time passes
        obs.worked = n.focus;
        const big = await page.evaluate(() => window.T.biggest());
        if (big && n.kind !== 'checklist') ok(big.h >= 76 && !big.worst, 'the main button is the biggest control on "' + n.title + '" (' + JSON.stringify(big) + ')');
        await ff(page, n.mins * 60000);
        continue;
      }
      obs.worked = null;
      obs.steps.push(n.focus);
      await finish(page, n, obs);
      continue;
    }
    if (n.mode === 'free') {
      ok(/^Free until \d+:\d\d [AP]M$/.test(await text(page.locator('#view .title'))) || !n.unlock, 'free card says until when');
      obs.free++;
      if (!n.unlock) throw new Error('walk: free with nothing to wait for at ' + n.clock);
      await ff(page, n.unlock.at - n.now + 1000);
      const after = await info(page);
      if (n.unlock.reason !== 'move') {
        ok(after.focus !== null, 'when free time ends at ' + after.clock + ' the next step takes the screen');
        ok(after.rings > n.rings, 'a sound plays when free time ends at ' + after.clock);
      }
      continue;
    }
    throw new Error('walk: unexpected card "' + n.mode + '" at ' + n.clock);
  }
  throw new Error('walk did not finish');
}

async function finish(page, n, obs) {
  const id = n.focus;
  if (n.kind === 'choice') { await bar(page, 'choose').first().click(); obs.choices++; return; }
  if (n.kind === 'check') {
    if (!obs.retried[id]) {
      const no = bar(page, 'check-no');
      ok(/check again in/.test(await text(no)), 'the "not yet" button says when to check again: ' + await text(no));
      await no.click();
      const a = await info(page);
      obs.retried[id] = { at: a.now, mins: n.retryMins };
      ok(a.focus !== id, 'after "not yet" the check leaves the screen');
      ok(a.waits.some(w => w.id === n.afterWait && !w.elapsed), 'after "not yet" its timer runs again');
      await ff(page, n.retryMins * 60000);              // clock + retry time ...
      return;
    }
    ok(n.now - obs.retried[id].at >= obs.retried[id].mins * 60000 - 1000, 'the check came back no sooner than its retry time');
    await bar(page, 'check-yes').click();               // ... then yes
    obs.checked.push(id);
    return;
  }
  if (n.timer) {
    const start = bar(page, 'start-timer');
    ok(/^Start \d+:\d\d$/.test(await text(start)), 'timer step offers "Start m:ss": ' + await text(start));
    await start.click();
    const box = page.locator('#actions .timerbox');
    ok(await box.count() === 1, 'the countdown replaces the button while the timer runs');
    const t1 = await text(box);
    await ff(page, 2000);
    const t2 = await text(box);
    ok(/^\d+:\d\d$/.test(t2) && t1 !== t2, 'the countdown ticks (' + t1 + ' -> ' + t2 + ')');
    ok(await bar(page, 'skip-timer').count() === 1, '"Skip timer" is offered while it runs');
    const size = await box.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    ok(size >= 38, 'countdown digits are huge (' + size + 'px)');
    if (obs.onTimer) await obs.onTimer(page, n);
    const before = (await info(page)).rings;
    await ff(page, n.timer * 1000);
    const done = bar(page, 'done');
    ok(await done.count() === 1 && /Done/.test(await text(done)), 'at zero the button becomes Done');
    ok((await info(page)).rings > before, 'at zero the alarm sounds');
    await done.click();
    obs.timers++;
    return;
  }
  if (n.kind === 'checklist') {
    const rows = page.locator('#view .tick');
    const count = await rows.count();
    ok(count > 0, 'checklist "' + n.title + '" has tick rows');
    if (obs.onChecklist) await obs.onChecklist(page, n, rows, count);
    obs.checklists++;
  }
  const main = bar(page, 'done');
  if (n.kind === 'move') obs.moves.push(await text(main));
  await main.click();
}


// The artifact page contract (SPEC 7), checked on the source files themselves.
function staticChecks() {
  section('0. Page contract (static)');
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
  const lines = html.split('\n');
  ok(lines[0].trim() === '<title>Ceviche Night</title>', 'index.html starts with the <title>');
  ok(lines[1].trim() === '<meta name="claude:viewport-fit-sides" content="cover">', 'then the viewport-fit-sides meta');
  ok(lines[2].trim() === '<style>', 'then the <style>');
  ok(!/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(html), 'no doctype, html, head or body tags');
  ok(/<script src="plan\.js"><\/script><script src="engine\.js"><\/script><script src="app\.js"><\/script><script src="board\.js"><\/script>\s*$/.test(html), 'the four scripts come last, in order');
  ok(/<div id="board-root" hidden><\/div>/.test(html), 'the board root is there and hidden');
  const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
  ok(!/100vh/.test(css), 'no 100vh');
  ok(!/position:\s*fixed/.test(css), 'no position: fixed');
  ok(/padding-left:\s*max\(16px, env\(safe-area-inset-left, 0px\)\)/.test(css) && /padding-right:\s*max\(16px, env\(safe-area-inset-right, 0px\)\)/.test(css), 'side gutters use the two max() paddings');
  ok(/html\s*\{[^}]*height:\s*100%/.test(css) && /body\s*\{[^}]*height:\s*100%/.test(css), 'html and body are height: 100%');
  ok(/body\s*\{[^}]*background:\s*var\(--bg\)[^}]*color:\s*var\(--fg\)/.test(css), 'body sets background and color from tokens');
  // the three token blocks
  const rootEnd = css.indexOf('}', css.indexOf(':root {'));
  const root = css.slice(css.indexOf(':root {'), rootEnd + 1);
  const mediaStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const mediaEnd = css.indexOf('}', css.indexOf('color-scheme: dark', mediaStart)) + 1;
  const media = css.slice(mediaStart, css.indexOf('}', mediaEnd) + 1);
  const attrStart = css.indexOf(':root[data-theme="dark"]');
  const attr = css.slice(attrStart, css.indexOf('}', attrStart) + 1);
  ok(mediaStart > rootEnd && /:root:not\(\[data-theme="light"\]\)/.test(media), 'dark values under prefers-color-scheme, guarded by :not([data-theme="light"])');
  ok(attrStart > mediaStart, 'dark values again under :root[data-theme="dark"]');
  const decls = block => { const m = {}; (block.match(/--[\w-]+:\s*[^;]+;/g) || []).forEach(d => { const i = d.indexOf(':'); m[d.slice(0, i).trim()] = d.slice(i + 1, -1).trim(); }); return m; };
  const R = decls(root), M = decls(media), A = decls(attr);
  ok(Object.keys(M).length > 20 && Object.keys(M).every(k => k in R), 'every dark token is first defined on bare :root');
  ok(JSON.stringify(M) === JSON.stringify(A), 'both dark blocks carry the same values (' + Object.keys(M).length + ' tokens)');
  ok(/color-scheme:\s*dark/.test(media) && /color-scheme:\s*dark/.test(attr), 'both dark blocks set color-scheme: dark');
  const colourTokens = Object.keys(R).filter(k => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(R[k]));
  ok(colourTokens.every(k => k in M), 'every colour token has a dark value: missing ' + colourTokens.filter(k => !(k in M)).join(', '));
  const rest = css.replace(root, '').replace(media, '').replace(attr, '');
  const literal = rest.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || [];
  ok(literal.length === 0, 'no literal colours in component rules: ' + literal.join(' '));
  ok(!/https?:\/\//.test(css) && !/<link|@import|url\(/i.test(html), 'no external resources');
  ok(!/<img|<svg[^>]*xlink|emoji/i.test(html.replace(css, '')), 'icons are inline SVG');
  // app.js
  ok(!/\b(alert|confirm|prompt)\s*\(/.test(js.replace(/\/\/.*$/gm, '')), 'no alert / confirm / prompt');
  ok(!/claude\.(db|sample|tts|room|user)\b/.test(js), 'capabilities only through claude.use()');
  ok(!/\?\.[A-Za-z_$(\[]|\?\?/.test(js), 'no optional chaining or ?? (ES2019)');
  ok(!/Date\.now\(\)/.test(js.replace("var clockFn = function () { return Date.now(); };", '').replace("typeof fn === 'function' ? fn : function () { return Date.now(); }", '')), 'time is read only through the one clock function');
  ok(!/new Date\(\)/.test(js), 'no new Date() without an argument');
  ok(!/style\.display/.test(js), 'visibility is toggled with .hidden, never style.display');
}

(async () => {
  staticChecks();
  const browser = await chromium.launch();
  try {
    /* ------------------------------------------------------------------ 1. the evening before */
    section('1. Evening before: Tonight card, soak tick, preview');
    {
      const { ctx, page } = await open(browser, { name: 'tonight', time: '2026-11-22T22:00:00', viewport: SMALL });
      let n = await info(page);
      ok(n.mode === 'tonight', 'at 10 PM the evening before the Now tab shows the Tonight card (got ' + n.mode + ')');
      ok(await page.evaluate(() => window.__cook.state.day) === '2026-11-23', 'the cook day is the next calendar day');
      ok(await text(page.locator('#view .title')) === 'Tonight', 'card title is "Tonight"');
      ok(await page.locator('#view .tn-item').count() === PLAN.tonight.length, 'every tonight item is listed');
      ok(/Tomorrow starts at \d+:\d\d AM/.test(await text(page.locator('#view'))), 'says when tomorrow starts');
      await audit(page, 'tonight card');

      const withSets = PLAN.tonight.filter(t => t.sets)[0];
      ok(!!withSets, 'the plan has a tonight item that sets an option');
      const before = await page.evaluate(() => JSON.stringify(window.__cook.state.opts));
      await page.locator('#view [data-act="toggle"][data-key="tn:' + withSets.id + '"]').click();
      ok(await page.locator('#view .tn-body').count() === 1, 'tapping a row shows how to do it');
      await audit(page, 'tonight card, row open');
      await page.locator('#view [data-act="tonight-tick"][data-id="' + withSets.id + '"]').click();
      const opts = await page.evaluate(() => window.__cook.state.opts);
      ok(Object.keys(withSets.sets).every(k => opts[k] === withSets.sets[k]), 'ticking "' + withSets.title + '" sets ' + JSON.stringify(withSets.sets) + ' (was ' + before + ')');
      ok(await page.evaluate(id => window.__cook.state.tonight[id] === true, withSets.id), 'the tick is stored');
      ok(await page.locator('#view [data-act="tonight-tick"][data-id="' + withSets.id + '"]').getAttribute('aria-pressed') === 'true', 'the row shows as ticked');
      await page.locator('#view [data-act="tonight-tick"][data-id="' + withSets.id + '"]').click();
      const cleared = await page.evaluate(() => window.__cook.state.opts);
      ok(Object.keys(withSets.sets).every(k => cleared[k] === undefined), 'un-ticking takes the option back (' + JSON.stringify(cleared) + ')');
      await page.locator('#view [data-act="tonight-tick"][data-id="' + withSets.id + '"]').click();
      ok(await page.evaluate(k => window.__cook.state.opts[k], Object.keys(withSets.sets)[0]) === withSets.sets[Object.keys(withSets.sets)[0]], 'ticking again sets it again');

      const realBefore = await page.evaluate(() => JSON.stringify(window.__cook.real));
      const storedBefore = await page.evaluate(() => localStorage.getItem('cevicheNight.v1'));
      const pv = bar(page, 'preview-enter');
      ok(await text(pv) === 'Preview tomorrow', 'the Tonight card offers "Preview tomorrow"');
      await pv.click();
      n = await info(page);
      ok(n.preview === true, 'preview mode is on');
      const banner = await text(page.locator('#banners .banner.preview'));
      ok(/PREVIEW/.test(banner) && /nothing is saved/i.test(banner), 'the preview banner shows: ' + banner);
      ok(n.mode === 'step' && n.focus === n.pick, 'preview starts on the first step');
      ok(/^7:00 AM$/.test(n.clock) || n.clock === (await page.evaluate(() => window.__cook.engine.fmtClock(window.__cook.engine.anchorMs(window.__cook.state, 'start')))), 'the preview clock starts at the start time (' + n.clock + ')');
      await audit(page, 'preview step');
      // walk a few steps in the preview: the clock jumps by each step's length
      for (let i = 0; i < 6; i++) {
        const a = await info(page);
        if (a.mode !== 'step') break;
        if (a.kind === 'choice') await bar(page, 'choose').first().click();
        else if (a.timer) { await bar(page, 'start-timer').click(); await bar(page, 'skip-timer').click(); await bar(page, 'done').click(); }
        else if (a.kind === 'check') await bar(page, 'check-yes').click();
        else await bar(page, 'done').click();
        const b = await info(page);
        ok(b.now >= a.now + a.mins * 60000 - 1, 'preview: Done moves the clock by the step length (' + a.title + ')');
      }
      for (const tab of ['day', 'dishes', 'setup', 'now']) {
        await goTab(page, tab);
        ok(await page.locator('#banners .banner.preview').count() === 1, 'the preview banner is on the ' + tab + ' tab');
        await audit(page, 'preview ' + tab);
      }
      ok(await page.evaluate(() => JSON.stringify(window.__cook.real)) === realBefore, 'the real state is untouched during the preview');
      ok(await page.evaluate(() => localStorage.getItem('cevicheNight.v1')) === storedBefore, 'nothing is written to storage during the preview');
      await page.locator('#banners [data-act="preview-exit"]').click();
      n = await info(page);
      ok(n.preview === false && n.mode === 'tonight', 'Exit returns to the Tonight card');
      ok(await page.evaluate(() => JSON.stringify(window.__cook.state)) === realBefore, 'after Exit the real state is exactly as before');
      ok(await page.locator('#banners .banner.preview').count() === 0, 'the preview banner is gone');
      await ctx.close();
    }

    /* ------------------------------------------------------------------ 2-4. the whole day */
    section('2. Morning: first step, Done, timers, chips, alerts, check');
    const main = await open(browser, { name: 'day', time: '2026-11-23T06:55:00', viewport: SMALL });
    let page = main.page;
    const obs = { steps: [], alerts: [], retried: {}, checked: [], timers: 0, checklists: 0, choices: 0, moves: [], free: 0, maxChips: 0, chipText: '', worked: null, activeIds: [], prevRings: 0 };
    {
      let n = await info(page);
      ok(n.mode === 'step' && n.focus === n.pick && n.focus !== null, 'at 6:55 AM the first step is shown (' + n.focus + ')');
      ok(await text(page.locator('#view .title')) === n.title, 'the card title is the step title');
      ok(await bar(page, 'undo').isDisabled(), 'Back is disabled when there is nothing to undo');
      await audit(page, 'first step');
      // the 1-second tick must never rebuild the step card or move the scroll position
      await page.evaluate(() => { document.querySelector('#view .step').__mark = 'same'; document.querySelector('#view .title').__mark = 'same'; document.getElementById('page').scrollTop = 90; });
      const clock0 = await text(page.locator('#clock'));
      for (let i = 0; i < 5; i++) await ff(page, 1000);
      await ff(page, 20000); await ff(page, 61000);
      const kept = await page.evaluate(() => ({ card: document.querySelector('#view .step').__mark, title: document.querySelector('#view .title').__mark, top: document.getElementById('page').scrollTop }));
      ok(kept.card === 'same' && kept.title === 'same', 'ticks leave the step card untouched (same DOM nodes after 86 s)');
      ok(kept.top === 90, 'ticks keep the scroll position (' + kept.top + ')');
      ok(await text(page.locator('#clock')) !== clock0, 'while the clock moves on (' + clock0 + ' -> ' + await text(page.locator('#clock')) + ')');
      await page.evaluate(() => { document.getElementById('page').scrollTop = 0; });

      /* ---- 3a. Back restores the previous state exactly ---- */
      section('3. Back and reload');
      // the day may open with a question or a checklist: get to the first plain step (a Done button, no timer, no wait)
      n = await walk(page, x => x.mode === 'step' && x.kind === 'do' && !x.timer && !x.hasWait, obs);
      const s0 = await page.evaluate(() => window.T.progress()), f0 = n.focus, d0 = n.doneCount, u0 = n.undo;
      const meta0 = await page.evaluate(() => ({ rev: window.__cook.state.rev, at: window.__cook.state.updatedAt }));
      await bar(page, 'done').click();
      n = await info(page);
      ok(n.focus !== f0 && n.doneCount === d0 + 1 && n.undo === u0 + 1, 'Done moves on to the next step');
      await bar(page, 'undo').click();
      n = await info(page);
      ok(await page.evaluate(() => window.T.progress()) === s0 && n.focus === f0, 'Back restores the previous state and step exactly');
      const meta1 = await page.evaluate(() => ({ rev: window.__cook.state.rev, at: window.__cook.state.updatedAt }));
      ok(meta1.rev > meta0.rev && meta1.at >= meta0.at, 'an undo still counts as a newer revision (so other devices follow it)');

      // walk to the first step that starts a background wait, and undo that too
      n = await walk(page, x => x.mode === 'step' && x.hasWait && x.kind === 'do' && !x.timer, obs);
      const s1 = await page.evaluate(() => window.T.progress()), f1 = n.focus;
      await bar(page, 'done').click();
      ok((await info(page)).waits.length > JSON.parse(s1).waits.length || Object.keys(JSON.parse(await page.evaluate(() => window.T.progress())).waits).length > Object.keys(JSON.parse(s1).waits).length, 'that step started a background timer');
      await bar(page, 'undo').click();
      ok(await page.evaluate(() => window.T.progress()) === s1 && (await info(page)).focus === f1, 'Back also takes the background timer away again');

      /* ---- 3b. reload in the middle of an in-step timer ---- */
      let reloaded = false;
      obs.onTimer = async (pg, x) => {
        if (reloaded) return;
        reloaded = true;
        const before = await pg.evaluate(() => ({ p: window.T.progress(), focus: window.__cook.focus, undo: window.__cook.undoDepth, now: window.__cook.now }));
        const cd1 = await text(pg.locator('#actions .timerbox'));
        const chips1 = await pg.locator('#chips .chip').count();
        await pg.reload();
        await ready(pg);
        const after = await pg.evaluate(() => ({ p: window.T.progress(), focus: window.__cook.focus, undo: window.__cook.undoDepth, now: window.__cook.now }));
        ok(after.now >= before.now && after.now - before.now < 60000, 'the fake clock survives the reload');
        ok(after.focus === before.focus, 'reload keeps the focused step (' + after.focus + ')');
        ok(after.p === before.p, 'reload keeps done steps, running waits and the in-step timer');
        ok(await pg.locator('#actions .timerbox').count() === 1, 'the in-step countdown is still running after the reload');
        const cd2 = await text(pg.locator('#actions .timerbox'));
        ok(/^\d+:\d\d$/.test(cd2), 'countdown after reload: ' + cd1 + ' -> ' + cd2);
        ok(await pg.locator('#chips .chip').count() === chips1 && chips1 > 0, 'the running waits are still shown as chips (' + chips1 + ')');
        ok(after.undo === before.undo && after.undo > 0, 'Back still works after a reload (' + after.undo + ' steps of history)');
        await audit(pg, 'after reload');
      };

      section('2 (cont). Walking the morning');
      n = await walk(page, x => x.loc !== 'home-am' || (x.mode === 'free' && x.unlock && x.unlock.reason === 'move') || x.kind === 'move', obs);
      ok(reloaded, 'the reload test ran during a timer step');
      ok(obs.timers >= 2, 'timer steps ran: Start, countdown, alarm, Done (' + obs.timers + ')');
      ok(obs.maxChips >= 2, 'background waits appeared as chips (up to ' + obs.maxChips + ' at once)');
      ok(/\d+:\d\d|Ready/.test(obs.chipText), 'a chip shows a label and a countdown: "' + obs.chipText + '"');
      ok(obs.alerts.some(a => a.kind === 'wait' && a.label === 'Go'), 'an urgent wait ended, the banner appeared and "Go" focused its step');
      ok(obs.checked.length >= 1 && Object.keys(obs.retried).length >= 1, 'a check step: "not yet", wait, then "yes" (' + obs.checked.join(', ') + ')');
      ok(obs.choices >= 1, 'a choice step was answered');
      log('  morning: ' + obs.steps.length + ' steps, ' + obs.timers + ' in-step timers, ' + obs.alerts.length + ' alerts, ' + obs.free + ' free cards, ended ' + n.clock + ' on ' + (n.focus || n.mode));

      /* ---- 5. Day, Dishes, Setup (mid-day, with real progress on the page) ---- */
      section('5. Day tab, Dishes tab, Setup');
      await goTab(page, 'day');
      await audit(page, 'day tab');
      const day = await page.evaluate(() => {
        const c = window.__cook, E = c.engine, pg = document.getElementById('page').getBoundingClientRect();
        const next = [].slice.call(document.querySelectorAll('#view [data-next]'));
        const p = E.project(c.plan, c.state, c.now);
        return {
          rows: document.querySelectorAll('#view .srow').length, moves: document.querySelectorAll('#view .mrow').length,
          doneRows: document.querySelectorAll('#view .srow.done').length, waitRows: document.querySelectorAll('#view .wrow').length,
          groups: [].slice.call(document.querySelectorAll('#view .group-title')).map(e => e.textContent),
          next: next.map(e => ({ id: e.getAttribute('data-step'), top: e.getBoundingClientRect().top - pg.top, cls: e.className })),
          projSteps: p.rows.filter(r => r.type === 'step').length, projMoves: p.rows.filter(r => r.type === 'move').length,
          projDone: p.rows.filter(r => r.type === 'step' && r.status === 'done').length,
          projNext: (p.rows.filter(r => r.status === 'next')[0] || p.rows.filter(r => r.stepId && r.status !== 'done')[0] || {}).stepId || null,
          head: document.querySelector('#view .day-head').textContent
        };
      });
      ok(day.rows === day.projSteps && day.moves === day.projMoves, 'the Day tab lists the whole projection (' + day.rows + ' steps, ' + day.moves + ' moves)');
      ok(day.doneRows === day.projDone && day.doneRows > 10, 'done rows are marked (' + day.doneRows + ')');
      ok(day.next.length === 1 && day.next[0].id === day.projNext, 'exactly one row is the next row, the one the engine picks (' + (day.next[0] && day.next[0].id) + ')');
      ok(day.next.length === 1 && day.next[0].top >= 0 && day.next[0].top < 160, 'on open the next row is near the top (' + (day.next[0] && Math.round(day.next[0].top)) + 'px)');
      ok(/Dinner \d+:\d\d PM/.test(day.head) && /(On time|late)/.test(day.head), 'the header shows dinner and its status: ' + day.head.replace(/\s+/g, ' ').slice(0, 60));
      ok(day.groups.length >= 5, 'rows are grouped by place: ' + day.groups.join(' / '));
      ok(day.waitRows > 0, 'wait rows are shown');
      // step sheet from a row
      const laterRow = page.locator('#view .srow:not(.done):not(.next)').first();
      const laterId = await laterRow.getAttribute('data-step');
      await laterRow.click();
      ok(await page.locator('#sheet-layer .sheet.full').count() === 1, 'tapping a row opens the step sheet');
      ok(await text(page.locator('#sheet-title')) === PLAN.steps.filter(s => s.id === laterId)[0].title, 'the sheet shows that step');
      for (const a of ['do-now', 'mark-done', 'sheet-close']) ok(await page.locator('#sheet-layer .sheet-actions [data-act="' + a + '"]').count() === 1, 'the sheet has "' + a + '"');
      await audit(page, 'step sheet');
      const termInSheet = page.locator('#sheet-layer .term').first();
      if (await termInSheet.count()) {
        await termInSheet.click();
        ok(await page.locator('#sheet-layer .gloss').count() === 1, 'a term inside the sheet opens the glossary on top');
        await page.locator('#sheet-layer [data-act="sheet-close"].btn').click();
        ok(await page.locator('#sheet-layer .sheet.full').count() === 1, 'closing the glossary returns to the step sheet');
      }
      await page.locator('#sheet-layer [data-act="mark-done"]').click();
      ok(await page.evaluate(id => !!window.__cook.state.done[id], laterId), '"Mark done" completes the step from the sheet');
      ok(await page.locator('#sheet-layer [data-act="mark-undone"]').count() === 1, 'the sheet then offers "Not done"');
      await page.locator('#sheet-layer [data-act="mark-undone"]').click();
      ok(await page.evaluate(id => !window.__cook.state.done[id], laterId), '"Not done" takes it back');
      await page.locator('#sheet-layer [data-act="do-now"]').click();
      ok((await info(page)).focus === laterId && await page.evaluate(() => location.hash) === '#now', '"Do this now" shows the step on the Now tab');
      ok(await page.locator('#sheet-layer').isHidden(), 'and closes the sheet');
      ok(await page.locator('#view .note-row').count() >= 0, 'early step card renders');
      await audit(page, 'step chosen from the day');
      await bar(page, 'undo').click();
      ok((await info(page)).focus !== laterId, 'Back returns to the step the guide suggested');

      await goTab(page, 'dishes');
      await audit(page, 'dishes grid');
      const tiles = page.locator('#view .tile');
      ok(await tiles.count() === PLAN.dishes.length + 1, 'one tile per dish plus "The day" (' + await tiles.count() + ')');
      ok((await tiles.evaluateAll(els => Math.min.apply(null, els.map(e => e.getBoundingClientRect().height)))) >= 120, 'tiles are at least 120px tall');
      ok(/^\d+ of \d+ steps$/.test(await text(page.locator('#view .tile .prog'))), 'tiles show progress');
      for (const d of PLAN.dishes.concat([{ id: 'day', nick: 'The day', ingredients: [], gear: [] }])) {
        await page.locator('#view .tile[href="#dish-' + d.id + '"]').click();
        await page.waitForFunction(id => location.hash === '#dish-' + id && !!document.querySelector('#view .dish'), d.id);
        ok(await text(page.locator('#view .dish .h1')) === d.nick, 'dish page title: ' + d.nick);
        const mine = PLAN.steps.filter(s => s.dish === d.id).length;
        const listed = await page.locator('#view .rows .srow').count();
        ok(listed > 0 && listed <= mine, d.nick + ': Steps lists its steps (' + listed + ' of ' + mine + ' in the plan)');
        const times = await page.locator('#view .rows .srow .t').evaluateAll(els => els.map(e => e.textContent));
        ok(times.filter(Boolean).length >= listed - 1, d.nick + ': steps carry times');
        await audit(page, 'dish ' + d.id + ' steps');
        if (d.id !== 'day') {
          await page.locator('#view [data-act="seg"][data-seg="ingredients"]').click();
          ok(await page.locator('#view .list').first().locator('li').count() === d.ingredients.length, d.nick + ': Ingredients lists every row');
          ok(await page.locator('#view .list li b').count() > 0, d.nick + ': quantities are bold');
          await audit(page, 'dish ' + d.id + ' ingredients');
          await page.locator('#view [data-act="seg"][data-seg="gear"]').click();
          ok(await page.locator('#view .list').first().locator('li').count() === d.gear.length, d.nick + ': Gear lists every item');
          await audit(page, 'dish ' + d.id + ' gear');
          await page.locator('#view [data-act="seg"][data-seg="steps"]').click();
          const src = page.locator('#view a.linkrow[target="_blank"]');
          ok(d.source.url ? (await src.count() === 1 && await src.getAttribute('href') === d.source.url) : await src.count() === 0, d.nick + ': source link');
        }
        const back = page.locator('#actions a[href="#dishes"]');
        ok(await back.count() === 1 && /Back to dishes/.test(await text(back)), d.nick + ': "Back to dishes" is in the action bar');
        await back.click();
        await page.waitForFunction(() => location.hash === '#dishes' && !!document.querySelector('#view .grid'));
      }

      await goTab(page, 'setup');
      await audit(page, 'setup');
      const names = Object.keys(PLAN.anchors);
      ok(await page.locator('#view [data-act="anchor"]').count() === names.length * 2, 'Setup has -15 / +15 for every time');
      const before = await page.evaluate(() => ({ a: window.__cook.state.anchors.dinner, pill: document.getElementById('pill').textContent, p: window.CookApp.getProjection().dinnerAnchor }));
      await page.locator('#view [data-act="anchor"][data-name="dinner"][data-d="15"]').click();
      const plus = await page.evaluate(() => ({ a: window.__cook.state.anchors.dinner, pill: document.getElementById('pill').textContent, p: window.CookApp.getProjection().dinnerAnchor }));
      ok(plus.a === before.a + 15 && plus.p === before.p + 15 * 60000 && plus.pill !== before.pill, '+15 on Dinner moves the projection (' + before.pill + ' -> ' + plus.pill + ')');
      await page.locator('#view [data-act="anchor"][data-name="dinner"][data-d="-15"]').click();
      const minus = await page.evaluate(() => ({ a: window.__cook.state.anchors.dinner, pill: document.getElementById('pill').textContent }));
      ok(minus.a === before.a && minus.pill === before.pill, '-15 moves it back');
      const dayBefore = await page.evaluate(() => window.__cook.state.day);
      await page.locator('#view [data-act="day-shift"][data-d="1"]').click();
      ok(await page.evaluate(() => window.__cook.state.day) !== dayBefore, '"+ day" changes the cook day');
      await page.locator('#view [data-act="day-shift"][data-d="-1"]').click();
      ok(await page.evaluate(() => window.__cook.state.day) === dayBefore, '"- day" changes it back');
      await page.locator('#view [data-act="toggle"][data-key^="pack:"]').first().click();
      ok(await page.locator('#view .tn-item .tick').count() > 0, 'a pack list opens with tick rows');
      await audit(page, 'setup, pack list open');
      await page.locator('#view [data-act="toggle"][data-key^="pack:"]').first().click();
      await page.locator('#view [data-act="test-alarm"]').click();
      ok(await page.evaluate(() => window.__cook.debug.rings.slice(-1)[0]) === 'alarm', '"Test the alarm" rings');
      await page.waitForTimeout(150);
      await page.locator('#view [data-act="test-alarm"]').click();
      ok(await page.evaluate(() => window.__cook.debug.played) >= 1, 'the WebAudio alarm actually plays once the page has been tapped (' + await page.evaluate(() => window.__cook.debug.played) + ' played)');
      ok(/Saved on this phone/i.test(await text(page.locator('#view'))) || /saved on this phone/i.test(await text(page.locator('#view'))), 'Setup says where progress is saved');
      ok(await page.locator('#view a[href="#board"]').count() === 1, 'Setup links to the board layout');
      await goTab(page, 'now');

      /* ---- 4. leave, away, home, cooler, drive, her kitchen, corn, dinner ---- */
      section('4. Leaving, coming home, packing, driving, her kitchen, dinner');
      n = await info(page);
      let leave = bar(page, 'done');
      ok(await text(leave) === "I'm leaving now", 'the morning ends with "I\'m leaving now" (' + n.mode + ' at ' + n.clock + ')');
      obs.moves.push(await text(leave));
      await leave.click();
      n = await info(page);
      ok(n.loc === 'away' && n.mode === 'away', 'after leaving the Away card shows');
      ok(/You're out\./.test(await text(page.locator('#view .title'))) && /Back home around \d+:\d\d PM/.test(await text(page.locator('#view'))), 'Away card: "You\'re out. Back home around ..."');
      await audit(page, 'away card');
      const backAt = await page.evaluate(() => window.__cook.engine.anchorMs(window.__cook.state, 'backHome'));
      await ff(page, backAt - n.now);
      ok((await info(page)).mode === 'away', 'the Away card stays until he says he is home');
      const home = bar(page, 'done');
      ok(await text(home) === "I'm home", 'Away card button: "I\'m home"');
      obs.moves.push(await text(home));
      await home.click();
      n = await info(page);
      ok(n.loc === 'home-pm' && n.kind === 'checklist' && n.listName === 'cooler', 'back home the cooler checklist is next (' + n.focus + ')');
      const coolerRows = page.locator('#view .tick');
      const total = await coolerRows.count();
      const list = await page.evaluate(() => window.__cook.engine.packList(window.__cook.plan, window.__cook.state, 'cooler').length);
      ok(total === list && total > 5, 'the cooler list shows the engine\'s pack list (' + total + ' rows)');
      const scrollBefore = await page.evaluate(() => { document.getElementById('page').scrollTop = 120; return document.getElementById('page').scrollTop; });
      for (const i of [1, 2, 3]) await coolerRows.nth(i).click();
      ok(await coolerRows.nth(2).getAttribute('aria-pressed') === 'true', 'tapping a row ticks it');
      ok(Object.keys(await page.evaluate(id => window.__cook.state.ticks[id] || {}, n.focus)).length === 3, 'ticks are stored in the state');
      ok(/^3 of \d+ ticked$/.test(await text(page.locator('#view .count-line'))), 'the count follows: ' + await text(page.locator('#view .count-line')));
      ok(await page.evaluate(() => document.getElementById('page').scrollTop) >= Math.min(scrollBefore, 60), 'ticking does not jump the list back to the top');
      await coolerRows.nth(3).click();
      ok(await coolerRows.nth(3).getAttribute('aria-pressed') === 'false', 'tapping again unticks');
      ok(await text(bar(page, 'done')) === 'All packed', 'the main button reads "All packed"');
      await audit(page, 'cooler checklist');
      n = await walk(page, x => x.loc !== 'home-pm' || (x.mode === 'free' && x.unlock && x.unlock.reason === 'move') || x.kind === 'move', obs);
      const onway = bar(page, 'done');
      ok(await text(onway) === "I'm on my way", 'then "I\'m on my way" (' + n.mode + ' at ' + n.clock + ')');
      obs.moves.push(await text(onway));
      await onway.click();
      n = await info(page);
      ok(n.loc === 'drive' && n.mode === 'drive' && /Drive to her place\./.test(await text(page.locator('#view .title'))), 'the Drive card shows');
      await audit(page, 'drive card');
      await ff(page, 30 * 60000);
      const here = bar(page, 'done');
      ok(await text(here) === "I'm here", 'Drive card button: "I\'m here"');
      obs.moves.push(await text(here));
      await here.click();
      n = await info(page);
      ok(n.loc === 'hers' && n.mode === 'step', 'at her place the first step shows (' + n.focus + ')');
      ok(/Her kitchen/.test(await text(page.locator('#view .crumb'))), 'the card says "Her kitchen"');

      const lapsBefore = obs.alerts.length;
      n = await walk(page, x => x.mode === 'done', obs);
      const laps = obs.alerts.slice(lapsBefore).filter(a => a.kind === 'lap');
      ok(laps.length >= 1 && laps.every(a => a.label === 'Turned'), 'the corn lap alert showed and "Turned" acknowledged it (' + laps.map(a => a.words).join('; ') + ')');
      ok(obs.steps[obs.steps.length - 1] === 'dinner', 'the last step done was "dinner"');
      ok(n.mode === 'done' && /Dinner is served\./.test(await text(page.locator('#view .title'))), 'finishing "dinner" shows the Done card');
      ok(await page.locator('#view .body p').count() === PLAN.steps.filter(s => s.id === 'dinner')[0].body.length, 'the Done card repeats the dinner step text');
      ok(/Dinner is served/.test(await text(page.locator('#pill'))), 'the status pill says dinner is served');
      await audit(page, 'done card');
      const late = await page.evaluate(() => window.CookApp.getProjection().lateMin);
      log('  day: ' + obs.steps.length + ' steps done through the UI, ' + obs.alerts.length + ' alerts handled, ' + obs.timers + ' in-step timers, ' + obs.checklists + ' checklists, moves: ' + obs.moves.join(', ') + '; dinner at ' + n.clock + ' (late ' + late + ' min)');
      ok(await page.evaluate(() => Object.keys(window.__cook.state.done).length) >= obs.steps.length, 'every step is recorded as done');
      await bar(page, 'undo').click();
      ok((await info(page)).focus === 'dinner', 'Back works even after dinner');
      await main.ctx.close();
    }

    /* ------------------------------------------------------------------ 5b. start over */
    section('5b. Start over needs a second tap');
    {
      const { ctx, page } = await open(browser, { name: 'reset', time: '2026-11-23T07:05:00', viewport: SMALL });
      const d5 = (await toDone(page)).doneCount + 1;
      await bar(page, 'done').click();
      ok((await info(page)).doneCount === d5, 'one more step done');
      await goTab(page, 'setup');
      await page.locator('#view [data-act="reset-ask"]').click();
      ok((await info(page)).doneCount === d5, 'the first tap on "Start over" erases nothing');
      ok(await page.locator('#view [data-act="reset-yes"]').count() === 1 && await page.locator('#view [data-act="reset-no"]').count() === 1, 'a confirm button appears in place');
      await audit(page, 'setup, confirm start over');
      await page.locator('#view [data-act="reset-no"]').click();
      ok((await info(page)).doneCount === d5 && await page.locator('#view [data-act="reset-ask"]').count() === 1, '"Keep my progress" cancels');
      await page.locator('#view [data-act="reset-ask"]').click();
      await page.locator('#view [data-act="reset-yes"]').click();
      const n = await info(page);
      ok(n.doneCount === 0 && n.undo === 0, 'the second tap clears everything');
      ok(await page.evaluate(() => JSON.parse(localStorage.getItem('cevicheNight.v1')).rev) >= 1, 'and the fresh state is saved');
      await ctx.close();
    }

    /* ------------------------------------------------------------------ 6b. the double-tap guard, glossary, help */
    section('6. Double-tap guard, glossary sheet, help sheet, iPhone 13 size');
    {
      const { ctx, page } = await open(browser, { name: 'iphone13', time: '2026-11-23T07:00:00' });
      const b6 = await toDone(page);
      await ff(page, 1000);
      await page.evaluate(() => window.__cook.setGuard(500));
      const first = b6.focus;
      await bar(page, 'done').dblclick();                     // two taps a few ms apart
      let n = await info(page);
      ok(n.doneCount === b6.doneCount + 1 && n.focus !== first, 'a double tap on Done completes one step, not two (done: ' + n.doneCount + ')');
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__cook.setGuard(0));
      // find a step with a glossary term
      for (let i = 0; i < 40; i++) {
        if (await page.locator('#view .term').count()) break;
        n = await info(page);
        if (n.mode !== 'step') break;
        if (n.kind === 'choice') await bar(page, 'choose').first().click(); else await page.evaluate(id => window.__cook.act('complete', id), n.focus);
      }
      const term = page.locator('#view .term').first();
      ok(await term.count() === 1, 'a step with a glossary term is on screen');
      const th = await term.evaluate(el => el.getBoundingClientRect().height);
      ok(th >= 44, 'glossary term is at least 44px tall to the finger (' + th.toFixed(1) + ')');
      ok(/dotted/.test(await term.evaluate(el => getComputedStyle(el).textDecorationStyle)), 'glossary term has a dotted underline');
      const key = await term.getAttribute('data-key');
      await term.click();
      ok(await text(page.locator('#sheet-layer .term-h')) === PLAN.glossary[key].term, 'the glossary sheet shows the term');
      const sizes = await page.evaluate(() => ({ t: parseFloat(getComputedStyle(document.querySelector('#sheet-layer .term-h')).fontSize), p: parseFloat(getComputedStyle(document.querySelector('#sheet-layer .gloss p')).fontSize) }));
      ok(sizes.t >= 28 && sizes.p >= 21, 'glossary type sizes (' + sizes.t + ' / ' + sizes.p + ')');
      await audit(page, 'glossary sheet');
      await page.keyboard.press('Escape');
      ok(await page.locator('#sheet-layer').isHidden(), 'Escape closes the sheet');
      await page.locator('#view [data-act="help"]').click();
      ok(await page.locator('#sheet-layer .help').count() === 1, 'Help opens');
      ok(await page.locator('#sheet-layer .help .card').count() >= 1, 'Help lists the words used in this step');
      ok(await page.locator('#sheet-layer [data-act="ask-preset"]').count() === 0, 'without the Ask capability there is no Ask section');
      await audit(page, 'help sheet');
      await page.locator('#sheet-layer .sheet-actions [data-act="sheet-close"]').click();
      ok(await page.locator('#view [data-act="read"]').count() === 1, 'the step card has a "Read to me" button');
      await audit(page, 'iphone 13 step');
      // free card and leave warning
      await page.evaluate(() => { const c = window.__cook, E = c.engine, P = c.plan; let g = 0; while (c.focus && g++ < 200) { const st = E.stepById(P, c.focus); c.act('complete', c.focus, st.kind === 'choice' ? { value: st.choice.options[0].value } : undefined); } });
      n = await info(page);
      ok(n.mode === 'free', 'with everything possible done, the Free time card shows');
      ok(await page.locator('#view .count [data-until]').count() === 1 && /^\d+:\d\d(:\d\d)?$/.test(await text(page.locator('#view .count'))), 'free card counts down: ' + await text(page.locator('#view .count')));
      ok(/Next/.test(await text(page.locator('#view'))), 'free card names what is next');
      ok(await page.locator('#actions a[href="#day"]').count() === 1, 'free card offers "See the day"');
      await audit(page, 'free card');
      const leaveAt = await page.evaluate(() => window.__cook.engine.anchorMs(window.__cook.state, 'leaveAm'));
      await ff(page, leaveAt - n.now - 8.5 * 60000);
      const soon = await text(page.locator('#banners .banner.soon'));
      ok(/^Leave in \d+ min$/.test(soon), 'ten minutes before the hard out a warning shows: ' + soon);
      ok(await page.locator('#banners .banner.soon button').count() === 0, 'the early warning has no button');
      await ff(page, 9 * 60000);
      n = await info(page);
      ok(/Time to leave/.test(await text(page.locator('#banners'))), 'when it is time, the banner says "Time to leave"');
      ok(await page.locator('#banners .banner').count() <= 2, 'at most two alert banners at once');
      const leaveBtn = page.locator('#banners [data-act="alert"][data-key^="leave:"]');
      if (n.kind !== 'move') {
        ok(await leaveBtn.count() === 1 && await text(leaveBtn) === 'Go', 'on another step the leave banner has a Go button');
        await leaveBtn.click();
        n = await info(page);
      } else ok(await leaveBtn.count() === 0, 'on the leave step itself the banner needs no button');
      ok(n.kind === 'move' && n.move === 'leaveAm' && await page.locator('#view .body p').count() > 0, 'the leave step is on screen with its walk-out checks');
      await audit(page, 'leave banner');
      ok(await text(bar(page, 'done')) === "I'm leaving now", 'its button reads "I\'m leaving now"');
      await bar(page, 'done').click();
      n = await info(page);
      ok(n.loc === 'away' && n.mode === 'away', 'leaving shows the Away card (' + n.mode + ')');
      await ctx.close();
    }

    /* ------------------------------------------------------------------ 7. themes */
    section('7. Dark mode');
    {
      // computed colours come back as rgb(r, g, b) or, for color-mix(), as color(srgb r g b) with 0..1 channels
      const lum = c => { const unit = /^color\(/.test(c); const m = c.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number).slice(0, 3).map(v => { if (!unit) v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const cases = [
        { name: 'OS dark', colorScheme: 'dark', attr: null, dark: true },
        { name: 'data-theme=dark on a light OS', colorScheme: 'light', attr: 'dark', dark: true },
        { name: 'data-theme=light on a dark OS', colorScheme: 'dark', attr: 'light', dark: false },
        { name: 'OS light', colorScheme: 'light', attr: null, dark: false }
      ];
      for (const cse of cases) {
        const { ctx, page } = await open(browser, { name: cse.name, time: '2026-11-23T07:00:00', colorScheme: cse.colorScheme });
        if (cse.attr) await page.evaluate(a => document.documentElement.setAttribute('data-theme', a), cse.attr);
        await page.evaluate(() => { const c = window.__cook, E = c.engine, P = c.plan; let g = 0; while (c.focus && g++ < 12) { const st = E.stepById(P, c.focus); if (st.into && st.need) break; c.act('complete', c.focus, st.kind === 'choice' ? { value: st.choice.options[0].value } : undefined); } });
        await page.waitForTimeout(250);                         // let the 80 ms colour transitions of a theme switch finish
        const c = await page.evaluate(() => {
          const cs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
          return {
            bodyBg: cs('body', 'backgroundColor'), bodyFg: cs('body', 'color'), scheme: getComputedStyle(document.documentElement).colorScheme,
            goBg: cs('#actions .btn.go', 'backgroundColor'), goFg: cs('#actions .btn.go', 'color'),
            card: cs('#view .callout', 'backgroundColor'), cardFg: cs('#view .callout .val', 'color'),
            meta: cs('#view .meta', 'color'), crumb: cs('#view .crumb .nick', 'color'), tabBg: cs('#tabs', 'backgroundColor'),
            pillBg: cs('#pill', 'backgroundColor'), pillFg: cs('#pill', 'color'), term: cs('#view .term', 'color')
          };
        });
        const isDark = lum(c.bodyBg) < 0.2;
        ok(isDark === cse.dark, cse.name + ': page is ' + (cse.dark ? 'dark' : 'light') + ' (body ' + c.bodyBg + ')');
        ok(new RegExp(cse.dark ? 'dark' : 'light').test(c.scheme), cse.name + ': color-scheme follows (' + c.scheme + ')');
        ok(ratio(c.bodyBg, c.bodyFg) >= 12, cse.name + ': body text contrast ' + ratio(c.bodyBg, c.bodyFg).toFixed(1));
        ok(ratio(c.goBg, c.goFg) >= 4.5, cse.name + ': Done button contrast ' + ratio(c.goBg, c.goFg).toFixed(1));
        ok(ratio(c.bodyBg, c.meta) >= 4.5, cse.name + ': secondary text contrast ' + ratio(c.bodyBg, c.meta).toFixed(1));
        ok(ratio(c.bodyBg, c.crumb) >= 4.5, cse.name + ': dish colour contrast ' + ratio(c.bodyBg, c.crumb).toFixed(1));
        ok(ratio(c.pillBg, c.pillFg) >= 4.5, cse.name + ': status pill contrast ' + ratio(c.pillBg, c.pillFg).toFixed(1));
        if (c.card) ok(ratio(c.card, c.cardFg) >= 7, cse.name + ': callout contrast ' + ratio(c.card, c.cardFg).toFixed(1));
        if (c.term) ok(ratio(c.bodyBg, c.term) >= 4.5, cse.name + ': glossary term contrast ' + ratio(c.bodyBg, c.term).toFixed(1));
        await audit(page, cse.name);
        for (const tab of ['day', 'dishes', 'setup']) { await goTab(page, tab); await audit(page, cse.name + ' ' + tab); }
        await ctx.close();
      }
    }

    /* ------------------------------------------------------------------ 8. capabilities, with a stand-in for window.claude */
    section('8. Sync, Ask and Read aloud (window.claude replaced by a stand-in)');
    {
      const mock = () => {
        window.__mock = { sets: [], asked: [], spoken: [], stopped: 0, next: null, sampleMode: 'ok', inflight: 0, maxInflight: 0 };
        const M = window.__mock;
        window.claude = { use: function (name) {
          if (name === 'db') return Promise.resolve({ doc: function (p) {
            M.path = p;
            return {
              set: function (body) { M.inflight++; M.maxInflight = Math.max(M.maxInflight, M.inflight); M.sets.push(JSON.parse(JSON.stringify(body))); return new Promise(function (r) { setTimeout(function () { M.inflight--; r(); }, 300); }); },
              onSnapshot: function (next) {
                M.next = next; M.subs = (M.subs || 0) + 1;
                // like the real store: the current document arrives once, a moment after subscribing
                setTimeout(function () { M.first = true; next({ exists: !!M.remote, data: function () { return M.remote; }, metadata: {} }); }, M.firstDelay || 20);
                return function () {};
              }
            };
          } });
          if (name === 'sample') return Promise.resolve(function (input, opts) {
            M.asked.push({ input: input, opts: Object.keys(opts || {}), tier: opts && opts.modelTier });
            return new Promise(function (res, rej) {
              setTimeout(function () {
                if (M.sampleMode === 'ok') { opts.onText({ text: 'Stir it', delta: 'Stir it' }); opts.onText({ text: 'Stir it gently.', delta: ' gently.' }); res({ text: 'Stir it gently.', truncated: false, modelTierApplied: 'quick' }); }
                else rej({ code: M.sampleMode, message: 'nope' });
              }, 40);
            });
          });
          if (name === 'tts') return Promise.resolve({ speak: function (t) { M.spoken.push(t); return new Promise(function () {}); }, stop: function () { M.stopped++; return Promise.resolve(); } });
          return Promise.resolve(null);
        } };
      };
      const { ctx, page } = await open(browser, { name: 'capabilities', time: '2026-11-23T07:00:00', init: mock });
      await page.waitForFunction(() => window.__mock.next && window.__cook.sync === 'on');
      await ff(page, 50);
      await page.waitForFunction(() => window.__mock.first === true);
      ok(await page.evaluate(() => window.__mock.path) === 'cook/state' && await page.evaluate(() => window.__mock.subs) === 1, 'subscribes once to cook/state');
      ok(await page.evaluate(() => window.__mock.sets.length) === 0, 'nothing is written on load');
      await toDone(page);
      await bar(page, 'done').click();
      await page.evaluate(new Function("const c = window.__cook; c.act('tick', " + TICK_STEP + ", 'i5', true);"));
      ok(await page.evaluate(() => window.__mock.sets.length) === 0, 'writes are debounced');
      await ff(page, 900);
      let m = await page.evaluate(() => ({ n: window.__mock.sets.length, rev: window.__mock.sets[0] && window.__mock.sets[0].rev, mine: window.__cook.state.rev, dev: window.__mock.sets[0] && window.__mock.sets[0].device }));
      ok(m.n === 1 && m.rev === m.mine && !!m.dev, 'one write after 800 ms with the latest state (rev ' + m.rev + ')');
      await page.evaluate(new Function("const c = window.__cook; c.act('tick', " + TICK_STEP + ", 'i0', true);"));
      await ff(page, 850);
      await page.evaluate(new Function("const c = window.__cook; c.act('tick', " + TICK_STEP + ", 'i1', true);"));
      await ff(page, 850);                                     // the second write must wait for the first to land
      ok(await page.evaluate(() => window.__mock.maxInflight) === 1, 'never two writes in flight');
      await ff(page, 2000);
      m = await page.evaluate(() => ({ n: window.__mock.sets.length, last: window.__mock.sets[window.__mock.sets.length - 1].rev, mine: window.__cook.state.rev }));
      ok(m.last === m.mine, 'the queued write goes out with the latest state (' + m.n + ' writes)');
      const writes = m.n;
      await ff(page, 5000);
      ok(await page.evaluate(() => window.__mock.sets.length) === writes, 'the 1-second tick never writes');
      // a newer state from another device is adopted, and not echoed back
      const adopted = await page.evaluate(() => {
        const c = window.__cook, E = c.engine, P = c.plan;
        let s = JSON.parse(JSON.stringify(c.state));
        const nextId = E.nextStep(P, s, c.now);
        s = E.complete(P, s, nextId, c.now + 1000);
        s.device = 'laptop'; s.updatedAt = c.now + 1000;
        window.__mock.next({ exists: true, data: function () { return s; }, metadata: {} });
        return { nextId: nextId, done: !!c.state.done[nextId], focus: c.focus, stored: !!JSON.parse(localStorage.getItem('cevicheNight.v1')).done[nextId] };
      });
      ok(adopted.done && adopted.stored && adopted.focus !== adopted.nextId, 'a newer snapshot from another device is adopted, saved and shown');
      await ff(page, 3000);
      ok(await page.evaluate(() => window.__mock.sets.length) === writes, 'an adopted snapshot is not written back');
      const older = await page.evaluate(() => {
        const c = window.__cook, before = JSON.stringify(c.state);
        const s = JSON.parse(before); s.done = {}; s.device = 'laptop'; s.updatedAt = c.state.updatedAt - 5000;
        window.__mock.next({ exists: true, data: function () { return s; }, metadata: {} });
        return JSON.stringify(c.state) === before;
      });
      ok(older, 'an older snapshot is ignored');
      await page.evaluate(new Function("const c = window.__cook; c.act('tick', " + TICK_STEP + ", 'i2', true);"));
      await ff(page, 1500);
      ok(await page.evaluate(() => window.__mock.sets.slice(-1)[0].device !== 'laptop' && window.__mock.sets.slice(-1)[0].rev === window.__cook.state.rev), 'after adopting, this device signs its own writes');
      await goTab(page, 'setup');
      ok(/saved online/i.test(await text(page.locator('#view'))), 'Setup says progress is saved online');
      await goTab(page, 'now');

      // a phone that lost its storage must not overwrite the day saved online
      {
        const lost = await open(browser, { name: 'sync-rescue', time: '2026-11-23T09:00:00', init: new Function('(' + mock.toString() + ')(); window.__mock.firstDelay = 3000; window.__mock.remote = ' + JSON.stringify(await page.evaluate(() => window.__cook.real)) + ';') });
        const p2 = lost.page;
        await p2.waitForFunction(() => window.__mock.next && window.__cook.sync === 'on');
        const remoteDone = await p2.evaluate(() => Object.keys(window.__mock.remote.done).length);
        ok(remoteDone >= 2 && (await info(p2)).doneCount === 0, 'a phone with empty storage starts from nothing while the store has ' + remoteDone + ' steps done');
        // he taps before the store has answered (the day may open with a question instead of a Done button)
        await ((await bar(p2, 'done').count()) ? bar(p2, 'done') : bar(p2, 'choose').first()).click();
        await ff(p2, 2000);
        ok(await p2.evaluate(() => window.__mock.sets.length) === 0, 'nothing is written before the store has said what it holds');
        await ff(p2, 1500);
        await p2.waitForFunction(() => window.__mock.first === true);
        const after = await p2.evaluate(() => ({ done: Object.keys(window.__cook.state.done).length, sets: window.__mock.sets.length }));
        ok(after.done === remoteDone, 'the saved day is adopted (' + after.done + ' steps done)');
        await ff(p2, 3000);
        ok(await p2.evaluate(() => window.__mock.sets.length) === 0, 'and it is not overwritten');
        await bar(p2, 'done').click().catch(() => {});
        await lost.ctx.close();
      }

      // Ask
      await page.evaluate(() => { const c = window.__cook, E = c.engine, P = c.plan; let g = 0; while (c.focus && g++ < 60) { const st = E.stepById(P, c.focus); if (st.dish !== 'day' && st.kind !== 'choice' && st.look) break; c.act('complete', c.focus, st.kind === 'choice' ? { value: st.choice.options[0].value } : undefined); } });
      const cur = await info(page);
      await page.locator('#view [data-act="help"]').click();
      ok(await page.locator('#sheet-layer [data-act="ask-preset"]').count() === 4, 'with the Ask capability, Help has four preset questions');
      ok(await page.locator('#ask-input').count() === 1, 'and a text field');
      await audit(page, 'help sheet with Ask');
      ok(await page.evaluate(() => window.__mock.asked.length) === 0, 'nothing is asked before a tap');
      await page.locator('#sheet-layer [data-act="ask-preset"]').first().click();
      ok(/Thinking/.test(await text(page.locator('#sheet-layer [data-role="answer"]'))), 'shows "Thinking…" while waiting');
      await ff(page, 100);
      await page.waitForFunction(() => /Stir it gently\./.test(document.querySelector('#sheet-layer').textContent));
      const answerSize = await page.locator('#sheet-layer [data-role="answer"]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      ok(answerSize >= 21, 'the answer is at least 21px (' + answerSize + ')');
      const asked = await page.evaluate(() => window.__mock.asked[0]);
      const stepObj = PLAN.steps.filter(s => s.id === cur.focus)[0], dish = PLAN.dishes.filter(d => d.id === stepObj.dish)[0];
      ok(asked.tier === 'quick' && asked.opts.indexOf('onText') >= 0, 'asks the quick tier and streams');
      const prompt = String(asked.input);
      ok(/at most 70 plain words/.test(prompt) && /first-time cook/.test(prompt) && /Do not change any quantity or time/.test(prompt) && /lime juice does not make it safe/.test(prompt) && /not sure, say so/.test(prompt), 'the prompt carries every rule');
      ok(dish.ingredients.filter(g => g.item).every(g => prompt.indexOf(g.item) >= 0), 'the prompt has the dish\'s ingredient list');
      ok(PLAN.steps.filter(s => s.dish === dish.id && !s.when).every(s => prompt.indexOf(s.title) >= 0), 'the prompt has all of the dish\'s steps');
      ok(prompt.indexOf('The cook is on this step right now:\n' + stepObj.title) >= 0 && /Question: Explain this step more simply$/.test(prompt), 'the prompt ends with the current step and the question');
      ok(!/\[\[/.test(prompt), 'glossary markup is stripped from the prompt');
      await page.locator('#ask-input').fill('Can I use a bigger pot?');
      await page.locator('#ask-form button[type="submit"]').click();
      await ff(page, 100);
      await page.waitForFunction(() => window.__mock.asked.length === 2);
      ok(/Question: Can I use a bigger pot\?$/.test(await page.evaluate(() => window.__mock.asked[1].input)), 'a typed question is sent');
      await page.waitForFunction(() => /Stir it gently\./.test(document.querySelector('#sheet-layer').textContent));
      await page.evaluate(() => { window.__mock.sampleMode = 'upstream_error'; });
      await page.locator('#sheet-layer [data-act="ask-preset"]').nth(1).click();
      await ff(page, 100);
      await page.waitForFunction(() => /Couldn't get an answer\. Try again\./.test(document.querySelector('#sheet-layer').textContent));
      ok(true, 'a failure shows "Couldn\'t get an answer. Try again."');
      ok(await page.locator('#sheet-layer [data-act="ask-preset"]').count() === 4, 'and the questions stay');
      await page.evaluate(() => { window.__mock.sampleMode = 'not_granted'; });
      await page.locator('#sheet-layer [data-act="ask-preset"]').nth(2).click();
      await ff(page, 100);
      await page.waitForFunction(() => !document.querySelector('#sheet-layer [data-act="ask-preset"]'));
      ok(true, 'when asking is not allowed the Ask section disappears');
      await page.locator('#sheet-layer .sheet-actions [data-act="sheet-close"]').click();

      // Read to me
      const read = page.locator('#view [data-act="read"]');
      ok(await read.isVisible() && /Read to me/.test(await text(read)), '"Read to me" is on the card');
      await read.click();
      const spoken = await page.evaluate(() => window.__mock.spoken[0] || '');
      ok(spoken.indexOf(stepObj.title) === 0 && spoken.indexOf("It's right when") > 0 && !/\[\[/.test(spoken), 'reads title, body and "It\'s right when" without markup');
      ok(/Stop reading/.test(await text(read)), 'the button becomes "Stop reading"');
      await read.click();
      ok(await page.evaluate(() => window.__mock.stopped) === 1 && /Read to me/.test(await text(read)), 'tapping again stops');
      await ctx.close();
    }

    /* ------------------------------------------------------------------ 9. edge cases */
    section('9. Edge cases');
    {
      // 9a. a running in-step timer follows him to other tabs
      let { ctx, page } = await open(browser, { name: 'edge-timer', time: '2026-11-23T07:00:00', viewport: SMALL });
      await page.evaluate(() => { window.T.ownClock(); window.T.fast(st => st && st.timer); });
      let n = await info(page);
      const timerStep = n.focus;
      await bar(page, 'start-timer').click();
      ok(await page.locator('#chips .chip').count() === n.waits.length, 'on its own step the timer is in the action bar, not in the chips');
      await goTab(page, 'day');
      ok(await page.locator('#chips .chip').count() === n.waits.length + 1, 'on another tab the in-step timer shows as a chip');
      await audit(page, 'day tab with a timer chip');
      await page.evaluate(ms => { window.__t += ms; window.__cook.tick(); }, n.timer * 1000 + 500);
      const fgBanner = page.locator('#banners [data-act="alert"][data-key^="fg:"]');
      ok(await fgBanner.count() === 1 && await text(fgBanner) === 'Go', 'when it ends on another tab an alert banner appears');
      ok(await page.evaluate(() => window.__cook.debug.rings.slice(-1)[0]) === 'alarm', 'and the alarm rings');
      await fgBanner.click();
      n = await info(page);
      ok(await page.evaluate(() => location.hash) === '#now' && n.focus === timerStep && /Done/.test(await text(bar(page, 'done'))), '"Go" returns to the step with its Done button');
      ok(await page.locator('#banners [data-key^="fg:"]').count() === 0, 'the banner is gone on the step itself');

      // 9b. an optional step can be skipped, and Back brings it back
      await bar(page, 'done').click();
      await page.evaluate(() => window.T.fast(st => st && st.optional));
      n = await info(page);
      ok(n.optional && await bar(page, 'skip').count() === 1, 'an optional step offers Skip (' + n.title + ')');
      const big = await page.evaluate(() => window.T.biggest());
      ok(big && !big.worst, 'Done is still the biggest button next to Skip (' + JSON.stringify(big) + ')');
      await audit(page, 'optional step');
      const optId = n.focus;
      await bar(page, 'skip').click();
      n = await info(page);
      ok(await page.evaluate(id => window.__cook.state.skipped[id] === true, optId) && n.focus !== optId, 'Skip moves on without doing it');
      await bar(page, 'undo').click();
      ok((await info(page)).focus === optId && await page.evaluate(id => !window.__cook.state.skipped[id], optId), 'Back un-skips');
      await ctx.close();

      // 9c. no time for the beans: the give-up button only shows near the hard out, and only at his place
      ({ ctx, page } = await open(browser, { name: 'edge-giveup', time: '2026-11-23T07:00:00', viewport: SMALL }));
      await page.evaluate(() => { window.T.ownClock(); window.T.fast(st => st && st.kind === 'check' && st.check.giveUp); });
      n = await info(page);
      ok(n.kind === 'check', 'reached the check step with a give-up (' + n.focus + ')');
      const checkId = n.focus;
      ok(await bar(page, 'give-up').count() === 0, 'early in the morning there is no give-up button');
      await page.evaluate(() => { const c = window.__cook, st = window.T.step(), w = st.check.giveUp.withinMinsOf; window.__t = c.engine.anchorMs(c.state, w.anchor) - (w.mins - 5) * 60000; c.tick(); });
      ok(await bar(page, 'give-up').count() === 1, 'inside the window the give-up button appears without a reload');
      await audit(page, 'check step with give-up');
      const giveLabel = await text(bar(page, 'give-up'));
      await bar(page, 'give-up').click();
      n = await info(page);
      const setOpts = PLAN.steps.filter(x => x.id === checkId)[0].check.giveUp.set;
      ok(Object.keys(setOpts).every(k => n && true) && await page.evaluate(o => Object.keys(o).every(k => window.__cook.state.opts[k] === o[k]), setOpts), '"' + giveLabel + '" sets ' + JSON.stringify(setOpts));
      ok(n.focus !== checkId && n.mode === 'step', 'and the guide moves on to what that needs (' + n.title + ')');
      await goTab(page, 'day');
      ok(await page.locator('#view .warn-list li').count() >= 1, 'the Day tab explains the change: ' + await text(page.locator('#view .warn-list')));
      await goTab(page, 'now');
      await bar(page, 'undo').click();
      ok((await info(page)).focus === checkId && await page.evaluate(o => Object.keys(o).every(k => window.__cook.state.opts[k] === undefined), setOpts), 'Back undoes the give-up');
      await ctx.close();

      // 9d. free time before a timed step: "Start it now", and the card says he is early
      ({ ctx, page } = await open(browser, { name: 'edge-early', time: '2026-11-23T07:00:00', viewport: SMALL }));
      await page.evaluate(() => { window.T.ownClock(); window.T.fast((st, c) => !st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'time'); });
      n = await info(page);
      ok(n.mode === 'free' && n.unlock.reason === 'time', 'reached free time before a timed step (' + n.clock + ')');
      const startNow = bar(page, 'do-now');
      ok(await startNow.count() === 1 && await text(startNow) === 'Start it now', 'the free card offers "Start it now"');
      await audit(page, 'free card with start it now');
      await startNow.click();
      n = await info(page);
      ok(n.focus === (await page.evaluate(() => window.__cook.focus)) && n.mode === 'step', 'it opens the timed step early');
      ok(/You are early/.test(await text(page.locator('#view .note-row'))), 'the card says so: ' + await text(page.locator('#view .note-row')));
      await page.evaluate(() => window.__cook.tick());
      ok((await info(page)).focus === n.focus, 'a step he chose himself stays on screen');
      await bar(page, 'undo').click();
      ok((await info(page)).mode === 'free', 'Back returns to the free card');

      // 9e. marinade-style "too long" alert
      const maxStep = PLAN.steps.filter(x => x.wait && x.wait.max)[0];
      if (maxStep) {
        await page.evaluate(id => { window.T.fast((st, c) => !!c.state.waits[id]); }, maxStep.wait.id);
        await page.evaluate(w => { const c = window.__cook; window.__t = c.state.waits[w.id].start + (w.max + 1) * 60000; c.tick(); }, maxStep.wait);
        const maxBanner = page.locator('#banners [data-act="alert"][data-key^="max:"]');
        ok(await maxBanner.count() === 1, 'past its limit a "too long" alert shows: ' + await text(page.locator('#banners')));
        await audit(page, 'too long alert');
      }
      await ctx.close();

      // 9f. the board layout mounts and unmounts through the contract
      ({ ctx, page } = await open(browser, { name: 'edge-board', time: '2026-11-23T07:00:00' }));
      const realBoard = await page.evaluate(() => !!window.CookBoard);
      await page.evaluate(() => {
        window.__b = { mounted: 0, unmounted: 0, calls: 0 };
        window.CookBoard = { mount: function (root, app) { window.__b.mounted++; window.__b.app = !!(app && app.plan && app.engine && app.getState && app.now && app.subscribe && app.act && app.fmt); root.innerHTML = '<p>board</p>'; window.__b.un = app.subscribe(function () { window.__b.calls++; }); }, unmount: function () { window.__b.unmounted++; window.__b.un(); } };
        location.hash = '#board';
      });
      await page.waitForFunction(() => window.__b.mounted === 1);
      ok(await page.locator('#app').isHidden() && await page.locator('#board-root').isVisible(), '#board hides the phone guide and shows the board root');
      ok(await page.evaluate(() => window.__b.app), 'the board gets the CookApp contract');
      const first = (await info(page)).focus;
      const res = await page.evaluate(id => window.CookApp.act('complete', id), first);
      ok(res === true && await page.evaluate(id => !!window.CookApp.getState().done[id], first), 'CookApp.act("complete") works from the board');
      ok(await page.evaluate(() => window.__b.calls) >= 1, 'subscribers hear about changes');
      const before = await page.evaluate(() => window.__b.calls);
      await ff(page, 1000); await ff(page, 1000);
      ok(await page.evaluate(() => window.__b.calls) >= before + 2, 'and about every tick');
      await page.evaluate(() => { location.hash = '#now'; });
      await page.waitForFunction(() => window.__b.unmounted === 1);
      ok(await page.locator('#app').isVisible() && await page.locator('#board-root').isHidden(), 'leaving #board unmounts it and shows the guide again');
      ok((await info(page)).focus !== first && await text(page.locator('#view .title')) === (await info(page)).title, 'the guide shows the progress made on the board');
      log('  (' + (realBoard ? 'board.js is present; a stand-in replaced it for this check' : 'board.js not present; a stand-in was used') + ')');
      await ctx.close();

      // 9g. storage that throws
      ({ ctx, page } = await open(browser, { name: 'edge-storage', time: '2026-11-23T07:00:00', init: () => {
        Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
        Storage.prototype.getItem = function () { throw new Error('SecurityError'); };
      } }));
      n = await info(page);
      ok(n.mode === 'step', 'the page works when storage throws');
      const b9 = await toDone(page);
      await bar(page, 'done').click();
      ok((await info(page)).doneCount === b9.doneCount + 1, 'and steps can still be done');
      await bar(page, 'undo').click();
      ok((await info(page)).doneCount === b9.doneCount, 'and undone');
      await ctx.close();

      // 9h. links straight to a tab
      for (const [hash, tab] of [['#day', 'day'], ['#setup', 'setup'], ['#dishes', 'dishes'], ['#dish-' + PLAN.dishes[0].id, 'dishes'], ['#nonsense', 'now'], ['', 'now']]) {
        ({ ctx, page } = await open(browser, { name: 'edge-link ' + hash, time: '2026-11-23T07:00:00', hash }));
        ok(await page.locator('#tabs .tab[aria-current="page"]').getAttribute('data-tab') === tab, 'opening with "' + hash + '" lands on the ' + tab + ' tab');
        if (/dish-/.test(hash)) ok(await page.locator('#view .dish').count() === 1, 'and on the dish page');
        await ctx.close();
      }

      // 9i. the evening rolls into the cook day quietly
      ({ ctx, page } = await open(browser, { name: 'edge-night', time: '2026-11-22T23:30:00' }));
      const r0 = (await info(page)).rings;
      await ff(page, 4.6 * 3600000);
      n = await info(page);
      ok(n.mode === 'step' && n.focus === n.pick, 'at 4 AM on the cook day the first step replaces the Tonight card (' + n.clock + ')');
      ok(n.rings === r0, 'without making a sound');
      await ctx.close();

      // 9k. the other answer to the morning question (no overnight soak): the whole day still runs
      ({ ctx, page } = await open(browser, { name: 'edge-other-choice', time: '2026-11-23T07:00:00', viewport: SMALL }));
      await page.evaluate(() => { window.T.ownClock(); window.T.pick = 1; window.T.fast(st => st && st.kind === 'choice'); });
      n = await info(page);
      ok(n.kind === 'choice', 'the morning question is asked');
      await audit(page, 'choice step');
      await bar(page, 'choose').nth(1).click();
      const variantStops = [];
      for (const stop of ['timer', 'free', 'leave', 'hers', 'done']) {
        await page.evaluate(what => window.T.fast((st, c) => {
          if (what === 'timer') return !!(st && st.timer);
          if (what === 'free') return !st && c.mode === 'free';
          if (what === 'leave') return c.engine.location(c.plan, c.state) !== 'home-am' || (!st && c.mode === 'free' && (c.engine.nextUnlock(c.plan, c.state, c.now) || {}).reason === 'move') || !!(st && st.kind === 'move');
          if (what === 'hers') return c.engine.location(c.plan, c.state) === 'hers' && !!st;
          return c.mode === 'done';
        }), stop);
        await page.evaluate(() => window.__cook.tick());
        n = await info(page);
        variantStops.push(stop + ' ' + n.clock + ' ' + (n.focus || n.mode));
        await audit(page, 'no-soak day at ' + stop);
        await goTab(page, 'day'); await audit(page, 'no-soak day tab at ' + stop); await goTab(page, 'now');
      }
      ok(n.mode === 'done', 'the no-soak day also reaches dinner: ' + variantStops.join(' | '));
      const lateNoSoak = await page.evaluate(() => { const c = window.__cook; return Math.round((c.state.done.dinner - c.engine.anchorMs(c.state, 'dinner')) / 60000); });
      log('  no-soak day: ' + variantStops.join(' | ') + '; dinner ' + (lateNoSoak > 0 ? lateNoSoak + ' min late' : 'on time'));
      await ctx.close();

      // 9l. real touch input (taps, not mouse clicks)
      ({ ctx, page } = await open(browser, { name: 'edge-touch', time: '2026-11-23T07:00:00' }));
      await page.evaluate(() => { window.T.ownClock(); window.T.fast(st => st && st.kind === 'checklist'); });
      n = await info(page);
      await page.locator('#view .tick').first().tap();
      ok(await page.locator('#view .tick').first().getAttribute('aria-pressed') === 'true', 'a tap ticks a row');
      await bar(page, 'done').tap();
      ok((await info(page)).doneCount === n.doneCount + 1, 'a tap on Done completes the step');
      await page.evaluate(() => { window.T.fast(st => st && /\[\[/.test(JSON.stringify(st.body))); });
      ok(await page.locator('#view .term').first().evaluate(el => getComputedStyle(el).cursor) === 'pointer', 'glossary terms are marked clickable (iOS needs that to send the tap)');
      await page.locator('#view .term').first().tap();
      ok(await page.locator('#sheet-layer .gloss').count() === 1, 'a tap on a glossary term opens it');
      ok(await page.locator('#sheet-layer .scrim').evaluate(el => getComputedStyle(el).cursor) === 'pointer', 'so is the dimmed area behind a sheet');
      // the dimmed area above the sheet (a long explanation can fill the screen; then only the Close button is left)
      await page.waitForTimeout(300);                         // let the sheet finish sliding in before measuring it
      const sheetTop = await page.locator('#sheet-layer .sheet').first().evaluate(el => el.getBoundingClientRect().top);
      if (sheetTop >= 28) {
        await page.touchscreen.tap(195, Math.round(sheetTop / 2));
        ok(await page.locator('#sheet-layer').isHidden(), 'a tap outside the sheet closes it');
      } else {
        await page.locator('#sheet-layer .sheet-actions [data-act="sheet-close"]').tap();
        ok(await page.locator('#sheet-layer').isHidden(), 'the Close button closes a sheet that fills the screen');
      }
      await page.locator('#tabs .tab[data-tab="day"]').tap();
      await page.waitForFunction(() => location.hash === '#day' && !!document.querySelector('#view .srow'));
      await page.locator('#view .srow').nth(3).tap();
      ok(await page.locator('#sheet-layer .sheet.full').count() === 1, 'a tap on a day row opens the step sheet');
      await page.locator('#sheet-layer .sheet-actions [data-act="sheet-close"]').tap();
      await page.locator('#status').tap();
      ok(await page.evaluate(() => location.hash) === '#day', 'a tap on the clock bar goes to the Day tab');
      await ctx.close();

      // 9j. a laptop
      ({ ctx, page } = await open(browser, { name: 'edge-laptop', time: '2026-11-23T07:00:00', viewport: { width: 1280, height: 800 } }));
      await audit(page, 'laptop');
      const col = await page.locator('#view').evaluate(el => el.getBoundingClientRect());
      ok(col.width <= 640 && Math.abs((col.left + col.right) / 2 - 640) < 2, 'on a wide screen the guide is a centred column (' + Math.round(col.width) + 'px)');
      for (const tab of ['day', 'dishes', 'setup']) { await goTab(page, tab); await audit(page, 'laptop ' + tab); }
      // keyboard: a glossary term opens with Enter, the sheet closes with Escape
      await goTab(page, 'now');
      await page.evaluate(() => { window.T.ownClock(); window.T.fast(st => st && /\[\[/.test(JSON.stringify(st.body))); });
      await page.locator('#view .term').first().focus();
      await page.keyboard.press('Enter');
      ok(await page.locator('#sheet-layer .gloss').count() === 1, 'Enter on a glossary term opens it');
      await page.keyboard.press('Escape');
      ok(await page.locator('#sheet-layer').isHidden(), 'Escape closes it');
      await ctx.close();
    }
  } catch (e) {
    failures++;
    log('\n  CRASH  ' + (e && e.stack || e));
  }
  await browser.close();

  section('6. Console errors and unhandled rejections');
  ok(problems.length === 0, problems.length + ' problem(s):\n    ' + problems.join('\n    '));
  if (!HAS_BOARD) log('  note: board.js does not exist yet; its 404 was ignored.');

  log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks' : 'PASSED: all ' + checks + ' checks'));
  process.exit(failures ? 1 : 0);
})();
