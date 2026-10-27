-- Life Planner 2.26: the Beta badge is only for people who signed up by the
-- end of Sunday 1 November 2026 (Melbourne time). Everyone who already has it keeps it.
create or replace function public.set_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.badges := array_remove(array[
    case when exists (select 1 from app_roles r where r.username = new.username and r.role = 'dev') then 'dev' end,
    case when (select u.created_at from auth.users u where u.id = new.id) < timestamptz '2026-11-02 00:00:00 Australia/Melbourne' then 'beta' end
  ], null);
  return new;
end $$;
