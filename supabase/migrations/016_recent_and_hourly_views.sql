-- Op FASTRAK Alpha.6 Sub-fix A — recent_foods + hourly_go_tos views.
-- Per-user feed surfaces consumed by the Alpha.6 library shortcut cascade
-- (Sub-fix D). Plain views (not materialized) — current scale is single-
-- digit saved_meals + 10s of food_log_entries per user. Revisit if either
-- table grows past ~10k rows per user.
--
-- Dedup key on both views: (lower(trim(name)), coalesce(source_ref, '')).
-- Historical foods_json items lack source_ref (pre-Alpha.7); coalesce-to-
-- empty preserves separation when source_ref IS present (e.g. branded
-- variants) without breaking dedup on legacy rows.

CREATE OR REPLACE VIEW recent_foods AS
SELECT
  fle.user_id,
  lower(trim(food->>'name'))           AS dedup_name,
  coalesce(food->>'source_ref', '')    AS dedup_source_ref,
  (food->>'name')                      AS name,
  (food->>'source_ref')                AS source_ref,
  max(fle.logged_at)                   AS last_logged_at,
  count(*)::int                        AS log_count
FROM food_log_entries fle
CROSS JOIN LATERAL jsonb_array_elements(fle.foods_json) AS food
WHERE food->>'name' IS NOT NULL
GROUP BY
  fle.user_id,
  lower(trim(food->>'name')),
  coalesce(food->>'source_ref', ''),
  food->>'name',
  food->>'source_ref';

-- hourly_go_tos: Gaussian time-of-day weighting (sigma=2) summed over all
-- log occurrences per (user_id, target_hour 0-23). Wraps around midnight
-- via min(|h_diff|, 24-|h_diff|) so an 11pm meal scores high for 1am
-- queries (2h apart, not 22h). Frequency × proximity = MacroFactor's
-- empirical "Hourly Go-Tos" surface.
CREATE OR REPLACE VIEW hourly_go_tos AS
WITH log_hours AS (
  SELECT
    fle.user_id,
    EXTRACT(HOUR FROM fle.logged_at)::int AS log_hour,
    food->>'name'                         AS name,
    food->>'source_ref'                   AS source_ref,
    fle.logged_at
  FROM food_log_entries fle
  CROSS JOIN LATERAL jsonb_array_elements(fle.foods_json) AS food
  WHERE food->>'name' IS NOT NULL
),
target_hours AS (
  SELECT generate_series(0, 23) AS target_hour
)
SELECT
  lh.user_id,
  th.target_hour,
  lower(trim(lh.name))                AS dedup_name,
  coalesce(lh.source_ref, '')         AS dedup_source_ref,
  lh.name,
  lh.source_ref,
  sum(
    exp(
      -power(
        least(
          abs(lh.log_hour - th.target_hour),
          24 - abs(lh.log_hour - th.target_hour)
        ),
        2
      ) / 8.0
    )
  )                                   AS weight,
  count(*)::int                       AS total_logs,
  max(lh.logged_at)                   AS last_logged_at
FROM log_hours lh
CROSS JOIN target_hours th
GROUP BY
  lh.user_id,
  th.target_hour,
  lower(trim(lh.name)),
  coalesce(lh.source_ref, ''),
  lh.name,
  lh.source_ref;
