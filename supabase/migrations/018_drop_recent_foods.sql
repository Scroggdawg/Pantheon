-- Op FASTRAK Alpha.6 Sub-fix D.1 — drop recent_foods view.
-- hourly_go_tos shadows recent_foods at every target_hour with non-zero
-- Gaussian weight (sigma=2 never decays to true zero), so the tier-3
-- recents branch in the matcher cascade was unreachable. Drop the view
-- to remove dead infrastructure. hourly_go_tos remains untouched.

DROP VIEW IF EXISTS recent_foods;
