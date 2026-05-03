-- 012_food_query_cache.sql
-- S26 Step 4b: cache search_food_database tool responses to
-- eliminate repeated USDA + OFF API calls. TTL: 30 days.

create table food_query_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  query_text text not null,
  response jsonb not null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index food_query_cache_query_key_idx
  on food_query_cache(query_key);
create index food_query_cache_expires_at_idx
  on food_query_cache(expires_at);
