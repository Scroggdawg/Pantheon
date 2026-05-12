# Op FASTRAK Brick Gamma E — Phase 0 recon

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code, no commits, no migrations.

---

## §0 — Status

Recon complete. **Auth gating confirmed working as expected** (no proxy.ts change needed). **Provisions inline-pattern partly false** — Provisions extracts sub-components for complex views; for Gamma E MVP, inline is still right but row component should live in `components/admin/` if it grows past ~150 lines. Three architectural recommendations:

1. **Server-batch search endpoint** (V20's option (a)) per security + central retry/backoff need
2. **Vertical row list** with collapsible candidate sections (best for paging through 50 rows)
3. **Inline manual macro entry** when LLM-fill picked (V20's option (b)) — 5 fields per row when triggered

**Refined turn estimate: 6-7 turns** (lower bound of V20's 5-7, more likely upper). Greenfield admin route + 4 candidate states + manual-macro fallback adds modest complexity beyond the simplest possible.

---

## §1 — Verbatim source for files referenced

### proxy.ts (full file already read; key gating lines)

```typescript
// Lines 28-31 — Public routes never gate
if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
  return NextResponse.next()
}

// Lines 34-60 — Native API routes via shared-secret header
if (NATIVE_ROUTES.includes(pathname)) { ... }

// Lines 62-65 — Catch-all cookie auth (THIS IS WHAT GATES /admin/*)
if (request.cookies.get('pantheon_session')?.value === '1') {
  return NextResponse.next()
}

// Lines 67-70 — Otherwise → /login redirect
const url = request.nextUrl.clone()
url.pathname = '/login'
return NextResponse.redirect(url)

// Lines 73-77 — Matcher matches everything except _next assets + static files
matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)']
```

### app/provisions/page.tsx (top 20 lines + structure observation)

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import MarbleBackground from '@/components/ui/MarbleBackground'
import SectionDivider from '@/components/ui/SectionDivider'
import { AddRecipePanel } from '@/components/provisions/AddRecipePanel'  // ← extracted
import PlanView from '@/components/provisions/PlanView'                  // ← extracted
import type { Recipe } from '@/types/database'
```

201 lines total. **Provisions is NOT fully inline** — it imports `AddRecipePanel` + `PlanView` from `components/provisions/*`. V20's Phase 0 §A.2 framing ("Provisions is the inline-everything pattern to mirror") is slightly off: Provisions extracts components when they have non-trivial state machinery. For Gamma E MVP, inline is still acceptable — but if the row component grows beyond ~150 lines, extract to `components/admin/PantryRow.tsx`.

### hooks/useUser.ts

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { User } from '@/types/database'

export function useUser() {
  // fetches /api/user once on mount
  return { user, userId, loading }
}
```

Reusable for Gamma E. Fits the "single-tenant authed = Luke" model.

### lib/usda/portions.ts + lib/off/search.ts signatures

```typescript
// USDA (Gamma A)
export async function usdaResolveFdcId(name: string, brand: string | null | undefined): Promise<number | null>
export async function usdaFetchPortions(fdcId: number): Promise<UnitAlternative[]>

// OFF (Gamma B)
export async function offTextSearch(query: string, brand: string | null | undefined, limit?: number): Promise<OffProduct[]>
export async function offProductDetail(barcode: string): Promise<OffProduct | null>

// LLM-fill (Gamma C)
export async function llmFillPortions(name: string, brand: string | null): Promise<UnitAlternative[]>
```

All three are async functions importable from a server route. Gamma E's batch endpoint composes `offTextSearch` + `usdaResolveFdcId` (then optionally `usdaFetchPortions` for the picked candidate's full portion data) + `llmFillPortions` (lazy fall-through).

### app/admin/* + app/api/admin/*

```
app/admin → does not exist (greenfield)
app/api/admin → does not exist (greenfield)
```

No prior route patterns to consult or conflict with.

---

## §2 — Architectural recommendations

### A.1 — proxy.ts /admin/* gating (P0.1 confirmed)

**No proxy change needed.** /admin/pantry will fall through to the `pantheon_session=1` cookie check at proxy.ts:63. Single-tenant auth works as designed.

The matcher config includes /admin/* (excludes only static assets). Cookie present → pass through. Cookie absent → /login redirect. Standard.

**Watch-for:** if Gamma E's API endpoint (`POST /api/admin/pantry/search`) is callable from native, add it to NATIVE_ROUTES. **Not needed for MVP** — Gamma E is browser-only (Luke's bulk-add session at /admin/pantry on desktop or laptop). If iPhone needs the same surface someday, add then.

### A.2 — Search execution shape: SERVER BATCH ENDPOINT (V20's option (a))

**Recommend `POST /api/admin/pantry/search`** with body `{ names: string[] }` returning per-name results.

**Reasoning:**
1. **USDA + OFF run server-side regardless** (`USDA_FDC_API_KEY` env var; OFF user-agent header). Client can't call them directly.
2. **Centralizes OFF retry/backoff logic** per Gamma B F.2 carry-forward. Single location for rate-limit handling.
3. **Single round-trip** from client (cleaner UX during loading).
4. **Server-side dedup-against-existing-products** (P0.6) co-locates with the search: server checks products table while it fans out, returns "already_exists" flag per name.
5. **Future Brick K barcode reuse:** server endpoint pattern transfers to a barcode batch search later.

**Endpoint shape:**

```typescript
POST /api/admin/pantry/search
Body: { names: string[] }
Response: {
  results: Array<{
    input_name: string
    already_exists?: { product_id: string, existing_name: string }  // dedup hit
    off: OffProduct[]   // top 3
    usda: Array<{       // top 3
      fdc_id: number
      description: string
      data_type: string
      per_serving: { kcal, protein, carbs, fat }
    }>
    error?: string      // per-row failure reason; allows row-level retry
  }>
}
```

Server runs `Promise.all` over names × {USDA, OFF, dedup-check} = 3N parallel sub-tasks. For 10 names: 30 parallel queries. Modest fan-out; both APIs handle it.

**Per-name error isolation:** if OFF fails for name 5 of 10, the result for name 5 still returns USDA + dedup data; OFF section shows error string. UI surfaces "OFF lookup failed; retry?" affordance.

### A.3 — Per-row component shape (P0.4)

**Vertical list. Each row is a card. Default-collapsed past row 5 (paging optimization).**

Sketch:

```
┌──────────────────────────────────────────────────────────┐
│ "Chicken breast"                       [pending → loaded] │
│ ─────────────────────────────────────────────────────────│
│ Already in library? — no                                  │
│                                                           │
│ OFF candidates (2):                                       │
│   ○ Chicken breast (Trader Joe's)                         │
│       95 cal · 21P · 0C · 1F per 85g · medium             │
│   ○ Boneless skinless chicken breast (Foster Farms)       │
│       110 cal · 23P · 0C · 1.5F per 100g · low            │
│                                                           │
│ USDA candidates (1):                                      │
│   ○ Chicken, broiler or fryers, breast, raw (Foundation)  │
│       110 cal · 23.1P · 0C · 1.7F per 100g · high         │
│                                                           │
│ [LLM-fill instead]   [Skip this row]                      │
└──────────────────────────────────────────────────────────┘
```

Per-row state:
```typescript
interface PantryRow {
  inputName: string
  status: 'pending' | 'loaded' | 'picked' | 'skipped' | 'saving' | 'saved' | 'failed'
  alreadyExists?: { product_id, existing_name }
  off: OffProduct[]
  usda: UsdaCandidate[]
  picked: { source: 'off' | 'usda' | 'llm', index?: number, manualMacros?: ManualMacros }
  error?: string
}
```

When `picked.source === 'llm'`, the row expands a sub-form with 5 inline inputs (serving_size_g, cal, P, C, F).

When `alreadyExists` is set, row shows "Already in library: <link to product>" + Save action disabled for that row.

When OFF + USDA both empty AND not already_exists, row defaults to "LLM-fill mode" with the inline-macros sub-form auto-revealed.

Row layout extracted to `components/admin/PantryRow.tsx` if it grows past ~150 lines; otherwise inline in the page is fine.

### A.4 — LLM-fill without macros: INLINE MANUAL ENTRY (V20's option (b))

**Recommend (b) — manual macro entry inline when LLM-fill picked.**

When Luke clicks "LLM-fill instead", the row's sub-form appears:

```
LLM-fill mode for "Chicken breast":
  Serving size (g): [____]
  Calories per serving: [____]
  Protein per serving (g): [____]
  Carbs per serving (g): [____]
  Fat per serving (g): [____]
  [Save with LLM-fill]   [Cancel]
```

On save, the row's INSERT path:
1. Calls `llmFillPortions(name, brand)` (Gamma C) for unit_alternatives
2. Combines with manual macros for the per_serving fields
3. INSERTs the products row

Trade-off: 5 fields of typing per LLM-fill row vs the alternative (a) "disable LLM-fill if no USDA/OFF match." (a) forces Luke through SaveMealModal + Delta editor for truly-unknown foods, fragmenting the bulk-add session. (b) keeps everything in one screen.

**~30 extra lines of code** for the manual-macro sub-form. Worth it for Luke's UX.

**V20's option (c) — extending Gamma C prompt to generate macros — explicitly rejected per V20 brief P0.5.** Out of Gamma E scope.

### A.5 — De-dup detection at search time (V20's option (c))

**Recommend (c) — server-side check during search, surface badge per row, skip save for that row.**

Implementation in batch search endpoint:
```typescript
// Per name:
const dedupKey = name.toLowerCase().trim()
const { data: existing } = await supabase
  .from('products')
  .select('id, name')
  .ilike('name', dedupKey)
  .limit(1)
  .maybeSingle()
if (existing) result.already_exists = { product_id: existing.id, existing_name: existing.name }
```

UI:
- Row header shows "Already in library: <link>" badge
- Pick / Save controls disabled for that row
- Luke can still review the candidates (educational; e.g., "I can see Bananas exists as the Foundation entry")

Trade-off: an extra Supabase query per name (33 calls for 33 names × name lookups against 33-row table = 1089 row scans, all from a tiny in-memory cache). Negligible cost.

### A.6 — UI edge cases (P0.7)

| Case | Handling |
|---|---|
| Empty paste | "Search" button disabled |
| Single line | Works the same as multi-line (length=1) |
| Blank lines / leading whitespace | Trim + skip blanks before sending to server |
| OFF + USDA both 0 candidates | Row defaults to LLM-fill mode with manual-macros sub-form auto-revealed |
| Network failure (whole batch) | "Search failed: <error>" banner; Retry button re-fires the whole batch |
| Per-name failure within batch | Server returns `error` field for that row; UI shows row-level "Retry this row" affordance |
| Save partial success | Server returns success/failure per row; UI flips status badge per row; Luke can retry failed rows |
| Save with all rows skipped | "Nothing to save" message + Save button disabled |
| Search after rows already loaded | Either: re-search overwrites all OR appends new rows to the list. **Recommend: append.** Luke might paste a second batch while reviewing the first. |

### A.7 — Component organization

Recommend:
- `app/admin/pantry/page.tsx` — main client page component, useState for rows array, fetch wrappers for /search and /save endpoints
- `components/admin/PantryRow.tsx` — extracted IF the row component grows past ~150 lines (likely); inline first, refactor on commit if too long
- `app/api/admin/pantry/search/route.ts` — POST batch search endpoint
- `app/api/admin/pantry/save/route.ts` — POST bulk save endpoint (or `app/api/admin/pantry/route.ts` with method routing)

Server-route auth via cookie check at proxy.ts level (no shared-secret needed since admin routes are browser-only). Skip NATIVE_ROUTES inclusion for now.

### A.8 — Insert path on Save (P0.5 / mappers)

For each picked row, build a ProductInsert based on source:

| Source | Macros source | unit_alternatives source | barcode | fdc_id |
|---|---|---|---|---|
| OFF | `nutriments_serving` | `[{unit, grams, source: 'off', confidence}]` from serving_size + nutriscore | OFF code | NULL |
| USDA | `foodNutrients` (per-serving derived) | `usdaFetchPortions(fdc_id)` | NULL | recovered fdc_id |
| LLM-fill | manual entry from Luke | `llmFillPortions(name, brand)` (cap at medium) | NULL | NULL |

All three set `fulfillment_source: 'manual'`. unit_alternatives_updated_at = now().

Bulk INSERT via `supabase.from('products').insert([row1, row2, ...]).select()`. Single roundtrip; partial-failure handling via per-row error inspection.

---

## §3 — Asks / greenlight requests

**A.1 — V20 confirms server-batch endpoint shape (per §2 A.2).** POST /api/admin/pantry/search with `{names}` body, response includes per-name OFF + USDA candidates + already_exists flag.

**A.2 — V20 confirms vertical-list row layout (per §2 A.3).** Cards collapsible past row 5; LLM-fill expands inline macro sub-form when picked.

**A.3 — V20 confirms LLM-fill inline manual-macros entry (per §2 A.4).** 5 fields per LLM-fill row; ~30 extra lines of code.

**A.4 — V20 confirms server-side dedup detection at search time (per §2 A.5).** Per-name ilike lookup against products; surface "Already in library" badge; skip save for those rows.

**A.5 — V20 confirms component organization (per §2 A.7).** Inline first; extract `PantryRow.tsx` if row component exceeds ~150 lines.

**A.6 — V20 confirms 6-7 turn refined estimate (per §2 P0.8 below).**

**A.7 — Greenlight Gamma E EXECUTE.** Once A.1-A.6 confirmed.

---

## §4 — Refined turn count (P0.8)

V20's 5-7 estimate. My refinement: **6-7 turns** (closer to upper bound).

| Sub-step | Turns | Notes |
|---|---|---|
| E.1 — admin route shell + auth smoke | 1 | New page route, render skeleton, verify cookie auth flow lands on the page |
| E.2 — server batch search endpoint (`/api/admin/pantry/search`) | 1-2 | Fans out USDA + OFF + dedup per name; per-name error isolation; rate-limit-friendly Promise.all |
| E.3 — row component + candidate display | 1-2 | Vertical list, collapsible cards, candidate radio buttons, status badges |
| E.4 — LLM-fill inline manual-macros + de-dup detection wiring | 1 | Sub-form for manual entry; dedup badge rendering |
| E.5 — save bulk-INSERT path (`/api/admin/pantry/save` or method on /search route) | 1 | Per-row source-aware ProductInsert builder; bulk INSERT with per-row success tracking |
| E.6 — smoke + commit + handoff | 1 | Paste 3-5 names; pick + save; verify products rows + spot-check |

**Total: 6-7 turns.** Sub-step costs depend on whether candidate-row component stays inline or extracts mid-EXECUTE.

---

## §5 — Plan re-evaluation

V20's brief framing was substantively right. Two refinements emerged:

1. **Provisions is NOT pure inline** — it extracts AddRecipePanel/PlanView for non-trivial sub-components. Gamma E follows the same logic — start inline, extract `PantryRow.tsx` if it grows. Doesn't change the architectural call, just the rationale.

2. **Server-batch endpoint is structurally required** (not just preferred) because USDA + OFF API keys/headers are server-side. V20's option (b) "client-side parallel fetch" was never actually viable — client can't reach those APIs directly without exposing keys. Surfacing this so the locked decision (server-batch) reflects the real constraint, not just a preference.

---

## §6 — Carry-forwards / related open items

- **Gamma C F.1 (lazy-init)**: lib/llm-fill/portions.ts uses lazy-init. Importing it from the route handler is route-context (Vercel runtime, env always set). Should work fine. Verify in E.4 smoke.
- **Gamma B F.2 (OFF flakiness)**: server-batch endpoint centralizes retry/backoff. Existing 1-retry pattern in lib/off/search.ts continues to apply per-name.
- **Brick K (post-FASTRAK)**: candidate-picker pattern reusable. Extract `PantryRow.tsx` THEN if not earlier.
- **Brick Beta inputs queued (Alpha.6 closeout)**: F.1, F.3, F.4 — none affect Gamma E scope.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMAE_PHASE0_1.md
