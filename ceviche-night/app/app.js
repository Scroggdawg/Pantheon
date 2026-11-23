/*
 * Ceviche Night: the phone guide (primary UI).
 *
 * Sections, in order:
 *   1. time source          one now() for everything; tests replace it with __cook.setClock
 *   2. plan index, helpers  lookups, escaping, glossary markup, icons
 *   3. store                localStorage (state + a little UI state), sessionStorage (undo), cloud mirror
 *   4. engine access        thin, defensive wrappers
 *   5. actions              every change goes through here: reducer -> save -> sync -> render
 *   6. alarms and sound     WebAudio beeps, alert schedule
 *   7. wake lock
 *   8. capabilities         db sync, Ask, read aloud (all optional)
 *   9. router               #now #day #dishes #dish-<id> #setup #board
 *  10. views                Now, Day, Dishes, Setup
 *  11. sheets               step, glossary, help
 *  12. preview mode
 *  13. window.CookApp       the contract for board.js
 *  14. boot
 *
 * Rendering rule: a state change rebuilds the active view from data. The 1-second tick only touches
 * clocks, countdown text nodes, banners, chips and the action bar. It never rebuilds a step card.
 */
(function () {
  'use strict';

  var PLAN = window.PLAN;
  var E = window.Engine;
  var doc = document;
  function $(id) { return doc.getElementById(id); }

  if (!PLAN || !E || !Array.isArray(PLAN.steps)) {
    var v0 = $('view');
    if (v0) v0.innerHTML = '<div class="hero"><h1 class="title">The guide did not load</h1><p class="lead">Close this page and open it again.</p></div>';
    return;
  }

  /* ================================================================== 1. time source */

  var MIN = 60000, HOUR = 3600000, DAY = 86400000;
  var clockFn = function () { return Date.now(); };
  var preview = null;                         // { state, now, focus, undo, acked } while previewing
  function realNow() { return clockFn(); }
  function now() { return preview ? preview.now : realNow(); }

  /* ================================================================== 2. plan index, helpers */

  var STEPS = PLAN.steps;
  var TITLE = PLAN.title || 'Ceviche Night';
  var byId = {}, orderOf = {}, waitDef = {}, moveOf = {}, listStepOf = {};
  STEPS.forEach(function (s, i) {
    byId[s.id] = s; orderOf[s.id] = i;
    if (s.wait && s.wait.id && !waitDef[s.wait.id]) waitDef[s.wait.id] = s.wait;
    if (s.kind === 'move' && s.move) moveOf[s.move] = s;
    if (s.kind === 'checklist' && typeof s.items === 'string') listStepOf[s.items] = s;
  });
  var DAY_DISH = { id: 'day', nick: 'The day', name: 'Packing, driving and setting up', color: 'day', ingredients: [], gear: [], notes: [] };
  var DISHES = (PLAN.dishes || []).slice();
  var dishById = {};
  DISHES.forEach(function (d) { dishById[d.id] = d; });
  dishById.day = DAY_DISH;
  var COLORS = { scoop: 1, pink: 1, patron: 1, milky: 1, blanch: 1, cream: 1, elote: 1, day: 1 };
  function dishOf(step) { return dishById[step.dish] || DAY_DISH; }
  function colorClass(d) { return 'c-' + (COLORS[d.color] ? d.color : 'day'); }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function at(name, val) { return ' data-' + name + '="' + esc(val) + '"'; }
  function lowerFirst(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  function safe(fn, fallback) { try { var v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } }

  var TERM_RE = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  // escaped text with [[key]] / [[key|shown]] turned into glossary buttons
  function rich(text) {
    text = String(text == null ? '' : text);
    var out = '', last = 0, m;
    TERM_RE.lastIndex = 0;
    while ((m = TERM_RE.exec(text))) {
      out += esc(text.slice(last, m.index));
      var key = m[1].trim(), shown = m[2] ? m[2] : key;
      if (PLAN.glossary && PLAN.glossary[key]) {
        out += '<span class="term" role="button" tabindex="0" data-act="term"' + at('key', key) + '>' + esc(shown) + '</span>';
      } else out += esc(shown);
      last = TERM_RE.lastIndex;
    }
    return out + esc(text.slice(last));
  }
  function plain(text) {
    return String(text == null ? '' : text).replace(TERM_RE, function (_, k, shown) { return shown ? shown : k.trim(); });
  }
  function termsIn(step) {
    var seen = {}, out = [];
    [].concat(step.body || [], step.look || [], step.tip || [], step.warn || []).forEach(function (t) {
      var m; TERM_RE.lastIndex = 0;
      while ((m = TERM_RE.exec(String(t)))) {
        var k = m[1].trim();
        if (!seen[k] && PLAN.glossary && PLAN.glossary[k]) { seen[k] = 1; out.push(k); }
      }
    });
    return out;
  }

  var ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    down: '<path d="M5 9l7 7 7-7"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
    jar: '<rect x="7" y="2.8" width="10" height="3.6" rx="1.2"/><path d="M6.5 11a4 4 0 0 1 2.2-3.6h6.6A4 4 0 0 1 17.5 11v7.5A2.5 2.5 0 0 1 15 21H9a2.5 2.5 0 0 1-2.5-2.5z"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
    tip: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    warn: '<path d="M12 4 2.8 20h18.4L12 4z"/><path d="M12 10v4.5M12 17.4h.01"/>',
    speaker: '<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.8M12 16.8h.01"/>',
    go: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    out: '<path d="M14 5h5v5M19 5l-8 8M11 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V13"/>'
  };
  function ico(name, size) {
    size = size || 24;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  function clock(ms) { return isFinite(ms) ? E.fmtClock(ms) : ''; }
  function shortClock(ms) { return clock(ms).replace(/\s*[AP]M$/i, ''); }
  function dur(mins) { return E.fmtDur(mins); }
  function stepMins(step) { return typeof E.stepMins === 'function' ? E.stepMins(step) : (step.mins || 0) + (step.timer ? step.timer.secs / 60 : 0); }
  // a countdown node: the tick fills it in and keeps it current
  function cd(until, doneText, pre, post) {
    return '<span data-until="' + until + '"' + at('done', doneText || '0:00') + (pre ? at('pre', pre) : '') + (post ? at('post', post) : '') + '></span>';
  }
  function btn(act, attrs, label, cls) {
    return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + label + '</button>';
  }
  function row() {
    var inner = Array.prototype.slice.call(arguments).join('');
    return inner ? '<div class="row">' + inner + '</div>' : '';
  }
  function setHTML(el, html) {
    if (el.__h === html) return false;
    el.innerHTML = html; el.__h = html;
    return true;
  }

  /* ================================================================== 3. store */

  var KEY = 'cevicheNight.v1';
  var KEY_UI = KEY + '.ui', KEY_UNDO = KEY + '.undo', KEY_DEV = KEY + '.device';
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readJSON(store, key) { try { var raw = store.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function writeJSON(store, key, val) { try { store.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

  var device = (function () {
    var d = null;
    try { d = ls().getItem(KEY_DEV); } catch (e) {}
    if (!d) {
      d = 'dev-' + Math.random().toString(36).slice(2, 12);
      try { ls().setItem(KEY_DEV, d); } catch (e) {}
    }
    return d;
  })();

  function validState(s) {
    return !!s && typeof s === 'object' && s.v === 1 && typeof s.day === 'string' && !!s.anchors && typeof s.anchors === 'object';
  }
  function tidy(s) {
    var o = Object.assign({}, s);
    ['opts', 'done', 'skipped', 'waits', 'laps', 'ticks', 'tonight'].forEach(function (k) {
      if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {};
    });
    if (!o.fg || typeof o.fg !== 'object' || typeof o.fg.stepId !== 'string') o.fg = null;
    return o;
  }

  var state = readJSON(ls(), KEY);
  function dayOver(s) { var d0 = E.dayMs(s); return isFinite(d0) && realNow() >= d0 + DAY + 4 * HOUR; }
  var freshState = !validState(state) || dayOver(state);
  state = tidy(freshState ? E.initialState(PLAN, device, realNow()) : state);

  var ui = { focus: null, pinned: false, acked: {}, seg: 'steps' };     // survives a reload (this device only)
  (function () {
    var u = freshState ? null : readJSON(ls(), KEY_UI);
    if (!u || typeof u !== 'object') return;
    if (typeof u.focus === 'string' && byId[u.focus]) { ui.focus = u.focus; ui.pinned = !!u.pinned; }
    if (u.acked && typeof u.acked === 'object') ui.acked = u.acked;
    if (u.seg === 'steps' || u.seg === 'ingredients' || u.seg === 'gear') ui.seg = u.seg;
  })();
  var undoStack = freshState ? [] : readJSON(ss(), KEY_UNDO);
  if (!Array.isArray(undoStack)) undoStack = [];
  var kept = null;                                        // the timer the last Back took away (see undo)
  var openMap = {};                                       // which disclosure rows are open (memory only)
  var confirmReset = false;

  function S() { return preview ? preview.state : state; }
  function focusGet() { return preview ? preview.focus : ui.focus; }
  // pinned = he chose this step himself; the guide then leaves it alone even if it is early
  function pinnedGet() { return !!(preview ? preview.pinned : ui.pinned); }
  function focusSet(id, pinned) {
    id = id || null; pinned = !!(id && pinned);
    if (preview) { preview.focus = id; preview.pinned = pinned; }
    else if (ui.focus !== id || ui.pinned !== pinned) { ui.focus = id; ui.pinned = pinned; saveUi(); }
  }
  function ackedMap() { return preview ? preview.acked : ui.acked; }
  function stack() { return preview ? preview.undo : undoStack; }
  function saveUi() { if (!preview) writeJSON(ls(), KEY_UI, ui); }
  function saveUndo() { if (!preview) writeJSON(ss(), KEY_UNDO, undoStack); }
  function setState(next) {
    if (preview) { preview.state = next; return; }
    if (next.device !== device) next = Object.assign({}, next, { device: device });   // so other devices know who wrote it
    state = next;
  }
  function save() {
    if (preview) return;
    writeJSON(ls(), KEY, state);
    scheduleSync();
  }

  /* ---- undo: one entry per action that changes progress or focus ---- */
  function pushUndo(tag) {
    var s = S(), st = stack();
    st.push({ tag: tag || '', done: s.done, skipped: s.skipped, waits: s.waits, laps: s.laps, fg: s.fg, opts: s.opts, focus: focusGet(), pinned: pinnedGet(), pnow: preview ? preview.now : null });
    if (st.length > 50) st.shift();
    saveUndo();
  }
  function dropUndo() { stack().pop(); saveUndo(); }
  function undo() {
    var st = stack();
    if (!st.length) return false;
    var e = st.pop(), s = S();
    if (preview && e.pnow != null) preview.now = e.pnow;
    // progress goes back; the things he toggles by hand (ticks, times, the day) stay as they are
    setState(Object.assign({}, s, {
      done: e.done || {}, skipped: e.skipped || {}, waits: e.waits || {}, laps: e.laps || {}, fg: e.fg || null, opts: e.opts || {},
      rev: (s.rev || 0) + 1, updatedAt: now()
    }));
    // Back to re-read a step must not restart the timer that step started: remember it for a Done that follows at once
    var um = /^done:(.+)$/.exec(e.tag || ''), ust = um ? byId[um[1]] : null, wid = ust && ust.wait ? ust.wait.id : null, w0 = wid && s.waits ? s.waits[wid] : null;
    kept = !preview && w0 && w0.by === ust.id && now() - w0.start > 60000 ? { id: ust.id, wid: wid, wait: w0, laps: (s.laps || {})[wid], after: S() } : null;
    focusSet(e.focus && byId[e.focus] ? e.focus : null, e.pinned);
    saveUndo();
    afterChange();
    return true;
  }

  /* ---- cloud mirror (artifact db capability). Local always wins on this device; see SPEC 4 ---- */
  var sync = { ref: null, status: 'checking', inflight: false, queued: false, timer: 0, lastRev: state.rev, heard: false };
  function scheduleSync() {
    if (!sync.ref || preview || sync.lastRev === state.rev) return;
    if (sync.timer) clearTimeout(sync.timer);
    sync.timer = setTimeout(flushSync, 800);
  }
  function flushSync() {
    sync.timer = 0;
    if (!sync.ref || sync.lastRev === state.rev) return;
    if (!sync.heard) { sync.timer = setTimeout(flushSync, 800); return; }      // never write before the store has said what it holds
    if (sync.inflight) { sync.queued = true; return; }
    var body, rev = state.rev, p;
    try { body = JSON.parse(JSON.stringify(state)); } catch (e) { return; }
    sync.inflight = true;
    try { p = sync.ref.set(body); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(function () { sync.lastRev = rev; sync.status = 'on'; }, function (err) {
      var code = err && err.code;
      sync.status = 'local';                  // say so in Setup; the next change tries again unless the store is gone for good
      if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') sync.ref = null;
    }).then(function () {
      sync.inflight = false;
      if (sync.queued) { sync.queued = false; scheduleSync(); }
    });
  }
  function countDone(s) { return s && s.done ? Object.keys(s.done).length : 0; }
  function onRemote(snap) {
    try {
      var cached = !!(snap && snap.metadata && snap.metadata.fromCache);
      var first = !sync.heard;
      if (!(freshState && cached)) sync.heard = true;     // a remembered copy is not the store's answer
      if (!snap || !snap.exists) return;
      var r = snap.data();
      if (!validState(r) || dayOver(r)) return;
      var newer = (r.updatedAt || 0) > (state.updatedAt || 0) && r.device !== device;
      // This phone lost its storage and started from nothing: the day saved online wins over a tap or two made since.
      var rescue = first && freshState && (r.day === state.day || r.day === ymd(new Date(realNow()))) && countDone(r) > countDone(state);
      if (!newer && !rescue && state.rev !== 0) return;
      if (r.rev === state.rev && r.updatedAt === state.updatedAt) return;
      if (rescue) { ui.focus = null; ui.pinned = false; saveUi(); }
      adopt(JSON.parse(JSON.stringify(r)));
    } catch (e) { /* local keeps working */ }
  }
  function adopt(remote) {
    state = tidy(remote);
    sync.lastRev = state.rev;                 // never echo a snapshot back
    writeJSON(ls(), KEY, state);
    undoStack = []; saveUndo();
    if (preview) return;                      // he is rehearsing: show it when he exits
    proj = null;
    settleFocus();
    render();
    swapAt = realNow();
    emit();
  }
  function initSync(db) {
    if (!db || typeof db.doc !== 'function') { sync.status = 'local'; return; }
    try {
      sync.ref = db.doc('cook/state');
      sync.status = 'on';
      sync.ref.onSnapshot(onRemote, function () { sync.ref = null; sync.status = 'local'; });
      setTimeout(function () { if (!freshState) sync.heard = true; }, 5000);      // a store that stays silent must not block saving for good
    } catch (e) { sync.ref = null; sync.status = 'local'; }
  }

  /* ================================================================== 4. engine access */

  var proj = null, projFor = null, projAt = 0;
  var EMPTY_PROJ = { rows: [], byStep: {}, dinnerAt: null, dinnerAnchor: NaN, lateMin: 0, spareMin: 0, warnings: [] };
  function projection() {
    var s = S(), t = now();
    if (!proj || projFor !== s || Math.abs(t - projAt) >= 15000) {
      proj = safe(function () { return E.project(PLAN, s, t); }, null);
      if (!proj || !proj.rows || !proj.byStep) proj = Object.assign({}, EMPTY_PROJ, { dinnerAnchor: E.anchorMs(s, 'dinner') });
      projFor = s; projAt = t;
    }
    return proj;
  }
  function loc() { return safe(function () { return E.location(PLAN, S()); }, 'home-am'); }
  function isDone(step) { return !!step && E.isDone(PLAN, S(), step); }
  function isActive(step) { return !!step && E.isActive(PLAN, S(), step); }
  function isSkipped(step) { var k = S().skipped; return !!(k && k[step.id]); }
  function anyDone() { var d = S().done; for (var k in d) if (d[k]) return true; return false; }
  function dinnerDone() { var d = S().done; return !!(d && d.dinner); }
  function isTonight() {
    if (preview) return false;
    var d0 = E.dayMs(state);
    return isFinite(d0) && realNow() < d0 + 4 * HOUR && !anyDone();
  }
  function canGiveUp(step) {
    var c = step.check;
    if (!c || !c.giveUp || loc() !== 'home-am') return false;          // only while he is still at his place (SPEC 9.2)
    if (typeof E.canGiveUp === 'function') return !!safe(function () { return E.canGiveUp(PLAN, S(), step, now()); }, false);
    var w = c.giveUp.withinMinsOf;
    if (!w) return true;
    var a = E.anchorMs(S(), w.anchor);
    return isFinite(a) && now() >= a - (w.mins || 0) * MIN;
  }
  function checklistItems(step) {
    if (typeof E.checklistItems === 'function') return safe(function () { return E.checklistItems(PLAN, S(), step); }, []);
    if (typeof step.items === 'string') return safe(function () { return E.packList(PLAN, S(), step.items); }, []);
    var mine = (S().ticks || {})[step.id] || {};
    return (step.items || []).map(function (label, i) { return { id: 'i' + i, label: label, note: '', ticked: !!mine['i' + i], stepId: step.id }; });
  }
  var MOVE_LABEL = { leaveAm: "I'm leaving now", backHome: "I'm home", leavePm: "I'm on my way", arrive: "I'm here" };
  function moveLabel(step) { return MOVE_LABEL[step.move] || 'Done'; }

  // what the Now tab shows
  function nowMode() {
    if (focusGet()) return 'step';
    if (dinnerDone()) return 'done';
    if (isTonight()) return 'tonight';
    var l = loc();
    if (l === 'away' || l === 'drive') return l;
    return 'free';
  }
  // Focus only moves when he acts, or when nothing was focused and something can now be done.
  function settleFocus() {
    var s = S(), f = focusGet(), before = f;
    if (f) {
      var st = byId[f];
      if (!st || E.isDone(PLAN, s, st) || !E.isActive(PLAN, s, st)) f = null;
      // a step the guide proposed stays only while it can be done (he left, or took back the step before it)
      else if (!pinnedGet() && !safe(function () { return E.isAvailable(PLAN, s, st, now()); }, true)) f = null;
    }
    if (!f && !dinnerDone() && !isTonight()) {
      var l = loc();
      if (l !== 'away' && l !== 'drive') f = safe(function () { return E.nextStep(PLAN, s, now()); }, null);
    }
    if (f !== before) { focusSet(f); return true; }
    return false;
  }
  // "Next: ..." under a step: what would come after it if he taps Done now
  function nextAfter(step) {
    return safe(function () {
      var s = S(), t = now() + stepMins(step) * MIN, payload;
      if (step.kind === 'choice' && step.choice) payload = { value: E.opt(PLAN, s, step.choice.opt) };
      var s2 = E.complete(PLAN, s, step.id, t, payload);
      if (s2 === s) return '';
      if (s2.done && s2.done.dinner) return '';
      var n = E.nextStep(PLAN, s2, t);
      if (n && byId[n]) return byId[n].title;
      var l = E.location(PLAN, s2);
      if (l === 'away') return 'you are out until about ' + clock(E.anchorMs(s2, 'backHome'));
      if (l === 'drive') return 'the drive to her place';
      var u = E.nextUnlock(PLAN, s2, t);
      return u ? 'free time until ' + clock(u.at) : '';
    }, '');
  }

  /* ================================================================== 5. actions */

  var subs = [];
  function emit() { subs.slice().forEach(function (fn) { try { fn(); } catch (e) { /* a broken listener must not stop the guide */ } }); }

  function afterChange(o) {
    if (!preview) save();
    proj = null;
    settleFocus();
    render(o);
    emit();
  }
  // run a reducer; returns false when nothing changed
  function apply(reducer, o) {
    o = o || {};
    var s = S();
    if (o.undo) pushUndo();
    var next = safe(function () { return reducer(s, now()); }, s);
    if (!next || next === s) { if (o.undo) dropUndo(); return false; }
    setState(next);
    afterChange(o);
    return true;
  }
  // in a preview the clock only moves when he acts
  function previewTimeAfter(step, t) {
    var s = S();
    if (step.kind === 'move') {
      if (step.move === 'backHome') { var b = E.anchorMs(s, 'backHome'); return isFinite(b) ? Math.max(t, b) : t; }
      if (step.move === 'arrive') { var drive = (s.anchors.arrive - s.anchors.leavePm) * MIN; return t + (drive > 0 ? drive : 0); }
      return t;
    }
    var ranTimer = step.timer && s.fg && s.fg.stepId === step.id;
    return t + (ranTimer ? (step.mins || 0) : stepMins(step)) * MIN;
  }
  function doComplete(id, payload) {
    var step = byId[id];
    if (!step || isDone(step)) return false;
    var wasFocus = focusGet() === id;
    pushUndo('done:' + id);
    if (preview) { preview.now = previewTimeAfter(step, preview.now); }
    var s = S(), next = safe(function () { return E.complete(PLAN, s, id, now(), payload); }, s);
    if (!next || next === s) { dropUndo(); return false; }
    var k = kept; kept = null;
    if (k && k.id === id && k.after === s && next.waits && next.waits[k.wid]) {
      var w2 = Object.assign({}, next.waits), l2 = Object.assign({}, next.laps);
      w2[k.wid] = k.wait;
      if (k.laps != null) l2[k.wid] = k.laps;
      next = Object.assign({}, next, { waits: w2, laps: l2 });
    }
    setState(next);
    if (wasFocus || step.kind === 'move') focusSet(null);     // settleFocus then asks the engine what is next (a move changes the place)
    afterChange();
    return true;
  }
  function doRetry(id) {
    var step = byId[id];
    if (!step) return false;
    pushUndo();
    if (preview) preview.now += (step.mins || 0) * MIN;
    var s = S(), next = safe(function () { return E.retry(PLAN, s, id, now()); }, s);
    if (!next || next === s) { dropUndo(); return false; }
    setState(next);
    if (focusGet() === id) focusSet(null);
    afterChange();
    return true;
  }
  function doGiveUp(id) {
    if (focusGet() === id) focusSet(id, false);          // let the guide move on if this step is now on hold
    return apply(function (s, t) { return E.giveUp(PLAN, s, id, t); }, { undo: true });
  }
  function doSkip(id) {
    return apply(function (s, t) { return E.skip(PLAN, s, id, t); }, { undo: true });
  }
  function doUncomplete(id) {
    // "Not done" right after "Mark done" is a plain undo (it also takes back what the plan's rules changed)
    var st = stack();
    if (st.length && st[st.length - 1].tag === 'done:' + id) return undo();
    return apply(function (s, t) { return E.uncomplete(PLAN, s, id, t); }, { undo: true });
  }
  function startTimer(id) {
    var step = byId[id];
    if (!step || !step.timer) return false;
    return apply(function (s, t) { return E.startFg(PLAN, s, id, t + step.timer.secs * 1000, t); }, { undo: true, keepCard: true });
  }
  function skipTimer() {
    var s = S(), fg = s.fg;
    if (!fg) return false;
    pushUndo();
    if (preview) {
      preview.now = Math.max(preview.now, fg.endsAt);
      preview.acked['fg:' + fg.stepId + '@' + fg.endsAt] = true;
    } else {
      var t = now();
      setState(E.startFg(PLAN, s, fg.stepId, t, t));
      ui.acked['fg:' + fg.stepId + '@' + t] = true;      // he ended it himself: no alarm
      saveUi();
    }
    afterChange({ keepCard: true });
    return true;
  }
  function doTick(stepId, itemId, on) {
    return apply(function (s, t) { return E.tick(PLAN, s, stepId, itemId, on, t); }, { keepCard: true });
  }
  function doTonight(id, on) {
    var item = (PLAN.tonight || []).filter(function (x) { return x.id === id; })[0];
    return apply(function (s, t) {
      var next = E.tickTonight(PLAN, s, id, on, t);
      // un-ticking takes back what the tick decided (the beans did not soak after all), so the question is asked again
      if (!on && item && item.sets) {
        Object.keys(item.sets).forEach(function (k) {
          if (next.opts && next.opts[k] === item.sets[k]) next = E.setOpt(PLAN, next, k, undefined, t);
        });
      }
      return next;
    });
  }
  function ackLap(waitId, n) {
    return apply(function (s, t) { return E.ackLap(PLAN, s, waitId, n, t); }, { keepCard: true });
  }
  function setOpt(name, value) {
    return apply(function (s, t) { return E.setOpt(PLAN, s, name, value, t); }, { undo: true });
  }
  function setAnchor(name, minutes) {
    return apply(function (s, t) { return E.setAnchor(PLAN, s, name, minutes, t); });
  }
  function setDay(day) {
    // A cook day that is already over is thrown away at the next load (see dayOver): never move the day there,
    // or one slip on "− day" and a reload would erase the morning.
    if (dayOver({ day: day })) return false;
    return apply(function (s, t) { return E.setDay(PLAN, s, day, t); });
  }
  // show a step on the Now tab
  function goFocus(id) {
    if (!byId[id]) return false;
    if (focusGet() !== id) { pushUndo(); focusSet(id, true); }
    else if (!pinnedGet()) focusSet(id, true);
    ack(function (a) { return a.stepId === id && a.kind !== 'lap'; });
    closeAllSheets();
    if (!boardOn && cur.tab !== 'now') { window.location.hash = '#now'; route(); }
    else render();
    emit();
    return true;
  }
  function startOver() {
    stopSpeech();
    preview = null;
    freshState = false;
    var t = realNow(), nextRev = (state.rev || 0) + 1;
    state = tidy(Object.assign({}, E.initialState(PLAN, device, t), { rev: nextRev, updatedAt: t, device: device }));
    undoStack = []; saveUndo();
    ui.focus = null; ui.pinned = false; ui.acked = {}; saveUi();
    confirmReset = false; alarm = {}; openMap = {};
    afterChange();
  }

  // the names board.js and tests may call
  var ACTIONS = {
    complete: doComplete, retry: doRetry, giveUp: doGiveUp, skip: doSkip, uncomplete: doUncomplete,
    ackLap: ackLap, tick: doTick, tickTonight: doTonight, setOpt: setOpt, setAnchor: setAnchor, setDay: setDay,
    startTimer: startTimer, skipTimer: skipTimer, focus: goFocus, undo: undo,
    startFg: function (id, endsAt) { return apply(function (s, t) { return E.startFg(PLAN, s, id, endsAt, t); }, { undo: true, keepCard: true }); },
    clearFg: function () { return apply(function (s, t) { return E.clearFg(PLAN, s, t); }, { undo: true, keepCard: true }); },
    ackAlert: function (key) { ackedMap()[key] = true; saveUi(); refreshAlerts(); emit(); return true; },
    previewEnter: function () { enterPreview(); return true; },
    previewExit: function () { exitPreview(); return true; },
    startOver: function () { startOver(); return true; }
  };
  function act(name) {
    var fn = ACTIONS[name];
    if (typeof fn !== 'function') return false;
    var args = Array.prototype.slice.call(arguments, 1);
    return !!safe(function () { return fn.apply(null, args); }, false);
  }

  /* ================================================================== 6. alarms and sound */

  var audio = { ctx: null };
  var dbg = { rings: [], played: 0 };       // rings: every alarm asked for; played: those that reached the speaker
  function initAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio.ctx) {
        audio.ctx = new AC();
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e2) { /* older phones: the ringer must be on */ }
      }
      if (audio.ctx.state !== 'running' && audio.ctx.resume) {
        var p = audio.ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* no sound: the banners still work */ }
  }
  function beep(t0, freq, len, vol, type) {
    var c = audio.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.setValueAtTime(vol, t0 + len - 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + len + 0.02);
  }
  function ring(kind) {
    dbg.rings.push(kind);
    if (dbg.rings.length > 500) dbg.rings.shift();
    try {
      var c = audio.ctx;
      if (!c) return;
      if (c.state !== 'running') {
        if (audio.waking || !c.resume) return;
        audio.waking = true;
        var asked = realNow(), p = c.resume(), fin = function () { audio.waking = false; };
        if (p && p.then) p.then(function () { fin(); if (c.state === 'running' && realNow() - asked < 4000) play(kind); }, fin);
        else fin();
        return;
      }
      play(kind);
    } catch (e) { audio.waking = false; }
  }
  function play(kind) {
    try {
      var c = audio.ctx;
      var t0 = c.currentTime + 0.03, i;
      if (kind === 'chime') {
        beep(t0, 784, 0.18, 0.4, 'sine');
        beep(t0 + 0.2, 1047, 0.3, 0.4, 'sine');
      } else {
        // a kitchen-timer sound that carries over a fan and a hot pan: two bursts of three sharp beeps
        for (i = 0; i < 6; i++) {
          var at = t0 + i * 0.2 + (i > 2 ? 0.25 : 0);
          beep(at, 2000, 0.12, 0.28, 'square');
          beep(at, 1000, 0.12, 0.3, 'sine');
        }
      }
      dbg.played++;
    } catch (e) { /* ignore */ }
  }

  function viewingStep(id) { return !boardOn && cur.tab === 'now' && !sheets.length && focusGet() === id; }
  // everything that needs attention right now, most urgent first
  function activeAlerts() {
    var s = S(), t = now(), out = [];
    var fg = s.fg;
    if (fg && byId[fg.stepId] && t >= fg.endsAt && !(s.done && s.done[fg.stepId])) {
      out.push({ kind: 'fg', id: 'fg:' + fg.stepId, key: 'fg:' + fg.stepId + '@' + fg.endsAt, stepId: fg.stepId });
    }
    safe(function () { return E.alerts(PLAN, s, t); }, []).forEach(function (a) {
      var w = a.waitId && s.waits ? s.waits[a.waitId] : null;
      var key = a.id + (w ? '@' + w.start : '') + (a.kind === 'leave' ? (a.minsLeft >= 1 ? ':soon' : ':now') : '');
      out.push(Object.assign({}, a, { key: key }));
    });
    return out;
  }
  function ack(test) {
    var m = ackedMap(), changed = false;
    activeAlerts().forEach(function (a) { if (!m[a.key] && test(a)) { m[a.key] = true; changed = true; } });
    if (changed) saveUi();
    return changed;
  }
  var alarm = {};                 // alert key -> { since, n } : when it started ringing, how many rings so far
  var flashOn = false;
  function refreshAlerts() {
    var list = activeAlerts(), acked = ackedMap(), t = realNow(), live = {}, due = false, loud = false, dirty = false, k;
    list.forEach(function (a) {
      live[a.key] = true;
      if (acked[a.key]) { delete alarm[a.key]; return; }
      var once = !!preview || (a.kind === 'leave' && a.minsLeft >= 1);
      var light = a.kind === 'fg' && viewingStep(a.stepId);
      var st = alarm[a.key] || (alarm[a.key] = { since: t, n: -1 });
      var e = Math.max(0, t - st.since) / 1000, n;
      if (once) n = 0;
      else if (light) n = e < 12 ? Math.floor(e / 3) : 4 + Math.floor((e - 12) / 15);
      else n = e < 30 ? Math.floor(e / 3) : 10 + Math.floor((e - 30) / 15);   // every 3 s for 30 s, then every 15 s
      if (n > st.n) { st.n = n; due = true; }
      if (!once) loud = true;
    });
    for (k in alarm) if (!live[k]) delete alarm[k];
    for (k in acked) if (!live[k]) { delete acked[k]; dirty = true; }
    var first = list.filter(function (a) { return alarm[a.key]; })[0];
    if (dirty) saveUi();
    if (due) ring('alarm');
    // the title flashes gently while an alarm is unanswered
    if (loud) {
      flashOn = !flashOn;
      doc.title = flashOn ? ((first && first.title) || 'Timer') + ' · ' + TITLE : TITLE;
    } else if (flashOn || doc.title !== TITLE) { flashOn = false; doc.title = TITLE; }
    if (!boardOn) {
      $('status').classList.toggle('alerting', loud && flashOn);
      renderBanners(list);
    }
  }
  // a soft reminder when free time ends and nobody is at the phone
  var nudge = null;
  function runNudge() {
    if (!nudge) return;
    var e = realNow() - nudge.since, at = [0, 20000, 60000];
    if (nudge.n >= at.length) { nudge = null; return; }
    if (e >= at[nudge.n]) {
      nudge.n++;
      var ringing = false, k;
      for (k in alarm) ringing = true;
      if (!ringing) ring('chime');
    }
  }

  /* ================================================================== 7. wake lock */

  var wake = { lock: null, status: ('wakeLock' in navigator) ? 'idle' : 'none' };
  function requestWake() {
    if (wake.status === 'none' || wake.lock || doc.visibilityState !== 'visible') return;
    try {
      navigator.wakeLock.request('screen').then(function (l) {
        wake.lock = l; wake.status = 'on';
        l.addEventListener('release', function () { wake.lock = null; if (wake.status === 'on') wake.status = 'idle'; });
      }, function () { wake.status = 'denied'; });
    } catch (e) { wake.status = 'denied'; }
  }
  var gestured = false;
  function onGesture() {
    gestured = true;
    nudge = null;
    initAudio();
    requestWake();
  }

  /* ================================================================== 8. capabilities: ask, read aloud (sync is in section 3) */

  var caps = { tts: null, sample: null };
  function useCap(name) {
    try {
      var c = window.claude;
      if (!c || typeof c.use !== 'function') return Promise.resolve(null);
      return Promise.resolve(c.use(name)).then(function (v) { return v || null; }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  /* ---- read to me ---- */
  var speech = { on: false, stepId: null, token: 0, hidden: false };
  function canSpeak() {
    if (speech.hidden) return false;
    return !!caps.tts || !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }
  function speakText(step) {
    var parts = [step.title].concat(step.warn ? ['Careful. ' + step.warn] : [], step.body || []);
    if (step.look) parts.push("It's right when: " + step.look);
    return parts.map(function (p) { p = plain(p).trim(); return /[.!?:]$/.test(p) ? p : p + '.'; }).join(' ').slice(0, 1900);
  }
  function patchReadButtons() {
    var nodes = doc.querySelectorAll('[data-act="read"]'), i, b, on;
    for (i = 0; i < nodes.length; i++) {
      b = nodes[i];
      b.hidden = !canSpeak();
      on = speech.on && speech.stepId === b.getAttribute('data-step');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('span').textContent = on ? 'Stop reading' : 'Read to me';
    }
  }
  function stopSpeech() {
    if (!speech.on) return;
    speech.token++; speech.on = false;
    try {
      if (caps.tts) { var p = caps.tts.stop(); if (p && p.catch) p.catch(function () {}); }
      else if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) { /* ignore */ }
    patchReadButtons();
  }
  function toggleRead(stepId) {
    var step = byId[stepId];
    if (!step) return;
    if (speech.on) { var same = speech.stepId === stepId; stopSpeech(); if (same) return; }
    var text = speakText(step), token = ++speech.token;
    speech.on = true; speech.stepId = stepId;
    var end = function () { if (speech.token === token) { speech.on = false; patchReadButtons(); } };
    try {
      if (caps.tts) {
        Promise.resolve(caps.tts.speak(text)).then(end, function (err) {
          var code = err && err.code;
          if (code === 'not_granted' || code === 'unavailable') speech.hidden = true;   // respect his choice: no other voice either
          end(); patchReadButtons();
        });
      } else if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        var u = new window.SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = 0.95; u.onend = end; u.onerror = end;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } else { speech.hidden = true; end(); }
    } catch (e) { end(); }
    patchReadButtons();
  }

  /* ---- ask ---- */
  var PRESETS = ['Explain this step more simply', 'Why am I doing this?', "How do I know it's done?", 'Something looks wrong'];
  function stepText(st) {
    var out = st.title + ': ' + (st.body || []).map(plain).join(' ');
    if (st.need && st.need.length) out += ' You need: ' + st.need.join(', ') + '.';
    if (st.into) out += ' Put it in: ' + st.into + '.';
    if (st.look) out += " It's right when: " + plain(st.look);
    if (st.tip) out += ' Tip: ' + plain(st.tip);
    if (st.warn) out += ' Warning: ' + plain(st.warn);
    if (st.timer) out += ' Timer: ' + dur(st.timer.secs / 60) + '.';
    if (st.wait) out += ' Then it waits: ' + st.wait.label + ', ' + dur(st.wait.mins) + '.';
    return out;
  }
  function buildPrompt(step, question) {
    var d = dishOf(step), L = [];
    L.push('You are helping a first-time cook who is in the middle of making dinner. Answer the question at the end.');
    L.push('Rules:');
    L.push('- Use at most 70 plain words. Short sentences. No cooking jargon.');
    L.push('- Do not change any quantity or time in the recipe.');
    L.push('- Be conservative about food safety. Raw fish must stay cold, and lime juice does not make it safe.');
    L.push('- If you are not sure, say so.');
    L.push('- Plain text only. No lists, no headings, no bold. Spell units out: tablespoon, teaspoon.');
    L.push('');
    L.push('Dish: ' + d.nick + (d.name ? ' (' + d.name + ')' : ''));
    if (d.ingredients && d.ingredients.length) {
      L.push('Ingredients:');
      d.ingredients.forEach(function (g) {
        if (!g.item) { L.push(g.qty + ':'); return; }
        L.push('- ' + [g.qty, g.item].filter(Boolean).join(' ') + (g.note ? ' (' + g.note + ')' : ''));
      });
    }
    L.push('All the steps for this dish, in order:');
    listSteps(function (st) { return st.dish === step.dish; }).forEach(function (st, i) { L.push((i + 1) + '. ' + stepText(st)); });
    L.push('');
    L.push('The cook is on this step right now:');
    L.push(stepText(step));
    L.push('');
    L.push('Question: ' + question);
    return L.join('\n');
  }
  function ask(question) {
    var top = sheets[sheets.length - 1];
    question = String(question || '').trim().slice(0, 300);
    if (!top || top.type !== 'help' || !caps.sample || !question || top.status === 'busy') return;
    var step = byId[top.id];
    if (!step) return;
    top.q = question; top.a = ''; top.status = 'busy';
    renderSheet();
    var box = doc.querySelector('#sheet-layer [data-role="answer"]');
    if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, p;
    top.ctl = ctl;
    var opts = { modelTier: 'quick', onText: function (u) {
      if (top.status !== 'busy' || !u) return;
      top.a = String(u.text || '');
      var el = doc.querySelector('#sheet-layer [data-role="answer"]');
      if (el && sheets[sheets.length - 1] === top) { el.textContent = top.a; el.className = 'answer'; }
    } };
    if (ctl) opts.signal = ctl.signal;
    try { p = caps.sample(buildPrompt(step, question), opts); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(function (r) {
      top.a = (r && r.text) || top.a;
      top.status = top.a ? 'done' : 'error';
    }, function (err) {
      var code = err && err.code;
      if (code === 'cancelled') { top.status = 'idle'; return; }
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || /^capability_/.test(String(code))) {
        caps.sample = null; top.status = 'idle'; top.q = ''; top.a = '';        // hide the Ask section for this visit
        return;
      }
      top.a = code === 'refused' ? '' : ((err && err.text) || top.a || '');
      top.status = 'error';
    }).then(function () {
      top.ctl = null;
      if (sheets.indexOf(top) >= 0) renderSheet();
    });
  }

  /* ---- ask the chef: a chat about the whole dinner (Claude Opus 5.5, low effort, short answers) ---- */
  var CHEF_MODEL = 'claude-opus-5-5', KEY_CHEF = KEY + '.chef';
  var CHEF_STARTERS = ['What can I get ahead on right now?', 'I am running late. What can I cut?', 'Something went wrong. Can I fix it?'];
  var chef = { turns: [], status: 'idle', live: '', err: '', other: false };
  (function () {
    var t = readJSON(ls(), KEY_CHEF);
    if (Array.isArray(t)) chef.turns = t.filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; }).slice(-30);
  })();
  function saveChef() { writeJSON(ls(), KEY_CHEF, chef.turns.slice(-30)); }
  // Standing instructions plus the whole plan. Claude keeps nothing between calls, so this goes first every time.
  function chefRules() {
    var L = [];
    L.push('You are the chef standing next to a first-time cook who is in the middle of cooking this dinner for two. Answer his questions about it.');
    L.push('Rules:');
    L.push('- Be brief: 1 to 3 short sentences. Give the answer first. No preamble, no recap, no sign-off.');
    L.push('- Plain words, no cooking jargon. Plain text only: no headings, no bold. A short numbered list only when he asks for steps.');
    L.push('- Go by the plan below. Do not change its quantities or times unless he asks for a substitution or a fix. Then say exactly what changes.');
    L.push('- Be conservative about food safety. Raw fish and shrimp stay cold. Lime juice does not make raw fish safe.');
    L.push('- If you are not sure, say so. Spell units out: tablespoon, teaspoon.');
    L.push('');
    L.push('THE PLAN: morning in his kitchen, out from late morning to early afternoon, then her kitchen until dinner.');
    DISHES.forEach(function (d) {
      L.push('');
      L.push('Dish: ' + d.nick + (d.name ? ' (' + d.name + ')' : '') + (d.makes ? '. Makes: ' + d.makes : ''));
      (d.ingredients || []).forEach(function (g) {
        L.push(g.item ? '- ' + [g.qty, g.item].filter(Boolean).join(' ') + (g.note ? ' (' + g.note + ')' : '') : String(g.qty || '') + ':');
      });
    });
    L.push('');
    L.push('Every step of the day in order, with its dish in brackets:');
    listSteps(function () { return true; }).forEach(function (st, i) { L.push((i + 1) + '. [' + dishOf(st).nick + '] ' + stepText(st)); });
    return L.join('\n');
  }
  // Where he is at this moment. Sent with each question, because it changes all day.
  function chefNow() {
    var s = S(), t = now(), L = [];
    var loc = safe(function () { return E.location(PLAN, s); }, '');
    var pr = safe(function () { return E.progress(PLAN, s); }, { done: 0, total: 0 });
    var f = focusGet() || safe(function () { return E.nextStep(PLAN, s, t); }, null), st = f ? byId[f] : null;
    var p = projection();
    L.push('Right now: ' + clock(t) + '. Place: ' + (LOC_TITLE[loc] || loc || 'unknown') + '. Steps done: ' + pr.done + ' of ' + pr.total + '.');
    if (st) L.push('The step on his screen: [' + dishOf(st).nick + '] ' + st.title + (/[.?!]$/.test(st.title) ? '' : '.'));
    safe(function () { return E.waitsView(PLAN, s, t); }, []).forEach(function (w) {
      L.push('Timer: ' + w.label + (w.elapsed ? ', time is up.' : ', ' + Math.max(1, Math.round(w.remainingMs / 60000)) + ' min left.'));
    });
    if (p && p.dinnerAt) L.push('Dinner is planned for ' + clock(p.dinnerAnchor) + (p.lateMin > 0 ? ' and now looks like ' + clock(p.dinnerAt) + '.' : ' and is on time.'));
    return L.join('\n');
  }
  function scrollChef() { var sc = doc.querySelector('#sheet-layer .sheet-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }
  function renderChef() {
    var top = sheets[sheets.length - 1];
    if (!top || top.type !== 'chef') return;
    renderSheet();
    scrollChef();
  }
  function chefSend(q) {
    q = String(q || '').trim().slice(0, 400);
    if (!q || !caps.sample || chef.status === 'busy') return;
    chef.turns.push({ role: 'user', content: q });
    chef.status = 'busy'; chef.live = ''; chef.err = '';
    saveChef(); renderChef();
    var turns = chef.turns.slice(-16);                       // recent chat only; the rules turn is always sent
    while (turns.length && turns[0].role !== 'user') turns.shift();
    var last = turns.pop(), input, p;
    try {
      input = [{ role: 'user', content: chefRules() }].concat(turns, [{ role: 'user', content: chefNow() + '\n\nQuestion: ' + last.content }]);
    } catch (e) { chef.status = 'error'; chef.err = "Couldn't get an answer. Try again."; renderChef(); return; }
    var opts = { model: CHEF_MODEL, modelTier: 'complex', effort: 'low', cache: false, onText: function (u) {
      if (chef.status !== 'busy' || !u) return;
      chef.live = String(u.text || '');
      var el = doc.querySelector('#sheet-layer [data-role="chef-live"]');
      if (el) { el.textContent = chef.live; el.className = ''; scrollChef(); }
    } };
    try { p = caps.sample(input, opts); } catch (e2) { p = Promise.reject(e2); }
    Promise.resolve(p).then(function (r) {
      var text = String((r && r.text) || chef.live || '').trim();
      if (!text) { chef.status = 'error'; chef.err = "Couldn't get an answer. Try again."; return; }
      chef.turns.push({ role: 'assistant', content: text });
      chef.other = !(r && r.modelApplied);                   // true when another Claude model had to answer
      chef.status = 'idle';
    }, function (err) {
      var code = err && err.code;
      if (code === 'cancelled') { chef.status = 'idle'; return; }
      if (err && err.text) chef.turns.push({ role: 'assistant', content: String(err.text) });
      chef.status = 'error';
      chef.err = code === 'rate_limited' ? 'Too many questions in a short time. Wait a minute, then ask again.'
        : (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || /^capability_/.test(String(code))) ? 'Ask the Chef is turned off for this page.'
        : code === 'refused' ? 'The chef could not answer that one. Try asking it another way.'
        : "Couldn't get an answer. Try again.";
    }).then(function () { chef.live = ''; saveChef(); renderChef(); });
  }
  function chefHTML() {
    var h = '<div class="help"><div class="block"><h2 class="term-h" id="sheet-title">Ask the Chef</h2>' +
      '<p class="sub">' + (chef.other ? 'Claude Opus 5.5 was not available here, so another Claude model answered.' : 'Claude Opus 5.5. Short answers about this dinner. It knows the whole plan and where you are in it.') + '</p></div>';
    if (!caps.sample) {
      return h + '<div class="card"><p>Ask the Chef is not available in this copy of the guide. Open the guide from the Claude link to use it.</p></div></div>';
    }
    if (!chef.turns.length && chef.status !== 'busy') {
      h += '<div class="rows">' + CHEF_STARTERS.map(function (q, i) { return btn('chef-preset', at('i', i), esc(q)); }).join('') + '</div>';
    }
    h += '<div class="chatlog">' + chef.turns.map(function (m) {
      return '<div class="chat ' + (m.role === 'user' ? 'me' : 'chef') + '"><p>' + esc(m.content) + '</p></div>';
    }).join('');
    if (chef.status === 'busy') h += '<div class="chat chef"><p' + (chef.live ? '' : ' class="dim"') + ' data-role="chef-live">' + esc(chef.live || 'Thinking…') + '</p></div>';
    h += '</div>';
    if (chef.status === 'error' && chef.err) h += '<p class="answer dim">' + esc(chef.err) + '</p>';
    return h + '</div>';
  }
  function chefActions() {
    var close = btn('sheet-close', '', 'Close', 'fill');
    if (!caps.sample) return row(close);
    return '<form class="ask-form" id="chef-form" autocomplete="off"><input class="field" id="chef-input" name="q" type="text" maxlength="400" enterkeyhint="send" placeholder="Ask about the cooking" aria-label="Your question">' +
      '<button type="submit" class="btn on">Send</button></form>' +
      row(chef.turns.length ? btn('chef-clear', '', 'New chat') : '', close);
  }

  /* ================================================================== 9. router */

  var cur = { tab: 'now', dish: null };
  var boardOn = false;
  function parseHash() {
    var h = String(window.location.hash || '').replace(/^#/, '');
    if (h === 'day' || h === 'dishes' || h === 'setup' || h === 'board') return { tab: h, dish: null };
    if (h.indexOf('dish-') === 0 && dishById[h.slice(5)]) return { tab: 'dishes', dish: h.slice(5) };
    return { tab: 'now', dish: null };
  }
  function mountBoard() {
    var B = window.CookBoard, root = $('board-root');
    if (!B || typeof B.mount !== 'function' || !root) return false;
    try {
      $('app').hidden = true; root.hidden = false;
      B.mount(root, window.CookApp);
      boardOn = true;
      return true;
    } catch (e) {
      root.hidden = true; $('app').hidden = false; boardOn = false;
      return false;
    }
  }
  function unmountBoard() {
    if (!boardOn) return;
    boardOn = false;
    try { if (window.CookBoard && window.CookBoard.unmount) window.CookBoard.unmount(); } catch (e) { /* ignore */ }
    $('board-root').hidden = true;
    $('app').hidden = false;
  }
  function route() {
    var r = parseHash();
    if (r.tab === 'board') {
      if (boardOn) return;
      if (mountBoard()) { emit(); return; }
      r = { tab: 'now', dish: null };          // no board yet: stay on the guide
    }
    unmountBoard();
    if (r.tab !== cur.tab || r.dish !== cur.dish) { closeAllSheets(true); confirmReset = false; }
    cur = r;
    render();
  }

  /* ================================================================== 10. views */

  var lastKey = null, scrollMem = {}, pointerDown = false, scrollBusy = false, scrollTimer = 0;
  var shownMode = null;                        // which Now card was up at the last render or tick
  function onScroll() {
    updateMore();
    scrollBusy = true;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { scrollBusy = false; scrollTimer = 0; }, 350);
  }
  function viewKey() {
    if (cur.tab === 'now') return 'now:' + (focusGet() || nowMode());
    if (cur.tab === 'dishes') return cur.dish ? 'dish:' + cur.dish : 'dishes';
    return cur.tab;
  }
  function viewParts() {
    if (cur.tab === 'day') return { view: dayHTML(), actions: '' };
    if (cur.tab === 'setup') return { view: setupHTML(), actions: '' };
    if (cur.tab === 'dishes') {
      if (!cur.dish) return { view: gridHTML(), actions: '' };
      return { view: dishHTML(dishById[cur.dish]), actions: row('<a class="btn" href="#dishes">' + ico('left', 22) + '<span>Back to dishes</span></a>') };
    }
    return nowParts();
  }

  function render(o) {
    o = o || {};
    if (boardOn) return;
    var page = $('page'), key = viewKey(), changed = key !== lastKey;
    if (changed && lastKey !== null) scrollMem[lastKey] = page.scrollTop;
    renderStatus();
    renderBanners();
    renderChips();
    renderTabs();
    var keep = o.keepCard && !changed && cur.tab === 'now' && nowMode() === 'step';
    var parts = keep ? null : viewParts();
    if (keep) { patchTicks(); renderActions(stepActions(byId[focusGet()])); }
    else { setHTML($('view'), parts.view); renderActions(parts.actions); }
    if (changed) {
      lastKey = key;
      if (speech.on) stopSpeech();
      page.scrollTop = key === 'day' ? 0 : (scrollMem[key] || 0);
      if (key === 'day') scrollDayToNext();
      var v = $('view');
      v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
    }
    renderSheet();
    if (o.keepCard) patchTicks();
    patchReadButtons();
    updateCountdowns();
    updateMore();
    shownMode = nowMode();
  }
  function renderActions(html) {
    $('actions').hidden = !html;
    setHTML($('actions-in'), html || '');
  }
  function renderTabs() {
    var tabs = doc.querySelectorAll('#tabs .tab'), i;
    for (i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-tab') === cur.tab) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
  }
  var lastClock = '', lastPill = '';
  function renderStatus() {
    var c = clock(now());
    if (c !== lastClock) {
      lastClock = c;
      var m = /^(.*?)\s*([AP]M)$/i.exec(c);
      $('clock').innerHTML = m ? esc(m[1]) + '<small>' + esc(m[2]) + '</small>' : esc(c);
    }
    var p = projection(), text, cls = '';
    if (dinnerDone()) text = 'Dinner is served';
    else if (p.dinnerAt == null) { text = 'Dinner ' + shortClock(p.dinnerAnchor); cls = 'plain'; }
    else if (p.lateMin > 0 && shortClock(p.dinnerAt) !== shortClock(p.dinnerAnchor)) { text = 'Dinner about ' + shortClock(p.dinnerAt); cls = 'late'; }
    else text = 'Dinner ' + shortClock(p.dinnerAnchor) + ' · on time';
    if (text + cls !== lastPill) {
      lastPill = text + cls;
      var el = $('pill');
      el.className = 'pill' + (cls ? ' ' + cls : '');
      el.innerHTML = '<span>' + esc(text) + '</span>' + ico('right', 18);
    }
  }
  function updateCountdowns() {
    var t = now(), nodes = doc.querySelectorAll('[data-until]'), i, n, rem, txt;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      rem = Number(n.getAttribute('data-until')) - t;
      txt = rem > 0 ? (n.getAttribute('data-pre') || '') + E.fmtCountdown(rem) + (n.getAttribute('data-post') || '') : n.getAttribute('data-done');
      if (n.textContent !== txt) n.textContent = txt;
    }
  }
  function updateMore() {
    var p = $('page'), w = $('page-wrap');
    w.classList.toggle('more', p.scrollHeight - p.clientHeight - p.scrollTop > 16);
    w.classList.toggle('scrolled', p.scrollTop > 4);
  }

  /* ---- banners ---- */
  function renderBanners(list) {
    list = list || activeAlerts();
    var acked = ackedMap(), h = '';
    if (preview) {
      h += '<div class="banner preview" aria-label="Preview. Nothing is saved."><div class="banner-text">PREVIEW<small>nothing is saved</small></div>' +
        btn('preview-exit', '', 'Exit') + '</div>';
    }
    var open = list.filter(function (a) {
      return !acked[a.key] && !(a.kind === 'fg' && viewingStep(a.stepId));      // on its own step the action bar already says so
    });
    var show = open.slice(0, 2), leave = open.filter(function (a) { return a.kind === 'leave'; })[0];
    if (leave && show.indexOf(leave) < 0) show[1] = leave;                       // the hard out always gets a place
    show.forEach(function (a) { h += alertHTML(a); });
    $('banners').hidden = !h;
    setHTML($('banners-in'), h);
  }
  function alertHTML(a) {
    var main = a.title || '', small = '', b = '', cls = 'banner', st = a.stepId ? byId[a.stepId] : null;
    var key = at('key', a.key);
    if (a.kind === 'lap') b = btn('alert', key, /^turn/i.test(main) ? 'Turned' : /^stir/i.test(main) ? 'Stirred' : 'OK');
    else if (a.kind === 'leave') {
      if (a.minsLeft >= 1) cls += ' soon';
      else { main = 'Time to leave'; if (st && !viewingStep(st.id)) b = btn('alert', key, 'Go'); }   // Go opens the leave step: its walk-out checks come first
    } else if (a.kind === 'fg') {
      main = st ? st.title : 'Timer'; small = 'The timer has finished'; b = btn('alert', key, 'Go');
    } else {
      var def = waitDef[a.waitId] || {}, label = def.label || '';
      var why = a.kind === 'max' ? (def.max ? 'more than ' + dur(def.max) : 'too long') : 'time is up';
      if (st && !viewingStep(st.id)) { main = st.title; small = label ? label + ': ' + why : why; b = btn('alert', key, 'Go'); }
      else { main = a.kind === 'max' ? 'Too long' : 'Time is up'; small = label; b = btn('alert', key, 'OK'); }
    }
    return '<div class="' + cls + '"><div class="banner-text">' + esc(main) + (small ? '<small>' + esc(small) + '</small>' : '') + '</div>' + b + '</div>';
  }

  /* ---- running timers ---- */
  function renderChips() {
    var s = S(), t = now(), h = '', fg = s.fg;
    function chip(stepId, label, end, ready) {
      return '<button type="button" class="chip' + (ready ? ' ready' : '') + '" data-act="open-step"' + at('step', stepId || '') + '>' + ico('timer', 20) +
        '<span>' + esc(label) + '</span>' + (ready ? '<b>Ready</b>' : '<b>' + cd(end, 'Ready') + '</b>') + '</button>';
    }
    if (fg && byId[fg.stepId] && t < fg.endsAt && !viewingStep(fg.stepId)) {
      h += chip(fg.stepId, (byId[fg.stepId].timer && byId[fg.stepId].timer.label) || byId[fg.stepId].title, fg.endsAt, false);
    }
    safe(function () { return E.waitsView(PLAN, s, t); }, []).sort(function (a, b) { return (a.elapsed ? 1 : 0) - (b.elapsed ? 1 : 0); }).forEach(function (w) {
      h += chip(w.gatedStepId || w.by, (waitDef[w.id] || {}).chip || w.label, w.endsAt, w.elapsed);
    });
    $('chips').hidden = !h;
    setHTML($('chips-in'), h);
  }

  /* ---- step card (also used inside the step sheet) ---- */
  function whereLabel(step) {
    if (step.kind === 'move') return '';
    var w = step.where;
    if (w === 'either') {
      var p = projection().byStep[step.id], l = p ? p.loc : loc();
      w = l === 'hers' ? 'hers' : 'home';
    }
    return w === 'hers' ? 'Her kitchen' : 'Your kitchen';
  }
  function callout(cls, icon, label, html) {
    return '<div class="callout ' + cls + '">' + ico(icon, 26) + '<div>' + (label ? '<span class="label">' + label + '</span>' : '') + '<div class="val">' + html + '</div></div></div>';
  }
  function noteRow(cls, icon, html) {
    return '<div class="note-row' + (cls ? ' ' + cls : '') + '">' + (icon ? ico(icon, 22) : '') + '<span>' + html + '</span></div>';
  }
  function statusNote(step, o) {
    var s = S(), t = now();
    if (o.sheet) {
      if (isDone(step)) return noteRow('ok', 'check', 'Done' + (s.done[step.id] ? ' at ' + esc(clock(s.done[step.id])) : ''));
      if (isSkipped(step)) return noteRow('', '', 'Skipped');
      if (!isActive(step)) return noteRow('', '', 'Not part of today');
      var p = projection().byStep[step.id];
      if (p && p.status === 'next') return noteRow('ok', 'go', 'Up next');
      if (p) return noteRow('', 'timer', 'Planned for ' + esc(clock(p.start)));
      return noteRow('', '', 'Not planned for today');
    }
    var bl = safe(function () { return E.blockers(PLAN, s, step, t); }, []), by = {};
    bl.forEach(function (b) { if (!by[b.type]) by[b.type] = b; });
    if (by.wait) {
      var label = (waitDef[by.wait.waitId] || {}).label || 'Timer';
      if (by.wait.endsAt == null) return noteRow('time', 'timer', esc(label) + ': not started yet');
      return noteRow('time', 'timer', cd(by.wait.endsAt, label + ': ready', label + ' · ', ' left'));
    }
    if (by.time) return noteRow('', 'timer', 'You are early. Planned for ' + esc(clock(by.time.at)) + '.');
    if (by.after && byId[by.after.stepId]) return noteRow('', '', 'First: ' + esc(byId[by.after.stepId].title));
    if (by.place && step.kind !== 'move') return noteRow('', '', by.place.where === 'hers' ? 'This step is for her kitchen.' : by.place.where === 'home' ? 'This step is for your kitchen.' : 'Not while you are packing up.');
    return '';
  }
  function tickRow(it) {
    var inner = '<span class="box">' + ico('check', 22) + '</span><span class="txt">' + esc(it.label) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</span>';
    if (!it.stepId) return '<li><div class="tick">' + inner + '</div></li>';
    return '<li><button type="button" class="tick" aria-pressed="' + (it.ticked ? 'true' : 'false') + '" data-act="tick"' + at('step', it.stepId) + at('item', it.id) + '>' + inner + '</button></li>';
  }
  function countText(items) { return items.filter(function (i) { return i.ticked; }).length + ' of ' + items.length + ' ticked'; }
  function checklistHTML(step) {
    var items = checklistItems(step);
    return '<div class="block"><p class="count-line"' + at('count', step.id) + '>' + countText(items) + '</p><ul class="ticks">' + items.map(tickRow).join('') + '</ul></div>';
  }
  // keep tick rows in step with the state without rebuilding the card
  function patchTicks() {
    var t = S().ticks || {}, nodes = doc.querySelectorAll('[data-act="tick"]'), i, n, on, counts;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      on = !!(t[n.getAttribute('data-step')] && t[n.getAttribute('data-step')][n.getAttribute('data-item')]);
      if ((n.getAttribute('aria-pressed') === 'true') !== on) n.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    counts = doc.querySelectorAll('[data-count]');
    for (i = 0; i < counts.length; i++) {
      var st = byId[counts[i].getAttribute('data-count')];
      if (st) { var txt = countText(checklistItems(st)); if (counts[i].textContent !== txt) counts[i].textContent = txt; }
    }
  }
  function nextLine(step) { var n = nextAfter(step); return n ? 'Next: ' + n : ''; }
  function stepHTML(step, o) {
    o = o || {};
    var d = dishOf(step), where = whereLabel(step), id = at('step', step.id), h = '';
    h += '<article class="step ' + colorClass(d) + '"' + id + '>';
    h += '<div class="crumb"><span class="dot"></span><span class="nick">' + esc(d.nick) + '</span><span class="where">' + where + '</span>' +
      (d.id !== 'day' && d.name ? '<span class="plain">' + esc(d.name) + '</span>' : '') + '</div>';
    h += '<h1 class="title"' + (o.sheet ? ' id="sheet-title"' : '') + '>' + esc(step.title) + '</h1>';
    h += statusNote(step, o);
    if (step.warn) h += callout('warn', 'warn', '', rich(step.warn));
    if (step.body && step.body.length) h += '<div class="body">' + step.body.map(function (l) { return '<p>' + rich(l) + '</p>'; }).join('') + '</div>';
    if (step.kind === 'checklist') h += checklistHTML(step);
    if (step.need && step.need.length) {
      h += '<div class="block"><p class="label">You need</p><ul class="need-list">' + step.need.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    }
    if (step.into) h += callout('into', 'jar', 'Put it in', esc(step.into));
    if (step.look) h += callout('look', 'ok', "It's right when", rich(step.look));
    if (step.tip) h += callout('tip', 'tip', 'Tip', rich(step.tip));
    var m = stepMins(step), meta = '';
    if (m > 0) meta += '<span>About ' + esc(dur(m)) + '</span>';
    if (!o.sheet) meta += '<span data-role="next">' + esc(nextLine(step)) + '</span>';
    if (meta) h += '<div class="meta">' + meta + '</div>';
    h += '<div class="tools">' +
      '<button type="button" class="btn" data-act="read"' + id + ' aria-pressed="false"' + (canSpeak() ? '' : ' hidden') + '>' + ico('speaker', 24) + '<span>Read to me</span></button>' +
      '<button type="button" class="btn" data-act="help"' + id + '>' + ico('help', 24) + '<span>Help</span></button></div>';
    return h + '</article>';
  }
  function backBtn() {
    return '<button type="button" class="btn back" data-act="undo"' + (stack().length ? '' : ' disabled') + '>Back</button>';
  }
  function stepActions(step) {
    var s = S(), t = now(), id = at('step', step.id), kind = step.kind || 'do', h = '';
    if (kind === 'check' && step.check) {
      var c = step.check;
      h += row(
        btn('check-no', id, '<span class="lines"><span>' + esc(c.no || 'Not yet') + '</span><small>check again in ' + esc(dur(c.retryMins || 5)) + '</small></span>', 'big'),
        btn('check-yes', id, esc(c.yes || 'Yes'), 'go ans')
      );
      return h + row(backBtn(), canGiveUp(step) ? btn('give-up', id, esc(c.giveUp.label || 'No time for this'), 'main') : '');
    }
    if (kind === 'choice' && step.choice) {
      var opts = step.choice.options || [];
      var pair = opts.length === 2 && opts.every(function (o) { return String(o.label).length <= 20; });
      var bs = opts.map(function (o, i) { return btn('choose', id + at('i', i), esc(o.label), 'big'); });
      h += pair ? row(bs[0], bs[1]) : bs.map(function (b) { return row(b); }).join('');
      return h + row(backBtn());
    }
    var fg = s.fg && s.fg.stepId === step.id ? s.fg : null, main;
    if (step.timer && !fg) main = btn('start-timer', id, 'Start ' + esc(E.fmtCountdown(step.timer.secs * 1000)), 'go main');
    else if (step.timer && fg && t < fg.endsAt) {
      return row(backBtn(), '<div class="timerbox" role="timer" aria-label="' + esc(step.timer.label || 'Timer') + '">' + cd(fg.endsAt, '0:00') + '</div>', btn('skip-timer', '', 'Skip timer', 'side'));
    } else if (fg) main = btn('done', id, '<span class="lines"><span>Done</span><small>Time is up</small></span>', 'go main');
    else main = btn('done', id, esc(kind === 'move' ? moveLabel(step) : (kind === 'checklist' && typeof step.items === 'string') ? 'All packed' : 'Done'), 'go main');
    return row(backBtn(), step.optional ? btn('skip', id, 'Skip', 'side') : '', main);
  }

  /* ---- the other Now cards ---- */
  function tonightList() {
    var s = S(), h = '<ul class="tn">';
    (PLAN.tonight || []).forEach(function (it) {
      var on = !!(s.tonight && s.tonight[it.id]), key = 'tn:' + it.id, open = !!openMap[key];
      h += '<li class="tn-item' + (on ? ' is-done' : '') + '"><div class="tn-row">' +
        '<button type="button" class="tn-tick" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc((on ? 'Done: ' : 'Mark done: ') + it.title) + '" data-act="tonight-tick"' + at('id', it.id) + '><span class="box">' + ico('check', 22) + '</span></button>' +
        '<button type="button" class="tn-open" aria-expanded="' + (open ? 'true' : 'false') + '" data-act="toggle"' + at('key', key) + '><span class="txt">' + esc(it.title) + '</span>' + ico('down', 22) + '</button></div>' +
        (open ? '<div class="tn-body">' + (it.body || []).map(function (l) { return '<p>' + rich(l) + '</p>'; }).join('') + '</div>' : '') + '</li>';
    });
    return h + '</ul>';
  }
  function previewLabel() { return realNow() < E.dayMs(state) ? 'Preview tomorrow' : 'Preview the day'; }
  function nowParts() {
    var mode = nowMode(), s = S(), h, mv;
    if (mode === 'step') { var st = byId[focusGet()]; return { view: stepHTML(st), actions: stepActions(st) }; }
    if (mode === 'done') {
      var dn = byId.dinner || { body: [] };
      h = '<div class="hero"><h1 class="title">Dinner is served.</h1><div class="body">' + (dn.body || []).map(function (l) { return '<p>' + rich(l) + '</p>'; }).join('') + '</div></div>';
      return { view: h, actions: row(backBtn(), '<a class="btn main" href="#day">See the day</a>') };
    }
    if (mode === 'tonight') {
      var d0 = E.dayMs(s), t = realNow(), startAt = clock(E.anchorMs(s, 'start'));
      var eve = t >= d0 - DAY;
      var when = t >= d0 ? 'Today starts at ' : eve ? 'Tomorrow starts at ' : dayLabel(d0) + ' starts at ';
      h = '<div class="hero"><h1 class="title">' + (eve ? 'Tonight' : 'Before the day') + '</h1>' +
        '<p class="lead">A few small jobs so the cooking goes smoothly. Tap a row to see how.</p>' + tonightList() +
        '<p class="lead"><b>' + esc(when + startAt) + '</b></p></div>';
      return { view: h, actions: row(btn('preview-enter', '', esc(previewLabel()), 'big')) };
    }
    if (mode === 'away' || mode === 'drive') {
      mv = moveOf[mode === 'away' ? 'backHome' : 'arrive'];
      var eta;
      if (mode === 'away') eta = 'Back home around ' + clock(E.anchorMs(s, 'backHome')) + '.';
      else {
        var left = moveOf.leavePm ? s.done[moveOf.leavePm.id] : null;
        var arr = left ? left + (s.anchors.arrive - s.anchors.leavePm) * MIN : E.anchorMs(s, 'arrive');
        eta = 'You should get there around ' + clock(arr) + '.';
      }
      h = '<div class="hero"><h1 class="title">' + (mode === 'away' ? "You're out." : 'Drive to her place.') + '</h1><p class="lead">' + esc(eta) + '</p>' +
        (mv && mv.body ? '<div class="body">' + mv.body.map(function (l) { return '<p>' + rich(l) + '</p>'; }).join('') + '</div>' : '') + '</div>';
      return { view: h, actions: row(backBtn(), mv ? btn('done', at('step', mv.id), esc(moveLabel(mv)), 'go main') : '') };
    }
    return freeParts();
  }
  function freeParts() {
    var s = S(), t = now(), u = safe(function () { return E.nextUnlock(PLAN, s, t); }, null), h = '<div class="hero">', top = '';
    var mvName = { 'home-am': 'leaveAm', 'home-pm': 'leavePm' }[loc()], mv = mvName ? moveOf[mvName] : null;
    // A burner that is still on: an attended timer started here whose step is not done. Not when that step now waits on
    // another step (he stopped the beans to finish them at her place: the pot is already off the stove).
    var onStove = safe(function () { return E.waitsView(PLAN, s, t); }, []).filter(function (w) {
      if (!w.attended || !w.here) return false;
      var g = w.gatedStepId ? byId[w.gatedStepId] : null;
      return !g || !safe(function () { return E.blockers(PLAN, s, g, t); }, []).some(function (b) { return b.type === 'after'; });
    });
    if (u && byId[u.stepId]) {
      var nx = byId[u.stepId];
      var why = u.reason === 'wait' ? ((waitDef[nx.afterWait] || {}).label || 'A timer is running') + '.'
        : u.reason === 'time' ? 'The next step is timed so the food is at its best at dinner.' : (onStove.length ? 'Still on the stove: ' + onStove.map(function (w) { return w.label; }).join(', ') + '. It has to come off before you go. Tap Leave early to see how.' : 'Everything for this kitchen is done.');
      h += '<h1 class="title">Free until ' + esc(clock(u.at)) + '</h1>' +
        '<div class="count" role="timer">' + cd(u.at, '0:00') + '</div>' +
        '<p class="lead">' + esc(why) + '</p>' +
        '<div class="block tight"><span class="label">Next</span><p class="lead"><b>' + esc(nx.title) + '</b></p></div>';
      if (preview) top = btn('skip-ahead', '', 'Skip ahead', 'go');
      else if (u.reason === 'time') top = btn('do-now', at('step', u.stepId), 'Start it now', 'big');
    } else {
      h += '<h1 class="title">Nothing to do right now</h1><p class="lead">Open the Day tab to see what is left.</p>';
    }
    // Leaving: when nothing else is left here the card shows the walk-out checks and the button leaves.
    // While timers are still running he can leave early, through the leave step so he sees those checks first.
    var canLeave = mv && !isDone(mv), leaveNow = canLeave && (!u || u.reason === 'move') && !onStove.length, early = '';
    if (leaveNow && mv.body && mv.body.length) h += '<div class="body">' + mv.body.map(function (l) { return '<p>' + rich(l) + '</p>'; }).join('') + '</div>';
    if (leaveNow && !top) top = btn('done', at('step', mv.id), esc(moveLabel(mv)), 'go');
    else if (leaveNow) early = btn('done', at('step', mv.id), esc(moveLabel(mv)));
    else if (canLeave) early = btn('do-now', at('step', mv.id), 'Leave early');
    return { view: h + '</div>', actions: row(top) + row(early) + row(backBtn(), '<a class="btn main" href="#day">See the day</a>') };
  }

  /* ---- Day tab ---- */
  var LOC_TITLE = { 'home-am': 'Your kitchen · morning', 'away': 'Out', 'home-pm': 'Your kitchen · pack up', 'drive': 'Drive', 'hers': 'Her kitchen' };
  function stepRow(st, info) {
    var s = S(), d = dishOf(st), done = info.status === 'done', next = info.status === 'next';
    var time = done ? shortClock(s.done[st.id] || info.end) : info.start != null ? shortClock(info.start) : '';
    var bits = [], m = stepMins(st);
    if (info.skipped) bits.push('skipped');
    else if (info.start == null && !done) bits.push('not planned today');
    if (m > 0) bits.push(dur(m));
    if (info.deferred) bits.push('moved from the morning');
    return '<button type="button" class="srow ' + colorClass(d) + (done ? ' done' : next ? ' next' : '') + '" data-act="open-step"' + at('step', st.id) + (next ? ' data-next="1"' : '') + '>' +
      '<span class="t">' + esc(time) + '</span>' +
      '<span class="dot">' + (done ? ico('check', 18) : '') + '</span>' +
      '<span class="mid"><span class="ttl">' + (next ? '<span class="tag">Next</span>' : '') + (info.late && !done ? '<span class="tag late">Late</span>' : '') + esc(st.title) + '</span>' +
      (bits.length ? '<span class="dur">' + esc(bits.join(' · ')) + '</span>' : '') + '</span></button>';
  }
  function dayHTML() {
    var p = projection(), h = '', group = null, open = false, upId = null;
    p.rows.forEach(function (r) { if (!upId && r.stepId && (r.type === 'step' || r.type === 'move') && r.status === 'next') upId = r.stepId; });
    if (!upId) p.rows.forEach(function (r) { if (!upId && r.stepId && (r.type === 'step' || r.type === 'move') && r.status !== 'done') upId = r.stepId; });
    h += '<div class="day-head"><h1 class="h1">Dinner ' + esc(clock(p.dinnerAnchor)) + '</h1>';
    if (dinnerDone()) h += '<p class="sub ok">Dinner is served.</p>';
    else if (p.dinnerAt == null) h += '<p class="sub">Some steps cannot be planned yet.</p>';
    else if (p.lateMin > 0) h += '<p class="sub late">Running ' + p.lateMin + ' min late. Dinner about ' + esc(clock(p.dinnerAt)) + '.</p>';
    else h += '<p class="sub ok">On time.' + (p.spareMin > 0 ? ' ' + p.spareMin + ' min to spare.' : '') + '</p>';
    var warns = (p.warnings || []).filter(function (w) { return w.code !== 'late' && w.text; });
    if (warns.length) h += '<ul class="warn-list">' + warns.map(function (w) { return '<li>' + esc(w.text) + '</li>'; }).join('') + '</ul>';
    h += '</div>';
    p.rows.forEach(function (r) {
      if (r.loc !== group) {
        if (open) h += '</section>';
        group = r.loc; open = true;
        h += '<section class="group"><h2 class="group-title">' + esc(LOC_TITLE[r.loc] || '') + '</h2>';
      }
      var st = r.stepId ? byId[r.stepId] : null;
      if (r.type === 'step' && st) h += stepRow(st, st.id === upId && r.status !== 'next' ? Object.assign({}, r, { status: 'next' }) : r);
      else if (r.type === 'wait') h += '<div class="wrow">' + ico('timer', 20) + '<span>' + esc(r.label) + ' until ' + esc(shortClock(r.end)) + '</span></div>';
      else if (r.type === 'free') h += '<div class="frow"><span>Free ' + esc(shortClock(r.start)) + ' – ' + esc(clock(r.end)) + '</span></div>';
      else if (r.type === 'move' && st) {
        h += '<button type="button" class="mrow' + (r.status === 'done' ? ' done' : '') + '" data-act="open-step"' + at('step', st.id) + (st.id === upId ? ' data-next="1"' : '') + '>' +
          '<span class="t">' + esc(clock(r.at)) + '</span>' + ico(r.status === 'done' ? 'check' : 'go', 22) + '<span>' + esc(st.title) + '</span></button>';
      }
    });
    if (open) h += '</section>';
    return h;
  }
  function scrollDayToNext() {
    var page = $('page'), el = page.querySelector('[data-next]');
    if (!el) return;
    var top = el.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop;
    var head = el.closest('.group') ? el.closest('.group').querySelector('.group-title') : null;
    page.scrollTop = Math.max(0, top - 12 - (head ? head.offsetHeight : 0));
  }

  /* ---- Dishes ---- */
  // steps for a human, in the order they will happen (never array order: SPEC 9.1)
  function listSteps(test) {
    var p = projection(), s = S();
    function when(st) {
      var b = p.byStep[st.id];
      if (s.done[st.id]) return s.done[st.id];
      if (b) return b.start;
      return isDone(st) ? -Infinity : Infinity;        // a question answered ahead of time comes first; unplanned steps last
    }
    return STEPS.filter(function (st) { return test(st) && (isActive(st) || isDone(st) || isSkipped(st)); }).sort(function (a, b) {
      var ka = when(a), kb = when(b);
      return ka === kb ? orderOf[a.id] - orderOf[b.id] : ka < kb ? -1 : 1;
    });
  }
  // A rough time for one dish: the hands-on minutes of its steps, plus the timers those steps start.
  function dishTime(d) {
    var hands = 0, timers = 0;
    STEPS.forEach(function (st) {
      if (st.dish !== d.id || !isActive(st)) return;
      hands += stepMins(st) || 0;
      if (st.wait && st.wait.mins > 0) timers += st.wait.mins;
    });
    function r5(m) { return m <= 0 ? 0 : Math.max(5, Math.round(m / 5) * 5); }
    return { hands: r5(hands), total: r5(hands + timers), timers: timers > 0 };
  }
  function gridHTML() {
    var s = S(), h = '<div class="stack"><h1 class="h1">Dishes</h1><div class="grid">';
    DISHES.concat([DAY_DISH]).forEach(function (d) {
      var pr = safe(function () { return E.dishProgress(PLAN, s, d.id); }, { done: 0, total: 0 });
      var tm = safe(function () { return dishTime(d); }, { hands: 0, total: 0 });
      h += '<a class="tile ' + colorClass(d) + '" href="#dish-' + esc(d.id) + '"><span><span class="nick">' + esc(d.nick) + '</span><span class="name">' + esc(d.name) + '</span></span>' +
        '<span><span class="prog">' + pr.done + ' of ' + pr.total + ' steps</span>' +
        (tm.total > 0 ? '<span class="est">About ' + esc(dur(tm.total)) + ' total</span>' : '') + '</span></a>';
    });
    return h + '</div></div>';
  }
  function dishTimeLine(d) {
    var tm = safe(function () { return dishTime(d); }, { hands: 0, total: 0 });
    if (!(tm.total > 0)) return '';
    return '<p class="sub"><b>About ' + esc(dur(tm.total)) + ' in all.</b> ' +
      (tm.timers && tm.hands < tm.total ? 'About ' + esc(dur(tm.hands)) + ' of that is hands-on. The rest is timers.' : 'All of it is hands-on.') + '</p>';
  }
  function dishHTML(d) {
    var p = projection(), isDay = d.id === 'day', seg = isDay ? 'steps' : ui.seg, h = '';
    h += '<div class="dish ' + colorClass(d) + '"><div class="block"><h1 class="h1">' + esc(d.nick) + '</h1><p class="lede">' + esc(d.name) + '</p>' +
      (d.blurb ? '<p class="sub">' + esc(d.blurb) + '</p>' : '') + dishTimeLine(d) + '</div>';
    if (d.source && d.source.url) {
      h += '<a class="linkrow" href="' + esc(d.source.url) + '" target="_blank" rel="noopener noreferrer"><span>Original recipe: ' + esc(d.source.label || d.name) + '</span>' + ico('out', 22) + '</a>';
    }
    if (!isDay) {
      h += '<div class="segs" role="group" aria-label="What to show">' + [['steps', 'Steps'], ['ingredients', 'Ingredients'], ['gear', 'Gear']].map(function (x) {
        return '<button type="button" class="btn' + (seg === x[0] ? ' on' : '') + '" aria-pressed="' + (seg === x[0] ? 'true' : 'false') + '" data-act="seg"' + at('seg', x[0]) + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    }
    if (seg === 'ingredients') {
      h += '<ul class="list">' + (d.ingredients || []).map(function (g) {
        if (!g.item) return '<li class="subhead">' + esc(g.qty) + '</li>';
        return '<li>' + (g.qty ? '<b>' + esc(g.qty) + '</b> ' : '') + esc(g.item) + (g.note ? '<small>' + esc(g.note) + '</small>' : '') + '</li>';
      }).join('') + '</ul>';
    } else if (seg === 'gear') {
      h += '<ul class="list">' + (d.gear || []).map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>';
    } else {
      h += '<div class="rows">' + listSteps(function (st) { return st.dish === d.id; }).map(function (st) {
        var b = p.byStep[st.id] || {};
        return stepRow(st, { status: isDone(st) ? 'done' : b.status, start: b.start, end: b.end, deferred: b.deferred, skipped: isSkipped(st) && !isDone(st) });
      }).join('') + '</div>';
    }
    if (d.notes && d.notes.length) {
      h += '<div class="block"><h2 class="h2">Good to know</h2><ul class="list">' + d.notes.map(function (n) { return '<li>' + rich(n) + '</li>'; }).join('') + '</ul></div>';
    }
    if (d.makes || (d.source && d.source.label)) {
      h += '<div class="block"><h2 class="h2">About this dish</h2>' + (d.makes ? '<p class="sub">Makes: ' + esc(lowerFirst(d.makes)) + '</p>' : '');
      if (d.source && d.source.label && !d.source.url) h += '<p class="sub">Recipe: ' + esc(d.source.label) + '</p>';
      h += '</div>';
    }
    return h + '</div>';
  }

  /* ---- Setup ---- */
  function dayLabel(ms) {
    return safe(function () { return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, ''); }, '');
  }
  function ymd(d) { function p(n) { return n < 10 ? '0' + n : '' + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function shiftedDay(delta) { var d = new Date(E.dayMs(S())); return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta)); }
  function countSummary(items) {
    var counts = {}, order = [];
    items.forEach(function (it) {
      var w = String(it.name || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).pop() || 'thing';
      if (!counts[w]) { counts[w] = 0; order.push(w); }
      counts[w]++;
    });
    return items.length + ' in all: ' + order.map(function (w) { return counts[w] + ' ' + w + (counts[w] === 1 ? '' : 's'); }).join(', ') + '.';
  }
  function setupHTML() {
    var s = S(), t = now(), h = '<div class="setup"><h1 class="h1">Setup</h1>';
    function sect(title, inner) { return '<section class="sect"><h2 class="h2">' + title + '</h2>' + inner + '</section>'; }

    h += sect('Big board', '<p class="sub">The whole day as a timeline, with the current step beside it. Best on a laptop or an iPad.</p>' +
      '<a class="btn big on block" href="#board">Open the big board</a>' + btn('chef-open', '', 'Ask the Chef', 'big block'));

    h += sect('The night before', tonightList());

    var c = PLAN.containers || {}, jars = '';
    [['home', 'At your place'], ['hers', 'At her place']].forEach(function (x) {
      var items = c[x[0]] || [];
      if (!items.length) return;
      jars += '<p class="label">' + x[1] + '</p><p class="sub">' + esc((PLAN.containerSummary || {})[x[0]] || countSummary(items)) + '</p><ul class="list">' + items.map(function (it) {
        return '<li><b>' + esc(it.name) + '</b><small>' + esc(it.size) + '</small>' + esc(it.holds) + '</li>';
      }).join('') + '</ul>';
    });
    h += sect('Jars, tubs and bowls', jars);

    var packs = '';
    Object.keys(PLAN.pack || {}).forEach(function (which) {
      var items = safe(function () { return E.packList(PLAN, s, which); }, []), st = listStepOf[which];
      var key = 'pack:' + which, open = !!openMap[key];
      packs += '<div class="tn-item"><button type="button" class="tn-open" aria-expanded="' + (open ? 'true' : 'false') + '" data-act="toggle"' + at('key', key) + '>' +
        '<span class="txt">' + esc(st ? st.title : which) + '<small class="count-line">' + countText(items) + '</small></span>' + ico('down', 22) + '</button>' +
        (open ? '<ul class="ticks">' + items.map(tickRow).join('') + '</ul>' : '') + '</div>';
    });
    h += sect('What to bring', '<div class="tn">' + packs + '</div>');

    var times = '<div class="card"><div class="stepper">' + btn('day-shift', at('d', -1) + (dayOver({ day: shiftedDay(-1) }) ? ' disabled' : ''), '− day', 'fill') +
      '<div class="val"><small>Cook day</small>' + esc(dayLabel(E.dayMs(s))) + '</div>' + btn('day-shift', at('d', 1), '+ day', 'fill') + '</div></div>';
    Object.keys(s.anchors || {}).forEach(function (name) {
      var v = s.anchors[name];
      var down = safe(function () { return E.setAnchor(PLAN, s, name, v - 15, t) !== s; }, false);
      var up = safe(function () { return E.setAnchor(PLAN, s, name, v + 15, t) !== s; }, false);
      times += '<div class="card"><div class="stepper">' +
        '<button type="button" class="btn fill" data-act="anchor"' + at('name', name) + at('d', -15) + (down ? '' : ' disabled') + ' aria-label="15 minutes earlier">−15</button>' +
        '<div class="val"><small>' + esc((PLAN.anchorLabels || {})[name] || name) + '</small>' + esc(clock(E.anchorMs(s, name))) + '</div>' +
        '<button type="button" class="btn fill" data-act="anchor"' + at('name', name) + at('d', 15) + (up ? '' : ' disabled') + ' aria-label="15 minutes later">+15</button></div></div>';
    });
    h += sect('Times', times);

    STEPS.forEach(function (st) {                      // every yes/no question of the day can be changed here
      if (st.kind !== 'choice' || !st.choice) return;
      var val = E.opt(PLAN, s, st.choice.opt);
      h += sect(esc(st.title), '<div class="pair">' + (st.choice.options || []).map(function (o, i) {
        return '<button type="button" class="btn' + (val === o.value ? ' on' : '') + '" aria-pressed="' + (val === o.value ? 'true' : 'false') + '" data-act="opt"' + at('step', st.id) + at('i', i) + '>' + esc(o.label) + '</button>';
      }).join('') + '</div>');
    });

    h += sect('Practice run', '<p class="sub">Walk through the day without changing anything real.</p>' +
      (preview ? btn('preview-exit', '', 'Exit preview', 'on') : canPreview() ? btn('preview-enter', '', esc(previewLabel())) : '<p class="sub">The day has started. The Day tab shows what is ahead.</p>'));

    h += sect('Sound', '<p class="sub">Timers beep through this phone. Turn the ringer on and the volume up. If your music stops when you tap the guide, play music from another device.</p>' + btn('test-alarm', '', 'Test the alarm'));

    var wk = wake.status === 'on' ? 'On. The screen stays awake while the guide is open.'
      : wake.status === 'idle' ? (gestured ? 'It turns back on when you return to this page.' : 'It turns on after your first tap.')
      : 'Not available here. On your phone: Settings → Display & Brightness → Auto-Lock → Never.';
    h += sect('Keep the screen on', '<div class="card"><p>' + esc(wk) + '</p></div>');

    h += sect('Start over', '<p class="sub">' + (preview ? 'Starts the practice run again. Your real day is not touched.' : 'Erases your progress, your ticks and your time changes.') + '</p>' +
      (confirmReset ? '<div class="pair">' + btn('reset-no', '', preview ? 'Keep going' : 'Keep my progress') + btn('reset-yes', '', preview ? 'Yes, start again' : 'Yes, erase it', 'danger') + '</div>' : btn('reset-ask', '', 'Start over')));

    var about = '<div class="card"><p>' + (sync.status === 'on' ? 'Your progress is saved online too. Open the guide on another device and it picks up where you are.'
      : sync.status === 'checking' ? 'Your progress is saved on this phone.' : 'Saved on this phone only.') + '</p></div>';
    about += '<p class="label">Recipes</p><div class="rows">' + DISHES.map(function (d) {
      if (!d.source || !d.source.label) return '';
      var txt = '<span>' + esc(d.nick) + ': ' + esc(d.source.label) + '</span>';
      return d.source.url ? '<a class="linkrow" href="' + esc(d.source.url) + '" target="_blank" rel="noopener noreferrer">' + txt + ico('out', 22) + '</a>'
        : '<div class="card"><p>' + esc(d.nick) + ': ' + esc(d.source.label) + '</p></div>';
    }).join('') + '</div>';
    h += sect('About', about);
    return h + '</div>';
  }

  /* ================================================================== 11. sheets */

  var sheets = [];           // a small stack: { type: 'step' | 'term' | 'help', ... }
  var sheetFresh = false;
  function openSheet(entry) {
    var sc = doc.querySelector('#sheet-layer .sheet-scroll');
    if (sc && sheets.length) sheets[sheets.length - 1].scroll = sc.scrollTop;
    sheets.push(entry); sheetFresh = true;
    renderSheet(); renderBanners(); renderChips();
  }
  function closeSheet() {
    var top = sheets.pop();
    if (top && top.ctl) { try { top.ctl.abort(); } catch (e) { /* ignore */ } }
    sheetFresh = false;
    renderSheet(); renderBanners(); renderChips();
  }
  function closeAllSheets(silent) {
    if (!sheets.length) return;
    sheets.forEach(function (x) { if (x.ctl) { try { x.ctl.abort(); } catch (e) { /* ignore */ } } });
    sheets = [];
    if (!silent) renderSheet();
  }
  function sheetShell(kind, inner, actions) {
    return '<div class="scrim" data-act="sheet-close"></div><section class="sheet ' + kind + '" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="sheet-scroll"><div class="wrap sheet-pad">' + inner + '</div></div>' +
      '<div class="sheet-actions"><div class="wrap sheet-actions-in">' + actions + '</div></div></section>';
  }
  function sheetList(top) {
    var dishId = top && typeof top.ctx === 'string' && top.ctx.indexOf('dish:') === 0 ? top.ctx.slice(5) : null;
    return listSteps(dishId ? function (st) { return st.dish === dishId; } : function () { return true; });
  }
  function glossLines(g) { return String(g.text || '').split('\n').map(function (l) { return '<p>' + esc(l) + '</p>'; }).join(''); }
  function sheetHTML(top) {
    var close = row(btn('sheet-close', '', 'Close', 'fill'));
    if (top.type === 'term') {
      var g = (PLAN.glossary || {})[top.key] || { term: top.key, text: '' };
      return sheetShell('low', '<div class="gloss"><h2 class="term-h" id="sheet-title">' + esc(g.term) + '</h2>' + glossLines(g) + '</div>', close);
    }
    if (top.type === 'chef') return sheetShell('full', chefHTML(), chefActions());
    var step = byId[top.id];
    if (!step) return sheetShell('low', '<div class="gloss"><h2 class="term-h" id="sheet-title">Not found</h2></div>', close);
    if (top.type === 'help') return sheetShell('full', helpHTML(step, top), close);
    var id = at('step', step.id), acts = '';
    if (isDone(step)) acts = row(btn('mark-undone', id, 'Not done'));
    else if (isSkipped(step)) acts = row(btn('mark-done', id, 'Mark done'));
    else if (isActive(step)) acts = row(step.kind === 'choice' ? '' : btn('mark-done', id, 'Mark done', 'half'), btn('do-now', id, 'Do this now', 'go main'));
    // Previous and Next page through the list the sheet was opened from: one dish's steps, or the whole day.
    // They sit in the bottom row, so they never move under the finger.
    var list = safe(function () { return sheetList(top); }, []), at0 = -1, k;
    for (k = 0; k < list.length; k++) if (list[k].id === step.id) { at0 = k; break; }
    if (at0 >= 0 && list.length > 1) {
      var navBtn = function (st, label) {
        return '<button type="button" class="btn nav" data-act="sheet-nav"' + (st ? at('step', st.id) : ' disabled') + '>' + label + '</button>';
      };
      close = row(navBtn(at0 > 0 ? list[at0 - 1] : null, 'Previous'),
        btn('sheet-close', '', '<span class="lines">Close<small>' + (at0 + 1) + ' of ' + list.length + '</small></span>', 'fill'),
        navBtn(at0 < list.length - 1 ? list[at0 + 1] : null, 'Next'));
    }
    return sheetShell('full', stepHTML(step, { sheet: true }), acts + close);
  }
  function helpHTML(step, top) {
    var h = '<div class="help"><div class="block"><h2 class="term-h" id="sheet-title">Help</h2><p class="sub">' + esc(step.title) + '</p></div>';
    var keys = termsIn(step), words;
    if (keys.length) {
      words = '<div class="block"><p class="label">Words in this step</p>' + keys.map(function (k) {
        var g = PLAN.glossary[k];
        return '<div class="card"><div class="kv"><b>' + esc(g.term) + '</b></div>' + glossLines(g) + '</div>';
      }).join('') + '</div>';
    } else words = '<p class="sub">This step uses no special words. In other steps, tap any underlined word to see what it means.</p>';
    if (caps.sample) {
      h += '<div class="block"><p class="label">Ask about this step</p>';
      if (top.q) {
        h += '<div class="card"><div class="kv"><b>' + esc(top.q) + '</b></div>';
        if (top.status === 'busy' && !top.a) h += '<p class="answer dim" data-role="answer">Thinking…</p>';
        else {
          if (top.a) h += '<p class="answer" data-role="answer">' + esc(top.a) + '</p>';
          if (top.status === 'error') h += '<p class="answer dim">Couldn\'t get an answer. Try again.</p>';
        }
        h += '</div>';
      }
      h += '<div class="rows">' + PRESETS.map(function (q, i) { return btn('ask-preset', at('i', i), esc(q)); }).join('') + '</div>' +
        '<form class="ask-form" id="ask-form" autocomplete="off"><input class="field" id="ask-input" name="q" type="text" maxlength="300" enterkeyhint="send" placeholder="Type a question" aria-label="Your question">' +
        '<button type="submit" class="btn on">Send</button></form></div>';
    }
    return h + words + '</div>';
  }
  function renderSheet() {
    var layer = $('sheet-layer');
    if (!sheets.length) {
      if (!layer.hidden) { layer.hidden = true; setHTML(layer, ''); layer.__top = null; }
      return;
    }
    var top = sheets[sheets.length - 1];
    var sc = layer.querySelector('.sheet-scroll');
    var keep = sc && layer.__top === top ? sc.scrollTop : (top.scroll || 0);
    var typed = $('ask-input') ? $('ask-input').value : '', typedChef = $('chef-input') ? $('chef-input').value : '';
    layer.hidden = false;
    if (setHTML(layer, sheetHTML(top))) {
      sc = layer.querySelector('.sheet-scroll');
      if (sc) sc.scrollTop = keep;
      if (typed && layer.__top === top && $('ask-input')) $('ask-input').value = typed;
      if (typedChef && layer.__top === top && $('chef-input')) $('chef-input').value = typedChef;
      if (sheetFresh) {
        var sh = layer.querySelector('.sheet');
        if (sh) { sh.classList.add('in'); if (sh.focus) { sh.setAttribute('tabindex', '-1'); sh.focus({ preventScroll: true }); } }
      }
    }
    sheetFresh = false;
    layer.__top = top;
    patchReadButtons();
    updateCountdowns();
  }

  /* ================================================================== 12. preview mode */

  function canPreview() { return !Object.keys(state.done || {}).length && !state.fg; }
  function enterPreview() {
    if (preview || !canPreview()) return;
    stopSpeech();
    var t = realNow(), start = E.anchorMs(state, 'start'), d0 = E.dayMs(state);
    var sim = isFinite(start) ? (t > start && t < d0 + DAY ? t : start) : t;
    preview = { state: state, now: sim, focus: null, pinned: false, undo: [], acked: {} };
    proj = null; alarm = {}; nudge = null;
    settleFocus();
    closeAllSheets(true);
    if (cur.tab !== 'now') { window.location.hash = '#now'; route(); }
    else render();
    emit();
  }
  function exitPreview() {
    if (!preview) return;
    stopSpeech();
    preview = null;
    proj = null; alarm = {}; lastKey = null; scrollMem = {};
    settleFocus();
    closeAllSheets(true);
    render();
    emit();
  }
  function skipAhead() {
    if (!preview) return;
    var u = safe(function () { return E.nextUnlock(PLAN, preview.state, preview.now); }, null);
    if (!u) return;
    pushUndo();
    preview.now = Math.max(preview.now, u.at);
    proj = null;
    settleFocus();
    render();
    emit();
  }

  /* ================================================================== events */

  var guardMs = 500, lastActionAt = -1e9, swapAt = 0;
  var HANDLERS = {
    'undo': function () { undo(); },
    'done': function (el) { doComplete(el.getAttribute('data-step')); },
    'check-yes': function (el) { doComplete(el.getAttribute('data-step')); },
    'check-no': function (el) { doRetry(el.getAttribute('data-step')); },
    'give-up': function (el) { doGiveUp(el.getAttribute('data-step')); },
    'skip': function (el) { doSkip(el.getAttribute('data-step')); },
    'choose': function (el) {
      var st = byId[el.getAttribute('data-step')], o = st && st.choice ? st.choice.options[Number(el.getAttribute('data-i'))] : null;
      if (o) doComplete(st.id, { value: o.value });
    },
    'start-timer': function (el) { startTimer(el.getAttribute('data-step')); },
    'skip-timer': function () { skipTimer(); },
    'tick': function (el) { doTick(el.getAttribute('data-step'), el.getAttribute('data-item'), el.getAttribute('aria-pressed') !== 'true'); },
    'tonight-tick': function (el) { doTonight(el.getAttribute('data-id'), el.getAttribute('aria-pressed') !== 'true'); },
    'toggle': function (el) { var k = el.getAttribute('data-key'); openMap[k] = !openMap[k]; render(); },
    'term': function (el) { openSheet({ type: 'term', key: el.getAttribute('data-key') }); },
    'help': function (el) { openSheet({ type: 'help', id: el.getAttribute('data-step'), q: '', a: '', status: 'idle' }); },
    'read': function (el) { toggleRead(el.getAttribute('data-step')); },
    'open-step': function (el) { var id = el.getAttribute('data-step'); if (byId[id]) openSheet({ type: 'step', id: id, ctx: cur.tab === 'dishes' && cur.dish ? 'dish:' + cur.dish : 'day' }); },
    // Previous / Next inside a step sheet: the next step of that dish, or of the whole day
    'sheet-nav': function (el) {
      var top = sheets[sheets.length - 1], id = el.getAttribute('data-step');
      if (!top || top.type !== 'step' || !byId[id]) return;
      stopSpeech();
      top.id = id; top.scroll = 0;
      $('sheet-layer').__top = null;                        // a different step: show it from its top
      renderSheet();
    },
    'sheet-close': function () { closeSheet(); },
    'do-now': function (el) { goFocus(el.getAttribute('data-step')); },
    'mark-done': function (el) { doComplete(el.getAttribute('data-step')); },
    'mark-undone': function (el) { doUncomplete(el.getAttribute('data-step')); },
    'alert': function (el) {
      var key = el.getAttribute('data-key'), a = activeAlerts().filter(function (x) { return x.key === key; })[0];
      if (!a) { refreshAlerts(); return; }
      if (a.kind === 'lap') ackLap(a.waitId, a.lap);
      else {
        ackedMap()[a.key] = true; saveUi();
        if (a.stepId && byId[a.stepId] && !viewingStep(a.stepId)) goFocus(a.stepId);
        else refreshAlerts();
      }
    },
    'preview-enter': function () { enterPreview(); },
    'preview-exit': function () { exitPreview(); },
    'skip-ahead': function () { skipAhead(); },
    'seg': function (el) { ui.seg = el.getAttribute('data-seg'); saveUi(); render(); },
    'day-shift': function (el) { setDay(shiftedDay(Number(el.getAttribute('data-d')))); },
    'anchor': function (el) { var n = el.getAttribute('data-name'); setAnchor(n, S().anchors[n] + Number(el.getAttribute('data-d'))); },
    'opt': function (el) {
      var st = byId[el.getAttribute('data-step')], o = st && st.choice ? st.choice.options[Number(el.getAttribute('data-i'))] : null;
      if (o) setOpt(st.choice.opt, o.value);
    },
    'test-alarm': function () { initAudio(); ring('alarm'); },
    'reset-ask': function () { confirmReset = true; render(); },
    'reset-no': function () { confirmReset = false; render(); },
    'reset-yes': function () { if (preview) { confirmReset = false; exitPreview(); enterPreview(); } else startOver(); },
    'ask-preset': function (el) { ask(PRESETS[Number(el.getAttribute('data-i'))]); },
    'chef-open': function () { openSheet({ type: 'chef' }); scrollChef(); },
    'chef-preset': function (el) { chefSend(CHEF_STARTERS[Number(el.getAttribute('data-i'))]); },
    'chef-clear': function () { if (chef.status === 'busy') return; chef.turns = []; chef.err = ''; chef.status = 'idle'; chef.other = false; saveChef(); renderChef(); }
  };
  function onClick(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    // a second slippery tap must not follow the link that takes a button's place ("See the day" where Done was)
    var link = !el && ev.target && ev.target.closest ? ev.target.closest('#actions a[href]') : null;
    if (link && ev.timeStamp - lastActionAt < guardMs) { ev.preventDefault(); return; }
    if (!el || el.disabled) return;
    var fn = HANDLERS[el.getAttribute('data-act')];
    if (!fn) return;
    var inBar = !!el.closest('#actions');
    var guarded = (inBar || !!el.closest('.sheet-actions, .banner')) && el.getAttribute('data-act') !== 'sheet-nav';
    if (guarded) {
      var quick = ev.timeStamp - lastActionAt < guardMs;
      lastActionAt = ev.timeStamp;
      if (quick) { ev.preventDefault(); return; }
    }
    if (inBar && guardMs && realNow() - swapAt < 700) { ev.preventDefault(); return; }
    var before = sheets.length + '|' + viewKey();
    if (inBar) {
      var f = focusGet();
      if (f) ack(function (a) { return a.stepId === f && (a.kind === 'wait' || a.kind === 'max' || a.kind === 'fg'); });
    }
    fn(el, ev);
    if (before !== sheets.length + '|' + viewKey()) lastActionAt = ev.timeStamp;
  }
  function onKey(ev) {
    if (ev.key === 'Escape' && sheets.length) { ev.preventDefault(); closeSheet(); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.getAttribute && ev.target.getAttribute('role') === 'button') {
      ev.preventDefault(); ev.target.click();
    }
  }
  function onSubmit(ev) {
    if (ev.target && ev.target.id === 'chef-form') {
      ev.preventDefault();
      var ci = $('chef-input'), cq = ci ? ci.value : '';
      if (chef.status === 'busy' || !String(cq).trim()) return;
      if (ci) { ci.value = ''; ci.blur(); }
      chefSend(cq);
      return;
    }
    if (!ev.target || ev.target.id !== 'ask-form') return;
    ev.preventDefault();
    var input = $('ask-input'), q = input ? input.value : '';
    if (input) { input.value = ''; input.blur(); }
    ask(q);
  }

  /* ---- the 1-second tick ---- */
  var tickN = 0, downTicks = 0, lastTickAt = realNow();
  function wokeUp() { var t = realNow(), gap = t - lastTickAt; lastTickAt = t; if (preview && gap > 10 * MIN) exitPreview(); }
  function tick() {
    wokeUp();
    tickN++;
    downTicks = pointerDown ? downTicks + 1 : 0;
    if (downTicks > 5) { pointerDown = false; downTicks = 0; }      // a finger-up event that never arrived must not freeze the page
    var wasFree = shownMode === 'free';
    if (settleFocus()) {                        // free time is over, or it is time to go
      swapAt = realNow();
      if (wasFree && focusGet() && !preview) nudge = { since: realNow(), n: 0 };
      proj = null;
      render();
      refreshAlerts();
      runNudge();
      shownMode = nowMode();
      emit();
      return;
    }
    shownMode = nowMode();
    refreshAlerts();
    runNudge();
    if (!boardOn) {
      renderStatus();
      renderChips();
      updateCountdowns();
      if (!pointerDown && !scrollBusy) {
        if (cur.tab === 'now' && nowMode() === 'step') {
          var st = byId[focusGet()];
          renderActions(stepActions(st));
          if (tickN % 5 === 0) {
            var el = doc.querySelector('#view [data-role="next"]'), txt = nextLine(st);
            if (el && el.textContent !== txt) el.textContent = txt;
          }
        } else {
          var parts = viewParts();
          setHTML($('view'), parts.view);
          renderActions(parts.actions);
        }
        updateCountdowns();
      }
      updateMore();
    }
    emit();
  }
  function refreshAll() {
    wokeUp();
    proj = null; lastClock = ''; lastPill = '';
    settleFocus();
    render();
    refreshAlerts();
    emit();
  }

  /* ================================================================== 13. the contract for board.js, and test hooks */

  window.CookApp = {
    plan: PLAN,
    engine: E,
    getState: function () { return S(); },
    now: function () { return now(); },
    subscribe: function (fn) {
      if (typeof fn !== 'function') return function () {};
      subs.push(fn);
      return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    },
    act: act,
    fmt: { clock: clock, shortClock: shortClock, dur: dur, countdown: E.fmtCountdown, fmtClock: E.fmtClock, fmtDur: E.fmtDur, fmtCountdown: E.fmtCountdown, plain: plain, esc: esc },
    // extras the board may use
    getFocus: function () { return focusGet(); },
    getProjection: function () { return projection(); },
    getAlerts: function () { return activeAlerts(); },
    isPreview: function () { return !!preview; }
  };
  window.__cook = {
    get state() { return S(); },
    get now() { return now(); },
    plan: PLAN,
    engine: E,
    act: act,
    setClock: function (fn) { clockFn = typeof fn === 'function' ? fn : function () { return Date.now(); }; refreshAll(); },
    // extra hooks for the smoke test
    get real() { return state; },
    get focus() { return focusGet(); },
    get mode() { return nowMode(); },
    get preview() { return !!preview; },
    get undoDepth() { return stack().length; },
    get sync() { return sync.status; },
    debug: dbg,
    setGuard: function (ms) { guardMs = Number(ms) || 0; },
    tick: tick,
    buildPrompt: function (id, q) { return byId[id] ? buildPrompt(byId[id], q) : ''; }
  };

  /* ================================================================== 14. boot */

  if (freshState) writeJSON(ls(), KEY, state);              // pin the cook day the first time the guide is opened
  safe(function () {
    var problems = E.validate(PLAN);
    if (problems && problems.length && window.console && console.warn) console.warn('Plan problems:\n' + problems.join('\n'));
    return 0;
  }, 0);

  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', function (ev) { onGesture(); onKey(ev); });
  doc.addEventListener('submit', onSubmit);
  doc.addEventListener('pointerdown', function () { pointerDown = true; onGesture(); }, true);
  doc.addEventListener('touchstart', function () {}, { passive: true });   // iOS shows :active feedback only when this exists
  doc.addEventListener('touchend', onGesture, true);          // iOS only unlocks sound on these two
  doc.addEventListener('click', onGesture, true);
  doc.addEventListener('pointerup', function () { pointerDown = false; }, true);
  doc.addEventListener('pointercancel', function () { pointerDown = false; }, true);
  $('page').addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateMore);
  window.addEventListener('hashchange', route);
  window.addEventListener('focus', refreshAll);
  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'visible') { requestWake(); if (gestured) initAudio(); alarm = {}; refreshAll(); }
  });
  window.addEventListener('storage', function (ev) {         // the same guide open in another tab on this device
    if (ev.key !== KEY || !ev.newValue) return;
    var r = safe(function () { return JSON.parse(ev.newValue); }, null);
    if (validState(r) && (r.rev !== state.rev || r.updatedAt !== state.updatedAt) && (r.updatedAt || 0) >= (state.updatedAt || 0)) adopt(r);
  });
  window.addEventListener('load', function () { if (parseHash().tab === 'board' && !boardOn) route(); });

  settleFocus();
  route();
  refreshAlerts();
  setInterval(tick, 1000);

  useCap('tts').then(function (t) { caps.tts = t && typeof t.speak === 'function' ? t : null; patchReadButtons(); });
  useCap('sample').then(function (f) { caps.sample = typeof f === 'function' ? f : null; if (sheets.length && (sheets[sheets.length - 1].type === 'help' || sheets[sheets.length - 1].type === 'chef')) renderSheet(); });
  useCap('db').then(initSync);
})();
