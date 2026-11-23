'use strict';
/*
 * Adversarial tests for engine.js: the reducers, the state they produce, and the view helpers.
 * Run: node --test ceviche-night/app/dev/engine.adversary-state.test.js
 *
 * - Own fixture (a made-up soup / salad / bread day with its own anchor times), not the real recipes
 *   and not the engine builder's fixture, so nothing passes by coincidence.
 * - The plan is deep-frozen. Every reducer call goes through act(), which deep-freezes the state first
 *   and checks on EVERY call: no throw, input untouched, rev + 1 and updatedAt = now on a change,
 *   a JSON-clean result, and the same result when the input went through JSON first.
 * - Random walks (valid and junk calls, fixture and the real plan.js when it is there) compare the engine
 *   with small reference versions of SPEC 3.2, 3.3, 3.5 and 3.6 written out again in this file.
 * - A plain failing test = the engine contradicts SPEC.md (or crashes).
 * - A test marked `todo` = the spec does not pin the behaviour down, but the way the engine does it
 *   can bite the cook. Those are reported, they do not fail the run.
 * - The file only reads engine.js and plan.js. It never edits them. It passes in any time zone.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const MIN = 60000;
const DAY = '2027-01-16';                                   // a Saturday with no clock change anywhere
const H = (h, m = 0, s = 0, ms = 0) => new Date(2027, 0, 16, h, m, s, ms).getTime();
const RT = (x) => JSON.parse(JSON.stringify(x));            // how the state is stored and synced
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

// ---------------------------------------------------------------- fixture

function makePlan() {
  const st = (o) => Object.assign({ body: [], mins: 1 }, o);
  return {
    version: 1,
    title: 'Soup Night',
    // NOT the real day's times: 8:00, 11:30, 1:30, 2:10, 2:40, 7:00
    anchors: { start: 480, leaveAm: 690, backHome: 810, leavePm: 850, arrive: 880, dinner: 1140 },
    anchorLabels: { start: 'Start', leaveAm: 'Leave', backHome: 'Back', leavePm: 'Leave again', arrive: 'Arrive', dinner: 'Dinner' },
    optionDefaults: { soaked: true, late: false, packed: false, saladReady: false, stoveOn: false },
    rules: [
      { on: 'go-am', ifNotDone: 'taste', set: { late: true } },
      { on: 'go-am', set: { packed: true } },
      { on: 'arrive', ifDone: 'brine-drain', set: { saladReady: true } },
      { on: 'go-pm', ifDone: 'boil', ifNotDone: 'stove-off', set: { stoveOn: true } }
    ],
    dishes: [
      { id: 'soup', nick: 'The Pot', name: 'pea soup', color: 'green', blurb: 'Thick and warm.', makes: '2 bowls',
        source: { label: 'Family card', url: null },
        ingredients: [{ qty: 'Soup', item: '' }, { qty: '1 cup', item: 'split peas', note: 'rinsed' }, { qty: '', item: 'salt' }],
        gear: ['Big pot'], notes: ['Keep it at a [[simmer]].'] },
      { id: 'salad', nick: 'The Crunch', name: 'cucumber salad', color: 'teal', blurb: 'Cold and sharp.', makes: '2 plates',
        source: { label: 'A site', url: 'https://example.com/salad' }, ingredients: [{ qty: '2', item: 'cucumbers' }], gear: ['Bowl'], notes: [] },
      { id: 'bread', nick: 'The Toast', name: 'garlic bread', color: 'gold', blurb: '', makes: '4 slices',
        source: { label: 'A site', url: 'https://example.com/bread' }, ingredients: [], gear: [], notes: [] }
    ],
    glossary: {
      simmer: { term: 'Simmer', text: 'Small bubbles.\nNot a full boil.' },
      brine: { term: 'Brine', text: 'Salty water. Keep it below a [[simmer]].' }
    },
    tonight: [
      { id: 'shop', title: 'Check the shopping', body: ['Everything is in the fridge.'] },
      { id: 'soak', title: 'Soak the peas', body: ['Cover them with water.', 'They [[simmer]] tomorrow.'], sets: { soaked: true } }
    ],
    steps: [
      // her kitchen first, like the real plan: array order is priority, not time
      st({ id: 'h-unpack', dish: 'day', block: 'hers', where: 'hers', title: 'Unpack', body: ['Cold things go in her fridge.'], mins: 5 }),
      st({ id: 'soup-resume', dish: 'soup', block: 'hers', where: 'hers', title: 'Soup back on the stove', body: ['Bring it back to a [[simmer]].'], mins: 4,
        when: { late: true }, wait: { id: 'soup2', mins: 30, label: 'Soup finishing', attended: true } }),
      st({ id: 'soup-taste2', dish: 'soup', block: 'hers', where: 'hers', kind: 'check', title: 'Taste the soup again', when: { late: true },
        after: ['soup-resume'], afterWait: 'soup2', check: { yes: 'Soft', no: 'Still hard', retryMins: 5 } }),
      st({ id: 'q-soak', dish: 'soup', block: 'am', where: 'home', kind: 'choice', title: 'Did the peas soak?', mins: 0.5,
        choice: { opt: 'soaked', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] } }),
      // two variants that start the SAME wait id
      st({ id: 'quick', dish: 'soup', block: 'am', where: 'home', title: 'Quick soak', mins: 3, after: ['q-soak'], when: { soaked: false },
        wait: { id: 'rest', mins: 30, label: 'Peas resting' } }),
      st({ id: 'rinse', dish: 'soup', block: 'am', where: 'home', title: 'Rinse the peas', mins: 2, after: ['q-soak'], when: { soaked: true },
        wait: { id: 'rest', mins: 5, label: 'Peas draining' } }),
      st({ id: 'boil', dish: 'soup', block: 'am', where: 'home', title: 'Start the soup', body: ['Bring it to a [[simmer|gentle simmer]].'],
        look: 'Small bubbles. See [[simmer]].', mins: 4, after: ['quick', 'rinse'], afterWait: 'rest',
        wait: { id: 'simmer', mins: 40, label: 'Soup simmering', attended: true, laps: [30, 10, 20], lapLabel: 'Stir the pot' } }),
      st({ id: 'taste', dish: 'soup', block: 'am', where: 'home', kind: 'check', title: 'Taste the soup', after: ['boil'], afterWait: 'simmer',
        when: { late: false },
        check: { yes: 'Soft', no: 'Still hard', retryMins: 10,
          giveUp: { label: 'No time. Finish it later.', set: { late: true }, withinMinsOf: { anchor: 'leaveAm', mins: 45 } } } }),
      st({ id: 'toast', dish: 'bread', block: 'am', where: 'either', title: 'Toast the bread', mins: 2, timer: { secs: 45, label: 'Butter melting' },
        wait: { id: 'toast', mins: 6, label: 'Bread toasting', attended: true, urgent: true } }),
      st({ id: 'toast-out', dish: 'bread', block: 'am', where: 'either', title: 'Take the bread out', after: ['toast'], afterWait: 'toast' }),
      st({ id: 'brine', dish: 'salad', block: 'am', where: 'either', title: 'Salt the cucumbers', mins: 3, tip: '[[brine|Brining]] keeps them crisp.',
        wait: { id: 'brine', mins: 15, label: 'Cucumbers brining', max: 25 } }),
      st({ id: 'brine-drain', dish: 'salad', block: 'am', where: 'either', title: 'Drain the cucumbers', mins: 2, after: ['brine'], afterWait: 'brine',
        warn: 'Do not leave them in the [[brine]] too long.' }),
      st({ id: 'chill', dish: 'salad', block: 'am', where: 'either', title: 'Chill the bowl', wait: { id: 'chill', mins: 20, label: 'Bowl chilling' } }),   // gates nothing
      st({ id: 'garnish', dish: 'salad', block: 'am', where: 'home', title: 'Cut the garnish', mins: 5, optional: true }),
      st({ id: 'wipe', dish: 'day', block: 'am', where: 'home', title: 'Wipe the counter', mins: 3 }),
      st({ id: 'stove-off', dish: 'soup', block: 'am', where: 'home', title: 'Turn the stove off', after: ['boil'], must: true }),
      st({ id: 'pack-bag', dish: 'day', block: 'am', where: 'home', kind: 'checklist', title: 'Pack the bag', mins: 5, items: 'bag' }),
      st({ id: 'go-am', dish: 'day', block: 'am', where: 'home', kind: 'move', move: 'leaveAm', title: 'Leave', mins: 0, after: ['stove-off'] }),
      st({ id: 'back', dish: 'day', block: 'load', kind: 'move', move: 'backHome', title: 'Back home', mins: 0 }),              // no `where` (9.1)
      st({ id: 'pack-cooler', dish: 'day', block: 'load', where: 'home', kind: 'checklist', title: 'Load the cooler', mins: 8, items: 'cooler', must: true, after: ['back'] }),
      st({ id: 'pack-tools', dish: 'day', block: 'load', where: 'home', kind: 'checklist', title: 'Load the tools', mins: 4, items: ['Soup pot', 'Ladle', 'Bread knife'], after: ['back'] }),
      st({ id: 'go-pm', dish: 'day', block: 'load', where: 'home', kind: 'move', move: 'leavePm', title: 'Leave for her place', mins: 0, after: ['pack-cooler'] }),
      st({ id: 'arrive', dish: 'day', block: 'hers', where: 'hers', kind: 'move', move: 'arrive', title: 'Arrive', mins: 0 }),
      st({ id: 'plate', dish: 'salad', block: 'final', where: 'hers', title: 'Plate the salad', mins: 5, notBefore: { anchor: 'dinner', mins: -30 } }),
      st({ id: 'dinner', dish: 'day', block: 'final', where: 'hers', title: 'Dinner', body: ['Sit down.'], mins: 0, after: ['plate'], notBefore: { anchor: 'dinner', mins: 0 } })
    ],
    pack: {
      cooler: [
        { id: 'ice', label: 'Ice packs', note: 'On top' },
        { id: 'soup', label: 'Soup tub', ifDone: 'boil' },
        { id: 'cukes', label: 'Brined cucumbers', ifDone: 'brine-drain' },
        { id: 'cukes-raw', label: 'Whole cucumbers', ifNotDone: 'brine' },
        { id: 'pot', label: 'Soup pot, still warm', when: { late: true } },
        { id: 'half', label: 'Half-cooked soup', ifDone: 'boil', ifNotDone: 'taste', when: { late: true } }     // all three must hold (9.1)
      ],
      bag: [{ id: 'bread', label: 'Bread' }, { id: 'salt', label: 'Salt', note: 'The flaky one' }],
      gear: [{ id: 'ladle', label: 'Ladle' }]                // no checklist step uses this list
    },
    containers: { home: [{ name: 'Soup tub', size: '2 quarts', holds: 'Soup' }], hers: [{ name: 'Salad bowl', size: 'large', holds: 'Salad' }] }
  };
}

const PLAN = deepFreeze(makePlan());
const IDS = PLAN.steps.map((s) => s.id);
const STEP_CACHE = new WeakMap();
// Step by id. Frozen plans cannot change any more, so their lookup table is kept.
function stepOf(plan, id) {
  if (!Object.isFrozen(plan)) return plan.steps.find((s) => s.id === id);
  let m = STEP_CACHE.get(plan);
  if (!m) { m = new Map(); for (const s of plan.steps) if (!m.has(s.id)) m.set(s.id, s); STEP_CACHE.set(plan, m); }
  return m.get(id);
}
const S0 = (now = H(7, 30)) => E.initialState(PLAN, 'adv-phone', now);

// Where `now` sits in each reducer's argument list (after plan and state).
const CALL = {
  complete: (a, now) => [a[0], now, a[1]],
  uncomplete: (a, now) => [a[0], now],
  skip: (a, now) => [a[0], now],
  retry: (a, now) => [a[0], now],
  giveUp: (a, now) => [a[0], now],
  ackLap: (a, now) => [a[0], a[1], now],
  tick: (a, now) => [a[0], a[1], a[2], now],
  tickTonight: (a, now) => [a[0], a[1], now],
  setOpt: (a, now) => [a[0], a[1], now],
  setAnchor: (a, now) => [a[0], a[1], now],
  setDay: (a, now) => [a[0], now],
  startFg: (a, now) => [a[0], a[1], now],
  clearFg: (a, now) => [now]
};
const show = (name, args) => name + '(' + args.map((a) => (typeof a === 'number' && !Number.isFinite(a) ? String(a) : JSON.stringify(a))).join(', ') + ')';

// One reducer call with every purity / rev / JSON check attached.
function act(state, name, args, now, plan = PLAN) {
  const label = show(name, args);
  deepFreeze(state);
  const before = JSON.stringify(state);
  let out;
  try { out = E[name](plan, state, ...CALL[name](args, now)); }
  catch (e) { assert.fail(label + ' threw on a frozen state: ' + (e && e.stack ? e.stack : e)); }
  assert.equal(JSON.stringify(state), before, label + ' changed its input state');
  assert.ok(out && typeof out === 'object', label + ' must return a state');
  if (out !== state) {
    assert.equal(out.rev, (typeof state.rev === 'number' ? state.rev : 0) + 1, label + ': rev must go up by exactly one');
    assert.equal(out.updatedAt, now, label + ': updatedAt must be now');
    assert.equal(out.device, state.device, label + ': device must be kept');
  }
  assert.deepEqual(RT(out), out, label + ': the result is not JSON-clean (undefined, NaN or a non-plain object inside)');
  const copy = deepFreeze(RT(state));
  const viaJson = E[name](plan, copy, ...CALL[name](args, now));
  assert.deepEqual(RT(viaJson), RT(out), label + ': a JSON round trip of the input changes the result');
  assert.equal(viaJson === copy, out === state, label + ': "nothing changed" must not depend on a JSON round trip');
  return out;
}

// Everything the UI can ask about a state at one moment.
function views(plan, state, now) {
  const ids = plan.steps.map((s) => s.id);
  return {
    location: E.location(plan, state),
    next: E.nextStep(plan, state, now),
    unlock: E.nextUnlock(plan, state, now),
    waits: E.waitsView(plan, state, now),
    alerts: E.alerts(plan, state, now),
    project: E.project(plan, state, now),
    packs: Object.keys(plan.pack).map((k) => E.packList(plan, state, k)),
    lists: ids.map((id) => E.checklistItems(plan, state, id)),
    progress: E.progress(plan, state),
    dishes: plan.dishes.map((d) => E.dishProgress(plan, state, d.id)).concat([E.dishProgress(plan, state, 'day')]),
    steps: ids.map((id) => [id, E.isActive(plan, state, id), E.isDone(plan, state, id), E.isAvailable(plan, state, id, now),
      E.blockers(plan, state, id, now), E.canGiveUp(plan, state, id, now)]),
    opts: Object.keys(plan.optionDefaults).map((k) => E.opt(plan, state, k)),
    dayMs: E.dayMs(state),
    anchors: Object.keys(plan.anchors).map((k) => E.anchorMs(state, k))
  };
}

// A clean default day, in time order. [reducer, args, now]
const SCRIPT = [
  ['complete', ['q-soak', { value: true }], H(8, 0)],
  ['complete', ['rinse'], H(8, 2)],                      // rest: 8:02 -> 8:07
  ['complete', ['boil'], H(8, 11)],                      // simmer: 8:11 -> 8:51, laps 8:21 8:31 8:41
  ['startFg', ['toast', H(8, 12, 45)], H(8, 12)],
  ['complete', ['toast'], H(8, 13)],                     // toast (urgent): 8:13 -> 8:19
  ['complete', ['toast-out'], H(8, 20)],
  ['ackLap', ['simmer', 1], H(8, 21, 30)],
  ['complete', ['brine'], H(8, 23)],                     // brine: 8:23 -> 8:38, max at 8:48
  ['complete', ['chill'], H(8, 25)],                     // chill: 8:25 -> 8:45, gates nothing
  ['tick', ['pack-bag', 'bread', true], H(8, 26)],
  ['complete', ['brine-drain'], H(8, 40)],
  ['complete', ['taste'], H(8, 52)],
  ['complete', ['stove-off'], H(8, 53)],
  ['complete', ['wipe'], H(8, 56)],
  ['complete', ['pack-bag'], H(9, 1)],
  ['complete', ['go-am'], H(11, 30)],
  ['complete', ['back'], H(13, 30)],
  ['tick', ['pack-cooler', 'ice', true], H(13, 32)],
  ['complete', ['pack-cooler'], H(13, 38)],
  ['complete', ['pack-tools'], H(13, 42)],
  ['complete', ['go-pm'], H(14, 10)],
  ['complete', ['arrive'], H(14, 40)],
  ['complete', ['h-unpack'], H(14, 45)],
  ['complete', ['plate'], H(18, 35)],
  ['complete', ['dinner'], H(19, 0)]
];
// Plain replay without checks (the checks have their own test). Returns [{label, now, state}], frozen.
function trace(script = SCRIPT, start = S0()) {
  const out = [{ label: 'start', now: H(7, 30), state: deepFreeze(start) }];
  let s = start;
  for (const [name, args, now] of script) {
    s = deepFreeze(E[name](PLAN, s, ...CALL[name](args, now)));
    out.push({ label: name + ':' + args[0], now, state: s });
  }
  return out;
}
// Built once. If the engine cannot even replay the day, the file still loads and the first tests say why.
let TRACE = [{ label: 'start', now: H(7, 30), state: null }];
let TRACE_ERROR = null;
try { TRACE = trace(); } catch (e) { TRACE_ERROR = e; }
const at = (label) => {
  if (TRACE_ERROR) throw TRACE_ERROR;
  const e = TRACE.find((x) => x.label === label);
  assert.ok(e, 'no trace entry ' + label);
  return e.state;
};
const run = (state, list) => { for (const [id, now, payload] of list) state = E.complete(PLAN, state, id, now, payload); return state; };
const kinds = (list) => list.map((a) => a.kind);

// ---------------------------------------------------------------- 0. fixture sanity

test('fixture: validate() accepts it', () => {
  assert.deepEqual(E.validate(PLAN), []);
});

test('fixture: the scripted day can be replayed on frozen states', () => {
  if (TRACE_ERROR) throw TRACE_ERROR;
  assert.equal(TRACE.length, SCRIPT.length + 1);
});

test('fixture: the scripted day runs clean through act() and ends with dinner at her place', () => {
  let s = S0();
  for (const [name, args, now] of SCRIPT) {
    const next = act(s, name, args, now);
    assert.notEqual(next, s, show(name, args) + ' is a real change and must return a new state');
    s = next;
  }
  assert.equal(E.isDone(PLAN, s, 'dinner'), true);
  assert.equal(E.location(PLAN, s), 'hers');
  assert.equal(s.rev, SCRIPT.length, 'one rev per change');
  assert.equal(s.updatedAt, H(19, 0));
  assert.deepEqual(RT(TRACE[TRACE.length - 1].state), RT(s));
});

// ---------------------------------------------------------------- 1. initialState / setDay / time

test('initialState: exactly the SPEC 3.1 shape, JSON-clean, nothing shared with the plan', () => {
  const s = E.initialState(PLAN, 'adv-phone', H(7, 30));
  assert.deepEqual(s, {
    v: 1, day: DAY, anchors: { start: 480, leaveAm: 690, backHome: 810, leavePm: 850, arrive: 880, dinner: 1140 },
    opts: {}, done: {}, skipped: {}, waits: {}, laps: {}, ticks: {}, tonight: {}, fg: null, rev: 0, updatedAt: 0, device: 'adv-phone'
  });
  assert.deepEqual(RT(s), s);
  const p = makePlan();
  const t = E.initialState(p, 'x', H(7, 30));
  t.anchors.start = 1; t.opts.soaked = false; t.done.x = 1;
  assert.equal(p.anchors.start, 480, 'editing the state must not edit the plan');
  assert.deepEqual(E.initialState(p, 'x', H(7, 30)).opts, {});
  assert.deepEqual(E.initialState(p, 'x', H(7, 30)).done, {});
});

function withTZ(tz, fn) {
  const old = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
}
const ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Australia/Lord_Howe', 'America/Havana'];
for (const tz of ZONES) {
  test('initialState day rule (15:59 / 16:00 / midnight) and wall-clock anchors in ' + tz, () => withTZ(tz, () => {
    const L = (y, mo, d, h, mi = 0, s = 0, ms = 0) => new Date(y, mo, d, h, mi, s, ms).getTime();
    const day = (now) => E.initialState(PLAN, 'x', now).day;
    assert.equal(day(L(2026, 10, 22, 15, 59, 59, 999)), '2026-11-22', '15:59:59.999 is still "today"');
    assert.equal(day(L(2026, 10, 22, 16, 0)), '2026-11-23', '16:00 sharp is the evening before');
    assert.equal(day(L(2026, 10, 22, 23, 59, 59, 999)), '2026-11-23');
    assert.equal(day(L(2026, 10, 23, 0, 0)), '2026-11-23', 'midnight: same cook day as a second earlier');
    assert.equal(day(L(2026, 10, 23, 0, 0, 0, 1)), '2026-11-23');
    assert.equal(day(L(2026, 10, 23, 6, 55)), '2026-11-23');
    assert.equal(day(L(2026, 10, 23, 15, 59)), '2026-11-23');
    assert.equal(day(L(2026, 10, 23, 16, 0)), '2026-11-24');
    assert.equal(day(L(2026, 10, 30, 18, 0)), '2026-12-01', 'month end');
    assert.equal(day(L(2026, 11, 31, 16, 0)), '2027-01-01', 'year end');
    assert.equal(day(L(2028, 1, 28, 22, 0)), '2028-02-29', 'leap day');
    assert.equal(day(L(2027, 1, 28, 22, 0)), '2027-03-01');
    const s = E.initialState(PLAN, 'x', L(2026, 10, 22, 22, 30));
    assert.equal(E.dayMs(s), L(2026, 10, 23, 0, 0));
    assert.equal(E.anchorMs(s, 'start'), L(2026, 10, 23, 8, 0));
    assert.equal(E.anchorMs(s, 'dinner'), L(2026, 10, 23, 19, 0));
    assert.equal(E.fmtClock(E.anchorMs(s, 'leaveAm')), '11:30 AM');
    assert.equal(E.fmtClock(E.dayMs(s)), '12:00 AM');
    const moved = E.setDay(PLAN, s, '2026-11-24', 5);
    assert.equal(E.dayMs(moved), L(2026, 10, 24, 0, 0));
    assert.equal(E.anchorMs(moved, 'dinner'), L(2026, 10, 24, 19, 0));
  }));
}

test('clock-change days: the evening before still picks the next date, anchors stay wall-clock', () => {
  withTZ('America/Los_Angeles', () => {
    // spring forward: Sun Mar 14 2027 has no 2:00 to 3:00
    let s = E.initialState(PLAN, 'x', new Date(2027, 2, 13, 23, 30).getTime());
    assert.equal(s.day, '2027-03-14');
    assert.equal(E.fmtClock(E.anchorMs(s, 'start')), '8:00 AM');
    assert.equal(E.fmtClock(E.anchorMs(s, 'dinner')), '7:00 PM');
    // fall back: Sun Nov 1 2026 has 1:00 to 2:00 twice
    s = E.initialState(PLAN, 'x', new Date(2026, 9, 31, 16, 0).getTime());
    assert.equal(s.day, '2026-11-01');
    assert.equal(E.fmtClock(E.anchorMs(s, 'start')), '8:00 AM');
    assert.equal(E.initialState(PLAN, 'x', new Date(2026, 10, 1, 15, 59).getTime()).day, '2026-11-01');
    assert.equal(E.initialState(PLAN, 'x', new Date(2026, 10, 1, 16, 0).getTime()).day, '2026-11-02');
  });
  withTZ('America/Havana', () => {
    // Cuba springs forward AT midnight: Sun Mar 14 2027 starts at 1:00
    const s = E.initialState(PLAN, 'x', new Date(2027, 2, 13, 20, 0).getTime());
    assert.equal(s.day, '2027-03-14');
    assert.equal(E.fmtClock(E.anchorMs(s, 'start')), '8:00 AM');
    assert.ok(Number.isFinite(E.dayMs(s)));
  });
});

test('setDay: changes only the day, refuses anything that is not a real YYYY-MM-DD date', () => {
  const s = at('complete:boil');
  const t = act(s, 'setDay', ['2028-02-29'], H(8, 30));
  assert.equal(t.day, '2028-02-29');
  assert.deepEqual({ ...t, day: s.day, rev: s.rev, updatedAt: s.updatedAt }, s, 'nothing else changes');
  assert.equal(E.dayMs(t), new Date(2028, 1, 29).getTime());
  assert.equal(E.anchorMs(t, 'leavePm'), new Date(2028, 1, 29, 14, 10).getTime());
  for (const bad of ['2027-02-29', '2027-02-30', '2027-13-01', '2027-00-10', '2027-01-00', '2027-1-17', '27-01-17', '2027/01/17', ' 2027-01-17',
    '2027-01-17T00:00:00Z', 'tomorrow', '', undefined, null, 20270117, {}, [], new Date(2027, 0, 17)]) {
    assert.equal(act(s, 'setDay', [bad], H(8, 30)), s, 'setDay must refuse ' + String(bad));
  }
  assert.equal(act(s, 'setDay', [s.day], H(8, 30)), s, 'the same day is no change');
});

// ---------------------------------------------------------------- 2. purity, rev, updatedAt

// A state with something in every map.
function rich() {
  let s = at('tick:pack-bag');
  s = E.startFg(PLAN, s, 'wipe', H(8, 30), H(8, 26, 10));
  s = E.tickTonight(PLAN, s, 'shop', true, H(8, 26, 20));
  s = E.skip(PLAN, s, 'h-unpack', H(8, 26, 30));
  return deepFreeze(s);
}
const T = H(8, 27);
const CHANGES = [
  ['complete', ['wipe']], ['complete', ['brine-drain']], ['complete', ['go-am']], ['complete', ['go-pm']], ['complete', ['h-unpack']],
  ['uncomplete', ['boil']], ['uncomplete', ['q-soak']], ['uncomplete', ['toast']],
  ['skip', ['garnish']], ['skip', ['wipe']],
  ['retry', ['taste']], ['giveUp', ['taste']],
  ['ackLap', ['simmer', 2]], ['ackLap', ['simmer', undefined]], ['ackLap', ['brine', undefined]],
  ['tick', ['pack-bag', 'salt', true]], ['tick', ['pack-bag', 'bread', false]], ['tick', ['pack-tools', 'i2', true]],
  ['tickTonight', ['soak', true]], ['tickTonight', ['shop', false]],
  ['setOpt', ['late', true]], ['setOpt', ['soaked', false]], ['setOpt', ['soaked', undefined]],
  ['setAnchor', ['dinner', 1155]], ['setAnchor', ['start', -10]], ['setAnchor', ['dinner', 99999]],
  ['setDay', ['2027-01-17']],
  ['startFg', ['toast', T + 45000]], ['clearFg', []]
];
for (const [name, args] of CHANGES) {
  test('pure reducer, new object, rev + 1, updatedAt = now: ' + show(name, args), () => {
    const s = rich();
    const out = act(s, name, args, T);
    assert.notEqual(out, s, 'a real change must return a new state object');
    assert.notDeepEqual({ ...out, rev: 0, updatedAt: 0 }, { ...s, rev: 0, updatedAt: 0 }, 'something other than rev must differ');
    assert.equal(out.v, 1);
    // an untouched map keeps its content
    if (name !== 'setAnchor') assert.deepEqual(out.anchors, s.anchors);
    if (name !== 'setDay') assert.equal(out.day, s.day);
  });
}

const NOOPS = [
  // unknown / garbage step ids
  ['complete', ['nope']], ['complete', [undefined]], ['complete', [null]], ['complete', [42]], ['complete', ['constructor']],
  ['complete', ['__proto__']], ['complete', ['toString']], ['complete', [{}]], ['complete', ['']],
  ['complete', ['boil']],                                  // already done
  ['complete', ['toast', { value: 1 }]],                   // already done, junk payload
  ['uncomplete', ['nope']], ['uncomplete', [undefined]], ['uncomplete', ['constructor']],
  ['uncomplete', ['wipe']], ['uncomplete', ['brine-drain']], ['uncomplete', ['go-am']], ['uncomplete', ['go-pm']],   // not done
  ['skip', ['nope']], ['skip', [undefined]], ['skip', ['h-unpack']],                                                  // already skipped
  ['retry', ['nope']], ['retry', [undefined]], ['retry', ['wipe']], ['retry', ['toast']], ['retry', ['q-soak']], ['retry', ['go-am']],   // not check steps
  ['giveUp', ['nope']], ['giveUp', [undefined]], ['giveUp', ['wipe']], ['giveUp', ['soup-taste2']],                   // nothing to give up
  ['ackLap', ['nope', 1]], ['ackLap', [undefined, 1]], ['ackLap', ['constructor', 1]], ['ackLap', ['soup2', 1]],       // unknown / not running
  ['ackLap', ['simmer', 1]], ['ackLap', ['simmer', 0]], ['ackLap', ['simmer', -3]],                                    // already acknowledged
  ['tick', ['nope', 'bread', true]], ['tick', [undefined, 'bread', true]], ['tick', ['pack-bag', 'bread', true]],
  ['tick', ['pack-bag', 'salt', false]], ['tick', ['pack-bag', undefined, true]], ['tick', ['pack-bag', null, true]],
  ['tickTonight', ['nope', true]], ['tickTonight', [undefined, true]], ['tickTonight', ['shop', true]], ['tickTonight', ['soak', false]],
  ['setOpt', ['late', undefined]], ['setOpt', ['soaked', true]], ['setOpt', [undefined, true]], ['setOpt', ['', true]], ['setOpt', [null, true]],
  ['setAnchor', ['nope', 600]], ['setAnchor', [undefined, 600]], ['setAnchor', ['constructor', 600]],
  ['setAnchor', ['dinner', NaN]], ['setAnchor', ['dinner', Infinity]], ['setAnchor', ['dinner', -Infinity]],
  ['setAnchor', ['dinner', '1150']], ['setAnchor', ['dinner', undefined]], ['setAnchor', ['dinner', null]],
  ['setAnchor', ['dinner', 1140]], ['setAnchor', ['dinner', 1140.3]],
  ['setAnchor', ['leaveAm', -5]], ['setAnchor', ['leaveAm', NaN]], ['setAnchor', ['dinner', -1]],
  ['setDay', ['2027-01-16']], ['setDay', ['2027-02-30']], ['setDay', [undefined]],
  ['startFg', ['nope', T + 1000]], ['startFg', [undefined, T + 1000]], ['startFg', ['toast', NaN]], ['startFg', ['toast', undefined]], ['startFg', ['toast', '12']]
];
for (const [name, args] of NOOPS) {
  test('nothing to do, the very same state comes back: ' + show(name, args), () => {
    const s = rich();
    assert.equal(act(s, name, args, T), s);
  });
}

test('clearFg with no foreground timer is no change', () => {
  const s = at('complete:toast');
  assert.equal(s.fg, null);
  assert.equal(act(s, 'clearFg', [], T), s);
});

test('reducers never hand out objects that belong to the plan', () => {
  const p = makePlan();                                    // not frozen: a leak would be writable
  const snapshot = JSON.stringify(p);
  let s = E.initialState(p, 'x', H(7, 30));
  s = E.tickTonight(p, s, 'soak', true, H(7, 31));
  s.opts.leak1 = 1;
  s = run2(p, s, [['q-soak', H(8), { value: true }], ['rinse', H(8, 2)], ['boil', H(8, 11)]]);
  s.waits.simmer.leak2 = 1; s.waits.rest.leak3 = 1;
  s = E.giveUp(p, s, 'taste', H(10, 50));
  s.opts.leak4 = 1;
  s = E.complete(p, s, 'go-am', H(11, 30));
  s.opts.leak5 = 1; s.skipped.leak6 = true; s.anchors.leak7 = 1;
  s = E.retry(p, s, 'taste', H(11, 31));
  s.waits.simmer.leak8 = 1;
  assert.equal(JSON.stringify(p), snapshot, 'writing into a state must never reach the plan');
});
function run2(plan, state, list) { for (const [id, now, payload] of list) state = E.complete(plan, state, id, now, payload); return state; }

// ---------------------------------------------------------------- 3. JSON round trip

test('JSON: every state of the scripted day equals its JSON copy', () => {
  for (const { label, state } of TRACE) assert.deepEqual(RT(state), state, 'after ' + label);
});

test('JSON: every view answers the same for a state and for its JSON copy', () => {
  for (const { label, state, now } of TRACE) {
    const copy = deepFreeze(RT(state));
    for (const t of [now, now + 1, now + 9 * MIN, H(11, 21), H(14, 1), H(18, 45), H(23, 59)]) {
      assert.deepEqual(views(PLAN, copy, t), views(PLAN, state, t), 'after ' + label + ' at ' + E.fmtClock(t));
    }
  }
});

test('JSON: the order of the keys inside the stored maps does not matter (a document store may reorder them)', () => {
  const flip = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    const out = {};
    for (const k of Object.keys(o).reverse()) out[k] = flip(o[k]);
    return out;
  };
  for (const { label, state, now } of TRACE) {
    const other = deepFreeze(flip(state));
    assert.deepEqual(other, state);
    for (const t of [now, now + 9 * MIN, H(11, 21), H(14, 1)]) {
      assert.deepEqual(views(PLAN, other, t), views(PLAN, state, t), 'after ' + label + ' at ' + E.fmtClock(t));
    }
  }
});

// ---------------------------------------------------------------- 4. older saved states: optional maps missing

const MAPS = ['opts', 'done', 'skipped', 'waits', 'laps', 'ticks', 'tonight'];
const norm = (s) => { const o = { ...s }; for (const k of MAPS) if (o[k] === undefined) o[k] = {}; if (o.fg === undefined) o.fg = null; return o; };
for (const key of MAPS.concat(['fg'])) {
  test('older saved state: no "' + key + '" key behaves exactly like an empty one', () => {
    const samples = [TRACE[0], TRACE.find((x) => x.label === 'tick:pack-bag'), TRACE.find((x) => x.label === 'complete:back'),
      TRACE.find((x) => x.label === 'complete:arrive'), { label: 'rich', now: T, state: rich() }];
    for (const { label, state, now } of samples) {
      const empty = deepFreeze({ ...state, [key]: key === 'fg' ? null : {} });
      const missing = { ...state }; delete missing[key]; deepFreeze(missing);
      for (const t of [now, now + 7 * MIN, H(11, 25), H(14, 5), H(18, 45)]) {
        let got;
        assert.doesNotThrow(() => { got = views(PLAN, missing, t); }, 'views threw without "' + key + '" (' + label + ')');
        assert.deepEqual(got, views(PLAN, empty, t), 'views differ without "' + key + '" (' + label + ' at ' + E.fmtClock(t) + ')');
      }
      for (const [name, args] of CHANGES.concat(NOOPS)) {
        const a = E[name](PLAN, empty, ...CALL[name](args, now + MIN));
        let b;
        assert.doesNotThrow(() => { b = E[name](PLAN, missing, ...CALL[name](args, now + MIN)); }, show(name, args) + ' threw without "' + key + '"');
        assert.deepEqual(norm(b), norm(a), show(name, args) + ' differs without "' + key + '" (' + label + ')');
        assert.equal(b === missing, a === empty, show(name, args) + ': change / no change differs without "' + key + '" (' + label + ')');
      }
    }
  });
}

test('older saved state: only v, day and anchors: a whole day can still be played', () => {
  let s = { v: 1, day: DAY, anchors: { ...PLAN.anchors } };
  for (const [name, args, now] of SCRIPT) s = act(s, name, args, now);
  assert.equal(s.rev, SCRIPT.length, 'a missing rev counts from 0');
  assert.deepEqual(norm({ ...s, device: 'adv-phone' }), TRACE[TRACE.length - 1].state);
});

test('garbage where a map should be (null, array, string, number) is treated as empty', () => {
  const base = rich();
  for (const junk of [null, [], 'x', 7, true]) {
    for (const key of MAPS) {
      const bad = deepFreeze({ ...base, [key]: junk });
      const empty = deepFreeze({ ...base, [key]: {} });
      let got;
      assert.doesNotThrow(() => { got = views(PLAN, bad, T); }, 'views threw with ' + key + ' = ' + JSON.stringify(junk));
      assert.deepEqual(got, views(PLAN, empty, T), key + ' = ' + JSON.stringify(junk));
      for (const [name, args] of CHANGES) {
        assert.doesNotThrow(() => E[name](PLAN, bad, ...CALL[name](args, T)), show(name, args) + ' threw with ' + key + ' = ' + JSON.stringify(junk));
      }
    }
  }
});

test('no state at all: every reducer and view returns without throwing', () => {
  for (const state of [undefined, null, 0, 'state', true, []]) {
    for (const [name, args] of CHANGES.concat(NOOPS)) {
      let out;
      assert.doesNotThrow(() => { out = E[name](PLAN, state, ...CALL[name](args, T)); }, show(name, args) + ' with state ' + JSON.stringify(state));
      // a primitive comes back as it was; an array may be read as an empty state
      if (!Array.isArray(state)) assert.equal(out, state, show(name, args) + ' must hand a non-state back untouched');
    }
    assert.doesNotThrow(() => {
      E.location(PLAN, state); E.nextStep(PLAN, state, T); E.nextUnlock(PLAN, state, T); E.waitsView(PLAN, state, T); E.alerts(PLAN, state, T);
      E.project(PLAN, state, T); E.packList(PLAN, state, 'cooler'); E.checklistItems(PLAN, state, 'pack-tools'); E.progress(PLAN, state);
      E.dishProgress(PLAN, state, 'soup'); E.dayMs(state); E.anchorMs(state, 'start'); E.opt(PLAN, state, 'soaked');
      for (const id of IDS) { E.isActive(PLAN, state, id); E.isDone(PLAN, state, id); E.isAvailable(PLAN, state, id, T); E.blockers(PLAN, state, id, T); E.canGiveUp(PLAN, state, id, T); }
    });
  }
});

// ---------------------------------------------------------------- 5. complete()

test('complete: sets done = now and arms the wait {start: now, mins, by}, laps = 0', () => {
  let s = act(S0(), 'complete', ['q-soak', { value: true }], H(8));
  assert.deepEqual(s.done, { 'q-soak': H(8) });
  assert.deepEqual(s.waits, {});
  s = act(s, 'complete', ['rinse'], H(8, 2));
  assert.deepEqual(s.waits, { rest: { start: H(8, 2), mins: 5, by: 'rinse' } }, 'the wait comes from the step that was completed');
  assert.deepEqual(s.laps, { rest: 0 });
  s = act(s, 'complete', ['boil'], H(8, 11));
  assert.deepEqual(s.waits.simmer, { start: H(8, 11), mins: 40, by: 'boil' });
  assert.equal(s.laps.simmer, 0);
  assert.deepEqual(s.waits.rest, { start: H(8, 2), mins: 5, by: 'rinse' }, 'other waits are left alone');
  assert.deepEqual(s.done, { 'q-soak': H(8), rinse: H(8, 2), boil: H(8, 11) });
  // a step with no wait arms nothing
  const w = act(s, 'complete', ['wipe'], H(8, 12));
  assert.deepEqual(w.waits, s.waits);
  assert.deepEqual(w.laps, s.laps);
});

test('complete: the same wait id started by the other variant replaces the record and resets its laps', () => {
  let s = run(S0(), [['q-soak', H(8), { value: true }], ['rinse', H(8, 2)]]);
  s = E.ackLap(PLAN, s, 'rest', 3, H(8, 3));
  assert.equal(s.laps.rest, 3);
  s = E.setOpt(PLAN, s, 'soaked', false, H(8, 4));
  s = act(s, 'complete', ['quick'], H(8, 5));
  assert.deepEqual(s.waits.rest, { start: H(8, 5), mins: 30, by: 'quick' }, 'latest arming wins');
  assert.equal(s.laps.rest, 0);
  const v = E.waitsView(PLAN, s, H(8, 6))[0];
  assert.equal(v.label, 'Peas resting', 'the label belongs to the step that started it');
  assert.equal(v.endsAt, H(8, 35));
});

test('complete: doing a step again later (after "Not done") restarts its wait and resets the laps', () => {
  let s = at('complete:boil');
  s = E.ackLap(PLAN, s, 'simmer', 2, H(8, 31));
  s = act(s, 'uncomplete', ['boil'], H(8, 32));
  s = act(s, 'complete', ['boil'], H(8, 33));
  assert.deepEqual(s.waits.simmer, { start: H(8, 33), mins: 40, by: 'boil' });
  assert.equal(s.laps.simmer, 0);
  assert.deepEqual(E.waitsView(PLAN, s, H(8, 44)).find((w) => w.id === 'simmer').laps.map((l) => [l.n, l.due, l.acked]),
    [[1, true, false], [2, false, false], [3, false, false]]);
});

test('complete: an already-done step keeps its first time and does not restart its wait', () => {
  const s = at('complete:boil');
  const again = act(s, 'complete', ['boil'], H(8, 30));
  assert.equal(again.done.boil, H(8, 11));
  assert.deepEqual(again.waits.simmer, { start: H(8, 11), mins: 40, by: 'boil' });
});

test('complete: choice payload', () => {
  const no = act(S0(), 'complete', ['q-soak', { value: false }], H(8));
  assert.equal(no.opts.soaked, false);
  assert.equal(E.opt(PLAN, no, 'soaked'), false);
  assert.equal(E.isActive(PLAN, no, 'quick'), true);
  assert.equal(E.isActive(PLAN, no, 'rinse'), false);
  const yes = act(S0(), 'complete', ['q-soak', { value: true }], H(8));
  assert.deepEqual(yes.opts, { soaked: true });
  assert.equal(E.isActive(PLAN, yes, 'quick'), false);
  // junk payloads: the step is done, the default answer stays, nothing invented
  for (const payload of [undefined, null, {}, { value: undefined }, 'yes', 7, [], { val: true }]) {
    let s;
    assert.doesNotThrow(() => { s = act(S0(), 'complete', ['q-soak', payload], H(8)); }, 'payload ' + JSON.stringify(payload));
    assert.equal(s.done['q-soak'], H(8));
    assert.deepEqual(s.opts, {}, 'payload ' + JSON.stringify(payload) + ' must not write an option');
    assert.equal(E.opt(PLAN, s, 'soaked'), true);
    assert.equal(E.isDone(PLAN, s, 'q-soak'), true);
  }
  // a payload on a step that is not a choice is ignored
  const w = act(S0(), 'complete', ['wipe', { value: false }], H(8));
  assert.deepEqual(w.opts, {});
});

test('complete: a choice counts as done once its option is answered anywhere (SPEC 3.3)', () => {
  let s = act(S0(), 'setOpt', ['soaked', false], H(7, 40));
  assert.equal(E.isDone(PLAN, s, 'q-soak'), true);
  assert.equal(E.isAvailable(PLAN, s, 'quick', H(8)), true, 'a dep that is an answered choice is satisfied');
  s = act(S0(), 'tickTonight', ['soak', true], H(7, 40));
  assert.equal(s.opts.soaked, true);
  assert.equal(E.isDone(PLAN, s, 'q-soak'), true);
  assert.equal(E.isDone(PLAN, S0(), 'q-soak'), false);
});

test('complete: clears the foreground timer only when it belongs to that step', () => {
  let s = act(S0(), 'startFg', ['toast', H(8, 12, 45)], H(8, 12));
  assert.deepEqual(s.fg, { stepId: 'toast', endsAt: H(8, 12, 45) });
  const other = act(s, 'complete', ['wipe'], H(8, 12, 10));
  assert.deepEqual(other.fg, { stepId: 'toast', endsAt: H(8, 12, 45) });
  const mine = act(other, 'complete', ['toast'], H(8, 13));
  assert.equal(mine.fg, null);
  // skipping the step clears it too, clearFg clears anything
  assert.equal(act(s, 'skip', ['toast'], H(8, 12, 20)).fg, null);
  assert.deepEqual(act(s, 'skip', ['garnish'], H(8, 12, 20)).fg, s.fg);
  assert.equal(act(s, 'clearFg', [], H(8, 12, 20)).fg, null);
  // a second startFg replaces the first
  assert.deepEqual(act(s, 'startFg', ['brine', H(8, 20)], H(8, 12, 30)).fg, { stepId: 'brine', endsAt: H(8, 20) });
});

test('rules: ifNotDone, ifDone, both, and unconditional, read from the NEW state', () => {
  // leave with the soup not tasted: late + packed
  let s = act(at('complete:brine-drain'), 'complete', ['go-am'], H(11, 30));
  assert.deepEqual(s.opts, { soaked: true, late: true, packed: true });
  // leave with it tasted: packed only
  s = act(at('complete:pack-bag'), 'complete', ['go-am'], H(11, 30));
  assert.deepEqual(s.opts, { soaked: true, packed: true });
  assert.equal(E.opt(PLAN, s, 'late'), false);
  // arrive with the cucumbers drained (ifDone holds)
  assert.equal(at('complete:arrive').opts.saladReady, true);
  // arrive without (ifDone fails): not set
  const noBrine = run(S0(), [['go-am', H(11, 30)], ['back', H(13, 30)], ['go-pm', H(14, 10)], ['arrive', H(14, 40)]]);
  assert.equal('saladReady' in noBrine.opts, false);
  assert.equal(E.opt(PLAN, noBrine, 'saladReady'), false);
  // ifDone AND ifNotDone on one rule: all four combinations
  const base = run(S0(), [['go-am', H(11, 30)], ['back', H(13, 30)]]);
  const leave = (pre) => E.complete(PLAN, run(base, pre), 'go-pm', H(14, 10));
  assert.equal(E.opt(PLAN, leave([]), 'stoveOn'), false, 'boil not done');
  assert.equal(E.opt(PLAN, leave([['boil', H(13, 31)]]), 'stoveOn'), true, 'boil done, stove not off');
  assert.equal(E.opt(PLAN, leave([['boil', H(13, 31)], ['stove-off', H(13, 32)]]), 'stoveOn'), false, 'both done');
  assert.equal(E.opt(PLAN, leave([['stove-off', H(13, 32)]]), 'stoveOn'), false, 'only stove-off done');
});

test('rules: run only for their own step, only on complete, and see the step itself as done', () => {
  const p = makePlan();
  p.rules.push({ on: 'wipe', ifDone: 'wipe', set: { saladReady: true } }, { on: 'wipe', ifNotDone: 'wipe', set: { stoveOn: true } });
  deepFreeze(p);
  let s = E.initialState(p, 'x', H(7, 30));
  s = act(s, 'complete', ['garnish'], H(8), p);
  s = act(s, 'skip', ['wipe'], H(8, 1), p);
  assert.deepEqual(s.opts, {}, 'skip and other steps do not run the rules');
  s = act(s, 'complete', ['wipe'], H(8, 2), p);
  assert.deepEqual(s.opts, { saladReady: true }, 'ifDone on the step itself holds, ifNotDone on itself does not');
  s = act(s, 'uncomplete', ['wipe'], H(8, 3), p);
  s = act(s, 'retry', ['taste'], H(8, 4), p);
  s = act(s, 'tick', ['pack-bag', 'bread', true], H(8, 5), p);
  assert.equal('stoveOn' in s.opts, false);
});

test('rules: a rule set wins over the choice payload of the same step, later rules win over earlier ones', () => {
  const p = makePlan();
  p.rules.push({ on: 'q-soak', set: { soaked: false, late: true } }, { on: 'q-soak', set: { late: false } });
  deepFreeze(p);
  const s = act(E.initialState(p, 'x', H(7, 30)), 'complete', ['q-soak', { value: true }], H(8), p);
  assert.deepEqual(s.opts, { soaked: false, late: false });
});

test('complete(leavePm): every not-done home step is skipped; either / hers steps and done steps are not', () => {
  // home-pm with a mixed morning behind him
  let s = run(S0(), [['q-soak', H(8), { value: true }], ['rinse', H(8, 2)], ['boil', H(8, 11)], ['brine', H(8, 23)], ['stove-off', H(9)],
    ['go-am', H(11, 30)], ['back', H(13, 30)], ['pack-cooler', H(13, 38)]]);
  s = E.skip(PLAN, s, 'plate', H(13, 39));                 // a manual skip of a hers step must survive
  const before = s;
  s = act(s, 'complete', ['go-pm'], H(14, 10));
  const homeLeft = ['quick', 'taste', 'garnish', 'wipe', 'pack-bag', 'pack-tools'];   // where:'home' and not done (quick: other variant)
  assert.deepEqual(Object.keys(s.skipped).sort(), homeLeft.concat(['plate']).sort());
  for (const id of Object.keys(s.skipped)) assert.equal(s.skipped[id], true);
  for (const st of PLAN.steps) {
    if (st.where !== 'home') assert.equal(st.id in s.skipped, st.id === 'plate', st.id + ' (' + st.where + ') must not be auto-skipped');
    else if (E.isDone(PLAN, before, st.id) || st.id === 'go-pm') assert.equal(st.id in s.skipped, false, st.id + ' is done and must not be skipped');
  }
  assert.equal(E.location(PLAN, s), 'drive');
  // 'either' work he did not get to is waiting in her kitchen; the skipped home deps do not block anything
  s = act(s, 'complete', ['arrive'], H(14, 40));
  for (const id of ['toast', 'chill', 'brine-drain', 'h-unpack']) assert.equal(E.isAvailable(PLAN, s, id, H(14, 40)), true, id);
  assert.equal(E.isActive(PLAN, s, 'toast-out'), true);
  for (const id of homeLeft) assert.equal(E.isActive(PLAN, s, id), false, id + ' is written off');
  // completing it again changes nothing
  assert.equal(act(s, 'complete', ['go-pm'], H(15)), s);
});

test('complete(leavePm): a home choice that was answered elsewhere is not skipped; other moves never skip anything', () => {
  let s = E.tickTonight(PLAN, S0(), 'soak', true, H(7, 31));           // answers q-soak without completing it
  for (const [id, now] of [['go-am', H(11, 30)], ['back', H(13, 30)]]) {
    s = act(s, 'complete', [id], now);
    assert.deepEqual(s.skipped, {}, id + ' must not skip anything');
  }
  s = act(s, 'complete', ['go-pm'], H(14, 10));
  assert.equal('q-soak' in s.skipped, false);
  assert.equal(s.skipped.rinse, true);
  const n = Object.keys(s.skipped).length;
  s = act(s, 'complete', ['arrive'], H(14, 40));
  assert.equal(Object.keys(s.skipped).length, n, 'arrive must not skip anything');
});

test('complete: a skipped step that he does after all is done and active again', () => {
  let s = act(S0(), 'skip', ['garnish'], H(8));
  assert.deepEqual(s.skipped, { garnish: true });
  assert.equal(E.isActive(PLAN, s, 'garnish'), false);
  s = act(s, 'complete', ['garnish'], H(8, 5));
  assert.equal(E.isDone(PLAN, s, 'garnish'), true);
  assert.equal(E.isActive(PLAN, s, 'garnish'), true);
});

// A second opinion on complete(), written from SPEC 3.5 only.
const refDone = (plan, s, id) => {
  const st = stepOf(plan, id);
  return !!st && (s.done[id] !== undefined || (st.kind === 'choice' && s.opts[st.choice.opt] !== undefined));
};
function refComplete(plan, state, id, now, payload) {
  const step = stepOf(plan, id);
  const n = RT(state);
  n.done[id] = now;
  delete n.skipped[id];
  if (step.wait) { n.waits[step.wait.id] = { start: now, mins: step.wait.mins, by: id }; n.laps[step.wait.id] = 0; }
  if (step.kind === 'choice' && payload && typeof payload === 'object' && payload.value !== undefined) n.opts[step.choice.opt] = payload.value;
  if (n.fg && n.fg.stepId === id) n.fg = null;
  for (const r of plan.rules || []) {
    if (r.on !== id) continue;
    if (r.ifDone !== undefined && !refDone(plan, n, r.ifDone)) continue;
    if (r.ifNotDone !== undefined && refDone(plan, n, r.ifNotDone)) continue;
    Object.assign(n.opts, r.set);
  }
  if (step.kind === 'move' && step.move === 'leavePm') for (const st of plan.steps) if (st.where === 'home' && !refDone(plan, n, st.id)) n.skipped[st.id] = true;
  n.rev = state.rev + 1; n.updatedAt = now;
  return n;
}
const refOpt = (plan, s, name) => s.opts[name] ?? plan.optionDefaults[name];
const refWhen = (plan, s, when) => !when || Object.keys(when).every((k) => refOpt(plan, s, k) === when[k]);
const refActive = (plan, s, st) => refWhen(plan, s, st.when) && !s.skipped[st.id];
function refPackList(plan, s, which) {
  const owner = plan.steps.find((x) => x.kind === 'checklist' && x.items === which);
  const mine = (owner && s.ticks[owner.id]) || {};
  return (plan.pack[which] || [])
    .filter((it) => (it.ifDone === undefined || refDone(plan, s, it.ifDone)) && (it.ifNotDone === undefined || !refDone(plan, s, it.ifNotDone)) && refWhen(plan, s, it.when))
    .map((it) => ({ id: it.id, label: it.label, note: it.note || '', ticked: !!mine[it.id] }));
}
function refProgress(plan, s, dish) {
  const mine = plan.steps.filter((st) => (dish === undefined || st.dish === dish) && !st.optional && refActive(plan, s, st));
  return { done: mine.filter((st) => refDone(plan, s, st.id)).length, total: mine.length };
}
const slim = (rows) => rows.map((r) => ({ id: r.id, label: r.label, note: r.note || '', ticked: r.ticked }));
// SPEC 3.2 / 3.3, written out again. (No wait record: closed only while a step that arms it can still happen.)
const MOVE_TO = { leaveAm: 'away', backHome: 'home-pm', leavePm: 'drive', arrive: 'hers' };
const MOVE_FROM = { leaveAm: 'home-am', backHome: 'away', leavePm: 'home-pm', arrive: 'drive' };
function refLocation(plan, s) {
  let loc = 'home-am';
  for (const name of ['leaveAm', 'backHome', 'leavePm', 'arrive']) {
    const mv = plan.steps.find((st) => st.kind === 'move' && st.move === name);
    if (mv && s.done[mv.id] !== undefined) loc = MOVE_TO[name];
  }
  return loc;
}
function refPlaceOk(step, loc) {
  if (step.kind === 'move') return MOVE_FROM[step.move] === loc;
  if (step.where === 'home') return loc === 'home-am' || loc === 'home-pm';
  if (step.where === 'hers') return loc === 'hers';
  return loc === 'home-am' || loc === 'hers';
}
function refBlockers(plan, s, step, now) {
  if (!refActive(plan, s, step) || refDone(plan, s, step.id)) return [];
  const out = [];
  for (const id of step.after || []) {
    const dep = stepOf(plan, id);
    if (dep && !refDone(plan, s, id) && refActive(plan, s, dep)) out.push({ type: 'after', stepId: id });
  }
  if (step.afterWait) {
    const r = s.waits[step.afterWait];
    if (r) { const end = r.start + r.mins * MIN; if (now < end) out.push({ type: 'wait', waitId: step.afterWait, endsAt: end }); }
    else if (plan.steps.some((a) => a.wait && a.wait.id === step.afterWait && refActive(plan, s, a) && !refDone(plan, s, a.id))) {
      out.push({ type: 'wait', waitId: step.afterWait, endsAt: null });
    }
  }
  if (step.notBefore) { const at = E.anchorMs(s, step.notBefore.anchor) + step.notBefore.mins * MIN; if (now < at) out.push({ type: 'time', at }); }
  if (!refPlaceOk(step, refLocation(plan, s))) out.push({ type: 'place', where: step.kind === 'move' ? MOVE_FROM[step.move] : step.where });
  return out;
}

function rng(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
function randomOp(plan, r, now) {
  const ids = plan.steps.map((s) => s.id);
  const waitIds = [...new Set(plan.steps.filter((s) => s.wait).map((s) => s.wait.id))];
  const itemIds = Object.keys(plan.pack).reduce((a, k) => a.concat(plan.pack[k].map((i) => i.id)), []).concat(['i0', 'i1', 'i2', 'nope', 3]);
  const one = (arr) => arr[Math.floor(r() * arr.length)];
  const anyId = () => (r() < 0.9 ? one(ids) : one(['nope', '', 'constructor', '__proto__', 'toString', undefined, null, 7]));
  const k = r();
  if (k < 0.42) return ['complete', [anyId(), r() < 0.3 ? { value: r() < 0.5 } : (r() < 0.1 ? one([null, 'x', {}, { value: undefined }]) : undefined)]];
  if (k < 0.52) return ['uncomplete', [anyId()]];
  if (k < 0.58) return ['skip', [anyId()]];
  if (k < 0.64) return ['retry', [anyId()]];
  if (k < 0.67) return ['giveUp', [anyId()]];
  if (k < 0.73) return ['ackLap', [r() < 0.9 ? one(waitIds) : one(['nope', undefined, 'constructor']), one([undefined, 1, 2, 3, 0, -1, 2.7, NaN, 'x'])]];
  if (k < 0.80) return ['tick', [anyId(), one(itemIds), r() < 0.7]];
  if (k < 0.84) return ['tickTonight', [one((plan.tonight || []).map((t) => t.id).concat(['nope', undefined])), r() < 0.7]];
  if (k < 0.88) return ['setOpt', [one(Object.keys(plan.optionDefaults).concat(['nope', '', undefined])), one([true, false, undefined])]];
  if (k < 0.94) return ['setAnchor', [one(Object.keys(plan.anchors).concat(['nope', undefined])),
    r() < 0.6 ? Math.floor(r() * 1700) - 100 : one([NaN, -30, 0, 1439, 5000, Infinity, -Infinity, '600', undefined, null, 12.5])]];
  if (k < 0.96) return ['setDay', [one(['2027-01-16', '2027-01-17', '2027-02-30', 'x', undefined])]];
  if (k < 0.99) return ['startFg', [anyId(), one([now + 30000, NaN, undefined])]];
  return ['clearFg', []];
}
const ORDER = ['start', 'leaveAm', 'backHome', 'leavePm', 'arrive', 'dinner'];
function checkState(plan, s, label) {
  const ids = new Set(plan.steps.map((x) => x.id));
  const waitIds = new Set(plan.steps.filter((x) => x.wait).map((x) => x.wait.id));
  assert.deepEqual(RT(s), s, label + ': state is not JSON-clean');
  assert.match(s.day, /^\d{4}-\d{2}-\d{2}$/, label);
  for (let i = 0; i < ORDER.length; i++) {
    const v = s.anchors[ORDER[i]];
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 1439, label + ': anchor ' + ORDER[i] + ' = ' + v + ' is not a whole minute of the day');
    if (i) assert.ok(v > s.anchors[ORDER[i - 1]], label + ': anchor ' + ORDER[i] + ' (' + v + ') is not after ' + ORDER[i - 1] + ' (' + s.anchors[ORDER[i - 1]] + ')');
  }
  for (const id of Object.keys(s.done)) { assert.ok(ids.has(id), label + ': done has unknown step ' + id); assert.ok(Number.isFinite(s.done[id]), label); }
  for (const id of Object.keys(s.skipped)) { assert.ok(ids.has(id), label + ': skipped has unknown step ' + id); assert.equal(s.skipped[id], true, label); }
  for (const id of Object.keys(s.waits)) {
    assert.ok(waitIds.has(id), label + ': waits has unknown wait ' + id);
    const w = s.waits[id];
    assert.deepEqual(Object.keys(w).sort(), ['by', 'mins', 'start'], label);
    assert.ok(Number.isFinite(w.start) && Number.isFinite(w.mins) && w.mins >= 0 && ids.has(w.by), label + ': bad wait record ' + JSON.stringify(w));
  }
  for (const id of Object.keys(s.waits)) {
    const by = stepOf(plan, s.waits[id].by);
    if (by.wait && by.wait.id === id) assert.ok(s.done[by.id] !== undefined, label + ': timer "' + id + '" is running for "' + by.id + '", which is not done');
  }
  for (const id of Object.keys(s.done)) assert.equal(id in s.skipped, false, label + ': ' + id + ' is both done and skipped');
  for (const id of Object.keys(s.laps)) assert.ok(Number.isInteger(s.laps[id]) && s.laps[id] >= 0, label + ': laps.' + id + ' = ' + s.laps[id]);
  for (const id of Object.keys(s.ticks)) for (const item of Object.keys(s.ticks[id])) assert.equal(s.ticks[id][item], true, label);
  for (const id of Object.keys(s.tonight)) assert.equal(s.tonight[id], true, label);
  if (s.fg !== null) assert.ok(ids.has(s.fg.stepId) && Number.isFinite(s.fg.endsAt), label + ': bad fg ' + JSON.stringify(s.fg));
  assert.ok(Number.isInteger(s.rev) && s.rev >= 0, label);
}
// What SPEC 3.6 promises about waitsView() and alerts(), checked against the raw state.
const WAIT_KEYS = ['id', 'label', 'by', 'gatedStepId', 'startedAt', 'endsAt', 'remainingMs', 'elapsed', 'urgent', 'attended', 'laps', 'overMax'];
const ALERT_RANK = { lap: 0, wait: 1, max: 2, leave: 3 };
function checkWaitViews(plan, s, t, label) {
  const rows = E.waitsView(plan, s, t);
  const alerts = E.alerts(plan, s, t);
  const loc = refLocation(plan, s);
  rows.forEach((w, i) => {
    for (const k of WAIT_KEYS) assert.ok(k in w, label + ': waitsView row ' + w.id + ' lacks ' + k);
    const r = s.waits[w.id];
    assert.ok(r, label + ': a row for "' + w.id + '", which is not armed');
    assert.equal(w.startedAt, r.start, label);
    assert.equal(w.endsAt, r.start + r.mins * MIN, label);
    assert.equal(w.by, r.by, label);
    assert.equal(w.remainingMs, Math.max(0, w.endsAt - t), label + ': remainingMs of ' + w.id);
    assert.equal(!!w.elapsed, t >= w.endsAt, label + ': elapsed of ' + w.id);
    if (i) assert.ok(rows[i - 1].endsAt <= w.endsAt, label + ': waitsView is not sorted by endsAt');
    if (w.gatedStepId !== null) {
      const g = stepOf(plan, w.gatedStepId);
      assert.ok(g && g.afterWait === w.id, label + ': gatedStepId ' + w.gatedStepId + ' is not gated by ' + w.id);
      assert.equal(refDone(plan, s, g.id), false, label + ': ' + w.id + ' is listed although its step ' + g.id + ' is done');
    }
    w.laps.forEach((l, k) => {
      assert.equal(l.n, k + 1, label);
      assert.equal(l.due, t >= l.at, label + ': lap due');
      assert.equal(l.acked, l.n <= (s.laps[w.id] || 0), label + ': lap acked');
      assert.ok(l.at >= w.startedAt && l.at <= w.endsAt, label + ': lap outside its wait');
      if (k) assert.ok(l.at >= w.laps[k - 1].at, label + ': laps not in time order');
    });
  });
  assert.equal(new Set(rows.map((w) => w.id)).size, rows.length, label + ': a wait is listed twice');
  let last = -1;
  const seen = new Set();
  for (const a of alerts) {
    assert.ok(a.kind in ALERT_RANK, label + ': unknown alert kind ' + a.kind);
    assert.ok(ALERT_RANK[a.kind] >= last, label + ': alerts out of order: ' + alerts.map((x) => x.kind).join(','));
    last = ALERT_RANK[a.kind];
    assert.ok(typeof a.id === 'string' && !seen.has(a.id), label + ': alert ids must be unique strings');
    seen.add(a.id);
    assert.ok(typeof a.title === 'string' && a.title.length > 0, label + ': alert without a title');
    if (a.kind === 'leave') continue;
    const w = rows.find((x) => x.id === a.waitId);
    assert.ok(w, label + ': ' + a.kind + ' alert for "' + a.waitId + '", which waitsView does not list');
    if (a.kind === 'wait') assert.ok(w.urgent && w.elapsed, label + ': "wait" alert for a timer that is not urgent or not over');
    if (a.kind === 'max') assert.ok(w.overMax, label + ': "max" alert too early');
    if (a.kind === 'lap') { const l = w.laps[a.lap - 1]; assert.ok(l && l.due && !l.acked, label + ': lap alert for a lap that is not due or already acknowledged'); }
    if (a.stepId !== undefined) assert.ok(stepOf(plan, a.stepId), label + ': alert names an unknown step');
  }
  // every listed timer that needs attention has its alert (timers of a kitchen he left are the engine's documented exception)
  for (const w of rows) {
    if (w.here === false) continue;
    if (w.urgent && w.elapsed) assert.ok(alerts.some((a) => a.kind === 'wait' && a.waitId === w.id), label + ': no alert for the ended urgent timer ' + w.id);
    if (w.overMax) assert.ok(alerts.some((a) => a.kind === 'max' && a.waitId === w.id), label + ': no alert for ' + w.id + ' over its max');
    if (!w.elapsed && w.laps.some((l) => l.due && !l.acked)) assert.ok(alerts.some((a) => a.kind === 'lap' && a.waitId === w.id), label + ': no alert for a due lap of ' + w.id);
  }
  // the leave warning
  const hardOut = loc === 'home-am' ? 'leaveAm' : loc === 'home-pm' ? 'leavePm' : null;
  const mv = hardOut && plan.steps.find((st) => st.kind === 'move' && st.move === hardOut);
  const leave = alerts.filter((a) => a.kind === 'leave');
  if (mv && s.done[mv.id] === undefined && t >= E.anchorMs(s, hardOut) - 10 * MIN) {
    assert.equal(leave.length, 1, label + ': a leave warning is due in ' + loc);
    assert.equal(leave[0].stepId, mv.id, label);
    assert.ok(Math.abs(leave[0].minsLeft - (E.anchorMs(s, hardOut) - t) / MIN) < 1, label + ': minsLeft ' + leave[0].minsLeft);
  } else assert.equal(leave.length, 0, label + ': a leave warning in ' + loc + ' at ' + E.fmtClock(t));
  // while he has never left his morning kitchen, SPEC 3.6 is exact: every armed wait with an open gated step is listed
  if (loc === 'home-am') {
    for (const id of Object.keys(s.waits)) {
      const gated = plan.steps.filter((g) => g.afterWait === id && refActive(plan, s, g));
      const open = gated.filter((g) => !refDone(plan, s, g.id));
      const row = rows.find((w) => w.id === id);
      if (open.length) assert.ok(row, label + ': waitsView lacks "' + id + '" although ' + open[0].id + ' is still waiting on it');
      else if (gated.length) assert.equal(row, undefined, label + ': waitsView lists "' + id + '" although every step it gates is done');
    }
  }
}

function randomWalk(plan, seed, steps, fresh) {
  const r = rng(seed);
  let s = fresh, now = E.anchorMs(fresh, 'start') - 15 * MIN, changes = 0;
  for (let i = 0; i < steps; i++) {
    now += Math.floor(r() * 12 * MIN);
    const [name, args] = randomOp(plan, r, now);
    const label = 'seed ' + seed + ' op ' + i + ' ' + show(name, args);
    const before = s;
    s = act(s, name, args, now, plan);
    if (s !== before) changes++;
    assert.equal(s.rev, changes, label + ': rev counts the changes');
    checkState(plan, s, label);
    if (name === 'complete' && typeof args[0] === 'string' && stepOf(plan, args[0]) && before.done[args[0]] === undefined) {
      assert.deepEqual(RT(s), refComplete(plan, before, args[0], now, args[1]), label + ': complete() differs from SPEC 3.5');
    }
    for (const which of Object.keys(plan.pack)) assert.deepEqual(slim(E.packList(plan, s, which)), refPackList(plan, s, which), label + ': packList ' + which);
    assert.deepEqual(E.progress(plan, s), refProgress(plan, s), label + ': progress');
    for (const d of plan.dishes.map((x) => x.id).concat(['day'])) assert.deepEqual(E.dishProgress(plan, s, d), refProgress(plan, s, d), label + ': dishProgress ' + d);
    assert.equal(E.location(plan, s), refLocation(plan, s), label + ': location');
    checkWaitViews(plan, s, now + Math.floor(r() * 40 * MIN), label);
    const probe = now + (i % 3) * 11 * MIN;
    for (const st of (i % 2 ? [] : plan.steps)) {
      assert.equal(E.isDone(plan, s, st.id), refDone(plan, s, st.id), label + ': isDone ' + st.id);
      assert.equal(E.isActive(plan, s, st.id), refActive(plan, s, st), label + ': isActive ' + st.id);
      const why = E.blockers(plan, s, st.id, probe);
      assert.deepEqual(why, refBlockers(plan, s, st, probe), label + ': blockers ' + st.id);
      assert.equal(E.isAvailable(plan, s, st.id, probe), refActive(plan, s, st) && !refDone(plan, s, st.id) && why.length === 0, label + ': isAvailable ' + st.id);
    }
    for (const name of Object.keys(plan.optionDefaults)) assert.equal(E.opt(plan, s, name), refOpt(plan, s, name), label + ': opt ' + name);
    if (i % 4 === 0) {
      const t = now + Math.floor(r() * 30 * MIN);
      let v;
      try { v = views(plan, s, t); } catch (e) { assert.fail(label + ': a view threw: ' + (e && e.stack ? e.stack : e)); }
      assert.deepEqual(views(plan, deepFreeze(RT(s)), t), v, label + ': views differ after a JSON round trip');
    }
  }
  return s;
}

test('random walks (valid and junk calls): pure, JSON-safe, state always well-formed, complete() and lists match the spec', () => {
  for (let seed = 1; seed <= 24; seed++) randomWalk(PLAN, seed * 7919, 100, S0());
});

// ---------------------------------------------------------------- 6. uncomplete()

test('uncomplete: removes done and the wait that step armed, nothing else', () => {
  const s = at('tick:pack-bag');                           // waits: rest, simmer, toast, brine, chill
  const u = act(s, 'uncomplete', ['boil'], H(8, 27));
  assert.equal('boil' in u.done, false);
  assert.equal('simmer' in u.waits, false);
  assert.deepEqual(Object.keys(u.waits).sort(), ['brine', 'chill', 'rest', 'toast']);
  assert.deepEqual({ ...u.done, boil: s.done.boil }, s.done);
  assert.deepEqual(u.ticks, s.ticks);
  assert.deepEqual(u.opts, s.opts);
  assert.equal(E.isDone(PLAN, u, 'boil'), false);
  assert.equal(E.waitsView(PLAN, u, H(8, 27)).some((w) => w.id === 'simmer'), false);
  assert.equal(E.alerts(PLAN, u, H(8, 32)).some((a) => a.waitId === 'simmer'), false, 'no "stir the pot" for a pot that is not on');
  // a step without a wait
  const w = act(at('complete:wipe'), 'uncomplete', ['wipe'], H(9));
  assert.equal('wipe' in w.done, false);
  assert.deepEqual(w.waits, at('complete:wipe').waits);
});

test('uncomplete: a re-armed check timer goes away with the step that owns the wait', () => {
  let s = E.retry(PLAN, at('complete:brine-drain'), 'taste', H(8, 52));      // simmer now {by: 'taste'}
  assert.equal(s.waits.simmer.by, 'taste');
  s = act(s, 'uncomplete', ['boil'], H(8, 53));
  assert.equal('simmer' in s.waits, false);
});

test('uncomplete: a step that is not done is no change, even when the other variant armed the same wait id', () => {
  const s = at('complete:rinse');                          // rest armed by rinse; quick (other variant, same wait id) never done
  assert.deepEqual(s.waits.rest, { start: H(8, 2), mins: 5, by: 'rinse' });
  const u = act(s, 'uncomplete', ['quick'], H(8, 3));
  assert.deepEqual(u.waits, s.waits, '"quick" did not arm this wait and must not remove it');
  assert.equal(u, s, 'uncompleting a not-done step must be no change');
});

test('uncomplete: a choice forgets its answer and asks again', () => {
  let s = act(at('complete:q-soak'), 'uncomplete', ['q-soak'], H(8, 1));
  assert.deepEqual(s.opts, {});
  assert.equal(E.isDone(PLAN, s, 'q-soak'), false);
  assert.equal(E.nextStep(PLAN, s, H(8, 1)), 'q-soak');
});

test('uncomplete: undoing each move returns to the place before it', () => {
  const places = [['go-am', 'home-am', 'away'], ['back', 'away', 'home-pm'], ['go-pm', 'home-pm', 'drive'], ['arrive', 'drive', 'hers']];
  for (const [id, from, to] of places) {
    const before = TRACE[TRACE.findIndex((x) => x.label === 'complete:' + id) - 1];
    assert.equal(E.location(PLAN, before.state), from);
    const moved = at('complete:' + id);
    assert.equal(E.location(PLAN, moved), to);
    const undone = act(moved, 'uncomplete', [id], moved.done[id] + MIN);
    assert.equal(E.location(PLAN, undone), from, 'undo of ' + id);
    assert.equal(E.isDone(PLAN, undone, id), false);
    assert.deepEqual(undone.done, before.state.done);
    assert.deepEqual(undone.waits, before.state.waits);
    assert.deepEqual(E.alerts(PLAN, undone, moved.done[id] + MIN), E.alerts(PLAN, before.state, moved.done[id] + MIN));
  }
});

test('uncomplete(leavePm): the home steps that leaving wrote off are open again', () => {
  const before = TRACE[TRACE.findIndex((x) => x.label === 'complete:go-pm') - 1].state;
  const left = at('complete:go-pm');
  assert.deepEqual(Object.keys(left.skipped).sort(), ['garnish', 'quick']);
  const undone = act(left, 'uncomplete', ['go-pm'], H(14, 11));
  assert.deepEqual(undone.skipped, before.skipped);
  assert.deepEqual(views(PLAN, undone, H(14, 11)), views(PLAN, deepFreeze({ ...before, rev: undone.rev, updatedAt: undone.updatedAt }), H(14, 11)));
});

test('uncomplete(leavePm): a home step he skipped HIMSELF before leaving stays skipped',
  { todo: 'spec gap: SPEC 3.5 says nothing about skips on uncomplete; engine.js promises to undo "the auto-skips" but also drops manual skips' }, () => {
    let s = TRACE[TRACE.findIndex((x) => x.label === 'complete:go-pm') - 1].state;
    s = E.skip(PLAN, s, 'garnish', H(14, 5));              // optional home step: "Skip"
    const left = E.complete(PLAN, s, 'go-pm', H(14, 10));
    const undone = act(left, 'uncomplete', ['go-pm'], H(14, 11));
    assert.deepEqual(undone.skipped, s.skipped, 'his own skip of "garnish" is gone after tapping "Not done" on the leave step');
  });

test('uncomplete of a move: the options its rules set are taken back',
  { todo: 'spec gap: SPEC 3.5 does not say rules are undone. app.js doUncomplete() uses its undo stack when "Not done" directly follows the tap; in every other case the options stay' }, () => {
    const before = at('complete:brine-drain');             // soup on, not tasted yet
    const left = E.complete(PLAN, before, 'go-am', H(9, 0));
    assert.deepEqual(left.opts, { soaked: true, late: true, packed: true });
    const undone = act(left, 'uncomplete', ['go-am'], H(9, 1));
    assert.equal(E.location(PLAN, undone), 'home-am');
    assert.deepEqual(undone.opts, before.opts, 'late / packed stay set after undoing the leave');
    assert.equal(E.isActive(PLAN, undone, 'taste'), true, 'the morning soup check must come back');
  });

// ---------------------------------------------------------------- 7. the other reducers

test('skip: marks exactly that step, its dependents are no longer blocked by it', () => {
  let s = at('complete:q-soak');
  assert.deepEqual(E.blockers(PLAN, s, 'boil', H(8, 1)).map((b) => b.type), ['after', 'wait']);
  s = act(s, 'skip', ['rinse'], H(8, 1));
  assert.deepEqual(s.skipped, { rinse: true });
  assert.equal(E.isActive(PLAN, s, 'rinse'), false);
  assert.equal(E.isDone(PLAN, s, 'rinse'), false);
  assert.deepEqual(E.blockers(PLAN, s, 'boil', H(8, 1)), [], 'a skipped dep is satisfied and a wait nobody will start is open (SPEC 3.3)');
  assert.equal(E.isAvailable(PLAN, s, 'boil', H(8, 1)), true);
});

test('retry: re-arms the check timer as {start: now, mins: retryMins, by: the check step}', () => {
  let s = at('complete:brine-drain');
  assert.equal(E.isAvailable(PLAN, s, 'taste', H(8, 51)), true);
  s = act(s, 'retry', ['taste'], H(8, 52));
  assert.deepEqual(s.waits.simmer, { start: H(8, 52), mins: 10, by: 'taste' });
  assert.equal(E.isDone(PLAN, s, 'taste'), false);
  assert.equal(E.isAvailable(PLAN, s, 'taste', H(9, 1, 59)), false);
  assert.deepEqual(E.blockers(PLAN, s, 'taste', H(9, 1)), [{ type: 'wait', waitId: 'simmer', endsAt: H(9, 2) }]);
  assert.equal(E.isAvailable(PLAN, s, 'taste', H(9, 2)), true);
  const v = E.waitsView(PLAN, s, H(8, 55)).find((w) => w.id === 'simmer');
  assert.equal(v.label, 'Soup simmering');
  assert.equal(v.by, 'taste');
  assert.equal(v.gatedStepId, 'taste');
  assert.equal(v.endsAt, H(9, 2));
  assert.equal(v.attended, true);
  // a second retry starts over again
  s = act(s, 'retry', ['taste'], H(9, 3));
  assert.deepEqual(s.waits.simmer, { start: H(9, 3), mins: 10, by: 'taste' });
  // the check at her place, without a giveUp
  let h = run(S0(), [['go-am', H(11, 30)], ['back', H(13, 30)], ['go-pm', H(14, 10)], ['arrive', H(14, 40)], ['soup-resume', H(14, 50)]]);
  h = act(h, 'retry', ['soup-taste2'], H(15, 21));
  assert.deepEqual(h.waits.soup2, { start: H(15, 21), mins: 5, by: 'soup-taste2' });
});

test('giveUp: applies exactly check.giveUp.set, does not complete the step', () => {
  let s = at('complete:boil');
  s = act(s, 'giveUp', ['taste'], H(10, 50));
  assert.deepEqual(s.opts, { soaked: true, late: true });
  assert.equal('taste' in s.done, false);
  assert.equal(E.isActive(PLAN, s, 'taste'), false);
  assert.equal(E.isActive(PLAN, s, 'soup-resume'), true);
  assert.equal(E.isAvailable(PLAN, s, 'stove-off', H(10, 50)), true);
});

test('canGiveUp: only from 45 minutes before the hard out', () => {
  const s = at('complete:boil');
  assert.equal(E.canGiveUp(PLAN, s, 'taste', H(10, 44, 59)), false);
  assert.equal(E.canGiveUp(PLAN, s, 'taste', H(10, 45)), true);
  assert.equal(E.canGiveUp(PLAN, s, stepOf(PLAN, 'taste'), H(11, 40)), true);
  assert.equal(E.canGiveUp(PLAN, s, 'soup-taste2', H(11)), false, 'a check with no giveUp');
  assert.equal(E.canGiveUp(PLAN, s, 'wipe', H(11)), false);
  assert.equal(E.canGiveUp(PLAN, s, 'nope', H(11)), false);
  // the window follows the edited anchor
  const later = E.setAnchor(PLAN, s, 'leaveAm', 720, H(8, 12));
  assert.equal(E.canGiveUp(PLAN, later, 'taste', H(11, 14)), false);
  assert.equal(E.canGiveUp(PLAN, later, 'taste', H(11, 15)), true);
});

for (const [place, moves] of [['away', ['go-am']], ['home-pm', ['go-am', 'back']], ['drive', ['go-am', 'back', 'go-pm']], ['hers', ['go-am', 'back', 'go-pm', 'arrive']]]) {
  test('canGiveUp (SPEC 9.2): false once he is not in his morning kitchen any more: ' + place, () => {
    let s = at('complete:boil');
    let now = H(11, 30);
    for (const id of moves) { s = E.complete(PLAN, s, id, now); now += 20 * MIN; }
    assert.equal(E.location(PLAN, s), place);
    assert.equal(E.canGiveUp(PLAN, s, 'taste', now), false,
      'SPEC 9.2: true only if giveUp exists, location === "home-am" and now is inside withinMinsOf; here location is ' + place);
  });
}

test('ackLap: counts up, never down, only for a wait that is running', () => {
  let s = at('complete:boil');
  assert.equal(s.laps.simmer, 0);
  s = act(s, 'ackLap', ['simmer', undefined], H(8, 22));
  assert.equal(s.laps.simmer, 1);
  s = act(s, 'ackLap', ['simmer', 3], H(8, 42));
  assert.equal(s.laps.simmer, 3);
  assert.equal(act(s, 'ackLap', ['simmer', 1], H(8, 43)), s);
  assert.equal(act(s, 'ackLap', ['simmer', 3], H(8, 43)), s);
  assert.equal(act(s, 'ackLap', ['nope', 1], H(8, 43)), s);
  assert.equal(act(s, 'ackLap', ['toast', 1], H(8, 43)), s, 'a wait that was never started');
  assert.deepEqual(act(s, 'ackLap', ['simmer', 4.9], H(8, 44)).laps, { rest: 0, simmer: 4 });
});

test('tick: {stepId: {itemId: true}}, off removes it, other steps and lists untouched', () => {
  let s = act(S0(), 'tick', ['pack-cooler', 'ice', true], H(8));
  s = act(s, 'tick', ['pack-cooler', 'soup', true], H(8, 1));
  s = act(s, 'tick', ['pack-bag', 'ice', true], H(8, 2));               // same item id under another step
  assert.deepEqual(s.ticks, { 'pack-cooler': { ice: true, soup: true }, 'pack-bag': { ice: true } });
  s = act(s, 'tick', ['pack-cooler', 'ice', false], H(8, 3));
  assert.equal(!!s.ticks['pack-cooler'].ice, false);
  assert.equal(s.ticks['pack-cooler'].soup, true);
  assert.equal(s.ticks['pack-bag'].ice, true);
  assert.equal(E.packList(PLAN, s, 'cooler').find((i) => i.id === 'ice').ticked, false);
  // truthy / falsy `on` values
  assert.equal(act(s, 'tick', ['pack-bag', 'salt', 1], H(8, 4)).ticks['pack-bag'].salt, true);
  assert.equal(!!act(s, 'tick', ['pack-bag', 'ice', undefined], H(8, 4)).ticks['pack-bag'].ice, false);
  assert.equal(!!act(s, 'tick', ['pack-bag', 'ice', 0], H(8, 4)).ticks['pack-bag'].ice, false);
});

test('tick on a step that is not a checklist, or an item that does not exist: no throw, no list changes', () => {
  const base = at('complete:boil');
  const lists = (s) => [E.packList(PLAN, s, 'cooler'), E.packList(PLAN, s, 'bag'), E.packList(PLAN, s, 'gear'), E.checklistItems(PLAN, s, 'pack-tools'), E.progress(PLAN, s)];
  for (const [stepId, itemId] of [['wipe', 'ice'], ['boil', 'i0'], ['go-am', 'bread'], ['q-soak', 'x'], ['pack-bag', 'nope'], ['pack-tools', 'i99'], ['pack-cooler', 'bread']]) {
    let s;
    assert.doesNotThrow(() => { s = act(base, 'tick', [stepId, itemId, true], H(8, 12)); });
    assert.deepEqual(lists(s), lists(base), 'tick(' + stepId + ', ' + itemId + ') must not show up in any list');
    assert.deepEqual({ ...s, ticks: base.ticks, rev: base.rev, updatedAt: base.updatedAt }, base, 'only ticks may change');
  }
});

test('tickTonight: ticks, applies the item\'s sets when on, never for an item without sets', () => {
  let s = act(S0(), 'tickTonight', ['shop', true], H(7, 31));
  assert.deepEqual(s.tonight, { shop: true });
  assert.deepEqual(s.opts, {});
  s = act(s, 'tickTonight', ['soak', true], H(7, 32));
  assert.deepEqual(s.tonight, { shop: true, soak: true });
  assert.deepEqual(s.opts, { soaked: true });
  s = act(s, 'tickTonight', ['shop', false], H(7, 33));
  assert.deepEqual(s.tonight, { soak: true });
  // ticking overrides an earlier "No"
  let n = E.setOpt(PLAN, S0(), 'soaked', false, H(7, 31));
  n = act(n, 'tickTonight', ['soak', true], H(7, 32));
  assert.equal(n.opts.soaked, true);
});

test('tickTonight: unticking takes back the option the tick had set, so the morning question is asked again',
  { todo: 'spec gap: SPEC 3.5 only says sets apply "when on". With the engine alone, tick + untick leaves the answer in place and the question is never asked (app.js doTonight() takes it back itself)' }, () => {
    let s = E.tickTonight(PLAN, S0(), 'soak', true, H(7, 31));
    s = act(s, 'tickTonight', ['soak', false], H(7, 32));
    assert.deepEqual(s.tonight, {});
    assert.equal(E.isDone(PLAN, s, 'q-soak'), false, 'the choice step is still answered "yes" although nothing is ticked');
    assert.equal(E.nextStep(PLAN, s, H(8)), 'q-soak');
  });

test('setOpt: sets, overrides the default, undefined removes the override', () => {
  let s = act(S0(), 'setOpt', ['late', true], H(7, 31));
  assert.deepEqual(s.opts, { late: true });
  assert.equal(E.opt(PLAN, s, 'late'), true);
  s = act(s, 'setOpt', ['late', false], H(7, 32));
  assert.deepEqual(s.opts, { late: false });
  s = act(s, 'setOpt', ['late', undefined], H(7, 33));
  assert.deepEqual(s.opts, {});
  assert.equal(E.opt(PLAN, s, 'late'), false);
  assert.equal(E.opt(PLAN, s, 'nope'), undefined);
  assert.equal(E.opt(PLAN, s, 'constructor'), undefined, 'no prototype leak');
  assert.equal(E.opt(PLAN, s, 'toString'), undefined);
});

test('opt (SPEC 3.3): state.opts[name] ?? plan.optionDefaults[name], so a null override falls back to the default', () => {
  const s = deepFreeze({ ...S0(), opts: { soaked: null } });
  assert.equal(E.opt(PLAN, s, 'soaked'), true);
  assert.equal(E.isActive(PLAN, s, 'rinse'), true, 'with null the soaked variant must still exist');
});

// ---------------------------------------------------------------- 8. setAnchor

test('setAnchor: rounds, clamps to 0..1439, refuses to touch or cross a neighbour', () => {
  const s = S0();
  const set = (name, v) => act(s, 'setAnchor', [name, v], H(7, 31));
  assert.equal(set('backHome', 849).anchors.backHome, 849);
  assert.equal(set('backHome', 691).anchors.backHome, 691);
  assert.equal(set('backHome', 850), s, 'equal to leavePm');
  assert.equal(set('backHome', 851), s, 'past leavePm');
  assert.equal(set('backHome', 690), s, 'equal to leaveAm');
  assert.equal(set('backHome', 0), s);
  assert.equal(set('backHome', 849.5), s, 'rounds up onto leavePm');
  assert.equal(set('backHome', 849.4).anchors.backHome, 849);
  assert.equal(set('start', 0).anchors.start, 0);
  assert.equal(set('start', -1).anchors.start, 0, 'negative clamps to midnight');
  assert.equal(set('start', -5000).anchors.start, 0);
  assert.equal(set('start', 689).anchors.start, 689);
  assert.equal(set('start', 690), s);
  assert.equal(set('start', 5000), s, 'clamped to 1439, which is past every other anchor');
  assert.equal(set('dinner', 1439).anchors.dinner, 1439);
  assert.equal(set('dinner', 1440).anchors.dinner, 1439);
  assert.equal(set('dinner', 1e9).anchors.dinner, 1439);
  assert.equal(set('dinner', 881).anchors.dinner, 881);
  assert.equal(set('dinner', 880), s);
  assert.equal(set('dinner', -20), s, 'clamped to 0, which is before every other anchor');
  for (const name of ['leaveAm', 'backHome', 'leavePm', 'arrive', 'dinner']) assert.equal(set(name, -30), s, name + ' cannot jump to midnight');
  for (const bad of [NaN, Infinity, -Infinity, '700', undefined, null, {}, [700], true]) assert.equal(set('leaveAm', bad), s, 'minutes = ' + String(bad));
  const out = set('leavePm', 860);
  assert.deepEqual(out.anchors, { ...s.anchors, leavePm: 860 }, 'only that anchor moves');
  assert.equal(PLAN.anchors.leavePm, 850);
  assert.equal(E.anchorMs(out, 'leavePm'), H(14, 20));
});

test('setAnchor: whatever is thrown at it, the six anchors stay whole minutes in strictly increasing order', () => {
  const r = rng(424242);
  let s = S0();
  const one = (arr) => arr[Math.floor(r() * arr.length)];
  for (let i = 0; i < 4000; i++) {
    const name = one(ORDER);
    const v = r() < 0.75 ? Math.round((r() * 1800 - 150) * 4) / 4 : one([NaN, -1, 0, 1439, 1440, Infinity, -Infinity, s.anchors[one(ORDER)], s.anchors[one(ORDER)] + 1, s.anchors[one(ORDER)] - 1]);
    const before = s;
    s = act(s, 'setAnchor', [name, v], H(7, 31) + i);
    for (let k = 0; k < ORDER.length; k++) {
      const a = s.anchors[ORDER[k]];
      assert.ok(Number.isInteger(a) && a >= 0 && a <= 1439, 'after setAnchor(' + name + ', ' + v + '): ' + JSON.stringify(s.anchors));
      if (k) assert.ok(a > s.anchors[ORDER[k - 1]], 'order broken by setAnchor(' + name + ', ' + v + '): ' + JSON.stringify(s.anchors));
    }
    if (s !== before) {
      const expected = Math.min(1439, Math.max(0, Math.round(v)));
      assert.equal(s.anchors[name], expected, 'setAnchor(' + name + ', ' + v + ')');
      for (const other of ORDER) if (other !== name) assert.equal(s.anchors[other], before.anchors[other]);
    }
  }
  assert.notDeepEqual(s.anchors, PLAN.anchors, 'the walk did move something');
});

test('setAnchor: every time-based answer follows the edited anchor', () => {
  let s = at('complete:pack-bag');
  assert.equal(kinds(E.alerts(PLAN, s, H(11, 20))).includes('leave'), true);
  s = act(s, 'setAnchor', ['leaveAm', 720], H(9, 5));                    // 12:00
  assert.deepEqual(E.alerts(PLAN, s, H(11, 49)), []);
  assert.deepEqual(kinds(E.alerts(PLAN, s, H(11, 50))), ['leave']);
  assert.equal(E.alerts(PLAN, s, H(11, 50))[0].minsLeft, 10);
  s = act(s, 'setAnchor', ['dinner', 1200], H(9, 6));                    // 8:00 PM
  assert.deepEqual(E.blockers(PLAN, s, 'plate', H(19, 29)).filter((b) => b.type === 'time'), [{ type: 'time', at: H(19, 30) }]);
});

// ---------------------------------------------------------------- 9. waitsView()

test('waitsView: every SPEC 3.6 field, sorted by endsAt, laps in time order', () => {
  const s = at('tick:pack-bag');                           // 8:26. rest ended (boil done), toast done; brine 8:38, chill 8:45, simmer 8:51
  const v = E.waitsView(PLAN, s, H(8, 26));
  assert.deepEqual(v.map((w) => w.id), ['brine', 'chill', 'simmer']);
  for (const w of v) for (const k of WAIT_KEYS) assert.ok(k in w, 'waitsView row for ' + w.id + ' lacks "' + k + '"');
  for (let i = 1; i < v.length; i++) assert.ok(v[i - 1].endsAt <= v[i].endsAt);
  const simmer = v[2];
  assert.equal(simmer.label, 'Soup simmering');
  assert.equal(simmer.by, 'boil');
  assert.equal(simmer.gatedStepId, 'taste');
  assert.equal(simmer.startedAt, H(8, 11));
  assert.equal(simmer.endsAt, H(8, 51));
  assert.equal(simmer.remainingMs, 25 * MIN);
  assert.equal(!!simmer.elapsed, false);
  assert.equal(simmer.attended, true);
  assert.equal(simmer.urgent, false);
  assert.equal(simmer.overMax, false);
  assert.deepEqual(simmer.laps, [
    { n: 1, at: H(8, 21), due: true, acked: true },         // plan lists laps as [30, 10, 20]: they must come out in time order
    { n: 2, at: H(8, 31), due: false, acked: false },
    { n: 3, at: H(8, 41), due: false, acked: false }
  ]);
  const brine = v[0];
  assert.equal(brine.gatedStepId, 'brine-drain');
  assert.equal(brine.attended, false);
  assert.equal(brine.urgent, false);
  assert.deepEqual(brine.laps, []);
  assert.equal(v[1].gatedStepId, null, 'chill holds nothing back');
  assert.deepEqual(E.waitsView(PLAN, S0(), H(8)), []);
});

test('waitsView: exact edges of due, elapsed, remaining and overMax', () => {
  const s = at('complete:chill');
  const w = (t, id) => E.waitsView(PLAN, s, t).find((x) => x.id === id);
  // lap 2 of simmer is at 8:31:00.000
  assert.equal(w(H(8, 30, 59, 999), 'simmer').laps[1].due, false);
  assert.equal(w(H(8, 31), 'simmer').laps[1].due, true);
  // brine ends 8:38:00.000
  assert.equal(!!w(H(8, 37, 59, 999), 'brine').elapsed, false);
  assert.equal(w(H(8, 37, 59, 999), 'brine').remainingMs, 1);
  assert.equal(!!w(H(8, 38), 'brine').elapsed, true);
  assert.equal(w(H(8, 38), 'brine').remainingMs, 0);
  assert.equal(w(H(8, 47), 'brine').remainingMs, 0, 'never negative');
  assert.equal(E.isAvailable(PLAN, s, 'brine-drain', H(8, 37, 59, 999)), false);
  assert.equal(E.isAvailable(PLAN, s, 'brine-drain', H(8, 38)), true, 'the gate opens the moment the row says elapsed');
  // max is 25 minutes after 8:23: beyond means after 8:48:00.000
  assert.equal(w(H(8, 48), 'brine').overMax, false);
  assert.equal(w(H(8, 48, 0, 1), 'brine').overMax, true);
  assert.equal(w(H(8, 40), 'simmer').overMax, false, 'no max on this wait');
});

test('waitsView: gone once the gated step is done; a wait that gates nothing is listed until it ends', () => {
  let s = at('complete:chill');
  assert.deepEqual(E.waitsView(PLAN, s, H(8, 44, 59)).map((w) => w.id), ['brine', 'chill', 'simmer']);
  assert.deepEqual(E.waitsView(PLAN, s, H(8, 45)).map((w) => w.id), ['brine', 'simmer']);
  s = E.complete(PLAN, s, 'brine-drain', H(8, 40));
  assert.deepEqual(E.waitsView(PLAN, s, H(8, 41)).map((w) => w.id), ['chill', 'simmer']);
  s = E.complete(PLAN, s, 'taste', H(8, 52));
  assert.deepEqual(E.waitsView(PLAN, s, H(8, 53)), []);
  // toast: armed 8:13, its step done 8:20
  assert.equal(E.waitsView(PLAN, at('complete:toast'), H(8, 19, 30)).some((w) => w.id === 'toast'), true);
  assert.equal(E.waitsView(PLAN, at('complete:toast-out'), H(8, 20)).some((w) => w.id === 'toast'), false);
});

test('waitsView: equal end times come out in a stable order; junk records are ignored', () => {
  const base = at('complete:boil');
  const s = deepFreeze({ ...base, waits: { toast: { start: H(8, 20), mins: 6, by: 'toast' }, brine: { start: H(8, 11), mins: 15, by: 'brine' },
    simmer: base.waits.simmer, chill: { start: H(8, 6), mins: 20, by: 'chill' } } });
  const a = E.waitsView(PLAN, s, H(8, 21)).map((w) => [w.id, w.endsAt]);
  assert.deepEqual(a.map((x) => x[1]), [H(8, 26), H(8, 26), H(8, 26), H(8, 51)]);
  const reordered = deepFreeze({ ...s, waits: { chill: s.waits.chill, simmer: s.waits.simmer, brine: s.waits.brine, toast: s.waits.toast } });
  assert.deepEqual(E.waitsView(PLAN, reordered, H(8, 21)).map((w) => [w.id, w.endsAt]), a, 'key order in the stored state must not matter');
  const junk = deepFreeze({ ...base, waits: { simmer: null, toast: 'soon', brine: { start: 'x', mins: 5 }, chill: { start: H(8), mins: null }, nope: { start: H(8), mins: 5, by: 'gone' }, rest: [] },
    laps: { simmer: 'two', toast: -4, brine: NaN, nope: 1.5 } });
  let v;
  assert.doesNotThrow(() => { v = E.waitsView(PLAN, junk, H(8, 2)); E.alerts(PLAN, junk, H(8, 2)); E.project(PLAN, junk, H(8, 2)); });
  assert.deepEqual(v.map((w) => w.id), ['nope'], 'only the one well-formed record (of an unknown wait) is listed');
});

// ---------------------------------------------------------------- 10. alerts()

test('alerts: a due lap until it is acknowledged; each has kind, id, title, waitId, lap', () => {
  const s = at('complete:boil');                           // laps 8:21 8:31 8:41, ends 8:51
  assert.deepEqual(E.alerts(PLAN, s, H(8, 20, 59, 999)), []);
  let a = E.alerts(PLAN, s, H(8, 21));
  assert.equal(a.length, 1);
  assert.equal(a[0].kind, 'lap');
  assert.equal(a[0].waitId, 'simmer');
  assert.equal(a[0].lap, 1);
  assert.equal(typeof a[0].id, 'string');
  assert.match(a[0].title, /Stir the pot/);
  assert.deepEqual(E.alerts(PLAN, act(s, 'ackLap', ['simmer', a[0].lap], H(8, 22)), H(8, 22)), []);
  // he missed two: acknowledging what the alert names clears it
  a = E.alerts(PLAN, s, H(8, 42));
  assert.ok(a.length >= 1 && a.every((x) => x.kind === 'lap' && x.waitId === 'simmer'));
  const top = a[a.length - 1].lap;
  assert.equal(top, 3);
  assert.deepEqual(E.alerts(PLAN, E.ackLap(PLAN, s, 'simmer', top, H(8, 43)), H(8, 43)), []);
  // ids are stable while the alert lasts and change with the lap
  assert.equal(E.alerts(PLAN, s, H(8, 21))[0].id, E.alerts(PLAN, s, H(8, 25))[0].id);
  assert.notEqual(E.alerts(PLAN, s, H(8, 21))[0].id, E.alerts(PLAN, s, H(8, 31))[0].id);
});

test('alerts: an urgent wait that ended, until its step is done; a non-urgent ending is not an alert', () => {
  const s = at('complete:toast');                          // toast 8:13 -> 8:19, urgent
  assert.deepEqual(E.alerts(PLAN, s, H(8, 18, 59, 999)), []);
  const a = E.alerts(PLAN, s, H(8, 19));
  assert.equal(a.length, 1);
  assert.equal(a[0].kind, 'wait');
  assert.equal(a[0].waitId, 'toast');
  assert.equal(a[0].stepId, 'toast-out');
  assert.match(a[0].title, /Bread toasting/);
  assert.equal(E.alerts(PLAN, s, H(8, 20)).length, 1);
  assert.deepEqual(E.alerts(PLAN, at('complete:toast-out'), H(8, 20, 30)), [], 'done gated step: no alert');
  // rest (not urgent) ended at 8:07 with boil not done
  assert.deepEqual(E.alerts(PLAN, at('complete:rinse'), H(8, 8)), []);
});

test('alerts: max exceeded (marinade style), until the gated step is done', () => {
  const s = at('complete:chill');                          // brine 8:23, ends 8:38, max 8:48
  const maxOnly = (t, st = s) => E.alerts(PLAN, st, t).filter((x) => x.kind === 'max');
  assert.deepEqual(maxOnly(H(8, 39)), []);
  assert.deepEqual(maxOnly(H(8, 48)), []);
  const a = maxOnly(H(8, 48, 0, 1));
  assert.equal(a.length, 1);
  assert.equal(a[0].waitId, 'brine');
  assert.equal(a[0].stepId, 'brine-drain');
  assert.match(a[0].title, /Cucumbers brining/);
  assert.deepEqual(maxOnly(H(8, 50), E.complete(PLAN, s, 'brine-drain', H(8, 49))), []);
});

test('alerts: nothing for a wait whose gated step is already done (lap, wait and max)', () => {
  // all three kinds would be due at 11:21 if their steps were open
  let s = run(S0(), [['q-soak', H(10, 30), { value: true }], ['rinse', H(10, 40)], ['boil', H(10, 50)], ['brine', H(10, 50)], ['toast', H(11, 10)]]);
  assert.deepEqual(kinds(E.alerts(PLAN, s, H(11, 21))).slice(0, 3), ['lap', 'wait', 'max']);
  s = run(s, [['taste', H(11, 20, 10)], ['toast-out', H(11, 20, 20)], ['brine-drain', H(11, 20, 30)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(11, 21)).filter((a) => a.kind !== 'leave'), []);
  assert.deepEqual(E.waitsView(PLAN, s, H(11, 21)), []);
});

test('alerts: order is laps, ended urgent waits, max exceeded, leave warning', () => {
  const s = run(S0(), [['q-soak', H(10, 30), { value: true }], ['rinse', H(10, 40)], ['boil', H(10, 50)], ['brine', H(10, 50)], ['toast', H(11, 10)]]);
  const a = E.alerts(PLAN, s, H(11, 21));                  // lap 3 due 11:20, toast ended 11:16, brine max 11:15, leave in 9
  assert.deepEqual(kinds(a), ['lap', 'wait', 'max', 'leave']);
  assert.deepEqual(a.map((x) => x.waitId), ['simmer', 'toast', 'brine', undefined]);
  assert.equal(a[3].minsLeft, 9);
  assert.equal(new Set(a.map((x) => x.id)).size, 4, 'ids are unique');
  for (const x of a) { assert.equal(typeof x.title, 'string'); assert.ok(x.title.length > 0); }
});

test('alerts: leave warning at 11 min, 10 min, 0 and past, for both hard outs only', () => {
  const s = at('complete:pack-bag');                       // morning work done, 11:30 hard out
  const leave = (st, t) => E.alerts(PLAN, st, t).filter((a) => a.kind === 'leave');
  assert.deepEqual(leave(s, H(11, 19)), [], '11 minutes before: nothing yet');
  assert.deepEqual(leave(s, H(11, 19, 59, 999)), []);
  let a = leave(s, H(11, 20));
  assert.equal(a.length, 1, '10 minutes before');
  assert.equal(a[0].minsLeft, 10);
  assert.equal(a[0].stepId, 'go-am');
  assert.equal(leave(s, H(11, 25))[0].minsLeft, 5);
  assert.ok(leave(s, H(11, 29, 30))[0].minsLeft <= 1 && leave(s, H(11, 29, 30))[0].minsLeft >= 0);
  assert.equal(leave(s, H(11, 30))[0].minsLeft, 0, 'at the hard out');
  assert.ok(leave(s, H(11, 34))[0].minsLeft < 0, 'past the hard out: minsLeft goes negative');
  assert.equal(leave(s, H(11, 34))[0].minsLeft, -4);
  assert.equal(leave(s, H(13, 0)).length, 1, 'still warning an hour and a half later');
  assert.equal(leave(s, H(11, 20))[0].id, leave(s, H(11, 34))[0].id, 'one stable id for the whole warning');
  // also when the morning is NOT finished (the move itself is blocked by a dep)
  assert.equal(leave(at('complete:boil'), H(11, 25)).length, 1);
  // away: no hard out
  const away = at('complete:go-am');
  assert.deepEqual(E.alerts(PLAN, away, H(13, 25)), []);
  assert.deepEqual(E.alerts(PLAN, away, H(13, 45)), [], 'being late back home is not a "leave" warning');
  // pack-up stop: leavePm 14:10
  const pm = at('complete:back');
  assert.deepEqual(leave(pm, H(13, 59)), []);
  a = leave(pm, H(14, 0));
  assert.equal(a.length, 1);
  assert.equal(a[0].minsLeft, 10);
  assert.equal(a[0].stepId, 'go-pm');
  assert.equal(leave(pm, H(14, 12))[0].minsLeft, -2);
  assert.notEqual(a[0].id, leave(s, H(11, 20))[0].id);
  // driving and her kitchen: none (arrive and dinner are not hard outs)
  assert.deepEqual(E.alerts(PLAN, at('complete:go-pm'), H(14, 39)), []);
  assert.deepEqual(E.alerts(PLAN, at('complete:go-pm'), H(15, 30)), []);
  assert.deepEqual(E.alerts(PLAN, at('complete:arrive'), H(18, 59)), []);
  assert.deepEqual(E.alerts(PLAN, at('complete:h-unpack'), H(19, 30)), []);
  // the evening before: nothing
  const eve = E.initialState(PLAN, 'x', new Date(2027, 0, 15, 22, 0).getTime());
  assert.equal(eve.day, DAY);
  assert.deepEqual(E.alerts(PLAN, eve, new Date(2027, 0, 15, 23, 25).getTime()), []);
});

test('alerts / waitsView: undoing and re-doing a move does not silence the timers already running in that kitchen', () => {
  // her kitchen: soup back on (attended), bread under the grill (attended, urgent)
  let s = run(S0(), [['go-am', H(11, 30)], ['back', H(13, 30)], ['pack-cooler', H(13, 38)], ['go-pm', H(14, 10)], ['arrive', H(14, 40)],
    ['soup-resume', H(14, 45)], ['toast', H(14, 50)]]);     // soup2: 14:45 -> 15:15, toast: 14:50 -> 14:56
  assert.deepEqual(E.waitsView(PLAN, s, H(14, 57)).map((w) => w.id), ['toast', 'soup2']);
  assert.deepEqual(E.alerts(PLAN, s, H(14, 57)).map((a) => [a.kind, a.waitId]), [['wait', 'toast']]);
  // Day tab: he taps the "Arrive" row and "Not done" by mistake, then the big "I'm here" the Now tab offers
  s = act(s, 'uncomplete', ['arrive'], H(14, 52));
  s = act(s, 'complete', ['arrive'], H(14, 52, 20));
  assert.equal(E.location(PLAN, s), 'hers');
  assert.deepEqual(E.waitsView(PLAN, s, H(14, 57)).map((w) => w.id), ['toast', 'soup2'], 'both pots are still on her stove (SPEC 3.6: every armed wait whose gated step is not done)');
  assert.deepEqual(E.alerts(PLAN, s, H(14, 57)).map((a) => [a.kind, a.waitId]), [['wait', 'toast']], 'the bread alarm must still ring (SPEC 3.6: elapsed urgent waits)');
});

test('odd but legal waits: zero minutes, laps out of range or repeated, max shorter than the wait', () => {
  const p = makePlan();
  S(p, 'toast').wait = { id: 'toast', mins: 0, label: 'Instant', attended: true, urgent: true };
  S(p, 'brine').wait = { id: 'brine', mins: 15, label: 'Brine', laps: [0, -5, 5, 5, 15, 40, 7.5], max: 10 };
  deepFreeze(p);
  assert.deepEqual(E.validate(p), []);
  let s = E.initialState(p, 'x', H(7, 30));
  s = act(s, 'complete', ['toast'], H(8), p);
  s = act(s, 'complete', ['brine'], H(8), p);
  assert.equal(E.isAvailable(p, s, 'toast-out', H(8)), true, 'a zero-minute wait is over at once');
  const w = E.waitsView(p, s, H(8));
  assert.deepEqual(w.map((x) => [x.id, x.remainingMs, !!x.elapsed]), [['toast', 0, true], ['brine', 15 * MIN, false]]);
  assert.deepEqual(E.alerts(p, s, H(8)).map((a) => [a.kind, a.waitId]), [['wait', 'toast']]);
  const laps = w[1].laps;
  assert.ok(laps.length >= 1);
  laps.forEach((l, i) => {
    assert.equal(l.n, i + 1);
    assert.ok(l.at > H(8) && l.at < H(8, 15), 'a lap outside the wait: ' + E.fmtClock(l.at));
    if (i) assert.ok(l.at >= laps[i - 1].at, 'laps in time order');
  });
  // max 10 < mins 15: the warning comes while the timer is still running
  assert.deepEqual(E.alerts(p, s, H(8, 10)).filter((a) => a.kind === 'max'), []);
  assert.deepEqual(E.alerts(p, s, H(8, 10, 0, 1)).filter((a) => a.kind === 'max').map((a) => a.waitId), ['brine']);
  // acknowledging the last lap named by the alert silences the laps for good
  const lap = E.alerts(p, s, H(8, 9)).find((a) => a.kind === 'lap');
  assert.ok(lap, 'a lap is due at 8:09');
  s = act(s, 'ackLap', ['brine', lap.lap], H(8, 9), p);
  assert.deepEqual(E.alerts(p, s, H(8, 9, 30)).filter((a) => a.kind === 'lap'), []);
});

test('options with string and number values: choice payload, when, pack conditions and JSON all agree', () => {
  const p = makePlan();
  p.optionDefaults.heat = 'mild';
  p.optionDefaults.loaves = 1;
  p.steps.splice(3, 0, { id: 'q-heat', dish: 'soup', block: 'am', where: 'home', kind: 'choice', title: 'How hot?', body: [], mins: 0.5,
    choice: { opt: 'heat', options: [{ label: 'Mild', value: 'mild' }, { label: 'Hot', value: 'hot' }] } });
  S(p, 'garnish').when = { heat: 'hot' };
  S(p, 'chill').when = { loaves: 2 };
  p.pack.bag.push({ id: 'chili', label: 'Chili flakes', when: { heat: 'hot' } }, { id: 'loaf2', label: 'Second loaf', when: { loaves: 2 } });
  deepFreeze(p);
  assert.deepEqual(E.validate(p), []);
  let s = E.initialState(p, 'x', H(7, 30));
  assert.deepEqual([E.isActive(p, s, 'garnish'), E.isActive(p, s, 'chill'), E.isDone(p, s, 'q-heat')], [false, false, false]);
  s = act(s, 'complete', ['q-heat', { value: 'hot' }], H(8), p);
  s = act(s, 'setOpt', ['loaves', 2], H(8, 1), p);
  assert.deepEqual(s.opts, { heat: 'hot', loaves: 2 });
  for (const st of [s, deepFreeze(RT(s))]) {
    assert.deepEqual([E.isActive(p, st, 'garnish'), E.isActive(p, st, 'chill'), E.isDone(p, st, 'q-heat')], [true, true, true]);
    assert.deepEqual(E.packList(p, st, 'bag').map((i) => i.id), ['bread', 'salt', 'chili', 'loaf2']);
  }
  // "2" is not 2, 0 and '' and false are real answers
  assert.equal(E.isActive(p, E.setOpt(p, s, 'loaves', '2', H(8, 2)), 'chill'), false);
  for (const v of [0, '', false]) {
    const z = act(S0(), 'setOpt', ['soaked', v], H(8));
    assert.equal(E.opt(PLAN, z, 'soaked'), v, 'a falsy override must not fall back to the default');
    assert.equal(E.isDone(PLAN, z, 'q-soak'), true);
  }
});

// ---------------------------------------------------------------- 11. packList / checklistItems / progress

test('packList: ifDone, ifNotDone, when; note; ticks come from the checklist step of that list', () => {
  const ids = (s, which = 'cooler') => E.packList(PLAN, s, which).map((i) => i.id);
  let s = S0();
  assert.deepEqual(ids(s), ['ice', 'cukes-raw']);
  const first = E.packList(PLAN, s, 'cooler')[0];
  assert.equal(first.label, 'Ice packs');
  assert.equal(first.note, 'On top');
  assert.equal(first.ticked, false);
  assert.equal(E.packList(PLAN, s, 'cooler')[1].note || '', '', 'no note is an empty note');
  s = run(s, [['q-soak', H(8), { value: true }], ['rinse', H(8, 2)], ['boil', H(8, 11)]]);
  assert.deepEqual(ids(s), ['ice', 'soup', 'cukes-raw']);
  s = E.complete(PLAN, s, 'brine', H(8, 23));
  assert.deepEqual(ids(s), ['ice', 'soup'], 'cucumbers are in the brine: neither whole nor ready');
  s = E.complete(PLAN, s, 'brine-drain', H(8, 40));
  assert.deepEqual(ids(s), ['ice', 'soup', 'cukes']);
  const late = E.giveUp(PLAN, s, 'taste', H(10, 50));
  assert.deepEqual(ids(late), ['ice', 'soup', 'cukes', 'pot', 'half']);
  // order is the plan's order, ticks are read per item
  let t = E.tick(PLAN, late, 'pack-cooler', 'pot', true, H(13, 31));
  t = E.tick(PLAN, t, 'pack-bag', 'soup', true, H(13, 31));               // wrong step: must not count
  t = E.tick(PLAN, t, 'pack-cooler', 'cukes-raw', true, H(13, 31));        // hidden item: stays hidden
  assert.deepEqual(E.packList(PLAN, t, 'cooler').map((i) => [i.id, i.ticked]), [['ice', false], ['soup', false], ['cukes', false], ['pot', true], ['half', false]]);
  assert.deepEqual(E.packList(PLAN, t, 'bag').map((i) => [i.id, i.ticked, i.note || '']), [['bread', false, ''], ['salt', false, 'The flaky one']]);
  // a list no checklist step uses, an unknown list, junk
  assert.deepEqual(E.packList(PLAN, t, 'gear').map((i) => [i.id, i.label, i.ticked]), [['ladle', 'Ladle', false]]);
  for (const which of ['nope', undefined, null, 7, 'constructor', 'toString', '__proto__']) assert.deepEqual(E.packList(PLAN, t, which), [], 'packList(' + String(which) + ')');
});

test('packList: an item with several conditions needs ALL of them (SPEC 9.1), in all eight combinations', () => {
  for (const boil of [false, true]) for (const taste of [false, true]) for (const late of [false, true]) {
    let s = S0();
    if (boil) s = E.complete(PLAN, s, 'boil', H(8, 11));
    if (taste) s = E.complete(PLAN, s, 'taste', H(8, 52));
    if (late) s = E.setOpt(PLAN, s, 'late', true, H(9));
    const shown = E.packList(PLAN, s, 'cooler').some((i) => i.id === 'half');
    assert.equal(shown, boil && !taste && late, 'half: boil ' + boil + ', taste ' + taste + ', late ' + late);
    assert.equal(E.packList(PLAN, s, 'cooler').some((i) => i.id === 'pot'), late);
    assert.equal(E.packList(PLAN, s, 'cooler').some((i) => i.id === 'soup'), boil);
  }
});

test('packList: conditions use isDone, so a skipped step is "not done" and an answered choice is "done"', () => {
  const p = makePlan();
  p.pack.cooler.push({ id: 'peas', label: 'Soaked peas', ifDone: 'q-soak' }, { id: 'dry', label: 'Dry peas', ifNotDone: 'q-soak' });
  deepFreeze(p);
  const has = (s, id) => E.packList(p, s, 'cooler').some((i) => i.id === id);
  let s = E.initialState(p, 'x', H(7, 30));
  assert.deepEqual([has(s, 'peas'), has(s, 'dry')], [false, true]);
  s = E.setOpt(p, s, 'soaked', false, H(7, 31));                         // answered in Setup, never "completed"
  assert.deepEqual([has(s, 'peas'), has(s, 'dry')], [true, false]);
  let k = E.skip(p, E.initialState(p, 'x', H(7, 30)), 'brine', H(8));
  assert.equal(E.packList(p, k, 'cooler').some((i) => i.id === 'cukes-raw'), true, 'skipped brine is not done: whole cucumbers travel');
});

test('checklistItems: pack list steps mirror packList, literal lists get stable ids, anything else is empty', () => {
  let s = E.tick(PLAN, at('complete:back'), 'pack-tools', 'i1', true, H(13, 31));
  assert.deepEqual(E.checklistItems(PLAN, s, 'pack-cooler'), E.packList(PLAN, s, 'cooler'));
  assert.deepEqual(E.checklistItems(PLAN, s, 'pack-bag'), E.packList(PLAN, s, 'bag'));
  assert.deepEqual(E.checklistItems(PLAN, s, 'pack-tools').map((i) => [i.id, i.label, i.ticked]),
    [['i0', 'Soup pot', false], ['i1', 'Ladle', true], ['i2', 'Bread knife', false]]);
  assert.deepEqual(E.checklistItems(PLAN, s, stepOf(PLAN, 'pack-tools')), E.checklistItems(PLAN, s, 'pack-tools'));
  for (const id of ['wipe', 'boil', 'nope', undefined, null, 5]) assert.deepEqual(E.checklistItems(PLAN, s, id), []);
});

test('progress / dishProgress: only active, non-optional steps count', () => {
  let s = S0();
  // 25 steps: minus quick (other variant), soup-resume + soup-taste2 (late only), garnish (optional)
  assert.deepEqual(E.progress(PLAN, s), { done: 0, total: 21 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'soup'), { done: 0, total: 5 });      // q-soak rinse boil taste stove-off
  assert.deepEqual(E.dishProgress(PLAN, s, 'salad'), { done: 0, total: 4 });     // brine brine-drain chill plate (garnish optional)
  assert.deepEqual(E.dishProgress(PLAN, s, 'bread'), { done: 0, total: 2 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'day'), { done: 0, total: 10 });
  for (const d of ['nope', undefined, null, 'constructor']) assert.deepEqual(E.dishProgress(PLAN, s, d), { done: 0, total: 0 });
  // an optional step never counts, done or not
  s = act(s, 'complete', ['garnish'], H(8));
  assert.deepEqual(E.progress(PLAN, s), { done: 0, total: 21 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'salad'), { done: 0, total: 4 });
  // a choice answered in Setup counts as done
  s = act(s, 'setOpt', ['soaked', false], H(8, 1));
  assert.deepEqual(E.dishProgress(PLAN, s, 'soup'), { done: 1, total: 5 }, 'quick replaces rinse, q-soak is answered');
  // a done step of the variant that is no longer active drops out
  s = act(s, 'complete', ['quick'], H(8, 2));
  assert.deepEqual(E.dishProgress(PLAN, s, 'soup'), { done: 2, total: 5 });
  s = act(s, 'setOpt', ['soaked', true], H(8, 3));
  assert.deepEqual(E.dishProgress(PLAN, s, 'soup'), { done: 1, total: 5 }, 'quick is inactive now: neither done nor total');
  // late: taste goes, the two her-kitchen steps come
  s = act(s, 'setOpt', ['late', true], H(8, 4));
  assert.deepEqual(E.dishProgress(PLAN, s, 'soup'), { done: 1, total: 6 });
  assert.deepEqual(E.progress(PLAN, s), { done: 1, total: 22 });
  // a skipped step leaves the total
  s = act(s, 'skip', ['wipe'], H(8, 5));
  assert.deepEqual(E.progress(PLAN, s), { done: 1, total: 21 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'day'), { done: 0, total: 9 });
  // the whole clean day
  const end = TRACE[TRACE.length - 1].state;
  assert.deepEqual(E.progress(PLAN, end), { done: 21, total: 21 });
  for (const d of ['soup', 'salad', 'bread', 'day']) { const p = E.dishProgress(PLAN, end, d); assert.equal(p.done, p.total, d); }
  // after leavePm the written-off home steps are out of the total, so it can still reach 100%
  const left = at('complete:go-pm');
  const sum = ['soup', 'salad', 'bread', 'day'].map((d) => E.dishProgress(PLAN, left, d)).reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }));
  assert.deepEqual(sum, E.progress(PLAN, left), 'the dishes add up to the whole');
});

// ---------------------------------------------------------------- 12. formatting

test('fmtClock: 12-hour clock, midnight and noon, local time', () => {
  const cases = [[0, 0, '12:00 AM'], [0, 1, '12:01 AM'], [0, 59, '12:59 AM'], [1, 0, '1:00 AM'], [7, 5, '7:05 AM'], [9, 59, '9:59 AM'], [10, 0, '10:00 AM'],
    [11, 59, '11:59 AM'], [12, 0, '12:00 PM'], [12, 30, '12:30 PM'], [13, 0, '1:00 PM'], [19, 30, '7:30 PM'], [23, 59, '11:59 PM']];
  for (const [h, m, want] of cases) assert.equal(E.fmtClock(H(h, m)), want);
  assert.equal(E.fmtClock(H(11, 59, 59, 999)), '11:59 AM', 'seconds are cut, never rounded up');
  assert.equal(E.fmtClock(H(23, 59, 59, 999)), '11:59 PM');
  assert.equal(E.fmtClock(H(24, 0)), '12:00 AM', 'the next midnight');
  for (const bad of [NaN, undefined, null, 'x', Infinity, -Infinity, {}]) {
    let out;
    assert.doesNotThrow(() => { out = E.fmtClock(bad); });
    assert.equal(typeof out, 'string');
    assert.doesNotMatch(out, /NaN|undefined|Invalid/, 'fmtClock(' + String(bad) + ') = ' + out);
  }
});

test('fmtDur: seconds under a minute, minutes, hours', () => {
  const cases = [[5, '5 min'], [1, '1 min'], [59, '59 min'], [60, '1 hr'], [61, '1 hr 1 min'], [80, '1 hr 20 min'], [120, '2 hr'], [125, '2 hr 5 min'],
    [600, '10 hr'], [0.5, '30 sec'], [0.25, '15 sec'], [0.75, '45 sec'], [1 / 60, '1 sec']];
  for (const [mins, want] of cases) assert.equal(E.fmtDur(mins), want, 'fmtDur(' + mins + ')');
  // edges that must never read "60 sec", "0 sec", "60 min" or "1 hr 60 min"
  assert.equal(E.fmtDur(59.5 / 60), '1 min', '59.5 seconds');
  assert.equal(E.fmtDur(59.9 / 60), '1 min');
  assert.equal(E.fmtDur(59.4 / 60), '59 sec');
  assert.equal(E.fmtDur(59.5), '1 hr', '59.5 minutes');
  assert.equal(E.fmtDur(119.5), '2 hr');
  assert.equal(E.fmtDur(119.4), '1 hr 59 min');
  assert.equal(E.fmtDur(2.5), '3 min');
  assert.equal(E.fmtDur(1.4), '1 min');
  for (const junk of [0, -1, -0.5, NaN, undefined, null, 'x', Infinity, -Infinity]) {
    let out;
    assert.doesNotThrow(() => { out = E.fmtDur(junk); });
    assert.match(out, /^\d+ (sec|min)$/, 'fmtDur(' + String(junk) + ') = ' + out);
    assert.doesNotMatch(out, /NaN|-/, 'fmtDur(' + String(junk) + ') = ' + out);
  }
  // every whole second and every quarter minute up to three hours reads sanely
  for (let secs = 1; secs <= 3 * 3600; secs += (secs < 180 ? 1 : 15)) {
    const out = E.fmtDur(secs / 60);
    assert.match(out, /^(\d+ sec|\d+ min|\d+ hr( \d+ min)?)$/, 'fmtDur(' + secs + ' s) = ' + out);
    const m = /^(?:(\d+) hr)?(?: ?(\d+) (min|sec))?$/.exec(out);
    if (m[2] !== undefined) assert.ok(Number(m[2]) >= 1 && Number(m[2]) <= 59, 'fmtDur(' + secs + ' s) = ' + out);
  }
});

test('fmtCountdown: m:ss and h:mm:ss, rounds up so 0:00 means done', () => {
  const cases = [[725000, '12:05'], [3730000, '1:02:10'], [0, '0:00'], [1, '0:01'], [999, '0:01'], [1000, '0:01'], [1001, '0:02'], [59000, '0:59'],
    [59500, '1:00'], [59001, '1:00'], [60000, '1:00'], [60001, '1:01'], [599000, '9:59'], [600000, '10:00'], [3599000, '59:59'], [3599001, '1:00:00'],
    [3600000, '1:00:00'], [3661000, '1:01:01'], [36000000, '10:00:00'], [86399000, '23:59:59'], [90061000, '25:01:01']];
  for (const [ms, want] of cases) assert.equal(E.fmtCountdown(ms), want, 'fmtCountdown(' + ms + ')');
  for (const junk of [-1, -5000, -Infinity, NaN, undefined, null, 'x', {}]) assert.equal(E.fmtCountdown(junk), '0:00', 'fmtCountdown(' + String(junk) + ')');
  for (let ms = 0; ms < 2 * 3600000; ms += 7919) {
    const out = E.fmtCountdown(ms);
    assert.match(out, /^(\d+:)?[0-5]?\d:[0-5]\d$/, 'fmtCountdown(' + ms + ') = ' + out);
    const parts = out.split(':').map(Number);
    const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    assert.equal(secs, Math.ceil(ms / 1000), 'fmtCountdown(' + ms + ') = ' + out);
  }
});

// ---------------------------------------------------------------- 13. validate()

test('validate: a valid plan is [] and is not touched; a JSON copy is still valid', () => {
  assert.deepEqual(E.validate(PLAN), []);
  assert.deepEqual(E.validate(RT(PLAN)), []);
  const p = makePlan();
  const before = JSON.stringify(p);
  E.validate(p);
  assert.equal(JSON.stringify(p), before);
});

// Each entry breaks exactly ONE invariant of SPEC section 2 (or 9.2). [what, mutate(plan), a word the report must contain]
const S = (p, id) => stepOf(p, id);
const BREAK = [
  ['unique ids: two steps share an id', (p) => { S(p, 'wipe').id = 'garnish'; }, /garnish/],
  ['unique ids: two dishes share an id', (p) => { p.dishes[2].id = 'salad'; S(p, 'toast').dish = 'salad'; S(p, 'toast-out').dish = 'salad'; }, /salad/],
  ['unique ids: two pack items in one list share an id', (p) => { p.pack.bag[1].id = 'bread'; }, /bread/],
  ['after names a step that does not exist', (p) => { S(p, 'toast-out').after = ['toast', 'ghost']; }, /ghost/],
  ['after names a dish id, not a step', (p) => { S(p, 'wipe').after = ['soup']; }, /soup/],
  ['afterWait names a wait nobody arms', (p) => { S(p, 'toast-out').afterWait = 'ghost-wait'; }, /ghost-wait/],
  ['afterWait names a step id instead of a wait id', (p) => { S(p, 'taste').afterWait = 'boil'; }, /boil/],
  ['pack item ifDone names a missing step', (p) => { p.pack.cooler[1].ifDone = 'ghost'; }, /ghost/],
  ['pack item ifNotDone names a missing step', (p) => { p.pack.cooler[3].ifNotDone = 'ghost'; }, /ghost/],
  ['rule "on" names a missing step', (p) => { p.rules[1].on = 'ghost'; }, /ghost/],
  ['rule ifDone names a missing step', (p) => { p.rules[2].ifDone = 'ghost'; }, /ghost/],
  ['rule ifNotDone names a missing step', (p) => { p.rules[0].ifNotDone = 'ghost'; }, /ghost/],
  ['a dep that comes later in the master order', (p) => { S(p, 'brine').after = ['chill']; }, /chill/],
  ['a step that depends on itself', (p) => { S(p, 'wipe').after = ['wipe']; }, /wipe/],
  ['a dep later in the order whose "when" does not exclude it', (p) => { S(p, 'rinse').after = ['q-soak', 'taste']; }, /taste/],
  ['a wait that is armed later in the master order', (p) => { S(p, 'toast').afterWait = 'chill'; }, /chill/],
  ['glossary key missing in body', (p) => { S(p, 'wipe').body = ['Now [[whisk]] it.']; }, /whisk/],
  ['glossary key missing in body, [[key|shown]] form', (p) => { S(p, 'wipe').body = ['Keep it [[cold|very cold]].']; }, /cold/],
  ['glossary key missing in look', (p) => { S(p, 'wipe').look = 'It looks [[glossy]].'; }, /glossy/],
  ['glossary key missing in tip', (p) => { S(p, 'wipe').tip = 'Use a [[bench-scraper]].'; }, /bench-scraper/],
  ['glossary key missing in warn', (p) => { S(p, 'wipe').warn = 'The pan is [[smoking-hot]].'; }, /smoking-hot/],
  ['glossary key missing in tonight[].body', (p) => { p.tonight[0].body = ['[[thaw]] the fish.']; }, /thaw/],
  ['glossary key with the wrong case', (p) => { S(p, 'wipe').body = ['[[Simmer]] it.']; }, /Simmer/],
  ['glossary key that only exists on Object.prototype', (p) => { S(p, 'wipe').body = ['[[constructor]]']; }, /constructor/],
  ['dish does not exist', (p) => { S(p, 'wipe').dish = 'stew'; }, /stew/],
  ['dish is missing', (p) => { delete S(p, 'wipe').dish; }, /wipe/],
  ['notBefore names a missing anchor', (p) => { S(p, 'plate').notBefore = { anchor: 'brunch', mins: -30 }; }, /brunch/],
  ['withinMinsOf names a missing anchor', (p) => { S(p, 'taste').check.giveUp.withinMinsOf.anchor = 'brunch'; }, /brunch/],
  ['no move step for backHome', (p) => { p.steps = p.steps.filter((s) => s.id !== 'back'); for (const s of p.steps) if (s.after) s.after = s.after.filter((id) => id !== 'back'); }, /backHome/],
  ['two move steps for leaveAm', (p) => { p.steps.splice(18, 0, { id: 'go-am-2', dish: 'day', block: 'am', where: 'home', kind: 'move', move: 'leaveAm', title: 'Leave again', body: [], mins: 0 }); }, /leaveAm/],
  ['the last step is not dinner (something comes after it)', (p) => { p.steps.push({ id: 'wash-up', dish: 'day', block: 'final', where: 'hers', title: 'Wash up', body: [], mins: 5 }); }, /dinner/],
  ['the last step is not dinner (it is called something else)', (p) => { S(p, 'dinner').id = 'supper'; }, /dinner/]
];
for (const [what, mutate, re] of BREAK) {
  test('validate reports: ' + what, () => {
    const p = makePlan();
    mutate(p);
    const problems = E.validate(deepFreeze(p));
    assert.ok(Array.isArray(problems) && problems.every((m) => typeof m === 'string' && m.length > 0), 'validate must return readable strings');
    assert.ok(problems.length > 0, 'nothing reported for: ' + what);
    assert.ok(problems.some((m) => re.test(m)), 'no problem mentions ' + re + ': ' + JSON.stringify(problems));
  });
}

test('validate reports: unique ids: two tonight items share an id', () => {
  const p = makePlan();
  p.tonight[1].id = 'shop';                                // tickTonight / state.tonight are keyed by this id
  const problems = E.validate(deepFreeze(p));
  assert.ok(problems.length > 0, 'two tonight items with id "shop" pass validate(); ticking one ticks both, and only the first one\'s `sets` ever apply');
});

test('validate: what the spec allows is not reported', () => {
  const ok = (what, mutate) => { const p = makePlan(); mutate(p); assert.deepEqual(E.validate(deepFreeze(p)), [], what); };
  ok('a dep later in the order that is variant-excluded', (p) => {
    p.steps.splice(p.steps.length - 2, 0, { id: 'late-only', dish: 'soup', block: 'hers', where: 'hers', title: 'Late only', body: [], mins: 1, when: { soaked: false } });
    S(p, 'rinse').after = ['q-soak', 'late-only'];        // rinse: soaked true, late-only: soaked false
  });
  ok('a wait armed later only by a variant-excluded step', (p) => {
    p.steps.splice(p.steps.length - 2, 0, { id: 'late-arm', dish: 'soup', block: 'hers', where: 'hers', title: 'Late arm', body: [], mins: 1, when: { late: true }, wait: { id: 'simmer', mins: 9, label: 'Again' } });
  });
  ok('a move step with no where, steps with no kind, fractional minutes', (p) => { delete S(p, 'go-am').where; S(p, 'wipe').mins = 0.25; });
  ok('an extra anchor used by notBefore', (p) => { p.anchors.snack = 1000; S(p, 'plate').notBefore = { anchor: 'snack', mins: 5 }; });
  ok('a glossary link in a dish note, an ingredient note and a container', (p) => { p.dishes[0].ingredients[1].note = 'see [[brine]]'; p.containers.home[0].holds = 'Soup at a [[simmer]]'; });
  ok('empty optional collections', (p) => { p.rules = []; p.tonight = []; p.pack.gear = []; p.containers = { home: [], hers: [] }; });
  ok('a rule with only on + set, a pack item with every condition', (p) => { p.rules.push({ on: 'wipe', set: { late: false } }); });
});

test('validate: junk plans report something and never throw', () => {
  for (const junk of [undefined, null, 0, 'plan', [], {}, { steps: [] }, { steps: 'x' }, { steps: [null, 1, 'a', {}, { id: 5 }] }, { steps: [{ id: 'dinner' }] }]) {
    let out;
    assert.doesNotThrow(() => { out = E.validate(junk); }, 'validate(' + JSON.stringify(junk) + ')');
    assert.ok(Array.isArray(out) && out.length > 0, 'validate(' + JSON.stringify(junk) + ') must report a problem');
  }
  // a valid plan with one field of every step replaced by junk still returns an array
  const r = rng(99);
  const fields = ['after', 'afterWait', 'wait', 'timer', 'check', 'choice', 'items', 'move', 'notBefore', 'when', 'body', 'kind', 'where', 'dish', 'mins', 'need', 'look'];
  const junk = [null, 0, 7, 'x', [], {}, [null], { id: null }, true];
  for (let i = 0; i < 250; i++) {
    const p = makePlan();
    const st = p.steps[Math.floor(r() * p.steps.length)];
    const f = fields[Math.floor(r() * fields.length)];
    st[f] = junk[Math.floor(r() * junk.length)];
    const label = 'step ' + st.id + '.' + f + ' = ' + JSON.stringify(st[f]);
    let out;
    assert.doesNotThrow(() => { out = E.validate(p); }, 'validate threw with ' + label);
    assert.ok(Array.isArray(out), label);
    // and the engine survives running that plan
    assert.doesNotThrow(() => {
      let s = E.initialState(p, 'x', H(7, 30));
      for (const [name, args, now] of SCRIPT) s = E[name](p, s, ...CALL[name](args, now));
      views(p, s, H(19, 5)); views(p, E.initialState(p, 'x', H(7, 30)), H(8, 30));
    }, 'the engine threw with ' + label);
  }
});

test('junk in any top-level section of the plan: nothing throws, a day can still be played', () => {
  const sections = ['anchors', 'anchorLabels', 'optionDefaults', 'rules', 'dishes', 'glossary', 'tonight', 'pack', 'containers', 'title', 'version'];
  const junk = [undefined, null, 0, 'x', [], {}, [null, 5, 'a', {}, { id: 5 }, { on: 'wipe' }, { on: 'wipe', set: 5 }, { id: 'a', sets: 7 }],
    { cooler: [null, 5, 'x', {}, { id: 5 }, { id: 'ok', ifDone: 5, when: 'x' }], bag: 'nope', gear: null }, { start: 'early', leaveAm: null, dinner: {} }];
  for (const key of sections) {
    for (const value of junk) {
      const p = makePlan();
      if (value === undefined) delete p[key]; else p[key] = value;
      const label = 'plan.' + key + ' = ' + JSON.stringify(value);
      let out;
      assert.doesNotThrow(() => { out = E.validate(p); }, 'validate threw with ' + label);
      assert.ok(Array.isArray(out), label);
      assert.doesNotThrow(() => {
        let s = E.initialState(p, 'x', H(7, 30));
        for (const [name, args, now] of SCRIPT) s = E[name](p, s, ...CALL[name](args, now));
        s = E.tickTonight(p, s, 'soak', true, H(19, 1)); s = E.giveUp(p, s, 'taste', H(19, 2)); s = E.retry(p, s, 'taste', H(19, 3));
        for (const t of [H(8, 30), H(11, 25), H(19, 5)]) {
          for (const k of Object.keys(p.pack && typeof p.pack === 'object' ? p.pack : {}).concat(['cooler', 'bag'])) E.packList(p, s, k);
          E.location(p, s); E.nextStep(p, s, t); E.nextUnlock(p, s, t); E.waitsView(p, s, t); E.alerts(p, s, t); E.project(p, s, t); E.progress(p, s);
          E.dishProgress(p, s, 'soup'); E.opt(p, s, 'soaked');
          for (const st of p.steps) { E.checklistItems(p, s, st.id); E.isActive(p, s, st.id); E.isDone(p, s, st.id); E.isAvailable(p, s, st.id, t); E.blockers(p, s, st.id, t); E.canGiveUp(p, s, st.id, t); }
        }
        E.project(p, E.initialState(p, 'x', H(7, 30)), H(7, 30));
      }, 'the engine threw with ' + label);
    }
  }
});

// ---------------------------------------------------------------- 14. hardening beyond the spec

test('a reducer called with a broken clock (NaN / undefined now) does not produce a state that changes meaning in storage',
  { todo: 'hardening: SPEC says now is epoch ms. complete(.., NaN) gives done = NaN, which is "done" in memory and null = "not done" after JSON' }, () => {
    for (const now of [NaN, undefined]) {
      const out = E.complete(PLAN, at('complete:q-soak'), 'wipe', now);
      assert.equal(E.isDone(PLAN, RT(out), 'wipe'), E.isDone(PLAN, out, 'wipe'), 'now = ' + String(now) + ': done before and after a JSON round trip');
      assert.deepEqual(RT(out), out, 'now = ' + String(now) + ': the state is not JSON-clean');
    }
  });

// ---------------------------------------------------------------- 15. the real plan, when it is there (never edited, only read)

let REAL = null;
try { REAL = require('../plan.js'); } catch (e) { REAL = null; }
const noReal = !REAL || !Array.isArray(REAL.steps) ? 'plan.js is not there (yet)' : false;
if (!noReal) deepFreeze(REAL);
const RD = (h, m = 0) => new Date(2026, 10, 23, h, m, 0, 0).getTime();
const realFresh = () => E.initialState(REAL, 'adv-phone', RD(6, 50));
const realMove = (name) => REAL.steps.find((s) => s.kind === 'move' && s.move === name);

test('real plan: random walks stay pure, JSON-safe and match the spec for complete(), pack lists and progress', { skip: noReal }, () => {
  for (let seed = 1; seed <= 3; seed++) randomWalk(REAL, seed * 104729, 80, realFresh());
});

test('real plan: canGiveUp is false everywhere but the morning kitchen (SPEC 9.2)', { skip: noReal }, () => {
  const checks = REAL.steps.filter((s) => s.kind === 'check' && s.check && s.check.giveUp);
  if (!checks.length) return;
  let s = realFresh(), now = RD(11, 0);
  for (const name of ['leaveAm', 'backHome', 'leavePm', 'arrive']) {
    s = E.complete(REAL, s, realMove(name).id, now);
    now += 30 * MIN;
    for (const c of checks) {
      assert.equal(E.canGiveUp(REAL, s, c.id, now), false,
        '"' + c.check.giveUp.label + '" is offered for ' + c.id + ' while location is ' + E.location(REAL, s));
    }
  }
});

test('real plan: unticking a Tonight item takes back the option it set',
  { skip: noReal, todo: 'spec gap: with the engine alone, tick + untick of "Soak the beans" leaves soaked = true and the morning question is never asked (app.js doTonight() takes it back itself)' }, () => {
    const eve = new Date(2026, 10, 22, 22, 30).getTime();
    for (const item of REAL.tonight.filter((t) => t.sets)) {
      const s0 = E.initialState(REAL, 'adv-phone', eve);
      const s = E.tickTonight(REAL, E.tickTonight(REAL, s0, item.id, true, eve + 1000), item.id, false, eve + 2000);
      assert.deepEqual(s.opts, s0.opts, 'after tick + untick of ' + item.id + ', opts are ' + JSON.stringify(s.opts));
      for (const c of REAL.steps.filter((x) => x.kind === 'choice' && x.choice && x.choice.opt in item.sets)) {
        assert.equal(E.isDone(REAL, s, c.id), false, 'the question "' + c.title + '" is never asked');
      }
    }
  });

test('real plan: "Not done" on a move takes back what its rules set',
  { skip: noReal, todo: 'spec gap: uncomplete() keeps rule-set options (app.js only covers "Not done" directly after the tap)' }, () => {
    for (const name of ['leaveAm', 'backHome', 'leavePm', 'arrive']) {
      const mv = realMove(name);
      const rules = (REAL.rules || []).filter((r) => r.on === mv.id);
      if (!rules.length) continue;
      let s = realFresh();
      for (const r of rules) if (r.ifDone) s = E.complete(REAL, s, r.ifDone, RD(9, 0));
      const left = E.complete(REAL, s, mv.id, RD(9, 30));
      const undone = E.uncomplete(REAL, left, mv.id, RD(9, 31));
      assert.equal(E.location(REAL, undone), E.location(REAL, s));
      assert.deepEqual(undone.opts, s.opts, 'after undoing ' + mv.id + ' the options are ' + JSON.stringify(undone.opts) + ' instead of ' + JSON.stringify(s.opts));
    }
  });
