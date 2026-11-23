// Chat-side helper for the guide's saved day (the artifact database document cook/state).
// It lets someone outside the page read where the cook is, and mark a step done for him.
//
//   node dev/remote.js show <state.json>                 where he is, what is next, timers, projected dinner
//   node dev/remote.js done <state.json> <stepId>        prints the new state JSON with that step completed now
//   node dev/remote.js steps <state.json>                every step still open, in planned order
//
// <state.json> is the document as saved by the page (fields v, day, anchors, done, waits, rev, updatedAt, device).
// Times are wall-clock times in the cook's time zone. Set it before any date is read:
process.env.TZ = process.env.COOK_TZ || 'America/Los_Angeles';

const fs = require('fs');
const path = require('path');
const P = require(path.join(__dirname, '..', 'plan.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

const [cmd, file, arg] = process.argv.slice(2);
if (!cmd || !file) { console.error('usage: node dev/remote.js show|done|steps <state.json> [stepId]'); process.exit(2); }
let state = JSON.parse(fs.readFileSync(file, 'utf8'));
if (state.data && state.data.v) state = state.data;            // a document saved with its envelope
const now = process.env.COOK_NOW ? new Date(process.env.COOK_NOW).getTime() : Date.now();
const title = id => { const s = E.stepById(P, id); return s ? s.title : id; };

if (cmd === 'show') {
  const pr = E.progress(P, state), proj = E.project(P, state, now), st = E.pick(P, state, now), un = E.nextUnlock(P, state, now);
  console.log('Now: ' + E.fmtClock(now) + ' | cook day ' + state.day + ' | place: ' + E.location(P, state) + ' | done ' + pr.done + ' of ' + pr.total);
  console.log('Next step: ' + (st ? st.id + ' — ' + st.title : 'nothing right now'));
  if (!st && un) console.log('Free until ' + E.fmtClock(un.at) + ', then: ' + title(un.stepId));
  E.waitsView(P, state, now).forEach(w => console.log('Timer: ' + w.label + (w.elapsed ? ' — READY' : ' — ' + E.fmtCountdown(w.remainingMs) + ' left (ends ' + E.fmtClock(w.endsAt) + ')')));
  E.alerts(P, state, now).forEach(a => console.log('Alert: ' + a.title));
  console.log('Dinner: ' + (proj.dinnerAt ? E.fmtClock(proj.dinnerAt) : '?') + (proj.lateMin > 0 ? ' (' + proj.lateMin + ' min late)' : ' (on time)'));
  proj.warnings.forEach(w => console.log('Plan note: ' + w.text));
} else if (cmd === 'steps') {
  E.project(P, state, now).rows.filter(r => r.type === 'step' && r.status !== 'done').forEach(r => console.log(E.fmtClock(r.start) + '  ' + r.stepId + ' — ' + title(r.stepId)));
} else if (cmd === 'done') {
  const step = E.stepById(P, arg);
  if (!step) { console.error('unknown step id: ' + arg); process.exit(2); }
  const payload = step.kind === 'choice' ? { value: step.choice.options[0].value } : undefined;
  const next = E.complete(P, state, arg, now, payload);
  if (next === state) { console.error('nothing changed (already done, or not possible)'); process.exit(1); }
  console.log(JSON.stringify(Object.assign({}, next, { device: 'chat' })));
} else { console.error('unknown command: ' + cmd); process.exit(2); }
