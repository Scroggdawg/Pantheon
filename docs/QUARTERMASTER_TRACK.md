# Quartermaster Track

Date: 2026-05-19
Owner context: Luke / Pantheon learning loop
Status: Active operating map

## ELI5

Quartermaster watches what happened when Luke used Pantheon.

It should learn from real use, not guesses. The goal is not to create a
thousand tiny patches. The goal is to notice patterns, fix the shared cause, and
then replay the original phrase to prove the fix worked.

## Anti-Drift Rule

Quartermaster must prefer durable learning over patch clutter.

Bad path:

```text
Add one alias.
Add another alias.
Patch one phrase.
The system gets dense and hard to reason about.
```

Good path:

```text
Find the shared cause.
Write the doctrine.
Fix the model.
Add narrow aliases only when they support the model.
Add regression tests from Luke's actual phrases.
```

The operating rule is:

```text
Group boldly. Execute narrowly.
```

## Identity And Measurement Doctrine

Quartermaster must treat every food log as five connected layers:

```text
user words -> canonical identity -> quantity/unit -> displayed trust surface -> saved evidence
```

The layers should not collapse into each other.

- A quantity is not a new food.
- A serving count is not a new favorite.
- A saved history row is not automatically a canonical identity.
- A heart belongs to the canonical food identity when one exists.
- A display name can change without changing the food.
- User-visible quantity should preserve what Luke said whenever possible.

Plain English: if Luke hearts a Yasso bar, then `one Yasso bar`, `two Yasso
bars`, and a slightly different product display name should still feel like the
same hearted food when they point at the same product. Pantheon can multiply the
macros for the quantity, but it should not create a separate favorite identity
for every count.

Quartermaster should flag violations as identity fractures, not just unit bugs:

- same product source_ref appears with multiple favorite wrappers
- a product-backed favorite appears unhearted after a quantity change
- logged quantity changes create new saved meals instead of preserving source_ref
- history emits `lib:saved_meal:*` when a cleaner `lib:product:*` identity exists
- display quantity differs from spoken quantity even when macros are close

## Current Track Position

Quartermaster is not moving through the track like a strict staircase. It is a
machine with layers. Later work can strengthen earlier legs.

Current overall position: **Leg 9 - Measure Improvement Over Time**.

Current grade: **B+ checkpoint**.

Plain English: Quartermaster can now ingest real app telemetry, compare against
cycle memory, classify outcomes, avoid counting deleted/test save events as
clean wins, distinguish likely user quantity corrections from parser failures,
and tell us whether the current loop is blocked, active, or checkpoint-ready.
It is not the full autonomous manager yet, but it is at a real stopping point
for the current Quartermaster buildout.

## Legs

### Leg 0: Instrument Reality

Goal: capture what actually happened.

Grade: B-

Status: real events exist and phone telemetry is flowing. Save events are now
audited against visible food log rows so deleted/test saves do not inflate
clean-success metrics. Edit-event coverage still depends on the native client
emitting enough detail.

### Leg 1: Detect Concrete Failures

Goal: turn raw behavior into findings.

Grade: A-

Status: detects stale refs, duplicate rows, unit display failures, slow parses,
parse/save deltas, save failures, identity fractures, orphan save events, and
likely user quantity corrections.

### Leg 2: Group Symptoms Into Themes

Goal: stop treating every finding as a separate chore.

Grade: B

Status: themes exist and are useful. Orphan/deleted save events stay in
telemetry/observability instead of being over-grouped into food-specific
doctrine just because the transcript mentions a food.

### Leg 3: Assign Ownership Lanes

Goal: route work to the right surface.

Grade: B-

Status: finding and packet lanes exist. Theme-level ownership is useful and now
keeps likely user corrections in review/watch rather than routing them straight
to parser or pantry mutation.

### Leg 4: Recommend Durable Fix Strategy

Goal: recommend the smallest robust change, not a pile of patches.

Grade: B-

Status: durable-fix language exists for themes, but some product judgment still
lives in Codex/docs instead of the machine. The machine now carries more
doctrine for quantity corrections, orphan save events, and checkpoint readiness.

### Leg 5: Generate Repair Packets

Goal: produce work packets specific enough to execute.

Grade: B

Status: work packets and top theme execution plans exist. Theme plans now carry
grouping scope, execution mode, safety gates, allowed actions, and blocked
actions. Runs also include readiness status and next-best-step guidance.

### Leg 6: Execute Or Delegate Repairs

Goal: Quartermaster becomes the dispatcher.

Grade: C+

Status: Codex can execute from Quartermaster output, but Quartermaster is not
yet managing agents or automatically opening safe work lanes. It can now tell
whether current packets are emergency, active repair, or checkpoint/watch.

### Leg 7: Verify The Repair

Goal: every fix gets tested against original evidence.

Grade: B

Status: parser tests, dry runs, and app replay are possible. The exact protein
shake + sweet potato phrase was replayed through native parse and save, and the
test row was cleaned up. Quartermaster now handles the leftover orphan event
honestly.

### Leg 8: Learn Memory / Doctrine

Goal: repeated lessons become standing rules.

Grade: B-

Status: doctrine exists in docs and theme plans, and more of it is now
machine-readable: group boldly/execute narrowly, preserve Luke-spoken units,
do not count orphan saves as clean wins, and do not panic-patch cleanly scaled
user quantity corrections.

### Leg 9: Measure Improvement Over Time

Goal: know whether Pantheon is actually getting better.

Grade: B

Status: scoreboards, cycle memory, visible save metrics, orphan save metrics,
and readiness assessment exist. Longitudinal trend reporting is still early,
but the loop can now say whether this run is checkpoint-ready.

### Leg 10: Self-Improving Pantry/Product Loop

Goal: Quartermaster drives Pantry Forge.

Grade: C+

Status: Pantry Forge and Quartermaster both exist, but their handoff is still
partly manual. Current run leaves only P3 pantry/watch items, not blocking
repairs.

### Leg 11: Multi-Agent Coordination

Goal: Quartermaster becomes the work manager.

Grade: C

Status: first coordination lane exists. The barcode scanner thread exchanged a
handoff, and the scanner product-identity/release boundary is documented.

### Leg 12: Full Learning Machine

Goal: Pantheon improves from Luke using it.

Grade: C+

Status: the foundation is real and checkpoint-ready for the current buildout.
The full machine still needs richer native edit telemetry, scanner telemetry,
agent dispatch, and Pantry Forge execution loops.

## Footer Contract

At the end of every substantial Quartermaster generation, Codex should include
one final line using this exact shape:

```text
Quartermaster Track: Leg X - <leg name> | Grade: <grade> | Plain English: <what just changed> | Next: <next checkpoint>
```

The footer should report the real overall track position, not merely the
technical layer touched during the last code change.
