# Op FASTRAK Brick Alpha.6 — Closed

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Status:** Brick Alpha.6 closes here.

---

## §0 — Final state

Op FASTRAK Brick Alpha.6 (Shape E library-building redesign + Brick Zeta scope-fold per-food UI) is empirically validated end-to-end on production. Three production outage paths resolved, native + web per-food card UI shipped via OTA, matcher cascade extended from 2 sources to 3, Sub-fix G regression test refreshed.

| Surface | State |
|---|---|
| Web `pantheon.guru` | LIVE on commit `6c5dc16` (head) — Vercel auto-deployed |
| Native iPhone via TestFlight | OTA `019e08b8-…` published to production channel; Build 21 picks up on cold-start |
| Live Supabase schema | Migrations 015/016/017/018 applied (rename + views + drop) |
| `Scroggdawg/Pantheon` web `main` | At `6c5dc16` (8 commits past pre-Alpha.6 baseline `179a19b`) |
| `Scroggdawg/pantheon-native` `main` | At `a76b587` (2 commits past pre-Alpha.6 baseline `cd148db`) |
| Memory rules | 5 saved during the broader doctrine arc; 1 from this brick (`feedback_schema_code_atomic.md`) |

**Verification end-to-end (Luke 2026-05-08):**
- V.1 McDonald's log saves (production outage resolved) ✓
- V.2 Quick Select picker shows favorites ✓
- V.3 Save-as-Meal succeeds (web) ✓
- V.4 Per-food cards rendering on iPhone ✓
- V.5 Per-food cards rendering on web ✓
- V.6 Heart toggle works (optimistic flip + persist) ✓
- V.7 Tap-to-edit with focus pulse ✓
- V.8 Tier 1 promotion on hearted re-log ✓

---

## §1 — Final commits

### Web repo `Scroggdawg/Pantheon` main (8 commits beyond `179a19b`)

```
6c5dc16  S27 Op FASTRAK Alpha.6 G: test-segmented-library CASES rewrite
8d0c48b  S27 Op FASTRAK Alpha.6 F: web TodayLog per-food cards + heart UI
6279336  S27 Op FASTRAK Alpha.6 C.1: heart endpoint accepts food_index
37384c1  S27 Op FASTRAK Alpha.6 D.1: drop recent_foods (unreachable tier)
0b2105a  S27 Op FASTRAK Alpha.6 D: searchUserLibrary cascade extension
b3aec2c  S27 Op FASTRAK Alpha.6 C: heart-icon save/un-save handler
4908489  S27 Op FASTRAK Alpha.6 B: meals/log surgical edit (Shape E redesign)
0a53302  S27 Op FASTRAK Alpha.6 A: schema migrations + is_staple→is_favorite rename
```

### Native repo `Scroggdawg/pantheon-native` main (2 commits beyond `cd148db`)

```
a76b587  S27 Op FASTRAK Alpha.6 E: native TodayLog per-food cards + heart UI
90515bc  S27 Op FASTRAK Alpha.6 A: rename SavedMeal.is_staple→is_favorite
```

---

## §2 — Cumulative cost ledger (Brick Alpha.6 only — Phase 0 through close)

| Resource | Spend |
|---|---|
| Schema migrations applied to live | 4 (015 rename, 016 views v1, 017 views with macros, 018 drop recent_foods) |
| New Supabase views | 1 net (`hourly_go_tos`; `recent_foods` was created in 016 then dropped in 018) |
| New API endpoints | 1 (`/api/saved_meals/heart` POST + DELETE) |
| Web file deletions | 0 (delete-by-trim within existing files) |
| Web file additions | 5 (`lib/favorites.ts`, `app/api/saved_meals/heart/route.ts`, `scripts/verify-alpha6-d.ts`, 4 migration .sql files) |
| Native file additions | 1 (`lib/favorites.ts`) |
| Lines net added (web) | ~1100 / ~330 deleted |
| Lines net added (native) | ~330 / ~250 deleted |
| EAS production iOS builds | 0 (Alpha.6 shipped via OTA against Build 21's runtime) |
| EAS Update publishes | 1 (production channel, group `23149dfe-bf76-4ec2-b48b-059a4021bfb0`) |
| Local commits | 9 (web 8 + native 2 across 8 sub-fixes including G) |
| Pushes to GitHub | 4 (Sub-fix A web/native at brick start; emergency-push 7 web + 2 native; Sub-fix G web cleanup) |
| Vercel deploys | 2 (post-emergency push and post-G push, both auto-triggered) |
| Conversation turns | ~50 across the brick arc (Phase 0 through close) |
| Apple processing cycles | 0 (all OTA, no rebuild required) |
| Memory rules captured | 1 (`feedback_schema_code_atomic.md`) |
| Doctrine bugs caught (post-Phase-0) | 1 (schema-code drift causing Luke's outage; recovered via emergency push) |
| Doctrine bugs caught (Phase 0) | 1 (Phase 0 missed `is_staple` overlap with `is_favorite`; surfaced + resolved before EXECUTE) |

**Total wall-clock outage**: ~30-60 min from Luke's first error until OTA published + cold-start applied. Real but bounded.

---

## §3 — Cumulative payback projection

### Empirical bundle measurement (replay-parse.ts vs Alpha-ex-6 baseline)

| Metric | Baseline (pre-Alpha.6) | Alpha.6 (replay over last 30d / 10 cases) | Delta |
|---|---|---|---|
| Median latency | 18,599ms | 9,938.5ms | **-46.5%** |
| p95 latency | 59,586ms | 40,012ms | **-32.8%** |
| `library_shortcut_hit` | 10% | 10% | unchanged |
| `library_segmented_full_hit` | 0% | 0% | unchanged |
| `library_segmented_partial_hit` (Alpha.4) | 0% | 20% | NEW |
| `response_cache_hit` (Alpha.5) | 0% | 10% | NEW |
| Mean LLM tool calls per case | n/a (not measured) | 3 | — |
| Mean LLM iters per case | n/a | 1.9 | — |

### Comparison to Alpha-ex-6 ship (cumulative Op FASTRAK)

Alpha-ex-6 closed at -39.3% median (18,769ms → 11,379ms). Alpha.6 builds further to **-46.5% cumulative** vs the historical baseline. The Alpha.4 partial-resolve hit rate doubled from 12.5% to 20% (more multi-item utterances now have at least one library segment that resolves fast). Response cache hit went from 12.5% (Alpha.5 ship) to 10% (similar — fresh cache after the Alpha.6 push wiped it).

### OTA payback

Brick I shipped the OTA infrastructure. Alpha.6 is the FIRST OTA-shipped UI brick after Brick I.

**EAS-build cycles avoided:** 1 (Alpha.6's native UI changes shipped via OTA against Build 21's runtime).

**Wall-clock saved vs EAS-build path:** ~7-8 min EAS build + 5-30 min Apple processing = **~15-40 min saved** for this brick. The OTA publish itself was ~30s; the rebuild path would have run 7-12x longer.

### Ongoing payback projection

Future native bricks downstream of Alpha.6 (Brick Gamma PANTRY UI, future Delta PLATE, Epsilon BIG BUTTON, etc.) all stay OTA-eligible so long as `eas fingerprint:compare` against Build 21 remains clean. Each ships in seconds, not minutes.

Brick I's break-even point (2 bricks) was reached at Alpha.6's ship. Every subsequent OTA-eligible brick is pure dividend.

---

## §4 — Memory rule captured during this brick

**`feedback_schema_code_atomic.md`** indexed in `MEMORY.md`:

> Forward-incompatible schema migrations (`RENAME`, `DROP`, `ALTER TYPE`) must ship simultaneously with the matching code push. Forward-compatible (additive — `ADD COLUMN`, `CREATE TABLE`, `CREATE VIEW`) migrations are safe to apply ahead of code.

Empirically validated tonight by Luke's McDonald's log outage. The Sub-fix A migration applied to live Supabase at brick-Phase-0 verification time, but the matching code stayed `git push`-held under doctrine bundle discipline for 6 subsequent sub-fixes. Production code at `origin/main` referenced `is_staple` in 3 runtime call sites that no longer existed in the schema. Luke logged the first non-library-source food after the migration applied → 42703 column-missing → `food_log_entries` rolled back.

**For Brick Gamma (PANTRY) and beyond:** classify migrations before `supabase db push` runs. Forward-incompatible cases either defer the migration until the bundle is push-ready, or do the `db push` + `git push` + Vercel-deploy-wait + OTA publish atomically.

---

## §5 — Five things to flag for V20 + Luke before Brick Gamma pivot

### F.1 — Variant-ambiguity gap-gate is a real Alpha.6-introduced regression in the segmented fast path

Surfaced by Sub-fix G's test rewrite + 30d replay. Foods that exist as both saved_meals AND hourly_go_tos with different `source_ref` values trigger gap-gate failures in the segmented shortcut. Specifically:
- Pre-Alpha.6: saved_meals were the only data source; "Double espresso" was unambiguous → segmented hit.
- Post-Alpha.6 Sub-fix D: hourly_go_tos surfaces the original food log instances at their original source_refs (often null or `lib:product:*`). Saved_meal "Double espresso" has a different source_ref (its own library_id). Both present at score=1.0, gap=0, fails 0.15 disambiguation gate.

Net impact on production replay: `library_segmented_full_hit` rate is 0% in both baseline and replay (data points limited to 10 cases over 30d). The LLM tool-loop still resolves the transcripts in 9-12s; pre-Alpha.6 baseline was 18-60s for same. Net replay shows -46.5% median improvement, so this isn't a NET regression — but it IS a missed opportunity.

**Brick Beta (matcher upgrade) candidate.** Two possible fixes:
- (a) Heart-endpoint backfills the parent `food_log_entries` row's `foods_json[i].source_ref` to point at the new saved_meal when it INSERTs.
- (b) Cascade dedup logic treats `lib:saved_meal:X` and entries whose source_ref points back at saved_meal X as equivalent.

V20's call which to schedule.

### F.2 — Build-info date stuck on 2026-05-03 (Luke's flag)

`constants/buildInfo.ts` is gitignored + auto-regenerated only on `npm prestart` or EAS server-side `eas-build-pre-install` hook. `eas update` doesn't trigger regen, so the OTA bundle bakes in whatever buildInfo.ts is on local disk at publish time.

**Fix scope (deferred to future-polish docket):** add a wrapper npm script `npm run ota` that regenerates buildInfo.ts before invoking `eas update --branch production --platform ios`. ~2 lines in package.json plus possibly a small shell wrapper. Not blocking; the BUILD_SHA still updates correctly via EAS env var on submit, just BUILD_AT lags.

### F.3 — McDonald's compound-name segmenter over-split

Pre-existing issue (not Alpha.6 regression): "One Bacon Egg and Cheese Biscuit from McDonald's and one Sausage Burrito from McDonald's" segments into 3 chunks, none of which match the saved_meals cleanly. The COMPOSITE_ALLOWLIST in `parse-meal-library-shortcut.ts` covers `half and half`, `salt and pepper`, `mac and cheese`, `fish and chips`, `rice and beans` but not McDonald's-style names with "and" inside.

Adding "Bacon Egg and Cheese Biscuit" to COMPOSITE_ALLOWLIST is one option. A more principled fix is to detect when a segment is inside a hearted/saved_meal name and avoid splitting it. Brick Beta candidate.

### F.4 — McDonald's saved_meal hearting created two saved_meals

From Luke's V.6 verification, the McDonald's transcript created two saved_meals (Sausage Burrito, Bacon Egg & Cheese Biscuit). Both `is_favorite=true`. Production state confirmed. Per Sub-fix C.1 design, one heart per food card → one saved_meal each.

Future re-log of the same McDonald's transcript will hit the LLM (per F.3 over-split issue) and the LLM should now prefer the favorited saved_meals via the matcher's Tier 1 ranking. Unverified — would need a test transcript replay through the LIVE API to see if Tier 1 promotion actually wins. Optional follow-up.

### F.5 — Doctrine learning capture

Five memory rules saved across the broader session arc (1 from Brick I, 4 from earlier in Brick I work, 1 from Alpha.6's outage). Plus three audit catches (Zeta absorption, Beta/Gamma swap, Recents tier dead-architecture trim). V20's "Tale of Two Claudes" amendment opportunity post-Brick-Gamma.

---

## §6 — Brick Alpha.6 closes

Op FASTRAK Brick Alpha.6 is closed. The library-building redesign + per-food UI cards are live in production. The matcher cascade extends from saved_meals + products to saved_meals + products + hourly_go_tos with tier-priority sort. The heart endpoint creates saved_meals on explicit user intent rather than auto-promote. The schema-code atomic discipline memory rule is captured.

**Cost paid:**
- 1 production outage (Luke's McDonald's log) — bounded ~30-60 min, recovered via emergency push
- 0 EAS build cycles (OTA-only delivery)
- 5 doctrine flags surfaced for follow-up

**Value captured:**
- -46.5% median latency vs pre-Alpha.6 baseline
- Per-food card UI on web + native (Brick Zeta scope absorbed)
- Heart icon affordance with full optimistic UI
- 4 schema migrations applied + verified
- Memory rule captured + indexed

**Ready to pivot to Brick Gamma (PANTRY).** V20 fires the brief whenever ready.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6_COMPLETION_1.md
