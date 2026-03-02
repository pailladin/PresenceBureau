create table if not exists public.presence_members (
  id text primary key,
  name text not null,
  avatar text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.presence_days (
  member_id text not null references public.presence_members(id) on delete cascade,
  work_date date not null,
  morning_status text not null default 'empty',
  afternoon_status text not null default 'empty',
  updated_at timestamptz not null default now(),
  primary key (member_id, work_date)
);

create index if not exists idx_presence_days_work_date on public.presence_days(work_date);

create or replace function public.set_presence_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_presence_members_updated_at on public.presence_members;
create trigger trg_presence_members_updated_at
before update on public.presence_members
for each row
execute procedure public.set_presence_row_updated_at();

drop trigger if exists trg_presence_days_updated_at on public.presence_days;
create trigger trg_presence_days_updated_at
before update on public.presence_days
for each row
execute procedure public.set_presence_row_updated_at();
