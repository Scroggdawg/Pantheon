-- 010_provisions_rls_policies.sql
-- Add SELECT policies for the Provisions arc tables. Migrations 008 and 009
-- enabled row level security on these tables but never defined any policies,
-- which means every read returns zero rows for non-superuser/non-service
-- roles. The native iOS app uses the bare anon key with no Supabase auth
-- session, so it was being silently blocked from reading meal_plans /
-- meal_plan_entries / recipes / products / shopping_lists / user_preferences.
--
-- We mirror the de facto posture of the V1 tables (food_log_entries,
-- weight_readings, etc.) which allow anon reads in practice. Long-term, this
-- should be tightened to auth.uid()-based policies once the native app
-- authenticates to Supabase as a real user.

CREATE POLICY "meal_plans_read"
  ON meal_plans FOR SELECT USING (true);

CREATE POLICY "meal_plan_entries_read"
  ON meal_plan_entries FOR SELECT USING (true);

CREATE POLICY "recipes_read"
  ON recipes FOR SELECT USING (true);

CREATE POLICY "products_read"
  ON products FOR SELECT USING (true);

CREATE POLICY "shopping_lists_read"
  ON shopping_lists FOR SELECT USING (true);

CREATE POLICY "user_preferences_read"
  ON user_preferences FOR SELECT USING (true);
