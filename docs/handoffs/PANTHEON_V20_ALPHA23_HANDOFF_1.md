# Pantheon — Alpha.2 + Alpha.3 Gate 1 Handoff (bundled)

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on Alpha.2 + Alpha.3 bundle
**Mode:** Sub-fix 5 of 6 in Alpha-ex-6 bundle. Local commit, not pushed.

---

## §0 — Status

Alpha.2 (Whisper vocab hint) + Alpha.3 (Whisper telemetry capture) shipped clean as a bundle. Type-check green. Vocab smoke validates against current library state.

**Commit:** `f2bc7b9 S27 Op FASTRAK Alpha.2 + Alpha.3: Whisper vocab hint + telemetry` (3 files, +285/-1)

Awaiting Gate 1 greenlight before moving to Alpha.8 (the replay measurement script — final sub-fix in the bundle).

---

## §1 — What changed

### `lib/whisper/vocab.ts` (new, 159 lines)

Self-contained vocab builder per Phase 0 §2 + V20's locked spec:

- Sources: saved_meals (user-scoped) + products (global) + recent food_log_entries.foods_json[].name (last 30 entries).
- Unified candidates Map keyed by lowercase name (dedup across sources).
- Sort: `last_logged_at desc → times_logged desc → alphabetical` (stable).
- Greedy include up to `CHAR_CAP = 700` (~200 Whisper tokens conservative). Truncate at last comma boundary fitting the cap; never emit half a name.
- Returns `{ prompt, source_count, char_count, truncated }`.

Notes locked into the file's header comment:
- We use a char-count heuristic instead of tiktoken because Whisper's tokenizer differs from cl100k_base (cl100k_base is GPT-3.5/4, not Whisper). Adding `tiktoken` as a dep would still be approximate; the char heuristic is simpler and conservative.
- 700 chars sits comfortably under Whisper's documented 224-token prompt cap for English brand/food names.

### `app/api/whisper/transcribe/route.ts` (modified)

- Imports `buildVocabString` + Supabase server client.
- Resolves the user, builds vocab best-effort. Failure to build vocab silently degrades to no-hint (regression to pre-Alpha.2 behavior; never blocks transcription).
- OpenAI call now passes `prompt: vocab.prompt` when vocab is non-empty (spread-conditional `...(prompt ? { prompt } : {})` so undefined isn't passed).
- Captures `whisper_latency_ms` around the call.
- Logs structured `{ type: 'whisper_telemetry', whisper_audio_duration_ms, whisper_latency_ms, whisper_prompt_tokens, whisper_prompt_truncated, whisper_prompt_source_count, whisper_language }` (Layer 1 of telemetry).
- Returns `whisper_audio_duration_ms`, `whisper_latency_ms`, `whisper_prompt_tokens`, `whisper_prompt_truncated` to the client alongside the transcript (Layer 2).

### `app/api/claude/parse-meal/route.ts` (modified)

Layer 3 — accepts `whisper_telemetry` in request body and merges into `_telemetry` across all 6 return paths:

```typescript
interface WhisperTelemetry {
  whisper_audio_duration_ms?: number
  whisper_latency_ms?: number
  whisper_prompt_tokens?: number
  whisper_prompt_truncated?: boolean
}

const body = await request.json()
const transcript = body?.transcript
const whisperTelemetry: WhisperTelemetry = body?.whisper_telemetry ?? {}
// ...
// Each _telemetry: { ... } block ends with `...whisperTelemetry,` spread.
```

6 spread sites confirmed via grep. All four optional fields propagate cleanly through to `food_log_entries.claude_parse_json._telemetry` via the existing `meals/log` `claude_parse_json` wrapper — older clients that don't send the wrapper just get empty whisper fields, no schema break.

---

## §2 — Web vs native scope

Critical scoping note for the handoff:

- **Web is unaffected by Layer 2/3 forwarding.** Web's voice path uses Web Speech API (not OpenAI Whisper) per `components/logging/VoiceLogger.tsx:130` which calls `/api/claude/parse-meal` directly with a transcript. There's no whisper telemetry to forward in the web flow. Web client untouched.
- **Native is the consumer of `/api/whisper/transcribe`.** Per `pantheon-native/lib/voice.ts:53`, the native client POSTs audio to the web's whisper route and gets a transcript back. Then `pantheon-native/app/log-food.tsx:193` calls parse-meal with the transcript.

For native to land Layer 3 end-to-end, two small changes are needed:
1. `pantheon-native/lib/voice.ts` — capture `whisper_audio_duration_ms`, `whisper_latency_ms`, `whisper_prompt_tokens`, `whisper_prompt_truncated` from the transcribe response.
2. `pantheon-native/app/log-food.tsx` — pass them through to the parse-meal request body as `whisper_telemetry: { ... }`.

**Both are out of scope for this web-only Alpha-ex-6 bundle.** Recommended as a small native follow-on commit. Until shipped, native parses simply lack whisper_* fields in the persisted telemetry — no break, just missing data for replay.

---

## §3 — Smoke output (scratch, deleted post-run)

Vocab builder against current live library:

```
build latency:   290ms
source_count:    25
char_count:      631
truncated:       true
prompt:
  "Churro, 3 eggs, Chocolate sauce, Dos Equis beer (16 oz), Guacamole,
   Margarita on the rocks, Shrimp fajitas with corn tortillas, Tortilla
   chips, Whipped cream, Protein Shake A - Pre-Workout, H-E-B Fajitas
   Chicken Thighs, Taylor Farms Mexican Street Corn Salad (half), David
   Protein Bar - Blueberry Pie, Harmless Harvest Organic Coconut Water,
   Double espresso, Half and half, Stevia Select Premium Hazelnut Stevia,
   Fage Total 0% Zero-Fat Greek Yogurt, Banana, Peanut butter, Test
   smoke meal, Bell & Evans Coconut Breaded Chicken Breast Tenders,
   Alden's Organic Mini Vanilla Ice Cream Sandwich, Avocado, Tandoori
   Spiced Chicken Breast"
```

Six expectation checks all pass:
- ✓ prompt non-empty
- ✓ char_count under cap (631 < 700)
- ✓ no trailing comma
- ✓ commas separate distinct entries (25 entries)
- ✓ matches a known saved_meal somewhere ("3 eggs", "Churro", "Double espresso")
- ✓ matches a known product somewhere ("David Protein Bar", "Stevia Select", "Harmless Harvest")

**Observation:** the prompt opens with recent-log foods (Shrimp fajitas, Tortilla chips, Margaritas — items from the recent restaurant meal), then library names (3 eggs, Double espresso), then products. Recent-log signals dominate the cap, which matches V20's spec ("ranked by recency desc → frequency desc → alphabetical"). 25 entries fit; the rest get truncated.

**Minor noise to note:** the recent-log scrape includes names from historical `food_log_entries.foods_json` rows that referenced now-deleted saved_meals. So entries like "Test smoke meal" or "Banana" still appear — not because the saved_meals exist, but because those names appear in past log payloads. Not architecturally wrong (Luke really did log those foods at one point), but a minor noise concern. Bounded by the 30-row limit; not load-bearing.

---

## §4 — Gate 1 spec checklist

### Alpha.2

| Spec from V20's brief | Status |
|---|---|
| Type-check passes | ✅ `npx tsc --noEmit` exit 0 |
| Manual smoke: same audio with/without prompt | ⏳ deferred — no audio fixture in Claude bash; Luke-side post-deploy validation |
| Vocab string under 224 tokens for current library size | ✅ 631 chars / ~200 conservative token estimate, well under cap |
| Truncation logic in place | ✅ smoke shows `truncated: true` (25/many candidates fit; rest get cut at last comma boundary) |

### Alpha.3

| Spec from V20's brief | Status |
|---|---|
| Telemetry visible in the database for any new transcription | ⏳ end-to-end requires (a) deployed transcribe route, (b) native client forwarding whisper_telemetry. Web parse-meal route accepts the field today; native pass-through is a follow-on |
| Field shape consistent with the existing _telemetry pattern | ✅ four fields namespaced `whisper_*`, all optional, spread into all 6 _telemetry return paths |

---

## §5 — Format-validation note (Phase 0 §2 callout)

V20's brief flagged: "Test with a sample utterance containing a brand name (e.g., 'David Bar' or a brand in Luke's products list) and confirm the brand transcribes correctly with the hint vs without."

I cannot run that test from Claude bash without an audio file — neither for "with hint" nor "without hint." OpenAI's Whisper accepts free-text in the `prompt` parameter per their docs; community usage shows comma-separated lists work fine; this matches Phase 0 §2's recommendation.

**The empirical "comma-separated vs sentence form" comparison Phase 0 mentioned is Luke-side post-deploy.** If the comma-separated approach underperforms in real use, the fallback per Phase 0 §2 is to switch the format inside `vocab.ts` (sentence form: "The user often eats X, Y, and Z."). One-line code change; doesn't affect the rest of the pipeline.

---

## §6 — Plan re-evaluation (per doctrine amendment)

**One observation about how the bundle interacts with the upcoming replay script (Alpha.8):**

The replay script can re-run text → parse-meal but cannot re-run audio → whisper (audio isn't archived). So whisper-side telemetry only flows for NEW parses post-deploy, not historical ones. **The replay script's whisper-related metrics will show zeros for the first N replay runs until Luke logs new meals through the deployed route post-push.** Not a regression; just means the whisper measurement spine takes time to accumulate signal.

**For Alpha.8's spec:** add a flag (e.g., `--include-whisper-telemetry`) that explicitly controls whether to surface whisper metrics. Default behavior should be "skip if not present" so historical replays don't mis-report.

**Carry forward to Alpha.8 spec (now the running list of three things from prior gates):**
- (a) Clear food_query_cache between replay runs (Alpha.1 finding)
- (b) Surface response_cache_hit_rate AND response_cache_write_rate (Alpha.5 finding)
- (c) Surface library_segmented_full_hit_rate vs library_segmented_partial_hit_rate distinctly with avg_resolved/unresolved_count (Alpha.4 finding)
- (d) Whisper telemetry only flows on post-deploy logs; replay script must handle missing whisper_* fields gracefully (Alpha.2/3 finding)

---

## §7 — What's NOT done in Alpha.2 + Alpha.3 scope

- Native client pass-through (lib/voice.ts + log-food.tsx) — flagged as native follow-on
- End-to-end audio smoke — Luke-side post-deploy
- Comma-separated vs sentence form A/B — empirical, post-deploy
- Alpha.8 (replay script) — pending in the locked sub-fix order
- No push to GitHub (per the bundle gate)

---

## §8 — Status / docket

**At bat:** Alpha.2 + Alpha.3 commit `f2bc7b9` awaiting V20 Gate 1 greenlight.

**On deck (post-greenlight):** Alpha.8 — replay measurement script at `scripts/replay-parse.ts`. Carries forward the four spec requirements accumulated across Alpha.1 / Alpha.4 / Alpha.5 / Alpha.2-3 gates.

**In the hole (after Alpha.8 lands):** bundle-level measurement against Luke's last 30 days of utterances, surfaced for V20's PROCEED PUSH greenlight.

**Cumulative bundle so far:** Alpha.7 + Alpha.1 + Alpha.5 + Alpha.4 + Alpha.2/3 = 5 commits, 8 files modified + 1 new file, 1 migration applied.

**Parallel thread:** Brick I steps 12-14 still blocked on Luke's interactive submit per HANDOFF_3.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA23_HANDOFF_1.md
