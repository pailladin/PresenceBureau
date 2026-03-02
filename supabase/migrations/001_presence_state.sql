create table if not exists public.presence_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_presence_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_presence_state_updated_at on public.presence_state;
create trigger trg_presence_state_updated_at
before update on public.presence_state
for each row
execute procedure public.set_presence_state_updated_at();
