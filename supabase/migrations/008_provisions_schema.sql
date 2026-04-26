-- 008_provisions_schema.sql
-- Provisions arc — Day 1 of 4. Adds 4 tables for
-- recipes, meal plans, plan entries, and shopping lists.
--
-- RLS enabled, no policies. Pantheon uses custom cookie auth;
-- server routes use the service role to access these tables.
-- Matches the 006_withings_tokens pattern.

CREATE TABLE IF NOT EXISTS recipes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  servings numeric NOT NULL,
  cuisine text,
  protein_type text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  source text NOT NULL CHECK (source IN ('user', 'ai_generated', 'imported')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_date_start date NOT NULL,
  plan_date_end date NOT NULL,
  daily_target_macros jsonb,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES recipes(id) ON DELETE RESTRICT,
  meal_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings numeric NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('planned', 'eaten', 'skipped', 'swapped')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_plan_date
  ON meal_plan_entries (plan_id, meal_date);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  generated_at timestamptz DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('draft', 'sent_to_agent', 'cart_filled', 'ordered', 'delivered')),
  cart_url text,
  order_total numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_plan_id
  ON shopping_lists (plan_id);
