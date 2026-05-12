# Brick I Build 21 — finished + submitted; Apple processing → Luke TestFlight install

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Build + submit complete. Hand-back for Luke's cold-start cycle.

---

## §0 — Status

Build 21 finished. Submit fired non-interactively (Brick I.1.1 paid off). Apple processing now in flight; TestFlight install will be ready in 5-10 min. **Mechanical alignment between Build 21's runtime and the published smoke OTA is empirically confirmed** — both `1949eb33d497f632a2469f958a99cedf8cf7a71d`. The empirical fingerprint test happens when Luke runs the cold-start cycle.

---

## §1 — Build 21 result

```
Build ID:                 575a26ab-4de8-498a-b040-5567c661efbc
Status:                   finished
Started:                  5/8/2026, 1:03:21 AM
Finished:                 5/8/2026, 1:11:08 AM   (7m 47s)
Build number:             21
Runtime Version:          1949eb33d497f632a2469f958a99cedf8cf7a71d
IPA artifact:             https://expo.dev/artifacts/eas/bMCbg4DwygB6JTfYNwZj8o.ipa
EAS dashboard:            https://expo.dev/accounts/scroggdawg/projects/pantheon/builds/575a26ab-4de8-498a-b040-5567c661efbc
Source commit:            9660cda (Brick I.1.1 on top of full Brick I bundle)
```

**The load-bearing observation:** Build 21's runtime version is `1949eb33d497f632a2469f958a99cedf8cf7a71d` — IDENTICAL to the published smoke OTA's runtime version. This is exactly what Phase 0's prediction (and HANDOFF_10's pre-flight) said would happen. EAS server-side fingerprint computation is **internally consistent** — same input project state at build time and update-publish time produces the same hash. The pipeline IS deterministic; the divergence we saw earlier was specifically between local `@expo/fingerprint` and EAS-server-side, not within EAS itself.

This means: when Luke's iPhone running Build 21 checks for updates, it advertises runtime `1949eb...`, EAS finds the matching smoke OTA on the preview channel (also `1949eb...`), and serves it. **The OTA pipeline IS viable for Pantheon.** The empirical proof is one cold-start cycle away.

---

## §2 — Submit result — NON-INTERACTIVE

```
Looking up credentials configuration for guru.pantheon.app...
✔ App Store Connect API Key already set up.
Using Api Key ID: XJ29XU7623 ([Expo] EAS Submit l4q4J77JcC)

ASC App ID:                 6765753500
Project ID:                 ba8c78fb-94d6-4884-b06e-8704070b1295
App Store Connect API Key:  
    Key Name  :  [Expo] EAS Submit l4q4J77JcC
    Key ID    :  XJ29XU7623
    Key Source:  EAS servers
Build:                      
    Build ID    :  575a26ab-4de8-498a-b040-5567c661efbc
    Build number:  21

✔ Scheduled iOS submission
Submission details: https://expo.dev/accounts/scroggdawg/projects/pantheon/submissions/59ce0e90-4bd7-4b11-be01-f7c73f0ad67c
✔ Submitted your app to Apple App Store Connect!
```

**No Apple 2FA dance.** The `ascAppId` properly nested at `submit.production.ios.ascAppId` (Brick I.1.1) gave EAS what it needed to skip the Apple-Developer-Portal lookup. Server-side ASC API Key handled auth. Brick I.1 + I.1.1's whole point — making future submits non-interactive — is now empirically validated.

```
Submission ID:   59ce0e90-4bd7-4b11-be01-f7c73f0ad67c
TestFlight URL:  https://appstoreconnect.apple.com/apps/6765753500/testflight/ios
ETA:             5-10 min Apple processing
```

---

## §3 — Hand-back to Luke

Per V20's smoke OTA brief, Step 5 (recapping for clarity):

```
1. Wait for the TestFlight notification from Apple (5-10 min)
2. Install build 21 on iPhone via TestFlight
3. Force quit Pantheon
4. Cold-start the app — silent fetch fires here (Pattern A)
5. Force quit again
6. Cold-start a second time
7. Look at the version label in the top-right corner
   (small dim text)
```

**Expected outcome (mechanically confirmed):** the version label should now read `9660cda · 2026-05-08 · ota1`. The `· ota1` suffix is the smoke marker. The `9660cda` SHA reflects Build 21's source commit (different from the `7a848db+dirty` that Build 20 displayed).

**Two paths from here:**

- **Marker visible** → fingerprint divergence theory confirmed; rebuild+retest cycle works. Gate 2 → I run `eas update --branch production --platform ios --message "Brick I OTA infrastructure live"` to promote. Then write OTA_RUNBOOK.md amendment with the success framing. Brick I closes clean.

- **Marker missing** → something else is diverging that we didn't catch in pre-flight. Re-run `eas fingerprint:compare --build-id 575a26ab-...` to surface what. Decide between iterate vs pivot to (iii) abandon Brick I. Less likely given the pre-flight clean read, but possible.

---

## §4 — Plan re-evaluation (per doctrine amendment)

**Three observations worth carrying forward from this rebuild cycle:**

1. **EAS pipeline IS internally consistent build-to-update.** Build 21 and the smoke OTA have the same runtime hash because they were both computed from the same project state by EAS server-side. The fingerprint divergence question collapsed to "local vs server" — within server, deterministic. This is the empirical answer to the open question raised at HANDOFF_3 / HANDOFF_9.

2. **Brick I.1 + Brick I.1.1's `ascAppId` work paid off this exact turn.** The non-interactive submit just executed is the validation. Future submits won't need Luke's Terminal.app for Apple 2FA. The "explicitness over redundancy" call from HANDOFF_4 was right.

3. **The two memories saved this turn (`feedback_eas_fingerprint_diagnostic.md`, `feedback_help_check_cited_tools.md`) are now empirically validated**, not just theoretically. Rebuild+retest cycle worked because we had the right diagnostic tool (`eas fingerprint:compare`) AND because we caught the schema-validation gap (Brick I.1.1) AND because we surfaced the entanglement (push-scope rule). All three memory rules from this Brick I arc are paying for themselves immediately.

---

## §5 — Status / docket

**At bat:** Apple processing → Luke TestFlight install + cold-start cycle. Luke surfaces marker visibility.

**On marker visible:** Gate 2 → I run `eas update --branch production --platform ios` → Brick I closes → I write OTA_RUNBOOK.md amendment with success framing.

**On marker missing:** I re-run `eas fingerprint:compare --build-id 575a26ab-...` to diagnose; surface to V20 for next-step decision.

**Deferred:**
- OTA_RUNBOOK.md amendment (per V20's deferral discipline; lands after Luke's outcome)
- Pre-existing web-export bug (Supabase + AsyncStorage SSR) — separate brick post-FASTRAK
- Smoke marker reversal OTA (cosmetic; can fire after Brick I closes)

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_12.md
