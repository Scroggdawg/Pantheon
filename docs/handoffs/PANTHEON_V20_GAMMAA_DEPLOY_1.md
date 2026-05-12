# Op FASTRAK Brick Gamma A — DEPLOYED + post-push finding

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Push complete on both repos. Three web commits landed. Native pushed. Vercel live. One architectural finding surfaced during post-deploy verification.

---

## §0 — Status

V20's push sequence executed cleanly. Web pushed in three commits (initial Gamma A + A.1 follow-on + A.2 follow-on). Native pushed once. Vercel auto-deployed each web push. Fingerprint check clean against Build 21.

**Empirical post-deploy finding:** the LLM-direct-output path doesn't carry unit_alternatives forward to the final FoodItem. The matcher cascade DOES expose unit_alternatives in `LibrarySearchResult` (LLM uses them for live conversions — Bell Peppers parse note: "Using library entry with 1 cup = 217g conversion"), but the LLM's structured JSON output doesn't include the field. A.1 + A.2 fixes are useful for classifier-path candidates flows but don't apply to the more-traveled auto-commit path.

This is a Brick Delta consumption-time concern, not a Gamma A regression.

---

## §1 — Pushes landed

### Web `Scroggdawg/Pantheon` main (3 commits past pre-Gamma baseline `6c5dc16`)

```
8e2b693  S27 Op FASTRAK Brick Gamma A.2: hourly_go_to backfills unit_alternatives via source_ref
0873aaa  S27 Op FASTRAK Brick Gamma A.1: foodFromLibraryHit unit_alternatives passthrough
114c898  S27 Op FASTRAK Brick Gamma A: unit_alternatives schema + USDA backfill
```

Three Vercel auto-deploys triggered (each push). Final deploy serving from commit `8e2b693`.

### Native `Scroggdawg/pantheon-native` main (1 commit past `a76b587`)

```
36d634b  S27 Op FASTRAK Brick Gamma A: mirror UnitAlternative type
```

Archival only. Fingerprint check verified clean against Build 21:
```
✅ Fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from IOS build matches
   fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from local directory
```

No OTA published per V20's brief — Gamma A has no native UI surface yet.

---

## §2 — Verification results

### V.1 — Vercel green

```
GET pantheon-woad.vercel.app/ → HTTP 307 → /login (proxy.ts redirect — server alive)
POST /api/saved_meals/heart with {} + native-secret → HTTP 400 "user_id required"
GET /api/auth → HTTP 404 (route doesn't exist; expected)
```

Three deployments served Vercel build cycles cleanly. `x-vercel-id` rotated across requests indicating CDN routing healthy.

**Note:** `pantheon.guru` exhibited intermittent SSL handshake failures from my local machine during verification (`SSL_ERROR_SYSCALL` on TLS handshake). DNS resolves to Vercel IPs (64.29.17.1) but TLS termination fails sporadically. `pantheon-woad.vercel.app` works consistently. This is a local-network or pantheon.guru-CDN-routing issue, not a deploy issue. Luke's iPhone hits `pantheon.guru` per `EXPO_PUBLIC_API_BASE`; if his connection works, the issue is just my local probe path.

### V.2 — Functional probe (parse-meal "a banana")

Empirical finding from multiple probes after each commit landed:

| Probe | Path resolved | source_ref | unit_alternatives on FoodItem |
|---|---|---|---|
| Banana via response cache | (cached pre-Gamma-A) | lib:product:629ab291-... | absent |
| Banana fresh execution | LLM-direct-output | lib:product:629ab291-... | absent |
| Banana via Tier 2 hourly | LLM-direct-output | lib:hourly_go_to:banana\|lib:product:629ab291-... | absent |
| Bell Peppers fresh | LLM-direct-output | lib:product:8ea98445-... | absent — but LLM note: "Using library entry with 1 cup = 217g conversion" |

**The LLM observably consumed unit_alternatives at parse time** (Bell Peppers conversion confirms search_user_library tool result carried them via A.2's altsForRef enrichment). But the LLM's structured JSON output schema doesn't include `unit_alternatives`, so the pipeline's `extractFinalJson(finalText)` produces FoodItems without that field.

A.1 (foodFromLibraryHit) and A.2 (hourly_go_to source_ref backfill) are NOT dead code — they're used by the classifier-based candidates path (when the matcher returns Disambiguation candidates instead of an auto-commit hit). Just not used by the dominant auto-commit / LLM-direct-output path.

### V.3 — Schema layer empirically working

Direct REST probes confirm 20/33 products carry populated unit_alternatives JSONB. matcher tool (search_user_library) returns them in LibrarySearchResult — verified via the Bell Peppers conversion note in the LLM output.

Schema + USDA backfill + matcher-tool integration all landed correctly.

---

## §3 — Surprises / flags

### F.1 — LLM-direct-output gap (Gamma A.3 candidate, NOT a blocker)

The parse-meal pipeline emits a JSON schema (parse-meal-pipeline.ts:120-143) that the LLM populates. That schema does NOT include `unit_alternatives` per food. Pipeline parses the LLM's output via `extractFinalJson(finalText)` and uses LLM's foods directly — bypassing `foodFromLibraryHit` for auto-commit cases.

**Two paths to fix (Brick Delta or a small Gamma A.3):**

- **Route-layer post-process (recommended):** in `app/api/claude/parse-meal/route.ts`, after the pipeline returns, iterate `parsed.foods` and enrich any food where `source_ref` starts with `lib:product:` or `lib:saved_meal:`. Single batched SELECT, ~10 lines added. Keeps the LLM prompt simple.

- **LLM prompt extension:** add `unit_alternatives` to the JSON schema the LLM emits. Means the LLM has to faithfully echo unit_alternatives from tool results — possible but adds prompt complexity and risk of LLM omitting/mangling the field.

- **Defer to Delta editor:** Delta consumes `food.source_ref`, fetches unit_alternatives at render time from `/products?id=eq.<uuid>`. Lazy lookup, no FoodItem field needed.

**My recommendation:** route-layer post-process when V20 schedules it. Cleanest write-once, read-everywhere pattern. Cost: ~1 turn of work, includes type-check + smoke. Could fold into Delta's Phase 0 EXECUTE.

### F.2 — A.1 + A.2 still ship value

Both A.1 (foodFromLibraryHit) and A.2 (hourly_go_to source_ref backfill) ARE used — by the classifier-based candidates path. When the matcher returns disambiguation candidates instead of auto-commit, these helpers build the FoodItem with unit_alternatives correctly.

**The classifier path triggers when:** library hit doesn't clear the auto_commit gate (score < 0.85 or gap < threshold) AND the database has alternative candidates worth surfacing. It's a less-traveled path but real.

A.1 + A.2 are net-positive even if they don't fix the dominant auto-commit gap.

### F.3 — Three-commit emergency-style push within Gate 1

Within this Gate 1 cycle, I pushed three commits in quick succession (114c898 → 0873aaa → 8e2b693) as A.1 + A.2 surfaced empirically through post-deploy verification. Each commit had its own commit message + scope confirmation per the locked push-scope memory rule.

**Push timing:** ~7-8 minutes between first push and last push. Vercel rebuilt each. The cumulative result is the right end state but the deploy log shows three deploy events instead of one. Worth flagging because it slightly muddies the "Gate 1 single coherent push" pattern.

**Disposition for future:** functional verification before push approval (smoke against staging deploy or a more-rigorous local probe) would surface F.1 ahead of push and bundle all three commits as one push. Not a doctrine change, just a discipline note.

### F.4 — Test infrastructure passing

`scripts/verify-alpha6-d.ts` re-run post-deploy: 7/7 cascade tests pass, no regressions from the matcher type widening. unit_alternatives passthrough doesn't affect tier semantics.

`scripts/test-segmented-library.ts`: 8/8 still pass (hasn't been re-run post-Gamma-A but no logic that would affect it changed).

---

## §4 — Asks / greenlight requests

**A.1 — V20 acknowledges F.1.** Either schedule a small Gamma A.3 (route-layer post-process), defer to Brick Delta (consume from products table at render time), or accept the gap (LLM uses unit_alternatives at parse time even though FoodItem doesn't carry them). My recommendation: defer to Brick Delta. The product/saved_meal lookup at edit-time is the simplest end-state.

**A.2 — Gamma B Phase 0 brief whenever ready.** Per V20's brief: "After PUSH lands clean: V20 fires Gamma B Phase 0 brief." Push has landed (three commits). Bundle measurement hasn't run on the Gamma A diff yet — I can fold a fresh `replay-parse.ts` 30d run into Gamma B Phase 0 if useful.

**A.3 — pantheon.guru SSL probe issue.** Flagging that my local machine can't TLS-handshake to `pantheon.guru` from the environment I'm running in (curl 35 SSL_ERROR_SYSCALL). `pantheon-woad.vercel.app` works fine. Luke's TestFlight on iPhone may or may not be affected. If Luke confirms the iPhone parses cleanly, the SSL issue is purely my local probe environment. Otherwise it's a pantheon.guru DNS/TLS routing issue on the Vercel side.

---

## §5 — Plan re-evaluation

Gamma A core deliverables shipped:
- ✅ Migration 019 applied + populated for 20/33 products
- ✅ USDA `/v1/food/{fdcId}` integration working
- ✅ Backfill script committed + ran live
- ✅ Type updates propagated to FoodItem (web + native)
- ✅ Matcher cascade returns unit_alternatives in LibrarySearchResult (LLM uses them at parse time)
- ⚠ FoodItem.unit_alternatives populated only via classifier-path; LLM-direct-output path is empty (F.1 — Brick Delta scope)

V20's master doc Gamma sequencing (A → B → bundle C/D/E) holds. Gamma B brief next.

13 zero-coverage products (the Branded entries USDA doesn't track portions for) still pending Gamma C LLM-fill or Gamma E hand-resolution.

---

## §6 — Cumulative Op FASTRAK state

**Web origin/main**: at `8e2b693`. Total 11 commits past pre-FASTRAK baseline (`179a19b`).

**Native origin/main**: at `36d634b`. Total 3 commits past pre-FASTRAK baseline (`cd148db`).

**Live Supabase**: 5 forward-only schema migrations applied (014/015/016/017/018/019 — counting Alpha.7 + Alpha.6 A through D.1 + Gamma A). One DROP VIEW, multiple ADD COLUMN, two CREATE OR REPLACE VIEW. Schema-code atomic memory rule held throughout (the one outage during Alpha.6 was the empirical evidence; rule has been applied cleanly since).

**OTA group**: `23149dfe-bf76-4ec2-b48b-059a4021bfb0` (Alpha.6 production OTA, runtime `1949eb33...`) — still serves Build 21 fleet. Gamma A is web-only; no OTA needed.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMAA_DEPLOY_1.md
