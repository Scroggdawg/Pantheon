# Pantheon — Op FASTRAK / V20 Handoff 4 (Brick Alpha-ex-6 Phase 0)

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 recon. No code, no commits, no destructive action.
**Filename:** Per locked convention.

Bundled Phase 0 across the 7 sub-fixes (Alpha.1, .2, .3, .4, .5, .7, .8 — Alpha.6 deferred to Shape E brief). Source files overlap and my prior recon covered most state, so this is narrower per V20's invitation.

---

## §0 — Bottom line

All 7 sub-fixes are well-scoped against current source. No surprises that change the brief's WHAT. Six P0 questions answered below with concrete recommendations. **Brick I read at the bottom: jump it ahead of Alpha.6 — payoff scales across 4+ downstream native bricks, cost is ~1-1.5 sessions, and Alpha-ex-6 web work can run in parallel.**

One plan re-evaluation observation worth surfacing now: junk cleanup left the library at 3 entries. **Alpha.4 (mixed-resolution) won't fire often until library grows, so its empirical impact in this sprint is small even though the fix is correct.** Worth shipping anyway because the fix is small and Sprint-1 measurement gates Beta on shortcut hit rate, which Alpha.4 helps.

---

## §1 — P0.1: Alpha.1 dispatcher text-block side effects

**Source — `lib/claude/parse-meal-pipeline.ts:258-310`** (the assistant-turn handling block):

```typescript
// Append assistant turn (raw blocks pass through unchanged)
messages.push({ role: 'assistant', content: resp.content })

if (resp.stop_reason === 'end_turn') {
  for (const block of resp.content) {
    if (block.type === 'text') finalText += (block as TextBlock).text
  }
  break
}

if (resp.stop_reason === 'tool_use') {
  const toolResults: ToolResultBlockParam[] = []
  for (const block of resp.content) {
    if (block.type === 'tool_use') {
      // ... dispatch + per-call timing + push toolCallLog + push toolResults
    } else if (block.type === 'text') {
      finalText += (block as TextBlock).text + '\n'
    }
  }
  messages.push({ role: 'user', content: toolResults })
  continue
}
```

**Subtleties Promise.all migration must preserve:**

1. **Trailing-newline divergence between paths.** End-turn text blocks (line 263) append WITHOUT trailing `'\n'`. Tool-use-turn text blocks (line 301) append WITH trailing `'\n'`. Probably intentional — separates intermediate-thinking text from final response. **Preserve both behaviors verbatim.**

2. **Order of operations within the tool-use branch.** Currently the loop interleaves text-block append and tool dispatch in source order. With Promise.all, text blocks need a synchronous pre-pass so they're appended in their original positions before tool dispatch promises resolve. Doesn't affect correctness (concatenation order doesn't change finalText semantics) but flagged for explicitness.

3. **`messages.push({ role: 'assistant', content: resp.content })` at line 259 happens BEFORE block iteration.** This appends the WHOLE response (text + tool_use blocks) to the messages array regardless. The Promise.all change shouldn't touch this — the model needs the full assistant turn in conversation history to interpret tool_results in the next turn.

4. **toolResults order vs tool_use block order.** Promise.all preserves array order — `Promise.all(arr.map(fn))` resolves to results in the same order as `arr`. So filtering tool_use blocks first, then mapping with `async`, then awaiting Promise.all, gives results in original order. No explicit sort needed.

5. **`toolCallLog.push` order preservation.** Currently push order = block iteration order. Under Promise.all, push must happen AFTER Promise.all resolves, iterating the resolved array in order. If push happens INSIDE each promise's body, log entries can interleave non-deterministically. **Push outside the promise.**

6. **Per-call timing inside each promise.** `t0 = Date.now()` must run inside each promise body (not before parallel dispatch). Otherwise duration_ms reflects wall-clock-from-Promise.all-start, which is ~equal for all calls and meaningless. The recommended pattern: each task captures its own t0/t1, returns `{ tu, out, duration_ms, cache_hit }`, the post-resolve loop pushes to toolCallLog and toolResults from those results.

**No other side effects spotted.** The dispatcher loop is otherwise clean.

**Recommendation shape (not implementation, just architectural hint):**

```typescript
// Pre-pass for text blocks (synchronous, preserves order + trailing newline)
for (const block of resp.content) {
  if (block.type === 'text') finalText += (block as TextBlock).text + '\n'
}

// Parallel pass for tool_use blocks
const toolUseBlocks = resp.content.filter(
  (b): b is ToolUseBlock => b.type === 'tool_use'
)
const dispatched = await Promise.all(
  toolUseBlocks.map(async (tu) => {
    const t0 = Date.now()
    let out: unknown
    try {
      out = await dispatchTool(tu.name, tu.input as Record<string, unknown>)
    } catch (e) {
      const err = e as Error
      out = { error: `${err.name}: ${err.message}` }
    }
    return {
      tu,
      out,
      duration_ms: Date.now() - t0,
      cache_hit: /* same predicate as today */,
    }
  })
)
// Sequential post-pass for log + result append (preserves order)
for (const { tu, out, duration_ms, cache_hit } of dispatched) {
  toolCallLog.push({ iter: it, tool: tu.name, args: tu.input, result_summary: ..., duration_ms, cache_hit })
  toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) })
}
messages.push({ role: 'user', content: toolResults })
```

This shape is locally swappable for the existing for-loop, preserves all current side effects, and Promise.all-correctness is provable by inspection.

---

## §2 — P0.2: Whisper prompt parameter format

**Format:** OpenAI's whisper-1 `prompt` parameter is **free-text**, not structured. Per OpenAI docs: "An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language."

The community-validated patterns:

- **Comma-separated brand/food list:** `"Spindrift, Yasso, Isopure, dos equis, fajitas, churros, Magic Spoon"` — works. Simplest to generate from a query, easiest to truncate at word boundary.
- **Sentence form:** `"The user often eats Spindrift seltzer, Yasso bars, dos equis beer, and Isopure protein shakes."` — also works, may give slightly better grammatical conditioning, harder to truncate cleanly.
- **Newline-separated:** also works.

**Constraints:**
- Hard limit ~244 tokens per OpenAI docs; safe target is 224.
- Must match audio language (Pantheon is English-only today; transcribe route returns `language` field, currently unused).

**Recommendation:** comma-separated list, simplest. Truncate at last comma boundary that fits under 224 tokens.

**Verification plan during implementation:** record one short audio with a known-failing brand (the access doc cites Spindrift → Spendthrift, dos xx misheard). Send it through transcribe twice — once with hint, once without. Compare. If hint helps, ship as-is; if not, try sentence form before falling back to no hint.

**Token counting:** OpenAI's tokenizer (cl100k_base) ≠ Anthropic's tokenizer. Use `tiktoken` for token-accurate counting, or approximate at ~4 chars/token for rough budgeting. For 224-token cap with brand+food names averaging 2-4 tokens each, that's 60-100 entries — comfortably above current library size (3 saved_meals + 33 products = 36 entries).

---

## §3 — P0.3: Whisper telemetry destination

**Trade-off surface:**

| Option | Pros | Cons |
|---|---|---|
| Console.log structured (Vercel runtime logs) | Zero schema change, zero coupling | Hobby plan ~1h retention; lost forever for replay/audit |
| Return to client + client passes to /api/meals/log → merged into `claude_parse_json._telemetry` | Persistent (food_log_entries lives forever); single telemetry surface; replay script reads one place | Couples whisper telemetry to meal-log path; voice notes used outside meal-logging would have no destination |
| New column `whisper_telemetry` on food_log_entries | Cleanly scoped to meal logging; one read path | Schema change; only useful when whisper IS followed by meal log |
| Separate `whisper_telemetry` table keyed by request_id | Most flexible, future voice-feature-friendly | Migration overhead; 2-table joins for replay |

**Recommendation: console.log + return-to-client + merge into `_telemetry`.** Three layers, no schema change, all forward-only:

1. transcribe route logs structured `[whisper] {audio_duration_ms, whisper_latency_ms, prompt_token_count, prompt_truncated_at}` to console (visible in Vercel real-time + during local dev).
2. transcribe route returns the same fields to client alongside `transcript`.
3. Native + web clients pass them through to `/api/claude/parse-meal` (or directly to `/api/meals/log` via the existing claude_parse_json wrapper). Pipeline merges into `_telemetry` object stored on the food_log_entries row.

**Why this beats a schema column:** the replay script measures parse-meal latency, not whisper. Whisper telemetry is for tuning Alpha.2's vocabulary hint impact — ad-hoc analysis, not regression suite. Merging into `_telemetry` keeps everything queryable in one JSONB blob; the field-shape drift the replay script already handles (per Round 1 recon: `library_shortcut_hit` absent on older entries) covers the gradual rollout of new fields.

**Field-naming proposal (lock now to avoid drift):**
- `whisper_audio_duration_ms` (numeric)
- `whisper_latency_ms` (numeric)
- `whisper_prompt_tokens` (integer; 0 if no hint)
- `whisper_prompt_truncated` (boolean; true if vocab list exceeded 224-token cap)

---

## §4 — P0.4: Alpha.5 ship-now vs defer-to-Shape-E

**My read: ship now. Agree with V20.**

Three reasons:

1. **The bug fires today on every log.** Holding the fix for the duration of the Shape E design + implementation cycle (probably 1-2 sprints) means continued cache misses on every repeat utterance. That's a real user-felt latency hit Luke pays daily.

2. **The fix shape is non-throwaway.** Changing `if (savedMealAction !== 'none')` → `if (savedMealAction === 'created')` is a one-line surgical change. When Shape E lands and the auto-promote block deletes entirely, `'created'` becomes unreachable from this code path AND the bust-on-novel-library-write semantics survive — they just move to the Shape E heart-icon save handler. **The pattern stays; only the trigger location moves.** No work is thrown away.

3. **Empirical reachability check.** Under current code (verified in my earlier recon), `savedMealAction` resolves to:
   - `'incremented'` when library_source_ref starts with `lib:saved_meal:` (library-shortcut re-logs)
   - `'created'` when library_source_ref is null OR starts with `lib:product:` (novel meals + product-direct logs)
   - `'none'` is unreachable
   
   Post-Alpha.5, busts only fire on `'created'` — which is the path that legitimately mutates the library by creating a new saved_meal. Library state changed → cache invalid. Correct semantics.

**One callout for V20's awareness:** post-Alpha.5, repeat-library-shortcut logs preserve cache. So if Luke logs "3 eggs" twice in a row, the second log's response_cache hits at ~100ms instead of going through the LLM. **This is the meaningful Sprint-1 latency win for repeat-meals, separate from the Promise.all win on multi-item meals.**

**Risk if I'm wrong:** if the "novel meal" path produces output that future "library re-log" parses would WANT to hit cache against, busting on 'created' is too aggressive. But that's actually the desired behavior — if user just created a new library entry, we want next parse to surface that entry, not return a stale cached response that was computed before the entry existed. So the bust-on-create semantics are right by construction.

**Ship Alpha.5.** No defer.

---

## §5 — P0.5: Alpha.7 library_source_ref parsing + UUID extraction location

**Verbatim from `app/api/meals/log/route.ts:80-89` (the parsing logic):**

```typescript
const isSavedMealRef = body.library_source_ref?.startsWith('lib:saved_meal:') ?? false
const isProductRef = body.library_source_ref?.startsWith('lib:product:') ?? false
const noLibraryRef = body.library_source_ref == null || body.library_source_ref === ''

try {
  if (isSavedMealRef) {
    const uuid = body.library_source_ref!.slice('lib:saved_meal:'.length)
    // ... saved_meals SELECT + UPDATE
```

So today the route handles two prefixes (`lib:saved_meal:` and `lib:product:`), with UUID extraction inline at line 89 for the saved_meals lookup.

**Where Alpha.7's UUID extraction belongs:** lift it OUT of the conditional and compute at the top, alongside `isSavedMealRef`/`isProductRef`/`noLibraryRef`:

```typescript
const savedMealRefUuid: string | null = isSavedMealRef
  ? body.library_source_ref!.slice('lib:saved_meal:'.length)
  : null
```

This makes it available for the food_log_entries insert WITHOUT changing the existing branching logic.

**Insert ordering decision (V20's call needed, but here's my read):**

Two viable shapes:

**Shape A — two-step (preserves existing flow):** food_log_entries insert at line 57 includes `saved_meal_id: savedMealRefUuid` for the `incremented` path. For the `created` path (where the saved_meals row doesn't exist yet at insert time), saved_meal_id stays null, then UPDATE the food_log_entries row after the saved_meals INSERT succeeds. Brief null window.

**Shape B — restructured ordering:** do the saved_meals INSERT FIRST when in the `created` path, capture its returned id, then food_log_entries INSERT with saved_meal_id populated. Cleaner single-write semantics but inverts the existing compensation logic (currently food_log_entries is the master; if saved_meals fails we DELETE food_log_entries to roll back).

**Recommend Shape A.** It preserves the existing compensation pattern verbatim and adds a single UPDATE in the `created` branch. Brief null window is acceptable — the row exists with valid food data, just missing the audit-trail FK; readers that don't need that linkage are unaffected.

**FK question (you said no FK, surfacing the alternative):**

V20's brief: "No FK to saved_meals (deletes shouldn't fail just because the source library entry was cleaned up later)."

Postgres FK with `ON DELETE SET NULL` does exactly that — deletes don't fail; the saved_meal_id auto-nulls when the parent row is deleted. So FK + `ON DELETE SET NULL` gives the same delete safety as no-FK, plus type safety (saved_meal_id can never point to a non-existent row).

**My recommendation:** add the FK with `ON DELETE SET NULL`. Insurance against bugs later (e.g., a typo writes a non-existent UUID); auto-cleanup on saved_meals delete; zero downside on the original concern. **But your call — if you want strict no-FK per the brief, the migration just omits the REFERENCES clause and the code behaves identically until something writes a stale UUID by mistake.**

**Migration shape (forward-only, both options):**

```sql
-- With FK (recommended)
ALTER TABLE food_log_entries
  ADD COLUMN saved_meal_id uuid
  REFERENCES saved_meals(id) ON DELETE SET NULL
  DEFAULT null;

-- Without FK (per brief)
ALTER TABLE food_log_entries
  ADD COLUMN saved_meal_id uuid DEFAULT null;
```

Either runs cleanly against the existing 41 rows (column nullable; default null; no constraint violations).

---

## §6 — P0.6: Replay script location + invocation

**Verified existing convention from package.json + scripts/ dir:**

```
scripts/
├── backup.ts                  (pattern: tsx-runnable, .env.local manual parse, no dotenv dep)
├── seed/                      (test-data seeders)
├── test-segmented-library.ts  (similar: tsx-runnable test/measurement script)
└── test-usda-ml-bug.ts        (same)

package.json:
  "scripts": {
    "backup": "npx tsx scripts/backup.ts"
    ...
  }
```

So the convention is locked: `scripts/<name>.ts` + `npm run <cmd>` mapping in package.json.

**Recommendation:**

- **Path:** `scripts/replay-parse.ts`
- **npm script:** `"replay": "npx tsx scripts/replay-parse.ts"` (matches `npm run backup`)
- **Args via env or `--` passthrough:** `npm run replay -- --since=30d --json`

**Mode flag (open question):**

Two invocation modes worth supporting:

- `--mode=local` (default): import `runParseMealPipeline` directly from `lib/claude/parse-meal-pipeline.ts`. Tests in-tree code. Best for measuring Alpha-ex-6's bundle impact pre-deploy.
- `--mode=live`: HTTP POST against `/api/claude/parse-meal` on a deployed URL (preview or prod). Tests deployed pipeline end-to-end. Best for post-deploy validation.

**Recommend ship local mode only in Alpha.8.** Live mode is nice but doesn't gate Sprint-1 measurement (which happens pre-push). Add live mode in Beta or whenever first needed.

**Output shape:**

- Default: human-readable table to stdout. Median, p95, hit rates, per-utterance diff.
- `--json`: structured JSON to stdout. Pipe-friendly.
- Both write to stdout; redirect to file if needed.

**Auth + env:**

Replay needs the same env as the parse-meal route at runtime — Anthropic key, USDA key, Supabase service role. Re-use backup.ts's `.env.local` parsing pattern (lines 13-26 of backup.ts handle it without a dotenv dependency).

**Should Alpha.8 ship as a Vercel cron or as a script?** Script. Cron is for scheduled production tasks; this is a developer-tool measurement spine. No reason to put it in the route surface.

---

## §7 — Alpha.4 architectural shape (P0.3 in the brief)

V20 left this open for my judgment. I'd take **path (a) partial-result return**.

**Path (a) shape:** `tryLibrarySegmentedShortcut` returns `{ resolved: FoodItem[], unresolved: { segment: string, position: number }[] } | null`. The caller (route handler) inspects:

- All resolved → build full ParsedMealResponse from resolved foods, return immediately (current behavior, no LLM call)
- Some unresolved → invoke LLM tool-loop with `unresolved.map(s => s.segment).join(', ')` as the transcript (or pass the full original transcript with a "skip these items" hint), then merge LLM output with `resolved` foods, preserving original positions

**Why path (a) over path (b):**

1. **Tool-loop input shape stays clean.** Path (b) requires injecting "skip these items, here are the resolved values" hints into the system prompt or initial user message — that complicates the prompt and risks the LLM ignoring the hint and re-parsing items the library already resolved. Worse, it leaks cascade internals into the LLM's context.

2. **Position preservation is explicit.** The caller assembles foods[] in the user-perceived order (segment 1, 2, 3...) — library-resolved or LLM-resolved doesn't matter at the assembly layer. With path (b), the LLM might emit foods in a different order and merging gets fiddly.

3. **Telemetry surfacing is natural.** `_telemetry.library_segmented_partial_hit: { resolved_count, unresolved_count, resolved_segments, unresolved_segments }` becomes a clean addition. The replay script can measure mixed-resolution rate distinctly from full-segmented-hit rate.

4. **Failure mode is graceful.** If LLM fails on the unresolved subset, the full transcript still has `resolved` foods that could be returned with a clarification_needed for the unresolved set. Path (b) couples library-resolved foods to LLM-call success.

**One subtle constraint path (a) introduces:** the LLM tool-loop currently takes a transcript string. If we send only the unresolved segments, the LLM loses context that could affect interpretation (e.g., "two churros" parsed in isolation might assume restaurant churros vs the library context that says "and Greek yogurt with churros" makes them dessert-style). Probably fine in practice — multi-item transcripts rarely have cross-item context dependencies — but flagged.

**Mitigation if needed:** pass the full original transcript to the LLM with `<resolved>` annotations marking items the library already handled. Lets the LLM see context but skip resolved items. Adds prompt complexity; only do if path (a) regresses on observed cases.

---

## §8 — Plan re-evaluation observations (per doctrine amendment)

Three observations worth surfacing now that change the relative urgency of bricks downstream:

1. **Library is now 3 entries.** Junk cleanup left 3 eggs + Churro + Double espresso. Alpha.4 (mixed-resolution) helps when SOME segments hit library and others don't — but with 3 entries, the probability of any random multi-item meal having even one library hit is low. **Alpha.4's empirical impact is small until library grows (PANTRY).** Ship anyway because the fix is small + cost is the same regardless of when, and Alpha.6 Shape E will start growing the library through hearts. But weight it accordingly when planning Beta — Beta's library-hit-rate gating metric needs library to be non-trivial first.

2. **Alpha.1 + Alpha.5 are the load-bearing latency wins for Sprint 1.** Alpha.1 cuts multi-item parses by ~30-50% (12-18s on the screenshot meal). Alpha.5 enables response_cache hits on repeat library-shortcut logs (11s → ~100ms for "3 eggs"). Together those carry most of the felt-experience improvement. Alpha.2 + Alpha.3 (Whisper) compound at the audio layer but aren't latency-critical. Alpha.4 helps multi-item-mixed cases that are rare today. **The Sprint-1 measurement spine should highlight Alpha.1 + Alpha.5 distributional impact as the headline metrics.**

3. **Beta's relative urgency depends on library growth, not matcher quality.** Pre-Alpha.6 Shape E, library is 3 entries. Even a perfect Typesense matcher fires on at most 3 distinct foods. **Beta's value scales with PANTRY's data layer (Brick Gamma), not with matcher choice.** This shifts the natural sequencing toward: Alpha-ex-6 → Alpha.6 (Shape E) → Gamma (PANTRY data layer) → Beta (matcher choice over a populated library) → ... — vs the master doc's `Alpha → Beta → Gamma`. Worth surfacing for the next master-doc revision: **swap Beta and Gamma in §6.**

---

## §9 — Brick I (OTA / expo-updates) — sequencing read

**Recommendation: jump it ahead of Alpha.6.**

### Cost estimate

OTA setup with expo-updates is well-trodden ground. Standard scope:

1. `npx expo install expo-updates` in the native repo
2. `eas update:configure` — sets up `runtimeVersion`, channel mapping, app.json updates
3. `app.json` config: `expo.updates.url`, `expo.runtimeVersion: { policy: "appVersion" }` or `"sdkVersion"`, channel definitions in `eas.json`
4. Add update-fetch logic in app entry point (`Updates.fetchUpdateAsync()` + reload prompt)
5. One EAS build with expo-updates baked in (this becomes the "binary base" — every JS-only change after this can OTA against it)
6. `eas update --branch production` for subsequent JS-only ships

**Total: ~1 implementation session for someone experienced; ~1.5 sessions for first-time setup with Pantheon's specifics (channel naming, runtime version policy, testing on real device). One EAS build cycle for the ship.**

### Payoff scaling

OTA pays back across ALL future native bricks that are JS-only:

| Brick | Native UI work? | Pre-Brick-I cost | Post-Brick-I cost |
|---|---|---|---|
| Alpha.6 Shape E | heart icon UI | EAS build (3-4hr) | OTA (~1-5min) |
| Delta PLATE | portion editor | EAS build | OTA |
| Epsilon BIG BUTTON | state-machine UI | EAS build | OTA (mostly) |
| Zeta per-food UI hybrid | display refactor | EAS build | OTA |
| Brick C swipe-edit | swipe affordance | EAS build | OTA |

5 future native bricks ≈ **15-20 hours of EAS-wait time saved** (vs Brick I's 1 EAS build to ship the OTA infrastructure itself). Within Op FASTRAK's 40-day frame, that's load-bearing iteration speed.

### Cost of NOT jumping

If Brick I waits, every Alpha.6 iteration costs an EAS build. Real-device tuning (animation timings, gesture thresholds, copy revisions) can need 2-3 cycles per brick. So Alpha.6 alone could absorb 3-4 EAS builds = 9-16 hours of Luke-waiting-for-builds time. Brick I's 1.5-session cost amortizes inside Alpha.6's iteration cost alone.

### Parallelization

**This is the load-bearing point for the recommendation:** Alpha-ex-6 is web-only. Brick I is native-only. They share zero source files. **They can run as two parallel Chat Claude threads** — one writing Alpha-ex-6 implementation briefs against the web repo, one writing Brick I against the native repo. Terminal works on whichever brief greenlights first. Total wall-clock time to "Alpha-ex-6 deployed AND Brick I deployed" is roughly the longer of the two, not the sum.

### Risk if I'm wrong

First-time expo-updates setup has occasionally hit version-compatibility issues (RN newArch incompatibilities at certain Expo SDK versions, channel routing pitfalls). If Brick I bogs down past 2 sessions, abort and ship Alpha.6 EAS-only. The decision is reversible at low cost.

### Recommendation summary

**Jump Brick I ahead of Alpha.6, run it in parallel with Alpha-ex-6 (web).** If both ship clean, Alpha.6 then ships OTA. If Brick I bogs, fall back to EAS-only Alpha.6.

If V20 + Luke prefer single-thread focus over parallelism: ship Alpha-ex-6 first (web-only, 1 Vercel deploy), then Brick I, then Alpha.6 OTA. Sequential, slower wall clock, no parallelization risk.

---

## §10 — Status / docket

**At bat:** This Phase 0 doc. V20 reviews + decides:
- Greenlight on each sub-fix to proceed to commit (per two-gate flow)
- FK-or-no-FK call on Alpha.7's saved_meal_id column
- Brick I sequencing decision (jump ahead, or sequential after Alpha-ex-6)

**On deck (post-greenlight):** Per-sub-fix EXECUTE + Gate-1 commit cycle. My read of order:
1. Alpha.7 first (migration + route change — small, unblocks audit-trail measurement for everything else)
2. Alpha.1 (Promise.all dispatcher — biggest single latency win)
3. Alpha.5 (cache bust granularity — second biggest latency win for repeat meals)
4. Alpha.4 (mixed-resolution — small fix, low immediate impact, ship for completeness)
5. Alpha.2 + Alpha.3 (Whisper hint + telemetry — bundle together)
6. Alpha.8 (replay script — last, so it can validate the cumulative bundle)

Each commit includes session tag `S27 Op FASTRAK Alpha.<N>` per V20's discipline note. Push held until bundle measures clean against Alpha.8.

**In the hole:** Alpha.6 Shape E brief (separate handoff from V20). Brick I if jumped (separate handoff). Beta gated on Sprint-1 measurement + Alpha.6 deployed + library populated.

**Re-evaluation flag:** master doc's §6 sequence shows Beta→Gamma. Empirical observation suggests Gamma→Beta is the right order (Beta's value scales with library size, which Gamma builds). Worth updating master doc on next revision pass.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_FASTTRACK_HANDOFF_4.md
