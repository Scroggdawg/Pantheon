-- Op FASTRAK Brick Gamma A — unit_alternatives data layer.
--
-- Adds unit_alternatives (JSONB array of {unit, grams, source, confidence}
-- entries) to products. unit_alternatives lives at the product row level
-- as the canonical source for global unit-to-grams data populated from
-- USDA food_portions (Gamma A), OFF (Gamma B), and LLM-fill (Gamma C).
--
-- saved_meals does NOT get a unit_alternatives column — per-user
-- overrides ride inside saved_meals.foods_json[i].unit_alternatives
-- (JSONB shape extension, no schema change). When Luke corrects a unit
-- weight in the Delta editor, the correction writes to that food's
-- foods_json entry with source='user_corrected'.
--
-- fdc_id added so the backfill script can stash the originating USDA
-- fdcId once recovered (avoids re-running name-search on subsequent
-- refresh cycles).
--
-- unit_alternatives_updated_at supports cache-invalidation (re-fetch
-- from USDA every N days if needed).
--
-- All three columns are forward-compatible additions per Alpha.6
-- schema-code atomic memory rule — pre-existing code reads unchanged
-- since the columns default to empty/null.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fdc_id integer NULL,
  ADD COLUMN IF NOT EXISTS unit_alternatives_updated_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS products_fdc_id_idx
  ON products (fdc_id) WHERE fdc_id IS NOT NULL;
