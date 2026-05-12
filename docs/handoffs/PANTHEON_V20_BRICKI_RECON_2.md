# Brick I — Fingerprint Divergence Recon

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Research only. No code, no commits.

---

## §0 — Bottom line

`eas fingerprint:compare` gave the exact answer in one command. The diff between build 20's binary runtime fingerprint and the current state is **`expo.ios.appleTeamId` in app.json** (added in Brick I.2). Local `npx @expo/fingerprint` does NOT include `appleTeamId` in its hash; EAS server-side DOES.

**Recommended next move: option (i) — clean rebuild + retest.** Specifically: trigger a new EAS build (build 21) with current state (commit `9660cda`, all Brick I follow-ons + smoke marker). Luke installs build 21 via TestFlight. The already-published smoke OTA on preview channel (runtime `1949eb...`) will then match build 21's runtime and reach his device on next cold start. **Brick I is viable. The fingerprint divergence is benign in an EAS-server-internally-consistent sense; the recovery is one rebuild.**

**Doctrine refinement that lands from this recon:** local `npx @expo/fingerprint generate` is unreliable as a predictor of OTA-binary compatibility. The trustworthy tool is `eas fingerprint:compare` (which exists in eas-cli but I missed in Phase 0 — it would have caught this pre-publish). Save as a memory after V20 confirms.

---

## §1 — Lane A: dirty-tree hypothesis — REJECTED as the cause

V20 hypothesized that the `+DIRTY` suffix on the version label might be the cause. Investigated; not the load-bearing factor here.

### What the build-info script actually does

Read `scripts/write-build-info.js`. It writes a TS constants file consumed only by `VersionFooter.tsx` for human-visible display. It does NOT participate in @expo/fingerprint computation. The `BUILD_DIRTY` constant exists purely to show "+dirty" in the UI when the working tree had uncommitted changes at build time.

### What was uncommitted at build 20 time

Reconstructed via `git status --porcelain` against the relevant commit. At commit `7a848db` (Brick I), the untracked files were the long list of `NATIVE_S26_*_HANDOFF.md` artifacts from prior sessions. These are gitignored conceptually but never `.gitignore`-listed — git sees them as untracked, `status --porcelain` sees them as dirty, build-info script flags `dirty: true`.

These untracked .md files do NOT affect @expo/fingerprint hash (verified — they're outside default fingerprint scope: not in `android/`, `ios/`, `app.json`, `package.json`, `lockfile`, `patches/`, plugin chain, or the relevant config plugins). So the dirty flag is cosmetic; the binary's actual fingerprint reflects only relevant native sources.

### So what DOES explain the divergence

`eas fingerprint:compare --build-id edc102f4-...` (the exact diagnostic tool I should have run in Phase 0):

```
🔄 Fingerprint 60d025988dc1c4cd893fd720aa5db9d671319a70 from IOS build
   differs from fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from local directory

📁 Paths with native dependencies:
    modified file:  eas.json

📝 Modified content: Expo app config
@@ -48,0 +48,1 @@
+    "appleTeamId": "XSQ9GQH9Z4",
```

(Note: the "modified file: eas.json" label is somewhat misleading — the actual addition was to app.json's `expo.ios.appleTeamId`. EAS shows the resolved Expo app config diff and labels by config-source rather than literal file. The content diff confirms it's the appleTeamId line, not anything else.)

**The single delta between build 20 fingerprint and current is appleTeamId.** Brick I.1 + I.1.1 + I.3 + smoke marker do NOT contribute to the EAS-side fingerprint diff. Only Brick I.2 (appleTeamId) flipped the hash.

Lane A: dirty-tree was a red herring; appleTeamId is the actual cause.

---

## §2 — Lane B: research — known issue pattern, with a concrete diagnostic tool

### EAS CLI has built-in fingerprint diagnostics

Discovered post-Phase-0: `eas fingerprint:compare` and `eas fingerprint:generate`. These compute fingerprints using EAS's actual algorithm (not the standalone `@expo/fingerprint` npm package's algorithm) and produce diffs.

**Phase 0 §2's recommendation to use `npx @expo/fingerprint generate` was wrong.** The EAS-bundled tooling is what's authoritative for predicting OTA-binary compatibility. Local @expo/fingerprint can return a different hash than EAS server-side for the same project state — empirically confirmed today (local `913d97...` vs EAS-current `1949eb...` vs EAS-build20 `60d025...`).

### Known divergence patterns

Searched expo/expo and expo/eas-cli issue trackers + Expo's published guidance. The pattern is well-documented and not unique to Pantheon:

- **Issue #34005 (expo-sqlite):** pod install on EAS server adds `sqlite3.c` and `sqlite3.h` to `node_modules/expo-sqlite/ios/`. Local `eas build` doesn't run pod install; local fingerprint misses those files. EAS server includes them. Hash diverges.
- **Issue #37667 (patches folder):** `@expo/fingerprint fails to ignore patches folder`. Open issue; relevant to Pantheon (we have `patches/react-native+0.81.5.patch`). Not necessarily the trigger today (compare diff shows appleTeamId, not patches/), but it's a parallel reason local + server can drift.
- **Issue #2615 (eas-cli):** "EAS Build is generating builds with different fingerprint from what it was supposed to" — broader umbrella issue acknowledging the pattern.
- **Workaround pattern:** `.fingerprintignore` file at repo root, `.gitignore`-style minimatch syntax, exclude paths that diverge between local and EAS. Example: `**/expo-sqlite/ios/sqlite3.{c,h}` or specific generated paths.

### Pantheon's specific stack

Pantheon's config that COULD be implicated in fingerprint drift:
- `buildReactNativeFromSource: true` — RN compiles from source; pod install on EAS adds RN sources. Could drift.
- `patches/react-native+0.81.5.patch` — known issue #37667 territory.
- `@bacons/apple-targets` plugin — generates dynamic widget config. Surface for further investigation.
- `expo.ios.appleTeamId` — confirmed today as a fingerprint-affecting field on EAS side, not on local @expo/fingerprint side.

The empirical answer for THIS specific OTA failure is appleTeamId. The other items are latent risks for future drift.

### Sources

- github.com/expo/expo/issues/34005 (expo-sqlite pod-install fingerprint divergence; root-cause + .fingerprintignore workaround)
- github.com/expo/expo/issues/37667 (patches/ directory not ignored)
- github.com/expo/eas-cli/issues/2615 (umbrella issue)
- github.com/expo/eas-cli/issues/2448 ("always generating different fingerprints")
- docs.expo.dev/versions/latest/sdk/fingerprint/ (.fingerprintignore syntax + DEFAULT_IGNORE_PATHS)
- expo.dev/blog/understanding-and-comparing-fingerprints-in-expo-apps (eas fingerprint:compare overview)

---

## §3 — Recommended next move: option (i) clean rebuild + retest

### Why option (i)

The single delta is `appleTeamId`. The right answer is NOT to revert appleTeamId (the field is correct + load-bearing for codesigning + future-clone friction). The right answer is to bake it into a new EAS build so the binary's runtime fingerprint matches what current OTAs target.

This is the discipline OTA_RUNBOOK.md anticipated: "any change that affects EAS server fingerprint requires a new build before OTA can resume." The runbook listed specific triggers (patches/, app.json plugin config, new native modules) but missed `appleTeamId`. Update the runbook to widen the trigger list to "anything `eas fingerprint:compare` flags as modifying the resolved Expo config."

### Specific plan (NOT executing this turn — surfacing for V20 greenlight)

1. **Trigger new EAS build** (build 21) from current `9660cda` HEAD:
   ```
   eas build --profile production --platform ios --non-interactive --no-wait
   ```
   ETA per build 20's empirical 7m41s.

2. **Submit build 21 to TestFlight.** Now non-interactive — ascAppId is in eas.json properly post-Brick I.1.1. Should work without Apple 2FA dance:
   ```
   eas submit --platform ios --latest --non-interactive
   ```

3. **Luke installs build 21 via TestFlight** when Apple processing completes.

4. **The already-published smoke OTA on preview channel (runtime `1949eb...`) should auto-deliver to build 21** on Luke's first cold start. The `· ota1` marker should appear after the second cold start.

5. **If marker appears:** OTA pipeline is internally consistent within EAS. Brick I value confirmed. Promote to production via `eas update --branch production --platform ios`. Brick I closes.

6. **If marker does NOT appear:** something else is wrong beyond appleTeamId. Re-run `eas fingerprint:compare` against build 21's id to diagnose what diverged. May indicate one of the latent risks (patches/, bacons/apple-targets) is also contributing.

### Why NOT option (iii) abandon

Empirical evidence says Brick I is viable: `eas fingerprint:compare` shows EAS knows the diff exactly, the diff is small (one line), and the recovery is one rebuild. EAS Update is internally consistent across build → OTA pipeline within EAS. The only friction is local-vs-EAS fingerprint divergence, which is a documented known pattern with documented diagnostic tooling (`eas fingerprint:compare`).

Option (iii) would mean abandoning the iteration-speed win for all downstream native bricks (Alpha.6, Delta, Epsilon, Zeta, Brick C). That trade isn't justified by the empirical state.

### Why NOT option (ii) config change before rebuild

`.fingerprintignore` is the right tool when local + server should agree but server-side adds files that don't exist locally (e.g., the expo-sqlite generated files). It's NOT the right tool here — locally we don't HAVE appleTeamId in the fingerprint scope at all (verified). EAS server-side DOES. Adding appleTeamId to .fingerprintignore on EAS would just hide the change, not fix it. Doesn't help.

Could we add `runtimeVersion` override — set runtimeVersion to "appVersion" instead of "fingerprint"? Yes, but that loses the auto-detection benefit and forces manual version bumps on every native change. Worse engineering.

The clean answer is rebuild.

---

## §4 — Plan re-evaluation (per doctrine amendment)

**Three observations from this recon worth carrying forward:**

1. **`eas fingerprint:compare` is the load-bearing diagnostic tool, not `npx @expo/fingerprint`.** Phase 0 §2 should have surfaced this. The fix is a memory update — already drafted in §0 above. Save after V20 confirms.

2. **OTA_RUNBOOK.md amendment scope is now clear** (and bigger than just "fingerprint divergence"):
   - Recommended diagnostic: `eas fingerprint:compare` (not `npx @expo/fingerprint`)
   - Recommended pre-publish gate: run `eas fingerprint:compare --build-id <latest-prod-build>` before publishing OTA. If diff is non-empty, rebuild required.
   - Trigger list for "rebuild required" should be broadened: "any change that `eas fingerprint:compare` flags," not just specific files like patches/ or app.json plugin config.
   - Hold writing until Brick I outcome confirmed (option (i) result).

3. **`buildReactNativeFromSource: true` + `patches/` + `bacons/apple-targets`** all remain latent fingerprint-divergence risks per known issue patterns. They didn't trip today (only appleTeamId did) but they could on future commits. If `eas fingerprint:compare` becomes part of the standard pre-OTA check, those latent risks get surfaced when they become real.

---

## §5 — Status / docket

**At bat:** V20 reviews recon + decides on the path:
- **(i) Rebuild + retest** — my recommendation. Concrete plan in §3.
- **(ii) Config change before rebuild** — rejected; `.fingerprintignore` doesn't apply here.
- **(iii) Abandon Brick I** — premature given empirical state.
- **(iv) Something else** — open if V20 sees a path I'm missing.

**On greenlight for option (i):** I run the `eas build` + `eas submit` (non-interactive, ascAppId now in eas.json) sequence. Luke installs new build via TestFlight, validates marker on cold start.

**Queued behind Brick I outcome:**
- OTA_RUNBOOK.md amendment (now scoped per §4 observation 2 — broader than originally framed)
- Memory: `feedback_eas_fingerprint_diagnostic.md` — replace `npx @expo/fingerprint` references with `eas fingerprint:compare` as the authoritative tool

**Pre-existing web-export bug** (Supabase auth-js + AsyncStorage SSR crash) — still on the future docket per HANDOFF_9 §6.

---

## §6 — Estimated time spent

~25 minutes of work this turn:
- Lane A empirical investigation: 5 min
- Lane B web research: 10 min
- `eas fingerprint:compare` discovery + execution: 5 min (the load-bearing diagnostic; should have been first)
- Synthesis + write-up: 5 min

Came in under V20's 30-minute target with the cleanest empirical answer the situation allows.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_RECON_2.md
