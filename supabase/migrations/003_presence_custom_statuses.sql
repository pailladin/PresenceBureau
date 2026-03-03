create table if not exists public.presence_custom_statuses (
  key text primary key,
  label text not null,
  color text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.set_presence_custom_statuses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_presence_custom_statuses_updated_at on public.presence_custom_statuses;
create trigger trg_presence_custom_statuses_updated_at
before update on public.presence_custom_statuses
for each row
execute procedure public.set_presence_custom_statuses_updated_at();
