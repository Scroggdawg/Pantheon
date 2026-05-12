# Op FASTRAK Brick Alpha.6 Sub-fix D — Gate 1

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Sub-fix D complete and committed (web only). Push HOLD per V20's bundle discipline. Awaiting Gate 1 review before Sub-fix E+F bundle.

---

## §0 — Status

searchUserLibrary cascade extension shipped. The matcher now Promise.all-fans 4 queries (saved_meals, products, recent_foods, hourly_go_tos), scores via the existing libraryNameSimilarity, dedups by source_ref, and tier-sorts. Empirically validated end-to-end against live Supabase via 7-test verification harness. Migration 017 amends both views to project per-row macros from latest log instance.

Commit: `0b2105a` (web). Native untouched.

---

## §1 — What changed

```
A  scripts/verify-alpha6-d.ts                          (verification harness)
A  supabase/migrations/017_views_with_macros.sql       (view amends)
M  lib/claude/tools/search-user-library.ts             (+ ~340 / -23 lines)
```

**+523 insertions / -23 deletions** total.

---

## §2 — Verification

### D.0 — Type-check

```
$ npx tsc --noEmit  →  clean
```

### D.1 — Source-enum consumer inventory (Phase 0 §F.5 ask)

```
0 exhaustive switches outside the type definition itself.
```

- `classifier.ts`: uses `LibrarySearchResult` via `library_id` (string) + macro fields. No `.source` switches.
- `parse-meal-library-shortcut.ts`: treats `LibrarySearchResult` as opaque (constructs FoodItem from `top.total.kcal` etc., uses `top.library_id` as source_ref). No `.source` switches.

Type widening was non-breaking. Well within the Phase 0 "≤5 callsites" estimate.

### D.2 — Migration 017 verified live

```
recent_foods + hourly_go_tos now project: calories, protein_g, carbs_g,
fat_g, qty, unit. Sample (Eggs - Large @ recent_foods):
  null-source variant     → cal=210 (different food entity)
  product-source variant  → cal=140 (most-recent log with qty=2 unit=egg)
```

### D.3 — 7-test empirical smoke (verify-alpha6-d.ts)

Run: `npx tsx scripts/verify-alpha6-d.ts` at `currentHour=15 UTC`.

| Query | Expected | Observed | Pass |
|---|---|---|---|
| **"eggs"** | tier mix per data shape | 3 eggs at T2 (hourly dedup with saved_meal source_ref); Eggs-Large at T2 (product source_ref) + T4 (separate saved_meal entity with `lib:saved_meal:1b78c243-…` source_ref); 5 other "eggs"-substring variants at T2 | ✅ |
| **"banana"** | tier 2 hourly variants (3 differently-keyed variants in data: "Banana", "banana", "Bananas" — each with different/null source_refs) | 3× T2 HRLY entries, properly preserved as distinct food entities | ✅ |
| **"guacamole"** | tier 2 (hourly captures it with USDA source_ref) | T2 HRLY cal=190 | ✅ |
| **"double espresso"** | T2 hourly + T4 saved_meal coexist (different source_refs) | T2 HRLY cal=5 (null source_ref logged variant) + T4 BASE cal=24 (saved_meal `lib:saved_meal:07c10655-…`) | ✅ |
| **"shrimp fajitas"** | tier 2 (hourly with USDA source_ref) | T2 HRLY cal=378 | ✅ |
| **"nonexistent zzz"** | 0 results | 0 results | ✅ |
| **"eggs" with 3-eggs HEARTED** | tier 1 promotion | T1 FAV ⭐ 3 eggs (saved_meal); other variants stay at T2/T4 | ✅ |

Final post-script live state: all 4 saved_meals at `is_favorite=false` (baseline restored).

### D.4 — Three downstream shortcut helpers (per V20 brief verification)

`tryLibraryShortcut`, `tryLibraryCandidates`, `tryLibrarySegmentedShortcut` all route through `searchUserLibrary` (verified at `parse-meal-library-shortcut.ts:39`). Their consumer code reads `LibrarySearchResult.total.kcal` + `library_id` + `match_confidence.score` — none of which changed shape. They work without code changes.

### D.5 — Hourly weighting at different times of day

Empirically validated by Sub-fix A's earlier check (banana wins at noon over eggs); that behavior is preserved post-D since the view weighting math is unchanged.

---

## §3 — Surprises / flags / disagreements

### S.1 — Recents tier (3) is essentially unreachable when hourly is on

Because `hourly_go_tos` produces a row at every (user, food, source_ref) × every target_hour 0-23 (with Gaussian-falling weights), a food that appears in `recent_foods` ALSO appears in `hourly_go_tos` at the current hour with non-zero weight (however tiny). In the matcher's tier sort:

- Same `dedup_key` → `recent` tier 3 vs `hourly_go_to` tier 2 → hourly wins
- Tier 3 (recents) is therefore unreachable for any food that has any logging history at all

**Disposition:** flagged. The architecture is correct per V20's brief and behaves intuitively (the food's "most relevant tier" is always the hourly one when at the current hour). But the `recent_foods` view is essentially a no-op fallback at runtime. Two paths if this matters:

- Drop `recent_foods` from the cascade (and migration 017 / 016 / queries) — saves one query roundtrip per parse-meal call
- Keep it as future-proofing (if the cascade ever filters hourly by min weight threshold, recents would catch the misses)

I leaned toward keep-as-future-proofing for Alpha.6. Worth confirming with V20 — if the answer is "drop it," the cleanup is small.

### S.2 — Per-query row limits dropped (vs Phase 0 §P0.3 sketch)

Phase 0 sketched `.limit(100)` on recent_foods and `.limit(50)` on hourly_go_tos. **Removed both** during smoke iteration when the hourly limit clipped a low-weight product-source `Eggs - Large` row that should have deduped against the recent variant. Without the limit, dedup converges correctly.

**Justification:** at Luke's single-tenant scale, both views return ≤100 rows per query (62 unique foods × 1 row in recent_foods; ~62 rows at one target_hour in hourly_go_tos). At 10x scale we're still under 1000 rows. Server-side ilike pre-filter would be the right escape hatch beyond ~5k rows; comment in code marks the threshold.

**Disposition:** my judgment call within Phase 0's scoping latitude. Flagging because it diverges from the literal Phase 0 sketch.

### S.3 — Date.now() vs signature parameter

V20 recommended Date.now() for simplicity. Implemented as `new Date().getUTCHours()` inside searchUserLibrary. The replay script (`scripts/replay-parse.ts`) at Sub-fix bundle measurement will produce hour-dependent results — flagging now so V20 expects telemetry variation if replays span different times of day. A `--target-hour` flag could be added later if stable measurement matters.

### S.4 — Test cleanup script terminates cleanly

The verify script self-restores baseline state (un-hearts 3-eggs after the heart-promotion test). I tripped a SIGPIPE during one iteration when I `head`-truncated the script's stdout, which killed it before un-heart fired. Manual restore worked. The script itself is correct; just don't pipe its output through `head`.

### S.5 — No disagreements with brief

V20's spec for D was clean. The 7-test verification matrix matches the brief's verification asks 1:1. Tier semantics (1/2/3/4) implemented exactly as specified. Dedup-by-source_ref (with name fallback) handles legacy null-source_ref data correctly.

---

## §4 — Asks / greenlight requests

**A.1 — V20 confirms recents-tier disposition (S.1).** Keep as-is or drop? Recommendation: keep. Awaiting decision.

**A.2 — V20 acknowledges row-limits removal (S.2).** Phase 0 said .limit(100)/.limit(50); shipped without limits. Flagging the divergence.

**A.3 — Greenlight Sub-fix E+F bundle.** Per V20's heads-up about Brick Zeta scope-fold:

> Brick Zeta (per-food UI) folds into Alpha.6 Sub-fix E+F. The food log display will refactor from one-row-per-entry to one-card-per-food with subtle visual grouping under a meal label. Heart icon lands on each food card, not on the parent entry row.

This is a meaningful UX change — instead of `food_log_entries` rows being the unit of display (with all `foods_json[]` items concatenated into a string), each food becomes its own card. Hearting per-food would mean the heart endpoint at Sub-fix C might need extension to support hearting a SPECIFIC food within a multi-food entry, OR the per-food heart targets the parent entry's saved_meal_id (current behavior, just with finer-grained UI).

**Awaiting V20's amended E+F brief** that resolves:
1. Does the Sub-fix C heart endpoint need extension (e.g., `food_index` body field) or does per-food UI just call the existing endpoint with the parent entry_id?
2. Is "subtle visual grouping under a meal label" meant as a card stack or a single card with multiple food rows? (Affects native + web component shape)
3. Are existing food_log_entries with multi-food foods_json shown as N cards or 1 card-with-rows?

I'll grep `'created'` callsites in client code (per Sub-fix B §S.2) when E+F kicks off — that's still on the docket.

**A.4 — Greenlight Sub-fix G** can fire whenever, doesn't depend on E+F. If V20 wants to pipeline G ahead of E+F's amended brief, I can do G now and pause for the brief.

---

## §5 — Plan re-evaluation

A → B → C → D done. E+F bundle awaits V20's amended brief incorporating Brick Zeta scope-fold. G is independent.

Cumulative cost so far: ~30 turns Phase 0 + A + B + C + D. With E+F amended scope expanding to per-food UI refactor, expect E+F to land in 5-8 turns (web TodayLog refactor + native TodayLog refactor + heart wiring on each + dashboard endpoint augmentation). G stays at ~1-2 turns.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6D_HANDOFF_1.md
