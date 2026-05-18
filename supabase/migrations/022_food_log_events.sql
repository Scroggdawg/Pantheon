-- Quartermaster v1: food logging event stream.
--
-- food_log_entries only captures successful saves. This table captures the
-- user experience around the save: parse attempts, failed saves, abandoned
-- sessions, edits, candidate choices, and other signals Quartermaster needs
-- to learn from real use.

CREATE TABLE IF NOT EXISTS food_log_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  food_log_entry_id uuid REFERENCES food_log_entries(id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL CHECK (
    event_type IN (
      'parse_requested',
      'parse_returned',
      'parse_failed',
      'parse_abandoned',
      'food_item_edited',
      'food_item_deleted',
      'food_item_added',
      'disambiguation_selected',
      'save_requested',
      'save_succeeded',
      'save_failed',
      'quick_add_after_parse',
      'retry_after_parse'
    )
  ),
  raw_input_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_platform text,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_log_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_log_events_own"
  ON food_log_events FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS food_log_events_user_created_idx
  ON food_log_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS food_log_events_type_created_idx
  ON food_log_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS food_log_events_session_idx
  ON food_log_events (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS food_log_events_log_entry_idx
  ON food_log_events (food_log_entry_id)
  WHERE food_log_entry_id IS NOT NULL;
