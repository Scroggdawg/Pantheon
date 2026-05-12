# Beta-1 / M.2b — Path β expansion drafts

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** **STOP for V20 PROCEED COMMIT.** M.2b drafted (36 LOC, mostly comments). Type-check clean.

---

## §1 — Diff (`+36`, `-0` in 1 file)

```typescript
// Inserted right after M.2's Pass 2 name-key drop, before `const deduped = ...`:

  for (const [key, r] of [...grouped.entries()]) {
    if (r.source !== 'hourly_go_to') continue
    const nameKey = `name:${r.name.toLowerCase().trim()}`
    const canonical = nameToCanonical.get(nameKey)
    if (canonical && canonical !== key) {
      grouped.delete(key)
    }
  }
```

(That's the operative ~7 LOC. The remaining 29 lines are doctrine comments naming the order-of-operations rationale, the self-collapse guard, and the Classes A + B "does not catch" disclaimer.)

---

## §2 — Q1 edge-case verification (V20's specific worry)

V20 asked: does M.2b break the Pass-1 cascade-dedup behavior? Specifically, does hourly@lib:product:X + product@lib:product:X still merge correctly via Pass 1 BEFORE M.2b runs?

### Order of operations (post-M.2b)

```
Pass 1: cascade-dedup
   For each candidate r:
     key = dedupKeyFor(r)        ← M.1's regex strip
     grouped[key] = r (or higher-tier r when collision)

Pass 2: name-cascade (M.2)
   Build nameToCanonical from non-name: survivors
   Drop name: keys that map to canonicals

Pass 2b: hourly-to-canonical cascade (M.2b NEW)
   For each surviving hourly_go_to entry:
     If a different canonical key exists for its name → drop
```

### Trace: hourly@lib:product:X + product@lib:product:X (your worry case)

```
Pass 1:
  hourly[Banana, src_ref=lib:product:629ab...]      → key=lib:product:629ab..., tier=2
  product[Banana, src_ref=lib:product:629ab...]     → key=lib:product:629ab..., tier=3

  Same key → tier wins → grouped[lib:product:629ab...] = hourly entry (tier 2)

Pass 2:
  nameToCanonical: { "name:banana" → "lib:product:629ab..." }
  No name: keys to drop.

Pass 2b:
  Entry at lib:product:629ab... is source='hourly_go_to', name="Banana"
  nameKey = "name:banana"
  canonical = "lib:product:629ab..."
  canonical === key → SELF-COLLAPSE GUARD FIRES → don't drop ✓
```

Hourly@lib:product survives Pass 2b because it IS the canonical for its name. No regression on cascade-dedup behavior. ✓

### Trace: hourly@lib:product:X without matching canonical entry

Edge case: an hourly entry whose underlying source_ref points at a product that doesn't currently match by name (e.g., user renamed the product). Pass 1 would store hourly@lib:product:X solo. Pass 2 nameToCanonical contains "name:<hourly_name>" → "lib:product:X". Pass 2b: same logic, canonical === key, no drop. Still preserved. ✓

### Trace: hourly@usda:172069 + saved_meal@lib:saved_meal:74cf (McDonald's BEC — Class C)

```
Pass 1:
  hourly[McDonald's BEC, src_ref=usda:172069]       → key=usda:172069, tier=2
  saved_meal[McDonald's BEC, fav=Y]                 → key=lib:saved_meal:74cf..., tier=1

  Different keys, no collision. Both survive.

Pass 2:
  nameToCanonical iteration:
    usda:172069 → name:mcdonald's bacon egg & cheese biscuit → canonical=usda:172069
    lib:saved_meal:74cf → same nameKey. tier 1 < tier 2 → update canonical=lib:saved_meal:74cf
  No name: keys to drop.

Pass 2b:
  usda:172069 (hourly_go_to). nameKey=name:mcdonald's...
  canonical = lib:saved_meal:74cf
  canonical !== key → DROP ✓
  
  Surviving: lib:saved_meal:74cf only. Single-hit shortcut fires. ✓
```

---

## §3 — Predicted live-test outcomes

| Case | Pre-M.2b | Post-M.2b | Why |
|---|---|---|---|
| "3 eggs" | ✓ single-hit | ✓ single-hit (no change) | M.1 baseline; no hourly_go_to second-place to drop |
| "banana" | ⚠ candidates | ⚠ candidates (no change) | Class A — "Bananas" plural-hourly self-collapses (nameKey=name:bananas matches its own key); M.2b can't fix without pluralization tolerance |
| "eggs - large" | ⚠ candidates | ⚠ candidates (no change) | Class B — product + saved_meal both canonical; M.2b only touches hourly_go_to source |
| **"McDonald's BEC"** | ⚠ candidates | **✓ single-hit (Class C fix)** | Hourly@usda:172069 (source=hourly_go_to) collapses into lib:saved_meal:74cf canonical |

After M.2b: **2 of 4** V20 cases single-hit (was 1 of 4 post-M.2).

---

## §4 — Beta-1 close-out plan (after M.2b live-tests)

```
Brick Beta-1 — CLOSED
Final scope:
  M.1 (c589cac) — source_ref write-time normalization + cascade-dedup
                  + migration 020 (ratchet cleanup)
  M.2 (e48c94d) — NULL-ref name-cascade dedup
  M.2b (<this commit>) — hourly_go_to-to-canonical name-cascade extension

Results (V20's 4 test cases):
  ✓ "3 eggs"                              — single-hit
  ✓ "McDonald's Bacon Egg and Cheese Biscuit" — single-hit (M.2b)
  ⚠ "banana"                              — still candidates (Class A → M.5)
  ⚠ "eggs - large"                        — still candidates (Class B → M.4)

Deferred / queued:
  M.3 (Beta-2) — library-driven segmenter protect (F.2 from Phase 0)
  M.4         — same-name canonical collision (product + saved_meal)
  M.5         — name-variant / pluralization tolerance for hourly_go_tos
```

---

## §5 — Asks for V20

**A.1 — V20 confirms diff + edge-case traces in §2.**

**A.2 — V20 PROCEED COMMIT + PROCEED PUSH** (or blanket).

**A.3 — Commit message:** `"S27 Op FASTRAK Brick Beta-1 / M.2b: hourly_go_to-to-canonical name-cascade (Class C)"`

---

## §6 — Cleanup state

- **Production: 61 products. food_log_entries clean.**
- **Git: HEAD `e48c94d` (M.2)**. Working tree dirty:
  - `lib/claude/tools/search-user-library.ts` (modified, +36 LOC)
- **Type-check: clean.**
- **No migration.**

Standing by for V20 PROCEED COMMIT.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_M2B_DRAFTS.md
