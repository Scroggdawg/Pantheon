# Brick I — smoke OTA BLOCKED on eas.json schema bug from Brick I.1

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — needs decision before retry
**Mode:** Surfacing a blocker. No further commits without greenlight.

---

## §0 — Status

Smoke OTA execution proceeded through steps 1-3 cleanly:

- **Step 1 ✅** — VersionFooter.tsx edited. Note: the existing footer shows `{sha} · {BUILD_AT}` (not the literal "v1.0.0 (20)" V20's brief described). Appended ` · ota1` to that existing format.
- **Step 2 ✅** — Commit `3b36e3e S27 Op FASTRAK Brick I smoke test marker` (1 file, +1/-1).
- **Step 3 ✅** — Push scope verified (1 commit only); pushed `821f3f7..3b36e3e main -> main`.
- **Step 4 ❌** — `eas update --branch preview` FAILED.

```
$ npx --yes eas-cli@latest update --branch preview \
    --message "Brick I smoke test - OTA infrastructure validation" --non-interactive
eas.json is not valid.
- "submit.production.ascAppId" is not allowed
    Error: update command failed.
```

`eas update` runs strict eas.json schema validation BEFORE doing any work. The current `submit.production.ascAppId` placement (added in Brick I.1, commit `7d093af`) is at the WRONG nesting level per EAS schema and gets rejected.

---

## §1 — Root cause

Per Expo docs (`docs.expo.dev/eas-submit/eas-json/`), `ascAppId` is a platform-scoped iOS field, not a top-level submit-profile field:

```json
// CORRECT
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "6765753500"
      }
    }
  }
}

// WHAT BRICK I.1 ACTUALLY SHIPPED
{
  "submit": {
    "production": {
      "ascAppId": "6765753500"
    }
  }
}
```

**Why we didn't catch this earlier:** the interactive `eas submit --platform ios --latest` Luke ran was lenient — likely because EAS resolved ascAppId from Apple Developer Portal before applying eas.json validation, or because the interactive flow took a different validation path. `eas update` is strict.

So Brick I.1 (`7d093af`) shipped a syntactically invalid eas.json. It hadn't tripped any validation gate until now.

---

## §2 — Recommended fix shape

One-line nesting fix as a small commit. Call it **Brick I.1.1**:

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

Session tag: `S27 Op FASTRAK Brick I.1.1: fix ascAppId nesting`.

After Brick I.1.1 lands + push, retry `eas update --branch preview`. Should publish cleanly.

---

## §3 — Why I stopped instead of fixing

V20's smoke OTA brief was strict on push-scope discipline:
> "Apply push-scope discipline per the locked memory rule — list commits ahead of origin, confirm scope is just this one commit, then push."

Adding an unrelated eas.json fix to that push would have widened scope without explicit authorization. Per the locked memory rule (`feedback_git_push_scope_surfacing.md`) and the doctrine refinement we just landed: **don't run git push blind, don't expand scope without confirmation.**

The smoke marker commit is already pushed (clean scope, single commit). The blocker is downstream of that push. Fix needs its own gate.

---

## §4 — Decision points for V20

1. **Approve the Brick I.1.1 fix shape** — confirm the one-line nesting change is the right move (vs alternative: revert ascAppId entirely, ship without it, server-side ASC API key handles auth anyway).
2. **Authorize me to commit + push Brick I.1.1** — small standalone commit. Push scope will be 1 commit only (the I.1.1 fix). Memory rule applied.
3. **Authorize retry of `eas update --branch preview`** — once eas.json validates, the smoke OTA publish should fire cleanly. Same `--message` as in your original brief.

If V20 prefers the alternative (revert ascAppId, accept first-time-clone friction, rely on server-side creds), that's also a one-line change — `submit.production.ascAppId: "6765753500"` → `submit.production: {}`. I documented the trade-off in HANDOFF_4 §3 originally; happy to defer if V20 wants the simpler shape now.

My recommendation: **fix the nesting (Brick I.1.1)**. The reasons we landed Brick I.1 in the first place (self-documenting config, future-clone friction avoidance, doctrine alignment) all still apply; the only issue was the wrong nesting level.

---

## §5 — Plan re-evaluation (per doctrine amendment)

**Doctrine moment:** Brick I.1 shipped invalid eas.json AND it took until smoke OTA execution to catch it. V20's review at Brick I.1 Gate 1 didn't catch it; my "JSON valid + ascAppId reads correctly" check at Gate 1 didn't catch it (I checked syntactic JSON validity, not EAS schema validity).

**The check that WOULD have caught it pre-commit:** `eas config` or running ANY eas-cli command that triggers schema validation (e.g., `eas update --help` would still validate, or `eas build --dry-run` if such a flag exists). I didn't run such a command at Brick I.1 verification.

**Future doctrine refinement candidate:** when modifying `eas.json`, run an eas-cli command afterward that exercises schema validation, before declaring Gate 1 verification complete. Cheap. Catches schema bugs.

I'll save this as a memory if V20 confirms the refinement is right; same shape as the push-scope-surfacing memory.

**Also worth adding to OTA_RUNBOOK.md:** "Before publishing OTA, run `eas update --help` (or similar) to surface eas.json schema errors. `eas update` validates strictly; `eas submit` is lenient." But hold this until the smoke OTA empirical answer is in (per V20's brief on the runbook amendment).

---

## §6 — Status / docket

**At bat:** V20 reviews + decides on §4 decision points. No further code action this turn.

**Smoke OTA pending Brick I.1.1 + retry.** The fingerprint divergence empirical question is still open — we'll get the answer once OTA actually publishes and Luke checks his device.

**Summary of the empirical state for V20's framing:**
- Local eas.json is broken at the EAS schema level (Brick I.1 nesting bug)
- Smoke marker commit (`3b36e3e`) is pushed and ready
- OTA publish blocked until Brick I.1.1 lands

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_8.md
