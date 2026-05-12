# Beta-1 / M.1 — Dry-run + code drafts

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** **STOP for V20 PROCEED COMMIT.** Code changes drafted, type-check clean, NOT committed yet. Migration file created (not applied).

---

## §1 — Dry-run results (Step 1)

Scanned 45 food_log_entries (full table). Chain-pattern matches:

```
Rows that would be UPDATEd:           2
Total food entries with chain prefix: 2
```

**Live count is 2, not 15.** Earlier recon overcounted — the "15 other" bucket included legitimate non-chain refs (`usda:172069`, `usda:172063`, etc.) which start with `usda:` not `lib:`. Only 2 actual ratchet rows in the entire log table.

### Sample chains (most recent first)

```
2026-05-10T04:18:50.718833+00:00  food="3 eggs"  prefixes=2
  BEFORE: "lib:hourly_go_to:3 eggs|lib:hourly_go_to:3 eggs|lib:saved_meal:b4c2ac48-dac4-43f3-b013-318562125661"
  AFTER:  "lib:saved_meal:b4c2ac48-dac4-43f3-b013-318562125661"

2026-05-09T21:40:23.373805+00:00  food="3 eggs"  prefixes=1
  BEFORE: "lib:hourly_go_to:3 eggs|lib:saved_meal:b4c2ac48-dac4-43f3-b013-318562125661"
  AFTER:  "lib:saved_meal:b4c2ac48-dac4-43f3-b013-318562125661"
```

Both terminate at the same `lib:saved_meal:b4c2ac48...` (the saved_meal "3 eggs"). One ratchet level vs two confirms the prediction: **each parse-meal cycle prepends one prefix.**

`hourly_go_tos` is a regular `VIEW` (not materialized) — derives live from `food_log_entries` on each query. Once migration 020 cleans the underlying table, the view's output is automatically clean. No view refresh needed.

---

## §2 — Code change diffs (Step 2)

Two files modified. Type-check clean (`tsc --noEmit -p .` returns nothing).

### File 1 — `lib/claude/parse-meal-library-shortcut.ts`

```diff
 const SHORTCUT_SCORE_THRESHOLD = 0.85
 const SHORTCUT_GAP_THRESHOLD = 0.15

+// M.1 — write-time source_ref normalization (Brick Beta-1).
+//
+// Strips ratcheting "lib:hourly_go_to:NAME|" prefixes from a chained
+// source_ref, leaving the terminal underlying ref ("lib:saved_meal:UUID"
+// or "lib:product:UUID") intact. Without this, hourly_go_to picks
+// ratchet one prefix deeper per parse-meal cycle: each log inherits the
+// prior chained ref AND prepends its own hourly library_id.
+//
+// Applied at every food.source_ref write site below (4 in this file).
+// Belt-and-suspenders cascade-dedup in dedupKeyFor() handles any chains
+// that bypass this normalization (e.g., legacy data pre-migration 020).
+function normalizeFoodSourceRef(ref: string | null | undefined): string | null {
+  if (!ref) return null
+  const cleaned = ref.replace(/^(lib:hourly_go_to:[^|]+\|)+/, '')
+  // Degenerate case: input was solely the chain prefix with empty terminal.
+  // Preserve original semantics rather than producing an empty string.
+  return cleaned.length > 0 ? cleaned : ref
+}
```

Plus 4 call-site changes:

```diff
 // Site 1 — tryLibraryShortcut (single-hit)
-    source_ref: top.library_id,
+    source_ref: normalizeFoodSourceRef(top.source_ref ?? top.library_id),

 // Site 2 — tryLibraryCandidates placeholderFood
-    source_ref: top.library_id,
+    source_ref: normalizeFoodSourceRef(top.source_ref ?? top.library_id),

 // Site 3 — tryLibraryCandidates DisambiguationCandidate (string-required)
-    source_ref: r.library_id,
+    source_ref: normalizeFoodSourceRef(r.source_ref ?? r.library_id) ?? r.library_id,

 // Site 4 — tryLibrarySegmentedShortcut resolved.food
-        source_ref: top.library_id,
+        source_ref: normalizeFoodSourceRef(top.source_ref ?? top.library_id),
```

Site 3 falls back to `r.library_id` because `DisambiguationCandidate.source_ref` is non-null `string`. Other 3 sites assign to `FoodItem.source_ref` which is `string | null`.

### File 2 — `lib/claude/tools/search-user-library.ts` (cascade-dedup)

```diff
 function dedupKeyFor(r: LibrarySearchResult): string {
-  if (r.source_ref && r.source_ref.length > 0) return r.source_ref
+  if (r.source_ref && r.source_ref.length > 0) {
+    // M.1 cascade-dedup (Brick Beta-1) — strip ratcheting
+    // "lib:hourly_go_to:NAME|" prefixes before using as dedup key.
+    // Belt-and-suspenders for any chained source_refs that escape the
+    // write-time normalization in parse-meal-library-shortcut.ts (e.g.,
+    // pre-migration-020 legacy data, or future regressions). Without
+    // this, a saved_meal candidate with source_ref="lib:saved_meal:X"
+    // and an hourly_go_to candidate whose underlying source_ref is the
+    // same lib:saved_meal:X but wrapped in a chain wouldn't dedup,
+    // killing the gap-gate at the matcher.
+    const stripped = r.source_ref.replace(/^(lib:hourly_go_to:[^|]+\|)+/, '')
+    return stripped.length > 0 ? stripped : r.source_ref
+  }
   return `name:${r.name.toLowerCase().trim()}`
 }
```

### File 3 — `supabase/migrations/020_normalize_food_log_source_refs.sql` (NEW)

Created. Same SQL as the migration plan handoff §2. Idempotent UPDATE with WHERE EXISTS gate. NOT applied yet — will run after Vercel deploy lands.

### Stat summary

```
lib/claude/parse-meal-library-shortcut.ts | 27 +++++++++++++++++++++++----
lib/claude/tools/search-user-library.ts   | 14 +++++++++++++-
supabase/migrations/020_normalize_food_log_source_refs.sql | 47 +++++ (NEW file)
3 files changed, 88 insertions(+), 5 deletions(-)
```

---

## §3 — Behavior matrix (per V20 review)

For each LibrarySearchResult source type, what does the change do?

| Source | `library_id` | `source_ref` | Pre-M.1 food.source_ref | Post-M.1 food.source_ref |
|---|---|---|---|---|
| saved_meal | `lib:saved_meal:X` | `lib:saved_meal:X` | `lib:saved_meal:X` | `lib:saved_meal:X` (unchanged) |
| product | `lib:product:Y` | `lib:product:Y` | `lib:product:Y` | `lib:product:Y` (unchanged) |
| hourly_go_to with clean underlying | `lib:hourly_go_to:N\|lib:saved_meal:X` | `lib:saved_meal:X` | `lib:hourly_go_to:N\|lib:saved_meal:X` (chained) | `lib:saved_meal:X` (clean) |
| hourly_go_to with chained underlying (legacy) | `lib:hourly_go_to:N\|lib:hourly_go_to:N\|lib:saved_meal:X` | `lib:hourly_go_to:N\|lib:saved_meal:X` | (chained worse) | normalize() strips → `lib:saved_meal:X` |
| hourly_go_to with NULL source_ref | `lib:hourly_go_to:N\|null` (synthetic) | `null` | `lib:hourly_go_to:N\|null` | `null` ?→ falls back to library_id, then normalize → still `lib:hourly_go_to:N` (degenerate) |

**For NULL underlying:** `top.source_ref ?? top.library_id` falls back to `library_id` = `lib:hourly_go_to:NAME|null`. Then normalize strips `lib:hourly_go_to:NAME|` → leaves `null` (the literal string "null"). Hmm — that's still odd. Let me trace more carefully.

Actually `row.source_ref` IS the literal column value. If it's the JS `null`, `?? top.library_id` falls back. `top.library_id` is `lib:hourly_go_to:${dedup_name}|${dedup_source_ref}` — and if dedup_source_ref is JS null, JS coerces to the string "null". So library_id = `lib:hourly_go_to:banana|null`. After normalize() strips `lib:hourly_go_to:banana|`, we get the literal string `"null"` (4 chars). That's persisted as source_ref.

That's... not catastrophic but not clean. Future dedupKeyFor() would see `"null"` as the key. Not great.

**Edge case worth noting but not blocking** — null-source_ref hourly_go_to entries (from pre-Gamma A.2 logs) currently surface as `lib:hourly_go_to:banana|null` in matcher; M.1 changes that to literal `"null"` — slightly cleaner (1 dedup key instead of 1) but neither matches a saved_meal/product key so dedup still won't help.

If V20 wants this fully cleaned, the fix is in `hourlyGoToCandidate` mapper (search-user-library.ts:330) — emit `library_id` without the `|null` tail when dedup_source_ref is null. Optional follow-on; doesn't block Beta-1.

---

## §4 — Sequenced plan (post V20 PROCEED COMMIT)

1. **(this turn)** STOP for V20 review.
2. V20 PROCEED COMMIT → I commit single bundle:
   - `lib/claude/parse-meal-library-shortcut.ts` (M.1 normalize + 4 sites)
   - `lib/claude/tools/search-user-library.ts` (M.1 cascade-dedup)
   - `supabase/migrations/020_normalize_food_log_source_refs.sql` (data clean)
   - Commit message: "S27 Op FASTRAK Brick Beta-1: M.1 source_ref write-time normalization + cascade-dedup + migration 020"
3. V20 PROCEED PUSH → I push to `main` → Vercel auto-deploys (~1-3 min).
4. After Vercel green: I apply migration 020 against production.
5. Verify post-migration count = 0 chains; spot-check 2 rows.
6. Live-test 4 known cases:
   - `"3 eggs"` — should single-hit (foods=1, disambiguation=null), source_ref clean
   - `"banana"` — should single-hit
   - `"eggs - large"` — should single-hit
   - `"McDonald's Bacon Egg and Cheese Biscuit"` — should single-hit (F.3 self-resolve)
7. Surface close-out.

---

## §5 — Asks for V20

**A.1 — V20 confirms diffs look correct.** Specifically the normalize helper, 4 site changes, and dedupKeyFor() cascade logic.

**A.2 — V20 acknowledges the NULL underlying edge case** (becomes literal `"null"` string after normalize). Acceptable for Beta-1; optional fix in hourlyGoToCandidate mapper as follow-on if Luke notices.

**A.3 — V20 PROCEED COMMIT** if diffs OK.

**A.4 — V20 PROCEED PUSH** after commit (or grant blanket "commit + push" if happy with diffs).

---

## §6 — Cleanup state

- **Production: 61 products.** No changes since Path γ.
- **Git: HEAD `04345b4`.** Working tree dirty:
  - `lib/claude/parse-meal-library-shortcut.ts` (modified)
  - `lib/claude/tools/search-user-library.ts` (modified)
  - `supabase/migrations/020_normalize_food_log_source_refs.sql` (untracked, new)
- **Type-check: clean** (`tsc --noEmit -p .`).
- **Migration 020 NOT applied yet.**

Standing by for V20 PROCEED COMMIT.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_M1_DRAFTS.md
