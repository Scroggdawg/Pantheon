-- Run this in the Supabase dashboard SQL editor to allow 'withings' as a weight source
ALTER TABLE weight_readings
DROP CONSTRAINT IF EXISTS weight_readings_source_check;

ALTER TABLE weight_readings
ADD CONSTRAINT weight_readings_source_check
CHECK (source IN ('wyze_sync', 'manual', 'withings'));
