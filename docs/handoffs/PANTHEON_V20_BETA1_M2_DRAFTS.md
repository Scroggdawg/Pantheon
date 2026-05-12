# Beta-1.5 / M.2 — NULL-ref name-cascade dedup drafts

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** **STOP for V20 PROCEED COMMIT.** M.2 drafted, type-check clean, NOT committed. No migration (pure read-time logic).

---

## §1 — Diff (`+51`, `-0` in 1 file)

```diff
// In lib/claude/tools/search-user-library.ts, inserted right after the
// existing Pass-1 dedup loop and before `const deduped = [...grouped.values()]`:

+  // M.2 — NULL-ref name-cascade dedup (Brick Beta-1.5).
+  //
+  // Symptom: banana / eggs - large / McDonald's BEC still surface as
+  // candidates-mode because their matching hourly_go_to entries carry
+  // NULL source_ref (legacy pre-Gamma-A.2 logs). NULL refs fall through
+  // dedupKeyFor() to `name:NAME`, while the canonical product/saved_meal
+  // carries `lib:product:UUID` / `lib:saved_meal:UUID`. Pass 1 can't
+  // collapse — different keys.
+  //
+  // Pass 2 collapses every `name:X` survivor into the canonical `lib:*`
+  // survivor whose entry's name (case-insensitive, trimmed) equals X.
+  // Canonical wins always — its source_ref is the durable identity.
+  const nameToCanonical = new Map<string, string>()
+  for (const [key, r] of grouped) {
+    if (key.startsWith('name:')) continue
+    const nameKey = `name:${r.name.toLowerCase().trim()}`
+    const existing = nameToCanonical.get(nameKey)
+    if (!existing) {
+      nameToCanonical.set(nameKey, key)
+      continue
+    }
+    if (tierFor(r) < tierFor(grouped.get(existing)!)) {
+      nameToCanonical.set(nameKey, key)
+    }
+  }
+  for (const key of [...grouped.keys()]) {
+    if (!key.startsWith('name:')) continue
+    if (nameToCanonical.has(key)) {
+      grouped.delete(key)
+    }
+  }
```

Plus a 7-line comment above the Pass-1 dedup loop pointing to M.2 below.

**Total:** 51 insertions, 0 deletions, 1 file. Type-check clean (`tsc --noEmit -p .`).

---

## §2 — Behavior model (Q1 edge-case audit)

### Cases M.2 collapses (intended)

| Setup | Pass 1 result | M.2 Pass 2 result |
|---|---|---|
| NULL-hourly[Banana] + product[Banana] | 2 entries: `name:banana` + `lib:product:629ab...` | 1 entry: `lib:product:629ab...` (NULL-hourly dropped) |
| NULL-hourly[Eggs - Large] + product[Eggs - Large] | 2 entries | 1 entry |
| NULL-hourly[McDonald's BEC] + saved_meal[McDonald's BEC, fav] | 2 entries: `name:mcdonald's...` + `lib:saved_meal:74cf...` | 1 entry: `lib:saved_meal:74cf...` (favorite tier-1 preserved) |

### Cases M.2 LEAVES distinct (Q1 safety net)

| Setup | Pass 1 result | M.2 Pass 2 result |
|---|---|---|
| product[Banana] + saved_meal[Banana smoothie] | 2 entries (different names) | 2 entries — names differ, no name-key collision |
| product[Banana] + saved_meal[Banana] (both canonical, same name) | 2 entries: `lib:product:X` + `lib:saved_meal:Y` | 2 entries — both `lib:*` keyed, M.2 only collapses `name:` keys; distinct canonicals coexist |
| NULL-hourly[Pizza] + product[Pizza margherita] (homonyms partial) | 2 entries (different names: "pizza" vs "pizza margherita") | 2 entries — name-key `name:pizza` doesn't match `name:pizza margherita` |

### Cases M.2 could mis-collapse (acceptable trade-off)

| Setup | What M.2 does | Why it's acceptable |
|---|---|---|
| User has product[Apple] (fruit) AND saved_meal[Apple] (a different food, same generic name); plus NULL-hourly[Apple] | NULL-hourly collapses into the HIGHER-tier of {product, saved_meal}; both canonicals still surface separately | NULL-ref has no identity beyond the name; collapsing to whichever canonical is higher-tier (saved_meal favorite > product) is the best heuristic |
| User logs "banana" as raw text (NULL-hourly), then later creates a product named "Banana"; old logs match by name | Old NULL-hourly folds into new product | Correct semantically — the product is now the durable record for "banana" |

### Cases M.2 does NOT help (out of M.2 scope)

| Setup | Pass 1 result | M.2 Pass 2 result | Why |
|---|---|---|---|
| product[Eggs - Large] + saved_meal[Eggs - Large, fav=N] (both canonical, both named identically) | 2 entries: `lib:product:X` + `lib:saved_meal:Y` | 2 entries (unchanged) | Both have `lib:*` keys, M.2 only touches `name:` keys. They're structurally distinct (saved_meal wraps the product); matcher surfaces both, gap-gate may still fail. **Would require M.3-class fix (name-canonical priority for ALL same-name entries) — out of scope for Beta-1.5.** |

I called this out specifically because the live-test from earlier showed Eggs - Large remained candidates-mode. If the saved_meal-vs-product collision IS the cause (not the NULL-hourly), M.2 alone won't fix Eggs - Large. Live-test will tell.

---

## §3 — Q2: insertion point

Two-pass logic needs cross-entry state (the `nameToCanonical` map). `dedupKeyFor()` only sees one entry at a time → can't host the logic.

The cleanest insertion is in the dedup function itself, **right after** the existing Pass-1 loop. That's where the implementation lives.

Considered alternatives:
- A wrapper helper: same logic, slightly more indirection. No structural gain.
- A SQL-side dedup (in the hourly_go_tos VIEW): would require schema change + the bigger Path γ (migration 021 name-backfill). Out of scope for M.2.

In-function placement chosen.

---

## §4 — Behavior matrix (Q1 expanded — for V20 sanity check)

For "banana" query against current production library:

**Inputs (after `min_score` filter):**
- `hourly_go_to[banana, NULL]` — score 1.0, tier 2
- `hourly_go_to[banana, lib:product:629ab...]` — score 1.0, tier 2 (M.1 strip → terminal key)
- `product[Banana]` — score 1.0, tier 3

**Pass 1 (existing logic):**
- `name:banana` ← NULL-hourly (alone)
- `lib:product:629ab...` ← M.1-cascade-dedup keeps tier-2 hourly over tier-3 product (current behavior)

Result: 2 entries — `name:banana` (NULL-hourly, tier 2) + `lib:product:629ab...` (hourly via dedup, tier 2)

**Pass 2 (M.2):**
- `nameToCanonical`: `name:banana` → `lib:product:629ab...`
- Drop `name:banana` from grouped

Result: 1 entry — `lib:product:629ab...` (tier-2 hourly with clean ref)

**Downstream:**
- `tryLibraryShortcut` sees 1 result.
- topScore = 1.0, secondScore = 0 (no second), gap = 1.0 — passes 0.15 threshold.
- Single-hit shortcut fires. ✓

For "eggs - large": same analysis applies IF there's only one canonical (the product). If the saved_meal also exists and shares the name, both canonicals surface (per §2 "out of scope" row). Live-test confirms.

For McDonald's BEC: only the hearted saved_meal canonical exists; NULL-hourly + clean-hourly + saved_meal. Pass 1 dedup leaves NULL-hourly@name:... + saved_meal@lib:saved_meal:... Pass 2 collapses → 1 entry → single-hit.

---

## §5 — Sequenced plan (post V20 PROCEED COMMIT)

1. **(this turn)** STOP for V20 review.
2. V20 PROCEED COMMIT → commit:
   - Single file change: `lib/claude/tools/search-user-library.ts` (+51 lines)
   - Message: `"S27 Op FASTRAK Brick Beta-1.5 / M.2: NULL-ref name-cascade dedup"`
3. V20 PROCEED PUSH → push to main → Vercel auto-deploys (~1-3 min).
4. Vercel green verification (poll `pantheon-woad.vercel.app` parse-meal).
5. Live-test 4 cases:
   - `"3 eggs"` — should still single-hit (M.1 baseline; M.2 shouldn't regress)
   - `"banana"` — should NOW single-hit (M.2 fix)
   - `"eggs - large"` — should NOW single-hit (M.2 fix) OR remain candidates if saved_meal+product collision is the actual cause
   - `"McDonald's Bacon Egg and Cheese Biscuit"` — should NOW single-hit (M.2 fix)
6. Surface results + Beta closeout doc.

---

## §6 — Asks for V20

**A.1 — V20 confirms M.2 logic + comment placement.**

**A.2 — V20 acknowledges the §2 "out of scope" row** (saved_meal+product same-name collision). If Eggs - Large still candidates post-M.2 live-test, that's the cause. Disposition: defer to M.X follow-on, or fold into M.2 with an additional same-name canonical collapse pass.

**A.3 — V20 PROCEED COMMIT + PROCEED PUSH** (or blanket "commit + push" if happy with diffs).

---

## §7 — Cleanup state

- **Production: 61 products. food_log_entries: 45 rows, 0 chains** (post-M.1 + migration 020).
- **Git: HEAD `c589cac`** (M.1 commit). Working tree dirty:
  - `lib/claude/tools/search-user-library.ts` (modified)
- **Type-check: clean.**
- **No new migration needed for M.2.** Read-time logic only.

Standing by for V20 PROCEED COMMIT.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_M2_DRAFTS.md
