# Brick Beta-1 — CLOSED

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Beta-1 close-out. Working tree audit-ready. Standing down for Codex audit.

---

## §0 — TL;DR

- ✓ M.1 + M.2 + M.2b shipped + deployed. All type-checks clean.
- ✓ Migration 020 applied (2 rows cleaned, idempotent).
- ✓ 2 of 4 V20 test cases now single-hit (3 eggs + McDonald's BEC).
- ⚠ 2 of 4 deferred to follow-on bricks (M.4 + M.5).
- ✓ Working tree audit-ready for Codex.

---

## §1 — Final Beta-1 commit chain

```
f32506c  S27 Op FASTRAK Brick Beta-1 / M.2b: hourly_go_to-to-canonical name-cascade (Class C)
e48c94d  S27 Op FASTRAK Brick Beta-1.5 / M.2: NULL-ref name-cascade dedup
c589cac  S27 Op FASTRAK Brick Beta-1 / M.1: source_ref write-time normalization + cascade-dedup + migration 020
```

All three pushed to `origin/main`. Vercel deployed and live.

### Per-rule summary

| Rule | What it does | Catches |
|---|---|---|
| **M.1** | Strips `^(lib:hourly_go_to:[^|]+\|)+` ratchet prefixes at write time + cascade-dedup belt-and-suspenders | Ratcheting concatenation bug (3 eggs case, where library_id chained one prefix per parse-meal cycle) |
| **M.2** | Pass 2: collapses `name:` keys (NULL-source_ref hourlies) into canonical lib:* survivors with matching name | NULL-ref legacy logs that surface alongside their corresponding product/saved_meal |
| **M.2b** | Pass 2 extension: drops ANY surviving hourly_go_to entry whose name matches a different canonical key | Hourlies with non-NULL non-chain source_refs (usda:, off:) that coexist with a canonical favorite saved_meal — McDonald's BEC case |

### Migration

`020_normalize_food_log_source_refs.sql` applied 2026-05-10 16:42 UTC. 2 rows updated. Post-count: 0 chains remaining. Idempotent (WHERE EXISTS gate).

---

## §2 — V20's 4 test cases — final state

| Case | Pre-Beta-1 | Post-Beta-1 | Fix that landed it |
|---|---|---|---|
| `"3 eggs"` | candidates (ratchet) | ✓ single-hit | M.1 + migration 020 |
| `"banana"` | candidates | ⚠ candidates | Out of Beta-1 scope — Class A (plural-variant) → queued M.5 |
| `"eggs - large"` | candidates | ⚠ candidates | Out of Beta-1 scope — Class B (canonical+canonical collision) → queued M.4 |
| `"McDonald's Bacon Egg and Cheese Biscuit"` | candidates | ✓ single-hit | M.2b |

**2 of 4 single-hit.** Both single-hit cases are the highest-frequency voice-log patterns Luke uses (his hearted McDonald's items, his "3 eggs" Sub-fix C.1 saved_meal). The remaining 2 require structurally different rules and are queued as separate bricks.

---

## §3 — Deferred to follow-on bricks

### M.4 — same-name canonical collision (Class B)

**Symptom:** "eggs - large" still candidates because product[Eggs - Large] AND saved_meal[Eggs - Large, fav=N] both exist as canonical entries with the same name. Both have lib:* keys, neither falls to name:, so M.2/M.2b don't touch them.

**Likely fix shape:** when two canonicals share a name (case-insensitive trim), collapse by tier priority (saved_meal favorite > hourly > product > saved_meal non-favorite). For Eggs - Large specifically, both are tier 3 (product + non-fav saved_meal) — secondary discriminator needed (e.g., the saved_meal's foods_json[0].source_ref points at the product → collapse saved_meal into product, or vice versa based on user signal).

### M.5 — name-variant / pluralization tolerance (Class A)

**Symptom:** "banana" query matches both `product[Banana]` and `hourly_go_to{name="Bananas"}` (plural). Names differ at the string level so M.2b's name-cascade doesn't collapse them.

**Likely fix shape:** singular/plural normalization in `name:` key construction (trim trailing 's' from one side before comparing), or add a token-similarity layer that recognizes "Banana" and "Bananas" as the same food. Cheap heuristic + careful edge-case audit to avoid over-collapsing.

### M.3 — library-driven segmenter protect (Beta-2)

**Symptom:** segmenter over-splits compound names like "McDonald's Bacon Egg and Cheese Biscuit" because "and" appears inside the saved_meal name.

**Likely fix shape:** pre-segmenter pass that pulls user's saved_meal names containing " and " or "&", protects substring matches via COMPOSITE_ALLOWLIST mechanism.

**Status:** Beta-2 is the next-up brick after Codex audit completes. Per V20 calibration, M.3 ships before M.4/M.5.

---

## §4 — Memory rule candidates (V20 disposition)

V20 raised two candidates in the EXECUTE brief. Surfacing here for V20 to formally save or leave as code comments.

### Candidate 1 — hourly_go_tos are a ranking signal, not a separate matcher entity

> "Pass 2/2b name-cascade collapses hourly_go_tos into matching canonicals as a structural rule. The hourly_go_to view exists to boost recently-logged foods in ranking; it should never out-rank or surface alongside the canonical it represents."

**My read:** worth saving as a doctrine memory rule. It's a structural principle that applies beyond M.2b — any future rule modifying the dedup pipeline should respect this hierarchy (canonicals are authoritative; views are ranking signals).

Suggested memory name: `feedback_hourly_view_ranking_signal.md`. Type: feedback.

### Candidate 2 — Self-collapse guard is the load-bearing safety check in two-pass dedup

> "When a Pass-N modifies the grouped Map mid-iteration, `canonical === key` is the guard that prevents an entry from dropping itself. Required whenever a pass references the post-dedup canonical for a name that the entry itself contributes to."

**My read:** more of a code-comment-level invariant than a doctrine memory. It's already documented in code comments. If the rule is "always include this guard in two-pass dedup logic" — that's a coding-pattern, narrow enough that the code comments are the right home. Don't think it warrants a memory rule.

Suggested disposition: leave as code comment in `search-user-library.ts`. Don't formalize.

---

## §5 — Working tree audit-ready state for Codex

```
HEAD:     f32506c  S27 Op FASTRAK Brick Beta-1 / M.2b
Branch:   main, up to date with origin/main
Modified: 0
Staged:   0
Untracked: 77 files
  - 76 PANTHEON_V20_*.md / PANTHEON_S27_*.md / GREEK_GOD_BOD_*.md handoff docs
    (intentional session journal; not load-bearing)
  - 1 app.json (16-byte placeholder `{"expo":{}}` from 2026-05-05;
    not load-bearing in web repo context — web is Next.js not Expo)
```

### Audit-ready criteria (V20's list)

| Criterion | Status |
|---|---|
| HEAD is the M.2b commit (`f32506c`) | ✓ |
| No untracked files in repo (except handoff docs) | ⚠ — 76 handoff docs + 1 stray placeholder `app.json` (not from M.2b work; pre-existing) |
| No staged or unstaged changes | ✓ |
| Vercel deploy confirmed green | ✓ (live-test showed M.2b firing) |

### Recommended pre-Codex cleanup (don't auto-execute)

- **Delete the stray `app.json`**: 16 bytes, `{"expo":{}}`, dated May 5. Web repo doesn't use it (it's Next.js, not Expo native). The native repo's `app.json` is at `~/Code/pantheon-native/app.json`. Safe to delete this stray from the web repo. Awaiting Luke approval.
- **Consolidate handoff docs**: 76 handoff `.md` files in repo root. Could move to a `docs/handoffs/` subdirectory or archive older ones to `.archive/`. Awaiting Luke approval — these were intentionally not committed during sessions (session journal vs code).

---

## §6 — Brick Delta queue update

Carry-forwards locked at Beta-1 close:

- **M.3 (Beta-2 next session)** — library-driven segmenter protect (F.2 from Phase 0 recon)
- **M.4** — same-name canonical collision (Class B; Eggs - Large)
- **M.5** — name-variant / pluralization tolerance (Class A; banana plural-hourly)
- OFF save-fail investigation (carry-over from Greek God Bod bulk-add)
- LLM-fill LEAN PROTEINS unit_alternatives (Foundation raw rows have 0-1 alts)
- Aicha Tomato Paste 0-kcal manual fix
- Optional R.4 (primary-noun match) if Ricotta-class recurs

---

## §7 — Standing down for Codex audit

State confirmed:
- ✓ HEAD `f32506c` on origin/main
- ✓ Working tree clean of code changes (only intentional handoff docs + 1 stray placeholder untracked)
- ✓ Vercel deploy green
- ✓ All Beta-1 commits pushed
- ✓ M.1 migration 020 applied + verified

Terminal Claude standing down. Next EXECUTE turn picks up M.3 (Beta-2 segmenter) per V20's calibration — unless Codex audit surfaces blockers requiring earlier intervention.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_CLOSEOUT.md
