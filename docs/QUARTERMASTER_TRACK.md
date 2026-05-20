# Quartermaster Track

Date: 2026-05-19
Owner context: Luke / Pantheon learning loop
Status: Active operating map

## ELI5

Quartermaster is the part of Pantheon that watches what happened when Luke used the app.

It should learn from real use, not guesses.

The goal is not to create a thousand tiny patches. The goal is to notice patterns:

- "Luke said grams, but the app showed serving."
- "One protein shake became two protein shakes."
- "The old protein shake identity came back from history."
- "This is not three different problems. This is one protein shake modeling problem."

Quartermaster should help Pantheon become a better student of Luke.

## The Big Loop

The mature loop is:

```text
Luke uses Pantheon normally.
Pantheon records the whole story.
Quartermaster audits what happened.
Quartermaster groups symptoms into themes.
Quartermaster recommends durable fixes.
The right lane fixes the problem.
The original phrase is replayed.
Metrics improve.
Doctrine updates.
The next cycle starts smarter.
```

## Anti-Drift Rule

Quartermaster must prefer durable learning over patch clutter.

Bad path:

```text
Add one alias.
Add another alias.
Add another alias.
Patch one phrase.
Patch another phrase.
The system gets dense, slow, and hard to reason about.
```

Good path:

```text
Find the shared cause.
Write the doctrine.
Fix the model.
Add narrow aliases only when they support the model.
Add regression tests from Luke's actual phrases.
```

Example:

```text
Bad: add twelve opaque protein shake aliases.
Good: model protein shake as protein powder quantity plus dextrose quantity.
```

## Track Legs

### Leg 0: Instrument Reality

Goal: capture what actually happened.

Quartermaster needs:

- what Luke said
- transcription text
- parser result
- displayed plate
- save success or failure
- edits
- deletes
- abandons
- disambiguation choices
- timing
- error messages
- saved final result

Plain English: "Did we record the whole story?"

Current grade: B-

Status: mostly live. Native telemetry and web event storage are deployed, and real phone events are flowing. Save-event coverage still needs confirmation and strengthening.

### Leg 1: Detect Concrete Failures

Goal: turn raw behavior into specific findings.

Examples:

- stale saved meal identity
- duplicate food row
- grams not preserved
- parse too slow
- LLM fallback used
- parse/save mismatch
- save failed
- user edited result
- user deleted result
- joke or non-food
- low-confidence saved item
- bad unit surface

Plain English: "Can Quartermaster point at what went wrong?"

Current grade: B

Status: active and useful. Quartermaster now detects duplicate food rows, stale refs, unit display failures, parse slowness, and several parse/save deltas.

### Leg 2: Group Symptoms Into Themes

Goal: stop treating every finding as a separate chore.

Theme examples:

- Protein Shake Composition Failure
- User Quantity Display Trust Failure
- Stale Library Identity Failure
- Generic Serving Unit Failure
- Slow Parse Due To Missing Staples
- Restaurant/Composite Meal Ambiguity
- Pantry Alias Overgrowth Risk

Plain English: "Are these ten problems actually one bigger lesson?"

Current grade: D

Status: not built yet. This is the next major Quartermaster layer.

### Leg 3: Assign Ownership Lanes

Goal: route work to the correct fix surface.

Lanes:

- Pantry Forge
- Parser
- Native UI
- Backend
- Saved Meal / Library Identity
- Data Repair
- Doctrine
- Human Review
- Ignore / Joke

Plain English: "Who should fix this?"

Current grade: C+

Status: partially built. Finding-level lanes exist. Theme-level lanes do not.

### Leg 4: Recommend Durable Fix Strategy

Goal: recommend the smallest robust change, not a pile of local patches.

Bad recommendation:

```text
Add 12 protein shake aliases.
```

Good recommendation:

```text
Model protein shake as ingredient composition:
Isopure protein quantity plus NutriCost dextrose quantity.
Then add shortcut aliases only for common defaults.
```

Plain English: "What is the clean fix?"

Current grade: D+

Status: mostly still human/Codex reasoning. Quartermaster does not yet synthesize durable strategy by itself.

### Leg 5: Generate Repair Packets

Goal: produce work packets that are specific enough to execute.

A good repair packet includes:

- root cause
- affected examples
- proposed fix
- likely files or data areas
- risk level
- regression tests
- "do not do this" guidance
- expected improvement metric

Plain English: "Can someone pick this up and fix it?"

Current grade: C-

Status: early. Work packets exist, but they are still too shallow.

### Leg 6: Execute Or Delegate Repairs

Goal: Quartermaster becomes the dispatcher.

It should decide:

- this goes to Pantry Forge
- this goes to parser code
- this goes to native UI
- this goes to backend
- this needs human confirmation
- this should be ignored
- this should become doctrine

Plain English: "Can Quartermaster manage the work instead of just describing it?"

Current grade: D

Status: not really built. Codex is still doing most routing manually.

### Leg 7: Verify The Repair

Goal: every fix gets tested against original evidence.

For each repair:

- replay the original phrase
- confirm displayed result
- confirm saved result
- confirm telemetry
- confirm the old failure packet disappears
- add regression coverage where possible

Plain English: "Did the fix actually fix Luke's problem?"

Current grade: C

Status: partially possible. We have parser tests, Quartermaster dry runs, and Maestro, but not a full closed-loop verifier.

### Leg 8: Learn Memory / Doctrine

Goal: repeated lessons become standing rules.

Doctrine examples:

- User-spoken quantity is display truth.
- Protein shake is ingredient composition, not an opaque saved meal.
- Brand does not matter when macros are equivalent within tolerance.
- Do not auto-approve composite/recipe foods into product pantry.
- Do not turn every symptom into a new alias.
- Historical deleted identities must not be emitted as live refs.

Plain English: "What should Pantheon remember forever?"

Current grade: D+

Status: mostly in chat/docs. Needs more machine-readable doctrine.

### Leg 9: Measure Improvement Over Time

Goal: know whether Pantheon is actually getting better.

Metrics:

- parse success rate
- save success rate
- edit/delete rate
- abandon rate
- average parse latency
- LLM fallback rate
- repeated failure count
- duplicate row rate
- unit preservation rate
- stale identity rate
- accepted-unchanged rate
- top recurring themes

Plain English: "Are we improving or just moving stuff around?"

Current grade: C-

Status: early scoreboard exists. Longitudinal trend tracking is not mature yet.

### Leg 10: Self-Improving Pantry/Product Loop

Goal: Quartermaster drives Pantry Forge.

Quartermaster should say:

- add these products
- add these aliases
- add these unit conversions
- reject these bad matches
- genericize these equivalent foods
- do not add these because they are jokes, composites, brands, or outliers
- rerun these phrases afterward

Plain English: "Can real app use tell Pantry Forge what to build next?"

Current grade: C

Status: partially manual. Pantry Forge and Quartermaster both exist, but they are not tightly joined.

### Leg 11: Multi-Agent Coordination

Goal: Quartermaster becomes the work manager.

Possible agents:

- Pantry agent: products, aliases, units, rejections
- Parser agent: segmentation, scoring, guards
- Native agent: display and edit flow
- Backend agent: save/reference problems
- Review agent: ambiguous evidence

Plain English: "Can Quartermaster coordinate the team?"

Current grade: F

Status: conceptual only.

### Leg 12: Full Learning Machine

Goal: Pantheon improves from Luke using it.

Plain English: "Pantheon gets smarter because Luke lives in it."

Completion means:

- Quartermaster captures every meaningful interaction.
- It grades failures and successes.
- It groups symptoms into themes.
- It recommends durable fixes.
- It routes work to the right lane.
- Repairs are verified against original evidence.
- Doctrine updates.
- Metrics improve across cycles.

Current grade: D+

Status: foundation exists, but the full machine is not there yet.

## Current Track Position

Current leg: Leg 1 complete enough to move forward.

Next leg: Leg 2 - Group Symptoms Into Themes.

Overall maturity: D+

Main risk: fixing symptoms one by one instead of teaching the system.

Next move: implement Quartermaster Themes v1.

## Progress Footer Contract

At the end of every substantial Quartermaster generation, Codex should include one final line using this exact shape:

```text
Quartermaster Track: Leg X - <leg name> | Grade: <grade> | Plain English: <what just changed> | Next: <next checkpoint>
```

Examples:

```text
Quartermaster Track: Leg 2 - Group Symptoms Into Themes | Grade: D -> C- | Plain English: Quartermaster learned to group separate problems into bigger lessons. | Next: make those themes easier to judge.
```

```text
Quartermaster Track: Leg 5 - Generate Repair Packets | Grade: C -> C+ | Plain English: Quartermaster can now turn the biggest lesson into a concrete fix plan. | Next: add cycle memory before executing the protein shake plan.
```

Plain English should avoid internal shorthand. For example:

```text
Bad: connected themes to strongest repair packets.
Good: Quartermaster can now pick the most important problem and show the exact fixes attached to it.
```

## Grade Key

```text
A  = strong, reliable, and ready to depend on
B  = useful and working, but still has known gaps
C  = partly working; good enough for guided use, not autonomous
D  = concept exists, but the machine cannot really do it yet
F  = not built
```

## Color Key

```text
GREEN  = dependable enough to build on
YELLOW = useful but needs supervision
RED    = missing or risky
```

Current color map:

```text
GREEN:  none yet
YELLOW: Legs 0, 1, 3, 5, 7, 9, 10
RED:    Legs 2, 4, 6, 8, 11, 12
```

Quartermaster Track: Leg 5 - Generate Repair Packets | Grade: C+ | Plain English: Quartermaster can now pick the most important problem and show the exact fixes attached to it. | Next: add cycle memory before executing the protein shake plan
