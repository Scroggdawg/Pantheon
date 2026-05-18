# Pantheon S28 Quartermaster V0 Audit 1

Date: 2026-05-18
Status: Quartermaster v0 read-only audit implemented and first full-history report generated.

## Summary

Quartermaster v0 now exists as a read-only script:

```bash
npm run quartermaster
```

It reads all visible `food_log_entries` rows by default, compares parsed foods to saved foods when both are available, checks parser telemetry, detects stale source refs, and emits local JSON/markdown reports under `scripts/output/`.

The first full-history run read every visible saved food log:

- rows read: 49
- rows with raw input: 40
- rows with parse foods: 38
- rows with saved foods: 49
- parse-vs-save comparable rows: 38
- likely accepted unchanged rows: 30
- live saved meals: 6
- live products: 227
- deduped findings: 195

Latest report files:

- `scripts/output/quartermaster-cf7b19e4-b5ec-44fb-b114-cf9f7f189f71.json`
- `scripts/output/quartermaster-cf7b19e4-b5ec-44fb-b114-cf9f7f189f71.md`

These output files are local artifacts and should usually remain ignored.

## Parser Path Picture

From the first audit:

- missing telemetry: 33
- LLM fallback: 11
- library shortcut: 3
- library candidates: 1
- library segmented partial: 1

This confirms that older rows lack telemetry and that many newer non-shortcut parses still hit the expensive LLM path.

## Major Findings

Top finding classes:

- unit missing or weak: 98
- telemetry gap: 24
- database-estimated saved: 15
- LLM fallback expensive: 11
- parse saved calorie delta: 9
- slow parse: 9
- parse saved quantity changed: 7
- parse saved name changed: 5
- chained source ref: 5
- low confidence saved: 4
- parse saved unit changed: 3
- stale source ref: 2
- parse saved food-count delta: 2
- LLM-estimated saved: 1

Action lanes:

- product unit add: 108
- parser bug: 25
- native UI or telemetry: 24
- pantry product add: 16
- manual review: 15
- alias add: 5
- saved meal repair: 2

## High-Value Issues Found

Quartermaster found the known stale protein shake identity:

- transcript: `Protein shake with dextrose.`
- stale emitted identity: `Protein Shake A - Pre-Workout`
- issue: stale `lib:saved_meal:*` source ref no longer exists
- lane: `saved_meal_repair`

Quartermaster found slow parses:

- espresso + half and half + stevia hazelnut liquid: 21.1s
- David Bar + Harmless Harvest coconut water: 20.7s
- H-E-B chicken fajitas + Taylor Farms street corn salad: 44.6s
- large restaurant meal with fajitas, chips, churros, beer, margaritas: 59.6s
- McDonald's biscuit + burrito: 20.4s

Quartermaster found large parse-vs-save changes:

- `2 scrambled eggs and a cup of oatmeal`: parsed two foods, saved one; calories changed by 90.
- large restaurant meal: parsed eight foods, saved seven; several food calories changed by hundreds.
- McDonald's meal: both items had very large calorie changes before save.
- `Three eggs.`: calories changed by 86.

Quartermaster found source ref chaining still present in historical rows:

- `3 eggs`
- `3 eggs and 2 strips of bacon`
- `6 egg whites and 2 eggs`

## Important Limitation

Luke's screenshot bug:

```text
1 protein shake, no dextrose, and 278 grams of sweet potatoes
```

was not visible as a saved `food_log_entries` row because the save failed before insert.

That is itself an important Quartermaster result: v0 can audit saved logs, but Pantheon still needs native/server event telemetry for failed saves, abandoned parses, exact edits, and unreadable display rows.

The immediate backend decimal-calorie save bug was fixed separately in commit `f264a01`.

## Files Added

- `scripts/quartermaster-audit.ts`
- `docs/QUARTERMASTER.md`
- `docs/handoffs/PANTHEON_S28_QUARTERMASTER_V0_AUDIT_1.md`

Updated:

- `package.json`

## Verification

Passed:

- `npx tsx scripts/quartermaster-audit.ts`
- `npm run typecheck`
- `npm run lint`

## Recommended Next Work

1. Add native/server event telemetry for failed save, abandoned parse, and exact edit gestures.
2. Fix the protein shake saved-meal taxonomy so stale `Protein Shake A - Pre-Workout` never returns.
3. Fix unit preservation/display for gram/count inputs.
4. Repair source-ref chaining in historical rows or make Quartermaster generate a cleanup packet.
5. Promote recurring slow parse phrases into golden replay cases.
