# Brick I — ascAppId Status + Recommendation

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Status check answer + advice. No edit, no commit (per "commit alongside next Brick I work").

---

## State

`eas.json:submit.production` is **still empty `{}`**. Luke's interactive submit fired clean (build 20 uploaded, Apple processing started), but the "save ascAppId to eas.json" prompt was either declined OR not surfaced at all (EAS may have skipped it since the server-side ASC API key handled the auth without needing ascAppId).

```
$ grep -A2 '"submit"' /Users/scrogdawg/Code/pantheon-native/eas.json
  "submit": {
    "production": {}
  }

$ git status --short eas.json
(no output — file unchanged since 7a848db)
```

ASC App ID per Luke's EAS output: **`6765753500`**.

---

## Recommendation: option (a) — add it to eas.json

Five reasons:

1. **It's a stable identifier.** App Store Connect App IDs don't change unless the app is unbundled or recreated on ASC. `6765753500` is the canonical ID for `guru.pantheon.app` for the lifetime of the app's ASC record.

2. **Self-documenting config.** A future Chat Claude (V21+) or fresh-eyes human opening eas.json sees the value explicitly. Empty `{}` reads as "incomplete or broken" without context.

3. **Avoids first-time-clone friction.** A fresh clone of pantheon-native (CI runner, new dev machine, future Luke device migration) running `eas submit` would hit the same Apple 2FA dance Luke just navigated. With ascAppId persisted + server-side creds, that's a fully non-interactive flow.

4. **Doctrine-aligned with the access doc commitment.** Per `PANTHEON_ACCESS_AND_CREDENTIALS.md`: "future sessions should never re-litigate access questions answered here." The ascAppId is exactly such a question; persisting it in eas.json answers it for everyone downstream.

5. **Cost = one line of JSON.** Zero risk, trivial change.

The counterargument (V20's option (b) rationale) is that it's redundant given server-side ASC API key handles auth. True. But redundancy here = explicitness, which has positive UX value in a config file consumed by humans + AI sessions across time.

## Recommended diff (when you greenlight)

```diff
   "submit": {
-    "production": {}
+    "production": {
+      "ascAppId": "6765753500"
+    }
   }
```

Per V20's brief framing ("Commit alongside the next Brick I work"), I'm holding the edit until the next Brick I commit fires (smoke OTA via preview channel post-TestFlight install, or the Apple Team ID warning fix, or whichever lands first). At that point this one-line addition rides along in the same commit. **No working-tree drift in the meantime.**

If V20 prefers a standalone commit now, easy — say the word and I'll edit + commit `S27 Op FASTRAK Brick I.1: persist ascAppId in eas.json` as a one-line follow-up.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_4.md
