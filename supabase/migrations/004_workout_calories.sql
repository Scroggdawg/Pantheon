-- Add calorie estimation columns to workout_sessions
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS distance_miles NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_cal_burned INTEGER,
ADD COLUMN IF NOT EXISTS cal_estimate_method TEXT
  DEFAULT 'MET_estimate'
  CHECK (cal_estimate_method IN ('MET_estimate', 'user_override', 'apple_health')),
ADD COLUMN IF NOT EXISTS avg_heart_rate INTEGER,
ADD COLUMN IF NOT EXISTS perceived_effort INTEGER
  CHECK (perceived_effort BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS workout_notes TEXT;

-- Add unique constraint for Sunday check-in deduplication
ALTER TABLE weekly_checkins
ADD CONSTRAINT weekly_checkins_user_week_unique UNIQUE (user_id, week_of);
