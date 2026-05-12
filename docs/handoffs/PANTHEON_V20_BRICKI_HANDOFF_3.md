# Pantheon — Brick I Submit Blocker + Step 14 Plan

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Step 12 BLOCKED on Apple 2FA — needs Luke's Terminal.app for one-time interactive submit. Step 14 plan ready to fire after Luke validates step 13.

---

## §0 — Status

**Step 12 BLOCKED.** EAS submit cannot complete from Claude bash — it requires Apple Developer 2FA which is incompatible with paste-output relay per the access doc.

**Step 14 PLANNED.** Smoke change ready to apply when greenlit; not yet edited.

---

## §1 — Step 12: what happened

**Attempt 1** — non-interactive:
```
$ npx --yes eas-cli@latest submit --platform ios --latest --non-interactive
> Set ascAppId in the submit profile (eas.json) or re-run this command
  in interactive mode.
> Submission failed
```

**Attempt 2** — interactive with empty stdin (to see how far it gets):
```
$ echo "" | npx --yes eas-cli@latest submit --platform ios --latest
> Ensuring your app exists on App Store Connect. This step can be
  skipped by providing ascAppId in the submit profile.
> Log in to your Apple Developer account to continue
> Authentication with Apple Developer Portal failed!
> Input is required, but stdin is not readable. Failed to display
  prompt: Apple ID:
> Submission failed
```

**Diagnosis:**

`eas.json:submit.production` is empty `{}` — no `ascAppId` populated. Without it, EAS submit attempts to discover the App Store Connect App ID by logging into Apple Developer Portal, which requires the Apple ID + password + 2FA code. **That flow needs Luke's regular Terminal.app per the access doc:**

> "EAS interactive flows that hit Apple Developer credentials (2FA, certificate management) MUST run in Luke's regular Terminal.app, NOT in Claude bash. Different shells, different credential caches. Apple's 2FA UX is incompatible with paste-output relay."

Prior production builds (16, 17, 19 in the EAS history) presumably went through the same interactive flow each time, OR a previous session's interactive submit auto-populated `ascAppId` and a subsequent commit reverted it. Git log on eas.json shows no prior `ascAppId` entries — so it's never been persisted in commit history. Luke (or a prior Terminal session) has been doing interactive submits each time without saving the ID back.

This is a **one-time pain**. Once Luke runs the interactive submit ONE time and EAS writes `ascAppId` to eas.json, all future submits work non-interactively from Claude bash.

---

## §2 — Action required from Luke

**Run this from your regular Terminal.app (NOT Claude bash):**

```bash
cd /Users/scrogdawg/Code/pantheon-native
npx --yes eas-cli@latest submit --platform ios --latest
```

**What will happen:**

1. EAS prompts: "Apple ID:" → enter `lscrogg@gmail.com` (per access doc)
2. EAS prompts for password
3. Apple sends 2FA code to your trusted device (iPhone)
4. EAS prompts: enter the 2FA code
5. EAS queries App Store Connect, finds the Pantheon app, asks if you want to save the `ascAppId` to eas.json — **say yes**
6. EAS submits build `edc102f4-1168-48e2-b28d-1d221aea92f0` to TestFlight
7. ~5-10 minute EAS queue + ~5-30 minute Apple processing → TestFlight install ready

**Outcome:**
- eas.json gets a permanent `submit.production.ascAppId` value
- All future Brick I OTA work bypasses this — `eas update` doesn't touch App Store Connect at all
- Future EAS submits (if any) work non-interactively

**After Luke runs this:** Luke surfaces "submit done, ascAppId saved" and we proceed to step 13 (TestFlight install + validate). Luke also commits the eas.json change (or I commit it on his behalf if he wants).

---

## §3 — Step 14 plan: smoke OTA change

V20 left this open. My pick: a tiny visible-but-subtle modification to `VersionFooter` text — added during step 14 when we run `eas update --branch preview`.

**Approach (proposed, not yet applied):**

Find `VersionFooter.tsx`'s display string and append a small visual marker that Luke would notice if he's looking but no one else would. Two options I'd consider after reading the file:

- **Option A — append a middle dot:** `v1.0.0 (20)` → `v1.0.0 (20)·`. Subtle but visible; trivially reversible.
- **Option B — text marker:** `v1.0.0 (20)` → `v1.0.0 (20) · ota1`. More obvious, but un-mistakable for Luke.

**Why VersionFooter:** it's rendered on every screen per its name. Luke will see it without hunting.

**Why NOT a console.log:** smoke validation needs to be visible without dev tools. Luke's iPhone won't have Safari devtools open during normal use.

**Reversibility:** after Luke validates the change reached his device on next cold start, I publish a follow-up OTA that removes the marker. Two-line round-trip via `eas update` calls.

**This is NOT applied yet.** I'll edit + ship only when V20 fires the step 14 trigger after Luke validates step 13.

V20 confirm the approach (Option A, B, or different) before step 14 fires.

---

## §4 — What's NOT done

- ❌ Step 12 EAS submit — BLOCKED on Luke's interactive run
- ❌ Step 13 — held for Luke (TestFlight install + validate)
- ❌ Step 14 — held until step 13 validates AND V20 confirms smoke change approach
- ❌ Step 15 / Gate 2 — held until smoke validates
- ❌ Push to GitHub — held until after Gate 2

---

## §5 — Plan re-evaluation (per doctrine amendment)

**Updates to the cost model:**

- Brick I's 7m 41s build (vs V17's 3-4hr cited cost) is one ~25× speedup.
- The submit step retains its V17-era ~5-30min Apple-processing cost; that part hasn't sped up.
- **The credential-gating wrinkle** for first-time submit-with-empty-ascAppId is a one-time-per-project cost, not a per-build cost. Won't recur for Brick I or any later submit.

**Implication for downstream native bricks (Alpha.6, Delta, Epsilon, Zeta):** zero EAS submits required for any of them — they all ship via `eas update` against the existing binary base. The credential-gating wrinkle does NOT recur for the rest of Op FASTRAK's native work.

**Implication for OTA_RUNBOOK.md:** worth adding a line about the one-time-per-project ascAppId interactive submit if a future fresh-clone scenario hits the same wall. Small follow-on.

---

## §6 — Status / docket

**At bat:** Luke runs interactive `eas submit` from his Terminal.app (per §2). When done, surfaces "submit done, ascAppId saved."

**On deck (post-submit):**
- Step 13: Luke TestFlight install + validate (cold start, voice log, dashboard render)
- Step 14: smoke OTA via `eas update --branch preview` with the VersionFooter marker change (V20 to confirm Option A vs B vs different)
- Step 15: Gate 2 review + promote to production
- Push to GitHub: post-Gate-2

**Parallel thread reminder:** Alpha-ex-6 web work still awaiting EXECUTE brief. Independent of this submit blocker.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BRICKI_HANDOFF_3.md
