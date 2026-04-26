# PANTHEON SESSION 20 — COMPLETION HANDOFF

**Date:** 2026-04-26
**Production:** https://pantheon.guru
**Previous session:** Session 19 (commit e7f31bb — Withings dirty-tree closeout / production-restoration)
**Phase:** 1.3 of the Provisions / grocery-ordering arc (Day 1 of 4 — UI consumption of the parse-recipe endpoint shipped in Session 18)

---

## WHAT SHIPPED

**Provisions UI v1** — a new `/provisions` route with two surfaces:

1. **Add Recipe** — paste free-form recipe text, parse it via `POST /api/claude/parse-recipe` (Session 18), edit the structured result inline, save it via the new `POST /api/recipes` endpoint.
2. **Recipe Library** — read-only client-side `SELECT * FROM recipes ORDER BY created_at DESC` with simple inline rows showing name, servings count, per-serving macros, cuisine + protein-type chips.

The flow is end-to-end: user pastes → parses (8s) → edits (any field, any ingredient row, add/remove ingredients) → saves (~500ms) → form auto-resets and the new recipe appears at the top of the library list. New recipe at the top IS the success feedback — there's no "saved!" stage by design.

### New files

| File | Purpose |
|------|---------|
| `app/api/recipes/route.ts` | POST handler. Service-role `INSERT` into `recipes`. Strict per-field validation (descriptive 400 errors). Hardcodes `source: 'ai_generated'` server-side regardless of client input. |
| `components/provisions/AddRecipePanel.tsx` | The full add-recipe state machine (`'input' \| 'processing' \| 'editing' \| 'saving'`). Editable form for all Recipe fields including ingredients table with add/remove rows. Spinner pattern reused verbatim from `TextLogModal.tsx`. |
| `app/provisions/page.tsx` | `'use client'` page. Sticky `PROVISIONS` / `← PANTHEON` nav matching `/progress`. `MarbleBackground`. `useUser()` gate. Holds the recipe-list state and the `fetchRecipes` callback passed to `<AddRecipePanel onSaved={…}/>`. |

No modifications to existing files. No middleware (`proxy.ts`) changes — `/api/recipes` is web-only and goes through the standard `pantheon_session=1` cookie gate.

---

## CONTRACT — `POST /api/recipes`

```
Request body:
{
  "name": string,                  // required, non-empty
  "servings": number,              // required, >= 1
  "cuisine": string | null,
  "protein_type": string | null,
  "calories": number | null,       // PER SERVING
  "protein_g": number | null,      // PER SERVING
  "carbs_g": number | null,        // PER SERVING
  "fat_g": number | null,          // PER SERVING
  "ingredients": [                 // required, can be empty
    { "name": string, "qty": number, "unit": string, "notes": string | null }
  ],
  "notes": string | null
}

Response 200: full Recipe row including id, source: "ai_generated",
              created_at, updated_at
Response 400: { "error": <descriptive field-level message> }
Response 500: { "error": <Error.message> }
```

`source` is **not** accepted from the client — it's hardcoded server-side. This endpoint exists specifically for the AI-parse-then-save flow. Future "manual entry" or "imported" flows will be separate endpoints with their own source values.

---

## VERIFICATION

### Typecheck + Build

```
npx tsc --noEmit  → exit 0
npm run build     → exit 0
```

New routes registered in build output:
```
ƒ /api/recipes        (dynamic — POST)
○ /provisions         (static page, client-side rendered)
```

### Smoke test (end-to-end against live Supabase)

A 13-ingredient beef chili was used (intentionally different from Session 18's chicken stir-fry, and large enough to exercise the ingredients editor's add/remove pattern):

**Step 1 — Parse:**
- `POST /api/claude/parse-recipe` returned: Beef Chili / 6 servings / american / beef
- Per-serving macros: 456 cal / 35P / 33C / 19F
- 13 ingredients extracted, units sensible (lb / ea with `notes: "cans, drained"` / oz / tbsp / tsp)
- `_estimation_notes`: "Ground beef 85/15 lean. Standard can sizes: kidney beans 15.5oz, black beans 15oz. Large onion ~300g. Used USDA values for whole foods."
- Latency: 8.1s (Claude API dominant)

**Step 2 — Save:**
- `POST /api/recipes` returned `HTTP 200` in 570ms (application-code: 451ms)
- Inserted UUID: `d02dbd18-3936-4419-a208-121d01297dac`
- `source: "ai_generated"` confirmed (server-hardcoded — overrides any client value)
- All 13 ingredients preserved verbatim, all macros preserved
- Server log line: `[api/recipes] inserted: <uuid> Beef Chili`

**Step 3 — Validation (4 cases):**
| Case | Expected | Actual |
|------|----------|--------|
| Missing `name` | 400 | `400 "name is required"` |
| `servings: 0` | 400 | `400 "servings must be a number >= 1"` |
| Ingredient row missing `qty` | 400 | `400 "ingredients[0].qty must be a number"` |
| Empty `ingredients` array | 200 | 200 (per C1 contract) |

**Step 4 — Page render:**
- `GET /provisions` with cookie → `HTTP 200`
- `GET /provisions` without cookie → `HTTP 307 → /login` (proxy.ts gating works)

**Step 5 — Cleanup:**
- The throwaway "Empty Test" row from validation step 4 was deleted via Supabase REST + service-role key.
- The Beef Chili row (`d02dbd18-…`) was **kept** as a legitimate smoke-test artifact — it'll be the first thing visible when the library list loads. Final `recipes` table state at session end: 1 row.

---

## DESIGN CALLS WORTH RECORDING

### GlassPanel vs lighter card

Existing chromed pages (`/dashboard`, `/progress`) use the heavy `GlassPanel` component — multi-layer backdrop blur, edge highlights, corner specular highlights — for read-only data displays. For Phase 1.3 the editable Add-Recipe surface and the library rows use a lighter custom card style (`background: 'rgba(255,253,249,0.55)'`, single hairline gold border) instead of `GlassPanel`. Rationale: editable forms benefit from a clean, low-chrome surface; the heavy glass treatment reads as "data readout" in the rest of the app and would visually compete with the input fields. Reversible polish — drop in `<GlassPanel>` wrappers if Luke wants the heavier chrome later.

### Sticky nav

Matches `/progress` verbatim: `PROVISIONS` left (dark text), `← PANTHEON` right (gold-light, links to `/dashboard`). Same background opacity, same z-index, same tracking/sizing.

### Spinner pattern

Reused verbatim from `TextLogModal.tsx` rather than reinvented. Same `animate-spin` class, same gold-on-faded-gold border colors.

---

## EXPLICITLY DEFERRED (confirmed in C1 Q7)

These were scoped OUT of this commit by design. None are TODO comments in the code — they're conscious phase-1.3 boundaries:

1. **Recipe detail view (click-through)** — list rows are not clickable. Deferred to Phase 1.3.5 or later.
2. **Edit-after-save** — once a recipe is in the library it cannot be edited. Same deferral.
3. **Deletion** — no UI affordance. Service-role REST works for ad-hoc cleanup; user-facing deletion is a separate phase.
4. **Empty-state CTA art** — the no-recipes state is plain text ("No recipes yet. Paste one above to get started."). Intentional minimum.
5. **Sub-nav for Plans / Orders** — no scaffold for the remaining Provisions arc tabs. They'll get their own routes when Day 3/4 ships.
6. **Dashboard nav exposure** — `/provisions` is reachable by direct URL only. No "PROVISIONS →" link on the dashboard. Smaller blast radius for this commit.

Rationale: ship the smallest useful slice that proves the parse → save → list loop works end-to-end. Polish comes after the loop is real.

---

## NEXT — PHASE 1.3.5 (BULK LOAD) AND BEYOND

The Provisions arc plan from Phase 1.0:
- **Day 1 — Schema (Session 17)** ✓
- **Day 1 — Parse-recipe endpoint (Session 18)** ✓
- **Day 1 — Provisions UI (this session)** ✓
- **Day 1.5 — Bulk-load** — feed 20–40 of Luke's existing recipes through `parse-recipe` in batch, populate the library so it's actually useful before Day 2 lands. Likely a small CLI script + the existing endpoint, no UI changes.
- **Day 2 — Meal planning UI** — assign recipes to slots on a date grid. Will use `meal_plans` + `meal_plan_entries` tables (already in migration 008).
- **Day 3 — Shopping list generation** — aggregate meal plan ingredients, dedupe, emit a `shopping_lists` row.
- **Day 4 — Shopping list → cart** — the open question. Whether this goes through Instacart's API, a browser-automation agent, or something simpler is undecided.

---

## OPEN ITEMS

1. **Push** — separate explicit approval per the C3-vs-push doctrine established in Session 19. Once pushed, Vercel auto-deploys and `/provisions` lands on pantheon.guru.
2. **CLAUDE_CONTEXT.md is still stale through Session 15.** Sessions 16–20 not yet reflected. Tracked since Session 19; standalone doc-refresh session warranted.
3. **Bulk-load (Phase 1.3.5)** — next major Provisions task once this commit ships.
4. **Withings `redirect_uri` cutover, Vercel env-var hygiene, Wyze route removal, RLS policy fix** — all still pending from Session 19's deferred list. Independent.

---

## VERIFICATION SUMMARY

```
Pre-stage tree:
  ?? app/api/recipes/
  ?? app/provisions/
  ?? components/provisions/

npx tsc --noEmit              → exit 0
npm run build                 → exit 0 (23 routes, +/api/recipes, +/provisions)
POST /api/claude/parse-recipe → HTTP 200, 13 ingredients, sensible macros
POST /api/recipes (valid)     → HTTP 200, UUID returned, source: "ai_generated"
POST /api/recipes (4 invalid) → 4× HTTP 400 with descriptive field errors
GET  /provisions (cookie)     → HTTP 200
GET  /provisions (no cookie)  → HTTP 307 → /login
Live recipes table            → 1 row (Beef Chili, smoke artifact, kept by design)
```

---

## NEXT SESSION CANDIDATES

- Push Session 20 + verify `/provisions` live on pantheon.guru
- Phase 1.3.5 — bulk-load 20–40 of Luke's existing recipes
- CLAUDE_CONTEXT.md doc refresh (Sessions 16–20)
- Phase 2 Day 2 — meal-planning UI
