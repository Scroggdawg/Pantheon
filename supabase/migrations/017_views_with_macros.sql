-- Op FASTRAK Alpha.6 Sub-fix D — denormalize macros into recent_foods +
-- hourly_go_tos so the matcher's library shortcut cascade can construct
-- LibrarySearchResult rows directly from view output (no in-memory
-- source_ref → saved_meals/products join needed).
--
-- Per-row macros come from the most-recent log instance per (user_id,
-- lower(trim(name)), coalesce(source_ref, '')) group, picked via
-- row_number() ranking. log_count + last_logged_at remain as before.
--
-- For hourly_go_tos: weight + total_logs are summed/counted across all
-- log instances per (user_id, target_hour, dedup_key) group, but the
-- macros come from the most-recent log instance regardless of target_hour
-- (the food's macros don't change per hour).

CREATE OR REPLACE VIEW recent_foods AS
WITH ranked AS (
  SELECT
    fle.user_id,
    lower(trim(food->>'name'))           AS dedup_name,
    coalesce(food->>'source_ref', '')    AS dedup_source_ref,
    food->>'name'                         AS name,
    food->>'source_ref'                   AS source_ref,
    fle.logged_at,
    (food->>'calories')::numeric          AS calories,
    (food->>'protein_g')::numeric         AS protein_g,
    (food->>'carbs_g')::numeric           AS carbs_g,
    (food->>'fat_g')::numeric             AS fat_g,
    (food->>'qty')::numeric               AS qty,
    food->>'unit'                         AS unit,
    row_number() OVER (
      PARTITION BY
        fle.user_id,
        lower(trim(food->>'name')),
        coalesce(food->>'source_ref', '')
      ORDER BY fle.logged_at DESC
    ) AS rn
  FROM food_log_entries fle
  CROSS JOIN LATERAL jsonb_array_elements(fle.foods_json) AS food
  WHERE food->>'name' IS NOT NULL
),
counts AS (
  SELECT
    user_id,
    dedup_name,
    dedup_source_ref,
    count(*)::int   AS log_count,
    max(logged_at)  AS last_logged_at
  FROM ranked
  GROUP BY user_id, dedup_name, dedup_source_ref
)
SELECT
  r.user_id,
  r.dedup_name,
  r.dedup_source_ref,
  r.name,
  r.source_ref,
  c.last_logged_at,
  c.log_count,
  r.calories,
  r.protein_g,
  r.carbs_g,
  r.fat_g,
  r.qty,
  r.unit
FROM ranked r
JOIN counts c USING (user_id, dedup_name, dedup_source_ref)
WHERE r.rn = 1;

CREATE OR REPLACE VIEW hourly_go_tos AS
WITH log_items AS (
  SELECT
    fle.user_id,
    EXTRACT(HOUR FROM fle.logged_at)::int AS log_hour,
    fle.logged_at,
    food->>'name'                         AS name,
    food->>'source_ref'                   AS source_ref,
    lower(trim(food->>'name'))            AS dedup_name,
    coalesce(food->>'source_ref', '')     AS dedup_source_ref,
    (food->>'calories')::numeric          AS calories,
    (food->>'protein_g')::numeric         AS protein_g,
    (food->>'carbs_g')::numeric           AS carbs_g,
    (food->>'fat_g')::numeric             AS fat_g,
    (food->>'qty')::numeric               AS qty,
    food->>'unit'                         AS unit
  FROM food_log_entries fle
  CROSS JOIN LATERAL jsonb_array_elements(fle.foods_json) AS food
  WHERE food->>'name' IS NOT NULL
),
target_hours AS (
  SELECT generate_series(0, 23) AS target_hour
),
weighted AS (
  SELECT
    li.user_id,
    th.target_hour,
    li.dedup_name,
    li.dedup_source_ref,
    sum(
      exp(
        -power(
          least(
            abs(li.log_hour - th.target_hour),
            24 - abs(li.log_hour - th.target_hour)
          ),
          2
        ) / 8.0
      )
    )                                  AS weight,
    count(*)::int                      AS total_logs,
    max(li.logged_at)                  AS last_logged_at
  FROM log_items li
  CROSS JOIN target_hours th
  GROUP BY li.user_id, th.target_hour, li.dedup_name, li.dedup_source_ref
),
latest_macros AS (
  SELECT DISTINCT ON (user_id, dedup_name, dedup_source_ref)
    user_id,
    dedup_name,
    dedup_source_ref,
    name,
    source_ref,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    qty,
    unit
  FROM log_items
  ORDER BY user_id, dedup_name, dedup_source_ref, logged_at DESC
)
SELECT
  w.user_id,
  w.target_hour,
  w.dedup_name,
  w.dedup_source_ref,
  m.name,
  m.source_ref,
  w.weight,
  w.total_logs,
  w.last_logged_at,
  m.calories,
  m.protein_g,
  m.carbs_g,
  m.fat_g,
  m.qty,
  m.unit
FROM weighted w
JOIN latest_macros m USING (user_id, dedup_name, dedup_source_ref);
