// Prints the projected day from the real plan: node ceviche-night/app/dev/print-day.js [soaked|nosoak] [startHH:MM]
// Uses the cook day 2026-11-23 in the machine's local timezone.
const E = require('../engine.js');
const P = require('../plan.js');
const mode = process.argv[2] || 'soaked';
const startArg = process.argv[3];
const day0 = new Date(2026, 10, 23, 0, 0, 0).getTime();
let now = day0 + 6 * 3600e3 + 55 * 60e3;           // 6:55 AM on the cook day
let st = E.initialState(P, 'print-day', now);
st = E.setOpt(P, st, 'soaked', mode !== 'nosoak', now);
if (startArg) { const [h, m] = startArg.split(':').map(Number); now = day0 + h * 3600e3 + m * 60e3; }
const pr = E.project(P, st, now);
const byId = Object.fromEntries(P.steps.map(s => [s.id, s]));
let lastLoc = null;
for (const r of pr.rows) {
  if (r.loc && r.loc !== lastLoc) { console.log('\n== ' + r.loc + ' =='); lastLoc = r.loc; }
  if (r.type === 'step') {
    const s = byId[r.stepId];
    const dur = Math.round((r.end - r.start) / 6000) / 10;
    console.log(`${E.fmtClock(r.start).padStart(8)}  ${String(dur).padStart(5)}m  [${s.dish.padEnd(6)}] ${s.title}${r.deferred ? '  (DEFERRED)' : ''}${r.late ? '  (LATE)' : ''}`);
  } else if (r.type === 'wait') {
    console.log(`${' '.repeat(8)}          ~ ${r.label}: ${E.fmtClock(r.start)} to ${E.fmtClock(r.end)}`);
  } else if (r.type === 'free') {
    console.log(`${E.fmtClock(r.start).padStart(8)}          -- free until ${E.fmtClock(r.end)} (${Math.round((r.end - r.start) / 60000)} min)`);
  } else if (r.type === 'move') {
    console.log(`${E.fmtClock(r.at).padStart(8)}          >> ${byId[r.stepId].title}`);
  }
}
console.log('\nDinner projected:', E.fmtClock(pr.dinnerAt), '| late by', pr.lateMin, 'min | spare', pr.spareMin, 'min');
console.log('Warnings:', pr.warnings.length ? pr.warnings.map(w => w.code + ': ' + w.text).join(' | ') : 'none');
