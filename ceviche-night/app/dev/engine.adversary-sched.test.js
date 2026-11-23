'use strict';
/*
 * Scheduler adversary tests for engine.js: pick(), nextStep(), nextUnlock(), project().
 * Run:  node --test ceviche-night/app/dev/engine.adversary-sched.test.js
 *
 * These tests bring their own made-up plan ("Stew Night", below). It is shaped like the real day: a morning at
 * his place with stove timers, a hard out at 11:00, a pack-up stop, a drive, and an afternoon in her kitchen
 * that is timed back from dinner. Nothing here edits the engine. plan.js is only read by the two "real plan"
 * tests at the very end, which skip themselves while that file is missing or not valid.
 *
 * How to read a red test: each assertion states what SPEC.md sections 2 and 3 promise, or names the way the
 * cook would be misled. The expected values were worked out by hand from the spec, never copied from engine output.
 * Where the spec text and the notes at the top of engine.js differ on purpose (an alarm or a must step before
 * "time to go"; a kitchen he has left no longer rings), audit() accepts both readings.
 *
 * Three tools carry most of the weight:
 *   ref()      an independent reading of SPEC 3.2 / 3.3 (active, done, deps, wait gate, place, notBefore).
 *   audit()    every promise the spec makes about one (state, now): pick, nextUnlock and the whole projection,
 *              including a replay of the projection row by row against pick().
 *   liveDay()  a simulated cook who uses the engine the way the phone does, with a seeded amount of chaos.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const MIN = 60000;
const DAY = 24 * 60 * MIN;
// Local wall-clock time on the cook day (Mon Nov 23 2026). Works in any timezone.
const H = (h, m = 0, s = 0, ms = 0) => new Date(2026, 10, 23, h, m, s, ms).getTime();
const clock = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return String(ms);
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return (d.getDate() !== 23 ? 'Nov ' + d.getDate() + ' ' : '') + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + (d.getMilliseconds() ? '.' + d.getMilliseconds() : '');
};
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}

// ------------------------------------------------------------------------------------------------ the fixture

function stewNight() {
  const S = (id, dish, block, where, mins, extra) => Object.assign({ id, dish, block, where, title: 'T:' + id, body: [], mins }, extra || {});
  const dish = (id) => ({ id, nick: id, name: id, color: 'x', blurb: '', makes: '2', source: { label: 'x', url: null }, ingredients: [], gear: [], notes: [] });
  return {
    version: 1,
    title: 'Stew Night',
    anchors: { start: 420, leaveAm: 660, backHome: 840, leavePm: 870, arrive: 900, dinner: 1170 },
    anchorLabels: { start: 'Start', leaveAm: 'Leave', backHome: 'Back home', leavePm: 'Leave again', arrive: 'Arrive', dinner: 'Dinner' },
    optionDefaults: { soaked: true, beansLater: false, stored: false },
    rules: [
      { on: 'leave-am', ifDone: 'stew-heat', ifNotDone: 'stew-off', set: { beansLater: true } },   // left with the stew unfinished
      { on: 'leave-am', set: { stored: true } }                                                    // the walk-out checks covered the fridge
    ],
    dishes: ['stew', 'brine', 'fish', 'rice', 'corn'].map(dish),
    glossary: {},
    tonight: [{ id: 'soak', title: 'Soak', body: ['Cover with water.'], sets: { soaked: true } }],
    steps: [
      // her kitchen, top priority there (like the real plan, SPEC 9.1)
      S('h-unpack', 'day', 'hers', 'hers', 5),
      S('stew-resume', 'stew', 'hers', 'hers', 4, { when: { beansLater: true } }),
      // the morning, at his place
      S('setup', 'day', 'am', 'home', 5, { kind: 'checklist', items: ['Pot', 'Knife'] }),
      S('soak-q', 'stew', 'am', 'either', 0.5, { kind: 'choice', choice: { opt: 'soaked', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }),
      S('stew-drain', 'stew', 'am', 'either', 2, { after: ['soak-q'], when: { soaked: true } }),
      S('stew-quick', 'stew', 'am', 'either', 3, { after: ['soak-q'], when: { soaked: false }, wait: { id: 'quick', mins: 45, label: 'Quick soak', attended: false } }),
      S('stew-heat', 'stew', 'am', 'either', 1, { after: ['stew-drain', 'stew-quick'], afterWait: 'quick', wait: { id: 'boil', mins: 12, label: 'Coming to a boil', attended: true, urgent: true } }),
      S('brine-water', 'brine', 'am', 'either', 1, { wait: { id: 'kettle', mins: 8, label: 'Water heating', attended: true, urgent: false } }),
      S('slice', 'brine', 'am', 'either', 6),
      S('chop', 'stew', 'am', 'either', 5),
      S('stew-simmer', 'stew', 'am', 'either', 1, { after: ['stew-heat'], afterWait: 'boil', wait: { id: 'simmer', mins: 60, label: 'Stew simmering', attended: true, laps: [20, 40], lapLabel: 'Stir the stew' } }),
      S('brine-dunk', 'brine', 'am', 'either', 2, { after: ['slice', 'brine-water'], afterWait: 'kettle', timer: { secs: 30, label: 'In hot water' }, wait: { id: 'steep', mins: 30, label: 'Steeping', attended: false } }),
      S('fry', 'stew', 'am', 'either', 1, { wait: { id: 'fry', mins: 10, label: 'Frying', attended: true, urgent: true } }),
      S('grate', 'stew', 'am', 'either', 4),
      S('sauce-base', 'fish', 'am', 'either', 5),
      S('drain', 'stew', 'am', 'either', 2),
      S('fry-out', 'stew', 'am', 'either', 3, { after: ['fry'], afterWait: 'fry' }),
      S('stew-check', 'stew', 'am', 'either', 2, { kind: 'check', after: ['stew-simmer', 'stew-resume'], afterWait: 'simmer',
        check: { yes: 'Tender', no: 'Still firm', retryMins: 15, giveUp: { label: 'No time. Finish at her place.', set: { beansLater: true }, withinMinsOf: { anchor: 'leaveAm', mins: 50 } } } }),
      S('stew-pause', 'stew', 'am', 'home', 3, { after: ['stew-heat'], when: { beansLater: true, stored: false }, must: true }),
      S('stew-finish', 'stew', 'am', 'either', 2, { after: ['stew-check', 'fry-out', 'chop'], wait: { id: 'final', mins: 25, label: 'Last simmer', attended: true } }),
      S('juice', 'fish', 'am', 'either', 18),
      S('sauce', 'fish', 'am', 'either', 6, { after: ['juice'] }),
      S('jar', 'brine', 'am', 'either', 3, { after: ['brine-dunk'], afterWait: 'steep' }),
      S('puree', 'rice', 'am', 'home', 6),
      S('kit', 'rice', 'am', 'home', 3),
      S('stew-off', 'stew', 'am', 'either', 3, { after: ['stew-finish'], afterWait: 'final', wait: { id: 'cool', mins: 25, label: 'Cooling', attended: false } }),
      S('stew-store', 'stew', 'am', 'home', 3, { after: ['stew-off'], afterWait: 'cool', when: { beansLater: false, stored: false }, must: true }),
      S('tidy', 'day', 'am', 'home', 10, { optional: true }),
      S('pack-bag', 'day', 'am', 'home', 7, { kind: 'checklist', items: 'bag', must: true }),
      S('leave-am', 'day', 'am', 'home', 0, { kind: 'move', move: 'leaveAm' }),
      // pack-up stop
      S('back', 'day', 'load', 'home', 0, { kind: 'move', move: 'backHome' }),
      S('cooler', 'day', 'load', 'home', 10, { kind: 'checklist', items: 'cooler', must: true, after: ['back'] }),
      S('car', 'day', 'load', 'home', 4, { must: true, after: ['cooler'] }),
      S('leave-pm', 'day', 'load', 'home', 0, { kind: 'move', move: 'leavePm' }),
      S('arrive', 'day', 'load', 'hers', 0, { kind: 'move', move: 'arrive' }),
      // her kitchen
      S('h-setup', 'day', 'hers', 'hers', 8, { kind: 'checklist', items: ['Bowls', 'Sheet pan'] }),
      S('h-chop-a', 'fish', 'hers', 'hers', 6),
      S('h-chop-b', 'fish', 'hers', 'hers', 10),
      S('fish-cube', 'fish', 'hers', 'hers', 6, { after: ['h-chop-a'] }),
      S('fish-cure', 'fish', 'hers', 'hers', 2, { after: ['fish-cube', 'juice'], wait: { id: 'cure', mins: 20, label: 'Fish curing', attended: false, urgent: true } }),
      S('fish-check', 'fish', 'hers', 'hers', 1, { kind: 'check', after: ['fish-cure'], afterWait: 'cure', check: { yes: 'Opaque', no: 'Still glassy', retryMins: 5 } }),
      S('fish-drain', 'fish', 'hers', 'hers', 2, { after: ['fish-check'] }),
      S('mix', 'fish', 'hers', 'hers', 5, { after: ['fish-drain', 'h-chop-b'], notBefore: { anchor: 'dinner', mins: -120 } }),
      S('table', 'day', 'hers', 'hers', 10, { optional: true }),
      // timed back from dinner
      S('rice-toast', 'rice', 'final', 'hers', 0.5, { after: ['kit'], timer: { secs: 330, label: 'Rice toasting' }, notBefore: { anchor: 'dinner', mins: -65 } }),
      S('rice-cover', 'rice', 'final', 'hers', 1, { after: ['rice-toast', 'puree'], wait: { id: 'rice', mins: 20, label: 'Rice cooking', attended: true, urgent: true } }),
      S('stew-reheat', 'stew', 'final', 'hers', 2, { after: ['stew-off'], notBefore: { anchor: 'dinner', mins: -45 } }),
      S('corn-in', 'corn', 'final', 'hers', 1, { notBefore: { anchor: 'dinner', mins: -36 }, wait: { id: 'corn', mins: 12, label: 'Corn broiling', attended: true, urgent: true, laps: [3, 6, 9], lapLabel: 'Turn the corn' } }),
      S('rice-fluff', 'rice', 'final', 'hers', 1, { after: ['rice-cover'], afterWait: 'rice' }),
      S('shrimp-marinate', 'fish', 'final', 'hers', 1, { after: ['sauce'], notBefore: { anchor: 'dinner', mins: -25 }, wait: { id: 'marinade', mins: 10, label: 'Marinating', attended: false, max: 20 } }),
      S('corn-out', 'corn', 'final', 'hers', 4, { after: ['corn-in'], afterWait: 'corn' }),
      S('skillet', 'fish', 'final', 'hers', 1, { after: ['shrimp-marinate'], afterWait: 'marinade', wait: { id: 'skillet', mins: 3, label: 'Skillet heating', attended: true, urgent: true } }),
      S('sear', 'fish', 'final', 'hers', 0.5, { after: ['skillet'], afterWait: 'skillet', timer: { secs: 60, label: 'Searing' } }),
      S('finish', 'day', 'final', 'hers', 2, { after: ['stew-reheat', 'rice-fluff'], notBefore: { anchor: 'dinner', mins: -5 } }),
      S('dinner', 'day', 'final', 'hers', 0, { after: ['finish', 'sear', 'corn-out', 'mix'], notBefore: { anchor: 'dinner', mins: 0 } })
    ],
    pack: {
      cooler: [{ id: 'fish', label: 'Fish' }, { id: 'pot', label: 'Stew pot', when: { beansLater: true } }],
      bag: [{ id: 'chips', label: 'Chips' }],
      gear: [{ id: 'knife', label: 'Knife' }]
    },
    containers: { home: [], hers: [] }
  };
}

const PLAN = deepFreeze(stewNight());
const step = (plan, id) => plan.steps.find((s) => s.id === id);
const fresh = (plan = PLAN, now = H(6, 50)) => E.initialState(plan, 'adv', now);
// complete() for [id, time, payload?] triples
function run(state, list, plan = PLAN) {
  for (const [id, at, payload] of list) state = E.complete(plan, state, id, at, payload);
  return state;
}
// Everything he can do in the morning (default variant), in master order.
const AM = PLAN.steps.filter((s) => s.block === 'am' && s.kind !== 'move' && E.isActive(PLAN, fresh(), s)).map((s) => s.id);
// A morning where every step except `open` was finished at `at` (their timers are long over by mid-morning).
function morning(open = [], at = H(8), plan = PLAN) {
  return run(fresh(plan), AM.filter((id) => !open.includes(id)).map((id) => [id, at, id === 'soak-q' ? { value: true } : undefined]), plan);
}
// Do exactly what the projection says, at the projected times, until step `until` (not included).
function follow(state, now, until, plan = PLAN) {
  const p = E.project(plan, state, now);
  for (const r of p.rows) {
    if ((r.type !== 'step' && r.type !== 'move') || r.status === 'done') continue;
    if (r.stepId === until) break;
    const st = step(plan, r.stepId);
    state = E.complete(plan, state, r.stepId, r.type === 'move' ? r.at : r.end, st.kind === 'choice' ? { value: E.opt(plan, state, st.choice.opt) } : undefined);
  }
  return state;
}
const span = (p, id) => (p.byStep[id] ? [p.byStep[id].start, p.byStep[id].end] : null);
const codes = (p) => p.warnings.map((w) => w.code);
const warning = (p, code) => p.warnings.find((w) => w.code === code);
const todoRows = (p) => p.rows.filter((r) => (r.type === 'step' || r.type === 'move') && r.status !== 'done');
const frees = (p) => p.rows.filter((r) => r.type === 'free').map((r) => [r.loc, r.start, r.end, r.nextStepId]);

// ------------------------------------------------------------------------------- an independent reading of the spec

const MOVES = ['leaveAm', 'backHome', 'leavePm', 'arrive'];
const MOVE_FROM = { leaveAm: 'home-am', backHome: 'away', leavePm: 'home-pm', arrive: 'drive' };
const MOVE_TO = { leaveAm: 'away', backHome: 'home-pm', leavePm: 'drive', arrive: 'hers' };
const LOC_MOVE = { 'home-am': 'leaveAm', away: 'backHome', 'home-pm': 'leavePm', drive: 'arrive' };

function ref(plan) {
  const byId = Object.create(null), order = Object.create(null), armers = Object.create(null), moves = Object.create(null);
  plan.steps.forEach((s, i) => {
    byId[s.id] = s; order[s.id] = i;
    if (s.wait) (armers[s.wait.id] = armers[s.wait.id] || []).push(s);
    if (s.kind === 'move') moves[s.move] = s;
  });
  const has = (st, id) => !!st.done && st.done[id] != null;
  const opt = (st, name) => (st.opts && st.opts[name] !== undefined ? st.opts[name] : plan.optionDefaults[name]);
  const whenOk = (st, s) => !s.when || Object.keys(s.when).every((k) => opt(st, k) === s.when[k]);
  const active = (st, s) => whenOk(st, s) && !(st.skipped && st.skipped[s.id]);                       // SPEC 3.3 isActive
  const done = (st, s) => has(st, s.id) || (s.kind === 'choice' && !!st.opts && st.opts[s.choice.opt] !== undefined);   // SPEC 3.3 isDone
  const lastMove = (st) => { for (let i = MOVES.length - 1; i >= 0; i--) { const m = moves[MOVES[i]]; if (m && has(st, m.id)) return MOVES[i]; } return null; };
  const loc = (st) => { const m = lastMove(st); return m ? MOVE_TO[m] : 'home-am'; };                 // SPEC 3.2
  const since = (st) => { const m = lastMove(st); return m ? st.done[moves[m].id] : -Infinity; };     // when he got to this place
  const placeOk = (s, l) => (s.kind === 'move' ? MOVE_FROM[s.move] === l
    : s.where === 'home' ? (l === 'home-am' || l === 'home-pm') : s.where === 'hers' ? l === 'hers' : (l === 'home-am' || l === 'hers'));
  const depsOk = (st, s) => (s.after || []).every((id) => { const d = byId[id]; return !d || done(st, d) || !active(st, d); });
  const gateOpen = (st, s, now) => {
    if (!s.afterWait) return true;
    const r = st.waits && st.waits[s.afterWait];
    if (r) return now >= r.start + r.mins * MIN;
    // no record: open when the arming step is inactive or skipped (a done armer always has a record in these tests)
    return !(armers[s.afterWait] || []).some((a) => active(st, a) && !done(st, a));
  };
  const notBeforeAt = (st, s) => (s.notBefore ? E.anchorMs(st, s.notBefore.anchor) + s.notBefore.mins * MIN : -Infinity);
  const available = (st, s, now) => active(st, s) && !done(st, s) && depsOk(st, s) && gateOpen(st, s, now) && placeOk(s, loc(st)) && now >= notBeforeAt(st, s);
  const stepMins = (s) => (s.mins || 0) + (s.timer ? s.timer.secs / 60 : 0);
  const needMins = (s) => stepMins(s) + (s.wait && s.wait.attended ? s.wait.mins : 0);     // SPEC 3.4 need(step)
  const waitDef = (st, id) => {
    const r = st.waits && st.waits[id], by = r && byId[r.by];
    if (by && by.wait && by.wait.id === id) return by.wait;
    return armers[id] && armers[id][0] ? armers[id][0].wait : null;
  };
  // gated by an urgent timer that has ended (SPEC 3.4 step 4)
  const urgentOver = (st, s, now) => {
    if (!s.afterWait) return false;
    const r = st.waits && st.waits[s.afterWait], d = waitDef(st, s.afterWait);
    return !!(r && d && d.urgent && now >= r.start + r.mins * MIN);
  };
  // ... and that timer was started in the place he is in now: its alarm is really ringing here
  const ringing = (st, s, now) => urgentOver(st, s, now) && st.waits[s.afterWait].start > since(st);
  // it needs a move that has not happened yet (e.g. "load the cooler" needs "back home")
  const behindMove = (st, s, seen = {}) => {
    if (seen[s.id]) return false;
    seen[s.id] = true;
    return (s.after || []).some((id) => { const d = byId[id]; return !!d && !done(st, d) && active(st, d) && (d.kind === 'move' || behindMove(st, d, seen)); });
  };
  return { plan, byId, order, armers, moves, opt, whenOk, active, done, loc, since, placeOk, depsOk, gateOpen, notBeforeAt, available, stepMins, needMins, waitDef, urgentOver, ringing, behindMove };
}

// --------------------------------------------------------------------------------------------------- the audit

// Everything the spec promises about one (state, now). Returns { list: [{cat, msg}], proj }.
function audit(plan, state, now, R = ref(plan)) {
  deepFreeze(state);                       // SPEC 3: nothing may mutate its arguments (a write would throw here)
  const list = [];
  const loc = R.loc(state);
  const bad = (cat, msg) => list.push({ cat, msg: '[now ' + clock(now) + ', ' + loc + '] ' + msg });
  const L1 = E.anchorMs(state, 'leaveAm'), L2 = E.anchorMs(state, 'leavePm');
  const hard = loc === 'home-am' ? L1 : loc === 'home-pm' ? L2 : NaN;

  // ---- SPEC 3.2 / 3.3
  if (E.location(plan, state) !== loc) bad('location', 'location() says ' + E.location(plan, state));
  for (const s of plan.steps) {
    const a = E.isAvailable(plan, state, s.id, now), b = R.available(state, s, now);
    if (a !== b) bad('isAvailable', s.id + ': engine ' + a + ', spec ' + b + ', blockers ' + JSON.stringify(E.blockers(plan, state, s.id, now)));
    if (R.active(state, s) && !R.done(state, s)) {
      const bl = E.blockers(plan, state, s.id, now);
      if ((bl.length === 0) !== b) bad('blockers', s.id + ': available ' + b + ' but blockers ' + JSON.stringify(bl));
      for (const x of bl) {
        if (['after', 'wait', 'time', 'place'].indexOf(x.type) < 0) bad('blockers', s.id + ': unknown blocker ' + x.type);
        if (x.type === 'time' && x.at !== R.notBeforeAt(state, s)) bad('blockers', s.id + ': time blocker at ' + clock(x.at));
        if (x.type === 'after' && (s.after || []).indexOf(x.stepId) < 0) bad('blockers', s.id + ': after blocker ' + x.stepId);
      }
    }
  }

  // ---- SPEC 3.4 pick
  const p = E.pick(plan, state, now);
  const ns = E.nextStep(plan, state, now);
  if ((p ? p.id : null) !== ns) bad('pick-nextStep', 'pick ' + (p && p.id) + ', nextStep ' + ns);
  const avail = plan.steps.filter((s) => R.available(state, s, now));
  const work = avail.filter((s) => s.kind !== 'move');
  const ring = work.filter((s) => R.ringing(state, s, now));                                  // alarms of this kitchen
  const rung = work.filter((s) => R.urgentOver(state, s, now));                               // ... of any kitchen (SPEC 3.4 step 4 as written)
  const alarmOk = [ring[0], rung[0]].filter(Boolean).map((s) => s.id);
  const goNow = avail.find((s) => s.kind === 'move' && now >= E.anchorMs(state, s.move));     // time to go
  if (p) {
    if (!R.available(state, p, now)) bad('pick-available', p.id + ' was picked but is not available');
    // SPEC 3.4 step 2 lets "time to go" win; the engine notes put an alarm before it. Both are accepted here.
    if (ring.length && alarmOk.indexOf(p.id) < 0 && !(goNow && p.id === goNow.id)) bad('pick-urgent-first', p.id + ' was picked while the alarm step ' + ring[0].id + ' is ready');
    if (p.kind === 'move' && !(now >= E.anchorMs(state, p.move))) bad('pick-move-early', 'the move ' + p.id + ' was proposed before its anchor');
    if (p.kind !== 'move' && Number.isFinite(hard) && alarmOk.indexOf(p.id) < 0 && p.must !== true) {
      const fits = now + R.needMins(p) * MIN <= hard;
      if (loc === 'home-am' && !(p.where === 'home' && !p.optional) && !fits) bad('pick-fit', p.id + ' was picked in the morning but does not fit (needs ' + R.needMins(p) + ' min)');
      if (loc === 'home-pm' && !fits) bad('pick-fit', p.id + ' was picked at the pack-up stop but does not fit (needs ' + R.needMins(p) + ' min)');
    }
  }
  if (!(p && alarmOk.indexOf(p.id) >= 0)) {
    if (Number.isFinite(hard)) {
      // Work that will certainly be done here before he leaves: must steps, plus (in the morning) home-only steps.
      const sure = plan.steps.filter((s) => s.kind !== 'move' && R.active(state, s) && !R.done(state, s) && R.placeOk(s, loc) && !R.behindMove(state, s) &&
        (s.must === true || (loc === 'home-am' && s.where === 'home' && !s.optional)));
      const left = (hard - now) / MIN;
      const before = p && p.kind !== 'move' ? work.filter((s) => R.order[s.id] < R.order[p.id]) : work;
      for (const x of before) {
        if (goNow) {
          // SPEC 3.4 step 2 returns the move. The engine documents: an alarm, then a must step he can do now, then the move.
          if (p && p.kind === 'move') { if (x.must === true) bad('pick-must-before-move', 'the move was picked while the must step ' + x.id + ' is available'); continue; }
          if (p && p.must === true) { if (x.must === true) bad('pick-skips-kept', p.id + ' was picked but the must step ' + x.id + ' comes first'); continue; }
          bad('pick-ignores-time-to-go', (p ? p.id : 'nothing') + ' was picked although it is time to go (' + goNow.id + ')');
          break;
        }
        if (x.must === true || (loc === 'home-am' && x.where === 'home' && !x.optional)) {
          bad('pick-skips-kept', (p ? p.id : 'nothing') + ' was picked, but ' + x.id + ' (must or home-only) comes first and is available');
          continue;
        }
        // x was passed over. That is right only when it does not fit. It certainly fits when its own length
        // (hands-on + stove time) ends before the hard out AND its hands-on time plus all the sure work does too.
        const room = sure.filter((s) => s.id !== x.id).reduce((n, s) => n + R.stepMins(s), 0);
        if (R.needMins(x) <= left && R.stepMins(x) + room <= left) {
          bad('pick-skips-fitting', (p ? p.id : 'nothing') + ' was picked, but ' + x.id + ' comes first and fits: ' + R.needMins(x) + ' min long (' + R.stepMins(x) +
            ' hands-on), ' + room + ' min of must-do work, ' + left.toFixed(1) + ' min left');
        }
      }
    } else {
      if (p && p.kind !== 'move' && work.length && work[0].id !== p.id) bad('pick-master-order', p.id + ' was picked but ' + work[0].id + ' is first in the master order');
      if (!p && work.length) bad('pick-null-with-work', 'nothing was picked but these are available: ' + work.map((s) => s.id).join(', '));
    }
  }

  // ---- SPEC 3.4 nextUnlock
  const u = E.nextUnlock(plan, state, now);
  if (u) {
    const us = R.byId[u.stepId];
    if (!(u.at > now)) bad('unlock-future', 'the unlock ' + clock(u.at) + ' is not in the future');
    if (!us) bad('unlock-step', 'unknown step ' + u.stepId);
    if (['wait', 'time', 'move'].indexOf(u.reason) < 0) bad('unlock-reason', 'reason ' + u.reason);
    if (us && u.reason === 'time' && u.at !== R.notBeforeAt(state, us)) bad('unlock-reason', u.stepId + ': reason time but its notBefore is ' + clock(R.notBeforeAt(state, us)));
    if (us && u.reason === 'move' && (us.kind !== 'move' || u.at !== E.anchorMs(state, us.move))) bad('unlock-reason', u.stepId + ': reason move but that is not its anchor');
    if (us && u.reason === 'wait') {
      const r = us.afterWait && state.waits && state.waits[us.afterWait];
      if (!r || u.at !== r.start + r.mins * MIN) bad('unlock-reason', u.stepId + ': reason wait but its timer does not end at ' + clock(u.at));
    }
    const then = E.pick(plan, state, u.at);
    if (!then) bad('unlock-nothing', 'nothing is pickable at the unlock ' + clock(u.at) + ' (' + u.stepId + ')');
    if (!p) {
      if (then && then.id !== u.stepId) bad('unlock-names-other', 'the unlock at ' + clock(u.at) + ' names ' + u.stepId + ' but pick returns ' + then.id + ' at that moment');
      for (const t of [u.at - 1, Math.floor((now + u.at) / 2)]) {
        const early = t > now ? E.pick(plan, state, t) : null;
        if (early) { bad('unlock-not-earliest', 'pick returns ' + early.id + ' at ' + clock(t) + ', before the unlock ' + clock(u.at)); break; }
      }
    }
  } else if (!p) {
    for (const d of [1, 7, 30, 120, 600, 1500]) {
      const later = E.pick(plan, state, now + d * MIN);
      if (later) { bad('unlock-missing', 'nextUnlock is null but pick returns ' + later.id + ' ' + d + ' min later'); break; }
    }
  }

  // ---- SPEC 3.7 project
  let P;
  try { P = E.project(plan, state, now); } catch (e) { bad('project-throws', String((e && e.stack) || e)); return { list, proj: null }; }
  const keyOf = (r) => (r.type === 'move' ? r.at : r.start);
  const rows = P.rows;
  if (P.now !== now) bad('proj-now', 'now is ' + P.now);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], name = r.stepId || r.waitId || r.type;
    if (['step', 'wait', 'free', 'move'].indexOf(r.type) < 0) bad('proj-row-type', 'row type ' + r.type);
    if (r.type === 'move') { if (!Number.isFinite(r.at)) bad('proj-finite', 'move ' + name + ' at ' + r.at); }
    else if (!Number.isFinite(r.start) || !Number.isFinite(r.end)) bad('proj-finite', name + ' has no finite times');
    else if (r.end < r.start) bad('proj-negative', name + ' ends before it starts');
    if (i && keyOf(rows[i - 1]) > keyOf(r)) bad('proj-chronological', name + ' at ' + clock(keyOf(r)) + ' is listed after a row at ' + clock(keyOf(rows[i - 1])));
    if (r.type === 'free' && r.end - r.start < 3 * MIN) bad('proj-free-short', 'a free row is shorter than 3 min');
    if (r.type === 'free' && ['home-am', 'home-pm', 'hers'].indexOf(r.loc) < 0) bad('proj-free-loc', 'a free row in ' + r.loc);
  }
  const acts = rows.filter((r) => r.type === 'step' || r.type === 'move');
  const ids = acts.map((r) => r.stepId);
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (twice.length) bad('proj-twice', 'scheduled twice: ' + twice.join(', '));
  for (const r of acts) {
    const b = P.byStep[r.stepId], s = R.byId[r.stepId];
    const rs = keyOf(r), re = r.type === 'move' ? r.at : r.end;
    if (!b) bad('proj-byStep', 'no byStep entry for ' + r.stepId);
    else if (b.start !== rs || b.end !== re || b.status !== r.status || b.loc !== r.loc || (b.deferred === true) !== (r.deferred === true)) bad('proj-byStep', 'byStep differs from the row of ' + r.stepId);
    const isDone = !!state.done && state.done[r.stepId] != null;
    if ((r.status === 'done') !== isDone) bad('proj-status', r.stepId + ' has status ' + r.status + ' but done is ' + isDone);
    if (r.type !== 'step') continue;
    if (r.status === 'done') {
      if (r.end !== state.done[r.stepId]) bad('proj-done-row', r.stepId + ': the done row does not end at its done time');
      if (r.start < r.end - R.stepMins(s) * MIN - 1) bad('proj-done-row', r.stepId + ': the done row starts before doneAt - mins');
    } else if (Math.abs((r.end - r.start) - R.stepMins(s) * MIN) > 1) bad('proj-duration', r.stepId + ' lasts ' + (r.end - r.start) / MIN + ' min, expected ' + R.stepMins(s));
    const isDef = s.where === 'either' && s.block === 'am' && r.loc === 'hers';
    if ((r.deferred === true) !== isDef) bad('proj-deferred-flag', r.stepId + ': deferred is ' + r.deferred + ', expected ' + isDef);
  }
  for (const id of Object.keys(P.byStep)) if (ids.indexOf(id) < 0) bad('proj-byStep', 'byStep has ' + id + ' without a row');
  const nexts = acts.filter((r) => r.status === 'next');
  if (nexts.length > 1) bad('proj-next', 'more than one next row');
  if (nexts.length && nexts[0].stepId !== ns) bad('proj-next', 'the next row is ' + nexts[0].stepId + ' but nextStep() is ' + ns);
  if (ns && P.byStep[ns] && P.byStep[ns].status !== 'next') bad('proj-next', 'nextStep() ' + ns + ' is planned but not marked next');

  const startA = E.anchorMs(state, 'start');
  const T0 = (!state.done || Object.keys(state.done).length === 0) && now < startA ? startA : now;    // SPEC 3.7 first line
  const todo = acts.filter((r) => r.status !== 'done');
  for (const r of todo) if (keyOf(r) < T0) bad('proj-before-now', r.stepId + ' is planned at ' + clock(keyOf(r)) + ', before ' + clock(T0));
  for (let i = 1; i < todo.length; i++) {
    const prevEnd = todo[i - 1].type === 'move' ? todo[i - 1].at : todo[i - 1].end;
    if (keyOf(todo[i]) < prevEnd) bad('proj-overlap', todo[i].stepId + ' starts at ' + clock(keyOf(todo[i])) + ', before ' + todo[i - 1].stepId + ' ends at ' + clock(prevEnd));
  }
  const mv = todo.filter((r) => r.type === 'move').map((r) => R.byId[r.stepId].move);
  for (let i = 1; i < mv.length; i++) if (MOVES.indexOf(mv[i]) !== MOVES.indexOf(mv[i - 1]) + 1) bad('proj-move-order', 'moves out of order: ' + mv.join(', '));
  if (mv.length && mv[0] !== LOC_MOVE[loc]) bad('proj-move-order', 'the first move is ' + mv[0] + ' but he is in ' + loc);
  // a background timer row for every planned step that starts one
  const waitRows = rows.filter((r) => r.type === 'wait');
  for (const r of todo) {
    const s = R.byId[r.stepId];
    if (r.type !== 'step' || !s.wait) continue;
    const w = waitRows.filter((x) => x.waitId === s.wait.id && x.start === r.end);
    if (w.length !== 1) bad('proj-wait-row', r.stepId + ' starts the timer ' + s.wait.id + ' but there are ' + w.length + ' wait rows for it');
    else if (w[0].end !== r.end + s.wait.mins * MIN || w[0].loc !== r.loc || w[0].label !== s.wait.label) bad('proj-wait-row', 'the wait row of ' + s.wait.id + ' is wrong');
  }

  // ---- replay: the projection must be what the live guide proposes at each of its rows ("using pick at each simulated moment")
  let s = state, t = T0, replayed = true;
  let leftAt = R.moves.leavePm && state.done ? state.done[R.moves.leavePm.id] : undefined;
  const freeRows = rows.filter((r) => r.type === 'free');
  const usedFree = new Set();
  for (let i = 0; i < todo.length; i++) {
    const r = todo[i], st = R.byId[r.stepId], start = keyOf(r), l = R.loc(s);
    if (l !== r.loc) { bad('replay-loc', r.stepId + ': the row says ' + r.loc + ' but the cook would be in ' + l); replayed = false; break; }
    if (start > t && l !== 'away' && l !== 'drive') {
      for (const tt of [t, Math.floor((t + start) / 2), start - 1]) {
        const pk = tt >= t && tt < start ? E.pick(plan, s, tt) : null;
        if (pk) { bad('replay-idle', 'the plan has him idle from ' + clock(t) + ' to ' + clock(start) + ' (then ' + r.stepId + ') but pick returns ' + pk.id + ' at ' + clock(tt)); break; }
      }
      const fr = freeRows.filter((f) => f.start === t && f.end === start);
      fr.forEach((f) => usedFree.add(f));
      if (start - t >= 3 * MIN && fr.length !== 1) bad('replay-free-row', 'the gap ' + clock(t) + ' - ' + clock(start) + ' has ' + fr.length + ' free rows');
      if (start - t < 3 * MIN && fr.length !== 0) bad('replay-free-row', 'a gap under 3 min has a free row');
      if (fr.length === 1 && fr[0].loc !== l) bad('replay-free-row', 'free row in ' + fr[0].loc + ' while he is in ' + l);
      if (fr.length === 1 && fr[0].nextStepId !== r.stepId) bad('replay-free-next', 'the free row ' + clock(t) + ' - ' + clock(start) + ' says the next step is ' + fr[0].nextStepId + ' but the next row is ' + r.stepId);
    }
    const pk = E.pick(plan, s, start);
    if (r.type === 'step') {
      if (!R.available(s, st, start)) bad('replay-available', r.stepId + ' is planned at ' + clock(start) + ' but cannot be done then: ' + JSON.stringify(E.blockers(plan, s, r.stepId, start)));
      if (!pk || pk.id !== r.stepId) bad('replay-pick', r.stepId + ' is planned at ' + clock(start) + ' but pick returns ' + (pk && pk.id) + ' at that moment');
      s = E.complete(plan, s, r.stepId, r.end, st.kind === 'choice' ? { value: R.opt(s, st.choice.opt) } : undefined);   // choice: the default option
      t = r.end;
    } else {
      const anchor = E.anchorMs(s, st.move);
      if (pk && pk.id !== r.stepId) bad('replay-move-vs-pick', 'the plan has him leave (' + r.stepId + ') at ' + clock(start) + ' but pick returns ' + pk.id + ' at that moment');
      if ((l === 'home-am' || l === 'home-pm') && start < anchor) bad('replay-move-early', r.stepId + ' is planned at ' + clock(start) + ', before its anchor ' + clock(anchor));
      if ((l === 'home-am' || l === 'home-pm') && !pk && start !== Math.max(t, anchor)) bad('replay-move-time', r.stepId + ' is planned at ' + clock(start) + ', expected ' + clock(Math.max(t, anchor)));
      if (l === 'away' && start !== Math.max(t, anchor)) bad('replay-move-time', 'back home is planned at ' + clock(start) + ', expected ' + clock(Math.max(t, anchor)));
      if (l === 'drive') {
        // SPEC 3.7: "t + (arrive - leavePm)". Counting the drive from the real departure is accepted too.
        const drive = E.anchorMs(s, 'arrive') - E.anchorMs(s, 'leavePm');
        const exp = Math.max(t, (leftAt != null ? leftAt : t) + drive);
        if (start !== exp && start !== t + drive) bad('replay-move-time', 'arriving is planned at ' + clock(start) + ', expected ' + clock(exp));
      }
      s = E.complete(plan, s, r.stepId, r.at);
      if (st.move === 'leavePm') leftAt = r.at;
      t = r.at;
    }
  }
  if (replayed) {
    for (const f of freeRows) if (f.start >= T0 && !usedFree.has(f)) bad('replay-free-row', 'the free row ' + clock(f.start) + ' - ' + clock(f.end) + ' does not sit between two planned rows');
    if (todo.length && R.loc(s) === 'hers') {
      const pk = E.pick(plan, s, t), un = pk ? null : E.nextUnlock(plan, s, t);
      if (pk) bad('replay-unfinished', 'the plan stops at ' + clock(t) + ' but pick still returns ' + pk.id);
      if (un) bad('replay-unfinished', 'the plan stops at ' + clock(t) + ' but ' + un.stepId + ' unlocks at ' + clock(un.at));
    }
  }

  // ---- summary numbers and warnings
  const dinnerA = E.anchorMs(state, 'dinner');
  const dRow = P.byStep.dinner;
  if (P.dinnerAnchor !== dinnerA) bad('proj-dinnerAnchor', 'dinnerAnchor is ' + P.dinnerAnchor);
  if (dRow ? P.dinnerAt !== dRow.start : P.dinnerAt != null) bad('proj-dinnerAt', 'dinnerAt ' + clock(P.dinnerAt) + ' is not the start of the dinner step');
  const expLate = dRow ? Math.max(0, Math.round((dRow.start - dinnerA) / MIN)) : 0;
  if (P.lateMin !== expLate) bad('proj-lateMin', 'lateMin is ' + P.lateMin + ', expected ' + expLate);
  if (!(P.spareMin >= 0)) bad('proj-spareMin', 'spareMin is ' + P.spareMin);
  if (P.lateMin > 0 && P.spareMin !== 0) bad('proj-spareMin', 'late by ' + P.lateMin + ' min yet ' + P.spareMin + ' min to spare');
  const cs = P.warnings.map((w) => w.code);
  for (const c of cs) if (['late', 'am-overrun', 'missed', 'deferred', 'beans-later'].indexOf(c) < 0) bad('proj-warning-code', 'unknown warning ' + c);
  for (const w of P.warnings) if (typeof w.text !== 'string' || !w.text) bad('proj-warning-text', 'warning ' + w.code + ' has no text');
  if ((P.lateMin > 0) !== (cs.indexOf('late') >= 0)) bad('proj-warning-late', 'late warning is ' + (cs.indexOf('late') >= 0) + ' with lateMin ' + P.lateMin);
  const defRows = todo.filter((r) => r.deferred).map((r) => r.stepId);
  const wDef = P.warnings.find((w) => w.code === 'deferred');
  if (JSON.stringify(wDef ? wDef.stepIds : []) !== JSON.stringify(defRows)) bad('proj-warning-deferred', 'the deferred warning lists ' + JSON.stringify(wDef && wDef.stepIds) + ' but the rows say ' + JSON.stringify(defRows));
  const over = todo.filter((r) => r.type === 'step' && r.loc === 'home-am' && r.end > L1).map((r) => r.stepId);
  const wOver = P.warnings.find((w) => w.code === 'am-overrun');
  if (over.length && !wOver) bad('proj-warning-overrun', 'steps at his place end after the hard out without am-overrun: ' + over.join(', '));
  if (wOver) for (const id of over) if (wOver.stepIds.indexOf(id) < 0) bad('proj-warning-overrun', id + ' ends after the hard out but is not in am-overrun');
  // nothing vanishes: every open step that is not optional is either planned or reported
  const wMiss = P.warnings.find((w) => w.code === 'missed');
  const missed = wMiss ? wMiss.stepIds : [];
  if (replayed) {
    for (const st of plan.steps) {
      if (st.optional || (state.skipped && state.skipped[st.id]) || R.done(state, st)) continue;
      if (R.done(s, st)) continue;                                  // planned
      if (R.whenOk(s, st) && missed.indexOf(st.id) < 0) bad('proj-vanished', st.id + ' is neither planned nor reported');
    }
  }
  for (const id of missed) {
    const st = R.byId[id];
    if (P.byStep[id]) bad('proj-missed-planned', id + ' is reported as not happening but has a row');
    if (st && st.must === true) bad('proj-missed-must', 'the must step ' + id + ' is reported as not happening');
    if (st && st.kind === 'move') bad('proj-missed-move', 'the move ' + id + ' is reported as not happening');
  }
  return { list, proj: P };
}

// Assert a clean audit. `allow` lists categories that belong to another (named) test.
function expectClean(plan, state, now, label, allow = []) {
  const a = audit(plan, state, now);
  const found = a.list.filter((x) => allow.indexOf(x.cat) < 0);
  assert.equal(found.length, 0, label + ': ' + found.length + ' broken promises\n  ' + found.slice(0, 8).map((x) => x.cat + ': ' + x.msg).join('\n  '));
  return a.proj;
}
// A promise that its own named tests below report (the "fit rule" tests), so broad simulations stay readable.
const KNOWN = ['pick-skips-fitting'];
function noViolations(day, label, allow = []) {
  const cats = Object.keys(day.viol).filter((c) => allow.indexOf(c) < 0);
  assert.equal(cats.length, 0, label + ':\n  ' + cats.map((c) => c + ' x' + day.viol[c].n + '\n    ' + day.viol[c].first.join('\n    ')).join('\n  '));
}

// ------------------------------------------------------------------------------------------- a simulated cook

function lcg(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }

// One cooking day, driven the way the phone drives the engine: pick, do it, repeat; wait for unlocks; move.
// profile: startOffset (min after 7:00), speedLo/speedHi (how long a step really takes, x the plan),
//          pOut (does some other open step instead), pRetry / pGiveUp (check steps), pAnchor (edits a time),
//          lateReact (min he is late to an unlock), moveJitter (min early/late on the road), pSkipOpt, choice.
function liveDay(plan, seed, profile) {
  const R = ref(plan), rnd = lcg(seed);
  const pr = Object.assign({ startOffset: 0, speedLo: 1, speedHi: 1, pOut: 0, pRetry: 0, pGiveUp: 0, pAnchor: 0, lateReact: 0, moveJitter: 0, pSkipOpt: 0, choice: 'default', every: 1 }, profile);
  let state = E.initialState(plan, 'chaos', H(6, 0));
  let now = H(7, 0) + Math.round(pr.startOffset * MIN);
  const viol = Object.create(null), log = [];
  let retries = 0, audits = 0;
  const note = (cat, msg) => { const c = viol[cat] || (viol[cat] = { n: 0, first: [] }); c.n++; if (c.first.length < 3) c.first.push('seed ' + seed + ' ' + msg); };
  const took = (s) => Math.round(R.stepMins(s) * (pr.speedLo + rnd() * (pr.speedHi - pr.speedLo)) * MIN);
  const finish = (s, payload) => {
    const before = state;
    state = E.complete(plan, state, s.id, now, payload);
    if (state.done[s.id] !== now || state.rev !== before.rev + 1) note('reducer-complete', s.id + ': done time or rev is wrong');
    if (s.wait) { const w = state.waits[s.wait.id]; if (!w || w.start !== now || w.mins !== s.wait.mins || w.by !== s.id) note('reducer-complete', s.id + ': its timer was not started at the done time'); }
  };
  for (let i = 0; i < 700; i++) {
    if (i % pr.every === 0) { audits++; for (const x of audit(plan, state, now, R).list) note(x.cat, x.msg); }
    if (R.done(state, R.byId.dinner)) break;
    const loc = R.loc(state);
    if (rnd() < pr.pAnchor) {                                   // he edits a time in Setup
      const name = ['leaveAm', 'backHome', 'leavePm', 'arrive', 'dinner'][Math.floor(rnd() * 5)];
      const next = E.setAnchor(plan, state, name, state.anchors[name] + [-30, -15, 15, 30][Math.floor(rnd() * 4)], now);
      if (next !== state) { state = next; log.push(clock(now) + ' anchor ' + name + ' -> ' + state.anchors[name]); continue; }
    }
    if (rnd() < pr.pOut) {                                      // he does some other open step, wherever he is
      const open = plan.steps.filter((s) => s.kind !== 'move' && s.id !== 'dinner' && R.active(state, s) && !R.done(state, s));
      if (open.length) {
        const s = open[Math.floor(rnd() * open.length)];
        now += took(s);
        finish(s, s.kind === 'choice' ? { value: s.choice.options[Math.floor(rnd() * s.choice.options.length)].value } : undefined);
        log.push(clock(now) + ' out of order: ' + s.id + ' in ' + loc);
        continue;
      }
    }
    const p = E.pick(plan, state, now);
    if (p) {
      if (p.kind === 'move') { finish(p); log.push(clock(now) + ' ' + p.id); continue; }
      if (p.kind === 'check' && retries < 5 && rnd() < pr.pRetry) {
        if (loc === 'home-am' && E.canGiveUp(plan, state, p.id, now) && rnd() < pr.pGiveUp) { state = E.giveUp(plan, state, p.id, now); log.push(clock(now) + ' give up ' + p.id); continue; }
        const next = E.retry(plan, state, p.id, now);
        if (next !== state) { retries++; state = next; log.push(clock(now) + ' retry ' + p.id); continue; }
      }
      if (p.optional && rnd() < pr.pSkipOpt) { state = E.skip(plan, state, p.id, now); log.push(clock(now) + ' skip ' + p.id); continue; }
      now += took(p);
      finish(p, p.kind === 'choice' ? { value: pr.choice === 'random' ? p.choice.options[Math.floor(rnd() * p.choice.options.length)].value : R.opt(state, p.choice.opt) } : undefined);
      log.push(clock(now) + ' ' + p.id);
      continue;
    }
    const jitter = () => Math.round((rnd() * 2 - 1) * pr.moveJitter * MIN);
    if (loc === 'away') { now = Math.max(now + MIN, E.anchorMs(state, 'backHome') + jitter()); finish(R.moves.backHome); log.push(clock(now) + ' back'); continue; }
    if (loc === 'drive') {
      now = Math.max(now + MIN, state.done[R.moves.leavePm.id] + (E.anchorMs(state, 'arrive') - E.anchorMs(state, 'leavePm')) + jitter());
      finish(R.moves.arrive); log.push(clock(now) + ' arrive'); continue;
    }
    const u = E.nextUnlock(plan, state, now);
    if (u && u.at > now) {
      if (u.reason === 'move' && pr.moveJitter && rnd() < 0.5) {      // he leaves early instead of waiting for the anchor
        now = Math.max(now + 1000, u.at - Math.round(rnd() * pr.moveJitter * MIN));
        finish(R.byId[u.stepId]); log.push(clock(now) + ' early ' + u.stepId); continue;
      }
      now = u.at + Math.round(rnd() * pr.lateReact * MIN);
      continue;
    }
    const mvName = LOC_MOVE[loc];
    if (!mvName) { log.push(clock(now) + ' stuck in ' + loc); break; }
    now = Math.max(now, E.anchorMs(state, mvName));
    finish(R.moves[mvName]); log.push(clock(now) + ' forced ' + mvName);
  }
  return { viol, log, state, now, audits, dinner: R.done(state, R.byId.dinner) };
}

// ================================================================================================ the fixture itself

test('fixture: Stew Night is a valid plan', () => {
  assert.deepEqual(E.validate(PLAN), []);
});

test('default day: every row is where the rules of SPEC 3.4 and 3.7 put it', () => {
  const s = fresh();
  const p = E.project(PLAN, s, H(6, 50));
  // worked out by hand: master order, the stew alarm at 7:20:30 and the fry alarm at 7:35 jump the queue
  const expected = {
    setup: [H(7), H(7, 5)], 'soak-q': [H(7, 5), H(7, 5, 30)], 'stew-drain': [H(7, 5, 30), H(7, 7, 30)], 'stew-heat': [H(7, 7, 30), H(7, 8, 30)],
    'brine-water': [H(7, 8, 30), H(7, 9, 30)], slice: [H(7, 9, 30), H(7, 15, 30)], chop: [H(7, 15, 30), H(7, 20, 30)],
    'stew-simmer': [H(7, 20, 30), H(7, 21, 30)], 'brine-dunk': [H(7, 21, 30), H(7, 24)], fry: [H(7, 24), H(7, 25)], grate: [H(7, 25), H(7, 29)],
    'sauce-base': [H(7, 29), H(7, 34)], drain: [H(7, 34), H(7, 36)], 'fry-out': [H(7, 36), H(7, 39)], juice: [H(7, 39), H(7, 57)],
    sauce: [H(7, 57), H(8, 3)], jar: [H(8, 3), H(8, 6)], puree: [H(8, 6), H(8, 12)], kit: [H(8, 12), H(8, 15)], tidy: [H(8, 15), H(8, 25)],
    'stew-check': [H(8, 25), H(8, 27)], 'stew-finish': [H(8, 27), H(8, 29)], 'pack-bag': [H(8, 29), H(8, 36)], 'stew-off': [H(8, 54), H(8, 57)],
    'stew-store': [H(9, 22), H(9, 25)], 'leave-am': [H(11), H(11)], back: [H(14), H(14)], cooler: [H(14), H(14, 10)], car: [H(14, 10), H(14, 14)],
    'leave-pm': [H(14, 30), H(14, 30)], arrive: [H(15), H(15)], 'h-unpack': [H(15), H(15, 5)], 'h-setup': [H(15, 5), H(15, 13)],
    'h-chop-a': [H(15, 13), H(15, 19)], 'h-chop-b': [H(15, 19), H(15, 29)], 'fish-cube': [H(15, 29), H(15, 35)], 'fish-cure': [H(15, 35), H(15, 37)],
    table: [H(15, 37), H(15, 47)], 'fish-check': [H(15, 57), H(15, 58)], 'fish-drain': [H(15, 58), H(16)], mix: [H(17, 30), H(17, 35)],
    'rice-toast': [H(18, 25), H(18, 31)], 'rice-cover': [H(18, 31), H(18, 32)], 'stew-reheat': [H(18, 45), H(18, 47)], 'rice-fluff': [H(18, 52), H(18, 53)],
    'corn-in': [H(18, 54), H(18, 55)], 'shrimp-marinate': [H(19, 5), H(19, 6)], 'corn-out': [H(19, 7), H(19, 11)], skillet: [H(19, 16), H(19, 17)],
    sear: [H(19, 20), H(19, 21, 30)], finish: [H(19, 25), H(19, 27)], dinner: [H(19, 30), H(19, 30)]
  };
  for (const id of Object.keys(expected)) assert.deepEqual(span(p, id), expected[id], id + ': ' + (span(p, id) || []).map(clock).join(' - '));
  assert.deepEqual(Object.keys(p.byStep).sort(), Object.keys(expected).sort(), 'exactly the steps of the default variant');
  assert.deepEqual(frees(p), [
    ['home-am', H(8, 36), H(8, 54), 'stew-off'], ['home-am', H(8, 57), H(9, 22), 'stew-store'], ['home-am', H(9, 25), H(11), 'leave-am'],
    ['home-pm', H(14, 14), H(14, 30), 'leave-pm'],
    ['hers', H(15, 47), H(15, 57), 'fish-check'], ['hers', H(16), H(17, 30), 'mix'], ['hers', H(17, 35), H(18, 25), 'rice-toast'],
    ['hers', H(18, 32), H(18, 45), 'stew-reheat'], ['hers', H(18, 47), H(18, 52), 'rice-fluff'], ['hers', H(18, 55), H(19, 5), 'shrimp-marinate'],
    ['hers', H(19, 11), H(19, 16), 'skillet'], ['hers', H(19, 17), H(19, 20), 'sear'], ['hers', H(19, 21, 30), H(19, 25), 'finish'], ['hers', H(19, 27), H(19, 30), 'dinner']
  ]);
  assert.equal(p.dinnerAt, H(19, 30));
  assert.equal(p.lateMin, 0);
  assert.equal(p.spareMin, 3, 'the last step before dinner ends 7:27 PM');
  assert.deepEqual(p.warnings, []);
  expectClean(PLAN, s, H(6, 50), 'default day');
});

// ================================================================================================ late and early starts

test('late start: 40 minutes late moves the morning by 40 minutes and nothing else', () => {
  const s = fresh();
  const base = E.project(PLAN, s, H(6, 50));
  const p = expectClean(PLAN, s, H(7, 40), '7:40 start');
  assert.equal(E.nextStep(PLAN, s, H(7, 40)), 'setup');
  for (const r of todoRows(base)) {
    const b = base.byStep[r.stepId], q = p.byStep[r.stepId];
    assert.ok(q, r.stepId + ' is still planned');
    const shift = b.loc === 'home-am' && r.type === 'step' ? 40 * MIN : 0;      // the hard outs and her kitchen do not move
    assert.deepEqual([q.start, q.end, q.loc], [b.start + shift, b.end + shift, b.loc], r.stepId + ' at ' + clock(q.start));
  }
  assert.deepEqual(span(p, 'stew-store'), [H(10, 2), H(10, 5)]);
  assert.deepEqual(frees(p).filter((f) => f[0] === 'home-am').pop(), ['home-am', H(10, 5), H(11), 'leave-am'], 'still 55 minutes in hand before leaving');
  assert.equal(p.lateMin, 0);
  assert.deepEqual(p.warnings, []);
});

test('late start: a cook who follows the guide from 7:40 is served dinner at 7:30 PM, every promise kept on the way', () => {
  const day = liveDay(PLAN, 1, { startOffset: 40 });
  noViolations(day, '7:40 start');
  assert.equal(day.dinner, true);
  assert.equal(day.state.done.dinner, H(19, 30));
  assert.equal(day.state.done['leave-am'], H(11));
  const p = E.progress(PLAN, day.state);
  assert.equal(p.done, p.total, 'every step of the day is done');
});

test('early start: before he begins the plan waits for 7:00; once he has begun at 6:30 it follows him', () => {
  const s = fresh();
  const base = E.project(PLAN, s, H(6, 50));
  const waiting = expectClean(PLAN, s, H(6, 30), '6:30, nothing done');
  assert.deepEqual(span(waiting, 'setup'), [H(7), H(7, 5)], 'SPEC 3.7: begin at the start anchor while nothing is done');
  assert.equal(waiting.byStep.setup.status, 'next');
  assert.equal(E.nextStep(PLAN, s, H(6, 30)), 'setup', 'he may start early: the first step is offered');
  // he did the setup from 6:30 to 6:35: half an hour ahead of the plan
  const began = E.complete(PLAN, s, 'setup', H(6, 35));
  const p = expectClean(PLAN, began, H(6, 35), '6:35, setup done');
  for (const r of todoRows(base)) {
    if (r.stepId === 'setup') continue;
    const b = base.byStep[r.stepId], q = p.byStep[r.stepId];
    const shift = b.loc === 'home-am' && r.type === 'step' ? -30 * MIN : 0;
    assert.deepEqual([q.start, q.end], [b.start + shift, b.end + shift], r.stepId + ' at ' + clock(q.start));
  }
  assert.equal(p.byStep['leave-am'].start, H(11), 'being early never moves the hard out');
  assert.deepEqual(frees(p).filter((f) => f[0] === 'home-am').pop(), ['home-am', H(8, 55), H(11), 'leave-am']);
  const day = liveDay(PLAN, 1, { startOffset: -30 });
  noViolations(day, '6:30 start');
  assert.equal(day.state.done.dinner, H(19, 30));
});

// ================================================================================================ doing it his own way

test('out of order: steps done before their deps, before their timers, and ahead of the queue', () => {
  let s = fresh();
  // he packs the bag first (last in the master order), takes "the fry" out before frying, jars before dunking
  s = run(s, [['pack-bag', H(7, 7)], ['fry-out', H(7, 10)], ['jar', H(7, 13)], ['stew-simmer', H(7, 14)]]);
  let p = expectClean(PLAN, s, H(7, 14), 'four steps out of order');
  assert.equal(E.nextStep(PLAN, s, H(7, 14)), 'setup', 'the guide carries on from the top of the master order');
  for (const id of ['pack-bag', 'fry-out', 'jar', 'stew-simmer']) assert.equal(p.byStep[id].status, 'done', id);
  for (const id of ['fry', 'brine-dunk', 'stew-heat', 'slice']) assert.equal(p.byStep[id].status, 'later', id + ' is still to do');
  assert.equal(todoRows(p).filter((r) => ['pack-bag', 'fry-out', 'jar', 'stew-simmer'].includes(r.stepId)).length, 0, 'nothing done is planned again');
  // the simmer timer he started by hand at 7:14 holds the check back until 8:14, whatever else is open
  assert.deepEqual(E.blockers(PLAN, s, 'stew-check', H(7, 30)), [{ type: 'wait', waitId: 'simmer', endsAt: H(8, 14) }]);
  // frying later starts a timer whose step is already done: nothing rings, nothing jumps the queue
  s = run(s, [['setup', H(7, 19)], ['fry', H(7, 20)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(7, 31)).filter((a) => a.kind === 'wait'), []);
  assert.equal(E.waitsView(PLAN, s, H(7, 31)).some((w) => w.id === 'fry'), false, 'SPEC 3.6: a wait is listed only while its gated step is not done');
  assert.equal(E.nextStep(PLAN, s, H(7, 31)), 'soak-q');
  expectClean(PLAN, s, H(7, 31), 'fry after fry-out');
  // and whole days of this: one step in three is something the guide did not ask for
  for (const seed of [11, 12, 13]) {
    const day = liveDay(PLAN, seed, { startOffset: 10, pOut: 0.35, speedLo: 0.8, speedHi: 1.3, choice: 'random' });
    noViolations(day, 'seed ' + seed, KNOWN);
    assert.equal(day.dinner, true, 'seed ' + seed + ': dinner is served');
  }
});

test('out of order: a her-kitchen step done at home stays where it happened and is never planned again', () => {
  let s = follow(fresh(), H(6, 50), 'stew-check');          // the morning up to the stew check (8:25)
  assert.equal(E.location(PLAN, s), 'home-am');
  // 9:00 to 9:14, he chops for the fish, cubes it and starts the cure. Those are her-kitchen steps.
  s = run(s, [['h-chop-a', H(9, 6)], ['fish-cube', H(9, 12)], ['fish-cure', H(9, 14)]]);
  const p = expectClean(PLAN, s, H(9, 14), 'hers steps done at home');
  for (const id of ['h-chop-a', 'fish-cube', 'fish-cure']) {
    assert.deepEqual([p.byStep[id].status, p.byStep[id].loc, p.byStep[id].deferred], ['done', 'home-am', false], id + ' happened in his kitchen');
  }
  assert.deepEqual(span(p, 'fish-cube'), [H(9, 6), H(9, 12)]);
  // the cure timer (urgent) ends 9:34 at home. Its step (fish-check) belongs to her kitchen: it is not picked here.
  assert.equal(E.isAvailable(PLAN, s, 'fish-check', H(9, 40)), false);
  assert.deepEqual(E.blockers(PLAN, s, 'fish-check', H(9, 40)), [{ type: 'place', where: 'hers' }]);
  assert.notEqual(E.nextStep(PLAN, s, H(9, 40)), 'fish-check');
  assert.equal(p.byStep['fish-check'].loc, 'hers');
  assert.deepEqual(E.alerts(PLAN, s, H(9, 40)).filter((a) => a.kind === 'wait').map((a) => [a.waitId, a.stepId]), [['cure', 'fish-check']], 'the alarm still tells him the fish is ready');
  // in her kitchen the rest follows in master order, without the three steps he already did
  const there = follow(s, H(9, 14), 'h-unpack');
  assert.equal(E.location(PLAN, there), 'hers');
  const q = expectClean(PLAN, there, H(15), 'arrived');
  assert.deepEqual(todoRows(q).slice(0, 5).map((r) => [r.stepId, r.start]),
    [['h-unpack', H(15)], ['h-setup', H(15, 5)], ['h-chop-b', H(15, 13)], ['fish-check', H(15, 23)], ['fish-drain', H(15, 24)]]);
});

// ================================================================================================ alarms

test('alarm: an urgent timer that ends while earlier steps are open wins the next pick, at home and in her kitchen', () => {
  // his kitchen: he fried at 7:10 with the whole morning still open
  let s = run(fresh(), [['setup', H(7, 5)], ['fry', H(7, 10)]]);
  assert.equal(E.nextStep(PLAN, s, H(7, 19, 59, 999)), 'soak-q', 'one millisecond before the alarm: master order');
  assert.equal(E.nextStep(PLAN, s, H(7, 20)), 'fry-out', 'SPEC 3.4 step 4: the alarm step jumps the queue');
  assert.deepEqual(E.nextUnlock(PLAN, s, H(7, 12)), { at: H(7, 20), stepId: 'fry-out', reason: 'wait' });
  // projection from 7:10: soak-q 7:10, stew-drain 7:10:30, stew-heat 7:12:30, brine-water 7:13:30, slice 7:14:30 to 7:20:30.
  // The alarm rings at 7:20 while he slices; fry-out is the very next row, before chop.
  let p = expectClean(PLAN, s, H(7, 10), 'fry at 7:10');
  assert.deepEqual(span(p, 'slice'), [H(7, 14, 30), H(7, 20, 30)]);
  assert.deepEqual(span(p, 'fry-out'), [H(7, 20, 30), H(7, 23, 30)]);
  assert.deepEqual(span(p, 'chop'), [H(7, 23, 30), H(7, 28, 30)]);
  // a quiet (not urgent) timer ending does not jump: the kettle ends 7:22:30, the dunk waits for its turn after chop
  assert.equal(p.byStep['brine-dunk'].start >= H(7, 28, 30), true);

  // her kitchen: he puts the corn under the broiler the minute he arrives (12 min, urgent), everything else still open
  s = run(follow(fresh(), H(6, 50), 'h-unpack'), [['corn-in', H(15, 2)]]);
  assert.equal(E.nextStep(PLAN, s, H(15, 13, 59, 999)), 'h-unpack');
  assert.equal(E.nextStep(PLAN, s, H(15, 14)), 'corn-out');
  p = expectClean(PLAN, s, H(15, 2), 'corn at 3:02 PM');
  assert.deepEqual(span(p, 'h-setup'), [H(15, 7), H(15, 15)]);
  assert.deepEqual(span(p, 'corn-out'), [H(15, 15), H(15, 19)], 'first row after the step the alarm interrupts');
  assert.deepEqual(span(p, 'h-chop-a'), [H(15, 19), H(15, 25)]);
});

test('alarm: after "check again" the retried timer still rings and still jumps the queue', () => {
  // her kitchen, fish first: chop, cube, cure by 3:14 PM; unpacking and setup are still open
  let s = run(follow(fresh(), H(6, 50), 'h-unpack'), [['h-chop-a', H(15, 6)], ['fish-cube', H(15, 12)], ['fish-cure', H(15, 14)]]);
  assert.equal(E.nextStep(PLAN, s, H(15, 34)), 'fish-check');
  s = E.retry(PLAN, s, 'fish-check', H(15, 34));                 // "Still glassy": 5 more minutes
  assert.deepEqual(s.waits.cure, { start: H(15, 34), mins: 5, by: 'fish-check' });
  assert.equal(E.nextStep(PLAN, s, H(15, 38, 59)), 'h-unpack', 'not offered again before the 5 minutes are over');
  assert.equal(E.nextStep(PLAN, s, H(15, 39)), 'fish-check', 'the retried timer is still the urgent one');
  assert.deepEqual(E.alerts(PLAN, s, H(15, 39)).filter((a) => a.kind === 'wait').map((a) => a.stepId), ['fish-check']);
  expectClean(PLAN, s, H(15, 36), 'after the retry');
});

// ================================================================================================ ties

test('ties: two urgent timers end in the same millisecond', () => {
  // her kitchen at 5:35 PM, everything before the rice done. He covers the rice at 6:32 (20 min) and, early, puts the
  // corn in at 6:40 (12 min). Both alarms go off at 6:52:00.000.
  let s = follow(fresh(), H(6, 50), 'rice-toast');
  s = run(s, [['rice-toast', H(18, 31)], ['rice-cover', H(18, 32)], ['corn-in', H(18, 40)], ['stew-reheat', H(18, 47)]]);
  assert.equal(s.waits.rice.start + 20 * MIN, H(18, 52));
  assert.equal(s.waits.corn.start + 12 * MIN, H(18, 52));
  assert.equal(E.pick(PLAN, s, H(18, 48)), null);
  assert.deepEqual(E.nextUnlock(PLAN, s, H(18, 48)), { at: H(18, 52), stepId: 'rice-fluff', reason: 'wait' });
  assert.equal(E.nextStep(PLAN, s, H(18, 51, 59, 999)), null);
  assert.equal(E.nextStep(PLAN, s, H(18, 52)), 'rice-fluff', 'SPEC 3.4 step 4: the first such in master order');
  assert.deepEqual(E.alerts(PLAN, s, H(18, 52)).filter((a) => a.kind === 'wait').map((a) => a.waitId).sort(), ['corn', 'rice']);
  const p = expectClean(PLAN, s, H(18, 48), 'two alarms at once');
  assert.deepEqual(span(p, 'rice-fluff'), [H(18, 52), H(18, 53)]);
  assert.deepEqual(span(p, 'corn-out'), [H(18, 53), H(18, 57)], 'the second alarm step follows at once');
  assert.deepEqual(frees(p)[0], ['hers', H(18, 48), H(18, 52), 'rice-fluff']);
  s = E.complete(PLAN, s, 'rice-fluff', H(18, 53));
  assert.equal(E.nextStep(PLAN, s, H(18, 53)), 'corn-out');
});

test('ties: an urgent and a quiet timer end in the same millisecond, the quiet step is earlier in the master order', () => {
  // his kitchen: fry at 7:18 (10 min, urgent) and kettle on at 7:20 (8 min, quiet). Both end 7:28:00.000.
  const s = run(fresh(), [['setup', H(7, 5)], ['slice', H(7, 11)], ['fry', H(7, 18)], ['brine-water', H(7, 20)]]);
  assert.equal(E.isAvailable(PLAN, s, 'brine-dunk', H(7, 28)), true);
  assert.equal(E.isAvailable(PLAN, s, 'fry-out', H(7, 28)), true);
  assert.equal(E.nextStep(PLAN, s, H(7, 28)), 'fry-out', 'the alarm wins although brine-dunk comes first in the master order');
  const u = E.nextUnlock(PLAN, s, H(7, 21));
  assert.deepEqual(u, { at: H(7, 28), stepId: 'fry-out', reason: 'wait' });
  expectClean(PLAN, s, H(7, 21), 'urgent and quiet tie');
});

test('ties: nextUnlock names the step the guide gives him when two timers end together', () => {
  // The jar (steeping, 30 min) and the fridge step (cooling, 25 min, a must step) both become possible at 9:30:00.000.
  // Nothing else is left. pick() goes by master order: the jar. The free-time card says "Next: ..." from nextUnlock().
  let s = morning(['brine-dunk', 'jar', 'stew-off', 'stew-store']);
  s = run(s, [['brine-dunk', H(9)], ['stew-off', H(9, 5)]]);
  assert.equal(s.waits.steep.start + 30 * MIN, H(9, 30));
  assert.equal(s.waits.cool.start + 25 * MIN, H(9, 30));
  assert.equal(E.pick(PLAN, s, H(9, 10)), null);
  assert.equal(E.nextStep(PLAN, s, H(9, 30)), 'jar', 'SPEC 3.4 step 5: the first kept step in master order');
  const u = E.nextUnlock(PLAN, s, H(9, 10));
  assert.equal(u.at, H(9, 30));
  assert.equal(u.stepId, E.nextStep(PLAN, s, u.at), 'nextUnlock().stepId is what pick() returns at that moment');
  const p = E.project(PLAN, s, H(9, 10));
  assert.equal(p.rows.find((r) => r.type === 'free').nextStepId, todoRows(p)[0].stepId, 'the free row names the row that follows it');
});

// ================================================================================================ the hard out

test('hard out: a quiet timer that ends exactly at 11:00 does not hold him back', () => {
  // 'either' step behind a quiet timer: the kettle (8 min) ends 11:00:00.000, the dunk (2 min 30) cannot fit: her kitchen
  let s = run(morning(['brine-water', 'brine-dunk', 'jar']), [['brine-water', H(10, 52)]]);
  assert.equal(E.isAvailable(PLAN, s, 'brine-dunk', H(11)), true);
  assert.equal(E.nextStep(PLAN, s, H(11)), 'leave-am');
  assert.deepEqual(E.nextUnlock(PLAN, s, H(10, 55)), { at: H(11), stepId: 'leave-am', reason: 'move' });
  let p = expectClean(PLAN, s, H(10, 55), 'kettle ends at the hard out');
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.deepEqual([p.byStep['brine-dunk'].loc, p.byStep['brine-dunk'].deferred], ['hers', true]);
  // home-only step that is not a must, behind a timer ending exactly at 11:00: it waits for the pack-up stop
  const q = stewNight();
  step(q, 'puree').wait = { id: 'reduce', mins: 10, label: 'Reducing', attended: false };
  Object.assign(step(q, 'kit'), { after: ['puree'], afterWait: 'reduce' });
  assert.deepEqual(E.validate(q), []);
  s = run(morning(['puree', 'kit'], H(8), q), [['puree', H(10, 50)]], q);
  assert.equal(E.nextStep(q, s, H(11)), 'leave-am');
  p = expectClean(q, s, H(10, 55), 'home-only step at the hard out');
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.deepEqual([p.byStep.kit.loc, p.byStep.kit.start], ['home-pm', H(14)]);
});

test('hard out: when an alarm goes off exactly at 11:00, the Day plan and the Now card agree on what comes first', () => {
  // Everything is done except the fry. He fries at 10:50:00.000; the 10 minute (urgent, stove on) timer ends 11:00:00.000.
  const s = run(morning(['fry', 'fry-out']), [['fry', H(10, 50)]]);
  assert.equal(s.waits.fry.start + 10 * MIN, H(11));
  const live = E.nextStep(PLAN, s, H(11));                 // what the Now card says at 11:00:00
  const p = E.project(PLAN, s, H(10, 55));                 // what the Day tab said five minutes earlier
  const first = todoRows(p)[0];
  assert.equal(first.type === 'move' ? first.at : first.start, H(11));
  assert.equal(first.stepId, live,
    'at 11:00 the guide says "' + live + '" but the plan made at 10:55 has "' + first.stepId + '" at 11:00 and fry-out in ' + p.byStep['fry-out'].loc + ' at ' + clock(p.byStep['fry-out'].start));
  expectClean(PLAN, s, H(10, 55), 'alarm at the hard out');
});

test('hard out: an 8:38 start puts "stew into the fridge" (must) exactly at 11:00, and the plan must match the guide', () => {
  // Nothing is constructed here: the default day, started 98 minutes late. stew-off ends 10:35, cooling takes 25 minutes,
  // so the must step stew-store unlocks at 11:00:00.000, the moment of the hard out.
  const s = fresh();
  const p = E.project(PLAN, s, H(8, 38));
  assert.deepEqual(span(p, 'stew-off'), [H(10, 32), H(10, 35)]);
  // he does every row the plan has before 11:00, at the planned times
  let atHardOut = s;
  for (const r of todoRows(p)) {
    if ((r.type === 'move' ? r.at : r.start) >= H(11)) break;
    atHardOut = E.complete(PLAN, atHardOut, r.stepId, r.type === 'move' ? r.at : r.end, r.stepId === 'soak-q' ? { value: true } : undefined);
  }
  assert.equal(atHardOut.waits.cool.start + 25 * MIN, H(11), 'the cooling timer ends on the dot');
  const live = E.nextStep(PLAN, atHardOut, H(11));          // what the Now card says at 11:00:00
  const planned = todoRows(p).find((r) => (r.type === 'move' ? r.at : r.start) >= H(11));
  assert.equal(planned.stepId, live, 'at 11:00 the guide says "' + live + '" but all morning the plan showed "' + planned.stepId + '" at 11:00');
  expectClean(PLAN, s, H(8, 38), '8:38 start');
});

test('hard out: an "either" step with stove time is offered only while step + stove time end by 11:00', () => {
  // fry: 1 min hands-on + 10 min on the stove (attended). Nothing else is open, so nothing else needs room.
  const s = morning(['fry', 'fry-out']);
  assert.equal(E.needMins(step(PLAN, 'fry')), 11);
  assert.equal(E.nextStep(PLAN, s, H(10, 49)), 'fry', 'ends exactly at the hard out: fits');
  assert.equal(E.nextStep(PLAN, s, H(10, 49, 0, 1)), null, 'one millisecond later it would run past 11:00: deferred');
  const p = expectClean(PLAN, s, H(10, 49, 0, 1), 'fry deferred');
  assert.deepEqual([p.byStep.fry.loc, p.byStep.fry.deferred], ['hers', true]);
  assert.deepEqual([p.byStep['fry-out'].loc, p.byStep['fry-out'].deferred], ['hers', true]);
  assert.deepEqual(warning(p, 'deferred').stepIds, ['fry', 'fry-out']);
  assert.equal(p.byStep['leave-am'].start, H(11));
  // time off the stove does not count: the dunk is 2 min 30 hands-on, its 30 minute steep needs nobody
  const d = morning(['brine-dunk', 'jar']);
  assert.equal(E.needMins(step(PLAN, 'brine-dunk')), 2.5);
  assert.equal(E.nextStep(PLAN, d, H(10, 57, 30)), 'brine-dunk');
  assert.equal(E.nextStep(PLAN, d, H(10, 57, 30, 1)), null);
  const pd = expectClean(PLAN, d, H(10, 57, 30), 'dunk just fits');
  assert.deepEqual([pd.byStep['brine-dunk'].loc, pd.byStep.jar.loc, pd.byStep.jar.deferred], ['home-am', 'hers', true]);
});

test('hard out: a home-only step whose stove time runs past 11:00 is kept and reported as am-overrun', () => {
  // Variant: the puree (home-only, 6 min) now reduces on the stove for 30 minutes (attended) before the kit can be packed.
  const q = stewNight();
  step(q, 'puree').wait = { id: 'reduce', mins: 30, label: 'Reducing', attended: true };
  Object.assign(step(q, 'kit'), { after: ['puree'], afterWait: 'reduce' });
  assert.deepEqual(E.validate(q), []);
  const s = morning(['puree', 'kit'], H(8), q);
  assert.equal(E.needMins(step(q, 'puree')), 36);
  assert.equal(E.nextStep(q, s, H(10, 50)), 'puree', 'SPEC 3.4: where home and not optional: kept although 36 min do not fit in 10');
  const p = E.project(q, s, H(10, 50));
  assert.deepEqual(span(p, 'puree'), [H(10, 50), H(10, 56)]);
  assert.deepEqual(p.rows.filter((r) => r.type === 'wait' && r.waitId === 'reduce').map((r) => [r.start, r.end, r.loc]), [[H(10, 56), H(11, 26), 'home-am']]);
  // (today the plan has him walk out at 11:00 with 26 minutes of stove time left and packs the kit at 2:00 PM)
  const w = warning(p, 'am-overrun');
  assert.ok(w, 'a home step runs past the hard out, expected an am-overrun warning; the plan leaves at ' + clock(p.byStep['leave-am'].start) + ' with warnings ' + JSON.stringify(codes(p)));
  assert.ok(Array.isArray(w.stepIds) && w.stepIds.length > 0);
});

test('hard out: when the stew is still simmering at 11:00 the plan says so', () => {
  // stew-heat fits at 10:40 (1 + 12 min). Its alarm step stew-simmer then starts a 60 minute simmer at 10:54.
  const s = morning(['stew-heat', 'stew-simmer', 'stew-check', 'stew-finish', 'stew-off', 'stew-store']);
  assert.equal(E.nextStep(PLAN, s, H(10, 40)), 'stew-heat');
  const p = expectClean(PLAN, s, H(10, 40), 'stew started at 10:40');
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.ok(codes(p).includes('beans-later') || codes(p).includes('am-overrun'), 'some warning tells him the stew is not finished: ' + JSON.stringify(codes(p)));
  assert.equal(p.byStep['stew-check'].loc, 'hers');
  assert.equal(p.byStep['stew-resume'].loc, 'hers', 'the leave rule switched the day to "finish at her place"');
});

test('fit rule: started at 9:00, the stew still finishes at his place', () => {
  // Two hours late, the same order as the default day. At 10:27 the last simmer is next: 2 min hands-on + 25 min on the
  // stove = 27 min, ends 10:54. SPEC 3.4 step 3: "fits if now + need <= L1". The only other work left there is the bag
  // (7 min) and, later, the fridge step: both fit inside the simmer. Then stew-off 10:54 to 10:57 fits too.
  const s = fresh();
  let at = follow(s, H(9), 'stew-check');                       // the morning as planned, up to the check
  assert.equal(Math.max(...Object.values(at.done)), H(10, 25));
  assert.equal(E.nextStep(PLAN, at, H(10, 25)), 'stew-check');
  at = E.complete(PLAN, at, 'stew-check', H(10, 27));
  assert.equal(E.isAvailable(PLAN, at, 'stew-finish', H(10, 27)), true);
  assert.equal(E.nextStep(PLAN, at, H(10, 27)), 'stew-finish',
    'stew-finish is first in the master order and ends 10:54, yet the guide gives him "' + E.nextStep(PLAN, at, H(10, 27)) + '"');
  const p = E.project(PLAN, s, H(9));
  assert.deepEqual([p.byStep['stew-finish'].loc, p.byStep['stew-finish'].start], ['home-am', H(10, 27)]);
  assert.deepEqual([p.byStep['stew-off'].loc, p.byStep['stew-off'].start], ['home-am', H(10, 54)]);
  assert.deepEqual(codes(p), [], 'nothing moved to her kitchen, the stew is finished before he leaves');
});

test('fit rule: stove time and must-do work overlap, they are not added up', () => {
  // 10:15, 45 minutes left. Open: the last simmer (2 + 25 min), and 19 min of must-do work (puree 6, kit 3, bag 7, fridge 3).
  // He can start the simmer and do all of that work while it bubbles: the simmer ends 10:42, 18 minutes to spare.
  const s = morning(['stew-finish', 'stew-off', 'stew-store', 'puree', 'kit', 'pack-bag', 'tidy']);
  assert.equal(E.nextStep(PLAN, s, H(10, 15)), 'stew-finish',
    'the guide passes over the simmer (27 min long, 45 min left) for "' + E.nextStep(PLAN, s, H(10, 15)) + '"');
  const p = E.project(PLAN, s, H(10, 15));
  assert.deepEqual([p.byStep['stew-finish'].loc, p.byStep['stew-off'].loc], ['home-am', 'home-am']);
  assert.equal(codes(p).includes('deferred') || codes(p).includes('beans-later'), false, JSON.stringify(codes(p)));
});

test('pack-up stop: a step that fits before 2:30 PM is offered, even when another one does not fit as well', () => {
  // The puree (6 min) and the kit (3 min) were not done in the morning. Both are home-only, neither is a must.
  let s = run(morning(['puree', 'kit']), [['leave-am', H(11)], ['back', H(14, 8)], ['cooler', H(14, 18)], ['car', H(14, 22)]]);
  // 2:22 PM: 8 minutes left, no must work left. SPEC 3.4: "keep steps that fit or are must". The puree ends 2:28.
  assert.equal(E.nextStep(PLAN, s, H(14, 22)), 'puree', '8 minutes left, the 6 minute puree fits, the guide offers ' + E.nextStep(PLAN, s, H(14, 22)));
  let p = E.project(PLAN, s, H(14, 22));
  assert.deepEqual(span(p, 'puree'), [H(14, 22), H(14, 28)]);
  assert.deepEqual(warning(p, 'missed').stepIds, ['kit'], 'only the kit (3 min, would end 2:31) is out of time');
  // 2:08 PM, before the must work: the puree (6) plus cooler and car (14) end at 2:28. It comes first in the master order.
  s = run(morning(['puree', 'kit']), [['leave-am', H(11)], ['back', H(14, 8)]]);
  assert.equal(E.nextStep(PLAN, s, H(14, 8)), 'puree');
  p = E.project(PLAN, s, H(14, 8));
  assert.deepEqual(span(p, 'puree'), [H(14, 8), H(14, 14)]);
});

// The next test is marked todo: the engine does what SPEC 3.3 and 3.4 say, to the letter (the fit rule looks at one step,
// a wait gate opens once its record has elapsed). The cook is still misled, so it is written down as a failing expectation.
const BEYOND_SPEC_HEAT = 'the letter of SPEC 3.3/3.4 allows this; the cook is told to use hot water that is four hours cold';
test('heat does not travel: a stove timer from his kitchen does not make a step ready in hers', { todo: BEYOND_SPEC_HEAT }, () => {
  // 10:49:30: the kettle (1 min + 8 min on the stove) still fits, the dunk that needs the hot water (2 min 30) will not.
  let s = morning(['brine-water', 'brine-dunk', 'jar']);
  const offered = E.nextStep(PLAN, s, H(10, 49, 30)) === 'brine-water';
  if (!offered) return;                                         // fine: it does not start heat it cannot use
  s = E.complete(PLAN, s, 'brine-water', H(10, 50, 30));         // water hot at 10:58:30
  assert.equal(E.nextStep(PLAN, s, H(10, 58, 30)), null, 'the dunk would end 11:01: deferred');
  const there = follow(s, H(10, 58, 30), 'h-unpack');
  assert.equal(E.location(PLAN, there), 'hers');
  assert.equal(E.isAvailable(PLAN, there, 'brine-dunk', H(15)), false,
    'at 3:00 PM in her kitchen "dunk in the hot water" is ready to go, on the strength of water he boiled at home at 10:58');
});

// ================================================================================================ checks, give up, choices

test('check: "still firm" five times in a row', () => {
  let s = follow(fresh(), H(6, 50), 'stew-check');          // 8:25, the 60 minute simmer ended 8:21:30
  let t = H(8, 25);
  for (let i = 1; i <= 5; i++) {
    assert.equal(E.nextStep(PLAN, s, t), 'stew-check', 'check #' + i + ' at ' + clock(t));
    const before = s;
    s = E.retry(PLAN, s, 'stew-check', t);
    assert.deepEqual(s.waits.simmer, { start: t, mins: 15, by: 'stew-check' }, 'SPEC 3.5 retry');
    assert.equal(s.rev, before.rev + 1);
    assert.equal(s.done['stew-check'], undefined);
    // while it simmers on he does what the guide gives him (the first time: the bag), then waits
    let now = t;
    for (let pk = E.pick(PLAN, s, now), n = 0; pk && n < 10; pk = E.pick(PLAN, s, now), n++) { now += E.stepMins(pk) * MIN; s = E.complete(PLAN, s, pk.id, now); }
    assert.ok(now < t + 15 * MIN);
    assert.equal(E.isAvailable(PLAN, s, 'stew-check', t + 15 * MIN - 1), false);
    assert.deepEqual(E.nextUnlock(PLAN, s, now), { at: t + 15 * MIN, stepId: 'stew-check', reason: 'wait' });
    const p = expectClean(PLAN, s, now, 'after retry #' + i);
    assert.equal(p.byStep['stew-check'].start, t + 15 * MIN, 'the next check is planned when the 15 minutes are over');
    assert.deepEqual(p.rows.filter((r) => r.type === 'wait' && r.waitId === 'simmer').map((r) => [r.start, r.end]), [[t, t + 15 * MIN]]);
    assert.equal(p.lateMin, 0);
    t += 15 * MIN;
  }
  // 9:40: tender at last. check 9:40, finish 9:42, last simmer to 10:09, off 10:09, cooling to 10:37, fridge 10:37 to 10:40.
  assert.equal(t, H(9, 40));
  assert.equal(E.canGiveUp(PLAN, s, 'stew-check', t), false, 'the give-up button only applies from 10:10');
  const p = expectClean(PLAN, s, t, 'after five retries');
  assert.deepEqual(span(p, 'stew-check'), [H(9, 40), H(9, 42)]);
  assert.deepEqual(span(p, 'stew-off'), [H(10, 9), H(10, 12)]);
  assert.deepEqual(span(p, 'stew-store'), [H(10, 37), H(10, 40)]);
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.deepEqual(p.warnings, []);
});

test('give up: the option switches one variant off and another on, and the day re-plans around it', () => {
  // an 8:45 start: the stew check comes up at 10:10, exactly when "No time. Finish at her place." starts to apply
  let s = follow(fresh(), H(8, 45), 'stew-check');
  assert.equal(E.nextStep(PLAN, s, H(10, 10)), 'stew-check');
  assert.equal(E.canGiveUp(PLAN, s, 'stew-check', H(10, 9, 59)), false, 'SPEC 9.2: not before leaveAm - 50 min');
  assert.equal(E.canGiveUp(PLAN, s, 'stew-check', H(10, 10)), true);
  const before = s;
  s = E.giveUp(PLAN, s, 'stew-check', H(10, 10));
  assert.deepEqual(s.opts, Object.assign({}, before.opts, { beansLater: true }));
  assert.deepEqual(['stew-pause', 'stew-store', 'stew-resume'].map((id) => E.isActive(PLAN, s, id)), [true, false, true]);
  assert.deepEqual(E.blockers(PLAN, s, 'stew-check', H(10, 10)), [{ type: 'after', stepId: 'stew-resume' }], 'the check now waits for her kitchen');
  assert.equal(E.nextStep(PLAN, s, H(10, 10)), 'stew-pause', 'the must step that takes the stew off the stove comes first');
  const p = expectClean(PLAN, s, H(10, 10), 'after giving up');
  assert.deepEqual(span(p, 'stew-pause'), [H(10, 10), H(10, 13)]);
  assert.deepEqual(span(p, 'pack-bag'), [H(10, 13), H(10, 20)]);
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.equal('stew-store' in p.byStep, false, 'the switched-off variant is not planned');
  assert.equal(warning(p, 'missed'), undefined, '... and not reported as missed');
  // her kitchen: unpack 3:00, stew back on 3:05, check 3:09, finish 3:11 (25 min simmer to 3:38), off after the fish is cubed
  assert.deepEqual(span(p, 'stew-resume'), [H(15, 5), H(15, 9)]);
  assert.deepEqual([span(p, 'stew-check'), p.byStep['stew-check'].deferred], [[H(15, 9), H(15, 11)], true]);
  assert.deepEqual(span(p, 'stew-finish'), [H(15, 11), H(15, 13)]);
  assert.deepEqual(span(p, 'stew-off'), [H(15, 43), H(15, 46)]);
  assert.deepEqual(warning(p, 'deferred').stepIds, ['stew-check', 'stew-finish', 'stew-off']);
  assert.ok(codes(p).includes('beans-later'));
  assert.equal(p.dinnerAt, H(19, 30));
  assert.equal(p.lateMin, 0);
  assert.deepEqual(E.packList(PLAN, s, 'cooler').map((i) => i.id), ['fish', 'pot'], 'the pot now travels');
});

test('give up: the button applies only in his kitchen in the morning (SPEC 9.2)', () => {
  let s = follow(fresh(), H(6, 50), 'stew-check');
  s = run(s, [['leave-am', H(11)]]);
  assert.equal(E.location(PLAN, s), 'away');
  assert.equal(E.canGiveUp(PLAN, s, 'stew-check', H(12)), false, 'canGiveUp is true while he is away (location "away")');
  s = run(s, [['back', H(14)]]);
  assert.equal(E.canGiveUp(PLAN, s, 'stew-check', H(14, 5)), false, 'packing up');
  s = run(s, [['cooler', H(14, 10)], ['car', H(14, 14)], ['leave-pm', H(14, 30)], ['arrive', H(15)], ['h-unpack', H(15, 5)], ['stew-resume', H(15, 9)]]);
  assert.equal(E.location(PLAN, s), 'hers');
  assert.equal(E.nextStep(PLAN, s, H(15, 9)), 'stew-check');
  assert.equal(E.canGiveUp(PLAN, s, 'stew-check', H(15, 9)), false, 'in her kitchen "No time. Finish at her place." makes no sense');
});

test('choice: never answered, the projection uses the default option and leaves the state alone', () => {
  // default "soaked: true" is the default day (first tests). Here the plan default is "not soaked".
  const q = stewNight();
  q.optionDefaults.soaked = false;
  deepFreeze(q);
  let s = fresh(q);
  let p = expectClean(q, s, H(6, 50), 'default not soaked');
  assert.equal('stew-drain' in p.byStep, false);
  // setup 7:00, question 7:05, quick soak 7:05:30 to 7:08:30, then 45 min in hot water: the stew can start 7:53:30.
  // He is juicing then (7:38 to 7:56), so stew-heat is 7:56; its alarm (8:09) finds him at the puree, simmer starts 8:12.
  assert.deepEqual(span(p, 'stew-quick'), [H(7, 5, 30), H(7, 8, 30)]);
  assert.deepEqual(span(p, 'fry-out'), [H(7, 35), H(7, 38)]);
  assert.deepEqual(span(p, 'juice'), [H(7, 38), H(7, 56)]);
  assert.deepEqual(span(p, 'stew-heat'), [H(7, 56), H(7, 57)]);
  assert.deepEqual(span(p, 'stew-simmer'), [H(8, 12), H(8, 13)]);
  assert.deepEqual(span(p, 'stew-check'), [H(9, 13), H(9, 15)]);
  assert.deepEqual(span(p, 'stew-store'), [H(10, 10), H(10, 13)]);
  assert.equal(p.lateMin, 0);
  assert.deepEqual(p.warnings, []);
  assert.deepEqual(s.opts, {}, 'projecting did not answer the question for him');
  assert.equal(E.isDone(q, s, 'soak-q'), false);
  // he does other things and never answers: the question stays first in line, the plan still assumes the default
  s = run(s, [['setup', H(7, 5)], ['slice', H(7, 11)], ['chop', H(7, 16)]], q);
  assert.equal(E.nextStep(q, s, H(7, 16)), 'soak-q');
  p = expectClean(q, s, H(7, 16), 'question still open');
  assert.equal(p.byStep['soak-q'].status, 'next');
  assert.equal('stew-quick' in p.byStep, true);
  assert.equal('stew-drain' in p.byStep, false);
  // answering against the default flips the variant at once
  const yes = E.complete(q, s, 'soak-q', H(7, 17), { value: true });
  p = expectClean(q, yes, H(7, 17), 'answered yes');
  assert.equal('stew-drain' in p.byStep, true);
  assert.equal('stew-quick' in p.byStep, false);
  // answered in Setup instead (setOpt): the question is done without a row of its own
  const setup = E.setOpt(q, s, 'soaked', true, H(7, 17));
  assert.equal(E.isDone(q, setup, 'soak-q'), true);
  p = expectClean(q, setup, H(7, 17), 'answered in Setup');
  assert.equal('soak-q' in p.byStep, false);
  assert.equal(E.nextStep(q, setup, H(7, 17)), 'stew-drain');
});

// ================================================================================================ timed back from dinner

test('notBefore: far ahead, every timed step starts exactly on its time and the gaps are free rows', () => {
  // He is very fast and leaves early everywhere: in her kitchen at 12:45 PM.
  let s = follow(fresh(), H(6, 50), 'leave-am');
  s = run(s, [['leave-am', H(9, 30)], ['back', H(12)], ['cooler', H(12, 10)], ['car', H(12, 14)], ['leave-pm', H(12, 15)], ['arrive', H(12, 45)]]);
  const p = expectClean(PLAN, s, H(12, 45), 'in her kitchen at 12:45');
  // prep runs straight through: unpack 12:45, setup 12:50, chop 12:58 and 1:04, cube 1:14, cure 1:20 (20 min), table 1:22,
  // check 1:42, drain 1:43 to 1:45. After that everything waits for its time before dinner.
  assert.deepEqual(span(p, 'fish-drain'), [H(13, 43), H(13, 45)]);
  const timed = { mix: H(17, 30), 'rice-toast': H(18, 25), 'stew-reheat': H(18, 45), 'corn-in': H(18, 54), 'shrimp-marinate': H(19, 5), finish: H(19, 25), dinner: H(19, 30) };
  for (const id of Object.keys(timed)) assert.equal(p.byStep[id].start, timed[id], id + ' starts at ' + clock(p.byStep[id].start));
  assert.deepEqual(frees(p).slice(0, 3), [['hers', H(13, 32), H(13, 42), 'fish-check'], ['hers', H(13, 45), H(17, 30), 'mix'], ['hers', H(17, 35), H(18, 25), 'rice-toast']]);
  assert.equal(p.lateMin, 0);
  assert.equal(p.spareMin, 3);
  assert.deepEqual(p.warnings, []);
  // nothing timed is offered early, the free card knows when and what
  assert.equal(E.pick(PLAN, follow(s, H(12, 45), 'mix'), H(14)), null);
  assert.deepEqual(E.nextUnlock(PLAN, follow(s, H(12, 45), 'mix'), H(14)), { at: H(17, 30), stepId: 'mix', reason: 'time' });
});

test('notBefore: far behind, dinner is late by exactly what the queue adds up to', () => {
  // The morning and the packing went to plan, but he only walks into her kitchen at 6:40 PM with all of it still to do.
  let s = follow(fresh(), H(6, 50), 'leave-pm');
  s = run(s, [['leave-pm', H(18, 10)], ['arrive', H(18, 40)]]);
  const p = expectClean(PLAN, s, H(18, 40), 'arrived 6:40 PM');
  // By hand, master order with alarms first: unpack 6:40, setup 6:45, chop 6:53 and 6:59, cube 7:09, cure 7:15 (to 7:37),
  // table 7:17, rice 7:27 to 7:33, cover 7:33 (to 7:54), reheat 7:34, corn in 7:36 (to 7:49), fish check 7:37 (alarm),
  // drain 7:38, mix 7:40, marinade 7:45 (to 7:56), free, corn out 7:49 (alarm), rice fluff 7:54 (alarm), finish 7:55,
  // skillet 7:57 (to 8:01), free, sear 8:01 to 8:02:30, dinner 8:02:30.
  const expected = {
    'h-unpack': [H(18, 40), H(18, 45)], 'h-setup': [H(18, 45), H(18, 53)], 'h-chop-a': [H(18, 53), H(18, 59)], 'h-chop-b': [H(18, 59), H(19, 9)],
    'fish-cube': [H(19, 9), H(19, 15)], 'fish-cure': [H(19, 15), H(19, 17)], table: [H(19, 17), H(19, 27)], 'rice-toast': [H(19, 27), H(19, 33)],
    'rice-cover': [H(19, 33), H(19, 34)], 'stew-reheat': [H(19, 34), H(19, 36)], 'corn-in': [H(19, 36), H(19, 37)], 'fish-check': [H(19, 37), H(19, 38)],
    'fish-drain': [H(19, 38), H(19, 40)], mix: [H(19, 40), H(19, 45)], 'shrimp-marinate': [H(19, 45), H(19, 46)], 'corn-out': [H(19, 49), H(19, 53)],
    'rice-fluff': [H(19, 54), H(19, 55)], finish: [H(19, 55), H(19, 57)], skillet: [H(19, 57), H(19, 58)], sear: [H(20, 1), H(20, 2, 30)],
    dinner: [H(20, 2, 30), H(20, 2, 30)]
  };
  for (const id of Object.keys(expected)) assert.deepEqual(span(p, id), expected[id], id + ': ' + (span(p, id) || []).map(clock).join(' - '));
  assert.deepEqual(todoRows(p).map((r) => r.stepId), Object.keys(expected), 'exactly these rows, in this order');
  assert.deepEqual(frees(p), [['hers', H(19, 46), H(19, 49), 'corn-out'], ['hers', H(19, 58), H(20, 1), 'sear']]);
  assert.equal(p.dinnerAt, H(20, 2, 30));
  assert.equal(p.lateMin, 33, 'round(32.5)');
  assert.equal(p.spareMin, 0);
  assert.deepEqual(codes(p), ['late']);
  assert.match(warning(p, 'late').text, /33/);
  for (const r of p.rows) if (r.type !== 'move') assert.ok(r.end >= r.start, 'no negative durations');
  const lateRows = p.rows.filter((r) => r.type === 'step' && r.late).map((r) => r.stepId);
  assert.deepEqual(lateRows, Object.keys(expected).filter((id) => expected[id][1] > H(19, 30) || id === 'dinner'), 'rows that end after 7:30 PM are flagged late');
});

// ================================================================================================ editing the times mid-day

test('anchors: dinner moved 30 minutes later while the corn is under the broiler', () => {
  let s = run(follow(fresh(), H(6, 50), 'corn-in'), [['corn-in', H(18, 55)]]);
  const before = expectClean(PLAN, s, H(18, 56), 'before the edit');
  assert.deepEqual([before.byStep['corn-out'].start, before.byStep['shrimp-marinate'].start, before.dinnerAt], [H(19, 7), H(19, 5), H(19, 30)]);
  const moved = E.setAnchor(PLAN, s, 'dinner', 1200, H(18, 56));
  assert.equal(moved.anchors.dinner, 1200);
  const p = expectClean(PLAN, moved, H(18, 56), 'dinner at 8:00 PM');
  // the broiler does not care about dinner: corn out at 7:07. Everything timed back from dinner moves by 30 minutes.
  const expected = { 'corn-out': [H(19, 7), H(19, 11)], 'shrimp-marinate': [H(19, 35), H(19, 36)], skillet: [H(19, 46), H(19, 47)], sear: [H(19, 50), H(19, 51, 30)],
    finish: [H(19, 55), H(19, 57)], dinner: [H(20), H(20)] };
  for (const id of Object.keys(expected)) assert.deepEqual(span(p, id), expected[id], id + ': ' + span(p, id).map(clock).join(' - '));
  assert.equal(p.dinnerAnchor, H(20));
  assert.equal(p.lateMin, 0);
  assert.equal(p.spareMin, 3);
  assert.deepEqual(E.nextUnlock(PLAN, moved, H(18, 56)), { at: H(19, 7), stepId: 'corn-out', reason: 'wait' });
  assert.deepEqual(E.blockers(PLAN, moved, 'shrimp-marinate', H(19, 5)), [{ type: 'time', at: H(19, 35) }]);
});

test('anchors: dinner moved to a time already past makes the day late at once, with the right number', () => {
  let s = run(follow(fresh(), H(6, 50), 'corn-in'), [['corn-in', H(18, 55)]]);
  s = E.setAnchor(PLAN, s, 'dinner', 1125, H(18, 56));           // 6:45 PM, eleven minutes ago
  const p = expectClean(PLAN, s, H(18, 56), 'dinner at 6:45 PM');
  // every timed step is open now: marinade 6:56 (10 min, to 7:07), finish 6:57 to 6:59, then both timers end at 7:07:00:
  // corn out (alarm) 7:07, skillet 7:11 (3 min), sear 7:15 to 7:16:30, dinner 7:16:30.
  const expected = { 'shrimp-marinate': [H(18, 56), H(18, 57)], finish: [H(18, 57), H(18, 59)], 'corn-out': [H(19, 7), H(19, 11)], skillet: [H(19, 11), H(19, 12)],
    sear: [H(19, 15), H(19, 16, 30)], dinner: [H(19, 16, 30), H(19, 16, 30)] };
  for (const id of Object.keys(expected)) assert.deepEqual(span(p, id), expected[id], id + ': ' + span(p, id).map(clock).join(' - '));
  assert.equal(p.lateMin, 32, 'round(31.5)');
  assert.equal(p.spareMin, 0);
  assert.deepEqual(codes(p), ['late']);
  // the corn and the marinade end in the same millisecond: the alarm (corn) is named and goes first
  assert.deepEqual(E.nextUnlock(PLAN, run(s, [['shrimp-marinate', H(18, 57)], ['finish', H(18, 59)]]), H(19)), { at: H(19, 7), stepId: 'corn-out', reason: 'wait' });
});

test('anchors: the morning hard out moved to before now', () => {
  let s = follow(fresh(), H(6, 50), 'grate');                     // 7:25: frying since 7:25, stew simmering since 7:21:30
  const edited = E.setAnchor(PLAN, s, 'leaveAm', 7 * 60 + 15, H(7, 26));
  assert.equal(edited.anchors.leaveAm, 435);
  assert.deepEqual(E.alerts(PLAN, edited, H(7, 26)).filter((a) => a.kind === 'leave').map((a) => [a.stepId, a.minsLeft <= 0]), [['leave-am', true]]);
  const p = expectClean(PLAN, edited, H(7, 26), 'hard out 11 minutes ago');
  const atHome = todoRows(p).filter((r) => r.type === 'step' && r.loc === 'home-am');
  for (const r of atHome) assert.ok(step(PLAN, r.stepId).must || step(PLAN, r.stepId).afterWait, r.stepId + ': only must steps and alarm steps may still hold him at home');
  assert.ok(p.byStep['leave-am'].start <= H(7, 26) + 7 * MIN, 'he leaves as soon as the bag (must, 7 min) is packed: ' + clock(p.byStep['leave-am'].start));
  for (const r of atHome) assert.ok(warning(p, 'am-overrun').stepIds.includes(r.stepId), r.stepId + ' ends after the hard out: am-overrun');
  assert.equal(p.byStep.juice.loc, 'hers');
  assert.equal(p.byStep.juice.deferred, true);
  assert.equal(p.byStep.puree.loc, 'home-pm', 'home-only work that is not a must waits for the pack-up stop');
  assert.ok(codes(p).includes('deferred'));
  assert.equal(p.lateMin, 0, 'the afternoon absorbs it');
  // an edit that would cross the next anchor is refused and changes nothing
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 845, H(7, 26)), s);
  assert.equal(E.setAnchor(PLAN, s, 'dinner', 890, H(7, 26)), s);
});

// ================================================================================================ the day before, the day after

test('evening before: nothing done, the plan is tomorrow from 7:00 and nothing nags tonight', () => {
  const eve = H(20) - DAY;
  const s = E.initialState(PLAN, 'adv', eve);
  assert.equal(s.day, '2026-11-23');
  const base = E.project(PLAN, fresh(), H(6, 50));
  const p = expectClean(PLAN, s, eve, 'the evening before');
  assert.deepEqual(p.byStep, base.byStep);
  assert.equal(E.nextStep(PLAN, s, eve), 'setup');
  assert.deepEqual(E.alerts(PLAN, s, eve), []);
  assert.deepEqual(E.nextUnlock(PLAN, s, eve), { at: H(11), stepId: 'leave-am', reason: 'move' });
  // ticking "soak" tonight answers tomorrow's question: no row for it, still a 7:00 start
  const soaked = E.tickTonight(PLAN, s, 'soak', true, eve);
  assert.equal(E.isDone(PLAN, soaked, 'soak-q'), true);
  const q = expectClean(PLAN, soaked, eve, 'soak ticked');
  assert.equal('soak-q' in q.byStep, false);
  assert.deepEqual(span(q, 'setup'), [H(7), H(7, 5)]);
  assert.deepEqual(span(q, 'stew-drain'), [H(7, 5), H(7, 7)]);
});

// Marked todo: the pseudo-code of SPEC 3.7 starts at the start anchor only "if nothing is done yet", and the engine follows
// it. The sentence above that pseudo-code ("if now is before the day's start anchor, begin at the start anchor") and the
// cook's evening both say otherwise.
const BEYOND_SPEC_NIGHT = 'SPEC 3.7 pseudo-code allows this; the Day tab shows the whole morning happening tonight';
test('evening before: one step done tonight does not move the whole morning into the night', { todo: BEYOND_SPEC_NIGHT }, () => {
  // 8:05 PM the evening before, he slices tomorrow's onions and marks the step done.
  const eve = H(20) - DAY;
  let s = E.initialState(PLAN, 'adv', eve);
  s = E.complete(PLAN, s, 'slice', eve + 5 * MIN);
  const p = E.project(PLAN, s, eve + 5 * MIN);
  const night = todoRows(p).filter((r) => (r.type === 'move' ? r.at : r.start) < E.dayMs(s));
  assert.equal(night.length, 0, night.length + ' steps are planned for tonight, the first: ' + night.slice(0, 4).map((r) => r.stepId + ' at ' + clock(r.type === 'move' ? r.at : r.start)).join(', '));
});

test('after dinner: everything done, nothing is proposed, nothing rings, the plan is all history', () => {
  const s = follow(fresh(), H(6, 50), null);
  assert.equal(s.done.dinner, H(19, 30));
  for (const now of [H(19, 30), H(21), H(9) + DAY]) {
    assert.equal(E.pick(PLAN, s, now), null);
    assert.equal(E.nextStep(PLAN, s, now), null);
    assert.equal(E.nextUnlock(PLAN, s, now), null);
    assert.deepEqual(E.alerts(PLAN, s, now), []);
    const p = expectClean(PLAN, s, now, 'done, at ' + clock(now));
    assert.equal(todoRows(p).length, 0);
    assert.equal(p.rows.some((r) => r.type === 'free'), false);
    assert.equal(p.rows.filter((r) => r.type === 'step' || r.type === 'move').every((r) => r.status === 'done'), true);
    assert.equal(p.dinnerAt, H(19, 30));
    assert.equal(p.lateMin, 0);
    assert.deepEqual(p.warnings, []);
  }
  const pr = E.progress(PLAN, s);
  assert.equal(pr.done, pr.total);
});

test('after dinner time: still cooking at 8:15 PM, the plan starts now and says how late', () => {
  // In her kitchen since 3:00 with only unpacking done; he looks at the plan at 8:15 PM.
  let s = follow(fresh(), H(6, 50), 'h-setup');
  const p = expectClean(PLAN, s, H(20, 15), 'at 8:15 PM');
  assert.equal(todoRows(p)[0].start, H(20, 15));
  // the same queue as in the 6:40 PM test, where setup started 6:45 and dinner was 8:02:30: here it starts 90 minutes later
  assert.equal(p.dinnerAt, H(21, 32, 30));
  assert.equal(p.lateMin, 123, 'round(122.5)');
  assert.deepEqual(codes(p), ['late']);
});

// ================================================================================================ every place, early and late

test('places: away, having left early or late, he is back at 2:00 PM; past 2:00 he is back "now"', () => {
  const ready = follow(fresh(), H(6, 50), 'leave-am');          // morning finished at 9:25
  for (const leftAt of [H(9, 40), H(11, 25)]) {
    const s = run(ready, [['leave-am', leftAt]]);
    assert.equal(E.location(PLAN, s), 'away');
    const now = leftAt + 15 * MIN;
    assert.equal(E.pick(PLAN, s, now), null);
    assert.deepEqual(E.nextUnlock(PLAN, s, now), { at: H(14), stepId: 'back', reason: 'move' });
    const p = expectClean(PLAN, s, now, 'away since ' + clock(leftAt));
    assert.deepEqual([p.byStep.back.start, p.byStep.back.status], [H(14), 'later']);
    assert.deepEqual(span(p, 'cooler'), [H(14), H(14, 10)]);
    assert.equal(p.dinnerAt, H(19, 30));
  }
  // 2:20 PM and still out: the guide asks "home?", the plan starts the packing now
  const s = run(ready, [['leave-am', H(11)]]);
  assert.equal(E.nextStep(PLAN, s, H(14, 20)), 'back');
  const p = expectClean(PLAN, s, H(14, 20), 'still away at 2:20 PM');
  assert.deepEqual([p.byStep.back.start, p.byStep.back.status], [H(14, 20), 'next']);
  assert.deepEqual(span(p, 'cooler'), [H(14, 20), H(14, 30)]);
  assert.deepEqual(span(p, 'car'), [H(14, 30), H(14, 34)]);
  assert.equal(p.byStep['leave-pm'].start, H(14, 34), 'a must step is finished before he leaves');
  assert.equal(p.byStep.arrive.start, H(15, 4), 'the drive still takes 30 minutes');
  assert.deepEqual(p.rows.filter((r) => r.type === 'step' && r.late).map((r) => r.stepId), ['car']);
  assert.equal(p.lateMin, 0);
});

test('places: pack-up stop, home early he still leaves at 2:30; home late the must steps push the leave', () => {
  const out = run(follow(fresh(), H(6, 50), 'leave-am'), [['leave-am', H(11)]]);
  let s = run(out, [['back', H(13, 20)]]);
  assert.equal(E.location(PLAN, s), 'home-pm');
  let p = expectClean(PLAN, s, H(13, 20), 'home at 1:20 PM');
  assert.deepEqual([span(p, 'cooler'), span(p, 'car')], [[H(13, 20), H(13, 30)], [H(13, 30), H(13, 34)]]);
  assert.deepEqual(frees(p)[0], ['home-pm', H(13, 34), H(14, 30), 'leave-pm']);
  assert.deepEqual([p.byStep['leave-pm'].start, p.byStep.arrive.start], [H(14, 30), H(15)]);
  assert.equal(E.isAvailable(PLAN, s, 'h-unpack', H(13, 40)), false);
  s = run(out, [['back', H(14, 25)]]);
  p = expectClean(PLAN, s, H(14, 25), 'home at 2:25 PM');
  assert.deepEqual([span(p, 'cooler'), span(p, 'car')], [[H(14, 25), H(14, 35)], [H(14, 35), H(14, 39)]]);
  assert.deepEqual([p.byStep['leave-pm'].start, p.byStep.arrive.start], [H(14, 39), H(15, 9)]);
  assert.deepEqual(p.rows.filter((r) => r.type === 'step' && r.late).map((r) => r.stepId), ['cooler', 'car']);
  assert.deepEqual(span(p, 'h-unpack'), [H(15, 9), H(15, 14)]);
  assert.equal(p.lateMin, 0);
});

test('places: on the road, the arrival follows the real departure', () => {
  const packed = follow(fresh(), H(6, 50), 'leave-pm');       // cooler and car loaded by 2:14 PM
  // left early at 2:15 PM: at 2:25 the plan has him there at 2:45
  let s = run(packed, [['leave-pm', H(14, 15)]]);
  assert.equal(E.location(PLAN, s), 'drive');
  let p = expectClean(PLAN, s, H(14, 25), 'on the road since 2:15');
  assert.equal(p.byStep.arrive.start, H(14, 45));
  assert.deepEqual(span(p, 'h-unpack'), [H(14, 45), H(14, 50)]);
  assert.equal(E.pick(PLAN, s, H(14, 25)), null);
  assert.deepEqual(E.nextUnlock(PLAN, s, H(14, 25)), { at: H(15), stepId: 'arrive', reason: 'move' });
  // left late at 2:50 PM: at 3:05 he is not there yet
  s = run(packed, [['leave-pm', H(14, 50)]]);
  p = expectClean(PLAN, s, H(15, 5), 'on the road since 2:50');
  assert.equal(p.byStep.arrive.start, H(15, 20));
  assert.equal(p.dinnerAt, H(19, 30));
  // slow traffic: 3:40 and still driving. He arrives "now".
  p = expectClean(PLAN, s, H(15, 40), 'still on the road at 3:40');
  assert.deepEqual([p.byStep.arrive.start, p.byStep.arrive.status], [H(15, 40), 'next']);
});

test('places: her kitchen, arriving early or an hour late still makes a 7:30 dinner', () => {
  const road = run(follow(fresh(), H(6, 50), 'leave-pm'), [['leave-pm', H(14, 10)]]);
  for (const [at, label] of [[H(14, 40), 'early'], [H(16), 'an hour late']]) {
    const s = run(road, [['arrive', at]]);
    assert.equal(E.location(PLAN, s), 'hers');
    const p = expectClean(PLAN, s, at, 'arrived ' + label);
    assert.deepEqual(span(p, 'h-unpack'), [at, at + 5 * MIN]);
    assert.deepEqual(span(p, 'fish-cure'), [at + 35 * MIN, at + 37 * MIN]);
    assert.equal(p.byStep.mix.start, H(17, 30));
    assert.equal(p.dinnerAt, H(19, 30));
    assert.equal(p.lateMin, 0);
    assert.deepEqual(p.warnings, []);
  }
});

test('places: marking "arrive" done without "leave" still leaves a day that can end with dinner', () => {
  // He forgot to tap "I'm on my way". In her kitchen he opens the Day tab and marks "Arrive" done.
  // The kit (home-only) was never packed; when he leaves through the leave step, such steps are written off.
  let s = run(morning(['kit']), [['leave-am', H(11)], ['back', H(14)], ['cooler', H(14, 10)], ['car', H(14, 14)]]);
  s = E.complete(PLAN, s, 'arrive', H(15));
  assert.equal(E.location(PLAN, s), 'hers');
  const p = E.project(PLAN, s, H(15));
  const missed = (warning(p, 'missed') || { stepIds: [] }).stepIds;
  assert.notEqual(p.dinnerAt, null, 'dinner cannot be planned at all; not happening: ' + missed.join(', '));
  assert.deepEqual(missed.filter((id) => step(PLAN, id).kind === 'move'), [], 'a move he has plainly made is reported as "no time for"');
});

// ================================================================================================ size and speed

function bigPlan(build) {
  const S = (id, where, mins, extra) => Object.assign({ id, dish: 'd', block: where === 'hers' ? 'hers' : 'am', where, title: id, body: [], mins }, extra || {});
  const moves = () => [S('leave-am', 'home', 0, { kind: 'move', move: 'leaveAm' }), S('back', 'home', 0, { kind: 'move', move: 'backHome' }),
    S('leave-pm', 'home', 0, { kind: 'move', move: 'leavePm' }), S('arrive', 'hers', 0, { kind: 'move', move: 'arrive' })];
  const plan = { version: 1, title: 'Big', anchors: { start: 420, leaveAm: 660, backHome: 840, leavePm: 870, arrive: 900, dinner: 1170 }, anchorLabels: {}, optionDefaults: {}, rules: [],
    dishes: [{ id: 'd', nick: 'd', name: 'd', color: 'x', blurb: '', makes: '', source: { label: 'x', url: null }, ingredients: [], gear: [], notes: [] }],
    glossary: {}, tonight: [], steps: [], pack: { cooler: [], bag: [], gear: [] }, containers: { home: [], hers: [] } };
  build(plan.steps, S, moves);
  return plan;
}
function bestOf(n, fn) {
  let best = Infinity, out;
  for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); out = fn(); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); }
  return { ms: best, out };
}
const BIG = {
  'a chain of 195 "either" steps in the morning': (steps, S, moves) => {
    for (let i = 0; i < 195; i++) steps.push(S('c' + i, 'either', 1, i ? { after: ['c' + (i - 1)] } : {}));
    steps.push(...moves(), S('dinner', 'hers', 0, { after: ['c194'], notBefore: { anchor: 'dinner', mins: 0 } }));
  },
  'a chain of 195 home-only steps, more than the morning holds': (steps, S, moves) => {
    for (let i = 0; i < 195; i++) steps.push(S('h' + i, 'home', 1.25, i ? { after: ['h' + (i - 1)] } : {}));
    steps.push(...moves(), S('dinner', 'hers', 0, { notBefore: { anchor: 'dinner', mins: 0 } }));
  },
  'a chain of 195 steps in her kitchen, each behind the timer of the one before': (steps, S, moves) => {
    steps.push(...moves());
    for (let i = 0; i < 195; i++) steps.push(S('w' + i, 'hers', 0.5, Object.assign({ wait: { id: 'wt' + i, mins: 0.5, label: 'w', urgent: i % 2 === 0, attended: i % 3 === 0 } }, i ? { after: ['w' + (i - 1)], afterWait: 'wt' + (i - 1) } : {})));
    steps.push(S('dinner', 'hers', 0, { after: ['w194'], notBefore: { anchor: 'dinner', mins: 0 } }));
  },
  '195 timed steps one minute apart': (steps, S, moves) => {
    steps.push(...moves());
    for (let i = 0; i < 195; i++) steps.push(S('n' + i, 'hers', 0.5, { notBefore: { anchor: 'dinner', mins: -260 + i } }));
    steps.push(S('dinner', 'hers', 0, { notBefore: { anchor: 'dinner', mins: 0 } }));
  },
  'a mixed day: 100 either, 50 home (must / optional), 45 timed, each needing the three before it': (steps, S, moves) => {
    const am = [], pm = [];
    for (let i = 0; i < 100; i++) {
      const s = S('e' + i, 'either', 2, { after: am.slice(-3) });
      if (i % 7 === 0) s.wait = { id: 'ew' + i, mins: 10, label: 'x', attended: true, urgent: i % 14 === 0 };
      if (i % 7 === 1) s.afterWait = 'ew' + (i - 1);
      steps.push(s); am.push(s.id);
    }
    for (let i = 0; i < 50; i++) steps.push(S('h' + i, 'home', 1, Object.assign({ after: i ? ['h' + (i - 1)] : [] }, i % 5 === 0 ? { must: true } : i % 5 === 1 ? { optional: true } : {})));
    steps.push(...moves());
    for (let i = 0; i < 45; i++) { steps.push(S('x' + i, 'hers', 2, { after: pm.slice(-2), notBefore: { anchor: 'dinner', mins: -200 + i * 4 } })); pm.push('x' + i); }
    steps.push(S('dinner', 'hers', 0, { after: pm.slice(-1), notBefore: { anchor: 'dinner', mins: 0 } }));
  }
};
for (const name of Object.keys(BIG)) {
  test('200 steps: ' + name + ' projects within 200 ms and keeps every promise', (t) => {
    const plan = deepFreeze(bigPlan(BIG[name]));
    assert.equal(plan.steps.length, 200);
    assert.deepEqual(E.validate(plan), []);
    for (const now of [H(7), H(10, 15), H(15, 30)]) {
      const s = deepFreeze(E.initialState(plan, 'big', H(6)));
      const r = bestOf(3, () => E.project(plan, s, now));
      t.diagnostic(clock(now) + ' start: project ' + r.ms.toFixed(1) + ' ms, ' + r.out.rows.length + ' rows');
      assert.ok(r.ms < 200, 'project() took ' + r.ms.toFixed(1) + ' ms for a ' + clock(now) + ' start');
      const planned = r.out.rows.filter((x) => x.type === 'step' || x.type === 'move').map((x) => x.stepId);
      assert.equal(new Set(planned).size, planned.length);
      const missed = (warning(r.out, 'missed') || { stepIds: [] }).stepIds;
      for (const st of plan.steps) assert.ok(st.optional || r.out.byStep[st.id] || missed.includes(st.id), st.id + ' is neither planned nor reported');
      const p1 = bestOf(3, () => E.pick(plan, s, now));
      assert.ok(p1.ms < 20, 'pick() took ' + p1.ms.toFixed(1) + ' ms');
    }
    const a = audit(plan, E.initialState(plan, 'big', H(6)), H(7));
    assert.deepEqual(a.list.filter((x) => KNOWN.indexOf(x.cat) < 0).slice(0, 5), []);
  });
}

test('200 steps: the worst case (every step needs every step before it) still ends, and in how long', (t) => {
  const plan = deepFreeze(bigPlan((steps, S, moves) => {
    const ids = [];
    for (let i = 0; i < 195; i++) { steps.push(S('d' + i, i % 2 ? 'home' : 'either', 1, { after: ids.slice() })); ids.push('d' + i); }
    steps.push(...moves(), S('dinner', 'hers', 0, { notBefore: { anchor: 'dinner', mins: 0 } }));
  }));
  assert.deepEqual(E.validate(plan), []);
  const s = E.initialState(plan, 'big', H(6));
  const r = bestOf(2, () => E.project(plan, s, H(7)));
  t.diagnostic('19,000 dependency edges: project ' + r.ms.toFixed(0) + ' ms (the 200 ms budget is for realistic plans)');
  assert.equal(r.out.rows.filter((x) => x.type === 'step').length, 196);
  assert.ok(r.ms < 5000, 'project() took ' + r.ms.toFixed(0) + ' ms');
});

// ================================================================================================ chaos (one shared run)

let CHAOS = null;
function chaos() {
  if (CHAOS) return CHAOS;
  const days = [];
  for (let off = -30; off <= 240; off += 15) days.push(['start ' + (off < 0 ? off : '+' + off) + ' min', 1, { startOffset: off }]);
  days.push(['on time, check retried five times', 2, { startOffset: 0, pRetry: 1 }]);
  days.push(['40 late, check retried five times', 2, { startOffset: 40, pRetry: 1 }]);
  days.push(['60 late, gives up when he can', 3, { startOffset: 60, pRetry: 1, pGiveUp: 1 }]);
  days.push(['120 late, gives up when he can', 3, { startOffset: 120, pRetry: 1, pGiveUp: 1 }]);
  for (let seed = 1; seed <= 24; seed++) {
    days.push(['chaotic #' + seed, seed, { startOffset: Math.round(lcg(seed * 7)() * 200 - 30), speedLo: 0.6, speedHi: 1.8, pOut: 0.08, pRetry: 0.6, pGiveUp: 0.4, pAnchor: 0.03, lateReact: 3, moveJitter: 25, pSkipOpt: 0.3, choice: 'random' }]);
  }
  for (let seed = 1; seed <= 8; seed++) {
    days.push(['slow #' + seed, seed, { startOffset: Math.round(lcg(seed * 3)() * 120), speedLo: 1.0, speedHi: 1.6, pRetry: 0.5, pGiveUp: 0.3, lateReact: 2, moveJitter: 10 }]);
  }
  const viol = Object.create(null), noDinner = [];
  let audits = 0;
  for (const [name, seed, profile] of days) {
    const day = liveDay(PLAN, seed, profile);
    audits += day.audits;
    if (!day.dinner) noDinner.push(name + ': ' + day.log.slice(-3).join(' | '));
    for (const cat of Object.keys(day.viol)) {
      const c = viol[cat] || (viol[cat] = { n: 0, days: [], first: [] });
      c.n += day.viol[cat].n; c.days.push(name);
      for (const m of day.viol[cat].first) if (c.first.length < 4) c.first.push(name + ': ' + m);
    }
  }
  CHAOS = { days: days.length, audits, viol, noDinner };
  return CHAOS;
}
// Assert that the shared run broke no promise whose category starts with one of `prefixes`.
function chaosClean(t, prefixes, except = []) {
  const c = chaos();
  const cats = Object.keys(c.viol).filter((cat) => prefixes.some((p) => cat === p || cat.startsWith(p + '-')) && except.indexOf(cat) < 0);
  t.diagnostic(c.days + ' simulated days, ' + c.audits + ' audited moments');
  assert.equal(cats.length, 0, '\n  ' + cats.map((cat) => cat + ' x' + c.viol[cat].n + ' on ' + c.viol[cat].days.length + ' days\n    ' + c.viol[cat].first.join('\n    ')).join('\n  '));
}

test('chaos: location, isAvailable and blockers always match SPEC 3.2 and 3.3, complete() records what it is given', (t) => {
  chaosClean(t, ['location', 'isAvailable', 'blockers', 'reducer']);
});

test('chaos: pick is always available, alarms first, master order, never a move before its anchor, never past the fit rule', (t) => {
  chaosClean(t, ['pick'], ['pick-skips-fitting']);
});

test('chaos: pick never passes over a step that certainly fits before the hard out', (t) => chaosClean(t, ['pick-skips-fitting']));

test('chaos: nextUnlock is in the future, the earliest, has the right reason and names what pick returns then', (t) => chaosClean(t, ['unlock']));

test('chaos: projections are chronological, one row per step, no overlaps, byStep and warnings consistent, lateMin right', (t) => chaosClean(t, ['proj', 'project']));

test('chaos: replayed row by row, every projection is exactly what the guide proposes at that moment', (t) => chaosClean(t, ['replay']));

test('chaos: every simulated day ends with dinner served', () => {
  assert.deepEqual(chaos().noDinner, []);
});

// ================================================================================================ the real plan, when it is there

// plan.js belongs to someone else and may change. These two checks use nothing but the spec: no step ids, no times.
let REAL = null;
try { REAL = require('../plan.js'); } catch (e) { REAL = null; }
const noReal = !REAL || !Array.isArray(REAL.steps) || E.validate(REAL).length > 0 ? 'plan.js is not there (or does not validate) yet' : false;

test('real plan: simulated days (on time, 40 min late, stubborn beans, chaotic) keep every promise and end with dinner', { skip: noReal }, () => {
  const days = [
    ['7:00 start', 1, { startOffset: 0 }],
    ['7:40 start', 1, { startOffset: 40 }],
    ['7:20 start, every check retried', 2, { startOffset: 20, pRetry: 1 }],
    ['chaotic', 5, { startOffset: 25, speedLo: 0.6, speedHi: 1.8, pOut: 0.08, pRetry: 0.6, pGiveUp: 0.4, pAnchor: 0.03, lateReact: 3, moveJitter: 25, pSkipOpt: 0.3, choice: 'random' }]
  ];
  for (const [label, seed, profile] of days) {
    const day = liveDay(REAL, seed, profile);
    noViolations(day, 'real plan, ' + label, KNOWN);
    assert.equal(day.dinner, true, 'real plan, ' + label + ': dinner is served\n' + day.log.slice(-5).join('\n'));
  }
});

test('real plan: started at 8:30, the guide never passes over a step that certainly fits before 11:00', { skip: noReal }, () => {
  const day = liveDay(REAL, 1, { startOffset: 90 });
  const hit = day.viol['pick-skips-fitting'];
  assert.equal(hit ? hit.n : 0, 0, hit ? hit.first.join('\n  ') : '');
});
