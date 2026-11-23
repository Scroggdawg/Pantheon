#!/usr/bin/env node
/*
 * Builds the paper back-up and the written schedules from the plan data.
 *
 *   node ceviche-night/app/dev/make-docs.js          (no arguments)
 *
 * Reads   ../plan.js (all content) and ../engine.js (the schedule). Dish colours come from ../index.html and
 *         the place names from ../app.js, so the paper matches the app (built-in fallbacks if they cannot be read).
 * Writes  into ceviche-night/ (overwriting):
 *           run-sheet.html + run-sheet.pdf   the paper run sheet (Letter, portrait)
 *           master-schedule.md               the whole day on one list
 *           schedule-*.md                    one per dish (see DISH_FILES)
 *           recipes-scaled.md                the recipes on their own, no clock times
 *
 * The day that gets printed: Engine.initialState + the option soaked = true, every anchor at its default,
 * projected with Engine.project. A second projection with soaked = false feeds "If you did not soak the beans".
 * Steps are always listed by projected time, never by their place in plan.steps.
 *
 * Nothing about the food is written in this file: every quantity, step, time and count is read from the
 * data when the script runs, so run it again after plan.js or engine.js changes.
 * Prints one line per file. Exits non-zero when something is missing (see checkDay / checkText / main).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(APP_DIR, '..');

/* ---- the one mapping table: schedule file <-> dish ---------------------------------------------- */
const DISH_FILES = [
  { id: 'scoop',  nick: 'The Classic Scoop', file: 'schedule-1-the-classic-scoop.md' },
  { id: 'pink',   nick: 'Smoke & Pink',      file: 'schedule-2-smoke-and-pink.md' },
  { id: 'patron', nick: 'The Patrón',        file: 'schedule-3-the-patron.md' },
  { id: 'milky',  nick: 'The Milky Way',     file: 'schedule-4-the-milky-way.md' },
  { id: 'blanch', nick: 'The Blanch',        file: 'schedule-5-the-blanch.md' },
  { id: 'cream',  nick: 'The Smoky Cream',   file: 'schedule-6-the-smoky-cream.md' },
  { id: 'elote',  nick: 'Elote',             file: 'schedule-8-elote.md' }
];

/* ---- labels for the sheet itself (not recipe content). The app's own tables win when they can be read. */
let PLACE_LABEL = { 'home-am': 'Your kitchen · morning', 'away': 'Out', 'home-pm': 'Your kitchen · pack up', 'drive': 'Drive', 'hers': 'Her kitchen' };
let DAY_DISH = { id: 'day', nick: 'The day', name: '', color: 'day' };
const CONTAINER_LABEL = { home: 'At your place', hers: 'At her place' };
const NO_SOAK_TITLE = 'If you did not soak the beans';
const FALLBACK_COLOR = '#4A5568';
const MIN = 60000;

let P, E;                      // plan, engine
const problems = [];           // anything here makes the exit code non-zero
const notes = [];              // worth a line in the summary, not a failure
let DISH_COLOR = {};
let stepById = {};
let dishById = {};

/* ================================================================================================
 * loading
 * ============================================================================================== */

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// plan.js / engine.js may be half-saved by someone else: wait and try again.
async function loadModule(file) {
  for (let tries = 0; ; tries++) {
    try {
      delete require.cache[require.resolve(file)];
      return require(file);
    } catch (e) {
      if (!(e instanceof SyntaxError) || tries >= 9) throw e;
      console.error(path.basename(file) + ' does not parse right now (probably mid-save). Trying again in 20 seconds.');
      await sleep(20000);
    }
  }
}

function readAppTables() {
  // dish colours: the light-theme tokens in index.html (--d-scoop: #08737C; ...)
  try {
    const css = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
    const re = /--d-([a-z0-9]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
    let m;
    while ((m = re.exec(css))) if (!DISH_COLOR[m[1]]) DISH_COLOR[m[1]] = m[2];   // first one = light theme
  } catch (e) { notes.push('index.html not readable: dish tags use one neutral colour.'); }
  // place names and the name of the "day" pseudo-dish, as the app shows them
  try {
    const js = fs.readFileSync(path.join(APP_DIR, 'app.js'), 'utf8');
    const pairs = function (literal) {                     // 'key': 'text' pairs of a flat object literal, read as text
      const o = {}, re = /['"]?([\w-]+)['"]?\s*:\s*'((?:[^'\\]|\\.)*)'/g;
      let m;
      while ((m = re.exec(literal))) o[m[1]] = m[2].replace(/\\(.)/g, '$1');
      return o;
    };
    const loc = /LOC_TITLE\s*=\s*(\{[^}]*\})/.exec(js);
    if (loc) PLACE_LABEL = Object.assign({}, PLACE_LABEL, pairs(loc[1]));
    const day = /DAY_DISH\s*=\s*(\{[^}]*\})/.exec(js);
    if (day && pairs(day[1]).nick) DAY_DISH = Object.assign({}, DAY_DISH, { nick: pairs(day[1]).nick });
  } catch (e) { /* keep the built-in labels */ }
  if (P.placeLabels && typeof P.placeLabels === 'object') PLACE_LABEL = Object.assign({}, PLACE_LABEL, P.placeLabels);
}

/* ================================================================================================
 * text helpers
 * ============================================================================================== */

const TERM_RE = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
function plain(t) {            // [[key|shown]] -> shown, [[key]] -> key
  return String(t == null ? '' : t).replace(TERM_RE, function (_, k, shown) { return shown ? shown : k.trim(); });
}
function termsOf(step) {       // glossary terms a step links to, in reading order
  const seen = {}, out = [];
  [].concat(step.body || [], step.look || [], step.tip || [], step.warn || []).forEach(function (t) {
    let m; TERM_RE.lastIndex = 0;
    while ((m = TERM_RE.exec(String(t)))) {
      const k = m[1].trim();
      if (!seen[k] && P.glossary && P.glossary[k]) { seen[k] = 1; out.push(P.glossary[k].term); }
    }
  });
  return out;
}
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ESC[c]; }); }
function mdEsc(s) { return String(s == null ? '' : s).replace(/([*`<|\\])/g, '\\$1'); }

// a length of time inside a sentence: "30 seconds", "5 to 8 minutes", "2 more minutes", "12-minute", "2 weeks",
// and the spelled-out ones: "an hour", "a minute or two", "a few minutes" (never "a second ...", which is a count)
const DUR_RE = new RegExp(
  '(?:(?:\\b\\d+[½¼¾]?|[½¼¾])(?: (?:to|or) \\d+[½¼¾]?)?(?: more)?[ -](?:seconds?|minutes?|hours?|days?|weeks?)' +
  '|\\ban? (?:minute|hour|day|week)(?: or (?:two|so|more))?' +
  '|\\b(?:a few|several) (?:seconds|minutes|hours|days|weeks))\\b', 'g');
function richH(t) { return esc(plain(t)).replace(DUR_RE, function (m) { return '<b>' + m + '</b>'; }); }
function richM(t) { return mdEsc(plain(t)).replace(DUR_RE, function (m) { return '**' + m + '**'; }); }

function clock(ms) { return E.fmtClock(ms); }
function words(mins) {         // spelled out: "30 seconds", "8 minutes", "1 hour 20 minutes"
  const secs = Math.max(0, Math.round(mins * 60));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60, parts = [];
  if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
  if (m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
  if (s) parts.push(s + (s === 1 ? ' second' : ' seconds'));
  return parts.join(' ') || '0 minutes';
}
function listAnd(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function dishOf(step) { return dishById[step.dish] || DAY_DISH; }
function colorOf(dish) { return DISH_COLOR[dish.color] || DISH_COLOR.day || FALLBACK_COLOR; }
function placeLabel(loc) { return PLACE_LABEL[loc] || String(loc || ''); }
function handsOn(step) { const m = E.stepMins(step); return m > 0 ? E.fmtDur(m) : ''; }
function sentence(s) { s = String(s || '').trim(); return /[.!?]$/.test(s) ? s : s + '.'; }

/* ================================================================================================
 * the day model: one projection turned into a list of entries a writer can print
 * ============================================================================================== */

function startState(soaked) {
  // Any fixed day works: only clock times are ever printed. 3 AM = before the start anchor, same calendar day.
  const now = new Date(2026, 0, 14, 3, 0, 0, 0).getTime();
  let st = E.initialState(P, 'docs', now);
  st = E.setOpt(P, st, 'soaked', soaked, now);
  return { st: st, now: now };
}

function buildDay(st, now) {
  const pr = E.project(P, st, now);
  const waitRows = pr.rows.filter(function (r) { return r.type === 'wait'; });
  const used = new Set();
  const entries = [];
  let sim = st;                                            // replayed alongside, so lists read as they will at that moment
  pr.rows.forEach(function (r) {
    if (r.type === 'wait') return;
    if (r.type === 'free') { entries.push({ type: 'free', start: r.start, end: r.end, loc: r.loc }); return; }
    const step = stepById[r.stepId];
    if (!step) return;
    const isMove = r.type === 'move';
    const e = { type: r.type, step: step, start: isMove ? r.at : r.start, end: isMove ? r.at : r.end, loc: r.loc,
                deferred: r.deferred === true, late: r.late === true };
    if (step.kind === 'checklist') e.items = E.checklistItems(P, sim, step);
    if (r.status !== 'done') {
      let payload;
      if (step.kind === 'choice' && step.choice) payload = { value: E.opt(P, sim, step.choice.opt) };
      sim = E.complete(P, sim, step.id, e.end, payload);
    }
    if (step.wait && step.wait.id) {
      const w = waitRows.find(function (x) { return !used.has(x) && x.waitId === step.wait.id && x.start === e.end; }) ||
                waitRows.find(function (x) { return !used.has(x) && x.waitId === step.wait.id; });
      if (w) { used.add(w); e.wait = { def: step.wait, label: w.label, start: w.start, end: w.end }; }
    }
    entries.push(e);
  });

  // A question answered ahead of time (the soak) is not in the projection. Print it just before the first step that needs it.
  P.steps.forEach(function (s) {
    if (s.kind !== 'choice' || !s.choice || entries.some(function (e) { return e.step === s; })) return;
    if (!E.isActive(P, st, s) || !E.isDone(P, st, s)) return;
    let at = entries.findIndex(function (e) { return e.step && (e.step.after || []).indexOf(s.id) >= 0; });
    if (at < 0) at = 0;
    const ref = entries[at];
    if (!ref) return;
    entries.splice(at, 0, { type: 'step', step: s, start: ref.start, end: ref.start, loc: ref.loc, answered: true,
                            value: E.opt(P, st, s.choice.opt) });
  });

  const byId = {};
  entries.forEach(function (e) { if (e.step) byId[e.step.id] = e; });
  let n = 0;
  entries.forEach(function (e) { if (e.step && !e.answered) e.n = ++n; });

  const groups = [];
  entries.forEach(function (e) {
    let g = groups[groups.length - 1];
    if (!g || g.loc !== e.loc) { g = { loc: e.loc, label: placeLabel(e.loc), entries: [], start: e.start, end: e.end }; groups.push(g); }
    g.entries.push(e); g.end = Math.max(g.end, e.end);
  });
  groups.forEach(function (g, i) {                         // a place lasts from the move that brought him there
    const before = i ? groups[i - 1].entries[groups[i - 1].entries.length - 1] : null;
    if (before && before.type === 'move') g.start = before.start;
  });
  return { st: st, sim: sim, pr: pr, entries: entries, byId: byId, groups: groups };
}

function waitInfo(day, e) {
  if (!e.wait) return null;
  const def = e.wait.def, mins = (e.wait.end - e.wait.start) / MIN;
  const lapMins = (def.laps || []).filter(function (m) { return m > 0 && m < mins; }).sort(function (a, b) { return a - b; });
  const gated = P.steps.filter(function (s) { return s.afterWait === def.id && day.byId[s.id]; })
                       .sort(function (a, b) { return day.byId[a.id].start - day.byId[b.id].start; })[0] || null;
  return { label: e.wait.label, mins: mins, end: e.wait.end, lapMins: lapMins,
           lapTimes: lapMins.map(function (m) { return e.wait.start + m * MIN; }),
           lapLabel: def.lapLabel || '', maxMins: typeof def.max === 'number' ? def.max : null,
           maxAt: typeof def.max === 'number' ? e.wait.start + def.max * MIN : null, then: gated };
}
// The timer of a step that is in no planned day: lengths only, no clock times. pool = the steps it is listed with.
function offPlanWait(step, pool) {
  const def = step.wait;
  const lapMins = (def.laps || []).filter(function (m) { return m > 0 && m < def.mins; }).sort(function (a, b) { return a - b; });
  return { label: def.label || '', mins: def.mins, lapMins: lapMins, lapLabel: def.lapLabel || '',
           maxMins: typeof def.max === 'number' ? def.max : null,
           then: (pool || []).find(function (q) { return q.afterWait === def.id; }) || null };
}
function notBeforeAt(day, step) {
  const nb = step.notBefore;
  if (!nb || step.id === 'dinner') return null;
  const a = E.anchorMs(day.st, nb.anchor);
  return isFinite(a) ? a + (nb.mins || 0) * MIN : null;
}
function notBeforeWords(step) {            // for the recipes, which carry no clock times
  const nb = step.notBefore;
  if (!nb || !nb.mins || step.id === 'dinner') return '';
  const label = String((P.anchorLabels || {})[nb.anchor] || nb.anchor).toLowerCase();
  return 'Not earlier than **' + words(Math.abs(nb.mins)) + '** ' + (nb.mins < 0 ? 'before' : 'after') + ' ' + label + '.';
}
function giveUpFrom(day, step) {
  const g = step.check && step.check.giveUp;
  if (!g || !g.withinMinsOf) return null;
  const a = E.anchorMs(day.st, g.withinMinsOf.anchor);
  return isFinite(a) ? a - g.withinMinsOf.mins * MIN : null;
}

// What changes between the main day and another version of it, in the other version's order.
const SMALL_SHIFT = 5;        // minutes: a step that moves by no more than this can be folded into a run
function compareDays(base, alt) {
  const list = alt.entries.filter(function (e) { return e.step; });
  let first = -1, last = -1;
  list.forEach(function (e, i) {
    const b = base.byId[e.step.id];
    e.change = !b ? 'new' : (clock(b.start) !== clock(e.start) || b.loc !== e.loc) ? 'moved' : 'same';
    e.was = b || null;
    e.shift = b ? Math.round((e.start - b.start) / MIN) : 0;
    if (e.change !== 'same') { if (first < 0) first = i; last = i; }
  });
  const removed = base.entries.filter(function (e) { return e.step && !alt.byId[e.step.id]; });
  const rows = [];
  const foldable = function (e) { return e.change !== 'new' && e.was.loc === e.loc && Math.abs(e.shift) <= SMALL_SHIFT; };
  if (first >= 0) {
    const span = list.slice(first, last + 1);
    for (let i = 0; i < span.length; i++) {
      const e = span[i];
      let j = i;
      if (foldable(e)) while (j + 1 < span.length && foldable(span[j + 1]) && span[j + 1].was.n > span[j].was.n) j++;
      if (j > i) {
        const part = span.slice(i, j + 1), shifts = part.map(function (x) { return x.shift; }), ranges = [];
        part.forEach(function (x) {                        // "steps 6 to 9 and 11 to 21": the printed numbers it covers
          const r = ranges[ranges.length - 1];
          if (r && x.was.n === r[1].was.n + 1) r[1] = x; else ranges.push([x, x]);
        });
        rows.push({ kind: 'run', from: e, to: span[j], part: part, ranges: ranges, lo: Math.min.apply(null, shifts), hi: Math.max.apply(null, shifts) });
        i = j;
      } else rows.push({ kind: e.change, e: e });
    }
  }
  const after = last >= 0 && last + 1 < list.length ? list[last + 1] : null;
  return { rows: rows, removed: removed, sameFrom: after ? after.start : null,
           added: list.filter(function (e) { return e.change === 'new'; }),
           moved: list.filter(function (e) { return e.change === 'moved'; }) };
}
function rangeWords(r) {       // "6 to 9 and 11 to 21"
  return listAnd(r.ranges.map(function (x) { return x[0] === x[1] ? String(x[0].was.n) : x[0].was.n + ' to ' + x[1].was.n; }));
}
function runWords(r) {         // how a folded run of steps differs from the printed times
  if (r.lo === 0 && r.hi === 0) return 'Same times as printed.';
  const n = Math.max(Math.abs(r.lo), Math.abs(r.hi)), unit = n === 1 ? ' minute' : ' minutes';
  if (r.lo === r.hi) return 'Each one ' + n + unit + (r.lo > 0 ? ' later' : ' earlier') + ' than printed.';
  if (r.lo >= 0) return 'Up to ' + n + unit + ' later than printed.';
  if (r.hi <= 0) return 'Up to ' + n + unit + ' earlier than printed.';
  return 'Within ' + n + unit + ' of the printed times.';
}

// Steps that are in no planned day: they only happen when a check is given up on ("finish them at her place").
function planBs(base, alt) {
  const out = [];
  P.steps.forEach(function (c) {
    const g = c.kind === 'check' && c.check && c.check.giveUp;
    const at = base.byId[c.id];
    if (!g || !g.set || !at) return;
    const keys = Object.keys(g.set);
    const on = P.steps.filter(function (s) {
      return !base.byId[s.id] && !alt.byId[s.id] && s.when && keys.some(function (k) { return s.when[k] === g.set[k]; });
    });
    if (!on.length) return;
    const off = base.entries.filter(function (e) {
      return e.step && e.step.when && keys.some(function (k) { return k in e.step.when && e.step.when[k] !== g.set[k]; });
    });
    const seen = new Set([c.id]);                          // everything in the main day that waits for this check
    for (let grew = true; grew;) {
      grew = false;
      base.entries.forEach(function (e) {
        if (e.step && !seen.has(e.step.id) && (e.step.after || []).some(function (id) { return seen.has(id); })) { seen.add(e.step.id); grew = true; }
      });
    }
    const later = base.entries.filter(function (e) {       // ...that was planned for the same place and can move
      return e.step && seen.has(e.step.id) && e.loc === at.loc && e.step.where === 'either' && off.indexOf(e) < 0;
    });
    const pool = on.filter(function (s) { return s.where === 'home'; }).concat(on.filter(function (s) { return s.where !== 'home'; }),
                 later.map(function (e) { return e.step; }));
    const order = [], inPool = new Set(pool.map(function (s) { return s.id; })), placed = new Set();
    while (order.length < pool.length) {                   // keep the order above, but never before a step it needs
      const next = pool.find(function (s) {
        return !placed.has(s.id) && (s.after || []).every(function (id) { return !inPool.has(id) || placed.has(id); });
      }) || pool.find(function (s) { return !placed.has(s.id); });
      placed.add(next.id); order.push(next);
    }
    out.push({ check: c, at: at, label: g.label, from: giveUpFrom(base, c), on: on, off: off, order: order });
  });
  return out;
}
function whereLabel(step) { return step.where === 'hers' ? placeLabel('hers') : placeLabel('home-am').split(' · ')[0]; }

// The steps a dish file lists: its own, plus the shared "day" steps tied to them by an `after` link (in either direction).
function dishEntries(day, dish) {
  const own = day.entries.filter(function (e) { return e.step && e.step.dish === dish.id; });
  const ownIds = own.map(function (e) { return e.step.id; });
  const shared = day.entries.filter(function (e) {
    if (!e.step || e.step.dish !== 'day') return false;
    const k = e.step.kind || 'do';
    if (k !== 'do' && k !== 'check') return false;
    const needsMine = (e.step.after || []).some(function (id) { return ownIds.indexOf(id) >= 0; });
    const iNeedIt = own.some(function (o) { return (o.step.after || []).indexOf(e.step.id) >= 0; });
    return needsMine || iNeedIt;
  });
  const sharedSet = new Set(shared);
  return own.concat(shared).sort(function (a, b) { return a.start - b.start || day.entries.indexOf(a) - day.entries.indexOf(b); })
            .map(function (e) { return { e: e, shared: sharedSet.has(e) }; });
}

// Pack lists in the order they are packed, each as it stands when its checklist step comes up.
function packLists(day) {
  const out = Object.keys(P.pack || {}).map(function (which, i) {
    const e = day.entries.find(function (x) { return x.step && x.step.kind === 'checklist' && x.step.items === which; });
    const items = e ? e.items : E.packList(P, day.sim, which);
    const shown = new Set(items.map(function (it) { return it.id; }));
    const hidden = (P.pack[which] || []).filter(function (it) { return !shown.has(it.id); });
    return { which: which, order: e ? e.start : Infinity, i: i, e: e || null, items: items, hidden: hidden };
  });
  return out.sort(function (a, b) { return a.order - b.order || a.i - b.i; });
}
function conditionWords(it) {                               // when a pack item that is not on the default list is needed
  const bits = [];
  const t = function (id) { return stepById[id] ? stepById[id].title : id; };
  if (it.ifDone != null) bits.push('“' + t(it.ifDone) + '” is done');
  if (it.ifNotDone != null) bits.push('“' + t(it.ifNotDone) + '” is not done');
  if (it.when) bits.push('the plan changed');
  return bits.join(' and ');
}
function itemText(it) {                                    // "label: note"; a note that starts with "and" just carries on
  if (!it.note) return it.label;
  return it.label + (/^(and|or|plus)\b/i.test(it.note) ? ', ' : ': ') + it.note;
}
function fixedTimes(day) {
  const a = day.st.anchors || {};
  return Object.keys(a).sort(function (x, y) { return a[x] - a[y]; }).map(function (k) {
    return { key: k, at: E.anchorMs(day.st, k), label: (P.anchorLabels || {})[k] || k };
  });
}
function mentionsApp() {                   // do the steps talk to the phone app ("Tap Done", "tap Yes", "the guide calls you back")?
  return P.steps.some(function (s) { return (s.body || []).some(function (b) { return /\b[Tt]ap [A-Z]|\b[Tt]he guide\b/.test(b); }); });
}

/* ================================================================================================
 * run-sheet.html
 * ============================================================================================== */

const CSS = `
@page { size: 8.5in 11in; margin: 0.5in; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; background: #fff; color: #000;
  font: 12.5pt/1.16 "Liberation Sans", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
b, strong { font-weight: 700; }
p { margin: 0; }
a { color: inherit; text-decoration: none; }
h1 { font-size: 27pt; line-height: 1.05; margin: 0 0 3pt; }
.contents { margin: 0 0 9pt; }
.contents b { white-space: nowrap; }
h2 { font-size: 21pt; line-height: 1.1; margin: 0 0 6pt; padding: 0 0 3pt; border-bottom: 2.5pt solid #000;
  display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; break-after: avoid; }
h2 .range { font-size: 13pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
h4 { font-size: 13.5pt; margin: 0 0 3pt; break-after: avoid; }
section { margin: 0 0 13pt; }
section.pb { break-before: page; }
.cols { column-count: 2; column-gap: 20pt; column-rule: 0.6pt solid #777; }
.lines { margin: 0 0 5pt; padding-left: 14pt; }
.lines li { margin: 0 0 2pt; break-inside: avoid; }
.lines.c2 { column-count: 2; column-gap: 20pt; }
.howto { border: 1pt solid #000; border-radius: 2pt; padding: 4pt 8pt 3pt; margin: 0 1pt 8pt 0; break-inside: avoid; }
.howto .lines { margin: 0; }

.box { flex: none; display: inline-block; width: 13pt; height: 13pt; border: 1.5pt solid #000; border-radius: 2pt; background: #fff; }
.sbox { flex: none; display: inline-block; width: 12pt; height: 12pt; border: 1.2pt solid #000; border-radius: 1.5pt; background: #fff; margin-top: 1.25pt; }

/* one step = one band across the page: what to do on the left, what to have and watch for on the right */
.step { break-inside: avoid; border-top: 0.75pt solid #555; border-left: 4pt solid var(--c, #444); padding: 3pt 1.5pt 4pt 7pt; }
.head { display: flex; align-items: baseline; gap: 7pt; }
.head .box { align-self: center; }
.time { font-size: 14pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tag { font-size: 10pt; font-weight: 700; line-height: 1.3; white-space: nowrap; color: #000; background: #fff;
  border: 1pt solid #000; border-left: 7pt solid var(--c, #444); border-radius: 2pt; padding: 0 4pt; align-self: center; }
.flag { font-size: 10pt; font-weight: 700; line-height: 1.3; white-space: nowrap; background: #000; color: #fff; border: 1pt solid #000; border-radius: 2pt; padding: 0 4pt; align-self: center; }
.head h3 { flex: 1 1 0; min-width: 0; font-size: 14pt; line-height: 1.15; font-weight: 700; margin: 0; }
h3 .n { font-weight: 400; }
.dur { white-space: nowrap; }
.bd { display: grid; column-gap: 9pt; margin-top: 2.5pt; }
.bd.stack { display: block; }
.side { border-left: 0.6pt solid #777; padding-left: 8pt; }
.bd.stack .side { border-left: 0; padding-left: 0; margin-top: 2pt; }
.side > :first-child { margin-top: 0; }
ul.body { margin: 0; padding-left: 13pt; }
ul.body li { margin: 0 0 1.5pt; }
ul.ticks { list-style: none; margin: 2pt 0 0; padding: 0; column-gap: 18pt; }
ul.ticks.c2 { column-count: 2; }
ul.ticks.c3 { column-count: 3; }
ul.ticks li { display: flex; gap: 6pt; align-items: flex-start; margin: 0 0 2.5pt; break-inside: avoid; }
.m { margin: 2.5pt 0 0; }
.timer { margin: 3pt 0 0; padding: 1.5pt 5pt; border: 1pt solid #000; border-radius: 2pt; }
.warn { margin: 3pt 0 0; padding: 2pt 5pt; border: 1.5pt solid #000; border-left: 6pt solid #000; }
.warn .lbl { letter-spacing: .04em; }
.gl { margin: 2.5pt 0 0; }
.step.k-move { border: 2pt solid #000; border-left: 7pt solid #000; padding: 4pt 7pt 5pt; margin: 3pt 1pt 3pt 0; }
.free { break-inside: avoid; border-top: 0.75pt solid #555; padding: 3pt 0 3pt 11pt; }
.free span { display: inline-block; border: 1pt dashed #444; border-radius: 2pt; padding: 1pt 8pt; }

.tonight { break-inside: avoid; margin: 0 0 6pt; }
.tonight .t { display: flex; gap: 6pt; align-items: flex-start; font-weight: 700; font-size: 13.5pt; line-height: 1.15; }
.tonight .t .box { margin-top: 1pt; }
.tonight ul { margin: 2pt 0 0 19pt; padding-left: 13pt; }
table.jars { width: 100%; border-collapse: collapse; margin: 0 0 7pt; }
table.jars td { vertical-align: top; padding: 1pt 8pt 1pt 0; border-bottom: 0.6pt solid #999; }
table.jars tr { break-inside: avoid; }
table.jars td.c { width: 17pt; padding-right: 4pt; }
table.jars td.nm { width: 27%; font-weight: 700; }
table.jars td.sz { width: 31%; }
.strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(80pt, 1fr)); gap: 0; border: 1pt solid #000; margin-right: 1pt; break-inside: avoid; }
.strip div { padding: 3pt 6pt 4pt; border-left: 1pt solid #000; }
.strip div:first-child { border-left: 0; }
.strip .t { display: block; font-size: 15pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }

.pack { break-inside: avoid; margin: 0 0 10pt; }
.pack h3 { font-size: 15.5pt; margin: 0 0 1pt; }
.ref { break-inside: avoid; display: flex; gap: 7pt; align-items: baseline; border-top: 0.75pt solid #555; padding: 1.5pt 0 1.5pt 11pt; }
.ref .box { align-self: flex-start; margin-top: 1pt; }
.ref .time { font-size: 12.5pt; min-width: 56pt; }
.ref.run .time { min-width: 0; }

.dish { border-left: 5pt solid var(--c, #444); padding-left: 8pt; margin: 0 0 11pt; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.dish h2 { font-size: 20pt; border-bottom: 0; margin: 0; padding: 0; display: block; break-after: avoid; }
.dish h2 .pl { font-size: 14pt; font-weight: 400; display: inline-block; }
.dish .meta { margin: 1pt 0 4pt; break-after: avoid; }
.dish ul { margin: 0 0 4pt; padding-left: 13pt; }
.dish li { margin: 0 0 1.5pt; break-inside: avoid; }
.dish li.sub { list-style: none; margin: 4pt 0 1.5pt -13pt; font-weight: 700; break-after: avoid; }
.g { break-inside: avoid; margin: 0 0 6pt; }
.g .term { font-weight: 700; font-size: 13pt; }

@media screen {
  a { text-decoration: underline; }
  html { background: #e8e8ec; }
  body { max-width: 8.5in; margin: 0 auto; padding: 0.5in; }
  section.pb { margin-top: 0.45in; padding-top: 0.3in; border-top: 1px dashed #888; }
}
@media screen and (max-width: 760px) {
  body { padding: 16px; }
  .cols, .lines.c2, ul.ticks.c2, ul.ticks.c3 { column-count: 1; }
  .bd { display: block; }
  .side { border-left: 0; padding-left: 0; margin-top: 2pt; }
  .head { flex-wrap: wrap; }
  .head h3 { order: 2; flex: 1 1 100%; }
  .dur { order: 1; margin-left: auto; }
  h2 { flex-wrap: wrap; }
  table.jars td.nm, table.jars td.sz { width: auto; }
}
`;

/* How wide to make the left side of a band. Rough text measuring is enough: it only picks one of a few widths. */
const CHAR_PT = 6.2;            // about one character at the body size, with a little slack for line ends
const BAND_PT = 528;            // inner width of a band
function linesFor(texts, width) {
  return texts.reduce(function (a, t) { return a + Math.max(1, Math.ceil(t.length * CHAR_PT / width)); }, 0);
}
function chooseSplit(left, right) {
  if (!right.length || !left.length) return { stack: true };
  let best = null;
  [0.44, 0.5, 0.56, 0.62, 0.68, 0.74].forEach(function (r) {
    const cost = Math.max(linesFor(left, (BAND_PT - 18) * r - 13), linesFor(right, (BAND_PT - 18) * (1 - r) - 5));
    if (!best || cost < best.cost || (cost === best.cost && Math.abs(r - 0.6) < Math.abs(best.r - 0.6))) best = { r: r, cost: cost };
  });
  const stacked = linesFor(left, BAND_PT - 13) + linesFor(right, BAND_PT);
  return stacked <= best.cost ? { stack: true } : { r: best.r };
}

function tickList(items) {
  const longest = items.reduce(function (a, it) { return Math.max(a, itemText(it).length); }, 0);
  const cls = items.length < 4 ? '' : longest <= 24 ? ' c3' : ' c2';
  return '<ul class="ticks' + cls + '">' + items.map(function (it) {
    return '<li><span class="sbox"></span><span>' + esc(itemText(it)) + '</span></li>';
  }).join('') + '</ul>';
}

// one step as a band. o.n = show the step number, o.flag = small label, o.refs = page numbers
function stepHtml(day, e, o) {
  o = o || {};
  const s = e.step, d = dishOf(s), kind = s.kind || 'do';
  const L = [], R = [];                                    // each: { h: html, t: plain text for measuring }
  (s.body || []).forEach(function (b) { L.push({ h: '<li>' + richH(b) + '</li>', t: plain(b), li: true }); });

  if (kind === 'choice' && s.choice) {
    (s.choice.options || []).forEach(function (op) {
      const mine = e.answered ? op.value === e.value : op.value === E.opt(P, day.st, s.choice.opt);
      let what = mine ? 'This sheet is written for this answer. Go on.' : 'The steps change.', whatH = esc(what);
      if (!mine && s.choice.opt === 'soaked' && op.value === false) {
        const pg = o.refs && o.refs.nosoak;
        what = 'Use “' + NO_SOAK_TITLE + '”' + (pg ? ', page ' + pg : '') + '.';
        whatH = 'Use “' + esc(NO_SOAK_TITLE) + '”' + (pg ? ', <a href="#nosoak">page ' + pg + '</a>' : '') + '.';
      }
      L.push({ h: '<li><span class="sbox"></span><span><b>' + esc(sentence(op.label)) + '</b> ' + whatH + '</span></li>', t: op.label + ' ' + what, tick: true });
    });
  }
  if (kind === 'check' && s.check) {
    const c = s.check, from = giveUpFrom(day, s);
    const yes = 'Go on to the next step.', no = 'Wait ' + words(c.retryMins || 0) + '. Then check again.';
    L.push({ h: '<li><span class="sbox"></span><span><b>' + esc(sentence(c.yes)) + '</b> ' + yes + '</span></li>', t: c.yes + ' ' + yes, tick: true });
    L.push({ h: '<li><span class="sbox"></span><span><b>' + esc(sentence(c.no)) + '</b> Wait <b>' + esc(words(c.retryMins || 0)) + '</b>. Then check again.</span></li>', t: c.no + ' ' + no, tick: true });
    if (c.giveUp) {
      const pg = o.refs && o.refs['planb-' + s.id];
      const tail = (from != null ? ' Only from ' + clock(from) + ' on.' : '') + (pg ? ' Then see page ' + pg + '.' : '');
      const tailH = (from != null ? ' Only from ' + clock(from) + ' on.' : '') + (pg ? ' Then see <a href="#planb-' + esc(s.id) + '">page ' + pg + '</a>.' : '');
      L.push({ h: '<li><span class="sbox"></span><span><b>' + esc(sentence(c.giveUp.label)) + '</b>' + tailH + '</span></li>', t: c.giveUp.label + tail, tick: true });
    }
  }

  // On paper the things to have at hand stay on one run-on line: one bullet per thing adds 3 pages to the sheet.
  if ((s.need || []).length) R.push({ h: '<p class="m"><b>You need:</b> ' + s.need.map(esc).join(' · ') + '</p>', t: 'You need: ' + s.need.join(' · ') });
  if (s.into) R.push({ h: '<p class="m"><b>Goes into:</b> ' + esc(plain(s.into)) + '</p>', t: 'Goes into: ' + plain(s.into) });
  const nb = notBeforeAt(day, s);
  if (nb != null) R.push({ h: '<p class="m">Not before <b>' + clock(nb) + '</b>.</p>', t: 'Not before ' + clock(nb) + '.' });
  if (s.timer) {
    const tt = 'Timer: ' + words(s.timer.secs / 60) + '.', rest = sentence(s.timer.label || '') + ' Stay here.';
    R.push({ h: '<p class="timer"><b>' + esc(tt) + '</b> ' + esc(rest) + '</p>', t: tt + ' ' + rest + '   ' });
  }
  const w = waitInfo(day, e);
  if (w) {
    let h = '<p class="timer"><b>Timer: ' + esc(words(w.mins)) + '.</b> ' + esc(sentence(w.label)) + ' Keep working. It ends about <b>' + clock(w.end) + '</b>.';
    const t = ['Timer: ' + words(w.mins) + '. ' + sentence(w.label) + ' Keep working. It ends about ' + clock(w.end) + '.   '];
    if (w.lapTimes.length) { const x = 'At ' + listAnd(w.lapTimes.map(clock)) + ': ' + sentence(w.lapLabel); h += '<br>' + esc(x); t.push(x); }
    if (w.maxAt != null) { h += '<br>Never longer than <b>' + esc(words(w.maxMins)) + '</b> (' + clock(w.maxAt) + ').'; t.push('Never longer than ' + words(w.maxMins) + ' (' + clock(w.maxAt) + ').'); }
    if (w.then) { const y = 'When it ends: ' + sentence(w.then.title); h += '<br>' + richH(y); t.push(y); }
    R.push({ h: h + '</p>', t: t[0] });
    t.slice(1).forEach(function (x) { R.push({ h: '', t: x }); });
  }
  if (!w && s.wait) {                                      // a step outside the planned day: lengths only, no clock time to give
    const ow = offPlanWait(s, o.then);
    let h = '<p class="timer"><b>Timer: ' + esc(words(ow.mins)) + '.</b> ' + esc(sentence(ow.label)) + ' Keep working.';
    const t = ['Timer: ' + words(ow.mins) + '. ' + sentence(ow.label) + ' Keep working.   '];
    if (ow.lapMins.length) {
      h += '<br>After ' + listAnd(ow.lapMins.map(function (m) { return '<b>' + esc(words(m)) + '</b>'; })) + ': ' + esc(sentence(ow.lapLabel));
      t.push('After ' + listAnd(ow.lapMins.map(words)) + ': ' + sentence(ow.lapLabel));
    }
    if (ow.maxMins != null) { h += '<br>Never longer than <b>' + esc(words(ow.maxMins)) + '</b>.'; t.push('Never longer than ' + words(ow.maxMins) + '.'); }
    if (ow.then) { const y = 'When it ends: ' + sentence(ow.then.title); h += '<br>' + richH(y); t.push(y); }
    R.push({ h: h + '</p>', t: t[0] });
    t.slice(1).forEach(function (x) { R.push({ h: '', t: x }); });
  }
  if (s.look) R.push({ h: '<p class="m"><b>Look for:</b> ' + richH(s.look) + '</p>', t: 'Look for: ' + plain(s.look) });
  if (s.tip) R.push({ h: '<p class="m"><b>Tip:</b> ' + richH(s.tip) + '</p>', t: 'Tip: ' + plain(s.tip) });
  if (s.warn) R.push({ h: '<p class="warn"><b class="lbl">WARNING:</b> ' + richH(s.warn) + '</p>', t: 'WARNING: ' + plain(s.warn) + '      ' });
  const terms = termsOf(s);
  if (terms.length) R.push({ h: '<p class="gl">Glossary: ' + terms.map(esc).join(' · ') + '</p>', t: 'Glossary: ' + terms.join(' · ') });

  let h = '<article class="step k-' + kind + '" style="--c:' + colorOf(d) + '">';
  h += '<div class="head"><span class="box"></span><span class="time">' + (o.slot ? esc(o.slot) : clock(e.start)) + '</span>' +
       '<span class="tag">' + esc(d.nick) + '</span>' + (o.flag ? '<span class="flag">' + esc(o.flag) + '</span>' : '') +
       '<h3>' + (o.n && e.n ? '<span class="n">' + e.n + '.</span> ' : '') + esc(s.title) + '</h3>' +
       (handsOn(s) && kind !== 'move' ? '<span class="dur">' + esc(handsOn(s)) + '</span>' : '') + '</div>';
  const lis = L.filter(function (x) { return x.li; }), ticks = L.filter(function (x) { return x.tick; });
  const leftHtml = (lis.length ? '<ul class="body">' + lis.map(function (x) { return x.h; }).join('') + '</ul>' : '') +
                   (ticks.length ? '<ul class="ticks">' + ticks.map(function (x) { return x.h; }).join('') + '</ul>' : '');
  const rightHtml = R.map(function (x) { return x.h; }).join('');
  if (leftHtml || rightHtml) {
    const sp = chooseSplit(L.map(function (x) { return x.t; }), R.map(function (x) { return x.t; }));
    if (sp.stack) h += '<div class="bd stack">' + (leftHtml ? '<div>' + leftHtml + '</div>' : '') + (rightHtml ? '<div class="side">' + rightHtml + '</div>' : '') + '</div>';
    else h += '<div class="bd" style="grid-template-columns:' + Math.round(sp.r * 100) + '% 1fr"><div>' + leftHtml + '</div><div class="side">' + rightHtml + '</div></div>';
  }
  if (kind === 'checklist') h += tickList(e.items || []);
  return h + '</article>';
}

function freeHtml(e) {
  return '<div class="free"><span>Free until <b>' + clock(e.end) + '</b>. About ' + esc(E.fmtDur((e.end - e.start) / MIN)) + '.</span></div>';
}

function frontHtml(base, refs, toc) {
  let h = '<section><h1>' + esc(P.title) + ' run sheet</h1><p class="contents">' + toc.map(function (t) {
    return '<a href="#' + esc(t.id) + '">' + esc(t.title) + ': <b>page ' + (refs[t.id] || '') + '</b></a>';
  }).join(' · ') + '</p>';
  h += '<h2>The night before</h2><div class="cols">';
  (P.tonight || []).forEach(function (t) {
    h += '<div class="tonight"><div class="t"><span class="box"></span><span>' + esc(t.title) + '</span></div><ul>' +
         (t.body || []).map(function (b) { return '<li>' + richH(b) + '</li>'; }).join('') + '</ul></div>';
  });
  h += '</div></section>';

  h += '<section><h2>Jars, tubs and bowls</h2>';
  Object.keys(P.containers || {}).forEach(function (k) {
    h += '<h4>' + esc(CONTAINER_LABEL[k] || k) + '</h4><table class="jars">' + P.containers[k].map(function (c) {
      return '<tr><td class="c"><span class="sbox"></span></td><td class="nm">' + esc(c.name) + '</td><td class="sz">' + esc(c.size) + '</td><td>' + esc(c.holds) + '</td></tr>';
    }).join('') + '</table>';
  });
  h += '</section>';

  h += '<section><h2>Fixed times</h2><div class="strip">' + fixedTimes(base).map(function (a) {
    return '<div><span class="t">' + clock(a.at) + '</span>' + esc(a.label) + '</div>';
  }).join('') + '</div></section>';
  return h;
}

function howToHtml() {
  return '<div class="howto"><ul class="lines">' +
    '<li>Tick the box when a step is done. The left side says what to do. The right side says what you need and what to look for.</li>' +
    '<li>The times are the plan. Running late? Keep the same order.</li>' +
    (mentionsApp() ? '<li>“Tap” and “the guide” mean the phone app. On paper, tick the box instead. Set your own timer for every box that starts with Timer.</li>' : '') +
    '</ul></div>';
}

function placeHtml(day, g, refs) {
  let h = '<h2><span>' + esc(g.label) + '</span><span class="range">' + clock(g.start) + ' to ' + clock(g.end) + '</span></h2>';
  g.entries.forEach(function (e) { h += e.type === 'free' ? freeHtml(e) : stepHtml(day, e, { n: true, refs: refs }); });
  return h;
}

function packHtml(day) {
  let h = '<h2>Pack lists</h2>';
  packLists(day).forEach(function (pl) {
    const title = pl.e ? pl.e.step.title : pl.which;
    h += '<div class="pack"><h3>' + esc(title) + '</h3>' +
         (pl.e ? '<p class="m">' + clock(pl.e.start) + ' · ' + esc(placeLabel(pl.e.loc)) + ' · step ' + pl.e.n + '</p>' : '') + tickList(pl.items) + '</div>';
    if (pl.hidden.length) {
      h += '<div class="pack"><p class="m"><b>' + esc(title) + ': only if a step did not get done</b></p>' + tickList(pl.hidden.map(function (it) {
        return { label: itemText(it) + '. Only if ' + conditionWords(it) + '.', note: '' };
      })) + '</div>';
    }
  });
  return h;
}

function refLine(alt, r) {
  const e = r.e, w = waitInfo(alt, e);
  let t = '<b>Step ' + e.was.n + ': ' + esc(sentence(e.step.title)) + '</b>';
  if (e.loc !== e.was.loc) t += ' Now at: ' + esc(placeLabel(e.loc)) + '.';
  if (w) {
    t += ' Timer ends about <b>' + clock(w.end) + '</b>.';
    if (w.lapTimes.length) t += ' At ' + listAnd(w.lapTimes.map(clock)) + ': ' + esc(sentence(w.lapLabel));
  }
  return '<div class="ref"><span class="box"></span><span class="time">' + clock(e.start) + '</span><span>' + t + '</span></div>';
}
function noSoakHtml(base, alt, cmp) {
  let h = '<h2>' + esc(NO_SOAK_TITLE) + '</h2><ul class="lines c2">' +
          '<li>Use this page for the morning.</li>' +
          '<li>Its times replace the printed ones.</li>' +
          '<li>Step numbers point to the main pages.</li>';
  cmp.removed.forEach(function (e) { h += '<li>Skip step ' + e.n + ': ' + esc(sentence(e.step.title)) + '</li>'; });
  if (cmp.sameFrom != null) h += '<li>From <b>' + clock(cmp.sameFrom) + '</b>: back to the main pages.</li>';
  h += '</ul>';
  cmp.rows.forEach(function (r) {
    if (r.kind === 'new') h += stepHtml(alt, r.e, { flag: 'Extra step' });
    else if (r.kind === 'run') h += '<div class="ref"><span class="box"></span><span class="time">' + clock(r.from.start) + '</span><span><b>Steps ' + rangeWords(r) + '.</b> ' + esc(runWords(r)) + '</span></div>';
    else h += refLine(alt, r);
  });
  return h;
}

function planBHead(b) {
  let h = '<h2>If you tick “' + esc(b.label) + '”</h2><ul class="lines c2">' +
          '<li>That answer is in step ' + b.at.n + ', “' + esc(b.check.title) + '”.' + (b.from != null ? ' Not before <b>' + clock(b.from) + '</b>.' : '') + '</li>';
  b.off.forEach(function (e) { h += '<li>Skip step ' + e.n + ': ' + esc(sentence(e.step.title)) + '</li>'; });
  return h + '<li>Then go down this list. Step numbers point to the main pages. Read the step there.</li></ul>';
}
function planBHtml(base, b) {
  let h = planBHead(b);
  b.order.forEach(function (s) {
    const e = base.byId[s.id];
    if (e) h += '<div class="ref"><span class="box"></span><span class="time">' + esc(whereLabel({ where: 'hers' })) + '</span><span><b>Step ' + e.n + ': ' + esc(sentence(s.title)) + '</b> Ignore the printed time.</span></div>';
    else h += stepHtml(base, { step: s, start: NaN, end: NaN, loc: null }, { slot: whereLabel(s), flag: 'Extra step', then: b.order });
  });
  return h;
}

function dishHtml(d) {
  let h = '<article class="dish" style="--c:' + colorOf(d) + '"><h2>' + esc(d.nick) + ' <span class="pl">' + esc(d.name) + '</span></h2>';
  h += '<p class="meta">Makes: ' + esc(d.makes || '') + '</p>';
  h += '<h4>Ingredients</h4><ul>' + (d.ingredients || []).map(function (r) {
    if (!r.item) return '<li class="sub">' + esc(r.qty) + '</li>';
    return '<li>' + (r.qty ? '<b>' + esc(r.qty) + '</b> ' : '') + esc(r.item) + (r.note ? ', ' + esc(r.note) : '') + '</li>';
  }).join('') + '</ul>';
  if ((d.gear || []).length) h += '<h4>Gear</h4><ul>' + d.gear.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  if ((d.notes || []).length) h += '<h4>Good to know</h4><ul>' + d.notes.map(function (x) { return '<li>' + richH(x) + '</li>'; }).join('') + '</ul>';
  return h + '</article>';
}

function glossaryHtml() {
  const terms = Object.keys(P.glossary || {}).map(function (k) { return P.glossary[k]; })
    .sort(function (a, b) { return a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }); });
  return '<h2>Glossary</h2><div class="cols">' + terms.map(function (g) {
    return '<div class="g"><div class="term">' + esc(g.term) + '</div>' +
           String(g.text || '').split('\n').map(function (l) { return '<p>' + richH(l) + '</p>'; }).join('') + '</div>';
  }).join('') + '</div>';
}

// The sheet as chunks, so the page each one starts on can be measured and printed in the contents line.
// pb = starts a new page. head = enough of the chunk to see where it lands when it follows on the same page.
function sheetChunks(base, alt, cmp, refs) {
  const places = [], toc = [];
  const big = function (g) { return g.entries.filter(function (e) { return e.step; }).length >= 6; };
  let cur = null;
  base.groups.forEach(function (g, i) {
    if (!cur || big(g)) { cur = { id: 'place' + i, parts: [] }; places.push(cur); toc.push({ id: cur.id, title: g.label }); }
    cur.parts.push(g);
  });
  const dayChunks = places.map(function (c, i) {
    const first = c.parts[0], lead = i === 0 ? howToHtml() : '';
    const headOnly = Object.assign({}, first, { entries: first.entries.slice(0, 1) });
    return { id: c.id, pb: i > 0,
             head: '<section>' + lead + placeHtml(base, headOnly, refs) + '</section>',
             html: '<section>' + lead + c.parts.map(function (g) { return placeHtml(base, g, refs); }).join('</section><section>') + '</section>' };
  });
  const rest = [
    { id: 'pack', title: 'Pack lists', html: '<section>' + packHtml(base) + '</section>' },
    { id: 'nosoak', title: NO_SOAK_TITLE, html: '<section>' + noSoakHtml(base, alt, cmp) + '</section>' },
    { id: 'dishes', title: 'Ingredients and gear', html: '<section><div class="cols">' + (P.dishes || []).map(dishHtml).join('') + '</div></section>' },
    { id: 'glossary', title: 'Glossary', html: '<section>' + glossaryHtml() + '</section>' }
  ];
  rest.forEach(function (r) { r.pb = true; });
  planBs(base, alt).forEach(function (b) {                 // goes after the pack lists, on the same page when it fits
    rest.splice(1, 0, { id: 'planb-' + b.check.id, title: '“' + b.label + '”', pb: false,
                        head: '<section>' + planBHead(b) + '</section>', html: '<section>' + planBHtml(base, b) + '</section>' });
  });
  rest.forEach(function (r) { toc.push({ id: r.id, title: r.title }); });
  const front = { id: 'front', pb: false, html: frontHtml(base, refs, toc) };
  return [front].concat(dayChunks, rest);
}
function sheetHtml(chunks, headOfLast) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(P.title) + ' run sheet</title>\n<style>' + CSS + '</style>\n</head>\n<body>\n' +
    chunks.map(function (c, i) {
      const html = headOfLast && i === chunks.length - 1 && c.head ? c.head : c.html;
      return '<div id="' + c.id + '">' + (c.pb ? html.replace('<section>', '<section class="pb">') : html) + '</div>';
    }).join('\n') + '\n</body>\n</html>\n';
}

function pdfPages(buf) { return (buf.toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length; }

async function makeSheet(base, alt, cmp) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const runHead = P.title + ' run sheet';
  const bar = 'width:100%;box-sizing:border-box;padding:0 0.5in;font-family:Helvetica,Arial,sans-serif;font-size:8.5pt;color:#000;display:flex;justify-content:space-between;';
  const pdfOpts = {
    format: 'Letter', printBackground: true, displayHeaderFooter: true,
    margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    headerTemplate: '<div style="' + bar + 'margin-top:5pt;"><span>' + esc(runHead) + '</span><span>' + esc((P.anchorLabels || {}).dinner || '') + ' ' + clock(E.anchorMs(base.st, 'dinner')) + '</span></div>',
    footerTemplate: '<div style="' + bar + 'margin-bottom:5pt;"><span></span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>'
  };
  try {
    const page = await browser.newPage();
    // pass 1: on which page does each chunk start?
    let refs = {}, pages = 0;
    for (let round = 0; round < 3; round++) {
      const chunks = sheetChunks(base, alt, cmp, refs);
      const found = {};
      let total = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (i && !chunks[i].pb) {                          // follows on the same page if its first block fits
          await page.setContent(sheetHtml(chunks.slice(0, i + 1), true), { waitUntil: 'load' });
          found[chunks[i].id] = pdfPages(await page.pdf(pdfOpts));
        } else found[chunks[i].id] = total + 1;
        await page.setContent(sheetHtml(chunks.slice(0, i + 1)), { waitUntil: 'load' });
        total = pdfPages(await page.pdf(pdfOpts));
      }
      const same = Object.keys(found).every(function (k) { return found[k] === refs[k]; });
      refs = found; pages = total;
      if (same) break;
    }
    const html = sheetHtml(sheetChunks(base, alt, cmp, refs));
    const htmlPath = path.join(OUT_DIR, 'run-sheet.html'), pdfPath = path.join(OUT_DIR, 'run-sheet.pdf');
    fs.writeFileSync(htmlPath, html);
    await page.goto('file://' + htmlPath, { waitUntil: 'load' });
    await page.pdf(Object.assign({ path: pdfPath }, pdfOpts));
    const got = pdfPages(fs.readFileSync(pdfPath));
    if (got !== pages) notes.push('run-sheet.pdf: the page numbers in the contents list were measured on ' + pages + ' pages, the file has ' + got + '.');
    return { html: html, pages: got };
  } finally { await browser.close(); }
}

/* ================================================================================================
 * markdown
 * ============================================================================================== */

// the lines under one step. o.clock = print clock times, o.pad = indent of the sub-bullets
function mdStepBody(day, e, o) {
  const s = e.step, kind = s.kind || 'do', pad = o.pad, L = [];
  (s.body || []).forEach(function (b) { L.push(pad + '- ' + richM(b)); });
  if (kind === 'checklist') (e.items || []).forEach(function (it) { L.push(pad + '- [ ] ' + mdEsc(itemText(it))); });
  if (kind === 'choice' && s.choice) {
    (s.choice.options || []).forEach(function (op) {
      const mine = e.answered ? op.value === e.value : op.value === E.opt(P, day.st, s.choice.opt);
      let what = mine ? 'These steps are written for this answer. Go on.' : 'The steps change.';
      if (!mine && s.choice.opt === 'soaked' && op.value === false) what = 'See “' + NO_SOAK_TITLE + '” below.';
      L.push(pad + '- ' + mdEsc(sentence(op.label)) + ' ' + what);
    });
  }
  if (kind === 'check' && s.check) {
    const c = s.check, from = giveUpFrom(day, s);
    L.push(pad + '- ' + mdEsc(sentence(c.yes)) + ' Go on to the next step.');
    L.push(pad + '- ' + mdEsc(sentence(c.no)) + ' Wait **' + words(c.retryMins || 0) + '**. Then check again.');
    if (c.giveUp) L.push(pad + '- ' + mdEsc(sentence(c.giveUp.label)) + (o.clock && from != null ? ' Only from ' + clock(from) + ' on.' : ''));
  }
  if ((s.need || []).length) {
    L.push(pad + '- You need:');
    s.need.forEach(function (x) { L.push(pad + '    - ' + mdEsc(x)); });
  }
  if (s.into) L.push(pad + '- Goes into: ' + mdEsc(plain(s.into)));
  if (o.clock) { const nb = notBeforeAt(day, s); if (nb != null) L.push(pad + '- Not before ' + clock(nb) + '.'); }
  else if (notBeforeWords(s)) L.push(pad + '- ' + notBeforeWords(s));
  if (s.timer) L.push(pad + '- **Timer: ' + words(s.timer.secs / 60) + '.** ' + mdEsc(sentence(s.timer.label || '')) + ' Stay here.');
  const w = waitInfo(day, e);
  if (w) {
    L.push(pad + '- **Timer: ' + words(w.mins) + '.** ' + mdEsc(sentence(w.label)) + ' Keep working.' + (o.clock ? ' It ends about ' + clock(w.end) + '.' : ''));
    if (w.lapTimes.length) {
      L.push(pad + '- ' + (o.clock ? 'At ' + listAnd(w.lapTimes.map(clock)) : 'After ' + listAnd(w.lapMins.map(function (m) { return '**' + words(m) + '**'; }))) + ': ' + mdEsc(sentence(w.lapLabel)));
    }
    if (w.maxMins != null) L.push(pad + '- Never longer than **' + words(w.maxMins) + '**.');
    if (w.then) L.push(pad + '- When it ends: ' + richM(sentence(w.then.title)));
  } else if (s.wait) {                                     // a step outside the planned day
    const ow = offPlanWait(s, o.then);
    L.push(pad + '- **Timer: ' + words(ow.mins) + '.** ' + mdEsc(sentence(ow.label)) + ' Keep working.');
    if (ow.lapMins.length) L.push(pad + '- After ' + listAnd(ow.lapMins.map(function (m) { return '**' + words(m) + '**'; })) + ': ' + mdEsc(sentence(ow.lapLabel)));
    if (ow.maxMins != null) L.push(pad + '- Never longer than **' + words(ow.maxMins) + '**.');
    if (ow.then) L.push(pad + '- When it ends: ' + richM(sentence(ow.then.title)));
  }
  if (s.look) L.push(pad + '- Look for: ' + richM(s.look));
  if (s.tip) L.push(pad + '- Tip: ' + richM(s.tip));
  if (s.warn) L.push(pad + '- **Warning:** ' + richM(s.warn));
  return L;
}

function mdIngredients(d) {
  const L = [];
  (d.ingredients || []).forEach(function (r, i) {
    if (!r.item) { if (i) L.push(''); L.push('**' + mdEsc(r.qty) + '**', ''); return; }
    L.push('- ' + (r.qty ? '**' + mdEsc(r.qty) + '** ' : '') + mdEsc(r.item) + (r.note ? ', ' + mdEsc(r.note) : ''));
  });
  return L;
}
function mdSource(d) {
  const s = d.source || {};
  if (!s.label) return '';
  return s.url ? '[' + mdEsc(s.label) + '](' + s.url + ')' : mdEsc(s.label);
}
function appNoteMd() {
  return mentionsApp() ? ['Some steps say “tap” or mention the guide. That is the phone app. On paper, set your own timer for every **Timer** line.', ''] : [];
}

function masterMd(base, alt, cmp) {
  const L = ['# Master Schedule — ' + mdEsc(P.title), ''];
  (base.pr.warnings || []).forEach(function (w) { if (w.text) L.push('- ' + mdEsc(w.text)); });
  if ((base.pr.warnings || []).length) L.push('');
  L.push('## Fixed times', '');
  fixedTimes(base).forEach(function (a) { L.push('- ' + clock(a.at) + ' — ' + mdEsc(a.label)); });
  L.push('', '## The night before', '');
  (P.tonight || []).forEach(function (t) {
    L.push('- [ ] **' + mdEsc(t.title) + '**');
    (t.body || []).forEach(function (b) { L.push('  - ' + richM(b)); });
  });
  L.push('', '## How to read the day', '',
    '- Each line: clock time, task, dish, hands-on time.',
    '- An indented line is a timer that runs in the background while you go on.',
    '- The full text of every step is in the dish schedules and on the run sheet.', '');

  base.groups.forEach(function (g) {
    L.push('## ' + mdEsc(g.label) + ' — ' + clock(g.start) + ' to ' + clock(g.end), '');
    g.entries.forEach(function (e) {
      if (e.type === 'free') { L.push('- ' + clock(e.start) + ' — Free until ' + clock(e.end) + ' · **' + E.fmtDur((e.end - e.start) / MIN) + '**'); return; }
      const s = e.step;
      if (e.type === 'move') { L.push('- [ ] **' + clock(e.start) + ' — ' + mdEsc(s.title) + '**'); return; }
      L.push('- [ ] ' + clock(e.start) + ' — ' + richM(s.title) + ' · ' + mdEsc(dishOf(s).nick) + (handsOn(s) ? ' · **' + handsOn(s) + '**' : ''));
      const w = waitInfo(base, e);
      if (w) {
        L.push('  - Timer: ' + mdEsc(w.label) + ', **' + words(w.mins) + '**. Ends about ' + clock(w.end) + '.');
        if (w.lapTimes.length) L.push('  - At ' + listAnd(w.lapTimes.map(clock)) + ': ' + mdEsc(sentence(w.lapLabel)));
      }
    });
    L.push('');
  });

  L.push('## Pack lists', '');
  packLists(base).forEach(function (pl) {
    L.push('### ' + mdEsc(pl.e ? pl.e.step.title : pl.which) + (pl.e ? ' — ' + clock(pl.e.start) : ''), '');
    pl.items.forEach(function (it) { L.push('- [ ] ' + mdEsc(itemText(it))); });
    if (pl.hidden.length) {
      L.push('', 'Only if a step did not get done:', '');
      pl.hidden.forEach(function (it) { L.push('- [ ] ' + mdEsc(itemText(it)) + '. Only if ' + richM(conditionWords(it)) + '.'); });
    }
    L.push('');
  });

  L.push('## Jars, tubs and bowls', '');
  Object.keys(P.containers || {}).forEach(function (k) {
    L.push('### ' + mdEsc(CONTAINER_LABEL[k] || k), '');
    P.containers[k].forEach(function (c) { L.push('- [ ] **' + mdEsc(c.name) + '** · ' + mdEsc(c.size) + ' · ' + mdEsc(c.holds)); });
    L.push('');
  });

  L.push('## ' + NO_SOAK_TITLE, '');
  L.push('- The morning changes. Use this list in place of the morning above.');
  cmp.removed.forEach(function (e) { L.push('- Skip: ' + richM(e.step.title) + '.'); });
  if (cmp.sameFrom != null) L.push('- From ' + clock(cmp.sameFrom) + ' on, the schedule above is right again.');
  const flat = [];
  cmp.rows.forEach(function (r) { if (r.kind === 'run') r.part.forEach(function (e) { flat.push(e); }); else flat.push(r.e); });
  let flatLoc = null;
  flat.forEach(function (e) {
    const s = e.step, w = waitInfo(alt, e);
    if (e.loc !== flatLoc) { flatLoc = e.loc; L.push('', '### ' + mdEsc(placeLabel(e.loc)), ''); }   // a heading also keeps this list apart from the lines above
    L.push('- [ ] ' + clock(e.start) + ' — ' + richM(s.title) + ' · ' + mdEsc(changeWords(e)) + (e.type !== 'move' && handsOn(s) ? ' · **' + handsOn(s) + '**' : ''));
    if (w) {
      L.push('  - Timer: ' + mdEsc(w.label) + ', **' + words(w.mins) + '**. Ends about ' + clock(w.end) + '.');
      if (w.lapTimes.length) L.push('  - At ' + listAnd(w.lapTimes.map(clock)) + ': ' + mdEsc(sentence(w.lapLabel)));
    }
  });
  L.push('');
  planBs(base, alt).forEach(function (b) { planBMd(base, alt, b, false, true).forEach(function (l) { L.push(l); }); });
  return L.join('\n');
}

function numbered(day, list, o) {          // a numbered list of steps, with the place as a small heading when it changes
  const L = [];
  let loc = null, n = 0;
  list.forEach(function (x) {
    const e = x.e, s = e.step;
    if (o.clock && e.loc !== loc) { loc = e.loc; if (L.length) L.push(''); L.push('### ' + mdEsc(placeLabel(loc)), ''); }
    n++;
    const bits = [];
    if (o.clock && handsOn(s)) bits.push('**' + handsOn(s) + '**');
    if (x.shared) bits.push('shared step, it also covers other dishes');
    if (o.flag) bits.push(o.flag);
    L.push(n + '. **' + (o.clock ? clock(e.start) + ' — ' : '') + mdEsc(s.title) + '**' + (bits.length ? ' (' + bits.join('; ') + ')' : ''));
    mdStepBody(day, e, { clock: o.clock, pad: '    ', then: o.then }).forEach(function (l) { L.push(l); });
  });
  return L;
}

function changeWords(e) {                  // how a step of another version of the day differs from the main day
  if (e.change === 'new') return 'extra step';
  return (clock(e.was.start) === clock(e.start) ? 'same time' : 'was ' + clock(e.was.start)) +
         (e.was.loc !== e.loc ? ', was in ' + placeLabel(e.was.loc) : '');
}
function noSoakForDish(base, alt, cmp, d, clockOn) {
  const skip = cmp.removed.filter(function (e) { return e.step.dish === d.id; });
  const extra = cmp.added.filter(function (e) { return e.step.dish === d.id; });
  const L = [];
  if (!clockOn) {                                          // the recipe: only the steps that are different, no times
    if (!extra.length) return L;
    L.push('## ' + NO_SOAK_TITLE, '');
    skip.forEach(function (e) { L.push('- Skip: ' + richM(e.step.title) + '.'); });
    L.push('- Do these steps instead.', '');
    numbered(alt, extra.map(function (e) { return { e: e, shared: false }; }), { clock: false }).forEach(function (l) { L.push(l); });
    L.push('');
    return L;
  }
  // the schedule: every step of this dish that is new or at another time, in the order of that morning
  const list = dishEntries(alt, d).filter(function (x) { return x.e.change === 'new' || x.e.change === 'moved'; });
  if (!list.length && !skip.length) return L;
  L.push('## ' + NO_SOAK_TITLE, '');
  skip.forEach(function (e) { L.push('- Skip: ' + richM(e.step.title) + '.'); });
  const anyMoved = list.some(function (x) { return x.e.change === 'moved'; });
  if (extra.length) L.push('- An extra step is new. Its full text is in this list.');
  if (extra.length && anyMoved) L.push('- The other steps are written out above. Here they only get a new time.');
  if (!extra.length && anyMoved) L.push('- The steps stay the same. These get a new time.');
  let loc = null, n = 0;
  list.forEach(function (x) {
    const e = x.e, s = e.step;
    if (e.loc !== loc) { loc = e.loc; L.push('', '### ' + mdEsc(placeLabel(loc)), ''); }
    n++;
    const bits = [];
    if (e.change === 'new' && handsOn(s)) bits.push('**' + handsOn(s) + '**');
    bits.push(mdEsc(changeWords(e)));
    if (x.shared) bits.push('shared step');
    L.push(n + '. **' + clock(e.start) + ' — ' + mdEsc(s.title) + '** (' + bits.join('; ') + ')');
    if (e.change === 'new') { mdStepBody(alt, e, { clock: true, pad: '    ' }).forEach(function (l) { L.push(l); }); return; }
    const w = waitInfo(alt, e);
    if (w) {
      L.push('    - **Timer: ' + words(w.mins) + '.** ' + mdEsc(sentence(w.label)) + ' Keep working. It ends about ' + clock(w.end) + '.');
      if (w.lapTimes.length) L.push('    - At ' + listAnd(w.lapTimes.map(clock)) + ': ' + mdEsc(sentence(w.lapLabel)));
    }
  });
  L.push('');
  return L;
}

// "If you tick ..." for the steps that only happen when a check is given up on
function planBMd(base, alt, b, full, clockOn) {
  const L = ['## If you tick “' + mdEsc(b.label) + '”', ''];
  L.push('- That answer is in “' + mdEsc(b.check.title) + '”.' + (clockOn && b.from != null ? ' Not before ' + clock(b.from) + '.' : ''));
  b.off.forEach(function (e) { L.push('- Skip: ' + richM(sentence(e.step.title))); });
  L.push('- Then go down this list.', '');
  let n = 0;
  b.order.forEach(function (s) {
    n++;
    if (base.byId[s.id]) { L.push(n + '. **' + mdEsc(s.title) + '** (' + mdEsc(whereLabel({ where: 'hers' })) + '; the step is listed above' + (clockOn ? ', ignore its time' : '') + ')'); return; }
    L.push(n + '. **' + mdEsc(s.title) + '** (' + mdEsc(whereLabel(s)) + '; extra step' + (clockOn && handsOn(s) ? '; **' + handsOn(s) + '**' : '') + ')');
    if (full) mdStepBody(base, { step: s, start: NaN, end: NaN, loc: null }, { clock: false, pad: '    ', then: b.order }).forEach(function (l) { L.push(l); });
  });
  L.push('');
  return L;
}

function dishMd(base, alt, cmp, d) {
  const list = dishEntries(base, d);
  const L = ['# ' + mdEsc(d.nick) + ' — ' + mdEsc(d.name), ''];
  if (d.blurb) L.push(mdEsc(d.blurb), '');
  L.push('- **Makes:** ' + mdEsc(d.makes || ''));
  if (mdSource(d)) L.push('- **Source:** ' + mdSource(d));
  if (list.length) {
    const a = list[0].e, z = list[list.length - 1].e;
    L.push('- **First step:** ' + clock(a.start) + ' · ' + mdEsc(placeLabel(a.loc)));
    L.push('- **Last step:** ' + clock(z.start) + ' · ' + mdEsc(placeLabel(z.loc)));
  }
  L.push('', '## Equipment', '');
  (d.gear || []).forEach(function (x) { L.push('- ' + mdEsc(x)); });
  L.push('', '## Ingredients', '');
  mdIngredients(d).forEach(function (l) { L.push(l); });
  L.push('', '## Steps', '');
  appNoteMd().forEach(function (l) { L.push(l); });
  numbered(base, list, { clock: true }).forEach(function (l) { L.push(l); });
  L.push('');
  noSoakForDish(base, alt, cmp, d, true).forEach(function (l) { L.push(l); });
  planBs(base, alt).forEach(function (b) {
    if (b.on.some(function (s) { return s.dish === d.id; })) planBMd(base, alt, b, true, true).forEach(function (l) { L.push(l); });
  });
  L.push('## Good to know', '');
  (d.notes || []).forEach(function (x) { L.push('- ' + richM(x)); });
  L.push('');
  return L.join('\n');
}

function recipesMd(base, alt, cmp) {
  const L = ['# Scaled Recipes — ' + mdEsc(P.title), ''];
  (P.dishes || []).forEach(function (d) { L.push('- **' + mdEsc(d.nick) + '** — ' + mdEsc(d.name) + '. Makes: ' + mdEsc(d.makes || '')); });
  L.push('');
  appNoteMd().forEach(function (l) { L.push(l); });
  (P.dishes || []).forEach(function (d) {
    L.push('## ' + mdEsc(d.nick) + ' — ' + mdEsc(d.name), '');
    if (d.blurb) L.push(mdEsc(d.blurb), '');
    L.push('- **Makes:** ' + mdEsc(d.makes || ''));
    if (mdSource(d)) L.push('- **Source:** ' + mdSource(d));
    L.push('', '### Ingredients', '');
    mdIngredients(d).forEach(function (l) { L.push(l); });
    L.push('', '### Equipment', '');
    (d.gear || []).forEach(function (x) { L.push('- ' + mdEsc(x)); });
    L.push('', '### Method', '');
    numbered(base, dishEntries(base, d), { clock: false }).forEach(function (l) { L.push(l); });
    L.push('');
    noSoakForDish(base, alt, cmp, d, false).forEach(function (l) { L.push(l.replace(/^## /, '### ')); });
    planBs(base, alt).forEach(function (b) {
      if (b.on.some(function (s) { return s.dish === d.id; })) planBMd(base, alt, b, true, false).forEach(function (l) { L.push(l.replace(/^## /, '### ')); });
    });
    L.push('### Good to know', '');
    (d.notes || []).forEach(function (x) { L.push('- ' + richM(x)); });
    L.push('');
  });
  return L.join('\n');
}

/* ================================================================================================
 * checks, writing, summary
 * ============================================================================================== */

function checkDay(name, day) {
  P.steps.forEach(function (s) {
    if (!E.isActive(P, day.st, s) || day.byId[s.id]) return;
    if (s.optional === true) { notes.push(name + ': the optional step “' + s.title + '” does not fit in the day and is left out.'); return; }
    problems.push(name + ': the step “' + s.title + '” (' + s.id + ') never got a planned time.');
  });
  (day.pr.warnings || []).forEach(function (w) {
    if (w.code === 'missed') problems.push(name + ': ' + w.text);
    else notes.push(name + ': ' + w.text);
  });
  if (day.pr.dinnerAt == null) problems.push(name + ': dinner could not be planned.');
}
function checkText(name, text) {
  if (!text || !text.trim()) { problems.push(name + ' is empty.'); return; }
  if (text.indexOf('[[') >= 0 || text.indexOf(']]') >= 0) problems.push(name + ' still contains glossary markup ([[ or ]]).');
  const bad = /\bundefined\b|\bNaN\b|\[object Object\]/.exec(text);
  if (bad) problems.push(name + ' contains “' + bad[0] + '”.');
}
function write(name, text) {
  checkText(name, text);
  fs.writeFileSync(path.join(OUT_DIR, name), text);
}
function sizeOf(name) {
  const f = path.join(OUT_DIR, name);
  if (!fs.existsSync(f) || fs.statSync(f).size === 0) { problems.push(name + ' was not written.'); return '0 B'; }
  const b = fs.statSync(f).size;
  return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
}

async function main() {
  P = await loadModule(path.join(APP_DIR, 'plan.js'));
  E = await loadModule(path.join(APP_DIR, 'engine.js'));
  (P.steps || []).forEach(function (s) { stepById[s.id] = s; });
  (P.dishes || []).forEach(function (d) { dishById[d.id] = d; });
  readAppTables();
  E.validate(P).forEach(function (p) { problems.push('plan.js: ' + p); });

  const a = startState(true), b = startState(false);
  const base = buildDay(a.st, a.now), alt = buildDay(b.st, b.now);
  const cmp = compareDays(base, alt);
  checkDay('Main day', base);
  checkDay('Day without the soak', alt);

  (P.dishes || []).forEach(function (d) {
    if (!base.entries.some(function (e) { return e.step && e.step.dish === d.id; })) problems.push('The dish “' + d.nick + '” has no steps in the day.');
    if (!(d.ingredients || []).length) problems.push('The dish “' + d.nick + '” has no ingredients.');
    if (!DISH_FILES.some(function (f) { return f.id === d.id; })) problems.push('The dish “' + d.nick + '” (' + d.id + ') has no schedule file in DISH_FILES.');
  });

  const written = [];
  const sheet = await makeSheet(base, alt, cmp);
  checkText('run-sheet.html', sheet.html);
  if (!sheet.pages) problems.push('run-sheet.pdf has no pages.');
  written.push(['run-sheet.html', ''], ['run-sheet.pdf', sheet.pages + ' pages']);

  write('master-schedule.md', masterMd(base, alt, cmp));
  written.push(['master-schedule.md', '']);
  DISH_FILES.forEach(function (f) {
    const d = dishById[f.id];
    if (!d) { problems.push(f.file + ': no dish with id “' + f.id + '” in plan.js.'); return; }
    if (d.nick !== f.nick) notes.push(f.file + ': the nickname is now “' + d.nick + '” (the table in make-docs.js says “' + f.nick + '”).');
    write(f.file, dishMd(base, alt, cmp, d));
    written.push([f.file, d.nick]);
  });
  write('recipes-scaled.md', recipesMd(base, alt, cmp));
  written.push(['recipes-scaled.md', '']);

  written.forEach(function (w) { console.log(w[0].padEnd(36) + sizeOf(w[0]).padStart(10) + (w[1] ? '   ' + w[1] : '')); });
  console.log('Main day: ' + base.entries.filter(function (e) { return e.step; }).length + ' steps, dinner planned for ' +
              (base.pr.dinnerAt == null ? 'never' : clock(base.pr.dinnerAt)) + '.');
  notes.forEach(function (n) { console.log('note: ' + n); });
  if (problems.length) {
    problems.forEach(function (p) { console.error('MISSING: ' + p); });
    process.exitCode = 1;
  }
}

main().catch(function (e) { console.error(e && e.stack ? e.stack : e); process.exitCode = 1; });
