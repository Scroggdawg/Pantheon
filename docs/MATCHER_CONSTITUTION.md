# Pantheon Matcher Constitution

Date: 2026-05-12
Status: Living doctrine. This document is binding for matcher and parse-pipeline work unless a future change explicitly updates it with evidence.
Scope: Web matcher, parse-meal library shortcut, segmented shortcut, pantry/library identity, and the downstream native experience across Pantheon, Provisions, and Progress.

## 1. Mission

Pantheon's matcher exists to make food logging elite: streamlined, lightning fast, and dead accurate.

Speed is not allowed to come from guessing. Accuracy is not allowed to come from making the user do extra work forever. The target system should feel like this:

- Pantheon logs what Luke actually ate with minimal friction.
- Provisions plans, prepares, and reuses known meals without corrupting live logging identities.
- Progress judges trends, adherence, and outcomes from clean data, not from parser artifacts.

The matcher is therefore not just a search helper. It is the identity layer for the whole app.

## 2. Core Principle

Every matched food must have one of two statuses:

1. A durable canonical identity: a saved meal, product, recipe, barcode product, or future pantry row the app can safely reuse.
2. A temporary observation: a recent/hourly/user-uttered food that can help ranking but must not pretend to be canonical.

Temporary observations may influence search order. They may not become the final identity when a durable canonical match exists.

## 3. Current Hourly Go-To Read

As of the 2026-05-12 read-only probe, `hourly_go_tos` is useful but downgraded.

Current-hour snapshot:

- `68` hourly rows for Luke at the current UTC hour.
- `8` rows had canonical-backed `lib:saved_meal:*` or `lib:product:*` source refs.
- `45` rows had `null` source refs.
- `15` rows had external or non-library source refs.

Focused probe examples:

- `banana` resolves to canonical product `Bananas`, not hourly.
- `3 eggs`, `double espresso`, and `McDonald's sausage burrito` resolve to saved meals.
- `mild Italian sausage`, `basmati rice, cooked`, and `T-bone steak` resolve through `hourly_go_to` because no stronger canonical identity currently wins.

Conclusion: `hourly_go_tos` is currently most effective as a coverage fallback for previously logged ad hoc foods. It is not effective enough to be a trusted primary identity layer. It should remain a ranking and recall signal until the pantry/product/saved-meal/recipe layers are broad enough to absorb most of its job.

## 4. Top-Level Invariants

These are the laws future matcher changes must preserve.

### Identity Invariants

1. Canonical identities beat temporary observations.
2. `hourly_go_to` rows are ranking signals, not durable food identities.
3. If an `hourly_go_to` row points to a canonical `lib:*` source ref, the canonical survives.
4. If an `hourly_go_to` row has the same normalized name as a canonical, the canonical survives unless there is a documented reason to expose ambiguity.
5. Parser output written to `food_log_entries.foods_json[].source_ref` should be canonical when a canonical is known. Do not persist derived `lib:hourly_go_to:*` wrapper IDs as final food identity.
6. Products, saved meals, recipes, barcode products, and future pantry rows must have deterministic priority rules when they collide.

### Accuracy Invariants

7. A shortcut may only fire when the top match clears both score and gap thresholds.
8. Ambiguity is better than confident wrongness. If two plausible canonicals are too close, return candidates or fall through.
9. Generic requests like `coffee`, `water`, `orange`, or `lime` must not resolve to branded/specialty products unless the utterance contains enough identity-bearing detail.
10. Matching-side normalization may remove filler, quantity, and unit tokens, but it must preserve food identity tokens.
11. Brand and voice aliases are product decisions when they change meaning, especially alcohol, restaurant, branded, or regional names.
12. Do not lower global thresholds to fix one example. Prefer scoped normalization, data coverage, or candidate UI.

### Speed Invariants

13. Fast paths must remain fast because they do less work, not because they accept worse evidence.
14. Multi-item utterances should resolve known segments locally and send only unknown segments to the LLM.
15. Per-parse full-table reads are acceptable only at Luke's current single-user scale. Any growth toward a larger library requires indexed filtering, caching, or a dedicated search layer.
16. Response cache behavior must never lock in known-bad parser artifacts.

### Data Invariants

17. Historical food logs are evidence, not doctrine. They can teach the matcher, but they can also contain stale parser bugs.
18. User-corrected values outrank machine-estimated values for the same food/unit.
19. The system should learn from explicit user action: hearts, edits, barcode scans, recipe saves, and portion corrections are stronger signals than passive parse output.
20. Progress and scoring should consume stable canonical data whenever possible; scoring should not depend on temporary matcher artifacts.

## 5. Whole-App Architecture Lens

Matcher work must be evaluated against the future complete app, not just the current log-food screen.

### Pantheon

Pantheon is the live daily surface. It needs near-instant logging, reliable totals, editable per-food cards, and clear recovery when the parser is unsure.

Matcher implication: optimize for fast correct first pass, then clean per-food edit recovery.

### Provisions

Provisions is the planning and preparation surface. It will eventually handle meal plans, recipes, pantry entries, batch cooking, and reusable structures.

Matcher implication: do not let ad hoc log history pollute planned-food identity. Recipes and planned meals need canonical IDs and portion math, not hourly wrappers.

### Progress

Progress is the truth surface. It will eventually compute adherence, trends, Greek God Score, streaks, weight response, training alignment, and macro quality.

Matcher implication: Progress cannot be better than the food identities underneath it. Parser shortcuts that save 2 seconds but create dirty source refs are unacceptable.

## 6. How Future Matcher Changes Must Be Made

Every future matcher change should fit one of these categories:

- Canonicalization: makes two representations of the same food collapse into one identity.
- Normalization: makes user speech match canonical names without changing meaning.
- Coverage: adds missing food data so the matcher no longer has to infer.
- Ranking: changes order among known candidates without changing identity.
- Recovery: improves how ambiguity or uncertainty reaches the user.

Before adding another dedup pass, ask:

1. Which invariant is currently failing?
2. Is this a code problem, a data coverage problem, or a product decision?
3. Can this be fixed by improving one helper instead of adding a new pass?
4. Can this be tested with a small invariant test?
5. Does this help the future Pantheon + Provisions + Progress system, or only today's isolated example?

## 7. Required Test Discipline

Replay is necessary but not sufficient.

Replay answers: did real Pantheon examples improve?

Invariant tests answer: did the matcher still obey its laws?

Future matcher work should add or update helper-level tests for the law it touches. Minimum test families:

- Canonical beats hourly for same source ref.
- Canonical beats hourly for same normalized name.
- Hourly can survive only when no canonical identity exists.
- Singular/plural food variants collapse conservatively.
- Generic one-word queries do not overmatch branded products.
- Restaurant context normalization preserves intended identities.
- Relaxed segment matching removes quantity/filler words but keeps food identity words.
- Ambiguous same-score canonicals remain candidates or fall through.
- Brand aliases do not silently change product meaning.

## 8. Current Audit Follow-Ups

Claude's S28 audit is accepted. The follow-up cleanup queue is:

1. Done — add this constitution.
2. Done — add matcher invariant/helper tests before the next matcher rule stack grows.
3. Done — remove duplicate `3 eggs and a banana` segmented replay case.
4. Done — update stale M6 comments that still describe tier-priority when behavior is now identity-priority.
5. Done — fence `scripts/verify-alpha6-d.ts`, because it temporarily mutates production `saved_meals.is_favorite` even though it reverts.
6. Revisit `loadRuntimeCompositeNames` cost before library scale grows materially.
7. Keep M8's broadening behavior Yellow until the risky alias/product-call pieces are resolved.

## 9. Decision Rule

The matcher is allowed to become more sophisticated, but not more mysterious.

If a future fix makes the system harder to reason about, it must pay that debt immediately with one of:

- a clearer invariant,
- a named helper,
- a focused test,
- or a deletion of older complexity it replaces.

No more stacking one more pass forever.
