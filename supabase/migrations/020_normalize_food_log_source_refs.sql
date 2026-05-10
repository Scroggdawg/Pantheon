-- Op FASTRAK Brick Beta-1 / M.1 — clean ratcheting source_ref concatenation.
--
-- food_log_entries.foods_json[].source_ref values containing one or more
-- "lib:hourly_go_to:NAME|" prefixes ratcheted onto an underlying terminal
-- ref ("lib:saved_meal:UUID" or "lib:product:UUID"). The ratchet
-- accumulated one level per parse-meal cycle when food.source_ref was
-- written with the chained library_id instead of the underlying ref
-- (parse-meal-library-shortcut.ts). The M.1 code change now writes the
-- normalized form going forward; this migration cleans existing rows.
--
-- Forward-compatible: no schema change. Pre-M.1 code reading these rows
-- continues to work — it just sees clean source_refs that dedupKeyFor()
-- matches more reliably. Post-M.1 code keeps writing clean refs going
-- forward.
--
-- Idempotent: the WHERE EXISTS predicate only matches rows that still
-- contain a chain; second run touches 0 rows.
--
-- Pre-migration dry-run (10 May 2026 production scan) found:
--   - 2 food_log_entries rows would be UPDATEd
--   - 2 food entries with chain prefix (both "3 eggs" terminating at the
--     same lib:saved_meal:b4c2ac48... saved_meal)
--   - One had 1 prefix, the other had 2 prefixes (proof of ratcheting)

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
