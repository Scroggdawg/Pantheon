'use strict';
// Engine tests. Run: node --test ceviche-night/app/engine.test.js
// The FIXTURE below is a small made-up day (not the real recipes) that touches every engine feature.

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');

const MIN = 60000;
// Local wall-clock time on the fixture cook day (Mon Nov 23 2026). Works in any timezone.
const H = (h, m = 0, s = 0) => new Date(2026, 10, 23, h, m, s, 0).getTime();
const clone = (x) => JSON.parse(JSON.stringify(x));
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

function fixture() {
  return {
    version: 1,
    title: 'Fixture Night',
    anchors: { start: 420, leaveAm: 660, backHome: 840, leavePm: 870, arrive: 900, dinner: 1170 },
    anchorLabels: { start: 'Start cooking', leaveAm: 'Leave for appointment', backHome: 'Back home', leavePm: 'Leave for her place', arrive: 'Arrive at her place', dinner: 'Dinner' },
    optionDefaults: { soaked: true, beansLater: false, limeReady: false },
    rules: [
      { on: 'leave-am', ifNotDone: 'beans-check', set: { beansLater: true } },
      { on: 'arrive', ifDone: 'lime-juice', set: { limeReady: true } }
    ],
    dishes: [
      { id: 'beans', nick: 'The Pot', name: 'beans', color: 'brown', blurb: '', makes: '2', source: { label: 'x', url: 'https://example.com' }, ingredients: [{ qty: '1 cup', item: 'beans' }], gear: ['Pot'], notes: [] },
      { id: 'onions', nick: 'The Dunk', name: 'pink onions', color: 'purple', blurb: '', makes: '1 jar', source: { label: 'x', url: 'https://example.com' }, ingredients: [], gear: [], notes: ['You will [[blanch]] them.'] },
      { id: 'fish', nick: 'The Scoop', name: 'ceviche', color: 'teal', blurb: '', makes: '2', source: { label: 'x', url: 'https://example.com' }, ingredients: [], gear: [], notes: [] },
      { id: 'corn', nick: 'The Cob', name: 'corn', color: 'gold', blurb: '', makes: '2', source: { label: 'x', url: 'https://example.com' }, ingredients: [], gear: [], notes: [] }
    ],
    glossary: {
      blanch: { term: 'Blanch', text: 'Dip in boiling water.\nThen take it out.' },
      simmer: { term: 'Simmer', text: 'Small bubbles. Not a full boil.' }
    },
    tonight: [
      { id: 'order', title: 'Place the order', body: ['Order the food.'] },
      { id: 'soak', title: 'Soak the beans', body: ['Cover the beans with water.', 'They [[simmer]] tomorrow.'], sets: { soaked: true } }
    ],
    steps: [
      { id: 'soak-q', dish: 'beans', block: 'am', where: 'home', kind: 'choice', title: 'Did the beans soak?', body: [], mins: 1,
        choice: { opt: 'soaked', options: [{ label: 'Yes, they soaked', value: true }, { label: 'No', value: false }] } },
      { id: 'beans-quick', dish: 'beans', block: 'am', where: 'home', title: 'Quick soak the beans', body: [], mins: 5, after: ['soak-q'],
        when: { soaked: false }, wait: { id: 'quicksoak', mins: 60, label: 'Quick soak' } },
      { id: 'beans-start', dish: 'beans', block: 'am', where: 'home', title: 'Start the beans', body: ['Bring to a [[simmer|gentle simmer]].'], mins: 10,
        after: ['soak-q'], afterWait: 'quicksoak',
        wait: { id: 'beans', mins: 60, label: 'Beans simmering', attended: true, laps: [20, 40], lapLabel: 'Stir the beans' } },
      { id: 'onion-slice', dish: 'onions', block: 'am', where: 'either', title: 'Slice the onions', body: [], mins: 10 },
      { id: 'onion-dunk', dish: 'onions', block: 'am', where: 'either', title: 'Dunk the onions', body: ['[[blanch]] the onions.'], mins: 2,
        after: ['onion-slice'], timer: { secs: 30, label: 'Onions in hot water' }, wait: { id: 'steep', mins: 30, label: 'Onions steeping' } },
      { id: 'onion-jar', dish: 'onions', block: 'am', where: 'either', title: 'Jar the onions', body: [], mins: 3, after: ['onion-dunk'], afterWait: 'steep' },
      { id: 'bacon-fry', dish: 'beans', block: 'am', where: 'home', title: 'Fry the bacon', body: [], mins: 3,
        wait: { id: 'bacon', mins: 10, label: 'Bacon frying', attended: true, urgent: true } },
      { id: 'lime-juice', dish: 'fish', block: 'am', where: 'either', title: 'Juice the limes', body: [], mins: 20 },
      { id: 'sauce', dish: 'fish', block: 'am', where: 'either', title: 'Make the sauce', body: [], mins: 5 },
      { id: 'garnish', dish: 'onions', block: 'am', where: 'home', title: 'Cut the garnish', body: [], mins: 15, optional: true },
      { id: 'bacon-out', dish: 'beans', block: 'am', where: 'home', title: 'Take the bacon out', body: [], mins: 2, after: ['bacon-fry'], afterWait: 'bacon' },
      { id: 'beans-check', dish: 'beans', block: 'am', where: 'home', kind: 'check', title: 'Check the beans', body: [], mins: 1,
        after: ['beans-start'], afterWait: 'beans', when: { beansLater: false },
        check: { yes: 'Tender', no: 'Still firm', retryMins: 15,
                 giveUp: { label: 'No time. Finish at her place.', set: { beansLater: true }, withinMinsOf: { anchor: 'leaveAm', mins: 50 } } } },
      { id: 'beans-off', dish: 'beans', block: 'am', where: 'home', title: 'Turn the beans off', body: [], mins: 2, after: ['beans-check'], must: true },
      { id: 'pack-bag', dish: 'day', block: 'am', where: 'home', kind: 'checklist', title: 'Pack the bag', body: [], mins: 10, items: 'bag' },
      { id: 'leave-am', dish: 'day', block: 'am', where: 'home', kind: 'move', move: 'leaveAm', title: 'Leave for the appointment', body: [], mins: 0, after: ['beans-off'] },
      { id: 'back-home', dish: 'day', block: 'load', where: 'home', kind: 'move', move: 'backHome', title: 'Back home', body: [], mins: 0 },
      { id: 'load-cooler', dish: 'day', block: 'load', where: 'home', kind: 'checklist', title: 'Load the cooler', body: [], mins: 10, items: 'cooler', must: true, after: ['back-home'] },
      { id: 'load-gear', dish: 'day', block: 'load', where: 'home', kind: 'checklist', title: 'Load the gear', body: [], mins: 5, items: ['Big pot', 'Skillet'], after: ['back-home'] },
      { id: 'leave-pm', dish: 'day', block: 'load', where: 'home', kind: 'move', move: 'leavePm', title: 'Leave for her place', body: [], mins: 0, after: ['load-cooler'] },
      { id: 'arrive', dish: 'day', block: 'hers', where: 'hers', kind: 'move', move: 'arrive', title: 'Arrive', body: [], mins: 0 },
      { id: 'unpack', dish: 'day', block: 'hers', where: 'hers', title: 'Unpack the cooler', body: [], mins: 10 },
      { id: 'beans-finish', dish: 'beans', block: 'hers', where: 'hers', title: 'Finish the beans', body: [], mins: 5, when: { beansLater: true },
        wait: { id: 'beans2', mins: 40, label: 'Beans finishing', attended: true } },
      { id: 'fish-cure', dish: 'fish', block: 'hers', where: 'hers', title: 'Start the fish', body: [], mins: 10,
        wait: { id: 'cure', mins: 20, label: 'Fish curing', max: 30 } },
      { id: 'fish-drain', dish: 'fish', block: 'hers', where: 'hers', title: 'Drain the fish', body: [], mins: 5, after: ['fish-cure'], afterWait: 'cure' },
      { id: 'corn-broil', dish: 'corn', block: 'final', where: 'hers', title: 'Broil the corn', body: [], mins: 5, notBefore: { anchor: 'dinner', mins: -40 },
        wait: { id: 'corn', mins: 12, label: 'Corn under the broiler', attended: true, urgent: true, laps: [3, 6, 9], lapLabel: 'Turn the corn' } },
      { id: 'table', dish: 'day', block: 'final', where: 'hers', title: 'Set the table', body: [], mins: 5, notBefore: { anchor: 'dinner', mins: -40 } },
      { id: 'corn-out', dish: 'corn', block: 'final', where: 'hers', title: 'Take the corn out', body: [], mins: 3, after: ['corn-broil'], afterWait: 'corn' },
      { id: 'dinner', dish: 'day', block: 'final', where: 'hers', title: 'Dinner', body: ['Sit down.'], mins: 0,
        after: ['corn-out', 'fish-drain', 'table'], notBefore: { anchor: 'dinner', mins: 0 } }
    ],
    pack: {
      cooler: [
        { id: 'fish', label: 'Fish', note: 'On the ice packs' },
        { id: 'beans', label: 'Beans', ifDone: 'beans-start' },
        { id: 'limejar', label: 'Jar of lime juice', ifDone: 'lime-juice' },
        { id: 'limes', label: 'Whole limes', ifNotDone: 'lime-juice' },
        { id: 'beanpot', label: 'Bean pot, still warm', when: { beansLater: true } }
      ],
      bag: [{ id: 'chips', label: 'Chips' }, { id: 'salt', label: 'Salt' }],
      gear: [{ id: 'knife', label: 'Sharp knife' }]
    },
    containers: { home: [{ name: 'Onion jar', size: '1 pint', holds: 'Pink onions' }], hers: [] }
  };
}

const PLAN = deepFreeze(fixture());
const fresh = (now = H(6, 55)) => E.initialState(PLAN, 'test', now);
// Apply complete() for [id, time, payload?] triples.
function run(state, list, plan = PLAN) {
  for (const [id, at, payload] of list) state = E.complete(plan, state, id, at, payload);
  return state;
}
// Follow the engine's own projection, completing each projected step at its projected end, until `until` (exclusive).
function replay(state, now, until, plan = PLAN) {
  const p = E.project(plan, state, now);
  for (const r of p.rows) {
    if (r.type !== 'step' && r.type !== 'move') continue;
    if (r.status === 'done') continue;
    if (r.stepId === until) break;
    state = E.complete(plan, state, r.stepId, r.type === 'move' ? r.at : r.end,
      r.stepId === 'soak-q' ? { value: true } : undefined);
  }
  return state;
}
const stepRows = (p) => p.rows.filter((r) => r.type === 'step');
const codes = (p) => p.warnings.map((w) => w.code);
const rowKey = (r) => (r.type === 'move' ? r.at : r.start);

// ---------------------------------------------------------------- initialState / setDay / time

test('initialState: before 16:00 local the cook day is today', () => {
  const s = E.initialState(PLAN, 'phone', H(15, 59));
  assert.equal(s.day, '2026-11-23');
  assert.equal(s.device, 'phone');
  assert.equal(s.rev, 0);
  assert.equal(s.updatedAt, 0);
  assert.equal(s.v, 1);
  assert.equal(s.fg, null);
  assert.deepEqual(s.anchors, PLAN.anchors);
  assert.notEqual(s.anchors, PLAN.anchors);
  for (const k of ['opts', 'done', 'skipped', 'waits', 'laps', 'ticks', 'tonight']) assert.deepEqual(s[k], {});
});

test('initialState: from 16:00 local the cook day is tomorrow (also across a month end)', () => {
  assert.equal(E.initialState(PLAN, '', H(16, 0)).day, '2026-11-24');
  assert.equal(E.initialState(PLAN, '', H(23, 30)).day, '2026-11-24');
  assert.equal(E.initialState(PLAN, '', new Date(2026, 10, 30, 20, 0).getTime()).day, '2026-12-01');
  assert.equal(E.initialState(PLAN, '', new Date(2026, 11, 31, 18, 0).getTime()).day, '2027-01-01');
  assert.equal(E.initialState(PLAN, '', new Date(2026, 10, 30, 9, 0).getTime()).day, '2026-11-30');
});

test('dayMs / anchorMs are local wall-clock times of the cook day', () => {
  const s = fresh();
  assert.equal(E.dayMs(s), H(0));
  assert.equal(E.anchorMs(s, 'start'), H(7));
  assert.equal(E.anchorMs(s, 'dinner'), H(19, 30));
  assert.ok(Number.isNaN(E.anchorMs(s, 'nope')));
  assert.ok(Number.isNaN(E.dayMs({ day: 'garbage' })));
});

test('setDay changes the day and refuses bad dates', () => {
  const s = fresh();
  const t = E.setDay(PLAN, s, '2026-11-24', 5);
  assert.equal(t.day, '2026-11-24');
  assert.equal(t.rev, 1);
  assert.equal(t.updatedAt, 5);
  assert.equal(E.anchorMs(t, 'start'), H(7) + 24 * 60 * MIN);
  assert.equal(E.setDay(PLAN, s, '2026-02-30', 5), s);
  assert.equal(E.setDay(PLAN, s, 'tomorrow', 5), s);
  assert.equal(E.setDay(PLAN, s, s.day, 5), s);
});

// ---------------------------------------------------------------- validate

test('validate: the fixture has no problems', () => {
  assert.deepEqual(E.validate(PLAN), []);
});

const step = (plan, id) => plan.steps.find((s) => s.id === id);
const BAD = [
  ['duplicate step id', (p) => { step(p, 'sauce').id = 'lime-juice'; }, /"lime-juice" is used twice/],
  ['after names a missing step', (p) => { step(p, 'onion-dunk').after = ['nope']; }, /"after" names "nope"/],
  ['afterWait that no step arms', (p) => { step(p, 'onion-jar').afterWait = 'nowait'; }, /"afterWait" names wait "nowait"/],
  ['pack item ifDone names a missing step', (p) => { p.pack.cooler[1].ifDone = 'ghost'; }, /"ifDone" names "ghost"/],
  ['pack item ifNotDone names a missing step', (p) => { p.pack.cooler[3].ifNotDone = 'ghost'; }, /"ifNotDone" names "ghost"/],
  ['rule on names a missing step', (p) => { p.rules[0].on = 'ghost'; }, /Rule #1: "on" names "ghost"/],
  ['rule ifDone names a missing step', (p) => { p.rules[1].ifDone = 'ghost'; }, /Rule #2: "ifDone" names "ghost"/],
  ['rule ifNotDone names a missing step', (p) => { p.rules[0].ifNotDone = 'ghost'; }, /Rule #1: "ifNotDone" names "ghost"/],
  ['dep later in the master order', (p) => { step(p, 'onion-slice').after = ['sauce']; }, /needs "sauce", which must come earlier/],
  ['wait armed later in the master order', (p) => { step(p, 'onion-slice').afterWait = 'bacon'; }, /starts that wait later/],
  ['glossary key missing (plain)', (p) => { step(p, 'sauce').body = ['Now [[whisk]] it.']; }, /\[\[whisk\]\]/],
  ['glossary key missing (with shown text)', (p) => { step(p, 'sauce').tip = 'Keep it [[cold|very cold]].'; }, /\[\[cold\]\]/],
  ['glossary key missing in tonight', (p) => { p.tonight[0].body = ['[[thaw]] the fish.']; }, /Tonight list.*\[\[thaw\]\]/],
  ['two tonight items share an id', (p) => { p.tonight[1].id = 'order'; }, /Tonight item #2: id "order" is used twice/],
  ['a tonight item without an id', (p) => { delete p.tonight[0].id; }, /Tonight item #1 has no id/],
  ['unknown dish', (p) => { step(p, 'sauce').dish = 'soup'; }, /dish "soup" does not exist/],
  ['notBefore names a missing anchor', (p) => { step(p, 'table').notBefore = { anchor: 'lunch', mins: 0 }; }, /"notBefore" names anchor "lunch"/],
  ['withinMinsOf names a missing anchor', (p) => { step(p, 'beans-check').check.giveUp.withinMinsOf.anchor = 'lunch'; }, /"withinMinsOf" names anchor "lunch"/],
  ['a move name with no step', (p) => { p.steps = p.steps.filter((s) => s.id !== 'back-home'); }, /exactly one move step for "backHome" \(found 0\)/],
  ['a move name with two steps', (p) => { step(p, 'back-home').move = 'leaveAm'; }, /exactly one move step for "leaveAm" \(found 2\)/],
  ['last step is not dinner', (p) => { p.steps.push({ id: 'dishes', dish: 'day', block: 'final', where: 'hers', title: 'Wash up', body: [], mins: 5 }); }, /last step must have id "dinner"/]
];
for (const [name, mutate, re] of BAD) {
  test('validate catches: ' + name, () => {
    const p = fixture();
    mutate(p);
    const problems = E.validate(p);
    assert.ok(problems.some((m) => re.test(m)), 'expected a problem matching ' + re + ', got ' + JSON.stringify(problems));
  });
}

test('validate: a dep may come later when the two steps can never be active together', () => {
  const p = fixture();
  // beans-quick (soaked:false) placed after a step that only exists when soaked:true
  p.steps.splice(1, 0, { id: 'beans-rinse', dish: 'beans', block: 'am', where: 'home', title: 'Rinse', body: [], mins: 1, when: { soaked: true }, after: ['beans-quick'] });
  assert.deepEqual(E.validate(p), []);
  delete step(p, 'beans-rinse').when;
  assert.ok(E.validate(p).some((m) => /needs "beans-quick", which must come earlier/.test(m)));
});

test('validate: survives junk', () => {
  assert.ok(E.validate(null).length > 0);
  assert.ok(E.validate({}).length > 0);
  assert.ok(E.validate({ steps: [null, 5, {}] }).length > 0);
});

// ---------------------------------------------------------------- places and status

const AM_ALL = ['soak-q', 'beans-start', 'onion-slice', 'onion-dunk', 'onion-jar', 'bacon-fry', 'lime-juice', 'sauce',
  'garnish', 'bacon-out', 'beans-check', 'beans-off', 'pack-bag'];
// Every morning step except `skip`, all marked done at `at`.
const morningDone = (skip = [], at = H(7)) =>
  run(fresh(), AM_ALL.filter((id) => !skip.includes(id)).map((id) => [id, at, id === 'soak-q' ? { value: true } : undefined]));
const types = (list) => list.map((b) => b.type);

test('location follows the move steps', () => {
  let s = fresh();
  assert.equal(E.location(PLAN, s), 'home-am');
  s = E.complete(PLAN, s, 'leave-am', H(11));
  assert.equal(E.location(PLAN, s), 'away');
  s = E.complete(PLAN, s, 'back-home', H(14));
  assert.equal(E.location(PLAN, s), 'home-pm');
  s = E.complete(PLAN, s, 'leave-pm', H(14, 30));
  assert.equal(E.location(PLAN, s), 'drive');
  s = E.complete(PLAN, s, 'arrive', H(15));
  assert.equal(E.location(PLAN, s), 'hers');
});

test('place gate: home, hers, either and the four moves', () => {
  let s = fresh();
  const at = (id) => E.blockers(PLAN, s, id, H(20)).filter((b) => b.type === 'place');
  // morning at his place
  assert.deepEqual(at('unpack'), [{ type: 'place', where: 'hers' }]);
  assert.deepEqual(at('lime-juice'), []);
  assert.deepEqual(at('soak-q'), []);
  assert.deepEqual(at('leave-am'), []);
  assert.deepEqual(at('arrive'), [{ type: 'place', where: 'drive' }]);
  assert.deepEqual(at('back-home'), [{ type: 'place', where: 'away' }]);
  // out
  s = E.complete(PLAN, s, 'leave-am', H(11));
  assert.deepEqual(at('lime-juice'), [{ type: 'place', where: 'either' }]);
  assert.deepEqual(at('soak-q'), [{ type: 'place', where: 'home' }]);
  assert.deepEqual(at('back-home'), []);
  // pack-up stop: home steps yes, 'either' steps no
  s = E.complete(PLAN, s, 'back-home', H(14));
  assert.deepEqual(at('load-cooler'), []);
  assert.deepEqual(at('lime-juice'), [{ type: 'place', where: 'either' }]);
  assert.deepEqual(at('leave-pm'), []);
  assert.deepEqual(at('arrive'), [{ type: 'place', where: 'drive' }]);
  assert.deepEqual(at('leave-am'), [], 'a done step has no blockers');
  // driving
  s = E.complete(PLAN, s, 'leave-pm', H(14, 30));
  assert.deepEqual(at('unpack'), [{ type: 'place', where: 'hers' }]);
  assert.deepEqual(at('arrive'), []);
  // her kitchen
  s = E.complete(PLAN, s, 'arrive', H(15));
  assert.deepEqual(at('unpack'), []);
  assert.deepEqual(at('lime-juice'), []);
  assert.equal(E.isAvailable(PLAN, s, 'lime-juice', H(15)), true);
  assert.equal(E.isAvailable(PLAN, s, 'unpack', H(15)), true);
});

test('opt / isActive / isDone', () => {
  let s = fresh();
  assert.equal(E.opt(PLAN, s, 'soaked'), true);
  assert.equal(E.opt(PLAN, s, 'unknown'), undefined);
  assert.equal(E.isActive(PLAN, s, 'beans-quick'), false);
  assert.equal(E.isActive(PLAN, s, step(PLAN, 'beans-start')), true);
  assert.equal(E.isDone(PLAN, s, 'soak-q'), false);
  s = E.setOpt(PLAN, s, 'soaked', false, H(7));
  assert.equal(E.opt(PLAN, s, 'soaked'), false);
  assert.equal(E.isActive(PLAN, s, 'beans-quick'), true);
  assert.equal(E.isDone(PLAN, s, 'soak-q'), true, 'a choice counts as done once its option is answered anywhere');
  s = E.skip(PLAN, s, 'beans-quick', H(7));
  assert.equal(E.isActive(PLAN, s, 'beans-quick'), false);
  assert.equal(E.isDone(PLAN, E.complete(PLAN, fresh(), 'sauce', H(8)), 'sauce'), true);
  assert.equal(E.isDone(PLAN, s, 'nope'), false);
  assert.equal(E.isActive(PLAN, s, 'nope'), false);
  assert.equal(E.stepById(PLAN, 'sauce').title, 'Make the sauce');
  assert.equal(E.stepById(PLAN, 'nope'), null);
});

test('after gate: blocked until the dep is done, skipped or inactive', () => {
  let s = fresh();
  assert.deepEqual(E.blockers(PLAN, s, 'onion-dunk', H(7)), [{ type: 'after', stepId: 'onion-slice' }]);
  assert.equal(E.isAvailable(PLAN, s, 'onion-dunk', H(7)), false);
  assert.equal(E.isAvailable(PLAN, E.complete(PLAN, s, 'onion-slice', H(7)), 'onion-dunk', H(7)), true);
  assert.equal(E.isAvailable(PLAN, E.skip(PLAN, s, 'onion-slice', H(7)), 'onion-dunk', H(7)), true);
  // beans-off needs beans-check; with beansLater the check does not exist, so the dep is met
  assert.deepEqual(types(E.blockers(PLAN, s, 'beans-off', H(7))), ['after']);
  s = E.setOpt(PLAN, s, 'beansLater', true, H(7));
  assert.deepEqual(E.blockers(PLAN, s, 'beans-off', H(7)), []);
  assert.equal(E.isAvailable(PLAN, s, 'beans-off', H(7)), true);
});

test('wait gate: closed until armed and elapsed', () => {
  let s = run(fresh(), [['onion-slice', H(7)]]);
  assert.deepEqual(E.blockers(PLAN, s, 'onion-jar', H(7)), [{ type: 'after', stepId: 'onion-dunk' }, { type: 'wait', waitId: 'steep', endsAt: null }]);
  s = E.complete(PLAN, s, 'onion-dunk', H(7, 10));
  assert.deepEqual(E.blockers(PLAN, s, 'onion-jar', H(7, 39)), [{ type: 'wait', waitId: 'steep', endsAt: H(7, 40) }]);
  assert.equal(E.isAvailable(PLAN, s, 'onion-jar', H(7, 39, 59)), false);
  assert.equal(E.isAvailable(PLAN, s, 'onion-jar', H(7, 40)), true);
  assert.deepEqual(E.blockers(PLAN, s, 'onion-jar', H(7, 40)), []);
});

test('wait gate: open when the step that would arm it is inactive or skipped', () => {
  // soaked (default): beans-quick does not exist, so its wait cannot hold beans-start back
  let s = run(fresh(), [['soak-q', H(7), { value: true }]]);
  assert.equal(E.isAvailable(PLAN, s, 'beans-start', H(7, 1)), true);
  // not soaked: the quick soak must run first
  s = run(fresh(), [['soak-q', H(7), { value: false }]]);
  assert.deepEqual(E.blockers(PLAN, s, 'beans-start', H(7, 1)), [{ type: 'wait', waitId: 'quicksoak', endsAt: null }]);
  const soaking = E.complete(PLAN, s, 'beans-quick', H(7, 5));
  assert.equal(E.isAvailable(PLAN, soaking, 'beans-start', H(8, 4)), false);
  assert.equal(E.isAvailable(PLAN, soaking, 'beans-start', H(8, 5)), true);
  // skipped arming step
  assert.equal(E.isAvailable(PLAN, E.skip(PLAN, s, 'beans-quick', H(7, 2)), 'beans-start', H(7, 2)), true);
});

test('wait gate: never a dead end, and one wait may be armed by either of two variant steps', () => {
  // a saved state that lost its timer record: the arming step is done, so nothing can ever start the timer again
  let s = run(fresh(), [['onion-slice', H(7)], ['onion-dunk', H(7, 10)]]);
  s = Object.assign({}, s, { waits: {} });
  assert.equal(E.isAvailable(PLAN, s, 'onion-jar', H(7, 11)), true);
  // two variants arm the same wait id with different lengths
  const p = fixture();
  step(p, 'beans-quick').wait = { id: 'beans', mins: 90, label: 'Beans simmering (long)', attended: true };
  step(p, 'beans-quick').after = ['soak-q'];
  step(p, 'beans-start').when = { soaked: true };
  delete step(p, 'beans-start').afterWait;
  assert.deepEqual(E.validate(p), []);
  let v = run(E.initialState(p, 't', H(6)), [['soak-q', H(7), { value: false }]], p);
  assert.deepEqual(E.blockers(p, v, 'beans-check', H(7, 1)), [{ type: 'wait', waitId: 'beans', endsAt: null }]);
  v = E.complete(p, v, 'beans-quick', H(7, 5));
  assert.deepEqual(E.blockers(p, v, 'beans-check', H(7, 6)), [{ type: 'wait', waitId: 'beans', endsAt: H(8, 35) }]);
  assert.equal(E.waitsView(p, v, H(7, 6))[0].label, 'Beans simmering (long)', 'label of the step that really started it');
  assert.deepEqual(E.waitsView(p, v, H(7, 6))[0].laps, []);
});

test('time gate: notBefore is relative to the (editable) dinner anchor', () => {
  let s = replay(fresh(), H(6, 55), 'corn-broil');
  assert.equal(E.location(PLAN, s), 'hers');
  assert.deepEqual(E.blockers(PLAN, s, 'corn-broil', H(18, 49)), [{ type: 'time', at: H(18, 50) }]);
  assert.equal(E.isAvailable(PLAN, s, 'corn-broil', H(18, 49)), false);
  assert.equal(E.isAvailable(PLAN, s, 'corn-broil', H(18, 50)), true);
  s = E.setAnchor(PLAN, s, 'dinner', 1200, H(16));          // dinner moved to 8:00 PM
  assert.deepEqual(E.blockers(PLAN, s, 'corn-broil', H(18, 50)), [{ type: 'time', at: H(19, 20) }]);
});

test('blockers: nothing for done, inactive or unknown steps', () => {
  const s = E.complete(PLAN, fresh(), 'onion-slice', H(7));
  assert.deepEqual(E.blockers(PLAN, s, 'onion-slice', H(7)), []);
  assert.deepEqual(E.blockers(PLAN, s, 'beans-quick', H(7)), []);
  assert.deepEqual(E.blockers(PLAN, s, 'nope', H(7)), []);
  assert.equal(E.isAvailable(PLAN, s, 'onion-slice', H(7)), false);
  assert.equal(E.isAvailable(PLAN, s, 'beans-quick', H(7)), false);
  assert.equal(E.isAvailable(PLAN, s, 'nope', H(7)), false);
});

// ---------------------------------------------------------------- pick / nextUnlock

test('pick: master order, also before the start anchor', () => {
  let s = fresh();
  assert.equal(E.pick(PLAN, s, H(6, 55)).id, 'soak-q');
  assert.equal(E.nextStep(PLAN, s, H(7)), 'soak-q');
  s = E.complete(PLAN, s, 'soak-q', H(7), { value: true });
  assert.equal(E.nextStep(PLAN, s, H(7, 1)), 'beans-start');
  s = E.complete(PLAN, s, 'beans-start', H(7, 11));
  assert.equal(E.nextStep(PLAN, s, H(7, 11)), 'onion-slice');
});

test('pick: a step whose urgent wait just ended jumps the queue', () => {
  let s = run(fresh(), [['bacon-fry', H(7)]]);
  assert.equal(E.nextStep(PLAN, s, H(7, 9)), 'soak-q');
  assert.equal(E.nextStep(PLAN, s, H(7, 10)), 'bacon-out');
  // a normal (not urgent) wait ending does not jump
  s = run(fresh(), [['onion-slice', H(7)], ['onion-dunk', H(7)]]);
  assert.equal(E.isAvailable(PLAN, s, 'onion-jar', H(7, 31)), true);
  assert.equal(E.nextStep(PLAN, s, H(7, 31)), 'soak-q');
  // no timer ran (the frying was skipped): no alarm, no jump
  s = E.skip(PLAN, fresh(), 'bacon-fry', H(7));
  assert.equal(E.isAvailable(PLAN, s, 'bacon-out', H(7, 1)), true);
  assert.equal(E.nextStep(PLAN, s, H(7, 1)), 'soak-q');
});

test('pick: a move step is proposed only once its anchor time is reached', () => {
  let s = morningDone();
  assert.equal(E.isAvailable(PLAN, s, 'leave-am', H(8)), true);
  assert.equal(E.pick(PLAN, s, H(10, 59)), null);
  assert.equal(E.nextStep(PLAN, s, H(11)), 'leave-am');
  s = E.complete(PLAN, s, 'leave-am', H(11));
  assert.equal(E.pick(PLAN, s, H(13, 59)), null);
  assert.equal(E.nextStep(PLAN, s, H(14)), 'back-home');
  s = run(s, [['back-home', H(14)], ['load-cooler', H(14, 10)], ['load-gear', H(14, 15)]]);
  assert.equal(E.pick(PLAN, s, H(14, 29)), null);
  assert.equal(E.nextStep(PLAN, s, H(14, 30)), 'leave-pm');
  s = E.complete(PLAN, s, 'leave-pm', H(14, 30));
  assert.equal(E.pick(PLAN, s, H(14, 59)), null);
  assert.equal(E.nextStep(PLAN, s, H(15)), 'arrive');
});

test('pick: a move whose deps are not done is not proposed; needed home steps still are', () => {
  const s = fresh();
  assert.equal(E.isAvailable(PLAN, s, 'leave-am', H(11, 5)), false);
  assert.equal(E.nextStep(PLAN, s, H(11, 5)), 'soak-q');
});

test('pick: morning fit rule defers "either" steps and drops optional home steps', () => {
  let s = morningDone(['lime-juice', 'sauce', 'garnish']);
  assert.equal(E.nextStep(PLAN, s, H(10, 39)), 'lime-juice');       // 20 min, ends 10:59
  assert.equal(E.nextStep(PLAN, s, H(10, 40)), 'lime-juice');       // ends exactly at the hard out
  assert.equal(E.nextStep(PLAN, s, H(10, 41)), 'sauce');            // lime juice no longer fits
  assert.equal(E.nextStep(PLAN, s, H(10, 55)), 'sauce');            // 5 min, ends exactly 11:00
  assert.equal(E.nextStep(PLAN, s, H(10, 56)), null);               // nothing fits: lime + sauce deferred, garnish dropped
  s = morningDone(['garnish']);
  assert.equal(E.nextStep(PLAN, s, H(10, 45)), 'garnish');          // optional, fits
  assert.equal(E.nextStep(PLAN, s, H(10, 46)), null);               // optional, does not fit: dropped
});

test('pick: home steps that are not optional, and must steps, are kept even when they do not fit', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }]]);
  assert.equal(E.needMins(step(PLAN, 'beans-start')), 70);          // 10 hands-on + 60 attended
  assert.equal(E.needMins(step(PLAN, 'onion-dunk')), 2.5);          // 2 + 30 s timer; its wait is not attended
  assert.equal(E.stepMins(step(PLAN, 'onion-dunk')), 2.5);
  assert.equal(E.nextStep(PLAN, s, H(10, 58)), 'beans-start');
  const p = fixture();
  step(p, 'lime-juice').must = true;
  s = run(E.initialState(p, 't', H(6)), AM_ALL.filter((id) => id !== 'lime-juice').map((id) => [id, H(7)]), p);
  assert.equal(E.nextStep(p, s, H(10, 56)), 'lime-juice');
});

test('pick: pack-up stop keeps only what fits before leavePm, or must', () => {
  let s = run(morningDone(), [['leave-am', H(11)], ['back-home', H(14)]]);
  assert.equal(E.nextStep(PLAN, s, H(14)), 'load-cooler');
  assert.equal(E.nextStep(PLAN, s, H(14, 27)), 'load-cooler');      // must, although 10 min do not fit
  s = E.complete(PLAN, s, 'load-cooler', H(14, 20));
  assert.equal(E.nextStep(PLAN, s, H(14, 25)), 'load-gear');        // 5 min fits exactly
  assert.equal(E.nextStep(PLAN, s, H(14, 26)), null);               // does not fit, not must: dropped
  assert.equal(E.nextStep(PLAN, s, H(14, 30)), 'leave-pm');
});

test('pick: a step that can wait must leave room for the home-only work still to do', () => {
  // left: sauce ("either", 5 min) and pack-bag (home-only, 10 min). Master order has the sauce first.
  let s = morningDone(['sauce', 'pack-bag']);
  assert.equal(E.nextStep(PLAN, s, H(10, 45)), 'sauce');            // 5 + 10 min end exactly at 11:00
  assert.equal(E.nextStep(PLAN, s, H(10, 46)), 'pack-bag');         // the sauce would push packing past 11:00: it waits
  s = E.complete(PLAN, s, 'pack-bag', H(10, 50));
  assert.equal(E.nextStep(PLAN, s, H(10, 55)), 'sauce');            // room again
  // pack-up stop: the optional garnish may not crowd out the cooler (must) or the gear (home-only)
  s = run(morningDone(['garnish']), [['leave-am', H(11)], ['back-home', H(14)]]);
  assert.equal(E.nextStep(PLAN, s, H(14)), 'garnish');              // 15 + 10 + 5 min end exactly at 2:30
  assert.equal(E.nextStep(PLAN, s, H(14, 1)), 'load-cooler');
  // work that needs a later move ("load the cooler" after coming back) takes no room in the morning
  assert.equal(E.nextStep(PLAN, morningDone(['sauce']), H(10, 55)), 'sauce');
});

test('pick: at a hard out a must step he can do now goes before the move, anything else does not', () => {
  const p = fixture();
  step(p, 'leave-am').after = [];
  step(p, 'leave-pm').after = [];
  const init = E.initialState(p, 't', H(6));
  // morning: beans-off (must) and pack-bag (home-only, not must) still open at 11:00
  let s = run(init, AM_ALL.filter((id) => id !== 'beans-off' && id !== 'pack-bag').map((id) => [id, H(7)]), p);
  assert.equal(E.nextStep(p, s, H(10, 59)), 'beans-off');
  assert.equal(E.nextStep(p, s, H(11)), 'beans-off');
  s = E.complete(p, s, 'beans-off', H(11, 2));
  assert.equal(E.nextStep(p, s, H(11, 2)), 'leave-am', 'pack-bag is not a must: time to go');
  // pack-up: the cooler (must) holds the move, the gear (not must) does not
  s = run(s, [['leave-am', H(11, 2)], ['back-home', H(14, 25)]], p);
  assert.equal(E.nextStep(p, s, H(14, 31)), 'load-cooler');
  s = E.complete(p, s, 'load-cooler', H(14, 41));
  assert.equal(E.nextStep(p, s, H(14, 41)), 'leave-pm');
  // and the projection says the same: late out, late in, nothing must-do dropped
  const proj = E.project(p, run(init, AM_ALL.map((id) => [id, H(7)]).concat([['leave-am', H(11)], ['back-home', H(14, 25)]]), p), H(14, 25));
  assert.deepEqual(span(proj, 'load-cooler'), [H(14, 25), H(14, 35)]);
  assert.equal(proj.byStep['leave-pm'].start, H(14, 35));
  assert.equal(proj.byStep.arrive.start, H(15, 5));
  assert.equal(stepRows(proj).find((r) => r.stepId === 'load-cooler').late, true);
  assert.deepEqual(warning(proj, 'missed').stepIds, ['load-gear']);
});

test('pick: a ringing urgent timer is never deferred, dropped, or left behind', () => {
  const p = fixture();
  step(p, 'bacon-fry').where = 'either';
  step(p, 'bacon-out').where = 'either';              // now a step the fit rule could send to her kitchen
  const init = E.initialState(p, 't', H(6));
  // only bacon-out (2 min) and pack-bag (home-only, 10 min) are open; the bacon timer ends 10:59
  let s = run(init, AM_ALL.filter((id) => !['bacon-fry', 'bacon-out', 'pack-bag'].includes(id)).map((id) => [id, H(7)]).concat([['bacon-fry', H(10, 49)]]), p);
  assert.equal(E.nextStep(p, s, H(10, 58)), 'pack-bag');
  assert.equal(E.nextStep(p, s, H(10, 59)), 'bacon-out', 'does not fit before 11:00, but the pan is hot');
  assert.deepEqual(E.nextUnlock(p, s, H(10, 58)), { at: H(10, 59), stepId: 'bacon-out', reason: 'wait' });
  s = E.complete(p, s, 'pack-bag', H(10, 59));
  assert.equal(E.nextStep(p, s, H(11, 1)), 'bacon-out', 'before "time to go"');
  assert.equal(E.nextStep(p, E.complete(p, s, 'bacon-out', H(11, 2)), H(11, 2)), 'leave-am');
  // the projection keeps it in his kitchen too
  const proj = E.project(p, s, H(10, 59));
  assert.deepEqual([proj.byStep['bacon-out'].loc, proj.byStep['bacon-out'].start], ['home-am', H(10, 59)]);
  assert.equal(proj.byStep['leave-am'].start, H(11, 1));
});

test('nextUnlock: at the same moment it names what pick would return', () => {
  // the (urgent) bacon timer ends exactly at 11:00, the moment to leave: the alarm goes first
  let s = run(morningDone(['bacon-fry', 'bacon-out']), [['bacon-fry', H(10, 50)]]);
  assert.equal(E.pick(PLAN, s, H(10, 55)), null);
  assert.deepEqual(E.nextUnlock(PLAN, s, H(10, 55)), { at: H(11), stepId: 'bacon-out', reason: 'wait' });
  assert.equal(E.nextStep(PLAN, s, H(11)), 'bacon-out');
  // a quiet timer ending at 11:00 on a step that is not a must: the move goes first
  const p = fixture();
  step(p, 'leave-am').after = [];
  s = run(E.initialState(p, 't', H(6)), AM_ALL.filter((id) => !['beans-start', 'beans-check', 'beans-off'].includes(id)).map((id) => [id, H(7)]).concat([['beans-start', H(10)]]), p);
  assert.equal(E.pick(p, s, H(10, 55)), null);
  assert.deepEqual(E.nextUnlock(p, s, H(10, 55)), { at: H(11), stepId: 'leave-am', reason: 'move' });
  assert.equal(E.nextStep(p, s, H(11)), 'leave-am');
});

test('nextUnlock: wait ending, notBefore time, move anchor, or null', () => {
  assert.equal(E.nextUnlock(PLAN, fresh(), H(7)), null);
  let s = run(fresh(), [['onion-slice', H(7)], ['onion-dunk', H(7)]]);
  assert.deepEqual(E.nextUnlock(PLAN, s, H(7, 5)), { at: H(7, 30), stepId: 'onion-jar', reason: 'wait' });
  assert.equal(E.nextUnlock(PLAN, s, H(7, 30)), null, 'already available is not a future unlock');
  s = morningDone();
  assert.deepEqual(E.nextUnlock(PLAN, s, H(8, 30)), { at: H(11), stepId: 'leave-am', reason: 'move' });
  assert.equal(E.nextUnlock(PLAN, s, H(11)), null);
  s = E.complete(PLAN, s, 'leave-am', H(11));
  assert.deepEqual(E.nextUnlock(PLAN, s, H(12)), { at: H(14), stepId: 'back-home', reason: 'move' });
  s = replay(fresh(), H(6, 55), 'corn-broil');
  assert.deepEqual(E.nextUnlock(PLAN, s, H(16)), { at: H(18, 50), stepId: 'corn-broil', reason: 'time' });
});

test('nextUnlock: ignores a step that would be deferred by the time it unlocks', () => {
  // onions dunked at 10:40: the 30 min steep ends 11:10, after the hard out
  const s = run(morningDone(['onion-dunk', 'onion-jar']), [['onion-dunk', H(10, 40)]]);
  assert.equal(E.pick(PLAN, s, H(10, 45)), null);
  assert.deepEqual(E.nextUnlock(PLAN, s, H(10, 45)), { at: H(11), stepId: 'leave-am', reason: 'move' });
});

// ---------------------------------------------------------------- reducers

function richState() {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(7, 11)], ['onion-slice', H(7, 21)], ['onion-dunk', H(7, 24)]]);
  s = E.tick(PLAN, s, 'pack-bag', 'chips', true, H(7, 25));
  s = E.tickTonight(PLAN, s, 'order', true, H(7, 25));
  s = E.startFg(PLAN, s, 'bacon-fry', H(7, 30), H(7, 26));
  s = E.ackLap(PLAN, s, 'beans', 1, H(7, 32));
  return s;
}
const T = H(7, 40);
const REDUCERS = [
  ['complete', (s) => E.complete(PLAN, s, 'bacon-fry', T)],
  ['complete (choice)', (s) => E.complete(PLAN, E.uncomplete(PLAN, s, 'soak-q', T - 1), 'soak-q', T, { value: false }), 2],
  ['complete (leavePm)', (s) => E.complete(PLAN, s, 'leave-pm', T)],
  ['uncomplete', (s) => E.uncomplete(PLAN, s, 'beans-start', T)],
  ['skip', (s) => E.skip(PLAN, s, 'garnish', T)],
  ['retry', (s) => E.retry(PLAN, s, 'beans-check', T)],
  ['giveUp', (s) => E.giveUp(PLAN, s, 'beans-check', T)],
  ['ackLap', (s) => E.ackLap(PLAN, s, 'beans', 2, T)],
  ['tick on', (s) => E.tick(PLAN, s, 'pack-bag', 'salt', true, T)],
  ['tick off', (s) => E.tick(PLAN, s, 'pack-bag', 'chips', false, T)],
  ['tickTonight', (s) => E.tickTonight(PLAN, s, 'soak', true, T)],
  ['setOpt', (s) => E.setOpt(PLAN, s, 'soaked', false, T)],
  ['setAnchor', (s) => E.setAnchor(PLAN, s, 'dinner', 1185, T)],
  ['startFg', (s) => E.startFg(PLAN, s, 'sauce', T + 30000, T)],
  ['clearFg', (s) => E.clearFg(PLAN, s, T)],
  ['setDay', (s) => E.setDay(PLAN, s, '2026-11-24', T)]
];
for (const [name, fn, revs = 1] of REDUCERS) {
  test('reducer is pure, bumps rev and updatedAt: ' + name, () => {
    const s = deepFreeze(richState());
    const before = clone(s);
    const out = fn(s);
    assert.notEqual(out, s);
    assert.equal(out.rev, s.rev + revs);
    assert.equal(out.updatedAt, T);
    assert.equal(out.device, 'test');
    assert.deepEqual(s, before, 'the input state must not change');
  });
}

test('queries do not touch a frozen state or plan', () => {
  const s = deepFreeze(richState());
  const before = clone(s);
  E.pick(PLAN, s, T); E.nextStep(PLAN, s, T); E.nextUnlock(PLAN, s, T); E.waitsView(PLAN, s, T); E.alerts(PLAN, s, T);
  E.project(PLAN, s, T); E.packList(PLAN, s, 'cooler'); E.checklistItems(PLAN, s, 'load-gear'); E.progress(PLAN, s);
  E.dishProgress(PLAN, s, 'beans'); E.blockers(PLAN, s, 'onion-jar', T); E.location(PLAN, s); E.validate(PLAN);
  assert.deepEqual(s, before);
});

test('reducers return the same state object when there is nothing to do', () => {
  const s = richState();
  assert.equal(E.complete(PLAN, s, 'nope', T), s);
  assert.equal(E.complete(PLAN, s, 'beans-start', T), s, 'already done: the timer must not restart');
  assert.equal(E.uncomplete(PLAN, s, 'nope', T), s);
  assert.equal(E.uncomplete(PLAN, s, 'sauce', T), s);
  assert.equal(E.skip(PLAN, s, 'nope', T), s);
  assert.equal(E.skip(PLAN, s, 'beans-start', T), s, 'a done step cannot be skipped');
  assert.equal(E.retry(PLAN, s, 'nope', T), s);
  assert.equal(E.retry(PLAN, s, 'sauce', T), s);
  assert.equal(E.giveUp(PLAN, s, 'nope', T), s);
  assert.equal(E.giveUp(PLAN, s, 'sauce', T), s);
  assert.equal(E.ackLap(PLAN, s, 'nope', 1, T), s);
  assert.equal(E.ackLap(PLAN, s, 'beans', 1, T), s);
  assert.equal(E.tick(PLAN, s, 'nope', 'chips', true, T), s);
  assert.equal(E.tick(PLAN, s, 'pack-bag', 'chips', true, T), s);
  assert.equal(E.tick(PLAN, s, 'pack-bag', 'salt', false, T), s);
  assert.equal(E.tickTonight(PLAN, s, 'nope', true, T), s);
  assert.equal(E.tickTonight(PLAN, s, 'order', true, T), s);
  assert.equal(E.setOpt(PLAN, s, 'soaked', true, T), s);
  assert.equal(E.setOpt(PLAN, s, 'beansLater', undefined, T), s);
  assert.equal(E.setAnchor(PLAN, s, 'nope', 600, T), s);
  assert.equal(E.setAnchor(PLAN, s, 'dinner', NaN, T), s);
  assert.equal(E.setAnchor(PLAN, s, 'dinner', 1170, T), s);
  assert.equal(E.startFg(PLAN, s, 'nope', T, T), s);
  assert.equal(E.clearFg(PLAN, E.clearFg(PLAN, s, T), T + 1).rev, s.rev + 1);
});

test('complete: done time, wait armed, laps reset, fg cleared, skip undone', () => {
  let s = richState();
  assert.equal(s.done['beans-start'], H(7, 11));
  assert.deepEqual(s.waits.beans, { start: H(7, 11), mins: 60, by: 'beans-start' });
  assert.equal(s.laps.beans, 1);
  assert.deepEqual(s.fg, { stepId: 'bacon-fry', endsAt: H(7, 30) });
  const other = E.complete(PLAN, s, 'sauce', T);
  assert.deepEqual(other.fg, s.fg, 'another step leaves the foreground timer alone');
  s = E.complete(PLAN, s, 'bacon-fry', T);
  assert.equal(s.fg, null);
  assert.deepEqual(s.waits.bacon, { start: T, mins: 10, by: 'bacon-fry' });
  assert.equal(s.laps.bacon, 0);
  s = E.skip(PLAN, s, 'garnish', T);
  assert.equal(s.skipped.garnish, true);
  s = E.complete(PLAN, s, 'garnish', T + 1);
  assert.equal('garnish' in s.skipped, false);
  assert.equal(E.isDone(PLAN, s, 'garnish'), true);
});

test('complete: choice payload sets the option; without payload the default stays', () => {
  const no = E.complete(PLAN, fresh(), 'soak-q', H(7), { value: false });
  assert.equal(no.opts.soaked, false);
  assert.equal(E.isActive(PLAN, no, 'beans-quick'), true);
  const plain = E.complete(PLAN, fresh(), 'soak-q', H(7));
  assert.equal('soaked' in plain.opts, false);
  assert.equal(E.opt(PLAN, plain, 'soaked'), true);
  assert.equal(E.isDone(PLAN, plain, 'soak-q'), true);
});

test('rules run on complete, against the new state', () => {
  // leaving with the bean check not done: the beans finish later
  let s = E.complete(PLAN, fresh(), 'leave-am', H(11));
  assert.equal(E.opt(PLAN, s, 'beansLater'), true);
  assert.equal(E.isActive(PLAN, s, 'beans-finish'), true);
  assert.equal(E.isActive(PLAN, s, 'beans-check'), false);
  // leaving with it done: no change
  s = E.complete(PLAN, morningDone(), 'leave-am', H(11));
  assert.equal(E.opt(PLAN, s, 'beansLater'), false);
  assert.equal('beansLater' in s.opts, false);
  // ifDone
  const lime = run(morningDone(), [['leave-am', H(11)], ['back-home', H(14)], ['leave-pm', H(14, 30)], ['arrive', H(15)]]);
  assert.equal(E.opt(PLAN, lime, 'limeReady'), true);
  const noLime = run(morningDone(['lime-juice']), [['leave-am', H(11)], ['back-home', H(14)], ['leave-pm', H(14, 30)], ['arrive', H(15)]]);
  assert.equal(E.opt(PLAN, noLime, 'limeReady'), false);
  // a rule that only applies when its own step is the one that was just completed
  const p = fixture();
  p.rules.push({ on: 'sauce', ifDone: 'sauce', set: { limeReady: true } }, { on: 'sauce', set: { soaked: false } });
  const r = E.complete(p, E.initialState(p, 't', H(6)), 'sauce', H(7));
  assert.equal(r.opts.limeReady, true);
  assert.equal(r.opts.soaked, false);
});

test('complete leavePm: every not-done home step is skipped, nothing else', () => {
  let s = run(morningDone(['garnish', 'lime-juice']), [['leave-am', H(11)], ['back-home', H(14)], ['load-cooler', H(14, 10)]]);
  s = E.complete(PLAN, s, 'leave-pm', H(14, 30));
  assert.equal(s.skipped['load-gear'], true);
  assert.equal(s.skipped.garnish, true);
  assert.equal(s.skipped['beans-quick'], true);
  for (const id of ['load-cooler', 'leave-pm', 'soak-q', 'beans-start', 'lime-juice', 'unpack', 'dinner', 'arrive']) {
    assert.equal(id in s.skipped, false, id + ' must not be skipped');
  }
  // a skipped dep does not block her kitchen
  s = E.complete(PLAN, s, 'arrive', H(15));
  assert.equal(E.nextStep(PLAN, s, H(15)), 'lime-juice');
});

test('uncomplete removes done, the wait it armed, and a choice answer', () => {
  let s = richState();
  s = E.uncomplete(PLAN, s, 'beans-start', T);
  assert.equal('beans-start' in s.done, false);
  assert.equal('beans' in s.waits, false);
  assert.equal('beans' in s.laps, false);
  assert.equal('steep' in s.waits, true);
  s = E.uncomplete(PLAN, s, 'soak-q', T);
  assert.equal('soaked' in s.opts, false);
  assert.equal(E.isDone(PLAN, s, 'soak-q'), false);
});

test('uncomplete of the leavePm move reopens the home steps that leaving wrote off', () => {
  let s = run(morningDone(['garnish']), [['leave-am', H(11)], ['back-home', H(14)]]);
  s = E.skip(PLAN, s, 'unpack', H(14, 1));                           // a skip that has nothing to do with leaving
  s = E.complete(PLAN, s, 'leave-pm', H(14, 5));                     // tapped too early
  assert.equal(s.skipped['load-cooler'], true);
  assert.equal(E.location(PLAN, s), 'drive');
  s = E.uncomplete(PLAN, s, 'leave-pm', H(14, 6));
  assert.equal(E.location(PLAN, s), 'home-pm');
  assert.deepEqual(s.skipped, { unpack: true });
  assert.equal(E.nextStep(PLAN, s, H(14, 6)), 'load-cooler');
});

test('retry re-arms the check timer; giveUp applies its options', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(7, 10)]]);
  s = E.ackLap(PLAN, s, 'beans', 2, H(8));
  assert.equal(E.isAvailable(PLAN, s, 'beans-check', H(8, 10)), true);
  s = E.retry(PLAN, s, 'beans-check', H(8, 12));
  assert.deepEqual(s.waits.beans, { start: H(8, 12), mins: 15, by: 'beans-check' });
  assert.equal(s.laps.beans, 0);
  assert.equal(E.isAvailable(PLAN, s, 'beans-check', H(8, 26)), false);
  assert.equal(E.isAvailable(PLAN, s, 'beans-check', H(8, 27)), true);
  assert.equal(E.isDone(PLAN, s, 'beans-check'), false);
  const view = E.waitsView(PLAN, s, H(8, 20))[0];
  assert.equal(view.by, 'beans-check');
  assert.equal(view.label, 'Beans simmering');
  assert.deepEqual(view.laps, [], 'laps at or past the end of this timer do not apply');
  // give up
  assert.equal(E.canGiveUp(PLAN, s, 'beans-check', H(10, 9)), false);
  assert.equal(E.canGiveUp(PLAN, s, 'beans-check', H(10, 10)), true);
  assert.equal(E.canGiveUp(PLAN, s, step(PLAN, 'beans-check'), H(11, 30)), true);
  assert.equal(E.canGiveUp(PLAN, s, 'sauce', H(10, 30)), false);
  assert.equal(E.canGiveUp(PLAN, s, 'nope', H(10, 30)), false);
  // SPEC 9.2: only while he is in his kitchen in the morning
  let gone = s;
  for (const [id, at, loc] of [['leave-am', H(11), 'away'], ['back-home', H(14), 'home-pm'], ['leave-pm', H(14, 30), 'drive'], ['arrive', H(15), 'hers']]) {
    gone = E.complete(PLAN, gone, id, at);
    assert.equal(E.location(PLAN, gone), loc);
    assert.equal(E.canGiveUp(PLAN, gone, 'beans-check', at + MIN), false, 'no give-up button in ' + loc);
  }
  s = E.giveUp(PLAN, s, 'beans-check', H(10, 15));
  assert.equal(E.giveUp(PLAN, s, 'beans-check', H(10, 16)), s, 'giving up twice changes nothing');
  assert.equal(s.opts.beansLater, true);
  assert.equal(E.isActive(PLAN, s, 'beans-check'), false);
  assert.equal(E.isAvailable(PLAN, s, 'beans-off', H(10, 15)), true);
});

test('ackLap, tick, tickTonight, setOpt, fg', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(7, 10)]]);
  assert.equal(E.ackLap(PLAN, s, 'beans', undefined, T).laps.beans, 1);
  assert.equal(E.ackLap(PLAN, s, 'beans', 2, T).laps.beans, 2);
  assert.equal(E.ackLap(PLAN, E.ackLap(PLAN, s, 'beans', 2, T), 'beans', 1, T + 1).laps.beans, 2);
  s = E.tick(PLAN, s, 'load-cooler', 'fish', true, T);
  s = E.tick(PLAN, s, 'load-cooler', 'limes', true, T);
  assert.deepEqual(s.ticks, { 'load-cooler': { fish: true, limes: true } });
  s = E.tick(PLAN, s, 'load-cooler', 'fish', false, T);
  assert.deepEqual(s.ticks, { 'load-cooler': { limes: true } });
  // tonight: ticking "soak" answers the soak question
  let n = fresh();
  assert.equal(E.isDone(PLAN, n, 'soak-q'), false);
  n = E.tickTonight(PLAN, n, 'soak', true, T);
  assert.deepEqual(n.tonight, { soak: true });
  assert.equal(n.opts.soaked, true);
  assert.equal(E.isDone(PLAN, n, 'soak-q'), true);
  n = E.tickTonight(PLAN, n, 'soak', false, T);
  assert.deepEqual(n.tonight, {});
  assert.equal('soaked' in n.opts, false, 'unticking takes back what the tick decided');
  assert.equal(E.isDone(PLAN, n, 'soak-q'), false, 'so the question is asked again in the morning');
  // ... unless he answered the question himself in the meantime
  let own = E.complete(PLAN, fresh(), 'soak-q', T, { value: true });
  own = E.tickTonight(PLAN, E.tickTonight(PLAN, own, 'soak', true, T), 'soak', false, T);
  assert.equal(own.opts.soaked, true);
  // ... and an answer that is not the one the tick gave stays
  let other = E.setOpt(PLAN, E.tickTonight(PLAN, fresh(), 'soak', true, T), 'soaked', false, T);
  assert.equal(E.tickTonight(PLAN, other, 'soak', false, T).opts.soaked, false);
  n = E.tickTonight(PLAN, n, 'order', true, T);
  assert.deepEqual(n.tonight, { order: true });
  // setOpt
  n = E.setOpt(PLAN, n, 'soaked', false, T);
  assert.equal(E.opt(PLAN, n, 'soaked'), false);
  n = E.setOpt(PLAN, n, 'soaked', undefined, T);
  assert.equal('soaked' in n.opts, false);
  assert.equal(E.opt(PLAN, n, 'soaked'), true);
  // fg
  n = E.startFg(PLAN, n, 'onion-dunk', T + 30000, T);
  assert.deepEqual(n.fg, { stepId: 'onion-dunk', endsAt: T + 30000 });
  assert.equal(E.skip(PLAN, n, 'onion-dunk', T).fg, null);
  assert.equal(E.clearFg(PLAN, n, T).fg, null);
});

test('setAnchor clamps to the day and refuses to touch or cross a neighbour', () => {
  const s = fresh();
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 645, T).anchors.leaveAm, 645);
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 645.4, T).anchors.leaveAm, 645);
  assert.equal(E.setAnchor(PLAN, s, 'start', -50, T).anchors.start, 0);
  assert.equal(E.setAnchor(PLAN, s, 'dinner', 5000, T).anchors.dinner, 1439);
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 840, T), s, 'equal to backHome');
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 900, T), s, 'past backHome');
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 420, T), s, 'equal to start');
  assert.equal(E.setAnchor(PLAN, s, 'leaveAm', 100, T), s, 'before start');
  assert.equal(E.setAnchor(PLAN, s, 'dinner', 900, T), s, 'equal to arrive');
  assert.equal(E.setAnchor(PLAN, s, 'start', 659, T).anchors.start, 659);
  const moved = E.setAnchor(PLAN, s, 'backHome', 855, T);
  assert.equal(E.anchorMs(moved, 'backHome'), H(14, 15));
  assert.equal(PLAN.anchors.backHome, 840);
});

// ---------------------------------------------------------------- waits and alerts

test('waitsView: shape, sorted by end, gone when the gated step is done', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(7, 10)]]);
  assert.deepEqual(E.waitsView(PLAN, s, H(7, 20)), [{
    id: 'beans', label: 'Beans simmering', lapLabel: 'Stir the beans', by: 'beans-start', gatedStepId: 'beans-check',
    startedAt: H(7, 10), endsAt: H(8, 10), remainingMs: 50 * MIN, elapsed: false, urgent: false, attended: true,
    laps: [{ n: 1, at: H(7, 30), due: false, acked: false }, { n: 2, at: H(7, 50), due: false, acked: false }], overMax: false, here: true
  }]);
  s = E.complete(PLAN, s, 'bacon-fry', H(7, 12));
  let v = E.waitsView(PLAN, s, H(7, 25));
  assert.deepEqual(v.map((w) => w.id), ['bacon', 'beans']);
  assert.equal(v[0].elapsed, true);
  assert.equal(v[0].remainingMs, 0);
  assert.equal(v[0].urgent, true);
  assert.equal(v[0].gatedStepId, 'bacon-out');
  assert.equal(v[0].lapLabel, 'Bacon frying');
  s = E.complete(PLAN, s, 'bacon-out', H(7, 26));
  assert.deepEqual(E.waitsView(PLAN, s, H(7, 27)).map((w) => w.id), ['beans']);
  assert.deepEqual(E.waitsView(PLAN, fresh(), H(7)), []);
});

test('waitsView: a timer that holds nothing back is listed until it ends', () => {
  let s = E.setOpt(PLAN, replay(fresh(), H(6, 55), 'unpack'), 'beansLater', true, H(15));
  s = E.complete(PLAN, s, 'beans-finish', H(15, 5));
  assert.deepEqual(E.waitsView(PLAN, s, H(15, 44)).map((w) => [w.id, w.gatedStepId]), [['beans2', null]]);
  assert.deepEqual(E.waitsView(PLAN, s, H(15, 45)), []);
});

test('timers from a kitchen he has left do not ring, show as running, or jump the queue', () => {
  // He walks out at 11:00 with the beans timer (attended, laps) and the bacon timer (attended, urgent) still open,
  // and the onions (not attended) steeping until 11:20.
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(10, 20)], ['onion-slice', H(10, 40)],
    ['onion-dunk', H(10, 50)], ['bacon-fry', H(10, 55)]]);
  assert.deepEqual(E.waitsView(PLAN, s, H(10, 59)).map((w) => [w.id, w.here]), [['bacon', true], ['beans', true], ['steep', true]]);
  assert.deepEqual(E.alerts(PLAN, s, H(10, 59)).map((a) => a.id), ['lap:beans:1', 'leave:leaveAm']);
  s = E.complete(PLAN, s, 'leave-am', H(11));
  // away: the stove timers are gone, the jar of onions is still counting, nothing rings
  assert.deepEqual(E.waitsView(PLAN, s, H(11, 6)).map((w) => [w.id, w.here, w.elapsed]), [['steep', false, false]]);
  assert.deepEqual(E.alerts(PLAN, s, H(11, 6)), [], 'no bacon alarm and no "stir the beans" at his appointment');
  assert.deepEqual(E.waitsView(PLAN, s, H(11, 21)), [], 'the onions finished while he was out: old news');
  // the gates themselves still count: the onions can be jarred in her kitchen
  s = run(s, [['back-home', H(14)], ['load-cooler', H(14, 10)], ['leave-pm', H(14, 30)], ['arrive', H(15)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(15)), []);
  assert.equal(E.isAvailable(PLAN, s, 'onion-jar', H(15)), true);
  // a timer started here rings here
  s = run(s, [['unpack', H(15, 10)], ['fish-cure', H(15, 20)], ['fish-drain', H(15, 45)], ['corn-broil', H(18, 50)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(18, 54)).map((a) => a.id), ['lap:corn:1']);
  assert.deepEqual(E.waitsView(PLAN, s, H(18, 54)).map((w) => [w.id, w.here]), [['corn', true]]);
  // Back early for the pack-up stop with the morning's bacon step still open: that alarm is stale,
  // so the master order decides (garnish comes before bacon-out), not the old alarm.
  let b = run(morningDone(['bacon-fry', 'bacon-out', 'garnish']), [['bacon-fry', H(10, 55)], ['leave-am', H(11)], ['back-home', H(13, 50)]]);
  assert.equal(E.isAvailable(PLAN, b, 'bacon-out', H(13, 50)), true);
  assert.equal(E.nextStep(PLAN, b, H(13, 50)), 'garnish');
  assert.deepEqual(E.alerts(PLAN, b, H(13, 50)), []);
  assert.deepEqual(E.waitsView(PLAN, b, H(13, 50)), []);
  // the same alarm while he is still in that kitchen does jump the queue
  b = run(morningDone(['bacon-fry', 'bacon-out', 'garnish']), [['bacon-fry', H(9)]]);
  assert.equal(E.nextStep(PLAN, b, H(9, 9)), 'garnish');
  assert.equal(E.nextStep(PLAN, b, H(9, 10)), 'bacon-out');
});

test('alerts: lap due, acknowledged, and only the latest lap of a wait', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(7, 10)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(7, 29)), []);
  assert.deepEqual(E.alerts(PLAN, s, H(7, 30)), [
    { kind: 'lap', id: 'lap:beans:1', title: 'Stir the beans (1 of 2)', waitId: 'beans', lap: 1, lapOf: 2, stepId: 'beans-start' }
  ]);
  assert.deepEqual(E.alerts(PLAN, E.ackLap(PLAN, s, 'beans', 1, H(7, 31)), H(7, 31)), []);
  const late = E.alerts(PLAN, s, H(7, 55));
  assert.equal(late.length, 1);
  assert.equal(late[0].id, 'lap:beans:2');
  assert.equal(late[0].title, 'Stir the beans (2 of 2)');
  assert.deepEqual(E.alerts(PLAN, E.ackLap(PLAN, s, 'beans', late[0].lap, H(7, 56)), H(7, 56)), []);
  assert.deepEqual(E.alerts(PLAN, s, H(8, 10)), [], 'the timer ended: its own step takes over');
});

test('alerts: an urgent wait that ended, until its step is done', () => {
  let s = run(fresh(), [['bacon-fry', H(7, 12)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(7, 21, 59)), []);
  assert.deepEqual(E.alerts(PLAN, s, H(7, 22)), [
    { kind: 'wait', id: 'wait:bacon', title: 'Time is up: Bacon frying', waitId: 'bacon', stepId: 'bacon-out' }
  ]);
  assert.equal(E.alerts(PLAN, s, H(7, 40)).length, 1);
  assert.deepEqual(E.alerts(PLAN, E.complete(PLAN, s, 'bacon-out', H(7, 41)), H(7, 41)), []);
});

test('alerts: max exceeded (marinade style)', () => {
  let s = replay(fresh(), H(6, 55), 'fish-cure');
  s = E.complete(PLAN, s, 'fish-cure', H(15, 20));
  assert.deepEqual(E.alerts(PLAN, s, H(15, 45)), [], 'a non-urgent wait ending is not an alert');
  assert.equal(E.waitsView(PLAN, s, H(15, 50))[0].overMax, false);
  assert.deepEqual(E.alerts(PLAN, s, H(15, 50, 1)), [
    { kind: 'max', id: 'max:cure', title: 'Too long: Fish curing', waitId: 'cure', stepId: 'fish-drain' }
  ]);
  assert.equal(E.waitsView(PLAN, s, H(15, 50, 1))[0].overMax, true);
  assert.deepEqual(E.alerts(PLAN, E.complete(PLAN, s, 'fish-drain', H(15, 51)), H(15, 52)), []);
});

test('alerts: leave warning inside 10 minutes of a hard out, and past it', () => {
  let s = fresh();
  assert.deepEqual(E.alerts(PLAN, s, H(10, 49, 59)), []);
  assert.deepEqual(E.alerts(PLAN, s, H(10, 50)), [{ kind: 'leave', id: 'leave:leaveAm', title: 'Leave in 10 min', stepId: 'leave-am', minsLeft: 10 }]);
  assert.equal(E.alerts(PLAN, s, H(10, 52, 30))[0].minsLeft, 7);
  assert.equal(E.alerts(PLAN, s, H(10, 52, 30))[0].title, 'Leave in 7 min');
  assert.deepEqual(E.alerts(PLAN, s, H(11)), [{ kind: 'leave', id: 'leave:leaveAm', title: 'Time to leave', stepId: 'leave-am', minsLeft: 0 }]);
  assert.equal(E.alerts(PLAN, s, H(11, 3))[0].minsLeft, -3);
  s = E.complete(PLAN, s, 'leave-am', H(11, 3));
  assert.deepEqual(E.alerts(PLAN, s, H(13, 58)), [], 'no hard out while he is away');
  s = E.complete(PLAN, s, 'back-home', H(14));
  assert.deepEqual(E.alerts(PLAN, s, H(14, 19)), []);
  assert.deepEqual(E.alerts(PLAN, s, H(14, 25)), [{ kind: 'leave', id: 'leave:leavePm', title: 'Leave in 5 min', stepId: 'leave-pm', minsLeft: 5 }]);
  s = run(s, [['leave-pm', H(14, 30)], ['arrive', H(15)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(19, 29)), []);
});

test('alerts: order is laps, ended urgent waits, max, leave', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(10, 20)], ['bacon-fry', H(10, 40)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(10, 55)).map((a) => a.kind), ['lap', 'wait', 'leave']);
  s = replay(fresh(), H(6, 55), 'fish-cure');
  s = run(s, [['fish-cure', H(18, 20)], ['corn-broil', H(19)]]);
  assert.deepEqual(E.alerts(PLAN, s, H(19, 4)).map((a) => a.id), ['lap:corn:1', 'max:cure']);
  assert.deepEqual(E.alerts(PLAN, s, H(19, 13)).map((a) => a.id), ['wait:corn', 'max:cure']);
});

// ---------------------------------------------------------------- lists, progress, formatting

test('packList applies ifDone / ifNotDone / when and reads ticks from its checklist step', () => {
  let s = fresh();
  assert.deepEqual(E.packList(PLAN, s, 'cooler'), [
    { id: 'fish', label: 'Fish', note: 'On the ice packs', ticked: false, stepId: 'load-cooler' },
    { id: 'limes', label: 'Whole limes', note: '', ticked: false, stepId: 'load-cooler' }
  ]);
  s = run(s, [['soak-q', H(7), { value: true }], ['beans-start', H(7, 10)], ['lime-juice', H(7, 40)]]);
  s = E.setOpt(PLAN, s, 'beansLater', true, H(8));
  s = E.tick(PLAN, s, 'load-cooler', 'limejar', true, H(8));
  assert.deepEqual(E.packList(PLAN, s, 'cooler').map((i) => [i.id, i.ticked]),
    [['fish', false], ['beans', false], ['limejar', true], ['beanpot', false]]);
  assert.deepEqual(E.packList(PLAN, s, 'gear'), [{ id: 'knife', label: 'Sharp knife', note: '', ticked: false, stepId: null }]);
  assert.deepEqual(E.packList(PLAN, s, 'nope'), []);
  assert.deepEqual(E.checklistItems(PLAN, s, 'pack-bag'), E.packList(PLAN, s, 'bag'));
  s = E.tick(PLAN, s, 'load-gear', 'i1', true, H(8));
  assert.deepEqual(E.checklistItems(PLAN, s, 'load-gear'), [
    { id: 'i0', label: 'Big pot', note: '', ticked: false, stepId: 'load-gear' },
    { id: 'i1', label: 'Skillet', note: '', ticked: true, stepId: 'load-gear' }
  ]);
  assert.deepEqual(E.checklistItems(PLAN, s, 'sauce'), []);
  assert.deepEqual(E.checklistItems(PLAN, s, 'nope'), []);
});

test('progress counts active, non-optional steps', () => {
  let s = fresh();
  assert.deepEqual(E.progress(PLAN, s), { done: 0, total: 25 });     // 28 minus beans-quick, beans-finish (variants) and garnish (optional)
  assert.deepEqual(E.dishProgress(PLAN, s, 'onions'), { done: 0, total: 3 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'nope'), { done: 0, total: 0 });
  s = E.tickTonight(PLAN, s, 'soak', true, H(6));
  s = run(s, [['onion-slice', H(7)], ['garnish', H(7, 10)]]);
  assert.deepEqual(E.progress(PLAN, s), { done: 2, total: 25 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'onions'), { done: 1, total: 3 });
  assert.deepEqual(E.dishProgress(PLAN, s, 'beans'), { done: 1, total: 6 });
  s = E.setOpt(PLAN, s, 'soaked', false, H(7, 20));
  assert.deepEqual(E.dishProgress(PLAN, s, 'beans'), { done: 1, total: 7 });
  s = E.skip(PLAN, s, 'sauce', H(7, 30));
  assert.deepEqual(E.progress(PLAN, s), { done: 2, total: 25 });
});

test('formatting', () => {
  assert.equal(E.fmtClock(H(7, 5)), '7:05 AM');
  assert.equal(E.fmtClock(H(0, 0)), '12:00 AM');
  assert.equal(E.fmtClock(H(12, 0)), '12:00 PM');
  assert.equal(E.fmtClock(H(19, 30)), '7:30 PM');
  assert.equal(E.fmtClock(NaN), '');
  assert.equal(E.fmtDur(5), '5 min');
  assert.equal(E.fmtDur(80), '1 hr 20 min');
  assert.equal(E.fmtDur(60), '1 hr');
  assert.equal(E.fmtDur(0.5), '30 sec');
  assert.equal(E.fmtDur(2.5), '3 min');
  assert.equal(E.fmtDur(0), '0 min');
  assert.equal(E.fmtDur(undefined), '0 min');
  assert.equal(E.fmtCountdown(725000), '12:05');
  assert.equal(E.fmtCountdown(3730000), '1:02:10');
  assert.equal(E.fmtCountdown(59001), '1:00');
  assert.equal(E.fmtCountdown(0), '0:00');
  assert.equal(E.fmtCountdown(-5000), '0:00');
});

// ---------------------------------------------------------------- project

const chronological = (p) => p.rows.every((r, i) => i === 0 || rowKey(p.rows[i - 1]) <= rowKey(r));
const span = (p, id) => [p.byStep[id].start, p.byStep[id].end];
const timesOf = (p) => p.rows.filter((r) => r.type === 'step' || r.type === 'move').map((r) => r.stepId);
const warning = (p, code) => p.warnings.find((w) => w.code === code);

test('project: an on-time day', () => {
  const s = fresh(H(6, 55));
  const p = E.project(PLAN, s, H(6, 55));
  assert.equal(p.now, H(6, 55));
  assert.deepEqual(timesOf(p), ['soak-q', 'beans-start', 'onion-slice', 'onion-dunk', 'bacon-fry', 'lime-juice', 'bacon-out', 'sauce',
    'onion-jar', 'garnish', 'beans-check', 'beans-off', 'pack-bag', 'leave-am', 'back-home', 'load-cooler', 'load-gear', 'leave-pm',
    'arrive', 'unpack', 'fish-cure', 'fish-drain', 'corn-broil', 'table', 'corn-out', 'dinner']);
  // exact times
  assert.deepEqual(span(p, 'soak-q'), [H(7), H(7, 1)]);                    // starts at the start anchor, not at 6:55
  assert.deepEqual(span(p, 'beans-start'), [H(7, 1), H(7, 11)]);
  assert.deepEqual(span(p, 'onion-dunk'), [H(7, 21), H(7, 23, 30)]);       // 2 min + 30 s timer
  assert.deepEqual(span(p, 'lime-juice'), [H(7, 26, 30), H(7, 46, 30)]);
  assert.deepEqual(span(p, 'bacon-out'), [H(7, 46, 30), H(7, 48, 30)]);    // urgent: before sauce and garnish
  assert.deepEqual(span(p, 'onion-jar'), [H(7, 53, 30), H(7, 56, 30)]);    // the moment the steep ends
  assert.deepEqual(span(p, 'beans-check'), [H(8, 11, 30), H(8, 12, 30)]);
  assert.deepEqual(span(p, 'pack-bag'), [H(8, 14, 30), H(8, 24, 30)]);
  assert.deepEqual(span(p, 'load-cooler'), [H(14), H(14, 10)]);
  assert.deepEqual(span(p, 'unpack'), [H(15), H(15, 10)]);
  assert.deepEqual(span(p, 'fish-drain'), [H(15, 40), H(15, 45)]);
  assert.deepEqual(span(p, 'corn-broil'), [H(18, 50), H(18, 55)]);
  assert.deepEqual(span(p, 'corn-out'), [H(19, 7), H(19, 10)]);
  assert.deepEqual(span(p, 'dinner'), [H(19, 30), H(19, 30)]);
  // summary
  assert.equal(p.dinnerAt, H(19, 30));
  assert.equal(p.dinnerAnchor, H(19, 30));
  assert.equal(p.lateMin, 0);
  assert.equal(p.spareMin, 20);
  assert.deepEqual(p.warnings, []);
  assert.ok(chronological(p));
  // every active, non-optional step exactly once; variants that do not apply never
  for (const st of PLAN.steps) {
    const n = timesOf(p).filter((id) => id === st.id).length;
    if (!E.isActive(PLAN, s, st)) assert.equal(n, 0, st.id);
    else if (!st.optional) assert.equal(n, 1, st.id);
  }
  // moves
  assert.deepEqual(p.rows.filter((r) => r.type === 'move'), [
    { type: 'move', stepId: 'leave-am', at: H(11), loc: 'home-am', to: 'away', status: 'later' },
    { type: 'move', stepId: 'back-home', at: H(14), loc: 'away', to: 'home-pm', status: 'later' },
    { type: 'move', stepId: 'leave-pm', at: H(14, 30), loc: 'home-pm', to: 'drive', status: 'later' },
    { type: 'move', stepId: 'arrive', at: H(15), loc: 'drive', to: 'hers', status: 'later' }
  ]);
  // free time
  assert.deepEqual(p.rows.filter((r) => r.type === 'free'), [
    { type: 'free', start: H(8, 24, 30), end: H(11), loc: 'home-am', nextStepId: 'leave-am' },
    { type: 'free', start: H(14, 15), end: H(14, 30), loc: 'home-pm', nextStepId: 'leave-pm' },
    { type: 'free', start: H(15, 20), end: H(15, 40), loc: 'hers', nextStepId: 'fish-drain' },
    { type: 'free', start: H(15, 45), end: H(18, 50), loc: 'hers', nextStepId: 'corn-broil' },
    { type: 'free', start: H(19), end: H(19, 7), loc: 'hers', nextStepId: 'corn-out' },
    { type: 'free', start: H(19, 10), end: H(19, 30), loc: 'hers', nextStepId: 'dinner' }
  ]);
  // background waits
  assert.deepEqual(p.rows.filter((r) => r.type === 'wait'), [
    { type: 'wait', waitId: 'beans', label: 'Beans simmering', start: H(7, 11), end: H(8, 11), loc: 'home-am' },
    { type: 'wait', waitId: 'steep', label: 'Onions steeping', start: H(7, 23, 30), end: H(7, 53, 30), loc: 'home-am' },
    { type: 'wait', waitId: 'bacon', label: 'Bacon frying', start: H(7, 26, 30), end: H(7, 36, 30), loc: 'home-am' },
    { type: 'wait', waitId: 'cure', label: 'Fish curing', start: H(15, 20), end: H(15, 40), loc: 'hers' },
    { type: 'wait', waitId: 'corn', label: 'Corn under the broiler', start: H(18, 55), end: H(19, 7), loc: 'hers' }
  ]);
  // status and flags
  assert.deepEqual(stepRows(p).filter((r) => r.status !== 'later').map((r) => [r.stepId, r.status]), [['soak-q', 'next']]);
  assert.ok(stepRows(p).every((r) => !('deferred' in r) && !('late' in r)));
  assert.deepEqual(p.byStep['lime-juice'], { start: H(7, 26, 30), end: H(7, 46, 30), status: 'later', loc: 'home-am', deferred: false });
  assert.equal(p.byStep['load-cooler'].loc, 'home-pm');
  assert.equal(p.byStep.unpack.loc, 'hers');
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.equal('beans-quick' in p.byStep, false);
});

test('project: starts at the start anchor only when nothing is done and it is still early', () => {
  assert.equal(E.project(PLAN, fresh(), H(6, 55)).byStep['soak-q'].start, H(7));
  assert.equal(E.project(PLAN, fresh(H(20) - 24 * 60 * MIN), H(20) - 24 * 60 * MIN).byStep['soak-q'].start, H(7), 'the evening before');
  assert.equal(E.project(PLAN, fresh(), H(7, 20)).byStep['soak-q'].start, H(7, 20));
  const early = run(fresh(), [['onion-slice', H(6, 40)]]);
  assert.equal(E.project(PLAN, early, H(6, 41)).byStep['soak-q'].start, H(6, 41), 'he already began: no waiting for 7:00');
});

test('project: the timeline follows what he actually did', () => {
  const fast = run(fresh(), [['soak-q', H(7, 0, 10), { value: true }]]);
  assert.deepEqual(span(E.project(PLAN, fast, H(7, 0, 10)), 'beans-start'), [H(7, 0, 10), H(7, 10, 10)]);
  const slow = run(fresh(), [['soak-q', H(7, 30), { value: true }]]);
  const p = E.project(PLAN, slow, H(7, 30));
  assert.deepEqual(span(p, 'beans-start'), [H(7, 30), H(7, 40)]);
  assert.deepEqual(span(p, 'beans-check'), [H(8, 40, 30), H(8, 41, 30)]);
  assert.equal(p.lateMin, 0);
  assert.deepEqual(stepRows(p)[0], { type: 'step', stepId: 'soak-q', start: H(7, 29), end: H(7, 30), status: 'done', loc: 'home-am' });
  assert.equal(stepRows(p)[1].status, 'next');
});

test('project: done rows come first, live timers are shown, and never the same step twice', () => {
  const s = richState();
  const p = E.project(PLAN, s, T);
  assert.ok(chronological(p));
  const kinds = stepRows(p).map((r) => r.status);
  assert.deepEqual(kinds.slice(0, 4), ['done', 'done', 'done', 'done']);
  assert.equal(kinds.indexOf('next'), 4);
  assert.ok(kinds.slice(5).every((k) => k === 'later'));
  assert.equal(new Set(timesOf(p)).size, timesOf(p).length);
  assert.deepEqual(p.rows.filter((r) => r.type === 'wait').slice(0, 2), [
    { type: 'wait', waitId: 'beans', label: 'Beans simmering', start: H(7, 11), end: H(8, 11), loc: 'home-am' },
    { type: 'wait', waitId: 'steep', label: 'Onions steeping', start: H(7, 24), end: H(7, 54), loc: 'home-am' }
  ]);
  assert.equal(p.rows.filter((r) => r.type === 'wait' && r.waitId === 'beans').length, 1);
  // the real 8:11 timer end gates the check; it is not urgent, so the garnish (earlier in the master order) goes first
  assert.equal(p.byStep.garnish.start, H(8, 13));
  assert.equal(p.byStep['beans-check'].start, H(8, 28));
  assert.equal(p.lateMin, 0);
});

test('project: finishing early turns the gap into free time', () => {
  const s = morningDone([], H(8));
  const p = E.project(PLAN, s, H(8));
  const firstOpen = p.rows.find((r) => r.type !== 'wait' && (r.type !== 'step' || r.status !== 'done'));
  assert.deepEqual(firstOpen, { type: 'free', start: H(8), end: H(11), loc: 'home-am', nextStepId: 'leave-am' });
  assert.equal(p.lateMin, 0);
  assert.deepEqual(p.warnings, []);
  // a gap under 3 minutes is not worth a row
  const tight = E.project(PLAN, s, H(10, 58));
  assert.equal(tight.rows.some((r) => r.type === 'free' && r.loc === 'home-am'), false);
  assert.equal(tight.byStep['leave-am'].start, H(11));
});

test('project: the move he should make right now is the "next" row', () => {
  const p = E.project(PLAN, morningDone(), H(11, 2));
  assert.deepEqual(p.rows.find((r) => r.type === 'move'), { type: 'move', stepId: 'leave-am', at: H(11, 2), loc: 'home-am', to: 'away', status: 'next' });
  assert.equal(p.byStep['leave-am'].status, 'next');
  assert.equal(p.byStep['back-home'].start, H(14));
});

test('project: late in her kitchen pushes dinner and warns', () => {
  const s = replay(fresh(), H(6, 55), 'corn-broil');
  const p = E.project(PLAN, s, H(19, 20));
  assert.deepEqual(span(p, 'corn-broil'), [H(19, 20), H(19, 25)]);
  assert.deepEqual(span(p, 'corn-out'), [H(19, 37), H(19, 40)]);
  assert.equal(p.dinnerAt, H(19, 40));
  assert.equal(p.dinnerAnchor, H(19, 30));
  assert.equal(p.lateMin, 10);
  assert.equal(p.spareMin, 0);
  assert.deepEqual(p.warnings, [{ code: 'late', text: 'Dinner is running about 10 min late.' }]);
  assert.deepEqual(stepRows(p).filter((r) => r.late).map((r) => r.stepId), ['corn-out', 'dinner']);
  assert.ok(chronological(p));
  // on time again once the dinner anchor is moved
  const moved = E.project(PLAN, E.setAnchor(PLAN, s, 'dinner', 1185, H(19, 20)), H(19, 20));
  assert.equal(moved.lateMin, 0);
  assert.equal(moved.dinnerAt, H(19, 45));
  assert.equal(moved.spareMin, 5);
});

test('project: a very late start pushes dinner, warns "late", and lists what will not get done', () => {
  const p = E.project(PLAN, fresh(), H(18));
  assert.deepEqual(timesOf(p), ['soak-q', 'beans-start', 'bacon-fry', 'pack-bag', 'bacon-out', 'leave-am', 'back-home', 'beans-off',
    'load-cooler', 'leave-pm', 'arrive', 'onion-slice', 'onion-dunk', 'lime-juice', 'sauce', 'unpack', 'onion-jar', 'beans-finish',
    'fish-cure', 'corn-broil', 'table', 'corn-out', 'fish-drain', 'dinner']);
  assert.equal(p.byStep['leave-am'].start, H(18, 26));
  assert.equal(p.byStep['back-home'].start, H(18, 26), 'no pretending he is back at 2:00 PM');
  assert.equal(p.byStep['leave-pm'].start, H(18, 38));
  assert.equal(p.byStep.arrive.start, H(19, 8), 'the drive still takes 30 minutes');
  assert.equal(p.dinnerAt, H(20, 38, 30));
  assert.equal(p.lateMin, 69);
  assert.equal(p.spareMin, 0);
  assert.deepEqual(codes(p), ['late', 'am-overrun', 'missed', 'deferred', 'beans-later']);
  assert.equal(warning(p, 'late').text, 'Dinner is running about 69 min late.');
  assert.deepEqual(warning(p, 'missed').stepIds, ['load-gear']);
  assert.equal(warning(p, 'missed').text, 'No time for: Load the gear.');
  assert.deepEqual(warning(p, 'deferred').stepIds, ['onion-slice', 'onion-dunk', 'lime-juice', 'sauce', 'onion-jar']);
  assert.equal(p.byStep.dinner.status, 'later');
  assert.equal(stepRows(p).find((r) => r.stepId === 'dinner').late, true);
  assert.equal(stepRows(p).find((r) => r.stepId === 'onion-slice').late, undefined);
  assert.equal(stepRows(p).find((r) => r.stepId === 'lime-juice').late, true);
  assert.equal('load-gear' in p.byStep, false);
  assert.equal('garnish' in p.byStep, false);
  assert.ok(chronological(p));
});

test('project: a tight morning defers "either" work early enough to still leave on time', () => {
  const p = E.project(PLAN, fresh(), H(10, 30));
  // his kitchen: only what can only happen there. The 28 min of home-only work is protected, so the
  // onions (10 min, would end 10:51) are sent to her kitchen even though they "fit" on their own.
  assert.deepEqual(stepRows(p).filter((r) => r.loc === 'home-am').map((r) => [r.stepId, r.start, r.end]), [
    ['soak-q', H(10, 30), H(10, 31)],
    ['beans-start', H(10, 31), H(10, 41)],
    ['bacon-fry', H(10, 41), H(10, 44)],
    ['pack-bag', H(10, 44), H(10, 54)],
    ['bacon-out', H(10, 54), H(10, 56)]
  ]);
  assert.deepEqual(p.rows.find((r) => r.type === 'free'), { type: 'free', start: H(10, 56), end: H(11), loc: 'home-am', nextStepId: 'leave-am' });
  assert.equal(p.byStep['leave-am'].start, H(11), 'out the door on time');
  // pack-up stop: must steps first, then the gear; the optional garnish (15 min) would crowd them out, so it is dropped
  assert.deepEqual(stepRows(p).filter((r) => r.loc === 'home-pm').map((r) => [r.stepId, r.start, r.end]), [
    ['beans-off', H(14), H(14, 2)], ['load-cooler', H(14, 2), H(14, 12)], ['load-gear', H(14, 12), H(14, 17)]
  ]);
  assert.equal(p.byStep['leave-pm'].start, H(14, 30));
  assert.equal('garnish' in p.byStep, false, 'the optional home step is dropped');
  // her kitchen picks up the deferred work first (master order)
  assert.deepEqual(stepRows(p).filter((r) => r.loc === 'hers').slice(0, 7).map((r) => [r.stepId, r.start, r.deferred === true]), [
    ['onion-slice', H(15), true], ['onion-dunk', H(15, 10), true], ['lime-juice', H(15, 12, 30), true], ['sauce', H(15, 32, 30), true],
    ['unpack', H(15, 37, 30), false], ['onion-jar', H(15, 47, 30), true], ['beans-finish', H(15, 50, 30), false]
  ]);
  assert.deepEqual(p.byStep['lime-juice'], { start: H(15, 12, 30), end: H(15, 32, 30), status: 'later', loc: 'hers', deferred: true });
  assert.deepEqual(codes(p), ['deferred', 'beans-later']);
  assert.deepEqual(warning(p, 'deferred').stepIds, ['onion-slice', 'onion-dunk', 'lime-juice', 'sauce', 'onion-jar']);
  assert.equal(warning(p, 'deferred').text, 'Moved to her kitchen: Slice the onions, Dunk the onions, Juice the limes, Make the sauce, Jar the onions.');
  assert.ok(stepRows(p).every((r) => !r.late));
  assert.equal(p.lateMin, 0);
  assert.equal(p.dinnerAt, H(19, 30));
  assert.ok(chronological(p));
});

test('project: morning overrun when the home-only steps themselves cannot fit', () => {
  const p = E.project(PLAN, fresh(), H(10, 50));
  assert.deepEqual(stepRows(p).filter((r) => r.loc === 'home-am').map((r) => [r.stepId, r.start, r.end]), [
    ['soak-q', H(10, 50), H(10, 51)],
    ['beans-start', H(10, 51), H(11, 1)],           // home-only: kept although it cannot fit
    ['bacon-fry', H(11, 1), H(11, 4)],
    ['pack-bag', H(11, 4), H(11, 14)],
    ['bacon-out', H(11, 14), H(11, 16)]
  ]);
  assert.equal(p.byStep['leave-am'].start, H(11, 16));
  assert.equal(p.byStep['back-home'].start, H(14));
  assert.deepEqual(codes(p), ['am-overrun', 'deferred', 'beans-later']);
  assert.deepEqual(warning(p, 'am-overrun').stepIds, ['beans-start', 'bacon-fry', 'pack-bag', 'bacon-out']);
  assert.equal(warning(p, 'am-overrun').text,
    'You will leave your place late. Running past 11:00 AM: Start the beans, Fry the bacon, Pack the bag, Take the bacon out.');
  assert.deepEqual(warning(p, 'deferred').stepIds, ['onion-slice', 'onion-dunk', 'lime-juice', 'sauce', 'onion-jar']);
  assert.deepEqual(stepRows(p).filter((r) => r.late).map((r) => r.stepId), ['beans-start', 'bacon-fry', 'pack-bag', 'bacon-out']);
  assert.equal(p.byStep['onion-slice'].loc, 'hers');
  assert.equal(p.lateMin, 0);
  assert.equal(p.dinnerAt, H(19, 30));
  assert.ok(chronological(p));
});

test('project: giving up on the beans shows the her-kitchen variant and the beans-later warning', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(9, 30)]]);
  s = E.giveUp(PLAN, s, 'beans-check', H(10, 20));
  const p = E.project(PLAN, s, H(10, 20));
  assert.equal('beans-check' in p.byStep, false);
  assert.equal(p.byStep['beans-finish'].loc, 'hers');
  assert.equal(p.byStep['beans-off'].loc, 'home-am');
  assert.ok(codes(p).includes('beans-later'));
  assert.equal(warning(p, 'missed'), undefined);
});

test('project: the beans-later warning goes away once that work is behind him', () => {
  let s = replay(E.giveUp(PLAN, run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(9, 30)]]), 'beans-check', H(10, 20)), H(10, 20), 'beans-finish');
  assert.equal(E.location(PLAN, s), 'hers');
  assert.ok(codes(E.project(PLAN, s, H(15, 40))).includes('beans-later'));
  s = E.complete(PLAN, s, 'beans-finish', H(15, 45));
  assert.equal(codes(E.project(PLAN, s, H(15, 45))).includes('beans-later'), false);
  assert.equal(E.opt(PLAN, s, 'beansLater'), true);
});

test('project: the not-soaked variant adds the quick soak and still makes dinner', () => {
  const s = run(fresh(), [['soak-q', H(7), { value: false }]]);
  const p = E.project(PLAN, s, H(7));
  assert.deepEqual(span(p, 'beans-quick'), [H(7), H(7, 5)]);
  assert.deepEqual(p.rows.find((r) => r.type === 'wait' && r.waitId === 'quicksoak').end, H(8, 5));
  assert.equal(p.byStep.garnish.end, H(8, 5, 30));
  assert.equal(p.byStep['beans-start'].start, H(8, 5, 30), 'held back by the quick soak, then first in line');
  assert.equal(p.rows.filter((r) => r.type === 'wait' && r.waitId === 'quicksoak').length, 1);
  assert.equal(p.lateMin, 0);
  assert.deepEqual(p.warnings, []);
});

test('project: away and driving use real times', () => {
  let s = E.complete(PLAN, morningDone(), 'leave-am', H(11));
  assert.equal(E.project(PLAN, s, H(12)).byStep['back-home'].start, H(14));
  assert.equal(E.project(PLAN, s, H(14, 10)).byStep['back-home'].start, H(14, 10), 'not home yet at 2:10');
  s = run(s, [['back-home', H(14, 10)], ['load-cooler', H(14, 25)], ['leave-pm', H(14, 40)]]);
  assert.equal(E.project(PLAN, s, H(14, 50)).byStep.arrive.start, H(15, 10), 'left 10 min late, arrives 10 min late');
  assert.equal(E.project(PLAN, s, H(15, 20)).byStep.arrive.start, H(15, 20));
  const p = E.project(PLAN, s, H(14, 50));
  assert.equal(p.byStep['load-gear'], undefined);
  assert.equal(warning(p, 'missed'), undefined, 'already skipped for real: not news');
  assert.equal(p.rows.find((r) => r.stepId === 'leave-pm').status, 'done');
});

test('project: done rows are placed where they really happened', () => {
  let s = run(morningDone(['lime-juice']), [['leave-am', H(11)], ['back-home', H(14)], ['load-cooler', H(14, 10)], ['leave-pm', H(14, 30)], ['arrive', H(15)]]);
  s = run(s, [['lime-juice', H(15, 4)]]);
  const p = E.project(PLAN, s, H(15, 4));
  // 20 min of juicing cannot have started before he arrived
  assert.deepEqual(stepRows(p).find((r) => r.stepId === 'lime-juice'),
    { type: 'step', stepId: 'lime-juice', start: H(15), end: H(15, 4), status: 'done', loc: 'hers', deferred: true });
  assert.equal(p.byStep['load-cooler'].loc, 'home-pm');
  assert.equal(p.byStep.sauce.loc, 'home-am');
  assert.equal(warning(p, 'deferred'), undefined, 'done is done: nothing left to warn about');
  assert.ok(chronological(p));
});

test('project: never mutates, always returns the full shape', () => {
  const s = deepFreeze(richState());
  const before = clone(s);
  const p = E.project(PLAN, s, T);
  assert.deepEqual(s, before);
  assert.deepEqual(Object.keys(p).sort(), ['byStep', 'dinnerAnchor', 'dinnerAt', 'lateMin', 'now', 'rows', 'spareMin', 'warnings']);
  const empty = E.project({}, null, H(7));
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.dinnerAt, null);
  assert.equal(empty.lateMin, 0);
  assert.equal(empty.spareMin, 0);
});

test('project: terminates on broken plans', () => {
  // a dependency cycle: nothing can ever start
  const cyc = fixture();
  step(cyc, 'onion-slice').after = ['onion-jar'];
  let p = E.project(cyc, E.initialState(cyc, 't', H(6)), H(7));
  assert.ok(warning(p, 'missed').stepIds.includes('onion-slice'));
  assert.equal(p.byStep.dinner.start, H(19, 30));
  // no move steps at all: he can never leave his kitchen
  const stay = fixture();
  stay.steps = stay.steps.filter((s) => s.kind !== 'move');
  for (const s of stay.steps) if (s.after) s.after = s.after.filter((id) => stay.steps.some((x) => x.id === id));
  p = E.project(stay, E.initialState(stay, 't', H(6)), H(7));
  assert.equal(p.dinnerAt, null);
  assert.ok(warning(p, 'missed').stepIds.includes('dinner'));
  // a long chain
  const long = fixture();
  const chain = [];
  for (let i = 0; i < 600; i++) chain.push({ id: 'c' + i, dish: 'day', block: 'hers', where: 'hers', title: 'c' + i, body: [], mins: 0.1, after: i ? ['c' + (i - 1)] : [] });
  long.steps.splice(long.steps.length - 1, 0, ...chain);
  step(long, 'dinner').after.push('c599');
  p = E.project(long, E.initialState(long, 't', H(6)), H(7));
  assert.equal(stepRows(p).filter((r) => /^c\d+$/.test(r.stepId)).length, 600);
  assert.equal(p.lateMin, 0);
});

test('project and friends never throw and stay consistent on random states', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ids = PLAN.steps.map((s) => s.id);
  for (let i = 0; i < 300; i++) {
    let s = fresh();
    const now = H(5) + Math.floor(rnd() * 20 * 60) * MIN;
    const n = Math.floor(rnd() * ids.length);
    for (let k = 0; k < n; k++) {
      const id = ids[Math.floor(rnd() * ids.length)];
      const at = now - Math.floor(rnd() * 180) * MIN;
      const r = rnd();
      if (r < 0.7) s = E.complete(PLAN, s, id, at, rnd() < 0.5 ? { value: rnd() < 0.5 } : undefined);
      else if (r < 0.8) s = E.skip(PLAN, s, id, at);
      else if (r < 0.9) s = E.retry(PLAN, s, id, at);
      else s = E.setOpt(PLAN, s, rnd() < 0.5 ? 'beansLater' : 'soaked', rnd() < 0.5, at);
    }
    deepFreeze(s);
    const p = E.project(PLAN, s, now);
    assert.ok(chronological(p), 'chronological #' + i);
    const seen = timesOf(p);
    assert.equal(new Set(seen).size, seen.length, 'each step at most once #' + i);
    assert.ok(p.lateMin >= 0 && p.spareMin >= 0);
    assert.ok(p.rows.every((r) => r.type === 'move' ? Number.isFinite(r.at) : Number.isFinite(r.start) && Number.isFinite(r.end) && r.end >= r.start), 'finite rows #' + i);
    assert.ok(p.rows.length < 400);
    const next = E.nextStep(PLAN, s, now);
    if (next !== null) assert.equal(E.isAvailable(PLAN, s, next, now), true);
    const nextRow = p.rows.filter((r) => r.status === 'next');
    assert.ok(nextRow.length <= 1);
    if (nextRow.length) assert.equal(nextRow[0].stepId, next);
    const u = E.nextUnlock(PLAN, s, now);
    if (u) { assert.ok(u.at > now); assert.notEqual(E.pick(PLAN, s, u.at), null, 'something is pickable at the unlock #' + i); }
    E.alerts(PLAN, s, now); E.waitsView(PLAN, s, now); E.progress(PLAN, s); E.packList(PLAN, s, 'cooler');
  }
});

// ---------------------------------------------------------------- junk in, no crash

test('every public function survives junk arguments', () => {
  const junk = [undefined, null, 0, 'x', [], {}, { steps: 'no' }, { steps: [null, 1, { id: 5 }, { id: 'a' }] }];
  const state = fresh();
  for (const name of Object.keys(E)) {
    for (const a of junk) {
      for (const b of junk) {
        assert.doesNotThrow(() => E[name](a, b, 'nope', H(7), {}), name + ' with junk plan/state');
        assert.doesNotThrow(() => E[name](PLAN, b, a, H(7), {}), name + ' with junk state/id');
        assert.doesNotThrow(() => E[name](PLAN, state, a, b, a, b), name + ' with junk tail');
        assert.doesNotThrow(() => E[name](a), name + ' with one junk argument');
      }
    }
  }
  // a state loaded from an older save with pieces missing still works
  const partial = { v: 1, day: state.day, anchors: state.anchors, rev: 3 };
  assert.equal(E.nextStep(PLAN, partial, H(7)), 'soak-q');
  const next = E.complete(PLAN, partial, 'soak-q', H(7), { value: true });
  assert.equal(next.rev, 4);
  assert.deepEqual(next.done, { 'soak-q': H(7) });
  assert.equal(E.project(PLAN, partial, H(7)).lateMin, 0);
});


// ---------------------------------------------------------------- findings from the engine review

// A variant where the must step "turn the beans off" waits for a 25 minute rest that the bean check starts.
function restPlan() {
  const p = fixture();
  step(p, 'beans-check').wait = { id: 'rest', mins: 25, label: 'Beans resting' };
  step(p, 'beans-off').afterWait = 'rest';
  return p;
}
const mornOf = (p, skip, at = H(7)) =>
  run(E.initialState(p, 't', H(6)), AM_ALL.filter((id) => !skip.includes(id)).map((id) => [id, at, id === 'soak-q' ? { value: true } : undefined]), p);

test('must: a must step waiting on a timer is released in time to be done before the hard out', () => {
  const p = restPlan();
  assert.deepEqual(E.validate(p), []);
  // the check is done 10:42: the rest would end 11:07, after the 11:00 hard out. The 2 minute step is released at 10:58.
  let s = run(mornOf(p, ['beans-check', 'beans-off']), [['beans-check', H(10, 42)]], p);
  assert.deepEqual(E.blockers(p, s, 'beans-off', H(10, 50)), [{ type: 'wait', waitId: 'rest', endsAt: H(10, 58) }]);
  assert.equal(E.isAvailable(p, s, 'beans-off', H(10, 57, 59)), false);
  assert.equal(E.isAvailable(p, s, 'beans-off', H(10, 58)), true);
  assert.equal(E.nextStep(p, s, H(10, 50)), null);
  assert.deepEqual(E.nextUnlock(p, s, H(10, 50)), { at: H(10, 58), stepId: 'beans-off', reason: 'wait' });
  assert.equal(E.nextStep(p, s, H(10, 58)), 'beans-off');
  let proj = E.project(p, s, H(10, 50));
  assert.deepEqual(span(proj, 'beans-off'), [H(10, 58), H(11)]);
  assert.equal(proj.byStep['beans-off'].loc, 'home-am');
  assert.equal(proj.byStep['leave-am'].start, H(11), 'and he still leaves on time');
  assert.deepEqual(codes(proj), []);
  assert.equal(E.waitsView(p, s, H(10, 50))[0].endsAt, H(11, 7), 'the timer itself is shown as it runs');
  // a timer that ends before that moment is not cut short
  s = run(mornOf(p, ['beans-check', 'beans-off']), [['beans-check', H(10, 20)]], p);
  assert.deepEqual(E.blockers(p, s, 'beans-off', H(10, 30)), [{ type: 'wait', waitId: 'rest', endsAt: H(10, 45) }]);
  // a timer started too late for that: the step is open at once, he leaves late and the plan says so
  s = run(mornOf(p, ['beans-check', 'beans-off']), [['beans-check', H(10, 59)]], p);
  assert.equal(E.nextStep(p, s, H(10, 59)), 'beans-off');
  proj = E.project(p, s, H(10, 59));
  assert.deepEqual(span(proj, 'beans-off'), [H(10, 59), H(11, 1)]);
  assert.equal(proj.byStep['leave-am'].start, H(11, 1));
  assert.deepEqual(warning(proj, 'am-overrun').stepIds, ['beans-off']);
  // only must steps, and only where there is a hard out: the onions (not a must) wait for their timer and are deferred
  s = run(morningDone(['onion-dunk', 'onion-jar']), [['onion-dunk', H(10, 40)]]);
  assert.deepEqual(E.blockers(PLAN, s, 'onion-jar', H(10, 59)), [{ type: 'wait', waitId: 'steep', endsAt: H(11, 10) }]);
});

test('fit rule: stove time runs while he does the home-only work, the two are not added up', () => {
  const p = fixture();
  step(p, 'sauce').wait = { id: 'reduce', mins: 20, label: 'Sauce reducing', attended: true };
  const s = mornOf(p, ['sauce', 'pack-bag']);
  assert.equal(E.needMins(step(p, 'sauce')), 25);
  assert.equal(E.nextStep(p, s, H(10, 35)), 'sauce', '5 min + 20 on the stove end at 11:00; the 10 min of packing fit inside');
  assert.equal(E.nextStep(p, s, H(10, 35, 1)), 'pack-bag', 'one second later the stove time runs past the hard out');
});

test('fit rule: only work that can still happen before the hard out takes room', () => {
  // beans on at 10:30: the check (home-only) and "beans off" (must, behind the check) cannot come up before 11:30
  let s = run(morningDone(['sauce', 'beans-start', 'beans-check', 'beans-off']), [['beans-start', H(10, 30)]]);
  assert.equal(E.nextStep(PLAN, s, H(10, 55)), 'sauce', '5 minutes left and nothing else can be done here: the sauce fits');
  assert.equal(E.nextStep(PLAN, s, H(10, 55, 1)), null);
  // work that follows the candidate still counts: a home-only step behind the sauce keeps its 10 minutes
  const p = fixture();
  step(p, 'pack-bag').after = ['sauce'];
  s = mornOf(p, ['sauce', 'pack-bag']);
  assert.equal(E.nextStep(p, s, H(10, 45)), 'sauce');
  assert.equal(E.nextStep(p, s, H(10, 46)), null, 'sauce + packing would end 11:01: the sauce goes to her kitchen');
});

test('fit rule: an urgent timer he starts, or that is already running, takes its step\'s minutes too', () => {
  const p = fixture();
  step(p, 'bacon-fry').where = 'either';
  step(p, 'bacon-out').where = 'either';
  // open: bacon-fry (3 min + 10 on the stove, urgent), bacon-out (2 min, the alarm step) and the bag (home-only, 10 min)
  let s = mornOf(p, ['bacon-fry', 'bacon-out', 'pack-bag']);
  assert.equal(E.nextStep(p, s, H(10, 45)), 'bacon-fry', '3 + 2 + 10 minutes of hands-on end exactly at 11:00');
  assert.equal(E.nextStep(p, s, H(10, 46)), 'pack-bag', 'the bacon and its alarm step would push the bag past 11:00');
  // the pan is already on (alarm 10:53): the sauce must leave room for "take the bacon out" as well as the bag
  s = run(mornOf(p, ['bacon-fry', 'bacon-out', 'sauce', 'pack-bag']), [['bacon-fry', H(10, 43)]], p);
  assert.equal(E.nextStep(p, s, H(10, 43)), 'sauce', '5 + 2 + 10 = 17 minutes, ends 11:00');
  assert.equal(E.nextStep(p, s, H(10, 44)), 'pack-bag');
});

test('pack-up stop: two leftover home steps do not block each other', () => {
  const p = fixture();
  delete step(p, 'garnish').optional;                    // now two home-only steps that are not a must: garnish 15, gear 5
  let s = run(mornOf(p, ['garnish']), [['leave-am', H(11)], ['back-home', H(14, 8)], ['load-cooler', H(14, 18)]], p);
  assert.equal(E.nextStep(p, s, H(14, 18)), 'load-gear', '12 minutes left: the garnish cannot fit, the gear can');
  const proj = E.project(p, s, H(14, 18));
  assert.deepEqual(span(proj, 'load-gear'), [H(14, 18), H(14, 23)]);
  assert.deepEqual(warning(proj, 'missed').stepIds, ['garnish']);
  // must work is still protected: before the cooler is loaded the garnish (15) + cooler (10) do not fit in 22 minutes
  s = run(mornOf(p, ['garnish']), [['leave-am', H(11)], ['back-home', H(14, 8)]], p);
  assert.equal(E.nextStep(p, s, H(14, 8)), 'load-cooler');
});

test('timers of this kitchen keep ringing when a move is taken back and done again', () => {
  let s = replay(fresh(), H(6, 55), 'corn-broil');
  s = E.complete(PLAN, s, 'corn-broil', H(18, 50));
  assert.deepEqual(E.alerts(PLAN, s, H(18, 54)).map((a) => a.id), ['lap:corn:1']);
  s = E.uncomplete(PLAN, s, 'arrive', H(18, 55));          // Day tab: "Not done" on the arrival by mistake
  assert.equal(E.location(PLAN, s), 'drive');
  s = E.complete(PLAN, s, 'arrive', H(18, 55, 20));        // "I'm here"
  assert.equal(E.location(PLAN, s), 'hers');
  assert.deepEqual(E.waitsView(PLAN, s, H(18, 57)).map((w) => [w.id, w.here]), [['corn', true]]);
  assert.deepEqual(E.alerts(PLAN, s, H(18, 57)).map((a) => a.id), ['lap:corn:2']);
  assert.equal(E.nextStep(PLAN, s, H(19, 2)), 'corn-out', 'the alarm still jumps the queue');
});

test('moves out of order: a later move completes the earlier ones, "Not done" on a move takes the later ones back', () => {
  // "I'm here" without "I'm on my way": the leave happened too, so the home steps are written off and dinner can be planned
  let s = run(morningDone(['garnish']), [['leave-am', H(11)], ['back-home', H(14)], ['load-cooler', H(14, 10)]]);
  const there = E.complete(PLAN, s, 'arrive', H(15));
  assert.equal(E.location(PLAN, there), 'hers');
  assert.equal(there.done['leave-pm'], H(15));
  assert.equal(there.rev, s.rev + 1, 'still one change');
  assert.equal(there.skipped['load-gear'], true);
  let p = E.project(PLAN, there, H(15));
  assert.equal(p.dinnerAt, H(19, 30));
  assert.equal(warning(p, 'missed'), undefined);
  // the rules of the skipped-over move run as well
  const jumped = E.complete(PLAN, fresh(), 'back-home', H(14));
  assert.equal(jumped.done['leave-am'], H(14));
  assert.equal(E.opt(PLAN, jumped, 'beansLater'), true);
  assert.equal(E.location(PLAN, jumped), 'home-pm');
  // "Not done" on the leave while he is marked as arrived: he is back at the pack-up stop, nothing is lost
  const back = E.uncomplete(PLAN, there, 'leave-pm', H(15, 1));
  assert.equal(E.location(PLAN, back), 'home-pm');
  assert.equal('arrive' in back.done, false);
  assert.equal('load-gear' in back.skipped, false);
  assert.equal(back.rev, there.rev + 1);
  assert.equal(E.nextStep(PLAN, back, H(15, 1)), 'leave-pm');
  // a home step taken back in her kitchen cannot be done any more: it is written off, dinner stays reachable
  const undone = E.uncomplete(PLAN, there, 'pack-bag', H(15, 2));
  assert.equal('pack-bag' in undone.done, false);
  assert.equal(undone.skipped['pack-bag'], true);
  assert.equal(E.project(PLAN, undone, H(15, 2)).dinnerAt, H(19, 30));
  // at his place the same "Not done" just reopens the step
  const home = E.uncomplete(PLAN, morningDone(), 'pack-bag', H(8));
  assert.equal('pack-bag' in home.skipped, false);
  assert.equal(E.nextStep(PLAN, home, H(8)), 'pack-bag');
});

test('project: an alarm that goes off exactly at the hard out is planned the way the guide will say it', () => {
  const s = run(morningDone(['bacon-fry', 'bacon-out']), [['bacon-fry', H(10, 50)]]);
  assert.equal(E.nextStep(PLAN, s, H(11)), 'bacon-out');
  const p = E.project(PLAN, s, H(10, 55));
  assert.deepEqual([span(p, 'bacon-out'), p.byStep['bacon-out'].loc], [[H(11), H(11, 2)], 'home-am']);
  assert.equal(p.byStep['leave-am'].start, H(11, 2));
  assert.deepEqual(warning(p, 'am-overrun').stepIds, ['bacon-out']);
  assert.deepEqual(p.rows.find((r) => r.type === 'free'), { type: 'free', start: H(10, 55), end: H(11), loc: 'home-am', nextStepId: 'bacon-out' });
});

test('project: a home step whose stove timer is still running at the hard out is named under am-overrun', () => {
  // bacon in the pan at 10:58 (home-only, 10 minutes on the stove). The plan has him leave at 11:00: it must say so.
  const s = morningDone(['bacon-fry', 'bacon-out']);
  const p = E.project(PLAN, s, H(10, 55));
  assert.deepEqual(span(p, 'bacon-fry'), [H(10, 55), H(10, 58)]);
  assert.equal(p.byStep['leave-am'].start, H(11));
  assert.deepEqual(p.warnings, [{ code: 'am-overrun', stepIds: ['bacon-fry'],
    text: 'Still on the stove when it is time to leave at 11:00 AM: Fry the bacon.' }]);
  // when the plan's own rules take the pot over on leaving ("the beans finish at her place"), that warning stands in
  assert.deepEqual(codes(E.project(PLAN, fresh(), H(10, 30))), ['deferred', 'beans-later']);
});

test('nextUnlock: two timers end together before the hard out, it names the one pick will give him', () => {
  const p = restPlan();
  // onions steeping until 9:30, beans resting until 9:30 ("beans off" is a must, but later in the master order)
  const s = run(mornOf(p, ['onion-dunk', 'onion-jar', 'beans-check', 'beans-off']), [['onion-dunk', H(9)], ['beans-check', H(9, 5)]], p);
  assert.equal(E.pick(p, s, H(9, 10)), null);
  assert.equal(E.nextStep(p, s, H(9, 30)), 'onion-jar');
  assert.deepEqual(E.nextUnlock(p, s, H(9, 10)), { at: H(9, 30), stepId: 'onion-jar', reason: 'wait' });
});

test('project: one step done the evening before leaves the plan on tomorrow morning', () => {
  const eve = H(20) - 24 * 60 * MIN;
  let s = fresh(eve);
  assert.equal(s.day, '2026-11-23');
  s = E.complete(PLAN, s, 'onion-slice', eve + 5 * MIN);
  const p = E.project(PLAN, s, eve + 5 * MIN);
  assert.equal(p.byStep['soak-q'].start, H(7));
  assert.equal(p.byStep['soak-q'].status, 'next');
  assert.ok(stepRows(p).filter((r) => r.status !== 'done').every((r) => r.start >= H(7)));
});

test('uncomplete: a step that is not done changes nothing, also when another step runs the same timer', () => {
  const p = fixture();
  step(p, 'beans-quick').wait = { id: 'beans', mins: 90, label: 'Beans simmering (long)', attended: true };
  step(p, 'beans-quick').after = ['soak-q'];
  step(p, 'beans-start').when = { soaked: true };
  delete step(p, 'beans-start').afterWait;
  let v = run(E.initialState(p, 't', H(6)), [['soak-q', H(7), { value: false }], ['beans-quick', H(7, 5)]], p);
  assert.equal(E.uncomplete(p, v, 'beans-start', H(7, 6)), v, 'beans-start is not done: the timer of beans-quick stays');
  assert.equal('beans' in E.uncomplete(p, v, 'beans-quick', H(7, 6)).waits, false);
  // both variants done (he changed his answer): taking one back leaves the timer the other one started
  v = E.setOpt(p, v, 'soaked', true, H(7, 7));
  v = E.complete(p, v, 'beans-start', H(7, 20));
  assert.deepEqual(E.uncomplete(p, v, 'beans-quick', H(7, 21)).waits.beans, { start: H(7, 20), mins: 60, by: 'beans-start' });
});

test('uncomplete: what the step\'s rules set is taken back, unless something else still explains it', () => {
  let s = run(fresh(), [['soak-q', H(7), { value: true }], ['beans-start', H(7, 10)]]);
  const left = E.complete(PLAN, s, 'leave-am', H(7, 30));       // a stray "I'm leaving now"
  assert.equal(left.opts.beansLater, true);
  const undone = E.uncomplete(PLAN, left, 'leave-am', H(7, 31));
  assert.equal(E.location(PLAN, undone), 'home-am');
  assert.deepEqual(undone.opts, s.opts, 'the beans are back in the morning plan');
  assert.equal(E.isActive(PLAN, undone, 'beans-check'), true);
  // another rule whose step is still done sets the same thing: it stays
  const p = fixture();
  p.rules.push({ on: 'sauce', set: { beansLater: true } });
  let t = run(E.initialState(p, 't', H(6)), [['sauce', H(7)], ['leave-am', H(7, 30)]], p);
  assert.equal(E.uncomplete(p, t, 'leave-am', H(7, 31)).opts.beansLater, true);
  assert.equal('beansLater' in E.uncomplete(p, E.uncomplete(p, t, 'leave-am', H(7, 31)), 'sauce', H(7, 32)).opts, false);
  // an option that was changed since is not this rule's value any more: left alone
  t = E.setOpt(PLAN, left, 'beansLater', false, H(7, 31));
  assert.equal(E.uncomplete(PLAN, t, 'leave-am', H(7, 32)).opts.beansLater, false);
});

test('opt: a stored null falls back to the default (SPEC 3.3 uses ??)', () => {
  const s = Object.assign({}, fresh(), { opts: { soaked: null } });
  assert.equal(E.opt(PLAN, s, 'soaked'), true);
  assert.equal(E.isActive(PLAN, s, 'beans-start'), true);
  assert.equal(E.isActive(PLAN, s, 'beans-quick'), false);
});

test('reducers: a clock that is not a number changes nothing', () => {
  const s = richState();
  for (const now of [NaN, undefined, null, Infinity, '7']) {
    assert.equal(E.complete(PLAN, s, 'sauce', now), s);
    assert.equal(E.uncomplete(PLAN, s, 'beans-start', now), s);
    assert.equal(E.skip(PLAN, s, 'garnish', now), s);
    assert.equal(E.retry(PLAN, s, 'beans-check', now), s);
    assert.equal(E.giveUp(PLAN, s, 'beans-check', now), s);
    assert.equal(E.tick(PLAN, s, 'pack-bag', 'salt', true, now), s);
    assert.equal(E.tickTonight(PLAN, s, 'soak', true, now), s);
    assert.equal(E.setOpt(PLAN, s, 'soaked', false, now), s);
    assert.equal(E.setAnchor(PLAN, s, 'dinner', 1185, now), s);
    assert.equal(E.startFg(PLAN, s, 'sauce', T + 30000, now), s);
    assert.equal(E.clearFg(PLAN, s, now), s);
    assert.equal(E.setDay(PLAN, s, '2026-11-24', now), s);
  }
});

// ---------------------------------------------------------------- the real plan, when it is there

// plan.js is written by someone else. These checks only run when the file exists; they never change it.
let REAL = null;
try { REAL = require('./plan.js'); } catch (e) { REAL = null; }
const noPlan = !REAL || !Array.isArray(REAL.steps) ? 'plan.js is not there yet' : false;

test('real plan: passes validate()', { skip: noPlan }, () => {
  assert.deepEqual(E.validate(REAL), []);
});

test('real plan: the default day is clean and on time', { skip: noPlan }, () => {
  const s = E.initialState(REAL, 't', H(6, 50));
  const p = E.project(REAL, s, H(6, 50));
  assert.equal(p.lateMin, 0);
  assert.equal(p.dinnerAt, E.anchorMs(s, 'dinner'));
  assert.deepEqual(codes(p), []);
  assert.ok(chronological(p));
  const seen = timesOf(p);
  for (const st of REAL.steps) {
    const n = seen.filter((id) => id === st.id).length;
    if (!E.isActive(REAL, s, st)) assert.equal(n, 0, st.id + ' is not part of the default day');
    else if (!st.optional) assert.equal(n, 1, st.id + ' must be scheduled exactly once');
  }
  for (const name of ['leaveAm', 'backHome', 'leavePm', 'arrive']) {
    const mv = REAL.steps.find((x) => x.kind === 'move' && x.move === name);
    assert.equal(p.byStep[mv.id].start, E.anchorMs(s, name), name + ' happens at its anchor');
  }
});

test('real plan: a start up to 9:30 keeps dinner on time; a later start is at most 20 min late; nothing needed is ever dropped', { skip: noPlan }, () => {
  const s = E.initialState(REAL, 't', H(6, 50));
  for (let m = 7 * 60; m <= 10 * 60 + 30; m += 5) {
    const p = E.project(REAL, s, H(0, m));
    const at = E.fmtClock(H(0, m));
    if (m <= 9 * 60 + 30) assert.equal(p.lateMin, 0, 'dinner on time for a ' + at + ' start');
    else assert.ok(p.lateMin <= 20, 'dinner at most 20 min late for a ' + at + ' start, got ' + p.lateMin);
    assert.notEqual(p.dinnerAt, null, 'dinner is planned for a ' + at + ' start');
    assert.equal(warning(p, 'missed'), undefined, 'nothing missed for a ' + at + ' start');
    assert.ok(chronological(p));
  }
});

test('real plan: following the engine step by step ends with dinner served', { skip: noPlan }, () => {
  // the way the phone uses the engine: pick, do it, repeat; wait for unlocks; move when told
  let s = E.initialState(REAL, 't', H(6, 50));
  let now = H(7), guard = 0, left = null;
  const anchorOf = { 'home-am': 'leaveAm', away: 'backHome', 'home-pm': 'leavePm', drive: 'arrive' };
  const moveId = (name) => REAL.steps.find((x) => x.kind === 'move' && x.move === name).id;
  while (!E.isDone(REAL, s, 'dinner') && guard++ < 2000) {
    const loc = E.location(REAL, s);
    const st = E.pick(REAL, s, now);
    if (st) {
      assert.equal(E.isAvailable(REAL, s, st, now), true, st.id + ' was picked but is not available');
      if (st.kind !== 'move') now += E.stepMins(st) * MIN;
      else if (st.move === 'leavePm') left = now;
      s = E.complete(REAL, s, st.id, now, st.kind === 'choice' ? { value: E.opt(REAL, s, st.choice.opt) } : undefined);
      continue;
    }
    if (loc === 'drive') { now = Math.max(now, left + 30 * MIN); s = E.complete(REAL, s, moveId('arrive'), now); continue; }
    const u = E.nextUnlock(REAL, s, now);
    if (u) { assert.ok(u.at > now); now = u.at; continue; }
    assert.ok(anchorOf[loc], 'stuck in ' + loc + ' at ' + E.fmtClock(now));
    now = Math.max(now, E.anchorMs(s, anchorOf[loc]));
    s = E.complete(REAL, s, moveId(anchorOf[loc]), now);
    if (anchorOf[loc] === 'leavePm') left = now;
  }
  assert.equal(E.isDone(REAL, s, 'dinner'), true);
  assert.equal(s.done.dinner, E.anchorMs(s, 'dinner'), 'served at the dinner anchor');
  const open = REAL.steps.filter((x) => !x.optional && E.isActive(REAL, s, x) && !E.isDone(REAL, s, x)).map((x) => x.id);
  assert.deepEqual(open, [], 'nothing left open');
  assert.deepEqual(E.alerts(REAL, s, now), []);
  const p = E.project(REAL, s, now);
  assert.ok(stepRows(p).every((r) => r.status === 'done'));
  assert.equal(p.lateMin, 0);
});
