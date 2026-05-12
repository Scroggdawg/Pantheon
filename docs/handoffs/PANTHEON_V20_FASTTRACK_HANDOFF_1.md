# PANTHEON — Operation Fast Track / Brick Alpha / Phase 0 Recon

**Date:** 2026-05-07
**Author:** Terminal Claude
**Recipient:** V20 Chat Claude
**Mode:** Recon only. No code changes, no commits, no diffs.
**Per Luke:** Operation Fast Track is the canonical name. Held throughout.

V20 asked for primary sources before any §16 product calls or Alpha EXECUTE. This doc replaces secondhand summaries with verbatim file content + live Supabase data. Four-bullet recon per section A through I.

**Critical doctrine flag up front:** I cannot read `OPERATION_FAST_TRACK_PHASE_0_MASTER.md` — it does not exist on Luke's Mac. The only Phase 0-relevant docs in the repo are my three prior recon outputs from earlier today. V20's references to "master doc §7 E0.2," "§16 product calls," etc. are not verifiable from disk on my side. I'm reconning against the file paths and Round-1 line numbers V20 cited; if §15 / §16 / Alpha.7 exist only in V20's chat-side context, my coverage may have gaps. **Surface this to Luke or paste the master doc into project knowledge before EXECUTE.**

---

## A — parse-meal pipeline current state

**Status:** Read in full. No drift since Round 1 recon — git log shows only one commit on these files since 2026-05-05 (`a258d26 S26 Brick D: multi-item utterance fast-path (segmented library shortcut, Step 4f.5)`, dated 2026-05-05), and that commit is what landed `tryLibrarySegmentedShortcut`. Master doc's Round-1 line numbers and threshold constants are still accurate.

**Source — `lib/claude/parse-meal-pipeline.ts:268-310` (the dispatcher block, current line numbers, unchanged from Round 1):**

```typescript
    if (resp.stop_reason === 'tool_use') {
      const toolResults: ToolResultBlockParam[] = []
      for (const block of resp.content) {
        if (block.type === 'tool_use') {
          const tu = block as ToolUseBlock
          const t0 = Date.now()
          let out: unknown
          try {
            out = await dispatchTool(tu.name, tu.input as Record<string, unknown>)
          } catch (e) {
            const err = e as Error
            out = { error: `${err.name}: ${err.message}` }
          }
          const dt = Date.now() - t0
          const cacheHit =
            tu.name === 'search_food_database' &&
            typeof out === 'object' &&
            out !== null &&
            (out as { _cache_hit?: boolean })._cache_hit === true
          toolCallLog.push({
            iter: it,
            tool: tu.name,
            args: tu.input as Record<string, unknown>,
            result_summary: summarizeToolResult(tu.name, out),
            duration_ms: dt,
            cache_hit: cacheHit,
          })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(out),
          })
        } else if (block.type === 'text') {
          finalText += (block as TextBlock).text + '\n'
        }
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Some other stop reason — bail
    break
  }
```

**Source — `lib/claude/parse-meal-library-shortcut.ts:45-46` (single-hit thresholds):**

```typescript
const SHORTCUT_SCORE_THRESHOLD = 0.85
const SHORTCUT_GAP_THRESHOLD = 0.15
```

**Source — `lib/claude/parse-meal-library-shortcut.ts:250-251` (segmented thresholds, separate constants):**

```typescript
const SEGMENT_SHORTCUT_SCORE_THRESHOLD = 0.85
const SEGMENT_SHORTCUT_GAP_THRESHOLD = 0.15
```

**Source — `lib/claude/parse-meal-library-shortcut.ts:439-478` (the all-or-nothing gate inside `tryLibrarySegmentedShortcut`):**

```typescript
  const foods: FoodItem[] = []
  const segmentScores: number[] = []
  let totalCal = 0
  let totalProt = 0
  let totalCarbs = 0
  let totalFat = 0

  for (let i = 0; i < segments.length; i++) {
    const r = segmentResults[i].results
    if (r.length === 0) return null
    const top = r[0]
    const second = r[1]
    const topScore = top.match_confidence.score
    const secondScore = second?.match_confidence.score ?? 0
    if (topScore < SEGMENT_SHORTCUT_SCORE_THRESHOLD) return null
    if (second && topScore - secondScore < SEGMENT_SHORTCUT_GAP_THRESHOLD) return null
    // ... accumulates into foods[] and totals
  }
```

**Flags / surprises:**
- Confirmed sequential `for ... await dispatchTool(...)` in dispatcher. Master doc accurate.
- Confirmed thresholds 0.85 / 0.15 unchanged in source. The "loosened plan referenced 0.7 / 0.10" from master doc is a PROPOSAL, not yet in code.
- Confirmed all-segments-required gate. Mixed resolution NOT yet implemented.
- Subtlety V20's master doc may not name explicitly: the dispatcher loop ALSO mixes `text` blocks from the same assistant turn into `finalText` (line 300-302). Promise.all migration must preserve this — text blocks aren't awaitable but they're appearing in the same `for (const block of resp.content)` loop.

**Greenlight ask:** None for §A. Confirms master doc's Round-1 framing is current.

---

## B — meals/log route current state

**Status:** Read in full (162 lines). Pulled current source verbatim. Confirms the auto-promote bug + cache-bust-on-every-log behavior. No drift since Round 1.

**Source — `app/api/meals/log/route.ts:80-134` (the auto-promote block, currently lines 80-134, slightly different range than master doc's 110-126 but same logic. The 110-126 cited is the second branch only):**

```typescript
  // ---- 2. Conditional auto-promote ----
  let savedMealId: string | null = null
  let savedMealAction: SavedMealAction = 'none'
  const isSavedMealRef = body.library_source_ref?.startsWith('lib:saved_meal:') ?? false
  const isProductRef = body.library_source_ref?.startsWith('lib:product:') ?? false
  const noLibraryRef = body.library_source_ref == null || body.library_source_ref === ''

  try {
    if (isSavedMealRef) {
      const uuid = body.library_source_ref!.slice('lib:saved_meal:'.length)
      const { data: existing, error: getErr } = await supabase
        .from('saved_meals')
        .select('times_logged')
        .eq('id', uuid)
        .single()
      if (getErr || !existing) {
        throw new Error(
          `saved_meals lookup for ${uuid} failed: ${getErr?.message ?? 'not found'}`,
        )
      }
      const { error: updErr } = await supabase
        .from('saved_meals')
        .update({
          times_logged: (existing.times_logged ?? 0) + 1,
          last_logged_at: new Date().toISOString(),
        })
        .eq('id', uuid)
      if (updErr) throw new Error(`saved_meals update failed: ${updErr.message}`)
      savedMealId = uuid
      savedMealAction = 'incremented'
    } else if (noLibraryRef || isProductRef) {
      const { data: ins, error: insErr } = await supabase
        .from('saved_meals')
        .insert({
          user_id: body.user_id,
          name: body.foods[0]?.name ?? 'Untitled meal',
          foods_json: body.foods,
          total_calories: body.total_calories,
          total_protein_g: body.total_protein_g,
          total_carbs_g: body.total_carbs_g,
          total_fat_g: body.total_fat_g,
          times_logged: 1,
          last_logged_at: new Date().toISOString(),
          yield_servings: 1,
          is_staple: false,
          tags: [],
        })
        .select('id')
        .single()
      if (insErr || !ins) {
        throw new Error(`saved_meals insert failed: ${insErr?.message ?? 'unknown'}`)
      }
      savedMealId = ins.id
      savedMealAction = 'created'
    }
  } catch (e) {
    // Compensation: roll back the food_log_entries insert.
    const { error: delErr } = await supabase
      .from('food_log_entries')
      .delete()
      .eq('id', logRow.id)
    // ...
  }
```

**Source — `app/api/meals/log/route.ts:150-155` (the cache bust):**

```typescript
  // S26 Step 4e — bust user's parse-meal response cache when their
  // library changes (saved_meals upsert). Best-effort; helper logs
  // its own warnings on failure and does not throw.
  if (savedMealAction !== 'none') {
    await bustResponseCacheForUser(supabase, body.user_id)
  }
```

**savedMealAction state machine (verbatim from source):**
- `'incremented'` ← when `library_source_ref` starts with `'lib:saved_meal:'`
- `'created'` ← when `library_source_ref` is null OR starts with `'lib:product:'`
- `'none'` ← only reachable in code paths that DON'T enter the try block (i.e., never, given the if/else-if covers all three input shapes exhaustively)

**Flags / surprises:**
- `savedMealAction === 'none'` is **unreachable in the current code.** The if/else-if at lines 88/110 covers every possible value of `library_source_ref` (string starting with `lib:saved_meal:`, null/empty, anything else including `lib:product:` matches via `isProductRef`). So the bust-on-line-154 fires on EVERY successful log. Master doc's framing is correct.
- The `compensation rollback` (lines 135-148) DELETEs the food_log_entries row on saved_meals failure. If the auto-promote bug were ever to fail (e.g., name too long for column), the user's log silently disappears. Flagged in prior recon as future Brick.
- This file imports `bustResponseCacheForUser` from `@/lib/claude/parse-meal-response-cache` — only one import site; no other callers of the bust helper from grep.

**Greenlight ask:** None for §B. Master doc's Alpha.6 (cache bust granularity fix) is the right surgical target. Recommended diff: `if (savedMealAction === 'created') { await bustResponseCacheForUser(...) }` — only bust on novel library entries, not increments.

---

## B.3 — auto-promote paths confirmed single-source

**Status:** Searched native + web for any non-route auto-promote paths.

**Source — grep `saved_meals` in `pantheon-native/`:**

```
app/log-food.tsx:493:      await supabase.from("saved_meals").delete().eq("id", id);
components/log/LibraryPicker.tsx:82:        .from("saved_meals")  // SELECT only
```

**Source — `app/log-food.tsx:484-499` (the only direct write — DELETE for Undo):**

```typescript
  async function handleUndoPromotion() {
    if (!pendingUndo) return;
    const id = pendingUndo.savedMealId;
    // Optimistic dismissal — clear UI immediately, fire DELETE in the
    // background. Per V15 P5.5: Undo only un-favorites; the
    // food_log_entries row stays (the user DID eat the meal).
    setPendingUndo(null);
    Haptics.selectionAsync().catch(() => {});
    try {
      await supabase.from("saved_meals").delete().eq("id", id);
    } catch {
      // Best-effort. Stale favorites row is a low-stakes UX wart, not a
      // data-integrity bug.
    }
    router.back();
  }
```

**Flags / surprises:**
- **Native does NOT auto-promote.** All saved_meals INSERTs and UPDATEs go through `/api/meals/log`. Master doc's "Alpha is web-only" assumption holds.
- **There IS a native Undo flow** at `app/log-food.tsx:484-499` that DELETEs auto-promoted saved_meals. This is real UX — when a user voice-logs and the route auto-promotes, the native client surfaces a 5-second Undo overlay (lines 469-478, `setPendingUndo(...) + setUndoCountdown(UNDO_SECONDS)`). If the user taps Undo, native fires `saved_meals.delete()` directly. **This affects the Alpha auto-promote-fix design:** if we change the route to only auto-promote single-food meals, the native Undo overlay should ALSO only appear on those cases. Otherwise the UX surfaces "Undo" with nothing to undo.
- LibraryPicker.tsx is read-only (SELECT). No write paths.

**Greenlight ask:** **Confirm whether the master doc's Alpha auto-promote fix scope includes coordinating the native Undo overlay**, or whether that's a separate brick. The native flow is web-route-driven (the route response carries `saved_meal_action: 'created'`), so a route-side change that stops creating multi-item saved_meals will naturally stop triggering the Undo overlay for those cases. Likely a free coordination, but worth flagging.

---

## D — whisper transcribe route current state

**Status:** Read in full (55 lines). No drift since Round 1 — no commits on this file since 2026-05-05.

**Source — `app/api/whisper/transcribe/route.ts:30-48` (the OpenAI call + response):**

```typescript
    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
    });

    // verbose_json shape includes duration + language; the SDK's union type
    // doesn't narrow on response_format, so cast at the boundary.
    const verbose = result as unknown as {
      text: string;
      duration: number;
      language: string;
    };

    return NextResponse.json({
      transcript: verbose.text,
      duration_seconds: verbose.duration,
      language: verbose.language,
    });
```

**Flags / surprises:**
- Confirmed: NO `prompt` parameter, NO `language` hint, NO vocabulary biasing. Three-parameter call (`file`, `model`, `response_format`).
- Confirmed: NO timing telemetry (no `console.time`, no structured log line). The `duration_seconds` field returned to the client is the AUDIO duration from Whisper's response, NOT transcribe latency.
- Returns `language` to the client — implies the API has been observed returning non-English at least once, otherwise this field wouldn't be plumbed. Worth noting for the vocabulary-hint design (hint should be language-aware OR force English).

**Greenlight ask:** None for §D. Alpha.4 (Whisper hint + transcribe latency telemetry) is the right scope.

---

## E — saved_meals current state

**Status:** Pulled all 10 rows for Luke's user_id (`f1fc7a56-f4c1-4332-9cd1-b7622e782986`). All 5 junk candidates from Round 3 are STILL PRESENT in the same state. Plus full row data on "Protein Shake A - Pre-Workout" for Luke's keep/edit/delete call.

**Source — full saved_meals dump (10 rows, sorted by times_logged desc):**

| name | total_cal | times_logged | last_logged_at | foods_json shape |
|---|---|---|---|---|
| **3 eggs** | 215 | 7 | 2026-05-07 | 1 food (single-food, clean) |
| **Protein Shake A - Pre-Workout** | 210 | 3 | 2026-05-07 | 1 food (named recipe, clean — see below) |
| **Churro** | 150 | 1 | 2026-05-07 | 1 food (clean, calorie-anchored) |
| **Shrimp fajitas with corn tortillas** | **3420** | 1 | 2026-05-07 | **8 foods** (entire restaurant meal — JUNK) |
| **H-E-B Fajitas Chicken Thighs** | 214 | 1 | 2026-05-07 | **2 foods** [chicken 119 + corn salad 95] — JUNK by name vs contents mismatch |
| **David Protein Bar - Blueberry Pie** | 200 | 1 | 2026-05-04 | **2 foods** [bar 150 + 16oz coconut water 50] — also conflated, but coconut-water sidecar is small. Borderline. |
| **Double espresso** | 24 | 1 | 2026-05-03 | **3 foods** [espresso 5 + half-and-half 19 + stevia 0] — composite drink semantically coherent under one name. Borderline. |
| **Banana** | 195 | 1 | 2026-05-03 | **2 foods** [Banana 105 + PB 90] — JUNK by name vs contents mismatch |
| **Blueberries** | 289 | 1 | 2026-05-03 | **2 foods** [Blueberries 84 + Almond butter 205] — JUNK by name vs contents mismatch |
| **Test smoke meal** | 100 | 1 | 2026-05-03 | 1 food, llm_estimated, source_ref null — JUNK (test artifact) |

**Source — `Protein Shake A - Pre-Workout` full row (V20 asked specifically for this; replaces V18+'s "3 re-logs, recipe-style" framing with primary data):**

```json
{
  "id": "1a2ac44d-80d4-4afd-83ed-bd388e77e14e",
  "name": "Protein Shake A - Pre-Workout",
  "total_calories": 210,
  "total_protein_g": 25,
  "total_carbs_g": 21,
  "total_fat_g": 1,
  "foods_json": [
    {
      "qty": 1,
      "name": "Protein Shake A - Pre-Workout",
      "unit": "1 shake",
      "fat_g": 1,
      "source": "library",
      "carbs_g": 21,
      "calories": 210,
      "protein_g": 25,
      "source_ref": "lib:product:300255c3-cd29-4cac-9f91-190ad2ed167f",
      "match_confidence": {"label": "high", "score": 1, "warnings": []}
    }
  ],
  "times_logged": 3,
  "last_logged_at": "2026-05-07T01:02:56.09+00:00",
  "created_at": "2026-05-04T15:53:15.980466+00:00"
}
```

**Flags / surprises:**
- **"Protein Shake A - Pre-Workout" is actually clean.** Its foods_json contains exactly ONE food entry (not multiple as I suggested in Round 3). The single food references the underlying `products` row `lib:product:300255c3-...` (which has the actual ingredient breakdown). So this saved_meal is structured as a "named alias for a product" — single food entry, clean. **KEEP confirmed via primary source.**
- **Two new borderline cases I underweighted in Round 3:**
  - **David Protein Bar - Blueberry Pie (200 cal):** foods_json has [David Bar 150 + 16oz coconut water 50]. The name is the bar but the entry total includes coconut water. Library shortcut on "david bar" returns 200 cal — 50 cal too high. **Soft junk.** Less aggressive than the 3420 case but same pattern.
  - **Double espresso (24 cal):** foods_json has [espresso 5 + half-and-half 19 + stevia 0]. The name semantically covers all three (a "double espresso with half-and-half and stevia" is what people order). Most users wouldn't call this junk. **KEEP recommended** but flag for Luke. The auto-promote bug would have stored this under any single-item name; the fact that it landed on "Double espresso" matches user intent.
- **All 5 originally-flagged junk candidates still present in same state.** Banana (195), Blueberries (289), Shrimp fajitas (3420), H-E-B Fajitas (214), Test smoke meal (100). No drift.
- Awaiting V20 confirmation before delete. Recommended deletion list: 5 confirmed junk + David Bar (borderline). Conservative: 5 only. Aggressive: 6.

**Greenlight ask:** Confirm deletion list — 5 (conservative) or 6 (include David Bar). Then I run the deletes via Supabase service-role REST. **Do NOT run this turn.** Per doctrine: no destructive action without explicit authorization.

---

## F — food_log_entries schema

**Status:** Pulled current column list via REST (1-row sample, then projected keys).

**Source — column list:**

```
id, user_id, logged_at, meal_label, day_type, foods_json, total_calories,
total_protein_g, total_carbs_g, total_fat_g, log_method, raw_input_text,
claude_parse_json, created_at
```

**Source — `saved_meal_id` existence check:**

```
GET /rest/v1/food_log_entries?select=saved_meal_id&limit=1
→ {"code":"42703","details":null,"hint":null,
   "message":"column food_log_entries.saved_meal_id does not exist"}
```

**Flags / surprises:**
- `saved_meal_id` column does NOT exist. Master doc's Alpha.7 (add nullable UUID column referencing saved_meals) is still applicable. Trivial migration.
- 14 columns total. All scalar except `foods_json` and `claude_parse_json` (both JSONB).
- No `meal_id` or `session_id` column either — confirms BRICK SPLIT (per-food data model) requires schema migration if ever pursued.

**Greenlight ask:** None. Alpha.7 migration is well-scoped.

---

## G — telemetry readiness for replay script

**Status:** Sampled last 10 food_log_entries with telemetry projection. Surfaces both shape consistency and a coverage gap.

**Source — last 10 entries with `claude_parse_json._telemetry` shape:**

```
2026-05-07T06:51:25  manual  cal=150   raw='One churro at 150 calories.'
  telemetry={iters: 3, cache_hits: 0, latency_ms: 16818, tool_calls: 2,
             response_cache_hit: False, library_shortcut_hit: False}

2026-05-07T03:09:17  manual  cal=2036  raw='Three shrimp fajitas with corn tortillas...'
  telemetry={iters: 6, cache_hits: 0, latency_ms: 59586, tool_calls: 22,
             response_cache_hit: False, library_shortcut_hit: False}

2026-05-07T01:02:56  manual  cal=210   raw='Protein shake with dextrose.'
  telemetry={iters: 2, cache_hits: 0, latency_ms: 11213, tool_calls: 3,
             response_cache_hit: False, library_shortcut_hit: False}

2026-05-07T01:01:56  manual  cal=214   raw='Four ounces of chicken from H-E-B Fajitas...'
  telemetry={iters: 6, cache_hits: 0, latency_ms: 44555, tool_calls: 13,
             response_cache_hit: False, library_shortcut_hit: False}

2026-05-05T21:14:30  manual  cal=210   raw='Protein shake with dextrose.'
  telemetry={iters: 2, cache_hits: 0, latency_ms: 11261, tool_calls: 3,
             response_cache_hit: False, library_shortcut_hit: False}

2026-05-04T17:50:32  manual  cal=200   raw='One David Bar, the blueberry flavor, and 16 ounces...'
  telemetry={iters: 3, cache_hits: 0, latency_ms: 20721, tool_calls: 5,
             response_cache_hit: False, library_shortcut_hit: False}

2026-05-04T15:53:15  quick   cal=210   raw=''
  telemetry=ABSENT  ← log_method='quick' bypasses parse-meal entirely

2026-05-04T04:17:42  manual  cal=215   raw='Three eggs.'
  telemetry={iters: 0, cache_hits: 0, latency_ms: 106, tool_calls: 0,
             response_cache_hit: False, library_shortcut_hit: TRUE,
             library_candidates_hit: False}

2026-05-03T22:28:55  manual  cal=24    raw='Double espresso, with half an ounce of half and half...'
  telemetry={iters: 3, cache_hits: 1, latency_ms: 21052, tool_calls: 6,
             response_cache_hit: False}  ← library_shortcut_hit field absent

2026-05-03T06:53:15  manual  cal=130   raw='1 yogurt'
  telemetry=ABSENT  ← older entry, predates telemetry instrumentation
```

**Flags / surprises:**
- **library_shortcut_hit DID fire once in this 10-entry sample.** "Three eggs." on 2026-05-04 hit the shortcut at 106ms. iters=0, tool_calls=0. Confirms the fast path works in the narrow case where transcript ≈ saved-meal-name. **This corrects my earlier "0/4 hit rate" framing in Round 1 recon — actual rate over the last 8 telemetry-bearing entries is 1/8 (12.5%).** Still bad but not zero. The replay script will measure this distributionally.
- **Two telemetry coverage gaps the replay script must handle:**
  1. `log_method='quick'` entries skip parse-meal entirely (no transcript, no LLM call). Skip them in the replay.
  2. Pre-S26 older entries (e.g., `1 yogurt` from 2026-05-03 06:53) have no `_telemetry` field at all. Filter on `created_at >= 2026-05-03T22:00` (when instrumentation seems to have landed) or filter on telemetry presence.
- **Field schema drift inside `_telemetry`:** the 2026-05-03 22:28 entry has `_telemetry` but missing `library_shortcut_hit`. Newer entries always have it. Replay script should treat absent fields as `false` / `null`.
- All recent entries (last 5 days) have consistent shape: `{iters, cache_hits, latency_ms, tool_calls, response_cache_hit, library_shortcut_hit}` minimum, sometimes `library_candidates_hit` or `library_segmented_hit`. **Sufficient for the replay measurement spine.**
- **Field naming nit for the replay script:** `cache_hits` (plural) is the COUNT of `food_query_cache` hits inside the LLM tool loop. `response_cache_hit` (singular) is a boolean for the layer-1 cache. Easy to confuse. Document explicitly in the replay script.

**Greenlight ask:** None. Telemetry is replay-ready. Master doc §15 spine works.

---

## H — credential / access health

**Status:** Vercel + Supabase + GitHub all green. Vercel env state has DRIFTED FAVORABLY since the access doc — all 5 originally-missing Preview vars are now present.

**Source — `npx vercel env ls` (verbatim):**

```
name                               value       environments                        created
PANTHEON_NATIVE_SHARED_SECRET      Encrypted   Preview                             2d ago
USDA_FDC_API_KEY                   Encrypted   Production, Preview                 5d ago
OPENAI_API_KEY                     Encrypted   Production, Preview                 8d ago
PANTHEON_NATIVE_SHARED_SECRET      Encrypted   Production                          13d ago
WITHINGS_CLIENT_ID                 Encrypted   Development, Preview, Production    24d ago
WITHINGS_CLIENT_SECRET             Encrypted   Development, Preview, Production    24d ago
PANTHEON_PASSWORD                  Encrypted   Production                          28d ago
ANTHROPIC_API_KEY                  Encrypted   Production, Preview                 28d ago
SUPABASE_SERVICE_ROLE_KEY          Encrypted   Production, Preview                 28d ago
NEXT_PUBLIC_SUPABASE_ANON_KEY      Encrypted   Production, Preview                 28d ago
NEXT_PUBLIC_SUPABASE_URL           Encrypted   Production, Preview                 28d ago
```

**Source — Supabase + GitHub smoke:**

```
gh auth status:    ✓ Logged in to github.com account Scroggdawg
supabase projects: ●  Pantheon  qlkjgguxjddalbswoxpm  East US (Ohio)
git push --dry-run: Everything up-to-date  (web repo)
```

**Flags / surprises:**
- All 5 access-doc-flagged vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `USDA_FDC_API_KEY`) are present in BOTH Production and Preview. **The access doc dated 2026-05-05 was already correct on this** (Brick B E1a-2 closed the gap). H.1 = no remaining drift.
- `PANTHEON_NATIVE_SHARED_SECRET` is split across two rows (Preview added 2d ago, Production already had it). Preview side was filled in recently. Both present.
- `OPENAI_API_KEY` is now Production+Preview (doc said it was missing from Preview; it now isn't). Drift favored us.
- `PANTHEON_PASSWORD` is Production-only — that's correct (login route).
- Web repo's git remote is healthy.

**Greenlight ask:** None for §H. Access surfaces all green; Sprint 1 can deploy without env-var blockers.

---

## I — drift since Round 1-3 recon

**Status:** Single commit on Phase-0-relevant files since 2026-05-05.

**Source — `git log --since="2026-05-05" --pretty=format:"%h %ad %s" --date=short -- app/api/claude/parse-meal/route.ts lib/claude/parse-meal-pipeline.ts lib/claude/parse-meal-library-shortcut.ts app/api/meals/log/route.ts app/api/whisper/transcribe/route.ts`:**

```
a258d26 2026-05-05 S26 Brick D: multi-item utterance fast-path (segmented library shortcut, Step 4f.5)
```

**Flags / surprises:**
- One commit. That's the Brick D shipment which Round 1 already accounted for.
- No commits on parse-meal-pipeline.ts (the dispatcher), meals/log/route.ts (the auto-promote + cache bust), or whisper/transcribe/route.ts since 2026-05-05.
- **Empirical conclusion: master doc's framing of these files is current.** Round 1's line numbers, Round 2's auto-promote diagnosis, and Round 3's Typesense / streaming framing all rest on accurate file state.

**Greenlight ask:** None for §I. No code drift.

---

## Cross-cutting flags (post-recon)

1. **Master doc gap.** `OPERATION_FAST_TRACK_PHASE_0_MASTER.md` is not on Luke's Mac. V20's references to "§7 E0.2," "§15," "§16," "Alpha.7" are not verifiable on my side. If V20 is reasoning from the master doc and I'm reasoning from the three Round 1-3 docs that ARE on disk, we may be on different versions. **Recommend Luke (or V20) writes the master doc to disk before EXECUTE so both sides reason from the same spec.**

2. **Native Undo flow (B.3 finding) interacts with Alpha auto-promote fix.** If Alpha changes the route to only auto-promote single-food meals, the native Undo overlay should stop appearing on multi-item logs. The native client already keys off `saved_meal_action: 'created'` in the response, so this should coordinate naturally — but worth confirming in Alpha sequencing.

3. **Library shortcut DID fire on "Three eggs."** The 1/8 hit rate (12.5%) is more accurate than my Round 1 "0/4." The "fast path is essentially dead" framing should soften to "fast path fires only for transcript ≈ saved-meal-name; misses on common natural-language phrasings." Behavioral claim about looseness still holds; rhetorical framing should update.

4. **Two telemetry coverage edges for the replay script:**
   - `log_method='quick'` entries skip parse-meal → exclude from replay.
   - Pre-S26 entries (older than ~2026-05-03 22:00 UTC) have no `_telemetry` field → filter or treat as null.
   - Field shape drift: `library_shortcut_hit` not present on entries from 2026-05-03 22:28; treat absent as `false`.

5. **Borderline saved_meals raise the junk-cleanup question's stakes:**
   - **David Protein Bar - Blueberry Pie** has [Bar 150 + 16oz coconut water 50] → soft junk (50 cal too high on shortcut).
   - **Double espresso** has [espresso + half-and-half + stevia] → semantically coherent under one name, KEEP.
   - V20's deletion call should explicitly include or exclude David Bar.

---

## Status / docket

**At bat:** This recon doc. V20 to consume + decide:
- Whether master doc needs to be written to disk before Alpha EXECUTE
- Whether David Bar joins the cleanup list (5 vs 6)
- Whether native Undo overlay coordination is in-Alpha or separate brick

**On deck (pending V20 confirmation):** Junk cleanup deletion of confirmed-junk saved_meals via Supabase service-role REST. NOT running this turn — explicit authorization required before destructive action.

**In the hole:** Alpha sub-fixes per master doc — assuming master doc lands on disk for cross-verification.

**Future docket:** Per Round 3 inflection — held items (matcher choice, BRICK PLATE, BRICK PANTRY, BRICK SPLIT) gated on Sprint 1 measurement results.

**Operation Fast Track holds the name.** Per Luke 2026-05-07.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_S27_OPERATION_FAST_TRACK_BRICK_ALPHA_PHASE_0_RECON.md
