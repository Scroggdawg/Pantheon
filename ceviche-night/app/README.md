# Ceviche Night cooking guide

A one-page web app, published as a claude.ai Artifact. It is not part of the Pantheon web build.

- Published at: https://claude.ai/artifact/XJvWRiuBgFtWZZ4iJqEnAd (private to the owner)
- Capabilities declared at publish: `db`, `sample`, `tts`

## Files

- `plan.js`: every dish, step, timer, pack list, container and glossary term, as data. Edit recipes and wording here.
- `engine.js`: pure scheduling and state functions. The header comment is the API.
- `index.html` + `app.js`: the phone guide (tabs Now, Day, Dishes, Setup).
- `board.js`: a rough big-screen layout at `#board`.
- `dev/`: tests and tools.

## After any change

Run all of these from the repository root. They must all pass.

- `node --test ceviche-night/app/engine.test.js ceviche-night/app/dev/engine.adversary-sched.test.js ceviche-night/app/dev/engine.adversary-state.test.js`
- `node ceviche-night/app/dev/check-plan.js`
- `node ceviche-night/app/dev/print-day.js soaked` and `node ceviche-night/app/dev/print-day.js nosoak` (both end "late by 0 min")
- `node ceviche-night/app/dev/smoke.js` (phone guide, end to end)
- `node ceviche-night/app/dev/board-shots.js` (board layout)
- `node ceviche-night/app/dev/make-docs.js` (regenerates `../run-sheet.pdf`, `../run-sheet.html` and the markdown schedules from the data; never edit those by hand)

Then publish `index.html` with the Artifact tool, with `plan.js`, `engine.js`, `app.js` and `board.js` as supporting files.

## Saved progress

- On the phone: `localStorage` key `cevicheNight.v1`.
- Online copy: artifact database document `cook/state` (the same JSON). A phone that lost its storage restores from it.
- `node ceviche-night/app/dev/remote.js show <state.json>` reads a saved day from outside the page (where the cook is, timers, what is next).
- Tapping through the published page leaves a `cook/state` document for that day. Delete it after testing, or the next phone adopts it.

## Known limits

- Never run on a real iPhone before its first use. Alarms only sound while the page is open and the screen is on.
- Two devices tapping at the same time can overwrite each other. Tap on one device.
- The plan assumes each step takes its planned minutes. It re-times after every tap, not in between.
