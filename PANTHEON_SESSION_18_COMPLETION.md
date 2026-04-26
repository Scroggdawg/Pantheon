# PANTHEON SESSION 18 — COMPLETION HANDOFF

**Date:** 2026-04-26
**Production:** https://pantheon.guru
**Previous session:** Session 17 (commit c0ac989 — Phase 1.1 Provisions schema)
**Phase:** 1.2 of the Provisions / grocery-ordering arc (Day 1 of 4)

---

## ⚠️ ACTION REQUIRED AFTER MERGE

**Vercel must redeploy for the `proxy.ts` `NATIVE_ROUTES` change to take effect in production.** Until redeploy lands, calls to `POST /api/claude/parse-recipe` from the native app (or any client passing the `x-pantheon-native-secret` header instead of the cookie) will be 307-redirected to `/login` and behave like the pre-Session-16 native bug.

The endpoint code itself is reachable via cookie auth immediately (no middleware change needed for browser callers), so the Phase 1.3 web UI work won't block on the redeploy. Only native + secret-header traffic does.

---

## WHAT WAS BUILT

A new `POST /api/claude/parse-recipe` endpoint that takes free-form recipe text and returns structured per-serving nutrition data ready to insert into the `recipes` table created in Session 17. The endpoint matches the response shape of the `Recipe` interface (minus the DB-managed `id`, `source`, `created_at`, `updated_at` fields — caller sets `source` based on context).

### Endpoint contract

```
POST /api/claude/parse-recipe

Request body:
{
  "text": string,         // required — raw recipe text, paste, or dictation
  "hint_name"?: string    // optional — pre-known recipe name override
}

Response 200 (top-level, no wrapper):
{
  "name": string,
  "servings": number,
  "cuisine": string | null,
  "protein_type": string | null,
  "calories": number | null,           // PER SERVING
  "protein_g": number | null,          // PER SERVING
  "carbs_g": number | null,            // PER SERVING
  "fat_g": number | null,              // PER SERVING
  "ingredients": [
    { "name": string, "qty": number, "unit": string, "notes": string | null }
  ],
  "notes": string | null
}

Response 400: { "error": "text is required" }
              { "error": "hint_name must be a string when provided" }
Response 500: { "error": <Error.message> }
```

### Implementation notes

- **Two-file split** matches the established pattern across `parse-meal`, `parse-workout`, and `parse-workout-image`: thin route file + lib function. Route validates inputs and shapes the response; lib owns the system prompt + Anthropic SDK call + JSON extraction.
- **Model:** `claude-sonnet-4-20250514` — same as the other three parse endpoints. Consistency over chasing newer models mid-arc.
- **`max_tokens: 1500`** — between `parse-meal` (1000, no exercise sets) and `parse-workout-image` (3000, hand-written workout cards). No truncation observed in smoke test.
- **Structured output: prompted JSON** — matches existing endpoints. No tool use, no `response_format`. System prompt declares "Return ONLY valid JSON, no preamble, no markdown fences" + provides exact JSON shape; defensive code strips fences and `JSON.parse`'s.
- **AI-quality hardening** baked into the prompt:
  - "per serving" / "PER SERVING" appears 8 times across role description, math instructions, JSON schema field comments, and a closing reminder
  - Explicit two-step math instruction: "compute total first, then divide by servings"
  - Self-attention nudge: "returning the total instead of the per-serving value is the most common failure mode for this task — be vigilant"
  - Ambiguous quantities ("a pinch", "to taste") → `qty: 0` + `unit: "to_taste"` + preserved in ingredients array with original phrasing in `notes`
- **`_estimation_notes` debugging field**: Claude returns it in the JSON; the route logs it via `console.log('[parse-recipe] estimation_notes:', ...)` for dev console + Vercel function log visibility, then `delete`s it before returning so the API contract matches the spec exactly. Visible to operators, invisible to callers.
- **`hint_name` handling**: when provided, prepended to the user message as `User has named this recipe: "<X>"\n\n<text>` so Claude can incorporate it without needing a separate prompt branch.
- **`proxy.ts` `NATIVE_ROUTES`**: appended `/api/claude/parse-recipe` after `parse-workout-image` and before `withings/sync` (build-order convention; smaller diff than re-sorting alphabetically).

---

## NEW/MODIFIED FILES (in this commit)

```
app/api/claude/parse-recipe/route.ts   NEW       — thin route shell
lib/claude/recipe.ts                    NEW       — system prompt + parseRecipe()
proxy.ts                                MODIFIED  — appended parse-recipe to NATIVE_ROUTES
PANTHEON_SESSION_18_COMPLETION.md       NEW       — this file
```

The pre-existing dirty tree (`app/dashboard`, `app/progress`, `CLAUDE_CONTEXT.md`, `types/database.ts` `WeightSource` change, untracked `supabase/migrations/006_withings_tokens.sql`, `007_weight_source_withings.sql`, Withings app routes, Withings progress components, Sessions 12–15 completion docs, `PANTHEON_WARP_HANDOFF.md`) is **OUT OF SCOPE** for this commit and remains exactly as it was at session start. The Withings closeout is still tracked as a separate open item from Session 17.

---

## VERIFICATION

### TypeScript

```
npx tsc --noEmit
```

Exits 0, no output.

### Smoke test (local dev)

Dev server bound to `:3001` (port 3000 was in use by another process; production / Vercel unaffected). Request issued via curl with the `x-pantheon-native-secret` header to validate both the endpoint and the new `proxy.ts` `NATIVE_ROUTES` entry end-to-end:

```bash
SECRET=$(grep '^PANTHEON_NATIVE_SHARED_SECRET=' .env.local | cut -d= -f2-)
curl -sS -X POST http://localhost:3001/api/claude/parse-recipe \
  -H 'Content-Type: application/json' \
  -H "x-pantheon-native-secret: $SECRET" \
  -d '{"text":"Chicken stir fry. Serves 2. Pound and a half of chicken
       breast cut into strips, two cups broccoli, one red bell pepper
       sliced, three cloves garlic, two tablespoons soy sauce, one
       tablespoon sesame oil, salt and pepper to taste. Cook chicken
       in oil, add veg, sauce at the end."}'
```

HTTP 200 in 6.6s (Claude API latency dominant; `next.js: 168ms`, `proxy.ts: 78ms`, `application-code: 6.4s`).

### Ground truth comparison (per Luke's logging history)

| Field      | Ground Truth | Response | Delta   |
|------------|--------------|----------|---------|
| servings   | 2            | 2        | exact   |
| calories   | ~420         | 447      | +6.4%   |
| protein_g  | 52           | 55.5     | +6.7%   |
| carbs_g    | 14           | 12.5     | -10.7%  |
| fat_g      | 17           | 18.5     | +8.8%   |

All within ±11%, slight conservative overestimate. Macros came back PER SERVING — the prompt's two-step math instruction and self-attention warning held; no total/per-serving conflation.

### Other smoke-test confirmations

- Top-level response shape (no `{ recipe: ... }` wrapper) matches the locked C1 contract.
- `_estimation_notes` stripped from the API response, logged to server console with `[parse-recipe] estimation_notes:` prefix as designed.
- All 8 ingredients extracted including salt + pepper as `qty: 0, unit: "to_taste"`.
- Unit normalization handled the natural-language input cleanly: "Pound and a half" → `1.5 lb`, "two tablespoons" → `2 tbsp`, "two cups" → `2 cups`, "three cloves garlic" → `qty: 3, unit: "ea", notes: "cloves"`.
- `cuisine: "asian"` and `protein_type: "chicken"` inferred correctly.
- The new `NATIVE_ROUTES` entry validated end-to-end (request passed through with valid secret; would 401 on mismatch per the proxy.ts behavior matrix from Session 16).

This baseline is **the regression reference** for any future modifications to the `RECIPE_PARSER_SYSTEM_PROMPT` constant in `lib/claude/recipe.ts`. If the prompt is ever changed, re-run this exact recipe and compare — drift beyond ±15% on any single macro warrants prompt review.

---

## POLISH BACKLOG (non-blockers)

1. **Conservative-estimate scoping.** The prompt's "for brand-name or restaurant-style items, use conservative estimates (slightly overestimate)" guidance fired on a home-cooked recipe in the smoke test, contributing to the +6–9% bias on calories/protein/fat. Over 21 meals/week this compounds. If Luke's logged intake starts trending high vs. plan targets in Phase 2+, revisit the prompt to scope the "conservative" framing only to detected restaurant/brand-name context. Not a correctness issue; tracking concern.

2. **Approved unit set expansion.** "Three cloves garlic" came back as `qty: 3, unit: "ea", notes: "cloves"`. Semantically right but the unit-adjective lives in `notes`. Adding `cloves`, `slices`, `sprigs`, etc. to the approved unit list in the prompt would land them on the `unit` field directly. Schema accepts free-form strings, so this is style, not correctness.

3. **DRY helper across parse endpoints.** Now that 4 endpoints (`parse-meal`, `parse-workout`, `parse-workout-image`, `parse-recipe`) all share the "model + max_tokens + system + messages.create + strip fences + JSON.parse" pattern, a small helper would reduce duplication. Deferred to a dedicated polish session — refactoring mid-arc isn't worth the risk relative to the aesthetic gain.

---

## OPEN ITEMS

1. **Vercel redeploy** (see action-required block at top). Trigger after merge. Native callers blocked until then.
2. **Withings dirty-tree closeout** — still pending from Session 17. Separate session, small.
3. **Phase 1.3 — Provisions UI** — the next phase. Will consume `POST /api/claude/parse-recipe` from a "New Recipe" form, then `INSERT` the result into `recipes` with `source: 'user'` (or `'ai_generated'` for the future AI-generated-recipe flow). Type imports from `@/types/database` will provide the `Recipe`, `RecipeIngredient`, `RecipeSource` types added in Session 17.

---

## NEXT SESSION CANDIDATES

- Phase 1.3 of Provisions (recipe-creation UI consuming this endpoint)
- Withings dirty-tree closeout (small, independent)
- DRY refactor of the 4 parse-* endpoints into a shared helper (polish)
