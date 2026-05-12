# Brick Beta Phase 0 — Matcher upgrade recon

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Phase 0 only. No code, no commits.

---

## Bullet 1 — F.1 empirical scope is BIGGER than the closeout described

The closeout framed F.1 as "saved_meal + hourly_go_to surface with mismatched source_refs." Empirically the issue is more severe: a **ratcheting source_ref concatenation bug** in the food_log_entries / hourly_go_tos pipeline.

### Evidence (production scan)

For the saved_meal **"3 eggs"** (id `b4c2ac48...`, hearted), `hourly_go_tos` shows THREE distinct source_ref shapes across hours:

```
hr=21,20,22,16,etc.  src_ref="lib:saved_meal:b4c2ac48-..."                                    (clean, post Gamma A.2)
hr=18,11             src_ref="lib:hourly_go_to:3 eggs|lib:saved_meal:b4c2ac48-..."            (1× concat — bug)
                     src_ref="lib:hourly_go_to:3 eggs|lib:hourly_go_to:3 eggs|lib:saved_meal:b4c2ac48-..."  (2× concat — ratcheting)
```

`food_log_entries.foods_json` confirms — **15 of 30 recent entries have non-standard source_refs** including double-concat strings. The `hourlyGoToCandidate` mapper builds `library_id = lib:hourly_go_to:${dedup_name}|${dedup_source_ref}`, and when `dedup_source_ref` already contains a concat (because a prior log inherited a concat ref), the next iteration prepends ANOTHER `lib:hourly_go_to:NAME|`. Each cycle ratchets one prefix deeper.

### Live verification — hits the gap-gate exactly as described

`POST /api/claude/parse-meal {"transcript": "3 eggs"}` returns:
- `foods[0].source_ref = "lib:hourly_go_to:3 eggs|lib:hourly_go_to:3 eggs|lib:hourly_g..."` (truncated)
- `disambiguation: [1 entries]` ← **library_candidates mode fired**, NOT single-hit shortcut

Single-hit shortcut requires gap >= 0.15. With saved_meal `lib:saved_meal:b4c2ac48...` and hourly `lib:hourly_go_to:3 eggs|lib:hourly_go_to:3 eggs|lib:saved_meal:b4c2ac48...` BOTH at score=1.0 with different `dedupKeyFor()` strings, dedup fails → both surface → gap=0 → fall to candidates.

### Other variant-ambiguity cases found

```
"banana"          refs=[NULL, lib:product:629ab291...]
"eggs - large"    refs=[lib:product:9d3aa4fe..., NULL]
```

Less severe than 3-eggs but same dedup-key gap. NULL source_refs probably from pre-Gamma-A.2 logs that the backfill didn't reach (or from logs that bypassed source_ref tagging entirely).

### Architectural call: 3 paths, not 2

V20's closeout listed (a) heart-backfill and (b) cascade-dedup. Empirical scope adds (c):

- **(a) Heart-endpoint backfill** — only handles "future hearts will write proper refs to historical food_log_entries." Doesn't address ratchet — the bug is in source_ref WRITE flow, not heart timing. AND requires retro-cleanup script for existing concat'd refs. Partial fix.

- **(b) Matcher cascade-dedup** — make `dedupKeyFor()` extract the terminal `lib:saved_meal:X` / `lib:product:Y` from any chain (regex strip `^(lib:hourly_go_to:[^|]+\|)+`). Compensates at read-time perpetually. Doesn't fix data corruption; symptoms keep re-accumulating.

- **(c) Normalize source_ref at WRITE time** — when `food.source_ref = top.library_id` for a hourly_go_to result, write the underlying `dedup_source_ref` instead of the chained `library_id`. Stops the ratchet at the source. Plus a one-time migration to clean existing concat'd refs in `food_log_entries.foods_json` (regex-extract terminal ref).

**My read: (c) is the architecturally correct fix.** The bug exists because we're persisting a derived/composite identifier (`lib:hourly_go_to:NAME|REF`) into a column that should hold a primary identifier (`lib:saved_meal:X` / `lib:product:Y`). Path (a) doesn't address this. Path (b) wallpapers it. Path (c) fixes the source.

But (c) involves one DB migration + parse-meal-pipeline edit + cascade-dedup as belt-and-suspenders for any concat'd refs not caught by migration. Effectively (c) + a slimmer (b) for safety.

---

## Bullet 2 — F.2 segmenter scope confirmed; path (a) is cleanest given current architecture

### Empirical reproduction

```
IN:  "One Bacon Egg and Cheese Biscuit from McDonald's and one Sausage Burrito from McDonald's"
OUT: 3 segments — "1 bacon egg", "cheese biscuit from mcdonald's", "1 sausage burrito from mcdonald's"
     ↑ over-split: "Bacon Egg AND Cheese Biscuit" gets split on internal "and"

IN:  "McDonald's Bacon Egg and Cheese Biscuit and a coffee"
OUT: 3 segments — "mcdonald's bacon egg", "cheese biscuit", "coffee"
     ↑ same over-split

IN:  "Cookies and cream protein shake"
OUT: 2 segments — "cookies", "cream protein shake"

IN:  "Bacon, egg and cheese sandwich"
OUT: 3 segments — "bacon", "egg", "cheese sandwich"
```

Luke's hearted McDonald's items use **"&"** in name (`McDonald's Bacon Egg & Cheese Biscuit`), but voice transcripts produce **"and"**. COMPOSITE_ALLOWLIST currently has 5 hardcoded entries (half/half, salt/pepper, mac/cheese, fish/chips, rice/beans). Luke's saved_meals contain user-specific compound names that aren't in the static list.

### Path (a) recommended — library-driven protect

V20's three paths:

- **(a) Detect when a segment is INSIDE a hearted/saved_meal name; don't split.**
  - Mechanic: at segmenter entry, query `saved_meals` (or pass user's saved_meal name list down from route), normalize names containing " and " → "&"-or-other, build a runtime composite-allowlist on top of the static one.
  - Auto-adapts as Luke saves new compound-named meals.
  - Library-driven: source-of-truth is the user's actual library, not a static list.
  - Cost: 1 query at parse-meal entry (already happens for searchUserLibrary; can reuse).

- **(b) Extend COMPOSITE_ALLOWLIST aggressively.** Brittle. Static list won't keep up with Luke's saved_meals.

- **(c) LLM-assisted segmentation.** Adds LLM cost + latency to the fast-path; defeats segmented shortcut purpose.

**Path (a) is structurally aligned with the architecture** — saved_meals IS the source of truth for "compound names this user has." Use it.

Implementation sketch (~30-50 LOC):
1. `segmentTranscript(transcript, savedMealNames?: string[])` accepts optional list.
2. Pre-filter: `savedMealNames.filter(n => /\s+and\s+/i.test(n) || n.includes('&'))` — only names that risk over-split.
3. For each such name, regex-escape + case-insensitive substring match against transcript. If match, treat as composite (placeholder swap).
4. Existing COMPOSITE_ALLOWLIST static list stays as fallback for un-saved compound terms.

---

## Bullet 3 — F.3 is an F.1 symptom; F.4 + F.5 are post-Beta micro-bricks

### F.3 — McDonald's Tier 1 verification

Live API test:
```
"McDonald's Bacon Egg and Cheese Biscuit"  → score=0.9, library hit, BUT disambiguation:1 entries (candidates mode, not single-hit)
"McDonald's Sausage Burrito"               → score=1.0, library hit, BUT disambiguation:1 entries
```

Both saved_meals are `is_favorite=true` and ARE getting matched by the library scorer. **Tier 1 fires at the matcher level** — but the route falls into `library_candidates` mode instead of single-hit shortcut because the gap-gate fails (saved_meal vs hourly_go_to with concat'd source_ref both at high score → gap=0).

**F.3's "is it a real bug" answer: yes, but its root cause IS F.1.** Fix F.1 (path c) → dedupKey aligns → second-place falls away → gap-gate passes → single-hit shortcut fires for McDonald's items. F.3 self-resolves with no separate work.

Recommend **dropping F.3 as a separate Beta input** and noting it as "verified F.1 fix coverage."

### F.4 — USDA Experimental filter

Search endpoint occasionally returns `dataType: "Experimental"` rows (research paper titles, kcal=null). Save endpoint correctly filters via per-row null check. UI shows them harmlessly. Polish only — single-line filter at search route.

### F.5 — Bell Peppers cup variant

LLM gave chopped-cup grams; USDA gives whole-rings cup grams. Both correct in their unit context. UX may show inconsistent values when toggling units. Low priority polish.

**Both F.4 + F.5 ship as standalone micro-bricks AFTER Beta.** They're not matcher-correctness items; they're polish. Folding them into Beta dilutes the matcher-upgrade narrative. Each is a 1-2 hour standalone commit.

---

## Bullet 4 — Sequencing + library-size + R.X discipline

### Sequencing — F.1 first, then F.2 within same Brick Beta

- **F.1 is upstream of everything** — affects single-hit + segmented shortcut + candidates mode equally. Fix yields measurable improvement across all parse-meal paths immediately.
- **F.2 expands F.1's empirical surface** — fixing F.2 means more compound-name inputs reach the matcher; if F.1 isn't fixed first, F.2's gains are masked because gap-gate failures still kill the picks.
- V20's option (i) sequential is correct empirically. Option (ii) F.2-first risks measurement noise. Option (iii) bundle is acceptable but harder to telemetry-attribute gains.

**Recommended: ship F.1 (path c) first as Beta-1; F.2 (path a) as Beta-2.** Single Brick Beta, two sequential commits, separate measurable improvements. If F.1's path-c migration is small enough, can pair-commit but keep separable in PR description.

### Library-size — ship Beta now, don't wait for Luke's backlog

V20's instinct correct. Beta's measurement surface:
- F.1 measurable on TODAY's library (61 products, 6 saved_meals, ~10+ hourly_go_tos with corrupt refs). The "3 eggs" + "banana" + "eggs - large" cases all reproduce now.
- F.2 measurable on TODAY's saved_meals (6 hearted/saved). McDonald's Bacon Egg & Cheese Biscuit is the canonical case; reproduces without any backlog work.
- Post-backlog (~200 products) the variant-ambiguity surface grows proportionally — quantitative scaling, no qualitative change. Beta's correctness improvements are independent of library size.

Shipping Beta now also benefits Luke's backlog work — every new saved_meal post-Beta gets clean source_refs at write time.

### R.X numbering carry-forward

V20's P0.7 says matcher rules should follow R.X discipline. The bulk-add R.X stack (R.1 / R.2 / R.2.5 / R.3 / R.3.5/b / R.6 / R.7) lives in `scripts/bulk-add-greek-god-bod.ts` — bulk-add-specific. The parse-meal pipeline matcher uses different naming (Tier 1/2/3, gap-gate, score-gate, etc.).

**Disposition:** Beta's fixes don't fit cleanly into the existing R.X stack (different code path, different problem class). Recommend Beta defines its own naming (e.g., M.1 source_ref normalization, M.2 library-driven segmentation) — distinct from R.X to avoid cross-codebase ambiguity. Each Beta-internal rule gets its own commit per V20's discipline.

Defer formalization of M.X names to EXECUTE per V20's instruction.

---

## Outstanding items / asks for V20

- V20 confirms path (c) for F.1 (write-time normalization + migration) over (a) heart-backfill or (b) matcher-cascade.
- V20 confirms path (a) for F.2 (library-driven segmenter protect).
- V20 confirms F.3 drop (F.1-derivative; no separate work).
- V20 confirms F.4 + F.5 as post-Beta micro-bricks.
- V20 confirms sequencing F.1 → F.2 within Beta.
- V20 confirms library-size: ship now.
- V20 confirms M.X naming for Beta-internal rules (vs continuation of R.X).

EXECUTE follows V20 review.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA_PHASE0_1.md
