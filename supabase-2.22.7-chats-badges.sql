-- Life Planner 2.22.7: badges, unique jersey numbers, DMs and group chats.
-- Paste ALL of this into Supabase → SQL Editor → New query, then press Run.
-- It is safe to run more than once.
--
-- Before running: change ELI_USERNAME on the line marked "DEV BADGE" to your
-- own Life Planner username (lowercase, no @). Only rows in app_roles get the
-- Dev badge, and nobody can write to that table from the app.

------------------------------------------------------------------ badges
alter table public.profiles add column if not exists badges text[] not null default '{}';

-- who gets special badges; no policies, so the app can't read or change it
create table if not exists public.app_roles (
  username text primary key,
  role text not null
);
alter table public.app_roles enable row level security;
insert into public.app_roles values ('ELI_USERNAME', 'dev') on conflict do nothing; -- DEV BADGE

-- badges are worked out by the server every time a profile is saved, so
-- nobody can give themselves one. Beta = signed up before 1 January 2027.
create or replace function public.set_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.badges := array_remove(array[
    case when exists (select 1 from app_roles r where r.username = new.username and r.role = 'dev') then 'dev' end,
    case when (select u.created_at from auth.users u where u.id = new.id) < '2027-01-01' then 'beta' end
  ], null);
  return new;
end $$;
drop trigger if exists profiles_badges on public.profiles;
create trigger profiles_badges before insert or update on public.profiles
  for each row execute function public.set_badges();
update public.profiles set username = username; -- give everyone already signed up their badges

------------------------------------------------------------------ jersey numbers
alter table public.profiles add column if not exists jersey smallint check (jersey between 0 and 99);
create unique index if not exists profiles_jersey_unique on public.profiles (jersey) where jersey is not null;

------------------------------------------------------------------ chats
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  name text check (char_length(name) <= 40),
  is_group boolean not null default false,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create table if not exists public.chat_members (
  chat_id uuid not null references public.chats on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_read bigint not null default 0,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user on public.chat_members (user_id);
create table if not exists public.messages (
  id bigserial primary key,
  chat_id uuid not null references public.chats on delete cascade,
  sender uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_chat on public.messages (chat_id, id desc);
create table if not exists public.blocks (
  blocker uuid not null references public.profiles on delete cascade,
  blocked uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create table if not exists public.reports (
  id bigserial primary key,
  reporter uuid references public.profiles on delete set null,
  reported uuid references public.profiles on delete set null,
  message_id bigint,
  message_body text,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_members where chat_id = c and user_id = auth.uid());
$$;

-- you can only read chats you're in. Every change goes through the functions
-- below, which check membership and blocks, so there are no write policies.
drop policy if exists "read your chats" on public.chats;
create policy "read your chats" on public.chats for select using (public.is_member(id));
drop policy if exists "read members of your chats" on public.chat_members;
create policy "read members of your chats" on public.chat_members for select using (public.is_member(chat_id));
drop policy if exists "read messages in your chats" on public.messages;
create policy "read messages in your chats" on public.messages for select using (public.is_member(chat_id));
drop policy if exists "read your blocks" on public.blocks;
create policy "read your blocks" on public.blocks for select using (blocker = auth.uid());

create or replace function public.uid_of(name text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where username = lower(name);
$$;
create or replace function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- start a DM (names = one username) or a group (names = several, plus a title).
-- A DM with someone you already have a DM with opens that one again.
create or replace function public.start_chat(names text[], title text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c uuid; other uuid; n text; added int := 0;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if coalesce(array_length(names, 1), 0) = 0 then raise exception 'Pick someone to chat with.'; end if;
  if array_length(names, 1) > 30 then raise exception 'Groups can have up to 30 people.'; end if;
  if array_length(names, 1) = 1 and coalesce(trim(title), '') = '' then
    other := uid_of(names[1]);
    if other is null or other = me then raise exception 'No one has that username.'; end if;
    if blocked_between(me, other) then raise exception 'You can''t message @%.', lower(names[1]); end if;
    select m1.chat_id into c from chat_members m1 join chat_members m2 on m2.chat_id = m1.chat_id
      join chats ch on ch.id = m1.chat_id
      where m1.user_id = me and m2.user_id = other and not ch.is_group limit 1;
    if c is not null then return c; end if;
    insert into chats (is_group, created_by) values (false, me) returning id into c;
    insert into chat_members (chat_id, user_id) values (c, me), (c, other);
    return c;
  end if;
  insert into chats (name, is_group, created_by) values (left(nullif(trim(title), ''), 40), true, me) returning id into c;
  insert into chat_members (chat_id, user_id) values (c, me);
  foreach n in array names loop
    other := uid_of(n);
    if other is not null and other <> me and not blocked_between(me, other) then
      insert into chat_members (chat_id, user_id) values (c, other) on conflict do nothing;
      added := added + 1;
    end if;
  end loop;
  if added = 0 then delete from chats where id = c; raise exception 'None of those people can be added.'; end if;
  return c;
end $$;

create or replace function public.add_members(c uuid, names text[]) returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid; n text; added int := 0;
begin
  if not is_member(c) then raise exception 'You''re not in that chat.'; end if;
  if not (select is_group from chats where id = c) then raise exception 'Make a group to add more people.'; end if;
  if (select count(*) from chat_members where chat_id = c) + coalesce(array_length(names, 1), 0) > 30 then raise exception 'Groups can have up to 30 people.'; end if;
  foreach n in array names loop
    other := uid_of(n);
    if other is not null and not blocked_between(me, other) then
      insert into chat_members (chat_id, user_id) values (c, other) on conflict do nothing;
      if found then added := added + 1; end if;
    end if;
  end loop;
  return added;
end $$;

create or replace function public.rename_chat(c uuid, title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(c) then raise exception 'You''re not in that chat.'; end if;
  update chats set name = left(nullif(trim(title), ''), 40) where id = c and is_group;
end $$;

create or replace function public.leave_chat(c uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from chat_members where chat_id = c and user_id = auth.uid();
  delete from chats where id = c and not exists (select 1 from chat_members where chat_id = c);
end $$;

create or replace function public.send_message(c uuid, body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid bigint;
begin
  if not is_member(c) then raise exception 'You''re not in that chat.'; end if;
  body := trim(body);
  if body = '' then raise exception 'Type a message first.'; end if;
  if not (select is_group from chats where id = c) and exists (
    select 1 from chat_members m where m.chat_id = c and m.user_id <> me and blocked_between(me, m.user_id)) then
    raise exception 'You can''t message this person.';
  end if;
  if (select count(*) from messages where sender = me and created_at > now() - interval '30 seconds') >= 15 then
    raise exception 'Slow down a bit. Try again in a few seconds.';
  end if;
  insert into messages (chat_id, sender, body) values (c, me, left(body, 2000)) returning id into mid;
  update chats set last_at = now() where id = c;
  update chat_members set last_read = mid where chat_id = c and user_id = me;
  return mid;
end $$;

create or replace function public.mark_read(c uuid) returns void
language sql security definer set search_path = public as $$
  update chat_members set last_read = coalesce((select max(id) from messages where chat_id = c), 0)
  where chat_id = c and user_id = auth.uid();
$$;

create or replace function public.block_user(name text) returns void
language plpgsql security definer set search_path = public as $$
declare other uuid := uid_of(name);
begin
  if other is null or other = auth.uid() then raise exception 'No one has that username.'; end if;
  insert into blocks (blocker, blocked) values (auth.uid(), other) on conflict do nothing;
end $$;
create or replace function public.unblock_user(name text) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker = auth.uid() and blocked = public.uid_of(name);
$$;
create or replace function public.my_blocks() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.username order by p.username), '{}') from blocks b join profiles p on p.id = b.blocked where b.blocker = auth.uid();
$$;

create or replace function public.report_user(name text, msg bigint default null, why text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid := uid_of(name); txt text;
begin
  if me is null or other is null then raise exception 'No one has that username.'; end if;
  if (select count(*) from reports where reporter = me and created_at > now() - interval '1 day') >= 20 then raise exception 'You''ve sent a lot of reports today.'; end if;
  if msg is not null then select m.body into txt from messages m where m.id = msg and is_member(m.chat_id); end if;
  insert into reports (reporter, reported, message_id, message_body, reason) values (me, other, msg, txt, left(why, 500));
end $$;

-- your chat list: members, the last message, and how many you haven't read
create or replace function public.my_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(c order by c.last_at desc), '[]'::json) from (
    select ch.id, ch.name, ch.is_group, ch.last_at,
      (select json_agg(json_build_object('u', p.username, 'd', p.display, 'av', p.avatar, 'b', p.badges) order by p.username)
         from chat_members m2 join profiles p on p.id = m2.user_id where m2.chat_id = ch.id) as members,
      (select json_build_object('id', x.id, 'body', left(x.body, 120), 'at', x.created_at, 'u', (select username from profiles where id = x.sender))
         from messages x where x.chat_id = ch.id order by x.id desc limit 1) as last,
      (select count(*) from messages x where x.chat_id = ch.id and x.id > m.last_read and x.sender <> auth.uid()
         and not exists (select 1 from blocks b where b.blocker = auth.uid() and b.blocked = x.sender)) as unread
    from chat_members m join chats ch on ch.id = m.chat_id where m.user_id = auth.uid()
  ) c;
$$;

-- only logged-in people can use the chat functions
revoke execute on function public.start_chat, public.add_members, public.rename_chat, public.leave_chat,
  public.send_message, public.mark_read, public.block_user, public.unblock_user, public.my_blocks,
  public.report_user, public.my_chats from public, anon;
grant execute on function public.start_chat, public.add_members, public.rename_chat, public.leave_chat,
  public.send_message, public.mark_read, public.block_user, public.unblock_user, public.my_blocks,
  public.report_user, public.my_chats to authenticated;
