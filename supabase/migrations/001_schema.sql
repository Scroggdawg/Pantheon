-- Pantheon Schema v1
-- User profile
create table users (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  height_in numeric,
  dob date,
  sex text,
  starting_weight_lbs numeric,
  starting_bf_pct numeric,
  goal_weight_lbs numeric,
  goal_date date,
  goal_rate_lbs_per_week numeric,
  base_calories_target int,
  base_protein_g int,
  base_fat_g int,
  base_carbs_g int,
  created_at timestamptz default now()
);

-- Food log entries
create table food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  logged_at timestamptz default now(),
  meal_label text,
  day_type text check (day_type in ('lift', 'zone2', 'rest')),
  foods_json jsonb,
  total_calories int,
  total_protein_g numeric,
  total_carbs_g numeric,
  total_fat_g numeric,
  log_method text check (log_method in ('voice', 'photo', 'barcode', 'quick', 'manual', 'ocr')),
  raw_input_text text,
  claude_parse_json jsonb,
  created_at timestamptz default now()
);

-- Daily summaries
create table daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  date date,
  day_type text,
  total_calories int,
  total_protein_g numeric,
  total_carbs_g numeric,
  total_fat_g numeric,
  calorie_target int,
  protein_target int,
  carbs_target int,
  fat_target int,
  fully_logged boolean default false,
  unique(user_id, date)
);

-- Weight readings (Wyze Scale X)
create table weight_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  measured_at timestamptz,
  weight_lbs numeric,
  body_fat_pct numeric,
  muscle_mass_lbs numeric,
  bone_mass_lbs numeric,
  water_pct numeric,
  visceral_fat int,
  bmi numeric,
  source text check (source in ('wyze_sync', 'manual')),
  wyze_record_id text unique,
  created_at timestamptz default now()
);

-- TDEE algorithm estimates (updated weekly)
create table tdee_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  week_of date,
  tdee_cal_per_day numeric,
  calorie_target int,
  avg_weight_lbs numeric,
  weight_trend_delta_lbs numeric,
  avg_calories_logged numeric,
  regression_data_points int,
  confidence text check (confidence in ('low', 'medium', 'high')),
  algorithm_version text default 'v1',
  created_at timestamptz default now(),
  unique(user_id, week_of)
);

-- Weekly check-ins
create table weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  week_of date,
  weight_trend_lbs numeric,
  calories_avg numeric,
  protein_avg_g numeric,
  tdee_estimate numeric,
  prior_tdee_estimate numeric,
  new_calorie_target int,
  projection_goal_date_weight_lbs numeric,
  on_track boolean,
  coach_message text,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

-- Saved meals (recipe memory)
create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  name text,
  foods_json jsonb,
  total_calories int,
  total_protein_g numeric,
  total_carbs_g numeric,
  total_fat_g numeric,
  times_logged int default 0,
  last_logged_at timestamptz,
  tags text[],
  is_staple boolean default false,
  created_at timestamptz default now()
);

-- Pantry inventory
create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  name text,
  quantity numeric,
  unit text,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  barcode text,
  added_at timestamptz default now(),
  expires_at timestamptz
);

-- Workout sessions
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  trained_at timestamptz,
  session_type text check (session_type in ('lift', 'bjj', 'zone2', 'other')),
  duration_min int,
  notes text,
  raw_input_text text,
  total_volume_lbs numeric,
  created_at timestamptz default now()
);

-- Workout exercises
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions on delete cascade,
  exercise_name text,
  muscle_groups text[],
  sets_json jsonb,
  total_volume_lbs numeric,
  is_pr boolean default false
);

-- Wyze sync log
create table wyze_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  synced_at timestamptz default now(),
  records_found int,
  records_new int,
  error text,
  duration_ms int
);

-- Row Level Security
alter table users enable row level security;
alter table food_log_entries enable row level security;
alter table daily_summaries enable row level security;
alter table weight_readings enable row level security;
alter table tdee_estimates enable row level security;
alter table weekly_checkins enable row level security;
alter table saved_meals enable row level security;
alter table pantry_items enable row level security;
alter table workout_sessions enable row level security;
alter table workout_exercises enable row level security;
alter table wyze_sync_log enable row level security;

-- RLS policies (users can only see their own data)
create policy "users_own_data" on users for all using (auth.uid() = id);
create policy "food_log_own" on food_log_entries for all using (auth.uid() = user_id);
create policy "daily_own" on daily_summaries for all using (auth.uid() = user_id);
create policy "weight_own" on weight_readings for all using (auth.uid() = user_id);
create policy "tdee_own" on tdee_estimates for all using (auth.uid() = user_id);
create policy "checkins_own" on weekly_checkins for all using (auth.uid() = user_id);
create policy "meals_own" on saved_meals for all using (auth.uid() = user_id);
create policy "pantry_own" on pantry_items for all using (auth.uid() = user_id);
create policy "workouts_own" on workout_sessions for all using (auth.uid() = user_id);
create policy "exercises_own" on workout_exercises for all using (session_id in (select id from workout_sessions where user_id = auth.uid()));
create policy "sync_log_own" on wyze_sync_log for all using (auth.uid() = user_id);
