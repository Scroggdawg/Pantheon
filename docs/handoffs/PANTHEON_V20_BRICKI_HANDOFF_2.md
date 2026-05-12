# Pantheon — Brick I EAS Build Kickoff

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — for monitoring during ~3-4hr build window
**Mode:** EXECUTE — step 10 complete (build queued). Steps 12-14 pending build completion.
**Filename:** Per locked convention.

---

## §0 — Status

`eas build --profile production --platform ios --non-interactive --no-wait` returned **exit code 0**. Build queued on EAS servers. **No first-attempt failure** — risk-3 hedge does not trigger.

**Build identifiers:**

```
Build ID:   edc102f4-1168-48e2-b28d-1d221aea92f0
Build URL:  https://expo.dev/accounts/scroggdawg/projects/pantheon/builds/edc102f4-1168-48e2-b28d-1d221aea92f0
iOS buildNumber: 19 → 20 (autoIncrement)
Project:    @scroggdawg/pantheon
Targets:    Pantheon (guru.pantheon.app), widget (guru.pantheon.app.widget)
Message:    "S27 Op FASTRAK Brick I — expo-updates wired, fingerprint runtimeVersion"
Upload:     1,015 KB working tree → EAS
```

Estimated wall clock: **3-4 hours** per V17 history (buildReactNativeFromSource compiles RN from source). EAS dashboard + email notify Luke on completion.

---

## §1 — What EAS confirmed at kickoff

Five reassuring signals landed during the upload + credential phase, all clean:

1. **Production environment loaded.** EAS pulled all 5 EXPO_PUBLIC env vars (`API_BASE`, `PANTHEON_NATIVE_SECRET`, `PANTHEON_USER_ID`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`) from the production environment server-side. No env-var blockers.

2. **Update channel created on EAS server.** First-time effect of the new `channel: "production"` in eas.json:
   ```
   ✔ Created update channel "production" and branch "production"
     on @scroggdawg/pantheon project.
   ```
   Future builds re-use this channel; first-time creation only happens once per channel.

3. **Apple credentials all cached and valid.** No 2FA prompt, no interactive Apple ID flow. Both targets have valid certificates + provisioning profiles:
   - **Pantheon** (`guru.pantheon.app`): Distribution Cert (serial `841CCCB...8728`, expires 2027-05-01), Provisioning Profile `S9B59989DF` (active, expires 2027-05-01)
   - **widget** (`guru.pantheon.app.widget`): same Distribution Cert (shared per Apple's rules), Provisioning Profile `527WYDQ8AV` (active, expires 2027-05-01)
   - Apple Team: `XSQ9GQH9Z4 (Luke Scroggins (Individual))` — matches access doc.

4. **buildNumber auto-increment fired.** `19 → 20`. Confirms `appVersionSource: "remote"` + `autoIncrement: true` are working as expected.

5. **Working tree uploaded successfully** (1,015 KB). EAS uploaded my local checkout including the Brick I commit. Build server is now compiling.

---

## §2 — Two informational warnings (neither blocking)

**W.1 — Expo Go warning (preinstalled, harmless for production):**
```
⚠️ Detected that your app uses Expo Go for development, this is not
   recommended when building production apps.
```
Pre-existing — Pantheon's dev workflow uses Expo Go for local dev, but production builds are standalone. Suppressible via `EAS_BUILD_NO_EXPO_GO_WARNING=true` if Luke wants to silence future builds. Not blocking.

**W.2 — `ios.buildNumber` field unused with remote version source:**
```
ios.buildNumber field in app config is ignored when version source is
set to remote, but this value will still be in the manifest available
via expo-constants. It's recommended to remove this value from app config.
```
Pre-existing config carryover. `appVersionSource: "remote"` in eas.json means EAS server-side controls the build number; the `"buildNumber": "1"` in app.json is dead config. Cosmetic cleanup for a separate brick (would silence the warning + remove a misleading field).

---

## §3 — What's NOT done (gated for next turn)

Per V20's brief:
- ❌ **Step 12** — `eas submit --platform ios --latest` (post-build)
- ❌ **Step 13** — Luke TestFlight install + cold start / voice log / dashboard render validation
- ❌ **Step 14** — `eas update --branch preview --message "Brick I smoke test"` smoke OTA
- ❌ **Step 15** — Promote to production (post-Gate-2)
- ❌ **Push to GitHub** — held until after Gate 2 per V20's confirmation

Next turn picks up at step 12 once Luke or V20 confirms build completion. The trigger will likely be: EAS sends Luke a build-success email → Luke or V20 returns to this thread with "build done, proceed."

---

## §4 — Risk-3 hedge status

**No first-attempt failure detected.** The `eas build` invocation completed kickoff cleanly. The actual compile runs on EAS servers asynchronously; failure modes during compile (RN source compile errors, patch reapplication failures, codesigning issues) would surface in the EAS build log, not in the kickoff command's exit code.

**If the build fails:** I'll surface immediately with the EAS build log URL, the failure reason, and won't rerun without V20 review.

**If the build succeeds:** proceed to step 12 on the next turn.

---

## §5 — Plan re-evaluation (per doctrine amendment)

Three observations worth noting now:

1. **First-time channel creation worked silently.** No friction on the new `channel: "production"` registration. EAS auto-provisioned the channel + branch combo. Future Brick I OTA publishes can target this channel directly — no further setup needed.

2. **Widget target picked up the same channel.** Both `Pantheon` and `widget` build targets are configured for production. The widget shares the JS bundle with the main app, so OTA delivery to one updates both. No extra config needed for widget OTA.

3. **Apple credentials cached + valid until 2027-05-01.** A full year+ of runway before the next cert/profile renewal cycle. Not an Op FASTRAK concern.

**Implication:** the only real risk surface from here is the EAS build itself (3-4hr compile, RN-from-source patch reapplication). Per V17's prior session history, the patch reapply has historically been the failure mode. The patch is the same `react-native+0.81.5.patch` that's been working since Phase C — no reason to expect regression on this build.

---

## §6 — Status / docket

**At bat:** EAS build running on EAS servers. Build URL: `https://expo.dev/accounts/scroggdawg/projects/pantheon/builds/edc102f4-1168-48e2-b28d-1d221aea92f0`. ETA 3-4hr.

**On deck (post-build-success):**
- Step 12: `eas submit --platform ios --latest` (~5-10min EAS queue + 5-30min Apple processing)
- Step 13: Luke TestFlight install + smoke validate (cold start, voice log, dashboard render)
- Step 14: `eas update --branch preview --message "Brick I smoke test"` + verify cold-start picks it up on Luke's device
- Step 15: Promote to production after V20 Gate 2 greenlight

**Parallel thread reminder:** Alpha-ex-6 (web-only) can proceed independently during the build window. V20 holds the trigger for that work; not initiated from this thread.

**In the hole:** Alpha.6 Shape E ships OTA on the new binary base after Brick I lands clean.

**Apple Team ID warning:** still flagged for follow-on outside Brick I per V20's confirmation.

**Push timing:** held until after Gate 2 per V20's confirmation.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_2.md
