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

Current overall position: **Leg 5 - Generate Repair Packets**.

Current grade: **C+**.

Plain English: Quartermaster can now group real app failures into larger
lessons and produce repair packets, but it still needs stronger closed-loop
execution, verification, and trend memory before it can be trusted as an
autonomous manager.

## Legs

### Leg 0: Instrument Reality

Goal: capture what actually happened.

Grade: B-

Status: real events exist and phone telemetry is flowing, but save-event and
edit-event coverage still need hardening.

### Leg 1: Detect Concrete Failures

Goal: turn raw behavior into findings.

Grade: B+

Status: detects stale refs, duplicate rows, unit display failures, slow parses,
parse/save deltas, save failures, and identity fractures.

### Leg 2: Group Symptoms Into Themes

Goal: stop treating every finding as a separate chore.

Grade: C

Status: themes exist and are useful. They still need better severity tuning and
subtheme splitting when a theme is too broad.

### Leg 3: Assign Ownership Lanes

Goal: route work to the right surface.

Grade: C+

Status: finding and packet lanes exist. Theme-level ownership is useful but
still needs sharper routing.

### Leg 4: Recommend Durable Fix Strategy

Goal: recommend the smallest robust change, not a pile of patches.

Grade: C

Status: durable-fix language exists for themes, but some product judgment still
lives in Codex/docs instead of the machine.

### Leg 5: Generate Repair Packets

Goal: produce work packets specific enough to execute.

Grade: C+

Status: work packets and top theme execution plans exist. Theme plans now carry
grouping scope, execution mode, safety gates, allowed actions, and blocked
actions.

### Leg 6: Execute Or Delegate Repairs

Goal: Quartermaster becomes the dispatcher.

Grade: D+

Status: Codex can execute from Quartermaster output, but Quartermaster is not
yet managing agents or automatically opening safe work lanes.

### Leg 7: Verify The Repair

Goal: every fix gets tested against original evidence.

Grade: C

Status: parser tests, dry runs, and some app replay are possible. The full
app-to-data closed loop is not mature yet.

### Leg 8: Learn Memory / Doctrine

Goal: repeated lessons become standing rules.

Grade: C-

Status: doctrine exists in docs and theme plans. More of it should become
machine-readable and regression-backed.

### Leg 9: Measure Improvement Over Time

Goal: know whether Pantheon is actually getting better.

Grade: C-

Status: scoreboards and cycle memory exist. Longitudinal trend reporting is
still early.

### Leg 10: Self-Improving Pantry/Product Loop

Goal: Quartermaster drives Pantry Forge.

Grade: C

Status: Pantry Forge and Quartermaster both exist, but their handoff is still
partly manual.

### Leg 11: Multi-Agent Coordination

Goal: Quartermaster becomes the work manager.

Grade: F

Status: conceptual only.

### Leg 12: Full Learning Machine

Goal: Pantheon improves from Luke using it.

Grade: D+

Status: the foundation is real, but the full machine is not there yet.

## Footer Contract

At the end of every substantial Quartermaster generation, Codex should include
one final line using this exact shape:

```text
Quartermaster Track: Leg X - <leg name> | Grade: <grade> | Plain English: <what just changed> | Next: <next checkpoint>
```

The footer should report the real overall track position, not merely the
technical layer touched during the last code change.
