-- HealthKit workout imports need a durable external identity so Apple Watch
-- sessions do not duplicate each time the native app syncs.

ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS external_source text,
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS external_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE workout_sessions
DROP CONSTRAINT IF EXISTS workout_sessions_external_source_check;

ALTER TABLE workout_sessions
ADD CONSTRAINT workout_sessions_external_source_check
CHECK (external_source IS NULL OR external_source IN ('healthkit'));

CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_external_identity_idx
ON workout_sessions (user_id, external_source, external_id);
