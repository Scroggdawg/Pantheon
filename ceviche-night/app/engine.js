/*
 * Ceviche Night engine: pure scheduling and state logic. No DOM. No clock of its own.
 * UMD: Node -> module.exports, browser -> window.Engine.
 *
 * Conventions
 *   plan   the PLAN object (SPEC section 2). Never mutated.
 *   state  the State object (SPEC 3.1). Never mutated. Reducers return a NEW object.
 *   now    epoch milliseconds. Every time-dependent function takes it. Nothing reads the real clock.
 *   step   a Step object from plan.steps. Every function that takes a step also accepts its id string.
 *   Loc    'home-am' | 'away' | 'home-pm' | 'drive' | 'hers'
 *   Nothing throws on unknown ids, missing optional fields, or empty collections.
 *
 * TIME
 *   dayMs(state) -> ms            local midnight of state.day (NaN when state.day is not a date)
 *   anchorMs(state, name) -> ms   wall-clock time of state.anchors[name] on the cook day (NaN when unknown)
 *
 * PLACES AND STATUS
 *   location(plan, state) -> Loc                  from which move steps are done
 *   opt(plan, state, name) -> value               state.opts[name] ?? plan.optionDefaults[name] (a stored null = not set)
 *   stepById(plan, id) -> Step | null
 *   isActive(plan, state, step) -> bool           its `when` matches and it is not skipped
 *   isDone(plan, state, step) -> bool             state.done[id] set, or a choice whose option was answered
 *   isAvailable(plan, state, step, now) -> bool   active, not done, deps met, wait over, right place, notBefore reached
 *   blockers(plan, state, step, now) -> [ {type:'after', stepId}
 *                                       | {type:'wait', waitId, endsAt}      endsAt null = timer not started yet
 *                                       | {type:'time', at}
 *                                       | {type:'place', where} ]            where = step.where; for a move step the Loc it needs
 *                                         Gates only. A done or inactive step returns [] too: test isDone / isActive first.
 *        The wait gate is SPEC 3.3 with one addition: a `must` step is never left waiting past a hard out. At his place
 *        (morning: leaveAm, pack-up stop: leavePm) its gate opens no later than (hard out - its own hands-on minutes),
 *        once the timer has been started. blockers().endsAt, isAvailable, pick and nextUnlock all use that moment;
 *        waitsView still shows the timer as it really runs.
 *   stepMins(step) -> minutes     hands-on length: mins + timer.secs/60          (Step object only, no id)
 *   needMins(step) -> minutes     stepMins + wait.mins when the wait is attended (used by the hard-out fit rule)
 *   canGiveUp(plan, state, step, now) -> bool     SPEC 9.2: a check step with a giveUp, he is in 'home-am', and now is
 *                                                 inside withinMinsOf (a giveUp without withinMinsOf: any time in 'home-am')
 *
 * WHAT TO DO NEXT
 *   pick(plan, state, now) -> Step | null         SPEC 3.4. A step whose urgent timer (started in this place) has ended
 *                                                 always comes first.
 *                                                 A move step is returned ONLY once its anchor time is reached,
 *                                                 and then only after every `must` step he can do right now.
 *                                                 (SPEC 3.4 step 2 puts the move first; a must step is "never dropped"
 *                                                 and nobody walks out past a ringing timer, so those two go before it.)
 *                                                 Before its anchor a move is never returned: null + an available move step
 *                                                 means "free time, he may leave early" (offer the move button yourself).
 *                                                 Fit rule at his place: a step that can wait (an 'either' step, an optional
 *                                                 step, a non-must pack-up step) is offered only if
 *                                                   - it ends before the hard out, stove time included (now + needMins), and
 *                                                   - its hands-on time leaves room for the work that will certainly be done
 *                                                     there before he goes: must steps, home-only steps that are not optional
 *                                                     (morning only), steps whose urgent timer is running there, and the step
 *                                                     an urgent timer of its own will call for. Only work that can still
 *                                                     start before the hard out counts. That work is done while the pot is
 *                                                     on, so it is not added to the stove time.
 *   nextStep(plan, state, now) -> stepId | null
 *   nextUnlock(plan, state, now) -> { at, stepId, reason:'wait'|'time'|'move' } | null
 *                                                 When several things unlock in the same millisecond, stepId is the one
 *                                                 pick() returns at that moment.
 *
 * REDUCERS  -> new State with rev+1 and updatedAt = now.
 *              When nothing changes (unknown id, refused value, already in that state) the SAME state object comes back.
 *              The same when `now` is not a finite number: a broken clock never reaches the saved state.
 *   initialState(plan, device, now) -> State      rev 0, updatedAt 0. day = today when local hour < 16, else tomorrow.
 *   setDay(plan, state, 'YYYY-MM-DD', now)
 *   complete(plan, state, stepId, now, payload?)  payload {value} for choice steps. Arms step.wait, runs rules,
 *                                                 leavePm auto-skips every not-done where:'home' step. Already done -> unchanged.
 *                                                 A move also completes every earlier move that is still open, at the same
 *                                                 time (their rules and the leavePm write-off run), in the one rev.
 *   uncomplete(plan, state, stepId, now)          removes done + the wait it armed (+ the answer of a choice step).
 *                                                 Not done (and not an answered choice) -> unchanged.
 *                                                 Options that plan.rules set for this step are taken back, unless another
 *                                                 done step's rule, a ticked Tonight item or an answered choice still gives
 *                                                 the same value. (A give-up or a Setup choice with that same value cannot be
 *                                                 told apart and is taken back too: for an exact undo use your own history.)
 *                                                 A move: the moves after it are taken back as well (he is in the place
 *                                                 before it again). The leavePm move: every where:'home' step is un-skipped,
 *                                                 also one he had skipped himself (the state cannot tell the two apart).
 *                                                 A where:'home' step taken back while he is on the road or in her kitchen
 *                                                 is marked skipped (it cannot be done any more and must not block dinner).
 *   skip(plan, state, stepId, now)
 *   retry(plan, state, stepId, now)               check step: restart its afterWait timer for check.retryMins
 *   giveUp(plan, state, stepId, now)              check step: apply check.giveUp.set to opts (already set -> unchanged)
 *   ackLap(plan, state, waitId, n, now)           laps 1..n are acknowledged (n omitted = one more)
 *   tick(plan, state, stepId, itemId, on, now)
 *   tickTonight(plan, state, id, on, now)         on applies that tonight item's `sets`; off takes them back (unless he
 *                                                 answered that question himself since), so the question is asked again
 *   setOpt(plan, state, name, value, now)         value undefined removes the override
 *   setAnchor(plan, state, name, minutes, now)    clamped 0..1439; refused when it would touch or cross a neighbour
 *   startFg(plan, state, stepId, endsAt, now)
 *   clearFg(plan, state, now)
 *
 * WAITS AND ALERTS
 *   waitsView(plan, state, now) -> [ { id, label, lapLabel, by, gatedStepId, startedAt, endsAt, remainingMs,
 *                                      elapsed, urgent, attended, laps:[{n, at, due, acked}], overMax, here } ]
 *        elapsed is a boolean. remainingMs >= 0. gatedStepId may be null. Sorted by endsAt.
 *        Lists every timer whose gated step is not done. A timer that gates nothing is listed until it ends.
 *        here = started in the place he is in now, i.e. after he left the place before it. After a move, timers from
 *        the place he left are dropped, except a not-attended one that is still running (e.g. onions steeping in a jar):
 *        listed with here:false. (Taking the arrival back and tapping it again does not change what is "here".)
 *   alerts(plan, state, now) -> [ { kind:'lap'|'wait'|'max'|'leave', id, title, stepId?, waitId?, lap?, lapOf?, minsLeft? } ]
 *        Order: laps, ended urgent waits, max exceeded, leave warning. `id` is stable while the alert lasts.
 *        Timer alerts only come from timers started in the place he is in now (nothing rings for a kitchen he left).
 *        lap    one per wait: the latest due, un-acked lap of a still-running wait. ackLap(waitId, alert.lap) clears it.
 *               stepId = the step that started the timer.
 *        wait   an urgent wait has ended and its step is not done. stepId = the step to do.
 *        max    wait.max minutes exceeded and its step is not done. stepId = the step to do.
 *        leave  the current place's hard-out move (leaveAm, leavePm) is within 10 min or past. minsLeft <= 0 = past.
 *               minsLeft is rounded down. stepId = the move step. Titles: 'Leave in 8 min' / 'Time to leave'.
 *
 * PROJECTION
 *   project(plan, state, now) -> {
 *     now,
 *     rows: [ {type:'step', stepId, start, end, status:'done'|'next'|'later', loc, deferred?:true, late?:true}
 *           | {type:'wait', waitId, label, start, end, loc}
 *           | {type:'free', start, end, loc, nextStepId}
 *           | {type:'move', stepId, at, loc, to, status} ],     loc = place being left, to = place entered
 *     byStep: { [stepId]: {start, end, status, loc, deferred} },  only steps that are done or scheduled
 *     dinnerAt,        start of step 'dinner' (null when it cannot be scheduled)
 *     dinnerAnchor, lateMin, spareMin,
 *     warnings: [ {code:'late'|'am-overrun'|'missed'|'deferred'|'beans-later', text, stepIds?} ]
 *   }
 *   The plan begins at `now`; at the start anchor instead while nothing is done yet, and on any day before the cook day
 *   (a step ticked off the evening before does not move the morning into the night).
 *   rows are chronological (done rows first). late:true = the step runs past its place's deadline
 *   (leaveAm at home in the morning, leavePm when packing, the dinner anchor in her kitchen).
 *   A step with no byStep entry is not going to happen today (optional and dropped, or listed under 'missed').
 *   Warnings, in this order: 'late' (dinner after its anchor), 'am-overrun' (stepIds: steps at his place that end after
 *   leaveAm, then home-only steps whose stove timer is still running when he is due to leave; when only the latter, the
 *   text reads 'Still on the stove when it is time to leave at ...'), 'missed' (stepIds: non-optional steps the day has
 *   no room for), 'deferred' (stepIds: block 'am' + where 'either' steps now planned in her kitchen), 'beans-later'
 *   (option beansLater is true and that work is still ahead).
 *   `text` is ready to show. Free rows shorter than 3 minutes are left out.
 *
 * VIEWS AND FORMATTING
 *   packList(plan, state, which) -> [ {id, label, note, ticked, stepId} ]   stepId = checklist step that stores the ticks (or null)
 *   checklistItems(plan, state, step) -> [ {id, label, note, ticked, stepId} ]   items of a checklist step (pack list or literal strings, ids 'i0','i1',..)
 *   progress(plan, state) -> {done, total}                over active, non-optional steps
 *   dishProgress(plan, state, dishId) -> {done, total}
 *   fmtClock(ms) -> '7:05 AM'      fmtDur(mins) -> '5 min' | '1 hr 20 min' | '30 sec'      fmtCountdown(ms) -> '12:05' | '1:02:10'
 *   validate(plan) -> [string]     human-readable problems, [] = OK (SPEC section 2 and 9.2, plus unique tonight ids)
 */
(function (root, factory) {
  var E = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = E;
  else root.Engine = E;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var MIN = 60000;
  var EMPTY = Object.freeze({});
  var NONE = Object.freeze([]);
  var MOVES = ['leaveAm', 'backHome', 'leavePm', 'arrive'];
  var MOVE_FROM = { leaveAm: 'home-am', backHome: 'away', leavePm: 'home-pm', arrive: 'drive' };
  var MOVE_TO = { leaveAm: 'away', backHome: 'home-pm', leavePm: 'drive', arrive: 'hers' };
  var LOC_MOVE = { 'home-am': 'leaveAm', 'away': 'backHome', 'home-pm': 'leavePm', 'drive': 'arrive' };
  var KINDS = ['do', 'check', 'choice', 'checklist', 'move'];
  var WHERES = ['home', 'hers', 'either'];
  var SIM_GUARD = 3000;

  // ---------- small helpers ----------

  function isObj(x) { return x !== null && typeof x === 'object'; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function num(x, d) { return isNum(x) ? x : d; }
  function own(o, k) { return isObj(o) && Object.prototype.hasOwnProperty.call(o, k); }
  function bag(state, key) { return isObj(state) && isObj(state[key]) && !Array.isArray(state[key]) ? state[key] : EMPTY; }
  function list(x) { return Array.isArray(x) ? x : NONE; }
  function put(o, k, v) { var c = Object.assign({}, o); c[k] = v; return c; }
  function drop(o, k) { if (!own(o, k)) return o; var c = Object.assign({}, o); delete c[k]; return c; }

  // Lookup tables for one plan. Built per public call (cheap) so a plan edited between calls is never stale.
  function index(plan) {
    var ix = { plan: isObj(plan) ? plan : EMPTY, steps: [], byId: Object.create(null), order: Object.create(null),
               armers: Object.create(null), waitDef: Object.create(null), gated: Object.create(null), moves: Object.create(null) };
    var steps = list(ix.plan.steps);
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (!isObj(s) || typeof s.id !== 'string') continue;
      ix.steps.push(s);
      if (!ix.byId[s.id]) { ix.byId[s.id] = s; ix.order[s.id] = i; }
      if (isObj(s.wait) && typeof s.wait.id === 'string') {
        (ix.armers[s.wait.id] || (ix.armers[s.wait.id] = [])).push(s);
        if (!ix.waitDef[s.wait.id]) ix.waitDef[s.wait.id] = s.wait;
      }
      if (typeof s.afterWait === 'string') (ix.gated[s.afterWait] || (ix.gated[s.afterWait] = [])).push(s);
      if (s.kind === 'move' && typeof s.move === 'string' && !ix.moves[s.move]) ix.moves[s.move] = s;
    }
    return ix;
  }
  function resolve(ix, stepOrId) {
    if (typeof stepOrId === 'string') return ix.byId[stepOrId] || null;
    return isObj(stepOrId) && typeof stepOrId.id === 'string' ? stepOrId : null;
  }

  // ---------- time ----------

  function dayParts(state) {
    var m = isObj(state) && typeof state.day === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(state.day) : null;
    return m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : null;
  }
  function dayMs(state) {
    var p = dayParts(state);
    return p ? new Date(p[0], p[1], p[2], 0, 0, 0, 0).getTime() : NaN;
  }
  function anchorMs(state, name) {
    var p = dayParts(state);
    var a = bag(state, 'anchors');
    if (!p || !own(a, name) || !isNum(a[name])) return NaN;
    return new Date(p[0], p[1], p[2], 0, a[name], 0, 0).getTime();   // wall clock, so a DST change cannot shift it
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  // ---------- status ----------

  function optI(ix, state, name) {
    var o = bag(state, 'opts');
    if (own(o, name) && o[name] != null) return o[name];        // SPEC 3.3: state.opts[name] ?? default
    var d = ix.plan.optionDefaults;
    return own(d, name) ? d[name] : undefined;
  }
  function whenI(ix, state, when) {
    if (!isObj(when)) return true;
    var keys = Object.keys(when);
    for (var i = 0; i < keys.length; i++) if (optI(ix, state, keys[i]) !== when[keys[i]]) return false;
    return true;
  }
  function skippedI(state, id) { var s = bag(state, 'skipped'); return own(s, id) && !!s[id]; }
  function activeI(ix, state, step) { return whenI(ix, state, step.when) && !skippedI(state, step.id); }
  function doneI(ix, state, step) {
    if (!step) return false;
    var d = bag(state, 'done');
    if (own(d, step.id) && d[step.id] != null && d[step.id] !== false) return true;
    if (step.kind === 'choice' && isObj(step.choice) && typeof step.choice.opt === 'string') {
      var o = bag(state, 'opts');
      return own(o, step.choice.opt) && o[step.choice.opt] !== undefined;
    }
    return false;
  }
  function locI(ix, state) {
    for (var i = MOVES.length - 1; i >= 0; i--) {
      var s = ix.moves[MOVES[i]];
      var d = bag(state, 'done');
      if (s && own(d, s.id) && d[s.id] != null && d[s.id] !== false) return MOVE_TO[MOVES[i]];
    }
    return 'home-am';
  }
  function placeOk(step, loc) {
    if (step.kind === 'move') return MOVE_FROM[step.move] === loc;
    if (step.where === 'home') return loc === 'home-am' || loc === 'home-pm';
    if (step.where === 'hers') return loc === 'hers';
    return loc === 'home-am' || loc === 'hers';      // 'either': never during the pack-up stop at home
  }
  function unmetDeps(ix, state, step) {
    var out = [];
    var after = list(step.after);
    for (var i = 0; i < after.length; i++) {
      var dep = ix.byId[after[i]];
      if (!dep) continue;                              // unknown id: validate() reports it, the cook is not stuck on it
      if (doneI(ix, state, dep) || !activeI(ix, state, dep)) continue;
      out.push(dep.id);
    }
    return out;
  }
  function waitRec(state, waitId) {
    var w = bag(state, 'waits');
    var r = own(w, waitId) ? w[waitId] : null;
    return isObj(r) && isNum(r.start) && isNum(r.mins) ? r : null;
  }
  function waitDefI(ix, state, waitId) {
    var r = waitRec(state, waitId);
    var by = r && typeof r.by === 'string' ? ix.byId[r.by] : null;
    if (by && isObj(by.wait) && by.wait.id === waitId) return by.wait;
    return ix.waitDef[waitId] || null;
  }
  // The hard out of the place he is in: leaveAm in the morning at home, leavePm at the pack-up stop. NaN elsewhere.
  function hardOutI(state, loc) {
    return loc === 'home-am' ? anchorMs(state, 'leaveAm') : loc === 'home-pm' ? anchorMs(state, 'leavePm') : NaN;
  }
  // When a running timer lets this step go. Normally the end of the timer. A `must` step is never left waiting past
  // a hard out: where the place has one, its gate opens no later than (hard out - its own hands-on minutes), so the
  // step can still be done before he has to go (cooked beans go into the fridge even if they are not cool yet).
  function gateEnd(state, step, start, mins, loc) {
    var end = start + mins * MIN;
    if (step.must === true && placeOk(step, loc)) {
      var L = hardOutI(state, loc);
      if (isNum(L)) end = Math.min(end, Math.max(start, L - stepMins(step) * MIN));
    }
    return end;
  }
  // {open, waitId, endsAt}. No record: closed only while a step that arms it can still happen.
  function gateI(ix, state, step, now, loc) {
    var id = step.afterWait;
    if (typeof id !== 'string') return { open: true, waitId: null, endsAt: null };
    var r = waitRec(state, id);
    if (r) { var end = gateEnd(state, step, r.start, r.mins, loc); return { open: now >= end, waitId: id, endsAt: end }; }
    var arm = ix.armers[id] || NONE;
    for (var i = 0; i < arm.length; i++) {
      if (activeI(ix, state, arm[i]) && !doneI(ix, state, arm[i])) return { open: false, waitId: id, endsAt: null };
    }
    return { open: true, waitId: id, endsAt: null };
  }
  // {open, at}. An anchor that does not exist never blocks.
  function timeGateI(state, step, now) {
    var nb = step.notBefore;
    if (!isObj(nb)) return { open: true, at: null };
    var at = anchorMs(state, nb.anchor) + num(nb.mins, 0) * MIN;
    if (!isNum(at)) return { open: true, at: null };
    return { open: now >= at, at: at };
  }
  function availI(ix, state, step, now, loc) {
    return activeI(ix, state, step) && !doneI(ix, state, step) && placeOk(step, loc) &&
      unmetDeps(ix, state, step).length === 0 && gateI(ix, state, step, now, loc).open && timeGateI(state, step, now).open;
  }
  function stepMins(step) {
    if (!isObj(step)) return 0;
    var m = Math.max(0, num(step.mins, 0));
    if (isObj(step.timer)) m += Math.max(0, num(step.timer.secs, 0)) / 60;
    return m;
  }
  function needMins(step) {
    if (!isObj(step)) return 0;
    var m = stepMins(step);
    if (isObj(step.wait) && step.wait.attended === true) m += Math.max(0, num(step.wait.mins, 0));
    return m;
  }
  // The fit rule's view of one place at one moment: its hard out L and, built on first use, the "reserved" work:
  // what will certainly be done here before he leaves. Returns null where there is no hard out.
  function reserveI(ix, state, loc, now, since) {
    var L = hardOutI(state, loc);
    if (!isNum(L)) return null;
    return { L: L, loc: loc, now: now, since: since, list: null, ids: null };
  }
  // Reserved steps: `must` steps, home-only steps that are not optional, and steps whose urgent timer is already
  // running in this kitchen (when it rings, that step comes first). Only those that can still start before the hard
  // out: a step behind a move that has not happened ("load the cooler" after coming back), behind a timer that ends
  // too late, or behind a step that cannot be reached in time takes no room. It is not going to happen here before
  // he leaves, whatever else he does.
  function reserveList(ix, state, res) {
    if (res.list) return res.list;
    var loc = res.loc, L = res.L, now = res.now, memo = Object.create(null);
    // earliest moment the step could start if everything it needs were done as early as possible (Infinity = not here)
    function earliest(s, depth) {
      if (memo[s.id] !== undefined) return memo[s.id];
      memo[s.id] = Infinity;                                    // also stops a dependency cycle
      if (depth > 2000 || !placeOk(s, loc)) return Infinity;
      var t = now, i, e;
      var tg = timeGateI(state, s, now);
      if (!tg.open) t = Math.max(t, tg.at);
      var after = list(s.after);
      for (i = 0; i < after.length && t < Infinity; i++) {
        var dep = ix.byId[after[i]];
        if (!dep || doneI(ix, state, dep) || !activeI(ix, state, dep)) continue;
        e = dep.kind === 'move' ? Infinity : earliest(dep, depth + 1);
        t = Math.max(t, e + stepMins(dep) * MIN);
      }
      if (t < Infinity && typeof s.afterWait === 'string') {
        var r = waitRec(state, s.afterWait);
        if (r) t = Math.max(t, gateEnd(state, s, r.start, r.mins, loc));
        else {
          var arm = ix.armers[s.afterWait] || NONE, open = Infinity, waiting = false;
          for (i = 0; i < arm.length; i++) {
            var a = arm[i];
            if (!activeI(ix, state, a) || doneI(ix, state, a)) continue;
            waiting = true;                                     // the timer still has to be started by this step
            e = a.kind === 'move' ? Infinity : earliest(a, depth + 1);
            if (e < Infinity) {
              var armedAt = e + stepMins(a) * MIN;
              open = Math.min(open, gateEnd(state, s, armedAt, Math.max(0, num(a.wait.mins, 0)), loc));
            }
          }
          if (waiting) t = Math.max(t, open);
        }
      }
      memo[s.id] = t;
      return t;
    }
    var out = [], ids = Object.create(null);
    for (var k = 0; k < ix.steps.length; k++) {
      var s = ix.steps[k];
      if (s.kind === 'move' || !placeOk(s, loc) || !activeI(ix, state, s) || doneI(ix, state, s)) continue;
      var alarm = urgentI(ix, state, s, res.since);             // rings here: never deferred, so it takes its minutes
      if (!alarm && !(s.must === true || (s.where === 'home' && s.optional !== true))) continue;
      var e = earliest(s, 0);
      // a must step or an alarm that comes up exactly at the hard out is still done before he goes
      if (s.must === true || alarm ? e <= L : e < L) { out.push(s); ids[s.id] = true; }
    }
    res.list = out;
    res.ids = ids;
    return out;
  }
  // SPEC 3.4 step 3: may this step be started at `now` given the place's hard out?
  // "Fits" = the step and its stove time end before the hard out (the spec's rule), AND its hands-on time still leaves
  // room for the reserved work, which he does while the pot is on. So a step that could be done later, or skipped,
  // never pushes a must step or a home-only step past the hard out. At the pack-up stop only `must` work is
  // protected from a step that is not optional, so two leftover steps never block each other.
  function keepI(ix, state, step, now, loc, res) {
    if (!res) return true;                                      // no hard out in this place
    if (step.must === true) return true;
    if (loc === 'home-am' && step.where === 'home' && step.optional !== true) return true;
    var room = 0, reserved = reserveList(ix, state, res), i;
    for (i = 0; i < reserved.length; i++) {
      var r = reserved[i];
      if (r.id === step.id) continue;
      if (loc === 'home-pm' && step.optional !== true && r.must !== true && !urgentI(ix, state, r, res.since)) continue;
      room += stepMins(r);
    }
    // an urgent timer this step starts will ring before he leaves: the step it calls for is part of the bargain
    var w = isObj(step.wait) && step.wait.urgent === true && typeof step.wait.id === 'string' ? step.wait : null;
    if (w && now + (stepMins(step) + Math.max(0, num(w.mins, 0))) * MIN <= res.L) {
      var called = ix.gated[w.id] || NONE;
      for (i = 0; i < called.length; i++) {
        var g = called[i];
        if (g.id !== step.id && !res.ids[g.id] && placeOk(g, loc) && activeI(ix, state, g) && !doneI(ix, state, g)) room += stepMins(g);
      }
    }
    return now + Math.max(needMins(step), stepMins(step) + room) * MIN <= res.L;
  }
  // Since when he has been in the kitchen he is in now: the moment he left the place before it (-Infinity in the
  // morning). A timer started before that belongs to a kitchen he has left: its burner is off, so it no longer rings,
  // jumps the queue or shows as a running stove timer. Measured from the leave, not from the arrival tap, so
  // "Not done" and "I'm here" again on the arrival does not silence what is cooking there.
  function stayStart(ix, state) {
    var d = bag(state, 'done');
    function at(name) {
      var s = ix.moves[name];
      return s && own(d, s.id) && isNum(d[s.id]) ? d[s.id] : NaN;
    }
    var loc = locI(ix, state);
    if (loc === 'home-am') return -Infinity;
    var names = loc === 'away' ? ['leaveAm'] : loc === 'home-pm' ? ['leaveAm', 'backHome'] : loc === 'drive' ? ['leavePm'] : ['leavePm', 'arrive'];
    var since = Infinity;
    for (var i = 0; i < names.length; i++) { var t = at(names[i]); if (isNum(t) && t < since) since = t; }
    return since < Infinity ? since : -Infinity;
  }
  // Is this step waiting on an urgent timer started during this stay? (Once it is available, that alarm has gone off.)
  function urgentI(ix, state, step, since) {
    var r = typeof step.afterWait === 'string' ? waitRec(state, step.afterWait) : null;
    if (!r || !(r.start > since)) return false;
    var def = waitDefI(ix, state, step.afterWait);
    return !!def && def.urgent === true;
  }
  function pickI(ix, state, now) {
    var loc = locI(ix, state);
    var since = stayStart(ix, state);
    var res = reserveI(ix, state, loc, now, since);
    var first = null, urgent = null, must = null, move = null;
    for (var i = 0; i < ix.steps.length; i++) {
      var s = ix.steps[i];
      if (first && urgent && must) break;                       // nothing further down can change the answer
      if (!availI(ix, state, s, now, loc)) continue;
      if (s.kind === 'move') {
        if (!move && now >= anchorMs(state, s.move)) move = s;  // time to go
        continue;                                               // early: the UI offers it, the engine does not push it
      }
      var isUrgent = urgentI(ix, state, s, since);              // its alarm just went off: something is on the heat
      if (!isUrgent) {
        if (first && s.must !== true) continue;                 // only an alarm or a must step can still matter
        if (!keepI(ix, state, s, now, loc, res)) continue;      // an alarm is never deferred or dropped
      }
      if (!first) first = s;
      if (!urgent && isUrgent) urgent = s;
      if (!must && s.must === true) must = s;
    }
    // Time to go beats everything except an alarm and a `must` step he can do right now: the engine never
    // tells him to walk out past a ringing timer or a step that must not be dropped (stove off, cooler loaded).
    if (move) return urgent || must || move;
    return urgent || first;
  }
  function nextUnlockI(ix, state, now) {
    var loc = locI(ix, state);
    var since = stayStart(ix, state);
    var best = null, bestRank = 0, resAt = Object.create(null), dueAt = Object.create(null);
    var mv = LOC_MOVE[loc] ? ix.moves[LOC_MOVE[loc]] : null;
    function due(at) {                                          // will "time to go" hold at that moment?
      if (dueAt[at] === undefined) dueAt[at] = !!mv && at >= anchorMs(state, mv.move) && availI(ix, state, mv, at, loc);
      return dueAt[at];
    }
    for (var i = 0; i < ix.steps.length; i++) {
      var s = ix.steps[i];
      if (!activeI(ix, state, s) || doneI(ix, state, s) || !placeOk(s, loc)) continue;
      if (unmetDeps(ix, state, s).length) continue;             // a clock cannot fix a missing step
      var at = -Infinity, reason = null;
      var g = gateI(ix, state, s, now, loc);
      if (!g.open) {
        if (g.endsAt === null) continue;                        // timer not started yet
        at = g.endsAt; reason = 'wait';
      }
      var tg = timeGateI(state, s, now);
      if (!tg.open && tg.at > at) { at = tg.at; reason = 'time'; }
      if (s.kind === 'move') {
        var a = anchorMs(state, s.move);
        if (isNum(a) && a > now && a > at) { at = a; reason = 'move'; }
      }
      if (reason === null || !(at > now)) continue;             // nothing time-based holds it back
      var alarm = s.kind !== 'move' && g.endsAt !== null && urgentI(ix, state, s, since);
      if (s.kind !== 'move' && !alarm) {                        // would it be offered then, or deferred / dropped?
        var res = resAt[at] === undefined ? (resAt[at] = reserveI(ix, state, loc, at, since)) : resAt[at];
        if (!keepI(ix, state, s, at, loc, res)) continue;
      }
      // same moment: what pick() would return then wins: an alarm; once it is time to go a must step, then the
      // move; otherwise the master order
      var rank = alarm ? 3 : (s.kind === 'move' ? 1 : (s.must === true && due(at) ? 2 : 0));
      if (!best || at < best.at || (at === best.at && rank > bestRank)) {
        best = { at: at, stepId: s.id, reason: reason };
        bestRank = rank;
      }
    }
    return best;
  }

  // ---------- reducers ----------

  function bump(state, now, patch) {
    if (!isNum(now)) return state;                              // a broken clock must not write NaN into a saved state
    var next = Object.assign({}, state, patch);
    next.rev = num(state.rev, 0) + 1;
    next.updatedAt = now;
    return next;
  }
  function hasDone(state, id) { var d = bag(state, 'done'); return own(d, id) && d[id] != null && d[id] !== false; }

  // One step done, without the rev bump. `step` is known and not done yet.
  function completeOne(ix, state, step, now, payload) {
    var stepId = step.id;
    var next = Object.assign({}, state);
    next.done = put(bag(state, 'done'), stepId, now);
    if (own(bag(state, 'skipped'), stepId)) next.skipped = drop(bag(state, 'skipped'), stepId);
    if (isObj(step.wait) && typeof step.wait.id === 'string') {
      next.waits = put(bag(state, 'waits'), step.wait.id, { start: now, mins: Math.max(0, num(step.wait.mins, 0)), by: stepId });
      next.laps = put(bag(state, 'laps'), step.wait.id, 0);
    }
    if (step.kind === 'choice' && isObj(step.choice) && typeof step.choice.opt === 'string' &&
        own(payload, 'value') && payload.value !== undefined) {
      next.opts = put(bag(state, 'opts'), step.choice.opt, payload.value);
    }
    if (isObj(state.fg) && state.fg.stepId === stepId) next.fg = null;
    // rules: conditions are read from the NEW state, in plan order
    var rules = list(ix.plan.rules);
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!isObj(r) || r.on !== stepId || !isObj(r.set)) continue;
      if (r.ifDone != null && !doneI(ix, next, ix.byId[r.ifDone])) continue;
      if (r.ifNotDone != null && doneI(ix, next, ix.byId[r.ifNotDone])) continue;
      next.opts = Object.assign({}, bag(next, 'opts'), r.set);
    }
    // leaving his place for good: whatever was not done there cannot be done any more
    if (step.kind === 'move' && step.move === 'leavePm') {
      var sk = Object.assign({}, bag(next, 'skipped'));
      for (var j = 0; j < ix.steps.length; j++) {
        var s = ix.steps[j];
        if (s.where === 'home' && s.id !== stepId && !doneI(ix, next, s)) sk[s.id] = true;
      }
      next.skipped = sk;
    }
    return next;
  }
  function completeI(ix, state, stepId, now, payload) {
    if (!isObj(state) || !isNum(now)) return state;
    var step = typeof stepId === 'string' ? ix.byId[stepId] : null;
    if (!step || hasDone(state, stepId)) return state;
    var next = state;
    // A later move marked done ("I'm here" without "I'm on my way") means the moves before it happened too.
    // They are completed first, at the same time, so their rules and the leavePm write-off run.
    var k = step.kind === 'move' ? MOVES.indexOf(step.move) : -1;
    for (var m = 0; m < k; m++) {
      var earlier = ix.moves[MOVES[m]];
      if (earlier && earlier.id !== stepId && !hasDone(next, earlier.id)) next = completeOne(ix, next, earlier, now);
    }
    next = completeOne(ix, next, step, now, payload);
    next.rev = num(state.rev, 0) + 1;
    next.updatedAt = now;
    return next;
  }
  function complete(plan, state, stepId, now, payload) { return completeI(index(plan), state, stepId, now, payload); }

  // Is option `key` = `value` still explained by something other than the rules of step `exceptId`?
  // (Another rule whose step is done and whose conditions hold, a ticked Tonight item, or a choice he answered.)
  function optJustified(ix, state, key, value, exceptId) {
    var rules = list(ix.plan.rules), i;
    for (i = 0; i < rules.length; i++) {
      var q = rules[i];
      if (!isObj(q) || q.on === exceptId || !isObj(q.set) || !own(q.set, key) || q.set[key] !== value) continue;
      if (typeof q.on !== 'string' || !hasDone(state, q.on)) continue;
      if (q.ifDone != null && !doneI(ix, state, ix.byId[q.ifDone])) continue;
      if (q.ifNotDone != null && doneI(ix, state, ix.byId[q.ifNotDone])) continue;
      return true;
    }
    var tonight = list(ix.plan.tonight), ticked = bag(state, 'tonight');
    for (i = 0; i < tonight.length; i++) {
      var it = tonight[i];
      if (isObj(it) && isObj(it.sets) && own(it.sets, key) && it.sets[key] === value && own(ticked, it.id) && ticked[it.id]) return true;
    }
    for (i = 0; i < ix.steps.length; i++) {
      var c = ix.steps[i];
      if (c.id !== exceptId && c.kind === 'choice' && isObj(c.choice) && c.choice.opt === key && hasDone(state, c.id)) return true;
    }
    return false;
  }
  // One step not done any more, without the rev bump. `step` is known.
  function uncompleteOne(ix, state, step) {
    var stepId = step.id, next = Object.assign({}, state);
    var wasDone = own(bag(state, 'done'), stepId);
    if (wasDone) next.done = drop(bag(state, 'done'), stepId);
    if (wasDone && isObj(step.wait) && typeof step.wait.id === 'string') {
      // the wait it armed. A record that another done step started (the other variant of the day) stays.
      var rec = waitRec(state, step.wait.id);
      var by = rec && typeof rec.by === 'string' && rec.by !== stepId ? ix.byId[rec.by] : null;
      var others = !!by && isObj(by.wait) && by.wait.id === step.wait.id && hasDone(state, by.id);
      if (!others) {
        if (own(bag(state, 'waits'), step.wait.id)) next.waits = drop(bag(state, 'waits'), step.wait.id);
        if (own(bag(state, 'laps'), step.wait.id)) next.laps = drop(bag(state, 'laps'), step.wait.id);
      }
    }
    if (step.kind === 'choice' && isObj(step.choice) && own(bag(state, 'opts'), step.choice.opt)) {
      next.opts = drop(bag(state, 'opts'), step.choice.opt);
    }
    if (wasDone) {
      // what plan.rules set when this step was completed is taken back, unless something else still explains it
      var rules = list(ix.plan.rules);
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (!isObj(r) || r.on !== stepId || !isObj(r.set)) continue;
        if (r.ifDone != null && !doneI(ix, state, ix.byId[r.ifDone])) continue;       // read from the state before the undo:
        if (r.ifNotDone != null && doneI(ix, state, ix.byId[r.ifNotDone])) continue;  // a rule that did not apply set nothing
        var keys = Object.keys(r.set);
        for (var k = 0; k < keys.length; k++) {
          var o = bag(next, 'opts');
          if (!own(o, keys[k]) || o[keys[k]] !== r.set[keys[k]]) continue;            // changed since: not this rule's value
          if (optJustified(ix, next, keys[k], r.set[keys[k]], stepId)) continue;
          next.opts = drop(o, keys[k]);
        }
      }
      if (step.kind === 'move' && step.move === 'leavePm') {
        // he has not left after all: the home steps that leaving had written off are open again
        var sk = Object.assign({}, bag(next, 'skipped'));
        for (var j = 0; j < ix.steps.length; j++) if (ix.steps[j].where === 'home') delete sk[ix.steps[j].id];
        next.skipped = sk;
      }
    }
    return next;
  }
  function uncomplete(plan, state, stepId, now) {
    if (!isObj(state) || !isNum(now)) return state;
    var ix = index(plan);
    var step = typeof stepId === 'string' ? ix.byId[stepId] : null;
    if (!step) return state;
    var wasDone = own(bag(state, 'done'), stepId);
    var answered = step.kind === 'choice' && isObj(step.choice) && own(bag(state, 'opts'), step.choice.opt);
    if (!wasDone && !answered) return state;                    // not done: nothing to take back (and no timer to drop)
    var next = state;
    if (wasDone && step.kind === 'move') {
      // "Not done" on a move puts him back in the place before it, so the moves after it are not done either
      for (var m = MOVES.length - 1; m > MOVES.indexOf(step.move) && MOVES.indexOf(step.move) >= 0; m--) {
        var later = ix.moves[MOVES[m]];
        if (later && later.id !== stepId && own(bag(next, 'done'), later.id)) next = uncompleteOne(ix, next, later);
      }
    }
    next = uncompleteOne(ix, next, step);
    if (wasDone && step.kind !== 'move' && step.where === 'home') {
      // a home step taken back after he left for her place cannot be done any more: written off like the others
      var loc = locI(ix, next);
      if (loc === 'drive' || loc === 'hers') next.skipped = put(bag(next, 'skipped'), stepId, true);
    }
    next.rev = num(state.rev, 0) + 1;
    next.updatedAt = now;
    return next;
  }

  function skip(plan, state, stepId, now) {
    if (!isObj(state)) return state;
    var ix = index(plan);
    var step = typeof stepId === 'string' ? ix.byId[stepId] : null;
    if (!step || hasDone(state, stepId) || skippedI(state, stepId)) return state;
    var patch = { skipped: put(bag(state, 'skipped'), stepId, true) };
    if (isObj(state.fg) && state.fg.stepId === stepId) patch.fg = null;
    return bump(state, now, patch);
  }

  function retry(plan, state, stepId, now) {
    if (!isObj(state)) return state;
    var ix = index(plan);
    var step = typeof stepId === 'string' ? ix.byId[stepId] : null;
    if (!step || step.kind !== 'check' || !isObj(step.check) || typeof step.afterWait !== 'string') return state;
    var mins = num(step.check.retryMins, 0);
    if (!(mins > 0)) return state;
    return bump(state, now, {
      waits: put(bag(state, 'waits'), step.afterWait, { start: now, mins: mins, by: stepId }),
      laps: put(bag(state, 'laps'), step.afterWait, 0)
    });
  }

  function giveUp(plan, state, stepId, now) {
    if (!isObj(state)) return state;
    var ix = index(plan);
    var step = typeof stepId === 'string' ? ix.byId[stepId] : null;
    var set = step && isObj(step.check) && isObj(step.check.giveUp) ? step.check.giveUp.set : null;
    if (!isObj(set)) return state;
    var o = bag(state, 'opts'), keys = Object.keys(set), same = true;
    for (var i = 0; i < keys.length; i++) if (!own(o, keys[i]) || o[keys[i]] !== set[keys[i]]) same = false;
    if (same) return state;                                     // already given up
    return bump(state, now, { opts: Object.assign({}, o, set) });
  }

  function canGiveUp(plan, state, stepOrId, now) {
    var ix = index(plan);
    var step = resolve(ix, stepOrId);
    var g = step && step.kind === 'check' && isObj(step.check) ? step.check.giveUp : null;
    if (!isObj(g)) return false;
    if (locI(ix, state) !== 'home-am') return false;            // SPEC 9.2: only in his kitchen in the morning
    if (!isObj(g.withinMinsOf)) return true;
    var at = anchorMs(state, g.withinMinsOf.anchor) - num(g.withinMinsOf.mins, 0) * MIN;
    return isNum(at) ? now >= at : true;
  }

  function ackLap(plan, state, waitId, n, now) {
    if (!isObj(state) || typeof waitId !== 'string' || !waitRec(state, waitId)) return state;
    var laps = bag(state, 'laps');
    var cur = Math.max(0, Math.floor(num(own(laps, waitId) ? laps[waitId] : 0, 0)));
    var want = isNum(n) ? Math.max(cur, Math.floor(n)) : cur + 1;
    if (want === cur) return state;
    return bump(state, now, { laps: put(laps, waitId, want) });
  }

  function tick(plan, state, stepId, itemId, on, now) {
    if (!isObj(state)) return state;
    var ix = index(plan);
    if (typeof stepId !== 'string' || !ix.byId[stepId]) return state;
    if (typeof itemId !== 'string' && typeof itemId !== 'number') return state;
    var ticks = bag(state, 'ticks');
    var mine = own(ticks, stepId) && isObj(ticks[stepId]) ? ticks[stepId] : EMPTY;
    var has = own(mine, itemId) && !!mine[itemId];
    if (has === !!on) return state;
    return bump(state, now, { ticks: put(ticks, stepId, on ? put(mine, itemId, true) : drop(mine, itemId)) });
  }

  function tickTonight(plan, state, id, on, now) {
    if (!isObj(state)) return state;
    var items = list(isObj(plan) ? plan.tonight : null), item = null;
    for (var i = 0; i < items.length; i++) if (isObj(items[i]) && items[i].id === id) { item = items[i]; break; }
    if (!item) return state;
    var t = bag(state, 'tonight');
    var has = own(t, id) && !!t[id];
    if (has === !!on) return state;
    var patch = { tonight: on ? put(t, id, true) : drop(t, id) };
    if (on && isObj(item.sets)) patch.opts = Object.assign({}, bag(state, 'opts'), item.sets);
    if (!on && isObj(item.sets)) {
      // unticking takes back what the tick decided, so the question is asked again (unless he answered it himself since)
      var ix = index(plan), o = bag(state, 'opts'), keys = Object.keys(item.sets), mine = null;
      for (var k = 0; k < keys.length; k++) {
        if (!own(o, keys[k]) || o[keys[k]] !== item.sets[keys[k]]) continue;
        if (optJustified(ix, Object.assign({}, state, patch), keys[k], item.sets[keys[k]], null)) continue;
        mine = mine || Object.assign({}, o);
        delete mine[keys[k]];
      }
      if (mine) patch.opts = mine;
    }
    return bump(state, now, patch);
  }

  function setOpt(plan, state, name, value, now) {
    if (!isObj(state) || typeof name !== 'string' || !name) return state;
    var o = bag(state, 'opts');
    if (value === undefined) return own(o, name) ? bump(state, now, { opts: drop(o, name) }) : state;
    if (own(o, name) && o[name] === value) return state;
    return bump(state, now, { opts: put(o, name, value) });
  }

  function setAnchor(plan, state, name, minutes, now) {
    if (!isObj(state) || typeof name !== 'string' || !isNum(minutes)) return state;
    var a = bag(state, 'anchors');
    if (!own(a, name)) return state;
    var v = Math.min(1439, Math.max(0, Math.round(minutes)));
    if (v === a[name]) return state;
    // neighbours = the other anchors, by their current time
    var keys = Object.keys(a);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === name || !isNum(a[k]) || !isNum(a[name])) continue;
      if (a[k] < a[name] && v <= a[k]) return state;      // would touch or cross the one before
      if (a[k] > a[name] && v >= a[k]) return state;      // would touch or cross the one after
      if (a[k] === a[name]) continue;
    }
    return bump(state, now, { anchors: put(a, name, v) });
  }

  function startFg(plan, state, stepId, endsAt, now) {
    if (!isObj(state) || typeof stepId !== 'string' || !isNum(endsAt)) return state;
    if (!index(plan).byId[stepId]) return state;
    return bump(state, now, { fg: { stepId: stepId, endsAt: endsAt } });
  }
  function clearFg(plan, state, now) {
    if (!isObj(state) || state.fg == null) return state;
    return bump(state, now, { fg: null });
  }

  function initialState(plan, device, now) {
    var d = new Date(isNum(now) ? now : 0);
    var day = d.getHours() < 16 ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return {
      v: 1, day: ymd(day),
      anchors: Object.assign({}, isObj(plan) && isObj(plan.anchors) ? plan.anchors : EMPTY),
      opts: {}, done: {}, skipped: {}, waits: {}, laps: {}, ticks: {}, tonight: {},
      fg: null, rev: 0, updatedAt: 0, device: typeof device === 'string' ? device : ''
    };
  }
  function setDay(plan, state, day, now) {
    if (!isObj(state) || typeof day !== 'string') return state;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!m) return state;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (ymd(d) !== day || day === state.day) return state;      // not a real calendar date, or no change
    return bump(state, now, { day: day });
  }

  // ---------- waits and alerts ----------

  function waitsViewI(ix, state, now) {
    var out = [];
    var ids = Object.keys(bag(state, 'waits'));
    var acks = bag(state, 'laps');
    var since = stayStart(ix, state);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var r = waitRec(state, id);
      if (!r) continue;
      var def = waitDefI(ix, state, id) || EMPTY;
      var end = r.start + r.mins * MIN;
      var gated = ix.gated[id] || NONE, target = null, anyActive = false;
      for (var g = 0; g < gated.length; g++) {
        if (!activeI(ix, state, gated[g])) continue;
        anyActive = true;
        if (!doneI(ix, state, gated[g])) { target = gated[g]; break; }
      }
      if (anyActive && !target) continue;            // the step it was holding back is done
      if (!anyActive && now >= end) continue;        // holds nothing back: listed until it ends
      var here = r.start > since;                    // started in the kitchen he is in now
      if (!here && (def.attended === true || now >= end)) continue;   // a burner he left behind, or old news
      var acked = Math.max(0, Math.floor(num(own(acks, id) ? acks[id] : 0, 0)));
      var mins = list(def.laps).filter(function (m) { return isNum(m) && m > 0 && m < r.mins; })
                               .slice().sort(function (a, b) { return a - b; });
      var laps = [];
      for (var k = 0; k < mins.length; k++) {
        var at = r.start + mins[k] * MIN;
        laps.push({ n: k + 1, at: at, due: now >= at, acked: k + 1 <= acked });
      }
      var label = typeof def.label === 'string' && def.label ? def.label : id;
      out.push({
        id: id, label: label,
        lapLabel: typeof def.lapLabel === 'string' && def.lapLabel ? def.lapLabel : label,
        by: typeof r.by === 'string' ? r.by : null,
        gatedStepId: target ? target.id : null,
        startedAt: r.start, endsAt: end, remainingMs: Math.max(0, end - now), elapsed: now >= end,
        urgent: def.urgent === true, attended: def.attended === true, laps: laps,
        overMax: isNum(def.max) && now > r.start + def.max * MIN, here: here
      });
    }
    out.sort(function (a, b) { return a.endsAt - b.endsAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    return out;
  }

  function alertsI(ix, state, now) {
    var views = waitsViewI(ix, state, now);
    var laps = [], ended = [], over = [], i, v;
    for (i = 0; i < views.length; i++) {
      v = views[i];
      if (!v.here) continue;                          // nothing rings for a kitchen he has left
      if (!v.elapsed) {                               // once the timer ends, its own step takes over
        var due = null;
        for (var k = 0; k < v.laps.length; k++) if (v.laps[k].due) due = v.laps[k];
        if (due && !due.acked) {
          var lap = { kind: 'lap', id: 'lap:' + v.id + ':' + due.n, title: v.lapLabel + ' (' + due.n + ' of ' + v.laps.length + ')',
                      waitId: v.id, lap: due.n, lapOf: v.laps.length, at: due.at };
          if (v.by) lap.stepId = v.by;
          laps.push(lap);
        }
      }
      if (v.urgent && v.elapsed) {
        var w = { kind: 'wait', id: 'wait:' + v.id, title: 'Time is up: ' + v.label, waitId: v.id, at: v.endsAt };
        if (v.gatedStepId) w.stepId = v.gatedStepId;
        ended.push(w);
      }
      if (v.overMax) {
        var m = { kind: 'max', id: 'max:' + v.id, title: 'Too long: ' + v.label, waitId: v.id, at: v.startedAt };
        if (v.gatedStepId) m.stepId = v.gatedStepId;
        over.push(m);
      }
    }
    var byAt = function (a, b) { return a.at - b.at; };
    var out = laps.sort(byAt).concat(ended.sort(byAt), over.sort(byAt));
    for (i = 0; i < out.length; i++) delete out[i].at;
    var loc = locI(ix, state);
    var name = loc === 'home-am' ? 'leaveAm' : loc === 'home-pm' ? 'leavePm' : null;
    var mv = name ? ix.moves[name] : null;
    var a = name ? anchorMs(state, name) : NaN;
    if (mv && isNum(a) && !doneI(ix, state, mv) && now >= a - 10 * MIN) {
      var left = Math.floor((a - now) / MIN);         // rounded down: never promises time he does not have
      out.push({ kind: 'leave', id: 'leave:' + name, title: left >= 1 ? 'Leave in ' + left + ' min' : 'Time to leave',
                 stepId: mv.id, minsLeft: left });
    }
    return out;
  }

  // ---------- lists and progress ----------

  function itemShows(ix, state, item) {
    if (item.ifDone != null && !doneI(ix, state, ix.byId[item.ifDone])) return false;
    if (item.ifNotDone != null && doneI(ix, state, ix.byId[item.ifNotDone])) return false;
    return whenI(ix, state, item.when);
  }
  function itemRows(ix, state, items, stepId) {
    var ticks = bag(state, 'ticks');
    var mine = stepId !== null && own(ticks, stepId) && isObj(ticks[stepId]) ? ticks[stepId] : EMPTY;
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], row;
      if (typeof it === 'string') row = { id: 'i' + i, label: it, note: '' };
      else if (isObj(it)) {
        if (!itemShows(ix, state, it)) continue;
        row = { id: typeof it.id === 'string' || typeof it.id === 'number' ? it.id : 'i' + i,
                label: typeof it.label === 'string' ? it.label : '', note: typeof it.note === 'string' ? it.note : '' };
      } else continue;
      row.ticked = own(mine, row.id) && !!mine[row.id];
      row.stepId = stepId;
      out.push(row);
    }
    return out;
  }
  function packItems(ix, which) {
    var pack = ix.plan.pack;
    return typeof which === 'string' && own(pack, which) ? list(pack[which]) : NONE;
  }
  function packList(plan, state, which) {
    var ix = index(plan), stepId = null;
    for (var i = 0; i < ix.steps.length; i++) {
      if (ix.steps[i].kind === 'checklist' && ix.steps[i].items === which) { stepId = ix.steps[i].id; break; }
    }
    return itemRows(ix, state, packItems(ix, which), stepId);
  }
  function checklistItems(plan, state, stepOrId) {
    var ix = index(plan);
    var step = resolve(ix, stepOrId);
    if (!step) return [];
    var items = typeof step.items === 'string' ? packItems(ix, step.items) : list(step.items);
    return itemRows(ix, state, items, step.id);
  }
  function progressI(ix, state, dishId) {
    var done = 0, total = 0;
    for (var i = 0; i < ix.steps.length; i++) {
      var s = ix.steps[i];
      if (dishId !== undefined && s.dish !== dishId) continue;
      if (s.optional === true || !activeI(ix, state, s)) continue;
      total++;
      if (doneI(ix, state, s)) done++;
    }
    return { done: done, total: total };
  }

  // ---------- projection ----------

  // Where he was at a past moment, and when he got there, from the times the move steps were done.
  function placeAt(ix, state, ms) {
    var d = bag(state, 'done');
    for (var i = MOVES.length - 1; i >= 0; i--) {
      var s = ix.moves[MOVES[i]];
      if (s && own(d, s.id) && isNum(d[s.id]) && ms > d[s.id]) return { loc: MOVE_TO[MOVES[i]], since: d[s.id] };
    }
    return { loc: 'home-am', since: -Infinity };
  }
  function isDeferred(step, loc) { return step.where === 'either' && step.block === 'am' && loc === 'hers'; }
  function titles(ix, ids) {
    return ids.map(function (id) { var s = ix.byId[id]; return s && typeof s.title === 'string' && s.title ? s.title : id; }).join(', ');
  }

  function project(plan, state, now) {
    var ix = index(plan);
    var st = isObj(state) ? state : EMPTY;
    var entries = [], byStep = {}, seq = 0, stove = [];
    function add(key, row) { entries.push({ k: key, s: seq++, row: row }); return row; }
    function waitRow(s, id, loc) {
      var r = waitRec(s, id);
      if (!r) return;
      var def = waitDefI(ix, s, id);
      var row = add(r.start, { type: 'wait', waitId: id, label: def && typeof def.label === 'string' && def.label ? def.label : id,
                               start: r.start, end: r.start + r.mins * MIN, loc: loc });
      if (def && def.attended === true && loc === 'home-am') stove.push({ row: row, by: typeof r.by === 'string' ? r.by : null });
    }

    // 1. what already happened
    var d = bag(st, 'done'), i, s;
    for (i = 0; i < ix.steps.length; i++) {
      s = ix.steps[i];
      if (!own(d, s.id) || !isNum(d[s.id]) || own(byStep, s.id)) continue;
      var at = d[s.id];
      if (s.kind === 'move' && MOVE_FROM[s.move]) {
        add(at, { type: 'move', stepId: s.id, at: at, loc: MOVE_FROM[s.move], to: MOVE_TO[s.move], status: 'done' });
        byStep[s.id] = { start: at, end: at, status: 'done', loc: MOVE_FROM[s.move], deferred: false };
        continue;
      }
      var pl = placeAt(ix, st, at);
      var began = Math.min(at, Math.max(at - stepMins(s) * MIN, pl.since));   // not before he got to that place
      var doneRow = add(began, { type: 'step', stepId: s.id, start: began, end: at, status: 'done', loc: pl.loc });
      if (isDeferred(s, pl.loc)) doneRow.deferred = true;
      byStep[s.id] = { start: began, end: at, status: 'done', loc: pl.loc, deferred: doneRow.deferred === true };
    }
    var liveWaits = Object.keys(bag(st, 'waits'));
    for (i = 0; i < liveWaits.length; i++) {
      var lr = waitRec(st, liveWaits[i]);
      if (lr) waitRow(st, liveWaits[i], placeAt(ix, st, lr.start).loc);
    }

    // 2. the rest of the day, one cook, same pick() the live screen uses
    var L1 = anchorMs(st, 'leaveAm'), L2 = anchorMs(st, 'leavePm');
    var backA = anchorMs(st, 'backHome'), arriveA = anchorMs(st, 'arrive');
    var startA = anchorMs(st, 'start'), dinnerA = anchorMs(st, 'dinner');
    var driveMs = isNum(arriveA) && isNum(L2) ? Math.max(0, arriveA - L2) : 0;
    var t = isNum(now) ? now : 0;
    // Begin at the start anchor while nothing is done yet, and on any day before the cook day (one step done the
    // evening before does not move the morning into the night). Once he has begun on the day itself, follow him.
    if (isNum(startA) && t < startA && (Object.keys(d).length === 0 || t < dayMs(st))) t = startA;
    var t0 = t;
    var nowPick = pickI(ix, st, now);
    var nextId = nowPick ? nowPick.id : null;
    var sim = st, stuck = false;

    function doMove(mv, when) {
      var status = mv.id === nextId ? 'next' : 'later';
      var before = sim;
      sim = completeI(ix, sim, mv.id, when);
      if (sim === before) { stuck = true; return; }
      add(when, { type: 'move', stepId: mv.id, at: when, loc: MOVE_FROM[mv.move], to: MOVE_TO[mv.move], status: status });
      byStep[mv.id] = { start: when, end: when, status: status, loc: MOVE_FROM[mv.move], deferred: false };
      t = when;
    }

    for (var guard = 0; guard < SIM_GUARD && !stuck; guard++) {
      var loc = locI(ix, sim);
      var mv = LOC_MOVE[loc] ? ix.moves[LOC_MOVE[loc]] : null;
      if (loc === 'away' || loc === 'drive') {            // nothing to cook: just get to the next place
        if (!mv) break;
        var when;
        if (loc === 'away') when = isNum(backA) ? Math.max(t, backA) : t;
        else {
          var left = ix.moves.leavePm ? bag(sim, 'done')[ix.moves.leavePm.id] : NaN;
          when = isNum(left) ? Math.max(t, left + driveMs) : t + driveMs;
        }
        doMove(mv, when);
        continue;
      }
      s = pickI(ix, sim, t);
      if (s) {
        if (s.kind === 'move') { doMove(s, t); continue; }
        var end = t + stepMins(s) * MIN;
        var payload;
        if (s.kind === 'choice' && isObj(s.choice)) {      // assume the default answer
          var v = optI(ix, sim, s.choice.opt);
          if (v === undefined && isObj(list(s.choice.options)[0])) v = s.choice.options[0].value;
          if (v !== undefined) payload = { value: v };
        }
        var prev = sim;
        sim = completeI(ix, sim, s.id, end, payload);       // check steps: assume "yes" the first time
        if (sim === prev) break;
        var status = s.id === nextId ? 'next' : 'later';
        var row = add(t, { type: 'step', stepId: s.id, start: t, end: end, status: status, loc: loc });
        if (isDeferred(s, loc)) row.deferred = true;
        byStep[s.id] = { start: t, end: end, status: status, loc: loc, deferred: row.deferred === true };
        if (isObj(s.wait) && typeof s.wait.id === 'string') waitRow(sim, s.wait.id, loc);
        t = end;
        continue;
      }
      var hard = loc === 'home-am' ? L1 : loc === 'home-pm' ? L2 : NaN;
      var u = nextUnlockI(ix, sim, t);
      if (u && u.at > t && (!isNum(hard) || u.at <= hard)) {      // at the hard out itself pick() decides: alarm, must, or go
        if (u.at - t >= 3 * MIN) add(t, { type: 'free', start: t, end: u.at, loc: loc, nextStepId: u.stepId });
        t = u.at;
        continue;
      }
      if (!mv) break;                                       // her kitchen and nothing left: the day is over
      var go = isNum(hard) ? Math.max(t, hard) : t;         // the hard out is hard
      if (go - t >= 3 * MIN) add(t, { type: 'free', start: t, end: go, loc: loc, nextStepId: mv.id });
      doMove(mv, go);
    }

    // 3. summary
    entries.sort(function (a, b) { return a.k - b.k || a.s - b.s; });
    var rows = entries.map(function (e) { return e.row; });
    var hasDinner = own(byStep, 'dinner');
    var dinnerAt = hasDinner ? byStep.dinner.start : null;
    var lateMin = hasDinner && isNum(dinnerA) ? Math.max(0, Math.round((dinnerAt - dinnerA) / MIN)) : 0;
    var overrun = [], deferred = [], lastEnd = t0;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.type === 'move') { if (r.at > lastEnd) lastEnd = r.at; continue; }
      if (r.type !== 'step') continue;
      if (r.stepId !== 'dinner' && r.end > lastEnd) lastEnd = r.end;
      if (r.status === 'done') continue;
      var deadline = r.loc === 'home-am' ? L1 : r.loc === 'home-pm' ? L2 : dinnerA;
      if (r.stepId === 'dinner' ? lateMin > 0 : (isNum(deadline) && r.end > deadline)) r.late = true;
      if (r.loc === 'home-am' && isNum(L1) && r.end > L1) overrun.push(r.stepId);
      if (r.deferred) deferred.push(r.stepId);
    }
    // A home-only step whose stove time (attended wait) is still running at the planned morning leave: the plan would
    // have him walk out with the burner on. Named under 'am-overrun' too, after the steps that end late.
    var leaveRow = ix.moves.leaveAm && own(byStep, ix.moves.leaveAm.id) ? byStep[ix.moves.leaveAm.id] : null;
    var lateSteps = overrun.length;
    if (leaveRow && leaveRow.status !== 'done') {
      for (i = 0; i < stove.length; i++) {
        var sw = stove[i], armer = sw.by ? ix.byId[sw.by] : null;
        if (!armer || armer.where !== 'home' || !(sw.row.start <= leaveRow.start && sw.row.end > leaveRow.start)) continue;
        // Not news when the step that takes it off the heat is done before he goes, was skipped by him, or was
        // switched off by the plan's own rules on leaving (the plan then says what happens to the pot: 'beans-later').
        var held = ix.gated[sw.row.waitId] || NONE, open = held.length === 0;
        for (var h = 0; h < held.length; h++) {
          var hs = held[h];
          if (!whenI(ix, sim, hs.when) || skippedI(st, hs.id)) continue;
          if (own(byStep, hs.id) && byStep[hs.id].end <= leaveRow.start) continue;
          open = true;
        }
        if (open && overrun.indexOf(armer.id) < 0) overrun.push(armer.id);
      }
    }
    var dinnerStep = ix.byId.dinner;
    if (dinnerStep && typeof dinnerStep.afterWait === 'string') {
      var dw = waitRec(sim, dinnerStep.afterWait);
      if (dw && dw.start + dw.mins * MIN > lastEnd) lastEnd = dw.start + dw.mins * MIN;
    }
    var dinnerDone = hasDinner && byStep.dinner.status === 'done';
    var spareMin = hasDinner && !dinnerDone && isNum(dinnerA) ? Math.max(0, Math.floor((dinnerA - lastEnd) / MIN)) : 0;

    var missed = [];
    for (i = 0; i < ix.steps.length; i++) {
      s = ix.steps[i];
      if (s.optional === true || skippedI(st, s.id) || !whenI(ix, sim, s.when) || doneI(ix, sim, s)) continue;
      missed.push(s.id);
    }
    var warnings = [];
    if (lateMin > 0) warnings.push({ code: 'late', text: 'Dinner is running about ' + lateMin + ' min late.' });
    if (overrun.length) warnings.push({ code: 'am-overrun', stepIds: overrun,
      text: lateSteps ? 'You will leave your place late. Running past ' + fmtClock(L1) + ': ' + titles(ix, overrun) + '.'
                      : 'Still on the stove when it is time to leave at ' + fmtClock(L1) + ': ' + titles(ix, overrun) + '.' });
    if (missed.length) warnings.push({ code: 'missed', stepIds: missed, text: 'No time for: ' + titles(ix, missed) + '.' });
    if (deferred.length) warnings.push({ code: 'deferred', stepIds: deferred, text: 'Moved to her kitchen: ' + titles(ix, deferred) + '.' });
    if (optI(ix, sim, 'beansLater') === true) {
      // shown while that work is still ahead: a step that exists only when beansLater is true and is not done yet
      var any = false, ahead = false;
      for (i = 0; i < ix.steps.length; i++) {
        s = ix.steps[i];
        if (!isObj(s.when) || s.when.beansLater !== true) continue;
        any = true;
        if (!doneI(ix, st, s) && !skippedI(st, s.id)) ahead = true;
      }
      if (any ? ahead : !dinnerDone) warnings.push({ code: 'beans-later', text: 'The beans finish cooking at her place.' });
    }

    return { now: now, rows: rows, byStep: byStep, dinnerAt: dinnerAt, dinnerAnchor: dinnerA,
             lateMin: lateMin, spareMin: spareMin, warnings: warnings };
  }

  // ---------- formatting ----------

  function fmtClock(ms) {
    if (!isNum(ms)) return '';
    var d = new Date(ms);
    var h = d.getHours(), h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad2(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function fmtDur(mins) {
    var m = Math.max(0, num(mins, 0));
    if (m > 0 && m < 1) {
      var secs = Math.max(1, Math.round(m * 60));
      if (secs < 60) return secs + ' sec';
    }
    var r = Math.round(m);
    if (r < 60) return r + ' min';
    return Math.floor(r / 60) + ' hr' + (r % 60 ? ' ' + (r % 60) + ' min' : '');
  }
  function fmtCountdown(ms) {
    var s = Math.max(0, Math.ceil(num(ms, 0) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s % 60) : m + ':' + pad2(s % 60);
  }

  // ---------- validate ----------

  function excludes(a, b) {            // two steps that can never be active in the same variant of the day
    if (!isObj(a.when) || !isObj(b.when)) return false;
    var keys = Object.keys(a.when);
    for (var i = 0; i < keys.length; i++) if (own(b.when, keys[i]) && b.when[keys[i]] !== a.when[keys[i]]) return true;
    return false;
  }
  function validate(plan) {
    var p = [];
    if (!isObj(plan)) return ['The plan is missing.'];
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) return ['plan.steps is missing or empty.'];
    var steps = plan.steps;
    var anchors = isObj(plan.anchors) ? plan.anchors : EMPTY;
    var glossary = isObj(plan.glossary) ? plan.glossary : EMPTY;
    var pack = isObj(plan.pack) ? plan.pack : EMPTY;
    var i, j, s, tag;

    var names = ['start', 'leaveAm', 'backHome', 'leavePm', 'arrive', 'dinner'];
    for (i = 0; i < names.length; i++) {
      if (!own(anchors, names[i]) || !isNum(anchors[names[i]])) p.push('Anchor "' + names[i] + '" is missing or not a number.');
      else if (i > 0 && isNum(anchors[names[i - 1]]) && anchors[names[i]] <= anchors[names[i - 1]]) {
        p.push('Anchor "' + names[i] + '" must be later than "' + names[i - 1] + '".');
      }
    }

    var dishIds = Object.create(null);
    var dishes = list(plan.dishes);
    for (i = 0; i < dishes.length; i++) {
      if (!isObj(dishes[i]) || typeof dishes[i].id !== 'string') { p.push('Dish #' + (i + 1) + ' has no id.'); continue; }
      if (dishIds[dishes[i].id]) p.push('Dish id "' + dishes[i].id + '" is used twice.');
      dishIds[dishes[i].id] = true;
    }

    var pos = Object.create(null), armers = Object.create(null), moveCount = Object.create(null);
    for (i = 0; i < steps.length; i++) {
      s = steps[i];
      if (!isObj(s) || typeof s.id !== 'string' || !s.id) { p.push('Step #' + (i + 1) + ' has no id.'); continue; }
      if (pos[s.id] !== undefined) p.push('Step id "' + s.id + '" is used twice.');
      else pos[s.id] = i;
      if (isObj(s.wait) && typeof s.wait.id === 'string') (armers[s.wait.id] || (armers[s.wait.id] = [])).push(i);
    }

    function links(value, where, depth) {      // every [[key]] / [[key|shown]] must be in the glossary
      if (typeof value === 'string') {
        var re = /\[\[([^\]|]*)(?:\|[^\]]*)?\]\]/g, m;
        while ((m = re.exec(value)) !== null) {
          var key = m[1].trim();
          if (!own(glossary, key)) p.push(where + ': glossary term "[[' + key + ']]" is not in the glossary.');
        }
      } else if (isObj(value) && depth < 8) {
        var ks = Object.keys(value);
        for (var q = 0; q < ks.length; q++) links(value[ks[q]], where, depth + 1);
      }
    }
    function stepRef(id, field, where) {
      if (typeof id !== 'string' || pos[id] === undefined) { p.push(where + ': "' + field + '" names "' + id + '", which is not a step.'); return false; }
      return true;
    }
    function anchorRef(a, field, where) {
      if (typeof a !== 'string' || !own(anchors, a)) p.push(where + ': "' + field + '" names anchor "' + a + '", which does not exist.');
    }

    for (i = 0; i < steps.length; i++) {
      s = steps[i];
      if (!isObj(s) || typeof s.id !== 'string' || !s.id) continue;
      tag = 'Step "' + s.id + '"';
      var kind = s.kind === undefined ? 'do' : s.kind;
      if (KINDS.indexOf(kind) < 0) p.push(tag + ': unknown kind "' + s.kind + '".');
      if (kind !== 'move' || s.where !== undefined) {
        if (WHERES.indexOf(s.where) < 0) p.push(tag + ': "where" must be home, hers or either.');
      }
      if (s.dish !== 'day' && !(typeof s.dish === 'string' && dishIds[s.dish])) p.push(tag + ': dish "' + s.dish + '" does not exist.');
      if (s.mins !== undefined && !(isNum(s.mins) && s.mins >= 0)) p.push(tag + ': "mins" must be a number, 0 or more.');
      if (s.timer !== undefined && !(isObj(s.timer) && isNum(s.timer.secs) && s.timer.secs > 0)) p.push(tag + ': "timer.secs" must be a number above 0.');

      if (s.after !== undefined && !Array.isArray(s.after)) p.push(tag + ': "after" must be a list of step ids.');
      var after = list(s.after);
      for (j = 0; j < after.length; j++) {
        if (!stepRef(after[j], 'after', tag)) continue;
        var dep = steps[pos[after[j]]];
        if (pos[after[j]] >= i && !excludes(dep, s)) p.push(tag + ': needs "' + after[j] + '", which must come earlier in the master order.');
      }
      if (s.wait !== undefined) {
        if (!isObj(s.wait) || typeof s.wait.id !== 'string' || !s.wait.id) p.push(tag + ': "wait" needs an id.');
        else if (!(isNum(s.wait.mins) && s.wait.mins >= 0)) p.push(tag + ': "wait.mins" must be a number, 0 or more.');
      }
      if (s.afterWait !== undefined) {
        var arm = typeof s.afterWait === 'string' ? armers[s.afterWait] : null;
        if (!arm) p.push(tag + ': "afterWait" names wait "' + s.afterWait + '", which no step starts.');
        else {
          for (j = 0; j < arm.length; j++) {
            if (arm[j] >= i && !excludes(steps[arm[j]], s)) {
              p.push(tag + ': waits for "' + s.afterWait + '", but "' + steps[arm[j]].id + '" starts that wait later in the master order.');
            }
          }
        }
      }
      if (s.notBefore !== undefined) {
        if (!isObj(s.notBefore)) p.push(tag + ': "notBefore" must be {anchor, mins}.');
        else anchorRef(s.notBefore.anchor, 'notBefore', tag);
      }
      if (kind === 'check') {
        if (!isObj(s.check)) p.push(tag + ': a check step needs "check".');
        else if (isObj(s.check.giveUp) && isObj(s.check.giveUp.withinMinsOf)) anchorRef(s.check.giveUp.withinMinsOf.anchor, 'withinMinsOf', tag);
      }
      if (kind === 'choice' && !(isObj(s.choice) && typeof s.choice.opt === 'string' && Array.isArray(s.choice.options) && s.choice.options.length)) {
        p.push(tag + ': a choice step needs "choice" with an opt and options.');
      }
      if (kind === 'checklist' && !(Array.isArray(s.items) || (typeof s.items === 'string' && own(pack, s.items)))) {
        p.push(tag + ': "items" must be a pack list name or a list of strings.');
      }
      if (kind === 'move') {
        if (MOVES.indexOf(s.move) < 0) p.push(tag + ': unknown move "' + s.move + '".');
        else moveCount[s.move] = (moveCount[s.move] || 0) + 1;
      }
      links(s, tag, 0);
    }
    for (i = 0; i < MOVES.length; i++) {
      var n = moveCount[MOVES[i]] || 0;
      if (n !== 1) p.push('There must be exactly one move step for "' + MOVES[i] + '" (found ' + n + ').');
    }
    var last = steps[steps.length - 1];
    if (!isObj(last) || last.id !== 'dinner') p.push('The last step must have id "dinner".');

    var rules = list(plan.rules);
    for (i = 0; i < rules.length; i++) {
      tag = 'Rule #' + (i + 1);
      if (!isObj(rules[i])) { p.push(tag + ' is not an object.'); continue; }
      stepRef(rules[i].on, 'on', tag);
      if (rules[i].ifDone !== undefined) stepRef(rules[i].ifDone, 'ifDone', tag);
      if (rules[i].ifNotDone !== undefined) stepRef(rules[i].ifNotDone, 'ifNotDone', tag);
      if (!isObj(rules[i].set)) p.push(tag + ': "set" is missing.');
    }
    var packNames = Object.keys(pack);
    for (i = 0; i < packNames.length; i++) {
      var items = list(pack[packNames[i]]), seen = Object.create(null);
      for (j = 0; j < items.length; j++) {
        tag = 'Pack list "' + packNames[i] + '" item #' + (j + 1);
        if (!isObj(items[j]) || typeof items[j].id !== 'string') { p.push(tag + ' has no id.'); continue; }
        if (seen[items[j].id]) p.push(tag + ': id "' + items[j].id + '" is used twice.');
        seen[items[j].id] = true;
        if (items[j].ifDone !== undefined) stepRef(items[j].ifDone, 'ifDone', tag);
        if (items[j].ifNotDone !== undefined) stepRef(items[j].ifNotDone, 'ifNotDone', tag);
      }
    }
    var tonight = list(plan.tonight), seenTonight = Object.create(null);
    for (i = 0; i < tonight.length; i++) {
      tag = 'Tonight item #' + (i + 1);
      if (!isObj(tonight[i]) || typeof tonight[i].id !== 'string' || !tonight[i].id) { p.push(tag + ' has no id.'); continue; }
      if (seenTonight[tonight[i].id]) p.push(tag + ': id "' + tonight[i].id + '" is used twice.');
      seenTonight[tonight[i].id] = true;
    }
    links(plan.tonight, 'Tonight list', 0);
    links(plan.dishes, 'Dishes', 0);
    links(plan.glossary, 'Glossary', 0);
    links(plan.pack, 'Pack lists', 0);
    links(plan.containers, 'Containers', 0);
    return p;
  }

  // ---------- public wrappers ----------

  function location(plan, state) { return locI(index(plan), state); }
  function opt(plan, state, name) { return optI(index(plan), state, name); }
  function stepById(plan, id) { return typeof id === 'string' ? (index(plan).byId[id] || null) : null; }
  function isActive(plan, state, stepOrId) {
    var ix = index(plan), step = resolve(ix, stepOrId);
    return !!step && activeI(ix, state, step);
  }
  function isDone(plan, state, stepOrId) {
    var ix = index(plan), step = resolve(ix, stepOrId);
    return !!step && doneI(ix, state, step);
  }
  function isAvailable(plan, state, stepOrId, now) {
    var ix = index(plan), step = resolve(ix, stepOrId);
    return !!step && availI(ix, state, step, now, locI(ix, state));
  }
  function blockers(plan, state, stepOrId, now) {
    var ix = index(plan), step = resolve(ix, stepOrId), out = [];
    if (!step || !activeI(ix, state, step) || doneI(ix, state, step)) return out;
    var deps = unmetDeps(ix, state, step);
    for (var i = 0; i < deps.length; i++) out.push({ type: 'after', stepId: deps[i] });
    var loc = locI(ix, state);
    var g = gateI(ix, state, step, now, loc);
    if (!g.open) out.push({ type: 'wait', waitId: g.waitId, endsAt: g.endsAt });
    var tg = timeGateI(state, step, now);
    if (!tg.open) out.push({ type: 'time', at: tg.at });
    if (!placeOk(step, loc)) {
      out.push({ type: 'place', where: step.kind === 'move' ? (MOVE_FROM[step.move] || null) : (WHERES.indexOf(step.where) >= 0 ? step.where : 'either') });
    }
    return out;
  }
  function pick(plan, state, now) { return pickI(index(plan), state, now); }
  function nextStep(plan, state, now) { var s = pickI(index(plan), state, now); return s ? s.id : null; }
  function nextUnlock(plan, state, now) { return nextUnlockI(index(plan), state, now); }
  function waitsView(plan, state, now) { return waitsViewI(index(plan), state, now); }
  function alerts(plan, state, now) { return alertsI(index(plan), state, now); }
  function progress(plan, state) { return progressI(index(plan), state, undefined); }
  function dishProgress(plan, state, dishId) { return progressI(index(plan), state, dishId === undefined ? null : dishId); }

  return {
    dayMs: dayMs, anchorMs: anchorMs,
    location: location, opt: opt, stepById: stepById, isActive: isActive, isDone: isDone, isAvailable: isAvailable,
    blockers: blockers, stepMins: stepMins, needMins: needMins, canGiveUp: canGiveUp,
    pick: pick, nextStep: nextStep, nextUnlock: nextUnlock,
    initialState: initialState, setDay: setDay, complete: complete, uncomplete: uncomplete, skip: skip, retry: retry,
    giveUp: giveUp, ackLap: ackLap, tick: tick, tickTonight: tickTonight, setOpt: setOpt, setAnchor: setAnchor,
    startFg: startFg, clearFg: clearFg,
    waitsView: waitsView, alerts: alerts,
    project: project,
    packList: packList, checklistItems: checklistItems, progress: progress, dishProgress: dishProgress,
    fmtClock: fmtClock, fmtDur: fmtDur, fmtCountdown: fmtCountdown,
    validate: validate
  };
});
