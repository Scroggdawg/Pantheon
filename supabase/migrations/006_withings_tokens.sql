-- Run this in the Supabase dashboard SQL editor BEFORE testing Withings integration
CREATE TABLE IF NOT EXISTS withings_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  withings_user_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Allow service role full access (RLS enabled but permissive for service role)
ALTER TABLE withings_tokens ENABLE ROW LEVEL SECURITY;
