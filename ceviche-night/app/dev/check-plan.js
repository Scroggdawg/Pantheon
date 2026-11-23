// Static consistency check for plan.js (no engine needed): node ceviche-night/app/dev/check-plan.js
const P = require('../plan.js');
const errs = [];
const ids = new Set(); const idx = {};
P.steps.forEach((s, i) => { if (ids.has(s.id)) errs.push('duplicate step id ' + s.id); ids.add(s.id); idx[s.id] = i; });
const waits = {};
P.steps.forEach(s => { if (s.wait) { if (waits[s.wait.id]) errs.push('duplicate wait id ' + s.wait.id); waits[s.wait.id] = s.id; } });
const dishes = new Set(P.dishes.map(d => d.id).concat(['day']));
const gl = new Set(Object.keys(P.glossary));
const used = new Set();
const scan = (t, where) => {
  (String(t).match(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g) || []).forEach(m => {
    const k = m.slice(2).split(/[|\]]/)[0]; used.add(k);
    if (!gl.has(k)) errs.push('glossary key missing: ' + k + ' (in ' + where + ')');
  });
};
P.steps.forEach((s, i) => {
  if (!s.title || !Array.isArray(s.body)) errs.push('missing title/body: ' + s.id);
  if (typeof s.mins !== 'number') errs.push('missing mins: ' + s.id);
  if (!['home', 'hers', 'either'].includes(s.where)) errs.push('bad where: ' + s.id);
  if (!dishes.has(s.dish)) errs.push('unknown dish ' + s.dish + ' in ' + s.id);
  (s.after || []).forEach(a => {
    if (!ids.has(a)) errs.push('after: unknown ' + a + ' in ' + s.id);
    else if (idx[a] > i) errs.push('after: ' + a + ' comes LATER in the array than ' + s.id);
  });
  if (s.afterWait && !waits[s.afterWait]) errs.push('afterWait not armed by any step: ' + s.afterWait + ' in ' + s.id);
  if (s.afterWait && idx[waits[s.afterWait]] > i) errs.push('wait ' + s.afterWait + ' is armed later than ' + s.id);
  (s.body || []).forEach(b => scan(b, s.id));
  ['look', 'tip', 'warn'].forEach(k => s[k] && scan(s[k], s.id));
  if (/\[\[/.test(s.title)) errs.push('glossary markup in title: ' + s.id);
  (s.need || []).forEach(n => { if (/\[\[/.test(n)) errs.push('glossary markup in need: ' + s.id); });
  if (/\b(Tbsp|tbsp|tsp|Tsp)\b/.test(JSON.stringify(s))) errs.push('abbreviated unit (spell it out): ' + s.id);
  if (s.kind === 'check' && (!s.check || !s.afterWait)) errs.push('check step needs check + afterWait: ' + s.id);
  if (s.kind === 'choice' && !s.choice) errs.push('choice step needs choice: ' + s.id);
  if (s.kind === 'checklist' && !s.items) errs.push('checklist step needs items: ' + s.id);
  if (s.kind === 'move' && !s.move) errs.push('move step needs move: ' + s.id);
  if (s.notBefore && !(s.notBefore.anchor in P.anchors)) errs.push('notBefore anchor unknown: ' + s.id);
});
(P.tonight || []).forEach(t => t.body.forEach(b => scan(b, t.id)));
for (const k of ['cooler', 'bag', 'gear']) {
  const seen = new Set();
  P.pack[k].forEach(it => {
    if (seen.has(it.id)) errs.push('duplicate pack id ' + it.id); seen.add(it.id);
    ['ifDone', 'ifNotDone'].forEach(c => { if (it[c] && !ids.has(it[c])) errs.push('pack item ' + it.id + ' references unknown step ' + it[c]); });
  });
}
(P.rules || []).forEach(r => ['on', 'ifDone', 'ifNotDone'].forEach(c => { if (r[c] && !ids.has(r[c])) errs.push('rule references unknown step ' + r[c]); }));
['leaveAm', 'backHome', 'leavePm', 'arrive'].forEach(m => {
  const n = P.steps.filter(s => s.kind === 'move' && s.move === m).length;
  if (n !== 1) errs.push('expected exactly one move step for ' + m + ', found ' + n);
});
if (P.steps[P.steps.length - 1].id !== 'dinner') errs.push('last step must be dinner');
const unused = [...gl].filter(k => !used.has(k));
console.log('steps:', P.steps.length, '| waits:', Object.keys(waits).length, '| glossary:', gl.size, '| unused glossary:', unused.join(', ') || 'none');
if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
console.log('plan.js OK');
