-- Life Planner 2.29: the phone app.
-- Paste ALL of this into Supabase → SQL Editor → New query, then press Run.
-- It is safe to run more than once.
--
-- Each account gets one row holding its whole planner. The PC app and the
-- phone app both read and write it while you're logged in. Row-level security
-- means you can only ever see or change your own row.

create table if not exists public.planner_data (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  device text check (char_length(device) <= 20),
  updated_at timestamptz not null default now()
);
alter table public.planner_data enable row level security;

drop policy if exists "own planner" on public.planner_data;
create policy "own planner" on public.planner_data for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.planner_data to authenticated;

-- the server sets the time of every save, so phone and PC clocks don't matter
create or replace function public.planner_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists planner_touch on public.planner_data;
create trigger planner_touch before insert or update on public.planner_data
  for each row execute function public.planner_touch();
