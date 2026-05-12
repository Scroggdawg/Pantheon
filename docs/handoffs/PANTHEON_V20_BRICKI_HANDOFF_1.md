# Pantheon — Brick I (OTA / expo-updates) Gate 1 Handoff

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — for Gate 1 review before EAS build
**Mode:** EXECUTE complete on steps 1-8. Local commit, not pushed. EAS build held pending greenlight.
**Filename:** Per locked convention.

---

## §0 — Status

Steps 1-8 from V20's EXECUTE brief shipped clean. Local commit on main, **not pushed**. Type-check passes.

**Commit:**
```
7a848db S27 Op FASTRAK Brick I: expo-updates + fingerprint runtimeVersion + channels
6 files changed, +151/-4
```

Awaiting Gate 1 greenlight before kicking off the EAS build (step 10).

---

## §1 — Diff summary

```
A  OTA_RUNBOOK.md          (new file, ~25 lines)
M  app.json                (+9 lines: updates.url + runtimeVersion fingerprint, top-level)
M  app/_layout.tsx         (+21 lines: Updates import + silent-fetch useEffect)
M  eas.json                (+5 lines: channel: development/preview/production)
M  package.json            (+1 line: expo-updates ~29.0.17)
M  package-lock.json       (lockfile updates for expo-updates and 6 transitives)
```

---

## §2 — Verbatim source

### app.json — top-level updates + runtimeVersion (added before closing brace)

```json
    "owner": "scroggdawg",
    "updates": {
      "url": "https://u.expo.dev/ba8c78fb-94d6-4884-b06e-8704070b1295"
    },
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

### eas.json — full file (channel additions on each profile)

```json
{
  "cli": {
    "version": ">= 18.9.1",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

### app/_layout.tsx — silent-fetch useEffect (inserted at top of RootLayout, before existing widget-hydrate effect)

```typescript
import * as Updates from "expo-updates";

// ... inside RootLayout, immediately after useFonts() ...

  // Brick I — silent OTA fetch on cold start. Pattern A per Op FASTRAK
  // Phase 0: check for an update, fetch it in the background, let the
  // next cold start apply it. Best-effort; never blocks app launch.
  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (cancelled || !update.isAvailable) return;
        await Updates.fetchUpdateAsync();
      } catch (err) {
        console.warn("[expo-updates] check/fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
```

### OTA_RUNBOOK.md — full content

(Native repo root: `/Users/scrogdawg/Code/pantheon-native/OTA_RUNBOOK.md`)

```markdown
# OTA_RUNBOOK — Pantheon (Brick I, Op FASTRAK)

EAS Update infrastructure. Channel map: production → TestFlight users;
preview → Luke's dev install; development → local dev client. Update
fetch is silent on cold start; new bundles apply on the launch after
fetch completes.

## Publish a JS-only update
  cd /Users/scrogdawg/Code/pantheon-native
  npx --yes eas-cli@latest update --branch preview    --message "<reason>"  # smoke first
  npx --yes eas-cli@latest update --branch production --message "<reason>"  # promote when clean

Native-runtime changes (anything in patches/, app.json plugin config, new
native modules) require a fresh eas build because the runtimeVersion
policy is fingerprint — the project hash will change and OTAs auto-pause
for old binaries.

## Roll back a bad update
  npx --yes eas-cli@latest update:rollback

Interactive — pick the channel, then "revert to a prior published update"
OR "revert to the embedded update" (the JS bundle baked into the binary
at build time). Clients pick up the rollback signal on next cold start;
≤30s propagation under Pattern A silent fetch.

## Verify fingerprint before publishing
  npx --yes @expo/fingerprint generate

If output differs from the deployed binary's fingerprint, do not publish
OTA — build first via eas build --profile production --platform ios.

## Worst-case recovery
User reinstalls Pantheon from TestFlight. The fresh install runs the JS
bundle embedded in the binary. Always recoverable.

## Watch for
- [expo-updates] warnings in Vercel/runtime logs (silent fetch failures)
- Fingerprint drift after editing patches/react-native+0.81.5.patch
- bacons/apple-targets warns about ios.appleTeamId missing — pre-existing,
  unrelated to OTA
```

---

## §3 — Drift from Phase 0 surfaced (per doctrine amendment)

Three items that drifted from the Phase 0 plan during EXECUTE. All resolved cleanly; surfacing for V20 awareness.

### D.1 — `eas update:configure` placed runtimeVersion at iOS scope, not top-level

**Phase 0 plan:** `runtimeVersion: { policy: "fingerprint" }` at top-level expo.

**What configure did:** wrote `runtimeVersion: { policy: "appVersion" }` *inside* the `expo.ios` block. iOS-only scope, wrong policy.

**Action taken:** ran configure non-interactively, observed the output, then manually edited app.json to put `runtimeVersion: { policy: "fingerprint" }` at top-level expo (alongside `updates.url`). iOS-scoped block was reverted as part of D.2 below.

**Verification:** final app.json has fingerprint policy at top-level only. No iOS-scoped runtimeVersion. Top-level applies to both iOS and Android, future-proof for Android distribution.

### D.2 — `eas update:configure` introduced unrelated app.json drift

**What configure did:** in addition to the intentional `updates.url` and `runtimeVersion` additions, the configure command (or the postinstall expo-install chain) re-serialized parts of app.json that included **dynamically-generated content from `@bacons/apple-targets`** and **duplicated existing entries**:

- iOS `entitlements.com.apple.security.application-groups` array got a duplicate of the same group ID
- Android `permissions` array got duplicates of `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS`
- New `extra.eas.build.experimental.ios.appExtensions` block was injected with the widget bundle config — content normally generated dynamically by the `@bacons/apple-targets` plugin, NOT meant to live in committed app.json

**Action taken:** reverted app.json to HEAD via `git checkout HEAD -- app.json`, then re-applied **only** the two Brick I additions (`updates.url` + top-level `runtimeVersion: fingerprint`). The duplicates and the static appExtensions block stayed out of the commit.

**Why this matters:** baking the dynamically-generated appExtensions into static app.json would have made future widget config changes harder (every plugin update would need to be reflected in the committed file). The duplicates would have been harmless but ugly.

**Verification:** final `git diff app.json` shows only the 9-line addition for Brick I — no duplicates, no appExtensions, no iOS-scoped runtimeVersion.

### D.3 — Pre-existing `bacons/apple-targets` warning about missing `ios.appleTeamId`

**What:** every install/configure run prints the warning:

```
[bacons/apple-targets] Expo config is missing required ios.appleTeamId property.
Find this in Xcode and add to the Expo Config to correct.
iOS builds may fail until this is corrected.
```

**Status:** pre-existing, not Brick I scope. The Apple Team ID is `XSQ9GQH9Z4` per the access doc. Adding it to `app.json:expo.ios.appleTeamId` would silence this warning, but it's a separate concern — flagged in OTA_RUNBOOK.md's "Watch for" section so it doesn't get conflated with OTA issues.

**Recommendation:** address as a small follow-on outside Brick I. Would also de-risk the EAS build if the warning becomes a hard error in future Expo versions.

---

## §4 — Optional dev affordance decision (V20 left this open)

**Decision: SKIP for Brick I. Defer to a later optional polish brick.**

Reasoning:

1. **Validation works without it.** Luke can manually quit + reopen the app to trigger cold-start update apply. That's the same path real users take.
2. **Adds non-trivial UI work.** A long-press detector or shake gesture + "Force update check / Reload now" affordance means new component code, gesture wiring, and surface to fit alongside `VersionFooter`. Not in Brick I's "minimum viable OTA" scope.
3. **More commit surface = more Gate 1 review surface.** Keeps Brick I tight.
4. **Easy to add later.** Once OTA is proven working through Pattern A, a dev-only affordance for explicit reload becomes a 1-hour polish item.

If V20 + Luke want it sooner, easy to add as Brick I.5 or fold into Alpha.6 alongside the heart-icon work.

---

## §5 — Type-check + smoke

```
npx tsc --noEmit  → exit 0 (clean)
git diff           → matches verbatim source above
```

What I did NOT do (out of scope for steps 1-8):
- No `eas build` (step 10, gated)
- No `eas submit` (step 12, gated)
- No `eas update --branch <...>` (steps 14-15, gated)
- No `git push` (not in steps 1-9; access doc + doctrine don't push without explicit request)

---

## §6 — Doctrine plan re-evaluation (per amendment)

One observation worth surfacing now:

**Brick I went smoothly.** The Phase 0 had the right architectural shape, the install was clean, the type-check passed first try, and the only friction was `eas update:configure`'s app.json over-reach (which was anticipated as a "first-time setup wrinkle" risk in Phase 0 §7). No upgrade prerequisites surfaced; no compatibility blockers; the fingerprint policy ran the configure step without complaint.

**Implication:** Brick I's EAS build is the next real risk surface, not the code prep. Per V20's risk-3 hedge, I'll surface immediately if the build fails on first attempt and won't burn a second build attempt without V20 review.

**Implication for Alpha-ex-6 parallel thread:** Brick I being on rails means V20 can confidently run Alpha-ex-6 in parallel without Brick I needing close attention. The 3-4hr EAS build window is a clean parallelization slot.

---

## §7 — Greenlight asks for V20 (Gate 1)

1. **Approve the diff** as committed at `7a848db`. Verbatim source in §2; drift narrative in §3.
2. **Confirm SKIP on the optional dev affordance** (§4). If V20 + Luke want it included, easy to amend.
3. **Greenlight EAS build kickoff** — `eas build --profile production --platform ios`. Estimated 3-4hr wall clock per V17 buildReactNativeFromSource history.
4. **Confirm push timing** — push to `Scroggdawg/pantheon-native` either now (before build) or after Gate 2 (after smoke validates). My read: push after Gate 2 keeps unverified work off the GitHub remote. V20's call.

---

## §8 — Status / docket

**At bat:** Gate 1 review of Brick I commit `7a848db`. V20 reviews + greenlights or revises.

**On deck (post-greenlight):**
- Step 10: `eas build --profile production --platform ios` (3-4hr)
- Step 12: `eas submit --platform ios --latest` (5-30min)
- Step 13: Luke installs via TestFlight, validates basic app function
- Step 14: Smoke OTA via `eas update --branch preview --message "Brick I smoke test"`
- Step 15: Promote to production after Gate 2 greenlight

**Parallel thread:** Alpha-ex-6 (web-only) can run during the 3-4hr build window per V20's brief.

**In the hole:** Alpha.6 Shape E ships OTA on the new binary base after Brick I lands.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_1.md
