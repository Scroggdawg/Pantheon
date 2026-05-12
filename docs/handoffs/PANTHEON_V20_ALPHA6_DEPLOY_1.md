# Op FASTRAK Brick Alpha.6 — Emergency push DEPLOYED

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Emergency push complete. Web deploy live. OTA published. Awaiting Luke's cold-start cycle + verification.

---

## §0 — Status

All 6 EXECUTE steps complete. Web Vercel deploy went green; OTA published with matching fingerprint to Build 21. Outage fix is in production code path. Luke's iPhone needs one cold-start cycle (force quit → reopen → force quit → reopen) to pick up the OTA.

---

## §1 — Step-by-step results

### Step 1: Web push ✓

```
Pushed: 0a53302 → 8d0c48b (7 commits)
To https://github.com/Scroggdawg/Pantheon.git
   179a19b..8d0c48b  main -> main
```

Push scope confirmed against V20's authorized list:
- 0a53302 ✓ Sub-fix A
- 4908489 ✓ Sub-fix B
- b3aec2c ✓ Sub-fix C
- 0b2105a ✓ Sub-fix D
- 37384c1 ✓ Sub-fix D.1
- 6279336 ✓ Sub-fix C.1
- 8d0c48b ✓ Sub-fix F

### Step 2: Vercel deploy ✓ GREEN

Polled the heart endpoint with proper native-secret auth header. Pre-deploy probe (no header) returned HTTP 307 redirect to `/login` (proxy's expected behavior for unauth requests). Once Vercel rebuilt:

```
$ curl -X POST https://pantheon.guru/api/saved_meals/heart \
    -H "Content-Type: application/json" \
    -H "x-pantheon-native-secret: $PANTHEON_NATIVE_SHARED_SECRET" \
    -d '{}'
{"error":"user_id required"}
HTTP 400
```

The 400 with the C.1 endpoint's exact validation message confirms the new code is live. Deploy took ~5 minutes Vercel-side.

### Step 3: Fingerprint check ✓ CLEAN

```
✅ Fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from IOS build matches
   fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from local directory
```

OTA-eligible. No native rebuild required.

### Step 4: Native push ✓

```
Pushed: 90515bc → a76b587 (2 commits)
To https://github.com/Scroggdawg/pantheon-native.git
   cd148db..a76b587  main -> main
```

Archival only (native repo doesn't auto-deploy).

### Step 5: OTA publish ✓

```
Branch           production
Runtime version  1949eb33d497f632a2469f958a99cedf8cf7a71d
Platform         ios
Update group ID  23149dfe-bf76-4ec2-b48b-059a4021bfb0
iOS update ID    019e08b8-e98a-7fb5-a24d-9b4a5922a07e
Message          Op FASTRAK Alpha.6 emergency: per-food cards + library redesign + outage fix
Commit           a76b5875eefa2346ceda4bd23e67be730cd2536e
EAS Dashboard    https://expo.dev/accounts/scroggdawg/projects/pantheon/updates/23149dfe-bf76-4ec2-b48b-059a4021bfb0
```

iOS bundle: `entry-a9c176d6c211f7448455c2b12c169ed1.hbc` (3.33 MB).

---

## §2 — Luke verification checklist

After picking up the OTA via cold-start cycle (force quit → reopen → force quit → reopen — Pattern A silent fetch then apply):

### V.1 — McDonald's log retry (verifies break #1 / Luke's outage)

Web (pantheon.guru) → Log Food → enter "McDonald's Bacon Egg & Cheese Biscuit and a Sausage Burrito" or similar non-library transcript → Save. Expected: log saves successfully (no 500 error). The food_log_entries row lands. NO new saved_meal row gets created (Sub-fix B removed the auto-promote create path).

### V.2 — Quick Select picker (verifies break #3 / latent silent failure)

Web (pantheon.guru) → Log Food → tap the Quick Select picker → expect to see the 4 saved_meals (3 eggs / Churro / Double espresso / Eggs - Large) with the "favorite" badge appearing on any that are hearted. Pre-push this list silently rendered empty.

### V.3 — Save-as-Meal flow (verifies break #2 / latent web recipe save)

Web (pantheon.guru) → after a multi-food log appears in TodayLog → tap "Select" → check 2+ food cards → tap "Save as Meal" → enter a name → Save. Expected: succeeds (no toast error).

### V.4 — Per-food cards + heart icon (iPhone, post-OTA)

Native iPhone (post cold-start) → Pantheon dashboard → Meals section → expect to see one card per food (not one row per entry). Tap a heart icon → expect immediate gold-fill (optimistic flip) + dashboard refetch. Tap card body → expect navigation to /edit-food with that food's row pulsing gold for ~1.5s.

### V.5 — Per-food cards + heart icon (web)

Web (pantheon.guru) → Dashboard → Meals → same shape: per-food cards under meal_label sections, heart icon per card, tap heart → flips, tap card → opens edit modal focused on that food.

### V.6 — Re-log a hearted food (Tier 1 promotion)

After hearting "3 eggs" (or similar saved_meal that's already in the library) — voice or type "3 eggs" again → expect Tier 1 (Favorites) library hit at the matcher level. Telemetry-visible via the response shape (source_ref `lib:saved_meal:b4c2ac48-...` with high confidence).

---

## §3 — Three production breaks resolved

| # | Break | Resolved by | Status |
|---|---|---|---|
| 1 | meals/log INSERT 42703 (Luke's outage) | Sub-fixes A + B (rename + auto-promote delete) | DEPLOYED |
| 2 | SaveMealModal INSERT 42703 (latent) | Sub-fix A (rename pass) | DEPLOYED |
| 3 | QuickSelectModal silent empty (latent) | Sub-fix A (rename pass) | DEPLOYED |

---

## §4 — Pending items

After Luke confirms verification (V.1-V.5) green:

**P.1 — Bundle measurement.** Run `scripts/replay-parse.ts` against the live deployed parse-meal route. Captures latency + tier hit rates post-Alpha.6. Empirical confirmation of cascade behavior; not a blocker.

**P.2 — Save doctrine memory rule.** Per my Phase 0 §A.3 framing — `feedback_schema_code_atomic.md` covering forward-incompatible migrations needing simultaneous code push. The outage tonight is the empirical event that justifies the rule.

**P.3 — Sub-fix G.** Test infrastructure cleanup (`scripts/test-segmented-library.ts` CASES rewrite). Outstanding since post-D.1; V20 sends brief next.

**P.4 — Brick Alpha.6 closeout.** Once V.1-V.6 + P.1 confirm clean, V20 to issue closeout. Brick Gamma (PANTRY) queued per audit-revised sequence.

---

## §5 — Rollback playbook (if any verification fails)

**Web rollback:** Revert via Vercel dashboard → Promote previous deployment to production. The 7 commits stay on origin/main; the Vercel CDN serves the prior build until we patch.

**Native rollback:** `eas update:rollback` → interactive picker → choose `production` branch → `revert to embedded update` (Build 21's baked-in JS bundle, pre-OTA). Clients pick up the rollback signal on next cold start.

**Schema rollback:** NOT advisable. Migrations 015/016/017/018 are forward-only. Reverting `is_favorite → is_staple` would lose any post-Alpha.6 hearting state. If a code-side rollback is needed without schema rollback, the prior code's `is_staple` references would re-break — the schema-code coupling is now atomic in the deployed direction.

---

## §6 — Live state snapshot

```
Web origin/main:    8d0c48b  (Sub-fix F head)  ← LIVE on pantheon.guru
Native origin/main: a76b587  (Sub-fix E head)  ← OTA published, awaiting cold-start
Live Supabase:      is_favorite present, is_staple gone (migrations 015/016/017/018 applied)
Build 21 runtime:   1949eb33...  (matches OTA fingerprint)
EAS update group:   23149dfe-bf76-4ec2-b48b-059a4021bfb0
```

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6_DEPLOY_1.md
