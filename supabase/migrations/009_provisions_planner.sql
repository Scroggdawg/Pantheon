-- 009_provisions_planner.sql
-- Phase 2.1.a.1 — Provisions Planner backend.
-- Adds products + user_preferences. Amends meal_plans (batch lifecycle
-- via in_hole/on_deck/up/archived enum + batch metadata columns).
-- Amends meal_plan_entries (polymorphic source_type/source_id replacing
-- recipe_id, plus locked flag).
-- RLS enabled on all new tables with NO policies (server-route +
-- service-role pattern, per Migration 008).

------------------------------------------------------------------
-- 1. NEW TABLE: products
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                      text NOT NULL,
  brand                     text,
  unit                      text NOT NULL,
  serving_size_g            numeric,
  calories_per_serving      numeric NOT NULL,
  protein_g_per_serving     numeric NOT NULL,
  fat_g_per_serving         numeric NOT NULL,
  carbs_g_per_serving       numeric NOT NULL,
  fiber_g_per_serving       numeric,
  fulfillment_source        text NOT NULL CHECK (fulfillment_source IN
                              ('amazon_fresh','amazon_prime','whole_foods','manual')),
  barcode                   text,
  product_url               text,
  notes                     text,
  tracks_inventory          boolean DEFAULT false,
  servings_per_unit         integer,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------
-- 2. NEW TABLE: user_preferences (singleton)
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_preferences (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_target_macros       jsonb,
  cuisine_likes             text[] NOT NULL DEFAULT '{}',
  cuisine_dislikes          text[] NOT NULL DEFAULT '{}',
  protein_likes             text[] NOT NULL DEFAULT '{}',
  protein_dislikes          text[] NOT NULL DEFAULT '{}',
  excluded_ingredients      text[] NOT NULL DEFAULT '{}',
  default_servings          numeric NOT NULL DEFAULT 1,
  default_batch_days        integer NOT NULL DEFAULT 4,
  notes                     text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------
-- 3. AMEND meal_plans
--    a. Replace status CHECK with batch lifecycle enum.
--    b. Default status to 'in_hole'.
--    c. Add batch_position, cook_date, order_date.
--    d. Partial unique indexes enforcing single 'up' / single 'on_deck'.
------------------------------------------------------------------

ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_status_check;

ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_status_check
  CHECK (status IN ('in_hole','on_deck','up','archived'));

ALTER TABLE meal_plans
  ALTER COLUMN status SET DEFAULT 'in_hole';

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS batch_position integer,
  ADD COLUMN IF NOT EXISTS cook_date      date,
  ADD COLUMN IF NOT EXISTS order_date     date;

CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_one_up_idx
  ON meal_plans (status) WHERE status = 'up';

CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_one_on_deck_idx
  ON meal_plans (status) WHERE status = 'on_deck';

CREATE INDEX IF NOT EXISTS meal_plans_status_date_idx
  ON meal_plans (status, plan_date_start);

------------------------------------------------------------------
-- 4. AMEND meal_plan_entries
--    Drop recipe_id (FK + column).
--    Add polymorphic source pointer (source_type, source_id).
--    Add locked flag.
------------------------------------------------------------------

ALTER TABLE meal_plan_entries
  DROP CONSTRAINT IF EXISTS meal_plan_entries_recipe_id_fkey;

ALTER TABLE meal_plan_entries
  DROP COLUMN IF EXISTS recipe_id;

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS source_type text
    CHECK (source_type IN ('recipe','product')),
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- Tighten polymorphic columns to NOT NULL. Table currently empty, so
-- this is safe. Validation of source_id existence is handled at the
-- API layer (no FK because source_type determines target table).
ALTER TABLE meal_plan_entries
  ALTER COLUMN source_type SET NOT NULL;
ALTER TABLE meal_plan_entries
  ALTER COLUMN source_id   SET NOT NULL;

CREATE INDEX IF NOT EXISTS meal_plan_entries_plan_date_slot_idx
  ON meal_plan_entries (plan_id, meal_date, slot);

------------------------------------------------------------------
-- 5. recipes.ingredients[].fulfillment_source
--    No schema change. Field is optional inside the existing jsonb
--    array. Documented in TS types only.
------------------------------------------------------------------

-- end of 009_provisions_planner.sql
