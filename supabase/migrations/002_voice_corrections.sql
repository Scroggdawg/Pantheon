-- Voice corrections: stores user-taught phonetic corrections for speech recognition
CREATE TABLE voice_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users ON DELETE CASCADE,
  heard text NOT NULL,
  corrected text NOT NULL,
  times_applied int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, heard)
);

ALTER TABLE voice_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrections_own" ON voice_corrections
  FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_correction_count(correction_id uuid)
RETURNS void AS $$
  UPDATE voice_corrections SET times_applied = times_applied + 1
  WHERE id = correction_id AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
