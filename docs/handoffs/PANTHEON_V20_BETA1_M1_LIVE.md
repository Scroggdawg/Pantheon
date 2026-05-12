# Beta-1 / M.1 — LIVE deploy + close-out

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** **STOP for V20 review.** M.1 partial-success: ratchet bug ELIMINATED, but post-deploy live-test reveals a separate NULL-ref gap-gate failure mode that M.1's scope didn't cover.

---

## §0 — TL;DR

✓ **Migration 020 applied: 2 rows cleaned, post-count = 0 chains.** Both `"3 eggs"` source_refs now terminate at `lib:saved_meal:b4c2ac48...`.
✓ **Code deploy verified live** (`pantheon-woad.vercel.app/api/claude/parse-meal "3 eggs"` returns clean source_ref + single-hit shortcut).
✓ **M.1 ratchet bug ELIMINATED.** All 4 live-test cases return clean (non-chained) source_refs.
⚠ **3 of 4 cases STILL in candidates mode** — caused by a separate NULL-ref hourly_go_tos failure mode that M.1's scope didn't address.

Commit: `c589cac` (pushed to main).

---

## §1 — Migration 020 application

```
scanned 45 food_log_entries
pre-migration: 2 rows need cleanup

Applying UPDATEs...
  ✓ 09b49a22-5a39-4e25-a18f-6b34b83d8e5b
  ✓ 0459e41b-03ce-4b17-85b2-a642ac53da9f

2/2 rows updated

post-migration: 0 chained source_refs remaining (expected 0) ✓
```

Spot-check both updated rows:
```
id=09b49a22...  2026-05-09T21:40:23  food="3 eggs"  source_ref="lib:saved_meal:b4c2ac48-..."
id=0459e41b...  2026-05-10T04:18:50  food="3 eggs"  source_ref="lib:saved_meal:b4c2ac48-..."
```

Both terminate at the saved_meal correctly. **Migration done. Idempotent.**

PostgREST limitation: no arbitrary-SQL endpoint, so I applied the migration client-side via JS — fetch + JSON transform + PATCH per row. Same effect as the SQL UPDATE; same idempotency guarantee. Production state matches what the SQL would have produced.

---

## §2 — Live-test results (4 cases)

```
══ "3 eggs"
   foods: 1  disambiguation: 0  ✓ SINGLE-HIT
   name="3 eggs"  source=library  source_ref="lib:saved_meal:b4c2ac48-..."  score=1.0

══ "banana"
   foods: 1  disambiguation: 1  ⚠ candidates mode
   name="Banana"  source=library  source_ref="lib:product:629ab291-..."  score=1.0

══ "eggs - large"
   foods: 1  disambiguation: 1  ⚠ candidates mode
   name="Eggs - Large"  source=library  source_ref="lib:product:9d3aa4fe-..."  score=1.0

══ "McDonald's Bacon Egg and Cheese Biscuit"
   foods: 1  disambiguation: 1  ⚠ candidates mode
   name="McDonald's Bacon Egg & Cheese Biscuit"  source=library  source_ref="lib:saved_meal:74cf84aa-..."  score=0.9
```

**ALL 4 source_refs are clean** (terminal `lib:saved_meal:` or `lib:product:` form, no chain). M.1 ratchet bug fully fixed.

**3 of 4 still candidates mode** — single-hit shortcut not firing for banana / eggs - large / McDonald's BEC.

---

## §3 — Diagnosis: separate NULL-ref hourly_go_to failure mode

Phase 0 recon flagged this earlier:

```
Variant-ambiguity hunt: same dedup_name in hourly_go_tos w/ different source_refs:
  AMBIG  "3 eggs"        refs(3)=[chain, chain, terminal]   ← M.1 fixed this class
  AMBIG  "banana"        refs(2)=[NULL, lib:product:...]    ← M.1 didn't address
  AMBIG  "eggs - large"  refs(2)=[lib:product:..., NULL]    ← same
```

For "banana":
- `hourly_go_to[banana, NULL]` candidate → dedupKey = `name:banana`
- `hourly_go_to[banana, lib:product:629ab...]` candidate → dedupKey (after M.1 strip) = `lib:product:629ab...`
- `product[Banana]` candidate → dedupKey = `lib:product:629ab...`

The clean hourly + product **DEDUP correctly** (both → `lib:product:629ab...`). But the NULL hourly has key `name:banana` — no overlap. So NULL hourly surfaces alongside the deduped pair → 2 candidates → fail gap-gate → candidates mode.

Same pattern for "eggs - large" and McDonald's BEC (the saved_meal has a NULL-ref hourly counterpart from older logs).

**This is a different bug than M.1.** M.1 was about ratcheting concat at WRITE time. The NULL-ref pattern is about LEGACY hourly entries from pre-Gamma-A.2 logs that never got source_ref tagged.

---

## §4 — Disposition options

### Option α — Accept M.1 partial; close Beta-1; ship Beta-2 (F.2 segmenter) next

M.1 stopped the bleeding (ratchet eliminated, no new chains writable). Migration cleaned the existing chains. The NULL-ref pattern is a separate failure class that needs its own brick. F.3 McDonald's was originally framed as F.1-derivative; turns out it's also NULL-ref-derivative.

Pros: Beta-1 ships clean per its scope. Beta-2 (F.2) starts unblocked.
Cons: 3 of 4 V20-listed test cases still candidates. Demonstrably the matcher upgrade isn't visible to Luke yet on those 3.

### Option β — Add Beta-1.5 micro-fix: NULL-ref name-cascade dedup

When a hourly_go_to candidate has NULL source_ref, OR when computing dedupKey for any candidate, fall back to `name:NAME` and treat that as a SECONDARY collision target. If a product/saved_meal with `lib:X:Y` key shares name with a NULL-ref hourly's `name:NAME` key, dedup them.

Implementation sketch (~10-15 LOC):
```typescript
// Two-pass dedup. First pass: by canonical source_ref key (current logic).
// Second pass: for survivors, build a name→canonical-key map; collapse
// name-only keys (NULL-ref hourlies) into the canonical key.
```

Pros: All 4 V20-listed cases would single-hit. Closes M.1's intent fully.
Cons: ~10 LOC + re-deploy + re-test. Slightly out of M.1's stated scope (write-time normalization).

### Option γ — Backfill NULL source_refs at the data layer

Migration 021: for each food_log_entries.foods_json[i] with NULL source_ref, look up the user's products + saved_meals by name match (case-insensitive, trim) and backfill the source_ref. Cleans the data so the view emits clean refs.

Pros: data-correct fix. Resolves the NULL-ref class permanently.
Cons: harder to reason about (name match is fuzzy); could mis-tag if Luke has e.g., `Banana (frozen)` vs `Banana` as separate products with same display name. Larger blast radius.

### My recommendation: Option β (Beta-1.5)

The implementation is small (~10-15 LOC), fully contained in dedupKeyFor or its caller, and addresses the specific gap. Option γ is broader and riskier; defer to a Brick Delta cleanup if it's needed.

If V20 prefers Option α (close Beta-1, ship F.2 next), I respect the iteration discipline but flag that 3 of 4 V20-listed test cases will still candidates-mode when Luke voice-logs them.

---

## §5 — Close-out summary

**Beta-1 / M.1 actually shipped:**
- ✓ Ratcheting source_ref concat bug ELIMINATED (write-time + cascade-dedup)
- ✓ Migration 020 applied (2 rows cleaned, idempotent)
- ✓ Production source_refs are now clean across the board
- ✓ "3 eggs" single-hit confirmed
- ⚠ Other 3 cases still candidates due to separate NULL-ref failure mode (out of M.1 scope)

**Memory rules captured:** None new for M.1 itself. Existing schema-code-atomic rule was followed (code-first, migration after Vercel green).

**Brick Delta queue update:**
- ✓ M.1 source_ref ratchet (deployed)
- NEW: NULL-ref hourly_go_to dedup (M.1.5 or as M.X — Option β decision pending V20)
- F.2 segmenter (Beta-2 next)
- OFF save-fail investigation (carry-over)
- LLM-fill LEAN PROTEINS unit_alts (carry-over)
- Aicha Tomato Paste 0-kcal (carry-over)
- Optional R.4 if Ricotta-class recurs (carry-over)

---

## §6 — Asks for V20

**A.1 — V20 picks disposition:** α (close Beta-1, ship F.2) / β (Beta-1.5 NULL dedup) / γ (data-layer backfill).

**A.2 — V20 confirms Beta-1 closeout** if path α chosen.

**A.3 — Sequencing for next EXECUTE:** Beta-1.5 (β) then F.2, OR F.2 directly?

---

## §7 — Cleanup state

- **Production: 61 products. food_log_entries: 45 rows, 0 chains.** Migration 020 applied.
- **Git: HEAD `c589cac`** (pushed to main). Vercel deploy verified live.
- **Working tree: clean.**
- **/tmp scripts: ephemeral.**

Standing by for V20 disposition.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_M1_LIVE.md
