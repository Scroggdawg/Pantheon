# Brick I.2 + I.3 — Gate 1 (held; awaiting push greenlight)

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on two bundled commits + push-scope confirmation
**Mode:** Local commits, NOT pushed. Push scope check per the locked memory rule.

---

## §0 — Status

Both small native fixes shipped clean as separate commits:

```
821f3f7 S27 Op FASTRAK Brick I.3: native whisper telemetry pass-through
5d811ac S27 Op FASTRAK Brick I.2: persist Apple Team ID in app.json
```

Local main is **2 commits ahead of origin/main**. Push scope confirmation per memory rule:

```
$ git log --oneline origin/main..HEAD
821f3f7 S27 Op FASTRAK Brick I.3: native whisper telemetry pass-through
5d811ac S27 Op FASTRAK Brick I.2: persist Apple Team ID in app.json
```

Both commits are intended scope per V20's brief ("Both fixes are file-disjoint so they can be done in either order or bundled"). **Confirming the push scope is exactly these two — no others entangled.** Awaiting Gate 1 + push greenlight.

---

## §1 — Brick I.2: Apple Team ID

### Diff (1 line)

```diff
   "ios": {
+    "appleTeamId": "XSQ9GQH9Z4",
     "supportsTablet": false,
     "bundleIdentifier": "guru.pantheon.app",
```

### Verification

- ✅ JSON valid (`json.load` parsed cleanly)
- ✅ `expo.ios.appleTeamId` reads `'XSQ9GQH9Z4'`
- ✅ **Fingerprint impact: NONE.** Empirically verified by stash/recompute:
  ```
  WITH appleTeamId:    913d97860c27984abbf7f9474e375d25a80e627d
  WITHOUT appleTeamId: 913d97860c27984abbf7f9474e375d25a80e627d
  ```
  V20's "fingerprint drift not expected" call was correct. Brick I.2 is OTA-pipeline-safe.

### One observation that surfaced during verification

The deployed binary (build 20 / `edc102f4`) has runtime version `60d025988dc1c4cd893fd720aa5db9d671319a70` per `eas build:view`. Local `npx @expo/fingerprint generate` at the same git state (commit `7a848db`, the Brick I commit that built into build 20) computes `913d97860c27984abbf7f9474e375d25a80e627d`.

These are different SHA-1 hashes. Either:
- EAS server-side `@expo/fingerprint` runs a different version than my local invocation
- File scope or normalization differs between server and local
- Some other algorithmic difference

**Material implication:** can't predict from local fingerprint check whether an OTA published from current code will reach the deployed binary. Empirical truth comes when smoke OTA fires (Luke's TestFlight install + `eas update --branch preview`). If it fails to reach his device, fingerprint mismatch is the cause; recovery is rebuilding.

**Not blocking this commit** — Brick I.2 doesn't make the situation worse (fingerprint identical pre/post). Just flagging for V20 awareness when smoke OTA finally fires.

---

## §2 — Brick I.3: native whisper telemetry pass-through

### Diff summary (3 files, +78/-16)

| File | Δ | Purpose |
|---|---|---|
| `lib/voice.ts` | +37/-9 | New exports `WhisperTelemetry` + `TranscribeResult`; `transcribeAudio()` + `useVoiceRecorder().stop()` return shape upgraded from string to result object |
| `components/log/VoiceButton.tsx` | +6/-4 | `onTranscript` callback signature: `(text: string) => void` → `(result: TranscribeResult) => void` |
| `app/log-food.tsx` | +35/-3 | New state `whisperTelemetry`; voice callback captures both text+telemetry; TextInput typing clears telemetry; handleParse forwards as `whisper_telemetry` field in parse-meal body |

### Verbatim — voice.ts new exports

```typescript
export interface WhisperTelemetry {
  whisper_audio_duration_ms?: number
  whisper_latency_ms?: number
  whisper_prompt_tokens?: number
  whisper_prompt_truncated?: boolean
}

export interface TranscribeResult {
  transcript: string
  whisper: WhisperTelemetry
}
```

### Verbatim — log-food.tsx parse-meal forwarding

```typescript
// Op FASTRAK Alpha.3 native pass-through — forward whisper telemetry
// when the transcript came from voice (whisperTelemetry !== null).
const parseMealBody: { transcript: string; whisper_telemetry?: WhisperTelemetry } = {
  transcript,
}
if (whisperTelemetry) parseMealBody.whisper_telemetry = whisperTelemetry

const res = await apiFetch("/api/claude/parse-meal", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(parseMealBody),
})
```

### UX semantics — clearing whisper on user typing

When voice fires, both `text` and `whisperTelemetry` are set. If the user then TYPES in the TextInput (any keystroke), `whisperTelemetry` clears to `null`. Reasoning: stale audio telemetry shouldn't propagate to a parse where the user has retyped the transcript. Voice → parse with no edits = whisper telemetry persists. Voice → small typo fix → parse = whisper telemetry cleared on first keystroke. Conservative semantics; the cost is small (we lose telemetry for one parse) and the gain is correctness (no stale data in replay measurement).

### Verification

- ✅ Type-check passes (`npx tsc --noEmit` exit 0)
- ✅ Fingerprint **unchanged** at `913d97860c27984abbf7f9474e375d25a80e627d` — TS-only edits don't affect native runtime fingerprint, as expected
- ⏳ End-to-end empirical verification deferred: requires deployed code + Luke voice-logging a meal. Replay script (Alpha.8) will surface `whisper_*` fields in the per-case diff once Luke's first post-deploy voice log lands.

---

## §3 — Push scope check (per locked memory rule)

Per `feedback_git_push_scope_surfacing.md` (just landed in memory): list all commits before push, confirm scope.

```
git log --oneline origin/main..HEAD:
  821f3f7 S27 Op FASTRAK Brick I.3: native whisper telemetry pass-through
  5d811ac S27 Op FASTRAK Brick I.2: persist Apple Team ID in app.json
```

**Two commits ahead. Both intended.** No other entangled work to surface. Push will land exactly Brick I.2 and Brick I.3 on `Scroggdawg/pantheon-native`.

---

## §4 — Gate 1 spec checklist

### Brick I.2

| Spec | Status |
|---|---|
| JSON valid | ✅ |
| Warning no longer surfaces | Should not on next install/configure run; not empirically verified in-session (next install is the test) |
| No fingerprint drift | ✅ verified empirically — identical hash with/without |

### Brick I.3

| Spec | Status |
|---|---|
| Type-check passes | ✅ exit 0 |
| voice.ts return shape includes whisper_* | ✅ TranscribeResult interface exposed |
| log-food.tsx forwards them | ✅ conditional `whisper_telemetry` field in parse-meal body |
| Web parse-meal merges into _telemetry | ✅ already shipped in Alpha.2/3 (commit `f2bc7b9`, deployed) |
| End-to-end persistence | ⏳ requires Luke's next voice log — replay script will surface |

---

## §5 — Plan re-evaluation (per doctrine amendment)

**The fingerprint observation in §1** is a real datapoint worth carrying forward. Brick I's fingerprint policy assumed local `@expo/fingerprint` would compute the same hash as the EAS server. Empirically they don't match. This isn't catastrophic (the OTA pipeline IS using consistent server-side fingerprints throughout), but it means:

- We can't preemptively check "will this OTA reach the deployed binary?" with local fingerprint computation
- The OTA_RUNBOOK.md `Verify fingerprint before publishing` step is essentially advisory only, not actually predictive

**Recommended OTA_RUNBOOK.md amendment** (separate small commit when convenient, or fold into next runbook update): note that local fingerprint and EAS server-side fingerprint diverge; the only reliable empirical check for OTA-binary compatibility is running an `eas update --branch preview` and observing whether the device picks it up.

**Brick I.2 + I.3 themselves are clean.** Both fingerprint-safe. Both narrow in scope. Both verified to the extent possible without a deployed environment.

---

## §6 — Status / docket

**At bat:** V20 reviews:
1. Brick I.2 Gate 1 — straightforward (one-line JSON addition, fingerprint verified safe)
2. Brick I.3 Gate 1 — three-file TS plumbing, type-check + fingerprint verified, end-to-end deferred to Luke's next voice log
3. Push-scope confirmation — both commits, no entanglement, intended scope

**On Gate 1 + push greenlight:** I run `git push origin main` to land both on `Scroggdawg/pantheon-native`.

**On deck (no action this turn):**
- Smoke OTA marker choice (V20 + Luke to resolve when TestFlight validates) — held
- OTA_RUNBOOK.md amendment re: local-vs-server fingerprint divergence — small commit when convenient
- Apple processing → TestFlight install (Luke-side, no ETA signal)

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_6.md
