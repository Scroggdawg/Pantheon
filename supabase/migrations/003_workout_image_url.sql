-- Add image_url to workout_sessions for photo-based workout logging
ALTER TABLE workout_sessions ADD COLUMN image_url text;
