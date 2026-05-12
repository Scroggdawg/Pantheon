# Beta-1.5 / M.2 — LIVE deploy + post-deploy findings

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** **HALT for V20 review.** M.2 deployed (commit `e48c94d`); confirmed via candidates payload introspection. 3 of 4 live-test cases STILL candidates, but for THREE NEW failure modes — not M.2's NULL-ref scope.

---

## §0 — TL;DR

✓ M.2 deployed and working — NULL-source_ref hourly_go_tos now collapse into canonical name-matching entries.
⚠ 3 of 4 V20-listed test cases still candidates-mode, but for **three distinct bug classes none of which is M.2's domain**.
⚠ V20's CASE C "Unexpected: HALT for V20 review" applies — surface and disposition.

Commit: `e48c94d` (pushed). Working tree clean.

---

## §1 — Evidence M.2 is live

Candidates payload for `"banana"` post-deploy:

```
foods: 1  disambiguation: 1
  placeholder: name="Banana"  src_ref="lib:product:629ab291-..."
  disambiguation[0].candidates: 2 entries
    "Banana"   src_ref="lib:product:629ab291-..."             score=1.0
    "Bananas"  src_ref="lib:hourly_go_to:bananas|"            score=1.0
```

**Pre-M.2 expected 3 candidates** (product + NULL-hourly + plural-hourly). **Post-M.2 shows 2** — the NULL-hourly was correctly collapsed by M.2's name-cascade. The remaining "Bananas" plural is a different beast.

---

## §2 — Three distinct failure classes uncovered by live data

### Class A — Empty-tail hourly_go_to with plural-name variant (banana)

Hourly entry: `src_ref="lib:hourly_go_to:bananas|"` (trailing pipe, empty after).

Origin: when a food was logged with `dedup_source_ref` = empty string (vs JS null), the library_id resolves to `lib:hourly_go_to:bananas|<empty>`. M.1's regex `^(lib:hourly_go_to:[^|]+\|)+` matches the entire `lib:hourly_go_to:bananas|` prefix, stripping leaves empty string, my degenerate-case fallback preserves original → dedupKey stays as `lib:hourly_go_to:bananas|`.

Plus the food name is **"Bananas" (plural)** — distinct from the canonical **"Banana"** singular. M.2's name-cascade keys on exact lowercased name match: `name:banana` ≠ `name:bananas`. No collapse.

**Net:** the matcher sees two valid entries ("Banana" product + "Bananas" hourly) with different names + different non-name dedup keys. Both surface at score 1.0 → gap-gate fails.

### Class B — Same-name canonicals collision (Eggs - Large)

Data probe found:
- `product[Eggs - Large]` (canonical)
- `saved_meal[Eggs - Large, is_favorite=false]` (canonical)
- Plus hourly variants — NULL collapsed by M.2 ✓

Both canonicals have lib:* keys, neither is `name:`-keyed. M.2 explicitly leaves these distinct (per my §2 edge-case audit row "product[Banana] + saved_meal[Banana] both canonical — M.2 only touches name: keys").

**Net:** product + saved_meal both at score 1.0 → gap-gate fails.

### Class C — Non-NULL non-chain hourly source_ref (McDonald's BEC)

Hourly entry: `src_ref="usda:172069"` (USDA reference, not lib:*, not NULL, not chain).

M.1 cascade-dedup regex strips `lib:hourly_go_to:NAME|` prefixes only — doesn't touch `usda:172069`. dedupKey = `usda:172069`. The canonical saved_meal has dedupKey `lib:saved_meal:74cf...`. Different keys, no collapse.

M.2 only collapses `name:` keys (NULL fallback). `usda:172069` is canonical-shaped, doesn't fall to `name:`.

**Net:** hourly@usda:172069 + saved_meal@lib:saved_meal:74cf both surface → gap-gate fails.

---

## §3 — Per-test-case audit

| Case | M.1 effect | M.2 effect | Why still candidates |
|---|---|---|---|
| "3 eggs" | ✓ strip chain | ✓ baseline | — single-hit ✓ |
| "banana" | n/a (no chain) | ✓ NULL collapsed | Class A: "Bananas" plural hourly@lib:hourly_go_to:bananas\| remains |
| "eggs - large" | n/a | ✓ NULL collapsed | Class B: product + saved_meal same-name canonicals |
| "McDonald's BEC" | n/a | n/a (no NULL-hourly) | Class C: hourly@usda:172069 + saved_meal canonical |

So M.1 + M.2 between them eliminate:
- ✓ Ratchet chains (M.1)
- ✓ NULL-hourly + canonical name-match (M.2)

But leave untouched:
- ⚠ Class A: empty-tail hourly + plural-or-variant name not exact-matching the canonical
- ⚠ Class B: same-name canonicals (product + saved_meal)
- ⚠ Class C: non-NULL non-chain hourly source_ref (usda: / off:) + canonical

---

## §4 — Disposition options

### Option α — Close Beta-1 with 1 of 4 fixed, queue M.3+ comprehensively

Beta-1 ships M.1 ratchet + M.2 NULL-cascade. Live-test confirms "3 eggs" single-hits. The other 3 cases need fixes that weren't in M.2's scope.

Queue for Beta-2 onwards:
- **M.3** — library-driven segmenter protect (already queued; was the original Beta-2 plan)
- **M.4** — same-name canonical priority pass (Class B)
- **M.5** — name-similarity hourly_go_to collapse (Class A — handles plural/variant + empty-tail)
- **M.6** — broader hourly_go_to → canonical cascade for any source_ref that doesn't match canonical's source_ref but name matches (Class C generalized — usda:/off:/anything)

### Option β — Fold Classes A+C into M.2 expansion (Beta-1.5b)

Generalize M.2 from "NULL hourly → canonical name-match" to "ANY hourly_go_to entry → canonical name-match, regardless of underlying source_ref":

```typescript
// Pass 2 expanded — collapse ALL hourly_go_to entries whose name matches a
// surviving canonical. The hourly view is a "this was logged at this hour"
// ranking signal, not a separate matcher entity.
for (const [key, r] of [...grouped.entries()]) {
  if (r.source !== 'hourly_go_to') continue
  const nameKey = `name:${r.name.toLowerCase().trim()}`
  const canonical = nameToCanonical.get(nameKey)
  if (canonical && canonical !== key) {
    grouped.delete(key)
  }
}
```

**Catches Class C** (McDonald's BEC) — hourly@usda:172069 has source=hourly_go_to, name "McDonald's Bacon Egg & Cheese Biscuit" matches saved_meal canonical → collapse.

**Doesn't catch Class A** (banana plural) — names differ ("Bananas" vs "Banana"). Would need string-similarity name matching (singular/plural tolerance) which is a different rule entirely.

Adding singular/plural tolerance: trim trailing 's' from one side before comparing? Cheap but fragile. Probably defer.

### Option γ — Class B (Eggs-Large) needs M.4 — separate brick

The product[Eggs - Large] and saved_meal[Eggs - Large, fav=N] both exist as canonical entries. The saved_meal wraps the product (its foods_json[0].source_ref = lib:product:9d3aa4fe...). They're structurally distinct but semantically identical for matcher purposes.

M.4 sketch: in the dedup loop, after Pass 1+2, walk all surviving canonicals. For each pair of canonicals sharing the same name, collapse the lower-tier into the higher-tier. Tier priority: saved_meal favorite > hourly > product > saved_meal non-favorite. For Eggs-Large, saved_meal (Tier 3, non-fav) vs product (Tier 3): tie → score wins → both 1.0 → first one stays. Hmm, still ambiguous.

Alternative M.4: when a saved_meal contains exactly one component pointing at a product, treat saved_meal and product as collapsable. The saved_meal is a wrapper; pick whichever has higher tier or stronger user signal (is_favorite first, then times_logged).

### My recommendation

**Option α — close Beta-1 cleanly.** M.1 + M.2 shipped, "3 eggs" works, the other 3 cases need different rule classes that warrant their own bricks.

Beta-1 narrative is clean: ratchet bug + NULL-cascade. Other failure modes are real but architecturally distinct, deserve separate framing.

**If V20 prefers Option β** (fold Class C into M.2 expansion), it's ~5 LOC additional and fixes McDonald's BEC. Acceptable as M.2b. But Class A (banana plural) and Class B (Eggs-Large canonical-collision) still need separate bricks.

---

## §5 — Asks for V20

**A.1 — Pick disposition:** α (close Beta-1 with 1 of 4) / β (M.2 expansion to fold Class C) / γ (extensive M.4 design now).

**A.2 — Acknowledge that the candidates-mode response IS still a working UX path** — Luke gets a 2-candidate disambiguation, picks the right one, food gets logged. The bug is "fast path doesn't fire" not "wrong food gets logged." Less urgent than M.1's ratchet+ over-counting was.

**A.3 — Confirm Beta-2 (M.3 segmenter) remains queued.** F.2 segmenter was the original next-up; should it still ship before M.4/M.5/M.6 work?

---

## §6 — Cleanup state

- **Production: 61 products. food_log_entries: 45 rows, 0 chains.**
- **Git: HEAD `e48c94d` (M.2)**. Pushed to main. Vercel deploy confirmed live (M.2 logic firing on banana NULL-hourly).
- **Working tree: clean.**

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_M2_LIVE.md
