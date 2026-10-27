-- Life Planner 2.32: the feedback chat.
-- Paste ALL of this into Supabase → SQL Editor → New query, then press Run.
-- It is safe to run more than once. It needs supabase-2.22.7-chats-badges.sql
-- (chats and the Dev role in app_roles) to have been run first.
--
-- "Send feedback" in the app opens a chat between that person and whoever has
-- the dev role, so bug reports and ideas arrive in the developer's Friends &
-- chats tab and can be answered there. Each person gets one feedback chat.

alter table public.chats add column if not exists kind text;

create or replace function public.feedback_chat() returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); dev uuid; c uuid; uname text;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select p.id into dev from profiles p join app_roles r on r.username = p.username and r.role = 'dev' limit 1;
  if dev is null then raise exception 'Feedback isn''t switched on yet.'; end if;
  if dev = me then raise exception 'You''re the developer: feedback from everyone else arrives in your chats.'; end if;
  select ch.id into c from chats ch join chat_members m on m.chat_id = ch.id and m.user_id = me
    where ch.kind = 'feedback' and ch.created_by = me limit 1;
  if c is null then
    select username into uname from profiles where id = me;
    insert into chats (name, is_group, created_by, kind)
      values (left('Feedback · @' || coalesce(uname, 'someone'), 40), true, me, 'feedback') returning id into c;
    insert into chat_members (chat_id, user_id) values (c, me);
  end if;
  insert into chat_members (chat_id, user_id) values (c, dev) on conflict do nothing; -- back in, if they left it
  return c;
end $$;

revoke execute on function public.feedback_chat from public, anon;
grant execute on function public.feedback_chat to authenticated;
