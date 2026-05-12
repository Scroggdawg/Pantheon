# Brick I.1.1 + Smoke OTA Published — Awaiting Luke's Device Validation

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude — empirical test now in Luke's hands
**Mode:** EXECUTE complete. OTA published to preview channel. Hand-back for device check.

---

## §0 — Status

Brick I.1.1 shipped clean. Two doctrine memories saved. Smoke OTA published to preview channel after one additional workaround (web platform export bug — see §3). Empirical answer to fingerprint divergence now waits on Luke's iPhone.

---

## §1 — Brick I.1.1 commit + push

**Commit:** `9660cda S27 Op FASTRAK Brick I.1.1: fix ascAppId nesting` (1 file, +3/-1)

**Diff:**

```diff
   "submit": {
     "production": {
-      "ascAppId": "6765753500"
+      "ios": {
+        "ascAppId": "6765753500"
+      }
     }
   }
```

**Verification:**

| Check | Result |
|---|---|
| `python3 json.load` | ✅ JSON valid; `submit.production.ios.ascAppId` reads `"6765753500"` |
| `npx --yes eas-cli@latest config --profile production --platform ios --non-interactive` | ✅ Clean output; no schema errors. Confirms eas.json is now schema-valid (the validator that rejected Brick I.1's placement). |

**Push:** scope verified 1 commit only via `git log --oneline origin/main..HEAD` per the locked memory rule.

```
3b36e3e..9660cda  main -> main
```

---

## §2 — Two memories saved this turn

Per V20's approval:

1. **`feedback_eas_json_schema_validation.md`** — when modifying structured config files, Gate 1 verification must include the consuming tool's actual schema validator, not just JSON-syntactic-validity. Indexed in MEMORY.md. Applies across `eas.json`, `app.json`, `tsconfig.json`, `vercel.json`, etc. — each has a documented schema-validating command in the memory.
2. (Already-landed earlier this session) `feedback_git_push_scope_surfacing.md` — applied successfully twice this turn (smoke marker push, Brick I.1.1 push).

V20 said the broader principle (schema vs syntax across structured configs generally) folds into the next `A_TALE_OF_TWO_CLAUDES` amendment. This memory captures the operational rule for Terminal in the meantime.

---

## §3 — Smoke OTA publish — first attempt blocked, second attempt succeeded

### First attempt (`--platform=all` default): FAILED on web export

```
[expo-cli] ReferenceError: window is not defined
    at getValue (.../@react-native-async-storage/async-storage/.../AsyncStorage.js:63:52)
    ...
    at getItemAsync (.../@supabase/auth-js/.../helpers.js:129:33)
    at j._initialize (.../GoTrueClient.js:321:24)
✖ Export failed
expo cli export --platform=all exited with non-zero code: 7
    Error: update command failed.
```

**Root cause:** `eas update` defaults to `--platform=all`, which includes web. Web export uses Expo's static rendering (`expo-router/node/render.js`) which runs JavaScript in Node — no `window` global. The Supabase auth-js library calls `AsyncStorage.getItem` at module load via `_initialize`, and AsyncStorage's web shim accesses `window.localStorage` → crash.

**Pre-existing bug, not introduced by Brick I.** The original `eas build --platform ios` skipped web export entirely (it builds an iOS binary, not a web bundle). `eas update --platform=all` is the first place this surfaces. Pantheon doesn't deploy to web (no web platform target post-S26), so the right fix is to either:
- Always run `eas update --platform ios` for OTA publishes (workaround used here)
- Make Supabase initialization SSR-safe (proper fix; out of scope for Brick I)

### Second attempt (`--platform ios`): SUCCEEDED

```
✔ Exported bundle(s)
✔ Uploaded 1 app bundle
✔ Computed project fingerprints
✔ Published!

Branch           preview
Runtime version  1949eb33d497f632a2469f958a99cedf8cf7a71d
Platform         ios
Update group ID  585c37fe-d17d-403e-91f9-b667a578b900
iOS update ID    019e0676-088b-7b7f-bf10-eec3644ab0ef
Message          Brick I smoke test - OTA infrastructure validation
Commit           9660cdafaebf62856690bacb258832c6b97aa8a6*
EAS Dashboard    https://expo.dev/accounts/scroggdawg/projects/pantheon/updates/585c37fe-d17d-403e-91f9-b667a578b900
```

**Bundle size:** 3.33 MB (`entry-5bf26710a031fa2ba6ac959290f6dcc7.hbc`). 52 iOS assets. 2 files. No new assets uploaded (all previously seen).

**Update is live on the preview channel.** Server-published, ready for any binary running runtime version `1949eb33d497f632a2469f958a99cedf8cf7a71d` to fetch on next launch.

---

## §4 — The fingerprint divergence — three different hashes now visible

This is the load-bearing question of Brick I. Empirical state:

| Hash | Source | Where computed |
|---|---|---|
| `60d025988dc1c4cd893fd720aa5db9d671319a70` | **Build 20 binary's runtime version** (per `eas build:view edc102f4`) | EAS server at BUILD time, from commit `7a848db`'s working tree |
| `913d97860c27984abbf7f9474e375d25a80e627d` | **Local `@expo/fingerprint generate`** (current state, post-Brick-I.1.1) | My local machine, npx-resolved tool |
| `1949eb33d497f632a2469f958a99cedf8cf7a71d` | **THIS OTA's runtime version** (per the publish output above) | EAS server at UPDATE time, from current working tree |

**Three different SHA-1 hashes for what should be a deterministic function of project state.** None match.

### My read

The server-side fingerprint at OTA-publish time (`1949eb...`) does not match the binary's runtime version (`60d025...`). **My prediction: the OTA will NOT reach Luke's device.** EAS Update only delivers updates whose runtime version matches the requesting binary's runtime version.

This is **outcome (b)** from V20's brief: fingerprint mismatch is real. Architecture needs revisit.

### But — empirical truth is Luke's check

Predictions about EAS server-side semantics are weak. The actual test is Luke's iPhone:
- If the marker appears on second cold start → OTA reached. Pipeline is internally consistent in a way I'm not modeling correctly.
- If the marker doesn't appear → OTA didn't reach. Fingerprint mismatch confirmed; rebuild required for any OTA work.

Don't write the OTA_RUNBOOK.md amendment until Luke surfaces the result.

---

## §5 — Hand-off to Luke for device validation

Per V20's smoke OTA brief, Step 5:

```
1. Force quit Pantheon on iPhone
2. Cold-start the app (silent fetch fires here — Pattern A)
3. Wait briefly OR just launch normally — apply-on-next-launch
   means even if the fetch happens this session, the marker
   won't appear until the launch AFTER fetch completes
4. Force quit again
5. Cold-start the app a second time
6. Look at the version label in the top-right corner (the
   small dim text that shows {sha} · {timestamp})
```

**What to look for:**
- **OTA reached:** the version label now reads `{sha} · {timestamp} · ota1` (the new ` · ota1` suffix at the end)
- **OTA did not reach:** label still reads `{sha} · {timestamp}` with no ` · ota1` suffix

If the SHA itself also changed (the leading hex string differs from what was visible right after build 20 install), that's an additional confirmation that the new bundle is loaded — but the ` · ota1` suffix is the primary signal.

**If OTA reached:** V20 issues PROCEED PROMOTE → I run `eas update --branch production --platform ios --message "Brick I OTA infrastructure live"`, then write the OTA_RUNBOOK.md amendment with the "local fingerprint is advisory; server-side is authoritative + internally consistent" framing.

**If OTA did not reach:** V20 + Terminal regroup on the architecture. Likely path: rebuild required for any OTA. OTA_RUNBOOK.md amendment writes the "rebuild for any tracked file change" rule. Brick I's value drops significantly under this scenario — OTA stops being a useful iteration shortcut for native bricks. May need to revisit Brick I scope or acceptance criteria.

---

## §6 — Status / docket

**At bat:** Luke runs the cold-start cycle and reports back with marker visibility.

**On deck (post-Luke):**
- If OTA reached: Gate 2 review → PROCEED PROMOTE → production publish → OTA_RUNBOOK.md amendment. Brick I closes.
- If OTA didn't reach: Brick I architecture review. May involve: rebuild as the only OTA delivery path, scope reduction on what changes can ship via OTA, or accepting that EAS Update isn't a reliable iteration mechanism for Pantheon's particular config.

**Surfaced for tracking (no action this turn):**
- Web export bug (Supabase auth-js + AsyncStorage SSR crash). Pre-existing, not Brick I scope. Workaround: always pass `--platform ios` to `eas update`. Proper fix is a separate brick — make Supabase init SSR-safe OR disable web platform from app.json entirely (`platforms: ["ios", "android"]`).
- OTA_RUNBOOK.md amendment, queued per V20's deferral discipline. Pending Luke's empirical answer.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_9.md
