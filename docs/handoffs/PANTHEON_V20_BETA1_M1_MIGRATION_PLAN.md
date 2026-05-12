# Beta-1 / M.1 — Migration plan for V20 review

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** **STOP for V20 PROCEED MIGRATION.** Migration drafted but not applied. Code change scoped but not committed.

---

## §0 — Scope

Two-part fix per V20-confirmed Beta-1:
1. **M.1 code change** — write-time normalization (strips `lib:hourly_go_to:NAME|` ratchet prefixes) + dedupKeyFor() cascade-dedup as belt-and-suspenders
2. **Migration 020** — one-time clean of existing concat'd refs in `food_log_entries.foods_json[].source_ref`

This handoff covers Step 1 — migration plan + the order-of-operations question. Code change diffs surface in Step 4 after migration applies.

---

## §1 — Root-cause confirmation (from spelunking)

The bug site:

**`lib/claude/tools/search-user-library.ts:330-333` — hourlyGoToCandidate:**
```typescript
return {
  library_id: `lib:hourly_go_to:${row.dedup_name}|${row.dedup_source_ref}`,
  source: 'hourly_go_to',
  source_ref: row.source_ref,    // ← raw underlying ref (clean if backfilled)
  ...
}
```

**`lib/claude/parse-meal-library-shortcut.ts:96, 186, 199, 543` — food assembly:**
```typescript
const food: FoodItem = {
  ...
  source_ref: top.library_id,    // ← USES library_id (the CHAINED form)
}
```

The food gets `source_ref = lib:hourly_go_to:NAME|REF` (chained), not `top.source_ref` (the underlying). When that food gets logged, food_log_entries.foods_json[i].source_ref persists the chain. The hourly_go_tos materialized view then re-aggregates with dedup_source_ref = the chain → next library_id = `lib:hourly_go_to:NAME|lib:hourly_go_to:NAME|REF` → ratchet deepens.

**M.1 code fix is one-line per site (4 sites): `source_ref: top.library_id` → `source_ref: top.source_ref ?? top.library_id`.** Plus a normalize helper for safety. Plus dedupKeyFor() regex strip.

---

## §2 — Migration 020 SQL

```sql
-- supabase/migrations/020_normalize_food_log_source_refs.sql
--
-- Op FASTRAK Brick Beta-1 / M.1 — clean ratcheting source_ref concatenation.
--
-- Recon found food_log_entries.foods_json[].source_ref values containing
-- one or more "lib:hourly_go_to:NAME|" prefixes ratcheted onto an underlying
-- "lib:saved_meal:UUID" or "lib:product:UUID" terminal. The ratchet
-- accumulates one level per parse-meal cycle when food.source_ref was
-- written with the chained library_id instead of the underlying ref.
--
-- This migration strips all leading "(lib:hourly_go_to:[^|]+\|)+" prefixes
-- from each food's source_ref, leaving the terminal underlying ref intact.
--
-- Forward-compatible: no schema change. Pre-M.1 code reading these rows
-- continues to work — it just sees clean source_refs that dedupKeyFor()
-- matches more reliably. Post-M.1 code keeps writing clean refs going
-- forward.
--
-- Idempotent: the WHERE EXISTS predicate only matches rows that still
-- contain a chain; second run touches 0 rows.

UPDATE food_log_entries
SET foods_json = (
  SELECT jsonb_agg(
    CASE
      WHEN f->>'source_ref' ~ '^(lib:hourly_go_to:[^|]+\|)+'
      THEN jsonb_set(
        f,
        '{source_ref}',
        to_jsonb(regexp_replace(f->>'source_ref', '^(lib:hourly_go_to:[^|]+\|)+', ''))
      )
      ELSE f
    END
  )
  FROM jsonb_array_elements(foods_json) AS f
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(foods_json) AS f
  WHERE f->>'source_ref' ~ '^(lib:hourly_go_to:[^|]+\|)+'
);
```

### Pre-migration dry-run query (for V20 verification)

```sql
-- Count of rows that would be touched:
SELECT COUNT(*) FROM food_log_entries
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(foods_json) AS f
  WHERE f->>'source_ref' ~ '^(lib:hourly_go_to:[^|]+\|)+'
);

-- Sample chain values (top 5):
SELECT (f->>'source_ref') AS source_ref, (f->>'name') AS food_name, fle.created_at
FROM food_log_entries fle, jsonb_array_elements(fle.foods_json) AS f
WHERE f->>'source_ref' ~ '^(lib:hourly_go_to:[^|]+\|)+'
ORDER BY fle.created_at DESC
LIMIT 5;
```

---

## §3 — Properties

| Property | Status |
|---|---|
| Forward-compatible (no schema change, only data UPDATE) | ✓ |
| Idempotent (WHERE EXISTS gates the UPDATE) | ✓ |
| Safe under concurrent reads (UPDATE is row-locked; readers see pre or post atomically) | ✓ |
| Reverts existing concat'd refs to terminal-only form | ✓ |
| Touches only rows with the ratchet pattern (NULL refs, clean refs untouched) | ✓ |
| Matches the recon prediction (~15 corrupted rows out of 30 sampled in last day) | TBD on dry-run |

---

## §4 — My read on order of operations (V20's ask)

**Recommend CODE-FIRST.**

Under "schema-code atomic" memory rule, forward-compatible migrations are safe to apply ahead of code push. But this case has a unique consideration: the bug **keeps accumulating** between migration-apply and code-push.

**Migration-first scenario:**
1. Migration cleans existing chains.
2. Old code (pre-push) still writes new dirty refs on every parse-meal log.
3. By the time code push lands (1-15 min Vercel deploy), more chains have accumulated.
4. Need a 2nd migration run after deploy to clean the new accumulation.
5. Net: two migrations effectively.

**Code-first scenario:**
1. Push code → Vercel deploys (1-3 min).
2. Old code stops writing new chains immediately on rollout.
3. Existing chains in DB still bad, BUT cascade-dedup belt-and-suspenders in dedupKeyFor() handles them at read time (matcher works correctly during the gap).
4. Apply migration after deploy lands.
5. Net: one migration. No new accumulation.

**Code-first is safer for THIS migration shape.** The cascade-dedup safety net is the load-bearing piece — it lets the system run cleanly even with dirty data during the deploy window.

If V20 prefers migration-first (e.g., to match doctrine literally), that's also safe — just plan for a 2nd migration sweep.

---

## §5 — Schema-code atomic memory rule check

Per the captured doctrine (`feedback_schema_code_atomic.md`):
> Forward-incompatible migrations (RENAME / DROP / ALTER TYPE) must ship simultaneously with the matching code push. Additive migrations are safe ahead of code.

This migration is **DATA-only UPDATE** (not even additive — pure data normalization). Strictly speaking it's safer than additive migrations against the doctrine. Either order works; my recommendation above is purely an accumulation-window optimization.

---

## §6 — Sequenced plan (post V20 PROCEED)

If V20 says PROCEED MIGRATION — code-first:
1. **(this turn)** Surface migration plan + code change drafts (Steps 1-2 of EXECUTE)
2. V20 reviews + says PROCEED CODE-FIRST
3. Apply M.1 code changes (write-time normalization + cascade-dedup)
4. Type-check clean
5. Surface diffs for V20 PROCEED COMMIT
6. Local commit + V20 PROCEED PUSH
7. Push to main → Vercel deploys
8. Run dry-run query (count rows that would be touched)
9. Apply migration 020
10. Verify post-migration count = 0 chains remaining; spot-check 2-3 rows
11. Live-test the 4 known cases (3 eggs / banana / eggs - large / McDonald's BEC)
12. Surface close-out

If V20 says PROCEED MIGRATION-FIRST: same with migration applied before code push, plus a 2nd migration sweep post-deploy.

---

## §7 — Asks for V20

**A.1 — V20 confirms migration 020 SQL.** Specifically: regex `^(lib:hourly_go_to:[^|]+\|)+` correctly strips one or more chain prefixes; idempotent gate via WHERE EXISTS; no schema change.

**A.2 — V20 picks order:** code-first (recommended) or migration-first.

**A.3 — V20 PROCEED to next step** (either run dry-run query first to confirm row count, OR proceed directly to code change drafts).

**A.4 — Implicit ask:** Beta-1 commit message structure. Recommend single commit covering:
- M.1 source_ref write-time normalization in parse-meal-library-shortcut.ts (4 sites)
- M.1 cascade-dedup in search-user-library.ts dedupKeyFor()
- Migration 020 SQL file added

If V20 prefers separate commits (one for code, one for migration), I can split.

---

## §8 — Cleanup state

- **Production: 61 products.** Unchanged since Path γ.
- **Git: HEAD `04345b4`.** Working tree clean.
- **No code changes applied yet.** No migration applied yet.

Standing by for V20 PROCEED.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BETA1_M1_MIGRATION_PLAN.md
