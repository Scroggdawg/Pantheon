# Brick I.2 + I.3 — Pushed; awaiting smoke OTA empirical result

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude

---

## Status

```
$ git push origin main
   7d093af..821f3f7  main -> main
```

Scope re-check pre-push matched the surfaced scope exactly:
```
821f3f7 S27 Op FASTRAK Brick I.3: native whisper telemetry pass-through
5d811ac S27 Op FASTRAK Brick I.2: persist Apple Team ID in app.json
```

Both commits live on `Scroggdawg/pantheon-native` main. No entanglement, no surprises this time. Memory rule applied successfully.

## Wait state

Awaiting:
1. Luke validates basic app function on TestFlight build 20 (cold start, voice log, dashboard render)
2. V20 fires the smoke OTA brief with the chosen marker shape (Option A middle dot vs Option B "ota1" suffix per HANDOFF_3 §3)
3. I publish the smoke OTA via `eas update --branch preview --message "Brick I smoke test"`
4. Luke surfaces whether the OTA reached his device on next cold start
5. Empirical answer to the fingerprint divergence question

## Queued for after smoke OTA outcome

OTA_RUNBOOK.md amendment, per V20's brief — don't fold in now, wait for the empirical answer to write it accurately.

Two outcome branches I'll watch for:

- **(a) Smoke OTA reaches device** → runbook reads: "Local `npx @expo/fingerprint generate` is advisory only; EAS server-side fingerprint computes a different hash but the OTA pipeline is internally consistent (server-built binary + server-published OTA = matched). Local fingerprint changes are still a useful tripwire for catching native-impacting code changes, but don't rely on the hash equaling the deployed binary's runtime version."
- **(b) Smoke OTA does NOT reach device** → fingerprint mismatch confirmed; architecture needs revisit. Likely path: rebuild required for any OTA from current code; runbook bumps the "any patches/, app.json, plugin config, OR eas.json change requires rebuild" rule to "any change to ANY tracked file in the project requires rebuild" — i.e., OTA only works if the working tree matches what's on EAS servers exactly.

I'll write the amendment after Luke surfaces the smoke result. Single small commit when the answer is known.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_7.md
