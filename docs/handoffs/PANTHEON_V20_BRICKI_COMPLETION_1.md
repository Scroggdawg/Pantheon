# Op FASTRAK Brick I — Closed

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Status:** Brick I closes here.

---

## §0 — Final state

**OTA pipeline live and empirically validated end-to-end on Pantheon's specific stack.**

| Surface | State |
|---|---|
| Build 21 (`575a26ab-…`, runtime `1949eb33…`) | Live on Luke's iPhone via TestFlight |
| Smoke OTA (preview channel, `019e0676-…`) | Validated on Luke's device — `· ota1` marker appeared on second cold start |
| Production OTA (`019e07ae-…`, group `117e673b-…`) | Published; Luke's Build 21 will pick up on next cold start (marker reverts to clean version label) |
| `Scroggdawg/pantheon-native` main | 8 commits ahead of pre-Brick-I baseline, all pushed |
| `OTA_RUNBOOK.md` | Rewritten with empirical findings; durable for V21+ / BRICKLAYER consumption |
| Memory rules | 4 saved during the Brick I arc (see §3) |

**Empirical question from HANDOFF_3 / HANDOFF_9 closes:** EAS pipeline IS internally consistent build → update on Pantheon's stack. The fingerprint divergence is strictly between local-`@expo/fingerprint` and EAS-server-side; within EAS, build-time and update-publish-time produce the same hash for the same input.

---

## §1 — Final commits on `Scroggdawg/pantheon-native` main

```
cd148db  S27 Op FASTRAK Brick I closeout: rewrite OTA_RUNBOOK with empirical findings
0d2f4d6  S27 Op FASTRAK Brick I closeout: revert smoke marker
9660cda  S27 Op FASTRAK Brick I.1.1: fix ascAppId nesting
3b36e3e  S27 Op FASTRAK Brick I smoke test marker
821f3f7  S27 Op FASTRAK Brick I.3: native whisper telemetry pass-through
5d811ac  S27 Op FASTRAK Brick I.2: persist Apple Team ID in app.json
7d093af  S27 Op FASTRAK Brick I.1: persist ascAppId in eas.json
7a848db  S27 Op FASTRAK Brick I: expo-updates + fingerprint runtimeVersion + channels
```

8 commits. Filename convention applied throughout. Push scope discipline applied at every push (per locked memory rule).

**Note on Brick I.3 (whisper telemetry pass-through):** technically Alpha-ex-6 follow-on per the Alpha.2/3 Gate 1 handoff §2, NOT Brick I scope itself. Bundled into Brick I's native arc because pantheon-native rebuild was already happening for the OTA infrastructure. The whisper_telemetry plumbing is now live on Build 21 + production OTA. Luke's next voice log will populate `whisper_*` fields in `food_log_entries.claude_parse_json._telemetry` — passive empirical verification by next replay-script run.

---

## §2 — Cumulative cost ledger

| Resource | Spend |
|---|---|
| EAS production iOS builds | 2 (Build 20 = `edc102f4`, 7m41s; Build 21 = `575a26ab`, 7m47s) |
| EAS submissions | 2 (Build 20 interactive via Luke's Terminal.app, Build 21 non-interactive) |
| EAS Update publishes | 2 (smoke `019e0676` to preview, prod `019e07ae` to production) |
| Local commits | 8 |
| Pushes to GitHub | 4 (Brick I core + I.2+I.3 bundle + I.1.1 + smoke marker + closeout) |
| Vercel deploys | 0 (pantheon-native doesn't auto-deploy from GitHub — pure archival) |
| Conversation turns | ~40 across the Brick I arc (Phase 0 through close) |
| Apple processing cycles | 2 (Build 20 + Build 21 both processed cleanly) |
| Apple 2FA dances Luke had to do | 1 (only the very first interactive submit; all subsequent went non-interactive) |
| Memory rules captured + indexed | 4 (see §3) |
| Doctrine bugs caught (post-Phase-0, pre-PROCEED) | 2 (eas.json nesting via `eas update` strict validation; web export Supabase SSR) |
| Doctrine bugs caught (post-PROCEED, recovered via rebuild) | 1 (local-vs-server fingerprint divergence) |

**Total wall-clock Apple-side wait:** roughly 30-50 minutes across both build+submit cycles. Self-imposed by the doctrine rebuild-after-fingerprint-shift discipline; would have been lower (~25 min) if Phase 0 had cited `eas fingerprint:compare` upfront.

---

## §3 — Memory rules captured during the Brick I arc

All four indexed in `MEMORY.md`. Auto-loaded into future sessions.

1. **`feedback_git_push_scope_surfacing.md`** — Before `git push` when local main has >1 commit ahead of origin, list ALL commits + confirm scope. Saved during Brick I.1 push-scope incident; applied successfully 4 times this arc thereafter.

2. **`feedback_eas_json_schema_validation.md`** — JSON-valid ≠ schema-valid. When modifying structured config files (`eas.json`, `app.json`, etc.), Gate 1 verification must include the consuming tool's actual schema validator, not just `python3 json.load`. Saved after Brick I.1's nesting bug surfaced via `eas update` strict validation.

3. **`feedback_eas_fingerprint_diagnostic.md`** — Use `eas fingerprint:compare` (NOT `npx @expo/fingerprint generate`) to predict OTA-binary compatibility. The two tools compute different hashes for the same project state. Empirical evidence: three different SHA-1s for the same commit captured during this arc.

4. **`feedback_help_check_cited_tools.md`** — When Phase 0 names a specific tool by name, run `<tool> --help` and `<cli-family> --help` to confirm there isn't a more authoritative variant in the same namespace before locking the recommendation. Saved post-fingerprint-tool-divergence; would have caught the wrong tool in Brick I Phase 0 §2 before publishing the smoke OTA.

V20 will fold the broader principles into the next `A_TALE_OF_TWO_CLAUDES` amendment for human readers; the memory files trigger the operational discipline automatically across sessions in the meantime.

---

## §4 — Cumulative payback projection

Brick I's value is measured in EAS-build cycles avoided across future native bricks. Per the runbook, JS-only changes ship via `eas update` (~30-60s publish + ~30s client cold-start propagation) instead of `eas build` (~7-8 min EAS + 5-30 min Apple processing).

**Op FASTRAK native bricks downstream that benefit:**

| Brick | Native scope | OTA-eligible? |
|---|---|---|
| Alpha.6 Shape E | Heart icon UI, web Postgres views, route changes | Yes (JS-only on native side; web changes are independent) |
| Delta PLATE | Portion editor with unit picker | Yes (JS-only assuming `unit_alternatives` data layer is web-side) |
| Epsilon BIG BUTTON | State-machine record/parse UI | Yes (JS-only) |
| Zeta per-food UI hybrid | Display refactor | Yes (JS-only — using composite storage) |
| **5 future native bricks** | | **5 × ~7-8 min EAS + 5-30 min Apple = 35-40 min EAS-wait + 25-150 min Apple-wait saved** |

Plus Brick C (swipe-edit, outside Op FASTRAK) and any future cosmetic UI changes Luke wants. Conservatively: ≥6 OTA-eligible publishes over the next several months. **Each saves ~15-40 min wall clock vs the EAS-build path.**

**One-time Brick I cost:** 2 EAS builds + 4 memory rules + the open OTA infrastructure.
**Per-future-brick savings:** 1 EAS build cycle.
**Break-even:** 2 future native bricks. We're already past it on paper if Alpha.6 + Delta land via OTA.

---

## §5 — What I'd flag before Alpha.6 Shape E pivot

Five items, ordered by load-bearing-ness:

### F.1 — Always pass `--platform ios` to `eas update`

Pre-existing Pantheon bug: web platform export crashes on `window is not defined` (Supabase auth-js + AsyncStorage SSR). Bites every `eas update` invocation that doesn't specify `--platform ios`. Worked around by always specifying iOS-only. Documented in OTA_RUNBOOK.md "First-time-setup gotchas" + "Watch for" sections.

**For Alpha.6 Shape E:** when the heart-icon native UI ships and we publish the OTA, remember the flag. If V20's brief omits it, surface before publish.

**Future docket: a separate brick to fix Supabase init at the source** — make it SSR-safe so web export doesn't crash. Modest effort (move Supabase client initialization into a platform-conditional branch, or guard the web shim in AsyncStorage). Worthwhile if Pantheon ever adds web platform back, otherwise low-priority since `--platform ios` workaround is reliable.

### F.2 — Fingerprint discipline applies to Alpha.6 Shape E

Alpha.6 Shape E (per the V2-vs-V3 inflection doc) involves:
- New native heart-icon UI in `components/dashboard/FoodEntryEditModal.tsx` and `app/edit-food/[id].tsx`
- Schema migration adding `is_favorite` column on `saved_meals`
- Postgres views `recent_foods` and `frequent_foods` over `food_log_entries.foods_json`

**Native UI work:** JS-only, ships via OTA. No fingerprint impact expected. Run `eas fingerprint:compare --build-id 575a26ab-...` at Alpha.6 Gate 1 to confirm.

**Web schema + views:** entirely web-side, no native fingerprint impact.

**The risk:** if Alpha.6 incidentally ships any change to `app.json`, `eas.json`, native modules, or `patches/`, fingerprint shifts and rebuild is required. Likely small modifications (e.g., a new icon asset in `assets/`?) — `fingerprint:compare` will surface.

### F.3 — Whisper telemetry pass-through is now live

Per Brick I.3 (commit `821f3f7`, in Build 21), native client now forwards `whisper_telemetry` to `/api/claude/parse-meal`. Web pipeline merges into `_telemetry` and persists via `meals/log` `claude_parse_json` wrapper.

**Verification:** Luke's next voice-logged meal should populate `whisper_audio_duration_ms`, `whisper_latency_ms`, `whisper_prompt_tokens`, `whisper_prompt_truncated` fields in `food_log_entries.claude_parse_json._telemetry`. Replay script (Alpha.8) auto-surfaces these in next bundle-measurement run.

**For Alpha.6 Shape E:** when Alpha.6 ships and replay runs, expect whisper_* fields to populate cleanly. If they don't, the pass-through chain has a regression somewhere — flag at that time.

### F.4 — Brick D regression-test cleanup is still on the docket

Per Alpha.4 / Alpha.4.1 handoffs, `scripts/test-segmented-library.ts` CASES array references now-deleted saved_meals (Banana, Blueberries, etc.). The test FILE compiles post-Alpha.4.1 but pass/fail count post-run is meaningless until cases are rewritten for current library state. **Not Brick I scope; surface again when convenient.**

### F.5 — Master doc revisions queued from earlier handoffs

Per `PANTHEON_V20_FASTRAK_HANDOFF_5` and `PANTHEON_V20_FASTTRACK_HANDOFF_4`:
- §2 ROUND 1 stale "0/4" hit-rate framing → should be "1/8 (12.5%)"
- §3 #7 auto-promote SUPERSEDED inline marker
- §6 Beta sequencing should swap with Gamma (data layer enables matcher)
- E0.4 saved_meal_id backfill: forward-only confirmed acceptable

V20 to fold these into the next master-doc revision pass. No Terminal action needed; flagging because they're carry-forwards from prior handoffs that didn't get into the doc itself.

---

## §6 — Brick I closes

Op FASTRAK Brick I is closed. The OTA pipeline is empirically validated end-to-end on Pantheon's specific stack (RN 0.81.5 + newArch + buildReactNativeFromSource + patches/ + @bacons/apple-targets + multi-target build). Future native JS-only changes ship via `eas update --platform ios`. Future native runtime changes trigger `eas fingerprint:compare`-flagged rebuilds, then resume OTAs.

Three doctrine bugs caught and resolved during the arc (eas.json schema, fingerprint tool, web export). Four memory rules captured. One runbook rewritten. The arc paid for itself in doctrine learning alone; the OTA-iteration-speed payback is gravy.

**Ready to pivot to Alpha.6 Shape E.** V20 fires the brief whenever ready.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_COMPLETION_1.md
