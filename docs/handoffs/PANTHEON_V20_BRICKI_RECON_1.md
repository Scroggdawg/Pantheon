# Pantheon — Brick I (OTA / expo-updates) Phase 0 Recon

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 recon. No code, no `eas update:configure`, no app.json edits.
**Filename:** Per locked convention.

Brick I jumps ahead of Alpha.6 to unlock OTA for downstream native bricks. This recon verifies version compatibility, recommends runtimeVersion + channel strategy, surfaces UX trade-offs, and confirms rollback safety net. **Compatibility green — no abort.**

---

## §0 — Bottom line

- **P0.1 GREEN:** Pantheon's stack (Expo SDK 54.0.34, RN 0.81.5, newArchEnabled, iOS target 26.0) is fully compatible with `expo-updates@~29.0.x`. No version-pinning, no upgrade prerequisites. Brick I is viable.
- **P0.2 RECOMMEND `fingerprint` policy** with explicit "patch changes require EAS rebuild" discipline — best fit for Pantheon's `buildReactNativeFromSource + react-native+0.81.5.patch` wrinkle. `appVersion` is the conservative fallback if you'd rather force manual discipline.
- **P0.3 RECOMMEND production + preview channels from day one.** Preview maps to Luke's dev device for safe iteration before promoting to TestFlight. Cost is configuration, not separate builds.
- **P0.4 RECOMMEND silent fetch + apply on next launch.** Lowest friction for Luke's 5-10x-per-day voice logging usage. No reload prompt during active sessions.
- **P0.5 ONE EAS BUILD** to ship the binary base with expo-updates baked in. ~3-4hr per V17 build history (buildReactNativeFromSource is the cost driver). Well within free-tier 30 builds/month.
- **P0.6 ROLLBACK SAFE:** `eas update:rollback` is the documented mechanism. Two recovery paths (revert to prior update OR fall back to binary-embedded update). Recovery time: ~1 minute to issue + ≤30s client propagation.

---

## §1 — P0.1: Version compatibility

**Status:** GREEN. No abort.

**Pantheon-native current state (verified from package.json + app.json):**

```json
{
  "expo": "~54.0.34",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "expo-router": "~6.0.23",
  "expo-build-properties": "~1.0.10"
}
```

```json
// app.json (key fields)
{
  "newArchEnabled": true,
  "ios": { "deploymentTarget": "26.0" },
  "experiments": { "typedRoutes": true, "reactCompiler": true },
  "plugins": [
    ["expo-build-properties", {
      "ios": {
        "buildReactNativeFromSource": true,
        "deploymentTarget": "26.0"
      }
    }]
  ]
}
```

`patches/react-native+0.81.5.patch` exists. `buildReactNativeFromSource: true` is enabled to make the patch take effect during EAS builds.

`expo-updates` is **NOT** currently installed (verified — not in dependencies).

**Compatibility check against expo-updates SDK 54:**

- Expo SDK 54 ships `expo-updates @ ~29.0.10` per the Expo SDK 54 changelog (verified).
- React Native 0.81 is the canonical RN for Expo 54 — full first-party support.
- newArchEnabled: true is explicitly supported on RN 0.81 + Expo 54.
- React Compiler experiment: orthogonal to expo-updates. Both can coexist.
- iOS deployment target 26.0: orthogonal. expo-updates ships JS bundles, not native code.

**The buildReactNativeFromSource wrinkle:**

This is Pantheon-specific. It causes RN to compile from source on every EAS build (~3-4 hours) so the patch in `patches/react-native+0.81.5.patch` takes effect. expo-updates and buildReactNativeFromSource are **orthogonal concerns** — expo-updates ships JS bundles + JS-side assets; buildReactNativeFromSource affects native binary compilation. They don't conflict.

But: the patch content matters for runtimeVersion policy choice (see §2).

**Install command (when EXECUTE greenlit):**

```bash
cd /Users/scrogdawg/Code/pantheon-native
npx expo install expo-updates
# Resolves to ~29.0.x per SDK 54 alignment
```

**No upgrade prerequisites. No version pins. No abort.**

**Sources:**
- expo.dev/changelog/sdk-54 — Expo SDK 54 release notes confirming RN 0.81, expo-updates ~29.0.10
- docs.expo.dev/versions/v54.0.0/sdk/updates/ — SDK 54 reference for expo-updates
- reactnative.dev/blog/2025/08/12/react-native-0.81 — RN 0.81 official release post

---

## §2 — P0.2: runtimeVersion policy recommendation

**Three documented policies:**

| Policy | How it works | Pantheon fit |
|---|---|---|
| `appVersion` | Runtime = `app.json` version field. Bump version → new runtime. | Safe but manual. Luke must bump version on EVERY native change including patch updates. |
| `sdkVersion` | Runtime = Expo SDK major version. All SDK 54 builds share runtime. | **Unsafe for Pantheon.** Patched RN behavior would silently propagate JS bundles across binaries with different patch states. |
| `fingerprint` | `@expo/fingerprint` hashes project state — package.json, lockfile, plugin config, native config, patches/. Auto-computed runtime. | Best fit. Detects native-impacting changes including patch file edits. |

**Recommendation: `fingerprint` policy** with explicit operational discipline:

1. **Lock policy in app.json:**
   ```json
   "expo": {
     "runtimeVersion": { "policy": "fingerprint" },
     "updates": { "url": "https://u.expo.dev/<project-id>" }
   }
   ```

2. **Discipline rule (document in eas.json comment or a runbook):** any change to `patches/` or `app.json` plugin config requires a new EAS build before OTA can resume. The fingerprint changes; OTAs would auto-pause until a build with the new fingerprint exists.

3. **Validation step before each `eas update`:** run `npx @expo/fingerprint` locally to verify the current project fingerprint matches the deployed binary's fingerprint. If they diverge, OTA won't be safe — build first.

**Why `fingerprint` over `appVersion`:**

- `appVersion` requires Luke to remember to bump `app.json`'s version field whenever the patch changes. Forgetting it ships a JS bundle to a binary with mismatched native behavior. Silent failure mode.
- `fingerprint` auto-detects native-impacting changes. If the patch file changes, the fingerprint changes; the new OTA targets a different runtimeVersion than existing binaries; old binaries don't pick up the breaking JS. Safe by construction.
- `fingerprint` is Expo's modern recommendation for SDK 51+ (per docs).

**Single caveat:** the fingerprint detection covers documented surfaces (package.json, native config, patches/). Edge cases where a non-tracked file affects native behavior could slip through. The `npx @expo/fingerprint` validation step catches most of these manually before each OTA.

**Fallback if you'd rather avoid fingerprint complexity:** lock `appVersion` policy + a hard rule: "every patch change bumps version." Simpler mental model, more discipline burden on Luke.

My recommendation: `fingerprint`. V20 + Luke's call.

**Sources:**
- docs.expo.dev/eas-update/runtime-versions/ — policy comparison table
- docs.expo.dev/versions/latest/sdk/fingerprint/ — fingerprint package reference
- medium.com/@julien_34351/youre-certainly-using-the-wrong-runtimeversion-in-expo-ce3466d4d2fe — community guide on fingerprint as 2026 best practice

---

## §3 — P0.3: Channel + branch strategy

**Current state:** Pantheon distributes through TestFlight only. eas.json has three build profiles (`development`, `preview`, `production`) but no `channel` mappings.

**Recommended channel map (lock during EXECUTE):**

```json
// eas.json — additions in build.<profile>.channel
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "channel": "development" },
    "preview":     { "distribution": "internal", "channel": "preview" },
    "production":  { "autoIncrement": true, "channel": "production" }
  }
}
```

**Channel-to-flow mapping:**

| Channel | Build profile | Audience | Use case |
|---|---|---|---|
| `development` | `development` | Luke's dev device with Expo Dev Client | Live-reload during local dev. Optional — can skip if Luke uses Metro bundler instead. |
| `preview` | `preview` | Luke's TestFlight account on a separate dev install OR internal distribution | Test JS changes on real iOS before promoting to production TestFlight. |
| `production` | `production` | TestFlight users (Luke today; future invitees later) | Live OTA delivery. |

**Workflow per change:**

```bash
# 1. Make JS changes locally, test in dev
# 2. Publish to preview channel
eas update --branch preview --message "alpha.6 heart icon — preview"
# 3. Install preview build on Luke's dev iPhone, validate behavior
# 4. Promote to production
eas update --branch production --message "alpha.6 heart icon — prod"
```

**Why both channels from day one** (not just production):

Pantheon today is single-user, but the cost of wiring `preview` is essentially zero — it's a one-line eas.json addition + one preview EAS build (which the development profile may already cover). The benefit is real: every OTA goes through a "shipped to preview, validated, then promoted" loop instead of "shipped directly to TestFlight." Buys safety with negligible overhead.

**If Luke explicitly wants minimum-config:** ship production-only initially. Add preview later when first non-Luke user joins TestFlight. I'd still recommend both, but it's defensible to defer.

**Branch == channel default:** `eas update --branch production` creates a Git-like branch on the production channel. EAS docs use channel and branch interchangeably for typical setups; advanced users can map multiple branches to one channel for staged rollouts.

**Sources:**
- docs.expo.dev/eas-update/getting-started/ — channel + branch primary docs
- docs.expo.dev/eas-update/rollouts/ — staged rollout via branch percentages

---

## §4 — P0.4: Update-fetch UX

**Three documented patterns:**

| Pattern | UX cost | Latency to user | Best for |
|---|---|---|---|
| **A. Silent fetch on launch + apply next launch** | Zero. User unaware. | One full session delay (next cold start) | Apps used multiple times per day; voice-driven flows |
| **B. Fetch on launch + immediate prompt + reload** | High. Disrupts session start with modal. | Immediate (this session) | Apps used rarely; high-stakes feature delivery |
| **C. Fetch on background-to-foreground + silent apply** | Low-medium. Foreground transition has minor JS overhead. | Variable | Apps with infrequent foregrounding |

**Recommendation: Pattern A (silent fetch + apply next launch).**

Reasoning:

- **Luke's usage profile** per project memory: 5-10x per day voice logging. Frequent cold starts. Pattern A delivers updates within hours of publish without ever interrupting an active session.
- **Voice logging is the hot path.** A reload prompt during meal entry is exactly the wrong moment for UX disruption. Pattern A keeps that path clean.
- **Pattern B's "immediate prompt" doesn't materially help.** Even if Luke gets the prompt instantly, he still has to acknowledge + reload, costing him ~5-10s of session start. Pattern A trades that for "next launch is silently up to date" — same end state, less friction.
- **Pattern C is fine** but adds JS execution to every foreground transition. For an app used 5-10x per day, that's 5-10x the JS cycles per day vs Pattern A's once-per-cold-start.

**Code shape (for the EXECUTE handoff, not for this turn):**

In `app/_layout.tsx` (or equivalent root entry):

```typescript
// Standard Pattern A — fetch silently on launch
import * as Updates from 'expo-updates'

useEffect(() => {
  async function checkForUpdate() {
    if (__DEV__) return  // skip in dev
    try {
      const update = await Updates.checkForUpdateAsync()
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync()
        // Don't reload here — let next cold start pick it up
      }
    } catch {
      // Best-effort; don't block app launch on update check
    }
  }
  checkForUpdate()
}, [])
```

**Optional dev/test polish:** add a hidden settings affordance (long-press on app version label, or shake gesture) that surfaces "Check for update now" + "Reload to apply." Lets Luke verify a fresh OTA without waiting for the next cold start. Trivial to add; useful during Brick I validation.

**V20 + Luke's UX call:** confirm Pattern A. If Luke explicitly wants to see "Update available" prompts (some users prefer the visibility), Pattern B is a one-line change.

---

## §5 — P0.5: EAS build implications

**Build cost for Brick I:**

ONE EAS build (production profile) to ship the binary base with `expo-updates` and the chosen `runtimeVersion` baked in. Per V17 closing notes + access doc: ~3-4 hours per build because of `buildReactNativeFromSource: true`.

**Free-tier budget check:**

Access doc cites 30 prod iOS builds/month free tier. Pantheon's recent use is sub-10 builds/month. **One Brick I build fits comfortably.**

**After Brick I ships:**

- JS-only changes → `eas update --branch <name>` → ~30-60s publish
- Native-runtime-impacting changes (patches/, plugin config, new native modules) → fingerprint changes → new EAS build required → ~3-4hr per
- Native-cosmetic changes (icon, splash) → fingerprint changes → also new EAS build

**Critical sequencing for the Brick I deploy day:**

The 3-4hr build time means the day Brick I's binary base ships is functionally blocked for native iteration. Plan around it: kick off the build, work on Alpha-ex-6 web fixes in parallel, validate Brick I install on Luke's device when the build completes.

**One-time cost amortizes across:**
- Alpha.6 (Shape E heart icon UI) → OTA
- Delta PLATE → OTA
- Epsilon BIG BUTTON → OTA
- Zeta per-food UI hybrid → OTA
- Brick C swipe-edit (outside Op FASTRAK) → OTA

5+ future native bricks save ~15-20hrs of Luke-waiting-for-EAS-builds time. Brick I's 1 build buys all of that.

**No budget block. No abort.**

---

## §6 — P0.6: Rollback path

**Documented mechanism: `eas update:rollback`** (interactive command).

**Two rollback modes:**

1. **Revert to prior published update.** EAS re-publishes a previously-shipped update on the same channel. Clients get the rollback signal on their next update check, fetch the prior bundle, apply on next launch.
2. **Revert to embedded update.** Client falls back to the JS bundle baked into the binary at build time. Useful when the entire OTA history is suspect.

**Mechanics:**

- Command: `eas update:rollback` (no arguments — interactive guide picks the channel + target)
- After rollback: future `eas update --branch <channel>` publishes resume normally; clients pick them up on next check.
- Client propagation time: depends on Pattern A vs B/C update-fetch UX. With Pattern A (recommended): ≤30s on next cold start. Fast.

**Recovery scenarios:**

| Scenario | Recovery action | Time-to-recovery |
|---|---|---|
| OTA breaks app launch | `eas update:rollback` → revert to embedded update | ~1 min issue + next cold start |
| OTA breaks one feature | `eas update:rollback` → revert to last good update OR publish a fix | ~1 min |
| Client unable to reach OTA server | User reinstalls from TestFlight; binary's embedded JS runs | ~2 min user action |

**Pantheon-specific safety:**

- Pattern A (silent fetch + apply next launch) means a broken update is detected by Luke on next cold start. He has time to roll back BEFORE the bad version reaches him on the cold start after that.
- If Pantheon ever opens to multi-user, staged rollouts via `--rollout-percentage` flag let Luke ship to 10% of users first, validate, then ramp.

**Recommendation:** before Brick I's first OTA ships, write a one-pager runbook in the native repo at `OTA_RUNBOOK.md` covering:
- How to publish an update (`eas update --branch production --message "..."`)
- How to roll back (`eas update:rollback`)
- How to detect a broken OTA (EAS dashboard + Luke's iPhone behavior)
- What "embedded update" means and when to fall back to it

10-line file. Worth the discipline.

**Sources:**
- docs.expo.dev/eas-update/rollbacks/ — rollback primary docs
- docs.expo.dev/eas-update/rollouts/ — staged rollouts via percentage
- expo.dev/blog/the-production-playbook-for-ota-updates — Expo's published OTA playbook

---

## §7 — Risks + mitigations

**Risk 1: First-time fingerprint policy hits an unexpected mismatch.**

`@expo/fingerprint` is robust but has known edge cases (Bun workspaces, certain monorepo layouts, custom config plugins that don't declare their native impact). Pantheon's plugin list includes `./plugins/with-fmt-fix` (custom), `@bacons/apple-targets` (third-party), and `@kingstinct/react-native-healthkit` — any of these could surface a fingerprint discrepancy.

**Mitigation:** before first `eas update` ships, run `npx @expo/fingerprint generate` locally and compare to EAS's stored fingerprint for the binary. If they match, OTA is safe. If not, investigate before publishing.

**Risk 2: react-native+0.81.5.patch is in the fingerprint, but a future patch update could ship without re-build.**

If Luke or Terminal modifies `patches/react-native+0.81.5.patch` and ships an OTA, the fingerprint catches it (patches/ is hashed). The OTA targets a new runtimeVersion → existing binaries don't pick up the breaking JS. **Safe by construction.**

**Risk 3: Brick I's EAS build itself fails.**

3-4hr build with custom RN compile has historically been the failure surface for Pantheon (per V17's C3c/C3d patches). If the Brick I build fails on the first attempt, that's 3-4hr lost. Plan a fallback path: if Brick I bogs past a second build attempt, abort and ship Alpha.6 EAS-only (per V20's pre-greenlight note).

**Risk 4: TestFlight latency on the binary base.**

After Brick I's EAS build completes + EAS submit + Apple processing, TestFlight install can take 5-30 min. So the full cycle from "kick off Brick I build" to "Luke installed and validated" is ~3.5-4.5 hours wall clock. Plan around it.

---

## §8 — Status / docket

**At bat:** This Phase 0 doc. V20 + Luke decide:
1. `runtimeVersion` policy: `fingerprint` (recommended) or `appVersion` (conservative fallback)
2. Channel strategy: production + preview from day one (recommended) or production-only (minimum)
3. Update-fetch UX: Pattern A silent + next launch (recommended) or Pattern B prompt + reload
4. OTA_RUNBOOK.md: ship alongside Brick I (recommended) or defer

**On deck:** Brick I EXECUTE — implementation handoff after greenlight. Single EAS build. Steps:
1. `npx expo install expo-updates` → ~29.0.x
2. `eas update:configure` → updates eas.json + app.json
3. Edit app.json: `runtimeVersion`, `updates.url` populated by configure
4. Edit app entry (`app/_layout.tsx` or equivalent): silent fetch logic
5. Commit with `S27 Op FASTRAK Brick I` session tag
6. `eas build --profile production --platform ios` → 3-4hr wait
7. Submit to TestFlight, install on Luke's device, validate
8. Test first OTA via `eas update --branch preview --message "Brick I smoke test"`
9. Promote to production once preview validates

**In the hole:** Alpha.6 Shape E (post-Brick I, ships OTA on the new binary base). Delta, Epsilon, Zeta — all native bricks now OTA-eligible.

**Parallel thread reminder:** Alpha-ex-6 web work runs independently. Wall-clock to "both deployed" = max(Alpha-ex-6, Brick I), not sum. If V20 wants to maximize parallelism, two Chat Claude threads work side-by-side.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_RECON_1.md
