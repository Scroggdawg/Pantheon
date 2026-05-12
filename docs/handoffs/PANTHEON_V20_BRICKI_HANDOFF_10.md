# Brick I Build 21 — Pre-flight: GO

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Pre-flight only. No code, no commits, no rebuild this turn.

---

## §0 — Verdict

**GO on Build 21 from current HEAD `9660cda`.** Empirical fingerprint compare confirms diff against build 20 is **still only `appleTeamId`** — no latent divergence sources are active. Memory landed for the diagnostic-tool lesson; OTA_RUNBOOK.md amendment held per V20's deferral discipline until Build 21 outcome confirms the rebuild+retest cycle works.

---

## §1 — Pre-flight `eas fingerprint:compare` (current state vs build 20)

```
$ npx --yes eas-cli@latest fingerprint:compare \
    --build-id edc102f4-1168-48e2-b28d-1d221aea92f0 \
    --environment production --non-interactive

🔄 Fingerprint 60d025988dc1c4cd893fd720aa5db9d671319a70 from IOS build
   differs from fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from local directory

📁 Paths with native dependencies:
    modified file:  eas.json

📝 Modified content: Expo app config
@@ -48,0 +48,1 @@
+    "appleTeamId": "XSQ9GQH9Z4",
```

**Diff is single-line: appleTeamId.** Same as the post-publish diagnostic. No additional risks have surfaced post-Brick-I.1.1 + smoke marker. The `--environment production` flag loaded all five EXPO_PUBLIC env vars from EAS — they didn't change the diff, confirming env vars aren't a divergence source either.

Local working tree has the usual untracked NATIVE_*_HANDOFF.md files but those aren't in fingerprint scope.

Current state's fingerprint per EAS = `1949eb33d497f632a2469f958a99cedf8cf7a71d` — exactly matches the runtime version of the already-published smoke OTA on preview channel. Build 21 from this state will bake `1949eb...` as runtime, the smoke OTA targets `1949eb...`, they match, OTA reaches Luke's device on cold start. **Mechanically lined up.**

---

## §2 — Answers to V20's open questions

### Q1 — Latent fingerprint risks pre-flight

**No latent risks are active right now.** The three known concerns:

- `buildReactNativeFromSource: true` — no fingerprint diff. RN compile state is identical across build 20 and current HEAD.
- `patches/react-native+0.81.5.patch` — no fingerprint diff. Patch is unchanged.
- `@bacons/apple-targets` plugin — no fingerprint diff. Plugin's deterministic output is the same.

These remain LATENT — they could trip future commits if we modify the patch, upgrade the plugin, or change RN version. But TODAY they're dormant. The single live diff is appleTeamId.

### Q2 — `.fingerprintignore` pre-rebuild

**Don't land it.** `.fingerprintignore` is the right tool when EAS server-side INCLUDES files that local doesn't have (e.g., expo-sqlite pod-install adding `sqlite3.c`). That's not Pantheon's situation today. Adding entries pre-emptively would:

- Be theory-driven without empirical drift to validate against
- Risk excluding paths that legitimately SHOULD be in the fingerprint (silent OTA delivery to incompatible binaries — worse failure mode than the one we just diagnosed)
- Add a config file with no test coverage; broken `.fingerprintignore` patterns silently degrade to no-op

The right discipline is: run `eas fingerprint:compare` after each build, and if drift surfaces on a specific path, add THAT path to `.fingerprintignore` only when we can verify the exclusion is safe. Reactive, not preemptive.

### Q3 — Build 21 sequencing: anything else to land first?

**Nothing.** Three things checked:

- **Web-export bug** (Supabase auth-js + AsyncStorage SSR `window is not defined`): only bites `eas update --platform=all` (web target triggers static rendering). `eas build --platform ios` doesn't trigger web export at all. Build 20 was iOS-only and didn't hit this; Build 21 same. **Doesn't affect rebuild.**
- **appExtensions configure-drift** (the static block I reverted from app.json during Brick I): that was a `eas update:configure` side-effect from re-serializing app.json. `eas build` reads the live app.json + plugin chain; @bacons/apple-targets generates appExtensions dynamically from its plugin config (line 78 of app.json: `"@bacons/apple-targets"`) at build time. The dynamic generation IS what build 20 used, and it's what Build 21 will use. **No regression risk.**
- **Anything else from research**: nothing surfaced. Tracking the latent risks via `eas fingerprint:compare` post-build is the right ongoing discipline; no pre-rebuild remediation needed.

### Q4 — Memory + runbook timing

**Memory: saved now.** `feedback_eas_fingerprint_diagnostic.md` indexed in MEMORY.md. Lesson is unambiguous (Phase 0 §2 told me to use the wrong tool; one empirical case proved it). Saving now reduces risk that the next session opens without the discipline. Future Phase 0 verification on fingerprint-relevant changes uses `eas fingerprint:compare` from the start.

**OTA_RUNBOOK.md amendment: held.** Per V20's deferral — wait until Build 21 confirms rebuild+retest actually works. Then write the runbook with empirical confidence:
- If rebuild+retest works: amendment says "use `eas fingerprint:compare` to predict + diagnose; rebuild on any non-empty diff before publishing OTA"
- If rebuild+retest doesn't work: amendment is more pessimistic, possibly requires architectural rethink

Either way the runbook lands AFTER Build 21 outcome is known.

---

## §3 — What Build 21 looks like (sequence preview)

Just to make the EXECUTE explicit when V20 greenlights:

```bash
cd /Users/scrogdawg/Code/pantheon-native

# 1. Build (~7-8 min per build 20)
npx --yes eas-cli@latest build \
  --profile production --platform ios \
  --non-interactive --no-wait \
  --message "S27 Op FASTRAK Brick I rebuild — verify OTA pipeline post-Brick-I.2 fingerprint shift"

# 2. After Apple-side processing settles, submit (NON-interactive now — ascAppId is correct in eas.json)
npx --yes eas-cli@latest submit --platform ios --latest --non-interactive
```

After build + submit:
- Apple processes → TestFlight install ready
- Luke installs build 21
- Luke force-quits + cold-starts twice
- Look for `· ota1` suffix on version label

**Outcome paths handled in HANDOFF_9 §5; recapping:**
- Marker visible → Gate 2 → `eas update --branch production --platform ios` → Brick I closes, OTA_RUNBOOK amendment writes the success framing
- Marker missing → re-run `fingerprint:compare --build-id <build-21-id>` to surface what else diverged (would suggest one of the latent risks went live during the rebuild, e.g., a different EAS server version computing differently)

---

## §4 — One observation for future Phase 0 discipline

The `eas fingerprint:compare` tool was never mentioned in Phase 0 of Brick I. I went deep on `runtimeVersion` policy choice (P0.2: appVersion vs sdkVersion vs fingerprint) and ended up recommending fingerprint with a "validate locally before each publish" caveat — citing `npx @expo/fingerprint generate`. That citation was wrong; the right tool was always `eas fingerprint:compare`.

**This is a "Phase 0 didn't surface the right tool" failure mode.** Worth a doctrine note: when Phase 0 cites a tool by name, run `<tool> --help` or `eas <category> --help` during Phase 0 to confirm there isn't a more authoritative variant in the same family. EAS CLI has `fingerprint:`, `update:`, `build:`, `submit:` namespaces; each can have multiple commands. Skimming `--help` once at Phase 0 time is cheap.

I'll consider whether this rises to a memory rule or stays in the V20-side `A_TALE_OF_TWO_CLAUDES` amendment basket. Surfacing for V20 to weigh in.

---

## §5 — Status / docket

**At bat:** V20 reviews + issues GO/NO-GO on Build 21. My recommendation: GO.

**On greenlight:** I run the build + submit sequence in §3. Background-monitor Vercel-style for build completion, surface state when it lands.

**On Build 21 outcome:**
- Marker visible → promote to production, write the OTA_RUNBOOK amendment with success framing, Brick I closes
- Marker missing → re-diagnose via `fingerprint:compare`, decide between iterate or pivot to (iii)

**Memory landed this turn:** `feedback_eas_fingerprint_diagnostic.md`. Indexed.

**Pre-existing web-export bug:** still future docket. Doesn't affect Build 21.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_10.md
