alter table if exists public.presence_days
  add column if not exists morning_location text,
  add column if not exists afternoon_location text;
