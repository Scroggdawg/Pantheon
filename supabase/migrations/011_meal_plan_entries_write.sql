-- Migration 011: UPDATE policy for meal_plan_entries
--
-- Phase B3 of the native app needs to mark entries as 'eaten' (on
-- tap-to-log) and 'skipped' (on swipe-skip). Migration 010 added
-- SELECT-only policies on the six Provisions tables; UPDATE is still
-- denied under the anon role, silently — PostgREST returns 200 [] with
-- no rows touched and no error surfaced to the client.
--
-- This adds the minimum policy needed for B3 to ship. INSERT and DELETE
-- on meal_plan_entries remain locked (out of scope for B3 — reroll/
-- regenerate flows go through service-role server routes on the web
-- side and the native app does not yet need them).
--
-- Same `USING (true)` shape as 010 — consistent with the native app's
-- bare-anon-key model where there is no Supabase auth session.

CREATE POLICY meal_plan_entries_update
  ON meal_plan_entries FOR UPDATE
  USING (true)
  WITH CHECK (true);
