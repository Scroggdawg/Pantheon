-- Op FASTRAK Alpha.7 — saved_meal_id audit-trail column on food_log_entries.
--
-- Rationale: today, the linkage from a logged meal back to its source
-- saved_meal is indirect (only via claude_parse_json.foods[].source_ref
-- text strings). That makes "library re-use rate" measurement fragile
-- and parse-history audits messy. This column gives us a stored, typed
-- pointer per row.
--
-- Forward-only by design. Historical food_log_entries rows stay NULL —
-- backfilling them would require parsing JSONB strings and is not
-- load-bearing for any current consumer. The replay measurement script
-- (Alpha.8) handles both populated and null cases.
--
-- FK with ON DELETE SET NULL: when a saved_meal is later deleted (e.g.,
-- the junk-cleanup pass we just ran), the audit-trail column auto-nulls
-- on existing log rows rather than failing the delete or leaving a
-- stale UUID. Trades type safety for delete-friendliness.

ALTER TABLE food_log_entries
  ADD COLUMN saved_meal_id uuid
  REFERENCES saved_meals(id) ON DELETE SET NULL
  DEFAULT null;

-- Optional indexing for queries that filter by saved_meal_id (e.g., "how
-- often do I re-log this saved meal?"). Cheap on the current ~41-row
-- table; load-bearing once log volume grows. Index over the non-null
-- subset only — most rows will have NULL until back-population fills in.
CREATE INDEX IF NOT EXISTS food_log_entries_saved_meal_id_idx
  ON food_log_entries (saved_meal_id)
  WHERE saved_meal_id IS NOT NULL;
