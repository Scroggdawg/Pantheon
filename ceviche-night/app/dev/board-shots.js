// Checks and screenshots of the board layout (#board): node ceviche-night/app/dev/board-shots.js [name-filter]
// Cooks through the day using the board's own buttons, with a fake clock, and writes dev/shots/board-*.png.
// Exits non-zero when a check fails. Nothing here hard-codes step ids, counts or texts from plan.js.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, [path.join(__dirname, 'build-preview.js')], { stdio: 'ignore' });
const URL = 'file://' + path.join(__dirname, 'preview.html');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] || '';

const BIG = { width: 1280, height: 800 }, MID = { width: 1024, height: 768 };
const DAY = '2026-11-23';
const at = hhmm => new Date(DAY + 'T' + hhmm + ':00').getTime();

let failures = 0, checks = 0;
const problems = [];
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FAIL  ' + msg); } return !!cond; }

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: o.viewport || BIG, colorScheme: o.scheme || 'light', deviceScaleFactor: 1, hasTouch: !!o.touch });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') problems.push('[' + o.name + '] console error: ' + m.text()); });
  page.on('pageerror', e => problems.push('[' + o.name + '] uncaught: ' + e.message));
  await page.clock.install({ time: new Date(o.time || DAY + 'T07:00:00') });
  await page.goto(URL + (o.hash === undefined ? '#board' : o.hash));
  await page.waitForFunction(() => !!window.__cook && !!window.CookBoard);
  if (o.hash === undefined) await page.waitForSelector('#board-root .bd');
  await page.evaluate(() => { window.CookBoard.guardMs = 0; window.__cook.setGuard(0); });
  if (o.hash !== undefined) await page.waitForTimeout(700);        // the phone guide's own double-tap guard reads real event times
  return { ctx, page };
}

const info = page => page.evaluate(() => {
  const a = window.CookApp, E = a.engine, P = a.plan, s = a.getState(), t = a.now(), f = a.getFocus();
  const st = f ? E.stepById(P, f) : null;
  return {
    now: t, clock: E.fmtClock(t), focus: f, title: st ? st.title : null, kind: st ? (st.kind || 'do') : null, mins: st ? (st.mins || 0) : 0,
    timer: st && st.timer ? st.timer.secs : 0, optional: !!(st && st.optional), hasWait: !!(st && st.wait), dish: st ? st.dish : null,
    hasTerm: !!st && /\[\[/.test(JSON.stringify([st.body, st.look, st.tip, st.warn])),
    available: st ? E.isAvailable(P, s, st, t) : false, loc: E.location(P, s), mode: window.__cook.mode, fg: s.fg,
    unlock: E.nextUnlock(P, s, t), pick: E.nextStep(P, s, t),
    waits: E.waitsView(P, s, t).map(w => ({ id: w.id, urgent: w.urgent, elapsed: w.elapsed, endsAt: w.endsAt, gated: w.gatedStepId, laps: w.laps.length })),
    alerts: a.getAlerts().map(x => ({ kind: x.kind, key: x.key, stepId: x.stepId || null })),
    doneCount: Object.keys(s.done).length, dinner: !!s.done.dinner, anchors: s.anchors,
    backHome: E.anchorMs(s, 'backHome'), leaveAm: E.anchorMs(s, 'leaveAm'), dinnerAt: E.anchorMs(s, 'dinner')
  };
});
const act = (page, b) => page.locator('#board-root .bd-actions [data-b="' + b + '"]');
async function ff(page, ms) { if (ms > 0) await page.clock.fastForward(Math.round(ms)); }

// what a board must never do, measured
const audit = page => page.evaluate(() => {
  const out = [], root = document.getElementById('board-root');
  const vis = el => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
  if (document.documentElement.scrollWidth > window.innerWidth + 0.5) out.push('the page scrolls sideways');
  if (document.documentElement.scrollHeight > window.innerHeight + 0.5) out.push('the page itself scrolls down');
  root.querySelectorAll('.bd-left, .bd-right, .bd-scroll, .bd-actions, .bd-head, .bd-up, .bd-alerts, .bd-timers').forEach(el => {
    if (vis(el) && el.scrollWidth > el.clientWidth + 1) out.push(el.className + ' is wider than its box (' + el.scrollWidth + ' > ' + el.clientWidth + ')');
  });
  root.querySelectorAll('.bd-actions button, .bd-alerts button, .bd-note button, button.bd-tick, button.bd-up-i, .bd-link, .bd-more button, .bd-gloss button').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) out.push('small control "' + el.textContent.trim().slice(0, 30) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  root.querySelectorAll('.bd-btn, .bd-alert button, .bd-note button').forEach(el => {
    if (vis(el) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) out.push('button text is clipped: "' + el.textContent.trim().slice(0, 40) + '"');
  });
  const go = root.querySelector('.bd-actions .bd-btn.is-go');
  if (go && vis(go) && go.getBoundingClientRect().height < 76) out.push('the main button is under 76px tall');
  const acts = root.querySelector('.bd-actions');
  if (acts && vis(acts) && acts.getBoundingClientRect().bottom > window.innerHeight + 0.5) out.push('the action bar is below the screen');
  // small type: the step itself must be big; chart labels may be smaller but never tiny
  root.querySelectorAll('.bd-left *').forEach(el => {
    if (!vis(el) || !el.childNodes.length) return;
    const own = [].some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim());
    if (own && parseFloat(getComputedStyle(el).fontSize) < 16.5) out.push('small type in the step panel: "' + el.textContent.trim().slice(0, 30) + '" ' + getComputedStyle(el).fontSize);
  });
  root.querySelectorAll('.bd-right *').forEach(el => {
    if (!vis(el) || !el.childNodes.length) return;
    const own = [].some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim());
    if (own && parseFloat(getComputedStyle(el).fontSize) < 11.5) out.push('tiny type on the timeline: "' + el.textContent.trim().slice(0, 30) + '" ' + getComputedStyle(el).fontSize);
  });
  return out;
});
async function auditOk(page, label) {
  const res = await audit(page);
  ok(res.length === 0, label + ': ' + res.join(' | '));
}

// Cooks like he would, but only through the board: follows every alert button, taps the big button, waits out free time.
async function walk(page, stop, o) {
  o = o || {};
  for (let i = 0; i < 900; i++) {
    const n = await info(page);
    if (await stop(n)) return n;
    const alertBtn = page.locator('#board-root .bd-alerts [data-b="alert"]').first();
    if (await alertBtn.count()) {
      if (o.alerts) o.alerts.push((await alertBtn.textContent()).trim());
      await alertBtn.click();
      continue;
    }
    if (n.focus) {
      if (!n.available) { await ff(page, 30000); continue; }
      if (n.kind === 'choice') { await act(page, 'choose').nth(o.choice || 0).click(); continue; }
      if (n.kind === 'checklist') {
        const rows = page.locator('#board-root .bd-scroll button.bd-tick');
        if (await rows.count()) await rows.first().click();
      }
      await ff(page, n.mins * 60000);
      if (n.timer) {
        if (await act(page, 'start').count()) await act(page, 'start').click();
        await ff(page, n.timer * 1000 + 700);
      }
      const before = n.doneCount;
      await act(page, 'done').click();
      const after = await info(page);
      if (!ok(after.doneCount > before || after.focus !== n.focus, 'the main button did something for "' + n.title + '" at ' + n.clock)) return after;
      continue;
    }
    if (n.mode === 'away') { await ff(page, n.backHome - n.now + 1000); await act(page, 'done').click(); continue; }
    if (n.mode === 'drive') { await ff(page, (n.anchors.arrive - n.anchors.leavePm) * 60000); await act(page, 'done').click(); continue; }
    if (n.mode === 'free' && n.unlock) { await ff(page, Math.max(1000, n.unlock.at - n.now + 1000)); continue; }
    return n;
  }
  ok(false, 'walk did not finish');
  return info(page);
}
// stop when the step on screen could not be finished before `t`, then let the clock run to exactly `t`
async function cookUntil(page, t) {
  await walk(page, n => n.now >= t || (n.focus && n.now + n.mins * 60000 + n.timer * 1000 > t) || (!n.focus && (!n.unlock || n.unlock.at > t)));
  const n = await info(page);
  await ff(page, t - n.now);
  return info(page);
}
async function shot(page, name) {
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(OUT, 'board-' + name + '.png') });
}
const geometry = page => page.evaluate(() => {
  const root = document.getElementById('board-root'), r = el => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  const now = root.querySelector('.bd-now'), bars = [].slice.call(root.querySelectorAll('.bd-bar'));
  const a = window.CookApp, p = a.getProjection();
  return {
    left: r(root.querySelector('.bd-left')), right: r(root.querySelector('.bd-right')), plot: r(root.querySelector('.bd-tlin')),
    nowShown: !now.hidden, nowX: now.getBoundingClientRect().left, lanes: root.querySelectorAll('.bd-lane').length, dishes: a.plan.dishes.length,
    bars: bars.length, rows: p.rows.filter(x => x.type === 'step' || x.type === 'move').length,
    waits: root.querySelectorAll('.bd-wait').length, waitRows: p.rows.filter(x => x.type === 'wait').length,
    doneBars: root.querySelectorAll('.bd-bar.is-done').length, doneRows: p.rows.filter(x => (x.type === 'step' || x.type === 'move') && x.status === 'done').length,
    maxDoneRight: Math.max.apply(null, [-1].concat(bars.filter(b => b.classList.contains('is-done')).map(b => b.getBoundingClientRect().left))),
    minTodoLeft: Math.min.apply(null, [1e9].concat(bars.filter(b => !b.classList.contains('is-done')).map(b => b.getBoundingClientRect().left))),
    focusBar: (root.querySelector('.bd-bar.is-focus') || { getAttribute: () => null }).getAttribute('data-step'),
    bands: [].map.call(root.querySelectorAll('.bd-band'), b => (b.classList.contains('is-out') ? 'out' : 'in')).join(','),
    title: (root.querySelector('.bd-title') || {}).textContent || '', clock: root.querySelector('.bd-clock').textContent, pill: root.querySelector('.bd-pill').textContent,
    dinner: root.querySelector('.bd-dinner-t').textContent, up: root.querySelectorAll('.bd-up-i').length,
    laneMinH: Math.min.apply(null, [].map.call(root.querySelectorAll('.bd-lane'), l => l.getBoundingClientRect().height)),
    barMinH: Math.min.apply(null, [1e9].concat(bars.map(b => b.getBoundingClientRect().height)))
  };
});

const SCENES = [
  { name: 'tonight', time: '2026-11-22T22:00:00', sizes: [BIG], run: async (page, v) => {
    ok(/Tonight/.test(await page.locator('#board-root .bd-title').textContent()), 'the evening before shows the Tonight jobs');
    await auditOk(page, 'tonight ' + v);
    await shot(page, 'tonight-' + v);
    const first = page.locator('#board-root button.bd-tick').first();
    await first.click();
    ok(await page.locator('#board-root button.bd-tick').first().getAttribute('aria-pressed') === 'true', 'a Tonight job can be ticked on the board');
    ok(await page.evaluate(() => Object.keys(window.CookApp.getState().tonight).length === 1), 'the tick is in the shared state');
  } },
  { name: 'start', sizes: [BIG, MID], run: async (page, v) => {
    const n = await info(page);
    ok(!!n.focus && await page.locator('#board-root .bd-title').textContent() === n.title, 'at the start the board shows the first step');
    const g = await geometry(page);
    ok(g.lanes === g.dishes + 1, 'one lane per dish plus one for the day (' + g.lanes + ')');
    ok(g.bars === g.rows && g.bars > 20, 'one bar per planned step (' + g.bars + ' bars, ' + g.rows + ' rows)');
    ok(g.waits === g.waitRows && g.waits > 3, 'one light bar per timer (' + g.waits + ')');
    ok(/in,out,in,out,in/.test(g.bands), 'bands: kitchen, out, kitchen, out, kitchen (' + g.bands + ')');
    ok(Math.abs(g.left.w / (g.left.w + g.right.w) - 1 / 3) < 0.02, 'the step takes the left third (' + Math.round(g.left.w) + ' of ' + Math.round(g.left.w + g.right.w) + ')');
    await auditOk(page, 'start ' + v);
    await shot(page, 'start-' + v);
  } },
  { name: '0740', sizes: [BIG, MID], schemes: ['light', 'dark'], run: async (page, v) => {
    const n = await cookUntil(page, at('07:40'));
    ok(n.clock === '7:40 AM', 'the clock reads 7:40 AM (' + n.clock + ')');
    ok(n.doneCount >= 5, 'several steps were done through the board (' + n.doneCount + ')');
    const g = await geometry(page);
    ok(/^7:40\s*AM$/.test(g.clock.trim()), 'the big clock shows 7:40 AM ("' + g.clock + '")');
    ok(/Dinner/.test(g.dinner) && g.pill.length > 3, 'dinner time and status are at the top ("' + g.dinner + '", "' + g.pill + '")');
    ok(g.title === n.title, 'the left panel shows the current step ("' + g.title + '")');
    ok(g.focusBar === n.focus, 'the current step is marked on the timeline');
    ok(g.doneBars === g.doneRows && g.doneBars === n.doneCount, 'done steps are dimmed (' + g.doneBars + ')');
    ok(g.nowShown && g.nowX > g.plot.l && g.nowX < g.plot.r, 'the now line is on the timeline');
    ok(g.maxDoneRight <= g.nowX + 2 && g.minTodoLeft >= g.nowX - 6, 'done bars are left of now, the rest right of it (' + Math.round(g.maxDoneRight) + ' <= ' + Math.round(g.nowX) + ' <= ' + Math.round(g.minTodoLeft) + ')');
    ok(n.waits.length >= 1 && await page.locator('#board-root .bd-timer').count() === n.waits.length, 'running timers are listed (' + n.waits.length + ')');
    ok(g.up >= 3, 'the next steps are listed in words (' + g.up + ')');
    ok(g.barMinH >= 14 && g.laneMinH >= 44, 'lanes and bars keep a readable height (lane ' + Math.round(g.laneMinH) + ', bar ' + Math.round(g.barMinH) + ')');
    await auditOk(page, '7:40 ' + v);
    await shot(page, '0740-' + v);
    if (v !== 'light-1280') return;

    // a tap on a later bar focuses that step; Back returns
    const target = await page.evaluate(() => {
      const a = window.CookApp, p = a.getProjection(), f = a.getFocus();
      const r = p.rows.filter(x => x.type === 'step' && x.status === 'later' && x.stepId !== f && a.engine.stepById(a.plan, x.stepId).dish !== 'day')[6];
      return r.stepId;
    });
    await page.locator('#board-root .bd-bar[data-step="' + target + '"]').click({ force: true });
    let m = await info(page);
    ok(m.focus === target, 'tapping a bar focuses that step');
    ok(await page.locator('#board-root .bd-note [data-b="focus"]').count() === 1, 'the board says what the plan would do next and offers a way back');
    await auditOk(page, 'picked step');
    await shot(page, 'picked-' + v);
    await page.locator('#board-root .bd-note [data-b="focus"]').click();
    m = await info(page);
    ok(m.focus === n.focus, 'the Go button returns to the plan\'s next step');
    // a done bar is only looked at
    const doneId = await page.evaluate(() => { const a = window.CookApp; return a.getProjection().rows.filter(x => x.type === 'step' && x.status === 'done')[2].stepId; });
    await page.locator('#board-root .bd-bar[data-step="' + doneId + '"]').click({ force: true });
    m = await info(page);
    ok(m.focus === n.focus, 'tapping a done bar leaves the current step alone');
    ok(/Done at/.test(await page.locator('#board-root .bd-note').first().textContent()), 'a done step shows when it was done');
    await shot(page, 'peek-' + v);
    await act(page, 'unpeek').click();
    ok(await page.locator('#board-root .bd-title').textContent() === n.title, 'Back to now shows the current step again');
    // a tap between two thin bars picks the nearest one
    const near = await page.evaluate(() => {
      const bars = [].slice.call(document.querySelectorAll('#board-root .bd-bar:not(.is-done)')), f = window.CookApp.getFocus();
      const b = bars.filter(x => x.getAttribute('data-step') !== f)[3], r = b.getBoundingClientRect(), row = b.parentElement.getBoundingClientRect();
      return { id: b.getAttribute('data-step'), x: r.left + r.width / 2, y: row.top + row.height / 2 };
    });
    await page.mouse.click(near.x, near.y);
    m = await info(page);
    ok(m.focus === near.id, 'a tap on a thin bar lands on it');
    await act(page, 'undo').click();
    m = await info(page);
    ok(m.focus === n.focus, 'Back undoes the pick');
    // the double-tap guard
    await page.evaluate(() => { window.CookBoard.guardMs = 500; });
    await page.waitForTimeout(650);                                  // the Back tap above also counts for the guard
    const before = (await info(page)).doneCount;
    await act(page, 'done').dblclick();
    await page.waitForTimeout(650);
    ok((await info(page)).doneCount === before + 1, 'a double tap on Done completes one step, not two');
    await page.evaluate(() => { window.CookBoard.guardMs = 0; });
    // leaving the board shows the phone guide in the same place
    const here = await info(page);
    await page.locator('#board-root .bd-link').click();
    await page.waitForFunction(() => !document.getElementById('app').hidden);
    ok(await page.locator('#board-root').isHidden() && await page.locator('#board-root').evaluate(el => el.innerHTML === ''), 'leaving unmounts the board');
    ok((await page.locator('#view .title').textContent()) === here.title, 'the phone guide shows the same step');
    await page.evaluate(() => { location.hash = '#board'; });
    await page.waitForSelector('#board-root .bd');
    ok(await page.locator('#board-root .bd-title').textContent() === here.title, 'and the board comes back to it');
  } },
  { name: 'timer', sizes: [MID], run: async (page, v) => {
    await walk(page, n => !!n.timer);
    await act(page, 'start').click();
    await ff(page, 6000);
    ok(await page.locator('#board-root .bd-timerbox').count() === 1 && /^\d+:\d\d$/.test((await page.locator('#board-root .bd-timerbox').textContent()).trim()), 'a started timer counts down in the action bar');
    await auditOk(page, 'timer ' + v);
    await shot(page, 'timer-' + v);
    const n = await info(page);
    await ff(page, n.timer * 1000);
    ok(/Done/.test(await act(page, 'done').textContent()), 'when the timer ends the button says Done');
    await shot(page, 'timer-done-' + v);
  } },
  { name: 'alert', sizes: [BIG], run: async (page, v) => {
    await walk(page, n => n.waits.some(w => w.urgent && !w.elapsed && w.gated !== n.focus) && n.kind === 'do' && !n.timer);
    const n = await info(page), w = n.waits.filter(x => x.urgent && !x.elapsed)[0];
    await ff(page, w.endsAt - n.now + 4000);
    ok(await page.locator('#board-root .bd-alert [data-b="alert"]').count() >= 1, 'an ended urgent timer raises an alert with a button');
    ok(await page.locator('#board-root .bd-timer.is-ready').count() >= 1, 'and its timer reads Ready');
    await auditOk(page, 'alert ' + v);
    await shot(page, 'alert-' + v);
    const rings = () => page.evaluate(() => window.__cook.debug.rings.length);
    const r0 = await rings();
    await page.clock.runFor(10000);
    const r1 = await rings();
    ok(r1 > r0, 'the alarm keeps ringing while the alert is open on the board (' + r0 + ' -> ' + r1 + ')');
    await page.locator('#board-root .bd-alert [data-b="alert"]').first().click();
    ok((await info(page)).focus === w.gated, 'Go opens the step the timer was for');
    ok(await page.locator('#board-root .bd-alert [data-b="alert"]').count() === 0, 'and the alert is answered');
    await page.clock.runFor(10000);
    ok(await rings() === r1, 'and the alarm is quiet after that');
  } },
  { name: 'term', sizes: [MID], run: async (page, v) => {
    await walk(page, n => n.hasTerm && n.kind === 'do');
    const title = await page.locator('#board-root .bd-title').textContent();
    await page.locator('#board-root .bd-scroll .bd-term').first().click();
    ok(await page.locator('#board-root .bd-gloss').isVisible() && (await page.locator('#board-root .bd-gloss h2').textContent()).length > 1, 'a tap on an underlined word explains it');
    await auditOk(page, 'word ' + v);
    await shot(page, 'word-' + v);
    await act(page, 'gloss-close').click();
    ok(await page.locator('#board-root .bd-gloss').count() === 0 && await page.locator('#board-root .bd-title').textContent() === title, 'Close puts the step back');
    await page.locator('#board-root .bd-scroll .bd-term').first().focus();
    await page.keyboard.press('Enter');
    ok(await page.locator('#board-root .bd-gloss').count() === 1, 'the word also opens with the keyboard');
    await page.keyboard.press('Escape');
    ok(await page.locator('#board-root .bd-gloss').count() === 0, 'and closes with Escape');
  } },
  { name: 'check', sizes: [MID], run: async (page, v) => {
    await walk(page, n => n.kind === 'check');
    ok(await act(page, 'retry').count() === 1 && await act(page, 'done').count() === 1, 'a check step has its two answers');
    await auditOk(page, 'check ' + v);
    await shot(page, 'check-' + v);
    const n = await info(page);
    await act(page, 'retry').click();
    const m = await info(page);
    ok(m.doneCount === n.doneCount && m.waits.some(w => w.gated === n.focus && !w.elapsed), 'the "not yet" answer restarts the timer');
  } },
  { name: 'longest', sizes: [MID], run: async (page, v) => {
    const id = await page.evaluate(() => window.CookApp.plan.steps.slice().sort((a, b) => JSON.stringify([b.body, b.need, b.into, b.look, b.warn, b.tip]).length - JSON.stringify([a.body, a.need, a.into, a.look, a.warn, a.tip]).length)[0].id);
    await walk(page, n => n.focus === id);
    await auditOk(page, 'longest step ' + v);
    await shot(page, 'longest-' + v);
    const more = page.locator('#board-root .bd-more');
    if (await more.isVisible()) {
      await more.locator('button').click();
      ok(await page.locator('#board-root .bd-scroll').evaluate(el => el.scrollTop > 0), 'More scrolls a long step');
      await shot(page, 'longest-more-' + v);
    }
  } },
  { name: 'free', sizes: [BIG], run: async (page, v) => {
    await walk(page, n => !n.focus && n.mode === 'free' && !!n.unlock && n.unlock.reason !== 'move');
    await ff(page, 20000);
    ok(/Free until/.test(await page.locator('#board-root .bd-title').textContent()), 'free time says until when');
    await auditOk(page, 'free ' + v);
    await shot(page, 'free-' + v);
  } },
  { name: 'leave', sizes: [MID], run: async (page, v) => {
    let n = await walk(page, n => !n.focus && n.mode === 'free' && !!n.unlock && n.unlock.reason === 'move');
    await auditOk(page, 'free before leaving ' + v);
    await shot(page, 'leave-free-' + v);
    await ff(page, n.leaveAm - n.now - 7.5 * 60000);
    ok(await page.locator('#board-root .bd-alert.is-soon').count() === 1, 'a soft warning shows before the hard out');
    await shot(page, 'leave-soon-' + v);
    n = await walk(page, n => n.mode === 'away');
    ok(/out/i.test(await page.locator('#board-root .bd-title').textContent()), 'while out the board says so');
    await ff(page, 40 * 60000);
    await auditOk(page, 'away ' + v);
    await shot(page, 'away-' + v);
  } },
  { name: 'hers', sizes: [BIG, MID], run: async (page, v) => {
    const n = await cookUntil(page, at('17:33'));
    ok(n.loc === 'hers', 'by 5:33 PM he is in her kitchen');
    const g = await geometry(page);
    ok(g.nowShown && g.nowX > g.plot.l + g.plot.w * 0.5, 'the now line is in the second half of the day');
    await auditOk(page, 'her kitchen ' + v);
    await shot(page, 'hers-' + v);
  } },
  { name: 'late', sizes: [BIG, MID], run: async (page, v) => {
    await cookUntil(page, at('16:20'));
    await ff(page, 3.6 * 3600000);                                   // he sat down for a long while
    const g = await geometry(page);
    ok(/late/i.test(g.pill) && /about/.test(g.dinner), 'a late dinner is said plainly ("' + g.dinner + '", "' + g.pill + '")');
    await auditOk(page, 'late ' + v);
    await shot(page, 'late-' + v);
  } },
  { name: 'dinner', sizes: [BIG], run: async (page, v) => {
    await cookUntil(page, at('19:10'));
    await auditOk(page, 'last half hour ' + v);
    await shot(page, 'last-half-hour-' + v);
    const n = await walk(page, n => n.dinner);
    ok(n.dinner, 'the whole day can be cooked from the board');
    ok(/Dinner is served/.test(await page.locator('#board-root .bd-title').textContent()), 'and it ends with dinner');
    await auditOk(page, 'dinner ' + v);
    await shot(page, 'dinner-' + v);
  } },
  { name: 'giveup', sizes: [MID], run: async (page, v) => {
    let n = await walk(page, n => n.kind === 'check' && n.loc === 'home-am');
    await ff(page, n.leaveAm - n.now - 30 * 60000);                   // he lost track of time; the beans are still firm
    if (await act(page, 'giveup').count() === 0) { console.log('  (this plan has no give-up on its first check; skipped)'); return; }
    await auditOk(page, 'give up ' + v);
    await shot(page, 'giveup-' + v);
    await act(page, 'giveup').click();
    n = await info(page);
    ok(await page.evaluate(() => { const a = window.CookApp; return Object.keys(a.getState().opts).length > 0; }), 'the give-up answer is stored');
    ok(await page.locator('#board-root .bd-warns li').count() >= 1, 'the board shows what changed in the plan');
    await ff(page, 20000);
    await auditOk(page, 'after give up ' + v);
    await shot(page, 'giveup-after-' + v);
    n = await walk(page, n => n.dinner);
    ok(n.dinner, 'the day still ends with dinner after giving up on the beans');
  } },
  { name: 'nosoak', sizes: [BIG], run: async (page, v) => {
    const log = [];
    let n = await walk(page, n => n.kind === 'choice');
    await auditOk(page, 'question ' + v);
    await shot(page, 'question-' + v);
    n = await walk(page, n => n.optional, { choice: 1, alerts: log });
    if (n.optional) {
      await shot(page, 'optional-' + v);
      const id = n.focus;
      await act(page, 'skip').click();
      ok(await page.evaluate(x => !!window.CookApp.getState().skipped[x], id), 'Skip skips an optional step');
    }
    n = await walk(page, n => n.dinner, { choice: 1, alerts: log });
    ok(n.dinner, 'the no-soak day can be cooked from the board');
    ok(log.some(x => /Turned|Stirred|OK|Done/.test(x)), 'lap alerts were answered on the way (' + log.filter(x => /Turned|Stirred|OK|Done/.test(x)).length + ')');
    // Whether a "Go" banner comes up on this route depends on the plan's timing (it needs an urgent timer to end while
    // another step is on screen). The alert scene above tests Go itself; here it is only counted.
    console.log('  no-soak day: ' + log.filter(x => x === 'Go').length + ' ended timers were followed with Go');
  } },
  { name: 'fgaway', sizes: [BIG], run: async (page, v) => {
    // start an in-step timer, look at another step, and let the timer end
    const n = await walk(page, n => n.timer >= 60);
    await act(page, 'start').click();
    const other = await page.evaluate(() => { const a = window.CookApp, f = a.getFocus(); return a.getProjection().rows.filter(x => x.type === 'step' && x.status === 'later' && x.stepId !== f)[1].stepId; });
    await page.locator('#board-root .bd-bar[data-step="' + other + '"]').click({ force: true });
    ok((await info(page)).focus === other, 'another step can be opened while a timer runs');
    ok(await page.locator('#board-root .bd-timer').count() === (await info(page)).waits.length + 1, 'the running in-step timer moves to the timer list');
    await ff(page, n.timer * 1000 + 2000);
    const banner = page.locator('#board-root .bd-alert', { hasText: 'The timer has finished' });
    ok(await banner.count() === 1, 'when it ends an alert says so');
    await shot(page, 'fg-ended-' + v);
    await banner.locator('[data-b="alert"]').click();
    ok((await info(page)).focus === n.focus && /Time is up/.test(await act(page, 'done').textContent()), 'Go returns to the timer step, which is ready to finish');
  } },
  { name: 'preview', time: '2026-11-22T22:00:00', hash: '', sizes: [BIG], run: async (page, v) => {
    await page.locator('#actions [data-act="preview-enter"]').click();
    ok(await page.evaluate(() => window.__cook.preview), 'preview starts on the phone guide');
    await page.evaluate(() => { location.hash = '#board'; });
    await page.waitForSelector('#board-root .bd');
    await page.evaluate(() => { window.CookBoard.guardMs = 0; });
    ok(await page.locator('#board-root .bd-alert.is-preview').count() === 1, 'the board says it is a preview');
    for (let i = 0; i < 4; i++) {
      const n = await info(page);
      if (n.kind === 'choice') await act(page, 'choose').first().click(); else await act(page, 'done').click();
    }
    ok(await page.evaluate(() => Object.keys(window.__cook.real.done).length === 0 && Object.keys(window.CookApp.getState().done).length >= 3), 'preview steps never touch real progress');
    await auditOk(page, 'preview ' + v);
    await shot(page, 'preview-' + v);
    await page.locator('#board-root [data-b="preview-exit"]').click();
    ok(await page.evaluate(() => !window.__cook.preview) && /Tonight/.test(await page.locator('#board-root .bd-title').textContent()), 'Exit returns to the real evening');
  } },
  { name: 'link', hash: '#setup', sizes: [BIG], run: async (page, v) => {
    await page.locator('#view a[href="#board"]').click();
    await page.waitForSelector('#board-root .bd');
    ok(await page.locator('#app').isHidden() && await page.locator('#board-root .bd-title').count() === 1, 'the Setup link opens the board');
    const res0 = await page.evaluate(() => {
      const B = window.CookBoard, root = document.getElementById('board-root'), out = {};
      try { B.mount(root, window.CookApp); B.mount(root, window.CookApp); out.remount = root.querySelectorAll('.bd').length; } catch (e) { out.remount = 'threw ' + e.message; }
      try { B.unmount(); B.unmount(); out.unmount = root.innerHTML === ''; } catch (e) { out.unmount = 'threw ' + e.message; }
      try { B.mount(root, {}); out.bad = 'no error'; } catch (e) { out.bad = 'threw'; }
      out.afterBad = root.innerHTML === '';
      B.mount(root, window.CookApp);
      out.back = root.querySelectorAll('.bd-title').length;
      return out;
    });
    ok(res0.remount === 1 && res0.unmount === true, 'mounting twice and unmounting twice is harmless (' + JSON.stringify(res0) + ')');
    ok(res0.bad === 'threw' && res0.afterBad === true && res0.back === 1, 'a bad contract is refused cleanly, so the phone guide stays up');
    // cheap: one second later only countdown text may change; with the clock frozen nothing changes at all
    await page.evaluate(() => { window.CookBoard.guardMs = 0; });
    await walk(page, n => n.waits.length >= 1 && n.kind === 'do' && !n.timer);
    const res = await page.evaluate(() => {
      const c = window.__cook, root = document.getElementById('board-root'), t0 = c.now;
      let t = t0;
      c.setClock(() => t);
      const seen = [];
      const mo = new MutationObserver(list => list.forEach(m => seen.push(m.type + ':' + (m.target.nodeType === 3 ? (m.target.parentElement && m.target.parentElement.getAttribute('data-bd-until') ? 'countdown' : 'text') : (m.target.className || m.target.nodeName)))));
      mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
      c.tick(); c.tick();
      const frozen = mo.takeRecords().length + seen.length;
      seen.length = 0;
      t += 1000; c.tick();
      mo.takeRecords().forEach(m => seen.push(m.type + ':' + (m.target.nodeType === 3 ? 'text' : (m.target.getAttribute && m.target.getAttribute('data-bd-until') ? 'countdown' : (m.target.className || m.target.nodeName)))));
      const oneSecond = seen.slice();
      // cost of the every-second callback, board mounted
      const n = 300, a = performance.now();
      for (let i = 0; i < n; i++) { t += 1000; c.tick(); }
      const perTick = (performance.now() - a) / n;
      mo.disconnect();
      c.setClock(null);
      return { frozen, oneSecond, perTick };
    });
    ok(res.frozen === 0, 'with nothing changing, a tick writes nothing to the page (' + res.frozen + ' changes)');
    ok(res.oneSecond.length > 0 && res.oneSecond.every(x => /countdown|bd-now/.test(x)), 'one second later only the countdowns (and the now line) change: ' + res.oneSecond.join(', '));
    ok(res.perTick < 8, 'a tick with the board open costs ' + res.perTick.toFixed(2) + ' ms');
    console.log('  tick cost with the board open: ' + res.perTick.toFixed(2) + ' ms');
  } },
  { name: 'narrow', sizes: [{ width: 390, height: 844 }], run: async (page, v) => {
    await cookUntil(page, at('07:20'));
    const res = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, vw: window.innerWidth, rootScroll: document.getElementById('board-root').scrollHeight > document.getElementById('board-root').clientHeight }));
    ok(res.w <= res.vw + 0.5, 'on a phone the board does not scroll the page sideways (' + res.w + ' vs ' + res.vw + ')');
    ok(res.rootScroll, 'and it scrolls down as one column');
    await shot(page, 'narrow-' + v);
    await page.locator('#board-root').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await shot(page, 'narrow-end-' + v);
  } }
];

(async () => {
  const browser = await chromium.launch();
  for (const sc of SCENES) {
    if (only && sc.name.indexOf(only) < 0) continue;
    for (const size of sc.sizes) {
      for (const scheme of sc.schemes || ['light']) {
        const v = scheme + '-' + size.width;
        console.log('\n' + sc.name + ' ' + v);
        const { ctx, page } = await open(browser, { name: sc.name + ' ' + v, time: sc.time, hash: sc.hash, viewport: size, scheme });
        try { await sc.run(page, v); }
        catch (e) { ok(false, sc.name + ' ' + v + ' threw: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log('\nconsole errors and uncaught errors');
  ok(problems.length === 0, problems.length + ' problem(s):\n    ' + problems.join('\n    '));
  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks' : 'PASSED: all ' + checks + ' checks'));
  process.exit(failures ? 1 : 0);
})();
