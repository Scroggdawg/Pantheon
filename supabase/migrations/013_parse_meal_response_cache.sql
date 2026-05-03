-- S26 Step 4e — transcript-level response cache for parse-meal.
-- Caches full ParsedMealResponse keyed by user_id + transcript hash.
-- Bust on library write (saved_meals + products); TTL 90 days.

CREATE TABLE IF NOT EXISTS parse_meal_response_cache (
  cache_key TEXT PRIMARY KEY,  -- sha256(user_id + ':' + normalized_transcript)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  normalized_transcript TEXT NOT NULL,
  response_json JSONB NOT NULL,  -- full ParsedMealResponse minus _telemetry
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX IF NOT EXISTS idx_parse_meal_cache_user_expires
  ON parse_meal_response_cache (user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_parse_meal_cache_expires
  ON parse_meal_response_cache (expires_at);

-- RLS policies
ALTER TABLE parse_meal_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own cache"
  ON parse_meal_response_cache FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role manages cache"
  ON parse_meal_response_cache FOR ALL
  USING (auth.role() = 'service_role');
