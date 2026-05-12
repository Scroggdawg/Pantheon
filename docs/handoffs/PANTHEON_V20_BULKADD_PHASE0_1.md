# Greek God Bod pantry bulk-add — Phase 0

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code, no commits.

---

## §0 — Status

Pantry doc parsed empirically. **247 entries across 14 categories**, last category `RECIPE ANCHORS` (20 entries) routes to manual LLM-fill at /admin/pantry per V20's structural-flag confirmation. Auto-pick script architecture sketched; per-category auto-resolve prediction surfaced; smoke plan locked at LEAN PROTEINS (18 entries) first.

**Auto-pick targets 227 atomic-food entries.** Empirically expecting **180-210 = 79-93% auto-resolve**, leaving 17-47 for Luke's manual eyeball, plus 20 recipe anchors always manual.

**Script-context confirmed safe** (P0.5): the script calls `/api/admin/pantry/search` + `/save` via HTTP, never imports `lib/llm-fill/*` or other lazy-init-sensitive modules directly. The Gamma C F.1 lazy-init memory rule doesn't apply.

---

## §1 — Verbatim findings from pantry doc parse

### F.1 — Category structure (P0.1 confirmed)

```
14 categories, parsed by markdown ### headers + fenced code blocks:

  1.  LEAN PROTEINS                  18 entries  (auto-pick candidate)
  2.  SEAFOOD                         9 entries  (auto-pick candidate)
  3.  EGG / DAIRY                     9 entries  (auto-pick candidate)
  4.  VEGETABLES                     38 entries  (auto-pick candidate)
  5.  MEDITERRANEAN / GREEK PANTRY   20 entries  (auto-pick candidate)
  6.  MEXICAN / LATIN PANTRY         18 entries  (auto-pick candidate)
  7.  ASIAN PANTRY                   19 entries  (auto-pick candidate)
  8.  HERBS + SPICES                 24 entries  (auto-pick candidate)
  9.  CARBS                          15 entries  (auto-pick candidate)
  10. FATS                           17 entries  (auto-pick candidate)
  11. FRUITS                         19 entries  (auto-pick candidate)
  12. CONDIMENTS / DRESSING          12 entries  (auto-pick candidate)
  13. COOKING / SUPPORT               9 entries  (auto-pick candidate)
  14. RECIPE ANCHORS                 20 entries  (MANUAL — composites)

  Total                             247 entries
  Auto-pick target                  227 entries (categories 1-13)
  Manual fall-through                20 entries (category 14)
```

Parser plan: regex split on `^### ` headers; entries inside ```...``` code blocks; trim whitespace; filter blank lines. RECIPE ANCHORS detected by literal category name match.

### F.2 — Existing-library overlap risk

Per the pantry doc itself ("Existing 33 products in the library overlap minimally"), expected dedup-skip count is small. Likely culprits: Bananas, Eggs - Large, Magic Spoon, Yasso, Manuka Honey, Coconut Water (Goya/Harmless), Cottage Cheese, Bell Peppers, Strawberries — i.e., the 33 already-populated products.

V20's pantry doc avoids these largely (FRUITS category lists Lemon/Lime/Orange/etc. but NOT Bananas/Strawberries explicitly). Predict 1-3 dedup-skips total across 247.

### F.3 — Recipe anchors are unambiguous (P0 §A.2 confirmed)

20 entries under `### RECIPE ANCHORS (Luke's 20-recipe canon dishes themselves — saved as composites)`. Per V20's structural flag, the script routes all 20 to "needs-manual" with reason `composite-recipe`. Luke handles via /admin/pantry's LLM-fill manual-macros sub-form.

---

## §2 — Auto-pick script architecture (P0.2)

### Script: `scripts/bulk-add-greek-god-bod.ts`

```typescript
// Pseudocode shape; full implementation at EXECUTE time.

interface AutoPickConfig {
  pantryDocPath: string
  batchSize: number       // 25 (per V20 brief 20-30)
  overlapThreshold: number  // 0.5 — half of input tokens must appear in candidate
  apiBase: string         // process.env.EXPO_PUBLIC_API_BASE ?? 'https://pantheon.guru'
}

async function main() {
  const args = parseArgs()  // --category=<n> | --all | --dry-run | --limit=<n>
  const categories = parsePantryDoc(config.pantryDocPath)
  const cookie = await authenticate(process.env.PANTHEON_PASSWORD!)
  const userId = await fetchUserId(cookie)

  const targets = args.category
    ? [args.category]
    : Object.keys(categories).filter((c) => c !== 'RECIPE ANCHORS')

  for (const cat of targets) {
    const names = categories[cat]
    if (cat === 'RECIPE ANCHORS') {
      console.log(`[skip-composite] ${cat}: ${names.length} entries → manual LLM-fill`)
      continue
    }
    await processCategory(cat, names, cookie, userId, args)
  }
}

async function processCategory(cat, names, cookie, userId, args) {
  // Batch into chunks of 25 (per V20 brief)
  for (let i = 0; i < names.length; i += 25) {
    const batch = names.slice(i, i + 25)
    const search = await postSearch(cookie, batch)
    const picks: PickedRow[] = []
    const eyeball: { name: string; reason: string }[] = []
    const dedup: string[] = []

    for (const result of search.results) {
      if (result.already_exists) {
        dedup.push(result.input_name)
        continue
      }
      const pick = autoPickStrategy(result)
      if (pick) {
        picks.push(pick)
      } else {
        eyeball.push({ name: result.input_name, reason: classifyMiss(result) })
      }
    }

    if (!args.dryRun && picks.length > 0) {
      const saveResp = await postSave(cookie, userId, picks)
      logSaveResults(cat, batch, saveResp.results, eyeball, dedup)
    } else {
      logDryRun(cat, batch, picks, eyeball, dedup)
    }
  }
}
```

### Auto-pick strategy

```typescript
function autoPickStrategy(result: SearchResult): PickedRow | null {
  const inputTokens = tokenize(result.input_name)

  // Tier 1: USDA Foundation/FNDDS with non-null kcal + token-overlap
  const usdaResearchCandidates = result.usda.filter(
    (u) =>
      (u.data_type === 'Foundation' || u.data_type === 'Survey (FNDDS)') &&
      u.per_serving.kcal !== null,
  )
  for (const u of usdaResearchCandidates) {
    const candTokens = tokenize(u.description)
    if (overlapRatio(inputTokens, candTokens) >= 0.5) {
      return {
        source: 'usda',
        input_name: result.input_name,
        fdc_id: u.fdc_id,
        description: u.description,
        brand: u.brand,
        per_serving: u.per_serving,
      }
    }
  }

  // Tier 2: OFF with nutriscore + token-overlap (only if no USDA research-grade)
  if (usdaResearchCandidates.length === 0) {
    const offRanked = result.off.filter(
      (p) => p.nutriscore_grade && p.nutriscore_grade !== 'unknown',
    )
    for (const off of offRanked) {
      const candTokens = tokenize(`${off.brands ?? ''} ${off.product_name ?? ''}`)
      if (overlapRatio(inputTokens, candTokens) >= 0.5) {
        return {
          source: 'off',
          input_name: result.input_name,
          off_index: result.off.indexOf(off),
        }
      }
    }
  }

  return null  // → ambiguous, route to Luke's eyeball
}
```

### Token-overlap heuristic

```typescript
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'with', 'in', 'and', 'or'])

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  )
}

function overlapRatio(input: Set<string>, candidate: Set<string>): number {
  if (input.size === 0) return 0
  let intersection = 0
  for (const t of input) if (candidate.has(t)) intersection += 1
  return intersection / input.size
}
```

**Threshold 0.5 is starting value.** Empirical heuristic from manual cases I traced:
- "Chicken breast" vs "Chicken, broiler or fryers, breast, raw" → 2/2 = 1.0 ✓
- "Eye of round steak" vs "Beef, round, eye of round, separable lean only, raw" → 3/4 = 0.75 ✓ (steak token misses but acceptable)
- "Wild salmon fillet" vs "Fish, salmon, Atlantic, wild, raw" → 2/3 = 0.67 ✓
- "Fresh basil" vs "Basil, fresh, raw" → 2/2 = 1.0 ✓
- "Truly Random XYZ" vs "Oleocanthal-rich extra virgin olive oil…" → 0/3 = 0.0 ✗ (correctly skipped)

If smoke surfaces too many false-positive auto-picks at 0.5, raise to 0.6. Too many false-negatives (good matches missed), drop to 0.4. **Tunable.**

### Logged outcomes per row

```
auto-saved          → product_id returned + token-overlap passed Tier 1 (USDA) or Tier 2 (OFF)
needs-eyeball       → no candidate cleared the threshold
dedup-skip          → already_exists set (existing product matched)
composite-manual    → category === 'RECIPE ANCHORS' (skip without searching)
search-failed       → /search endpoint returned per-name error
save-failed         → /save endpoint returned status='failed' for that row
```

End-of-run summary:
```
=== Bulk-add summary ===
Categories processed: <N>
Total entries:        247
  auto-saved:         <X>  (<Y%>)
  needs-eyeball:      <X>  (<Y%>)
  dedup-skip:         <X>
  composite-manual:   20
  search-failed:      <X>
  save-failed:        <X>
Final library size:   33 + <auto-saved> = <total>
```

---

## §3 — Per-category auto-resolve prediction (P0.3)

Based on Gamma A (~60% USDA hit on 33 existing products) + Gamma B (~54% OFF hit on the 13 zero-coverage Branded items) + qualitative read of the doc:

| # | Category | Entries | Predicted auto-resolve | Predicted eyeball |
|---|---|---|---|---|
| 1 | LEAN PROTEINS | 18 | 15-17 (83-94%) — generics hit USDA Foundation reliably; some specific cuts (eye of round, sirloin tip) might fall through | 1-3 |
| 2 | SEAFOOD | 9 | 8-9 (89-100%) — all generic | 0-1 |
| 3 | EGG / DAIRY | 9 | 7-9 (78-100%) — Fage/Siggi's are well-curated on OFF; halloumi/ricotta on USDA | 0-2 |
| 4 | VEGETABLES | 38 | 32-36 (84-95%) — USDA Foundation has near-complete produce coverage | 2-6 |
| 5 | MED / GREEK | 20 | 14-17 (70-85%) — Kalamata/Castelvetrano olives have brand variations on OFF; tahini/hummus generic | 3-6 |
| 6 | MEXICAN / LATIN | 18 | 14-16 (78-89%) — most generic; chipotle in adobo is brand-sensitive | 2-4 |
| 7 | ASIAN PANTRY | 19 | 12-15 (63-79%) — soy sauce/tamari/mirin generic; gochujang/sriracha brand-sensitive; dashi/shiso esoteric | 4-7 |
| 8 | HERBS + SPICES | 24 | 20-22 (83-92%) — USDA broad spice coverage | 2-4 |
| 9 | CARBS | 15 | 13-14 (87-93%) — generic grains | 1-2 |
| 10 | FATS | 17 | 13-15 (76-88%) — oils + nuts generic; nut butters might hit OFF | 2-4 |
| 11 | FRUITS | 19 | 17-19 (89-100%) — all generic produce | 0-2 |
| 12 | CONDIMENTS / DRESSING | 12 | 10-12 (83-100%) — vinegars + mustards generic | 0-2 |
| 13 | COOKING / SUPPORT | 9 | 7-9 (78-100%) — broths + non-dairy milks generic | 0-2 |
| 14 | RECIPE ANCHORS | 20 | 0 (0%) — composites, all manual | 0 |
| | **TOTAL** | **247** | **182-212 = 74-86% auto-resolve** + **20 manual composites** | **17-45 eyeball** |

**Cumulative read:** session script handles 74-86% of the 247 (180-210 entries) without Luke's input. Luke handles 20 recipe anchors + 17-45 ambiguous via /admin/pantry. **Total Luke-touch: 37-65 entries vs 247.** Roughly 5x time savings vs manual-everything.

---

## §4 — Smoke plan (P0.4)

**Run on category 1 (LEAN PROTEINS, 18 entries) first.**

Rationale:
- Smallest of the high-priority categories
- Mostly generic-meat queries — USDA Foundation should be strong (predict 83-94%)
- Failures here (e.g., "Eye of round steak" doesn't auto-pick) are diagnostic for the token-overlap threshold
- Fast feedback loop: 18 entries × ~5s/entry HTTP cost = ~90s to run

**Sequence:**
1. **Dry-run first:** `npx tsx scripts/bulk-add-greek-god-bod.ts --category="LEAN PROTEINS" --dry-run`
   - Outputs what WOULD auto-save without writing
   - Surface picks + eyeball + dedup to V20 + Luke
2. **V20 review:** approve, tweak threshold, or override-pick on specific entries
3. **Live run:** drop `--dry-run`, write to products
4. **Spot-check via REST:** verify 5 random saved rows have expected fields populated
5. **Greenlight expansion:** Luke confirms "looks right" → run remaining 12 categories in waves

**Wave structure post-smoke (matching V20's pantry-doc session split):**
- **Wave 1 (high-priority):** SEAFOOD + VEGETABLES + MED/GREEK + MEXICAN = 85 entries
- **Wave 2 (medium-priority):** ASIAN + HERBS + CARBS + FATS + CONDIMENTS = 87 entries
- **Wave 3 (lower-priority):** FRUITS + COOKING SUPPORT = 28 entries
- **Manual at end:** RECIPE ANCHORS via /admin/pantry UI = 20 entries

Script supports running per-category OR per-wave OR all-at-once via flags. Recommend per-wave with eyeball break in between for Luke to spot-fix any wrong auto-picks.

---

## §5 — Script-context auth confirmation (P0.5)

**Confirmed safe.** The script:

1. Loads `.env.local` (script-top-level `loadEnvLocal()` per existing pattern in `scripts/replay-parse.ts` etc.)
2. Reads `PANTHEON_PASSWORD` + `NEXT_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_API_BASE` (or hardcoded `https://pantheon.guru`) from env
3. POSTs `/api/auth/login` with `{password}` → captures `Set-Cookie: pantheon_session=1` from response headers
4. Uses that cookie on all subsequent `/api/admin/pantry/search` and `/save` requests

**Lazy-init memory rule does NOT apply:**
- The script never imports `lib/llm-fill/portions.ts`, `lib/usda/portions.ts`, or `lib/off/search.ts` directly
- All API calls go through the HTTP boundary; the Vercel runtime initializes the SDK clients on the server side where env vars are always set pre-load
- `import { llmFillPortions }` would have triggered the hoist race; `fetch('/api/admin/pantry/save')` does not

**Auth target:**
- Local dev: `http://localhost:3000` (requires `npm run dev` running)
- Production: `https://pantheon.guru` (covers Luke's actual library; cookie auth works the same)

V20's call which to target. Recommend production for empirical Luke-impact (the saved rows go to Luke's actual products table). Local dev is fine for repeated dry-runs without API rate-limit concerns.

---

## §6 — Architectural calls / judgments / flags

### A.1 — Token-overlap threshold 0.5 is starting value

Tunable based on smoke. Acknowledged false-positive vs false-negative trade-off.

### A.2 — Auto-pick prefers USDA Foundation/FNDDS over OFF

Per Gamma B F.1 carry-forward in the pantry doc itself ("Generic foods → prefer USDA"). Script implements this strictly — only falls to OFF when USDA Foundation/FNDDS returned ZERO research-grade candidates.

This may produce slightly lower OFF auto-pick rates than expected, since branded foods (Fage yogurt, Castelvetrano olives) might have weak USDA generic matches that pass token-overlap, displacing the better OFF Branded match.

**Trade-off acknowledged.** Could refine: if USDA top match has token-overlap < 0.7 AND OFF top match has nutriscore + token-overlap > 0.7, prefer OFF. Adds complexity. Defer to smoke results — if smoke shows USDA over-eager picking, layer this in.

### A.3 — Recipe anchors skip-without-searching

Saves 20 search round-trips. The category is identifiable by literal name match before any HTTP work. Confirmed correct routing.

### A.4 — Dry-run mode is a hard requirement, not optional

Per V20 brief structure (smoke plan). Script must support `--dry-run` to preview picks + eyeball without writing. Implementation: short-circuit the `/save` call; print the would-be payloads.

### A.5 — Per-row error isolation

Search endpoint already does this (Gamma E). Save endpoint per-row failure tracking is already implemented (Gamma E). Script logs each row's outcome. Partial failures don't abort the wave.

### F.1 — Predicted false-positive risk on USDA Experimental dataType (Gamma E F.1 carry-forward)

The Tier 1 filter restricts to `Foundation` or `Survey (FNDDS)` — Experimental rows are excluded by data_type filter. **No additional handling needed.** Gamma E's existing search response includes data_type per candidate; my filter is strict.

### F.2 — Predicted token-overlap false-positive on USDA generic-vegetable matches

"Brown rice" might top-match "Rice, white, long-grain, regular, raw, unenriched" — token overlap is just "rice" / 2 = 0.5 (passes). But "Brown" is missed; the candidate is wrong type of rice.

**Mitigation:** the smoke phase will catch this. If common, raise threshold to 0.6 or add a "bonus" for token presence in candidate (positive overlap) — e.g., require ALL input tokens present.

### F.3 — No dedup edge case from Gamma E F.3 (case-insensitive exact-match) anticipated

V20's pantry doc avoids the 33 already-populated products; predicted 1-3 dedup-skips total. Strict ilike is fine here.

### F.4 — No disagreements with brief

Six asks, four edge cases surfaced. Script architecture is structurally clean; smoke-first approach is locked.

---

## §7 — Asks / greenlight requests

**A.1 — V20 confirms script architecture sketch (§2).** Auto-pick rules, token-overlap heuristic, batch-25, dry-run mode, per-row outcome logging.

**A.2 — V20 confirms 0.5 token-overlap threshold as starting value.** Tunable post-smoke.

**A.3 — V20 confirms Tier 1 (USDA Foundation/FNDDS) > Tier 2 (OFF + nutriscore) ordering.** Per Gamma B F.1 doctrine carry-forward; OFF only fires when USDA research-grade returns zero.

**A.4 — V20 confirms smoke target: LEAN PROTEINS (18 entries), dry-run first.** Surface picks + eyeball before live save.

**A.5 — V20 confirms target environment.** Production (`pantheon.guru` / `pantheon-woad.vercel.app`) vs local dev. Recommend production for Luke-empirical.

**A.6 — V20 confirms session split.** Per-category waves with eyeball-break between, OR all-at-once auto-run. Recommend per-wave.

**A.7 — Greenlight EXECUTE on the auto-pick script.** Once A.1-A.6 confirmed, write `scripts/bulk-add-greek-god-bod.ts` + run smoke on LEAN PROTEINS.

---

## §8 — Estimated turn count

EXECUTE estimate: **3-5 turns** total.

| Step | Turns |
|---|---|
| Write script (parser + auth + search + save + auto-pick + logging) | 1 |
| Smoke run on LEAN PROTEINS dry-run + surface to V20 | 1 |
| Tune threshold if needed; live run on LEAN PROTEINS + spot-check | 1 |
| Wave 1-3 runs across the remaining 12 categories | 1-2 |
| (Recipe anchors handled by Luke at /admin/pantry; not in script scope) | — |

If threshold tuning takes 1-2 iterations the count rises to 4-5 turns. Tight scope; mature primitives.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_PHASE0_1.md
